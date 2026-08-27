# Local infrastructure and workflow validation — 2026-08-27

This record validates the delivery configuration in the current uncommitted
candidate. It made no Terraform plan or apply, changed no Google Cloud
resource, and did not push the private repository.

## Tool provenance

| Tool | Version | Provenance |
|---|---:|---|
| Terraform | 1.14.5 | Official HashiCorp `darwin_arm64` release; SHA-256 `132e740024635494900e561014cf4d111a66c6454fcd548dee5cc4cf873ee52f` matched the official `SHA256SUMS` manifest |
| actionlint | 1.7.12 | Official `rhysd/actionlint` macOS ARM64 release; GitHub artifact attestation verification passed |
| Google providers | 7.45.0 | Reused exactly from both read-only dependency lock files |

## Results

- `actionlint -no-color`: all six GitHub workflow files passed with no
  findings.
- `terraform fmt -check -recursive deployment/terraform`: passed.
- bootstrap `terraform init -backend=false -lockfile=readonly`: passed.
- bootstrap `terraform validate`: configuration valid.
- application `terraform init -backend=false -lockfile=readonly`: passed.
- application `terraform validate`: configuration valid.
- `uv lock --check`: passed with 110 resolved packages.
- Python compilation: passed for `agents`, `app`, `scripts`, and `tests`.
- durable topology: compatible at
  `f8899ce46bfc5165a5143cab67e874bad44d489a094d9aaad65df0e182ef3d9b`.
- pending fixture policy: schema v2, fail-closed, no exposed unfrozen files,
  exactly the Google Vertex AI and Google Cloud Text-to-Speech providers
  allowed, with English and Kiswahili required.
- strict release fixture verification still fails intentionally because the
  four Google assets are not approved, generated, reviewed, and frozen.
- pre-push credential, forbidden-path, reachable-history, and forbidden
  trailer audit: passed.
- `git diff --check`: passed.

Terraform provider validation initially failed inside the restricted process
sandbox because provider plugins could not bind their temporary Unix RPC
sockets. The trace showed `bind: operation not permitted`; rerunning the same
read-only validation with local socket permission succeeded for both modules.
That was a test-environment restriction, not an HCL or provider-schema error.

CI now repeats actionlint using the exact v1.7.12 Linux archive and verifies
its GitHub artifact attestation before execution.
