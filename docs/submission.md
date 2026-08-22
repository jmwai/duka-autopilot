# Devpost submission — Duka Autopilot

> Paste-ready text for the Devpost form. Track: **The Taskmaster**.
> Also entering: Individual/Hobbyist · Best Architectural Design · Best Multimodal UX.

## Elevator pitch (one-liner)

The always-on AI back office for African SMEs: customers order by Swahili
voice note, the owner photographs the handwritten ledger, 50,000 M-Pesa
statement rows reconcile overnight for under a dollar — and every shilling
that moves waits for a human thumb.

## Inspiration

A duka owner in Mombasa runs order intake, customer support, bookkeeping
and M-Pesa reconciliation from one phone, after hours, between customers.
The tooling assumption behind most "AI agent" demos — a desk, a keyboard, a
typed English prompt — describes nobody in that shop. Customers send voice
notes in Swahili. The ledger is a paper exercise book. The bank statement
is an M-Pesa export with mangled payer names. We built the agent system
that meets that reality, after presenting an earlier teaching demo of these
ideas at Google I/O Extended Pwani 2026 (disclosed below).

## What it does

Duka Autopilot is an event-driven back office that runs while the duka
sleeps. Inbound messages — text, Swahili voice notes, photos of order notes
or ledger pages — arrive as events on Pub/Sub and are handled asynchronously
by an ADK workflow graph. Orders are extracted with per-order confidence
gates; support answers from tools; a photographed ledger page becomes
book entries with per-row gates. At 2am, Cloud Scheduler fires the night
shift: a deterministic engine reconciles the month's M-Pesa statement
(97.3% settled by plain code in ~1 second at 50k-row scale), the LLM sees
only the ~3% residue and may only file proposals, a shelf scan drafts a
supplier order, and at 6:30 the owner gets a morning digest. Refunds,
doubtful orders, fuzzy matches, smudged ledger rows, restock drafts and
security flags all converge on one approval queue — the only place money
can move.

## How we built it

Gemini (gemini-3.6-flash on Vertex AI — one model for text, vision and
audio) inside an ADK 2.x workflow graph where every hop is an explicit
Edge. Three swap-by-config seams make local and cloud the same codebase:
Store (SQLite ⇄ Firestore), Bus (in-process ⇄ Pub/Sub push), Memory
(keyword recall ⇄ Agent Engine Memory Bank). FastAPI on Cloud Run serves
the channel API and the owner console; Cloud Scheduler drives the nightly
pipeline; a deterministic screening node (with an optional Model Armor
layer) inspects every inbound message before any LLM sees it. A seeded
synthetic-month generator produces 50,000 statement rows with noise
engineered at known rates, so the test suite asserts the reconciliation
engine settles exactly what was engineered — the headline number is
measured, not vibes.

## Challenges we ran into

Free-tier API caps (20 requests/day) killed early rehearsals — the
architecture answer was better than a bigger quota: make the deterministic
pass do 97% of the work so the LLM bills only for the interesting 3%.
Greedy payment matching subtly breaks when a regular has two same-total
orders (the ground-truth tests caught the time-window violation; the fix
is chronological pairing). And graph-native human-in-the-loop suspension is
unforgiving: one broad try/except around a tool body swallows the
interrupt machinery and the pause never happens.

## Accomplishments we're proud of

A measured economics story (a full statement month reconciled overnight
for well under a dollar); a security posture that is auditable code, not a
prompt asking nicely; 40+ deterministic keyless tests including
generator-ground-truth assertions; and a demo a duka owner would actually
recognize as their shop.

## What we learned

LLM suggests, code decides — routing, matching and screening verdicts
should be emitted by code. Deterministic first is an economics strategy,
not just an engineering aesthetic. Modalities change, guardrails don't:
voice, photo and text should enter one screened, gated pipeline rather
than three bolted-on paths.

## What's next

A real WhatsApp Business bridge (the UI already speaks webhook), Kiswahili
voice replies for the digest, multi-duka fleets with cooperative bulk
buying, and M-Pesa statement ingestion via the Daraja API.

## Built with

`gemini-3.6-flash` · Vertex AI · Google ADK 2.x (workflow graphs,
FunctionNodes, graph-native HITL) · Agent Engine (Memory Bank,
Observability) · Cloud Run · Pub/Sub · Firestore · Cloud Scheduler ·
Model Armor (optional layer) · FastAPI · Python · SQLite (local twin)

## Data sources

All demo data is synthetic: a seeded generator (`agents/synth`) produces
customers with Kenyan names, a month of orders, and M-Pesa-statement-shaped
rows with engineered noise (payer-name variants, partial and split
payments, duplicate refs, unknown deposits). The Swahili voice-note test
set is generated offline with espeak-ng and ships with ground-truth
expected orders. No real customer or payment data is used anywhere.

## Disclosure of pre-existing work

Duka Autopilot was built during the submission period (Aug 2026). It
incorporates disclosed pre-existing code from **my-duka-agent**, an open
demo the author built for the talk "Building AI Agents for African SMEs"
at Google I/O Extended Pwani 2026: the demo data model and seed, the
exact-match reconciliation logic (since rebuilt for indexed bulk scale),
the workflow graph shape, and the WhatsApp-look demo UI shell. Every
ported file says so in its docstring, and the repo's git history shows the
hackathon-period work: the Store/Bus/Memory seams, the Firestore backend,
the event-driven intake, the nightly pipeline, the synthetic-month
generator, inbound screening, voice-note and ledger-photo ingestion, the
restock scan, the morning digest, and the owner console.
