# Duka Autopilot — Grand-Prize Release Plan v2

> Status: active plan for remaining work
> Created: August 26, 2026
> Baseline commit: `4526871360620148380f134ec72c787481e70d96`
> Baseline branch: private `origin/dev`
> Application plane: `europe-west1`
> Vertex AI and Agent Platform: `global`
> Frontend decision: standalone Next.js Cloud Run service with shadcn/ui

This plan supersedes the sequencing in `docs/hackathon-plan.md` from the first
cloud push onward. The earlier document remains the full decision history,
judging analysis, and A01–A30 source. This document is the shorter execution
contract for the release that judges will use.

## 1. Outcome and non-negotiables

Duka Autopilot must feel like a finished operating product, not a collection of
agent demos. The owner should understand the result within ten seconds:

> The duka slept. Its back office did not.

The application should then prove one causal story:

1. a customer sends messy real-world input;
2. Duka acknowledges it immediately and works asynchronously;
3. exact evidence is settled automatically;
4. Gemini handles only bounded ambiguity;
5. consequential uncertainty stops in one owner queue;
6. managed Sessions and Memory preserve useful context across a new day;
7. the owner starts the morning with a compressed, actionable brief.

Non-negotiables:

- Keep **The Taskmaster** as the core category; Grand Prize follows from the
  highest overall score rather than a separate architecture.
- Keep the FastAPI/ADK API, Pub/Sub worker, and Cloud Run Jobs private.
- Make only the Next.js frontend public.
- Continue using Cloud Run, Firestore, Pub/Sub, Scheduler, Vertex AI, managed
  Sessions, and Memory Bank. Do not add Gemini Enterprise merely for breadth.
- Preserve the trust doctrine: **autonomy where evidence is exact, Gemini where
  reality is messy, a human where consequences matter.**
- Never present a synthetic fixture, local timing, drafted refund, or restock
  proposal as a real external-world effect.
- No service-account keys, no direct browser access to the private API, and no
  secrets in `NEXT_PUBLIC_*` variables.

## 2. Current baseline

### Complete and pushed

- [x] Private `dev` branch pushed at
      `4526871360620148380f134ec72c787481e70d96`.
- [x] Branch/tag push surface scanned: no high-confidence credentials,
      forbidden secret filenames, `Co-Authored-By`, or `Claude-Session` trailers.
- [x] Repository externally confirmed private before the push.
- [x] 107 tests pass against Firestore emulator with zero failures, errors, or
      skips.
- [x] Terraform modules, six workflows, locked Python graph, containers,
      topology compatibility, seed Job, eval package, and evidence framework
      exist.
- [x] Durable managed Session/Memory wiring and retryable Memory outbox exist.
- [x] Synthetic ledger image, hash, and two-record/one-gate truth are frozen.
- [x] Loom transcript and operator guide exist as deliberately unresolved drafts.

### Current external state after first push

- GitHub container builds passed after the first push.
- GitHub CI exposed two clean-runner parity defects: the Firestore emulator
  action installed the emulator but not the `beta` command group, and the
  Terraform locks contained only the local Darwin checksum. The follow-up fix
  installs both emulator components and locks Darwin plus Linux AMD64.
- The follow-up change passes 109 Firestore-emulator tests locally with zero
  failures, errors, or skips; clean-runner proof remains the next gate.
- Development deployment was cancelled because its reusable CI dependency was
  red; the actual deploy job also remains disabled until WIF and development
  infrastructure exist. This is expected gating, not deployment evidence.
- No GCP APIs or resources have yet been mutated by this plan.
- `aiplatform.googleapis.com` remains disabled until explicit bootstrap approval.

## 3. Frontend product thesis

### 3.1 What we are designing

The frontend is a **morning control room for a small shop**, with a live customer
inbox and an evidence-aware night-shift view. It is not:

- a WhatsApp clone;
- a generic SaaS admin template;
- a chatbot wrapped around tables;
- a neon “AI” dashboard;
- a developer trace viewer masquerading as the owner experience.

The interface should communicate calm competence. Routine work is quiet. Risk,
ambiguity, and required decisions are prominent. Technical evidence is one
layer deeper for judges and operators.

### 3.2 The ten-second first impression

The initial authenticated view contains:

- **Autopilot status:** “Night shift complete” with last execution time;
- **Morning outcome:** routine rows settled, exceptions remaining, and queue
  compression;
- **One primary action:** “Review 3 decisions” or “Queue clear”;
- **A compact causal timeline:** received → exact pass → bounded Gemini review →
  morning brief;
- **A truthful environment label:** development, judging, or local synthetic.

The local 97.28% result may appear only as “local synthetic baseline” until the
matching cloud Job result is captured. Production cards must render live cloud
values from `/recon/report`, `/digest/morning`, and the final evidence manifest.

## 4. Information architecture

### Desktop navigation

Use a shadcn sidebar that collapses to icons. Keep the owner’s work organized by
intent rather than backend resource:

| Route | Label | Purpose |
|---|---|---|
| `/` | Morning brief | Outcome-first home and current priorities |
| `/approvals` | Decisions | Unified queue for every human gate |
| `/inbox` | Customer inbox | Async text, photo, and Swahili voice interactions |
| `/night-shift` | Night shift | Reconciliation stages, report, cost, and trigger |
| `/ledger` | Ledger desk | Upload, preview, extraction result, and gated rows |
| `/orders` | Orders | Searchable orders and manual sale creation |
| `/inventory` | Stock | Product levels and restock proposals |
| `/evidence` | How Duka worked | Runtime, trust lanes, traces, release, tests, evals |

Customers can be a filter/drawer within Inbox and Orders rather than a separate
top-level route for the hackathon release.

### Responsive model

- **Desktop ≥1280 px:** collapsible sidebar, main workspace, optional right
  context rail.
- **Tablet:** icon sidebar; context rail becomes a shadcn Sheet.
- **Mobile:** bottom navigation for Brief, Decisions, Inbox, and More; all
  primary actions meet a 44 px touch target.
- The Inbox conversation is full-width on mobile and an optional right-hand
  workspace on desktop. It no longer consumes 380 px on every page.

## 5. Screen contracts

### 5.1 Morning brief

Hero band:

- Duka la Amani identity;
- “Autopilot is on” status with semantic icon and text, not color alone;
- last successful night shift and next scheduled run;
- a restrained line: “Exact evidence settles automatically. Ambiguity waits for
  you.”

Outcome cards:

- settled exactly;
- needs owner review;
- unmatched;
- bounded Gemini cost;
- recent orders.

Below the cards:

- deterministic morning digest in readable prose;
- night-shift stage timeline;
- top three decisions with “Review all”;
- low-stock summary only when actionable.

### 5.2 Decisions

This is the product’s clearest expression of safe agency. Use a filterable data
table on desktop and stacked cards on mobile.

Every decision shows:

- kind and risk level;
- what Duka observed;
- why automation stopped;
- proposed bookkeeping effect;
- evidence or confidence;
- affected customer/order/payment identifier;
- approve and reject actions.

Money-adjacent actions use an AlertDialog that states the precise internal
effect. Copy must say “record approved proposal” or “resume the workflow,” not
“money sent” or “supplier order placed.” Duplicate/in-progress/conflicting
responses render as stable idempotency states, not generic errors.

### 5.3 Customer inbox

Use shadcn Message, Bubble, MessageScroller, and Attachment primitives. The
conversation must show the asynchronous contract visibly:

- customer message or media preview;
- immediate `202 queued` state with event prefix and acknowledgement time;
- processing state that survives navigation;
- final agent reply;
- expandable execution receipt: node path, wall time, tokens, cost, suspended
  state, and request/event identifier.

Composer:

- text field;
- image/audio attachment with visible upload state;
- press-and-hold or explicit start/stop voice recording;
- customer selector;
- “new day” action with a confirmation explaining that managed Memory—not raw
  chat history—carries the usual order forward.

Poll every second only while a reply is outstanding, back off to five seconds
when idle, and pause when the tab is hidden. SSE is a post-release enhancement;
do not delay the core flow for a new transport.

### 5.4 Night shift

Present the workflow as three trust lanes:

1. **Exact** — indexed deterministic reconciliation;
2. **Gemini** — bounded residue batches only;
3. **Owner** — ambiguous or consequential proposals.

Show:

- Job status and execution time;
- generated, unique, duplicate, exact, residue, and proposal counts;
- settle-rate chart with accessible labels;
- batch size, batch ceiling, and stop-on-no-progress policy;
- model tokens and measured cost;
- release SHA and immutable backend digest;
- “Run night shift” action guarded by environment and owner confirmation.

The Loom must still trigger the real schedule/Job in Google Cloud. The UI action
is operational convenience, not a substitute for Scheduler evidence.

### 5.5 Ledger desk

Use a two-stage workflow:

1. drag/drop or choose a JPEG/PNG/WebP and preview it with filename, size, MIME,
   and validation state;
2. show the returned extraction receipt plus the resulting recorded and gated
   rows.

For the frozen fixture, the expected result is two recorded rows and one gated
unreadable amount. The UI must never display an invented value for that row.

### 5.6 Orders and manual sale

- TanStack-backed shadcn Data Table with search, status filter, sorting, and
  responsive row detail Sheet;
- KSh formatting using `Intl.NumberFormat` and integer source values;
- manual sale in a Dialog or dedicated split view;
- catalog-derived price displayed as read-only;
- quantity validation and line totals;
- clear paid/confirmed semantics;
- success links directly to the created order.

### 5.7 Evidence

This is judge-facing but truthful and useful to an operator. It should show:

- deployed release SHA and image digests;
- model and global endpoint;
- durable topology fingerprint and compatibility state;
- Cloud Run service/Job status summaries;
- exact/Gemini/human architecture;
- latest benchmark labels and source environment;
- deterministic test and ADK eval counts;
- sanitized correlation IDs and trace link where authorized;
- synthetic-data and pre-existing-work disclosures;
- known limitations: no external M-Pesa transfer and no supplier order effect.

Do not expose secrets, raw prompts, phone-derived Memory keys, inline media, or
private Google Cloud console data to anonymous visitors.

## 6. Visual design system

### Direction: operational warmth

Use a warm, grounded visual language inspired by paper ledgers and practical
shop tools—without “African” clichés, flags, safari motifs, or decorative
ethnography.

Suggested semantic palette in OKLCH tokens:

- warm ivory canvas;
- ink/charcoal foreground;
- deep shop green primary;
- amber for human attention;
- clear blue for bounded Gemini work;
- red reserved for destructive/conflict states;
- muted green for deterministic completion.

The three trust lanes must use icon + label + color:

- check/grid = exact;
- sparkle/bounded brackets = Gemini;
- hand/shield = owner.

Typography:

- Manrope or Geist Sans through `next/font`, bundled at build time;
- Geist Mono or IBM Plex Mono for event IDs, SHAs, costs, and node paths;
- tabular numerals for financial and benchmark cards.

Surface rules:

- 12–16 px radii, light borders, restrained shadows;
- generous white space and clear grouping;
- no gradient headline text, glowing orbs, glassmorphism, or constant animation;
- subtle ledger-grid texture only in empty/hero backgrounds;
- Lucide icons with accessible labels;
- 150–220 ms purposeful transitions and `prefers-reduced-motion` support.

Dark mode is supported through semantic tokens but is P1. Light mode is the
recording baseline because it remains more legible in Loom compression.

## 7. shadcn/ui composition

Use the `new-york` style, Tailwind CSS v4, React 19, and the Radix-backed
component set. Components are copied into the repository and owned by the
project.

P0 components:

- Sidebar, Breadcrumb, Card, Badge, Button, Separator;
- Message, Bubble, MessageScroller, Attachment;
- Table/Data Table, Tabs, Select, Input, Textarea, Checkbox;
- Dialog, AlertDialog, Sheet, Dropdown Menu, Tooltip, Popover;
- Skeleton, Spinner, Progress, Empty, Sonner;
- Chart with Recharts v3 and accessibility layer enabled.

Do not build a generic `DataTable` abstraction before the Orders and Decisions
column contracts are understood. Share small primitives—status badge, money,
execution receipt, trust-lane badge—rather than a universal table framework.

## 8. Next.js architecture

### 8.1 Project shape

Create `frontend/` as a self-contained application:

```text
frontend/
  src/app/
    (auth)/login/
    (control-room)/
      page.tsx
      approvals/
      inbox/
      night-shift/
      ledger/
      orders/
      inventory/
      evidence/
    api/[...path]/route.ts
    health/route.ts
    ready/route.ts
  src/components/
    ui/
    control-room/
    inbox/
    decisions/
    evidence/
  src/lib/
    api/server-client.ts
    api/browser-client.ts
    api/contracts.ts
    auth/
    format/
    telemetry/
  instrumentation.ts
  public/
  components.json
  next.config.ts
  package.json
  pnpm-lock.yaml
```

Technology lock for implementation:

- Next.js 16 App Router;
- React 19;
- Node.js 24 LTS in build/runtime containers;
- TypeScript strict mode;
- pnpm with a committed frozen lock;
- Tailwind CSS v4;
- shadcn/ui `new-york` style;
- Zod at all API response/request boundaries;
- TanStack Query only for interactive polling/mutations; Server Components for
  initial reads;
- Vitest + Testing Library for components/contracts;
- Playwright + axe for critical journeys and accessibility.

Pin exact package and base-image versions/digests during scaffolding. Do not use
floating `latest` in the release Dockerfile or CI.

### 8.2 Server/client boundary

Default layouts and initial page reads to Server Components. Use Client
Components only for browser APIs, recording, file selection, polling, charts,
dialogs, and mutations.

Server Components call the private FastAPI service directly through a
`server-only` data-access module. They must not call the public Next Route
Handler and incur an unnecessary loopback request.

Browser mutations and polling call a single allowlisted Route Handler under
`/api/[...path]`. That handler replaces `app/web.py` and must:

- accept only the declared method/path matrix;
- reject path traversal and unknown routes;
- enforce content type, request-size, media MIME, and timeout limits;
- forward request ID, trace context, owner cookie, and safe response headers;
- obtain a Google-signed ID token with `google-auth-library` using the private
  API URL as audience;
- send the token server-to-server; never expose it to the browser;
- preserve backend `Set-Cookie` on login/logout;
- return normalized, non-sensitive upstream failures.

Keep authorization in both layers: Next is a BFF and convenience boundary;
FastAPI remains the authoritative owner/channel authorization boundary.

### 8.3 Caching

The control room is operational and user-specific:

- use `cache: "no-store"` for orders, approvals, messages, reports, costs, and
  readiness;
- cache only immutable hashed frontend assets;
- do not introduce ISR or cross-instance cache invalidation for live business
  state;
- package static assets in the standalone image.

This avoids multi-instance stale-state coordination while keeping the frontend
service horizontally safe.

### 8.4 Auth

Replace the JavaScript prompt with `/login`:

- password field with show/hide, pending, invalid, and rate-limit states;
- submit only to the Next Route Handler;
- backend continues signing the HttpOnly owner session cookie;
- cookie remains `Secure`, `HttpOnly`, scoped, and SameSite-protected;
- Next `proxy.ts` may perform only an optimistic cookie-presence redirect;
- every Server Component data read, mutation, and Route Handler still verifies
  the backend response/authorization.

### 8.5 Observability

- use `instrumentation.ts` in the Node runtime;
- emit W3C `traceparent`/`tracestate` through the private API call;
- retain request/event/approval/session IDs as structured attributes;
- export server traces through OTLP to Cloud Trace using the runtime identity;
- use `onRequestError` for sanitized server errors;
- report Core Web Vitals without adding third-party tracking before judging.

## 9. Cloud Run delivery

Replace the Python frontend image with a multi-stage Next.js image:

1. `deps` stage installs from `pnpm-lock.yaml` with frozen lock;
2. `build` stage runs lint, typecheck, tests where appropriate, and `next build`;
3. runner copies `.next/standalone`, `.next/static`, and `public`;
4. runtime uses Node 24 LTS, non-root UID/GID 10001;
5. set `HOSTNAME=0.0.0.0` and honor Cloud Run `PORT=8080`;
6. expose `/health` and `/ready` Route Handlers;
7. add startup and liveness HTTP probes;
8. label image with Git SHA and retain immutable digest promotion.

Cloud Run settings:

- service remains `duka-ENV-web`;
- only this service permits unauthenticated invocation;
- runtime SA receives only private API invoker and trace-writer permissions;
- API URL is server-only `DUKA_API_URL`;
- judging can use min instances 1 if cold-start rehearsal proves it materially
  improves the first ten seconds and the cost envelope allows it;
- cap max instances and concurrency in Terraform;
- handle `SIGTERM` through normal Node server shutdown behavior and keep route
  work request-bounded.

Terraform and GitHub updates:

- keep Artifact Registry image name `duka-frontend`;
- change frontend build context and Dockerfile, not service identity;
- add Node/pnpm cache and frontend test gates to CI;
- keep backend/worker/Job images unchanged;
- update smoke test to verify HTML shell, `/health`, `/ready`, `/api/version`,
  authentication redirect, and private API denial;
- promote the exact tested frontend digest to production.

## 10. API parity contract

The Next cutover is complete only when these current capabilities remain:

| Capability | FastAPI endpoint | Next surface |
|---|---|---|
| Owner login/logout | `/auth/login`, `/auth/logout` | `/login`, account menu |
| Morning brief | `/digest/morning`, `/recon/report`, `/metrics/costs` | `/` |
| Decisions | `/approvals`, `/approvals/{id}` | `/approvals` |
| Async inbox | `/inbound`, `/messages/{customer}` | `/inbox` |
| Session rotation | `/sessions/new` | Inbox “New day” dialog |
| Ledger | `/ledger` | `/ledger` |
| Nightly run/report | `/recon/nightly`, `/recon/report` | `/night-shift` |
| Orders | `/orders`, `/customers`, `/products` | `/orders` |
| Restock | `/restock/check` | `/inventory` |
| Runtime proof | `/version`, `/ready` | `/evidence` |

Generate TypeScript schemas from explicit handwritten Zod contracts for this
release. Do not add an OpenAPI code-generation toolchain unless API drift makes
manual contracts demonstrably unsafe within the timebox.

## 11. Frontend quality gates

### Functional journeys

1. Login → Morning brief renders live data.
2. Review approval → exact pending/resuming/final state → duplicate click causes
   one effect.
3. Send text → see `202` → receive async reply → execution receipt.
4. Record/attach Swahili voice → grounded usual order at current catalog price.
5. Upload frozen ledger → two recorded, one gated.
6. New day → old raw context absent → managed Memory recalls usual order.
7. Run/observe night shift → report and cost cards refresh.
8. Create manual sale → price remains catalog-derived.
9. Direct private API request fails; same operation through BFF succeeds.
10. Evidence page agrees with final SHA/digests/runtime.

### Automated gates

- TypeScript strict check;
- ESLint and formatting;
- unit tests for Zod contracts, formatters, trust badges, approval copy, and
  proxy allowlist;
- component tests for all loading/empty/error/conflict states;
- Playwright at desktop 1440×900 and mobile 390×844;
- axe: zero serious/critical violations on login, brief, decisions, inbox,
  ledger, and night shift;
- keyboard-only approval and upload journeys;
- reduced-motion screenshot suite;
- no hydration errors or uncaught browser console errors;
- production build and standalone container smoke;
- Lighthouse targets on the authenticated shell: performance ≥85, accessibility
  ≥95, best practices ≥95. Treat these as targets, not spoken claims unless the
  final report is saved.

### Visual states that must be designed

- cold start;
- initial skeleton;
- empty queue;
- queue with every approval kind;
- async processing;
- suspended workflow;
- conflict/idempotent replay;
- offline/private API unavailable;
- rate limited;
- upload too large/wrong MIME;
- no Memory found;
- Memory service degraded while the business action succeeded;
- mobile navigation and long identifiers.

## 12. Consolidated work plan

### Phase R0 — unblock and stabilize

Goal: finish the first-push feedback and authorize the cloud foundation.

- [ ] Confirm GitHub CI at `4526871` passes; fix only real failures through a new
      commit.
- [ ] Document the expected deploy cancellation while
      `GCP_DEV_DEPLOY_ENABLED=false`.
- [ ] Obtain explicit approval for API enablement and Terraform bootstrap.
- [ ] Read project number and billing/credit status without exposing tokens.
- [ ] Review bootstrap/app Terraform plans and estimated judging-window spend.
- [ ] Enable declared APIs; create state bucket, Artifact Registry, WIF,
      identities, secrets, and GitHub environments.
- [ ] Run the minimal global model and Agent Platform context probe.

Exit: WIF authenticates, dev infrastructure plan is approved, and no JSON key
exists.

### Phase F1 — Next foundation

Goal: a tested standalone shell running locally in a production container.

- [ ] Scaffold `frontend/` with the locked stack and committed pnpm lock.
- [ ] Initialize shadcn/ui and semantic OKLCH tokens.
- [ ] Implement typography, responsive shell, sidebar/mobile nav, dark-token
      support, loading/error boundaries, and `/login`.
- [ ] Implement server-only private API client, Google ID-token provider, Zod
      contracts, and allowlisted catch-all Route Handler.
- [ ] Add health/readiness/version surfaces and OpenTelemetry instrumentation.
- [ ] Replace `deployment/docker/frontend.Dockerfile` with pinned standalone
      Node image and non-root runtime.
- [ ] Add frontend CI: install, lint, typecheck, unit, build, container smoke.

Exit: local Next container proxies `/api/version`, denies an unknown path, and
passes auth/cookie, health, and non-root smoke tests.

### Phase F2 — demo-critical product experience

Goal: every action in the four-minute Loom is polished and truthful.

- [ ] Morning brief with outcome cards, digest, decisions preview, and trust
      timeline.
- [ ] Decisions page with kind-specific evidence, exact-effect confirmation,
      idempotent/conflict states, and responsive layout.
- [ ] Inbox with adaptive polling, audio recording, attachments, `202` receipt,
      node-path disclosure, and new-day Memory explanation.
- [ ] Ledger desk with frozen fixture preview and two-record/one-gate result.
- [ ] Night-shift view with exact/Gemini/human lanes and measured report.
- [ ] Evidence view with release, topology, benchmark labels, disclosures, and
      known limitations.
- [ ] Orders table and catalog-derived manual sale.

Exit: the entire transcript click path succeeds locally without using the legacy
HTML frontend.

### Phase F3 — design QA and cutover

Goal: the Next service becomes the only frontend release candidate.

- [ ] Build Playwright fixtures against SQLite/local bus and deterministic API
      data.
- [ ] Pass desktop/mobile, keyboard, axe, reduced-motion, and visual regression
      gates.
- [ ] Run a second-person usability rehearsal: first useful action in <15 sec;
      no explanation required to find Decisions, Inbox, or Night shift.
- [ ] Update Terraform, workflows, architecture diagram, runbook, and evidence
      to name the Next service accurately.
- [ ] Remove `app.web` and `app/static/index.html` from the frontend image after
      parity is proven. Retain history, not two production frontends.
- [ ] Rebuild both release images and rerun Python 107+ and frontend suites.

Exit: no documentation or image claims the Python HTML UI is deployed.

### Phase C1 — development cloud deployment

Goal: one genuine cloud causal loop.

- [ ] Apply development Terraform through the approved operator path.
- [ ] Configure custom Memory Bank topic before executing seed Job.
- [ ] Set `GCP_DEV_DEPLOY_ENABLED=true`; push a reviewed commit; let GitHub WIF
      build and deploy immutable digests.
- [ ] Execute seed Job twice and prove counts plus idempotency.
- [ ] Prove public Next → private API and direct API denial.
- [ ] Prove text event, duplicate event, retry/DLQ, security block, ledger,
      voice, and approval flows with correlated evidence.
- [ ] Prove managed Session restart/rotation/refund resume and cross-session
      Memory isolation.
- [ ] Trigger Scheduler → Cloud Run Job and save the exact report/cost.

Exit: A01–A29 have authoritative cloud evidence or an explicit documented cut.

### Phase Q1 — evals, benchmark, and release candidate

Goal: maximize the 40/30/30 judging score with evidence.

- [ ] Run all 20 ADK eval cases with the locked judge and three samples.
- [ ] Add/verify critical Swahili, multimodal, injection, unknown-usual, stale
      catalog, and money-wording trajectories.
- [ ] Run the 50,000-row Job once in cloud and reconcile all counts.
- [ ] Measure Cloud Run duration, model tokens, Firestore operations, Memory
      generation/retrieval, and total cost separately.
- [ ] Promote exact dev digests to protected production.
- [ ] Drill production rollback in under five minutes.
- [ ] Freeze evidence ledger, manifests, SHA, digests, URLs, and architecture.

Exit: no spoken claim lacks a raw release-tied artifact.

### Phase D1 — Loom and submission

Goal: a 3:45–3:55 proof-first story.

- [ ] Purpose-record the frozen human Swahili voice file; hash and validate it.
- [ ] Replace every transcript/guide placeholder from final evidence.
- [ ] Rehearse three times with timings and a second operator.
- [ ] Record one visibly unedited live cloud segment in Loom.
- [ ] Correct captions and verify incognito playback.
- [ ] Publish the technical article with the required hackathon statement.
- [ ] Publish the exact `#AllThingsAgenticHackathon` social post.
- [ ] Verify judge repository access, hosted URL, architecture image,
      disclosures, and spin-up guide.
- [ ] Submit Devpost and save the receipt before the internal deadline.

Exit: submission is submitted—not draft—and every link works in a clean browser.

## 13. Priority cut line

### P0 — required to compete

- cloud foundation and WIF;
- Next shell/BFF/login;
- Morning brief, Decisions, Inbox, Ledger, Night shift, Orders, Evidence;
- voice and ledger multimodal proof;
- durable Session/Memory proof;
- Scheduler/Job proof;
- tests/evals/benchmark/economics;
- Loom, architecture, disclosures, hosted URL, Devpost.

### P1 — do after P0 evidence is green

- Inventory page beyond the restock summary;
- dark-mode polish;
- command palette and keyboard accelerators;
- richer charts and customer drill-down;
- min-instance optimization based on measured cold start;
- one short real-owner usability quote or observed time saving.

### P2 — cut without regret

- SSE/WebSocket transport;
- PWA/offline mode;
- multilingual dashboard localization;
- multi-shop tenancy;
- external M-Pesa/supplier integrations;
- generative decoration, avatars, or animations;
- Gemini Enterprise Platform deployment beyond the managed context services
  already required for Sessions and Memory.

## 14. Definition of done

The goal is not complete until all are true:

- private GitHub release history is judge-accessible and CI is green;
- public Next Cloud Run service is live and the only public application;
- API, worker, and Jobs deny unauthorized direct use;
- one real event and one scheduled night shift complete in cloud;
- restart-safe HITL and cross-session Memory work on managed services;
- voice and ledger modalities pass the final release;
- duplicate messages and decisions create exactly one effect;
- tests, ADK evals, cloud benchmark, economics, traces, WIF, and rollback are
  tied to one SHA and immutable digests;
- the architecture depicts only deployed components;
- Loom is under four minutes, captioned, and public;
- disclosures and limitations are explicit;
- Devpost has a saved submission receipt.

## 15. Official implementation basis

- [Next.js App Router installation and current requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js 16 upgrade/runtime guidance](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js Backend-for-Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)
- [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [shadcn/ui Tailwind v4 and React 19 guidance](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui component catalog](https://ui.shadcn.com/docs/components)
- [shadcn/ui chat components](https://ui.shadcn.com/docs/changelog/2026-06-chat-components)
- [shadcn/ui chart component](https://ui.shadcn.com/docs/components/base/chart)
- [Cloud Run service-to-service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)
- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Cloud Run health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)

## 16. Immediate next actions

1. Push the clean-runner portability fix and require its replacement CI run to
   pass before frontend implementation begins.
2. Keep the development deployment gate disabled until WIF and infrastructure
   exist; a skipped deploy is not cloud evidence.
3. Obtain explicit cloud bootstrap/API enablement approval in parallel with the
   Next design implementation.
4. Scaffold `frontend/` and establish tokens/BFF/container before building
   screens.
5. Deliver screens in Loom order: Brief → Inbox → Ledger → Night shift →
   Decisions → Evidence.
