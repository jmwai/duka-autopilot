# Duka Autopilot Evidence Ledger

> Status: active release ledger
> Last updated: August 26, 2026
> Rule: a claim is submission-ready only when its evidence is tied to the exact
> committed SHA and, where applicable, immutable image digest and cloud resource
> execution ID.

## Evidence states

| State | Meaning |
|---|---|
| `LOCAL-PROVEN` | Reproducible local evidence exists; no cloud claim is implied |
| `IMPLEMENTED` | Code/configuration exists and local checks pass, but the required runtime proof is missing |
| `CLOUD-PENDING` | Requires an approval-gated GCP or GitHub execution |
| `CONTENT-PENDING` | Requires the stable release, final Loom cut, or publication URL |
| `FINAL` | Exact release evidence is captured and suitable for the submission |

## Judge-facing claims

| Claim | Current state | Current evidence | Evidence required for `FINAL` |
|---|---|---|---|
| Duka is an event-driven autonomous workflow | `IMPLEMENTED` | ADK graph, async API, worker, local event tests | Authenticated Pub/Sub delivery, correlated ADK/Firestore trace, exact release SHA |
| Inbound intake acknowledges immediately | `IMPLEMENTED` | HTTP 202 endpoint and async intake tests | Hosted ten-request p95 report and one visible Loom execution |
| Routine reconciliation is deterministic | `LOCAL-PROVEN` | `docs/evidence/benchmark-local.json`; exact-pass tests | Cloud Run Job counts and raw report tied to final digest |
| Approximately 97% settles without Gemini | `LOCAL-PROVEN` | 48,402/49,756 rows = 97.28% in local no-fuzzy baseline | Same declared dataset/configuration executed in the Cloud Run Job |
| Gemini receives only bounded ambiguity | `IMPLEMENTED` | 25-row residue batches, 40-batch cap, stop-on-no-progress tests | Model-call trace with batches, tokens, cost, and no-progress behavior |
| Uncertain money remains a proposal | `LOCAL-PROVEN` | fuzzy lifecycle and money-invariant tests | Cloud approve/reject traces and Firestore before/after evidence |
| Refund suspension survives restart | `IMPLEMENTED` | durable handle/state-machine tests and compatibility fingerprint | Ten restart/revision resumes per decision with zero duplicate reply |
| Duka remembers a grounded usual order | `IMPLEMENTED` | narrow outbox, custom topic payload, catalog-override tests | Cross-session managed Memory Bank run, multilingual score, isolation proof |
| Blocked text cannot poison later context | `LOCAL-PROVEN` | sanitized-context and screening tests | ADK trajectory eval and cloud trace showing no later model/tool exposure |
| Duka runs on Google Cloud | `CLOUD-PENDING` | Terraform/containers/workflows only | Public `.run.app`, private services, Job, Firestore, Pub/Sub, Scheduler, Vertex, Session, Memory, Trace evidence |
| Deployment is keyless and reproducible | `IMPLEMENTED` | WIF Terraform and pinned GitHub workflows pass local validation | Successful GitHub OIDC run, immutable digest manifest, IAM evidence |
| Production can roll back safely | `IMPLEMENTED` | digest-promotion/rollback workflow and topology guard | Timed production rollback manifest under five minutes |
| The economics are measured | `LOCAL-PROVEN` | `docs/economics.md` local exact-pass measurement | Model, Firestore, Cloud Run duration, operations, and total cloud cost |
| Data is synthetic and privacy-safe | `IMPLEMENTED` | seeded generator, synthetic integration disclosure, PII-safe logging tests | Final fixture manifest, scan report, and demo disclosure |
| Built during the hackathon | `IMPLEMENTED` | Git history and pre-existing work disclosure | Final public/private judge-accessible history and linked disclosure |

## Acceptance matrix A01–A30

| ID | Scenario | State | Best current evidence | Missing proof |
|---|---|---|---|---|
| A01 | Text order | `IMPLEMENTED` | async intake + order tests | hosted trace and mutation |
| A02 | Duplicate event | `LOCAL-PROVEN` | SQLite/Firestore event replay tests | Pub/Sub redelivery trace |
| A03 | Retry and DLQ | `IMPLEMENTED` | retry classification code, Terraform DLQ | controlled cloud delivery proof |
| A04 | Tool integrity | `LOCAL-PROVEN` | money/tool validation tests | ADK tool trajectory |
| A05 | Exact reconciliation | `LOCAL-PROVEN` | invariants + local benchmark | Cloud Run Job report |
| A06 | Fuzzy lifecycle | `LOCAL-PROVEN` | transaction/invariant tests | cloud approve/reject proof |
| A07 | Security screen | `LOCAL-PROVEN` | screening tests | model/tool trace |
| A08 | History poisoning | `LOCAL-PROVEN` | sanitized-history tests | ADK eval and managed Session proof |
| A09 | Same-session restart | `IMPLEMENTED` | managed-service wiring and local contract | Cloud Run A/B revision test |
| A10 | Multi-instance sequence | `IMPLEMENTED` | durable customer lease tests | two Cloud Run instances |
| A11 | Session rotation | `IMPLEMENTED` | pointer/old-session local test | managed Sessions console/trace |
| A12 | Suspended old session | `IMPLEMENTED` | stored-handle logic | cloud rotation and resume |
| A13 | Approval/rejection resume | `IMPLEMENTED` | restart-safe state-machine tests | 10/10 cloud report |
| A14 | Duplicate decision | `LOCAL-PROVEN` | transaction/idempotency tests | cloud concurrent delivery |
| A15 | Resume failure | `LOCAL-PROVEN` | retryable failure tests | injected managed-service 503 trace |
| A16 | Conflicting decisions | `LOCAL-PROVEN` | transactional winner tests | cloud concurrency trace |
| A17 | Expired/missing session | `LOCAL-PROVEN` | error/copy tests | managed expiry evidence |
| A18 | Cross-session usual | `IMPLEMENTED` | narrow summary + catalog override | managed Memory run |
| A19 | Multilingual memory | `IMPLEMENTED` | multilingual embedding/topic config | curated >=90% report |
| A20 | User isolation | `IMPLEMENTED` | exact opaque scope contract | ten-user cloud isolation report |
| A21 | Unknown usual | `IMPLEMENTED` | agent constraints | ADK eval |
| A22 | Changed preference | `IMPLEMENTED` | revisions enabled/configured | consolidation evidence |
| A23 | Stale catalog | `LOCAL-PROVEN` | catalog-derived order tests | managed-memory tool trace |
| A24 | Negative memory | `IMPLEMENTED` | negative examples and allowlist tests | Memory Bank inspection |
| A25 | Memory outage | `LOCAL-PROVEN` | durable outbox retry test | cloud degraded/retry trace |
| A26 | Real voice | `CONTENT-PENDING` | byte-pipeline stub coverage only | human Swahili audio eval/video |
| A27 | Bilingual ledger images | `CONTENT-PENDING` | Google-only schema, prompts, generator, and verifier implemented; APIs disabled | English/Kiswahili Vertex-generated fixtures, Gemini extraction results, and Loom proof |
| A28 | Scheduled night shift | `IMPLEMENTED` | Job/Scheduler Terraform and local nightly tests | Scheduler execution ID/report |
| A29 | Authorization | `IMPLEMENTED` | local BFF/route auth tests and IAM config | incognito/IAM denial matrix |
| A30 | Rollback | `IMPLEMENTED` | promotion workflow | timed production drill |

## Local artifacts

| Artifact | Purpose | Status |
|---|---|---|
| `docs/evidence/local-preflight-2026-08-26.md` | 107/0/0 suite, schema/workflow/container/seed/eval-package gate | Current local candidate |
| `docs/evidence/prepush-audit.json` | Candidate and branch/tag history credential/trailer scan | Preliminary; rerun immediately before each push |
| `fixtures/demo/manifest.json` | Google-only bilingual fixture allowlist and freeze contract | Schema v2 implemented; release-ready false until four generated assets are frozen |
| `docs/evidence/benchmark-local.json` | Raw 50,000-row local no-fuzzy baseline | Current local candidate |
| `docs/economics.md` | Interpreted local baseline and claim limits | Current local candidate |
| `deployment/compatibility.json` | Durable topology fingerprint | Enforced locally and in deploy workflows |

## Cloud evidence package to capture

Each artifact must include `project_id`, environment, timestamp, final Git SHA,
image digest(s), resource name, execution/request/trace ID, command or workflow
source, result, and redaction note.

- `docs/cloud-deployment.md`
- `docs/evaluation-report.md`
- `docs/security-and-limitations.md`
- `docs/evidence/cloud/terraform-plan-summary.json`
- `docs/evidence/cloud/release-manifest.json`
- `docs/evidence/cloud/smoke.json`
- `docs/evidence/cloud/model-eval-summary.json`
- `docs/evidence/cloud/nightly-benchmark.json`
- `docs/evidence/cloud/restart-resume.json`
- `docs/evidence/cloud/memory-eval.json`
- `docs/evidence/cloud/authorization-matrix.json`
- `docs/evidence/cloud/rollback.json`

Console screenshots and Loom frames supplement these records but do not replace
raw IDs and machine-readable evidence.

## Publication package

| Artifact | State | Final verification |
|---|---|---|
| `docs/demo-transcript.md` | `CONTENT-PENDING` | timecodes/captions match final Loom cut |
| `docs/demo-guide.md` | `CONTENT-PENDING` | second-operator rehearsal succeeds |
| Loom URL | `CONTENT-PENDING` | incognito playback, under four minutes |
| Hosted application URL | `CLOUD-PENDING` | incognito demo path and access instructions |
| Technical article URL | `CONTENT-PENDING` | required hackathon statement present |
| Social URL | `CONTENT-PENDING` | exact `#AllThingsAgenticHackathon` present |
| Devpost receipt | `CONTENT-PENDING` | submission status is submitted, not draft |
