# Duka Autopilot — Grand-Prize Execution Plan

> Status: active delivery contract
> Last updated: August 26, 2026
> Core track: The Taskmaster
> Prize objective: win Taskmaster or the automatically adjudicated Grand Prize
> Internal submission deadline: August 30, 2026 at 20:00 EAT
> Official deadline: August 31, 2026 at 17:00 PT / September 1 at 03:00 EAT
> Runtime decision: Cloud Run, deployed through GitHub Actions
> Durable context decision: Agent Platform Sessions plus Memory Bank
> Cloud project: `my-duka-autopilot`; hackathon credits applied; ADC quota project set
> Application region: `europe-west1`; Vertex AI and Agent Platform context: `global`
> Repository: private `jmwai/duka-autopilot` remote verified locally; no push authorized yet
> Demo delivery: Loom recording, preceded by a timecoded transcript and reproducible recording/demo guide

This document is the execution contract for the remaining hackathon work. It
replaces the earlier feature-oriented schedule with measurable goals, milestone
gates, a cloud and CI/CD contract, a critical path, acceptance tests, evidence
requirements, demo choreography, scope cuts, and submission-freeze controls.

## 1. Executive objective

Duka Autopilot will be presented as:

> **The autonomous night shift for an independent Kenyan shop.**

The product turns Swahili voice notes, handwritten ledger photographs, and
synthetic mobile-money statement records into structured orders, reconciled
books, restock drafts, and a small morning exception queue.

The central architectural line is:

> **Autonomy where evidence is exact. Gemini where reality is messy. A human
> where consequences matter.**

The submission must prove one continuous operational story:

1. A customer event is accepted immediately.
2. Pub/Sub delivers it to an ADK workflow.
3. The workflow screens, classifies, routes, and performs a real business
   mutation without owner intervention.
4. A scheduled Cloud Run Job performs the night shift.
5. Deterministic code settles exact evidence at scale.
6. Gemini receives only bounded ambiguity and can file proposals, not declare
   uncertain money paid.
7. The owner wakes to a compressed exception queue and deterministic digest.

The project will not be positioned as a collection of chatbots or a generic
platform for all African SMEs. It will lead with one shop, one night, and one
complete workflow. Broader market potential belongs at the end.

## 2. Locked strategic decisions

| Decision | Contract |
|---|---|
| Core category | Stay in Taskmaster. Grand Prize is pursued through the highest overall score, not a category switch. |
| GCP project | Use `my-duka-autopilot`. Local Application Default Credentials have `my-duka-autopilot` set as their quota project. |
| Application region | Use `europe-west1` for Cloud Run, Artifact Registry, Firestore, Pub/Sub, and Scheduler. Keep the configured Vertex model and Agent Platform context endpoints on `global`. |
| Repository | Use private GitHub repository `jmwai/duka-autopilot`. Keep the remote unpushed until GitHub Actions/WIF execution is required and the pre-push gate passes. |
| Runtime | Cloud Run remains the execution plane. Duka code will not migrate to full Agent Runtime before submission. |
| Frontend | A public Cloud Run frontend/BFF serves the UI and proxies authenticated application calls. |
| Backend | A private API service and private Pub/Sub worker run on Cloud Run. |
| Batch work | The nightly workflow runs as a Cloud Run Job, not as a long HTTP request. |
| Business state | Firestore is the durable source of truth for orders, payments, approvals, messages, reports, event receipts, and active-session pointers. |
| Conversation state | Agent Platform Sessions stores durable ADK session events, state, and resumability data. |
| Long-term memory | Memory Bank stores allowlisted, grounded customer preferences across sessions. It is advisory context, never business truth. |
| Agent context resource | One protected context-only Agent Platform resource per environment backs both Sessions and Memory Bank. Application deploys must never recreate it. |
| CI/CD | GitHub Actions uses OIDC Workload Identity Federation and dedicated deployer service accounts. No JSON service-account keys. |
| Release model | Build once, tag by Git SHA, promote exact image digests, smoke test, then shift traffic. |
| Production authorization | Production promotion is a manual GitHub workflow using a protected environment after tests and ADK evals pass. |
| Model | Preserve the repository default, Gemini 3.7 Flash, unless the owner explicitly changes it. Treat a 404 as a location/configuration problem first. |
| Data | Demo and benchmark data remain synthetic. No real customer or payment data. |
| Integrations | WhatsApp-like, mobile-money, refund, and supplier effects are simulated and disclosed. |
| Demo recording | Record and host the final sub-four-minute video with Loom. Maintain a timecoded, manually reviewed transcript and a separate recording/demo guide. |
| Internal cut | Optional feature work stops August 30 at 12:00 EAT. Submission is complete by 20:00 EAT. |

These choices are planning inputs, not authorization to mutate cloud resources,
push the private repository, or publish the Loom recording. The first push is
made only when the Phase 4 pre-push audit passes and GitHub Actions/WIF are ready
to execute; cloud deployment remains a separately approval-gated action.

### Owner-confirmed configuration checkpoint — August 26, 2026

- The active GCP project is `my-duka-autopilot`, and hackathon credits have been
  applied to it.
- Local Application Default Credentials use `my-duka-autopilot` as the quota
  project via `gcloud auth application-default set-quota-project
  my-duka-autopilot`.
- The application data plane is locked to `europe-west1`. Vertex AI model and
  Agent Platform Sessions/Memory Bank endpoints remain `global` where required
  by the selected services.
- The configured `origin` is the private repository
  `git@github.com:jmwai/duka-autopilot.git`. It remains intentionally unpushed;
  a first push requires the Phase 4 pre-push audit and explicit authorization.
- Loom is the delivery platform for the final demo. The recording cannot begin
  until `docs/demo-transcript.md` and `docs/demo-guide.md` exist, match the
  release candidate, and pass a timed rehearsal.

## 3. Current baseline

### Already complete

- [x] GCP project `my-duka-autopilot` created.
- [x] Hackathon credits applied.
- [x] Local ADC quota project set with
      `gcloud auth application-default set-quota-project my-duka-autopilot`.
- [x] Application region locked to `europe-west1`.
- [x] Private Git remote configured as `jmwai/duka-autopilot`; no push is
      authorized yet.
- [x] Taskmaster selected as the core track.
- [x] Gemini 3.7 Flash configured through Vertex AI.
- [x] Explicit ADK workflow graph with deterministic screen and allowlisted
      routing.
- [x] Order, support/refund, ledger, reconciliation, restock, and digest paths.
- [x] Local SQLite and cloud Firestore Store seam.
- [x] Local bus and Pub/Sub publisher seam.
- [x] Asynchronous inbound endpoint returning HTTP 202.
- [x] Deterministic indexed reconciliation and seeded 50,000-row stress
      generator.
- [x] Bounded fuzzy residue batches and a hard nightly model-call ceiling.
- [x] Graph-native refund suspension and approval metadata.
- [x] Intake, support, and safety ADK evalsets with 20 schema-valid cases.
- [x] Current complete local release audit: 107 tests pass with zero failures,
      errors, or skips against Firestore emulator 1.22.0, including backend
      parity for deduplication, leases, durable pointers, approval transactions,
      the Memory outbox, and the locked Vertex SDK Memory configuration schema.
- [x] Architecture, submission, disclosure, and blog drafts.
- [x] Root `DESIGN_SPEC.md` established as the implementation contract.
- [x] `docs/deployment-matrix.md` records locked project, region, repository,
      environment, identity, and resource decisions.
- [x] Reproducible frontend/backend container definitions and distinct API,
      Pub/Sub worker, and Cloud Run Job entry points exist locally; both images
      have passed local health/readiness smoke tests.
- [x] Initial bootstrap and application Terraform modules exist locally for
      review; they are scaffolding only and have not been initialized, applied,
      or treated as cloud evidence.

### Release blockers

- [ ] The private remote has not been pushed and judge access has not yet been
      verified.
- [ ] Terraform and six GitHub Actions workflows exist and pass local format,
      provider-schema, and `actionlint` checks. A real Terraform plan, policy
      review, WIF run, push, and apply are still pending. Direct and transitive
      Python dependencies are pinned in `pyproject.toml` and `uv.lock`.
- [ ] No deployed Cloud Run services or Job.
- [ ] No cloud execution evidence.
- [ ] Pub/Sub bounded retry and DLQ are not provisioned.
- [ ] The Agent Platform context resources and custom Memory Bank topic are not
      provisioned or cloud-verified. The narrow topic, examples, scope, TTL,
      and awaited ingestion contract are implemented and validated locally
      against the locked Vertex SDK.
- [ ] PII-safe structured logging, W3C propagation, and direct OTLP/gRPC export
      are implemented locally; end-to-end Cloud Trace ingestion is not yet
      proven.
- [ ] Real-cloud restart/resume, cross-session memory, model eval, and
      multimodal acceptance scenarios remain unproven.
- [ ] Local owner-authentication controls exist, but the final Cloud Run IAM,
      BFF/session flow, CORS, payload limits, MIME checks, and negative route
      exposure tests are not yet proven in cloud.
- [ ] Local no-model economics evidence is committed: 50,000 generated rows,
      49,750 unique synthetic rows, 48,402 exact matches, 1,354 residue, and
      97.28% deterministic settlement in 812 ms on the recorded workstation.
      Cloud economics, ADK eval results, audio proof, Gemini ledger-extraction
      proof, and restart/resume proof remain outstanding. The stable synthetic
      ledger bitmap, hash, and ground truth are frozen locally.
- [ ] The ADK eval gate is correctly packaged and now fails closed on a failed
      case even when the ADK CLI exits zero. The first authenticated model-eval
      attempt is blocked because the Agent Platform API has not yet been
      enabled; API enablement remains approval gate A.
- [ ] Some product copy implies real external effects or unmeasured economics.

## 4. Goals and key results

| ID | Goal | Release key result | Evidence |
|---|---|---|---|
| G1 | Complete and compliant submission | Judge-accessible repository, hosted URL, architecture, spin-up guide, public Loom video under four minutes, reviewed transcript, demo guide, disclosures, and Devpost receipt all verified by August 30 | Incognito checklist and submission receipt |
| G2 | Prove autonomous operational value | One inbound event completes routing, persistence, and reply without an owner; one scheduled night shift completes reconciliation, restock scan, report, and digest | End-to-end trace, Firestore before/after, Job execution |
| G3 | Prove safe autonomy | Duplicate delivery creates one business result; no LLM-only path invents catalog facts or directly marks an uncertain payment paid | Invariant tests, replay test, tool-trajectory eval |
| G4 | Prove durable execution | A suspended refund survives restart or revision change and resumes exactly once | Managed Session record, approval state machine, trace |
| G5 | Prove useful memory | A confirmed usual order is recalled in a new session, while current catalog price is fetched from the catalog and cross-user leakage is zero | Memory Bank console evidence and curated eval report |
| G6 | Prove production architecture | Frontend, API, worker, and nightly Job are deployed by GitHub Actions using WIF, dedicated identities, immutable digests, and rollback controls | GitHub run, release manifest, IAM screenshots |
| G7 | Prove measured economics | Cloud benchmark records rows, exact matches, residue, wall time, batches, tokens, model cost, Firestore operations, and total Job duration | Raw benchmark JSON and docs/economics.md |
| G8 | Maximize judging score | Internal review reaches at least 4.7/5 in each base criterion with no Stage One compliance gap | Internal rubric and evidence ledger |
| G9 | Capture straightforward bonuses | Public technical article and exact-hashtag social post published after release URLs stabilize | Public URLs in submission |

### Quantitative release targets

- HTTP 202 acknowledgement: p95 below 1.5 seconds over ten synthetic requests.
- Async reply: target below 30 seconds for the recorded demo path.
- Duplicate event delivery: zero duplicate orders, replies, approvals, or cost
  rows.
- Nightly Job: three consecutive successful executions.
- Durable refund: ten out of ten restart/revision resume attempts for approval
  and rejection, with zero duplicate resumes.
- Memory recall: at least 90% correct retrieval on a curated multilingual set,
  zero cross-user memories, and zero memory-derived financial actions.
- Safety-critical ADK trajectories: zero failures.
- Firestore-emulator parity suite: no skips in the release candidate.
- Production rollback drill: restore the preceding revision and Job image in
  under five minutes.
- Loom demo video: target 3:45–3:55; never exceed four minutes; transcript and
  guide match the final cut.

## 5. Scope and explicit non-goals

### P0 — cannot be cut

- GitHub repository, GitHub Actions, and WIF authentication.
- Cloud Run frontend, API/worker path, and nightly Job.
- Firestore, Pub/Sub, Scheduler, Vertex AI, Sessions, Memory Bank, Logging, and
  Trace.
- Backend-neutral IDs, deterministic tool validation, event idempotency,
  bounded retries, and DLQ semantics.
- Authenticated owner and infrastructure operations.
- Durable active-session mapping and refund resume.
- One grounded cross-session memory example.
- One unattended intake path and one complete scheduled night shift.
- Deterministic tests, Firestore parity tests, ADK evals, cloud benchmark, and
  trace evidence.
- Public Loom video, reviewed transcript, recording/demo guide, architecture
  diagram, reproducible instructions, honest disclosures, and submission
  receipt.

### P1 — keep if P0 is green

- Ledger-photo demonstration.
- Restock proposal.
- Real shop-owner validation and a consented quote.
- Published blog and social bonuses.
- Polished evidence dashboard.
- Model Armor as an additional layer after the deterministic screen remains
  authoritative.

### P2 — cut first

- Chirp audio digest or any additional bonus model.
- Agent Registry, Agent Gateway, or migration of Duka code to full Agent
  Runtime.
- Real WhatsApp, M-Pesa, refund-transfer, or supplier-order integration.
- Multi-tenancy, multi-region, GKE, Cloud SQL, or separate GCP projects.
- Extra agents, an elaborate UI redesign, or general-purpose platform features.

### Claims the submission will not make

- It will not call the 50,000-row dataset a normal month for one small shop; it
  is a reproducible stress test.
- It will not claim a sub-dollar run until the measured cloud artifact proves
  it.
- It will not imply Safaricom, WhatsApp, supplier, or payment-provider
  affiliation.
- It will not claim that Duka sends refunds or places supplier orders.
- It will not claim every bookkeeping mutation requires approval. Exact
  evidence may update bookkeeping deterministically.
- It will not claim audio and image semantics are screened by the current text
  rule engine.
- It will not claim Memory Bank is an authorization source or source of current
  product price.

## 6. Target cloud architecture

~~~mermaid
flowchart LR
    CUSTOMER["Customer or owner browser"] --> WEB["duka-ENV-web<br/>Public Cloud Run frontend + BFF"]
    WEB -->|"Service identity"| API["duka-ENV-api<br/>Private Cloud Run API"]
    API -->|"Publish event + return 202"| TOPIC["Pub/Sub inbound topic"]
    TOPIC -->|"Authenticated push"| WORKER["duka-ENV-worker<br/>Private Cloud Run worker"]

    SCHED["Cloud Scheduler<br/>02:00 Africa/Nairobi"] -->|"jobs.run"| JOB["duka-ENV-nightly<br/>Cloud Run Job"]

    WORKER --> GRAPH["ADK workflow"]
    API --> GRAPH
    JOB --> GRAPH

    GRAPH --> MODEL["Vertex AI<br/>Gemini 3.7 Flash"]
    GRAPH --> STORE["Firestore<br/>business + control state"]
    GRAPH --> CONTEXT["Agent Platform context resource<br/>Sessions + Memory Bank"]
    GRAPH --> OBS["Cloud Trace + structured Logging"]

    STORE --> API
    API --> WEB
    TOPIC --> DLQ["Dead-letter topic"]
    GHA["GitHub Actions<br/>OIDC WIF"] --> AR["Artifact Registry<br/>immutable digests"]
    AR --> WEB
    AR --> API
    AR --> WORKER
    AR --> JOB
~~~

### Runtime units

| Unit | Image | Access | Purpose | Initial scaling |
|---|---|---|---|---|
| duka-ENV-web | duka-frontend | Public | Static UI, demo login/session, and server-side proxy to private API | 0–2; optional min 1 during judging |
| duka-ENV-api | duka-backend | Private to frontend identity | API, owner operations, event publication, read models | 0–3, concurrency 8 |
| duka-ENV-worker | duka-backend | Private to Pub/Sub invoker | Push-only event consumer and ADK execution | 0–3, concurrency 1 initially |
| duka-ENV-nightly | duka-backend | Scheduler/manual invocation only | Exact pass, bounded fuzzy proposals, restock, report, digest | One task, parallelism 1 |
| duka-ENV-seed | duka-backend | Manual operator invocation only; never scheduled | Idempotently initialize an empty synthetic demo environment | One task, parallelism 1; no force reset |

The backend image will expose separate entry points for API, worker, and Job.
The worker service will expose only push and health endpoints. The nightly
entry point will print a structured JSON report and exit nonzero on failure.

### Locked locations

- Cloud Run, Artifact Registry, Firestore, Pub/Sub, and Scheduler:
  **europe-west1**.
- Scheduler timezone: **Africa/Nairobi**.
- Vertex model endpoint: preserve **global** from the current configuration.
- Agent Platform Sessions and Memory Bank: **global**, backed by a context-only
  Agent Platform resource.
- The Phase 0 probe validates the `europe-west1` application plane against the
  global model and context endpoints before full provisioning. A location or
  quota failure is investigated as configuration first; it does not authorize
  an unrequested model change or an ad hoc second application region.

### Logical environments inside the credited project

| Resource | Development | Judging/demo |
|---|---|---|
| Frontend | duka-dev-web | duka-prod-web |
| API | duka-dev-api | duka-prod-api |
| Worker | duka-dev-worker | duka-prod-worker |
| Nightly Job | duka-dev-nightly | duka-prod-nightly |
| Digest Job | duka-dev-digest | duka-prod-digest |
| One-shot seed Job | duka-dev-seed | duka-prod-seed |
| Firestore | named database duka-dev | named database duka-prod |
| Pub/Sub | duka-dev-inbound | duka-prod-inbound |
| DLQ | duka-dev-inbound-dlq | duka-prod-inbound-dlq |
| Scheduler | duka-dev-nightly | duka-prod-nightly |
| Agent context | duka-dev-context | duka-prod-context |

Development and judging data, sessions, and memories must never share a
database or context resource. If named Firestore databases introduce a
deadline-blocking issue, preserve isolation with a verified environment
namespace and keep the production context resource separate.

## 7. State, trust, and durability contract

| State class | Owner | Contents | May influence |
|---|---|---|---|
| Business truth | Firestore | Catalog, customers, orders, payments, approvals, messages, event receipts, reports | Business actions through deterministic invariants |
| Active conversation | Agent Platform Sessions | ADK events, workflow state, invocation state, suspend/resume handles | Current conversation and resumability |
| Long-term preference | Memory Bank | Confirmed usual items/quantities and language preference | Suggestions and clarification only |
| Deployment truth | Git SHA, image digest, release manifest | Exact code, revisions, Job image, context IDs, test/eval links | Reproduction and rollback |

### Durable Sessions design

- Cloud mode uses **VertexAiSessionService**. It must never silently fall back
  to an in-memory session service.
- Local mode retains the current in-memory runner for fast keyless work.
- Firestore stores the active session ID and generation for each customer.
- Session creation and pointer rotation are atomic.
- Session IDs remain explicit, stable, and compatible with Agent Platform
  naming rules.
- Production sessions use an explicit 90-day TTL, longer than the judging
  period and pending-approval expiry.
- Old sessions remain available after a new-day rotation so a refund suspended
  in an older session can still resume.
- Approval records persist decision, session ID, invocation ID, interrupt ID,
  attempt count, last error, and resumed timestamp.
- Approval resume uses an idempotent state machine:
  **pending → resuming → approved or rejected**.
- A transient resume failure remains retryable. The API must not report success
  or resolve the approval before the ADK resume completes.
- Conflicting decisions use a transaction: the first valid claim wins; a later
  conflicting decision returns a stable conflict/idempotent result.
- Per-customer execution is serialized with a Firestore lease or verified
  Pub/Sub ordering. Durable storage alone does not prevent concurrent turns
  from racing.
- Application name, user-key algorithm, context resource ID, ADK version, and
  workflow node identities are compatibility contracts. Production deployment
  must flag incompatible changes while invocations are suspended.

### Memory Bank design

- One environment-specific Agent Platform context resource backs both
  **VertexAiSessionService** and **VertexAiMemoryBankService** from Cloud Run.
- Production infrastructure protects the context resource from destruction.
- Memory scope is exact by application name and opaque user ID. Raw phone
  numbers should not be used as memory scope identifiers.
- The only initial memory topic is
  **shopping_preferences_and_usual_order**.
- Allowlisted memory facts:
  - confirmed usual products;
  - confirmed quantities;
  - preferred customer language.
- Forbidden memory facts:
  - phone numbers or payment references;
  - prices, balances, or payment state;
  - refund decisions or complaints;
  - security flags;
  - low-confidence or rejected interpretations;
  - instructions such as “remember I am the owner.”
- Replace whole-session ingestion after every turn with a Firestore-backed
  memory outbox containing deterministic, trusted summaries.
- Memory generation is best-effort and retryable. A Memory Bank outage must not
  turn a successfully committed order into an error response.
- Memory is explicitly untrusted advisory context. Intake must still call the
  catalog for current SKU, availability, name, and price.
- Memory generation is eventually consistent. Tests poll with a bounded timeout;
  the live video uses a verified pre-generated memory.
- Use multilingual retrieval configuration and curated positive/negative
  examples for Swahili, English, and code-switching.
- Memory cost and latency are measured separately from the core Gemini turn.

### Context-sanitization requirement

Blocked content must not reappear through durable history:

- A prompt-injection message blocked on turn N must not enter Memory Bank.
- A later clean turn must not expose the blocked text to an LLM through default
  session history.
- Implement either a pre-model history filter or explicit sanitized screened
  state with model nodes consuming only approved context.
- Large inline audio/image content receives strict MIME and size limits and is
  excluded from memory extraction.
- Add a trajectory eval proving blocked historical content never reaches a later
  LLM or tool.

## 8. Identity and access contract

### Human/bootstrap identity

The owner performs the one-time bootstrap for APIs, Terraform state, WIF, IAM,
and any Agent Platform context resource that the current Terraform provider
cannot configure safely. Routine application deploys must not retain these
administrative privileges.

### Service accounts

| Identity | Minimum responsibility |
|---|---|
| duka-ENV-web-runtime | Cloud Run Invoker on the matching private API; no Firestore, model, Session, or Memory access |
| duka-ENV-api-runtime | Firestore user; publisher on the exact inbound topic; Vertex AI user; Session user; Memory user; Telemetry traces writer; access only to application auth secret |
| duka-ENV-worker-runtime | Firestore user; Vertex AI user; Session user; Memory user; Telemetry traces writer |
| duka-ENV-job-runtime | Firestore user; Vertex AI user; Session user; Memory user; Telemetry traces writer; runs the nightly, digest, and manually invoked seed Jobs |
| duka-ENV-pubsub-invoker | Cloud Run Invoker on the matching worker only |
| duka-ENV-scheduler-invoker | Cloud Run Invoker on the matching nightly Job only |
| duka-gha-dev-deployer | Artifact writer; Cloud Run developer; Service Account User on dev runtime identities only |
| duka-gha-prod-deployer | Artifact writer; Cloud Run developer; Service Account User on production runtime identities only |
| duka-dev-evaluator | Vertex AI and development evaluation resources only |

Neither deployer receives Project Owner/Editor, IAM administration, secret
payload access, Firestore data access, model invocation, memory access, or
Pub/Sub publishing.

### Authentication rules

- GitHub uses OIDC Workload Identity Federation through dedicated deployer
  service accounts.
- The trusted repository subject is private repository
  **`jmwai/duka-autopilot`**.
- The WIF provider is restricted with immutable GitHub repository and owner
  numeric IDs, plus exact ref/environment conditions.
- Dev impersonation is limited to the exact repository and dev branch.
- Production impersonation is limited to the exact repository and main or a
  protected release tag.
- Workflows request only repository read and OIDC token permissions.
- No GCP service-account JSON key is generated or stored.
- Local development uses Application Default Credentials with quota project
  `my-duka-autopilot`; this setting is not a deployment credential and grants
  no GitHub or Cloud Run workload identity by itself.
- Cloud Run uses Application Default Credentials derived from each attached
  runtime service account.
- Secret Manager stores only unavoidable values such as signed-session/cookie
  secret and demo owner credential.
- GitHub knows secret resource names, not secret payloads.
- Owner mutation routes require an authenticated demo session.
- Direct anonymous API mutation, worker invocation, Job execution, synthetic
  seeding, approvals, costs, and raw traces are denied.
- Input size, MIME, CORS origin, rate, and max-instance limits are explicit.

## 9. GitHub Actions delivery contract

### Branch and environment model

- Pull requests: CI only.
- **dev** branch: CI plus automatic development deployment after CI succeeds.
- **main**: protected release source; no direct pushes.
- Production: manual **release-prod** dispatch using an exact main SHA or
  protected tag and a GitHub production environment approval.
- Final release: annotated **hackathon-2026-final** tag.
- Post-submission work: a branch that cannot deploy or change judged artifacts.

### Workflow 1 — ci.yml

Triggers: every pull request and pushes to dev/main.

Tasks:

1. Verify dependency lock, disclosures, start date, and absence of credentials,
   local databases, generated auth files, or environment files.
2. Install with uv from a locked dependency set.
3. Run configured lint, formatting, and type checks.
4. Run deterministic unit/integration tests.
5. Start the Firestore emulator and run parity tests without skips.
6. Build frontend and backend images without pushing.
7. Verify non-root runtime, health/readiness endpoints, version endpoint, and
   nightly Job smoke command.
8. Run dependency, secret, and container scans.
9. Upload test report, coverage summary, SBOM, and build metadata.

CI does not receive an OIDC deployment token.

### Workflow 2 — model-eval.yml

Triggers: manual dispatch and release-candidate tag.

Tasks:

1. Authenticate to development through WIF.
2. Run existing ADK evalsets against the intended model and location.
3. Run voice, image, routing, injection, tool-validation, memory, and durable
   resume cases.
4. Record model ID, location, Git SHA, scores, repetitions, tokens, cost, and
   known limitations.
5. Fail on any critical safety trajectory or agreed quality threshold.
6. Upload the evaluation report as a release artifact.

Paid model evals do not run on every pull request.

### Workflow 3 — deploy-dev.yml

Trigger: successful dev push.

Tasks:

1. Verify CI completion.
2. Build frontend and backend exactly once.
3. Authenticate using the dev WIF identity immediately before push.
4. Push Git-SHA tags to Artifact Registry and record their digests.
5. Update dev worker, API, frontend, nightly Job, digest Job, and one-shot seed
   Job using exact digests.
6. Leave IAM, context resources, and durable data untouched.
7. Run dev smoke and acceptance tests.
8. Upload a development deployment manifest.

Deployment concurrency cancels an older in-progress dev deployment so it cannot
overtake a newer commit.

### Workflow 4 — release-prod.yml

Trigger: manual dispatch with an exact main SHA or protected release tag.

Required gate: protected GitHub production environment and explicit owner
approval after CI and model evals pass.

Tasks:

1. Confirm the chosen commit has passing CI and model-eval artifacts.
2. Resolve and verify the already-tested dev image digests. Do not rebuild.
3. Record current production revisions, all Job images, Scheduler state, Firestore
   schema version, and context IDs.
4. Deploy worker and all Jobs, then API, then frontend.
5. Run production smoke tests against the exact release.
6. Shift service traffic only after health checks pass.
7. Restore prior traffic and every Job image automatically if smoke tests fail.
8. Upload **release-manifest.json**.

### Workflow 5 — nightly-proof.yml

Trigger: manual release verification and demo rehearsal.

Tasks:

1. Execute the production nightly Job and wait for completion.
2. Capture execution name, start/end times, status, image digest, and release
   SHA.
3. Fetch structured logs and the persisted reconciliation report.
4. Verify the morning digest and exception queue.
5. Upload the evidence bundle keyed to the release SHA.

### Infrastructure workflow

Terraform validation and planning may run in CI, but infrastructure apply stays
manual under the human/bootstrap identity for the hackathon deadline. Routine
GitHub deployers update images and traffic, not IAM or durable infrastructure.
This limits supply-chain blast radius.

## 10. Infrastructure-as-code plan

Terraform manages:

- required service APIs;
- versioned GCS Terraform state with separate dev and production prefixes;
- Artifact Registry;
- named Firestore databases and indexes;
- Cloud Run services plus nightly, digest, and one-shot seed Jobs;
- Pub/Sub topic, authenticated push subscription, retry policy, and DLQ;
- Scheduler invocation of the Cloud Run Jobs API;
- runtime identities and resource-level IAM;
- Secret Manager references;
- Trace permissions;
- budget alert and Cloud Run max instances;
- WIF pool/provider and deployer identities;
- production deletion protection.

If the provider cannot safely create the desired Agent Platform context and
Memory Bank configuration, an idempotent bootstrap script creates it once,
records the resource ID, and never recreates it during app deployment.
Production context infrastructure uses a prevent-destroy guard.

The locked Google provider can create the context resource and its base Memory
Bank model, embedding, revision, and TTL settings, but does not expose custom
topics/examples. The release therefore uses a split ownership contract:

1. Terraform creates the environment context resource with `prevent_destroy`.
2. `scripts/configure_memory_bank.py` renders the complete SDK payload locally
   for review without making a network call.
3. After a separately approved Terraform apply, the operator invokes the same
   script with `--apply` exactly once per context to add the custom topic,
   exact `[app_name, user_id]` scope, positive/negative examples, third-person
   output, and 90-day retention.
4. The operator reads the resource back, saves redacted configuration evidence,
   and reruns the customization step after any intentional base-config update.

Memory outbox delivery uses awaited `GenerateMemories`, not fire-and-forget
event ingestion. A summary is marked complete only after Agent Platform accepts
the generation request; retryable failure stays in the durable outbox.

Container images are never tagged only as latest. The canonical release
identity is:

- Git commit SHA;
- frontend image digest;
- backend image digest;
- Cloud Run revision names;
- nightly, digest, and seed Job image digests;
- Agent Platform context resource ID;
- test and eval artifact URLs.

## 11. Milestones and exit gates

| Milestone | Deadline | Current status | Exit gate |
|---|---|---|---|
| M0 — scope and configuration lock | Aug 26 EOD | In progress: product/region/repository/narrative locked; project number, fixtures, and approved global probe remain | `my-duka-autopilot`, `europe-west1`, private repository policy, resource names, global model/context probe, claims, demo dataset, and cut line recorded |
| M1 — correctness release baseline | Aug 27 12:00 EAT | Local release suite is green at 107/0/0; cloud denial/retry/DLQ proof remains | ID, tool contract, idempotency, retry, fuzzy lifecycle, auth, fixture integrity, pre-push scanning, and production-seeding regressions pass |
| M2 — reproducible cloud foundation | Aug 27 EOD | Local lock, containers, Terraform, and workflows validated; push, WIF, APIs, plan, and deploy are approval-gated | Dependency lock, containers, Terraform foundation, WIF auth, and first dev deployment succeed |
| M3 — durable autonomous cloud loop | Aug 28 18:00 EAT | Cloud-pending; durable session/memory contracts implemented locally | Sessions, Memory Bank, Pub/Sub, Firestore, Scheduler, and Job pass all P0 production scenarios |
| M4 — release candidate and evidence lock | Aug 29 18:00 EAT | Local 50k baseline and observability implementation exist; model/cloud evidence remains | Tests, evals, benchmark, traces, security checks, and rollback drill pass; demo rehearsed three times |
| M5 — internal submission | Aug 30 20:00 EAT | Pending M3/M4; the Loom transcript and operator guide now exist as placeholder-controlled drafts and remain unfrozen until the release candidate has cloud evidence | Final tag, Loom video, transcript, demo guide, hosted URL, repository access, Devpost form, public bonus links, and receipt verified |
| M6 — official freeze | Sep 1 03:00 EAT | Pending | Linked assets and production deployment frozen through winner announcement |

## 12. Phase plan and task backlog

### Phase 0 — configuration and narrative lock

Timebox: August 26.

Confirmed inputs:

| Input | Locked value |
|---|---|
| GCP project ID | `my-duka-autopilot` |
| Credits | Applied |
| Local ADC quota project | `my-duka-autopilot` |
| Application region | `europe-west1` |
| Vertex model endpoint | `global`; preserve the configured model |
| Sessions and Memory Bank endpoint | `global` |
| Git remote | `git@github.com:jmwai/duka-autopilot.git` |
| Repository state | Private and intentionally unpushed |
| Recording platform | Loom |

- [ ] **CFG-01** Record the remaining GCP project number, billing/credit
      verification, exact model ID, and final environment resource names in the
      non-secret deployment matrix. The project ID, ADC quota project, region,
      Git remote, repository privacy/push policy, and Loom delivery format are
      already locked.
- [ ] **CFG-02** Run one Vertex model call and one minimal Sessions/Memory
      resource probe across the `europe-west1` application plane and `global`
      endpoints before provisioning the full stack. The first authenticated
      ADK eval reached the credited project but confirmed
      `aiplatform.googleapis.com` is disabled; complete this only after approval
      gate A enables the declared APIs.
- [x] **CFG-03** Configure private GitHub remote `jmwai/duka-autopilot` and defer
      the first push until the Phase 4 pre-push gate passes and Actions/WIF are
      ready to run.
- [x] **CFG-04** Create a concise DESIGN_SPEC.md covering use cases, tools,
      safety constraints, success criteria, and edge cases.
- [ ] **CFG-05** Generate and commit a dependency lock without changing the
      configured model. `uv.lock` is generated and passes `uv lock --check`;
      the task closes with the reviewed implementation commit.
- [ ] **CFG-06** Record the stable synthetic demo customer IDs, event strategy,
      audio fixture, ledger image, and benchmark seed. Customer Mama Achieng,
      her exact usual-order ground truth, catalog total, event-ID strategy,
      benchmark seed, and ledger bitmap/hash/ground truth are frozen in
      `docs/demo-fixtures.md` and `fixtures/demo/manifest.json`; only the
      purpose-recorded human audio file/hash remains.
- [ ] **CFG-07** Configure budget alert, labels, max-instance ceiling, and a
      judging-window cost envelope.
- [ ] **CFG-08** Lock the narrative, honest-claims table, P0/P1/P2 cut line, and
      four-minute Loom causal story.
- [ ] **CFG-09** Capture current local test output and baseline screenshots.
      The dated 107/0/0 local test, container, fixture, and pre-push evidence is
      captured; baseline UI screenshots remain for the frontend redesign.

Exit: no unresolved project, region, repository, model, environment, claim, or
demo-dataset decision.

The intentionally deferred push is not a Phase 0 failure. It becomes required
only when Phase 4 needs GitHub Actions to authenticate and deploy.

### Phase 1 — correctness and safety hardening

Timebox: August 26–27. This phase blocks cloud release.

- [x] **COR-01** Make approval, order, and payment identifiers backend-neutral
      opaque IDs end to end.
- [x] **COR-02** Fix the Firestore string-ID versus FastAPI integer-route
      incompatibility and add SQLite/Firestore regression coverage.
- [x] **COR-03** Make save_order resolve customers and catalog records inside the
      tool.
- [x] **COR-04** Derive product name and unit price from the catalog; reject
      unknown SKUs, nonexistent customers, nonpositive quantities, invalid
      confidence, empty orders, and malformed amounts.
- [x] **COR-05** Add a durable event ID to every inbound request and Pub/Sub
      message.
- [x] **COR-06** Implement transactional event states:
      received → processing → completed or failed.
- [x] **COR-07** Make replay return the stored prior result without a second
      order, reply, approval, or cost row.
- [x] **COR-08** Classify failures as permanent or retryable; return non-success
      for transient worker failure and route exhausted delivery to the DLQ.
- [x] **COR-09** Prevent duplicate fuzzy proposals; make approval atomic and
      make rejection return the payment to unmatched residue.
- [x] **COR-10** Remove production startup seeding and create an explicit,
      idempotent seed/bootstrap command and unscheduled one-shot Cloud Run Job.
      The Job returns exact created counts and refuses to reset an already
      seeded environment.
- [x] **COR-11** Require authenticated owner access and validate CORS, MIME,
      payload size, and route exposure.
- [x] **COR-12** Correct refund/restock copy so it records approved proposals
      without promising an external transfer or order.
- [x] **COR-13** Add health, readiness, and version endpoints. Readiness fails
      precisely when required durable cloud configuration is missing.
- [x] **COR-14** Add structured correlation fields without logging raw phone
      numbers, base64 media, secrets, or sensitive prompt content.
- [x] **COR-15** Add sanitized-history handling so a previously blocked message
      cannot reappear in a later LLM context.

Exit:

- Existing tests plus identifier, validation, rejection, duplicate-delivery,
  retry/DLQ, authorization, and history-poisoning tests pass.
- Replaying an event creates exactly one business result.
- No LLM tool can persist arbitrary price, SKU, quantity, or customer data.
- No simulated integration is described as a real completed external effect.

### Phase 2 — durable Sessions and Memory Bank

Timebox: August 27–28.

- [ ] **CTX-01** Provision one context-only Agent Platform resource per
      environment and record its immutable ID.
- [x] **CTX-02** Configure the cloud Runner with VertexAiSessionService and
      VertexAiMemoryBankService using the same environment context ID.
- [x] **CTX-03** Preserve the in-memory service only for explicit local mode.
      Cloud readiness must fail rather than fall back.
- [x] **CTX-04** Replace the process-global session counter with a transactional
      Firestore active-session pointer and generation.
- [x] **CTX-05** Make new-session creation asynchronous, explicit, and durable
      with a 90-day production TTL.
- [x] **CTX-06** Preserve old sessions and make refund resume use the approval’s
      stored session/invocation/interrupt handles rather than the current active
      session.
- [x] **CTX-07** Implement the idempotent approval resume state machine and
      retryable failure state.
- [x] **CTX-08** Serialize turns per customer with a Firestore lease or verified
      ordering strategy.
- [x] **CTX-09** Replace raw whole-session memory ingestion with an allowlisted
      deterministic memory outbox and ingestion ledger.
- [x] **CTX-10** Define and locally validate the custom
      `shopping_preferences_and_usual_order` topic, multilingual embedding,
      positive and negative examples, exact scope, third-person output,
      retention, opaque user IDs, and awaited generation metadata. Applying and
      reading it back in each cloud environment remain CTX-01/CLD-10 gates.
- [x] **CTX-11** Ensure catalog lookup overrides stale memory price or product
      facts.
- [x] **CTX-12** Make Memory Bank outage nonfatal to an already successful
      business action and observable as degraded/retryable.
- [x] **CTX-13** Pin exact ADK and Agent Platform dependency versions.
- [x] **CTX-14** Add a deployment compatibility check for application name,
      user-key algorithm, graph/node identities, and suspended invocations.

Exit:

- New-session recall succeeds three consecutive times without inventing a
  product or reusing stale price.
- Restart/revision refund resume succeeds ten out of ten times for approval and
  rejection.
- Duplicate and conflicting decisions create one resume and one customer reply.
- Cross-user memory leakage is zero.
- Blocked content, payment facts, phone numbers, complaints, and ownership
  instructions do not become memories.

### Phase 3 — containers, infrastructure, and WIF

Timebox: August 27.

- [x] **INF-01** Add frontend and backend Dockerfiles, dockerignore rules,
      non-root users, health checks, and reproducible builds.
- [x] **INF-02** Add distinct API, worker, nightly/digest Job, and unscheduled
      seed Job entry points while preserving domain logic.
- [x] **INF-03** Add Artifact Registry and immutable SHA/digest conventions.
- [x] **INF-04** Define Terraform state, required APIs, Firestore, indexes,
      Pub/Sub, DLQ, Scheduler, Cloud Run units, identities, IAM, secrets,
      budgets, and deletion protection.
- [ ] **INF-05** Bootstrap GitHub WIF for private repository
      `jmwai/duka-autopilot` using immutable repository/owner IDs and
      branch/environment restrictions.
- [ ] **INF-06** Create separate dev and production deployer identities and
      runtime identities.
- [x] **INF-07** Add authenticated Pub/Sub push with bounded retry and DLQ.
- [x] **INF-08** Schedule the nightly Cloud Run Job at 02:00 Africa/Nairobi
      through a dedicated invoker.
- [x] **INF-09** Protect production context resources from destroy/recreation.
- [x] **INF-10** Add direct OTLP/gRPC export to Google Cloud's Telemetry API and
      PII-safe structured logs carrying event, session, invocation, approval,
      node, revision, and release identifiers. W3C context propagates through
      the BFF and Pub/Sub; cloud ingestion proof remains CLD-13.

Exit:

- No JSON service-account key exists.
- Wrong repository, branch, fork, or environment cannot impersonate a deployer.
- Each workload displays its dedicated runtime identity.
- Direct unauthenticated worker or Job invocation is rejected.

### Phase 4 — GitHub Actions and development deployment

Timebox: August 27–28.

- [ ] **CICD-00** Immediately before the first push, review outgoing history,
      ignored/untracked files, secrets, credentials, large artifacts, licenses,
      disclosures, and branch targets; confirm the GitHub repository is still
      private. A preliminary automated scan passes and GitHub reports the empty
      remote as private; rerun against the committed tree immediately before
      the first branch-only push. Push only after Actions/WIF are ready to use it.
- [x] **CICD-01** Implement ci.yml and make Firestore parity a required release
      check.
- [x] **CICD-02** Implement manual/release model-eval.yml.
- [x] **CICD-03** Implement deploy-dev.yml with WIF, immutable image push,
      concurrency control, smoke tests, and manifest artifact.
- [x] **CICD-04** Implement manually approved release-prod.yml that promotes
      existing digests and rolls back on failed smoke tests.
- [x] **CICD-05** Implement nightly-proof.yml for Job execution and evidence
      capture.
- [x] **CICD-06** Pin or review third-party Action versions and prevent generated
      auth credentials from entering source or container context.
- [ ] **CICD-07** Verify version endpoint, image digest, revision labels, and Git
      SHA agree after deployment.
- [ ] **CICD-08** Produce release-manifest.json with all reproduction and
      evidence identifiers.

Exit:

- The first authorized push occurs only after CICD-00 and enables a dev deploy
  of the known SHA through WIF.
- A failed smoke test prevents production traffic promotion.
- Production cannot deploy without explicit approval.
- The same tested digest, not a rebuild, reaches production.

### Phase 5 — end-to-end cloud proving

Timebox: August 28.

- [ ] **CLD-01** Deploy development, initialize explicit synthetic data, and
      verify Firestore indexes.
- [ ] **CLD-02** Prove text event → 202 → Pub/Sub → ADK → Firestore → async
      reply.
- [ ] **CLD-03** Prove real Swahili voice event with catalog-derived values.
- [ ] **CLD-04** Prove ledger photograph with confident rows committed and an
      uncertain row gated.
- [ ] **CLD-05** Publish the same event twice and prove exactly one business
      mutation.
- [ ] **CLD-06** Inject a transient worker failure, observe retry, then verify
      exhausted work reaches the DLQ in a controlled test.
- [ ] **CLD-07** Prove injection/social engineering is blocked before a business
      tool and cannot poison later history.
- [ ] **CLD-08** Prove fuzzy approve and reject lifecycles.
- [ ] **CLD-09** Suspend a refund, restart or deploy a compatible new revision,
      then resume the original invocation exactly once.
- [ ] **CLD-10** Create a new session and prove grounded “usual order” recall.
- [ ] **CLD-11** Trigger the nightly Job through Scheduler and verify exact pass,
      bounded fuzzy residue, restock proposal, persisted report, and digest.
- [ ] **CLD-12** Verify anonymous owner mutation fails and documented demo access
      succeeds from a clean browser.
- [ ] **CLD-13** Capture a Cloud Trace spanning event, Session, graph nodes,
      model, tool, and Firestore mutation.
- [ ] **CLD-14** Promote an approved production release and perform a rollback
      drill.

Exit: every P0 scenario has a stable cloud proof artifact and three consecutive
demo rehearsals can use the same release.

### Phase 6 — evaluation, benchmark, and evidence

Timebox: August 28–29.

Before running ADK evaluation, read and follow the ADK evaluation guide. Unit
tests and ADK evaluation are distinct release gates.

- [x] **QUA-01** Run the full local deterministic suite: 107 tests pass with
      zero failures/errors/skips on the August 26 local release candidate.
- [x] **QUA-02** Run Firestore-emulator 1.22.0 parity without skips and validate
      the JUnit report with `scripts/assert_junit.py`.
- [ ] **QUA-03** Run the intake, support, and safety evalsets (20 cases total).
      The fail-closed wrapper and eval dependencies are ready; the first live
      attempt is recorded as infrastructure-blocked until Agent Platform API
      enablement, not as a passing evaluation.
- [ ] **QUA-04** Add and run critical cases for Swahili extraction, ambiguity
      gates, catalog validation, refund wording, injection, fuzzy proposals,
      durable resume, and grounded memory.
- [ ] **QUA-05** Repeat nondeterministic critical cases and require zero
      safety-trajectory failures.
- [ ] **QUA-06** Run 500-row and 5,000-row Firestore scaling probes.
- [ ] **QUA-07** Run the full 50,000-row Firestore stress test once in the
      nightly Job. A separate local SQLite/no-fuzzy baseline is complete and
      retained in `docs/evidence/benchmark-local.json`; it is not cloud proof.
- [ ] **QUA-08** Record generated/stored rows, duplicates, exact matches,
      residue, wall times, batches, proposals, tokens, cost, Firestore
      operations, total duration, model, location, SHA, and Job execution.
- [ ] **QUA-09** Commit dated evaluation and economics reports with raw evidence
      and known limitations. `docs/economics.md` and the raw local baseline
      exist; the task closes only after model and Cloud Run Job measurements
      are appended for the final SHA.
- [ ] **QUA-10** Capture GitHub deployment, Cloud Run revisions, Job execution,
      Scheduler, Pub/Sub/DLQ, Firestore mutation, Sessions, Memory Bank, Trace,
      and rollback proof.
- [ ] **QUA-11** Conduct one short real-owner validation if possible, using
      consent and no personal financial data.
- [x] **QUA-12** Build an evidence ledger mapping every quantitative or
      architectural claim to a repository or cloud artifact.

Exit:

- Release test/eval thresholds pass.
- Three nightly Jobs succeed.
- Economics copy uses only measured committed results.
- Every final claim has a traceable evidence source.

### Phase 7 — demo, content, and submission

Timebox: August 29–30.

- [ ] **DEM-01** Seed and freeze the dedicated production demo dataset.
- [ ] **DEM-02** Validate one real human Swahili audio fixture and one stable
      handwritten ledger image.
- [ ] **DEM-03** Pre-generate and verify only the memory needed for the demo;
      keep the runtime execution genuine. The one-shot seed Job now prepares
      the deterministic allowlisted summary and fails if that source is absent;
      managed Memory Bank inspection remains cloud-pending.
- [ ] **DEM-04** Update architecture and deployment documentation to show only
      deployed/proven components.
- [ ] **DEM-05** Run a clean-clone local reproduction and a GitHub deployment
      reproduction.
- [x] **DEM-06** Draft `docs/demo-transcript.md`: exact timecoded narration,
      on-screen actions, expected evidence, pronunciation notes, disclosures,
      and fallback lines. Every segment names its maximum duration, visible
      artifact, spoken claim, and acceptable pre-recorded fallback. Unsupported
      cloud values remain explicit placeholders and the draft is not yet
      approved for recording.
- [x] **DEM-07** Draft `docs/demo-guide.md`: prerequisites, clean-browser and
      Loom settings, fixture/reset procedure, click path, expected states,
      contingency path, security checks, recording checklist, publication
      settings, and post-record verification. The guide is intentionally
      unresolved where production resource IDs and evidence do not yet exist.
- [ ] **DEM-07A** Freeze both Loom documents against the release-candidate SHA
      before recording and have a second operator execute the guide without
      undocumented setup. The transcript is the narration contract; the guide
      is the operator contract. Neither may require showing a secret or an
      unrestricted cloud-console credential. Any change to the deployed proof
      path requires both artifacts to be reviewed again.
- [ ] **DEM-08** Rehearse the transcript and guide three times, recording actual
      segment durations and removing any beat that pushes the cut beyond 3:55.
- [ ] **DEM-09** Record in Loom at 1080p with readable browser zoom, reviewed
      English narration/captions, and visible Cloud proof.
- [ ] **DEM-10** Trim the Loom recording to 3:45–3:55 while retaining a visibly
      continuous live execution segment; verify the share link without sign-in
      and retain a source or downloadable backup where available.
- [ ] **DEM-10A** Reconcile the transcript timecodes and manually corrected
      captions to the final Loom cut, then rerun the guide's publication and
      incognito-playback checks.
- [ ] **DEM-11** Publish the technical article with the required hackathon-entry
      statement.
- [ ] **DEM-12** Publish the social post with the exact hashtag
      #AllThingsAgenticHackathon.
- [ ] **DEM-13** Complete every Devpost field, disclosure, data-source note,
      technology field, date, and prize opt-in.
- [ ] **DEM-14** Verify the Loom video, transcript, demo guide, repository,
      hosted app, credentials, architecture, blog, and social links from an
      incognito browser.
- [ ] **DEM-15** Create the final annotated tag and GitHub release containing
      manifest, SBOM, eval report, benchmark report, and known limitations.
- [ ] **DEM-16** Submit Devpost by August 30 at 20:00 EAT and save the receipt.

Exit: the project is actually submitted, not left as a draft, and every linked
artifact matches the final deployed SHA and image digests.

### Phase 8 — contingency and judging freeze

Timebox: August 31 through winner announcement.

- [ ] **FRZ-01** Use August 31 only for link, playback, uptime, quota, spend, and
      submission-receipt checks.
- [ ] **FRZ-02** Permit only eligibility-blocking or demo-breaking fixes before
      the official deadline.
- [ ] **FRZ-03** For any permitted fix, rerun affected gates, redeploy through
      GitHub Actions, update manifest/SHA, and resubmit before the deadline.
- [ ] **FRZ-04** Protect main and the final tag; disable automatic production
      deployment.
- [ ] **FRZ-05** Retain exact Artifact Registry digests, Cloud Run revisions,
      context resources, Firestore demo data, and required URLs.
- [ ] **FRZ-06** Keep scale-to-zero services available through judging; use a
      minimum instance only if credits and demo reliability justify it.
- [ ] **FRZ-07** Monitor errors, quotas, and spend without altering judged
      artifacts.
- [ ] **FRZ-08** Perform post-submission work only on an unlinked,
      non-deploying branch or fork.

## 13. Acceptance-test matrix

| ID | Scenario | Required result | Evidence |
|---|---|---|---|
| A01 | Text order | HTTP 202, async route, catalog-derived order, one reply | Trace plus Firestore mutation |
| A02 | Duplicate event | Two deliveries, one event claim and one business result | Event receipt and row counts |
| A03 | Retry and DLQ | Transient failure retries; exhausted failure reaches DLQ | Pub/Sub delivery log |
| A04 | Tool integrity | Unknown SKU/customer, bad quantity/price/confidence rejected | Unit test and ADK trajectory |
| A05 | Exact reconciliation | Expected ground-truth matches, idempotent second pass | Benchmark JSON |
| A06 | Fuzzy lifecycle | Proposal only; approval links atomically; rejection returns residue | Transaction test |
| A07 | Security screen | Malicious text never invokes a business tool | Trace and security flag |
| A08 | History poisoning | Blocked prior text never enters later LLM context or Memory Bank | ADK eval |
| A09 | Same-session restart | Turn on revision A, restart, turn on B retains state | Session record and trace |
| A10 | Multi-instance sequence | Two messages on different instances preserve customer ordering | Correlated logs |
| A11 | Session rotation | New managed session becomes active atomically; old remains readable | Firestore pointer and Sessions console |
| A12 | Suspended old session | Rotate after suspension, then resume the old invocation | Approval trace |
| A13 | Approval/rejection resume | Restart Runner and resume once with correct customer reply | Ten-run report |
| A14 | Duplicate decision | Concurrent duplicate click produces one claim, resume, and reply | State-machine test |
| A15 | Resume failure | Injected 503 leaves retryable state, not false success | Failure/retry trace |
| A16 | Conflicting decisions | First transaction wins; second is stable conflict | Concurrency test |
| A17 | Expired/missing session | Explicit owner-visible failure; no external-money promise | Error-path test |
| A18 | Cross-session usual | New session recalls confirmed items and calls current catalog | Memory eval |
| A19 | Multilingual memory | Swahili/English/code-switch retrieval reaches threshold | Curated score report |
| A20 | User isolation | Ten other users retrieve none of customer A’s memory | Isolation report |
| A21 | Unknown usual | Clarification or low-confidence gate; no invented order | ADK eval |
| A22 | Changed preference | Later confirmed preference consolidates correctly | Memory revision evidence |
| A23 | Stale catalog | Memory item may help; current catalog price always wins | Tool trace |
| A24 | Negative memory | Payment/refund/phone/owner-instruction content is not persisted | Memory inspection |
| A25 | Memory outage | Business action succeeds; memory write becomes degraded/retryable | Injected-failure test |
| A26 | Real voice | Human Swahili audio produces expected structured order | Video and eval |
| A27 | Ledger image | Clear rows commit; unclear row is gated | Video and eval |
| A28 | Scheduled night shift | Scheduler runs Job; report, restock, and digest persist | Job execution |
| A29 | Authorization | Anonymous owner/API/worker/Job mutation denied | HTTP/IAM checks |
| A30 | Rollback | Prior revisions and Job image restored in under five minutes | Rollback manifest |

## 14. Evidence and claims ledger

Every strong claim must point to a durable artifact.

| Claim | Required artifact |
|---|---|
| Event-driven autonomous routing | Pub/Sub delivery plus ADK node trace |
| Immediate asynchronous intake | Ten-request acknowledgement timing report |
| Approximately 97% deterministic settlement | Seeded ground-truth test and cloud benchmark JSON |
| Full 50,000-row stress test | Cloud Run Job execution, Firestore counts, and exact configuration |
| Model sees only bounded residue | Batch count, residue size, prompt bounds, and token report |
| Safe uncertain-money handling | Tool scope, fuzzy/refund approval tests, and traces |
| Survives restart or revision | Managed Session record and resume report |
| Remembers the usual across sessions | Memory Bank evidence and multilingual recall eval |
| Production-minded architecture | IAM matrix, WIF run, retry/DLQ proof, Trace, and rollback drill |
| Runs on Google Cloud | .run.app URL, Cloud Run console, Job, Firestore, Pub/Sub, Scheduler, and Vertex evidence |
| Economics figure | Dated measured report tied to release SHA |
| Built during hackathon | Git history, start date, and granular pre-existing-code disclosure |
| Synthetic and privacy-safe | Generator documentation, fixture manifest, and no-real-data statement |

Recommended evidence files to create during execution:

- docs/cloud-deployment.md
- docs/evaluation-report.md
- docs/economics.md
- docs/security-and-limitations.md
- docs/evidence-ledger.md
- docs/demo-transcript.md
- docs/demo-guide.md
- deployment/release-manifest.json

## 15. Four-minute Loom demo contract

### Required demo artifacts

- **Loom recording:** the judge-facing 3:45–3:55 video, accessible without
  sign-in and verified in an incognito browser.
- **`docs/demo-transcript.md`:** the final timecoded narration and matching
  on-screen cues. It starts as the recording script, including proof beats and
  fallback narration, then is reconciled to the final Loom edit. Loom-generated
  captions are manually corrected for Swahili, M-Pesa, Firestore, Pub/Sub, ADK,
  and product terminology.
- **`docs/demo-guide.md`:** the operator runbook for preparing data, opening
  tabs, setting Loom/browser options, executing the click path, validating each
  checkpoint, recovering from a failed take, publishing the link, and
  performing the final incognito check. A second operator should be able to
  reproduce the same causal demo from this guide without undocumented setup.

The transcript and guide are release artifacts: both must identify the final
release SHA and must be updated if the final edit changes timing or proof.

### Storyboard

1. **0:00–0:12 — Outcome first**
   - Show the deployed morning digest and small exception queue.
   - Say: “While this shop slept, Duka completed the routine work and reduced
     the night to these decisions.”

2. **0:12–0:55 — Live Swahili event**
   - Send the real human voice note.
   - Show immediate 202 acknowledgement.
   - Show Pub/Sub delivery, ADK path, catalog-derived order, and Firestore
     mutation.

3. **0:55–1:20 — Multimodal risk boundary**
   - Upload the stable ledger image.
   - Show clear rows committed and one doubtful row gated.

4. **1:20–2:15 — The night shift**
   - Execute the real Cloud Run Job through the proof workflow or Scheduler.
   - Show actual exact count, residue, wall time, token/cost values, and Job
     execution.

5. **2:15–2:50 — Durable exception**
   - Approve one bounded exception or resume a suspended refund after a revision
     restart.
   - Emphasize that the unattended happy path already completed.

6. **2:50–3:25 — Architecture**
   - Explain only event-driven execution, three trust lanes, and exception
     compression.
   - Show Sessions and Memory Bank as durable context, not runtime logo garnish.

7. **3:25–3:55 — Proof and close**
   - Show .run.app, GitHub deployment, Cloud Run revisions/Job, Trace, tests,
     evals, and measured evidence.
   - Close: **“The duka slept. Its back office didn’t.”**

### Recording rules

- Use Loom as the recording and hosting platform.
- Show the working product in the first 10–15 seconds.
- Start already authenticated; never film setup or loading.
- Keep one visibly continuous live execution proof segment.
- Use cuts around waiting, not around the causal proof.
- Use English narration or accurate English subtitles.
- Manually review Loom captions against `docs/demo-transcript.md`.
- Use readable zoom and stable synthetic fixtures.
- Show one causal example, not a feature tour.
- Use a clean browser profile, suppress notifications, and close unrelated
  tabs, bookmarks, account details, and desktop content.
- Verify the final Loom share permissions and playback from an incognito
  browser; retain the local source segments or an MP4 backup where available.
- Do not expose project secrets, raw personal data, or unrestricted console
  credentials.

## 16. Award and rubric positioning

| Target | What judges should remember | Proof |
|---|---|---|
| Taskmaster | A full event-driven night shift that completes routine work without an owner | 202 → Pub/Sub → ADK → Firestore plus scheduled Job |
| Grand Prize | Unusual real-world friction, disciplined trust boundaries, and undeniable production evidence | Genuine BYOF story, measured impact, trace, durable state, polished demo |
| Best Architectural Design | Exception compression, three trust lanes, scoped identities, idempotency, durable context, and rollback | Architecture, IAM, replay/resume tests, Trace, release manifest |
| Best Multimodal UX | Voice and paper are native inputs for the actual operator, not decorative modalities | Real Swahili audio and ledger image with confidence gating |
| Individual/Hobbyist | A coherent, production-minded solo build with a transparent build history | Git history, disclosure, evidence, and clean reproduction |

Internal rubric gate:

| Criterion | Minimum internal release score | Required improvement |
|---|---:|---|
| Innovation and operational utility | 4.7/5 | Genuine personal friction, unattended happy path, before/after value, honest stress scale |
| Architectural discipline | 4.7/5 | Durable Sessions, safe Memory, idempotency, validation, least privilege, retries, Trace |
| Demo and production readiness | 4.7/5 | Hosted release, reproducible CI/CD, cloud proof, measured evidence, stable four-minute story |

## 17. Risk register

| Risk | Probability / impact | Trigger | Mitigation and cut rule |
|---|---|---|---|
| GitHub/WIF IAM delay | Medium / Critical | First auth run fails | Bootstrap on Aug 27; verify numeric claims and ref condition; use human bootstrap for infra; never fall back to JSON keys |
| Model/location mismatch or quota | Medium / Critical | 404, 429, or repeated 503 | Run probe first; fix location before model; bounded retry; preserve known model |
| Agent Platform provisioning mismatch | Medium / Critical | Session or memory creation fails | Minimal context spike before integration; use one context resource per environment; preserve local seam |
| Context resource deletion | Low / Critical | Terraform proposes replacement | Prevent destroy; remove it from routine app deployment; explicit owner review |
| Resume breaks across revision | Medium / Critical | Approval cannot resume | Persist all handles; pin ADK/topology; cross-revision test is P0 |
| Concurrent session mutation | Medium / Critical | Two events overlap for one customer | Firestore lease or verified ordering; concurrency-one worker initially |
| Memory eventual consistency | Medium / High | “Usual” recall misses | Trusted outbox, bounded poll, pre-verified demo memory, three rehearsals |
| Memory poisoning/history replay | Medium / Critical | Blocked content appears later | Allowlisted summaries, sanitized history, negative extraction tests |
| Pub/Sub redelivery duplicates work | High / Critical | Same event handled twice | Transactional event claim and stored replay result |
| Worker errors never retry | Current / Critical | Exception returns success | Retryable/nonretryable contract and DLQ before cloud release |
| Firestore stress run slow/costly | Medium / High | 5,000-row curve is poor | Probe 500→5,000; optimize batches; run 50,000 once; report actual result |
| Public demo abuse or spend | Medium / High | Unexpected traffic/cost | Demo access, rate/body limits, max instances, budgets, synthetic users |
| Authentication blocks judges | Medium / High | Incognito test fails | Simple documented demo access; public frontend/BFF; rehearse clean browser |
| Four-minute feature tour | High / High | Rehearsal exceeds 4:10 | One causal story; remove secondary beats; lock 3:55 cut |
| Audio/image variability | Medium / High | One of three rehearsals fails | Stable real fixtures, MIME checks, controlled demo data |
| Claims outrun evidence | High / High | Copy contains estimates | Evidence ledger; remove unsupported number or component |
| Repository is unavailable | Planned / Critical | Private remote remains unpushed or judges cannot access it | Run the pre-push audit only when CI/CD needs the remote; verify private judge access before submission; change visibility only through an explicit release decision |
| Loom playback or captions fail | Medium / Critical | Incognito playback asks for sign-in, captions are inaccurate, or runtime exceeds four minutes | Verify public-link permissions, manually reconcile captions to the transcript, retain a backup, and test playback on two clean browsers |
| Deadline timezone error | Low / Critical | Work continues Aug 31 night | Submit Aug 30 at 20:00 EAT; Aug 31 is contingency only |

## 18. Release and rollback contract

Before production promotion, record:

- current frontend, API, and worker revisions;
- current nightly Job image digest;
- Scheduler state;
- Firestore schema version;
- Agent Platform context IDs;
- pending suspended approvals;
- selected release SHA and tested image digests.

Rollback:

1. Pause Scheduler if the Job is unsafe.
2. Route frontend, API, and worker to the prior revisions.
3. Restore the prior nightly Job image digest.
4. Run health and one read-only smoke check.
5. Resume Scheduler only after verification.

Never recreate or roll back the Agent Platform context resource during an
application rollback. Sessions and memories must survive application revisions.
Firestore changes use additive expand/contract patterns. Any material data
transformation is a separate explicit, idempotent Job with a pre-deploy export.

## 19. Daily command center

### August 26

- Complete CFG-01 through CFG-09.
- Begin COR blockers.
- Record the configured private remote and lock the remaining cloud/resource
  matrix; do not push yet.
- Finish the model and Agent Platform compatibility spike.

### August 27

- Reach M1 by 12:00 EAT.
- Complete durable-state implementation and container entry points.
- Bootstrap Terraform foundation and WIF.
- Run CICD-00 and make the first push only when Actions/WIF are ready to execute.
- Obtain the first GitHub-driven dev deployment by end of day.

### August 28

- Complete the end-to-end cloud scenario matrix.
- Run durable restart/resume and memory tests.
- Trigger three successful nightly Jobs.
- Capture traces and start evaluation/economics evidence.

### August 29

- Finish all tests, ADK evals, benchmark, security checks, and rollback drill.
- Promote the release candidate.
- Freeze features by 18:00 EAT.
- Draft the Loom transcript and demo guide, then rehearse the complete recording
  three times.
- Finalize architecture, README, submission copy, and evidence ledger.

### August 30

- Stop optional work at 12:00 EAT.
- Record/edit the Loom video, reconcile its transcript and guide, and verify
  every link from incognito.
- Publish article and social post.
- Create final tag/release and confirm deployment manifest.
- Submit Devpost by 20:00 EAT and save the receipt.

### August 31

- Contingency only: uptime, quota, playback, link, and receipt checks.
- No optional product or content changes.
- Freeze all judged artifacts at the official deadline.

## 20. Final submission gate

The project is ready to submit only when every item below is true.

### Product and cloud

- [ ] Public frontend works from an incognito browser with documented access.
- [ ] Private API/worker/Job deny unauthorized direct mutation.
- [ ] One unattended event and one complete night shift work on production.
- [ ] Sessions survive restart/revision.
- [ ] Memory recalls a grounded usual order in a new session.
- [ ] Duplicate event and duplicate approval actions are idempotent.
- [ ] Scheduler, Job, Pub/Sub, DLQ, Firestore, Vertex, Sessions, Memory, Trace,
      and Logging evidence exists.

### Quality

- [ ] Deterministic tests pass.
- [ ] Firestore parity tests pass without skips.
- [ ] Critical ADK evals pass with zero safety-trajectory failures.
- [ ] Cloud benchmark and economics are measured and committed.
- [ ] Three consecutive Job executions succeed.
- [ ] Rollback drill succeeds in under five minutes.

### Repository and documentation

- [ ] Repository is accessible to judges.
- [ ] The private-repository access path is verified or visibility is changed
      through an explicit release decision.
- [ ] Clean-clone setup works.
- [ ] Local and cloud deployment instructions are reproducible.
- [ ] Architecture matches the deployed system.
- [ ] Exact model/framework/services and start date are listed.
- [ ] Pre-existing code is disclosed granularly.
- [ ] Synthetic data and mocked integrations are disclosed.
- [ ] Security and known limitations are honest.
- [ ] Final tag, release manifest, image digests, and deployed revision agree.

### Video and Devpost

- [ ] Loom video is accessible without sign-in, English/subtitled, and under
      four minutes.
- [ ] Timecoded transcript matches the final Loom edit and reviewed captions.
- [ ] Demo guide reproduces the recording path from a clean browser.
- [ ] Product works in the first 10–15 seconds.
- [ ] Video visibly proves backend execution on Google Cloud.
- [ ] Hosted URL and demo instructions work.
- [ ] Architecture diagram is uploaded.
- [ ] Blog includes the required hackathon-entry statement.
- [ ] Social post uses #AllThingsAgenticHackathon.
- [ ] Devpost is submitted, not saved as a draft.
- [ ] Receipt and incognito verification are saved.

## 21. Authoritative references

- Hackathon overview and requirements:
  https://allthingsagentichackathon.devpost.com/
- Binding rules and scoring:
  https://allthingsagentichackathon.devpost.com/rules
- Final organizer checklist:
  https://allthingsagentichackathon.devpost.com/updates/45853-one-week-to-go-run-this-checklist-before-you-submit
- ADK on Cloud Run:
  https://docs.cloud.google.com/run/docs/ai/build-and-deploy-ai-agents/deploy-adk-agent
- Cloud Run Jobs:
  https://docs.cloud.google.com/run/docs/create-jobs
- Scheduled Cloud Run Jobs:
  https://docs.cloud.google.com/run/docs/execute-jobs-on-schedule
- Authenticated Pub/Sub push:
  https://docs.cloud.google.com/run/docs/tutorials/pubsub
- Pub/Sub exactly-once limits for push:
  https://docs.cloud.google.com/pubsub/docs/exactly-once-delivery
- GitHub Actions Google authentication:
  https://github.com/google-github-actions/auth
- Google Cloud WIF for deployment pipelines:
  https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- Cloud Run deployment Action:
  https://github.com/google-github-actions/deploy-cloudrun
- Agent Platform Sessions with ADK:
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions/manage-with-adk
- Memory Bank ADK quickstart:
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank/adk-quickstart
- Memory Bank setup and configuration:
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank/setup
- Agent Platform locations:
  https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/agent-locations
- Agent Platform IAM roles:
  https://docs.cloud.google.com/iam/docs/roles-permissions/aiplatform
- ADK tracing:
  https://adk.dev/observability/traces/

## 22. Immediate next action

Keep the next checkpoint local-only. Rerun the complete deterministic and
Firestore-emulator release suite after the Memory Bank policy addition, render
and review the non-mutating Memory payload, refresh the local container smoke,
and close the pre-push secret/history audit. Do not push or enable an API.

Then request two distinct approvals in order:

1. **Cloud bootstrap approval:** review the exact Terraform plan, expected
   spend, project/repository numeric IDs, and any narrowly required initial API
   prerequisite; enable/provision only the approved foundation.
2. **First private push approval:** run CICD-00 against the final outgoing
   commit range, confirm the repository is private and WIF environments are
   ready, then push the reviewed SHA so GitHub Actions—not a local key—builds
   and deploys development.

The initial Loom transcript and operator guide are now drafted. After the
development demo path and evidence IDs are stable, replace every placeholder,
freeze both documents against the release-candidate SHA, and reconcile them to
the deployed proof path. Rehearse the pair three times before opening Loom. The
transcript governs what is said and shown; the guide governs setup, reset, click
path, fallbacks, publication, and incognito verification. Neither document may
claim cloud, memory, evaluation, cost, or external effects until its cited
evidence exists.
