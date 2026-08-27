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

import math
import re

from google.adk.tools import ToolContext

from agents.store import get_store

ROW_CONFIDENCE_GATE = 0.8
CUSTOMER_ID = re.compile(r"^[A-Za-z0-9_-]{1,100}$")


def _text(value: object, fallback: str = "", limit: int = 500) -> str:
    cleaned = str(value or "").strip()
    return (cleaned or fallback)[:limit]


def _normalize_row(raw: object) -> tuple[dict, list[str]]:
    """Keep one malformed model row from blocking valid rows on the page."""
    row = raw if isinstance(raw, dict) else {}
    issues: list[str] = []
    stated_issue = _text(row.get("issue"), limit=300)

    customer_id = row.get("customer_id")
    if customer_id is not None:
        customer_id = str(customer_id).strip()
        if not CUSTOMER_ID.fullmatch(customer_id):
            customer_id = None
            issues.append("customer identifier invalid")

    description = _text(row.get("description"))
    if not description:
        issues.append("description missing")

    raw_amount = row.get("amount")
    amount = raw_amount if isinstance(raw_amount, int) and not isinstance(raw_amount, bool) else 0
    if amount <= 0:
        amount = 0
        if "amount" not in stated_issue.lower():
            issues.append("amount must be a positive integer")

    raw_confidence = row.get("confidence")
    confidence_valid = True
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        confidence = 0.0
        confidence_valid = False
    if (not confidence_valid or isinstance(raw_confidence, bool) or not math.isfinite(confidence)
            or not 0 <= confidence <= 1):
        confidence = 0.0
        issues.append("confidence invalid")

    raw_paid = row.get("paid")
    paid = raw_paid if isinstance(raw_paid, bool) else False
    if not isinstance(raw_paid, bool):
        issues.append("paid marker invalid")

    if stated_issue:
        issues.insert(0, stated_issue)

    return {
        "customer_name": _text(row.get("customer_name"), "walk-in", 200),
        "customer_id": customer_id,
        "description": description,
        "amount": amount,
        "paid": paid,
        "confidence": confidence,
        "issue": stated_issue or None,
    }, list(dict.fromkeys(issues))


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
    recorded, gated, order_ids, approval_ids, outcomes = 0, 0, [], [], []
    for index, raw_row in enumerate(rows):
        row, issues = _normalize_row(raw_row)
        confidence = row["confidence"]
        doubtful = confidence < ROW_CONFIDENCE_GATE or bool(issues)
        if doubtful:
            reason = "; ".join(issues) if issues else f"confidence {confidence:.2f}"
            approval_ids.append(store.add_approval("ledger_row", {
                "row": row, "page_note": page_note,
                "reason": reason,
            }))
            outcomes.append({
                "index": index, "outcome": "gated",
                "customer_name": row["customer_name"],
                "description": row["description"], "amount": row["amount"] or None,
                "paid": row["paid"], "confidence": confidence,
                "reason": reason, "approval_id": approval_ids[-1],
            })
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
        outcomes.append({
            "index": index, "outcome": "recorded",
            "customer_name": row["customer_name"],
            "description": row["description"], "amount": row["amount"],
            "paid": row["paid"], "confidence": confidence,
            "reason": None, "order_id": oid,
        })
        recorded += 1
    return {"status": "success", "recorded": recorded, "gated": gated,
            "order_ids": order_ids, "approval_ids": approval_ids,
            "rows": outcomes}
