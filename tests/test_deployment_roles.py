"""Role-specific Cloud Run surfaces remain narrow and independently healthy."""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def local_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_ENV", "local")
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    from agents.seed import seed
    seed(force=True)


def test_web_health_and_readiness(monkeypatch):
    from app.web import app

    monkeypatch.delenv("DUKA_API_URL", raising=False)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"ok": True, "role": "web"}
        assert client.get("/ready").status_code == 503
    monkeypatch.setenv("DUKA_API_URL", "http://private-api")
    with TestClient(app) as client:
        assert client.get("/ready").status_code == 200


def test_web_bff_denies_worker_and_unknown_routes(monkeypatch):
    from app.web import app

    monkeypatch.setenv("DUKA_API_URL", "http://private-api")
    with TestClient(app) as client:
        assert client.post("/pubsub/push", json={}).status_code == 404
        assert client.get("/synth").status_code == 404


def test_web_bff_allows_only_declared_owner_paths(monkeypatch):
    from app import web

    seen = []

    async def fake_proxy(request, path):
        seen.append((request.method, path))
        return JSONResponse({"proxied": path})

    monkeypatch.setattr(web, "_proxy", fake_proxy)
    with TestClient(web.app) as client:
        assert client.get("/customers").json() == {"proxied": "customers"}
        assert client.post("/approvals/a1", json={}).json() == {
            "proxied": "approvals/a1"}
        assert client.post("/ledger", json={}).json() == {"proxied": "ledger"}
    assert seen == [
        ("GET", "customers"), ("POST", "approvals/a1"),
        ("POST", "ledger"),
    ]


def test_worker_push_surface_processes_pubsub_envelope(monkeypatch):
    from app import worker_api

    async def fake_handle(payload):
        assert payload["event_id"] == "msg-1"
        return {"event_id": "msg-1", "duplicate": False}

    monkeypatch.setattr(worker_api, "handle_inbound", fake_handle)
    encoded = base64.b64encode(json.dumps({
        "customer_id": "254711000001", "text": "unga mbili",
    }).encode()).decode()
    with TestClient(worker_api.app) as client:
        response = client.post("/pubsub/push", json={
            "message": {"data": encoded, "messageId": "msg-1"},
        })
    assert response.status_code == 200
    assert response.json()["event_id"] == "msg-1"


@pytest.mark.asyncio
async def test_job_memory_action_is_bounded_and_keyless():
    from app.jobs import run

    result = await run("memory", fuzzy=False)
    assert result == {"ok": True, "action": "memory",
                      "completed": 0, "failed": 0}


@pytest.mark.asyncio
async def test_job_seed_action_is_explicit_and_idempotent():
    from agents.store import get_store
    from app.jobs import run

    get_store().reset()
    first = await run("seed", fuzzy=False)
    second = await run("seed", fuzzy=False)

    assert first == {
        "ok": True,
        "action": "seed",
        "memory_prepared": True,
        "result": {
            "seeded": True,
            "products": 12,
            "customers": 8,
            "orders": 10,
            "payments": 6,
        },
    }
    assert second == {
        "ok": True,
        "action": "seed",
        "memory_prepared": True,
        "result": {"seeded": False, "reason": "already seeded; use force"},
    }


def test_seed_job_is_never_scheduled_and_is_promoted_with_release():
    root = Path(__file__).resolve().parent.parent
    run_tf = (root / "deployment/terraform/app/run.tf").read_text()
    scheduler_tf = (root / "deployment/terraform/app/scheduler.tf").read_text()
    deploy_dev = (root / ".github/workflows/deploy-dev.yml").read_text()
    release_prod = (root / ".github/workflows/release-prod.yml").read_text()

    assert 'resource "google_cloud_run_v2_job" "seed"' in run_tf
    assert 'args    = ["seed"]' in run_tf
    assert 'AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name' in run_tf
    assert "google_cloud_run_v2_job.seed" not in scheduler_tf
    assert "gcloud run jobs update duka-dev-seed" in deploy_dev
    assert "gcloud run jobs update duka-prod-seed" in release_prod
    assert "steps.previous.outputs.seed_image" in release_prod
