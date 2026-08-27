"""Generate Google-only bilingual ledger and voice demo fixtures.

This script deliberately does not edit the frozen manifest. It writes binary
candidates and prints machine-readable metadata for a human-reviewed candidate
to be frozen with ``scripts/verify_demo_fixtures.py``.

Examples:

    uv run --extra assets python scripts/generate_google_demo_assets.py --kind ledger
    uv run --extra assets python scripts/generate_google_demo_assets.py --kind voice

The script uses Application Default Credentials and always sends the explicit
``--project`` value. It never uses an API key or a non-Google model provider.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import tempfile
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "fixtures" / "demo"
PROMPT_DIR = FIXTURE_DIR / "prompts"
AUTHORIZED_PROJECT = "agent-platform-503913"

LEDGERS = {
    "en-KE": {
        "prompt": PROMPT_DIR / "ledger-en-v2.txt",
        "output": FIXTURE_DIR / "ledger-en-v2.png",
    },
    "sw-KE": {
        "prompt": PROMPT_DIR / "ledger-sw-v2.txt",
        "output": FIXTURE_DIR / "ledger-sw-v2.png",
    },
}

VOICES = {
    "en-KE": {
        "text": "Hello, please bring me my usual order tomorrow morning.",
        "english_translation": "Hello, please bring me my usual order tomorrow morning.",
        "prompt": (
            "Speak as a friendly adult Kenyan shop customer leaving a short "
            "voice note. Use a natural conversational pace, clear diction, and "
            "a warm, matter-of-fact tone. Do not add or omit any words."
        ),
        "output": FIXTURE_DIR / "voice-usual-en-v1.wav",
    },
    "sw-KE": {
        "text": "Habari, niletee vitu vyangu vya kawaida kesho asubuhi.",
        "english_translation": "Hello, please bring me my usual items tomorrow morning.",
        "prompt": (
            "Sema kama mteja mtu mzima wa Kenya anayeacha ujumbe mfupi wa sauti "
            "kwa duka. Tumia kasi ya kawaida, matamshi wazi, na sauti ya kirafiki. "
            "Usiongeze wala kuondoa maneno yoyote."
        ),
        "output": FIXTURE_DIR / "voice-usual-sw-v1.wav",
    },
}


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _metadata(
    path: Path,
    *,
    final_path: Path,
    source: dict[str, Any],
) -> dict[str, Any]:
    payload = path.read_bytes()
    result: dict[str, Any] = {
        "path": final_path.relative_to(ROOT).as_posix(),
        "bytes": len(payload),
        "sha256": _sha256(payload),
        "source": source,
    }
    if path.suffix.lower() == ".png":
        with Image.open(path) as image:
            result.update({"mime_type": "image/png", "width": image.width, "height": image.height})
    else:
        result["mime_type"] = "audio/wav"
        with wave.open(str(path), "rb") as audio:
            result["duration_seconds"] = round(
                audio.getnframes() / audio.getframerate(), 3)
    return result


def _normalise_png(payload: bytes, output_path: Path) -> tuple[int, int]:
    """Decode a generated image and write a real RGB PNG."""
    with Image.open(io.BytesIO(payload)) as image:
        image.load()
        normalised = image.convert("RGB")
        normalised.save(output_path, format="PNG", optimize=True)
        return normalised.width, normalised.height


def _usage_metadata(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return {}
    fields = {
        "prompt_tokens": "prompt_token_count",
        "output_tokens": "candidates_token_count",
        "total_tokens": "total_token_count",
    }
    return {
        output_name: int(value)
        for output_name, attribute in fields.items()
        if (value := getattr(usage, attribute, None)) is not None
    }


def generate_ledgers(
    project: str,
    location: str,
    model: str,
    staging_dir: Path,
) -> tuple[list[dict[str, Any]], list[tuple[Path, Path]]]:
    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True,
        project=project,
        location=location,
        http_options=types.HttpOptions(api_version="v1"),
    )
    generated: list[dict[str, Any]] = []
    staged: list[tuple[Path, Path]] = []
    for language, fixture in LEDGERS.items():
        prompt_path = fixture["prompt"]
        final_path = fixture["output"]
        output_path = staging_dir / final_path.name
        prompt = prompt_path.read_text(encoding="utf-8")
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=[types.Modality.TEXT, types.Modality.IMAGE],
                image_config=types.ImageConfig(aspect_ratio="2:3"),
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        image_parts = [
            part.inline_data
            for candidate in response.candidates or []
            for part in (candidate.content.parts if candidate.content else [])
            if part.inline_data and part.inline_data.data
        ]
        if len(image_parts) != 1:
            raise RuntimeError(f"Expected one image for {language}; received {len(image_parts)}")
        image_data = image_parts[0]
        _normalise_png(image_data.data, output_path)
        prompt_payload = prompt_path.read_bytes()
        generated.append(
            {
                "language": language,
                **_metadata(
                    output_path,
                    final_path=final_path,
                    source={
                        "provider": "google_vertex_ai",
                        "project_id": project,
                        "location": location,
                        "model": model,
                        "prompt_path": prompt_path.relative_to(ROOT).as_posix(),
                        "prompt_sha256": _sha256(prompt_payload),
                        "response_mime_type": image_data.mime_type,
                        "usage": _usage_metadata(response),
                        "generated_utc": datetime.now(timezone.utc).isoformat(),
                        "synthetic": True,
                    },
                ),
            }
        )
        staged.append((output_path, final_path))
    return generated, staged


def generate_voices(
    project: str,
    location: str,
    model: str,
    speaker: str,
    staging_dir: Path,
) -> tuple[list[dict[str, Any]], list[tuple[Path, Path]]]:
    from google.api_core.client_options import ClientOptions
    from google.cloud import texttospeech

    endpoint = "texttospeech.googleapis.com" if location == "global" else f"{location}-texttospeech.googleapis.com"
    client = texttospeech.TextToSpeechClient(client_options=ClientOptions(api_endpoint=endpoint))
    generated: list[dict[str, Any]] = []
    staged: list[tuple[Path, Path]] = []
    for language, fixture in VOICES.items():
        response = client.synthesize_speech(
            request={
                "input": texttospeech.SynthesisInput(text=fixture["text"], prompt=fixture["prompt"]),
                "voice": texttospeech.VoiceSelectionParams(
                    language_code=language,
                    name=speaker,
                    model_name=model,
                ),
                "audio_config": texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                ),
            }
        )
        final_path = fixture["output"]
        output_path = staging_dir / final_path.name
        output_path.write_bytes(response.audio_content)
        generated.append(
            {
                "language": language,
                "transcript": fixture["text"],
                "english_translation": fixture["english_translation"],
                **_metadata(
                    output_path,
                    final_path=final_path,
                    source={
                        "provider": "google_cloud_text_to_speech",
                        "project_id": project,
                        "location": location,
                        "model": model,
                        "speaker": speaker,
                        "style_prompt": fixture["prompt"],
                        "transcript_sha256": _sha256(
                            fixture["text"].encode("utf-8")),
                        "style_prompt_sha256": _sha256(
                            fixture["prompt"].encode("utf-8")),
                        "generated_utc": datetime.now(timezone.utc).isoformat(),
                        "synthetic": True,
                    },
                ),
            }
        )
        staged.append((output_path, final_path))
    return generated, staged


def _selected_fixtures(kind: str) -> list[tuple[str, str, dict[str, Any]]]:
    selected: list[tuple[str, str, dict[str, Any]]] = []
    if kind in {"all", "ledger"}:
        selected.extend(("ledger", language, fixture) for language, fixture in LEDGERS.items())
    if kind in {"all", "voice"}:
        selected.extend(("voice", language, fixture) for language, fixture in VOICES.items())
    return selected


def preflight(args: argparse.Namespace) -> dict[str, Any]:
    """Validate the bounded generation plan without importing a cloud SDK."""
    if args.project != AUTHORIZED_PROJECT:
        raise ValueError(
            f"Refusing project {args.project!r}; approved project is {AUTHORIZED_PROJECT!r}"
        )

    planned: list[dict[str, Any]] = []
    for artifact_kind, language, fixture in _selected_fixtures(args.kind):
        output_path: Path = fixture["output"]
        if output_path.exists() and not args.overwrite:
            raise FileExistsError(
                f"Refusing to overwrite {output_path}; inspect it or pass --overwrite"
            )
        item: dict[str, Any] = {
            "kind": artifact_kind,
            "language": language,
            "output": output_path.relative_to(ROOT).as_posix(),
        }
        if artifact_kind == "ledger":
            prompt_path: Path = fixture["prompt"]
            if not prompt_path.is_file():
                raise FileNotFoundError(prompt_path)
            prompt_payload = prompt_path.read_bytes()
            if not prompt_payload.strip():
                raise ValueError(f"Prompt is empty: {prompt_path}")
            item.update(
                {
                    "provider": "google_vertex_ai",
                    "location": args.image_location,
                    "model": args.image_model,
                    "prompt_sha256": _sha256(prompt_payload),
                }
            )
        else:
            if not fixture["text"].strip() or not fixture["prompt"].strip():
                raise ValueError(f"Voice input is empty for {language}")
            item.update(
                {
                    "provider": "google_cloud_text_to_speech",
                    "location": args.voice_location,
                    "model": args.voice_model,
                    "speaker": args.speaker,
                    "transcript_sha256": _sha256(fixture["text"].encode("utf-8")),
                }
            )
        planned.append(item)

    return {
        "schema_version": 1,
        "dry_run": bool(args.dry_run),
        "project_id": args.project,
        "planned_calls": len(planned),
        "artifacts": planned,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("all", "ledger", "voice"), default="all")
    parser.add_argument("--project", default="agent-platform-503913")
    parser.add_argument("--image-location", default="global")
    parser.add_argument("--image-model", default="gemini-3.1-flash-image")
    # Cloud Text-to-Speech exposes Gemini-TTS in the EU multi-region. The
    # europe-west1 listing applies to the Vertex AI API, not Cloud TTS.
    parser.add_argument("--voice-location", default="eu")
    parser.add_argument("--voice-model", default="gemini-2.5-flash-tts")
    parser.add_argument("--speaker", default="Kore")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the four-call plan without importing a cloud SDK.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing candidate files after explicit review.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    plan = preflight(args)
    if args.dry_run:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0

    result: dict[str, Any] = {
        "schema_version": 1,
        "project_id": args.project,
        "planned_calls": plan["planned_calls"],
        "generated": {},
    }
    staged: list[tuple[Path, Path]] = []
    with tempfile.TemporaryDirectory(prefix=".generated-", dir=FIXTURE_DIR) as temp_dir:
        staging_dir = Path(temp_dir)
        if args.kind in {"all", "ledger"}:
            ledgers, ledger_files = generate_ledgers(
                args.project, args.image_location, args.image_model, staging_dir
            )
            result["generated"]["ledgers"] = ledgers
            staged.extend(ledger_files)
        if args.kind in {"all", "voice"}:
            voices, voice_files = generate_voices(
                args.project,
                args.voice_location,
                args.voice_model,
                args.speaker,
                staging_dir,
            )
            result["generated"]["voices"] = voices
            staged.extend(voice_files)

        # Every selected call must produce a valid artifact before any candidate
        # is exposed at its review path.
        if len(staged) != plan["planned_calls"]:
            raise RuntimeError(
                f"Expected {plan['planned_calls']} staged artifacts; received {len(staged)}"
            )
        for staged_path, final_path in staged:
            os.replace(staged_path, final_path)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
