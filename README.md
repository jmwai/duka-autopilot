# Duka Autopilot

Duka means *Shop* in Swahili.

Across Africa, neighbourhood dukas are the heartbeat of daily commerce. But running one is an exhausting, multimodal balancing act:
- **Customers order the way they speak** — sending quick WhatsApp texts, leaving Swahili or Sheng voice notes (*"Niletee ile ya kawaida kesho asubuhi"*), or walking up to the counter.
- **Sales are recorded on paper** — scribbled in black ballpoint across ruled exercise-book pages.
- **Payments arrive digitally** — a steady stream of mobile money (M-Pesa) transactions with disparate customer names, SMS alerts, and reference codes.

After a 14-hour day on their feet, shop owners face a second shift of manual paperwork: transcribing voice notes, deciphering scribbled ledger lines, reconciling dozens of mobile money receipts, and calculating what stock to reorder.

**Duka Autopilot is the autonomous taskmaster and night shift built for this reality.**

It meets shop owners where they already work:
1. **By day (Autonomous Taskmaster)**: Inbound voice notes, text messages, and photographed ledger pages are processed asynchronously into catalog-grounded orders and audited records without slowing down the counter.
2. **By night (The Night Shift)**: A deterministic pipeline reconciles mobile money statements against orders and ledgers in seconds, scans inventory for proactive restock needs, and persists audited reports.
3. **By morning (Compressed Exceptions)**: Instead of hours of ledger math, the owner wakes to an executive morning digest, balanced books, and a tiny approval queue containing only genuine ambiguities that warrant human judgment.

Built for the [All Things Agentic Hackathon](https://allthingsagentichackathon.devpost.com/)
(Taskmaster track: event-driven workflow with autonomous routing).

## The thesis

1. **LLM suggests, code decides.** The classifier proposes a route; a
   `FunctionNode` sanitizes and emits it. Fuzzy matches are proposals; code
   and humans decide.
2. **Deterministic first.** Reconciliation is an indexed, bulk, plain-code
   pass. The LLM only ever sees the bounded residue engineering could not
   settle. Cost claims are published only after a measured cloud run.
3. **Humans gate uncertainty — and resolve it.** Refund proposals,
   low-confidence orders, gated ledger rows, and fuzzy matches stop in the
   approval queue. Where the model refuses to guess, the owner can supply the
   single missing fact — a smudged ledger amount, bounded and recorded as
   owner-entered, never confused with what the model read. Exact evidence may
   update the books; Duka never initiates an external transfer.
4. **Tool invariants survive every modality.** Text, voice, and photo intake
   share catalog validation, authority scoping, confidence gates, idempotency,
   and durable history filtering. The deterministic text screen does not claim
   to understand audio or image semantics.

## See it running

**<https://duka-prod-web-efjhavvylq-ew.a.run.app>** — the deployed control
room, open with no login so you can act as the shop owner immediately. The
data is synthetic; nothing there moves real money.

Worth doing in that order: read the **morning brief**, start a run from
**Night shift** and then walk away to another page until it tells you it
finished, upload a page on **Ledger desk**, and clear what lands in
**Decisions**.

## Run in 5 minutes

Two processes: the agent API, and the control room in front of it.

```bash
uv sync --extra dev
cp .env.example .env.local       # ignored local config; safe when .env/ is a virtualenv
uv run python -m agents.seed     # explicit synthetic demo seed
DUKA_DEMO_OPEN_ACCESS=true uv run uvicorn app.main:app --reload   # API on :8000
```

```bash
cd frontend                      # second terminal; Node >= 24.12, pnpm 11
pnpm install
DUKA_API_URL=http://localhost:8000 pnpm dev      # control room on :3000
```

Open <http://localhost:3000>. (`DUKA_DEMO_OPEN_ACCESS` waives only the
password check that gets you an owner session; every route, tool, and
authority boundary behind it is unchanged. Drop it and sign in with
`DUKA_OWNER_PASSWORD` instead.)

The API is usable on its own. Reconciliation needs no API key, because it is
deterministic:

```bash
uv run python -m agents.synth.generate         # one duka's month: ~1,500 rows, ~50/day
curl -X POST "localhost:8000/recon/nightly?fuzzy=false"   # ~97% settled, no model
curl localhost:8000/digest/morning             # the owner's morning brief
```

`--rows` is a scale dial, not a busier shop. At ~50 payments a day, `--rows
50000` is roughly three years of trading, or thirty dukas reconciling on one
instance — the headroom test, which settles 48,403 of 49,756 in about half a
second on a laptop.

Two async paths, both of which return immediately and finish elsewhere —
in-process locally, over Pub/Sub in the cloud:

```bash
# a customer message: accepted, answered by the worker
curl -X POST localhost:8000/inbound -H 'content-type: application/json' \
  -d '{"customer_id":"254711000001","text":"Nataka unga 2 bales"}'   # 202
curl localhost:8000/messages/254711000001         # the reply, asynchronously

# the night shift: queued, outlives the request, reports back
RUN=$(curl -sX POST localhost:8000/recon/nightly/start \
  -H 'content-type: application/json' -d '{"fuzzy":true}' | jq -r .run_id)
curl "localhost:8000/recon/nightly/status?run_id=$RUN"   # pending → completed
```

Keyless tests (money invariants, scale recon vs generator ground truth,
async plumbing, screening, ledger gating, digest). 178 of the 196 run with
no credential at all; the other 18 need a Firestore emulator:

```bash
uv run pytest -q                 # 178 passed, 18 skipped

gcloud beta emulators firestore start --host-port=127.0.0.1:8085 &
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIRESTORE_DATABASE="(default)" \
  GOOGLE_CLOUD_PROJECT=demo-duka uv run pytest -q      # all 196
```

Browser tests and the judge-state profile:

```bash
cd frontend && pnpm check        # lint, types, unit, build, bundle budget
pnpm test:e2e                    # 33 Playwright cases against a real API
pnpm test:e2e:judge              # the seeded judging profile
```

Measured economics (needs model access; writes `economics.md`):

```bash
uv run python scripts/measure_nightly.py            # the realistic month
```

## Architecture

![Duka Autopilot architecture](docs/architecture-diagram.svg)

The Store, Bus,
Sessions, and Memory seams, the graph, and its trust boundaries.

```
customer (text / voice note / order photo)        owner (ledger photo)
        │                                             ▲
        ▼                                             │ approvals + digest
  channel API (FastAPI · Cloud Run) ──────▶ [async phase: Pub/Sub topics]
                                                      │
                                                      ▼
                                        ADK workflow graph (Gemini via Vertex)
                                        classifier ─▶ router ──order──▶ intake
                                                            ├─support─▶ support ─▶ refund_gate ⏸
                                          trusted owner role ├─ledger──▶ ledger_reader
                                                            └─recon──▶ exact_recon ─▶ fuzzy_recon
                                                      │
                                          Store seam: SQLite (local) / Firestore (cloud)
```

- `agents/` — the ADK workflow graph, tools, deterministic reconciliation
  engine, Store seam, and synthetic statement generator.
- `app/` — FastAPI channel layer: the public API, the Pub/Sub worker surface,
  the event bus seam, and the Cloud Run Job entrypoints.
- `frontend/` — the Next.js control room the owner actually works in: morning
  brief, customer inbox, ledger desk, decisions, night shift, and the evidence
  pages. It talks to the API through a server-side proxy, never from the
  browser.
- `tests/` — keyless deterministic suite.

## The four seams

The system is organized around four swap-by-config seams, so the exact same
domain logic runs on a laptop with zero credentials and on Google Cloud:

| seam | local | cloud | switch |
|---|---|---|---|
| **Store** (`agents/store/`) | SQLite | Firestore | `DUKA_STORE` |
| **Bus** (`app/bus.py`) | in-process asyncio | Pub/Sub (push → `/pubsub/push`) | `DUKA_BUS` |
| **Sessions** (`app/runner.py`) | ADK in-memory Sessions | Agent Platform managed Sessions | `DUKA_ENV` + `AGENT_CONTEXT_ID` |
| **Memory** (`app/runner.py`) | keyword recall | Agent Platform Memory Bank | `DUKA_ENV` + `AGENT_CONTEXT_ID` |

Nothing above a seam knows which side is plugged in. That is why the whole
test suite is keyless and deterministic, and why "deploy" is configuration,
not a rewrite.

## The graph

One ADK workflow serves every modality. In the diagram above each node is
tagged `CODE` (a `FunctionNode`) or `LLM`, and the human gate is the amber
one — the tag carries the meaning, not the colour:

- **screen** (code) — injection phrasing, money-path social engineering and
  smuggled payloads are stopped before any LLM sees the message; flagged
  traffic files a `security_flag` for the owner and never routes.
- **classifier** (LLM) proposes a route; **router** (code) sanitizes and
  emits it. Owner-only ledger and reconciliation decisions are rejected unless
  trusted Session state carries `actor_role=owner`; customer input cannot set
  this value. The LLM cannot route anywhere the code doesn't allow.
- **order intake / support / ledger** (LLM) can only act through tools, and
  the tools hold the gates: `save_order` files low-confidence orders for
  review, `request_refund` can only open a request, and the owner-scoped
  `record_ledger_rows` tool gates per row.
- **exact_recon** (code) settles ~97% of a statement month — milliseconds
  for one duka, under a second for the 50,000-row headroom test;
  **fuzzy_recon** (LLM) sees
  only the residue and can only file proposals. Cloud timing remains a release
  evidence gate.
- **refund_gate** (code) SUSPENDS the invocation graph-natively; the owner's
  decision resumes the same conversation.

## The night shift

Cloud Scheduler executes the private nightly Cloud Run Job at 02:00: an exact
pass, then fuzzy batches through the same graph until the residue stops
shrinking, then a restock shelf scan, a persisted report, and the morning
digest. Every number in that report is produced by code — the model's only
output is proposals sitting in the owner's queue.

The owner can also start the same pipeline from the control room, and that is
the part worth watching. It does not run inside the request: the API publishes
to the bus, answers immediately, and a worker does the work. So you press the
button, walk off to the inbox, and a couple of minutes later it interrupts you
wherever you are to say it finished and left three proposals. The run is
claimed and recorded like any other event, so a redelivery replays the receipt
instead of reconciling the month twice.

Each batch is capped at 25 residue rows and the loop stops at 40 batches or as
soon as a batch stops shrinking the pile, whichever comes first. The ceiling is
what makes the worst night bounded by construction rather than by hoping the
model gets bored.
