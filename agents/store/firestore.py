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
import time
from hashlib import sha256
from datetime import datetime, timezone


def _now() -> str:
    # Microseconds preserve the write order of sequential channel messages.
    # Second precision allowed an inbound and outbound message from one turn to
    # tie, leaving Firestore free to return them in either order.
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


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
        for name in ("messages", "cost_log", "memory_outbox", "customer_turn_leases",
                     "event_receipts", "session_pointers",
                     "approvals", "payments",
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

    def get_order(self, order_id) -> dict | None:
        snap = self._col("orders").document(str(order_id)).get()
        return self._doc(snap) if snap.exists else None

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
        # BulkWriter seals a batch when a document path repeats. The emulator
        # can acknowledge both queued create operations before surfacing the
        # duplicate callback, which makes callback-based insert counts wrong.
        # Match SQLite's INSERT OR IGNORE semantics by retaining the first row
        # for each statement ref before scheduling any writes.
        unique: list[dict] = []
        seen_refs: set[str] = set()
        for payment in payments:
            ref = str(payment["ref"])
            if ref in seen_refs:
                continue
            seen_refs.add(ref)
            unique.append(payment)

        failed = 0
        terminal_errors: list[str] = []
        failed_lock = threading.Lock()

        def on_error(err, _bulk_writer) -> bool:
            nonlocal failed
            with failed_lock:
                if err.code == 6:  # gRPC ALREADY_EXISTS
                    failed += 1
                    return False
                if err.attempts < 5:
                    return True
                terminal_errors.append(
                    f"payment write failed with gRPC {err.code}: {err.message}")
                return False

        bw = self.db.bulk_writer()
        bw.on_write_error(on_error)
        for p in unique:
            doc = {"ref": p["ref"], "phone": p.get("phone"),
                   "payer_name": p.get("payer_name"), "amount": int(p["amount"]),
                   "paid_at": p.get("paid_at"),
                   "matched_order_id": None, "match_kind": None}
            bw.create(self._col("payments").document(p["ref"]), doc)
        bw.close()
        if terminal_errors:
            raise RuntimeError(terminal_errors[0])
        return len(unique) - failed

    def get_payment(self, payment_id) -> dict | None:
        snap = self._col("payments").document(str(payment_id)).get()
        return self._doc(snap) if snap.exists else None

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

    def mark_payment_kind(self, payment_id, kind: str | None) -> None:
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
                 "invocation_id": None, "requested_decision": None,
                 "resume_attempts": 0, "resume_lease_expires_at": 0,
                 "last_error": None, "created_at": _now(),
                 "resolved_at": None, "resumed_at": None,
                 "effect_applied_at": None, "effect_result": None})
        return ref.id

    def get_approval(self, approval_id) -> dict | None:
        snap = self._col("approvals").document(str(approval_id)).get()
        if not snap.exists:
            return None
        d = self._doc(snap)
        d["payload"] = json.loads(d["payload"])
        return d

    def pending_approvals(self) -> list[dict]:
        q = self._col("approvals").where(
            "status", "in", ["pending", "resume_failed"])
        out = [self._doc(s) for s in q.stream()]
        for a in out:
            a["payload"] = json.loads(a["payload"])
        return sorted(out, key=lambda a: a["created_at"])

    def stamp_approval(self, approval_id, invocation_id: str, payload: dict) -> None:
        self._col("approvals").document(str(approval_id)).update(
            {"invocation_id": invocation_id, "payload": json.dumps(payload)})

    def resolve_approval(self, approval_id, decision: str) -> None:
        self._col("approvals").document(str(approval_id)).update(
            {"status": decision, "requested_decision": decision,
             "resolved_at": _now()})

    def claim_approval_decision(self, approval_id, decision: str,
                                lease_seconds: int = 120) -> dict:
        from google.cloud import firestore

        ref = self._col("approvals").document(str(approval_id))
        now = int(time.time())
        transaction = self.db.transaction()

        @firestore.transactional
        def claim(txn):
            snap = ref.get(transaction=txn)
            if not snap.exists:
                return {"claimed": False, "outcome": "not_found"}
            approval = snap.to_dict() or {}
            status = approval.get("status")
            requested = approval.get("requested_decision")
            if status in ("approved", "rejected"):
                return {"claimed": False,
                        "outcome": "idempotent" if status == decision else "conflict",
                        "status": status, "decision": requested or status}
            if requested and requested != decision:
                return {"claimed": False, "outcome": "conflict",
                        "status": status, "decision": requested}
            active = (status == "resuming"
                      and int(approval.get("resume_lease_expires_at") or 0) > now)
            if active:
                return {"claimed": False, "outcome": "in_progress",
                        "status": status, "decision": requested}
            attempts = int(approval.get("resume_attempts") or 0) + 1
            txn.update(ref, {
                "status": "resuming", "requested_decision": decision,
                "resume_attempts": attempts,
                "resume_lease_expires_at": now + lease_seconds,
                "last_error": None,
            })
            return {"claimed": True, "outcome": "claimed", "status": "resuming",
                    "decision": decision, "attempts": attempts}

        return claim(transaction)

    def complete_approval_decision(self, approval_id, decision: str) -> None:
        self._col("approvals").document(str(approval_id)).update({
            "status": decision, "requested_decision": decision,
            "resume_lease_expires_at": 0, "last_error": None,
            "resolved_at": _now(), "resumed_at": _now(),
        })

    def fail_approval_decision(self, approval_id, error: str) -> None:
        self._col("approvals").document(str(approval_id)).update({
            "status": "resume_failed", "last_error": error[:500],
            "resume_lease_expires_at": 0,
        })

    def apply_approval_effect(self, approval_id, decision: str) -> dict:
        """Apply a non-refund approval effect exactly once in one transaction."""
        from google.cloud import firestore

        approval_ref = self._col("approvals").document(str(approval_id))
        transaction = self.db.transaction()

        @firestore.transactional
        def apply(txn):
            approval_snap = approval_ref.get(transaction=txn)
            if not approval_snap.exists:
                raise ValueError("approval not found")
            approval = approval_snap.to_dict() or {}
            if approval.get("effect_applied_at"):
                result = approval.get("effect_result") or {}
                return {**result, "idempotent": True}
            if approval.get("status") != "resuming":
                raise ValueError("approval effect requires a claimed decision")
            if approval.get("requested_decision") != decision:
                raise ValueError("approval decision does not match the claim")

            kind = approval.get("kind")
            if kind == "refund":
                raise ValueError("refund effects are completed by ADK resume")
            payload = json.loads(approval.get("payload") or "{}")
            result: dict = {"kind": kind, "decision": decision}
            writes: list[tuple[str, object, dict]] = []

            if kind == "fuzzy_match":
                payment_ref = self._col("payments").document(str(payload["payment_id"]))
                order_ref = self._col("orders").document(str(payload["order_id"]))
                payment_snap = payment_ref.get(transaction=txn)
                order_snap = order_ref.get(transaction=txn)
                if not payment_snap.exists or not order_snap.exists:
                    raise ValueError("fuzzy proposal references a missing entity")
                payment = payment_snap.to_dict() or {}
                if decision == "approved":
                    linked = payment.get("matched_order_id")
                    if linked is not None and str(linked) != str(payload["order_id"]):
                        raise ValueError("payment is already linked to another order")
                    writes.append(("update", payment_ref, {
                        "matched_order_id": str(payload["order_id"]),
                        "match_kind": "fuzzy",
                    }))
                    writes.append(("update", order_ref, {"status": "paid"}))
                else:
                    if payment.get("matched_order_id") is None:
                        writes.append(("update", payment_ref, {"match_kind": None}))
            elif kind == "low_confidence_order":
                order_ref = self._col("orders").document(str(payload["order_id"]))
                if not order_ref.get(transaction=txn).exists:
                    raise ValueError("order awaiting approval no longer exists")
                patch = ({"status": "pending_confirmation", "needs_review": False}
                         if decision == "approved" else {"status": "rejected"})
                writes.append(("update", order_ref, patch))
            elif kind == "ledger_row" and decision == "approved":
                row = payload.get("row") or {}
                amount = int(row.get("amount") or 0)
                if amount <= 0:
                    raise ValueError("approved ledger row requires a positive amount")
                customer_id = row.get("customer_id") or "walk-in"
                customer_ref = self._col("customers").document(customer_id)
                customer_exists = customer_ref.get(transaction=txn).exists
                order_ref = self._col("orders").document()
                if not customer_exists:
                    writes.append(("set", customer_ref, {
                        "id": customer_id,
                        "name": row.get("customer_name") or customer_id,
                        "notes": "from ledger page",
                    }))
                writes.append(("set", order_ref, {
                    "customer_id": customer_id,
                    "customer_name": row.get("customer_name") or customer_id,
                    "status": "paid" if row.get("paid") else "confirmed",
                    "total": amount, "needs_review": False,
                    "notes": "ledger row approved by owner",
                    "items": [{
                        "sku": None,
                        "name": row.get("description") or "ledger sale",
                        "qty": 1, "unit_price": amount,
                    }],
                    "created_at": _now(),
                }))
                result["order_id"] = order_ref.id

            for operation, ref, data in writes:
                if operation == "set":
                    txn.set(ref, data)
                else:
                    txn.update(ref, data)
            txn.update(approval_ref, {
                "effect_applied_at": _now(), "effect_result": result,
            })
            return {**result, "idempotent": False}

        return apply(transaction)

    # ---- event receipts ----------------------------------------------------
    @staticmethod
    def _event_doc_id(event_id: str) -> str:
        return sha256(event_id.encode()).hexdigest()

    def claim_event(self, event_id: str, customer_id: str, payload_hash: str,
                    lease_seconds: int = 120) -> dict:
        from google.cloud import firestore

        ref = self._col("event_receipts").document(self._event_doc_id(event_id))
        now = int(time.time())
        transaction = self.db.transaction()

        @firestore.transactional
        def claim(txn):
            snap = ref.get(transaction=txn)
            if not snap.exists:
                txn.set(ref, {
                    "event_id": event_id, "customer_id": customer_id,
                    "payload_hash": payload_hash, "status": "processing",
                    "attempts": 1, "lease_expires_at": now + lease_seconds,
                    "result": None, "last_error": None,
                    "created_at": _now(), "updated_at": _now(),
                })
                return {"claimed": True, "status": "processing", "attempts": 1}
            receipt = snap.to_dict() or {}
            if (receipt.get("payload_hash") != payload_hash
                    or receipt.get("customer_id") != customer_id):
                return {"claimed": False, "status": "conflict",
                        "attempts": receipt.get("attempts", 1),
                        "result": receipt.get("result")}
            reclaimable = (receipt.get("status") == "failed_retryable"
                           or (receipt.get("status") == "processing"
                               and int(receipt.get("lease_expires_at") or 0) <= now))
            if reclaimable:
                attempts = int(receipt.get("attempts") or 1) + 1
                txn.update(ref, {
                    "status": "processing", "attempts": attempts,
                    "lease_expires_at": now + lease_seconds,
                    "last_error": None, "updated_at": _now(),
                })
                return {"claimed": True, "status": "processing", "attempts": attempts}
            return {"claimed": False, "status": receipt.get("status"),
                    "attempts": receipt.get("attempts", 1),
                    "result": receipt.get("result")}

        return claim(transaction)

    def get_event(self, event_id: str) -> dict | None:
        snap = self._col("event_receipts").document(
            self._event_doc_id(event_id)).get()
        return self._doc(snap) if snap.exists else None

    def complete_event(self, event_id: str, result: dict) -> None:
        self._col("event_receipts").document(self._event_doc_id(event_id)).update({
            "status": "completed", "result": result, "last_error": None,
            "lease_expires_at": 0, "updated_at": _now(),
        })

    def fail_event(self, event_id: str, error: str, retryable: bool) -> None:
        self._col("event_receipts").document(self._event_doc_id(event_id)).update({
            "status": "failed_retryable" if retryable else "failed_permanent",
            "last_error": error[:500], "lease_expires_at": 0,
            "updated_at": _now(),
        })

    # ---- active managed-session pointer -----------------------------------
    @staticmethod
    def _customer_doc_id(customer_id: str) -> str:
        return sha256(customer_id.encode()).hexdigest()

    @staticmethod
    def _session_pointer(customer_id: str, user_id: str, generation: int) -> dict:
        return {
            "customer_id": customer_id,
            "user_id": user_id,
            "session_id": f"chat-{user_id}-{generation}",
            "generation": generation,
            "updated_at": _now(),
        }

    def get_active_session(self, customer_id: str) -> dict | None:
        snap = self._col("session_pointers").document(
            self._customer_doc_id(customer_id)).get()
        return self._doc(snap) if snap.exists else None

    def ensure_active_session(self, customer_id: str, user_id: str) -> dict:
        from google.cloud import firestore

        ref = self._col("session_pointers").document(self._customer_doc_id(customer_id))
        transaction = self.db.transaction()

        @firestore.transactional
        def ensure(txn):
            snap = ref.get(transaction=txn)
            if snap.exists:
                pointer = snap.to_dict() or {}
                if pointer.get("user_id") != user_id:
                    raise ValueError("stored user-key algorithm does not match runtime")
                return pointer
            pointer = self._session_pointer(customer_id, user_id, 0)
            txn.set(ref, pointer)
            return pointer

        return ensure(transaction)

    def rotate_active_session(self, customer_id: str, user_id: str) -> dict:
        from google.cloud import firestore

        ref = self._col("session_pointers").document(self._customer_doc_id(customer_id))
        transaction = self.db.transaction()

        @firestore.transactional
        def rotate(txn):
            snap = ref.get(transaction=txn)
            current = snap.to_dict() if snap.exists else None
            if current and current.get("user_id") != user_id:
                raise ValueError("stored user-key algorithm does not match runtime")
            generation = int((current or {}).get("generation", 0)) + 1
            pointer = self._session_pointer(customer_id, user_id, generation)
            txn.set(ref, pointer)
            return pointer

        return rotate(transaction)

    # ---- per-customer turn serialization ---------------------------------
    def claim_customer_turn(self, customer_id: str, owner: str,
                            lease_seconds: int = 180) -> dict:
        from google.cloud import firestore

        ref = self._col("customer_turn_leases").document(
            self._customer_doc_id(customer_id))
        now = int(time.time())
        transaction = self.db.transaction()

        @firestore.transactional
        def claim(txn):
            snap = ref.get(transaction=txn)
            current = snap.to_dict() if snap.exists else None
            if (current and current.get("owner") != owner
                    and int(current.get("lease_expires_at") or 0) > now):
                return {"claimed": False, "owner": current.get("owner"),
                        "lease_expires_at": current.get("lease_expires_at")}
            lease_expires_at = now + lease_seconds
            txn.set(ref, {
                "customer_id": customer_id, "owner": owner,
                "lease_expires_at": lease_expires_at, "updated_at": _now(),
            })
            return {"claimed": True, "owner": owner,
                    "lease_expires_at": lease_expires_at}

        return claim(transaction)

    def release_customer_turn(self, customer_id: str, owner: str) -> None:
        from google.cloud import firestore

        ref = self._col("customer_turn_leases").document(
            self._customer_doc_id(customer_id))
        transaction = self.db.transaction()

        @firestore.transactional
        def release(txn):
            snap = ref.get(transaction=txn)
            current = snap.to_dict() if snap.exists else None
            if current and current.get("owner") == owner:
                txn.delete(ref)

        release(transaction)

    # ---- trusted Memory Bank outbox --------------------------------------
    @staticmethod
    def _memory_doc_id(dedupe_key: str) -> str:
        return sha256(dedupe_key.encode()).hexdigest()

    def enqueue_memory_summary(self, customer_id: str, user_id: str,
                               summary: str, dedupe_key: str):
        from google.api_core.exceptions import AlreadyExists

        ref = self._col("memory_outbox").document(self._memory_doc_id(dedupe_key))
        try:
            ref.create({
                "dedupe_key": dedupe_key, "customer_id": customer_id,
                "user_id": user_id, "summary": summary, "status": "pending",
                "attempts": 0, "lease_expires_at": 0, "last_error": None,
                "created_at": _now(), "updated_at": _now(),
                "completed_at": None,
            })
        except AlreadyExists:
            pass
        return ref.id

    def claim_memory_summary(self, customer_id: str | None = None,
                             lease_seconds: int = 120) -> dict | None:
        from google.cloud import firestore

        now = int(time.time())
        query = self._col("memory_outbox").where(
            "status", "in", ["pending", "failed_retryable", "processing"]
        ).limit(25)
        candidates = []
        for snap in query.stream():
            row = self._doc(snap)
            if customer_id is not None and row.get("customer_id") != customer_id:
                continue
            if (row.get("status") == "processing"
                    and int(row.get("lease_expires_at") or 0) > now):
                continue
            candidates.append(row)
        candidates.sort(key=lambda row: row.get("created_at") or "")
        for candidate in candidates:
            ref = self._col("memory_outbox").document(candidate["id"])
            transaction = self.db.transaction()

            @firestore.transactional
            def claim(txn):
                snap = ref.get(transaction=txn)
                if not snap.exists:
                    return None
                row = snap.to_dict() or {}
                if customer_id is not None and row.get("customer_id") != customer_id:
                    return None
                status = row.get("status")
                reclaimable = status in ("pending", "failed_retryable") or (
                    status == "processing"
                    and int(row.get("lease_expires_at") or 0) <= now)
                if not reclaimable:
                    return None
                attempts = int(row.get("attempts") or 0) + 1
                lease_expires_at = now + lease_seconds
                txn.update(ref, {
                    "status": "processing", "attempts": attempts,
                    "lease_expires_at": lease_expires_at, "last_error": None,
                    "updated_at": _now(),
                })
                row.update({"id": ref.id, "status": "processing",
                            "attempts": attempts,
                            "lease_expires_at": lease_expires_at})
                return row

            claimed = claim(transaction)
            if claimed:
                return claimed
        return None

    def get_memory_summary(self, entry_id) -> dict | None:
        snap = self._col("memory_outbox").document(str(entry_id)).get()
        return self._doc(snap) if snap.exists else None

    def complete_memory_summary(self, entry_id) -> None:
        self._col("memory_outbox").document(str(entry_id)).update({
            "status": "completed", "lease_expires_at": 0,
            "last_error": None, "updated_at": _now(), "completed_at": _now(),
        })

    def fail_memory_summary(self, entry_id, error: str,
                            retryable: bool = True) -> None:
        self._col("memory_outbox").document(str(entry_id)).update({
            "status": "failed_retryable" if retryable else "failed_permanent",
            "lease_expires_at": 0, "last_error": error[:500],
            "updated_at": _now(),
        })

    # ---- messages ------------------------------------------------------------
    def add_message(self, customer_id: str, direction: str, text: str,
                    channel: str = "chat", meta: dict | None = None,
                    dedupe_key: str | None = None):
        ref = (self._col("messages").document(sha256(dedupe_key.encode()).hexdigest())
               if dedupe_key else self._col("messages").document())
        doc = {"customer_id": customer_id, "direction": direction,
               "channel": channel, "text": text,
               "meta": json.dumps(meta or {}), "created_at": _now(),
               "dedupe_key": dedupe_key}
        if dedupe_key:
            from google.api_core.exceptions import AlreadyExists
            try:
                ref.create(doc)
            except AlreadyExists:
                pass
        else:
            ref.set(doc)
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
