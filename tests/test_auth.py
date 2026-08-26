"""Application auth boundary for the public frontend/private API design."""
from __future__ import annotations

import sys
import base64
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest


@pytest.fixture(autouse=True)
def cloud_auth(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_ENV", "prod")
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_OWNER_PASSWORD", "correct-horse-battery-staple")
    monkeypatch.setenv("DUKA_SESSION_SECRET", "test-session-secret-long-enough")
    monkeypatch.setenv("DUKA_CHANNEL_KEY", "test-channel-key")
    monkeypatch.setenv("DUKA_TRACE_ENABLED", "false")
    from app.http_security import reset_request_limits
    reset_request_limits()
    from agents.seed import seed
    seed(force=True)


def test_owner_login_cookie_protects_dashboard_and_logout():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app, base_url="https://testserver") as client:
        assert client.get("/approvals").status_code == 401
        assert client.post("/auth/login", json={"password": "wrong"}).status_code == 401
        login = client.post(
            "/auth/login", json={"password": "correct-horse-battery-staple"})
        assert login.status_code == 200
        assert client.get("/approvals").status_code == 200
        assert client.post("/auth/logout").status_code == 200
        assert client.get("/approvals").status_code == 401


def test_inbound_requires_trusted_channel_key(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    class FakeBus:
        def __init__(self):
            self.payloads = []

        async def publish(self, topic, payload):
            self.payloads.append((topic, payload))

    fake = FakeBus()
    from app import bus as bus_module
    monkeypatch.setattr(bus_module, "get_bus", lambda: fake)
    body = {"event_id": "evt-auth-1", "customer_id": "254711000001",
            "text": "Nataka unga"}
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/inbound", json=body).status_code == 401
        accepted = client.post(
            "/inbound", json=body,
            headers={"X-Duka-Channel-Key": "test-channel-key"})
    assert accepted.status_code == 202
    assert fake.payloads[0][1]["event_id"] == "evt-auth-1"


def test_tampered_or_expired_owner_token_is_rejected(monkeypatch):
    from app.auth import create_owner_token, verify_owner_token
    token = create_owner_token(now=100)
    assert verify_owner_token(token, now=101)
    assert not verify_owner_token(token + "x", now=101)
    assert not verify_owner_token(token, now=100 + 8 * 60 * 60)


def test_login_rate_limit_and_same_origin_default():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app, base_url="https://testserver") as client:
        for _ in range(10):
            response = client.post("/auth/login", json={"password": "wrong"})
            assert response.status_code == 401
        limited = client.post("/auth/login", json={"password": "wrong"})
        assert limited.status_code == 429
        assert int(limited.headers["retry-after"]) >= 1

        preflight = client.options(
            "/auth/login",
            headers={"Origin": "https://attacker.example",
                     "Access-Control-Request-Method": "POST"},
        )
        assert "access-control-allow-origin" not in preflight.headers


def test_request_body_limit_runs_before_json_parsing(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    monkeypatch.setenv("DUKA_MAX_REQUEST_BYTES", "128")
    with TestClient(app, base_url="https://testserver") as client:
        response = client.post(
            "/auth/login", content=b'{' + b'"password":"' + b'x' * 200 + b'"}',
            headers={"content-type": "application/json"},
        )
    assert response.status_code == 413
    assert response.json() == {"error": "request body too large"}


def test_owner_ledger_endpoint_sets_trusted_owner_role(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    captured = {}

    async def fake_turn(customer_id, text, **kwargs):
        captured.update({"customer_id": customer_id, "text": text, **kwargs})
        return type("Result", (), {
            "reply": "2 rows recorded; 1 held for review.",
            "node_path": ["classifier", "router", "ledger_reader"],
            "input_tokens": 10, "output_tokens": 5,
            "cost_usd": 0.0001, "wall_ms": 42,
        })()

    monkeypatch.setitem(
        sys.modules, "app.runner", type("FakeRunnerModule", (), {
            "run_turn": staticmethod(fake_turn),
        })())
    payload = base64.b64encode(b"synthetic-ledger-image").decode()
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/ledger", json={
            "image_b64": payload, "image_mime": "image/jpeg",
        }).status_code == 401
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple",
        }).status_code == 200
        response = client.post("/ledger", json={
            "image_b64": payload, "image_mime": "image/jpeg",
        })
    assert response.status_code == 200
    assert captured["customer_id"] == "owner"
    assert captured["actor_role"] == "owner"
    assert captured["image_bytes"] == b"synthetic-ledger-image"
