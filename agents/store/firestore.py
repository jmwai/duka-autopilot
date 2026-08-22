"""Firestore Store backend - the cloud twin of sqlite.py.

Same Store interface, Firestore idioms underneath:
  - payments are keyed by the M-Pesa ref itself, so duplicate statement rows
    are rejected by `create()` semantics - the same deterministic dedup the
    SQLite backend gets from UNIQUE(ref), enforced by the datastore.
  - bulk paths use BulkWriter / WriteBatch (450-op chunks): a 50k-row month
    loads without 50k round trips.
  - customer_name is denormalized onto orders (no joins in Firestore).
  - ids are opaque strings (Firestore auto-ids); nothing upstream assumes
    integers - the Store seam kept id types out of the domain logic.

Local dev/tests run against the Firestore emulator (firebase.json in the
repo root): FIRESTORE_EMULATOR_HOST=127.0.0.1:8925. Deploy notes ship a
firestore.indexes.json with the two composite indexes the queries need.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class FirestoreStore:
    def __init__(self) -> None:
        self._client = None
        self._lock = threading.Lock()

    @property
    def db(self):
        if self._client is None:
            with self._lock:
                if self._client is None:
                    from google.cloud import firestore
                    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "demo-duka")
                    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
                        from google.auth.credentials import AnonymousCredentials
                        self._client = firestore.Client(
                            project=project, credentials=AnonymousCredentials())
                    else:
                        self._client = firestore.Client(
                            project=project,
                            database=os.environ.get("FIRESTORE_DATABASE", "(default)"))
        return self._client

    def _col(self, name: str):
        return self.db.collection(f"duka-{name}")

    @staticmethod
    def _doc(snap) -> dict:
        d = snap.to_dict() or {}
        d["id"] = snap.id
        return d

    # ---- lifecycle -------------------------------------------------------
    def init(self) -> None:
        return None  # collections are implicit in Firestore

    def reset(self) -> None:
        for name in ("messages", "cost_log", "approvals", "payments",
                     "orders", "customers", "products"):
            self.db.recursive_delete(self._col(name))

    # ---- catalog & customers --------------------------------------------
    def products(self) -> list[dict]:
        out = [self._doc(s) for s in self._col("products").stream()]
        return sorted(out, key=lambda p: p["name"])

    def upsert_products(self, products: list[dict]) -> None:
        batch = self.db.batch()
        for p in products:
            p = dict(p)
            batch.set(self._col("products").document(p["sku"]), p)
        batch.commit()

    def customers(self) -> list[dict]:
        out = [self._doc(s) for s in self._col("customers").stream()]
        return sorted(out, key=lambda c: c.get("name") or "")

    def get_customer(self, customer_id: str) -> dict | None:
        snap = self._col("customers").document(customer_id).get()
        return self._doc(snap) if snap.exists else None

    def upsert_customers(self, customers: list[dict]) -> None:
        bw = self.db.bulk_writer()
        for c in customers:
            c = dict(c)
            bw.set(self._col("customers").document(c["id"]), c)
        bw.close()

    # ---- orders ----------------------------------------------------------
    def _order_doc(self, customer_id: str, items: list[dict], status: str,
                   needs_review: bool, notes: str, created_at: str | None,
                   total: int | None = None, customer_name: str | None = None) -> dict:
        if customer_name is None:
            cust = self.get_customer(customer_id)
            customer_name = (cust or {}).get("name")
        return {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "status": status,
            "total": total if total is not None else
                     sum(int(i["unit_price"]) * int(i["qty"]) for i in items),
            "needs_review": bool(needs_review),
            "notes": notes,
            "items": items,
            "created_at": created_at or _now(),
        }

    def create_order(self, customer_id: str, items: list[dict], status: str,
                     needs_review: bool = False, notes: str = "",
                     created_at: str | None = None):
        ref = self._col("orders").document()
        ref.set(self._order_doc(customer_id, items, status, needs_review, notes, created_at))
        return ref.id

    def bulk_create_orders(self, orders: list[dict]) -> int:
        # denormalize names without a read per order
        names = {c["id"]: c.get("name") for c in self.customers()}
        bw = self.db.bulk_writer()
        n = 0
        for o in orders:
            ref = self._col("orders").document()
            bw.set(ref, self._order_doc(
                o["customer_id"], o.get("items", []), o["status"], False, "",
                o.get("created_at"), total=o.get("total"),
                customer_name=names.get(o["customer_id"])))
            o["id"] = ref.id
            n += 1
        bw.close()
        return n

    def orders_for_customer(self, customer_id: str, limit: int = 5) -> list[dict]:
        q = (self._col("orders").where("customer_id", "==", customer_id)
             .order_by("created_at", direction="DESCENDING").limit(limit))
        return [self._doc(s) for s in q.stream()]

    def list_orders(self, limit: int = 100) -> list[dict]:
        q = self._col("orders").order_by("created_at", direction="DESCENDING").limit(limit)
        return [self._doc(s) for s in q.stream()]

    def unpaid_orders(self) -> list[dict]:
        q = self._col("orders").where("status", "in", ["confirmed", "pending_confirmation"])
        return [self._doc(s) for s in q.stream()]

    def set_order_status(self, order_id, status: str,
                         needs_review: bool | None = None) -> None:
        patch: dict = {"status": status}
        if needs_review is not None:
            patch["needs_review"] = bool(needs_review)
        self._col("orders").document(str(order_id)).update(patch)

    # ---- payments ----------------------------------------------------------
    def add_payments(self, payments: list[dict]) -> int:
        """Doc id = M-Pesa ref; create() rejects duplicates deterministically."""
        failed = 0
        failed_lock = threading.Lock()

        def on_error(err) -> bool:
            nonlocal failed
            with failed_lock:
                failed += 1
            return False  # do not retry AlreadyExists

        bw = self.db.bulk_writer()
        bw.on_write_error(on_error)
        for p in payments:
            doc = {"ref": p["ref"], "phone": p.get("phone"),
                   "payer_name": p.get("payer_name"), "amount": int(p["amount"]),
                   "paid_at": p.get("paid_at"),
                   "matched_order_id": None, "match_kind": None}
            bw.create(self._col("payments").document(p["ref"]), doc)
        bw.close()
        return len(payments) - failed

    def unmatched_payments(self, limit: int | None = None) -> list[dict]:
        q = (self._col("payments").where("matched_order_id", "==", None)
             .where("match_kind", "==", None))
        if limit:
            q = q.limit(limit)
        return [self._doc(s) for s in q.stream()]

    def link_payments(self, links: list[tuple]) -> None:
        CHUNK = 400
        for i in range(0, len(links), CHUNK):
            batch = self.db.batch()
            for pid, oid, kind in links[i:i + CHUNK]:
                batch.update(self._col("payments").document(str(pid)),
                             {"matched_order_id": str(oid), "match_kind": kind})
                if kind == "exact":
                    batch.update(self._col("orders").document(str(oid)),
                                 {"status": "paid"})
            batch.commit()

    def mark_payment_kind(self, payment_id, kind: str) -> None:
        self._col("payments").document(str(payment_id)).update({"match_kind": kind})

    def payments_summary(self) -> dict:
        def count(q) -> int:
            agg = q.count().get()
            return int(agg[0][0].value)
        col = self._col("payments")
        return {
            "total": count(col),
            "matched_exact": count(col.where("match_kind", "==", "exact")),
            "fuzzy_proposed": count(col.where("match_kind", "==", "fuzzy")),
            "unmatched": count(col.where("matched_order_id", "==", None)
                                  .where("match_kind", "==", None)),
        }

    # ---- approvals ---------------------------------------------------------
    def add_approval(self, kind: str, payload: dict):
        ref = self._col("approvals").document()
        ref.set({"kind": kind, "payload": json.dumps(payload), "status": "pending",
                 "invocation_id": None, "created_at": _now(), "resolved_at": None})
        return ref.id

    def get_approval(self, approval_id) -> dict | None:
        snap = self._col("approvals").document(str(approval_id)).get()
        if not snap.exists:
            return None
        d = self._doc(snap)
        d["payload"] = json.loads(d["payload"])
        return d

    def pending_approvals(self) -> list[dict]:
        q = self._col("approvals").where("status", "==", "pending")
        out = [self._doc(s) for s in q.stream()]
        for a in out:
            a["payload"] = json.loads(a["payload"])
        return sorted(out, key=lambda a: a["created_at"])

    def stamp_approval(self, approval_id, invocation_id: str, payload: dict) -> None:
        self._col("approvals").document(str(approval_id)).update(
            {"invocation_id": invocation_id, "payload": json.dumps(payload)})

    def resolve_approval(self, approval_id, decision: str) -> None:
        self._col("approvals").document(str(approval_id)).update(
            {"status": decision, "resolved_at": _now()})

    # ---- messages ------------------------------------------------------------
    def add_message(self, customer_id: str, direction: str, text: str,
                    channel: str = "chat", meta: dict | None = None):
        ref = self._col("messages").document()
        ref.set({"customer_id": customer_id, "direction": direction,
                 "channel": channel, "text": text,
                 "meta": json.dumps(meta or {}), "created_at": _now()})
        return ref.id

    def messages_for(self, customer_id: str, limit: int = 50) -> list[dict]:
        q = (self._col("messages").where("customer_id", "==", customer_id)
             .order_by("created_at", direction="DESCENDING").limit(limit))
        out = [self._doc(s) for s in q.stream()]
        for m in out:
            m["meta"] = json.loads(m["meta"] or "{}")
        return list(reversed(out))

    # ---- cost metering ---------------------------------------------------------
    def log_cost(self, row: dict) -> None:
        self._col("cost_log").document().set({
            "interaction": row.get("interaction", "chat"),
            "agent_impl": row.get("agent_impl", "graph"), "model": row.get("model"),
            "input_tokens": row.get("input_tokens", 0),
            "output_tokens": row.get("output_tokens", 0),
            "cost_usd": row.get("cost_usd", 0.0), "wall_ms": row.get("wall_ms", 0),
            "node_path": row.get("node_path", ""), "created_at": _now()})

    def cost_summary(self) -> dict:
        rows = [self._doc(s) for s in self._col("cost_log").stream()]
        per: dict[str, dict] = {}
        for r in rows:
            g = per.setdefault(r["interaction"], {"interaction": r["interaction"], "n": 0,
                                                  "total_cost_usd": 0.0, "wall_ms": 0,
                                                  "input_tokens": 0, "output_tokens": 0})
            g["n"] += 1
            g["total_cost_usd"] += r.get("cost_usd") or 0
            g["wall_ms"] += r.get("wall_ms") or 0
            g["input_tokens"] += r.get("input_tokens") or 0
            g["output_tokens"] += r.get("output_tokens") or 0
        for g in per.values():
            g["avg_cost_usd"] = g["total_cost_usd"] / g["n"]
            g["avg_wall_ms"] = g["wall_ms"] / g["n"]
        recent = sorted(rows, key=lambda r: r.get("created_at") or "", reverse=True)[:20]
        return {"per_interaction": list(per.values()), "recent": recent}
