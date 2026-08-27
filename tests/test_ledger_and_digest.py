"""Ledger row gating + morning digest - keyless, deterministic."""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    from agents.seed import seed
    seed(force=True)


ROWS = [
    {"customer_name": "Mama Achieng", "customer_id": "254711000001",
     "description": "unga x2, mafuta 1", "amount": 710, "paid": True,
     "confidence": 0.95, "issue": None},
    {"customer_name": "walk-in", "customer_id": None,
     "description": "soda 3", "amount": 210, "paid": True,
     "confidence": 0.9, "issue": None},
    {"customer_name": "J. Kilonzo", "customer_id": None,
     "description": "mayai tray", "amount": 0, "paid": False,
     "confidence": 0.4, "issue": "amount unreadable"},
    {"customer_name": "???", "customer_id": None,
     "description": "crossed out", "amount": 150, "paid": False,
     "confidence": 0.5, "issue": None},   # low confidence, no explicit issue
]


def _owner_tool_context():
    return SimpleNamespace(state={"actor_role": "owner"})


def test_ledger_rows_gate_per_row():
    from agents.tools.ledger import record_ledger_rows
    out = record_ledger_rows(
        ROWS, page_note="Aug 21, page total 1070",
        tool_context=_owner_tool_context())
    assert out["recorded"] == 2 and out["gated"] == 2
    assert [row["outcome"] for row in out["rows"]] == [
        "recorded", "recorded", "gated", "gated"]
    assert out["rows"][2]["amount"] is None
    assert out["rows"][2]["reason"].startswith("amount unreadable")
    store = get_store()
    gates = [a for a in store.pending_approvals() if a["kind"] == "ledger_row"]
    assert len(gates) == 2
    reasons = {g["payload"]["reason"] for g in gates}
    assert "amount unreadable" in reasons
    # the paid walk-in sale is on the books as paid
    walkin = store.orders_for_customer("walk-in", limit=5)
    assert walkin and walkin[0]["status"] == "paid" and walkin[0]["total"] == 210


def test_approving_ledger_row_records_the_sale():
    from fastapi.testclient import TestClient

    from agents.tools.ledger import record_ledger_rows
    from app.main import app
    out = record_ledger_rows(
        [ROWS[3]], page_note="", tool_context=_owner_tool_context())
    aid = out["approval_ids"][0]
    with TestClient(app) as client:
        r = client.post(f"/approvals/{aid}", json={"decision": "approved"})
        assert r.status_code == 200
        replay = client.post(f"/approvals/{aid}", json={"decision": "approved"})
        assert replay.status_code == 200 and replay.json()["idempotent"] is True
    walkin = get_store().orders_for_customer("walk-in", limit=5)
    assert len([o for o in walkin if o["total"] == 150]) == 1


def test_ledger_effect_is_exactly_once_across_crash_and_retry():
    from agents.tools.ledger import record_ledger_rows

    store = get_store()
    approval_id = record_ledger_rows(
        [ROWS[3]], page_note="", tool_context=_owner_tool_context()
    )["approval_ids"][0]
    assert store.claim_approval_decision(
        approval_id, "approved")["claimed"] is True
    first = store.apply_approval_effect(approval_id, "approved")
    assert first["idempotent"] is False

    # Simulate a revision dying after the business mutation but before the
    # API can mark the approval complete. The retry reclaims the decision but
    # must observe the transaction marker and never create a second order.
    store.fail_approval_decision(approval_id, "revision terminated")
    assert store.claim_approval_decision(
        approval_id, "approved")["claimed"] is True
    replay = store.apply_approval_effect(approval_id, "approved")
    assert replay["idempotent"] is True
    store.complete_approval_decision(approval_id, "approved")

    walkin = store.orders_for_customer("walk-in", limit=20)
    assert len([order for order in walkin if order["total"] == 150]) == 1


def test_morning_digest_shape_and_text():
    from agents.digest import morning_digest
    from agents.tools.ledger import record_ledger_rows
    from agents.tools.orders import request_refund
    record_ledger_rows(
        [ROWS[2]], page_note="", tool_context=_owner_tool_context())
    request_refund("6", "broken eggs", SimpleNamespace(
        state={"customer_id": "254711000006"}))

    out = morning_digest(persist=True)
    d, text = out["digest"], out["text"]
    assert d["approvals_pending"] == 2
    assert d["approvals_by_kind"] == {"ledger_row": 1, "refund": 1}
    assert d["statement"]["total"] == 6
    assert "Waiting for YOU: 2" in text
    assert "Habari ya asubuhi" in text
    # persisted into the owner's thread for the UI
    msgs = get_store().messages_for("owner")
    assert msgs[-1]["meta"].get("digest") is True


def test_ledger_tool_rejects_customer_authority():
    from agents.tools.ledger import record_ledger_rows

    before = len(get_store().list_orders())
    result = record_ledger_rows(
        [ROWS[0]], page_note="customer upload",
        tool_context=SimpleNamespace(state={"actor_role": "customer"}))
    assert result["status"] == "error"
    assert result["error"] == "owner authority required"
    assert len(get_store().list_orders()) == before


def test_ledger_tool_gates_negative_amount_and_invalid_confidence_per_row():
    from agents.tools.ledger import record_ledger_rows

    before = len(get_store().list_orders())
    result = record_ledger_rows([
        {**ROWS[0], "amount": -710},
        {**ROWS[1], "confidence": "not-a-number"},
    ], page_note="malformed rows", tool_context=_owner_tool_context())

    assert result["recorded"] == 0 and result["gated"] == 2
    assert len(get_store().list_orders()) == before
    assert "positive integer" in result["rows"][0]["reason"]
    assert "confidence invalid" in result["rows"][1]["reason"]


async def test_digest_includes_nightly_report_when_present():
    from agents.digest import build_digest
    from agents.nightly import run_nightly
    await run_nightly(fuzzy=False)
    d = build_digest()
    assert d["nightly"] is not None
    assert d["nightly"]["exact_matched"] == 2
