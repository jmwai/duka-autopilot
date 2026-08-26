# Measured reconciliation economics

> Status: local deterministic baseline; model-backed cloud cost pending
> Measured: 2026-08-26T12:48:20.031686+00:00
> Git SHA: `605669888468114d37606f2ee5a067920ca14823` (dirty worktree)
> Backend: `sqlite` on Python 3.14.2
> Raw evidence: `docs/evidence/benchmark-local.json`

One synthetic month, generated with engineered noise (`agents/synth`),
reconciled by `agents/nightly.run_nightly` on `gemini-3.7-flash`.
This run is a reproducible engineering baseline, not yet a Cloud Run or
Firestore performance claim. The release headline will be replaced only by a
matching immutable cloud Job artifact.

| metric | value |
|---|---|
| requested synthetic statement rows | 50,000 |
| unique synthetic rows inserted | 49,750 |
| duplicate references dropped | 250 |
| total rows considered, including 6 demo-seed rows | 49,756 |
| settled deterministically | 48,402 (97.28%) |
| exact pass wall time | 800 ms |
| residue sent to the LLM | 1,354 |
| fuzzy batches run | 0 |
| fuzzy proposals (to approval queue) | 0 |
| still unmatched | 1,354 |
| measured LLM cost | not measured (fuzzy pass disabled) |
| total wall time | 0.8 s |

When enabled, the LLM may only create proposals; it never marks an uncertain
payment paid. Every fuzzy proposal waits in the owner's approval queue.
