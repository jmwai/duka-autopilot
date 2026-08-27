# Night-shift Evidence — August 26, 2026

> Scope: local Phase F2 candidate after private commit `903f06c`
> Cloud claim: none
> Real-model claim: none in this verification run

## Persisted report contract

Nightly reports now persist enough provenance to be evaluated rather than
merely displayed:

- schema version and unique run ID;
- explicit completed status, UTC start, and UTC finish;
- execution surface (`cloud_run_job`, `api`, or local/library test surface);
- release SHA, configured model, and model location;
- fuzzy enabled/disabled flag and total rows considered;
- exact matches, exact wall time, settle rate, residue before/after, fuzzy
  batches, and fuzzy proposals;
- per-run model call, input-token, output-token, and cost deltas;
- restock scan outcome, total wall time, and final statement summary.

The Cloud Run Job entrypoint stamps `execution_surface=cloud_run_job`; the
owner API stamps `api`. The frontend compares a report SHA to the current
backend release and labels it current, stale, or unattributed. An optional
backend image digest is displayed only when supplied by the immutable cloud
release manifest; otherwise it says `pending cloud manifest`.

## Product evidence boundary

The Night-shift view separates three things that must not be conflated:

1. **Observed persisted run** — live report values from the private API;
2. **Current aggregate statement** — shown only when no run exists and never
   inferred into a completed report;
3. **Historical local synthetic baseline** — the committed 50,000-row
   SQLite/macOS run, prominently labelled `LOCAL-PROVEN · dirty worktree`, not
   Cloud Run, not Firestore, not the current release, and with model cost not
   measured because fuzzy review was disabled.

The historical baseline remains exactly: 50,000 generated, 49,750 unique
inserted, 250 duplicate references dropped, 49,756 total with six demo rows,
48,402 exact, 1,354 residue, 97.28% exact, 800 ms exact pass, and 812 ms total.

The three authority lanes state that exact rows never reach a model, Gemini can
only propose on residue, and consequential proposals remain in Decisions. Hard
bounds are visible: 25 rows per residue batch, 40 batches maximum, 1,000 rows
presented maximum, and stop on empty/no-progress.

## Guarded operator control

The page does not pretend that an API button proves Cloud Scheduler. In local
mode, the only enabled action is `Run local exact check`; its native
confirmation says it runs the deterministic pass with fuzzy review disabled,
may mutate internal exact links and draft a restock proposal, is not comparable
after prior settlement, and is not Gemini, Cloud Run Job, or Scheduler proof.

In development/production the page disables that convenience path and directs
the operator to the real Cloud Run Job through Scheduler or the reviewed proof
workflow. The Loom contract still requires a visible Scheduler/Job execution.

## Automated evidence

```text
pnpm lint
  passed with zero warnings

pnpm typecheck
  passed in strict no-emit mode

pnpm test
  20 passed across 5 files
  - 4 Night-shift evidence tests
  - 4 Decisions presentation tests
  - 4 Ledger fixture/receipt tests
  - 5 Inbox boundary/receipt tests
  - 3 BFF policy tests

pnpm prebuild && pnpm exec next build --webpack
  passed; /night-shift compiled as a dynamic server route

.venv/bin/pytest -q
  103 passed, 13 cloud-emulator tests skipped
```

The Night-shift tests prove frozen-baseline arithmetic, batch/ceiling
arithmetic, release attribution, and rejection of a report whose residue grows
during one run. Backend tests prove deterministic-only persistence, zero model
usage in that mode, fuzzy stop-on-no-progress, and restock integration. These
are local tests, not Cloud Scheduler or Gemini evidence.

## Standalone container evidence

| Contract | Verified value |
|---|---|
| Local image | `sha256:422b6e8db5ac6cfb74eb6d83b58fc3556f75b98e5b2997fd90a28f882c68b2a0` |
| Image size reported by Docker | `95,317,324` bytes |
| Runtime identity | `10001:10001` |
| Runtime command | `node server.js` |
| `/health` | `200`, web role healthy |
| `/ready` | `200`, synthetic private API dependency healthy |
| `/night-shift` | `200`, dynamic production-rendered report |
| Persisted QA report | 6 considered, 2 exact, 4 residue, 0 model calls, `$0.0000` |

The production image was connected to an isolated seeded SQLite database. A
keyless deterministic report was prepared before startup with
`execution_surface=local_qa`; the UI action was not submitted. The container,
API process, and temporary database were removed after verification.

## Visual and interaction evidence

The production container was inspected at 1280×720 and 390×844:

- observed cards show exact, residue, proposals, measured model cost, and
  per-run token counts without borrowing numbers from the baseline;
- the settlement bar has an accessible progressbar label and numeric value;
- receipt, hard bounds, three authority lanes, and historical baseline remain
  readable at desktop density;
- the local run confirmation is explicit and focus-managed;
- mobile stacks the status banner and outcome cards without horizontal
  overflow, while keeping the primary action and fixed navigation usable;
- Nairobi time is deterministic on server and client;
- the browser reported zero errors or warnings.

Real Scheduler trigger status, Cloud Run Job duration/digest, Firestore counts,
Gemini fuzzy batches/tokens/cost, trace correlation, and the final 50,000-row
cloud artifact remain development-cloud acceptance evidence to collect later.
