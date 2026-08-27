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


def record_fuzzy_match(payment_id: str, order_id: str,
                       confidence: float, rationale: str) -> dict:
    """Record an LLM-proposed match. Goes to the approval queue, never auto-paid.

    Args:
        payment_id: The payment row id.
        order_id: The proposed order id.
        confidence: 0.0-1.0.
        rationale: One-line explanation, e.g. 'payer name variant of customer name'.

    Returns:
        A pending proposal identifier, an existing duplicate proposal, or a
        structured validation error.
    """
    store = get_store()
    payment = store.get_payment(payment_id)
    order = store.get_order(order_id)
    if payment is None or order is None:
        return {"status": "error", "error": "payment or order not found",
                "approval_id": None}
    if payment.get("matched_order_id") is not None:
        return {"status": "error", "error": "payment is already linked",
                "approval_id": None}
    if order.get("status") not in ("confirmed", "pending_confirmation"):
        return {"status": "error", "error": "order is not open",
                "approval_id": None}
    if isinstance(confidence, bool):
        return {"status": "error", "error": "invalid confidence", "approval_id": None}
    try:
        confidence_value = float(confidence)
    except (TypeError, ValueError):
        return {"status": "error", "error": "invalid confidence", "approval_id": None}
    if not 0.0 <= confidence_value <= 1.0:
        return {"status": "error", "error": "invalid confidence", "approval_id": None}
    for approval in store.pending_approvals():
        payload = approval.get("payload") or {}
        if (approval.get("kind") == "fuzzy_match"
                and str(payload.get("payment_id")) == str(payment_id)):
            return {"status": "pending_owner_approval",
                    "approval_id": approval["id"], "duplicate": True}
    approval_id = store.add_approval("fuzzy_match", {
        "payment_id": payment_id, "order_id": order_id,
        "confidence": confidence_value, "rationale": str(rationale or "")[:500],
    })
    store.mark_payment_kind(payment_id, "fuzzy")
    return {"status": "pending_owner_approval", "approval_id": approval_id,
            "duplicate": False}
