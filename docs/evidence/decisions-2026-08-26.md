# Decisions Evidence — August 26, 2026

> Scope: local Phase F2 candidate after private commit `903f06c`
> Cloud claim: none
> External-effect claim: none

## Implemented contract

The owner queue now explains safe agency before offering an action. Each
pending or retryable item shows its kind and risk, what Duka observed, why
automation stopped, evidence/confidence, affected identifiers, and the exact
internal approve and reject effects.

The reviewed presentation contracts are:

| Kind | Approve effect shown to owner | Fail-closed boundary |
|---|---|---|
| Refund | Resume the suspended ADK workflow and record an owner-approved proposal for manual completion | No M-Pesa transfer is initiated |
| Fuzzy match | Link the payment to the proposed order in Duka’s books and mark that order paid | Similar evidence cannot settle autonomously; no transfer is initiated or reversed |
| Low-confidence order | Move the existing draft to pending customer confirmation | No duplicate order and no paid status |
| Ledger row | Record one internal sale only when the stored amount is a positive integer | Unreadable/nonpositive amount disables approval; no value is guessed |
| Security flag | Record owner acknowledgement of the review | Blocked text is not replayed or treated as authority |
| Restock proposal | Record owner acceptance of the draft | No supplier order, payment, or inventory adjustment |
| Unknown future kind | Approval disabled | Interface refuses to explain an unreviewed effect |

Money-adjacent and consequential actions open a native modal confirmation with
the precise effect and a shared “exactly once” boundary. The queue renders
completed idempotent replay, already-in-progress, 409 conflict, and retryable
503 language as distinct states rather than generic success or failure.

The owner API now returns a deliberate approval projection. Business evidence
is present, but `session_id`, `interrupt_id`, and `invocation_id` never cross
the private API/browser boundary.

## Automated evidence

```text
pnpm lint
  passed with zero warnings

pnpm typecheck
  passed in strict no-emit mode

pnpm test
  16 passed across 4 files
  - 4 Decisions presentation tests
  - 4 Ledger fixture/receipt tests
  - 5 Inbox boundary/receipt tests
  - 3 BFF policy tests

pnpm prebuild && pnpm exec next build --webpack
  passed; /approvals compiled as a dynamic server route

.venv/bin/pytest -q
  103 passed, 13 cloud-emulator tests skipped
```

The Decisions tests prove truthful fuzzy/refund/restock wording, unreadable
ledger and unknown-kind fail-closed behavior, and stable filter kinds. Backend
tests prove retryable refund resume, same-decision idempotency, conflicting
decision rejection, exactly one resumed outbound reply, transactional
non-refund effects, opaque approval IDs, and browser omission of durable resume
handles. These are local unit/integration tests, not managed-session cloud
evidence.

## Standalone container evidence

| Contract | Verified value |
|---|---|
| Local image | `sha256:7e2609b2374b506afdefbcdca512f5967a0d6f0a7fa97a721209f5546ea93b29` |
| Image size reported by Docker | `95,316,625` bytes |
| Runtime identity | `10001:10001` |
| Runtime command | `node server.js` |
| `/health` | `200`, web role healthy |
| `/ready` | `200`, synthetic private API dependency healthy |
| `/approvals` | `200`, dynamic production-rendered queue |
| `/api/approvals` | six synthetic kinds, no durable resume handles |

The production image was connected only to an isolated local SQLite database
containing six synthetic proposals. No action was submitted. The container,
API process, and temporary database were removed after verification.

## Visual and interaction evidence

The queue was inspected at 1280×720 and 390×844:

- desktop uses a filterable evidence table with stacked action controls and no
  clipped labels;
- desktop filters wrap so every kind remains visible without hidden scrolling;
- mobile switches to stacked decision cards and a deliberately discoverable
  horizontal filter rail without page-wide overflow;
- the consequential-action modal remains fully readable and operable on
  mobile, with approve and cancel actions above the fixed navigation;
- the unreadable ledger approval is visibly disabled while rejection remains
  available;
- EAT timestamp formatting is explicitly pinned to `Africa/Nairobi`, removing
  server/client timezone hydration drift;
- the final fresh browser reported zero errors or warnings.

Actual Cloud Run IAM, Firestore transaction behavior, managed-session refund
resume across revisions, concurrent duplicate clicks, and a real fuzzy-match
decision remain development-cloud acceptance evidence to collect later.
