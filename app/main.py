"""Duka Autopilot - FastAPI channel layer. Ported (disclosed) from the talk
repo, rewired onto the Store seam; new: /recon/exact (deterministic scale
pass, the nightly job's core) and /synth (statement-month generator).

Run:  uvicorn app.main:app --reload
UI:   http://localhost:8000
"""
from __future__ import annotations

import base64

from dotenv import load_dotenv

load_dotenv()  # before agents import (they read GEMINI_MODEL / keys at import)

from pathlib import Path  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from agents.seed import seed  # noqa: E402
from agents.store import get_store  # noqa: E402

app = FastAPI(title="Duka Autopilot")

STATIC = Path(__file__).parent / "static"


@app.on_event("startup")
def _startup() -> None:
    get_store().init()
    seed()  # no-op if already seeded
    from app.worker import register
    register()  # subscribe the inbound handler to the bus


# ---------- customer chat ----------

class ChatIn(BaseModel):
    customer_id: str
    text: str
    image_b64: str | None = None
    image_mime: str = "image/jpeg"


@app.post("/chat")
async def chat(body: ChatIn):
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
    customer_id: str
    text: str = ""
    image_b64: str | None = None
    image_mime: str = "image/jpeg"
    audio_b64: str | None = None
    audio_mime: str = "audio/ogg"
    channel: str | None = None


@app.post("/inbound", status_code=202)
async def inbound(body: InboundIn):
    """Accept the event, publish it, return immediately. The worker replies
    asynchronously; the conversation lives in /messages/{customer_id}."""
    from app.bus import get_bus
    from app.worker import INBOUND_TOPIC
    await get_bus().publish(INBOUND_TOPIC, body.model_dump(exclude_none=True))
    return {"queued": True}


@app.post("/pubsub/push")
async def pubsub_push(envelope: dict):
    """Pub/Sub push delivery endpoint (cloud mode). The subscription POSTs
    {"message": {"data": base64(json), ...}, "subscription": ...}; a 2xx acks.
    Same handler as the local bus - the bus is the only thing that changes."""
    import base64 as b64
    import json as jsonlib

    from app.worker import handle_inbound
    msg = (envelope or {}).get("message") or {}
    if not msg.get("data"):
        return JSONResponse({"error": "empty push envelope"}, status_code=400)
    payload = jsonlib.loads(b64.b64decode(msg["data"]))
    result = await handle_inbound(payload)
    return {"ok": True, **result}


@app.get("/messages/{customer_id}")
def messages(customer_id: str, limit: int = 50):
    return get_store().messages_for(customer_id, limit=limit)


# ---------- owner dashboard ----------

@app.get("/customers")
def customers():
    return [{"id": c["id"], "name": c["name"]} for c in get_store().customers()
            if c.get("notes") != "synthetic"]


@app.get("/products")
def products():
    return get_store().products()


class SaleItem(BaseModel):
    sku: str
    qty: int


class SaleIn(BaseModel):
    customer_id: str
    items: list[SaleItem]
    paid: bool = False  # walk-in cash sale vs. on-account order


@app.post("/orders")
def create_sale(body: SaleIn):
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
def orders():
    return get_store().list_orders(limit=100)


@app.get("/approvals")
def approvals():
    return get_store().pending_approvals()


class Decision(BaseModel):
    decision: str  # approved | rejected


@app.post("/approvals/{approval_id}")
async def decide(approval_id: int, body: Decision):
    store = get_store()
    if body.decision not in ("approved", "rejected"):
        return JSONResponse({"error": "decision must be approved|rejected"}, status_code=422)
    a = store.get_approval(approval_id)
    if not a or a["status"] != "pending":
        return JSONResponse({"error": "not found or already resolved"}, status_code=404)
    payload = a["payload"]
    store.resolve_approval(approval_id, body.decision)
    if body.decision == "approved":
        if a["kind"] == "fuzzy_match":
            store.link_payments([(payload["payment_id"], payload["order_id"], "fuzzy")])
            store.set_order_status(payload["order_id"], "paid")
        elif a["kind"] == "low_confidence_order":
            store.set_order_status(payload["order_id"], "pending_confirmation", needs_review=False)
    elif a["kind"] == "low_confidence_order":
        store.set_order_status(payload["order_id"], "rejected")

    # graph-native HITL: a refund approval row carries the handles of the
    # workflow invocation suspended at refund_gate - resume it with the
    # decision so the SAME conversation continues.
    resumed_reply = None
    if a["kind"] == "refund" and a["invocation_id"] and payload.get("interrupt_id"):
        from app.runner import resume_refund
        resumed_reply = await resume_refund(
            customer_id=payload["customer_id"],
            session_id=payload["session_id"],
            invocation_id=a["invocation_id"],
            interrupt_id=payload["interrupt_id"],
            decision=body.decision,
        )
    return {"ok": True, "kind": a["kind"], "decision": body.decision,
            "customer_id": payload.get("customer_id"), "resumed_reply": resumed_reply}


class NewSessionIn(BaseModel):
    customer_id: str


@app.post("/sessions/new")
def sessions_new(body: NewSessionIn):
    """Start a fresh chat session ('new day'). Older sessions remain reachable
    only through the memory service - which is the whole demo point."""
    from app.runner import new_session
    return {"session_id": new_session(body.customer_id)}


# ---------- reconciliation ----------

@app.post("/recon/run")
async def recon_run():
    """Chat-driven recon (the workflow route). Small statements only; the
    nightly scale path is /recon/exact + batched fuzzy passes."""
    from app.runner import run_turn
    result = await run_turn("owner", "Please reconcile the M-Pesa statement now.")
    return {"report": result.reply, "node_path": result.node_path}


@app.post("/recon/exact")
def recon_exact():
    """The deterministic pass alone, at any scale. No LLM, no key needed.
    This is what Cloud Scheduler fires nightly in the cloud phase."""
    from agents.recon_engine import run_exact_pass
    stats = run_exact_pass(get_store())
    stats.pop("residue")  # counts only over the wire
    return stats


@app.get("/recon/report")
def recon_report():
    return get_store().payments_summary()


# ---------- synthetic data (demo/stress) ----------

class SynthIn(BaseModel):
    rows: int = 50_000
    days: int = 30
    seed: int = 2026


@app.post("/synth/generate")
def synth_generate(body: SynthIn):
    from agents.synth.generate import generate_month
    return generate_month(rows=body.rows, days=body.days, seed=body.seed)


# ---------- metrics ----------

@app.get("/metrics/costs")
def costs():
    return get_store().cost_summary()


@app.get("/healthz")
@app.get("/health")  # /healthz is GFE-reserved on run.app domains - /health for cloud
def healthz():
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")
