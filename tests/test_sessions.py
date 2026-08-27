"""Durable session-pointer and safe-memory contracts; keyless local coverage."""
from __future__ import annotations

import sys
import json
from types import SimpleNamespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_ENV", "local")
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_USER_KEY_SECRET", "test-user-key-secret")
    from agents.seed import seed
    seed(force=True)


def test_agent_user_key_is_stable_opaque_and_secret_bound(monkeypatch):
    from app.runner import _user_id
    customer_id = "254711000001"
    first = _user_id(customer_id)
    assert first == _user_id(customer_id)
    assert first.startswith("u_") and customer_id not in first
    monkeypatch.setenv("DUKA_USER_KEY_SECRET", "different-secret")
    assert _user_id(customer_id) != first


@pytest.mark.asyncio
async def test_session_rotation_persists_pointer_and_preserves_old_session():
    from app.runner import APP_NAME, _active_session, _ensure_session, new_session, runner
    customer_id = "254711000001"
    initial = _active_session(customer_id)
    await _ensure_session(
        initial["user_id"], initial["session_id"],
        {"customer_id": customer_id, "user_key": initial["user_id"]})
    rotated = await new_session(customer_id, "session-test-rotation-1")
    rotated_id = rotated["session_id"]
    pointer = get_store().get_active_session(customer_id)
    assert pointer["generation"] == 1 and pointer["session_id"] == rotated_id
    replay = await new_session(customer_id, "session-test-rotation-1")
    assert replay["session_id"] == rotated_id and replay["idempotent"] is True
    assert get_store().get_active_session(customer_id)["generation"] == 1
    old = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=initial["user_id"],
        session_id=initial["session_id"])
    new = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=pointer["user_id"], session_id=rotated_id)
    assert old is not None and new is not None


def test_session_rotation_operation_conflicts_across_customers():
    store = get_store()
    first = store.rotate_active_session_once(
        "session-shared-operation", "254711000001", "u_one")
    conflict = store.rotate_active_session_once(
        "session-shared-operation", "254711000002", "u_two")
    assert first["status"] == "completed"
    assert conflict["status"] == "conflict"


@pytest.mark.asyncio
async def test_turn_correlation_enters_adk_state_and_is_explicitly_cleared(
        monkeypatch):
    from app import runner as runner_module

    calls = []

    async def capture_run_async(**kwargs):
        calls.append(kwargs)
        if False:
            yield None

    async def no_memory(_customer_id):
        return False

    monkeypatch.setattr(runner_module.runner, "run_async", capture_run_async)
    monkeypatch.setattr(runner_module, "_ingest_order_summary", no_memory)

    await runner_module._run_turn_locked(
        "254711000001", "Nataka unga",
        source_event_id="evt-state-1")
    await runner_module._run_turn_locked(
        "254711000001", "Asante",
        source_event_id=None)

    assert calls[0]["state_delta"]["source_event_id"] == "evt-state-1"
    assert calls[1]["state_delta"]["source_event_id"] is None


@pytest.mark.asyncio
async def test_turn_captures_authoritative_order_tool_receipt(monkeypatch):
    from app import runner as runner_module

    response = {
        "status": "success", "order_id": 17,
        "status_detail": "pending_confirmation", "total": 390,
        "needs_review": False,
    }

    async def capture_run_async(**kwargs):
        part = SimpleNamespace(
            function_call=None,
            function_response=SimpleNamespace(
                name="save_order", response=response),
            text=None,
        )
        yield SimpleNamespace(
            invocation_id="inv-order-proof", node_info=None,
            author="order_intake", usage_metadata=None,
            content=SimpleNamespace(parts=[part]),
            is_final_response=lambda: False,
        )

    async def no_memory(_customer_id):
        return False

    monkeypatch.setattr(runner_module.runner, "run_async", capture_run_async)
    monkeypatch.setattr(runner_module, "_ingest_order_summary", no_memory)
    result = await runner_module._run_turn_locked(
        "254711000001", "Nataka unga", source_event_id="evt-order-proof-2")

    assert result.order_result == response


@pytest.mark.asyncio
async def test_memory_summary_is_allowlisted_and_opaque(monkeypatch):
    from app import runner as runner_module
    captured = {}

    async def capture(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        runner_module.runner.memory_service, "add_events_to_memory", capture)
    assert await runner_module._ingest_order_summary("254711000001") is True
    assert captured["user_id"].startswith("u_")
    assert "254711000001" not in captured["user_id"]
    assert captured["custom_metadata"] == {
        "wait_for_completion": True,
        "allowed_topics": [{
            "custom_memory_topic_label":
                "shopping_preferences_and_usual_order",
        }],
        "revision_ttl": "7776000s",
    }
    text = captured["events"][0].content.parts[0].text
    assert "usually buys" in text
    assert "4x Unga wa Dola 2kg" in text
    assert "3x Laundry soap bar" in text
    assert "254" not in text and "KSh" not in text and "order #" not in text


def test_customer_turn_lease_serializes_and_recovers_after_release():
    store = get_store()
    customer_id = "254711000001"
    first = store.claim_customer_turn(customer_id, "revision-a", lease_seconds=120)
    blocked = store.claim_customer_turn(customer_id, "revision-b", lease_seconds=120)
    assert first["claimed"] is True
    assert blocked["claimed"] is False and blocked["owner"] == "revision-a"
    store.release_customer_turn(customer_id, "not-the-owner")
    assert store.claim_customer_turn(
        customer_id, "revision-b", lease_seconds=120)["claimed"] is False
    store.release_customer_turn(customer_id, "revision-a")
    assert store.claim_customer_turn(
        customer_id, "revision-b", lease_seconds=120)["claimed"] is True


def test_customer_turn_lease_can_be_reclaimed_after_expiry():
    store = get_store()
    customer_id = "254711000001"
    assert store.claim_customer_turn(
        customer_id, "dead-revision", lease_seconds=0)["claimed"] is True
    assert store.claim_customer_turn(
        customer_id, "new-revision", lease_seconds=120)["claimed"] is True


def test_memory_outbox_deduplicates_and_retries():
    store = get_store()
    entry_id = store.enqueue_memory_summary(
        "254711000001", "u_test", "This customer usually buys 2x Unga.",
        "usual-v1-test")
    assert store.enqueue_memory_summary(
        "254711000001", "u_test", "This customer usually buys 2x Unga.",
        "usual-v1-test") == entry_id
    first = store.claim_memory_summary(customer_id="254711000001")
    assert first["id"] == entry_id and first["attempts"] == 1
    store.fail_memory_summary(entry_id, "temporary 503", retryable=True)
    second = store.claim_memory_summary(customer_id="254711000001")
    assert second["id"] == entry_id and second["attempts"] == 2
    store.complete_memory_summary(entry_id)
    assert store.get_memory_summary(entry_id)["status"] == "completed"
    assert store.claim_memory_summary(customer_id="254711000001") is None


@pytest.mark.asyncio
async def test_memory_bank_failure_is_retryable_and_does_not_lose_summary(monkeypatch):
    from app import runner as runner_module

    async def unavailable(**_kwargs):
        raise RuntimeError("503 memory unavailable")

    monkeypatch.setattr(
        runner_module.runner.memory_service, "add_events_to_memory", unavailable)
    with pytest.raises(RuntimeError, match="503 memory unavailable"):
        await runner_module._ingest_order_summary("254711000001")

    store = get_store()
    retry = store.claim_memory_summary(customer_id="254711000001")
    assert retry is not None and retry["attempts"] == 2
    store.fail_memory_summary(retry["id"], "still unavailable", retryable=True)

    delivered = []

    async def capture(**kwargs):
        delivered.append(kwargs)

    monkeypatch.setattr(
        runner_module.runner.memory_service, "add_events_to_memory", capture)
    stats = await runner_module.drain_memory_outbox(
        customer_id="254711000001", limit=1)
    assert stats == {"completed": 1, "failed": 0}
    assert len(delivered) == 1
    row = store.get_memory_summary(retry["id"])
    assert row["status"] == "completed" and row["attempts"] == 3


def test_cloud_readiness_requires_user_key_secret(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    monkeypatch.setenv("DUKA_ENV", "prod")
    monkeypatch.setenv("DUKA_STORE", "firestore")
    monkeypatch.setenv("DUKA_BUS", "pubsub")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "my-duka-autopilot")
    monkeypatch.setenv("GOOGLE_CLOUD_LOCATION", "global")
    monkeypatch.setenv("FIRESTORE_DATABASE", "duka-prod")
    monkeypatch.setenv("AGENT_CONTEXT_ID", "123")
    monkeypatch.delenv("DUKA_USER_KEY_SECRET", raising=False)
    with TestClient(app) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert "DUKA_USER_KEY_SECRET" in response.json()["missing"]


def test_durable_topology_manifest_matches_runtime():
    from app.compatibility import manifest_status, topology_contract

    status = manifest_status()
    assert status["compatible"] is True
    assert topology_contract()["app_name"] == "duka-autopilot"
    assert topology_contract()["user_key_algorithm"] == "hmac-sha256-v1"
    assert any(node["name"] == "refund_gate" and node["rerun_on_resume"]
               for node in topology_contract()["nodes"])


def test_durable_topology_manifest_detects_incompatible_release(tmp_path):
    from app.compatibility import manifest_status

    manifest = tmp_path / "compatibility.json"
    manifest.write_text(json.dumps({"fingerprint": "wrong"}))
    status = manifest_status(manifest)
    assert status["compatible"] is False
    assert status["expected"] == "wrong"
    assert len(status["actual"]) == 64


def test_memory_bank_customization_matches_locked_vertex_schema():
    from app.memory_config import (
        MEMORY_TOPIC_LABEL,
        build_memory_bank_config,
        validate_memory_bank_config,
    )

    config = build_memory_bank_config("my-duka-autopilot")
    validate_memory_bank_config(config)
    customization = config["customization_configs"][0]
    assert customization["scope_keys"] == ["app_name", "user_id"]
    assert customization["memory_topics"][0]["custom_memory_topic"][
        "label"] == MEMORY_TOPIC_LABEL
    assert any(not example["generated_memories"]
               for example in customization["generate_memories_examples"])
