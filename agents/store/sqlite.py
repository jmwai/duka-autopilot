"""SQLite Store backend - local dev + keyless tests.

Ported (disclosed) from the my-duka-agent talk repo's duka_store.py, then
refactored: raw rows()/execute() calls became the domain methods in
base.Store, and bulk paths (executemany, single transaction) were added so a
50,000-row statement month loads and reconciles in seconds instead of
opening 50,000 connections.

Lives INSIDE the agents package because `adk deploy agent_engine` ships only
this folder - everything the tools touch must be importable without app.*.
DUKA_DB is read per-call (not at import) so tests can point it anywhere.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from agents.store.base import LEDGER_OWNER_AMOUNT_MAX

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price INTEGER NOT NULL,          -- KSh
    stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,                  -- phone number
    name TEXT,
    notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'pending_confirmation',
        -- pending_confirmation | needs_review | confirmed | paid | rejected
    total INTEGER NOT NULL DEFAULT 0,     -- KSh
    needs_review INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    source_event_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    sku TEXT,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT UNIQUE,                      -- M-Pesa transaction code (dedup here)
    phone TEXT,
    payer_name TEXT,
    amount INTEGER NOT NULL,
    paid_at TEXT,
    matched_order_id INTEGER REFERENCES orders(id),
    match_kind TEXT                       -- exact | fuzzy | NULL (unmatched)
);
CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,                   -- refund | low_confidence_order | fuzzy_match
    payload TEXT NOT NULL,                -- JSON
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    invocation_id TEXT,                   -- ADK resume handle (HITL)
    requested_decision TEXT,
    resume_attempts INTEGER NOT NULL DEFAULT 0,
    resume_lease_expires_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resumed_at TEXT,
    effect_applied_at TEXT,
    effect_result TEXT
);
CREATE TABLE IF NOT EXISTS event_receipts (
    event_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    lease_expires_at INTEGER NOT NULL DEFAULT 0,
    result TEXT,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS session_pointers (
    customer_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    generation INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS customer_turn_leases (
    customer_id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    lease_expires_at INTEGER NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memory_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    lease_expires_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT,
    direction TEXT NOT NULL,              -- in | out
    channel TEXT DEFAULT 'chat',          -- chat | voice | photo | system
    text TEXT DEFAULT '',
    meta TEXT DEFAULT '{}',               -- JSON: node_path, cost, flags
    dedupe_key TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interaction TEXT NOT NULL,            -- order | support | recon | chat
    agent_impl TEXT NOT NULL DEFAULT 'graph',
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    wall_ms INTEGER DEFAULT 0,
    node_path TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
-- scale: the exact pass matches on (customer phone, amount); index both sides
CREATE INDEX IF NOT EXISTS idx_payments_unmatched
    ON payments (phone, amount) WHERE matched_order_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_open
    ON orders (customer_id, total) WHERE status IN ('confirmed','pending_confirmation');
"""

_TABLES = ("messages", "cost_log", "memory_outbox", "customer_turn_leases",
           "event_receipts", "session_pointers",
           "approvals", "payments", "order_items",
           "orders", "customers", "products")


def _db_path() -> Path:
    return Path(os.environ.get("DUKA_DB", "data/duka.db"))


class SqliteStore:
    @contextmanager
    def _conn(self):
        path = _db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _rows(self, q: str, params: tuple = ()) -> list[dict]:
        with self._conn() as c:
            return [dict(r) for r in c.execute(q, params).fetchall()]

    def _exec(self, q: str, params: tuple = ()) -> int:
        with self._conn() as c:
            return c.execute(q, params).lastrowid

    # ---- lifecycle -------------------------------------------------------
    def init(self) -> None:
        with self._conn() as c:
            c.executescript(SCHEMA)
            # Existing local databases predate message idempotency. Migrate
            # additively; production schema changes follow the same rule.
            columns = {row[1] for row in c.execute("PRAGMA table_info(messages)")}
            if "dedupe_key" not in columns:
                c.execute("ALTER TABLE messages ADD COLUMN dedupe_key TEXT")
            c.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_dedupe "
                "ON messages(dedupe_key) WHERE dedupe_key IS NOT NULL")
            approval_columns = {
                row[1] for row in c.execute("PRAGMA table_info(approvals)")}
            approval_migrations = {
                "requested_decision": "TEXT",
                "resume_attempts": "INTEGER NOT NULL DEFAULT 0",
                "resume_lease_expires_at": "INTEGER NOT NULL DEFAULT 0",
                "last_error": "TEXT",
                "resumed_at": "TEXT",
                "effect_applied_at": "TEXT",
                "effect_result": "TEXT",
            }
            for name, definition in approval_migrations.items():
                if name not in approval_columns:
                    c.execute(f"ALTER TABLE approvals ADD COLUMN {name} {definition}")
            order_columns = {
                row[1] for row in c.execute("PRAGMA table_info(orders)")}
            if "source_event_id" not in order_columns:
                c.execute("ALTER TABLE orders ADD COLUMN source_event_id TEXT")

    def reset(self) -> None:
        self.init()
        with self._conn() as c:
            for t in _TABLES:
                c.execute(f"DELETE FROM {t}")

    # ---- catalog & customers --------------------------------------------
    def products(self) -> list[dict]:
        return self._rows("SELECT sku, name, unit, unit_price, stock FROM products ORDER BY name")

    def upsert_products(self, products: list[dict]) -> None:
        with self._conn() as c:
            c.executemany(
                "INSERT OR REPLACE INTO products (sku,name,unit,unit_price,stock) "
                "VALUES (:sku,:name,:unit,:unit_price,:stock)", products)

    def customers(self) -> list[dict]:
        return self._rows("SELECT id, name, notes FROM customers ORDER BY name")

    def get_customer(self, customer_id: str) -> dict | None:
        r = self._rows("SELECT id, name, notes FROM customers WHERE id=?", (customer_id,))
        return r[0] if r else None

    def upsert_customers(self, customers: list[dict]) -> None:
        with self._conn() as c:
            c.executemany(
                "INSERT OR REPLACE INTO customers (id,name,notes) "
                "VALUES (:id,:name,:notes)", customers)

    # ---- orders ----------------------------------------------------------
    def create_order(self, customer_id: str, items: list[dict], status: str,
                     needs_review: bool = False, notes: str = "",
                     created_at: str | None = None,
                     source_event_id: str | None = None) -> int:
        total = sum(int(i["unit_price"]) * int(i["qty"]) for i in items)
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO orders (customer_id,status,total,needs_review,notes,source_event_id,created_at) "
                "VALUES (?,?,?,?,?,?,COALESCE(?,datetime('now')))",
                (customer_id, status, total, int(needs_review), notes,
                 source_event_id, created_at))
            oid = cur.lastrowid
            c.executemany(
                "INSERT INTO order_items (order_id,sku,name,qty,unit_price) VALUES (?,?,?,?,?)",
                [(oid, i.get("sku"), i["name"], int(i["qty"]), int(i["unit_price"])) for i in items])
        return oid

    def create_owner_sale_once(self, event_id: str, customer_id: str,
                               payload_hash: str, items: list[dict],
                               status: str) -> dict:
        """Atomically persist a manual sale and its completed event receipt."""
        total = sum(int(i["unit_price"]) * int(i["qty"]) for i in items)
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            receipt_row = c.execute(
                "SELECT * FROM event_receipts WHERE event_id=?", (event_id,)
            ).fetchone()
            if receipt_row is not None:
                receipt = dict(receipt_row)
                result = json.loads(receipt["result"]) if receipt["result"] else None
                if (receipt["payload_hash"] != payload_hash
                        or receipt["customer_id"] != customer_id):
                    return {"status": "conflict", "idempotent": False,
                            "result": result}
                if receipt["status"] == "completed" and result:
                    return {"status": "completed", "idempotent": True,
                            "result": result}
                return {"status": receipt["status"], "idempotent": False,
                        "result": result}

            now = int(time.time())
            c.execute(
                "INSERT INTO event_receipts "
                "(event_id,customer_id,payload_hash,status,attempts,lease_expires_at) "
                "VALUES (?,?,?,?,1,?)",
                (event_id, customer_id, payload_hash, "processing", now + 120),
            )
            cursor = c.execute(
                "INSERT INTO orders "
                "(customer_id,status,total,needs_review,notes,source_event_id) "
                "VALUES (?,?,?,?,?,?)",
                (customer_id, status, total, 0,
                 "created by owner (dashboard sale)", event_id),
            )
            order_id = cursor.lastrowid
            c.executemany(
                "INSERT INTO order_items "
                "(order_id,sku,name,qty,unit_price) VALUES (?,?,?,?,?)",
                [(order_id, item.get("sku"), item["name"], int(item["qty"]),
                  int(item["unit_price"])) for item in items],
            )
            result = {
                "event_id": event_id,
                "order_id": order_id,
                "status": status,
                "total": total,
            }
            c.execute(
                "UPDATE event_receipts SET status='completed', result=?, "
                "last_error=NULL, lease_expires_at=0, updated_at=datetime('now') "
                "WHERE event_id=?",
                (json.dumps(result), event_id),
            )
            return {"status": "completed", "idempotent": False,
                    "result": result}

    def decide_order_once(self, event_id: str, order_id, payload_hash: str,
                          to_status: str, allowed_from: tuple[str, ...]) -> dict:
        """Atomically record an owner decision on one order, once."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            receipt_row = c.execute(
                "SELECT * FROM event_receipts WHERE event_id=?", (event_id,)
            ).fetchone()
            if receipt_row is not None:
                receipt = dict(receipt_row)
                result = json.loads(receipt["result"]) if receipt["result"] else None
                if receipt["payload_hash"] != payload_hash:
                    return {"status": "conflict", "idempotent": False, "result": result}
                if receipt["status"] == "completed" and result:
                    return {"status": "completed", "idempotent": True, "result": result}
                return {"status": receipt["status"], "idempotent": False, "result": result}

            order = c.execute(
                "SELECT id, customer_id, status FROM orders WHERE id=?", (order_id,)
            ).fetchone()
            if order is None:
                return {"status": "missing", "idempotent": False, "result": None}
            current = dict(order)["status"]
            if current not in allowed_from:
                # Already decided, already settled by a payment, or in the
                # approvals queue: refuse rather than overwrite the outcome.
                return {"status": "not_allowed", "idempotent": False,
                        "result": {"order_id": str(order_id), "status": current}}

            now = int(time.time())
            c.execute(
                "INSERT INTO event_receipts "
                "(event_id,customer_id,payload_hash,status,attempts,lease_expires_at) "
                "VALUES (?,?,?,?,1,?)",
                (event_id, dict(order)["customer_id"], payload_hash, "processing", now + 120),
            )
            c.execute("UPDATE orders SET status=?,needs_review=0 WHERE id=?",
                      (to_status, order_id))
            result = {"event_id": event_id, "order_id": str(order_id),
                      "status": to_status, "previous_status": current}
            c.execute(
                "UPDATE event_receipts SET status='completed', result=?, "
                "last_error=NULL, lease_expires_at=0, updated_at=datetime('now') "
                "WHERE event_id=?",
                (json.dumps(result), event_id),
            )
            return {"status": "completed", "idempotent": False, "result": result}

    def get_order(self, order_id) -> dict | None:
        rows = self._rows(
            "SELECT id, customer_id, status, total, needs_review, notes, source_event_id, created_at "
            "FROM orders WHERE id=?", (order_id,))
        if not rows:
            return None
        order = rows[0]
        order["needs_review"] = bool(order["needs_review"])
        order["items"] = self._rows(
            "SELECT sku, name, qty, unit_price FROM order_items WHERE order_id=?",
            (order_id,))
        return order

    def bulk_create_orders(self, orders: list[dict]) -> int:
        """Scale path: one transaction for the whole synthetic month."""
        n = 0
        with self._conn() as c:
            for o in orders:
                cur = c.execute(
                    "INSERT INTO orders (customer_id,status,total,created_at) VALUES (?,?,?,?)",
                    (o["customer_id"], o["status"], o["total"], o["created_at"]))
                oid = cur.lastrowid
                o["id"] = oid  # written back so the generator can pay them
                c.executemany(
                    "INSERT INTO order_items (order_id,sku,name,qty,unit_price) VALUES (?,?,?,?,?)",
                    [(oid, i.get("sku"), i["name"], int(i["qty"]), int(i["unit_price"]))
                     for i in o.get("items", [])])
                n += 1
        return n

    def orders_for_customer(self, customer_id: str, limit: int = 5) -> list[dict]:
        orders = self._rows(
            "SELECT id, status, total, source_event_id, created_at FROM orders WHERE customer_id=? "
            "ORDER BY id DESC LIMIT ?", (customer_id, limit))
        for o in orders:
            items = self._rows("SELECT name, qty, unit_price FROM order_items WHERE order_id=?", (o["id"],))
            o["items"] = items
        return orders

    def list_orders(self, limit: int = 100) -> list[dict]:
        out = self._rows(
            "SELECT o.*, c.name AS customer_name FROM orders o "
            "LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC LIMIT ?", (limit,))
        for o in out:
            o["items"] = self._rows(
                "SELECT name, qty, unit_price FROM order_items WHERE order_id=?", (o["id"],))
        return out

    def unpaid_orders(self) -> list[dict]:
        return self._rows(
            "SELECT o.id, o.customer_id, c.name AS customer_name, o.total, o.created_at "
            "FROM orders o LEFT JOIN customers c ON c.id = o.customer_id "
            "WHERE o.status IN ('confirmed','pending_confirmation')")

    def set_order_status(self, order_id: int, status: str,
                         needs_review: bool | None = None) -> None:
        if needs_review is None:
            self._exec("UPDATE orders SET status=? WHERE id=?", (status, order_id))
        else:
            self._exec("UPDATE orders SET status=?, needs_review=? WHERE id=?",
                       (status, int(needs_review), order_id))

    # ---- payments ----------------------------------------------------------
    def add_payments(self, payments: list[dict]) -> int:
        with self._conn() as c:
            before = c.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
            c.executemany(
                "INSERT OR IGNORE INTO payments (ref,phone,payer_name,amount,paid_at) "
                "VALUES (:ref,:phone,:payer_name,:amount,:paid_at)", payments)
            after = c.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        return after - before

    def get_payment(self, payment_id) -> dict | None:
        rows = self._rows("SELECT * FROM payments WHERE id=?", (payment_id,))
        return rows[0] if rows else None

    def unmatched_payments(self, limit: int | None = None) -> list[dict]:
        q = "SELECT * FROM payments WHERE matched_order_id IS NULL AND match_kind IS NULL"
        if limit:
            return self._rows(q + " LIMIT ?", (limit,))
        return self._rows(q)

    def link_payments(self, links: list[tuple[int, int, str]]) -> None:
        with self._conn() as c:
            c.executemany("UPDATE payments SET matched_order_id=?, match_kind=? WHERE id=?",
                          [(oid, kind, pid) for pid, oid, kind in links])
            c.executemany("UPDATE orders SET status='paid' WHERE id=?",
                          [(oid,) for _, oid, kind in links if kind == "exact"])

    def mark_payment_kind(self, payment_id: int, kind: str | None) -> None:
        self._exec("UPDATE payments SET match_kind=? WHERE id=?", (kind, payment_id))

    def payments_summary(self) -> dict:
        one = lambda q: self._rows(q)[0]["c"]  # noqa: E731
        return {
            "total": one("SELECT COUNT(*) c FROM payments"),
            "matched_exact": one("SELECT COUNT(*) c FROM payments WHERE match_kind='exact'"),
            "fuzzy_proposed": one("SELECT COUNT(*) c FROM payments WHERE match_kind='fuzzy'"),
            "unmatched": one("SELECT COUNT(*) c FROM payments WHERE matched_order_id IS NULL AND match_kind IS NULL"),
        }

    # ---- approvals ---------------------------------------------------------
    def add_approval(self, kind: str, payload: dict) -> int:
        return self._exec("INSERT INTO approvals (kind,payload) VALUES (?,?)",
                          (kind, json.dumps(payload)))

    def get_approval(self, approval_id: int) -> dict | None:
        r = self._rows("SELECT * FROM approvals WHERE id=?", (approval_id,))
        if not r:
            return None
        r[0]["payload"] = json.loads(r[0]["payload"])
        return r[0]

    def pending_approvals(self) -> list[dict]:
        out = self._rows(
            "SELECT * FROM approvals WHERE status IN ('pending','resume_failed') "
            "ORDER BY id")
        for a in out:
            a["payload"] = json.loads(a["payload"])
        return out

    def stamp_approval(self, approval_id: int, invocation_id: str, payload: dict) -> None:
        self._exec("UPDATE approvals SET invocation_id=?, payload=? WHERE id=?",
                   (invocation_id, json.dumps(payload), approval_id))

    def resolve_approval(self, approval_id: int, decision: str) -> None:
        self._exec(
            "UPDATE approvals SET status=?, requested_decision=?, "
            "resolved_at=datetime('now') WHERE id=?",
            (decision, decision, approval_id))

    def claim_approval_decision(self, approval_id, decision: str,
                                lease_seconds: int = 120,
                                owner_amount: int | None = None) -> dict:
        now = int(time.time())
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT status,requested_decision,resume_attempts,"
                "resume_lease_expires_at,payload FROM approvals WHERE id=?",
                (approval_id,)).fetchone()
            if row is None:
                return {"claimed": False, "outcome": "not_found"}
            status = row["status"]
            requested = row["requested_decision"]
            payload = json.loads(row["payload"])
            stored_amount = payload.get("owner_amount")
            # The typed amount is part of the decision, so it obeys the same
            # rule: the same amount replays, a different one conflicts.
            if (owner_amount is not None and stored_amount is not None
                    and int(stored_amount) != int(owner_amount)):
                return {"claimed": False, "outcome": "conflict",
                        "status": status, "decision": requested or status}
            if status in ("approved", "rejected"):
                return {"claimed": False,
                        "outcome": "idempotent" if status == decision else "conflict",
                        "status": status, "decision": requested or status}
            if requested and requested != decision:
                return {"claimed": False, "outcome": "conflict",
                        "status": status, "decision": requested}
            active = (status == "resuming"
                      and int(row["resume_lease_expires_at"] or 0) > now)
            if active:
                return {"claimed": False, "outcome": "in_progress",
                        "status": status, "decision": requested}
            attempts = int(row["resume_attempts"] or 0) + 1
            c.execute(
                "UPDATE approvals SET status='resuming',requested_decision=?,"
                "resume_attempts=?,resume_lease_expires_at=?,last_error=NULL "
                "WHERE id=?",
                (decision, attempts, now + lease_seconds, approval_id))
            if owner_amount is not None and stored_amount is None:
                # Same transaction as the claim: the effect can never read a
                # payload the claim did not agree to.
                payload["owner_amount"] = int(owner_amount)
                c.execute("UPDATE approvals SET payload=? WHERE id=?",
                          (json.dumps(payload), approval_id))
            return {"claimed": True, "outcome": "claimed", "status": "resuming",
                    "decision": decision, "attempts": attempts}

    def complete_approval_decision(self, approval_id, decision: str) -> None:
        self._exec(
            "UPDATE approvals SET status=?,requested_decision=?,"
            "resume_lease_expires_at=0,last_error=NULL,resolved_at=datetime('now'),"
            "resumed_at=datetime('now') WHERE id=? AND requested_decision=?",
            (decision, decision, approval_id, decision))

    def fail_approval_decision(self, approval_id, error: str) -> None:
        self._exec(
            "UPDATE approvals SET status='resume_failed',last_error=?,"
            "resume_lease_expires_at=0 WHERE id=? AND status='resuming'",
            (error[:500], approval_id))

    def apply_approval_effect(self, approval_id, decision: str) -> dict:
        """Apply a non-refund approval effect exactly once in one transaction."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            approval = c.execute(
                "SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
            if approval is None:
                raise ValueError("approval not found")
            if approval["effect_applied_at"]:
                result = json.loads(approval["effect_result"] or "{}")
                return {**result, "idempotent": True}
            if approval["status"] != "resuming":
                raise ValueError("approval effect requires a claimed decision")
            if approval["requested_decision"] != decision:
                raise ValueError("approval decision does not match the claim")

            kind = approval["kind"]
            if kind == "refund":
                raise ValueError("refund effects are completed by ADK resume")
            payload = json.loads(approval["payload"])
            result: dict = {"kind": kind, "decision": decision}

            if kind == "fuzzy_match":
                payment_id = payload["payment_id"]
                order_id = payload["order_id"]
                payment = c.execute(
                    "SELECT matched_order_id FROM payments WHERE id=?",
                    (payment_id,)).fetchone()
                order = c.execute(
                    "SELECT id FROM orders WHERE id=?", (order_id,)).fetchone()
                if payment is None or order is None:
                    raise ValueError("fuzzy proposal references a missing entity")
                if decision == "approved":
                    if (payment["matched_order_id"] is not None
                            and str(payment["matched_order_id"]) != str(order_id)):
                        raise ValueError("payment is already linked to another order")
                    c.execute(
                        "UPDATE payments SET matched_order_id=?,match_kind='fuzzy' "
                        "WHERE id=?", (order_id, payment_id))
                    c.execute("UPDATE orders SET status='paid' WHERE id=?", (order_id,))
                else:
                    c.execute(
                        "UPDATE payments SET match_kind=NULL "
                        "WHERE id=? AND matched_order_id IS NULL", (payment_id,))
            elif kind == "low_confidence_order":
                order_id = payload["order_id"]
                row = c.execute("SELECT id FROM orders WHERE id=?", (order_id,)).fetchone()
                if row is None:
                    raise ValueError("order awaiting approval no longer exists")
                if decision == "approved":
                    c.execute(
                        "UPDATE orders SET status='pending_confirmation',needs_review=0 "
                        "WHERE id=?", (order_id,))
                else:
                    c.execute("UPDATE orders SET status='rejected' WHERE id=?", (order_id,))
            elif kind == "ledger_row" and decision == "approved":
                row = payload.get("row") or {}
                # The owner may supply the amount the model could not read.
                # The extracted row is never overwritten, so the trail keeps
                # what the model saw next to what the owner said.
                owner_amount = payload.get("owner_amount")
                owner_entered = owner_amount is not None
                amount = int(owner_amount) if owner_entered else int(row.get("amount") or 0)
                if amount <= 0:
                    raise ValueError("approved ledger row requires a positive amount")
                if amount > LEDGER_OWNER_AMOUNT_MAX and owner_entered:
                    raise ValueError("owner-entered ledger amount exceeds the limit")
                customer_id = row.get("customer_id") or "walk-in"
                c.execute(
                    "INSERT OR IGNORE INTO customers (id,name,notes) VALUES (?,?,?)",
                    (customer_id, row.get("customer_name") or customer_id,
                     "from ledger page"))
                cur = c.execute(
                    "INSERT INTO orders "
                    "(customer_id,status,total,needs_review,notes,source_event_id) "
                    "VALUES (?,?,?,?,?,?)",
                    (customer_id, "paid" if row.get("paid") else "confirmed",
                     amount, 0,
                     "ledger row approved by owner; amount entered by owner"
                     if owner_entered else "ledger row approved by owner",
                     payload.get("source_event_id")))
                order_id = cur.lastrowid
                c.execute(
                    "INSERT INTO order_items "
                    "(order_id,sku,name,qty,unit_price) VALUES (?,?,?,?,?)",
                    (order_id, None, row.get("description") or "ledger sale", 1, amount))
                result["order_id"] = order_id
                result["amount"] = amount
                result["amount_source"] = "owner" if owner_entered else "extracted"

            c.execute(
                "UPDATE approvals SET effect_applied_at=datetime('now'),effect_result=? "
                "WHERE id=?", (json.dumps(result), approval_id))
            return {**result, "idempotent": False}

    # ---- event receipts ----------------------------------------------------
    def claim_event(self, event_id: str, customer_id: str, payload_hash: str,
                    lease_seconds: int = 120) -> dict:
        now = int(time.time())
        lease_until = now + lease_seconds
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT * FROM event_receipts WHERE event_id=?", (event_id,)).fetchone()
            if row is None:
                c.execute(
                    "INSERT INTO event_receipts "
                    "(event_id,customer_id,payload_hash,status,attempts,lease_expires_at) "
                    "VALUES (?,?,?,?,1,?)",
                    (event_id, customer_id, payload_hash, "processing", lease_until))
                return {"claimed": True, "status": "processing", "attempts": 1}
            receipt = dict(row)
            receipt["result"] = json.loads(receipt["result"]) if receipt["result"] else None
            if receipt["payload_hash"] != payload_hash or receipt["customer_id"] != customer_id:
                return {"claimed": False, "status": "conflict",
                        "attempts": receipt["attempts"], "result": receipt["result"]}
            reclaimable = (receipt["status"] == "failed_retryable"
                           or (receipt["status"] == "processing"
                               and int(receipt["lease_expires_at"] or 0) <= now))
            if reclaimable:
                attempts = int(receipt["attempts"]) + 1
                c.execute(
                    "UPDATE event_receipts SET status='processing', attempts=?, "
                    "lease_expires_at=?, last_error=NULL, updated_at=datetime('now') "
                    "WHERE event_id=?", (attempts, lease_until, event_id))
                return {"claimed": True, "status": "processing", "attempts": attempts}
            return {"claimed": False, "status": receipt["status"],
                    "attempts": receipt["attempts"], "result": receipt["result"]}

    def get_event(self, event_id: str) -> dict | None:
        rows = self._rows("SELECT * FROM event_receipts WHERE event_id=?", (event_id,))
        if not rows:
            return None
        receipt = rows[0]
        receipt["result"] = json.loads(receipt["result"]) if receipt["result"] else None
        return receipt

    def complete_event(self, event_id: str, result: dict) -> None:
        self._exec(
            "UPDATE event_receipts SET status='completed', result=?, last_error=NULL, "
            "lease_expires_at=0, updated_at=datetime('now') WHERE event_id=?",
            (json.dumps(result), event_id))

    def fail_event(self, event_id: str, error: str, retryable: bool) -> None:
        status = "failed_retryable" if retryable else "failed_permanent"
        self._exec(
            "UPDATE event_receipts SET status=?, last_error=?, lease_expires_at=0, "
            "updated_at=datetime('now') WHERE event_id=?",
            (status, error[:500], event_id))

    # ---- active managed-session pointer -----------------------------------
    @staticmethod
    def _session_pointer(customer_id: str, user_id: str, generation: int) -> dict:
        """Reserve the pointer unbound; the session service assigns the id.

        Empty string rather than NULL keeps the column NOT NULL and keeps the
        unbound test (`not pointer["session_id"]`) identical in both backends.
        """
        return {
            "customer_id": customer_id,
            "user_id": user_id,
            "session_id": "",
            "generation": generation,
        }

    def get_active_session(self, customer_id: str) -> dict | None:
        rows = self._rows(
            "SELECT customer_id,user_id,session_id,generation,updated_at "
            "FROM session_pointers WHERE customer_id=?", (customer_id,))
        return rows[0] if rows else None

    def ensure_active_session(self, customer_id: str, user_id: str) -> dict:
        pointer = self._session_pointer(customer_id, user_id, 0)
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            c.execute(
                "INSERT OR IGNORE INTO session_pointers "
                "(customer_id,user_id,session_id,generation) VALUES (?,?,?,0)",
                (customer_id, user_id, pointer["session_id"]))
            row = c.execute(
                "SELECT customer_id,user_id,session_id,generation,updated_at "
                "FROM session_pointers WHERE customer_id=?", (customer_id,)).fetchone()
            result = dict(row)
            if result["user_id"] != user_id:
                raise ValueError("stored user-key algorithm does not match runtime")
            return result

    def bind_active_session(self, customer_id: str, user_id: str, generation: int,
                            session_id: str,
                            expected_session_id: str = "") -> dict:
        """Compare-and-set the service-assigned session id onto the pointer.

        Loses deliberately when another binder got there first or when the
        generation moved on, so a stale binder can never clobber a rotation.
        """
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT customer_id,user_id,session_id,generation,updated_at "
                "FROM session_pointers WHERE customer_id=?", (customer_id,)).fetchone()
            if row is None:
                c.execute(
                    "INSERT INTO session_pointers "
                    "(customer_id,user_id,session_id,generation) VALUES (?,?,?,?)",
                    (customer_id, user_id, session_id, generation))
                return {"bound": True, "pointer": self._session_pointer(
                    customer_id, user_id, generation) | {"session_id": session_id}}
            current = dict(row)
            if current["user_id"] != user_id:
                raise ValueError("stored user-key algorithm does not match runtime")
            if current["session_id"] == session_id:
                return {"bound": True, "pointer": current}
            if (int(current["generation"]) != generation
                    or (current["session_id"] or "") != (expected_session_id or "")):
                return {"bound": False, "pointer": current}
            c.execute(
                "UPDATE session_pointers SET session_id=?,updated_at=datetime('now') "
                "WHERE customer_id=?", (session_id, customer_id))
            return {"bound": True, "pointer": current | {"session_id": session_id}}

    def rotate_active_session(self, customer_id: str, user_id: str) -> dict:
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT user_id,generation FROM session_pointers WHERE customer_id=?",
                (customer_id,)).fetchone()
            if row is None:
                generation = 1
            else:
                if row["user_id"] != user_id:
                    raise ValueError("stored user-key algorithm does not match runtime")
                generation = int(row["generation"]) + 1
            pointer = self._session_pointer(customer_id, user_id, generation)
            c.execute(
                "INSERT INTO session_pointers (customer_id,user_id,session_id,generation) "
                "VALUES (?,?,?,?) ON CONFLICT(customer_id) DO UPDATE SET "
                "user_id=excluded.user_id,session_id=excluded.session_id,"
                "generation=excluded.generation,updated_at=datetime('now')",
                (customer_id, user_id, pointer["session_id"], generation))
            return pointer

    def rotate_active_session_once(self, event_id: str, customer_id: str,
                                   user_id: str) -> dict:
        """Atomically rotate the pointer once for one owner operation ID."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            receipt_row = c.execute(
                "SELECT * FROM event_receipts WHERE event_id=?", (event_id,)
            ).fetchone()
            if receipt_row is not None:
                receipt = dict(receipt_row)
                result = json.loads(receipt["result"]) if receipt["result"] else None
                if (receipt["customer_id"] != customer_id
                        or receipt["payload_hash"] != user_id):
                    return {"status": "conflict", "idempotent": False,
                            "pointer": result}
                if receipt["status"] == "completed" and result:
                    return {"status": "completed", "idempotent": True,
                            "pointer": result}
                return {"status": receipt["status"], "idempotent": False,
                        "pointer": result}

            row = c.execute(
                "SELECT user_id,generation FROM session_pointers WHERE customer_id=?",
                (customer_id,),
            ).fetchone()
            if row is None:
                generation = 1
            else:
                if row["user_id"] != user_id:
                    raise ValueError("stored user-key algorithm does not match runtime")
                generation = int(row["generation"]) + 1
            pointer = self._session_pointer(customer_id, user_id, generation)
            c.execute(
                "INSERT INTO session_pointers "
                "(customer_id,user_id,session_id,generation) VALUES (?,?,?,?) "
                "ON CONFLICT(customer_id) DO UPDATE SET "
                "user_id=excluded.user_id,session_id=excluded.session_id,"
                "generation=excluded.generation,updated_at=datetime('now')",
                (customer_id, user_id, pointer["session_id"], generation),
            )
            c.execute(
                "INSERT INTO event_receipts "
                "(event_id,customer_id,payload_hash,status,attempts,"
                "lease_expires_at,result) VALUES (?,?,?,?,1,0,?)",
                (event_id, customer_id, user_id, "completed",
                 json.dumps(pointer)),
            )
            return {"status": "completed", "idempotent": False,
                    "pointer": pointer}

    # ---- per-customer turn serialization ---------------------------------
    def claim_customer_turn(self, customer_id: str, owner: str,
                            lease_seconds: int = 180) -> dict:
        now = int(time.time())
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute(
                "SELECT owner,lease_expires_at FROM customer_turn_leases "
                "WHERE customer_id=?", (customer_id,)).fetchone()
            if row and row["owner"] != owner and int(row["lease_expires_at"]) > now:
                return {"claimed": False, "owner": row["owner"],
                        "lease_expires_at": int(row["lease_expires_at"])}
            lease_expires_at = now + lease_seconds
            c.execute(
                "INSERT INTO customer_turn_leases "
                "(customer_id,owner,lease_expires_at) VALUES (?,?,?) "
                "ON CONFLICT(customer_id) DO UPDATE SET owner=excluded.owner,"
                "lease_expires_at=excluded.lease_expires_at,updated_at=datetime('now')",
                (customer_id, owner, lease_expires_at))
            return {"claimed": True, "owner": owner,
                    "lease_expires_at": lease_expires_at}

    def release_customer_turn(self, customer_id: str, owner: str) -> None:
        self._exec(
            "DELETE FROM customer_turn_leases WHERE customer_id=? AND owner=?",
            (customer_id, owner))

    # ---- trusted Memory Bank outbox --------------------------------------
    def enqueue_memory_summary(self, customer_id: str, user_id: str,
                               summary: str, dedupe_key: str) -> int:
        with self._conn() as c:
            c.execute(
                "INSERT OR IGNORE INTO memory_outbox "
                "(dedupe_key,customer_id,user_id,summary) VALUES (?,?,?,?)",
                (dedupe_key, customer_id, user_id, summary))
            row = c.execute(
                "SELECT id FROM memory_outbox WHERE dedupe_key=?",
                (dedupe_key,)).fetchone()
            return int(row["id"])

    def claim_memory_summary(self, customer_id: str | None = None,
                             lease_seconds: int = 120) -> dict | None:
        now = int(time.time())
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            params: list[object] = [now]
            customer_filter = ""
            if customer_id is not None:
                customer_filter = " AND customer_id=?"
                params.append(customer_id)
            row = c.execute(
                "SELECT * FROM memory_outbox WHERE "
                "(status IN ('pending','failed_retryable') OR "
                "(status='processing' AND lease_expires_at<=?))"
                + customer_filter + " ORDER BY id LIMIT 1", tuple(params)).fetchone()
            if row is None:
                return None
            attempts = int(row["attempts"] or 0) + 1
            c.execute(
                "UPDATE memory_outbox SET status='processing',attempts=?,"
                "lease_expires_at=?,last_error=NULL,updated_at=datetime('now') "
                "WHERE id=?", (attempts, now + lease_seconds, row["id"]))
            claimed = dict(row)
            claimed.update({"status": "processing", "attempts": attempts,
                            "lease_expires_at": now + lease_seconds})
            return claimed

    def get_memory_summary(self, entry_id) -> dict | None:
        rows = self._rows("SELECT * FROM memory_outbox WHERE id=?", (entry_id,))
        return rows[0] if rows else None

    def complete_memory_summary(self, entry_id) -> None:
        self._exec(
            "UPDATE memory_outbox SET status='completed',lease_expires_at=0,"
            "last_error=NULL,updated_at=datetime('now'),completed_at=datetime('now') "
            "WHERE id=? AND status='processing'", (entry_id,))

    def fail_memory_summary(self, entry_id, error: str,
                            retryable: bool = True) -> None:
        status = "failed_retryable" if retryable else "failed_permanent"
        self._exec(
            "UPDATE memory_outbox SET status=?,lease_expires_at=0,last_error=?,"
            "updated_at=datetime('now') WHERE id=? AND status='processing'",
            (status, error[:500], entry_id))

    # ---- messages (async channel log) ---------------------------------------
    def add_message(self, customer_id: str, direction: str, text: str,
                    channel: str = "chat", meta: dict | None = None,
                    dedupe_key: str | None = None) -> int:
        with self._conn() as c:
            c.execute(
                "INSERT OR IGNORE INTO messages "
                "(customer_id,direction,channel,text,meta,dedupe_key) VALUES (?,?,?,?,?,?)",
                (customer_id, direction, channel, text, json.dumps(meta or {}), dedupe_key))
            if dedupe_key is not None:
                row = c.execute(
                    "SELECT id FROM messages WHERE dedupe_key=?", (dedupe_key,)).fetchone()
                return int(row[0])
            return int(c.execute("SELECT last_insert_rowid()").fetchone()[0])

    def messages_for(self, customer_id: str, limit: int = 50) -> list[dict]:
        out = self._rows(
            "SELECT * FROM messages WHERE customer_id=? ORDER BY id DESC LIMIT ?",
            (customer_id, limit))
        for m in out:
            m["meta"] = json.loads(m["meta"] or "{}")
        return list(reversed(out))

    # ---- cost metering -------------------------------------------------------
    def log_cost(self, row: dict) -> None:
        self._exec(
            "INSERT INTO cost_log (interaction,agent_impl,model,input_tokens,output_tokens,"
            "cost_usd,wall_ms,node_path) VALUES (?,?,?,?,?,?,?,?)",
            (row.get("interaction", "chat"), row.get("agent_impl", "graph"), row.get("model"),
             row.get("input_tokens", 0), row.get("output_tokens", 0),
             row.get("cost_usd", 0.0), row.get("wall_ms", 0), row.get("node_path", "")))

    def cost_summary(self) -> dict:
        return {
            "per_interaction": self._rows(
                "SELECT interaction, COUNT(*) n, AVG(cost_usd) avg_cost_usd, SUM(cost_usd) total_cost_usd, "
                "AVG(wall_ms) avg_wall_ms, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens "
                "FROM cost_log GROUP BY interaction"),
            "recent": self._rows("SELECT * FROM cost_log ORDER BY id DESC LIMIT 20"),
        }
