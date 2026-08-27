# Duka Autopilot Demo Fixture Manifest

> Status: legacy media quarantined; Google bilingual release fixtures pending API activation
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
| Voice transcript | `Habari, niletee vitu vyangu vya kawaida kesho asubuhi.` | “Hello, please bring me my usual items tomorrow morning.” |
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
| English voice | Google Cloud Gemini-TTS `.wav`; SHA-256 and duration | “Hello, please bring me my usual order tomorrow morning.”; expected usual items and current KSh 1,035 total | Pending API activation |
| Kiswahili voice | Google Cloud Gemini-TTS `.wav`; SHA-256 and duration | `Habari, niletee vitu vyangu vya kawaida kesho asubuhi.`; expected usual items and current KSh 1,035 total | Pending API activation |
| English handwritten ledger | `fixtures/demo/ledger-en-v2.png`; Vertex AI synthetic PNG | Two readable rows and one unreadable amount that must gate | Pending API activation |
| Kiswahili handwritten ledger | `fixtures/demo/ledger-sw-v2.png`; Vertex AI synthetic PNG | Equivalent two-record/one-gate truth | Pending API activation |

Both audio fixtures must be generated with Google Cloud Gemini-TTS and labelled
as synthetic in the demo and manifest. Both ledger fixtures must be generated
with the approved Google Vertex AI image model and contain no real name, phone,
account, or payment reference.

The earlier ledger and offline voice candidates do not satisfy the Google-only
release policy and are quarantined. They must not appear in the hosted app,
Loom, or submission evidence. Schema v2 of `fixtures/demo/manifest.json` will
freeze the bilingual Google assets, their prompt/transcript provenance, hashes,
dimensions or duration, and expected tool outcomes. Integrity checks do not
substitute for running the actual Gemini multimodal path on the final release.

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
