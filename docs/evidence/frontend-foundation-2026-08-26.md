# Frontend Foundation Evidence — August 26, 2026

> Scope: local Phase F1 release candidate
> Cloud claim: none
> Push state: private `dev` commit `903f06c5af77175cc9e6d12060c87d2ed7bd0536`

## Locked runtime and dependencies

| Contract | Verified value |
|---|---|
| Next.js | `16.3.3` |
| React | `19.2.8` |
| Node.js | `24.12.0` |
| pnpm | `11.9.0` |
| Tailwind CSS | `4.3.3` |
| TypeScript | `6.0.3`, strict mode |
| Base image | `node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99` |
| Local frontend image | `sha256:6782708d19d8b72dc96d199da0a5aef24e7bbf6ca742e7dca2a2c023190450ef` |
| Runtime identity | `10001:10001` |
| Runtime command | `node server.js` |

The pnpm lock contains exact package versions and passes pnpm's supply-chain
policy check. Only the required `esbuild` and `unrs-resolver` install scripts
are explicitly allowlisted. The newest Vitest/Vite release was rejected because
its registry graph requested an unpublished `lightningcss` version; the
compatible Vitest `4.0.18` line is pinned instead. ESLint and TypeScript are
pinned to the newest majors supported by Next's current lint plugins, and the
peer-dependency check is clean.

## Automated checks

```text
pnpm check
  ESLint: passed with zero warnings
  TypeScript: passed with strict no-emit checking
  Vitest: 3 passed
  Next production build: passed; 14 routes plus Proxy compiled

uv run pytest -q \
  tests/test_deployment_roles.py \
  tests/test_smoke_release.py \
  tests/test_prepush_audit.py
  16 passed

actionlint .github/workflows/*.yml
  passed
```

The GitHub workflow now adds an independent Next quality job and a paired
container smoke. CI starts the backend and frontend on an isolated Docker
network, checks matching release SHAs, dependency readiness, compatible durable
topology, HTML identity, BFF worker-route denial, and frontend UID/GID, then
removes only those ephemeral resources.

## Paired local release smoke

The production frontend image and the real local FastAPI service ran with the
same synthetic release identifier. `scripts/smoke_release.py` returned:

```json
{
  "api_release_sha": "local-next-foundation",
  "frontend_release_sha": "local-next-foundation",
  "forbidden_route_status": 404,
  "health": true,
  "ready_dependency": "api",
  "topology_compatible": true
}
```

The browser-facing login round trip returned HTTP 200, preserved exactly one
`duka_owner_session` cookie with `HttpOnly` and `SameSite=strict`, and logout
returned HTTP 200 with an empty cookie and `Max-Age=0`. No token value is stored
in this artifact.

## Visual and responsive QA

The production container was inspected in the in-app browser at desktop and a
390×844 mobile viewport.

- The desktop control room rendered the warm ledger-inspired shell, all eight
  primary routes, outcome cards, three trust lanes, digest, and decisions.
- The mobile shell had zero horizontal overflow, a visible four-item bottom
  navigation, 44 px or larger primary controls, and readable full-page content.
- The owner login rendered at mobile width with a labelled password input,
  disabled empty submit, show/hide control, and HttpOnly-session disclosure.
- The browser console reported zero errors or warnings.
- The exact model label and `KSh 0` money format were verified after the final
  visual correction.

This is local implementation evidence only. It does not prove Cloud Run,
managed Sessions, Memory Bank, IAM, WIF, or a hosted judging URL.

## GitHub confirmation

GitHub Actions run `32985154437` completed successfully for the exact commit
above. Its Next quality, full Firestore parity, Terraform validation,
reproducible image build, paired non-root container smoke, and repository audit
jobs all passed. The development deploy gate remained disabled; this is CI
evidence and not a cloud-deployment claim.
