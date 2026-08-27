# Duka Autopilot — Grand-Prize Execution Plan v3

> Status: superseded by `docs/grand-prize-winning-product-plan-v4.md`
> Created: August 27, 2026
> Baseline commit: `267440e820e018314c7227e2dcf0ff9799f88a41`
> Baseline branch: private `origin/dev`
> GCP project: `my-duka-autopilot`
> Application region: `europe-west1`
> Vertex AI / Agent Platform location: `global`
> Core category: The Taskmaster
> Delivery: standalone Next.js web service plus private ADK application services on Cloud Run

This document replaces `docs/release-plan-v2-nextjs.md` as the day-to-day
execution contract. The v2 plan and `docs/hackathon-plan.md` remain the detailed
decision history, requirements source, and A01–A30 acceptance catalogue.

No command in this plan grants permission to create, change, or deploy Google
Cloud infrastructure. Cloud bootstrap and deployment remain explicit approval
gates.

## 1. Winning objective

Duka Autopilot must demonstrate one finished, useful agentic system:

> **The autonomous night shift for a Kenyan shop: English or Kiswahili voice,
> handwritten ledgers, and M-Pesa-like exports become reconciled books and a
> three-minute morning decision queue.**

The four-minute story is causal rather than feature-based:

1. a real-world event arrives as voice, image, or text;
2. the public web service acknowledges it immediately;
3. the private ADK workflow handles it asynchronously;
4. deterministic code settles exact evidence;
5. Gemini handles only bounded ambiguity;
6. consequential uncertainty stops for the owner;
7. managed Sessions and Memory preserve the useful context;
8. the owner wakes to a compressed brief with evidence attached.

The product maxim is visible in the interface and the architecture:

> **Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.**

### Judge outcomes

| Judging concern | What the release must make undeniable |
|---|---|
| Innovation and utility | It solves the actual shape of duka work: voice, paper, payment exports, interruptions, and limited owner time |
| Architectural discipline | ADK graph orchestration, deterministic tools, bounded model authority, durable state, idempotency, and explicit human gates |
| Demo and production readiness | Public hosted product, private services, real Cloud Run execution, immutable release evidence, evals, economics, and rollback |
| Grand Prize | The most complete score across utility, architecture, and proof—not the most Google products in a diagram |

### Release success metrics

- First useful meaning is visible within 10 seconds of opening the app.
- A new judge can identify the one required owner action within 15 seconds.
- The main demo completes in 3:45–3:55 with one visibly unedited cloud segment.
- Every number spoken in the Loom maps to a release-SHA-bound evidence artifact.
- Zero ambiguous model output directly changes money-adjacent bookkeeping.
- Zero duplicate business effects in the delivery and approval replay tests.
- Zero cross-user Memory retrievals in the isolation suite.
- Zero non-Google model or synthetic-media providers in the release manifest.
- English and Kiswahili variants exist for the voice and ledger test journeys.

## 2. Baseline and remaining gap

### Pushed at the v3 baseline

- Standalone Next.js 16 / React 19 application with a pinned pnpm lock and
  standalone non-root container.
- Public web / private API BFF boundary with Google-signed service-to-service
  identity.
- Login, morning brief, responsive shell, and owned shadcn-compatible
  primitives.
- Working Inbox with text, photo, voice capture, `202` receipts, polling,
  same-event retry, and execution details.
- Working Ledger Desk with image validation, idempotent submission, and
  structured recorded/gated row outcomes.
- Working Decisions queue for all six proposal classes with truthful effect
  language and sanitized durable resume handles.
- Working Night Shift workspace with exact/Gemini/owner lanes, hard bounds,
  release attribution, and observed-versus-baseline separation.
- Durable managed Session and Memory seams, Firestore persistence, Pub/Sub,
  Cloud Run Jobs, Terraform, WIF GitHub Actions, observability, and local test
  coverage.
- Private `dev` remote updated to `267440e`.

### Highest-value gaps

1. The checked-in ledger fixture still identifies a non-Google generation source.
   It is disqualified from the release package and must be replaced before any
   further screenshot or evidence freeze.
2. The multimodal fixture set is not bilingual. Judges need an English path;
   the Kenyan product story still needs a Kiswahili path.
3. Orders, Stock, and Evidence remain incomplete product surfaces.
4. The shell uses custom navigation rather than the complete shadcn Sidebar /
   Sheet behavior and has not passed final Playwright, axe, keyboard, or visual
   regression gates.
5. No GCP infrastructure has been applied; there is no hosted URL, cloud
   benchmark, production trace, managed-state proof, or immutable release
   manifest yet.
6. ADK evals are packaged but not final-run against the locked cloud model.
7. Loom guide and transcript are drafts with evidence placeholders.

## 3. Product and design thesis

### 3.1 The product is a morning control room

The frontend is not a WhatsApp clone, a chatbot, or a generic analytics
dashboard. It is the owner’s **morning control room**:

- quiet when routine work succeeded;
- urgent only when the owner must decide;
- explicit about why automation stopped;
- able to expose proof without forcing the owner to read traces;
- grounded in shop language rather than cloud-service language.

The first screen answers only four questions:

1. Did the night shift complete?
2. What did it settle?
3. What needs me now?
4. Can I trust that result?

### 3.2 Signature interaction: the trust grammar

Every important record carries one of three consistent lanes:

| Lane | Meaning | Visual language | Permitted authority |
|---|---|---|---|
| Exact | Strong deterministic evidence | deep green, check/grid icon | may update internal bookkeeping under tool invariants |
| Gemini | Bounded interpretation | Google/Gemini blue, sparkle/brackets icon | may extract or propose; may not create an irreversible effect |
| Owner | Consequential ambiguity | amber, hand/shield icon | explicit approve or reject with an audit receipt |

This grammar appears in the Morning Brief, Inbox receipts, Ledger rows,
Decisions, Night Shift, and Evidence. Judges should understand the application’s
authority model before the architecture slide appears.

### 3.3 Progressive proof

Use three layers of detail:

1. **Outcome:** human sentence and primary action.
2. **Reason:** evidence, confidence, and why Duka acted or stopped.
3. **Proof:** event ID, graph path, release SHA, tokens, cost, trace correlation,
   and immutable artifact source.

Proof opens in a Sheet, disclosure, or Evidence workspace; it does not crowd
the default owner view.

### 3.4 Visual direction: operational warmth

- Warm ivory canvas, ink foreground, deep shop green primary.
- Gemini blue only for bounded model work; amber only for owner attention; red
  only for conflict or destructive failure.
- Paper-ledger grid texture used sparingly in hero and empty states.
- Geist Sans / Geist Mono with tabular numerals for KSh, counts, durations,
  event IDs, SHAs, and costs.
- Strong type hierarchy, 12–16 px radii, fine borders, minimal shadows.
- No glassmorphism, neon AI gradients, glowing orbs, decorative “African”
  clichés, animated vanity charts, or color-only status.
- Light mode is the Loom baseline. Dark mode is post-submission unless all P0
  gates are green.
- Motion is limited to 150–220 ms state transitions and obeys reduced-motion.

### 3.5 Language and judge comprehension

- Product copy defaults to clear English for the judged release.
- Customer fixtures have explicit `English` and `Kiswahili` selectors.
- Kiswahili voice always shows a reviewed English transcript beneath it.
- The primary Loom narration and captions are English.
- The demo may lead with the English fixture for immediate comprehension, then
  show the equivalent Kiswahili proof as a verified variant.
- Do not translate immutable IDs, product names, KSh values, or evidence labels.

## 4. Information architecture

Group navigation by owner intent, not by backend component.

| Group | Route | Screen contract |
|---|---|---|
| Today | `/` | Morning Brief: outcome, queue compression, next action, causal timeline |
| Today | `/approvals` | Decisions: everything Duka refused to decide alone |
| Work | `/inbox` | Customer events: text, English/Kiswahili voice, photos, async receipts |
| Work | `/ledger` | Ledger Desk: bilingual fixture/upload, preview, row evidence, confidence gates |
| Work | `/orders` | Orders: search, status, detail, catalog-derived manual sale |
| Work | `/inventory` | Stock: low-stock signal, evidence, restock proposals, no supplier claim |
| Operations | `/night-shift` | Pipeline: exact pass, bounded Gemini residue, owner exceptions, run receipt |
| Proof | `/evidence` | Release: architecture, cloud status, tests/evals, traces, provenance, limits |

### Responsive behavior

- Desktop: shadcn `Sidebar` collapses to icons; main workspace may add a narrow
  proof rail.
- Tablet: icon sidebar; proof/detail rail becomes a `Sheet`.
- Mobile: fixed bottom navigation for Brief, Decisions, Inbox, and More; detail
  is progressive; all primary controls are at least 44 px.
- Tables become semantic stacked cards on small screens; do not force horizontal
  scrolling for the primary decision journey.

## 5. Screen blueprints

### Morning Brief

- Hero: “Night shift complete” or a truthful degraded state, last run, next run.
- Compression statement: “49,756 unique rows became 3 owner decisions,” using
  live data only; local numbers retain the `local synthetic baseline` label.
- One primary CTA: `Review 3 decisions` or `Queue clear`.
- Horizontal causal rail: received → exact → Gemini residue → owner queue.
- Digest in plain language, followed by top decisions and actionable stock.
- Small environment/release strip; no infrastructure tile wall.

### Decisions

- Filter by proposal kind, risk, and state.
- Each item answers: observation, reason for stopping, proposed internal effect,
  evidence/confidence, affected object, and expiry.
- Native `AlertDialog` states the exact effect and what will *not* happen.
- Duplicate, retrying, conflict, expired-session, and failed-resume results have
  explicit stable states rather than generic toasts.
- Completion exposes a sanitized receipt, never session/invocation/interrupt IDs.

### Inbox

- Two-pane desktop conversation; single-pane mobile.
- Media composer supports text, upload, and start/stop recording.
- Fixture chooser offers English and Kiswahili voice with transcript, origin,
  MIME, duration, and hash.
- Message lifecycle is visible: queued → processing → completed/suspended/failed.
- Execution receipt exposes path, wall time, tokens, measured model cost,
  event/request ID, and trust lane.
- “New day” dialog explains Session rotation and advisory Memory behavior.

### Ledger Desk

- English and Kiswahili frozen fixture tabs plus owner upload.
- Large paper preview, filename, MIME, dimensions, bytes, hash, model/provider,
  prompt hash, and synthetic disclosure.
- Result is two parallel columns: `Recorded automatically` and `Needs owner`.
- Expected fixture truth is visually separate from observed model/tool output.
- An unreadable amount remains unreadable; never fill it for a prettier demo.

### Night Shift

- Three-lane pipeline with counts that visually narrow from all rows to residue
  to owner proposals.
- Run status, duration, exact settlement rate, duplicates, residue, proposals,
  bounded batch settings, no-progress stop, tokens, and measured cost.
- Release SHA, backend digest, execution surface, and trace correlation.
- Local control is clearly local. The real Loom run starts via Scheduler or the
  reviewed GitHub proof workflow and shows Cloud Run Job evidence.

### Orders

- Screen-specific TanStack/shadcn table with search, filter, sort, pagination,
  and a mobile detail Sheet.
- Manual sale uses catalog SKUs and server-derived current prices; quantity must
  be positive; unknown customers/products fail closed.
- KSh values originate as integers and use one shared formatter.
- Created orders link directly to their event and tool receipt.

### Stock

- Show only actionable low-stock signals first.
- Product, level, threshold, recent demand evidence, proposal quantity, and
  supplier-facing status.
- Approval records an internal proposal/outbox item. It does not claim a
  supplier order was placed unless a real integration exists.

### Evidence

- Release identity: SHA, frontend/backend digests, deployed revisions, model,
  locations, immutable topology fingerprint.
- Cloud topology status: web/API/worker, Jobs, Firestore, Pub/Sub/DLQ,
  Scheduler, Vertex, Sessions, Memory, Trace.
- Trust architecture: exact/Gemini/owner with actual tool boundaries.
- Latest tests, Firestore parity, ADK evals, benchmark, economics, restart,
  Memory isolation, IAM denial, and rollback status.
- Fixture provenance: Google model/provider or first-party human recording,
  prompt/transcript hash, language, and synthetic status.
- Disclosures: synthetic data, pre-existing work, no M-Pesa transfer, no
  supplier order effect.
- Sanitized trace links only for authenticated judges; no private console data,
  phone-derived Memory keys, raw prompts, inline media, cookies, or secrets.

## 6. Frontend engineering contract

### Stack

- Next.js App Router with React Server Components for initial authenticated reads.
- Client Components only for recording, file input, polling, charts, dialogs,
  sheets, and mutations.
- shadcn/ui components are copied into and owned by the repository.
- Tailwind CSS v4 semantic tokens; strict TypeScript; Zod at every boundary.
- TanStack Query for interactive server state and TanStack Table only where a
  real data-table contract exists.
- Vitest/Testing Library for units and contracts; Playwright plus axe for
  release journeys and visual evidence.

shadcn’s own guidance treats data tables as screen-specific compositions, not a
premature universal abstraction. The official Sidebar provides the desired
icon collapse and mobile state. Charts must enable the accessibility layer.

### Public web / private service boundary

```text
Judge browser
  -> public duka-prod-web (Next.js on Cloud Run)
       -> allowlisted BFF route + owner session
            -> Google-signed ID token
                 -> private duka-prod-api
                      -> Firestore / Pub/Sub / Vertex AI / managed context

Pub/Sub -> private worker
Scheduler -> private Cloud Run Jobs
```

- Only `duka-ENV-web` permits unauthenticated invocation.
- The browser never sees a private API URL, service identity token, channel key,
  or Agent Platform credential.
- Server Components call the private API directly through a server-only client.
- Browser polling/mutations use one allowlisted BFF route.
- FastAPI remains the authoritative authorization and business-policy boundary.
- Operational data uses `no-store`; only immutable hashed assets are cached.

### Cloud Run package

- Multi-stage build with frozen pnpm lock.
- `output: "standalone"`; copy `.next/standalone`, `.next/static`, and `public`.
- Pinned Node 24 image, non-root UID/GID 10001, `PORT=8080`,
  `HOSTNAME=0.0.0.0`.
- Health and readiness endpoints; startup and liveness probes.
- Git SHA labels and immutable Artifact Registry digest promotion.
- Runtime service account receives only private API invocation and trace-writing
  permissions.

Next.js documents standalone output as the minimal production server package,
and Google Cloud documents Next.js as a supported Cloud Run service shape.

## 7. Google-only multimodal fixture policy

This policy is a P0 release gate.

### Images

- Replace `fixtures/demo/ledger-page-v1.png` and every non-Google provenance string.
- Generate two synthetic ledgers through Vertex AI
  `gemini-2.5-flash-image`: one English, one Kiswahili.
- Keep identical business truth where possible: two readable rows and one
  deliberately unreadable amount.
- Store source prompt, model ID, Google Cloud project, location, generation
  timestamp, output MIME/dimensions/bytes/SHA-256, and expected extraction truth.
- Keep Vertex AI watermark/provenance behavior enabled unless the selected API
  requires a documented alternative for reproducibility.
- Verify both images using the production Gemini extraction path; generated
  appearance alone is not acceptance.

Google’s current Vertex AI release guidance identifies
`gemini-2.5-flash-image` as the replacement image-generation endpoint. Do not
use a deprecated Imagen endpoint or any non-Google image generator.

### Audio

- Purpose-record a first-party human English fixture and a first-party human
  Kiswahili fixture so the core proof remains genuine human speech.
- Store language, transcript, reviewed English translation, speaker consent,
  date, MIME, duration, bytes, and SHA-256.
- The fixture contains no real customer/payment data.
- Process both through Gemini on Vertex AI and require the same structured
  catalog-grounded outcome.
- Google Cloud Text-to-Speech may create additional synthetic regression cases
  only where the selected language/voice is officially supported; such files
  must be labelled `Google Cloud TTS · synthetic` and may not be presented as
  human audio.
- Remove the current offline non-Google TTS submission claim.

### Acceptance

- Repository search returns zero release-facing non-Google media provenance.
- Manifest validation fails on an unknown provider, missing language variant,
  hash mismatch, or absent ground truth.
- Frontend fixture selectors show English/Kiswahili and human/synthetic origin.
- Model/eval report proves both language variants on the final release.

## 8. Delivery phases and tasks

### Phase 0 — Baseline lock and provenance repair

**Goal:** begin all new work from a clean, reproducible, Google-only baseline.

- [x] **P0-01** Commit and push the current control-room WIP to private `dev` at
      `267440e` with summarized message `feat: build core control room workflows`.
- [ ] **P0-02** Update stale baseline references in deployment/evidence docs.
- [ ] **P0-03** Add English and Kiswahili image prompts and generate both ledger
      fixtures with Vertex AI `gemini-2.5-flash-image`.
- [ ] **P0-04** Purpose-record English and Kiswahili human voice fixtures.
- [ ] **P0-05** Replace the manifest with an allowlisted Google/first-party
      provenance schema and ground truth for all four fixtures.
- [ ] **P0-06** Add fixture sync, integrity, UI selection, and negative-provider
      tests; remove every non-Google media-provider release claim.
- [ ] **P0-07** Run frontend checks, full Python suite, credential/trailer scan,
      container builds, and responsive fixture QA.

**Exit:** clean tests; four validated fixtures; no non-Google provider claim;
all evidence points to one commit.

### Phase 1 — Design-system and shell convergence

**Goal:** create a coherent, fast, accessible product frame before adding more
screens.

- [ ] **P1-01** Replace custom desktop/mobile navigation with owned shadcn
      Sidebar, SidebarInset, SidebarTrigger, Sheet, Breadcrumb, Tooltip, and
      account menu primitives.
- [ ] **P1-02** Finalize semantic tokens for exact/Gemini/owner plus success,
      warning, conflict, focus, chart, and dark-mode-compatible values.
- [ ] **P1-03** Create shared `TrustBadge`, `ExecutionReceipt`, `EvidenceSource`,
      `EnvironmentBadge`, `Metric`, `EmptyState`, and `FailureState` primitives.
- [ ] **P1-04** Add skeletons, error boundaries, offline/degraded banners,
      focus restoration, and mobile 44 px action targets.
- [ ] **P1-05** Add a compact proof rail/Sheet pattern reused across operational
      pages.
- [ ] **P1-06** Capture desktop/tablet/mobile shell screenshots and run axe,
      keyboard, zoom, reduced-motion, and contrast checks.

**Exit:** one shell and trust grammar work at 390, 768, 1280, and 1440 px; zero
critical axe violations; no owner action requires proof-panel knowledge.

### Phase 2 — Core journey polish

**Goal:** make the already-working story recording-ready.

- [ ] **P2-01** Refine Morning Brief around night result, queue compression, one
      CTA, causal timeline, and truthful environment/release labels.
- [ ] **P2-02** Add bilingual fixture selection and transcript/provenance to Inbox.
- [ ] **P2-03** Add bilingual ledger tabs, Google provenance, expected-vs-observed
      separation, and failure recovery to Ledger Desk.
- [ ] **P2-04** Apply shared trust/proof primitives to Decisions and verify every
      kind’s effect copy against backend behavior.
- [ ] **P2-05** Apply shared trust/proof primitives to Night Shift; add an
      accessible compression chart only if it communicates faster than counts.
- [ ] **P2-06** Add deterministic Playwright journeys for Inbox, Ledger,
      Decisions, and Night Shift using a local backend and frozen fixtures.

**Exit:** the four-minute causal flow can be rehearsed locally without a manual
database edit or hidden developer action.

### Phase 3 — Complete product surfaces

**Goal:** remove placeholder routes and make the application feel complete.

- [ ] **P3-01** Build Orders search/filter/sort/detail and catalog-derived manual
      sale with Zod contracts and backend validation.
- [ ] **P3-02** Build Stock summary and restock proposal workflow with truthful
      no-supplier-effect language.
- [ ] **P3-03** Build Evidence from a sanitized release-manifest endpoint and
      evidence-ledger data, not hardcoded success copy.
- [ ] **P3-04** Link orders, decisions, messages, ledger rows, and night reports
      through stable sanitized correlation IDs.
- [ ] **P3-05** Remove placeholder components and dead legacy frontend paths.

**Exit:** every navigation item has useful live, empty, loading, degraded, and
unauthorized states; Evidence cannot claim a missing cloud artifact.

### Phase 4 — Local release candidate

**Goal:** prove the exact images and code are deployable before spending cloud
time.

- [ ] **P4-01** Add Playwright + axe gates for login → brief, voice receipt,
      ledger gate, decision conflict/retry, nightly report, order, stock, and
      evidence.
- [ ] **P4-02** Run lint, strict typecheck, Vitest, production build, and
      standalone-container smoke.
- [ ] **P4-03** Run complete Python and Firestore-emulator suites with zero
      unexplained skips.
- [ ] **P4-04** Run topology, dependency lock, Terraform validate, actionlint,
      credential, trailer, fixture, and documentation link checks.
- [ ] **P4-05** Verify frontend image runs as 10001:10001 and public assets,
      health, readiness, login redirect, and BFF allowlist work.
- [ ] **P4-06** Perform second-person usability rehearsal: first useful meaning
      under 10 seconds and first decision under 15 seconds.

**Exit:** one green SHA, two tested image digests, reproducible evidence bundle,
and no cloud mutation needed to diagnose local defects.

### Phase 5 — Approved Google Cloud bootstrap and development deploy

**Goal:** establish the real private/public topology in `my-duka-autopilot`.

- [ ] **P5-00 APPROVAL** Review Terraform plans, APIs, IAM, quotas, budget/max
      instances, resource names, and expected judging-window spend with the user.
- [ ] **P5-01** Enable only declared APIs and create Terraform state, Artifact
      Registry, GitHub WIF, environment identities, secrets, budget, and limits.
- [ ] **P5-02** Provision the protected development Agent Platform context and
      configure the custom Memory Bank topic; read it back before seeding.
- [ ] **P5-03** Provision named Firestore, Pub/Sub/DLQ, Scheduler, web/API/worker,
      nightly/digest/seed Jobs, and observability in declared locations.
- [ ] **P5-04** Enable the reviewed GitHub development gate and deploy the exact
      locally tested SHA through WIF; no JSON service-account keys.
- [ ] **P5-05** Run seed twice and prove idempotency.
- [ ] **P5-06** Prove public Next → private API, direct anonymous denial, owner
      auth, worker invoker, and Scheduler/Job IAM boundaries.

**Exit:** public development URL; private backend units; Agent Platform console
proof; GitHub OIDC deployment; release metadata tied to exact digests.

### Phase 6 — Cloud behavior and evaluation proof

**Goal:** turn architecture claims into reproducible evidence.

- [ ] **P6-01** Prove English and Kiswahili text/voice plus English and
      Kiswahili ledger images end to end.
- [ ] **P6-02** Prove duplicate inbound delivery, transient retry/DLQ, and one
      business effect.
- [ ] **P6-03** Prove injection is blocked before tool action and cannot poison a
      later Session or Memory.
- [ ] **P6-04** Prove refund suspension across restart/revision, approve/reject,
      duplicate click, conflicting decision, transient resume failure, and
      expired session.
- [ ] **P6-05** Prove Session rotation and grounded usual-order Memory across a
      new session; current catalog data must override memory.
- [ ] **P6-06** Run the locked 20+ ADK evals with repeated critical cases and
      zero safety-trajectory failures.
- [ ] **P6-07** Trigger Scheduler → 50,000-row nightly Job and capture exact,
      duplicate, residue, proposals, duration, tokens, model cost, Firestore
      operations, and total economics.
- [ ] **P6-08** Capture end-to-end Cloud Trace and sanitized Evidence view links.
- [ ] **P6-09** Promote exact development digests through the protected
      production environment; drill rollback under five minutes.

**Exit:** every score-driving claim is `CLOUD-PROVEN` or removed from the demo;
no local baseline is presented as cloud evidence.

### Phase 7 — Loom and submission lock

**Goal:** make the proof effortless for judges to consume.

- [ ] **P7-01** Freeze production demo data, fixtures, Memory, release manifest,
      architecture diagram, evidence ledger, and URLs.
- [ ] **P7-02** Replace every placeholder in `docs/demo-guide.md` and
      `docs/demo-transcript.md` from final evidence.
- [ ] **P7-03** Rehearse three complete takes, including one second operator;
      record actual timings and recovery steps.
- [ ] **P7-04** Record Loom at 1080p with English narration/captions and one
      visibly unedited cloud execution segment.
- [ ] **P7-05** Edit only to 3:45–3:55; manually correct Kiswahili, M-Pesa,
      Firestore, Pub/Sub, ADK, and product-name captions.
- [ ] **P7-06** Verify Loom and hosted app in incognito with no sign-in surprise.
- [ ] **P7-07** Publish the article with the required hackathon statement and the
      social post with exact `#AllThingsAgenticHackathon`.
- [ ] **P7-08** Verify repository access, pre-existing-work disclosure, synthetic
      data disclosure, model/services, architecture, URL, and video in Devpost.
- [ ] **P7-09** Submit before the internal deadline and save the receipt.

**Exit:** submitted project, accessible proof, matching SHA/digests/captions,
and a stable judging environment.

## 9. Milestones and critical path

| Milestone | Target | Required evidence |
|---|---|---|
| M0 — Google-only bilingual baseline | Aug 27 | Four fixtures, manifests, hashes, provider scan, green local suites |
| M1 — Frontend complete | Aug 28 | No placeholders, responsive journeys, axe/Playwright, standalone image |
| M2 — Local release candidate | Aug 28 | Exact SHA/digests, full test bundle, Terraform/workflow/container gates |
| M3 — Development cloud proof | Aug 29 | Public URL, private services, WIF deploy, Sessions/Memory, Pub/Sub, Scheduler |
| M4 — Production and evidence lock | Aug 29 | Cloud evals, 50k Job/economics, traces, IAM, rollback, promoted digests |
| M5 — Loom and internal submission | Aug 30 | 3:45–3:55 video, transcript, guide, incognito validation, Devpost draft/receipt |
| M6 — Freeze and monitor | Aug 31 | Only eligibility/demo-breaking fixes; uptime/quota/spend monitoring |

Critical path:

```text
Google-only fixtures
  -> shared shell/trust grammar
    -> core polish + Orders/Stock/Evidence
      -> local release candidate
        -> approved cloud bootstrap
          -> cloud proofs/evals/benchmark
            -> production digest promotion
              -> Loom + submission
```

Parallel-safe work is limited to documentation, fixture recording, and
frontend polish that does not change API/state contracts. Durable-state,
topology, deployment, and evidence-manifest changes stay serialized.

## 10. Four-minute Loom contract

| Time | Screen/action | Judge takeaway |
|---|---|---|
| 0:00–0:18 | Morning Brief hook and queue compression | A real owner outcome, immediately understandable |
| 0:18–0:55 | Send English human voice; show `202`, then receipt | Messy input becomes a grounded asynchronous action |
| 0:55–1:25 | Upload English ledger; two record, one gate; flash Kiswahili variants | Multimodality is operational, bilingual, and risk-aware |
| 1:25–2:12 | Trigger real Scheduler/Cloud Run Job; show unedited logs and counts | The backend acts on Google Cloud, not in a slide |
| 2:12–2:42 | Review morning decision and approve one safe internal proposal | Human authority is deliberate, not a fallback |
| 2:42–3:18 | Rotate Session and recall grounded usual order | Durable managed context produces practical continuity |
| 3:18–3:43 | Evidence view: ADK graph, services, SHA/digests, evals, economics, trace | Architecture and readiness are tied to the release |
| 3:43–3:55 | Close: “The duka slept; its back office did not.” | Memorable category and Grand Prize positioning |

Use an English fixture in the primary path for judge comprehension. Keep the
Kiswahili fixture visibly verified and available without extending the demo
into two duplicate flows.

## 11. Release gates

### Product

- No placeholder route or unsupported success claim.
- Routine outcome is quiet; owner decisions dominate attention.
- Every model-mediated action exposes its bounded authority.
- English and Kiswahili multimodal paths are clear and tested.

### Safety and durability

- Backend re-derives catalog identity/price and rejects invalid quantity/user.
- Inbound delivery and approvals are idempotent under concurrency.
- Session pointer, approval state, invocation handle, and memory outbox are durable.
- Blocked instructions do not enter later model history or Memory.
- Memory is allowlisted advisory context and cannot authorize financial action.

### Cloud and CI/CD

- GitHub Actions uses WIF; no service-account JSON keys.
- Development deploys from `dev`; production promotes exact tested digests after
  protected manual approval.
- Only web is public; API, worker, and Jobs deny anonymous invocation.
- Context resources are protected from destroy and never recreated by app deploy.
- `APP_NAME`, user-key algorithm, context ID, topology fingerprint, and ADK lock
  remain compatible while suspensions exist.

### Evidence

- Release manifest, app `/version`, GitHub SHA, Artifact Registry digests, Cloud
  Run revisions, Evidence page, Loom, and Devpost all agree.
- Cloud benchmark identifies dataset, seed, model, location, release, execution
  surface, calls, tokens, cost, and timestamps.
- ADK eval results are separate from unit tests.
- Synthetic media and data are labelled; no real customer or payment data.
- Known limitations are visible: no external M-Pesa transfer and no supplier
  order placement.

## 12. Ruthless cut list

Do not delay the submission for:

- Gemini Enterprise Platform breadth beyond the managed Sessions/Memory context
  behavior already required;
- a real WhatsApp Business bridge;
- real M-Pesa transfer or supplier ordering;
- SSE/WebSockets when bounded polling works;
- dark mode, themes, animation, or a marketing landing page;
- a generic component framework or universal data table;
- another model solely for a bonus;
- dashboards that duplicate Evidence without improving the owner journey;
- production multi-tenancy beyond proven per-user isolation;
- mobile-native packaging.

If time compresses, preserve in this order:

1. Google-only bilingual fixtures and honest provenance.
2. Morning → event → ledger → decision → night proof causal flow.
3. Durable Session/Memory and idempotency evidence.
4. Public web/private backend Cloud Run proof.
5. Cloud eval/benchmark/economics and Evidence view.
6. Orders and Stock completeness.
7. Secondary polish.

## 13. Risk register

| Risk | Impact | Mitigation / stop rule |
|---|---|---|
| Non-Google fixture survives | Credibility and ecosystem narrative fail | P0 provider allowlist plus repository scan blocks release |
| Generated ledger text is visually wrong | Multimodal demo looks contrived | Generate candidates, freeze only one that passes human truth review and Gemini extraction |
| Swahili audio is unclear | Demo becomes hard to follow | Purpose-record clean human fixture, reviewed transcript/translation, English primary path |
| Managed resume breaks across revision | Core architecture claim fails | Compatibility lock, 10/10 restart tests, omit refund-resume demo if not proven |
| Cloud bootstrap consumes schedule | No production proof | Local RC before apply; minimal declared services; stop adding scope |
| Public demo abuse/cost | Outage or credits loss | Owner auth, rate/body limits, max instances, budget alert, synthetic users |
| Evidence hardcodes success | Judges spot unverifiable claims | Evidence reads sanitized release manifest; missing artifact renders pending |
| Loom is too technical | Utility score drops | Outcome-first English narration; architecture only after live value is clear |
| Feature polish crowds proof work | Demo readiness remains weak | M0–M4 gates outrank optional screens and dark mode |

## 14. Plan maintenance

- Update task checkboxes only with a link to the evidence artifact or commit.
- Record every cloud mutation in `docs/deployment-runbook.md` and the evidence
  ledger.
- Never overwrite local evidence with cloud evidence; keep environment labels.
- After every pushed release candidate, rerun credential/trailer/fixture scans.
- Any model, location, APP_NAME, context ID, topology, or fixture change
  invalidates affected eval/evidence artifacts.
- Freeze the Loom transcript only after the production SHA and evidence IDs are
  immutable.

## 15. Current references

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js deployment modes](https://nextjs.org/docs/app/getting-started/deploying)
- [Google Cloud Next.js on Cloud Run](https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/aria/sidebar)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/aria/data-table)
- [shadcn/ui Chart accessibility](https://ui.shadcn.com/docs/components/base/chart)
- [Vertex AI image generation](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal-response-generation)
- [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/docs/release-notes)
- [Google Cloud Text-to-Speech audio creation](https://docs.cloud.google.com/text-to-speech/docs/create-audio)
