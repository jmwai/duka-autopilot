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
from contextlib import contextmanager
from pathlib import Path

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
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT,
    direction TEXT NOT NULL,              -- in | out
    channel TEXT DEFAULT 'chat',          -- chat | voice | photo | system
    text TEXT DEFAULT '',
    meta TEXT DEFAULT '{}',               -- JSON: node_path, cost, flags
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

_TABLES = ("messages", "cost_log", "approvals", "payments", "order_items",
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
                     created_at: str | None = None) -> int:
        total = sum(int(i["unit_price"]) * int(i["qty"]) for i in items)
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO orders (customer_id,status,total,needs_review,notes,created_at) "
                "VALUES (?,?,?,?,?,COALESCE(?,datetime('now')))",
                (customer_id, status, total, int(needs_review), notes, created_at))
            oid = cur.lastrowid
            c.executemany(
                "INSERT INTO order_items (order_id,sku,name,qty,unit_price) VALUES (?,?,?,?,?)",
                [(oid, i.get("sku"), i["name"], int(i["qty"]), int(i["unit_price"])) for i in items])
        return oid

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
            "SELECT id, status, total, created_at FROM orders WHERE customer_id=? "
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

    def mark_payment_kind(self, payment_id: int, kind: str) -> None:
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
        out = self._rows("SELECT * FROM approvals WHERE status='pending' ORDER BY id")
        for a in out:
            a["payload"] = json.loads(a["payload"])
        return out

    def stamp_approval(self, approval_id: int, invocation_id: str, payload: dict) -> None:
        self._exec("UPDATE approvals SET invocation_id=?, payload=? WHERE id=?",
                   (invocation_id, json.dumps(payload), approval_id))

    def resolve_approval(self, approval_id: int, decision: str) -> None:
        self._exec("UPDATE approvals SET status=?, resolved_at=datetime('now') WHERE id=?",
                   (decision, approval_id))

    # ---- messages (async channel log) ---------------------------------------
    def add_message(self, customer_id: str, direction: str, text: str,
                    channel: str = "chat", meta: dict | None = None) -> int:
        return self._exec(
            "INSERT INTO messages (customer_id,direction,channel,text,meta) VALUES (?,?,?,?,?)",
            (customer_id, direction, channel, text, json.dumps(meta or {})))

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
