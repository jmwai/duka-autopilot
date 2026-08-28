"""A ledger row the model could not read is completed by the owner typing the
amount. The typed amount is part of the decision, so it replays like one."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from agents.store import get_store
from agents.store.base import LEDGER_OWNER_AMOUNT_MAX


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_BUS", "local")
    monkeypatch.setenv("DUKA_DEMO_OPEN_ACCESS", "1")
    from agents.seed import seed
    seed(force=True)


@pytest.fixture
def client():
    from app.main import app
    with TestClient(app) as test_client:
        yield test_client


def unreadable_row(**overrides) -> str:
    """Queue the gate a handwritten page produces when the amount is a smudge."""
    payload = {
        "row": {"customer_name": "J. Kilonzo", "customer_id": None,
                "description": "mayai tray", "amount": 0, "paid": False,
                "confidence": 0.41},
        "page_note": "Tuesday page",
        "reason": "amount unreadable",
        "source_event_id": "ledger-page-1",
    }
    payload.update(overrides)
    return str(get_store().add_approval("ledger_row", payload))


def readable_row() -> str:
    return str(get_store().add_approval("ledger_row", {
        "row": {"customer_name": "Mama Achieng", "customer_id": None,
                "description": "unga x2", "amount": 710, "paid": True,
                "confidence": 0.55},
        "page_note": "Tuesday page",
        "reason": "confidence 0.55",
        "source_event_id": "ledger-page-1",
    }))


def test_owner_amount_records_the_sale(client):
    approval_id = unreadable_row()
    response = client.post(f"/approvals/{approval_id}",
                           json={"decision": "approved", "amount": 240})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["amount"] == 240
    assert body["amount_source"] == "owner"

    order = get_store().get_order(body["order_id"])
    assert order["total"] == 240
    # not marked paid on the page, so the sale is owed, not collected
    assert order["status"] == "confirmed"
    assert order["items"][0]["name"] == "mayai tray"
    assert "amount entered by owner" in order["notes"]
    assert order["source_event_id"] == "ledger-page-1"


def test_the_extracted_row_is_never_overwritten(client):
    approval_id = unreadable_row()
    client.post(f"/approvals/{approval_id}",
                json={"decision": "approved", "amount": 240})
    payload = get_store().get_approval(approval_id)["payload"]
    # what the model saw stays next to what the owner said
    assert payload["row"]["amount"] == 0
    assert payload["owner_amount"] == 240


def test_replaying_the_same_amount_does_not_write_a_second_sale(client):
    approval_id = unreadable_row()
    first = client.post(f"/approvals/{approval_id}",
                        json={"decision": "approved", "amount": 240}).json()
    second = client.post(f"/approvals/{approval_id}",
                         json={"decision": "approved", "amount": 240}).json()
    assert second["ok"] is True and second["idempotent"] is True
    ledger_orders = [o for o in get_store().list_orders()
                     if (o.get("notes") or "").startswith("ledger row approved")]
    assert len(ledger_orders) == 1
    assert first["order_id"]


def test_a_different_amount_on_replay_is_a_conflict(client):
    approval_id = unreadable_row()
    client.post(f"/approvals/{approval_id}",
                json={"decision": "approved", "amount": 240})
    changed = client.post(f"/approvals/{approval_id}",
                          json={"decision": "approved", "amount": 900})
    assert changed.status_code == 409
    assert get_store().get_approval(approval_id)["payload"]["owner_amount"] == 240


def test_approving_an_unreadable_row_without_an_amount_is_refused(client):
    approval_id = unreadable_row()
    response = client.post(f"/approvals/{approval_id}", json={"decision": "approved"})
    assert response.status_code == 422
    assert "supply one" in response.json()["error"]
    # the gate is untouched, so the owner can still come back and enter it
    assert get_store().get_approval(approval_id)["status"] == "pending"


def test_a_readable_amount_cannot_be_re_entered(client):
    approval_id = readable_row()
    response = client.post(f"/approvals/{approval_id}",
                           json={"decision": "approved", "amount": 999})
    assert response.status_code == 422
    assert "cannot be re-entered" in response.json()["error"]


def test_a_readable_row_still_approves_on_its_extracted_amount(client):
    approval_id = readable_row()
    body = client.post(f"/approvals/{approval_id}", json={"decision": "approved"}).json()
    assert body["amount_source"] == "extracted"
    assert get_store().get_order(body["order_id"])["total"] == 710


def test_rejecting_an_unreadable_row_needs_no_amount(client):
    approval_id = unreadable_row()
    response = client.post(f"/approvals/{approval_id}", json={"decision": "rejected"})
    assert response.status_code == 200
    assert response.json()["order_id"] is None


@pytest.mark.parametrize("amount", [0, -5, LEDGER_OWNER_AMOUNT_MAX + 1, 71_000_000])
def test_amounts_outside_the_shop_counter_range_are_rejected(client, amount):
    approval_id = unreadable_row()
    response = client.post(f"/approvals/{approval_id}",
                           json={"decision": "approved", "amount": amount})
    assert response.status_code == 422


def test_the_ceiling_itself_is_accepted(client):
    approval_id = unreadable_row()
    body = client.post(f"/approvals/{approval_id}",
                       json={"decision": "approved",
                             "amount": LEDGER_OWNER_AMOUNT_MAX}).json()
    assert get_store().get_order(body["order_id"])["total"] == LEDGER_OWNER_AMOUNT_MAX


def test_an_amount_on_another_approval_kind_is_refused(client):
    approval_id = str(get_store().add_approval("fuzzy_match", {
        "payment_id": "1", "order_id": "1", "confidence": 0.7,
        "rationale": "name variant",
    }))
    response = client.post(f"/approvals/{approval_id}",
                           json={"decision": "approved", "amount": 240})
    assert response.status_code == 422
    assert "only to a ledger row" in response.json()["error"]
