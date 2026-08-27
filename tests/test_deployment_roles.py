"""Role-specific Cloud Run surfaces remain narrow and independently healthy."""
from __future__ import annotations

import base64
import json
import re
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


def test_worker_readiness_requires_vertex_backend(monkeypatch):
    from app.worker_api import app

    for key, value in {
        "GOOGLE_CLOUD_PROJECT": "agent-platform-503913",
        "FIRESTORE_DATABASE": "duka-dev",
        "AGENT_CONTEXT_ID": "123",
        "DUKA_USER_KEY_SECRET": "test-user-key",
        "DUKA_TRACE_ENABLED": "true",
        "DUKA_STORE": "firestore",
        "GOOGLE_GENAI_USE_VERTEXAI": "false",
    }.items():
        monkeypatch.setenv(key, value)
    with TestClient(app) as client:
        response = client.get("/ready")
        assert response.status_code == 503
        assert "GOOGLE_GENAI_USE_VERTEXAI=true" in response.json()["missing"]

        monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")
        assert client.get("/ready").status_code == 200


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
    assert 'args    = ["seed", "--seed-profile", "judge", "--seed-rows", "50000"]' in run_tf
    assert 'timeout         = "3600s"' in run_tf
    assert 'limits = { cpu = "2", memory = "2Gi" }' in run_tf
    assert 'AGENT_CONTEXT_ID = google_vertex_ai_reasoning_engine.context.name' in run_tf
    assert "google_cloud_run_v2_job.seed" not in scheduler_tf
    assert "gcloud run jobs update duka-dev-seed" in deploy_dev
    assert "gcloud run jobs update duka-prod-seed" in release_prod
    assert "steps.previous.outputs.seed_image" in release_prod


def test_seed_receipt_never_labels_local_execution_as_cloud(monkeypatch):
    from app.jobs import _seed_execution_surface

    monkeypatch.setenv("DUKA_ENV", "local")
    assert _seed_execution_surface() == "local_seed_job"
    monkeypatch.setenv("DUKA_ENV", "dev")
    assert _seed_execution_surface() == "cloud_run_seed_job"
    monkeypatch.setenv("DUKA_ENV", "prod")
    assert _seed_execution_surface() == "cloud_run_seed_job"


def test_ci_installs_firestore_emulator_command_group_explicitly():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github/workflows/ci.yml").read_text()

    assert "actions/setup-java@b6effb05e454b25005698d916606bdc6ffcbf961" in workflow
    assert 'java-version: "21"' in workflow
    assert "install_components: beta,cloud-firestore-emulator" in workflow
    assert workflow.index("Install Java 21") < workflow.index("install_components:")
    assert workflow.index("install_components:") < workflow.index(
        "gcloud beta emulators firestore start")


def test_direct_and_reusable_ci_runs_have_distinct_concurrency_groups():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github/workflows/ci.yml").read_text()

    assert "group: ci-${{ github.workflow }}-${{ github.ref }}" in workflow


def test_terraform_provider_locks_cover_local_and_ci_platforms():
    root = Path(__file__).resolve().parent.parent
    for module in ("bootstrap", "app"):
        lock = (root / f"deployment/terraform/{module}/.terraform.lock.hcl").read_text()
        # Each of the two providers must have one platform-specific h1 checksum
        # for Darwin ARM64 and one for Linux AMD64. The shared zh checksums alone
        # did not satisfy `terraform validate` on GitHub's clean Linux runner.
        assert lock.count('"h1:') == 4


def test_terraform_modules_lock_the_replacement_project_identity():
    root = Path(__file__).resolve().parent.parent
    for module, refusal in (
        ("bootstrap", "Refusing bootstrap"),
        ("app", "Refusing app plan"),
    ):
        module_root = root / f"deployment/terraform/{module}"
        variables = (module_root / "variables.tf").read_text()
        terraform = "\n".join(
            path.read_text() for path in sorted(module_root.glob("*.tf"))
        )
        example = (module_root / "terraform.tfvars.example").read_text()

        assert re.search(r'default\s*=\s*"agent-platform-503913"', variables)
        assert re.search(r'default\s*=\s*"183775788663"', variables)
        assert 'check "project_identity"' in terraform
        assert "data.google_project.current.number == var.expected_project_number" in terraform
        assert refusal in terraform
        assert 'project_id              = "agent-platform-503913"' in example
        assert 'expected_project_number = "183775788663"' in example


def test_ci_runs_the_frozen_nextjs_quality_gate_before_release_images():
    root = Path(__file__).resolve().parent.parent
    workflow = (root / ".github/workflows/ci.yml").read_text()
    dockerfile = (root / "deployment/docker/frontend.Dockerfile").read_text()

    assert "name: Next.js quality gate" in workflow
    assert "node-version: \"24.12.0\"" in workflow
    assert "pnpm install --frozen-lockfile" in workflow
    assert "run: pnpm check" in workflow
    assert "pnpm build && pnpm check:bundle" in (
        root / "frontend/package.json").read_text()
    assert "Smoke the paired non-root release containers" in workflow
    assert "python3 scripts/smoke_release.py" in workflow
    assert "--env DUKA_API_URL=http://duka-ci-api:8080" in workflow
    assert "Clean up release smoke containers" in workflow
    assert "node:24.12.0-bookworm-slim@sha256:" in dockerfile
    assert "COPY frontend/ ./" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert 'CMD ["node", "server.js"]' in dockerfile
