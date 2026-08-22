"""Order intake agent - multimodal, schema-strict, confidence-gated.
Ported (disclosed) from the talk repo. Voice-note intake lands in the
multimodal phase; the guardrails below apply to every modality."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import preload_memory

from agents.tools.catalog import get_catalog
from agents.tools.orders import save_order

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

intake_agent = LlmAgent(
    name="order_intake",
    model=MODEL,
    description="Turns free-form customer messages (text or order-note photos) into structured orders.",
    # Workflow nodes default to include_contents='none' (verified on adk 2.5:
    # the node would only see the router's output, never the customer's
    # message). 'default' restores the conversation view.
    include_contents="default",
    instruction=(
        "You take orders for Duka la Amani (Mombasa). Prices in KSh.\n"
        "The customer's phone number is {customer_id?} - if that is blank, "
        "ask for their phone number BEFORE saving the order.\n\n"
        "Process:\n"
        "1. Extract every requested item and quantity from the message or photo.\n"
        "2. For each item call get_catalog to resolve the sku and unit_price.\n"
        "3. Set confidence 0.0-1.0 for the WHOLE order. Lower it when: an item "
        "didn't match the catalog, a quantity is ambiguous, or handwriting was "
        "hard to read. Never guess amounts - reflect doubt in confidence.\n"
        "4. Call save_order exactly once with all items.\n"
        "5. Reply to the customer with an itemized total. If the order needs "
        "review, say the shop will confirm shortly - do NOT promise it is confirmed.\n"
        "Never invent products or prices. Never skip save_order.\n"
        "If earlier conversations (PAST CONVERSATIONS context) show what this "
        "customer usually orders, you may resolve phrases like 'the usual' "
        "from them - but say what you resolved it to, and lower confidence "
        "if the memory is not an exact order."
    ),
    tools=[get_catalog, save_order, preload_memory],
)
