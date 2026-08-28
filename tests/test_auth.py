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


def test_owner_manual_sale_is_atomic_idempotent_and_conflict_safe():
    from fastapi.testclient import TestClient

    from agents.store import get_store
    from app.main import app

    store = get_store()
    before = len(store.list_orders(limit=200))
    request = {
        "event_id": "sale-auth-test-1",
        "customer_id": "254711000001",
        "items": [{"sku": "UNGA-2KG", "qty": 2}],
        "paid": True,
    }
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple",
        }).status_code == 200
        created = client.post("/orders", json=request)
        replay = client.post("/orders", json=request)
        conflict = client.post("/orders", json={
            **request,
            "items": [{"sku": "UNGA-2KG", "qty": 3}],
        })

    assert created.status_code == 200
    assert created.json() == {
        "event_id": request["event_id"],
        "order_id": created.json()["order_id"],
        "status": "paid",
        "total": 390,
        "idempotent": False,
    }
    assert replay.status_code == 200
    assert replay.json()["order_id"] == created.json()["order_id"]
    assert replay.json()["idempotent"] is True
    assert conflict.status_code == 409
    assert conflict.json()["event_id"] == request["event_id"]
    assert len(store.list_orders(limit=200)) == before + 1


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
        captured["calls"] = captured.get("calls", 0) + 1
        captured.update({"customer_id": customer_id, "text": text, **kwargs})
        return type("Result", (), {
            "reply": "2 rows recorded; 1 held for review.",
            "node_path": ["classifier", "router", "ledger_reader"],
            "ledger_result": {
                "status": "success", "recorded": 2, "gated": 1,
                "order_ids": ["order-1", "order-2"],
                "approval_ids": ["approval-1"], "rows": [],
            },
            "input_tokens": 10, "output_tokens": 5,
            "cost_usd": 0.0001, "wall_ms": 42,
        })()

    monkeypatch.setitem(
        sys.modules, "app.runner", type("FakeRunnerModule", (), {
            "run_turn": staticmethod(fake_turn),
        })())
    payload = base64.b64encode(b"synthetic-ledger-image").decode()
    request = {
        "event_id": "ledger-auth-test-1",
        "image_b64": payload, "image_mime": "image/jpeg",
    }
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/ledger", json=request).status_code == 401
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple",
        }).status_code == 200
        response = client.post("/ledger", json=request)
        replay = client.post("/ledger", json=request)
        conflict = client.post("/ledger", json={
            **request,
            "image_b64": base64.b64encode(
                b"different-synthetic-ledger-image").decode(),
        })
    assert response.status_code == 200
    assert captured["customer_id"] == "owner"
    assert captured["actor_role"] == "owner"
    assert captured["image_bytes"] == b"synthetic-ledger-image"
    assert captured["calls"] == 1
    assert response.json()["ledger"]["recorded"] == 2
    assert response.json()["ledger"]["gated"] == 1
    assert response.json()["idempotent"] is False
    assert replay.json()["idempotent"] is True
    assert conflict.status_code == 409
    assert conflict.json()["event_id"] == request["event_id"]


def test_demo_open_access_is_off_unless_explicitly_enabled(monkeypatch):
    from app.auth import demo_open_access

    monkeypatch.delenv("DUKA_DEMO_OPEN_ACCESS", raising=False)
    assert demo_open_access() is False
    for value in ("false", "", "1", "yes", "TRUE-ish"):
        monkeypatch.setenv("DUKA_DEMO_OPEN_ACCESS", value)
        assert demo_open_access() is False
    monkeypatch.setenv("DUKA_DEMO_OPEN_ACCESS", "  TRUE  ")
    assert demo_open_access() is True


def test_demo_open_access_grants_owner_session_without_password(monkeypatch):
    """Judges reach owner surfaces without logging in; scoping is unchanged."""
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("DUKA_DEMO_OPEN_ACCESS", "true")
    with TestClient(app, base_url="https://testserver") as client:
        assert client.get("/approvals").status_code == 200
        # A wrong password still fails: the credential check itself is intact,
        # it is simply no longer the only way to hold an owner session.
        assert client.post(
            "/auth/login", json={"password": "wrong"}).status_code == 401


def test_owner_approval_queue_hides_durable_resume_handles():
    from fastapi.testclient import TestClient

    from agents.store import get_store
    from app.main import app

    store = get_store()
    payload = {
        "customer_id": "254711000006",
        "order_id": "6",
        "reason": "broken",
        "session_id": "managed-session-secret-handle",
        "interrupt_id": "interrupt-secret-handle",
    }
    approval_id = store.add_approval("refund", payload)
    store.stamp_approval(approval_id, "invocation-secret-handle", payload)

    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple",
        }).status_code == 200
        response = client.get("/approvals")

    assert response.status_code == 200
    approval = next(
        row for row in response.json() if str(row["id"]) == str(approval_id))
    assert approval["payload"]["order_id"] == "6"
    assert "session_id" not in approval["payload"]
    assert "interrupt_id" not in approval["payload"]
    assert "invocation_id" not in approval


def test_owner_can_confirm_or_cancel_a_proposed_order_but_never_mark_it_paid():
    """The owner decides whether a proposed order stands; money is separate."""
    from fastapi.testclient import TestClient

    from agents.store import get_store
    from app.main import app

    store = get_store()
    order = store.create_order(
        "254711000001",
        [{"sku": "UNGA-2KG", "name": "Unga wa Dola 2kg", "qty": 1, "unit_price": 195}],
        status="pending_confirmation",
    )
    order_id = order["id"] if isinstance(order, dict) else order

    with TestClient(app, base_url="https://testserver") as client:
        assert client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-1", "decision": "confirm"}).status_code == 401
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple"}).status_code == 200

        confirmed = client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-1", "decision": "confirm"})
        assert confirmed.status_code == 200
        body = confirmed.json()
        assert body["status"] == "confirmed"
        assert body["previous_status"] == "pending_confirmation"
        assert body["idempotent"] is False

        # A replay of the same decision returns the stored outcome.
        replay = client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-1", "decision": "confirm"})
        assert replay.status_code == 200 and replay.json()["idempotent"] is True

        # A different decision under the same event ID is a conflict.
        assert client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-1", "decision": "cancel"}).status_code == 409

        # An already-decided order cannot be decided again.
        again = client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-2", "decision": "cancel"})
        assert again.status_code == 409
        assert again.json()["status"] == "confirmed"

    assert store.get_order(order_id)["status"] == "confirmed"


def test_a_paid_order_cannot_be_reopened_by_an_owner_decision():
    """Payment evidence outranks the owner's decision surface."""
    from fastapi.testclient import TestClient

    from agents.store import get_store
    from app.main import app

    store = get_store()
    order = store.create_order(
        "254711000001",
        [{"sku": "UNGA-2KG", "name": "Unga wa Dola 2kg", "qty": 1, "unit_price": 195}],
        status="paid",
    )
    order_id = order["id"] if isinstance(order, dict) else order

    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple"}).status_code == 200
        blocked = client.post(f"/orders/{order_id}/decision", json={
            "event_id": "decide-paid", "decision": "cancel"})
    assert blocked.status_code == 409
    assert store.get_order(order_id)["status"] == "paid"


def test_an_order_decision_rejects_an_unknown_order_and_a_bad_decision():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app, base_url="https://testserver") as client:
        assert client.post("/auth/login", json={
            "password": "correct-horse-battery-staple"}).status_code == 200
        assert client.post("/orders/999999/decision", json={
            "event_id": "decide-missing", "decision": "confirm"}).status_code == 404
        assert client.post("/orders/1/decision", json={
            "event_id": "decide-bad", "decision": "mark_paid"}).status_code == 422
