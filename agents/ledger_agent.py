"""Ledger reader - Gemini vision digitizes a handwritten page, row by row.

Owner-only route. The agent can look and extract; only record_ledger_rows
decides what reaches the books, and its per-row confidence gate sends every
doubtful line to the approval queue.
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent

from agents.context_safety import sanitize_model_history
from agents.tools.catalog import get_catalog
from agents.tools.ledger import record_ledger_rows

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.7-flash")

ledger_agent = LlmAgent(
    name="ledger_reader",
    model=MODEL,
    description="Digitizes photos of the shop's handwritten sales/credit ledger pages.",
    include_contents="default",  # must see the photo, not just the router hop
    instruction=(
        "You digitize handwritten ledger pages for Duka la Amani (Mombasa).\n"
        "The photo shows one page: usually a date header, then one sale or\n"
        "credit entry per line (name, items or shorthand, amount in KSh,\n"
        "sometimes a tick/'lipa' mark meaning paid). Swahili, English and\n"
        "shorthand mix freely.\n\n"
        "Process:\n"
        "1. Read EVERY line. Use get_catalog to resolve product shorthand\n"
        "   ('unga x2' -> catalog name/price) when it helps confirm an amount.\n"
        "2. For each line build a row: customer_name, customer_id (phone ONLY\n"
        "   if written on the page - never invent one), description, amount\n"
        "   (integer KSh), paid (true if ticked/lipa), confidence 0-1, and\n"
        "   issue (set it whenever anything is unreadable, crossed out,\n"
        "   ambiguous, or the math on the page disagrees with itself).\n"
        "3. NEVER guess amounts. An unreadable amount is issue='amount\n"
        "   unreadable', amount=0, low confidence - the owner will fix it.\n"
        "4. Call record_ledger_rows exactly once with all rows and a short\n"
        "   page_note (the date header, page totals if written).\n"
        "5. Reply to the owner: how many rows recorded, how many held for\n"
        "   review and why - one line each for the held ones."
    ),
    tools=[get_catalog, record_ledger_rows],
    before_model_callback=sanitize_model_history,
)
