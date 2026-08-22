"""The morning digest - what the owner reads with their first chai.

Plain code end to end: the digest is an accounting artifact, so it is
assembled deterministically from the Store (no LLM between the books and
the owner's numbers). The nightly report it embeds was persisted by
agents/nightly.py. Cloud Scheduler calls /digest/morning after the nightly
run; the async phase can also push it out as a WhatsApp/SMS message.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from agents.store import get_store

LOW_STOCK_THRESHOLD = 10


def build_digest() -> dict:
    store = get_store()
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

    orders = store.list_orders(limit=100)
    new_orders = [o for o in orders if (o.get("created_at") or "") >= since]
    paid_new = [o for o in new_orders if o["status"] == "paid"]

    approvals = store.pending_approvals()
    by_kind: dict[str, int] = {}
    for a in approvals:
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1

    low_stock = [p for p in store.products() if p["stock"] < LOW_STOCK_THRESHOLD]

    nightly = None
    for m in reversed(store.messages_for("owner", limit=50)):
        if m["channel"] == "system" and "exact_matched" in (m["meta"] or {}):
            nightly = m["meta"]
            break

    return {
        "date": now.strftime("%Y-%m-%d"),
        "orders_last_24h": len(new_orders),
        "paid_last_24h": len(paid_new),
        "revenue_paid_last_24h": sum(o["total"] for o in paid_new),
        "approvals_pending": len(approvals),
        "approvals_by_kind": by_kind,
        "low_stock": [{"sku": p["sku"], "name": p["name"], "stock": p["stock"]}
                      for p in low_stock],
        "nightly": nightly,
        "statement": store.payments_summary(),
    }


def render_text(d: dict) -> str:
    """The WhatsApp-length version. Deterministic - numbers are numbers."""
    lines = [f"Habari ya asubuhi! Duka Autopilot - {d['date']}"]
    lines.append(f"• Orders (24h): {d['orders_last_24h']}, paid: {d['paid_last_24h']} "
                 f"(KSh {d['revenue_paid_last_24h']:,})")
    n = d.get("nightly")
    if n:
        lines.append(f"• Night shift: {n['exact_matched']:,} payments settled "
                     f"({n['settle_rate']:.0%} deterministic), "
                     f"{n['fuzzy_proposals']} proposal(s) need you, "
                     f"LLM cost ${n['cost_usd']:.4f}")
    else:
        s = d["statement"]
        lines.append(f"• Statement: {s['matched_exact']:,} matched, "
                     f"{s['unmatched']:,} unmatched")
    if d["approvals_pending"]:
        kinds = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in
                          sorted(d["approvals_by_kind"].items()))
        lines.append(f"• Waiting for YOU: {d['approvals_pending']} approval(s) - {kinds}")
    else:
        lines.append("• Nothing waiting for you. Approval queue is clear!")
    if d["low_stock"]:
        top = ", ".join(f"{p['name']} ({p['stock']})" for p in d["low_stock"][:5])
        lines.append(f"• Low stock: {top}")
    return "\n".join(lines)


def morning_digest(persist: bool = True) -> dict:
    d = build_digest()
    text = render_text(d)
    if persist:
        get_store().add_message("owner", "out", text, channel="system",
                                meta={"digest": True, "date": d["date"]})
    return {"digest": d, "text": text}
