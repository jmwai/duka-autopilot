# Duka Autopilot — Grand-Prize Winning Product Plan v4

> Status: active execution plan
> Created: August 27, 2026
> Planning baseline: `ba19196840877ba4c3914f52576c3e9edcb74e84`
> Baseline branch: private `origin/dev`
> GCP project: `my-duka-autopilot`
> Cloud Run application region: `europe-west1`
> Agent Platform location: `global`
> Core category: The Taskmaster
> Frontend: standalone public Next.js Cloud Run service
> Backend: private ADK services, jobs, and managed context on Google Cloud

This plan supersedes `docs/grand-prize-execution-plan-v3.md` as the day-to-day
execution contract. The v3, v2, hackathon, deployment, evidence, and durable
state documents remain the requirements and decision history.

This document does not authorize Google Cloud mutations or deployment. API
activation, Terraform apply, GitHub deployment, and production promotion remain
explicit approval gates.

## 1. Winning outcome

Duka Autopilot will feel like a finished product for one concrete person: the
owner of a busy Kenyan shop who has only a few minutes in the morning.

> **Duka Autopilot is the autonomous night shift for a Kenyan shop. It turns
> English or Kiswahili voice notes, handwritten ledgers, and M-Pesa-like
> exports into reconciled books and a three-minute morning decision queue.**

The product must make three ideas obvious without an architecture explanation:

1. routine, exact work completed autonomously;
2. Gemini interpreted only bounded ambiguity;
3. consequential uncertainty stopped for the owner.

The visible product maxim remains:

> **Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.**

### Grand-prize goals

| Goal | Release outcome |
|---|---|
| Useful | A judge understands the owner problem and first action within 15 seconds |
| Agentic | Live input causes an asynchronous ADK workflow and a real persisted result |
| Disciplined | Deterministic, Gemini, and owner authority are visibly separated |
| Durable | Session rotation, Memory recall, suspension, restart, and replay work across revisions |
| Production-ready | Public web, private backend, Cloud Run Jobs, IAM, WIF, tracing, rollback, and cost bounds are proven |
| Credible | Every number, media artifact, model, location, SHA, digest, and limitation is attributable |
| Memorable | Judges leave with “The duka slept; its back office did not.” |

### Success measures

- First useful meaning in under 10 seconds on a cold navigation.
- First owner decision identifiable in under 15 seconds.
- Primary action visible without scrolling at 390, 768, 1280, and 1440 px.
- Four-minute Loom finishes between 3:45 and 3:55.
- One continuous, visibly unedited Google Cloud action segment.
- Zero ambiguous model decisions directly changing money-adjacent bookkeeping.
- Zero duplicate business effects under delivery or approval replay.
- Zero cross-user memory retrievals in the release suite.
- Zero non-Google generated-media providers in release assets.
- English and Kiswahili voice and ledger paths both pass the release eval.

## 2. Honest baseline at `ba19196`

### What already exists

- Next.js 16, React 19, App Router, Tailwind CSS v4, strict TypeScript, Zod,
  TanStack Query, Recharts, Lucide, and owned shadcn-compatible primitives.
- Standalone non-root frontend container and public web/private API BFF seam.
- Login and owner session handling.
- Working Morning Brief, Decisions, Inbox, Ledger Desk, and Night Shift flows.
- Server Components for authenticated initial reads and Client Components for
  recording, polling, uploads, and mutations.
- Three-lane trust grammar: Exact, Gemini, Owner.
- Durable Session/Memory, Firestore, Pub/Sub, Jobs, Terraform, WIF, and
  observability seams in the wider project.
- Google-only bilingual media schema, generation scripts, integrity verifier,
  prompts, negative-provider tests, and a fail-closed pending manifest.
- The WIP baseline is committed and pushed to private `origin/dev`.

### Current gaps and failures

| Gap | Current fact | Priority |
|---|---|---|
| Ledger refactor | Lint passes; typecheck fails because Ledger Desk still imports removed `LEDGER_FIXTURE` and calls the new truth matcher without its fixture | P0 |
| Frozen media | Release manifest is intentionally `release_ready: false`; no release ledger or voice asset is present | P0 |
| Google APIs | Vertex AI and Cloud Text-to-Speech APIs are disabled; enabling them requires approval | P0 gate |
| Inbox fixtures | Manifest helpers exist but English/Kiswahili voice selection is not wired into the screen | P0 |
| Product completeness | Orders, Stock, and Evidence are placeholder routes | P0/P1 |
| Component system | Only Button, Badge, Card, and Separator are owned UI primitives | P1 |
| Shell | Custom fixed sidebar/mobile bar lacks the full collapse, sheet, tooltip, breadcrumb, and command behavior | P1 |
| Browser QA | No final Playwright, axe, keyboard, zoom, visual-regression, or mobile journey proof | P0 release gate |
| Cloud proof | No approved infrastructure apply, hosted release URL, cloud benchmark, trace, managed-state proof, or production manifest | P0 release gate |
| Submission | Loom guide/transcript contain evidence placeholders; article/social/Devpost are not locked | Final gate |

The next commit must repair the current compilation seam before adding design
scope. Visual work does not begin from a red baseline.

## 3. Frontend product thesis

### 3.1 The product is a morning control room

This is not a chatbot, an “AI dashboard,” or a generic admin template. The app
is the owner’s morning control room: calm when routine work succeeded, urgent
only when a decision is genuinely required, and able to reveal proof on demand.

The first page answers exactly four questions:

1. Did the night shift complete?
2. What did it settle?
3. What needs me now?
4. Why should I trust it?

### 3.2 Signature design concept: the Morning Ledger

The experience blends the clarity of an operations console with the familiarity
of a paper ledger. It should feel grounded in shop work without imitating paper
so heavily that it becomes nostalgic or decorative.

Signature elements:

- a quiet paper-grid canvas and warm ivory surfaces;
- a strong ink-and-shop-green frame;
- compact tabular KSh, duration, row, and evidence values;
- a horizontal “overnight compression” rail;
- three authority lanes used consistently across the product;
- ledger margin marks for recorded and gated rows;
- a reusable proof drawer that reveals execution receipts without crowding the
  owner view;
- a release authenticity strip in Evidence, not infrastructure tiles on every
  screen.

The result should look recognizably like Duka Autopilot even if all logos and
headings are hidden.

### 3.3 The ten-second first impression

The desktop Morning Brief opens with:

- **Night shift complete** plus truthful finish time and environment;
- **48,402 settled exactly** and a live percentage;
- **3 decisions need you** as the dominant action;
- a three-step rail: Exact → Gemini residue → Owner queue;
- a short natural-language morning digest;
- one `Review 3 decisions` button.

Model ID, topology fingerprint, tokens, SHA, trace, and image digests remain one
interaction away in the proof layer. They are evidence, not the owner’s first
sentence.

### 3.4 Trust grammar

| Lane | Meaning | Color and icon | Authority |
|---|---|---|---|
| Exact | Deterministic evidence satisfies invariants | deep green + check/grid | may update internal books |
| Gemini | Bounded interpretation of messy input | Google blue + sparkle/brackets | may extract or propose only |
| Owner | Consequential ambiguity | amber + hand/shield | explicit approve or reject |

Every lane always has a text label and icon; color is never the only signal.
Red is reserved for a real conflict or failed effect, not normal uncertainty.

### 3.5 Progressive proof

Every important object exposes three layers:

1. **Outcome:** what happened in human language.
2. **Reason:** evidence, confidence, and why Duka acted or stopped.
3. **Proof:** graph path, event/request ID, release SHA, tokens, cost, trace, and
   immutable asset source.

Outcome is on the page. Reason expands inline. Proof opens in a right-hand Sheet
on desktop and a bottom Drawer/Sheet on mobile.

## 4. Visual system

### Direction: operational warmth

- Canvas: warm ivory, not clinical white.
- Ink: near-black warm foreground.
- Primary: deep shop green.
- Exact: clear green with sufficient text contrast.
- Gemini: restrained Google blue used only for model-mediated steps.
- Owner: amber used only where attention or authority is required.
- Conflict: red used only for errors, collisions, or destructive risk.
- Cards: fine borders, 12–16 px radii, almost no shadow.
- Texture: paper grid/noise only in the brief hero, ledger surface, and empty
  states.
- Typography: Geist Sans for product copy; Geist Mono and tabular numerals for
  KSh, IDs, SHAs, model names, durations, row counts, and costs.
- Motion: 150–220 ms for state and Sheet transitions; no number-counting,
  pulsing AI glows, or decorative loading theatrics.
- Light mode is the submission baseline. Dark mode is cut unless every P0 gate
  is green.

### Avoid

- generic metric-card walls;
- neon gradients, glowing orbs, glassmorphism, or robot illustrations;
- flags, kitenge patterns, wildlife, or other decorative regional clichés;
- model/service logos as navigation;
- “AI confidence” meters without a defined decision boundary;
- vanity charts that are slower to understand than one sentence;
- success copy that outruns the backend effect.

### Layout rhythm

- Main width: 1440–1536 px maximum for operational screens.
- Reading width: 720–800 px for explanations and evidence narratives.
- Page spacing: 24 px mobile, 32 px desktop; dense tables may use 16–20 px.
- Primary controls: minimum 44 px hit target.
- Metric values: tabular, aligned, and never abbreviated when exactness matters.
- Dense IDs: truncated visually with copy action and full accessible label.

## 5. Information architecture

Navigation is grouped by owner intent.

| Group | Route | Primary job |
|---|---|---|
| Today | `/` | Understand the overnight result and next action |
| Today | `/approvals` | Resolve what Duka refused to decide alone |
| Work | `/inbox` | Receive text, voice, and photo events |
| Work | `/ledger` | Turn ledger images into recorded and gated rows |
| Work | `/orders` | Find grounded orders and record a catalog-derived sale |
| Work | `/inventory` | See low-stock evidence and review restock proposals |
| Operations | `/night-shift` | Inspect the exact/Gemini/owner pipeline and run receipt |
| Proof | `/evidence` | Verify release identity, cloud architecture, evals, cost, and limitations |

### Desktop shell

- Owned shadcn `SidebarProvider`, `Sidebar`, `SidebarInset`, and
  `SidebarTrigger`.
- Sidebar groups: Today, Work, Operations, Proof.
- Icon-collapse mode with tooltips and persisted preference.
- Sticky top bar with breadcrumb, command/search trigger, connection state,
  environment, and owner menu.
- No duplicate slogan in both sidebar and top bar.
- Page content begins with a compact page header and one clear action.

### Mobile shell

- Fixed bottom navigation: Brief, Decisions, Inbox, More.
- `More` opens a shadcn Sheet containing Ledger, Orders, Stock, Night Shift,
  Evidence, environment, and sign out.
- Detail/proof surfaces become bottom or full-height Sheets.
- Tables become semantic record cards for the main journey.
- Recording, upload, approve, reject, and retry controls remain thumb-sized.

### Command palette

Use shadcn `Command` for navigation and read-only object lookup:

- `Go to Decisions`, `Open Ledger Desk`, `Show latest night run`;
- find order/customer by safe display value;
- keyboard shortcut on desktop;
- no hidden destructive actions in the command palette.

## 6. Screen contracts

### 6.1 Morning Brief

**Composition**

1. Night-status hero with one owner CTA.
2. Overnight compression rail: received → exact → Gemini residue → decisions.
3. Four concise outcomes: exact settled, decisions, paid orders, paid revenue.
4. Top decision stack with risk/effect preview.
5. Morning digest and actionable low-stock note.
6. Small synthetic-environment and external-effect disclosure.

**Design rule:** owner value first; model and deployment metadata move to Proof.

### 6.2 Decisions

Use a queue-and-inspector design instead of a wide audit table:

- left: compact queue with kind, amount/object, reason, expiry, and risk;
- right: selected item with observation, evidence, exact proposed effect, and
  what will not happen;
- sticky action dock with Reject and Approve;
- mobile: queue cards, then full-height inspector Sheet;
- `AlertDialog` repeats the exact effect before mutation;
- stable states for retrying, duplicate, conflict, expired session, failed
  resume, and completed receipt;
- no internal session, invocation, interrupt, or customer-key leakage.

### 6.3 Customer Inbox

Desktop uses three purposeful zones:

1. customer rail with search and unread/processing state;
2. conversation with queued → processing → completed/suspended/failed receipts;
3. collapsible execution/proof rail for selected event.

The composer supports text, image, upload, and start/stop recording. A `Try a
verified example` popover offers English and Kiswahili Google-generated voice
fixtures with transcript, English translation, duration, provider/model, and
hash. The normal owner composer remains visually primary.

### 6.4 Ledger Desk

This should be the most tactile screen:

- left: large ledger preview on a subtle paper surface;
- right: processing state, expected fixture truth, observed extraction, and
  final recorded/gated results;
- language tabs: English, Kiswahili, Owner upload;
- margin markers connect image row positions to result rows when bounding data
  is trustworthy; otherwise do not fake coordinates;
- `Recorded automatically` and `Needs owner` remain separate columns/sections;
- provenance lives in a compact `Evidence source` disclosure;
- unreadable values visibly remain blank.

### 6.5 Night Shift

- top: truthful status, finish time, next scheduled time, environment;
- compression visualization with exact counts and text equivalent;
- three authority stages with counts, duration, hard bounds, and stop reason;
- observed run is visually separate from the historical local synthetic
  baseline;
- run receipt includes surface, release, digest, trace, tokens, model calls,
  and measured cost;
- app cannot pretend that clicking a local button is Scheduler evidence.

Use Recharts only if an accessible compression chart is faster to understand
than a three-stage bar. Always enable the accessibility layer and include exact
text values.

### 6.6 Orders

- screen-specific TanStack/shadcn table; no universal data-grid abstraction;
- search, status filter, sort, pagination, and detail Sheet;
- catalog-derived manual sale with current server price and positive quantity;
- order links to its source event and execution receipt;
- integers remain integers through the KSh formatter;
- mobile uses stacked cards and detail Sheet.

### 6.7 Stock

- actionable low-stock items first, full catalog second;
- level, threshold, recent demand evidence, suggested quantity, and proposal
  status;
- restock action creates/approves an internal proposal or outbox record only;
- never claim a supplier order was placed without a real integration;
- evidence Sheet explains why the item was suggested.

### 6.8 Evidence

Evidence is the judge-facing proof room and the app’s credibility center:

- release SHA, web/API/worker/job digests, Cloud Run revisions, model and
  locations, topology fingerprint;
- public/private topology with current status;
- ADK graph and exact/Gemini/owner boundaries;
- unit, emulator, ADK eval, multilingual, durability, IAM, benchmark,
  economics, and rollback evidence;
- one trace story from input to effect;
- fixture provenance with provider/model, language, prompt/transcript hashes,
  and synthetic status;
- pre-existing-work and synthetic-data disclosures;
- explicit limitations: no external M-Pesa transfer and no supplier placement.

Evidence reads a sanitized release-manifest API. Missing evidence renders
`Pending` or `Not proven`; it never renders hardcoded green success.

## 7. shadcn/ui composition plan

shadcn supplies accessible, owned primitives; Duka supplies composition,
tokens, language, and state contracts.

### Foundation primitives to add

- Sidebar, Sheet, Drawer, Breadcrumb, Tooltip, ScrollArea, Separator.
- DropdownMenu, Command, Tabs, Popover, Collapsible.
- Input, Textarea, Label, Select, Checkbox, RadioGroup, ToggleGroup.
- Dialog and AlertDialog for exact-effect confirmation.
- Table, Pagination, Skeleton, Progress, Sonner.
- Resizable only for Inbox/Ledger desktop if keyboard and responsive behavior
  are acceptable; otherwise use fixed CSS grids.
- Chart only for the single overnight-compression visualization.

### Duka-owned compositions

- `TrustBadge`
- `AuthorityRail`
- `ExecutionReceipt`
- `ProofSheet`
- `EvidenceSource`
- `EnvironmentBadge`
- `ReleaseStamp`
- `Metric`
- `KshValue`
- `StatusTimeline`
- `DecisionInspector`
- `MediaFixturePicker`
- `LedgerResultRow`
- `EmptyState`, `PendingState`, `FailureState`, `DegradedBanner`

Do not wrap every shadcn primitive. Create Duka compositions only where business
meaning or repeated interaction exists.

## 8. Next.js and standalone Cloud Run architecture

### Rendering boundary

- Pages and initial authenticated reads remain Server Components.
- Server Components call the private API directly through the server-only
  client; they do not call the frontend’s own Route Handler.
- Client Components are limited to recorder/upload, polling, filters, charts,
  dialogs, Sheets, and mutations.
- Browser mutations and polling use the allowlisted BFF route.
- Zod validates every API and media-manifest boundary.
- Operational data is `no-store`; immutable hashed media assets are cached.
- `loading.tsx` and localized Suspense boundaries provide meaningful skeletons.
- Expected failures are rendered as typed states; unexpected failures reach
  route/global error boundaries with safe request IDs.
- Defer heavy client-only chart/media modules until their screen or disclosure
  is opened.

### Service boundary

```text
Judge browser
  -> public duka-prod-web (Next.js on Cloud Run)
       -> owner session + allowlisted BFF
            -> Google-signed ID token
                 -> private duka-prod-api
                      -> Firestore / Pub/Sub / Vertex / managed context

Pub/Sub authenticated push -> private worker
Scheduler OIDC -> private Cloud Run Jobs
```

- Only the web service is public.
- Browser code never receives a private API URL or service identity token.
- FastAPI remains the authoritative business and authorization boundary.
- Frontend service account receives only private API invocation and trace-write
  permissions.
- The frontend image uses frozen pnpm, Next standalone output, Node 24,
  non-root UID/GID 10001, `PORT=8080`, health/readiness, and release labels.
- Development deploys from `dev`; production promotes the exact tested image
  digest through protected manual approval.

## 9. Execution phases

### Phase 0 — Repair and re-baseline

**Goal:** return the current pushed WIP to a green, truthful local baseline.

- [ ] **R0-01** Refactor Ledger Desk to consume `DemoLedgerFixture` from the v2
  manifest; remove the deleted hardcoded fixture import and local hash helper.
- [ ] **R0-02** Render a truthful fixture-pending state when
  `release_ready=false`; never offer a missing file.
- [ ] **R0-03** Wire English/Kiswahili manifest ledgers, dimensions, ground
  truth, provider/model/location, and integrity verification into Ledger Desk.
- [ ] **R0-04** Wire English/Kiswahili voice fixtures, transcripts,
  translations, provider/model, and verification into Inbox.
- [ ] **R0-05** Add component and contract tests for pending, valid, wrong hash,
  wrong provider, missing language, and failed fetch states.
- [ ] **R0-06** Run lint, typecheck, Vitest, webpack production build, full
  Python suite, fixture verifier/quarantine, and source provenance scan.
- [ ] **R0-07** Commit the repaired local baseline; do not activate APIs or
  generate cloud assets without approval.

**Exit:** all local gates green; no missing asset is clickable; both screens are
manifest-driven; release remains truthfully pending.

### Phase 1 — Product shell and design system

**Goal:** establish the visual and interaction grammar before completing pages.

- [ ] **F1-01** Finalize semantic OKLCH tokens for canvas, surface, ink, exact,
  Gemini, owner, conflict, focus, charts, sidebar, and muted states.
- [ ] **F1-02** Add the selected shadcn primitives with pinned dependencies and
  owned source.
- [ ] **F1-03** Build grouped collapsible Sidebar, mobile More Sheet, sticky top
  bar, breadcrumbs, account menu, and command palette.
- [ ] **F1-04** Build the Duka-owned trust, metric, proof, release, timeline,
  empty, pending, failed, and degraded compositions.
- [ ] **F1-05** Create shared page skeletons and route-level expected/unexpected
  error states.
- [ ] **F1-06** Add a local component gallery route available only in
  development/test for state and accessibility QA.
- [ ] **F1-07** Capture 390/768/1280/1440 shell screenshots and pass keyboard,
  focus, 200% zoom, reduced-motion, contrast, and axe checks.

**Exit:** one coherent shell and trust grammar; no visual component relies on
color alone; no page must invent its own error/proof pattern.

### Phase 2 — Demo-critical journey

**Goal:** make the four-minute causal story delightful and deterministic.

- [ ] **F2-01** Redesign Morning Brief around status, compression, one CTA,
  digest, and top owner decisions.
- [ ] **F2-02** Convert Decisions to queue + inspector + exact-effect
  AlertDialog with durable replay/conflict states.
- [ ] **F2-03** Apply three-zone Inbox, verified bilingual examples, event
  lifecycle, and Proof Sheet.
- [ ] **F2-04** Apply bilingual tactile Ledger Desk, expected/observed
  separation, and recorded/gated visual split.
- [ ] **F2-05** Apply observed-run-first Night Shift with accessible compression,
  bounds, run receipt, and honest local/cloud distinction.
- [ ] **F2-06** Add a deterministic local seed/reset contract for rehearsal;
  no hidden database edits.
- [ ] **F2-07** Add Playwright journeys for voice, ledger, decision, night run,
  failed network, retry, duplicate, and unauthorized states.

**Exit:** the primary Loom journey rehearses locally from a reset state with no
developer console, manual data edit, or unsupported claim.

### Phase 3 — Complete the product

**Goal:** remove every placeholder and make navigation feel intentional.

- [ ] **F3-01** Build Orders contracts, screen-specific table, filters, detail
  Sheet, and catalog-derived manual sale.
- [ ] **F3-02** Build Stock summary, low-stock evidence, proposal flow, and
  truthful supplier boundary.
- [ ] **F3-03** Build Evidence from sanitized live/release artifacts with
  fail-closed statuses.
- [ ] **F3-04** Add safe correlation links across messages, ledger rows, orders,
  decisions, nightly reports, and evidence.
- [ ] **F3-05** Remove placeholder component and dead frontend paths.
- [ ] **F3-06** Complete loading, empty, stale, degraded, unauthorized, mobile,
  and print/share states for every route.

**Exit:** every navigation route is useful and truthful; Evidence cannot claim
an artifact that is absent.

### Phase 4 — Google-only bilingual release assets

**Goal:** freeze the exact media used in tests, UI, cloud evals, and Loom.

- [ ] **A4-00 APPROVAL** Review APIs, models, regions, scripts, expected calls,
  quotas, and spend with the user.
- [ ] **A4-01** Enable only approved Vertex AI and Cloud Text-to-Speech APIs.
- [ ] **A4-02** Generate English/Kiswahili ledger candidates with the declared
  Google Vertex image model; human-review text and layout.
- [ ] **A4-03** Generate English/Kiswahili Google TTS fixtures and optionally
  record consented first-party human voice fixtures.
- [ ] **A4-04** Run all candidates through the production Gemini extraction
  path; freeze only assets with exact reviewed truth.
- [ ] **A4-05** Record hashes, bytes, dimensions/duration, model, provider,
  project, location, timestamp, prompt/transcript hash, language, synthetic
  status, and truth in manifest v2.
- [ ] **A4-06** Set `release_ready=true` only when all four required variants
  pass verifier, UI, backend, and eval tests.

**Exit:** checked-in, hash-verified, bilingual, Google-only release assets with
no unknown provenance.

### Phase 5 — Local release candidate

**Goal:** prove the exact code and images before cloud apply.

- [ ] **Q5-01** Run lint, strict typecheck, Vitest, production build, bundle
  inspection, and standalone-container smoke.
- [ ] **Q5-02** Run Playwright + axe for all critical desktop/mobile journeys.
- [ ] **Q5-03** Run complete Python, Firestore emulator, topology, lock,
  Terraform validate, actionlint, credential, commit-trailer, fixture, and docs
  link checks.
- [ ] **Q5-04** Verify web container as 10001:10001 and health, readiness, login,
  BFF allowlist, caching, media limits, and safe errors.
- [ ] **Q5-05** Measure Core Web Vitals and bundle budgets on the production
  image; fix avoidable client-boundary and waterfall costs.
- [ ] **Q5-06** Run second-person usability rehearsal and record time to first
  meaning, decision, voice result, ledger result, and recovery.

**Exit:** one green SHA, reproducible evidence bundle, tested image digests, and
no known local defect deferred to cloud.

### Phase 6 — Approved Cloud Run and managed-state proof

**Goal:** prove the real production-shaped Google Cloud system.

- [ ] **C6-00 APPROVAL** Review Terraform plan, APIs, IAM, WIF, resource names,
  quotas, budget, max instances, retention, and expected judging-window spend.
- [ ] **C6-01** Bootstrap state, Artifact Registry, WIF, identities, secrets,
  budget/limits, and protected context resource.
- [ ] **C6-02** Provision named Firestore, Pub/Sub/DLQ, Scheduler, public web,
  private API/worker, Jobs, observability, and Agent Platform context.
- [ ] **C6-03** Configure durable Session pointer, 90-day Session TTL, approval
  state machine, per-customer sequencing, Memory outbox, allowlisted summaries,
  multilingual embedding, and custom Memory topic.
- [ ] **C6-04** Deploy the exact local SHA from private GitHub Actions using WIF;
  no service-account JSON key.
- [ ] **C6-05** Prove public web → private API, anonymous denial, owner auth,
  Pub/Sub/Scheduler invoker boundaries, and idempotent seed.
- [ ] **C6-06** Prove restart, scale-to-zero, revision continuity, Session
  rotation, approval replay/conflict/retry, and Memory isolation/poisoning cases.
- [ ] **C6-07** Promote exact tested digests through protected production and
  drill rollback under five minutes.

**Exit:** public hosted frontend, private backend, durable context, IAM proof,
and release identity tied to exact digests.

### Phase 7 — Evaluation, economics, and evidence lock

**Goal:** make every score-driving claim independently verifiable.

- [ ] **E7-01** Run English/Kiswahili text, voice, and ledger journeys against
  the locked release.
- [ ] **E7-02** Run 20+ ADK evals with repeated critical safety trajectories.
- [ ] **E7-03** Trigger Scheduler → 50,000-row Cloud Run Job and capture exact,
  duplicates, residue, proposals, wall time, tokens, model calls, and cost.
- [ ] **E7-04** Capture Cloud Trace from request → event → session → invocation
  → decision → resume/effect.
- [ ] **E7-05** Publish sanitized durability, isolation, IAM, benchmark,
  economics, eval, rollback, and provenance artifacts through Evidence.
- [ ] **E7-06** Bind evidence ledger, release manifest, app version, image
  digests, revisions, and Git SHA; remove any unproven claim.

**Exit:** every claim used in Loom is `CLOUD-PROVEN`, release-bound, and visible
in Evidence—or omitted.

### Phase 8 — Loom and submission

**Goal:** make the complete product effortless to judge.

- [ ] **D8-01** Freeze demo account/data, bilingual assets, managed Memory,
  release manifest, architecture diagram, URLs, and recovery script.
- [ ] **D8-02** Write the final four-minute guide and word-for-word English
  transcript with screen action, expected state, proof ID, timing, and fallback
  for each beat.
- [ ] **D8-03** Rehearse three end-to-end takes and one second-operator take.
- [ ] **D8-04** Record Loom at 1080p with English narration/captions and one
  unedited cloud execution segment.
- [ ] **D8-05** Correct captions for Kiswahili, M-Pesa, ADK, Firestore, Pub/Sub,
  model names, and product names.
- [ ] **D8-06** Verify app and Loom in incognito and on a second network/device.
- [ ] **D8-07** Publish hackathon article and social post with required wording
  and hashtag.
- [ ] **D8-08** Complete Devpost model/services, architecture, repo access,
  pre-existing-work, synthetic-data, URL, video, and category disclosures.
- [ ] **D8-09** Submit before the internal deadline and save the receipt.

**Exit:** stable hosted product, accessible Loom, matching evidence, and saved
submission receipt.

## 10. Milestones and dependency chain

| Milestone | Definition |
|---|---|
| M0 — Green re-baseline | Ledger migration and bilingual fixture UI compile; all local suites pass |
| M1 — Design system | New shell, trust/proof grammar, responsive/accessibility baseline |
| M2 — Demo journey | Brief → event → ledger → decision → night shift rehearses locally |
| M3 — Product complete | Orders, Stock, Evidence live; zero placeholders |
| M4 — Asset freeze | Four verified Google-only bilingual media assets |
| M5 — Local RC | One SHA/digest set passes all local/container/browser gates |
| M6 — Cloud proven | Hosted web/private backend, managed durability, IAM, WIF, rollback |
| M7 — Evidence locked | Evals, 50k benchmark, economics, traces, release manifest |
| M8 — Submitted | Final Loom/transcript/guide, Devpost, article/social, receipt |

Critical path:

```text
Repair red baseline
  -> shell + trust/proof system
    -> core journey
      -> complete routes
        -> approved Google media freeze
          -> local release candidate
            -> approved cloud deployment
              -> cloud evals + benchmark + evidence
                -> Loom + submission
```

Orders and Stock may be developed after the shared shell in parallel with core
screen polish only if API contracts do not change. Durable state, deployment,
release manifest, and evidence remain serialized.

## 11. Four-minute Loom design contract

| Time | Product beat | Visible action | Judge takeaway |
|---|---|---|---|
| 0:00–0:18 | Morning Brief | Show night complete, exact compression, three decisions | Immediate practical owner value |
| 0:18–0:55 | Inbox | Send verified English voice, show `202`, processing, grounded result and receipt | Messy input causes asynchronous action |
| 0:55–1:25 | Ledger Desk | Run English ledger; two rows record, one remains gated; show Kiswahili tab | Multimodal, bilingual, risk-aware |
| 1:25–2:10 | Night Shift | Start real Scheduler/Job path and show an unedited cloud segment | Real action on Google Cloud |
| 2:10–2:40 | Decisions | Inspect why Duka stopped; approve one exact internal effect | Human authority is deliberate |
| 2:40–3:12 | Inbox/Memory | Rotate Session and recall a grounded usual order at current catalog price | Durable context has practical value |
| 3:12–3:43 | Evidence | Show ADK graph, public/private topology, SHA/digests, evals, trace, 50k economics | Architecture and readiness are proven |
| 3:43–3:55 | Morning Brief | Return to the compressed outcome and closing line | Memorable finish |

The transcript and operator guide are produced from the final release evidence,
not written as aspirational success copy. Every beat includes a fallback that
remains truthful if a network-dependent step is slow.

## 12. Release gates

### Product and design

- No placeholder route, dead action, missing fixture, or unsupported success.
- One visually dominant action per screen.
- Exact/Gemini/Owner grammar is consistent and never color-only.
- English primary judging path and verified Kiswahili equivalent.
- Every route has live, empty, loading, stale, degraded, unauthorized, failed,
  mobile, and keyboard-accessible behavior.
- Zero critical axe violations; contrast and 200% zoom pass.

### Engineering

- Lint, strict typecheck, unit, contract, integration, browser, build, container,
  topology, infrastructure, and documentation gates pass at one SHA.
- Server/Client boundaries are intentional; no avoidable frontend-to-self BFF
  call from Server Components.
- Operational reads are uncached; immutable hashed assets cache safely.
- No secret, service token, private API URL, or durable resume handle reaches
  the browser or logs.

### Safety and durability

- Catalog identity and price are server-derived; invalid quantity/user fails
  closed.
- Inbound events, memory ingestion, approval decisions, resume, and outbox
  effects are idempotent.
- Managed Sessions persist across restarts and scale; Firestore stores the
  active-session pointer and approval state.
- Memory is allowlisted advisory context and cannot authorize money-adjacent
  action.
- Blocked instructions do not survive into later model history or Memory.

### Cloud and evidence

- Only web is public; API, worker, and Jobs deny anonymous invocation.
- GitHub uses WIF; production promotes exact tested digests after approval.
- App version, manifest, SHA, digests, revisions, Evidence, Loom, and Devpost
  agree.
- Benchmark records dataset, seed, model, location, release, calls, tokens,
  Firestore operations, time, and cost.
- ADK eval evidence is distinct from unit tests.
- Synthetic media/data and pre-existing work are disclosed.

## 13. Ruthless cut line

### Never cut

1. Green baseline and truthful fixture states.
2. Morning → voice → ledger → decision → night causal journey.
3. Durable Sessions/Memory and idempotency proof.
4. Public Next.js/private backend Cloud Run proof.
5. English and Kiswahili Google-only media provenance.
6. Cloud eval, 50k benchmark/economics, Evidence, and Loom attribution.

### Cut before risking the above

- dark mode and themes;
- animation beyond functional transitions;
- marketing landing page;
- real WhatsApp Business, M-Pesa transfer, or supplier-order integration;
- SSE/WebSockets when bounded polling works;
- universal data table or generic component framework;
- another model only for a bonus;
- a second chart;
- mobile-native app packaging;
- multi-shop administration;
- Gemini Enterprise breadth beyond the managed context behavior we prove.

## 14. Immediate next sequence

1. Fix Ledger Desk’s manifest migration and restore green frontend gates.
2. Complete bilingual fixture wiring and fail-closed tests in Inbox/Ledger.
3. Freeze the design tokens and install the minimum shadcn primitive set.
4. Build the new responsive shell and proof Sheet.
5. Redesign Morning Brief and Decisions first.
6. Polish Inbox, Ledger Desk, and Night Shift around the Loom path.
7. Build Orders, Stock, and Evidence; remove placeholders.
8. Reach the local release candidate.
9. Ask for approval before Google API activation or any cloud mutation.
10. Generate/freeze media, deploy through WIF, prove durability/evals/economics,
    then write and record the final Loom guide/transcript.

## 15. Official implementation basis

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js data fetching and streaming](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/aria/sidebar)
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/aria/sheet)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/aria/data-table)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Google Cloud Next.js on Cloud Run](https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service)
