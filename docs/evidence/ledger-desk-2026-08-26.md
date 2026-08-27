# Ledger Desk Evidence — August 26, 2026

> Scope: local Phase F2 candidate after private commit `903f06c`
> Cloud claim: none
> Real-model claim: none in this verification run
> Superseded: the media candidate documented here was quarantined and removed
> from the active release on August 27; this file is historical evidence only.

## Implemented contract

The owner-facing Ledger desk now makes the multimodal trust boundary visible
and machine-verifiable:

- JPEG, PNG, and WebP photographs are rejected before encoding when empty,
  unsupported, or larger than the backend's decoded 6,000,000-byte ceiling;
- every selected page receives a stable event ID that is reused for retries;
- the owner-only `/ledger` route hashes the decoded image and MIME type before
  claiming the event;
- replaying the same event and image returns the completed receipt without a
  second agent run, while reusing the event ID for another image returns 409;
- Gemini may propose rows, but `record_ledger_rows` normalizes and validates
  every row independently before any internal bookkeeping action;
- malformed customer IDs, missing descriptions, nonpositive/noninteger
  amounts, invalid confidence, and invalid paid markers are gated rather than
  allowed to crash or enter the books;
- the tool returns structured per-row `recorded` or `gated` outcomes, order or
  approval identity, confidence, and reason;
- the runner captures only that named tool receipt. The frontend refuses to
  infer row outcomes from model prose;
- unreadable or invalid amounts render as `Amount unreadable`/an em dash, never
  zero or an invented value;
- token counts, node path, measured turn cost, wall time, and event identity
  remain attached to the observed receipt.

The frozen synthetic page is shown beside a panel explicitly labelled
“Expected outcome—not a model result.” The expected two-record/one-gate truth
is therefore a test oracle, not a claim that Gemini produced it during this
local verification.

## Frozen fixture integrity

| Contract | Verified value |
|---|---|
| Source | `fixtures/demo/ledger-page-v1.png` |
| MIME | `image/png` |
| Dimensions | 1024×1536 |
| Bytes | 3,014,160 |
| SHA-256 | `9b85c98d1d35e5b9c8a5e98d03dea9168ff014ce157c51bfa09da99de62f59a0` |
| Ground truth | 2 recorded, 1 gated with unreadable amount |
| Data class | synthetic only |

The frontend prebuild reads the frozen manifest, verifies the source hash,
byte count, and synthetic flag, then copies the image into generated public
assets. The standalone Docker builder receives only the required fixture and
manifest. The generated public copy remains ignored in Git.

The running production container served the exact SHA-256 above. The browser
then repeated the hash and byte check before enabling the fixture as a selected
upload.

## Automated evidence

```text
pnpm lint
  passed with zero warnings

pnpm typecheck
  passed in strict no-emit mode

pnpm test
  12 passed across 3 files
  - 4 Ledger fixture/receipt tests
  - 5 Inbox boundary/receipt tests
  - 3 BFF policy tests

pnpm prebuild && pnpm exec next build --webpack
  passed; /ledger compiled as a static application route

.venv/bin/pytest -q
  102 passed, 13 cloud-emulator tests skipped
```

The Ledger frontend tests validate media policy, the structured
two-record/one-gate receipt, count consistency, and rejection of a nonpositive
gated amount. Python tests validate per-row normalization and gating, owner
authority, structured tool capture, same-image idempotent replay, and
different-image event conflict. These are unit/integration tests, not ADK
evaluations and not real Gemini vision evidence.

## Standalone container evidence

| Contract | Verified value |
|---|---|
| Local image | `sha256:b75d2162a963f17a425bdd297a45974614835812a6b6c9069a0d481e98b6948f` |
| Image size reported by Docker | `95,233,004` bytes |
| Runtime identity | `10001:10001` |
| Runtime command | `node server.js` |
| `/health` | `200`, web role healthy |
| `/ledger` | `200`, production-rendered Ledger desk |
| Frozen fixture route | exact frozen SHA-256 |

The temporary local container was stopped and auto-removed after verification.

## Visual and interaction evidence

The production container was inspected at the default desktop viewport and at
390×844:

- desktop keeps the upload/preview and expected-or-observed receipt in a clear
  two-column evidence desk;
- mobile stacks all trust lanes, controls, preview, and truth rows without
  page-wide horizontal overflow;
- the sticky header retains a measured 24-pixel gap before the page eyebrow;
- the frozen button verifies and loads the real packaged image, shows a
  build-verified badge, and enables the explicit run action;
- the expected rows show KSh 390, KSh 320, and no amount for the gated sugar
  row;
- the browser reported no errors or warnings.

The run action was deliberately not clicked because no Gemini call was
authorized for this phase and the local API dependency was not part of this
container-only visual check. Actual model extraction of this exact fixture,
observed two-record/one-gate parity, Cloud Run correlation, and approval flow
remain development-cloud acceptance evidence to collect later.
