"""Offline safety checks for the bounded Google-only media generator."""
from __future__ import annotations

import argparse
from io import BytesIO

import pytest
from PIL import Image

from scripts import generate_google_demo_assets as generator


def _args(**overrides: object) -> argparse.Namespace:
    values: dict[str, object] = {
        "kind": "all",
        "project": "agent-platform-503913",
        "image_location": "global",
        "image_model": "gemini-3.1-flash-image",
        "voice_location": "eu",
        "voice_model": "gemini-2.5-flash-tts",
        "speaker": "Kore",
        "dry_run": True,
        "overwrite": False,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def test_preflight_freezes_google_only_bilingual_four_call_plan():
    plan = generator.preflight(_args())

    assert plan["project_id"] == "agent-platform-503913"
    assert plan["dry_run"] is True
    assert plan["planned_calls"] == 4
    assert {(item["kind"], item["language"]) for item in plan["artifacts"]} == {
        ("ledger", "en-KE"),
        ("ledger", "sw-KE"),
        ("voice", "en-KE"),
        ("voice", "sw-KE"),
    }
    assert {item["provider"] for item in plan["artifacts"]} == {
        "google_vertex_ai",
        "google_cloud_text_to_speech",
    }
    assert {
        item["model"] for item in plan["artifacts"] if item["kind"] == "ledger"
    } == {"gemini-3.1-flash-image"}


def test_preflight_refuses_unapproved_billing_project():
    with pytest.raises(ValueError, match="approved project"):
        generator.preflight(_args(project="some-other-project"))


def test_preflight_refuses_to_replace_candidate_without_explicit_overwrite(
    tmp_path, monkeypatch
):
    output = tmp_path / "ledger-en-v2.png"
    output.write_bytes(b"already reviewed")
    monkeypatch.setitem(generator.LEDGERS["en-KE"], "output", output)

    with pytest.raises(FileExistsError, match="--overwrite"):
        generator.preflight(_args(kind="ledger"))


def test_image_response_is_decoded_and_normalised_to_real_png(tmp_path):
    source = BytesIO()
    Image.new("RGBA", (17, 29), (31, 117, 254, 127)).save(source, format="WEBP")
    output = tmp_path / "candidate.png"

    dimensions = generator._normalise_png(source.getvalue(), output)

    assert dimensions == (17, 29)
    assert output.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    with Image.open(output) as image:
        assert image.format == "PNG"
        assert image.mode == "RGB"
