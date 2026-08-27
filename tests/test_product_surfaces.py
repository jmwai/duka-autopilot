from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_ENV", "local")
    from agents.seed import seed
    seed(force=True)


def test_inventory_endpoint_exposes_backend_policy_without_mutation():
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/inventory")
    assert response.status_code == 200
    inventory = response.json()
    soap = next(item for item in inventory if item["sku"] == "SABUNI-1L")
    assert soap == {
        "sku": "SABUNI-1L",
        "name": "Dish soap 1L",
        "unit": "bottle",
        "unit_price": 180,
        "stock": 9,
        "reorder_point": 10,
        "target_stock": 30,
        "low": True,
        "suggested_qty": 21,
    }


def test_release_evidence_is_pending_until_bound_to_running_sha(monkeypatch):
    from app.evidence import _ARTIFACTS, release_evidence

    for _, _, url_env, sha_env, summary_env in _ARTIFACTS:
        monkeypatch.delenv(url_env, raising=False)
        monkeypatch.delenv(sha_env, raising=False)
        monkeypatch.delenv(summary_env, raising=False)
    monkeypatch.setenv("RELEASE_SHA", "release-a")
    monkeypatch.setenv("AGENT_PLATFORM_CONTEXT_ID", "projects/secret-context-id")

    pending = release_evidence()
    assert all(artifact["state"] == "pending" for artifact in pending["artifacts"])
    assert "secret-context-id" not in json.dumps(pending)

    monkeypatch.setenv("EVIDENCE_CI_URL", "https://github.com/example/actions/runs/1")
    monkeypatch.setenv("EVIDENCE_CI_SHA", "release-a")
    monkeypatch.setenv("EVIDENCE_CI_SUMMARY", "109 deterministic tests passed")
    proven = release_evidence()["artifacts"][0]
    assert proven["state"] == "proven"
    assert proven["release_sha"] == "release-a"

    monkeypatch.setenv("EVIDENCE_CI_SHA", "older-release")
    assert release_evidence()["artifacts"][0]["state"] == "not_proven"


def test_release_evidence_rejects_non_https_artifact_url(monkeypatch):
    from app.evidence import release_evidence

    monkeypatch.setenv("RELEASE_SHA", "release-a")
    monkeypatch.setenv("EVIDENCE_CI_URL", "javascript:alert(1)")
    monkeypatch.setenv("EVIDENCE_CI_SHA", "release-a")
    artifact = release_evidence()["artifacts"][0]
    assert artifact["state"] == "not_proven"
    assert artifact["url"] is None


def test_owner_approval_read_removes_phone_shaped_authority_keys():
    from agents.store import get_store
    from app.main import app

    approval_id = get_store().add_approval("ledger_row", {
        "customer_id": "254711000001",
        "source_event_id": "ledger-safe-1",
        "row": {
            "customer_id": "254711000001",
            "customer_name": "Mama Achieng",
            "description": "Unga",
            "amount": 390,
            "paid": True,
            "confidence": 0.7,
        },
    })
    with TestClient(app) as client:
        response = client.get("/approvals")
    assert response.status_code == 200
    public = next(
        item for item in response.json()
        if str(item["id"]) == str(approval_id))
    assert "customer_id" not in public["payload"]
    assert "customer_id" not in public["payload"]["row"]
    assert public["payload"]["source_event_id"] == "ledger-safe-1"
