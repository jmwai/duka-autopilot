# Google media generation preflight

> Date: 2026-08-27
>
> Scope: offline validation only; no API enablement and no generation call

The bilingual release generator passed its fail-closed preflight for exactly
four synthetic Google media calls in project `agent-platform-503913`
(`183775788663`):

| Artifact pair | Provider | Model | Location | Languages |
|---|---|---|---|---|
| Ledger pages | Google Vertex AI | `gemini-3.1-flash-image` | `global` | `en-KE`, `sw-KE` |
| Voice notes | Google Cloud Text-to-Speech | `gemini-2.5-flash-tts`, `Kore` | `eu` | `en-KE`, `sw-KE` |

The preflight printed the approved billing project, four output paths, and the
SHA-256 of each ledger prompt and voice transcript. It refuses another project,
does not import a cloud SDK in dry-run mode, and refuses to overwrite an
existing candidate unless `--overwrite` is explicit.

Additional release protections now in the generator:

- Vertex requests both text and image response modalities, matching the current
  API contract.
- Response bytes are decoded and normalized to a real RGB PNG rather than being
  trusted based on a filename.
- All selected outputs stay in a same-filesystem staging directory until every
  response has produced a structurally valid image or WAV.
- The frozen manifest remains untouched and `release_ready=false`; generation
  creates review candidates, not release evidence.
- Provenance includes provider, project, location, model, prompt/transcript
  hashes, source response MIME type, available token usage, creation timestamp,
  file hash, byte count, and dimensions or duration.

## Commands and results

```text
uv run python scripts/generate_google_demo_assets.py \
  --kind all --project agent-platform-503913 --dry-run

planned_calls: 4
providers: google_vertex_ai, google_cloud_text_to_speech
languages: en-KE, sw-KE
```

Focused media-policy Python tests: **14 passed**. They cover the pending
Google-only manifest, the exact bilingual call plan, refusal of an unapproved
project, refusal of an implicit overwrite, decoding a WebP response into a
genuine RGB PNG, frozen-manifest integrity, exact model/location contracts, and
rejection of provenance from the superseded project.

The installed `google-genai` client also accepted the local request shape
`response_modalities=['TEXT', 'IMAGE']` and `aspect_ratio='2:3'` without a
network call. The optional Cloud TTS package is locked but not installed in the
current environment; installing it and invoking either API remain behind the
explicit F3 approval gate.

Official references:

- [Gemini 3.1 Flash Image](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image)
- [Vertex AI image generation quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)
- [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
- [Google generative AI pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
