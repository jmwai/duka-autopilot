"""Duka Autopilot - FastAPI channel layer. Ported (disclosed) from the talk
repo, rewired onto the Store seam; new: /recon/exact (deterministic scale
pass, the nightly job's core) and /synth (statement-month generator).

Run:  uvicorn app.main:app --reload
UI:   http://localhost:8000
"""
from __future__ import annotations

import base64
import hashlib
from typing import Literal
from uuid import uuid4

from dotenv import load_dotenv

load_dotenv()  # before agents import (they read GEMINI_MODEL / keys at import)

from pathlib import Path  # noqa: E402

from fastapi import Depends, FastAPI, Query, Request, Response  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from agents.store import get_store  # noqa: E402
from app.auth import (  # noqa: E402
    clear_owner_cookie,
    require_channel,
    require_owner,
    set_owner_cookie,
)
from app.observability import bind_context, instrument_fastapi, tracer  # noqa: E402
from app.http_security import RequestSecurityMiddleware  # noqa: E402

app = FastAPI(title="Duka Autopilot")
app.add_middleware(RequestSecurityMiddleware, role="api")
instrument_fastapi(app, "api")

STATIC = Path(__file__).parent / "static"


@app.on_event("startup")
def _startup() -> None:
    get_store().init()
    from app.worker import register
    register()  # subscribe the inbound handler to the bus


# ---------- customer chat ----------

class ChatIn(BaseModel):
    customer_id: str = Field(min_length=1, max_length=100,
                             pattern=r"^[A-Za-z0-9_-]+$")
    text: str = Field(default="", max_length=4_000)
    image_b64: str | None = Field(default=None, max_length=8_000_000)
    image_mime: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


@app.post("/chat")
async def chat(body: ChatIn, _auth: None = Depends(require_channel)):
    from app.runner import run_turn  # lazy: keeps startup fast, import errors visible per-request
    image = base64.b64decode(body.image_b64) if body.image_b64 else None
    result = await run_turn(body.customer_id, body.text, image, body.image_mime)
    return {
        "reply": result.reply,
        "node_path": result.node_path,
        "suspended": result.suspended,
        "tokens": {"input": result.input_tokens, "output": result.output_tokens},
        "cost_usd": round(result.cost_usd, 6),
        "wall_ms": result.wall_ms,
    }


# ---------- async intake (event-driven workflow, autonomous routing) ----------

class InboundIn(BaseModel):
    """A webhook-shaped inbound event (what a WhatsApp/SMS bridge would POST)."""
    event_id: str | None = Field(default=None, max_length=200)
    customer_id: str = Field(min_length=1, max_length=100,
                             pattern=r"^[A-Za-z0-9_-]+$")
    text: str = Field(default="", max_length=4_000)
    image_b64: str | None = Field(default=None, max_length=8_000_000)
    image_mime: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    audio_b64: str | None = Field(default=None, max_length=8_000_000)
    audio_mime: Literal[
        "audio/ogg", "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4"
    ] = "audio/ogg"
    channel: Literal["chat", "voice", "photo"] | None = None


@app.post("/inbound", status_code=202)
async def inbound(body: InboundIn, _auth: None = Depends(require_channel)):
    """Accept the event, publish it, return immediately. The worker replies
    asynchronously; the conversation lives in /messages/{customer_id}."""
    from app.bus import get_bus
    from app.worker import INBOUND_TOPIC

    payload = body.model_dump(exclude_none=True)
    payload["event_id"] = body.event_id or uuid4().hex
    with bind_context(event_id=payload["event_id"]):
        with tracer().start_as_current_span("duka.inbound.enqueue") as span:
            span.set_attribute("messaging.destination.name", INBOUND_TOPIC)
            await get_bus().publish(INBOUND_TOPIC, payload)
    return {"queued": True, "event_id": payload["event_id"]}


@app.post("/pubsub/push")
async def pubsub_push(envelope: dict):
    """Pub/Sub push delivery endpoint (cloud mode). The subscription POSTs
    {"message": {"data": base64(json), ...}, "subscription": ...}; a 2xx acks.
    Same handler as the local bus - the bus is the only thing that changes."""
    import os
    if os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod"):
        return JSONResponse(
            {"error": "Pub/Sub delivery is exposed only by the worker service"},
            status_code=404)
    import base64 as b64
    import json as jsonlib

    from app.worker import RetryableInboundError, handle_inbound
    msg = (envelope or {}).get("message") or {}
    if not msg.get("data"):
        return JSONResponse({"error": "empty push envelope"}, status_code=400)
    try:
        payload = jsonlib.loads(b64.b64decode(msg["data"], validate=True))
    except (ValueError, TypeError):
        return JSONResponse({"error": "invalid push payload"}, status_code=400)
    if not isinstance(payload, dict):
        return JSONResponse({"error": "push data must be an object"}, status_code=400)
    attributes = msg.get("attributes") or {}
    payload.setdefault("event_id", attributes.get("event_id") or msg.get("messageId"))
    payload["pubsub_message_id"] = msg.get("messageId")
    payload["delivery_attempt"] = envelope.get("deliveryAttempt")
    try:
        result = await handle_inbound(payload)
    except RetryableInboundError as exc:
        return JSONResponse({"ok": False, "retryable": True, "error": str(exc)},
                            status_code=503)
    return {"ok": True, **result}


@app.get("/messages/{customer_id}")
def messages(customer_id: str, limit: int = Query(default=50, ge=1, le=200),
             _auth: None = Depends(require_owner)):
    return get_store().messages_for(customer_id, limit=limit)


# ---------- owner dashboard ----------

@app.get("/customers")
def customers(_auth: None = Depends(require_owner)):
    return [{"id": c["id"], "name": c["name"]} for c in get_store().customers()
            if c.get("notes") != "synthetic"]


@app.get("/products")
def products(_auth: None = Depends(require_owner)):
    return get_store().products()


class SaleItem(BaseModel):
    sku: str
    qty: int = Field(gt=0, le=10_000)


class SaleIn(BaseModel):
    customer_id: str
    items: list[SaleItem]
    paid: bool = False  # walk-in cash sale vs. on-account order


@app.post("/orders")
def create_sale(body: SaleIn, _auth: None = Depends(require_owner)):
    """Owner creates a sale by hand - plain code, no LLM anywhere.

    Prices always come from the catalog (the same rule the intake agent
    lives under: nobody gets to invent a price, not even the owner's UI)."""
    store = get_store()
    if not body.items:
        return JSONResponse({"error": "add at least one item"}, status_code=422)
    catalog = {p["sku"]: p for p in store.products()}
    unknown = [i.sku for i in body.items if i.sku not in catalog]
    if unknown:
        return JSONResponse({"error": f"unknown sku(s): {unknown}"}, status_code=422)
    if not store.get_customer(body.customer_id):
        return JSONResponse({"error": "unknown customer"}, status_code=422)
    items = [{"sku": i.sku, "name": catalog[i.sku]["name"], "qty": i.qty,
              "unit_price": catalog[i.sku]["unit_price"]} for i in body.items]
    status = "paid" if body.paid else "confirmed"
    order_id = store.create_order(body.customer_id, items, status=status,
                                  notes="created by owner (dashboard sale)")
    total = sum(i["unit_price"] * i["qty"] for i in items)
    return {"order_id": order_id, "status": status, "total": total}


@app.get("/orders")
def orders(_auth: None = Depends(require_owner)):
    return get_store().list_orders(limit=100)


@app.get("/approvals")
def approvals(_auth: None = Depends(require_owner)):
    public = []
    for approval in get_store().pending_approvals():
        payload = dict(approval.get("payload") or {})
        # Durable ADK resume handles stay behind the private API boundary. The
        # owner UI needs business evidence, never session or interrupt IDs.
        payload.pop("session_id", None)
        payload.pop("interrupt_id", None)
        public.append({
            "id": approval["id"],
            "kind": approval["kind"],
            "status": approval["status"],
            "payload": payload,
            "created_at": approval.get("created_at"),
            "requested_decision": approval.get("requested_decision"),
            "resume_attempts": int(approval.get("resume_attempts") or 0),
            "retryable": approval.get("status") == "resume_failed",
        })
    return public


class Decision(BaseModel):
    decision: str  # approved | rejected


@app.post("/approvals/{approval_id}")
async def decide(approval_id: str, body: Decision,
                 _auth: None = Depends(require_owner)):
    import logging
    logger = logging.getLogger(__name__)
    store = get_store()
    if body.decision not in ("approved", "rejected"):
        return JSONResponse({"error": "decision must be approved|rejected"}, status_code=422)
    a = store.get_approval(approval_id)
    if not a:
        return JSONResponse({"error": "approval not found"}, status_code=404)
    with bind_context(approval_id=approval_id):
        claim = store.claim_approval_decision(approval_id, body.decision)
    if not claim["claimed"]:
        if claim["outcome"] == "not_found":
            return JSONResponse({"error": "approval not found"}, status_code=404)
        if claim["outcome"] == "conflict":
            return JSONResponse({
                "error": "approval already has a different decision",
                "status": claim.get("status"),
                "decision": claim.get("decision"),
            }, status_code=409)
        if claim["outcome"] == "in_progress":
            return JSONResponse({
                "ok": False, "in_progress": True,
                "decision": claim.get("decision"),
            }, status_code=202)
        return {
            "ok": True, "idempotent": True, "kind": a["kind"],
            "decision": claim.get("decision") or body.decision,
            "customer_id": a["payload"].get("customer_id"),
            "resumed_reply": None,
        }

    payload = a["payload"]
    resumed_reply = None
    try:
        if a["kind"] == "refund":
            if not (a.get("invocation_id") and payload.get("interrupt_id")
                    and payload.get("session_id")):
                raise ValueError("refund invocation is not ready to resume")
            from app.runner import resume_refund
            resumed_reply = await resume_refund(
                customer_id=payload["customer_id"],
                session_id=payload["session_id"],
                invocation_id=a["invocation_id"],
                interrupt_id=payload["interrupt_id"],
                decision=body.decision,
            )
            if not resumed_reply:
                raise RuntimeError("refund resume produced no final response")
            store.add_message(
                payload["customer_id"], "out", resumed_reply,
                meta={"approval_id": approval_id, "resumed": True,
                      "decision": body.decision},
                dedupe_key=f"approval:{approval_id}:{body.decision}:reply")
        else:
            store.apply_approval_effect(approval_id, body.decision)

        store.complete_approval_decision(approval_id, body.decision)
        logger.info(
            "approval decision completed",
            extra={"approval_id": approval_id})
    except Exception as exc:
        store.fail_approval_decision(
            approval_id, f"{exc.__class__.__name__}: {str(exc)[:300]}")
        status_code = 409 if isinstance(exc, ValueError) else 503
        logger.warning(
            "approval decision failed",
            extra={"approval_id": approval_id})
        return JSONResponse({
            "ok": False,
            "retryable": not isinstance(exc, ValueError),
            "error": str(exc)[:300],
        }, status_code=status_code)

    return {
        "ok": True, "idempotent": False, "kind": a["kind"],
        "decision": body.decision, "customer_id": payload.get("customer_id"),
        "resumed_reply": resumed_reply,
    }


class NewSessionIn(BaseModel):
    customer_id: str


@app.post("/sessions/new")
async def sessions_new(body: NewSessionIn,
                       _auth: None = Depends(require_owner)):
    """Start a fresh chat session ('new day'). Older sessions remain reachable
    only through the memory service - which is the whole demo point."""
    from app.runner import new_session
    return {"session_id": await new_session(body.customer_id)}


# ---------- reconciliation ----------

@app.post("/recon/run")
async def recon_run(_auth: None = Depends(require_owner)):
    """Chat-driven recon (the workflow route). Small statements only; the
    nightly scale path is /recon/exact + batched fuzzy passes."""
    from app.runner import run_turn
    result = await run_turn(
        "owner", "Please reconcile the M-Pesa statement now.",
        actor_role="owner")
    return {"report": result.reply, "node_path": result.node_path}


class LedgerUploadIn(BaseModel):
    event_id: str | None = Field(
        default=None, min_length=1, max_length=200,
        pattern=r"^[A-Za-z0-9._~-]+$")
    image_b64: str = Field(min_length=1, max_length=8_000_000)
    image_mime: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


@app.post("/ledger")
async def ledger_upload(body: LedgerUploadIn,
                        _auth: None = Depends(require_owner)):
    """Owner-only ledger vision path; customer intake cannot set this role."""
    from app.runner import run_turn
    from app.worker import MAX_MEDIA_BYTES

    try:
        image = base64.b64decode(body.image_b64, validate=True)
    except (ValueError, TypeError):
        return JSONResponse({"error": "invalid image payload"}, status_code=422)
    if len(image) > MAX_MEDIA_BYTES:
        return JSONResponse({"error": "image exceeds 6 MB decoded limit"},
                            status_code=413)
    event_id = body.event_id or f"ledger-{uuid4().hex}"
    payload_hash = hashlib.sha256(
        body.image_mime.encode() + b"\0" + image).hexdigest()
    store = get_store()
    claim = store.claim_event(event_id, "owner-ledger", payload_hash)
    if not claim["claimed"]:
        if claim["status"] == "completed" and claim.get("result"):
            return {**claim["result"], "idempotent": True}
        if claim["status"] == "conflict":
            return JSONResponse({
                "error": "ledger event ID was already used for another image",
                "event_id": event_id,
            }, status_code=409)
        return JSONResponse({
            "error": "ledger event is already processing or unavailable",
            "event_id": event_id, "status": claim["status"],
        }, status_code=409)
    try:
        result = await run_turn(
            "owner", "Digitize this handwritten ledger page.",
            image_bytes=image, image_mime=body.image_mime, actor_role="owner")
    except Exception as exc:
        from app.worker import _retryable
        store.fail_event(
            event_id, f"{exc.__class__.__name__}: {str(exc)[:300]}",
            retryable=_retryable(exc))
        raise
    response = {
        "event_id": event_id,
        "idempotent": False,
        "reply": result.reply,
        "node_path": result.node_path,
        "ledger": getattr(result, "ledger_result", None),
        "tokens": {"input": result.input_tokens, "output": result.output_tokens},
        "cost_usd": round(result.cost_usd, 6),
        "wall_ms": result.wall_ms,
    }
    store.complete_event(event_id, response)
    return response


@app.post("/recon/exact")
def recon_exact(_auth: None = Depends(require_owner)):
    """The deterministic pass alone, at any scale. No LLM, no key needed.
    This is what Cloud Scheduler fires nightly in the cloud phase."""
    from agents.recon_engine import run_exact_pass
    stats = run_exact_pass(get_store())
    stats.pop("residue")  # counts only over the wire
    return stats


@app.post("/recon/nightly")
async def recon_nightly(fuzzy: bool = True,
                        _auth: None = Depends(require_owner)):
    """The full nightly pipeline (Cloud Scheduler's target in the cloud):
    exact pass + batched fuzzy passes + persisted report. fuzzy=false keeps
    it keyless (deterministic pass and report only)."""
    from agents.nightly import run_nightly
    return await run_nightly(fuzzy=fuzzy, execution_surface="api")


@app.get("/recon/report")
def recon_report(_auth: None = Depends(require_owner)):
    return get_store().payments_summary()


# ---------- synthetic data (demo/stress) ----------

class SynthIn(BaseModel):
    rows: int = Field(default=50_000, ge=1, le=50_000)
    days: int = Field(default=30, ge=1, le=365)
    seed: int = 2026


@app.post("/synth/generate")
def synth_generate(body: SynthIn, _auth: None = Depends(require_owner)):
    from agents.synth.generate import generate_month
    return generate_month(rows=body.rows, days=body.days, seed=body.seed)


# ---------- restock ----------

@app.post("/restock/check")
def restock_check(_auth: None = Depends(require_owner)):
    """Deterministic shelf scan; drafts one supplier order to the approval
    queue when stock is low. The nightly run calls this automatically."""
    from agents.restock import check_restock
    return check_restock()


# ---------- morning digest ----------

@app.get("/digest/morning")
def digest_morning(persist: bool = False,
                   _auth: None = Depends(require_owner)):
    """Deterministic digest (no LLM between the books and the owner's
    numbers). Cloud Scheduler hits this after the nightly run with
    persist=true so it lands in the owner's message thread."""
    from agents.digest import morning_digest
    return morning_digest(persist=persist)


# ---------- metrics ----------

@app.get("/metrics/costs")
def costs(_auth: None = Depends(require_owner)):
    return get_store().cost_summary()


@app.post("/memory/drain")
async def memory_drain(limit: int = Query(default=25, ge=1, le=100),
                       _auth: None = Depends(require_owner)):
    """Retry trusted Memory Bank outbox entries without replaying business work."""
    from app.runner import drain_memory_outbox
    return await drain_memory_outbox(limit=limit)


@app.get("/healthz")
@app.get("/health")  # /healthz is GFE-reserved on run.app domains - /health for cloud
def healthz():
    return {"ok": True}


@app.get("/ready")
def ready():
    """Fail closed when a cloud revision is missing durable configuration."""
    import os

    environment = os.environ.get("DUKA_ENV", "local").lower()
    missing: list[str] = []
    if environment in ("dev", "prod"):
        required = (
            "GOOGLE_CLOUD_PROJECT",
            "GOOGLE_CLOUD_LOCATION",
            "FIRESTORE_DATABASE",
            "AGENT_CONTEXT_ID",
            "DUKA_USER_KEY_SECRET",
            "DUKA_OWNER_PASSWORD",
            "DUKA_SESSION_SECRET",
            "DUKA_CHANNEL_KEY",
            "DUKA_TRACE_ENABLED",
        )
        missing.extend(key for key in required if not os.environ.get(key))
        if os.environ.get("DUKA_STORE") != "firestore":
            missing.append("DUKA_STORE=firestore")
        if os.environ.get("DUKA_BUS") != "pubsub":
            missing.append("DUKA_BUS=pubsub")
        from app.compatibility import manifest_status
        if not manifest_status()["compatible"]:
            missing.append("durable-topology-compatibility")
    if missing:
        return JSONResponse({"ok": False, "missing": missing}, status_code=503)
    return {"ok": True, "environment": environment}


@app.get("/version")
def version():
    import os
    from app.compatibility import manifest_status

    return {
        "app": "duka-autopilot",
        "release_sha": os.environ.get("RELEASE_SHA", "local"),
        "environment": os.environ.get("DUKA_ENV", "local"),
        "backend_image_digest": os.environ.get("BACKEND_IMAGE_DIGEST"),
        "model": os.environ.get("GEMINI_MODEL", "gemini-3.7-flash"),
        "model_location": os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
        "durable_topology": manifest_status(),
    }


class OwnerLogin(BaseModel):
    password: str = Field(min_length=1, max_length=500)


@app.post("/auth/login")
def owner_login(body: OwnerLogin, response: Response):
    import hmac
    import os

    expected = os.environ.get("DUKA_OWNER_PASSWORD", "")
    if not expected or not hmac.compare_digest(body.password, expected):
        return JSONResponse({"error": "invalid credentials"}, status_code=401)
    set_owner_cookie(response)
    return {"ok": True}


@app.post("/auth/logout")
def owner_logout(response: Response):
    clear_owner_cookie(response)
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")
