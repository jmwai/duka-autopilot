# Judge-profile local evidence — 2026-08-27

This record proves the deterministic local judging profile and the refined
standalone Next.js presentation. It is not Google Cloud execution evidence and
it is not generated-media evidence.

## Candidate identity

- Base commit: `494291a`.
- Candidate state: reviewed local worktree after that commit; bind this record
  to the eventual candidate SHA before release promotion.
- Store/runtime: SQLite on local macOS.
- Model calls during seed: zero.
- Generated image/audio calls during seed: zero.

## 50,000-row result

The production seed profile was executed with `rows=50000`, synthetic seed
`2026`, and `execution_surface=local_scale_verification`.

| Measure | Observed |
|---|---:|
| Rows generated | 50,000 |
| Unique rows inserted | 49,750 |
| Duplicate references dropped | 250 |
| Exact matches | 48,402 |
| Deterministic settlement rate | 97.28% |
| Residue | 1,354 |
| Gemini calls | 0 |
| Gemini cost | $0.00 |
| Nightly wall time | 501 ms |
| Owner queue | 1 ledger row, 1 low-confidence order, 1 restock proposal |

The runtime result agrees with the generator’s known ground truth. The
exact-only seed run intentionally makes no Gemini claim; a later approved
cloud evaluation measures the bounded fuzzy path separately.

## Product state

The judge profile creates through real domain seams:

- one completed exact-only night report;
- two recorded ledger rows and one unreadable gated row;
- one catalog-grounded English order;
- one catalog-grounded Kiswahili order;
- one low-confidence catalog-grounded order awaiting owner authority;
- one restock proposal and exactly three total owner decisions;
- current paid sales and a deterministic Morning Digest;
- English and Kiswahili synthetic text history.

The operation is idempotent. A second run without `force` leaves order,
payment, message, and approval counts unchanged.

Seeded Inbox receipts say `Synthetic deterministic seed` and explicitly state
that they are not live model invocations. The live multimodal Loom path will use
separate Google-generated, hash-verified media after approval.

## Frontend gates

| Gate | Result |
|---|---:|
| Vitest contract tests | 36 passed |
| Existing production-browser journeys | 23 passed |
| Isolated judge-profile browser journey | 1 passed |
| Judge-profile axe scan | 0 reported violations |
| Python suite | 121 passed, 16 infrastructure-gated skips |
| Heaviest route JavaScript | 128,839 bytes gzip / 153,600-byte budget |
| Total production static assets | 1,683,901 bytes |

The isolated browser journey proves the 3,874/3,986 local rehearsal state,
97.2% deterministic rate, three owner decisions, 1440 px and 390 px layouts,
no horizontal overflow, and English/Kiswahili history. The release Cloud seed
uses the same profile at 50,000 rows.

## Google-only and bilingual boundary

- The release media manifest remains deliberately `release_ready=false`.
- No release ledger image or voice file is present or clickable.
- Generated ledger providers are allowlisted to Google Vertex AI.
- Generated voice providers are allowlisted to Google Cloud Text-to-Speech.
- Release readiness requires exactly `en-KE` and `sw-KE` variants for both
  ledger and voice.
- The locked Python graph contains no non-Google model-provider SDK introduced
  by the ADK evaluation tooling.
- The release verifier fails closed while the four approved media assets are
  absent. That failure is expected until the explicit Google-media gate runs.

## Commands

```bash
uv run --frozen pytest -q

cd frontend
pnpm check
pnpm exec playwright test
pnpm test:e2e:judge
```

The 50,000-row command uses `agents.demo_state.prepare_judge_state` against a
disposable SQLite path. Cloud Run, Firestore, Scheduler, managed Sessions,
Memory Bank, hosted Core Web Vitals, and release economics remain pending.
