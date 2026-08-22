"""Fuzzy-pass tools: what the LLM may see and the ONLY things it may do.
It can look at open orders and PROPOSE matches into the approval queue.
It cannot mark anything paid. Ported (disclosed); Store seam + scale caps."""
from __future__ import annotations

from agents.store import get_store

# At 50k-statement scale the residue is ~3%, but the candidate-order list
# must still be bounded before it lands in a prompt: cap and say so.
CANDIDATE_CAP = 200


def unpaid_orders_summary() -> dict:
    """List open (unpaid) orders as candidates for fuzzy matching.

    Returns:
        {"orders": [...], "truncated": bool, "total_open": int}
    """
    orders = get_store().unpaid_orders()
    return {
        "orders": orders[:CANDIDATE_CAP],
        "truncated": len(orders) > CANDIDATE_CAP,
        "total_open": len(orders),
    }


def record_fuzzy_match(payment_id: int, order_id: int, confidence: float, rationale: str) -> dict:
    """Record an LLM-proposed match. Goes to the approval queue, never auto-paid.

    Args:
        payment_id: The payment row id.
        order_id: The proposed order id.
        confidence: 0.0-1.0.
        rationale: One-line explanation, e.g. 'payer name variant of customer name'.

    Returns:
        {"approval_id": int}
    """
    store = get_store()
    approval_id = store.add_approval("fuzzy_match", {
        "payment_id": payment_id, "order_id": order_id,
        "confidence": confidence, "rationale": rationale,
    })
    store.mark_payment_kind(payment_id, "fuzzy")
    return {"approval_id": approval_id}
