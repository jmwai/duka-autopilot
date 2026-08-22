"""Async intake: bus -> worker -> persisted conversation. Keyless - the
LLM turn is stubbed; what's under test is the event-driven plumbing that
Pub/Sub push will drive in the cloud."""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store


class FakeTurn:
    reply = "Karibu! Order received."
    node_path = ["classifier", "router", "order_intake"]
    suspended = False
    cost_usd = 0.0012
    wall_ms = 42
    input_tokens = 100
    output_tokens = 20


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_BUS", "local")
    from app.bus import reset_bus
    reset_bus()
    from agents.seed import seed
    seed(force=True)


@pytest.fixture()
def stub_turn(monkeypatch):
    async def fake_run_turn(customer_id, text, **kw):
        fake_run_turn.calls.append({"customer_id": customer_id, "text": text, **kw})
        return FakeTurn()
    fake_run_turn.calls = []
    from app import runner
    monkeypatch.setattr(runner, "run_turn", fake_run_turn)
    return fake_run_turn


@pytest.mark.asyncio
async def test_bus_dispatch_persists_conversation(stub_turn):
    from app.bus import get_bus
    from app.worker import INBOUND_TOPIC, register
    register()
    bus = get_bus()
    await bus.publish(INBOUND_TOPIC, {"customer_id": "254711000001",
                                      "text": "Nataka unga 2 bales"})
    await bus.wait_idle()

    msgs = get_store().messages_for("254711000001")
    assert [m["direction"] for m in msgs] == ["in", "out"]
    assert msgs[0]["text"] == "Nataka unga 2 bales"
    assert msgs[1]["text"] == FakeTurn.reply
    assert msgs[1]["meta"]["node_path"][-1] == "order_intake"
    assert stub_turn.calls[0]["customer_id"] == "254711000001"


@pytest.mark.asyncio
async def test_voice_payload_reaches_runner_as_audio(stub_turn):
    from app.worker import handle_inbound
    audio = base64.b64encode(b"OggS-fake-voice-note").decode()
    out = await handle_inbound({"customer_id": "254711000003", "text": "",
                                "audio_b64": audio, "audio_mime": "audio/ogg"})
    assert out["reply"] == FakeTurn.reply
    call = stub_turn.calls[0]
    assert call["audio_bytes"] == b"OggS-fake-voice-note"
    assert call["audio_mime"] == "audio/ogg"
    # channel inferred as voice for the message log
    msgs = get_store().messages_for("254711000003")
    assert msgs[0]["channel"] == "voice"


def test_pubsub_push_envelope(stub_turn):
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as client:
        payload = {"customer_id": "254711000002", "text": "Where is my order?"}
        envelope = {"message": {"data": base64.b64encode(
            json.dumps(payload).encode()).decode(), "messageId": "m-1"},
            "subscription": "projects/x/subscriptions/duka-inbound"}
        r = client.post("/pubsub/push", json=envelope)
        assert r.status_code == 200 and r.json()["ok"] is True
        # empty envelope is a 400, not a crash-and-redeliver loop
        assert client.post("/pubsub/push", json={}).status_code == 400
        msgs = client.get("/messages/254711000002").json()
        assert [m["direction"] for m in msgs] == ["in", "out"]


def test_inbound_endpoint_queues_and_returns_202(stub_turn):
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as client:
        r = client.post("/inbound", json={"customer_id": "254711000001",
                                          "text": "bei ya sukari?"})
        assert r.status_code == 202 and r.json() == {"queued": True}
