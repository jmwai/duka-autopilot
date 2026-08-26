# Duka Autopilot Deployment Matrix

> Status: Phase 0 configuration record
> Last updated: August 26, 2026
> Secrets: none belong in this file

## Locked coordinates

| Setting | Value | Status |
|---|---|---|
| GCP project ID | `my-duka-autopilot` | Locked |
| GCP project number | Pending read after `gcloud` user credentials are refreshed | Blocked only for numeric IAM conditions |
| Credits | Hackathon credits applied | User-confirmed |
| Local ADC quota project | `my-duka-autopilot` | Configured |
| Application region | `europe-west1` | Locked |
| Vertex AI location | `global` | Locked |
| Agent Platform context location | `global` | Locked |
| Agent Platform API | `aiplatform.googleapis.com` | Authenticated preflight found it disabled; enable only through approval gate A |
| Model | `gemini-3.7-flash` | Preserve |
| Memory generation model | `gemini-3.5-flash` | Locked for custom Memory Bank extraction only |
| Memory embedding | `gemini-embedding-2` at `global` | Locally schema-validated |
| Memory custom topic | `shopping_preferences_and_usual_order` | Defined locally; not applied or read back from cloud |
| Session/memory retention | 90 days | Defined locally; cloud proof pending |
| GitHub owner/repository | `jmwai/duka-autopilot` | Locked |
| Git remote | `git@github.com:jmwai/duka-autopilot.git` | Configured |
| Repository visibility | Private | Locked for development |
| Push state | Private `dev` branch pushed; baseline `4526871`; no other branch or tag pushed | Verified |
| Scheduler timezone | `Africa/Nairobi` | Locked |
| Nightly schedule | `02:00` daily | Defined, not applied |
| Morning digest schedule | `06:30` daily | Defined, not applied |
| Loom | Final recording and hosting platform | Locked |

The ADC quota-project command controls quota/billing attribution for local
Application Default Credentials. It does not grant GitHub or Cloud Run an
identity. The attempted project-number read on August 26 could not refresh the
non-interactive `gcloud` user token; no cloud mutation was attempted. An
authenticated ADK evaluation reached `my-duka-autopilot` but stopped with
`SERVICE_DISABLED`, confirming that Agent Platform API enablement remains part
of the reviewed bootstrap rather than an undocumented prerequisite.

## Environment resources

| Resource | Development | Judging/production |
|---|---|---|
| Frontend Cloud Run service | `duka-dev-web` | `duka-prod-web` |
| API Cloud Run service | `duka-dev-api` | `duka-prod-api` |
| Worker Cloud Run service | `duka-dev-worker` | `duka-prod-worker` |
| Nightly Cloud Run Job | `duka-dev-nightly` | `duka-prod-nightly` |
| Digest Cloud Run Job | `duka-dev-digest` | `duka-prod-digest` |
| One-shot seed Cloud Run Job | `duka-dev-seed` | `duka-prod-seed` |
| Firestore database | `duka-dev` | `duka-prod` |
| Pub/Sub inbound topic | `duka-dev-inbound` | `duka-prod-inbound` |
| Pub/Sub push subscription | `duka-dev-inbound-push` | `duka-prod-inbound-push` |
| Dead-letter topic | `duka-dev-inbound-dlq` | `duka-prod-inbound-dlq` |
| Scheduler nightly trigger | `duka-dev-nightly` | `duka-prod-nightly` |
| Scheduler digest trigger | `duka-dev-digest` | `duka-prod-digest` |
| Agent context display name | `duka-dev-context` | `duka-prod-context` |
| Terraform state prefix | `duka/dev/app` | `duka/prod/app` |

Context resource IDs are intentionally `TBD` until the one-time bootstrap.
They are immutable compatibility inputs after creation and must never be
recreated by an application deployment.

## Shared resources

| Resource | Name |
|---|---|
| Artifact Registry repository | `duka-images` |
| Frontend image | `duka-frontend` |
| Backend image | `duka-backend` |
| Terraform state bucket | `my-duka-autopilot-tfstate` (availability check required before creation) |
| WIF pool | `github-pool` |
| WIF provider | `duka-github` |

Images use Git SHA tags and production promotion resolves immutable digests.
Production never rebuilds an approved development image.

## Runtime identities

| Identity | Narrow responsibility |
|---|---|
| `duka-dev-web-runtime` | Invoke `duka-dev-api`; write dev trace spans through the Telemetry API |
| `duka-prod-web-runtime` | Production equivalent, production resources only |
| `duka-dev-api-runtime` | Dev Firestore/application access, publish dev inbound events, invoke approved model/context operations, write trace spans |
| `duka-prod-api-runtime` | Production equivalent, production resources only |
| `duka-dev-worker-runtime` | Consume dev events, dev business/context access, model invocation, write trace spans |
| `duka-prod-worker-runtime` | Production equivalent, production resources only |
| `duka-dev-job-runtime` | Execute dev nightly, digest, and manually invoked idempotent seed Jobs and write their trace spans |
| `duka-prod-job-runtime` | Execute production nightly, digest, and manually invoked idempotent seed Jobs only |
| `duka-dev-pubsub-invoker` | Invoke dev worker only |
| `duka-prod-pubsub-invoker` | Invoke production worker only |
| `duka-dev-scheduler-invoker` | Execute dev nightly Job only |
| `duka-prod-scheduler-invoker` | Execute production nightly Job only |
| `duka-gha-dev-deployer` | Push images and update dev Cloud Run resources |
| `duka-gha-prod-deployer` | Promote exact digests to production after protected approval |
| `duka-gha-dev-evaluator` | Invoke Vertex AI only for reviewed ADK eval runs |

No deployer receives project Owner/Editor, IAM administration, Firestore data
access, model invocation, Memory Bank access, or secret payload access.

## Required configuration keys

| Key | Development | Production | Secret? |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | `my-duka-autopilot` | `my-duka-autopilot` | No |
| `GOOGLE_CLOUD_LOCATION` | `global` | `global` | No |
| `GEMINI_MODEL` | `gemini-3.7-flash` | `gemini-3.7-flash` | No |
| `DUKA_ENV` | `dev` | `prod` | No |
| `DUKA_STORE` | `firestore` | `firestore` | No |
| `FIRESTORE_DATABASE` | `duka-dev` | `duka-prod` | No |
| `DUKA_BUS` | `pubsub` | `pubsub` | No |
| `PUBSUB_TOPIC_PREFIX` | `duka-dev-` | `duka-prod-` | No |
| `AGENT_CONTEXT_ID` | TBD after bootstrap | TBD after bootstrap | Configuration, protected from replacement |
| `APP_NAME` | `duka-autopilot` | `duka-autopilot` | Compatibility constant |
| `RELEASE_SHA` | Injected by deploy | Injected by deploy | No |
| `DUKA_TRACE_ENABLED` | `true` | `true` | No |
| `DUKA_TRACE_SAMPLE_RATE` | `1.0` during judging | `1.0` during judging | No |
| `DUKA_MAX_REQUEST_BYTES` | `8500000` | `8500000` | No |
| `DUKA_RATE_LIMIT_AUTH_LOGIN` | `10` per instance/minute | `10` per instance/minute | No |
| `DUKA_RATE_LIMIT_CHAT` | `60` per instance/minute | `60` per instance/minute | No |
| `DUKA_RATE_LIMIT_INBOUND` | `120` per instance/minute | `120` per instance/minute | No |
| `DUKA_RATE_LIMIT_PUBSUB_PUSH` | `240` per instance/minute | `240` per instance/minute | No |
| Demo owner session signing secret | Secret Manager reference | Secret Manager reference | Yes |
| Demo owner credential | Secret Manager reference | Secret Manager reference | Yes |
| Trusted channel key | Secret Manager reference | Secret Manager reference | Yes |
| Stable opaque user-key secret | Secret Manager reference | Secret Manager reference | Yes |

## GitHub repository and environment variables

| Variable | Scope | Value/source |
|---|---|---|
| `GCP_PROJECT_ID` | Repository | `my-duka-autopilot` |
| `GCP_REGION` | Repository | `europe-west1` |
| `GCP_WIF_PROVIDER` | Repository | Terraform bootstrap output `workload_identity_provider` |
| `GCP_DEV_DEPLOYER_SA` | `development` environment | Bootstrap dev deployer output |
| `GCP_DEV_EVALUATOR_SA` | `development` environment | Bootstrap evaluator output |
| `GCP_DEV_DEPLOY_ENABLED` | `development` environment | Start `false`; set `true` only after dev infrastructure exists |
| `GCP_PROD_DEPLOYER_SA` | `production` environment | Bootstrap prod deployer output |

`development` is restricted to the `dev` branch. `production` is restricted to
`main` and requires an explicit reviewer. These are configuration values, not
secret payloads; GitHub receives no service-account JSON key.

## Outstanding Phase 0 checks

- [ ] Refresh interactive `gcloud` user authentication, then record the project
      number without printing access tokens.
- [ ] Verify billing/credit linkage and required service quotas.
- [ ] Run one `global` Vertex model call without changing the model.
- [ ] Create/probe a disposable development Agent Platform context and verify
      managed Sessions plus Memory Bank from the intended client versions.
- [x] Render and validate the complete Memory Bank customization payload
      against the locked Vertex SDK without making a network call. Terraform
      owns the protected context; the SDK post-provision apply remains gated.
- [ ] Verify named Firestore database and required product compatibility in
      `europe-west1`.
- [ ] Confirm all selected names meet service constraints and are unused.
- [ ] Record immutable GitHub owner/repository numeric IDs before creating WIF
      conditions.
- [ ] Run CICD-00 immediately before the first push; keep the repository private
      until an explicit release-access decision.
- [x] Local Terraform modules pass Terraform 1.14.5/provider 7.45.0 schema
      validation; no plan or apply has run.
- [x] CI, image-build, dev deployment, model-eval, nightly-proof, and production
      promotion workflows pass local `actionlint`; none has run remotely.
- [x] Direct OTLP/gRPC trace export, W3C propagation through the BFF and Pub/Sub,
      structured log correlation, Telemetry API enablement, and least-privilege
      trace-writer IAM are implemented locally; cloud ingestion remains to be
      proven after deployment.
