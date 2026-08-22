"""ADK runner glue - local mode. Ported (disclosed) from the talk repo,
trimmed: Autopilot is always the workflow graph (no 'naive' act here), and
RUN_MODE=cloud (deployed Agent Engine) returns with the deploy phase.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

from google.adk.events.event import Event
from google.genai import types

from agents.store import get_store

APP_NAME = "duka-autopilot"

# USD per 1M tokens - Vertex list prices, override in .env
PRICE_IN = float(os.environ.get("PRICE_INPUT_PER_M", "1.50"))
PRICE_OUT = float(os.environ.get("PRICE_OUTPUT_PER_M", "7.50"))


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
    # Memory seam: locally the default keyword-matching memory; with
    # MEMORY_BANK_ENGINE_ID set, the SAME add_session_to_memory /
    # preload_memory calls read and write Agent Engine Memory Bank
    # (LLM-powered extraction + semantic recall). Config swap, no code change
    # anywhere else - the memory service is a seam like the Store and the bus.
    bank_id = os.environ.get("MEMORY_BANK_ENGINE_ID") or (
        os.environ.get("AGENT_ENGINE_ID")
        if os.environ.get("USE_MEMORY_BANK", "").lower() in ("1", "true") else None)
    if bank_id:
        from google.adk.memory import VertexAiMemoryBankService
        from google.adk.sessions import InMemorySessionService

        return Runner(
            app=adk_app,
            session_service=InMemorySessionService(),
            memory_service=VertexAiMemoryBankService(
                project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
                location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
                agent_engine_id=bank_id.split("/")[-1],
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

    @property
    def cost_usd(self) -> float:
        return (self.input_tokens * PRICE_IN + self.output_tokens * PRICE_OUT) / 1_000_000


# Session rotation: "chat-<customer>-<n>". Bumping n starts a fresh session;
# memory is the only bridge back to older sessions.
_session_gen: dict[str, int] = {}


def _session_id(customer_id: str) -> str:
    return f"chat-{customer_id}-{_session_gen.get(customer_id, 0)}"


def new_session(customer_id: str) -> str:
    """Start the customer's next session (UI 'new day' button)."""
    _session_gen[customer_id] = _session_gen.get(customer_id, 0) + 1
    return _session_id(customer_id)


async def _ensure_session(user_id: str, session_id: str, state: dict) -> None:
    svc = runner.session_service
    existing = await svc.get_session(app_name=APP_NAME, user_id=user_id, session_id=session_id)
    if existing is None:
        await svc.create_session(app_name=APP_NAME, user_id=user_id, session_id=session_id, state=state)


async def resume_refund(customer_id: str, session_id: str, invocation_id: str,
                        interrupt_id: str, decision: str) -> str:
    """Resume a workflow suspended at the refund_gate with the owner's decision.

    The decision travels as a function_response part whose id is the
    interrupt_id - the Runner turns that into ctx.resume_inputs for the
    rerun of the gate node. Returns the customer-facing confirmation text."""
    message = types.Content(role="user", parts=[types.Part(
        function_response=types.FunctionResponse(
            id=interrupt_id, name="adk_request_input",
            response={"decision": decision},
        ))])
    reply = ""
    async for event in runner.run_async(user_id=customer_id, session_id=session_id,
                                        new_message=message,
                                        invocation_id=invocation_id):
        if event.content and event.content.parts:
            texts = [p.text for p in event.content.parts if p.text]
            if texts and event.is_final_response():
                reply = "".join(texts)
    return reply


async def _ingest_order_summary(customer_id: str) -> None:
    """Deterministic memory: after every turn, write a compact English summary
    of the customer's confirmed order history (plain code, no LLM).

    Local keyword-matching memory can't bridge languages: Thursday's "the
    usual" shares no words with Tuesday's "nataka unga...". This summary
    contains the literal words "usual order", so the beat works locally;
    Memory Bank's semantic recall makes it unnecessary once deployed."""
    orders = get_store().orders_for_customer(customer_id, limit=3)
    lines = []
    for o in orders:
        items = o.get("items") or []
        if items and not o.get("needs_review"):
            lines.append(f"order #{o['id']}: "
                         + ", ".join(f"{i['qty']}x {i['name']}" for i in items)
                         + f" (KSh {o['total']})")
    if not lines:
        return
    text = (f"Order history for customer {customer_id} - their usual order is "
            f"the most recent: " + "; ".join(lines))
    # stable id per (customer, latest order): the memory service dedups on
    # event id, so unchanged history is a no-op and new orders add one entry
    event = Event(
        id=f"order-summary-{customer_id}-{orders[0]['id']}",
        author="system",
        content=types.Content(role="user", parts=[types.Part.from_text(text=text)]),
    )
    await runner.memory_service.add_events_to_memory(
        app_name=APP_NAME, user_id=customer_id, events=[event],
        session_id=f"order-summaries-{customer_id}")


async def run_turn(customer_id: str, text: str, image_bytes: bytes | None = None,
                   image_mime: str = "image/jpeg", audio_bytes: bytes | None = None,
                   audio_mime: str = "audio/ogg") -> TurnResult:
    """Run one customer message through the workflow; log cost.

    Modalities change, guardrails don't: text, order-note/ledger photos and
    Swahili voice notes all enter as parts of ONE user message and flow
    through the same screened, gated graph."""
    session_id = _session_id(customer_id)
    await _ensure_session(customer_id, session_id, state={"customer_id": customer_id})

    parts: list[types.Part] = [types.Part.from_text(text=text)] if text.strip() else []
    if image_bytes:
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
    if audio_bytes:
        parts.append(types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime))
    message = types.Content(role="user", parts=parts)

    result = TurnResult()
    started = time.monotonic()
    async for event in runner.run_async(user_id=customer_id, session_id=session_id, new_message=message):
        # node_info.path like 'duka_autopilot@1/order_intake@1' - node identity
        # comes from the path, not event.author (verified on adk 2.5)
        ni = getattr(event, "node_info", None)
        label = (ni.path.split("/")[-1].split("@")[0] if ni and getattr(ni, "path", None)
                 else event.author)
        if label and (not result.node_path or result.node_path[-1] != label):
            result.node_path.append(label)
        usage = getattr(event, "usage_metadata", None)
        if usage:
            result.input_tokens += usage.prompt_token_count or 0
            result.output_tokens += usage.candidates_token_count or 0
        if event.content and event.content.parts:
            for p in event.content.parts:
                # a workflow suspension surfaces as an adk_request_input call
                if p.function_call and p.function_call.name == "adk_request_input":
                    result.suspended = True
            texts = [p.text for p in event.content.parts if p.text]
            if texts and event.is_final_response():
                result.reply = "".join(texts)
    result.wall_ms = int((time.monotonic() - started) * 1000)
    if result.suspended and not result.reply:
        # the model occasionally ends on a bare tool call before the gate
        # suspends; never show the customer an empty bubble
        result.reply = ("Your request has been sent to the shop owner for "
                        "approval - we will confirm here as soon as they decide.")

    # Ingest the session into long-term memory after every turn. Locally this
    # is keyword matching; on Agent Engine the same call feeds Memory Bank
    # (LLM-powered extraction + semantic recall).
    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=customer_id, session_id=session_id)
    if session is not None:
        await runner.memory_service.add_session_to_memory(session)
    await _ingest_order_summary(customer_id)

    _log_cost(result)
    return result


def _log_cost(result: TurnResult) -> None:
    path = " ".join(result.node_path)
    interaction = ("order" if "order_intake" in path else
                   "support" if "support" in path else
                   "recon" if "exact_recon" in path else "chat")
    get_store().log_cost({
        "interaction": interaction, "agent_impl": "graph",
        "model": os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
        "input_tokens": result.input_tokens, "output_tokens": result.output_tokens,
        "cost_usd": result.cost_usd, "wall_ms": result.wall_ms,
        "node_path": " > ".join(result.node_path),
    })
