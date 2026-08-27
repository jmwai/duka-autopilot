"""Fail-closed state before Google bilingual fixtures are frozen."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.verify_demo_fixtures import verify


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "fixtures" / "demo" / "manifest.json"


def test_demo_fixture_manifest_quarantines_legacy_media():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema_version"] == 2
    assert manifest["release_ready"] is False
    assert manifest["synthetic_only"] is True
    assert manifest["provider_policy"] == {
        "generated_media": "google_only",
        "allowed": [
            "google_vertex_ai",
            "google_cloud_text_to_speech",
        ],
    }
    assert manifest["ledgers"] == []
    assert manifest["voices"] == []


def test_quarantined_manifest_cannot_pass_release_verification():
    with pytest.raises(ValueError, match="release_ready=true"):
        verify(MANIFEST)


def test_quarantined_manifest_passes_pending_google_policy_verification():
    result = verify(MANIFEST, allow_pending=True)
    assert result == {
        "schema_version": 2,
        "status": "pending",
        "release_ready": False,
        "ledgers": 0,
        "voices": 0,
        "languages_required": ["en-KE", "sw-KE"],
        "providers_allowed": [
            "google_cloud_text_to_speech",
            "google_vertex_ai",
        ],
    }


def test_removed_non_google_media_is_not_present():
    assert not (ROOT / "fixtures" / "demo" / "ledger-page-v1.png").exists()
    voice_dir = ROOT / "data" / "voice_notes"
    assert not voice_dir.exists() or list(voice_dir.iterdir()) == []
