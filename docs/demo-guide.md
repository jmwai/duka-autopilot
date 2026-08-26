# Duka Autopilot — Loom Recording and Demo Guide

> Status: operator draft; cloud execution fields are intentionally unresolved
> Release SHA: `{{FINAL_RELEASE_SHA}}`
> Transcript: `docs/demo-transcript.md`
> Target Loom length: 3:45–3:55

This is the reproducibility contract for the final video. A second operator
must be able to prepare and record the same causal demo without undocumented
steps. Do not record until every blocking checkpoint is green.

## 1. Blocking prerequisites

- [ ] `{{FINAL_RELEASE_SHA}}` is committed, reviewed, tagged, and matches both immutable image digests.
- [ ] The public frontend is reachable from an incognito browser at `{{WEB_URL}}`.
- [ ] API and worker reject anonymous direct invocation; the web BFF succeeds.
- [ ] Cloud Run services, nightly/digest Jobs, Firestore, Pub/Sub/DLQ,
      Scheduler, Vertex, managed Sessions, Memory Bank, Logging, and Trace are green.
- [ ] `docs/evidence-ledger.md` contains final artifact IDs for every spoken claim.
- [ ] The 50,000-row cloud report and model cost are captured for this SHA.
- [ ] Intake/support/safety ADK evals pass their final thresholds.
- [ ] Restart/resume, memory isolation, duplicate delivery, IAM denial, and rollback reports pass.
- [ ] `{{VOICE_FIXTURE_FILENAME}}` and `{{LEDGER_FIXTURE_FILENAME}}` match the frozen fixture manifest.
- [ ] No secret, raw credential, real payment data, or personal customer data appears in any tab.

If any prerequisite is false, rehearse with placeholders but do not publish a
judge-facing recording.

## 2. Frozen demo identities and fixtures

Record these values in the fixture manifest before the first timed rehearsal:

| Item | Frozen value |
|---|---|
| Demo customer ID/name | `254711000001` / `Mama Achieng` (synthetic) |
| Usual order ground truth | `4x Unga wa Dola 2kg + 3x Laundry soap bar` |
| Expected current catalog total | `KSh 1,035` |
| Voice fixture | `{{VOICE_FIXTURE_PATH}}` |
| Voice SHA-256 | `{{VOICE_FIXTURE_SHA256}}` |
| Voice transcript | `Habari, niletee ya kawaida kesho asubuhi.` |
| Ledger fixture | `fixtures/demo/ledger-page-v1.png` |
| Ledger SHA-256 | `9b85c98d1d35e5b9c8a5e98d03dea9168ff014ce157c51bfa09da99de62f59a0` |
| Ledger expected clean/gated rows | `2` / `1` |
| Inbound event ID strategy | Fresh server-generated ID; capture visible first 12 characters |
| Synthetic statement seed | `2026` |
| Nightly dataset | 50,000 generated rows plus the six-row demo statement; final cloud counts come from the release report |
| Demo Memory scope | `duka-autopilot` + opaque `{{MEMORY_USER_KEY}}` |

The voice may be recorded live or attached from the frozen purpose-recorded
fixture. The ledger may be purpose-created or generated, but must be synthetic,
stable, disclosed, and have known row-level ground truth.

## 3. Seed and rehearsal-state procedure

The production seed Job is an initial, idempotent setup operation—not a reset.
Never use startup seeding, pass `--force`, or run a destructive reset against
an unresolved project, environment, database, or context resource. Rehearse in
development; seed production only when the final release is ready for its first
judge-facing take.

1. Confirm gcloud/GitHub console headers show `my-duka-autopilot` and production.
2. Confirm the deployed `/version` response matches `{{FINAL_RELEASE_SHA}}` and
   durable fingerprint `{{TOPOLOGY_FINGERPRINT}}`.
3. Verify the production Firestore database is the intended empty synthetic
   environment, then run the approved idempotent Job `duka-prod-seed` once.
4. Require the Job result to report 12 products, 8 synthetic customers, 10
   orders, 6 statement rows, and `memory_prepared=true`.
5. Verify the customer has one confirmed historical usual order and one
   pre-generated Memory Bank preference, with no price/payment/phone facts.
6. Rotate the customer to a fresh managed Session.
7. Confirm the production environment has not been used for rehearsal traffic.
   Do not clear or rewrite durable state to rescue a take.
8. Ensure one known ledger ambiguity and one bounded approval scenario will be visible.
9. In development, execute the same seed Job twice and verify the second run
   reports `seeded=false` without changing counts. Do not run a production dry
   rehearsal after the final production baseline is frozen.

Save the seed execution ID and timestamp. Never reseed between the live action
and the evidence capture within a take. If a production take mutates the
baseline incorrectly, stop and diagnose it; do not force-reset the database.

## 4. Browser and Loom setup

### Browser

1. Use a clean browser profile at 100–110% zoom and 1920×1080 display resolution.
2. Disable notifications, password-manager prompts, translation popups, and bookmarks bar.
3. Close email, chat, personal cloud projects, billing details, and unrelated tabs.
4. Authenticate before recording. The owner password must not appear in video,
   clipboard history, developer tools, URL, or JavaScript storage.
5. Grant microphone access and record a two-second level test.
6. Keep the cursor large enough to follow; disable click effects that obscure text.

### Loom

1. Record the browser tab or sanitized display at 1080p; camera bubble is optional.
2. Use system audio off unless needed; use a quiet microphone and fixed gain.
3. Disable Loom notifications/countdown overlay after the initial start.
4. Prefer one take with cuts only around service waiting, never around causal actions.
5. Keep a local source/MP4 backup where the account permits it.

## 5. Pre-arranged tabs

Open these in order; use direct resource URLs rather than searching during the take:

1. `{{WEB_URL}}` — Duka dashboard, morning digest open.
2. `{{SCHEDULER_URL}}` — `{{NIGHTLY_SCHEDULER_NAME}}` detail page.
3. `{{JOB_URL}}` — nightly Job executions filtered to final SHA.
4. `{{TRACE_URL}}` — exact end-to-end trace or trace list filtered by release/event.
5. `{{AGENT_CONTEXT_URL}}` — protected context resource, Sessions, and Memory Bank proof.
6. `{{GITHUB_RUN_URL}}` — keyless deployment run and manifest artifact.
7. `{{EVIDENCE_BOARD_URL_OR_LOCAL_PAGE}}` — compact test/eval/manifest summary.
8. `{{ARCHITECTURE_URL_OR_LOCAL_PAGE}}` — final deployed architecture.

Arrange tabs in narration order. Hide account avatars/project selectors if they
reveal unnecessary personal information, while retaining enough resource name
and project context to prove GCP execution.

## 6. Recording click path

Follow `docs/demo-transcript.md` exactly:

1. Start on outcome: digest and compressed approval queue.
2. Select `{{DEMO_CUSTOMER_NAME}}` and confirm the fresh-session marker.
3. Record or attach the frozen Swahili voice note.
4. Hold on the visible `202 queued`, event prefix, and acknowledgement time.
5. Hold on the final node path, itemized order, current KSh total, and order row.
6. Upload `fixtures/demo/ledger-page-v1.png` through **Upload ledger**.
7. Show the recorded/gated result and the one doubtful row in the queue.
8. In Cloud Scheduler, force-run `{{NIGHTLY_SCHEDULER_NAME}}` without a cut.
9. Show execution `{{JOB_EXECUTION_ID}}` succeed; return to the dashboard and refresh.
10. Show exact counts, residue, wall time, batch count, tokens, and cost.
11. Approve one bounded proposal; show exactly one resulting mutation.
12. Explain the architecture’s exact/Gemini/human trust lanes.
13. Show the revision/digest, trace, WIF run, 0-skip tests, and ADK eval result.
14. Return to the digest, state the simulation disclosure, and close.

## 7. Expected checkpoints

| Checkpoint | Pass condition | Stop-take condition |
|---|---|---|
| Hosted identity | `.run.app`, release SHA, and topology agree | Any mismatch or local host |
| Voice acknowledgement | HTTP 202/event prefix visible under 1.5 s target | non-202 or wrong event |
| Voice result | expected items/qty; current catalog total; one order | invented price, duplicate order, or wrong user |
| Memory | prior confirmed usual only; opaque isolated scope | price/payment/phone/role memory |
| Ledger | expected clean rows record; expected doubtful row gates | doubtful amount reaches books |
| Scheduler/Job | matching schedule starts matching final-digest Job | manual local endpoint presented as Scheduler |
| Reconciliation | cloud report equals evidence ledger | local number or unmeasured cost spoken |
| Approval | one atomic decision/effect | duplicate or false external-effect claim |
| Trace | request → Pub/Sub → ADK/tool → Firestore correlation | unrelated/pre-release trace |
| Tests/evals | exact counts and types correctly labeled | pytest described as ADK eval |

## 8. Timing rehearsal sheet

Record actual duration after each rehearsal:

| Segment | Target | Rehearsal 1 | Rehearsal 2 | Rehearsal 3 |
|---|---:|---:|---:|---:|
| Outcome/problem | 0:25 |  |  |  |
| Voice + memory | 0:43 |  |  |  |
| Ledger | 0:26 |  |  |  |
| Scheduler/night shift | 0:57 |  |  |  |
| Approval | 0:12 |  |  |  |
| Architecture | 0:29 |  |  |  |
| Proof/close | 0:41 |  |  |  |
| **Total** | **3:53** |  |  |  |

Three rehearsals must finish at or below 3:55. Cut narration or a secondary
proof beat before attempting to speak faster.

## 9. Contingency procedure

- Keep the exact event ID/request ID whenever cutting service wait time.
- A pre-recorded execution is acceptable only when labeled as such and tied to
  the exact release; never narrate it as the action just triggered.
- If a model response, count, cost, or route differs, stop and investigate.
- If the voice microphone fails, attach only the frozen purpose-recorded file.
- If eventual Memory generation is incomplete, do not wait live; use the
  pre-verified memory specified by the fixture manifest.
- If the app, Scheduler, Job, or console is unavailable, abandon the take. A
  screenshot alone is not a substitute for the required working-app proof.
- Never reveal a password, secret value, access token, unrestricted terminal,
  billing account, or real person’s information to rescue a take.

## 10. Security and privacy check

- [ ] Owner password entered before capture; cookie is HttpOnly/Secure/SameSite Strict.
- [ ] API/worker/Job remain private; only web is public.
- [ ] No developer tools show Authorization, channel key, cookies, or request body media.
- [ ] Customer IDs shown are synthetic; Memory console uses opaque user key.
- [ ] Ledger and statement are synthetic; M-Pesa-like data is clearly disclosed.
- [ ] CORS remains same-origin by default; BFF exposes only allowlisted routes.
- [ ] No raw audio/image base64 or prompt body appears in logs/trace.

## 11. Post-record verification

1. Trim only dead time; preserve at least one visibly continuous live action.
2. Confirm duration is under 4:00 and target range is 3:45–3:55.
3. Correct Loom captions against `docs/demo-transcript.md`, especially Swahili and product names.
4. Update transcript timecodes to match the final cut exactly.
5. Set share access so judges can watch without sign-in.
6. Verify playback, resolution, captions, audio, and links in an incognito browser.
7. Verify the hosted app and demo access in a separate incognito session.
8. Save Loom URL, source backup location, final duration, verification time,
   verifier, SHA, digests, and production revision IDs in the evidence ledger.
9. Rewatch once with the sound off: every claimed action should still have
   legible visual evidence.
10. Rewatch once listening only: no unsupported claim may remain.

## 12. Publication gate

- [ ] Transcript matches final cut and captions.
- [ ] Second operator reproduced the guide successfully.
- [ ] Loom incognito playback works.
- [ ] All placeholders are gone.
- [ ] Evidence ledger points to the same SHA/digests shown in video.
- [ ] Devpost copy, architecture, disclosures, hosted URL, and video agree.

Only then may the Loom URL be added to Devpost.
