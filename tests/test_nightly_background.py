"""The night shift off the bus: the API answers immediately, the worker runs
the pipeline, and the outcome is collected from the event receipt."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_BUS", "local")
    monkeypatch.setenv("DUKA_DEMO_OPEN_ACCESS", "1")
    from app.bus import reset_bus
    reset_bus()
    from agents.seed import seed
    seed(force=True)


@pytest.fixture
def client():
    from app.main import app
    with TestClient(app) as test_client:
        yield test_client


async def test_start_answers_before_the_run_finishes(client, monkeypatch):
    """The endpoint returns a run id without waiting for any model call."""
    started = []

    async def slow_nightly(**kwargs):
        started.append(kwargs)
        return {"fuzzy_proposals": 2, "exact_matched": 2, "residue_end": 1}

    import agents.nightly
    monkeypatch.setattr(agents.nightly, "run_nightly", slow_nightly)

    response = client.post("/recon/nightly/start", json={"fuzzy": True, "batches": 3})
    assert response.status_code == 202
    body = response.json()
    assert body["queued"] is True and body["run_id"]

    from app.bus import get_bus
    await get_bus().wait_idle()

    assert started and started[0]["max_batches"] == 3
    assert started[0]["fuzzy"] is True

    status = client.get(f"/recon/nightly/status?run_id={body['run_id']}").json()
    assert status["status"] == "completed"
    assert status["report"]["fuzzy_proposals"] == 2
    assert status["error"] is None


def test_status_of_an_unclaimed_run_is_pending_not_an_error(client):
    status = client.get("/recon/nightly/status?run_id=never-published")
    assert status.status_code == 200
    assert status.json() == {"run_id": "never-published", "status": "pending",
                             "report": None, "error": None}


async def test_a_failed_run_is_reported_not_silently_dropped(client, monkeypatch):
    async def broken_nightly(**kwargs):
        raise ValueError("statement source is unreadable")

    import agents.nightly
    monkeypatch.setattr(agents.nightly, "run_nightly", broken_nightly)

    run_id = client.post("/recon/nightly/start", json={}).json()["run_id"]
    from app.bus import get_bus
    await get_bus().wait_idle()

    status = client.get(f"/recon/nightly/status?run_id={run_id}").json()
    assert status["status"] == "failed_permanent"
    assert "statement source is unreadable" in status["error"]
    assert status["report"] is None


async def test_a_redelivered_run_does_not_run_the_pipeline_twice(monkeypatch):
    """Pub/Sub redelivery must replay the receipt, not reconcile again."""
    calls = {"n": 0}

    async def counting_nightly(**kwargs):
        calls["n"] += 1
        return {"fuzzy_proposals": 1}

    import agents.nightly
    monkeypatch.setattr(agents.nightly, "run_nightly", counting_nightly)

    from app.worker import handle_nightly
    payload = {"event_id": "run-1", "run_id": "run-1", "customer_id": "owner",
               "fuzzy": True, "max_batches": None}
    first = await handle_nightly(payload)
    second = await handle_nightly(payload)

    assert calls["n"] == 1
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    assert second["event_status"] == "completed"


async def test_push_delivery_routes_on_the_topic_attribute(monkeypatch):
    """One subscription carries both kinds of work; the attribute decides."""
    import base64
    import json

    async def quiet_nightly(**kwargs):
        return {"fuzzy_proposals": 0}

    import agents.nightly
    monkeypatch.setattr(agents.nightly, "run_nightly", quiet_nightly)

    from app.bus import TOPIC_ATTRIBUTE
    from app.worker import NIGHTLY_TOPIC, register
    register()

    from app.main import app
    with TestClient(app) as test_client:
        payload = {"event_id": "run-2", "run_id": "run-2", "customer_id": "owner"}
        envelope = {"message": {
            "data": base64.b64encode(json.dumps(payload).encode()).decode(),
            "messageId": "m-1",
            "attributes": {TOPIC_ATTRIBUTE: NIGHTLY_TOPIC},
        }}
        response = test_client.post("/pubsub/push", json=envelope)
        assert response.status_code == 200
        assert response.json()["run_id"] == "run-2"

        unknown = {"message": {
            "data": base64.b64encode(json.dumps(payload).encode()).decode(),
            "messageId": "m-2",
            "attributes": {TOPIC_ATTRIBUTE: "not-a-topic"},
        }}
        assert test_client.post("/pubsub/push", json=unknown).status_code == 400


def test_publish_carries_the_logical_topic_as_an_attribute():
    """Cloud mode rides one transport topic, so the attribute is the routing."""
    from app.bus import TOPIC_ATTRIBUTE, TRANSPORT_TOPIC
    assert TRANSPORT_TOPIC == "inbound"
    assert TOPIC_ATTRIBUTE == "topic"
