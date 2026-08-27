# Paired release-container smoke — 2026-08-27

This record covers the standalone Next.js image and FastAPI/ADK image built
from the current local worktree. It is local container evidence, not Google
Cloud deployment evidence and not a frozen release digest.

## Images

| Image | Local image ID | Runtime user |
|---|---|---|
| `duka-backend:local` | `sha256:a6411271e2034b35935537d15ffa6ae7ad3883da6c622b84bc1ff31b14915f58` | `10001:10001` (`duka`) |
| `duka-frontend:local` | `sha256:de01106cc409219875d780bff685b89e357ac5aab8b0ac0dfca9c6242e2547dc` | `10001:10001` (`duka`) |

Both Docker health checks reached `healthy`. `docker exec ... id` confirmed
UID/GID `10001` in both running containers.

## Paired topology

- Isolated Docker network: `duka-smoke`.
- Public loopback web: `127.0.0.1:8180`.
- API container alias: `duka-smoke-api:8080`.
- API loopback mapping for diagnostics only: `127.0.0.1:8181`.
- Shared test release identity: `local-wip-20260827`.
- Backend store/bus: local SQLite and in-process bus.
- Model calls: none.
- Google Cloud mutations: none.

The test containers and network were removed after verification. The two local
images remain in Docker's cache and may be rebuilt from the Dockerfiles.

## Observed release smoke

`scripts/smoke_release.py` returned:

- web `/health`: `200`, `ok=true`, role `web`;
- web `/ready`: `200`, dependency `api`, `ok=true`;
- web and API release SHA: `local-wip-20260827`;
- frontend runtime: Node `v24.12.0`;
- model declaration: `gemini-3.7-flash`, location `global`;
- durable topology: compatible at fingerprint
  `f8899ce46bfc5165a5143cab67e874bad44d489a094d9aaad65df0e182ef3d9b`;
- forbidden `/api/pubsub/push`: `404` from the BFF allowlist.

Additional checks observed:

- owner login through the web BFF returned `200`;
- the authenticated `/api/approvals` read returned `200`;
- an unknown browser mutation route returned a normalized `404` with only a
  request ID and safe error;
- `/health` and `/version` returned `cache-control: no-store`;
- the release fixture sync stayed fail-closed because bilingual Google media
  is not yet approved or frozen.

## Claim boundary

The local API ran with `DUKA_ENV=local`, where application owner auth is
deliberately bypassed for keyless development. Therefore this run does **not**
claim that anonymous access to the Cloud Run API is denied. That boundary must
be proven after approved deployment using Cloud Run IAM, an unauthenticated
request, and the public-web service identity. It also does not prove Firestore,
Pub/Sub, managed Sessions, Memory Bank, Scheduler, Trace, or hosted latency.

