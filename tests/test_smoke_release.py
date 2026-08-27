"""Release smoke verifies the public Next shell and private API as one SHA."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "smoke_release.py"
SPEC = importlib.util.spec_from_file_location("smoke_release", SCRIPT)
assert SPEC and SPEC.loader
smoke_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke_release)


def _successful_json(url: str, timeout: float = 10.0) -> dict:
    del timeout
    if url.endswith("/health"):
        return {"ok": True, "role": "web"}
    if url.endswith("/ready"):
        return {"ok": True, "role": "web", "dependency": "api"}
    if url.endswith("/api/version"):
        return {
            "release_sha": "a" * 40,
            "durable_topology": {"compatible": True},
        }
    if url.endswith("/version"):
        return {"release_sha": "a" * 40, "app": "duka-autopilot-web"}
    raise AssertionError(f"unexpected URL {url}")


def test_release_smoke_requires_both_revisions_and_denied_worker_route(monkeypatch):
    monkeypatch.setattr(smoke_release, "_get_json", _successful_json)
    monkeypatch.setattr(smoke_release, "_get_text", lambda *_args: "Duka Autopilot")
    monkeypatch.setattr(smoke_release, "_status", lambda *_args: 404)

    result = smoke_release.verify("https://duka.example", "a" * 40, attempts=1)

    assert result["web_version"]["release_sha"] == "a" * 40
    assert result["api_version"]["durable_topology"]["compatible"] is True
    assert result["forbidden_route_status"] == 404


def test_release_smoke_rejects_frontend_backend_sha_skew(monkeypatch):
    def skewed_json(url: str, timeout: float = 10.0) -> dict:
        result = _successful_json(url, timeout)
        if url.endswith("/api/version"):
            result["release_sha"] = "b" * 40
        return result

    monkeypatch.setattr(smoke_release, "_get_json", skewed_json)
    monkeypatch.setattr(smoke_release, "_get_text", lambda *_args: "Duka Autopilot")
    monkeypatch.setattr(smoke_release, "_status", lambda *_args: 404)

    with pytest.raises(RuntimeError, match="backend release SHA mismatch"):
        smoke_release.verify("https://duka.example", "a" * 40, attempts=1)
