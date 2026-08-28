"""The nightly reconciliation run - what Cloud Scheduler fires at 2am.

Shape of the run (and of the whole thesis):

  1. exact pass    - plain code, indexed, settles ~97% of the month in seconds
  2. fuzzy batches - the residue goes through the SAME workflow graph the
                     owner would trigger by chat, RESIDUE_BATCH rows per
                     invocation, until the residue stops shrinking. Every
                     proposal lands in the approval queue; nothing is paid.
  3. report        - counts + measured cost (from the cost log delta),
                     persisted as a system message for the morning digest.

The LLM only ever sees step 2. The release economics report records the real
cloud cost for that bounded residue; no cost headline is published before the
measurement exists.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from uuid import uuid4

from agents.recon_engine import run_exact_pass
from agents.store import get_store

MAX_FUZZY_BATCHES = 40  # hard ceiling per night; leftovers wait for the owner
MAX_REPORTED_PROPOSALS = 12  # the report is a receipt, not the approvals queue


def _describe_proposal(store, approval: dict) -> dict:
    """Flatten one queued proposal into something an owner can read.

    The approval payload holds ids; the amounts and names that make the
    model's reasoning checkable live on the payment and the order.
    """
    payload = approval.get("payload") or {}
    payment = store.get_payment(payload.get("payment_id")) or {}
    order = store.get_order(payload.get("order_id")) or {}
    customer_id = str(order.get("customer_id") or "")
    # an empty document id is a hard error on Firestore, not a miss
    customer = (store.get_customer(customer_id) or {}) if customer_id else {}
    return {
        "approval_id": str(approval.get("id", "")),
        "payment_id": str(payload.get("payment_id", "")),
        "order_id": str(payload.get("order_id", "")),
        "confidence": float(payload.get("confidence") or 0.0),
        "rationale": str(payload.get("rationale") or ""),
        "payment_ref": str(payment.get("ref") or ""),
        "payer_name": str(payment.get("payer_name") or ""),
        "payment_amount": int(payment.get("amount") or 0),
        "order_total": int(order.get("total") or 0),
        "customer_name": str(customer.get("name") or order.get("customer_id") or ""),
    }


def _fuzzy_approval_ids(store) -> set[str]:
    return {str(a["id"]) for a in store.pending_approvals()
            if a["kind"] == "fuzzy_match"}


def _recon_usage(store) -> dict:
    per = store.cost_summary()["per_interaction"]
    row = next((r for r in per if r["interaction"] == "recon"), None)
    return {
        "calls": int(row.get("n") or 0) if row else 0,
        "input_tokens": int(row.get("input_tokens") or 0) if row else 0,
        "output_tokens": int(row.get("output_tokens") or 0) if row else 0,
        "cost_usd": float(row.get("total_cost_usd") or 0) if row else 0.0,
    }


async def run_nightly(fuzzy: bool = True,
                      execution_surface: str = "library",
                      max_batches: int | None = None) -> dict:
    """Run the whole nightly pipeline; returns the report dict.

    max_batches lets a caller that answers inside a request timeout - the
    console button - take a few batches and stop, leaving the rest for the
    next run. The scheduled Job passes nothing and gets the full ceiling.
    """
    store = get_store()
    batch_limit = (MAX_FUZZY_BATCHES if max_batches is None
                   else max(1, min(int(max_batches), MAX_FUZZY_BATCHES)))
    t0 = time.monotonic()
    started_at = datetime.now(timezone.utc)
    usage_before = _recon_usage(store)

    exact = run_exact_pass(store)
    report = {
        "schema_version": 1,
        "run_id": uuid4().hex,
        "status": "completed",
        "started_at": started_at.isoformat(),
        "execution_surface": execution_surface,
        "release_sha": os.environ.get("RELEASE_SHA", "local"),
        "model": os.environ.get("GEMINI_MODEL", "gemini-3.7-flash"),
        "model_location": os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
        "fuzzy_enabled": fuzzy,
        "total_considered": exact["total_considered"],
        "exact_matched": exact["matched"],
        "settle_rate": round(exact["settle_rate"], 4),
        "exact_wall_ms": exact["wall_ms"],
        "residue_start": exact["residue_count"],
        "fuzzy_batches": 0,
        "fuzzy_proposals": 0,
        "fuzzy_batch_trace": [],
        "fuzzy_proposal_sample": [],
        "fuzzy_batch_limit": batch_limit,
        "fuzzy_stop_reason": "not_entered" if fuzzy else "disabled",
    }

    if fuzzy and exact["residue_count"]:
        # Each turn re-enters the graph on the recon route: exact pass is a
        # cheap no-op re-check, the fuzzy node gets the next residue batch.
        from app.runner import run_turn
        seen_ids = _fuzzy_approval_ids(store)
        proposals: list[dict] = []
        last_remaining = None
        report["fuzzy_stop_reason"] = ("batch_ceiling"
                                       if batch_limit == MAX_FUZZY_BATCHES
                                       else "batch_limit")
        for _ in range(batch_limit):
            remaining = len(store.unmatched_payments())
            if remaining == 0:
                report["fuzzy_stop_reason"] = "residue_cleared"
                break
            if remaining == last_remaining:
                # the model proposed nothing new - stop burning tokens
                report["fuzzy_stop_reason"] = "no_progress"
                break
            last_remaining = remaining
            turn = await run_turn(
                "owner", "Reconcile the M-Pesa statement residue now.",
                actor_role="owner")
            report["fuzzy_batches"] += 1

            fresh = [a for a in store.pending_approvals()
                     if a["kind"] == "fuzzy_match" and str(a["id"]) not in seen_ids]
            seen_ids.update(str(a["id"]) for a in fresh)
            proposals.extend(_describe_proposal(store, a) for a in fresh)
            report["fuzzy_proposals"] += len(fresh)
            report["fuzzy_batch_trace"].append({
                "batch": report["fuzzy_batches"],
                "residue_before": remaining,
                "residue_after": len(store.unmatched_payments()),
                "proposed": len(fresh),
                "node_path": list(getattr(turn, "node_path", []) or []),
                "input_tokens": int(getattr(turn, "input_tokens", 0) or 0),
                "output_tokens": int(getattr(turn, "output_tokens", 0) or 0),
                "cost_usd": round(float(getattr(turn, "cost_usd", 0.0) or 0.0), 6),
                "wall_ms": int(getattr(turn, "wall_ms", 0) or 0),
            })
        report["fuzzy_proposal_sample"] = proposals[:MAX_REPORTED_PROPOSALS]

    report["residue_end"] = len(store.unmatched_payments())
    usage_after = _recon_usage(store)
    report["model_calls"] = usage_after["calls"] - usage_before["calls"]
    report["model_input_tokens"] = (
        usage_after["input_tokens"] - usage_before["input_tokens"])
    report["model_output_tokens"] = (
        usage_after["output_tokens"] - usage_before["output_tokens"])
    report["cost_usd"] = round(
        usage_after["cost_usd"] - usage_before["cost_usd"], 6)

    # proactive restock: the same night shift checks the shelves (plain code)
    from agents.restock import check_restock
    restock = check_restock()
    report["restock_low_count"] = len(restock["low"])
    report["restock_proposed"] = restock["proposed"]

    report["wall_ms"] = int((time.monotonic() - t0) * 1000)
    report["finished_at"] = datetime.now(timezone.utc).isoformat()

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
                      f"Gemini cost: ${report['cost_usd']:.4f}.{restock_line}",
                      channel="system", meta=report)
    return report
