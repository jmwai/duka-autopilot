"""Private authenticated Pub/Sub push surface for inbound agent work."""
from __future__ import annotations

import base64
import json

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from agents.store import get_store
from app.http_security import RequestSecurityMiddleware
from app.worker import RetryableInboundError, handle_inbound
from app.observability import bind_context, extracted_context, instrument_fastapi, tracer

app = FastAPI(title="Duka Autopilot Worker")
app.add_middleware(RequestSecurityMiddleware, role="worker")
instrument_fastapi(app, "worker")


@app.on_event("startup")
def startup() -> None:
    get_store().init()


@app.get("/health")
@app.get("/healthz")
def health() -> dict:
    return {"ok": True, "role": "worker"}


@app.get("/ready")
def ready():
    import os

    required = (
        "GOOGLE_CLOUD_PROJECT", "FIRESTORE_DATABASE", "AGENT_CONTEXT_ID",
        "DUKA_USER_KEY_SECRET", "DUKA_TRACE_ENABLED",
    )
    missing = [key for key in required if not os.environ.get(key)]
    if os.environ.get("DUKA_STORE") != "firestore":
        missing.append("DUKA_STORE=firestore")
    if missing:
        return JSONResponse({"ok": False, "missing": missing}, status_code=503)
    return {"ok": True, "role": "worker"}


@app.post("/pubsub/push")
async def pubsub_push(envelope: dict):
    message = (envelope or {}).get("message") or {}
    if not message.get("data"):
        return JSONResponse({"error": "empty push envelope"}, status_code=400)
    try:
        payload = json.loads(base64.b64decode(message["data"], validate=True))
    except (ValueError, TypeError, json.JSONDecodeError):
        return JSONResponse({"error": "invalid push payload"}, status_code=400)
    if not isinstance(payload, dict):
        return JSONResponse({"error": "push data must be an object"},
                            status_code=400)
    attributes = message.get("attributes") or {}
    payload.setdefault(
        "event_id", attributes.get("event_id") or message.get("messageId"))
    payload["pubsub_message_id"] = message.get("messageId")
    payload["delivery_attempt"] = envelope.get("deliveryAttempt")
    with extracted_context(attributes), bind_context(
            event_id=payload.get("event_id"),
            pubsub_message_id=message.get("messageId"),
            delivery_attempt=envelope.get("deliveryAttempt")):
        try:
            with tracer().start_as_current_span("duka.inbound.process") as span:
                span.set_attribute("messaging.system", "gcp_pubsub")
                span.set_attribute("messaging.operation.name", "process")
                result = await handle_inbound(payload)
        except RetryableInboundError as exc:
            return JSONResponse(
                {"ok": False, "retryable": True, "error": str(exc)},
                status_code=503)
    return {"ok": True, **result}
