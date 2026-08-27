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
import json
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "fixtures" / "demo"
PROMPT_DIR = FIXTURE_DIR / "prompts"

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


def _metadata(path: Path, *, source: dict[str, Any]) -> dict[str, Any]:
    payload = path.read_bytes()
    result: dict[str, Any] = {
        "path": path.relative_to(ROOT).as_posix(),
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


def generate_ledgers(project: str, location: str, model: str) -> list[dict[str, Any]]:
    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True,
        project=project,
        location=location,
        http_options=types.HttpOptions(api_version="v1"),
    )
    generated: list[dict[str, Any]] = []
    for language, fixture in LEDGERS.items():
        prompt_path = fixture["prompt"]
        output_path = fixture["output"]
        prompt = prompt_path.read_text(encoding="utf-8")
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
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
        output_path.write_bytes(image_data.data)
        prompt_payload = prompt_path.read_bytes()
        generated.append(
            {
                "language": language,
                **_metadata(
                    output_path,
                    source={
                        "provider": "google_vertex_ai",
                        "project_id": project,
                        "location": location,
                        "model": model,
                        "prompt_path": prompt_path.relative_to(ROOT).as_posix(),
                        "prompt_sha256": _sha256(prompt_payload),
                        "generated_utc": datetime.now(timezone.utc).isoformat(),
                        "synthetic": True,
                    },
                ),
            }
        )
    return generated


def generate_voices(project: str, location: str, model: str, speaker: str) -> list[dict[str, Any]]:
    from google.api_core.client_options import ClientOptions
    from google.cloud import texttospeech

    endpoint = "texttospeech.googleapis.com" if location == "global" else f"{location}-texttospeech.googleapis.com"
    client = texttospeech.TextToSpeechClient(client_options=ClientOptions(api_endpoint=endpoint))
    generated: list[dict[str, Any]] = []
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
        output_path = fixture["output"]
        output_path.write_bytes(response.audio_content)
        generated.append(
            {
                "language": language,
                "transcript": fixture["text"],
                "english_translation": fixture["english_translation"],
                **_metadata(
                    output_path,
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
    return generated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("all", "ledger", "voice"), default="all")
    parser.add_argument("--project", default="my-duka-autopilot")
    parser.add_argument("--image-location", default="global")
    parser.add_argument("--image-model", default="gemini-2.5-flash-image")
    # Cloud Text-to-Speech exposes Gemini-TTS in the EU multi-region. The
    # europe-west1 listing applies to the Vertex AI API, not Cloud TTS.
    parser.add_argument("--voice-location", default="eu")
    parser.add_argument("--voice-model", default="gemini-2.5-flash-tts")
    parser.add_argument("--speaker", default="Kore")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result: dict[str, Any] = {"schema_version": 1, "generated": {}}
    if args.kind in {"all", "ledger"}:
        result["generated"]["ledgers"] = generate_ledgers(
            args.project, args.image_location, args.image_model
        )
    if args.kind in {"all", "voice"}:
        result["generated"]["voices"] = generate_voices(
            args.project, args.voice_location, args.voice_model, args.speaker
        )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
