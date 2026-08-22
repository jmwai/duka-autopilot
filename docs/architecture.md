# Architecture

![Duka Autopilot architecture](architecture.svg)

## The three seams

The system is organized around three swap-by-config seams, so the exact same
domain logic runs on a laptop with zero credentials and on Google Cloud:

| seam | local | cloud | switch |
|---|---|---|---|
| **Store** (`agents/store/`) | SQLite | Firestore | `DUKA_STORE` |
| **Bus** (`app/bus.py`) | in-process asyncio | Pub/Sub (push → `/pubsub/push`) | `DUKA_BUS` |
| **Memory** (`app/runner.py`) | keyword recall | Agent Engine Memory Bank | `MEMORY_BANK_ENGINE_ID` |

Nothing above a seam knows which side is plugged in. That is why the whole
test suite is keyless and deterministic, and why "deploy" is configuration,
not a rewrite.

## The graph

One ADK workflow serves every modality. Rose nodes are plain code
(`FunctionNode`s), green nodes are LLM agents, amber is the human gate:

- **screen** (code) — injection phrasing, money-path social engineering and
  smuggled payloads are stopped before any LLM sees the message; flagged
  traffic files a `security_flag` for the owner and never routes.
- **classifier** (LLM) proposes a route; **router** (code) sanitizes and
  emits it. The LLM cannot route anywhere the code doesn't allow.
- **order intake / support / ledger** (LLM) can only act through tools, and
  the tools hold the gates: `save_order` files low-confidence orders for
  review, `request_refund` can only open a request, `record_ledger_rows`
  gates per row.
- **exact_recon** (code) settles ~97% of a statement month in about a
  second; **fuzzy_recon** (LLM) sees only the residue and can only file
  proposals.
- **refund_gate** (code) SUSPENDS the invocation graph-natively; the owner's
  decision resumes the same conversation.

## The night shift

Cloud Scheduler fires `/recon/nightly` at 02:00: exact pass, then fuzzy
batches through the same graph until the residue stops shrinking, then a
restock shelf scan, then a persisted report. At 06:30 `/digest/morning`
assembles the owner's brief — deterministically, because nobody wants an
LLM between the books and the money numbers.

## Where the money can move

Exactly one place: `POST /approvals/{id}` with an owner decision. Refunds,
low-confidence orders, fuzzy matches, doubtful ledger rows, restock drafts
and security flags all converge there. No other code path changes an order
to `paid` off an LLM's say-so.
