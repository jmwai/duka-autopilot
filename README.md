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
python -m agents.synth.generate --rows 50000    # one month, engineered noise
curl -X POST localhost:8000/recon/exact          # settle ~97% in seconds
```

Keyless tests (money invariants + scale recon vs generator ground truth):

```bash
pytest tests/
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
- [ ] Pub/Sub async intake + Firestore backend
- [ ] Nightly reconciliation via Cloud Scheduler + measured economics
- [ ] Swahili voice-note ordering, ledger/receipt photo ingestion
- [ ] Memory Bank per-customer memory, inbound injection screening
- [ ] Cloud Run + Agent Engine deployment, Agent Observability traces

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
