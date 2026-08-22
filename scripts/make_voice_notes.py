"""Generate the Swahili voice-note test set with espeak-ng (offline TTS).

Real customers send voice notes; the demo needs reproducible ones. Each
sample has a ground-truth expected order in data/voice_notes/manifest.json,
so `adk eval` sets (and the demo video) have something honest to check
against. Synthetic TTS is deliberately imperfect - if intake handles robot
Swahili, market-noise Swahili with a human voice is the easy case... but the
video should still use a real recorded voice note for the wow beat.

Run: python scripts/make_voice_notes.py   (needs: apt install espeak-ng)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "voice_notes"

SAMPLES = [
    {
        "file": "unga_mafuta.wav",
        "text": "Habari, nataka unga bale mbili na chupa moja ya mafuta ya kupikia.",
        "expect": {"items": [{"sku": "UNGA-2KG", "qty": 2}, {"sku": "MAFUTA-1L", "qty": 1}]},
    },
    {
        "file": "sukari_chai.wav",
        "text": "Nipe sukari kilo tatu na majani ya chai pakiti moja tafadhali.",
        "expect": {"items": [{"sku": "SUKARI-1KG", "qty": 3}, {"sku": "CHAI-250G", "qty": 1}]},
    },
    {
        "file": "mchele_mayai.wav",
        "text": "Nataka mchele pishori pakiti mbili na trei moja ya mayai.",
        "expect": {"items": [{"sku": "RICE-2KG", "qty": 2}, {"sku": "MAYAI-TRAY", "qty": 1}]},
    },
    {
        "file": "mixed_english.wav",
        "text": "Hi, please send two bread na maziwa packet nne, asante.",
        "expect": {"items": [{"sku": "MKATE", "qty": 2}, {"sku": "MAZIWA-500", "qty": 4}]},
    },
    {
        "file": "ambiguous_usual.wav",
        "text": "Ni mimi Mama Achieng, niletee vitu vyangu vya kawaida.",
        "expect": {"note": "'the usual' - must resolve from memory or gate on review"},
    },
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SAMPLES:
        wav = OUT / s["file"]
        subprocess.run(
            ["espeak-ng", "-v", "sw", "-s", "150", "-w", str(wav), s["text"]],
            check=True)
        print("wrote", wav.name)
    (OUT / "manifest.json").write_text(json.dumps(SAMPLES, indent=2, ensure_ascii=False))
    print("wrote manifest.json")


if __name__ == "__main__":
    sys.exit(main())
