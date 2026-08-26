# Duka Autopilot Deployment Runbook

> Project: `my-duka-autopilot`
> Application region: `europe-west1`
> Vertex AI / Agent Platform context location: `global`
> Repository: private `jmwai/duka-autopilot`
> State: private `dev` branch pushed; no GCP resource in this runbook has been applied

This is the operator contract for the first development release and the final
production promotion. A command that creates, updates, or deletes a GCP
resource is run only after an explicit human approval. The first Git push is a
completed gate; every later push must still pass the repository audit.
Service-account keys are forbidden.

## 1. Release topology

Terraform owns APIs, state, Artifact Registry, WIF, Secret Manager containers,
runtime identities, least-privilege IAM, named Firestore databases, Agent
Platform context resources, Pub/Sub/DLQ, Scheduler, and the initial Cloud Run
service/Job definitions, including the unscheduled one-shot seed Job. GitHub
Actions owns application image builds and
subsequent Cloud Run image promotions.

The bootstrap enables the Telemetry API. Web, API, worker, and Job runtime
identities receive only `roles/telemetry.tracesWriter` and
`roles/serviceusage.serviceUsageConsumer` for direct OTLP/gRPC trace export;
the application uses no deprecated Google-specific trace exporter.

The one-time initial Cloud Run definitions use exact images produced by the
`Build release images` workflow. After the infrastructure exists,
`Deploy development` updates every service and Job to the same tested SHA and
smoke-tests the public web/BFF through the private API. Production only promotes
the exact development digests; it never rebuilds them.

The seed Job is never scheduled and never runs as a deployment side effect. An
operator invokes it once for an initially empty synthetic environment. It uses
`seed(force=False)`, reports the created counts, and refuses to wipe an already
seeded database.

## 2. Local preflight — no cloud mutation

Required local tools:

- gcloud with user and Application Default Credentials for the credited project;
- Terraform 1.14.5;
- Docker;
- GitHub CLI authenticated to the private repository;
- Python 3.12.12 and uv 0.11.13;
- Node.js 24.12.0, Corepack, and pnpm 11.9.0.

Run before requesting any cloud or push approval:

```bash
uv lock --check
uv run --frozen pytest -q
uv run --frozen python scripts/check_compatibility.py
terraform fmt -check -recursive deployment/terraform
terraform -chdir=deployment/terraform/bootstrap init -backend=false -lockfile=readonly
terraform -chdir=deployment/terraform/bootstrap validate
terraform -chdir=deployment/terraform/app init -backend=false -lockfile=readonly
terraform -chdir=deployment/terraform/app validate
actionlint .github/workflows/*.yml
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend check
docker build -f deployment/docker/backend.Dockerfile -t duka-backend:preflight .
docker build -f deployment/docker/frontend.Dockerfile -t duka-frontend:preflight .
uv run --frozen python scripts/prepush_audit.py \
  --output docs/evidence/prepush-audit.json
```

The release version of the test gate must run with the Firestore emulator and
zero skips. The GitHub CI workflow supplies this automatically.

## 3. Approval gate A — bootstrap GCP foundation

Before execution, record:

- GCP project number and billing-account linkage;
- immutable GitHub owner ID and repository ID;
- final bootstrap Terraform plan;
- estimated monthly/judging-window spend;
- operator name and approval time.

The local authenticated preflight confirmed that
`aiplatform.googleapis.com` and `cloudresourcemanager.googleapis.com` are not
yet enabled. This is expected before bootstrap and must not be worked around by
an ad-hoc local enablement. The reviewed bootstrap plan is the authorization
boundary. If Terraform cannot read the project before creating the declared
project-service resources, enable only `serviceusage.googleapis.com` and
`cloudresourcemanager.googleapis.com` as a separately recorded bootstrap
prerequisite, rerun the saved plan, and let Terraform own the full declared API
set thereafter.

The GCS backend bucket must exist before Terraform can store bootstrap state.
Create the bucket with uniform access, public-access prevention, and versioning,
then initialize the bootstrap backend and import that bucket into
`google_storage_bucket.terraform_state`. Do not leave bootstrap state on a
laptop. Use a local, ignored `backend.hcl` copied from
`deployment/terraform/bootstrap/backend.hcl.example`.

Create an ignored `terraform.tfvars` from the example and populate the numeric
GitHub IDs. Review the saved plan before the separately approved apply:

```bash
terraform -chdir=deployment/terraform/bootstrap init -backend-config=backend.hcl
terraform -chdir=deployment/terraform/bootstrap import google_storage_bucket.terraform_state my-duka-autopilot-tfstate
terraform -chdir=deployment/terraform/bootstrap plan -out=bootstrap.tfplan
terraform -chdir=deployment/terraform/bootstrap show bootstrap.tfplan
```

The reviewed apply creates/enables only the declared bootstrap resources. Save
these non-secret outputs:

```bash
terraform -chdir=deployment/terraform/bootstrap output -json
```

Required outputs are the project number, Artifact Registry path, WIF provider,
dev/prod deployer service accounts, evaluator service account, state bucket,
and secret container names.

## 4. Secret versions and GitHub protection

Add one version to each Secret Manager container for each environment:

- `duka-ENV-channel-key` — high-entropy trusted channel credential;
- `duka-ENV-owner-password` — demo owner credential;
- `duka-ENV-session-secret` — at least 32 random bytes for signed sessions;
- `duka-ENV-user-key-secret` — stable random key for opaque Agent Platform IDs.

Enter values through protected stdin or an approved secret manager interface.
Never put a value in a shell argument, Terraform variable, workflow variable,
repository file, build argument, log, or screenshot. Do not rotate
`user-key-secret` during judging: that would change the exact Memory Bank user
scope.

Create GitHub environments and variables exactly as recorded in
`docs/deployment-matrix.md`:

- `development`: restricted to `dev`, no required reviewer for normal dev
  releases;
- `production`: restricted to `main`, required reviewer, deployment wait timer
  optional;
- repository variables for project, region, and WIF provider;
- environment variables for the matching deployer/evaluator identities.

Keep `GCP_DEV_DEPLOY_ENABLED=false` or unset until the development Cloud Run
resources exist. This lets the first `dev` push run CI without attempting a
half-configured deployment.

## 5. Approval gate B — first private push

Immediately before pushing:

1. inspect every untracked/modified file and the outgoing commit range;
2. search tracked content and Git history for credentials, tokens, private
   keys, `.env`, Terraform state, databases, and generated auth files;
3. verify the repository is still private;
4. verify the remote is exactly `git@github.com:jmwai/duka-autopilot.git`;
5. verify workflow action SHAs, branch targets, WIF numeric claims, disclosure,
   licenses, and large files;
6. obtain explicit push approval.

Push only the reviewed `dev` branch by name. Never use `git push --mirror`,
`git push --all`, or a refspec that includes `refs/backup`, `refs/original`, or
`refs/codex`; those local safety/tool refs are deliberately outside the
reviewed release history.

Push the reviewed `dev` revision. CI runs deterministic tests, Firestore parity
with zero skips, compatibility checks, Terraform validation, and local image
builds. The deployment job stays skipped while
`GCP_DEV_DEPLOY_ENABLED` is false.

## 6. Produce initial immutable images

On the reviewed `dev` SHA, manually run `Build release images`. It authenticates
through WIF only after both Docker builds finish, pushes SHA tags, resolves
registry digests, and uploads `image-manifest.json` as
`release-images-SHA`.

Confirm:

- the manifest SHA equals the checked-out SHA;
- both references use `@sha256:`;
- no `gha-creds-*.json` entered a build context;
- Artifact Registry shows both digests and their SHA tags.

## 7. Approval gate C — development infrastructure

Copy `deployment/terraform/app/backend.hcl.example` to ignored `backend.hcl`.
Copy `terraform.tfvars.example` to ignored `terraform.tfvars`, insert the
development image references from the GitHub image manifest, and use the full
Git SHA.

```bash
terraform -chdir=deployment/terraform/app init -backend-config=backend.hcl
terraform -chdir=deployment/terraform/app plan -out=dev.tfplan
terraform -chdir=deployment/terraform/app show dev.tfplan
```

The plan must show `duka-dev` resources only, a `global` context resource,
named Firestore `duka-dev`, authenticated Pub/Sub push, a five-attempt DLQ,
02:00 and 06:30 Africa/Nairobi schedules, protected durable resources, and no
public invoker except `duka-dev-web`. Apply only after explicit approval.

After the apply:

- record the immutable context resource ID;
- verify all workload service accounts and Cloud Run IAM;
- verify secret references resolve without revealing payloads;
- set `GCP_DEV_DEPLOY_ENABLED=true`;
- rerun `Deploy development` on the same `dev` SHA.

The workflow must upload a manifest and smoke result proving the public web,
private API, release SHA, and durable-topology fingerprint agree.

Do not run the seed Job until the custom Memory Bank policy in section 7.1 is
applied and verified. The Job prepares both the deterministic Firestore baseline
and the one allowlisted demo preference through the awaited Memory outbox.

### 7.1 Apply and verify the custom Memory Bank policy

Terraform creates and protects the context resource, including the base
embedding and retention settings. Provider 7.45.0 does not expose custom Memory
Bank topics and examples, so those fields use the official Vertex SDK as a
separate, approval-gated post-provision step.

First render the payload locally; this performs no network call:

```bash
uv run --frozen python scripts/configure_memory_bank.py \
  --project my-duka-autopilot \
  --location global \
  --context-id CONTEXT_ID
```

Review that the payload contains exactly:

- scope keys `app_name` and `user_id`;
- topic `shopping_preferences_and_usual_order`;
- the multilingual embedding and 90-day TTL;
- positive usual-order examples and empty-result negative examples for payment,
  refund, phone, complaint, and owner-role content;
- third-person memories and revisions enabled.

Only after the context-specific payload is approved, rerun with `--apply`.
Record the operator, time, context resource name, release SHA, and returned
resource name. Read the context back through the console or SDK and retain a
redacted artifact proving the configuration. Never pass `--apply` during local
preflight, CI validation, or an ordinary application image deploy.

Before accepting inbound memory traffic, prove that the application’s awaited
generation metadata uses the same custom topic. A Memory Bank error must leave
the summary retryable in Firestore and must not reverse an already committed
order. Reapply and re-verify this customization after any intentional Terraform
change to the context’s base Memory Bank configuration.

Now verify the named development Firestore database is the intended empty
synthetic environment. Execute `duka-dev-seed` once, retain its execution JSON
and logs, and require 12 products, 8 customers, 10 orders, 6 statement rows,
and `memory_prepared=true`. Inspect the generated memory for the opaque demo
user: it must contain only 4x Unga wa Dola 2kg and 3x Laundry soap bar—no price,
phone, payment, refund, or authority fact. A second invocation must report
`seeded=false` and `memory_prepared=true`; it must not reset, duplicate, or
regenerate contradictory data. Repeat the same check for `duka-prod-seed` only
after the production infrastructure plan is approved and before production
demo traffic begins.

## 8. Development evidence gates

Before production:

1. run `Model evaluation` on the same `dev` SHA and retain both detailed ADK
   eval logs plus `eval-manifest.json`;
2. run `Capture nightly proof` for `dev` three times, retaining Job execution
   JSON and correlated logs;
3. verify an OTLP-ingested Cloud Trace joins the frontend request, private API,
   Pub/Sub publish/delivery, ADK turn, approval resume where applicable, and Job
   execution using the same trace/release identifiers;
4. run restart/resume and cross-session Memory Bank acceptance tests;
5. verify Pub/Sub replay, transient retry, and DLQ behavior;
6. run the 50,000-row benchmark and commit measured economics evidence;
7. perform a development rollback rehearsal;
8. verify the hosted demo path from a clean browser.

No unit-test count may be described as an ADK evaluation result. No cloud claim
is accepted without a matching immutable SHA, resource ID, timestamp, and raw
artifact.

## 9. Approval gate D — production infrastructure and promotion

Initialize a separate app backend using prefix `duka/prod/app`, and create a
production tfvars file with `environment="prod"`, the exact development image
digests, and the same release SHA. Review and explicitly approve the production
plan/apply. It creates isolated production state and a protected production
Agent Platform context; it must not read, replace, or destroy development
durable state.

Run `Promote production` from `main` with:

- the full tested SHA;
- backend and frontend digests copied from the successful dev manifest;
- the successful `Deploy development` run ID.

The workflow independently requires successful CI and model-eval runs for the
SHA, downloads the dev smoke artifact, verifies both digests, captures current
production images, promotes without rebuilding, and smoke-tests the result. A
failed promotion restores every service and Job image plus the previous
`RELEASE_SHA`.

## 10. Freeze and rollback

Save the final production manifest, smoke JSON, GitHub run IDs, Cloud Run
revision IDs, Job execution IDs, context IDs, Firestore database, Pub/Sub and
Scheduler evidence, trace IDs, eval report, benchmark report, and known
limitations in the evidence ledger.

Application rollback changes images and release metadata on every service and
the nightly, digest, and seed Jobs only. It never
recreates Firestore or the Agent Platform context. The compatibility fingerprint
blocks graph/application-name/user-key changes that could strand a suspended
approval. A topology-breaking release requires draining or migrating pending
invocations before promotion.

Keep production and all evidence online through judging. Any cleanup of
Sessions, Memory Bank, Firestore, Artifact Registry, or the Loom source is a
separate post-judging decision.
