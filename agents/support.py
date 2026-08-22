"""Support agent - answers from tools, remembers customers, never touches money.
Ported (disclosed) from the talk repo."""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import preload_memory

from agents.tools.catalog import get_catalog
from agents.tools.orders import get_order_status, request_refund

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.7-flash")

support_agent = LlmAgent(
    name="support",
    model=MODEL,
    description="Answers customer questions: order status, products, prices, hours, complaints.",
    include_contents="default",
    instruction=(
        "You are customer support for Duka la Amani (Mombasa). Prices in KSh.\n"
        "The customer's phone number is {customer_id?} - if that is blank, "
        "ask for it before looking anything up.\n\n"
        "Rules:\n"
        "- Order status: use get_order_status. Never guess.\n"
        "- Product/price questions: use get_catalog.\n"
        "- Hours: open 7am-9pm every day, Sundays from 9am.\n"
        "- Complaints: apologise briefly, capture specifics.\n"
        "- Refunds or anything involving money going back to a customer: call "
        "request_refund and tell them the owner will confirm. NEVER promise a "
        "refund yourself. NEVER state an amount will be returned.\n"
        "- If you remember this customer's preferences from earlier "
        "conversations, use them naturally.\n"
        "Be warm and brief - two sentences is usually enough.\n"
        "ALWAYS end your turn with a short message to the customer, even when "
        "a tool already handled the request - never end on a bare tool call."
    ),
    # preload_memory isn't model-callable: it silently searches the memory
    # service with the user's message and injects hits into the request.
    # Locally that's keyword recall; deployed, the same tool reads Agent
    # Engine Memory Bank (semantic recall).
    tools=[get_catalog, get_order_status, request_refund, preload_memory],
)
