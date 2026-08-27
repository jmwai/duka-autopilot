"""Contract tests for the credential/trailer detector itself."""
from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepush_audit.py"
SPEC = importlib.util.spec_from_file_location("prepush_audit", SCRIPT)
assert SPEC and SPEC.loader
prepush_audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepush_audit)
_forbidden_path = prepush_audit._forbidden_path
_remote_matches = prepush_audit._remote_matches
_secret_hits = prepush_audit._secret_hits


def test_prepush_detector_finds_high_confidence_credentials_without_echoing():
    payload = b"token=github_pat_" + b"a" * 24
    hits = _secret_hits(payload, "fixture")
    assert hits == [{"type": "github_token", "source": "fixture", "line": 1}]
    assert "github_pat" not in str(hits)


def test_prepush_detector_ignores_placeholders_and_flags_secret_files():
    assert _secret_hits(b"GOOGLE_API_KEY=replace-me", "fixture") == []
    assert not _forbidden_path(".env.example")
    assert _forbidden_path(".env")
    assert _forbidden_path(".env.local")
    assert _forbidden_path("backend/.env.production")
    assert _forbidden_path("ops/service-account-prod.json")
    assert _forbidden_path("keys/deployer.pem")


def test_prepush_remote_accepts_only_exact_repository_url_forms():
    assert _remote_matches("git@github.com:jmwai/duka-autopilot.git")
    assert _remote_matches("https://github.com/jmwai/duka-autopilot")
    assert _remote_matches("https://github.com/jmwai/duka-autopilot.git")
    assert not _remote_matches("https://github.com/other/duka-autopilot")
    assert not _remote_matches("https://evil.example/jmwai/duka-autopilot.git")
    assert not _remote_matches("https://github.com/jmwai/duka-autopilot-extra")
