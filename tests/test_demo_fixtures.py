"""Google-only bilingual fixtures are frozen, and the gate still fails closed."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.verify_demo_fixtures import verify


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "fixtures" / "demo" / "manifest.json"


def test_demo_fixture_manifest_declares_the_frozen_google_release():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema_version"] == 2
    assert manifest["release_ready"] is True
    assert manifest["synthetic_only"] is True
    assert manifest["provider_policy"] == {
        "generated_media": "google_only",
        "allowed": [
            "google_vertex_ai",
            "google_cloud_text_to_speech",
        ],
    }
    # A frozen manifest carries media and, by schema rule, no blocked reason.
    assert "blocked_reason" not in manifest
    assert {item["language"] for item in manifest["ledgers"]} == {"en-KE", "sw-KE"}
    assert {item["language"] for item in manifest["voices"]} == {"en-KE", "sw-KE"}


def test_release_verification_passes_on_the_frozen_manifest():
    assert verify(MANIFEST) == {
        "schema_version": 2,
        "ledgers": 2,
        "voices": 2,
        "languages": ["en-KE", "sw-KE"],
        "providers": ["google_cloud_text_to_speech", "google_vertex_ai"],
    }


def test_every_frozen_ledger_keeps_the_two_record_one_gate_truth():
    manifest = json.loads(MANIFEST.read_text())
    for ledger in manifest["ledgers"]:
        truth = ledger["ground_truth"]
        assert truth["recorded_rows"] == 2 and truth["gated_rows"] == 1
        gated = [row for row in truth["rows"] if row["expected_action"] == "gate"]
        # The unreadable amount must stay null: no value may be invented for it.
        assert len(gated) == 1 and gated[0]["amount_ksh"] is None


def test_voice_records_the_locale_it_was_actually_synthesized_in():
    """The Gemini voice serves Kenyan English through en-US; say so."""
    manifest = json.loads(MANIFEST.read_text())
    for voice in manifest["voices"]:
        assert voice["source"]["synthesis_language_code"]


def test_a_pending_manifest_still_fails_closed(tmp_path):
    pending = json.loads(MANIFEST.read_text())
    pending["release_ready"] = False
    path = tmp_path / "manifest.json"

    # Pending plus media is the dangerous shape: unfrozen assets on display.
    path.write_text(json.dumps(pending), encoding="utf-8")
    with pytest.raises(ValueError, match="release_ready=true"):
        verify(path)
    with pytest.raises(ValueError, match="must not expose unfrozen media"):
        verify(path, allow_pending=True)

    pending.update({"ledgers": [], "voices": [], "blocked_reason": "assets pending"})
    path.write_text(json.dumps(pending), encoding="utf-8")
    assert verify(path, allow_pending=True)["status"] == "pending"


def test_removed_non_google_media_is_not_present():
    assert not (ROOT / "fixtures" / "demo" / "ledger-page-v1.png").exists()
    voice_dir = ROOT / "data" / "voice_notes"
    assert not voice_dir.exists() or list(voice_dir.iterdir()) == []
