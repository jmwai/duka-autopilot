# Local Testing and GCP Configuration

> Project: `agent-platform-503913`
>
> Cloud Run region: `europe-west1`
>
> Vertex AI and Agent Platform location: `global`
>
> Model contract: `gemini-3.7-flash`
>
> Cloud mutation status: this guide prepares and verifies configuration; it
> does not authorize a Terraform apply, image push, deployment, or media call.

This is the shortest reproducible path from a clean checkout to the seeded
judge experience, followed by the exact configuration inputs required before
the first reviewed GCP bootstrap.

## 1. Toolchain

The locked release toolchain is:

- Python 3.12.12 and uv 0.11.13;
- Node.js 24.12.0, Corepack, and pnpm 11.9.0;
- Terraform 1.14.5;
- Docker;
- gcloud with both user credentials and Application Default Credentials;
- GitHub CLI authenticated to the private repository;
- Java 21 and Firebase CLI for the zero-skip Firestore emulator gate;
- `actionlint` for workflow validation.

Verify the interpreter used by uv:

```bash
uv run python --version
```

The current developer virtual environment reports Python 3.14, while the
release image and CI contract use 3.12.12. The backend image has been proven on
3.12.12, but recreate the local `.venv` on 3.12.12 before freezing the release
candidate so local and CI deprecation behavior cannot diverge.

## 2. Deterministic local judge run

### 2.1 Install and configure the backend

```bash
uv sync --extra dev
cp .env.example .env.local
```

If the earlier instruction already copied the template into the virtual
environment directory, preserve it by moving just that file:

```bash
mv .env/.env.example .env.local
```

Do not remove `.env/`; it is a Python virtual environment in that checkout.

Use the following local values in `.env.local` for the seed-only path. This
name is intentional: `.env/` is already a Python virtual-environment directory
in some checkouts, while `.env.local` is an ignored regular configuration file.
Every backend entrypoint loads `.env.local` first and ignores a directory named
`.env`. Set `DUKA_ENV_FILE=/absolute/path/to/file` only when you need an
explicit alternative.

```dotenv
DUKA_ENV=local
DUKA_STORE=sqlite
DUKA_DB=data/duka-judge-4k.db
DUKA_BUS=local
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=agent-platform-503913
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3.7-flash
RELEASE_SHA=local
DUKA_TRACE_ENABLED=false
```

The deterministic seed and exact reconciliation do not call Gemini. They do
not consume model quota, but keeping the Vertex AI backend selected means the
same process can safely exercise live agent turns with Application Default
Credentials. Do not switch `GOOGLE_GENAI_USE_VERTEXAI` to `false` unless you
deliberately intend to use the Gemini Developer API and have separately
configured an API key; Duka's release path stays on Vertex AI.

### 2.2 Choose one seed profile

For the compact baseline only:

```bash
uv run python -m agents.seed --force
```

For the judge-shaped 4,000-row environment:

```bash
uv run python -m app.jobs seed --seed-profile judge --seed-rows 4000
```

For the full benchmark rehearsal:

```bash
DUKA_DB=data/duka-judge-50k.db \
uv run python -m app.jobs seed --seed-profile judge --seed-rows 50000
```

Use a new explicit `DUKA_DB` filename for each clean judge run. The judge seed
is deliberately non-destructive and refuses to wipe a populated database.
Do not combine the baseline and judge profiles in one database.

The 4,000-row command was verified locally on August 27, 2026. It produced:

- 3,986 unique statement rows after duplicate-reference removal;
- 3,874 deterministic exact matches;
- 112 ambiguous residue rows;
- 97.19% deterministic settlement;
- zero model calls and USD 0.00 model cost;
- exactly one ledger-row, one low-confidence-order, and one restock approval;
- prepared English and Kiswahili business conversations.

These are local synthetic fixture results, not cloud execution evidence.

### 2.3 Start the backend

```bash
uv run uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`. Check:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/version
curl http://localhost:8000/digest/morning
curl http://localhost:8000/approvals
```

Interactive API documentation is at `http://localhost:8000/docs`.

### 2.4 Start the standalone frontend

In a second terminal:

```bash
cd frontend
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
DUKA_API_URL=http://127.0.0.1:8000 \
DUKA_ENV=local \
RELEASE_SHA=local \
NEXT_DEPLOYMENT_ID=local \
pnpm dev
```

Open `http://localhost:3000`. Local mode bypasses owner login. Review the
judge journey in this order:

1. `/` — morning outcome and authority summary;
2. `/approvals` — the three prepared decisions;
3. `/night-shift` — deterministic settlement and residue;
4. `/inbox` — English/Kiswahili conversations and execution receipts;
5. `/ledger` — recorded versus gated rows;
6. `/orders` and `/inventory` — catalog-grounded business truth;
7. `/evidence` — claim status and release provenance.

The release media sync warning is expected until the separately approved
Google-generated bilingual fixtures are frozen. Placeholder media must never
be described as release evidence.

## 3. Automated local gates

Backend:

```bash
uv lock --check
uv run --frozen pytest -q
uv run --frozen python scripts/check_compatibility.py
```

Frontend:

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm test:e2e
pnpm test:e2e:judge
```

The browser suites start isolated backend and frontend processes and seed their
own databases. Stop manually running development servers if ports conflict.

Firestore parity requires Java 21 and Firebase CLI:

```bash
firebase emulators:exec --project demo-duka --only firestore \
  ".venv/bin/python -m pytest tests/test_store_firestore.py -q"
```

Release infrastructure checks:

```bash
terraform fmt -check -recursive deployment/terraform
terraform -chdir=deployment/terraform/bootstrap init -backend=false -lockfile=readonly
terraform -chdir=deployment/terraform/bootstrap validate
terraform -chdir=deployment/terraform/app init -backend=false -lockfile=readonly
terraform -chdir=deployment/terraform/app validate
actionlint .github/workflows/*.yml
```

## 4. Optional local Vertex AI path

Only enable Vertex locally when testing a real text, audio, image, Memory Bank,
or ADK evaluation path. Preserve the model and global location:

```dotenv
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=agent-platform-503913
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3.7-flash
```

The project API and IAM must exist before this path works. A seeded exact-only
run should remain model-free even after Vertex is configured.

If ADK reports `No API key was provided`, it selected the Gemini Developer API
instead of Vertex AI. Stop the running server, clear any stale shell override,
and restart so `.env.local` is loaded by a fresh parent process:

```bash
unset GOOGLE_GENAI_USE_VERTEXAI GOOGLE_API_KEY
uv run uvicorn app.main:app --reload
```

Confirm the backend selection without making a model call:

```bash
uv run python -c 'from app.environment import load_environment; load_environment(); from google.genai import Client; c=Client(); print({"vertexai": c.vertexai})'
```

The expected result is `{'vertexai': True}`. Uvicorn reload children inherit
the parent process environment, so editing `.env.local` does not repair a
parent that was already running with `GOOGLE_GENAI_USE_VERTEXAI=false`.

## 5. Local GCP identity preparation

The quota-project command already run by the operator controls billing/quota
attribution for local ADC. It does not authenticate GitHub Actions or a Cloud
Run runtime identity.

Complete and verify local identity:

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project agent-platform-503913
gcloud config set project agent-platform-503913
gcloud auth list
gcloud projects describe agent-platform-503913 --format='value(projectNumber)'
gcloud billing projects describe agent-platform-503913
gh auth status
```

The project-number command must print `183775788663`. Stop before any cloud
mutation if it prints another value. Both Terraform modules enforce the same
ID/number pairing.

Resolve the immutable GitHub numeric claims immediately before WIF bootstrap:

```bash
gh api users/jmwai --jq .id
gh api repos/jmwai/duka-autopilot --jq .id
```

Record the results without recording access tokens.

## 6. Terraform inputs to prepare

Create ignored local working files:

```bash
cp deployment/terraform/bootstrap/backend.hcl.example \
  deployment/terraform/bootstrap/backend.hcl
cp deployment/terraform/bootstrap/terraform.tfvars.example \
  deployment/terraform/bootstrap/terraform.tfvars
```

Populate only reviewed non-secret coordinates:

```hcl
project_id              = "agent-platform-503913"
expected_project_number = "183775788663"
region                  = "europe-west1"
github_owner_id         = "NUMERIC_OWNER_ID"
github_repository_id    = "NUMERIC_REPOSITORY_ID"
billing_account_id      = ""
budget_usd              = 50
```

If the operator is authorized to create the budget, set the billing account in
the ignored tfvars file. It must not be committed or copied into evidence.

### Terraform-owned foundation

Do not manually create the following. Bootstrap Terraform owns:

- the declared Google API enablement;
- protected and versioned GCS Terraform state;
- regional Artifact Registry `duka-images`;
- GitHub Workload Identity Federation and dev/prod deployer identities;
- the isolated evaluator identity;
- the eight Secret Manager containers;
- least-privilege bootstrap IAM;
- the optional USD 50 budget.

The declared API set is Agent Platform/Vertex AI, Artifact Registry, Billing
Budgets, Cloud Resource Manager, Cloud Scheduler, Cloud Trace, Firestore, IAM,
IAM Credentials, Logging, Monitoring, Pub/Sub, Cloud Run, Secret Manager,
Service Usage, STS, Cloud Storage, and Telemetry.

The state bucket is the one bootstrap exception to ordinary ordering: a GCS
backend must exist before Terraform can write state. The reviewed workflow
creates `agent-platform-503913-tfstate` with uniform access, public-access
prevention, and versioning, then imports it into the protected Terraform
resource. This remains an explicit cloud-mutation approval gate.

### Terraform-owned application resources

After immutable backend/frontend image digests exist, the application module
owns:

- public `duka-ENV-web` and private API/worker Cloud Run services;
- private nightly, digest, and one-shot seed Cloud Run Jobs;
- named Firestore databases `duka-dev` and `duka-prod` in `europe-west1`;
- Pub/Sub inbound, authenticated push, and dead-letter resources;
- 02:00 nightly and 06:30 digest schedules in `Africa/Nairobi`;
- one protected Agent Platform context per environment in `global`;
- managed Sessions and Memory Bank access through narrow runtime identities;
- release, tracing, rate-limit, retention, and service configuration.

The frontend is the only public Cloud Run service. It invokes the private API
with a Google ID token. GitHub promotes immutable image digests; production is
not rebuilt.

## 7. Secrets and GitHub environments

After bootstrap, add one secret version per environment for:

- `duka-ENV-channel-key`;
- `duka-ENV-owner-password`;
- `duka-ENV-session-secret`;
- `duka-ENV-user-key-secret`.

Values must enter through protected stdin or an approved secret-manager UI,
never a command argument, Terraform variable, GitHub variable, repository
file, screenshot, or log. The user-key secret is a stable Memory Bank identity
contract and must not rotate during judging.

Configure GitHub after bootstrap outputs exist:

Repository variables:

- `GCP_PROJECT_ID=agent-platform-503913`;
- `GCP_REGION=europe-west1`;
- `GCP_WIF_PROVIDER=<bootstrap output>`.

`development` environment:

- branch restricted to `dev`;
- `GCP_DEV_DEPLOYER_SA=<bootstrap output>`;
- `GCP_DEV_EVALUATOR_SA=<bootstrap output>`;
- `GCP_DEV_DEPLOY_ENABLED=false` until development infrastructure exists.

`production` environment:

- branch restricted to `main`;
- required human reviewer;
- `GCP_PROD_DEPLOYER_SA=<bootstrap output>`.

GitHub receives no service-account JSON key and no runtime secret payload.

## 8. Approved deployment sequence

1. Complete every deterministic local gate.
2. Record project number, billing linkage, GitHub numeric IDs, cost estimate,
   and the reviewed bootstrap plan.
3. Obtain explicit approval for the state bucket/import and bootstrap apply.
4. Add secret versions and protected GitHub variables/environments.
5. Build backend and frontend images on the reviewed `dev` SHA through WIF.
6. Resolve and record both immutable `@sha256:` references.
7. Plan the `dev` application module with the full 40-character release SHA.
8. Obtain explicit approval and apply only `duka-dev` resources.
9. Apply and read back the custom Memory Bank policy after separate review.
10. Run the one-shot non-destructive seed Job.
11. Prove public-web/private-backend IAM, durability, trace, benchmark, and
    bilingual multimodal paths.
12. Promote the exact dev digests to protected production after approval.

No step should silently fall back from managed cloud Sessions to in-memory
state, from Firestore to SQLite, or from Pub/Sub to the local bus.

## 9. Authoritative references

- [Duka deployment runbook](deployment-runbook.md)
- [Duka deployment matrix](deployment-matrix.md)
- [Google Cloud: Workload Identity Federation for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google Cloud: deploy container images to Cloud Run](https://docs.cloud.google.com/run/docs/deploying)
- [Google Cloud: create and manage named Firestore databases](https://cloud.google.com/firestore/docs/manage-databases)
- [Google Cloud: set up Agent Engine Memory Bank for Cloud Run](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/memory-bank/set-up)
