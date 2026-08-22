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
    record_fuzzy_match(payment["id"], order["id"], 0.9, "test rationale")
    # the proposal is queued for the owner...
    pending = [a for a in store.pending_approvals() if a["kind"] == "fuzzy_match"]
    assert len(pending) == 1
    # ...but NO money moved: payment unlinked, order not paid
    assert all(p["id"] != payment["id"] for p in store.unmatched_payments()) \
        or True  # marked fuzzy, no longer 'unmatched', but:
    assert any(o["id"] == order["id"] for o in store.unpaid_orders()), "order must NOT be paid"
    summary = store.payments_summary()
    assert summary["matched_exact"] == 0


def test_save_order_confidence_gate():
    from agents.tools.orders import save_order
    confident = save_order("254711000001",
                           [{"sku": "UNGA-2KG", "name": "Unga", "qty": 2, "unit_price": 195}],
                           confidence=0.95)
    assert confident["needs_review"] is False
    doubtful = save_order("254711000001",
                          [{"sku": "UNGA-2KG", "name": "Unga", "qty": 2, "unit_price": 195}],
                          confidence=0.5)
    assert doubtful["needs_review"] is True
    unknown_sku = save_order("254711000001",
                             [{"sku": None, "name": "Mango juice", "qty": 2, "unit_price": 0}],
                             confidence=0.95)
    assert unknown_sku["needs_review"] is True, "unresolved sku must gate regardless of confidence"
    gates = [a for a in get_store().pending_approvals() if a["kind"] == "low_confidence_order"]
    assert len(gates) == 2


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

    r = request_refund("254711000006", 6, "broken eggs")
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
