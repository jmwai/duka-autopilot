"""Grounded order and refund tools.

The model may extract intent, SKUs, quantities, and confidence. These tools
derive customer authority from ADK state, re-read the current catalog, and
enforce every persistence invariant. Model-supplied product names and prices
are never business truth.
"""
from __future__ import annotations

from google.adk.tools import ToolContext

from agents.store import get_store

CONFIDENCE_GATE = 0.8


def _customer_scope(tool_context: ToolContext) -> str:
    customer_id = str(tool_context.state.get("customer_id") or "").strip()
    if not customer_id:
        raise ValueError("customer scope is missing")
    return customer_id


def _order_error(message: str) -> dict:
    return {
        "status": "error",
        "error": message,
        "order_id": None,
        "total": 0,
        "needs_review": False,
    }


def save_order(items: list[dict], confidence: float, notes: str,
               tool_context: ToolContext) -> dict:
    """Save a catalog-grounded order for the current customer.

    Args:
        items: Parsed line items containing only catalog sku and integer qty,
            for example [{"sku": "UNGA-2KG", "qty": 2}].
        confidence: Parser confidence from 0.0 to 1.0 over the whole order.
        notes: A short explanation of any ambiguity, or an empty string.

    Returns:
        Success with order_id, total, status and needs_review, or a structured
        error. Product names and prices always come from the current catalog.
    """
    store = get_store()
    try:
        customer_id = _customer_scope(tool_context)
    except ValueError as exc:
        return _order_error(str(exc))
    if not store.get_customer(customer_id):
        return _order_error("unknown customer")
    if isinstance(confidence, bool):
        return _order_error("confidence must be between 0 and 1")
    try:
        confidence_value = float(confidence)
    except (TypeError, ValueError):
        return _order_error("confidence must be between 0 and 1")
    if not 0.0 <= confidence_value <= 1.0:
        return _order_error("confidence must be between 0 and 1")
    if not isinstance(items, list) or not items:
        return _order_error("order must contain at least one item")

    catalog = {str(p["sku"]): p for p in store.products()}
    grounded_items: list[dict] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            return _order_error(f"item {index} must be an object")
        sku = str(item.get("sku") or "").strip()
        product = catalog.get(sku)
        if product is None:
            return _order_error(f"unknown sku: {sku or '<missing>'}")
        qty = item.get("qty")
        if type(qty) is not int or qty <= 0:
            return _order_error(f"invalid quantity for {sku}")
        grounded_items.append({
            "sku": sku,
            "name": product["name"],
            "qty": qty,
            "unit_price": int(product["unit_price"]),
        })

    needs_review = confidence_value < CONFIDENCE_GATE
    status = "needs_review" if needs_review else "pending_confirmation"
    safe_notes = str(notes or "")[:500]
    order_id = store.create_order(
        customer_id,
        grounded_items,
        status=status,
        needs_review=needs_review,
        notes=safe_notes,
    )
    total = sum(i["unit_price"] * i["qty"] for i in grounded_items)
    if needs_review:
        store.add_approval("low_confidence_order", {
            "order_id": order_id,
            "customer_id": customer_id,
            "confidence": confidence_value,
            "notes": safe_notes,
        })
    return {
        "status": "success",
        "order_id": order_id,
        "status_detail": status,
        "total": total,
        "needs_review": needs_review,
    }


def get_order_status(tool_context: ToolContext) -> list[dict]:
    """Get the current customer's five most recent orders.

    Returns:
        Recent orders with id, status, total and item summary.
    """
    try:
        customer_id = _customer_scope(tool_context)
    except ValueError:
        return []
    orders = get_store().orders_for_customer(customer_id, limit=5)
    for order in orders:
        order["items"] = ", ".join(
            f"{item['qty']}x {item['name']}" for item in order["items"])
    return orders


def request_refund(order_id: str, reason: str, tool_context: ToolContext) -> dict:
    """Open an owner-reviewed refund proposal for the current customer.

    Args:
        order_id: The customer's order identifier.
        reason: The customer's stated reason.

    Returns:
        A pending proposal identifier, or a structured validation error.
    """
    store = get_store()
    try:
        customer_id = _customer_scope(tool_context)
    except ValueError as exc:
        return {"status": "error", "error": str(exc), "approval_id": None}
    order = store.get_order(order_id)
    if order is None or str(order.get("customer_id")) != customer_id:
        return {"status": "error", "error": "order not found for customer",
                "approval_id": None}
    safe_reason = str(reason or "").strip()[:500]
    if not safe_reason:
        return {"status": "error", "error": "refund reason is required",
                "approval_id": None}
    for approval in store.pending_approvals():
        payload = approval.get("payload") or {}
        if (approval.get("kind") == "refund"
                and str(payload.get("order_id")) == str(order_id)
                and str(payload.get("customer_id")) == customer_id):
            return {"status": "pending_owner_approval",
                    "approval_id": approval["id"], "duplicate": True}

    payload = {"customer_id": customer_id, "order_id": order_id,
               "reason": safe_reason}
    approval_id = store.add_approval("refund", payload)
    tool_context.state["refund_request"] = {"approval_id": approval_id, **payload}
    return {"approval_id": approval_id, "status": "pending_owner_approval",
            "duplicate": False}
