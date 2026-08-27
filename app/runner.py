"""ADK runner glue for local and Cloud Run execution.

Autopilot is always the workflow graph. Local mode uses in-memory ADK context;
cloud mode uses Agent Platform managed Sessions and Memory Bank through the
protected context resource configured by ``AGENT_CONTEXT_ID``.
"""
from __future__ import annotations

import os
import time
import hashlib
import hmac
import logging
from contextlib import contextmanager
from dataclasses import dataclass, field
from uuid import uuid4

from google.adk.events.event import Event
from google.genai import types

from agents.store import get_store
from app.constants import APP_NAME
from app.memory_config import MEMORY_TOPIC_LABEL, MEMORY_TTL
from app.observability import bind_context, tracer

SESSION_TTL = os.environ.get("DUKA_SESSION_TTL", "7776000s")  # 90 days
logger = logging.getLogger(__name__)

# USD per 1M tokens - gemini-3.7-flash intro rates (through 2026-12-31),
# override in .env (standard rates from 2027: 1.50 / 7.50)
PRICE_IN = float(os.environ.get("PRICE_INPUT_PER_M", "0.75"))
PRICE_OUT = float(os.environ.get("PRICE_OUTPUT_PER_M", "3.75"))


def _build_runner():
    from google.adk.apps import App, ResumabilityConfig
    from google.adk.runners import InMemoryRunner, Runner

    from agents.graph import autopilot_workflow
    # Resumability is what lets the refund_gate SUSPEND an invocation and
    # /approvals resume it later (graph-native HITL).
    adk_app = App(
        name=APP_NAME,
        root_agent=autopilot_workflow,
        resumability_config=ResumabilityConfig(is_resumable=True),
    )
    environment = os.environ.get("DUKA_ENV", "local").lower()
    if environment in ("dev", "prod"):
        from google.adk.memory import VertexAiMemoryBankService
        from google.adk.sessions import VertexAiSessionService

        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        context_id = os.environ.get("AGENT_CONTEXT_ID")
        if not project or not context_id:
            raise RuntimeError(
                "cloud mode requires GOOGLE_CLOUD_PROJECT and AGENT_CONTEXT_ID")
        context_location = os.environ.get("AGENT_CONTEXT_LOCATION", "global")
        engine_id = context_id.split("/")[-1]

        return Runner(
            app=adk_app,
            session_service=VertexAiSessionService(
                project=project,
                location=context_location,
                agent_engine_id=engine_id,
            ),
            memory_service=VertexAiMemoryBankService(
                project=project,
                location=context_location,
                agent_engine_id=engine_id,
            ),
        )
    return InMemoryRunner(app=adk_app)


runner = _build_runner()


@dataclass
class TurnResult:
    reply: str = ""
    node_path: list[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    wall_ms: int = 0
    suspended: bool = False  # workflow paused at a human gate this turn
    ledger_result: dict | None = None  # deterministic record_ledger_rows receipt

    @property
    def cost_usd(self) -> float:
        return (self.input_tokens * PRICE_IN + self.output_tokens * PRICE_OUT) / 1_000_000


def _cloud_mode() -> bool:
    return os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod")


def _user_id(customer_id: str) -> str:
    """Stable opaque Agent Platform user scope; raw phones never become keys."""
    secret = os.environ.get("DUKA_USER_KEY_SECRET")
    if not secret:
        if _cloud_mode():
            raise RuntimeError("cloud mode requires DUKA_USER_KEY_SECRET")
        secret = "duka-local-user-key-v1"
    digest = hmac.new(secret.encode(), customer_id.encode(), hashlib.sha256).hexdigest()
    return f"u_{digest[:32]}"


def _active_session(customer_id: str) -> dict:
    return get_store().ensure_active_session(customer_id, _user_id(customer_id))


class CustomerTurnBusyError(RuntimeError):
    """A retryable signal that another instance owns this customer's turn."""

    status_code = 409


@contextmanager
def _customer_turn_lease(customer_id: str):
    store = get_store()
    owner = uuid4().hex
    lease_seconds = max(30, min(900, int(
        os.environ.get("DUKA_TURN_LEASE_SECONDS", "180"))))
    claim = store.claim_customer_turn(customer_id, owner, lease_seconds)
    if not claim["claimed"]:
        raise CustomerTurnBusyError(
            "customer turn is already processing; retry after the active lease")
    try:
        yield
    finally:
        store.release_customer_turn(customer_id, owner)


async def new_session(customer_id: str) -> str:
    """Create and activate a fresh managed session, preserving the old one."""
    with _customer_turn_lease(customer_id):
        user_id = _user_id(customer_id)
        pointer = get_store().rotate_active_session(customer_id, user_id)
        with bind_context(
                customer_key=user_id, session_id=pointer["session_id"]):
            with tracer().start_as_current_span("duka.session.rotate") as span:
                span.set_attribute("duka.session.generation", pointer["generation"])
                await _ensure_session(
                    user_id, pointer["session_id"],
                    state={"customer_id": customer_id, "user_key": user_id,
                           "actor_role": "customer"})
        return pointer["session_id"]


async def _ensure_session(user_id: str, session_id: str, state: dict) -> None:
    svc = runner.session_service
    existing = await svc.get_session(app_name=APP_NAME, user_id=user_id, session_id=session_id)
    if existing is None:
        kwargs = {"ttl": SESSION_TTL} if _cloud_mode() else {}
        await svc.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
            state=state, **kwargs)


async def resume_refund(customer_id: str, session_id: str, invocation_id: str,
                        interrupt_id: str, decision: str) -> str:
    """Resume a workflow suspended at the refund_gate with the owner's decision.

    The decision travels as a function_response part whose id is the
    interrupt_id - the Runner turns that into ctx.resume_inputs for the
    rerun of the gate node. Returns the customer-facing confirmation text."""
    with _customer_turn_lease(customer_id):
        message = types.Content(role="user", parts=[types.Part(
            function_response=types.FunctionResponse(
                id=interrupt_id, name="adk_request_input",
                response={"decision": decision},
            ))])
        reply = ""
        user_id = _user_id(customer_id)
        with bind_context(
                customer_key=user_id, session_id=session_id,
                invocation_id=invocation_id):
            with tracer().start_as_current_span("duka.approval.resume") as span:
                span.set_attribute("duka.approval.decision", decision)
                async for event in runner.run_async(
                        user_id=user_id, session_id=session_id,
                        new_message=message, invocation_id=invocation_id):
                    if event.content and event.content.parts:
                        texts = [p.text for p in event.content.parts if p.text]
                        if texts and event.is_final_response():
                            reply = "".join(texts)
        return reply


async def _ingest_order_summary(customer_id: str) -> bool:
    """Enqueue and best-effort drain one allowlisted preference summary."""
    store = get_store()
    orders = store.orders_for_customer(customer_id, limit=1)
    if not orders:
        return False
    order = orders[0]
    items = order.get("items") or []
    if not items or order.get("needs_review") or order.get("status") in ("rejected", "needs_review"):
        return False
    text = ("This customer usually buys "
            + ", ".join(f"{int(item['qty'])}x {item['name']}" for item in items)
            + ". Treat this as an advisory preference and verify the current catalog.")
    dedupe_key = hashlib.sha256(
        f"usual-v1\0{customer_id}\0{text}".encode()).hexdigest()
    store.enqueue_memory_summary(
        customer_id, _user_id(customer_id), text, dedupe_key)
    await drain_memory_outbox(customer_id=customer_id, limit=1)
    return True


async def drain_memory_outbox(customer_id: str | None = None,
                              limit: int = 10) -> dict:
    """Deliver trusted summaries to Memory Bank with durable retry state."""
    store = get_store()
    completed = failed = 0
    for _ in range(max(0, min(limit, 100))):
        entry = store.claim_memory_summary(customer_id=customer_id)
        if entry is None:
            break
        event_key = str(entry["dedupe_key"])[:24]
        event = Event(
            id=f"usual-{event_key}", author="system",
            content=types.Content(
                role="user",
                parts=[types.Part.from_text(text=entry["summary"])]),
        )
        try:
            await runner.memory_service.add_events_to_memory(
                app_name=APP_NAME, user_id=entry["user_id"], events=[event],
                session_id=f"usual-{event_key}",
                custom_metadata={
                    # Force the awaited GenerateMemories path. ADK's default
                    # IngestEvents path is fire-and-forget and cannot support a
                    # durable success/failure outbox state.
                    "wait_for_completion": True,
                    "allowed_topics": [{
                        "custom_memory_topic_label": MEMORY_TOPIC_LABEL,
                    }],
                    "revision_ttl": MEMORY_TTL,
                })
        except Exception as exc:
            store.fail_memory_summary(
                entry["id"], f"{exc.__class__.__name__}: {str(exc)[:300]}",
                retryable=True)
            failed += 1
            raise
        else:
            store.complete_memory_summary(entry["id"])
            completed += 1
    return {"completed": completed, "failed": failed}


async def run_turn(customer_id: str, text: str, image_bytes: bytes | None = None,
                   image_mime: str = "image/jpeg", audio_bytes: bytes | None = None,
                   audio_mime: str = "audio/ogg",
                   actor_role: str = "customer") -> TurnResult:
    if actor_role not in ("customer", "owner"):
        raise ValueError("actor_role must be customer or owner")
    with _customer_turn_lease(customer_id):
        return await _run_turn_locked(
            customer_id, text, image_bytes=image_bytes, image_mime=image_mime,
            audio_bytes=audio_bytes, audio_mime=audio_mime,
            actor_role=actor_role)


async def _run_turn_locked(customer_id: str, text: str,
                           image_bytes: bytes | None = None,
                           image_mime: str = "image/jpeg",
                           audio_bytes: bytes | None = None,
                           audio_mime: str = "audio/ogg",
                           actor_role: str = "customer") -> TurnResult:
    """Run one customer message through the workflow; log cost.

    Modalities change, guardrails don't: text, order-note/ledger photos and
    Swahili voice notes all enter as parts of ONE user message and flow
    through the same screened, gated graph."""
    pointer = _active_session(customer_id)
    user_id = pointer["user_id"]
    session_id = pointer["session_id"]
    await _ensure_session(
        user_id, session_id,
        state={"customer_id": customer_id, "user_key": user_id,
               "actor_role": actor_role})

    parts: list[types.Part] = [types.Part.from_text(text=text)] if text.strip() else []
    if image_bytes:
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
    if audio_bytes:
        parts.append(types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime))
    message = types.Content(role="user", parts=parts)

    result = TurnResult()
    invocation_id = None
    started = time.monotonic()
    with bind_context(customer_key=user_id, session_id=session_id):
        with tracer().start_as_current_span("duka.agent.turn") as span:
            span.set_attribute("duka.input.has_image", image_bytes is not None)
            span.set_attribute("duka.input.has_audio", audio_bytes is not None)
            span.set_attribute("duka.actor.role", actor_role)
            async for event in runner.run_async(
                    user_id=user_id, session_id=session_id, new_message=message):
                invocation_id = invocation_id or getattr(event, "invocation_id", None)
                # node_info.path like 'duka_autopilot@1/order_intake@1' - node
                # identity comes from the path, not event.author.
                ni = getattr(event, "node_info", None)
                label = (
                    ni.path.split("/")[-1].split("@")[0]
                    if ni and getattr(ni, "path", None) else event.author)
                if label and (not result.node_path or result.node_path[-1] != label):
                    result.node_path.append(label)
                usage = getattr(event, "usage_metadata", None)
                if usage:
                    result.input_tokens += usage.prompt_token_count or 0
                    result.output_tokens += usage.candidates_token_count or 0
                if event.content and event.content.parts:
                    for p in event.content.parts:
                        # Suspension surfaces as an adk_request_input call.
                        if (p.function_call
                                and p.function_call.name == "adk_request_input"):
                            result.suspended = True
                        if (p.function_response
                                and p.function_response.name == "record_ledger_rows"
                                and isinstance(p.function_response.response, dict)):
                            result.ledger_result = dict(p.function_response.response)
                    texts = [p.text for p in event.content.parts if p.text]
                    if texts and event.is_final_response():
                        result.reply = "".join(texts)
            if invocation_id:
                span.set_attribute("duka.invocation.id", invocation_id)
            span.set_attribute("duka.workflow.suspended", result.suspended)
            span.set_attribute("duka.workflow.node_count", len(result.node_path))
    result.wall_ms = int((time.monotonic() - started) * 1000)
    if result.suspended and not result.reply:
        # the model occasionally ends on a bare tool call before the gate
        # suspends; never show the customer an empty bubble
        result.reply = ("Your request has been sent to the shop owner for "
                        "approval - we will confirm here as soon as they decide.")

    # Memory is best-effort advisory context. A Memory Bank failure must never
    # turn an already committed order into a customer-facing error.
    try:
        await _ingest_order_summary(customer_id)
    except Exception as exc:  # memory boundary; business action already committed
        logger.warning("memory summary deferred: %s", exc.__class__.__name__)

    _log_cost(result)
    logger.info(
        "agent turn completed",
        extra={
            "session_id": session_id,
            "invocation_id": invocation_id,
            "node": result.node_path[-1] if result.node_path else "none",
        })
    return result


def _log_cost(result: TurnResult) -> None:
    path = " ".join(result.node_path)
    interaction = ("order" if "order_intake" in path else
                   "support" if "support" in path else
                   "recon" if "exact_recon" in path else "chat")
    get_store().log_cost({
        "interaction": interaction, "agent_impl": "graph",
        "model": os.environ.get("GEMINI_MODEL", "gemini-3.7-flash"),
        "input_tokens": result.input_tokens, "output_tokens": result.output_tokens,
        "cost_usd": result.cost_usd, "wall_ms": result.wall_ms,
        "node_path": " > ".join(result.node_path),
    })
