# Duka Autopilot — Product, Frontend, and Grand-Prize Release Plan v5

> Status: active plan for all remaining work  
> Created: August 27, 2026  
> Planning baseline: `494291a` (`feat: harden control room evidence flow`)  
> Baseline branch: private `origin/dev`  
> GCP project: `agent-platform-503913` (`183775788663`)
> Cloud Run application region: `europe-west1`  
> Vertex AI and Agent Platform location: `global`  
> Core category: The Taskmaster  
> Frontend: standalone public Next.js Cloud Run service  
> Backend: private ADK API, worker, Jobs, and managed context

This document supersedes `docs/grand-prize-winning-product-plan-v4.md` as the
day-to-day execution plan. Earlier plans remain the decision history and the
source for detailed acceptance scenarios. `DESIGN_SPEC.md` remains the product
contract if any plan language conflicts with implementation requirements.

This plan does not authorize a Google Cloud mutation or deployment. API
activation, media-generation calls, Terraform apply, GitHub deployment, and
production promotion remain explicit approval gates.

## 1. Executive outcome

Duka Autopilot should win by feeling like a complete operational product, not
an agent framework demo.

> **Duka Autopilot is the autonomous night shift for a Kenyan shop. It turns
> English or Kiswahili voice notes, handwritten ledger pages, and M-Pesa-like
> exports into reconciled books and a three-minute morning decision queue.**

The owner-facing product must communicate one rule at every level:

> **Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.**

The winning four-minute story is one causal journey:

```text
messy customer input
  -> immediate durable receipt
    -> asynchronous ADK workflow
      -> grounded business result
        -> exact overnight settlement
          -> bounded Gemini residue
            -> owner decision only where consequences matter
              -> a short, trustworthy morning brief
```

### Grand-prize goals

| Goal | Release outcome |
|---|---|
| Immediate value | A judge understands the shop problem and owner action in 10–15 seconds |
| Real agency | A live multimodal event causes an asynchronous ADK workflow and persisted result |
| Architectural discipline | Exact, Gemini, and Owner authority are visible and technically enforced |
| Durable behavior | Sessions, Memory, replay, suspension, and resume survive restart and revision |
| Product quality | The public control room is polished, responsive, accessible, and coherent |
| Production credibility | Cloud Run, IAM, WIF, Firestore, Pub/Sub, Scheduler, traces, and rollback are proven |
| Evidence integrity | Every number, model, asset, cost, trace, SHA, digest, and limitation is attributable |
| Memorability | Judges leave with: “The duka slept; its back office did not.” |

### Quantitative success measures

- One dominant owner action above the fold at 390, 768, 1280, and 1440 px.
- A meaningful seeded Morning Brief in under 10 seconds from login.
- LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below
  0.1 in the judging deployment lab.
- Zero critical accessibility violations and no horizontal overflow at 200%
  zoom.
- Zero duplicate business effects under inbound replay or approval replay.
- Zero cross-user Memory retrievals in the release isolation suite.
- Zero non-Google generated-media assets in the release manifest.
- English and Kiswahili voice and ledger paths both pass the locked release
  tests and ADK evaluations.
- Loom duration between 3:45 and 3:55 with one visibly continuous cloud action
  segment.

## 2. Honest baseline at `494291a`

### Complete and pushed

- [x] Private `dev` branch is synchronized with `origin/dev` at `494291a`.
- [x] Next.js 16.3.3, React 19.2.8, App Router, strict TypeScript, Tailwind CSS
  v4, shadcn-compatible owned components, Zod, TanStack Query, and Recharts.
- [x] Standalone non-root frontend container and public web/private API BFF
  architecture.
- [x] Eight owner routes: Morning Brief, Decisions, Inbox, Ledger Desk, Orders,
  Stock, Night Shift, and Evidence.
- [x] Login, owner session, authenticated reads, allowlisted browser mutations,
  and server-only Google identity-token acquisition.
- [x] Exact/Gemini/Owner trust grammar, progressive proof Sheet, responsive
  navigation, command palette, print mode, loading/error states, and local
  component gallery.
- [x] Safe correlation from completed Inbox receipt to the authenticated
  persisted order and from recorded ledger rows to orders.
- [x] 33 frontend contract tests and 19 production-browser Playwright journeys.
- [x] Local route-level axe scans, keyboard/focus, reduced-motion, responsive,
  print, bundle, and performance-lab coverage.
- [x] Recorded full Python result of 115 passed and 13 infrastructure-gated
  skips; the latest WIP-focused run passed all 35 selected tests.
- [x] Python evaluation dependencies no longer pull a broad multi-provider
  evaluation extra; rubric evaluation remains configured for Gemini.
- [x] Durable Sessions/Memory, Firestore, Pub/Sub, Jobs, Terraform, WIF,
  observability, seed, evaluation, and evidence seams exist in the wider repo.

### Still pending

| Workstream | Current fact | Priority |
|---|---|---|
| Judge-ready product state | Current screenshots prove layout but the local brief is mostly empty; the winning seeded state is not yet frozen | P0 |
| Frontend refinement | Strong foundation exists; some routes still need tighter hierarchy, mobile density, stale/degraded mutation states, and final proof links | P0/P1 |
| Bilingual media | Release manifest remains intentionally pending; four Google-generated English/Kiswahili fixtures are not frozen | P0 approval gate |
| Local RC | Full Java 21 emulator parity, Terraform/action validation, paired-container smoke, and second-person usability remain | P0 |
| Cloud infrastructure | No approved Terraform apply, public URL, WIF deployment, or hosted runtime proof exists | P0 approval gate |
| Managed-state proof | Sessions/Memory implementation exists but restart, revision, isolation, poison, and replay evidence is not cloud-proven | P0 |
| Evals and economics | Final ADK evaluation result, 50,000-row cloud Job, trace, and model-cost evidence are absent | P0 |
| Loom package | Guide and transcript are drafts with evidence placeholders | Final gate |
| Submission | Article, social post, Devpost copy, access decision, and receipt remain | Final gate |

## 3. Frontend decision: refine, do not rewrite

The standalone frontend is already the correct decision. It gives Duka:

- a public, judge-friendly product URL while the agent backend remains private;
- server-side access to a Google-authenticated private API;
- independent Cloud Run scaling, health checks, release labels, and rollback;
- a proper product experience instead of exposing FastAPI or an ADK playground;
- Server Components for fast authenticated reads and small client islands for
  recording, uploads, polling, filters, dialogs, and charts.

The next frontend phase is not “build a new dashboard.” It is a deliberate
design refinement of the existing control room. Rewriting would add risk and
erase working accessibility, test, security, and evidence seams.

### What is already visually strong

- The deep shop-green frame and warm ivory ledger canvas are distinctive.
- Geist Sans/Mono and tabular values make money, counts, IDs, and evidence easy
  to scan.
- The Exact/Gemini/Owner rail is a strong signature visual and architectural
  explanation.
- The desktop sidebar feels operational rather than promotional.
- Progressive proof keeps technical evidence available without making the
  owner read a trace dashboard.
- The mobile bottom navigation preserves the four most important destinations.

### What should improve

- The release must open with meaningful seeded data; an empty “0 settled” hero
  is honest locally but not the winning judge experience.
- On mobile, the Morning Brief is too vertically long. Compress the hero,
  authority rail, and outcome metrics while preserving exact values.
- Avoid duplicated actions such as “View decisions,” “Review queue,” and “Open
  decision queue” competing on the same first screen.
- Give every route a single unmistakable page job and one dominant action.
- Make state transitions feel continuous: queued, processing, completed,
  suspended, retryable, conflict, and stale must preserve the same object and
  correlation identity.
- Evidence must feel like a designed proof room, not a collection of green
  infrastructure cards.
- The desktop experience should become slightly denser on operational screens;
  mobile should become more compressed, not merely stacked desktop cards.

## 4. Product design thesis: the Morning Ledger

The design language combines a calm operations console with the familiarity of
a shop ledger. It should feel specific to Duka without turning Kenyan context
into decoration.

### Signature composition

1. **Morning state:** a compact, authoritative overnight outcome.
2. **Compression rail:** received → exact → Gemini residue → owner queue.
3. **Decision focus:** the first consequential item and its exact internal
   effect.
4. **Progressive proof:** Outcome → Reason → Proof.
5. **Ledger texture:** subtle grid, margin marks, and tabular numerals only where
   they support work.

### Visual grammar

| Role | Treatment | Meaning |
|---|---|---|
| Canvas | warm ivory with restrained grid | familiar working surface |
| Frame | deep shop green | calm operational shell |
| Exact | green + check/grid icon + text | deterministic evidence may update internal books |
| Gemini | Google blue + sparkle/brackets + text | model may extract or propose within bounds |
| Owner | amber + hand/shield + text | explicit human authority is required |
| Conflict | red used sparingly | failed effect, collision, expired state, or destructive risk |
| Proof | mono values, fine rules, low-emphasis surface | release and execution attribution |

Rules:

- Never rely on color alone.
- Use one restrained shadow level and 12–16 px radii.
- Use motion only for state continuity, Sheet/Drawer transitions, and feedback;
  target 160–220 ms and respect reduced motion.
- No neon gradients, glowing AI orbs, glassmorphism, robot mascots, decorative
  flags, wildlife, or generic regional clichés.
- No dark mode until every release gate is green.
- No vanity chart when an exact sentence or compression rail is faster.

### Content voice

- Owner copy is direct, calm, and concrete.
- Prefer “3 decisions need you” over “3 pending approvals.”
- Prefer “Duka stopped because the amount was unclear” over “low confidence.”
- Say exactly what approval changes internally.
- Say what does not happen: no M-Pesa transfer and no supplier order placement.
- English is the judging interface language; Kiswahili input, transcript,
  translation, and response remain first-class proof.

## 5. Information architecture

| Group | Route | Owner job | Dominant action |
|---|---|---|---|
| Today | `/` | Understand the night and start the day | Review decisions |
| Today | `/approvals` | Decide what Duka refused to decide alone | Approve or reject selected item |
| Work | `/inbox` | Receive and inspect customer text, voice, and image events | Send or try verified example |
| Work | `/ledger` | Extract and record trustworthy ledger rows | Process a ledger page |
| Work | `/orders` | Find grounded orders and record a manual sale | Record sale |
| Work | `/inventory` | See stock risk and proposed replenishment | Review restock evidence |
| Operations | `/night-shift` | Inspect the autonomous reconciliation run | Run/review night shift |
| Proof | `/evidence` | Verify architecture, release, evals, economics, and limitations | Open trace/release proof |

### Desktop shell

- Keep the owned shadcn Sidebar with Today, Work, Operations, and Proof groups.
- Preserve icon-collapse mode, tooltips, persisted preference, breadcrumb, and
  command palette.
- Use the right rail only for selected-object context or proof; do not reserve
  empty space globally.
- Keep operational pages within a 1440–1536 px maximum and narrative proof
  within a 720–800 px reading width.

### Mobile shell

- Keep Brief, Decisions, Inbox, and More in the bottom navigation.
- Use a shadcn Sheet/Drawer for secondary navigation and object detail.
- Reduce Morning Brief vertical length by using a compact night-status panel,
  a stacked three-lane rail, and a 2×2 outcome grid.
- Show only one decision CTA. If decisions exist, allow a small sticky action
  bar after the hero scrolls out of view.
- Keep all primary controls at least 44 px and ensure bottom navigation never
  obscures the final action or disclosure.

## 6. Screen design contracts

### 6.1 Morning Brief — the winning first frame

The production seeded state must show:

- Night shift complete, finish time, environment, and next scheduled run.
- Exact count and exact percentage from the observed release-bound report.
- A small owner queue with one dominant `Review 3 decisions` action.
- One compression rail with exact → Gemini → Owner counts.
- A two-sentence digest and one actionable stock note.
- A compact disclosure that data is synthetic and external payment/supplier
  effects are not executed.

Refinement tasks:

- Remove redundant decision actions from the same viewport.
- Change the hero layout based on queue state: owner action dominant when the
  queue is nonempty; calm completion state when clear.
- Preserve exact numbers but shorten explanatory copy above the fold.
- Keep release/model details inside Proof rather than the hero.
- Add stale-report behavior: show age, do not call stale data “today,” and
  provide a safe route to Night Shift.

### 6.2 Decisions — the clearest safe-agency screen

- Keep queue + inspector on desktop and cards + full-height Sheet on mobile.
- Each item shows observation, reason for stopping, supporting evidence, exact
  proposed bookkeeping effect, and explicit non-effect.
- Confirmation uses AlertDialog and repeats the exact effect.
- State model: pending, claiming, resuming, retryable, conflicting, expired,
  approved, rejected, and resume failed.
- Preserve the selected item and receipt after mutation; never jump to a generic
  toast with no audit trail.
- Never expose customer authority keys or raw session/invocation/interrupt
  handles.

### 6.3 Inbox — make agent work visible without becoming a trace console

- Desktop: customer rail, conversation, optional event/proof inspector.
- Mobile: conversation first; customer and proof open in Sheets.
- Composer supports text, image, upload, recording, and verified bilingual
  examples.
- A sent item retains one visual identity through `202 queued`, processing,
  completed, suspended, retryable, or failed.
- Completed order receipts link to the exact authenticated order Sheet.
- Proof includes event prefix, node path, wall time, model usage, cost, and
  release attribution, while the default message view remains human.
- Poll only while work is outstanding, back off when idle, and pause in hidden
  tabs. SSE is a post-release enhancement.

### 6.4 Ledger Desk — the tactile multimodal proof

- Desktop: large page preview left, observed results right.
- Mobile: preview, extraction status, then separate Recorded and Needs owner
  sections.
- English, Kiswahili, and Owner upload are explicit modes.
- Keep expected fixture truth visually separate from observed runtime output.
- Connect image rows to result rows only when trustworthy bounding information
  exists; never fabricate coordinates.
- An unreadable amount remains blank and gated.
- Provenance shows Google provider/model/location, hash, language, and synthetic
  status in a compact disclosure.

### 6.5 Night Shift — show bounded autonomy

- Separate current observed run from historical local synthetic baseline.
- Show the three trust lanes, their counts, durations, and stop reason.
- Display hard bounds: residue batch size, batch ceiling, no-progress stop, and
  model calls.
- Show release SHA, image digest, run ID, tokens, measured cost, and trace in the
  receipt layer.
- The product may offer a guarded action, but the Loom must show real
  Scheduler/Cloud Run Job evidence.
- Use one accessible compression chart only if it communicates faster than the
  rail; always include exact text equivalents.

### 6.6 Orders

- Keep a screen-specific TanStack/shadcn table rather than a universal grid.
- Search, status filter, sorting, pagination, and authenticated detail Sheet.
- Manual sale uses current catalog SKU and server-derived integer KSh price.
- Link to source event, ledger row, or receipt where available.
- Mobile uses compact order cards and a detail Sheet.

### 6.7 Stock

- Actionable low-stock products first; full catalog second.
- Show threshold, current level, recent demand evidence, suggested quantity,
  and proposal state.
- Restock is an internal proposal/outbox action only.
- The proof layer explains why the item was suggested and what approval changes.

### 6.8 Evidence — the judge proof room

Design this as five concise chapters rather than a wall of status cards:

1. **Release identity:** SHA, image digests, revisions, model, and locations.
2. **How Duka acts:** ADK graph and Exact/Gemini/Owner authority boundaries.
3. **One causal trace:** event → Pub/Sub → Session → invocation → result →
   decision/resume.
4. **Measured quality:** unit/emulator results, ADK evals, bilingual paths,
   durability, IAM, benchmark, cost, and rollback.
5. **Honest boundaries:** synthetic data, pre-existing work, no external money
   transfer, and no supplier placement.

Missing proof renders `Pending` or `Not proven`; it never becomes a green
placeholder. Links to private Google consoles must be sanitized and shown only
to an authenticated owner/judge session.

## 7. shadcn/ui composition strategy

Use shadcn as owned accessible source, not as the visual identity. Duka’s
business semantics belong in Duka compositions.

### Foundation primitives

- Keep: Sidebar, Sheet, Breadcrumb, Tooltip, Separator, DropdownMenu, Command,
  Dialog, AlertDialog, Card, Badge, Button, Skeleton, and Sonner.
- Add only when required: Drawer, ScrollArea, Tabs, Popover, Collapsible,
  Textarea, Label, Select, Table, Pagination, Progress, and accessible Chart.
- Avoid adding a component because it exists in the registry.
- Prefer route-specific table composition; shadcn’s own guidance notes that
  data tables usually have distinct sorting, filtering, and data-source needs.

### Duka-owned compositions

- `TrustBadge`
- `AuthorityRail`
- `ExecutionReceipt`
- `ProofSheet`
- `EvidenceSource`
- `EnvironmentBadge`
- `ReleaseStamp`
- `Metric` and `KshValue`
- `StatusTimeline`
- `DecisionInspector`
- `MediaFixturePicker`
- `LedgerResultRow`
- `EmptyState`, `PendingState`, `FailureState`, `StaleState`, and
  `DegradedBanner`

Do not wrap every primitive. Create a Duka composition only when business
meaning, repeated state, or safety language must remain consistent.

## 8. Next.js and standalone Cloud Run architecture

### Rendering boundary

- Pages and initial authenticated reads remain Server Components.
- Server Components call the private API directly through the server-only
  client; they do not call the frontend’s own Route Handler.
- Client Components remain small islands for recorder/upload, polling, filters,
  dialogs, Sheets, charts, and mutations.
- Zod validates every private API and media-manifest boundary.
- Operational reads are `no-store`; immutable content-hashed assets may use
  long-lived caching.
- Parallelize independent initial reads and use route/local Suspense boundaries
  to avoid whole-page waterfalls.
- Keep `use client` at the narrowest interactive boundary; every imported module
  under that boundary contributes to browser JavaScript.
- Defer charts, media processing, and heavy inspectors until their route or
  disclosure is opened.

### BFF and identity boundary

```text
Judge browser
  -> public duka-prod-web (Next.js / Cloud Run)
       -> secure owner session
       -> allowlisted Route Handler for browser mutations/polling
       -> server-only Google-signed ID token
            -> private duka-prod-api

Pub/Sub signed push -> private worker
Scheduler identity  -> private Cloud Run Jobs
```

- The browser never receives the private API URL, Google token, service account,
  Memory key, or durable resume handle.
- FastAPI remains the business authorization and invariant boundary.
- BFF routes are method/path allowlisted with request-size, content-type,
  timeout, safe-error, and no-store policies.
- Owner cookies are `Secure`, `HttpOnly`, `SameSite=Lax` or stricter, bounded,
  rotated, and scoped to the web origin.
- Add a reviewed CSP and security-header set after confirming Next.js
  self-hosting behavior; do not break required inline runtime behavior with an
  aspirational header.

### Cloud Run frontend contract

- Service: public `duka-dev-web` and `duka-prod-web` in `europe-west1`.
- Image: frozen pnpm install, Next standalone output, Node 24, non-root
  UID/GID 10001, `PORT=8080`, immutable release labels.
- Health surfaces: lightweight `/health`, dependency-aware `/ready`, and safe
  `/version` with release/model metadata but no secret.
- Configure startup and liveness probes; readiness is used only if the selected
  Cloud Run configuration supports the required behavior at deployment time.
- Frontend runtime identity receives only private API invocation and telemetry
  write permissions.
- Development deploys from `dev` only after CI and an explicit cloud gate.
- Production promotes the exact tested image digest after protected approval;
  it does not rebuild.
- Consider one minimum web instance only for the judging window if cold-start
  measurements justify the cost; record the decision and budget before apply.

## 9. Work plan and milestones

### Phase P0 — Baseline and design lock

**Goal:** establish one truthful baseline and one design contract.

- [x] **P0-01** Commit and push the reviewed WIP at `494291a`.
- [x] **P0-02** Record the existing product, browser, bundle, and local test
  evidence.
- [x] **P0-03** Confirm the standalone Next.js/public web and private backend
  architecture.
- [x] **P0-04** Lock the Morning Ledger, Exact/Gemini/Owner, and progressive
  proof design direction in this plan.
- [ ] **P0-05** Review this plan with the owner and mark it accepted.

**Milestone M0:** accepted product/design/release contract at one pushed SHA.

### Phase P1 — Judge-ready frontend refinement

**Goal:** turn the strong control-room foundation into a decisive judging
experience without a rewrite.

- [x] **P1-01** Freeze a deterministic seeded judge state with a completed
  night run, meaningful exact count, three diverse decisions, bilingual Inbox
  history, one gated ledger row, linked order, and low-stock evidence.
- [x] **P1-02** Refine Morning Brief hierarchy and remove duplicate CTAs.
- [x] **P1-03** Reduce mobile Morning Brief length while retaining exact values,
  disclosure, and proof access.
- [x] **P1-04** Complete stale/degraded/retry/conflict states for every mutation
  route and preserve object identity through recovery.
- [ ] **P1-05** Finish nightly/evidence correlation links once cloud-safe trace
  URLs and release artifacts exist.
- [x] **P1-06** Recompose Evidence into the five proof chapters.
- [x] **P1-07** Audit content language for owner clarity, exact internal effect,
  and explicit non-effect.
- [x] **P1-08** Add only the missing shadcn primitives required by the accepted
  compositions; no registry-driven scope expansion.
- [ ] **P1-09** Capture final seeded screenshots at 390, 768, 1280, and 1440 px
  and compare them with the current baseline.

  **Progress:** the deterministic judge profile now produces 48,402 exact
  matches at 50,000-row scale, three reviewed approval kinds, current sales,
  and English/Kiswahili text history with zero model or media calls. The
  Morning Brief has one dominant CTA, a compact mobile authority rail, a 2×2
  mobile outcome grid, truthful stale-run handling, and an isolated 1440/390
  Playwright/axe gate. Evidence now follows Release identity → How Duka acts →
  Causal trace → Measured quality → Honest boundaries; the trace stays pending
  until a release-bound artifact exists. No additional shadcn primitive was
  needed. Manual sale and managed-session rotation now preserve one operation
  ID through a lost response, while inbound intake, restock, nightly, and
  approval mutations expose truthful persistent recovery states. The base
  production browser suite passes 23 journeys and the isolated judge profile
  passes its bilingual accessibility journey. Final four-width captures remain
  tied to the eventual Google-media release candidate.

**Exit criteria**

- Meaningful owner action visible in 10–15 seconds.
- One dominant CTA per route.
- No route is a placeholder or generic admin table.
- Mobile primary journey is compact and has no obstructed action.
- Every visible success is backed by the selected environment.

**Milestone M1:** visually frozen, judge-ready product candidate.

### Phase P2 — Google-only bilingual release assets

**Goal:** freeze the exact media used by UI, tests, evals, cloud, and Loom.

- [ ] **P2-00 APPROVAL** Review `docs/google-media-approval-packet.md` with the
  owner before any API activation or billable call.
- [ ] **P2-01** Enable only the approved Vertex AI and Cloud Text-to-Speech APIs.
- [ ] **P2-02** Generate English and Kiswahili ledger candidates using the
  approved Google Vertex image model.
- [ ] **P2-03** Generate English and Kiswahili voice fixtures using approved
  Google Cloud Text-to-Speech.
- [ ] **P2-04** Human-review every candidate and run it through the production
  extraction path.
- [ ] **P2-05** Freeze only assets with reviewed truth and record hash, bytes,
  dimensions/duration, provider, model, location, project, timestamp,
  prompt/transcript hash, language, and synthetic status.
- [ ] **P2-06** Set `release_ready=true` only when all four required variants
  pass verifier, UI, backend, and eval tests.

**Milestone M2:** four verified Google-only bilingual release fixtures.

### Phase P3 — Local release candidate

**Goal:** prove the exact code and images before any cloud apply.

- [ ] **P3-01** Run lint, strict typecheck, Vitest, production build, bundle
  budget, and complete Playwright/axe journeys.
- [ ] **P3-02** Run the complete Python suite and zero-skip Firestore emulator
  parity under Java 21.
- [ ] **P3-03** Run topology, lock, Terraform validate, actionlint, credential,
  commit-trailer, fixture, and docs-link checks.
- [ ] **P3-04** Build and run paired frontend/backend containers; verify non-root
  identity, probes, login, BFF allowlist, private-api denial, caching, media
  limits, and safe errors.
- [ ] **P3-05** Measure production-image TTFB/LCP/INP/CLS and route bundle
  budgets; fix avoidable client boundaries and waterfalls.
- [ ] **P3-06** Run a second-person usability rehearsal and record time to first
  meaning, first decision, voice result, ledger result, and recovery.
- [ ] **P3-07** Freeze one release-candidate SHA, image digests, screenshots,
  topology fingerprint, and evidence bundle.

**Milestone M3:** one green, reproducible local release candidate.

**Local progress:** both release images now build, run as UID/GID 10001, reach
healthy probes, agree on release/topology identity, complete owner login and an
authenticated BFF read, return `no-store`, and deny forbidden BFF routes. The
Cloud Run private-API denial remains intentionally pending because a local
`DUKA_ENV=local` container cannot prove IAM. Java 21+, Terraform, actionlint,
Google media, and a frozen candidate SHA also remain before M3 can close.

### Phase P4 — Approved cloud foundation and CI/CD

**Goal:** create the minimum production-shaped Google Cloud system.

- [ ] **P4-00 APPROVAL** Review saved Terraform plans, APIs, IAM, WIF, names,
  quotas, max instances, retention, budget, and expected judging spend.
- [ ] **P4-01** Bootstrap Terraform state, Artifact Registry, WIF, deployer
  identities, secrets, budget alerts, and protected Agent Platform contexts.
- [ ] **P4-02** Provision named Firestore databases, Pub/Sub/DLQ, Scheduler,
  public web, private API/worker, Jobs, telemetry, and context resources.
- [ ] **P4-03** Configure GitHub environments and variables; no JSON service
  account key.
- [ ] **P4-04** Deploy development from the exact approved SHA using WIF.
- [ ] **P4-05** Prove public web → private API, anonymous denial, owner auth,
  Pub/Sub/Scheduler invoker boundaries, and idempotent seed.
- [ ] **P4-06** Promote exact tested digests through protected production and
  rehearse rollback under five minutes.

**Milestone M4:** hosted public product with private production-shaped agent
services and reproducible delivery.

### Phase P5 — Durable Agent Platform proof

**Goal:** prove that managed state creates real product value.

- [ ] **P5-01** Verify one protected context resource per environment backs both
  `VertexAiSessionService` and `VertexAiMemoryBankService`.
- [ ] **P5-02** Prove Firestore active-session pointers, 90-day Session TTL,
  old-session readability, and per-customer sequencing.
- [ ] **P5-03** Prove refund suspend/resume after scale-to-zero, revision change,
  and Session rotation.
- [ ] **P5-04** Prove duplicate decisions, conflicting decisions, transient
  resume failure, and expired Session behavior.
- [ ] **P5-05** Prove Memory outbox retry, multilingual “usual order,” current
  catalog override, changed preference, no-memory clarification, and zero
  cross-user retrieval.
- [ ] **P5-06** Prove blocked/poisoning content cannot enter Memory or a later
  model turn.
- [ ] **P5-07** Publish sanitized request → Session → invocation → decision →
  resume correlation in Evidence.

**Milestone M5:** durable Sessions and Memory are a demonstrated behavior, not
an architecture label.

### Phase P6 — Evaluation, benchmark, economics, and evidence lock

**Goal:** make every score-driving claim independently verifiable.

- [ ] **P6-01** Run locked English/Kiswahili text, voice, and ledger journeys.
- [ ] **P6-02** Run 20+ ADK evaluations with repeated critical safety
  trajectories and a Gemini judge.
- [ ] **P6-03** Trigger Scheduler → 50,000-row Cloud Run Job and capture exact,
  duplicate, residue, proposal, wall-time, token, model-call, and cost values.
- [ ] **P6-04** Capture one complete Cloud Trace causal story.
- [ ] **P6-05** Run IAM denial, delivery replay, approval replay, isolation,
  durability, poison, and rollback evidence suites.
- [ ] **P6-06** Bind evidence ledger, release manifest, Evidence page, SHA,
  image digests, revisions, model, locations, and trace identifiers.
- [ ] **P6-07** Remove or relabel every claim that is not cloud-proven for the
  exact release.

**Milestone M6:** evidence-locked production release.

### Phase P7 — Loom, transcript, guide, and submission

**Goal:** make the complete product effortless to judge.

- [ ] **P7-01** Freeze judge credentials, seed state, bilingual assets, Memory,
  architecture diagram, release manifest, URLs, and recovery procedure.
- [ ] **P7-02** Complete `docs/demo-guide.md` with exact screen action, expected
  state, evidence ID, timing, and truthful fallback for every beat.
- [ ] **P7-03** Complete `docs/demo-transcript.md` as a word-for-word English
  narration aligned to the same evidence and screen timing.
- [ ] **P7-04** Rehearse three end-to-end runs and one second-operator run.
- [ ] **P7-05** Record Loom at 1080p with English narration/captions and one
  unedited cloud action segment.
- [ ] **P7-06** Correct captions for Kiswahili, M-Pesa, ADK, Firestore, Pub/Sub,
  Gemini, and product names.
- [ ] **P7-07** Verify the public app and Loom in incognito and on a second
  network/device.
- [ ] **P7-08** Publish the hackathon article and social post with required
  wording and hashtag.
- [ ] **P7-09** Complete Devpost category, model/services, architecture, access,
  pre-existing-work, synthetic-data, URL, and video disclosures.
- [ ] **P7-10** Submit before the internal deadline and save the receipt.

**Milestone M7:** submitted, accessible, evidence-consistent entry.

## 10. Four-minute Loom contract

| Time | Product beat | Visible action | Judge takeaway |
|---|---|---|---|
| 0:00–0:18 | Morning Brief | Show night complete, exact compression, and three decisions | Immediate practical value |
| 0:18–0:55 | Inbox | Send verified English voice; show durable `202`, processing, and grounded order | Real asynchronous agent action |
| 0:55–1:25 | Ledger Desk | Process Kiswahili ledger; show two recorded rows and one gated blank | Multimodal, bilingual, risk-aware |
| 1:25–2:10 | Night Shift | Trigger the real Scheduler/Job path and keep one segment visibly continuous | Real Google Cloud execution |
| 2:10–2:40 | Decisions | Explain why Duka stopped; approve one exact internal effect | Human authority is deliberate |
| 2:40–3:12 | Inbox/Memory | Rotate Session and request the grounded usual at the current catalog price | Durable context has practical value |
| 3:12–3:43 | Evidence | Show ADK graph, public/private topology, release, evals, trace, and economics | Architecture and readiness are proven |
| 3:43–3:55 | Morning Brief | Return to the compressed outcome and close | “The duka slept; its back office did not.” |

The final guide and transcript are generated from the evidence-locked release,
not from expected results. Every network-dependent beat has a pre-rehearsed
fallback that stays truthful.

## 11. Release gates

### Product and design

- No placeholder route, dead action, missing fixture, or unsupported success.
- One visually dominant action per screen.
- Exact/Gemini/Owner grammar is consistent and never color-only.
- Meaningful seeded release state with English primary and verified Kiswahili
  equivalent.
- Loading, empty, stale, degraded, unauthorized, retry, conflict, and failure
  states exist where applicable.
- Zero critical axe violations; keyboard, contrast, reduced motion, 200% zoom,
  390/768/1280/1440, mobile safe area, and print pass.

### Frontend engineering

- Server/Client boundaries are intentional and route bundles remain within the
  enforced budget.
- Server Components never call the app’s own BFF.
- Browser BFF path/method/body/content-type/timeout policy is fail-closed.
- Private API URL, Google token, service identity, secret, Memory key, or resume
  handle never reaches browser code, responses, or logs.
- Standalone container runs non-root, respects `PORT`, and passes probes.
- Hosted Core Web Vitals meet the release thresholds.

### Agent safety and durability

- Catalog identity and price are server-derived; invalid quantity or user scope
  fails closed.
- Inbound events, approval decisions, resume, Memory ingestion, and outbox
  effects are idempotent.
- Managed Sessions persist across restart/revision and Firestore owns the active
  pointer and approval state.
- Memory is allowlisted advisory context and cannot authorize consequential
  action.
- Blocked instructions cannot survive into later history or Memory.

### Cloud and evidence

- Only web is public; API, worker, and Jobs deny anonymous invocation.
- GitHub uses WIF; production promotes exact tested digests after approval.
- App version, manifest, SHA, digests, revisions, Evidence, Loom, and Devpost
  agree.
- Benchmark and economics identify dataset, seed, model, location, release,
  calls, tokens, operations, time, and cost.
- ADK evaluation evidence is clearly distinct from unit tests.
- Synthetic media/data and pre-existing work are disclosed.

## 12. Scope guardrails and cut line

### Never cut

1. Morning → voice → ledger → decision → night causal journey.
2. Durable Sessions/Memory and replay/idempotency proof.
3. Public Next.js/private backend Cloud Run architecture.
4. English and Kiswahili Google-only media provenance.
5. ADK eval, 50,000-row economics, trace, Evidence, and release attribution.
6. Accessibility, truthful external-effect copy, and safe owner authority.

### Cut before risking the above

- dark mode or multiple themes;
- decorative animation;
- a marketing landing page;
- real WhatsApp Business, M-Pesa transfer, or supplier integration;
- SSE/WebSockets when bounded polling works;
- a universal data-grid abstraction;
- a second chart;
- another model solely for a bonus;
- native mobile packaging;
- multi-shop administration;
- Gemini Enterprise breadth beyond the managed context behavior actually
  demonstrated.

## 13. Immediate execution sequence

1. Review and accept this plan; decide whether the current Morning Ledger
   direction is the final visual direction.
2. Refine the seeded judge state and the Morning Brief/mobile hierarchy before
   adding new frontend features.
3. Obtain P2-00 approval before enabling APIs or generating the four Google-only
   bilingual release assets.
4. Complete local release-candidate gates, paired-container smoke, hosted-style
   performance, and second-person rehearsal.
5. Freeze one candidate SHA and review Terraform plans, IAM, quotas, retention,
   and spend; obtain P4-00 approval before any cloud mutation.
6. Deploy exact images through WIF; prove public/private boundaries and managed
   Session/Memory durability.
7. Run ADK evals, the 50,000-row Job, traces, economics, IAM/replay suites, and
   evidence lock.
8. Finalize the Loom guide and transcript against the exact release, rehearse,
   record, publish bonuses, and submit.

## 14. Official design and implementation basis

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js deployment and standalone output](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/aria/sidebar)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/aria/data-table)
- [shadcn/ui Chart accessibility](https://ui.shadcn.com/docs/components/base/chart)
- [Google Cloud Run health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)
- [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
