"""Order tools. save_order enforces the review gate - the LLM never bypasses it.
Ported (disclosed) from the talk repo; rewired onto the Store seam."""
from __future__ import annotations

from agents.store import get_store

CONFIDENCE_GATE = 0.8


def save_order(customer_id: str, items: list[dict], confidence: float, notes: str = "") -> dict:
    """Save a parsed customer order.

    Args:
        customer_id: Customer phone number, e.g. '254711000001'.
        items: Parsed line items: [{"sku": str|null, "name": str, "qty": int, "unit_price": int}].
               sku may be null when the product wasn't matched to the catalog.
        confidence: Parser confidence 0.0-1.0 over the WHOLE order (lowest field wins).
        notes: Anything ambiguous worth surfacing to the owner.

    Returns:
        {"order_id": int, "status": str, "total": int, "needs_review": bool}
    """
    store = get_store()
    needs_review = confidence < CONFIDENCE_GATE or any(not i.get("sku") for i in items)
    status = "needs_review" if needs_review else "pending_confirmation"
    order_id = store.create_order(customer_id, items, status=status,
                                  needs_review=needs_review, notes=notes)
    total = sum(int(i["unit_price"]) * int(i["qty"]) for i in items)
    if needs_review:
        store.add_approval("low_confidence_order",
                           {"order_id": order_id, "confidence": confidence, "notes": notes})
    return {"order_id": order_id, "status": status, "total": total, "needs_review": needs_review}


def get_order_status(customer_id: str) -> list[dict]:
    """Get a customer's recent orders, newest first.

    Args:
        customer_id: Customer phone number.

    Returns:
        Up to 5 recent orders with id, status, total and item summary.
    """
    orders = get_store().orders_for_customer(customer_id, limit=5)
    for o in orders:
        o["items"] = ", ".join(f"{i['qty']}x {i['name']}" for i in o["items"])
    return orders


def request_refund(customer_id: str, order_id: int, reason: str,
                   tool_context=None) -> dict:
    """Open a refund request. NEVER promises money - the owner must approve.

    Args:
        customer_id: Customer phone number.
        order_id: The order the refund concerns.
        reason: Customer's stated reason.

    Returns:
        {"approval_id": int, "status": "pending_owner_approval"}
    """
    payload = {"customer_id": customer_id, "order_id": order_id, "reason": reason}
    approval_id = get_store().add_approval("refund", payload)
    if tool_context is not None:
        # flag the request in state so the refund_gate node downstream
        # suspends the workflow on it (graph-native HITL)
        tool_context.state["refund_request"] = {"approval_id": approval_id, **payload}
    return {"approval_id": approval_id, "status": "pending_owner_approval"}
