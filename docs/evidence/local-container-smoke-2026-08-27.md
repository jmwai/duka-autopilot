# Paired release-container smoke — 2026-08-27

This record covers the standalone Next.js image and FastAPI/ADK image built
from the current local worktree. It is local container evidence, not Google
Cloud deployment evidence and not a frozen release digest.

## Images

| Image | Local image ID | Runtime user |
|---|---|---|
| `duka-backend:grand-prize-wip` | `sha256:4f34e5ad10b5353be04d13f93047335ec0f4c6b5831e7c734863f3fec1004057` | `10001:10001` (`duka`) |
| `duka-frontend:grand-prize-wip` | `sha256:cac98fc7ef4dd2a7227123806a33402f0009da0ceaa8cd04754abfac7b706841` | `10001:10001` (`duka`) |

Both Docker health checks reached `healthy`. `docker exec ... id` confirmed
UID/GID `10001` in both running containers.

## Paired topology

- Isolated Docker network: `duka-gp-smoke-20260827`.
- Public loopback web: `127.0.0.1:18080`.
- API container alias: `duka-gp-api-20260827:8080`.
- The private API was not mapped to a host port.
- Shared test release identity: `local-wip-20260827`.
- Backend store/bus: local SQLite and in-process bus.
- Model calls: none.
- Google Cloud mutations: none.

The uniquely named test containers and network were removed after verification. The two local
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
- a synthetic 65 KB order mutation exceeded the 64 KB route budget and
  returned normalized `413` with request ID `payload-limit-r2`; the payload was
  not forwarded;
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
