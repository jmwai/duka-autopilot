"""Ledger row gating + morning digest - keyless, deterministic."""
from __future__ import annotations

import sys
from pathlib import Path

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


def test_ledger_rows_gate_per_row():
    from agents.tools.ledger import record_ledger_rows
    out = record_ledger_rows(ROWS, page_note="Aug 21, page total 1070")
    assert out["recorded"] == 2 and out["gated"] == 2
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
    out = record_ledger_rows([ROWS[3]])
    aid = out["approval_ids"][0]
    with TestClient(app) as client:
        r = client.post(f"/approvals/{aid}", json={"decision": "approved"})
        assert r.status_code == 200
    walkin = get_store().orders_for_customer("walk-in", limit=5)
    assert any(o["total"] == 150 for o in walkin)


def test_morning_digest_shape_and_text():
    from agents.digest import morning_digest
    from agents.tools.ledger import record_ledger_rows
    from agents.tools.orders import request_refund
    record_ledger_rows([ROWS[2]])                 # 1 gated row
    request_refund("254711000006", 6, "broken eggs")

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


async def test_digest_includes_nightly_report_when_present():
    from agents.digest import build_digest
    from agents.nightly import run_nightly
    await run_nightly(fuzzy=False)
    d = build_digest()
    assert d["nightly"] is not None
    assert d["nightly"]["exact_matched"] == 2
