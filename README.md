# Duka Autopilot

**The autonomous night shift for an independent Kenyan shop.** Customers order
by text or Swahili voice notes; owners photograph handwritten ledgers;
payments arrive as M-Pesa statements. Agents do the heavy lifting in the
background, exact evidence is settled deterministically, and the owner wakes to
a compressed exception queue.

Built for the [All Things Agentic Hackathon](https://allthingsagentichackathon.devpost.com/)
(Taskmaster track: event-driven workflow with autonomous routing).

## The thesis

1. **LLM suggests, code decides.** The classifier proposes a route; a
   `FunctionNode` sanitizes and emits it. Fuzzy matches are proposals; code
   and humans decide.
2. **Deterministic first.** Reconciliation is an indexed, bulk, plain-code
   pass. The LLM only ever sees the bounded residue engineering could not
   settle. Cost claims are published only after a measured cloud run.
3. **Humans gate uncertainty.** Refund proposals, low-confidence orders, and
   fuzzy matches stop in the approval queue. Exact evidence may update the
   books; Duka never initiates an external transfer.
4. **Tool invariants survive every modality.** Text, voice, and photo intake
   share catalog validation, authority scoping, confidence gates, idempotency,
   and durable history filtering. The deterministic text screen does not claim
   to understand audio or image semantics.

## Run in 5 minutes

For the complete judge-seed, standalone Next.js frontend, browser-test, and
GCP preparation path, use
[docs/local-testing-and-gcp-configuration.md](docs/local-testing-and-gcp-configuration.md).

```bash
uv sync --extra dev
cp .env.example .env.local       # ignored local config; safe when .env/ is a virtualenv
uv run python -m agents.seed     # explicit synthetic demo seed
uv run uvicorn app.main:app --reload    # open http://localhost:8000
```

Stress-scale reconciliation (no API key needed — it's deterministic):

```bash
uv run python -m agents.synth.generate --rows 50000  # reproducible stress data
curl -X POST "localhost:8000/recon/nightly?fuzzy=false"   # settle ~97% in ~1s
curl localhost:8000/digest/morning                # the owner's morning brief
```

The async path (what Pub/Sub drives in the cloud):

```bash
curl -X POST localhost:8000/inbound -H 'content-type: application/json' \
  -d '{"customer_id":"254711000001","text":"Nataka unga 2 bales"}'   # 202
curl localhost:8000/messages/254711000001         # the reply, asynchronously
```

Keyless tests (money invariants, scale recon vs generator ground truth,
async plumbing, screening, ledger gating, digest):

```bash
uv run pytest tests/
# Firestore backend parity (needs the emulator; skips cleanly without):
firebase emulators:exec --project demo-duka --only firestore \
  ".venv/bin/python -m pytest tests/test_store_firestore.py -q"
```

Measured economics (needs model access; writes docs/economics.md):

```bash
uv run python scripts/measure_nightly.py --rows 50000
```

## Architecture

![Duka Autopilot architecture](docs/architecture.svg)

Full notes: [docs/architecture.md](docs/architecture.md) — the Store, Bus,
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
- `app/` — FastAPI channel layer + WhatsApp-look demo UI.
- `tests/` — keyless deterministic suite.

## Status (hackathon build log)

- [x] Day 1: Store seam (SQLite backend), scale recon engine, 50k-row
      synthetic month generator with engineered noise, workflow graph,
      channel API + UI, keyless test suite
- [x] Day 2: event-driven intake (bus seam: local + Pub/Sub push, worker,
      persisted conversations) + Firestore backend with emulator parity tests
- [x] Day 3: nightly reconciliation pipeline (exact pass + batched fuzzy
      through the same graph, stop-when-dry), cost metering per run,
      /recon/nightly + measure_nightly.py
- [x] Day 4: deterministic inbound screening (injection + money-path
      social engineering -> owner's queue, optional Model Armor on top);
      Swahili voice-note transport and multimodal runner coverage; frozen
      bilingual Google Cloud Gemini-TTS fixtures and live model proof remain
      release gates
- [x] Day 5: ledger-photo digitization with per-row gating, deterministic
      morning digest (/digest/morning), and Memory Bank service seam
- [x] Day 7: owner console UI (async multimodal chat, digest card, shelf
      scan, readable approvals), proactive restock, LLM evalsets ported
- [x] Day 8: architecture diagram + docs, Devpost submission text
      (docs/submission.md), blog post draft (docs/blog-post.md),
      clean-machine repro pass
- [ ] Deploy: Cloud Run services and Job + Pub/Sub + Firestore + Scheduler +
      managed Sessions/Memory Bank context, traces, and measured economics
- [ ] Submit: Loom video, reviewed transcript/guide, Devpost form, and blog

## Disclosure of pre-existing code

This project was built during the hackathon submission period. It
incorporates disclosed pre-existing code from
[my-duka-agent](https://github.com/jamesmwai/my-duka-agent), an open demo the
author built for a conference talk (Google I/O Extended Pwani 2026): the demo
data model and seed, the exact-match reconciliation logic (since rebuilt for
scale), the workflow graph shape, and the WhatsApp-look demo UI. Ported files
say so in their docstrings. Everything else — the Store seam and backends,
the indexed bulk reconciliation engine, the synthetic statement generator,
the async/cloud/multimodal phases — is new hackathon-period work.

## License

Apache-2.0
