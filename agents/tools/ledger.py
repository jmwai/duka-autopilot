"""Ledger digitization tools - what the vision agent may do with a page.

The owner photographs a handwritten sales/credit page; the LLM extracts
rows; THESE tools decide what happens to them (LLM suggests, code decides):

  - a row that resolves cleanly (known customer or walk-in, catalog-priced
    or explicit amount, legible) becomes a recorded sale
  - anything doubtful - unreadable amount, unknown name, sum mismatch -
    goes to the approval queue as a ledger_row, never straight to the books

Confidence gates per ROW, not per page: one smudged line must not block
the nine clean ones, and must never sneak in with them either.
"""
from __future__ import annotations

from google.adk.tools import ToolContext

from agents.store import get_store

ROW_CONFIDENCE_GATE = 0.8


def record_ledger_rows(rows: list[dict], page_note: str,
                       tool_context: ToolContext) -> dict:
    """Record extracted ledger rows; doubtful rows gate on the owner.

    Args:
        rows: One dict per handwritten line:
            {"customer_name": str, "customer_id": str|null (phone if known),
             "description": str, "amount": int (KSh),
             "paid": bool (cash column ticked), "confidence": float 0-1,
             "issue": str|null (why doubtful, e.g. 'amount unreadable')}
        page_note: Anything about the page as a whole (date header, totals).

    Returns:
        {"recorded": int, "gated": int, "order_ids": [...], "approval_ids": [...]}
    """
    if tool_context.state.get("actor_role") != "owner":
        return {
            "status": "error", "error": "owner authority required",
            "recorded": 0, "gated": 0, "order_ids": [], "approval_ids": [],
        }
    store = get_store()
    recorded, gated, order_ids, approval_ids = 0, 0, [], []
    for row in rows:
        confidence = float(row.get("confidence", 0))
        doubtful = (confidence < ROW_CONFIDENCE_GATE or row.get("issue")
                    or not row.get("amount"))
        if doubtful:
            approval_ids.append(store.add_approval("ledger_row", {
                "row": row, "page_note": page_note,
                "reason": row.get("issue") or f"confidence {confidence:.2f}",
            }))
            gated += 1
            continue
        customer_id = row.get("customer_id") or "walk-in"
        if not store.get_customer(customer_id):
            # a ledger page can name a customer the system has never seen;
            # the books must not reject them (plain upsert, no LLM judgment)
            store.upsert_customers([{"id": customer_id,
                                     "name": row.get("customer_name") or customer_id,
                                     "notes": "from ledger page"}])
        items = [{"sku": None, "name": row.get("description") or "ledger sale",
                  "qty": 1, "unit_price": int(row["amount"])}]
        oid = store.create_order(
            customer_id,
            items,
            status="paid" if row.get("paid") else "confirmed",
            notes=f"ledger page: {page_note}" if page_note else "ledger row",
        )
        order_ids.append(oid)
        recorded += 1
    return {"status": "success", "recorded": recorded, "gated": gated,
            "order_ids": order_ids, "approval_ids": approval_ids}
