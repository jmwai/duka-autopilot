"""Integrity contract for stable, synthetic judge-facing demo fixtures."""
from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "fixtures" / "demo" / "manifest.json"


def test_demo_fixture_manifest_and_ledger_bitmap_are_frozen():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema_version"] == 1
    assert manifest["synthetic_only"] is True

    ledger = manifest["ledger"]
    image = ROOT / ledger["path"]
    payload = image.read_bytes()
    assert hashlib.sha256(payload).hexdigest() == ledger["sha256"]
    assert len(payload) == ledger["bytes"]
    assert len(payload) <= 6_000_000
    assert payload[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", payload[16:24])
    assert (width, height) == (ledger["width"], ledger["height"])
    assert (width, height) == (1024, 1536)

    truth = ledger["ground_truth"]
    assert truth["recorded_rows"] == 2
    assert truth["gated_rows"] == 1
    assert len(truth["rows"]) == 3
    assert [row["expected_action"] for row in truth["rows"]] == [
        "record", "record", "gate"]
    assert truth["rows"][2]["amount_ksh"] is None
    assert truth["rows"][2]["issue"] == "amount unreadable"


def test_voice_fixture_remains_explicitly_unfrozen_until_human_recording():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["voice"] == {
        "status": "pending_human_recording",
        "transcript": "Habari, niletee ya kawaida kesho asubuhi.",
    }
