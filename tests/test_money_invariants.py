"""Money invariants - ported (disclosed) from the talk repo's eval suite.

No code path may move money without a human: fuzzy proposals never mark
paid, low-confidence orders gate on approval, the refund gate suspends the
workflow and only resumes on the owner's decision. Keyless.
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    from agents.seed import seed
    seed(force=True)


def test_demo_exact_recon_settles_two_of_six():
    from agents.recon_engine import run_exact_pass
    stats = run_exact_pass(get_store())
    assert stats["matched"] == 2
    assert stats["residue_count"] == 4


def test_fuzzy_match_never_marks_paid():
    from agents.tools.recon import record_fuzzy_match
    store = get_store()
    payment = store.unmatched_payments(limit=1)[0]
    order = store.unpaid_orders()[0]
    result = record_fuzzy_match(str(payment["id"]), str(order["id"]), 0.9,
                                "test rationale")
    assert result["status"] == "pending_owner_approval"
    # the proposal is queued for the owner...
    pending = [a for a in store.pending_approvals() if a["kind"] == "fuzzy_match"]
    assert len(pending) == 1
    # ...but NO money moved: payment unlinked, order not paid
    assert all(p["id"] != payment["id"] for p in store.unmatched_payments())
    assert any(o["id"] == order["id"] for o in store.unpaid_orders()), "order must NOT be paid"
    summary = store.payments_summary()
    assert summary["matched_exact"] == 0


def test_fuzzy_proposal_deduplicates_and_rejection_restores_residue():
    from fastapi.testclient import TestClient

    from agents.tools.recon import record_fuzzy_match
    from app.main import app
    store = get_store()
    payment = store.unmatched_payments(limit=1)[0]
    order = store.unpaid_orders()[0]
    first = record_fuzzy_match(str(payment["id"]), str(order["id"]), 0.8, "variant")
    second = record_fuzzy_match(str(payment["id"]), str(order["id"]), 0.7, "again")
    assert second["duplicate"] is True and second["approval_id"] == first["approval_id"]
    with TestClient(app) as client:
        response = client.post(f"/approvals/{first['approval_id']}",
                               json={"decision": "rejected"})
    assert response.status_code == 200
    assert any(str(p["id"]) == str(payment["id"])
               for p in store.unmatched_payments())


def test_fuzzy_proposal_rejects_invalid_entities_and_confidence():
    from agents.tools.recon import record_fuzzy_match
    store = get_store()
    before = len(store.pending_approvals())
    assert record_fuzzy_match("missing", "missing", 0.9, "x")["status"] == "error"
    payment = store.unmatched_payments(limit=1)[0]
    order = store.unpaid_orders()[0]
    assert record_fuzzy_match(str(payment["id"]), str(order["id"]), 1.5, "x")["status"] == "error"
    assert len(store.pending_approvals()) == before


def test_save_order_confidence_gate():
    from agents.tools.orders import save_order
    tool_ctx = SimpleNamespace(state={
        "customer_id": "254711000001",
        "source_event_id": "evt-grounded-order-1",
    })
    confident = save_order(
        [{"sku": "UNGA-2KG", "name": "tampered", "qty": 2, "unit_price": 1}],
        confidence=0.95, notes="", tool_context=tool_ctx)
    assert confident["needs_review"] is False
    assert confident["total"] == 390, "catalog price must override model input"
    assert get_store().get_order(confident["order_id"])[
        "source_event_id"] == "evt-grounded-order-1"
    doubtful = save_order(
        [{"sku": "UNGA-2KG", "qty": 2}], confidence=0.5,
        notes="ambiguous", tool_context=tool_ctx)
    assert doubtful["needs_review"] is True
    unknown_sku = save_order(
        [{"sku": None, "qty": 2}], confidence=0.95, notes="",
        tool_context=tool_ctx)
    assert unknown_sku["status"] == "error" and unknown_sku["order_id"] is None
    gates = [a for a in get_store().pending_approvals() if a["kind"] == "low_confidence_order"]
    assert len(gates) == 1
    assert gates[0]["payload"]["source_event_id"] == "evt-grounded-order-1"


@pytest.mark.parametrize("items,confidence", [
    ([], 0.9),
    ([{"sku": "UNGA-2KG", "qty": 0}], 0.9),
    ([{"sku": "UNGA-2KG", "qty": -1}], 0.9),
    ([{"sku": "UNGA-2KG", "qty": 1.5}], 0.9),
    ([{"sku": "UNGA-2KG", "qty": 1}], 1.5),
])
def test_save_order_rejects_invalid_business_inputs(items, confidence):
    from agents.tools.orders import save_order
    before = len(get_store().list_orders())
    result = save_order(
        items, confidence=confidence, notes="",
        tool_context=SimpleNamespace(state={"customer_id": "254711000001"}))
    assert result["status"] == "error"
    assert len(get_store().list_orders()) == before


def test_save_order_rejects_unknown_customer_scope():
    from agents.tools.orders import save_order
    result = save_order(
        [{"sku": "UNGA-2KG", "qty": 1}], confidence=0.9, notes="",
        tool_context=SimpleNamespace(state={"customer_id": "254799999999"}))
    assert result["status"] == "error" and result["error"] == "unknown customer"


def _gate_ctx(state: dict, resume_inputs: dict | None = None):
    return SimpleNamespace(
        state=state,
        resume_inputs=resume_inputs or {},
        invocation_id="e-test-invocation",
        session=SimpleNamespace(id="chat-test-0"),
    )


def test_refund_gate_noop_without_request():
    from agents.refund_gate import gate_refund
    assert gate_refund(_gate_ctx({})) is None


def test_refund_gate_suspends_then_resumes():
    from google.adk.events.request_input import RequestInput

    from agents.refund_gate import gate_refund
    from agents.tools.orders import request_refund

    r = request_refund("6", "broken eggs", SimpleNamespace(
        state={"customer_id": "254711000006"}))
    state = {"refund_request": {"approval_id": r["approval_id"], "customer_id": "254711000006",
                                "order_id": 6, "reason": "broken eggs"}}

    # first pass: suspend + stamp resume handles on the approvals row
    out = gate_refund(_gate_ctx(state))
    assert isinstance(out, RequestInput)
    row = get_store().get_approval(r["approval_id"])
    assert row["invocation_id"] == "e-test-invocation"
    assert row["payload"]["interrupt_id"] == out.interrupt_id
    assert row["payload"]["session_id"] == "chat-test-0"

    # resume approved: confirmation content, flag cleared
    ctx = _gate_ctx(dict(state), {out.interrupt_id: {"decision": "approved"}})
    resumed = gate_refund(ctx)
    text = resumed.parts[0].text
    assert "approved" in text.lower()
    assert ctx.state["refund_request"] is None

    # resume rejected: decline message, no approval language
    ctx = _gate_ctx(dict(state), {out.interrupt_id: {"decision": "rejected"}})
    text = gate_refund(ctx).parts[0].text
    assert "could not approve" in text.lower()


def test_refund_rejects_another_customers_order_and_deduplicates():
    from agents.tools.orders import request_refund
    wrong = request_refund("1", "not mine", SimpleNamespace(
        state={"customer_id": "254711000006"}))
    assert wrong["status"] == "error"
    ctx = SimpleNamespace(state={"customer_id": "254711000006"})
    first = request_refund("6", "broken eggs", ctx)
    second = request_refund("6", "same request", ctx)
    assert first["duplicate"] is False
    assert second == {"status": "pending_owner_approval",
                      "approval_id": first["approval_id"], "duplicate": True}


def test_refund_resume_failure_is_retryable_and_decision_is_idempotent(monkeypatch):
    from fastapi.testclient import TestClient

    from app import runner
    from app.main import app
    store = get_store()
    payload = {
        "customer_id": "254711000006", "order_id": "6", "reason": "broken",
        "session_id": "chat-test", "interrupt_id": "refund-test",
    }
    approval_id = store.add_approval("refund", payload)
    store.stamp_approval(approval_id, "inv-test", payload)
    calls = []

    async def fail_once(**kwargs):
        calls.append(kwargs)
        raise RuntimeError("503 session service unavailable")

    monkeypatch.setattr(runner, "resume_refund", fail_once)
    with TestClient(app) as client:
        first = client.post(f"/approvals/{approval_id}",
                            json={"decision": "approved"})
        assert first.status_code == 503
        failed = store.get_approval(approval_id)
        assert failed["status"] == "resume_failed"
        assert failed["requested_decision"] == "approved"

        async def succeeds(**kwargs):
            calls.append(kwargs)
            return "The refund proposal was approved for manual completion."

        monkeypatch.setattr(runner, "resume_refund", succeeds)
        second = client.post(f"/approvals/{approval_id}",
                             json={"decision": "approved"})
        assert second.status_code == 200 and second.json()["idempotent"] is False
        replay = client.post(f"/approvals/{approval_id}",
                             json={"decision": "approved"})
        assert replay.status_code == 200 and replay.json()["idempotent"] is True
        conflict = client.post(f"/approvals/{approval_id}",
                               json={"decision": "rejected"})
        assert conflict.status_code == 409

    completed = store.get_approval(approval_id)
    assert completed["status"] == "approved" and completed["resume_attempts"] == 2
    assert len(calls) == 2
    replies = [m for m in store.messages_for("254711000006")
               if m["meta"].get("approval_id") == str(approval_id)]
    assert len(replies) == 1
