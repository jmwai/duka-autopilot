# Local release-candidate preflight — 2026-08-26

> Evidence class: local engineering evidence, not Google Cloud proof
> Recorded: 2026-08-26T14:12:16Z
> Branch: `dev`
> Base commit: `605669888468114d37606f2ee5a067920ca14823`
> Worktree: dirty and intentionally unpushed; final evidence must use the
> reviewed committed release SHA

## Result

The current local candidate passed every deterministic, Firestore-emulator,
schema, workflow, compatibility, and container smoke gate available without
mutating Google Cloud or GitHub.

| Gate | Result |
|---|---|
| Locked dependency graph | `uv lock --check` passed; 136 packages resolved |
| Ordinary local tests | 94 passed, 13 emulator-gated skips |
| Firestore parity release suite | 107 passed, 0 failed, 0 errors, 0 skipped |
| JUnit assertion | `{'tests': 107, 'failures': 0, 'errors': 0, 'skipped': 0}` |
| Firestore emulator | Google Cloud Firestore emulator 1.22.0 at `127.0.0.1:8085` |
| Python import compilation | `agents`, `app`, `scripts`, and `tests` passed |
| Durable topology | Compatible; fingerprint `f8899ce46bfc5165a5143cab67e874bad44d489a094d9aaad65df0e182ef3d9b` |
| Memory Bank payload | Rendered without network access and validated against locked Vertex SDK 1.165.1 |
| Terraform | 1.14.5 format check and both provider-schema validations passed |
| GitHub Actions | actionlint 1.7.7 passed all workflows |
| Eval wrapper | `bash -n scripts/run_evals.sh` passed; wrapper fails closed on ADK case-count mismatch |
| Git whitespace | `git diff --check` passed |
| Backend image | Built as `duka-backend:preflight`; local image ID `sha256:96321a69b1b72c0630939396941a664841d7c0e94040fa29796762bfec7b74de`; runtime UID/GID `10001:10001` |
| Frontend image | Built as `duka-frontend:preflight`; local image ID `sha256:e83742314ad035537651d141d7bba7fa6f80433050fe84e58cbf8363bb5ab9a0`; runtime UID/GID `10001:10001` |
| ADK eval package | 20 schema-valid cases: intake 6, support 10, safety 4; explicit `actor_role=customer`; Gemini 3.7 Flash judge with three samples; machine-readable success/failure summary tested fail-closed; live execution remains cloud-pending |
| BFF smoke | `/health`, `/ready`, and `/version` passed through frontend to private backend |
| Runtime metadata | `gemini-3.7-flash`, `global`, `release_sha=local-preflight`, compatible topology |
| Seed entrypoint | First container invocation created 12 products, 8 customers, 10 orders, and 6 payments and returned `memory_prepared=true`; second invocation returned `seeded=false`, retained `memory_prepared=true`, and did not reset data |
| Demo fixture integrity | Synthetic ledger PNG frozen at 1024×1536 and 3,014,160 bytes; SHA-256 and two-record/one-gate ground truth verified by tests |
| Preliminary pre-push audit | Private GitHub repository confirmed with zero remote branches; branch/tag-reachable history and candidate scan found no high-confidence credentials, forbidden secret filenames, or removed commit trailers |
| HTTP abuse boundary | login rate, same-origin default, and whole-request ceiling negative tests passed |

The two uniquely named smoke containers were stopped and removed after the
test. The local images remain available for inspection.

## Commands

~~~bash
uv lock --check
.venv/bin/pytest -q -rs

FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
FIRESTORE_DATABASE='(default)' \
GOOGLE_CLOUD_PROJECT=demo-duka \
.venv/bin/pytest -q -rs --junitxml=/tmp/duka-pytest.xml
.venv/bin/python scripts/assert_junit.py \
  /tmp/duka-pytest.xml --max-skipped 0

.venv/bin/python -m compileall -q agents app scripts tests
.venv/bin/python scripts/check_compatibility.py
terraform fmt -check -recursive deployment/terraform
terraform -chdir=deployment/terraform/bootstrap validate
terraform -chdir=deployment/terraform/app validate
actionlint .github/workflows/*.yml
bash -n scripts/run_evals.sh
git diff --check

docker build --file deployment/docker/backend.Dockerfile \
  --tag duka-backend:preflight .
docker build --file deployment/docker/frontend.Dockerfile \
  --tag duka-frontend:preflight .
# The local backend smoke container used DUKA_DB=/tmp/duka.db. Production uses
# the named Firestore database and never relies on this local SQLite setting.
.venv/bin/python scripts/smoke_release.py \
  --url http://127.0.0.1:18081 \
  --release-sha local-preflight \
  --attempts 6

docker exec duka-preflight-backend-20260826 python -m app.jobs seed
docker exec duka-preflight-backend-20260826 python -m app.jobs seed
~~~

## Scope boundary

This artifact proves local reproducibility and store parity only. It does not
prove Vertex model behavior, managed Session durability, Memory Bank retrieval,
Cloud Run execution, IAM denial, Pub/Sub delivery/DLQ, Scheduler execution,
Cloud Trace ingestion, cloud cost, GitHub WIF, immutable registry digests, or
judge access. Those remain separate cloud evidence gates tied to the final
committed SHA.
