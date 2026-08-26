# Duka Autopilot Demo Fixture Manifest

> Status: ledger fixture frozen; human voice fixture pending
> Environment: synthetic data only
> Release SHA: `{{FINAL_RELEASE_SHA}}`

This manifest is the source of truth for the Loom fixtures and their expected
business effects. Do not replace a fixture after the release candidate is
tagged without rerunning its affected tests, ADK evals, cloud proof, transcript,
and rehearsal.

## Frozen identities and ground truth

| Fixture | Locked value | Verification |
|---|---|---|
| Demo customer | `254711000001` — Mama Achieng | Synthetic seed record |
| Opaque Memory scope | `app_name=duka-autopilot`; HMAC-derived user key | Record only the opaque key after cloud seed; never publish the raw HMAC secret |
| Confirmed usual | `4x Unga wa Dola 2kg + 3x Laundry soap bar` | Latest seeded Mama Achieng order; unique timestamp `08:03:00` |
| Current catalog total | `4 × 195 + 3 × 85 = KSh 1,035` | Recomputed from current catalog on every order |
| Voice transcript | `Habari, niletee ya kawaida kesho asubuhi.` | “Hello, bring me the usual tomorrow morning.” |
| Event ID | Fresh server-generated UUID per take | Capture the visible first 12 characters and the complete ID in evidence |
| Statement generator | `rows=50000`, `seed=2026`, duplicate rate `0.005` | `docs/evidence/benchmark-local.json`; cloud result must be separately measured |
| Demo statement | Six fixed synthetic M-Pesa-like rows | `agents/seed.py`; no real payment data |

The one-shot seed Job must report 12 products, 8 customers, 10 orders, 6
payments, and `memory_prepared=true`. The second execution must report
`seeded=false` and still confirm `memory_prepared=true`. The generated memory
may contain only the usual items and quantities plus advisory language; it may
not contain the customer ID, phone, price, payment, refund, complaint, or owner
authority.

## Media fixtures still required

| Fixture | Required artifact | Ground truth | Status |
|---|---|---|---|
| Swahili voice | Purpose-recorded human `.ogg`, `.webm`, or `.wav`; SHA-256 and duration | Exact transcript above; expected usual items and current KSh 1,035 total | Pending recording |
| Handwritten ledger | `fixtures/demo/ledger-page-v1.png`; PNG; 3,014,160 bytes; 1024×1536; SHA-256 `9b85c98d1d35e5b9c8a5e98d03dea9168ff014ce157c51bfa09da99de62f59a0` | Two legible rows: Unga Dola 2kg, qty 2, KSh 390, paid; Mafuta 1L, qty 1, KSh 320, paid. One Sukari 1kg row has an unreadable amount and must gate. | Bitmap and manifest frozen; actual Gemini extraction validation remains cloud-pending |

The audio must be a real purpose-recorded human voice if the submission says
“real human voice.” A TTS file may be used only if the transcript and demo label
it synthetic. The ledger must contain no real name, phone, account, or payment
reference.

The ledger was created with OpenAI's built-in image-generation tool on August
26, 2026 and is intentionally synthetic. Its machine-readable ground truth and
integrity contract live in `fixtures/demo/manifest.json`; local tests verify its
hash, byte size, dimensions, decoded-size limit, and two-record/one-gate
contract. This protects artifact drift but does not substitute for running the
actual Gemini vision path on the final cloud release.

## Freeze procedure

1. Save media under `fixtures/demo/` with descriptive, versioned filenames.
2. Record SHA-256, MIME type, byte size, dimensions/duration, creator, and
   creation date in this manifest.
3. Run the actual model path on the final release and save the structured result.
4. Confirm voice produces the frozen usual through a new managed Session and
   current catalog lookup.
5. Confirm the ledger produces exactly two recorded rows and one gated row.
6. Copy the exact filenames and hashes into `docs/demo-guide.md` and the evidence
   ledger, then freeze both Loom artifacts against the release SHA.
