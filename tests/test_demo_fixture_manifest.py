from __future__ import annotations

import hashlib
import json
import wave
from pathlib import Path

import pytest
from PIL import Image

import scripts.verify_demo_fixtures as verifier


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_png(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (12, 18), "white").save(path, format="PNG")


def _write_wav(path: Path) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    rate = 8_000
    frames = b"\x00\x00" * 800
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(frames)
    return 800 / rate


def _manifest(root: Path) -> dict:
    prompt_dir = root / "fixtures" / "demo" / "prompts"
    prompt_dir.mkdir(parents=True)
    ledgers = []
    voices = []
    for language, suffix in (("en-KE", "en"), ("sw-KE", "sw")):
        prompt = prompt_dir / f"ledger-{suffix}.txt"
        prompt.write_text(f"Google fixture prompt {language}", encoding="utf-8")
        image = root / "fixtures" / "demo" / f"ledger-{suffix}.png"
        _write_png(image)
        ledgers.append(
            {
                "id": f"ledger-{suffix}",
                "language": language,
                "path": image.relative_to(root).as_posix(),
                "mime_type": "image/png",
                "bytes": image.stat().st_size,
                "sha256": _sha(image),
                "width": 12,
                "height": 18,
                "synthetic": True,
                "source": {
                    "provider": "google_vertex_ai",
                    "project_id": "agent-platform-503913",
                    "location": "global",
                    "model": "gemini-3.1-flash-image",
                    "prompt_path": prompt.relative_to(root).as_posix(),
                    "prompt_sha256": _sha(prompt),
                    "response_mime_type": "image/png",
                    "usage": {"output_tokens": 1120},
                    "generated_utc": "2026-08-27T08:00:00+00:00",
                    "synthetic": True,
                },
                "ground_truth": {
                    "recorded_rows": 2,
                    "gated_rows": 1,
                    "rows": [
                        {"amount_ksh": 390, "expected_action": "record"},
                        {"amount_ksh": 320, "expected_action": "record"},
                        {"amount_ksh": None, "expected_action": "gate"},
                    ],
                },
            }
        )
        voice = root / "fixtures" / "demo" / f"voice-{suffix}.wav"
        duration = _write_wav(voice)
        transcript = "Please bring my usual." if suffix == "en" else "Niletee ya kawaida."
        style_prompt = f"Synthetic Google voice fixture for {language}."
        voices.append(
            {
                "id": f"voice-{suffix}",
                "language": language,
                "path": voice.relative_to(root).as_posix(),
                "mime_type": "audio/wav",
                "bytes": voice.stat().st_size,
                "sha256": _sha(voice),
                "duration_seconds": duration,
                "transcript": transcript,
                "english_translation": "Please bring my usual.",
                "synthetic": True,
                "source": {
                    "provider": "google_cloud_text_to_speech",
                    "project_id": "agent-platform-503913",
                    "location": "eu",
                    "model": "gemini-2.5-flash-tts",
                    "speaker": "Kore",
                    "style_prompt": style_prompt,
                    "transcript_sha256": hashlib.sha256(transcript.encode()).hexdigest(),
                    "style_prompt_sha256": hashlib.sha256(style_prompt.encode()).hexdigest(),
                    "generated_utc": "2026-08-27T08:00:00+00:00",
                    "synthetic": True,
                },
            }
        )
    return {
        "schema_version": 2,
        "release_ready": True,
        "synthetic_only": True,
        "provider_policy": {
            "generated_media": "google_only",
            "allowed": ["google_vertex_ai", "google_cloud_text_to_speech"],
        },
        "ledgers": ledgers,
        "voices": voices,
    }


@pytest.fixture
def frozen_manifest(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, dict]:
    manifest = _manifest(tmp_path)
    path = tmp_path / "fixtures" / "demo" / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    monkeypatch.setattr(verifier, "ROOT", tmp_path)
    return path, manifest


def test_bilingual_google_fixture_manifest_passes(frozen_manifest: tuple[Path, dict]) -> None:
    path, _ = frozen_manifest
    result = verifier.verify(path)
    assert result == {
        "schema_version": 2,
        "ledgers": 2,
        "voices": 2,
        "languages": ["en-KE", "sw-KE"],
        "providers": ["google_cloud_text_to_speech", "google_vertex_ai"],
    }


def test_missing_english_variant_fails_closed(frozen_manifest: tuple[Path, dict]) -> None:
    path, manifest = frozen_manifest
    manifest["voices"] = [item for item in manifest["voices"] if item["language"] != "en-KE"]
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="exactly en-KE and sw-KE"):
        verifier.verify(path)


def test_non_google_generated_provider_fails_closed(frozen_manifest: tuple[Path, dict]) -> None:
    path, manifest = frozen_manifest
    manifest["ledgers"][0]["source"]["provider"] = "unapproved_image_generator"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="provider is absent from the manifest allowlist"):
        verifier.verify(path)


def test_superseded_gcp_project_provenance_fails_closed(
    frozen_manifest: tuple[Path, dict],
) -> None:
    path, manifest = frozen_manifest
    manifest["ledgers"][0]["source"]["project_id"] = "retired-project"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="approved GCP project"):
        verifier.verify(path)


def test_broadened_provider_policy_fails_closed(frozen_manifest: tuple[Path, dict]) -> None:
    path, manifest = frozen_manifest
    manifest["provider_policy"]["allowed"].append("unapproved_media_surface")
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="only approved Google surfaces"):
        verifier.verify(path)


def test_fixture_path_cannot_escape_repository(frozen_manifest: tuple[Path, dict]) -> None:
    path, manifest = frozen_manifest
    manifest["voices"][0]["path"] = "../../outside.wav"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="escapes the repository"):
        verifier.verify(path)
