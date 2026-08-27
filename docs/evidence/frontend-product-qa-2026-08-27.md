# Frontend product QA — 2026-08-27

This record captures local release-candidate evidence for the standalone Next.js
control room. It is not evidence of a Google Cloud deployment and does not
claim that the pending Google-generated bilingual media exists.

## Verified surface

- Production webpack build of Next.js 16.3.3.
- Google Chrome driven by Playwright 1.62.1.
- axe-core 4.13.0 checks tagged for WCAG 2 A/AA, WCAG 2.1 AA, and WCAG 2.2 AA.
- Eight owner routes: Morning Brief, Decisions, Inbox, Ledger Desk, Night Shift,
  Orders, Stock, and How Duka Worked.
- Release widths 390, 768, 1280, and 1440 pixels with reduced motion enabled.
- A 640-pixel no-horizontal-overflow check as the layout proxy for 200% zoom.
- Keyboard-visible focus, command-menu navigation, and mobile navigation Sheet.
- Orders, Stock, and Evidence checks for their explicit authority and external-
  effect boundaries.
- A provenance-aware print composition on every owner route.
- Causal navigation from a completed Inbox execution receipt to the exact
  authenticated persisted order.
- An enforced per-route JavaScript budget from production client-reference
  manifests.
- A pinned-Chromium local production-build lab check for TTFB, LCP, CLS, and
  observed interaction duration, attached as JSON to the browser report.
- A separate deterministic judging profile with meaningful exact settlement,
  three safe owner decisions, and English/Kiswahili history.
- Paired non-root frontend/backend release images with healthy probes, matching
  release identity, authenticated BFF login/read, and forbidden-route denial.

## Results

| Gate | Result |
|---|---:|
| Vitest component/contract tests | 46 passed |
| Playwright production journeys | 29 passed |
| Playwright judge-profile journey | 1 passed |
| Route-level axe scans | 8 passed, 0 reported violations |
| Judge-profile axe scan | 1 passed, 0 reported violations |
| Python suite, local keyless mode | 134 passed, 16 emulator-gated skips |
| Python suite, Firestore emulator | 150 passed, 0 failed, 0 errors, 0 skipped |
| Heaviest route JavaScript | 129,532 bytes gzip / 153,600-byte budget |
| Total production static assets | 1,701,081 bytes |
| Local production-build lab budgets | TTFB < 800 ms; LCP < 2.5 s; CLS < 0.1; observed interaction ≤ 200 ms |

The paired production images were also measured at every release width. All
four runs had zero horizontal overflow and stayed within every local lab
budget:

| Width | TTFB | LCP | CLS | Max observed event | Menu action |
|---:|---:|---:|---:|---:|---:|
| 390 px | 133.7 ms | 848 ms | 0 | 32 ms | 65.27 ms |
| 768 px | 27.2 ms | 100 ms | 0 | 40 ms | 42.55 ms |
| 1280 px | 63.7 ms | 124 ms | 0 | 56 ms | 85.70 ms |
| 1440 px | 20.1 ms | 68 ms | 0 | 48 ms | 69.93 ms |

The machine-readable record is
`docs/evidence/frontend-lab-performance-2026-08-27.json`. These are loopback
lab measurements against local production containers, not hosted field data.

The ordinary keyless run skips the Firestore parity cases. A separate full run
used the installed Google Cloud Firestore emulator with Java 21 and produced a
JUnit summary of 144 tests, zero failures, zero errors, and zero skips. This is
local emulator evidence, not managed Firestore execution evidence.

## Commands

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm check
pnpm check:bundle
pnpm test:e2e
pnpm test:e2e:judge

cd ..
.venv/bin/python -m pytest -q

FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
FIRESTORE_DATABASE='(default)' \
GOOGLE_CLOUD_PROJECT=demo-duka \
uv run --frozen pytest -q -rs --junitxml=/tmp/duka-pytest-firestore.xml
uv run --frozen python scripts/assert_junit.py \
  /tmp/duka-pytest-firestore.xml --max-skipped 0
```

`pnpm test:e2e` first builds the production application, then starts a
deterministic local FastAPI/SQLite fixture backend and the production Next.js
server. It does not mutate Google Cloud.

The mutation journeys additionally prove a catalog-key-only manual-sale
request with an authoritative backend-rendered total; exactly-once sale replay
after a simulated lost response; one duplicate-safe restock draft and visible
retry recovery; owner rejection plus idempotent replay; a locally attributed
night-run receipt with an explicit failure state; preservation of one inbound
event ID across a simulated handoff failure and retry; exactly-once managed-
session rotation after a simulated lost response; safe navigation from an
allowlisted order receipt to the authenticated order Sheet; clean print output
on all owner routes; and redirect to login when the owner session expires.

The isolated judge-profile journey runs the same deterministic preparation
contract intended for the one-shot Cloud Run seed Job. At 4,000 generated rows
it renders 3,874 exact matches out of 3,986 unique statement rows (97.2%),
three owner decisions, current sales, and bilingual English/Kiswahili history.
Seeded receipts are explicitly labeled as rehearsal data rather than live model
execution. The separate 50,000-row local run produced 48,402 exact matches,
1,354 residue rows, a 97.28% deterministic rate, zero Gemini calls, and zero
Gemini cost in 501 ms. See `judge-profile-local-2026-08-27.md`.

The judge-facing Evidence route is now organized into five ordered chapters
and carries the same fail-closed release strip used by the Morning Brief:
release identity, how Duka acts, one causal trace, measured quality, and honest
boundaries. Configured services do not make the trace green; only an attached,
release-bound Cloud Trace artifact does.

## Captured screenshots

| Width | Artifact | SHA-256 |
|---:|---|---|
| 390 | `frontend/morning-brief-390-local-production.png` | `7884bd8df5956540d7abb256b3b0d9be6da4557d5e308a57efc841a1a084dad4` |
| 768 | `frontend/morning-brief-768-local-production.png` | `e74c90fdac5b753c92a985e2c6248def217b95182056860a02c5190cf771e71a` |
| 1280 | `frontend/morning-brief-1280-local-production.png` | `7995c684cedf6f97496bb06d28de0840d83bf7d3c9ebbe474e2fae4f9126a140` |
| 1440 | `frontend/morning-brief-1440-local-production.png` | `05dbd6e61f6a3e35f212ea00b66438a80cb7f52ac4ac5334bf6530098ad80633` |

These screenshots are product captures, not AI-generated media. Their hashes
are bound to the Git commit that contains this evidence record; they are not
cloud-deployment evidence.

## Truth boundary

- The browser environment is local and says so in the interface.
- Google-generated English and Kiswahili voice/ledger fixtures remain pending.
- Missing evidence is rendered as pending or not proven; it does not degrade to
  a green badge.
- No external M-Pesa transfer, refund, supplier order, or payment is initiated.
- Cloud Run, managed Sessions, Memory Bank, Scheduler, Pub/Sub, and cloud trace
  proof remain pending until an approved deployment is exercised and captured.
- Hosted Core Web Vitals remain cloud-release work; the current production-image
  result is a local lab gate, not hosted field-user evidence.
- Paired-container details and the explicit Cloud Run IAM limitation are in
  `local-container-smoke-2026-08-27.md`.
