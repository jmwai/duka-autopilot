"""Coordinator: LLM classifies, code routes.

The LlmAgent only suggests a route; the FunctionNode makes the routing
decision and emits it via ctx.route. LLM suggests, code decides.
Ported (disclosed) from the talk repo.
"""
from __future__ import annotations

import os

from google.adk.agents import Context, LlmAgent
from google.adk.workflow import FunctionNode

from agents.context_safety import sanitize_model_history
from agents.store import get_store

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.7-flash")

ROUTES = ("order", "support", "recon", "ledger")

classifier = LlmAgent(
    name="classifier",
    model=MODEL,
    description="Classifies an inbound customer message.",
    instruction=(
        "Classify the customer's message into exactly one word.\n"
        "The message may be text, a VOICE NOTE (audio, often Swahili or\n"
        "Swahili-English mix - listen to it), or a PHOTO (an order note, or a\n"
        "page of the shop's handwritten ledger).\n"
        "- 'order'   : they want to buy something (text, voice note, or a photo of an order note)\n"
        "- 'support' : question about an order, product, price, hours, or a complaint/refund\n"
        "- 'ledger'  : the OWNER sent a photo of a handwritten ledger/sales page to digitize\n"
        "- 'recon'   : the OWNER asking to reconcile payments / run the statement\n"
        "Reply with only the single word. Nothing else."
    ),
    output_key="route_decision",
    before_model_callback=sanitize_model_history,
)


def route_message(ctx: Context) -> None:
    """Read the classifier's suggestion, sanitize it, emit the route.

    Returns None on purpose: a FunctionNode's return value is injected into
    the NEXT node's context as a user-role message (verified on adk 2.5), so
    returning the route word would make intake see a bogus "order" message.
    The route travels only via ctx.route."""
    decision = str(ctx.state.get("route_decision", "")).strip().lower()
    if (decision in ("ledger", "recon")
            and ctx.state.get("actor_role") != "owner"):
        text = " ".join(
            part.text for part in (ctx.user_content.parts or [])
            if getattr(part, "text", None)
        ) if ctx.user_content else ""
        get_store().add_approval("security_flag", {
            "customer_id": ctx.state.get("customer_id", "unknown"),
            "message_excerpt": text[:200],
            "reasons": [f"customer attempted owner-only {decision} route"],
        })
        ctx.route = "blocked"
        return
    ctx.route = decision if decision in ROUTES else "support"  # safe default


router = FunctionNode(func=route_message, name="router")
