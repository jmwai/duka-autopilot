# Google bilingual media approval packet

> Prepared: 2026-08-27
>
> Project: `agent-platform-503913`
>
> Project number: `183775788663`
>
> Application region: `europe-west1`
>
> Status: approval requested; no API has been enabled and no generation call
> has been made by this packet

## Decision requested

Approve this bounded Phase 4 operation:

1. enable `aiplatform.googleapis.com` and `texttospeech.googleapis.com` in
   `agent-platform-503913`;
2. make two Vertex AI image-generation calls in `global`, one for each of the
   English and Kiswahili synthetic ledger candidates;
3. make two Gemini-TTS calls through the Cloud Text-to-Speech `eu`
   multi-region, one for each language;
4. permit at most two additional two-ledger candidate rounds only when the
   exact handwritten text is not legible enough to preserve reviewed truth;
5. stop before any deployment, Terraform apply, or unrelated API activation.

The initial operation is four model calls. The hard approval envelope is eight
calls: six image candidates and two voice candidates. A larger retry set needs
a new approval.

## Why these APIs, models, and locations

| Artifact | Google surface | Model | Location | Reason |
|---|---|---|---|---|
| English ledger | Vertex AI native image generation | `gemini-3.1-flash-image` | `global` | Current Google image model recommended for image generation; release artifact only |
| Kiswahili ledger | Vertex AI native image generation | `gemini-3.1-flash-image` | `global` | Same model and prompt contract for a comparable bilingual pair |
| English voice | Cloud Text-to-Speech Gemini-TTS | `gemini-2.5-flash-tts`, speaker `Kore` | `eu` | Prompted natural speech and a WAV container from the Cloud TTS API |
| Kiswahili voice | Cloud Text-to-Speech Gemini-TTS | `gemini-2.5-flash-tts`, speaker `Kore` | `eu` | Same voice/model boundary; transcript and English translation are frozen |

The app still deploys to `europe-west1`. The Cloud Text-to-Speech API supports
Gemini-TTS at the `eu` endpoint, not `europe-west1`; `europe-west1` is listed
for the Vertex AI TTS interface. Keeping Cloud TTS at `eu` preserves European
processing and avoids an invalid regional endpoint.

Official basis:

- [Gemini image generation on Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation)
- [Gemini-TTS regions and API choice](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
- [Cloud Text-to-Speech regional endpoints](https://docs.cloud.google.com/text-to-speech/docs/endpoints)
- [Google generative AI pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- [Cloud Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing)

## Cost envelope

Google documents a roughly 1 MP Gemini 3.1 Flash Image output as 1,120 image
tokens, approximately $0.067 at standard pricing. Resolution changes the exact
charge. Six candidates are therefore expected to stay below $0.50 plus small
prompt and text-output charges.

Gemini 2.5 Flash TTS is $0.50 per million input text tokens and $10 per million
audio tokens; audio is approximately 25 tokens per second. These two short
notes are expected to cost far below one cent. The approved media-generation
ceiling is **$1.00**; stop and report if observed usage or required retries could
exceed it.

This estimate excludes later agent evals, benchmark inference, Cloud Run,
Firestore, Sessions, Memory Bank, and logging. Those remain in the deployment
approval packet.

## Inputs and data handling

- Prompts and transcripts are checked into `fixtures/demo/prompts/` and
  `scripts/generate_google_demo_assets.py`.
- All people, orders, ledger rows, and M-Pesa-like references are synthetic.
- No real phone, payment reference, shop record, customer image, or recording
  of a person is sent.
- Authentication is Application Default Credentials. No API key or service-
  account JSON file is created.
- Generated media is written only to `fixtures/demo/` in this workspace.

## Offline preflight (no API call)

This command validates the exact project, prompts, hashes, models, locations,
speaker, output paths, and four-call boundary without importing a cloud SDK:

```bash
uv run --extra assets python scripts/generate_google_demo_assets.py \
  --kind all \
  --project agent-platform-503913 \
  --dry-run
```

## Exact commands after approval

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  texttospeech.googleapis.com \
  --project=agent-platform-503913

UV_CACHE_DIR=/tmp/duka-assets-uv-cache uv run --extra assets python \
  scripts/generate_google_demo_assets.py \
  --kind all \
  --project agent-platform-503913 \
  --image-location global \
  --image-model gemini-3.1-flash-image \
  --voice-location eu \
  --voice-model gemini-2.5-flash-tts \
  --speaker Kore
```

The generation script does not set `release_ready=true`. It produces candidate
binaries and machine-readable provenance for human review.

## Review and freeze gate

Before any candidate becomes a release fixture:

1. visually inspect both ledger pages and reject invented, missing, or
   unreadable required text;
2. listen to both voices and compare every word with the frozen transcripts;
3. run each artifact through the real production Gemini extraction path;
4. require exactly two valid ledger rows recorded and one unreadable-amount row
   gated for both languages;
5. require both usual-order voices to resolve the same item quantities while
   the current price still comes from the catalog;
6. record SHA-256, byte count, dimensions/duration, model, provider, location,
   timestamp, prompt/transcript hashes, translation, synthetic status, and
   reviewed ground truth;
7. run the fixture verifier, Python tests, Vitest, production build, and the
   voice/ledger Playwright journeys;
8. set `release_ready=true` only after all four variants pass.

Any rejected candidate stays out of the manifest and hosted app. Enabling the
APIs is reversible, but the plan leaves them enabled because Vertex AI is also
required by the final application. No generated output is automatically
published.
