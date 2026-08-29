"""Reconciliation workflow nodes: engine first, LLM only on the residue.
The exact pass now runs the indexed recon_engine so the same node handles a duka's 50-row night or the
50,000-row headroom test."""
from __future__ import annotations

import os

from google.adk.agents import Context, LlmAgent
from google.adk.workflow import FunctionNode

from agents.context_safety import sanitize_model_history
from agents.recon_engine import run_exact_pass
from agents.store import get_store
from agents.tools.recon import record_fuzzy_match, unpaid_orders_summary

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.7-flash")

# Bound what can land in the fuzzy prompt; the nightly job iterates batches.
RESIDUE_BATCH = 25


def exact_pass_node(ctx: Context) -> dict:
    """Deterministic pass. No LLM. Settles the engineered majority and routes:
    'fuzzy' if residue remains, 'done' if everything matched."""
    stats = run_exact_pass(get_store())
    ctx.state["recon_exact_matched"] = stats["matched"]
    ctx.state["recon_remaining"] = stats["residue"][:RESIDUE_BATCH]
    ctx.state["recon_residue_total"] = stats["residue_count"]
    ctx.state["recon_settle_rate"] = round(stats["settle_rate"], 4)
    ctx.route = "fuzzy" if stats["residue_count"] else "done"
    return {"matched": stats["matched"], "residue_count": stats["residue_count"],
            "settle_rate": stats["settle_rate"], "wall_ms": stats["wall_ms"]}


exact_recon = FunctionNode(func=exact_pass_node, name="exact_recon")

fuzzy_recon = LlmAgent(
    name="fuzzy_recon",
    model=MODEL,
    description="Proposes matches for payments the exact pass could not settle.",
    # Dataflow node: state must be TEMPLATED into the instruction - a
    # workflow node cannot "look up" state on its own (verified on adk 2.5).
    instruction=(
        "You reconcile M-Pesa payments for Duka la Amani.\n"
        "The deterministic pass settled {recon_exact_matched?} payment(s) "
        "(settle rate {recon_settle_rate?}). {recon_residue_total?} remain; "
        "this batch:\n{recon_remaining?}\n\n"
        "Process:\n"
        "1. Call unpaid_orders_summary to see candidate orders.\n"
        "2. For each unmatched payment, look for: payer-name variants of the "
        "customer name (e.g. 'B. Otieno' vs 'Bwana Otieno'), partial payments, "
        "or two payments summing to one order.\n"
        "3. For each plausible match call record_fuzzy_match with confidence "
        "and a one-line rationale. It goes to the owner's approval queue - "
        "you CANNOT mark anything paid.\n"
        "4. If no plausible match exists, leave the payment unmatched.\n"
        "5. Finish with a short report: exact matches settled, your fuzzy "
        "proposals, anything still unmatched."
    ),
    tools=[unpaid_orders_summary, record_fuzzy_match],
    before_model_callback=sanitize_model_history,
)


def summarize(ctx: Context) -> str:
    """Terminal node when the exact pass settled everything."""
    n = ctx.state.get("recon_exact_matched", 0)
    return f"Reconciliation complete: {n} payment(s) matched exactly, nothing left for review."


recon_summary = FunctionNode(func=summarize, name="recon_summary")
