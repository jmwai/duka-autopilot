# Duka Autopilot

**The always-on AI back office for African SMEs.** Customers order by text
(and soon Swahili voice notes); owners photograph handwritten ledgers;
payments arrive as M-Pesa statements. Agents do the heavy lifting in the
background — the owner's whole job is a morning approval queue. **Every
shilling that moves is gated by a human.**

Built for the [All Things Agentic Hackathon](https://allthingsagentichackathon.devpost.com/)
(Taskmaster track: event-driven workflow with autonomous routing).

## The thesis

1. **LLM suggests, code decides.** The classifier proposes a route; a
   `FunctionNode` sanitizes and emits it. Fuzzy matches are proposals; code
   and humans decide.
2. **Deterministic first.** Reconciliation is an indexed, bulk, plain-code
   pass. The LLM only ever sees the ~3% residue engineering couldn't settle —
   which is why a 50,000-row statement month reconciles for well under a dollar.
3. **Humans gate money.** Refunds, low-confidence orders, and fuzzy matches
   all stop in the approval queue. No code path can auto-move money.
4. **Modalities change, guardrails don't.** Text, voice, and photo intake all
   funnel into the same sanitized, approval-gated pipeline.

## Run in 5 minutes

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env             # pick model access (Vertex AI recommended)
python -m agents.seed            # demo base: catalog, regulars, small statement
uvicorn app.main:app --reload    # open http://localhost:8000
```

Stress-scale reconciliation (no API key needed — it's deterministic):

```bash
python -m agents.synth.generate --rows 50000     # one month, engineered noise
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
pytest tests/
# Firestore backend parity (needs the emulator; skips cleanly without):
firebase emulators:exec --project demo-duka --only firestore \
  ".venv/bin/python -m pytest tests/test_store_firestore.py -q"
```

Measured economics (needs model access; writes docs/economics.md):

```bash
python scripts/measure_nightly.py --rows 50000
```

## Architecture

```
customer (text / voice note / photo)              owner (phone)
        │                                             ▲
        ▼                                             │ approvals + digest
  channel API (FastAPI · Cloud Run) ──────▶ [async phase: Pub/Sub topics]
                                                      │
                                                      ▼
                                        ADK workflow graph (Gemini via Vertex)
                                        classifier ─▶ router ──order──▶ intake
                                                            ├─support─▶ support ─▶ refund_gate ⏸
                                                            └─recon──▶ exact_recon ─▶ fuzzy_recon
                                                      │
                                          Store seam: SQLite (local) / Firestore (cloud)
```

- `agents/` — the ADK package (ships whole to Agent Engine): workflow graph,
  tools, the deterministic `recon_engine`, the `store/` seam, the synthetic
  statement generator.
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
      Swahili voice-note intake + reproducible TTS test set
- [x] Day 5: ledger-photo digitization with per-row gating, deterministic
      morning digest (/digest/morning), Memory Bank memory-service seam
- [ ] Deploy: Cloud Run + Pub/Sub + Firestore + Cloud Scheduler + Agent
      Engine, Agent Observability traces, measured cloud economics
- [ ] Polish: UI rebrand + voice/photo upload buttons, video, submission

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
