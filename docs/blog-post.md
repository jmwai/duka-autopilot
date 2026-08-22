# The LLM only sees the 3%: building an AI back office a duka can afford

*James Mwai — August 2026. Built for the All Things Agentic Hackathon;
code at github.com/jamesmwai/duka-autopilot.*

Last month I gave a talk in Mombasa about building AI agents for African
SMEs. The demo was a two-act play: Act 1, one overloaded agent with every
tool and a prayer, failing on ambiguity; Act 2, a workflow graph where the
failures stopped. The room's favorite moment wasn't either act — it was a
slide with a number on it: what one customer interaction actually costs in
tokens. Kenyan shop owners don't ask whether AI is impressive. They ask
what it costs per day and whether it can be trusted near the till.

Duka Autopilot is my attempt to answer both questions properly, built
during the hackathon on the bones of that talk demo (disclosed in the
repo). It is an always-on back office for a small shop: customers order by
Swahili voice note, the owner photographs the handwritten ledger, and the
M-Pesa statement reconciles itself overnight. Three design rules carry the
whole thing.

## 1. Deterministic first — because it is an economics strategy

The heart of the system is the nightly reconciliation run, and the heart
of that run contains no AI at all. Payments match to orders on
(phone, amount, time-window) with an indexed, bulk-writeback pass — plain
Python over a Store interface. On a synthetic month of 50,000 statement
rows it settles 97.3% in about 1.1 seconds, for free.

Only the residue — payer-name variants like "B. OTIENO" paid from a
spouse's line, partial payments, two transfers that sum to one order —
reaches Gemini, in bounded batches, with one power: filing a *proposal*
into the owner's approval queue. The loop stops when the residue stops
shrinking, so a stubborn 40 rows can't burn tokens all night. That is how
a full month of statements reconciles for less than a dollar: the LLM
bills only for the 3% that genuinely needs judgment.

The number is measured, not vibes. The synthetic generator engineers its
noise at known rates, and the test suite asserts the engine settles
*exactly* what was engineered. (That test caught a real bug: greedy
matching breaks when a regular has two same-total orders — the fix is
pairing payments chronologically.)

## 2. LLM suggests, code decides — especially about money

Every verdict that matters is emitted by code. The classifier LLM proposes
a route; a FunctionNode sanitizes it against an allowlist. The intake
agent extracts an order but `save_order` decides whether it needs review.
The vision agent reads a ledger page but `record_ledger_rows` gates every
smudged line individually. Support can open a refund request; only the
graph's refund gate — which suspends the workflow mid-conversation until
the owner taps approve — can let the conversation continue, and even then
the code writes the outcome.

The same doctrine handles security. Customer messages are untrusted input
to a system that sits near money, so a deterministic screen runs before
any LLM sees them: injection phrasing, "mark my order as paid", oversized
smuggled payloads. Flagged messages get a polite brush-off and the owner
gets a security flag in the queue. It's auditable regex and length checks,
testable without a key, failing closed on the money paths — with Model
Armor as an optional cloud layer on top. A prompt that says "please ignore
attackers" is a wish; a FunctionNode that refuses to route is a policy.

## 3. Modalities change, guardrails don't

The real interface of a duka is not a chat box. It's a voice note in
Swahili-English mix recorded with a thumb on a counter, an exercise-book
ledger page photographed in afternoon light, an M-Pesa SMS. Gemini's
single-model multimodality made this the easy part: the voice note and the
ledger photo enter the *same* screened, routed, human-gated pipeline as
text. No second system, no second security review. "Niletee vitu vyangu
vya kawaida" — bring me my usual — resolves from per-customer memory, and
if the memory isn't an exact order, confidence drops and the order waits
for review like anything else doubtful.

## The seams made it deployable

Three swap-by-config seams — Store (SQLite ⇄ Firestore), Bus (in-process ⇄
Pub/Sub), Memory (keyword recall ⇄ Memory Bank) — mean the laptop that runs
the 40-test keyless suite and the Cloud Run deployment execute the same
domain logic. Local-first wasn't a compromise; it's why everything from
the money invariants to the 97.3% settle rate is a deterministic test
instead of a claim.

The owner's whole job, in the end, is a morning digest and an approval
queue: last night the agent settled 48,402 payments, drafted a restock
order for the eggs, flagged one suspicious message, and left four things
that need a human. Approve, approve, reject, chai. The duka slept; the
back office didn't.

*Stack: Gemini 3.7 Flash on Vertex AI · Google ADK workflow graphs ·
Agent Engine Memory Bank · Cloud Run · Pub/Sub · Firestore · Cloud
Scheduler. The repo's README has a five-minute local quickstart.*
