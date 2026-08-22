"""The nightly reconciliation run - what Cloud Scheduler fires at 2am.

Shape of the run (and of the whole thesis):

  1. exact pass    - plain code, indexed, settles ~97% of the month in seconds
  2. fuzzy batches - the residue goes through the SAME workflow graph the
                     owner would trigger by chat, RESIDUE_BATCH rows per
                     invocation, until the residue stops shrinking. Every
                     proposal lands in the approval queue; nothing is paid.
  3. report        - counts + measured cost (from the cost log delta),
                     persisted as a system message for the morning digest.

The LLM only ever sees step 2. That is why the measured number on the
economics slide is "a 50,000-row month for under a dollar", not "50,000
LLM calls".
"""
from __future__ import annotations

import time

from agents.recon_engine import run_exact_pass
from agents.store import get_store

MAX_FUZZY_BATCHES = 40  # hard ceiling per night; leftovers wait for the owner


def _recon_cost_usd(store) -> float:
    per = store.cost_summary()["per_interaction"]
    row = next((r for r in per if r["interaction"] == "recon"), None)
    return float(row.get("total_cost_usd") or 0) if row else 0.0


async def run_nightly(fuzzy: bool = True) -> dict:
    """Run the whole nightly pipeline; returns the report dict."""
    store = get_store()
    t0 = time.monotonic()
    cost_before = _recon_cost_usd(store)

    exact = run_exact_pass(store)
    report = {
        "exact_matched": exact["matched"],
        "settle_rate": round(exact["settle_rate"], 4),
        "exact_wall_ms": exact["wall_ms"],
        "residue_start": exact["residue_count"],
        "fuzzy_batches": 0,
        "fuzzy_proposals": 0,
    }

    if fuzzy and exact["residue_count"]:
        # Each turn re-enters the graph on the recon route: exact pass is a
        # cheap no-op re-check, the fuzzy node gets the next residue batch.
        from app.runner import run_turn
        pending_before = len([a for a in store.pending_approvals()
                              if a["kind"] == "fuzzy_match"])
        last_remaining = None
        for _ in range(MAX_FUZZY_BATCHES):
            remaining = len(store.unmatched_payments())
            if remaining == 0 or remaining == last_remaining:
                break  # done, or the model proposed nothing new - stop burning tokens
            last_remaining = remaining
            await run_turn("owner", "Reconcile the M-Pesa statement residue now.")
            report["fuzzy_batches"] += 1
        pending_after = len([a for a in store.pending_approvals()
                             if a["kind"] == "fuzzy_match"])
        report["fuzzy_proposals"] = pending_after - pending_before

    report["residue_end"] = len(store.unmatched_payments())
    report["cost_usd"] = round(_recon_cost_usd(store) - cost_before, 6)

    # proactive restock: the same night shift checks the shelves (plain code)
    from agents.restock import check_restock
    restock = check_restock()
    report["restock_low_count"] = len(restock["low"])
    report["restock_proposed"] = restock["proposed"]

    report["wall_ms"] = int((time.monotonic() - t0) * 1000)

    summary = store.payments_summary()
    report["statement"] = summary
    # persist for the morning digest ("owner" is the digest's mailbox)
    restock_line = (f" Restock proposal drafted for {report['restock_low_count']} "
                    f"low product(s)." if report["restock_proposed"] else "")
    store.add_message("owner", "out",
                      f"Nightly reconciliation: {report['exact_matched']} settled "
                      f"deterministically ({report['settle_rate']:.1%}), "
                      f"{report['fuzzy_proposals']} fuzzy proposal(s) awaiting your "
                      f"approval, {report['residue_end']} unmatched. "
                      f"LLM cost: ${report['cost_usd']:.4f}.{restock_line}",
                      channel="system", meta=report)
    return report
