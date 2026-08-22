"""Proactive restock - the agent notices the shelf before the owner does.

Plain code, on purpose: stock math is arithmetic, not judgment. The nightly
run (and any manual trigger) scans the catalog; products at or below the
reorder point go into ONE restock_proposal in the approval queue - a drafted
supplier order the owner can approve or reject with their morning chai.
Nothing is ordered, paid, or adjusted until they do: humans gate money.

Idempotent: while a restock_proposal is pending, no new one is filed (the
owner is not nagged with duplicates); resolve it and the next scan may file
a fresh one if shelves are still low.
"""
from __future__ import annotations

from agents.store import get_store

REORDER_POINT = 10   # at or below this -> propose reordering
TARGET_STOCK = 30    # order up to this level


def check_restock() -> dict:
    """Scan stock; file one drafted supplier order if anything is low.

    Returns {"low": [...], "proposed": bool, "approval_id": id|None,
             "skipped_pending": bool}.
    """
    store = get_store()
    low = [p for p in store.products() if p["stock"] <= REORDER_POINT]
    if not low:
        return {"low": [], "proposed": False, "approval_id": None,
                "skipped_pending": False}

    already = [a for a in store.pending_approvals() if a["kind"] == "restock_proposal"]
    if already:
        return {"low": low, "proposed": False, "approval_id": already[0]["id"],
                "skipped_pending": True}

    lines = [{"sku": p["sku"], "name": p["name"], "stock": p["stock"],
              "order_qty": TARGET_STOCK - p["stock"], "unit": p["unit"]}
             for p in low]
    approval_id = store.add_approval("restock_proposal", {
        "lines": lines,
        "note": (f"{len(lines)} product(s) at or below reorder point "
                 f"({REORDER_POINT}); drafted to restock to {TARGET_STOCK}."),
    })
    return {"low": low, "proposed": True, "approval_id": approval_id,
            "skipped_pending": False}
