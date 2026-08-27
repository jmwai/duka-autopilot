# Duka Autopilot Design Specification

> Status: implementation contract
> Version: 1.0
> Last updated: August 26, 2026
> Core hackathon category: The Taskmaster
> GCP project: `agent-platform-503913` (`183775788663`)
> Application region: `europe-west1`
> Vertex AI and Agent Platform context location: `global`

This file is the source of truth for Duka Autopilot behavior. The detailed
delivery schedule, evidence plan, and submission choreography live in
`docs/hackathon-plan.md`. If implementation and this specification disagree,
the implementation must be corrected or this specification must be changed by
an explicit product decision.

## 1. Product contract

Duka Autopilot is the autonomous night shift for an independent Kenyan shop.
It accepts the messy inputs the shop already has—Swahili or code-switched voice
notes, text, handwritten ledger photographs, and synthetic M-Pesa-like
statement rows—and turns them into grounded orders, reconciled books, restock
proposals, a persisted nightly report, and a small morning exception queue.

The governing principle is:

> Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.

The normal, exact-evidence path must finish without owner intervention. Human
approval is reserved for ambiguity and consequential proposals; it is not a
substitute for autonomous execution.

## 2. Actors and authority

| Actor | Permitted authority |
|---|---|
| Customer | Submit an event, view their own message thread, ask about their own orders, and request a refund proposal |
| Shop owner | View business data, initiate deterministic jobs, decide approval proposals, seed the synthetic demo, and view evidence |
| Frontend BFF | Invoke the private API using its Cloud Run service identity and maintain the demo owner session |
| Pub/Sub | Invoke only the private worker push endpoint using its dedicated identity |
| Scheduler | Execute only the matching nightly Cloud Run Job using its dedicated identity |
| ADK agents | Call only their allowlisted tools; they do not acquire owner authority through prompts, history, or memory |
| GitHub deployer | Promote immutable images to the environment it owns; it cannot read business data or invoke models |

Memory, caller-supplied identifiers, model output, and conversation history are
never authorization sources.

## 3. Primary use cases

### UC-01 — asynchronous order intake

1. An inbound text, voice, or image event receives a durable event ID.
2. The API publishes it and returns HTTP 202 without running an agent inline.
3. Pub/Sub delivers it to the worker using authenticated push.
4. The worker claims the event idempotently, persists the inbound message, and
   runs the ADK workflow for the authenticated customer scope.
5. The workflow screens, classifies, resolves products against the catalog,
   and persists a grounded order or a bounded review proposal.
6. The worker persists one outbound response and completes the event receipt.

### UC-02 — ledger photograph

The vision path extracts individual rows. Deterministic code commits valid,
high-confidence positive-amount rows and places each doubtful row in the owner
queue. One doubtful row must not block valid rows on the same page.

### UC-03 — nightly autonomous loop

A Scheduler-triggered Cloud Run Job runs exact reconciliation, sends only
bounded residue to Gemini for proposals, scans stock, persists the report, and
creates the morning digest. Exact evidence may update bookkeeping. Fuzzy
matches remain proposals until an owner decision.

### UC-04 — durable refund exception

A refund request creates an approval and suspends the ADK invocation. The
approval stores its session, invocation, and interrupt handles. After a process
restart, scale-to-zero event, session rotation, or compatible revision, one
owner decision resumes that exact invocation once and persists one customer
reply. The system records an approved proposal; it does not send money.

### UC-05 — cross-session usual order

After a confirmed, trusted order, an allowlisted summary can enter Memory Bank.
In a later managed Session the customer may request “the usual.” Memory can
suggest products and quantities, but the workflow must call the current catalog
and must clarify missing or conflicting facts.

## 4. Functional requirements

### Event intake and delivery

- **FR-001** Every inbound event has a stable `event_id`; a Pub/Sub
  `messageId` is retained as delivery evidence but is not the sole business ID.
- **FR-002** Event processing is idempotent across API replay, Pub/Sub
  redelivery, process restart, and concurrent delivery.
- **FR-003** Event receipt state is durable: `received`, `processing`,
  `completed`, or `failed_retryable`/`failed_permanent`.
- **FR-004** A completed replay returns the stored outcome and creates no
  second order, message, approval, or cost row.
- **FR-005** Retryable worker failures return a non-2xx push response so
  Pub/Sub retries; permanent invalid input returns a stable terminal result.
- **FR-006** Exhausted Pub/Sub delivery reaches a dead-letter topic.

### Deterministic tool boundary

- **FR-010** `save_order` derives product name and integer KSh unit price from
  the current catalog. Model-supplied names and prices are ignored.
- **FR-011** Unknown customer, unknown SKU, empty items, non-integer or
  nonpositive quantity, invalid confidence, and malformed values are rejected
  before persistence.
- **FR-012** A low-confidence but otherwise valid order is persisted as
  `needs_review` and creates one approval.
- **FR-013** Caller customer scope is derived from trusted request/session
  context and cannot be changed by model tool arguments.
- **FR-014** Refund tools verify that the order belongs to the scoped customer
  before creating a proposal.
- **FR-015** Ledger tools reject nonpositive amounts from direct posting and
  gate uncertain rows without inventing customer or catalog facts.

### Reconciliation and money invariants

- **FR-020** M-Pesa-like references are deduplicated durably.
- **FR-021** Exact reconciliation is deterministic, indexed, repeatable, and
  idempotent.
- **FR-022** Gemini sees only capped residue batches and capped candidate
  orders, with a hard nightly batch limit and stop-on-no-progress behavior.
- **FR-023** A fuzzy proposal cannot mark an order paid or link a payment.
- **FR-024** Approval links the proposed payment and order atomically.
- **FR-025** Rejection returns the payment to unmatched residue and prevents a
  duplicate live proposal.

### Approvals and resumability

- **FR-030** Approval identifiers are backend-neutral opaque strings at API and
  domain boundaries; SQLite numeric values are serialized without changing
  their meaning.
- **FR-031** Approval decisions use a durable state machine:
  `pending -> resuming -> approved|rejected` or `resume_failed`.
- **FR-032** Duplicate identical decisions are idempotent; conflicting
  concurrent decisions have one winner and return a stable conflict.
- **FR-033** A transient resume failure remains retryable and is never reported
  as a successful decision.
- **FR-034** External-effect copy describes refund and restock actions as
  approved proposals or manual fulfillment, never as completed transfers.

### Sessions and memory

- **FR-040** Explicit local mode may use in-memory Sessions. Cloud readiness
  fails if managed Sessions are not configured; cloud mode never silently
  falls back to in-memory state.
- **FR-041** Cloud mode uses `VertexAiSessionService` and
  `VertexAiMemoryBankService` against the same environment-specific protected
  Agent Platform context resource.
- **FR-042** Firestore owns one transactional active-session pointer and
  generation per opaque customer ID; old sessions remain readable.
- **FR-043** Per-customer turns are serialized using a durable lease or verified
  ordering strategy.
- **FR-044** The stable `APP_NAME`, user-key algorithm, context resource ID,
  pinned ADK version, and workflow node identities are deployment compatibility
  contracts.
- **FR-045** Memory ingestion uses a durable outbox of allowlisted deterministic
  summaries. Raw whole sessions are never ingested after each turn.
- **FR-046** Initial memories contain only confirmed usual products,
  quantities, and preferred language. Prices, phones, payment references,
  refunds, complaints, security flags, and authority claims are forbidden.
- **FR-047** Memory is advisory and untrusted. Current catalog and deterministic
  stores always override it.
- **FR-048** A Memory Bank outage cannot convert a successful business action
  into a failed customer response; the memory write becomes retryable/degraded.
- **FR-049** Blocked content never enters Memory Bank or a later LLM request
  through durable history.

### API, security, and operations

- **FR-050** Owner mutations require an authenticated owner session. Worker and
  Job endpoints require dedicated Google service identities.
- **FR-051** Customer-scoped reads cannot retrieve another customer’s thread or
  order data.
- **FR-052** MIME type, decoded size, JSON size, field length, identifier shape,
  CORS origin, and rate limits are explicit.
- **FR-053** Production startup initializes schema/connectivity only. Synthetic
  seeding is an explicit idempotent command or one-shot Job.
- **FR-054** `/health` reports process liveness; `/ready` verifies required
  configuration and dependencies; `/version` exposes release SHA and model
  metadata without secrets.
- **FR-055** Structured logs correlate release, revision, event, customer hash,
  session, invocation, approval, and node without raw phones, media, secrets,
  or sensitive prompt bodies.

## 5. State ownership

| State | Authority | Retention and use |
|---|---|---|
| Catalog, customers, orders, payments, approvals, messages, reports | Firestore | Business truth; deterministic invariants apply |
| Event receipts, active-session pointers, leases, memory outbox | Firestore | Control truth; transactional and idempotent |
| ADK events, workflow state, suspend/resume handles | Agent Platform Sessions | Active conversation and resumability; 90-day demo TTL |
| Confirmed preferences | Memory Bank | Advisory cross-session context with explicit retention |
| Code and release topology | Git SHA plus immutable image digest | Reproduction, compatibility, and rollback |

## 6. Runtime and delivery contract

- Public `duka-ENV-web`: frontend and authenticated BFF.
- Private `duka-ENV-api`: application API and owner operations.
- Private `duka-ENV-worker`: Pub/Sub push consumer, concurrency one initially.
- `duka-ENV-nightly`: Cloud Run Job with one task and parallelism one.
- `duka-ENV-seed`: unscheduled, manually invoked, idempotent one-shot Cloud
  Run Job for an initially empty synthetic environment; it never force-resets
  an existing database.
- Firestore, Pub/Sub, Scheduler, Artifact Registry, and Cloud Run use
  `europe-west1`; Vertex AI and the Agent Platform context use `global`.
- GitHub Actions authenticates with Workload Identity Federation. No JSON
  service-account key exists.
- Development may deploy automatically from `dev` after required gates.
- Production promotion is manual, protected, and promotes tested image digests
  without rebuilding.
- No push occurs until the pre-push audit passes and Actions/WIF are ready.
- No cloud deployment occurs without explicit human approval.

## 7. Model and data contract

- Preserve repository model `gemini-3.7-flash` unless the owner explicitly
  requests a change.
- Treat 404 as a location/configuration problem before considering a model
  change.
- Money is integer KSh throughout domain state.
- All demo, benchmark, payment, customer, voice, and ledger fixtures are
  synthetic. Release voice and ledger media is generated only with approved
  Google Cloud surfaces. No real financial data.

## 8. Required acceptance evidence

Release requires all scenarios A01–A30 in `docs/hackathon-plan.md`, including:

- deterministic and Firestore parity tests;
- ADK tool-trajectory and safety evaluations;
- duplicate-event and duplicate-decision proofs;
- restart/revision refund resume proof;
- multilingual, isolated, stale-catalog-safe memory proof;
- real voice and ledger-image proof;
- Scheduler-triggered nightly Job proof;
- IAM denial tests and rollback under five minutes;
- measured 50,000-row economics tied to release SHA.

Unit tests are not a substitute for ADK evaluations, and local tests are not a
substitute for cloud evidence.

## 9. Demo and claims contract

The final Loom recording is 3:45–3:55 and has a matching reviewed
`docs/demo-transcript.md` and reproducible `docs/demo-guide.md`. It shows a real
continuous action segment and visible Google Cloud evidence.

The product does not claim to send M-Pesa refunds, place supplier orders, run a
real WhatsApp integration, screen audio/image semantics with the text-only rule
engine, or achieve any cost/latency figure without a measured release artifact.

## 10. Definition of done

Duka Autopilot is complete only when the implementation satisfies this spec,
all P0 tasks and A01–A30 gates have authoritative evidence, the exact production
release is stable and reproducible, judge access works from a clean browser,
the Loom package and disclosures match the deployed system, and Devpost is
submitted with a saved receipt.
