# Duka Autopilot — Four-Minute Loom Transcript

> Status: rehearsal draft; not approved for recording
> Target duration: 3:45–3:55
> Release SHA: `{{FINAL_RELEASE_SHA}}`
> Frontend digest: `{{FRONTEND_DIGEST}}`
> Backend digest: `{{BACKEND_DIGEST}}`
> Loom URL: `{{LOOM_URL}}`

This transcript is both narration and claims control. Replace every
`{{PLACEHOLDER}}` from the final evidence ledger before recording. If a value
cannot be cited, remove the spoken claim and its screen beat.

## Final timecoded script

| Time | Screen and operator action | Exact narration | Required visible proof |
|---|---|---|---|
| 0:00–0:13 | Start on the hosted owner dashboard with the morning digest open and the small approval queue visible. Do not begin on a title slide. | “While this Kenyan shop slept, Duka settled the routine work and compressed the night into these few decisions.” | Public `.run.app` host; digest; exact-match and queue cards |
| 0:13–0:25 | Keep dashboard and chat visible. Briefly point at the tagline. | “Most agents expect clean text. A duka actually receives a Swahili voice note, a handwritten exercise book, and an M-Pesa export.” | Product UI, not slides |
| 0:25–0:34 | Select `{{DEMO_CUSTOMER_NAME}}`; show that a fresh managed Session is active. Click the microphone. | “This customer is starting a new day, so only a confirmed usual order can carry across through Memory Bank.” | New-session marker; no old chat context relied upon |
| 0:34–0:40 | Record the real human voice note. | **Voice fixture:** “Habari, niletee ya kawaida kesho asubuhi.” | Browser microphone indicator; continuous take |
| 0:40–0:57 | Stop recording. Leave the `202 queued · EVENT… · N ms` status visible, then let the async reply arrive. Point to the node path and grounded total. | “The public API returns 202 immediately. Pub/Sub delivers the event; ADK screens, classifies, recalls the preference, re-reads today’s catalog, and saves exactly one grounded order.” | Visible 202/event ID/ack time; `screen › classifier › router › order_intake`; itemized current KSh total |
| 0:57–1:08 | Show the new order row. If space permits, flash the managed Memory evidence tab for no more than three seconds. | “Memory suggests items and quantities—it never supplies authority, payment state, or price. Firestore and the catalog remain business truth.” | Current catalog price; opaque memory user scope; no raw phone in memory |
| 1:08–1:16 | Click **Upload ledger** and choose `fixtures/demo/ledger-page-v1.png`. | “Now the owner photographs yesterday’s handwritten ledger.” | Owner-authenticated ledger control; fixture hash begins `9b85c98d1d35` |
| 1:16–1:34 | Let the ledger result render. Point to committed rows and one `ledger row` approval. | “Gemini reads the messy page, but deterministic code decides row by row: two clear entries reach the books; this smudged amount stops for review.” | `screen › classifier › router › ledger_reader`; `2` recorded; `1` gated; no guessed amount |
| 1:34–1:46 | In the GCP tab, show Cloud Scheduler and click **Force run** on `{{NIGHTLY_SCHEDULER_NAME}}`. Keep this action uncut. | “At two each morning, Cloud Scheduler starts the real Cloud Run night-shift Job. I’ll trigger that same schedule now.” | Scheduler name, `europe-west1`, successful trigger; no terminal simulation |
| 1:46–2:13 | Show the Job execution transition to success, then switch to the dashboard and refresh. | “The exact indexed pass handles routine evidence first. Only bounded residue reaches Gemini: twenty-five rows per batch, forty batches maximum, and it stops when progress stops.” | Job execution ID `{{JOB_EXECUTION_ID}}`; success; bounded configuration evidence |
| 2:13–2:31 | Point to the final cards/report. | “On this measured run, {{EXACT_MATCHED}} of {{ROWS_CONSIDERED}} rows settled deterministically—{{SETTLE_RATE}} percent—in {{EXACT_WALL_MS}} milliseconds. {{RESIDUE_END}} remained, and the model stage cost {{MODEL_COST_USD}}.” | Exact cloud report tied to final SHA; never substitute local 812 ms or unmeasured cost |
| 2:31–2:43 | Approve one bounded fuzzy or ledger proposal. Show the queue shrink and the linked status/update. | “A human sees only ambiguity and consequences. This approval is atomic and idempotent; a double click cannot create a second effect.” | Approval ID and final state; one mutation only |
| 2:43–3:12 | Switch to the final architecture diagram. Trace one left-to-right path only: web → API/Pub/Sub → worker/ADK → Firestore/Session/Memory; then Scheduler → Job. | “The architecture has three trust lanes: exact code may update exact bookkeeping; Gemini may interpret messy input and propose; humans decide ambiguity. Cloud Run executes the app, Firestore owns business truth, and one protected Agent Platform context provides durable Sessions and Memory Bank.” | Diagram matches deployed resources; no undeployed logos |
| 3:12–3:39 | Show a pre-arranged evidence board or compact sequence of tabs: Cloud Run revisions, Cloud Trace, GitHub WIF deployment, tests/evals. | “This is not a mock backend: here are the running revisions and Job, a trace joining the request to the ADK nodes and Firestore, a keyless GitHub deployment, {{TEST_COUNT}} deterministic tests with zero skips, and {{EVAL_PASS_COUNT}} of {{EVAL_TOTAL_COUNT}} ADK evaluations passing.” | Final SHA/digests; trace ID; WIF run; 0 skipped; actual ADK result—not pytest presented as eval |
| 3:39–3:53 | Return to the digest and exception queue. Pause half a beat on the outcome. | “Duka does not send a real refund or supplier order; it creates auditable proposals for manual fulfillment. The routine work is autonomous. The duka slept. Its back office didn’t.” | Honest disclosure; final outcome screen |

Target spoken duration: **3:53**. Never exceed 3:55 in rehearsal; Loom must
remain below the official four-minute limit after processing.

## Fallback lines

Fallbacks preserve truthful narration; they do not permit faking a live result.

| Failure during take | Allowed action | Replacement narration |
|---|---|---|
| Voice reply takes more than 12 seconds | Keep the visible 202/event ID, cut waiting only, then show the eventual reply from the same event | “The event was already durably accepted; this is the reply from that same visible event ID.” |
| Browser microphone permission fails | Attach the exact purpose-recorded audio fixture and keep the filename visible | “I’m attaching the same purpose-recorded Swahili voice note used in our evaluation.” |
| Memory is eventually consistent | Use the pre-generated, pre-verified demo memory specified in the guide | “This preference was generated from a prior confirmed order; the current turn still re-reads the catalog live.” |
| Ledger vision takes more than 15 seconds | Cut only the wait; retain upload and final response from the same request | “This result belongs to the ledger upload you just saw.” |
| Scheduler or Job exceeds the take window | Show a successful execution created in the immediately preceding rehearsal only if its immutable SHA and execution ID are visible; do not say “now” | “Here is the successful execution for this exact release candidate.” |
| Cloud console navigation is slow | Use the prepared evidence board containing direct console links/IDs | “These identifiers link the application action to the running Google Cloud resources.” |
| Any required result differs from placeholders | Stop the take and update the evidence/transcript | No fallback claim is allowed |

## Pronunciation and caption corrections

- **Duka:** “doo-kah”
- **Swahili line:** “hah-BAH-ree, nee-leh-TEH yah kah-WAH-ee-dah KEH-shoh ah-soo-BOO-hee”
- **M-Pesa:** “em-PEH-sah”
- **Unga:** “OON-gah”
- **KSh:** narrate as “Kenyan shillings,” caption as `KSh`
- Correct Loom captions to `Duka`, `Swahili`, `M-Pesa`, `Pub/Sub`, `Firestore`,
  `Cloud Run`, `ADK`, `Gemini`, and `Memory Bank`.

## Claims checklist before recording

- [ ] Every placeholder is replaced from `docs/evidence-ledger.md`.
- [ ] The voice is purpose-recorded/synthetic and contains no real customer data.
- [ ] The ledger is synthetic and its ground truth is recorded.
- [ ] The Job measurement is cloud evidence from the final SHA, not the local baseline.
- [ ] The ADK eval count is from `adk eval`, not pytest.
- [ ] The diagram contains only provisioned and proven services.
- [ ] The recording discloses simulated WhatsApp-like, M-Pesa-like, refund, and supplier effects.
- [ ] Final captions are manually reconciled to this transcript.
