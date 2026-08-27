# Duka Autopilot — Winning Frontend and Remaining Delivery Plan v6

> Status: active execution contract; local frontend refinement is in progress;
> no cloud mutation is authorized by this document
>
> Baseline: `0a9390a` on `dev`, pushed to the private GitHub remote
>
> Core category: The Taskmaster; Grand Prize is the score target
>
> GCP project: `agent-platform-503913` (`183775788663`)
>
> Cloud Run region: `europe-west1`; Vertex AI and Agent Platform: `global`
>
> Frontend: Next.js 16.3.3, React 19, Tailwind CSS 4, shadcn/ui composition

This plan supersedes the execution sequencing in v5 while preserving its
truth, safety, evidence, and release requirements. `DESIGN_SPEC.md` remains the
product contract. The purpose of v6 is to turn the existing strong control room
into a memorable judging experience and then finish every still-open release
gate in dependency order.

## 1. Outcome

Duka Autopilot should feel like a calm morning operating system for one Kenyan
shop, not a generic AI dashboard. Within ten seconds a judge should understand:

1. routine evidence was settled while the owner slept;
2. Gemini handled only messy, bounded interpretation;
3. consequential uncertainty stopped in a small owner queue;
4. every result has inspectable execution and release evidence.

The product promise remains:

> The autonomous night shift for a Kenyan shop: voice notes, handwritten
> ledgers, and payment records become reconciled books and a three-minute
> morning decision queue.

The interaction maxim remains:

> Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.

### Winning goals

| Goal | Release measure |
|---|---|
| Immediate utility | A first-time judge can describe the product after the first Morning Brief viewport |
| Visible agency | The Loom contains one unedited voice-to-action segment and one real scheduled night-run segment |
| Safe autonomy | Exact, Gemini, and Owner authority is visible before every consequential action |
| Multimodal credibility | English and Kiswahili Google-generated voice and ledger fixtures pass frozen-truth checks |
| Architectural discipline | Public web, private API/worker, Jobs, Firestore, Pub/Sub, managed Sessions, and Memory Bank are proven at one release |
| Production confidence | The exact tested image digests are promoted through WIF and can be rolled back in under five minutes |
| Honest evidence | Every green claim resolves to a release-bound artifact; missing proof remains visibly pending |

## 2. Baseline decision: evolve the existing frontend

The current repository already contains the intended standalone frontend:

- `frontend/` is a Next.js App Router application with Server Components for
  initial private reads and Client Components for bounded interaction;
- the UI is composed from local shadcn-style primitives rather than a remote
  runtime dependency;
- `deployment/docker/frontend.Dockerfile` produces a standalone, non-root
  Node 24 image;
- Terraform defines a public `duka-ENV-web` Cloud Run service with a dedicated
  runtime identity;
- the web server obtains a Google ID token and calls the private API; browsers
  can reach only the narrow same-origin BFF allowlist;
- operational responses are validated with Zod and use `no-store`;
- the current working candidate passes 46 frontend unit tests, 134 backend
  tests with 16 emulator-gated skips, a separate 150/0/0 Firestore-emulator
  run, 29 production browser journeys, one
  isolated bilingual judge journey, and real per-route bundle accounting;
- the standalone frontend image builds as UID/GID `10001:10001` with one
  immutable build/runtime deployment identity.

Therefore “new frontend” means a design-system and experience refinement of
this application. It does **not** mean another repository, a parallel SPA, a
static export, or a rewrite of the working business flows.

### Concepts considered

| Direction | Decision | Reason |
|---|---|---|
| Generic analytics dashboard | Reject | Familiar but interchangeable; it hides the agent’s causal work |
| Full WhatsApp clone | Reject | Overweights one intake channel and weakens ledger, reconciliation, and owner authority |
| Futuristic AI command center | Reject | Visually noisy and culturally generic; encourages unsupported “magic” claims |
| **The Morning Ledger** | **Choose** | Connects the shop’s real artifacts, overnight work, exact books, and owner decisions in one distinctive grammar |

## 3. Design thesis: The Morning Ledger

The interface should feel like a contemporary operating ledger built for a
small shop: warm paper, dark duka green, precise ruled structure, clear numeric
hierarchy, and compact evidence receipts. It should have local specificity
without costume, cliché, or decorative “African” motifs.

### Visual grammar

- **Canvas:** warm off-white with a very quiet ledger grid.
- **Primary surface:** deep duka green for the one most important outcome.
- **Exact:** green, check mark, and explicit “Exact” text.
- **Gemini:** blue, sparkle/brain icon, and explicit “Gemini · bounded” text.
- **Owner:** amber, hand/shield icon, and explicit “Owner” text.
- **Conflict:** red reserved for failed or unsafe states, never ordinary
  ambiguity.
- **Typography:** Geist Sans for prose, Geist Mono/tabular numbers for IDs,
  KSh, counts, duration, and release evidence.
- **Shape:** restrained 12–16 px radii; cards group a decision or proof object,
  not every paragraph.
- **Depth:** borders and tonal contrast before shadow. No floating-glass visual
  language.
- **Motion:** 120–180 ms state transitions only; no ornamental animation and
  full `prefers-reduced-motion` support.

### Content grammar

Lead with owner outcomes, then reveal proof:

- “3 decisions need you” before “3 pending approvals.”
- “The amount was unreadable, so nothing was recorded” before a confidence
  score.
- “Recorded exactly once” before an idempotency ID.
- “Google fixture verified” before provider metadata.
- “No supplier order was placed” wherever a restock proposal is shown.

English remains the primary interface language for judging. Kiswahili appears
as real customer and ledger content with an adjacent English meaning where a
judge could otherwise miss the result. Full application localization is outside
the hackathon cut line.

### Anti-patterns

- no card wall with equal visual weight;
- no chart that merely redraws a headline number;
- no pulsing “AI” ornament;
- no green “proven” state derived from configuration alone;
- no raw trace dump in the primary workflow;
- no optimistic success without a durable receipt;
- no hidden external-effect limitation;
- no dark mode work before the release is evidence-complete.

## 4. Information architecture and judge journey

The existing route map is correct and should remain stable:

| Group | Route | User question |
|---|---|---|
| Today | `/` | What happened overnight, and what needs me? |
| Today | `/approvals` | Why did Duka stop, and what exactly will my decision do? |
| Work | `/inbox` | What did a customer send, and what did the agent actually do? |
| Work | `/ledger` | What did Gemini read, what was recorded, and what was gated? |
| Work | `/orders` | What is the catalog-grounded business record? |
| Work | `/inventory` | What is low, and is there already one safe draft? |
| Operations | `/night-shift` | What ran, what stayed deterministic, and what did it cost? |
| Proof | `/evidence` | Can every important claim be independently verified? |

The signature causal journey is:

```text
Morning Brief
    -> English or Kiswahili voice event
    -> asynchronous worker receipt and grounded order
    -> handwritten ledger image
    -> two exact rows recorded, one unreadable row gated
    -> owner decides one bounded proposal
    -> managed Session rotation and “usual order” recall
    -> Scheduler-triggered 50,000-row night run
    -> release-bound Evidence room
```

Desktop uses the persistent sidebar and top command menu. Mobile keeps the
four-item bottom navigation, but each workspace becomes a focused sequence
rather than a compressed desktop canvas.

## 5. Screen design contracts

### 5.1 Morning Brief — the decisive first frame

Keep the existing green outcome hero and improve it into one “overnight
receipt”:

- night-run state, finish time, and release environment;
- one large exact-settlement number and one plain-language denominator;
- one owner-action module with the only filled CTA;
- a compact Exact → Gemini → Owner authority path;
- four supporting metrics only when they add new information;
- the first decision summarized, with the rest progressively disclosed;
- a concise morning digest and low-stock preview below the primary action.

On mobile, the first viewport must show the product promise, exact result, and
decision CTA. The long list of all decision details should move behind “Review
3 decisions”; the Morning Brief should preview one decision, not duplicate the
full queue.

**Signature moment:** 48,402 rows settled exactly, bounded residue visible, and
three owner decisions—understood without opening a technical panel.

### 5.2 Decisions — the trust screen

Use a queue + inspector composition:

- left: oldest-first review list with risk, age, and retry state;
- right: Observed → Why Duka stopped → Evidence → Exact effect;
- sticky reject/approve action bar;
- a confirmation dialog that repeats the exact effect and non-effect;
- mobile: list first, Sheet inspector second, one decision at a time;
- success, conflict, transient failure, and idempotent replay remain persistent
  enough to understand and verify.

**Signature moment:** the judge can say precisely what approval changes and
what it does not do.

### 5.3 Inbox — the agent in motion

Desktop should read as a three-part workspace:

1. customer rail with search and active work indicator;
2. conversation with sticky multimodal composer;
3. collapsible execution/proof rail for the selected response.

The conversation remains human first. Node path, event ID, model, cost, and
duration belong in an execution receipt, not inside every message bubble.

Voice and photo events must show four truthful stages:

```text
Preparing -> Accepted (202) -> Worker processing -> Persisted reply
```

If the response is uncertain, the same event ID stays visible with a retry
action. Session rotation uses the same recovery pattern and explicitly explains
that old suspended invocations remain resumable.

**Signature moment:** a Kiswahili or English voice note becomes a grounded
catalog order while the event receipt proves the asynchronous path.

### 5.4 Ledger Desk — the multimodal showpiece

Desktop should use a document stage rather than a form-card stack:

- left: the verified Google-generated ledger image at useful size;
- right: frozen truth and observed per-row outcomes aligned by row;
- recorded rows receive exact treatment;
- the unreadable row receives owner treatment and no invented amount;
- a compact comparison summary states `2 recorded · 1 gated` and whether the
  observed result matches frozen truth;
- provider, model, location, hashes, and bytes live in the provenance Sheet.

Mobile uses two explicit tabs—Source and Result—so the image and outcome remain
legible. Do not fake spatial bounding boxes until the model response provides
stable row coordinates.

**Signature moment:** one smudged row does not block the two clean rows, and no
amount is guessed.

### 5.5 Night Shift — bounded autonomy made legible

Present one vertical execution timeline:

1. normalize and deduplicate;
2. exact deterministic reconciliation;
3. bounded Gemini residue proposals;
4. stock scan, persisted report, and morning digest.

Show dataset, unique rows, duplicate drops, exact rate, residue, batches, model
calls, wall time, and measured cost in a single run receipt. Local runs remain
clearly local. Only the real Scheduler/Cloud Run Job artifact can mark the
scheduled step proven.

**Signature moment:** most work completes with zero model calls; Gemini is a
bounded exception handler rather than the entire system.

### 5.6 Orders and Stock — operational truth

Orders should emphasize the persisted catalog truth, not a generic data table:

- filter/search, compact order list, and a detail Sheet;
- current catalog names/prices, integer KSh total, customer, status, event ID,
  and replay status;
- manual-sale failure preserves the same event ID visibly.

Stock should lead with exceptions:

- low items first, reorder arithmetic second, full catalog last;
- one restock draft at a time;
- retry state says the scan cannot create a second pending draft;
- every proposal repeats that no supplier was contacted.

### 5.7 Evidence — the judge proof room

Retain the five-chapter composition:

1. Release identity
2. How Duka acts
3. One causal trace
4. Measured quality
5. Honest boundaries

Add a sticky release strip on wide screens with SHA, web/API agreement,
environment, model, and evidence completeness. Every artifact link must be
allowlisted and tied to the current release. Configuration is “configured,”
not “proven.”

### 5.8 Login and empty/degraded states

The existing login story is strong. Keep the line “The duka slept. Its back
office did not.” Add only release identity and judge-access clarity after the
deployment is frozen.

Empty, loading, stale, unauthorized, unavailable, conflict, retry, and pending-
evidence states use the shared product-state grammar. They must never invent
business values to make a screenshot look complete.

## 6. shadcn/ui strategy

shadcn/ui is the primitive layer; Duka-owned compositions carry the product
identity. Do not install a large component pack or introduce a second styling
system.

### Keep and standardize

- Button, Badge, Card, Separator, Input, Skeleton
- Dialog and Alert Dialog
- Sheet for mobile inspectors and proof
- Sidebar and Tooltip
- Command for keyboard navigation
- Dropdown Menu and Breadcrumb

### Add only when the accepted screen needs it

| Primitive | Intended use |
|---|---|
| `Textarea` | Consistent Inbox composer |
| `Select` | Catalog/customer controls with keyboard behavior |
| `ScrollArea` | Bounded customer, message, and inspector panes |
| `Tabs` | Mobile Ledger Source/Result and only other genuine view switches |
| `Table` | Semantic Orders/Inventory desktop rows; retain card form on mobile |

Do not add charts, resizable panes, a carousel, calendar, or data-table
framework unless a verified user task requires them.

### Duka compositions

- `OutcomeHero`
- `AuthorityRail`
- `DecisionInspector`
- `ExecutionReceipt`
- `OperationRecovery`
- `DocumentStage`
- `FrozenTruthComparison`
- `ProofSheet`
- `ReleaseStrip`
- `EvidenceSource`

Each composition gets a clear state contract, focused unit coverage, and one
entry in the local design-system route.

## 7. Next.js and Cloud Run contract

### Rendering and state

- Server Components fetch initial operational data directly from the private
  API using the web service identity.
- Client Components own browser-only media, filters, dialogs, optimistic
  pending state, polling, and mutation recovery.
- Server Components never call the app’s own BFF.
- Browsers never receive `DUKA_API_URL`, Google credentials, resume handles, or
  unrestricted backend routes.
- All operational reads remain dynamic and `no-store`; immutable static assets
  use Next.js hashed caching.
- Do not introduce Server Actions in this release. The explicit BFF route
  policy is easier to audit and avoids multi-instance action-key concerns.
- Do not introduce ISR or shared application caching. If that decision changes,
  multi-instance cache/tag coordination becomes a release requirement.

### Client-boundary cleanup

The current full-page Client Components are functional but too large for long-
term clarity (`InboxWorkspace` is over 700 lines; Ledger, Decisions, and Night
Shift are also broad). Refactor by product responsibility, not by arbitrary
line count:

- split global Toaster from TanStack Query and mount Query only around routes
  that use it;
- keep route headers and static explanation in Server Components where
  practical;
- isolate composer, recorder, queue, inspector, document upload, result
  comparison, and mutation recovery into client islands;
- co-locate pure presentation logic with focused tests;
- preserve the current Zod response boundary and stable idempotency IDs.

### Standalone image and rolling deployment

- Build `output: "standalone"` with locked Node 24 and pnpm versions.
- Run as UID/GID 10001 on `PORT=8080`.
- Build one immutable web image per Git SHA and promote its digest without
  rebuilding.
- Set Next.js `deploymentId` from the release SHA at build time to protect
  client navigation during Cloud Run revision changes.
- Require web `/health`, dependency-aware `/ready`, and safe `/version`.
- Keep web concurrency conservative for judging and measure before changing it.
- Consider one minimum web instance only for the judging window after cost
  approval.

### Identity and security

- Public internet invokes only `duka-ENV-web`.
- The web runtime service account has only private API invocation and telemetry
  permissions.
- The BFF retains explicit method/path/body/content-type/timeout limits.
- Owner authentication uses a Secure, HttpOnly, SameSite cookie at the web
  origin; cookie presence is only an early navigation hint, while the API
  remains the authority.
- Add and test CSP, frame, referrer, permissions, MIME-sniffing, and transport
  headers before production; do not ship an aspirational CSP that breaks Next
  runtime behavior.
- Trace and request IDs propagate web → API → worker/session/job without raw
  media, phone numbers, passwords, or prompt bodies in logs.

## 8. Work plan

Checkboxes describe the state at baseline `0a9390a`.

### Phase F0 — Accept the visual and architecture contract

**Goal:** prevent a late rewrite and freeze the product grammar.

- [x] **F0-01** Push the verified WIP baseline at `0a9390a`.
- [x] **F0-02** Confirm standalone public Next.js web + private API.
- [ ] **F0-03** Owner accepts The Morning Ledger direction.
- [ ] **F0-04** Freeze English-primary/Kiswahili-content language policy.
- [ ] **F0-05** Freeze the eight-route information architecture and no-new-route
  rule.
- [ ] **F0-06** Record accepted 1440 px and 390 px wireframes before component
  refactoring.

**Milestone F0:** one approved visual contract; no parallel frontend.

### Phase F1 — Design-system and shell hardening

**Goal:** make every route feel like one product and reduce frontend risk.

- [ ] **F1-01** Audit and freeze tokens for canvas, ink, exact, Gemini, owner,
  conflict, typography, spacing, radius, and focus.
- [ ] **F1-02** Add only Textarea, Select, ScrollArea, Tabs, and Table where the
  screen contracts require them.
- [x] **F1-03** Build `OperationRecovery`, `ReleaseStrip`, `DocumentStage`, and
  `FrozenTruthComparison` compositions.
- [x] **F1-04** Split global Query state from the universal provider.
- [ ] **F1-05** Decompose Inbox, Ledger, Decisions, and Night Shift into tested
  feature islands without behavior changes.
- [x] **F1-06** Add `deploymentId`, security headers, and production-header
  browser tests.
- [x] **F1-07** Preserve keyboard command navigation, print composition,
  reduced motion, and mobile safe areas.

**Milestone F1:** stable product grammar and smaller, intentional client
boundaries.

### Phase F2 — Signature owner journey

**Goal:** make Morning Brief and Decisions competition-grade.

- [x] **F2-01** Convert Morning Brief into the final overnight-receipt hierarchy.
- [x] **F2-02** Show only one decision preview on mobile and remove duplicated
  queue content from the brief.
- [x] **F2-03** Add the wide-screen release strip and compact mobile proof entry.
- [x] **F2-04** Finalize queue + inspector + sticky decision actions.
- [x] **F2-05** Verify approve, reject, replay, conflict, resume-failure, expired-
  session, and unauthorized compositions.
- [ ] **F2-06** Measure first-meaning and first-decision time with a second
  operator.

**Milestone F2:** a judge understands value and owner authority in under 30
seconds.

### Phase F3 — Multimodal workspaces

**Goal:** make voice and ledger the most convincing live product proof.

- [ ] **F3-00 APPROVAL** Obtain approval for the bounded Google media generation
  packet before enabling APIs or making billable calls.
- [ ] **F3-01** Generate, review, and freeze English/Kiswahili Google Cloud TTS
  fixtures.
- [ ] **F3-02** Generate, review, and freeze English/Kiswahili Vertex ledger
  images with known ground truth.
- [x] **F3-03** Refine Inbox into customer/conversation/proof regions and keep
  the composer visible.
- [x] **F3-04** Make Accepted → Processing → Persisted visually continuous and
  preserve the same event ID through retry.
- [x] **F3-05** Build the Ledger document stage and mobile Source/Result tabs.
- [x] **F3-06** Compare the observed ledger result with frozen truth without
  inferring from prose.
- [ ] **F3-07** Run both languages through the production paths and accessibility
  tests.

**Milestone F3:** four verified Google-only media assets and two polished live
multimodal journeys.

### Phase F4 — Operational and proof workspaces

**Goal:** make autonomy, business truth, and evidence easy to inspect.

- [x] **F4-01** Finalize the Night Shift four-stage timeline and run receipt.
- [x] **F4-02** Refine Orders and Stock into exception-first master/detail
  workspaces.
- [x] **F4-03** Add causal links from event → order/approval → run/report →
  Evidence.
- [x] **F4-04** Add the release strip and artifact completeness summary to
  Evidence.
- [ ] **F4-05** Attach cloud-safe trace links only after release-bound artifacts
  exist.
- [ ] **F4-06** Capture final 390, 768, 1280, and 1440 px product images from the
  frozen release candidate.

**Milestone F4:** every primary result can be followed to business truth and
release evidence.

### Phase L1 — Local release candidate

**Goal:** eliminate avoidable failures before touching GCP.

- [x] **L1-01** Run lint, typecheck, unit tests, production build, bundle budget,
  base Playwright, judge Playwright, axe, print, and responsive gates.
- [x] **L1-02** Install/use Java 21 and run the Firestore emulator suite with
  zero infrastructure-gated skips.
- [x] **L1-03** Run Terraform validate, actionlint, topology, lock, credential,
  trailer, fixture, and documentation checks.
- [x] **L1-04** Rebuild paired non-root images and prove probes, login, BFF
  allowlist, payload limits, safe errors, and release agreement.
- [x] **L1-05** Measure production-image TTFB, LCP, CLS, and interaction
  latency at release widths.
- [ ] **L1-06** Complete a second-person usability and full Loom-path rehearsal.
- [ ] **L1-07** Freeze one candidate SHA, image digests, topology fingerprint,
  fixture hashes, screenshots, and local evidence bundle.

**Milestone L1:** one reproducible candidate ready for an approved cloud plan.

### Phase C1 — Cloud foundation and CI/CD

**Goal:** deploy the exact candidate through keyless, reproducible delivery.

- [ ] **C1-00 APPROVAL** Review Terraform plans, enabled APIs, IAM, WIF, quotas,
  retention, max instances, secrets, budget alerts, and expected spend.
- [ ] **C1-01** Bootstrap remote state, Artifact Registry, WIF, deployer/runtime
  identities, secrets, and protected context resources.
- [ ] **C1-02** Provision Firestore, Pub/Sub/DLQ, Scheduler, public web, private
  API/worker, nightly/seed Jobs, logging, and tracing.
- [ ] **C1-03** Configure protected GitHub environments and variables; create no
  JSON service-account key.
- [ ] **C1-04** Deploy development from the approved SHA.
- [ ] **C1-05** Prove public web → private API, anonymous API denial, owner auth,
  invoker boundaries, request correlation, and idempotent seed.
- [ ] **C1-06** Promote exact tested digests to production and rehearse rollback
  under five minutes.

**Milestone C1:** hosted public control room with private production-shaped
agent services.

### Phase A1 — Durable Sessions and Memory Bank

**Goal:** demonstrate durable state as product value, not architecture text.

- [ ] **A1-01** Verify one protected context resource per environment backs both
  managed Sessions and Memory Bank.
- [ ] **A1-02** Prove active-session pointers, 90-day TTL, old-session access,
  and per-customer sequencing.
- [ ] **A1-03** Prove refund suspension/resume after scale-to-zero, revision
  change, and session rotation.
- [ ] **A1-04** Prove duplicate/conflicting decisions, transient resume failure,
  and expired-session handling.
- [ ] **A1-05** Prove multilingual “usual order,” current-catalog override,
  changed preference, unknown usual, outage retry, and user isolation.
- [ ] **A1-06** Prove blocked content cannot enter Memory Bank or a later model
  turn.
- [ ] **A1-07** Publish sanitized causal correlation in Evidence.

**Milestone A1:** durable Sessions and Memory visibly survive real runtime
boundaries without gaining authority.

### Phase E1 — Evaluation, benchmark, and evidence lock

**Goal:** bind every score-driving claim to the exact release.

- [ ] **E1-01** Run the locked English/Kiswahili text, voice, and ledger paths.
- [ ] **E1-02** Run the 20-case ADK eval package with repeated critical safety
  trajectories and Gemini judges.
- [ ] **E1-03** Trigger Scheduler → 50,000-row Cloud Run Job and record rows,
  duplicates, exact matches, residue, batches, model calls, tokens, wall time,
  and cost.
- [ ] **E1-04** Capture one complete Cloud Trace causal story.
- [ ] **E1-05** Run IAM denial, replay, isolation, durability, poison, and
  rollback evidence suites.
- [ ] **E1-06** Bind the evidence ledger, release manifest, UI, SHA, image
  digests, revisions, model, locations, execution IDs, and trace IDs.
- [ ] **E1-07** Remove or relabel every claim not proven by the exact release.

**Milestone E1:** evidence-locked production release.

### Phase S1 — Loom and submission

**Goal:** make the winning product effortless to judge.

- [ ] **S1-01** Freeze judge credentials, seeded state, media, Memory, URLs,
  architecture diagram, and recovery procedure.
- [ ] **S1-02** Rewrite `docs/demo-guide.md` against exact screens, actions,
  expected states, evidence IDs, timings, and truthful fallbacks.
- [ ] **S1-03** Rewrite `docs/demo-transcript.md` as word-for-word English Loom
  narration with Kiswahili captions/translations where used.
- [ ] **S1-04** Rehearse three full runs and one second-operator run.
- [ ] **S1-05** Record a 3:45–3:55 Loom at 1080p with one visibly continuous
  action segment.
- [ ] **S1-06** Correct captions for Kiswahili, M-Pesa, ADK, Gemini, Firestore,
  Pub/Sub, Cloud Run, and product names.
- [ ] **S1-07** Verify app and Loom in incognito and on a second network/device.
- [ ] **S1-08** Publish the technical article and social bonus with the required
  hackathon wording and hashtag.
- [ ] **S1-09** Complete Devpost disclosures, links, access instructions, and
  category fields; save the submitted receipt.

**Milestone S1:** accessible, truthful, on-time Grand Prize submission.

## 9. Quality gates

### Product and visual

- first product meaning in ≤10 seconds;
- first owner decision reachable in ≤30 seconds;
- one dominant action per route;
- no placeholder, dead action, invented success, or unsupported external effect;
- 390, 768, 1280, and 1440 px layouts; 200% zoom; mobile safe area;
- zero critical axe violations; keyboard and reduced-motion support;
- printed Evidence and operational receipts remain readable.

### Frontend engineering

- per-route JavaScript gzip ≤153,600 bytes and no unexplained regression;
- hosted LCP ≤2.5 s, CLS ≤0.1, and INP ≤200 ms at the judged path;
- no private URL, credential, Google token, resume handle, or unallowlisted API
  route in browser code or responses;
- mutation identity survives retry, refresh, and lost response;
- web image is non-root, digest-pinned, probeable, and revision-attributed;
- rolling deployment produces no missing assets or incompatible navigation.

### Agent and evidence

- unit tests and ADK evaluations are reported separately;
- 100% of release media is Google-generated, synthetic, bilingual, and hash-
  verified;
- 0 duplicate business effects in retry/concurrency tests;
- 0 cross-user Memory retrievals in the isolation set;
- 0 memory-derived authority or stale catalog prices;
- every release claim has a source, state, release SHA, and required execution
  identity.

## 10. Dependency order and cut line

### Next safe implementation sequence

1. Accept F0 visual and architecture decisions.
2. Produce static wireframes for Morning Brief, Decisions, Inbox, and Ledger.
3. Implement F1 primitives/compositions and client-boundary cleanup.
4. Complete F2 owner journey.
5. Obtain F3-00 approval and freeze Google bilingual media.
6. Complete F3 multimodal workspaces and F4 proof workspaces.
7. Close all L1 local gates and freeze one SHA.
8. Obtain C1-00 approval before any GCP mutation.
9. Deploy development through WIF and prove boundaries.
10. Prove A1 durable Sessions/Memory behavior.
11. Run E1 evaluation, benchmark, security, and trace suites.
12. Promote exact digests, rehearse rollback, and lock evidence.
13. Finalize the Loom guide/transcript, record, publish, and submit.

### Never cut

- Morning → voice → ledger → decision → night → Evidence causal journey;
- durable Session/refund resume and bounded Memory proof;
- public web/private backend architecture;
- English and Kiswahili Google-only media provenance;
- ADK evaluation, cloud benchmark/economics, causal trace, and release identity;
- owner authority, idempotency, accessibility, and truthful non-effect copy.

### Cut before risking the above

- dark mode;
- decorative motion;
- a marketing landing page;
- real WhatsApp, M-Pesa transfer, or supplier integrations;
- WebSockets/SSE when bounded polling proves the flow;
- resizable panes or a universal data-grid abstraction;
- another model solely for a bonus;
- full application localization;
- multi-shop administration or native mobile packaging.

## 11. Four-minute design contract

| Time | Screen | Visible product event | Design purpose |
|---|---|---|---|
| 0:00–0:18 | Morning Brief | Exact overnight compression + 3 decisions | Value before architecture |
| 0:18–0:55 | Inbox | Google voice → 202 → worker → grounded order | Agent action and async truth |
| 0:55–1:25 | Ledger | Google ledger → 2 record / 1 gate | Multimodal risk boundary |
| 1:25–2:08 | Night Shift | Real Scheduler/Job run and bounded counters | Autonomous execution on GCP |
| 2:08–2:38 | Decisions | Inspect and approve one exact internal effect | Human authority is deliberate |
| 2:38–3:10 | Inbox | Rotate Session and recall the usual at current price | Durable memory has utility |
| 3:10–3:43 | Evidence | Release, ADK graph, trace, evals, economics | Claims become independently credible |
| 3:43–3:55 | Morning Brief | Return to compressed outcome | “The duka slept; its back office did not.” |

The final Loom guide and transcript must be generated from the frozen deployed
release, not from this expected sequence.

## 12. Definition of done

This plan is complete only when:

- the accepted frontend is deployed as the public standalone Cloud Run service;
- the API, worker, and Jobs are private and their IAM denials are proven;
- Google-only English/Kiswahili media is frozen and exercised through the
  production paths;
- managed Sessions and Memory Bank pass the durability, isolation, and safety
  matrix;
- the exact release passes local, cloud, browser, accessibility, performance,
  ADK evaluation, benchmark, security, and rollback gates;
- Evidence, Loom, transcript, guide, architecture, economics, and Devpost all
  identify the same SHA, image digests, model, locations, and execution proof;
- the entry is submitted and the receipt is saved.
