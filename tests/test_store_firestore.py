"""FirestoreStore parity tests - run against the Firestore emulator.

Skipped cleanly when no emulator is up. To run:
    firebase emulators:exec --project demo-duka --only firestore \
        ".venv/bin/python -m pytest tests/test_store_firestore.py -q"
(FIRESTORE_EMULATOR_HOST is set by emulators:exec.)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("FIRESTORE_EMULATOR_HOST"),
    reason="Firestore emulator not running (FIRESTORE_EMULATOR_HOST unset)")


@pytest.fixture(autouse=True)
def firestore_backend(monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "firestore")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "demo-duka")
    from agents.store import get_store
    get_store().reset()
    from agents.seed import seed
    seed(force=True)
    yield


def test_seed_and_reads():
    from agents.store import get_store
    store = get_store()
    assert len(store.products()) == 12
    assert store.get_customer("254711000001")["name"] == "Mama Achieng"
    orders = store.orders_for_customer("254711000001", limit=5)
    assert orders and all(o["customer_id"] == "254711000001" for o in orders)
    assert orders[0]["items"], "items must be embedded in the order doc"
    assert {(item["name"], item["qty"]) for item in orders[0]["items"]} == {
        ("Unga wa Dola 2kg", 4), ("Laundry soap bar", 3)}


def test_payment_dedup_via_doc_ids():
    from agents.store import get_store
    store = get_store()
    rows = [{"ref": "DUPX000001", "phone": "254700000001", "payer_name": "T",
             "amount": 100, "paid_at": "2026-08-20 10:00:00"}] * 3
    assert store.add_payments(rows) == 1, "create() must reject duplicate refs"
    assert store.add_payments(rows[:1]) == 0, "existing refs must remain idempotent"


def test_exact_pass_parity_on_demo_seed():
    """Same engine, same demo statement, same 2/6 result as SQLite."""
    from agents.recon_engine import run_exact_pass
    from agents.store import get_store
    stats = run_exact_pass(get_store())
    assert stats["matched"] == 2
    assert stats["residue_count"] == 4
    summary = get_store().payments_summary()
    assert summary["matched_exact"] == 2 and summary["unmatched"] == 4


def test_generator_and_engine_at_small_scale():
    from agents.recon_engine import run_exact_pass
    from agents.store import get_store
    from agents.synth.generate import generate_month
    truth = generate_month(rows=600, seed=11)
    assert truth["rows_inserted"] == truth["rows_generated"] - truth["dup_ref"]
    stats = run_exact_pass(get_store())
    assert stats["matched"] == truth["clean"] + 2
    assert stats["settle_rate"] > 0.9


@pytest.mark.asyncio
async def test_judging_profile_has_firestore_parity():
    from agents.demo_state import prepare_judge_state

    result = await prepare_judge_state(
        force=True,
        rows=1_000,
        synthetic_seed=31,
        execution_surface="firestore_emulator",
    )
    assert result["prepared"] is True
    assert result["nightly"]["exact_matched"] == (
        result["synthetic_month"]["clean"] + 2)
    assert result["nightly"]["settle_rate"] > 0.95
    assert result["approvals"] == {
        "ledger_row": 1,
        "low_confidence_order": 1,
        "restock_proposal": 1,
    }


def test_approvals_and_fuzzy_flow():
    from agents.store import get_store
    store = get_store()
    p = store.unmatched_payments(limit=1)[0]
    o = store.unpaid_orders()[0]
    aid = store.add_approval("fuzzy_match", {"payment_id": p["id"], "order_id": o["id"],
                                             "confidence": 0.9, "rationale": "t"})
    store.mark_payment_kind(p["id"], "fuzzy")
    got = store.get_approval(aid)
    assert got["status"] == "pending" and got["payload"]["order_id"] == o["id"]
    store.stamp_approval(aid, "inv-1", {**got["payload"], "interrupt_id": "i-1"})
    assert store.get_approval(aid)["invocation_id"] == "inv-1"
    store.resolve_approval(aid, "approved")
    store.link_payments([(p["id"], o["id"], "fuzzy")])
    store.set_order_status(o["id"], "paid")
    assert store.get_approval(aid)["status"] == "approved"
    assert all(x["id"] != o["id"] for x in store.unpaid_orders())


def test_messages_roundtrip():
    from agents.store import get_store
    store = get_store()
    store.add_message("254711000001", "in", "habari", channel="chat")
    store.add_message("254711000001", "out", "Karibu!", meta={"cost_usd": 0.001})
    msgs = store.messages_for("254711000001")
    assert [m["direction"] for m in msgs] == ["in", "out"]
    assert msgs[1]["meta"]["cost_usd"] == 0.001


def test_event_receipt_claim_retry_complete_and_conflict():
    from agents.store import get_store
    store = get_store()
    first = store.claim_event("evt-firestore-1", "254711000001", "hash-a")
    assert first == {"claimed": True, "status": "processing", "attempts": 1}
    active = store.claim_event("evt-firestore-1", "254711000001", "hash-a")
    assert active["claimed"] is False and active["status"] == "processing"
    store.fail_event("evt-firestore-1", "503", retryable=True)
    retry = store.claim_event("evt-firestore-1", "254711000001", "hash-a")
    assert retry["claimed"] is True and retry["attempts"] == 2
    store.complete_event("evt-firestore-1", {"reply": "ok"})
    replay = store.claim_event("evt-firestore-1", "254711000001", "hash-a")
    assert replay["status"] == "completed" and replay["result"] == {"reply": "ok"}
    conflict = store.claim_event("evt-firestore-1", "254711000001", "hash-b")
    assert conflict["status"] == "conflict"


def test_owner_sale_and_receipt_commit_exactly_once():
    from agents.store import get_store

    store = get_store()
    items = [{
        "sku": "UNGA-2KG",
        "name": "Unga wa Dola 2kg",
        "qty": 2,
        "unit_price": 195,
    }]
    first = store.create_owner_sale_once(
        "sale-firestore-1", "254711000001", "hash-a", items, "paid")
    replay = store.create_owner_sale_once(
        "sale-firestore-1", "254711000001", "hash-a", items, "paid")
    conflict = store.create_owner_sale_once(
        "sale-firestore-1", "254711000001", "hash-b", items, "paid")

    assert first["status"] == "completed" and first["idempotent"] is False
    assert replay["status"] == "completed" and replay["idempotent"] is True
    assert replay["result"]["order_id"] == first["result"]["order_id"]
    assert conflict["status"] == "conflict"
    assert len([
        order for order in store.orders_for_customer("254711000001", limit=20)
        if order.get("source_event_id") == "sale-firestore-1"
    ]) == 1


def test_message_dedupe_key_is_idempotent():
    from agents.store import get_store
    store = get_store()
    first = store.add_message("254711000001", "in", "habari",
                              dedupe_key="evt-firestore-2:in")
    second = store.add_message("254711000001", "in", "duplicate",
                               dedupe_key="evt-firestore-2:in")
    assert first == second
    msgs = store.messages_for("254711000001")
    assert len(msgs) == 1 and msgs[0]["text"] == "habari"


def test_active_session_pointer_rotation_is_transactional():
    from agents.store import get_store
    store = get_store()
    initial = store.ensure_active_session("254711000001", "u_testkey")
    assert initial["generation"] == 0
    assert store.ensure_active_session("254711000001", "u_testkey")["session_id"] == initial["session_id"]
    rotated = store.rotate_active_session("254711000001", "u_testkey")
    assert rotated["generation"] == 1
    assert store.get_active_session("254711000001")["session_id"] == rotated["session_id"]


def test_active_session_rotation_operation_is_exactly_once():
    from agents.store import get_store
    store = get_store()
    first = store.rotate_active_session_once(
        "session-firestore-1", "254711000001", "u_testkey")
    replay = store.rotate_active_session_once(
        "session-firestore-1", "254711000001", "u_testkey")
    conflict = store.rotate_active_session_once(
        "session-firestore-1", "254711000002", "u_other")
    assert first["status"] == "completed" and first["idempotent"] is False
    assert replay["status"] == "completed" and replay["idempotent"] is True
    assert replay["pointer"] == first["pointer"]
    assert conflict["status"] == "conflict"
    assert store.get_active_session("254711000001")["generation"] == 1


def test_customer_turn_lease_serializes_instances():
    from agents.store import get_store
    store = get_store()
    first = store.claim_customer_turn("254711000001", "revision-a")
    blocked = store.claim_customer_turn("254711000001", "revision-b")
    assert first["claimed"] is True
    assert blocked["claimed"] is False and blocked["owner"] == "revision-a"
    store.release_customer_turn("254711000001", "revision-a")
    assert store.claim_customer_turn(
        "254711000001", "revision-b")["claimed"] is True


def test_memory_outbox_deduplicates_retries_and_completes():
    from agents.store import get_store
    store = get_store()
    entry_id = store.enqueue_memory_summary(
        "254711000001", "u_test", "This customer usually buys 2x Unga.",
        "firestore-usual-v1")
    assert store.enqueue_memory_summary(
        "254711000001", "u_test", "This customer usually buys 2x Unga.",
        "firestore-usual-v1") == entry_id
    first = store.claim_memory_summary("254711000001")
    assert first["id"] == entry_id and first["attempts"] == 1
    store.fail_memory_summary(entry_id, "503", retryable=True)
    second = store.claim_memory_summary("254711000001")
    assert second["id"] == entry_id and second["attempts"] == 2
    store.complete_memory_summary(entry_id)
    assert store.get_memory_summary(entry_id)["status"] == "completed"
    assert store.claim_memory_summary("254711000001") is None


def test_approval_decision_state_machine():
    from agents.store import get_store
    store = get_store()
    approval_id = store.add_approval("refund", {"customer_id": "254711000001"})
    first = store.claim_approval_decision(approval_id, "approved")
    assert first["claimed"] is True and first["attempts"] == 1
    duplicate = store.claim_approval_decision(approval_id, "approved")
    assert duplicate["outcome"] == "in_progress"
    conflict = store.claim_approval_decision(approval_id, "rejected")
    assert conflict["outcome"] == "conflict"
    store.fail_approval_decision(approval_id, "503")
    retry = store.claim_approval_decision(approval_id, "approved")
    assert retry["claimed"] is True and retry["attempts"] == 2
    store.complete_approval_decision(approval_id, "approved")
    replay = store.claim_approval_decision(approval_id, "approved")
    assert replay["outcome"] == "idempotent"


def test_approval_effect_is_transactional_and_exactly_once():
    from agents.store import get_store
    store = get_store()
    approval_id = store.add_approval("ledger_row", {
        "row": {"customer_id": "walk-in", "customer_name": "walk-in",
                "description": "soda 3", "amount": 210, "paid": True},
        "reason": "test",
    })
    store.claim_approval_decision(approval_id, "approved")
    first = store.apply_approval_effect(approval_id, "approved")
    assert first["idempotent"] is False
    store.fail_approval_decision(approval_id, "revision terminated")
    store.claim_approval_decision(approval_id, "approved")
    replay = store.apply_approval_effect(approval_id, "approved")
    assert replay["idempotent"] is True
    store.complete_approval_decision(approval_id, "approved")
    assert len([order for order in store.orders_for_customer("walk-in", limit=20)
                if order["total"] == 210]) == 1
