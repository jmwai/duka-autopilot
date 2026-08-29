"""Deterministic, synthetic judging state built through real domain seams.

The small base seed stays suitable for focused tests. This profile adds the
larger statement, a completed exact-only night run, bilingual text history,
fresh sales, and three owner decisions used by the product and Loom rehearsal.
It never calls a model and never generates media.
"""
from __future__ import annotations

from types import SimpleNamespace

from agents.digest import morning_digest
from agents.nightly import run_nightly
from agents.seed import seed
from agents.store import get_store
from agents.synth.generate import DEFAULT_ROWS, generate_month
from agents.tools.ledger import record_ledger_rows
from agents.tools.orders import save_order

DEFAULT_JUDGE_ROWS = DEFAULT_ROWS  # one duka's month, not the scale ceiling
DEFAULT_JUDGE_SEED = 2026

_LEDGER_ROWS = [
    {
        "customer_name": "Mama Achieng",
        "customer_id": "254711000001",
        "description": "unga x2, mafuta x1",
        "amount": 710,
        "paid": True,
        "confidence": 0.98,
        "issue": None,
    },
    {
        "customer_name": "walk-in",
        "customer_id": None,
        "description": "soda x3",
        "amount": 210,
        "paid": True,
        "confidence": 0.96,
        "issue": None,
    },
    {
        "customer_name": "J. Kilonzo",
        "customer_id": None,
        "description": "mayai tray",
        "amount": 0,
        "paid": False,
        "confidence": 0.41,
        "issue": "amount unreadable",
    },
]


def _tool_context(customer_id: str | None = None,
                  source_event_id: str | None = None):
    state = {"actor_role": "owner"}
    if customer_id:
        state["customer_id"] = customer_id
    if source_event_id:
        state["source_event_id"] = source_event_id
    return SimpleNamespace(state=state)


def _safe_order_receipt(result: dict) -> dict:
    return {
        "order_id": str(result["order_id"]),
        "status": str(result["status_detail"]),
        "total": int(result["total"]),
        "needs_review": bool(result["needs_review"]),
    }


def _add_bilingual_history(store, swahili_order: dict,
                           english_order: dict) -> None:
    examples = [
        {
            "customer_id": "254711000001",
            "event_id": "judge-text-sw-usual",
            "language": "sw-KE",
            "request": "Niletee unga mbili na mafuta moja tafadhali.",
            "reply": "Nimeandika unga mbili na mafuta moja kwa bei ya sasa ya katalogi.",
            "order": _safe_order_receipt(swahili_order),
        },
        {
            "customer_id": "254711000008",
            "event_id": "judge-text-en-order",
            "language": "en-KE",
            "request": "Please prepare one bag of Pishori rice and one litre of cooking oil.",
            "reply": "I recorded one Pishori rice and one cooking oil at the current catalog prices.",
            "order": _safe_order_receipt(english_order),
        },
    ]
    for example in examples:
        common_meta = {
            "event_id": example["event_id"],
            "language": example["language"],
            "synthetic_seed": True,
        }
        store.add_message(
            example["customer_id"],
            "in",
            example["request"],
            channel="chat",
            meta=common_meta,
            dedupe_key=f"{example['event_id']}:in",
        )
        store.add_message(
            example["customer_id"],
            "out",
            example["reply"],
            channel="chat",
            meta={**common_meta, "order": example["order"]},
            dedupe_key=f"{example['event_id']}:out",
        )


async def prepare_judge_state(*, force: bool = False,
                              rows: int = DEFAULT_JUDGE_ROWS,
                              synthetic_seed: int = DEFAULT_JUDGE_SEED,
                              execution_surface: str = "seed_job") -> dict:
    """Create one complete, reproducible synthetic judging environment.

    The operation is fail-closed and idempotent: without ``force``, an already
    initialized store is returned untouched. Rows must be large enough to make
    the deterministic-settlement story representative without depending on a
    model.
    """
    if rows < 1_000 or rows > 50_000:
        raise ValueError("judge rows must be between 1,000 and 50,000")

    base = seed(force=force)
    if not base.get("seeded"):
        return {
            "prepared": False,
            "reason": base.get("reason", "store is already initialized"),
            "base": base,
        }

    truth = generate_month(rows=rows, seed=synthetic_seed)
    report = await run_nightly(
        fuzzy=False,
        execution_surface=execution_surface,
    )

    ledger = record_ledger_rows(
        _LEDGER_ROWS,
        page_note="Synthetic judging ledger · reviewed truth",
        tool_context=_tool_context(source_event_id="judge-ledger-page"),
    )
    if ledger.get("recorded") != 2 or ledger.get("gated") != 1:
        raise RuntimeError("judge ledger did not produce the reviewed 2/1 result")

    swahili_order = save_order(
        [{"sku": "UNGA-2KG", "qty": 2}, {"sku": "MAFUTA-1L", "qty": 1}],
        confidence=0.97,
        notes="Synthetic Kiswahili judging example",
        tool_context=_tool_context(
            customer_id="254711000001",
            source_event_id="judge-text-sw-usual",
        ),
    )
    english_order = save_order(
        [{"sku": "RICE-2KG", "qty": 1}, {"sku": "MAFUTA-1L", "qty": 1}],
        confidence=0.98,
        notes="Synthetic English judging example",
        tool_context=_tool_context(
            customer_id="254711000008",
            source_event_id="judge-text-en-order",
        ),
    )
    review_order = save_order(
        [{"sku": "SUKARI-1KG", "qty": 2}],
        confidence=0.62,
        notes="Quantity heard unclearly in a synthetic example",
        tool_context=_tool_context(
            customer_id="254711000005",
            source_event_id="judge-low-confidence-order",
        ),
    )
    for result in (swahili_order, english_order, review_order):
        if result.get("status") != "success":
            raise RuntimeError("judge order could not be grounded")

    store = get_store()
    _add_bilingual_history(store, swahili_order, english_order)
    digest = morning_digest(persist=True)
    approvals = store.pending_approvals()
    approval_kinds: dict[str, int] = {}
    for approval in approvals:
        kind = str(approval["kind"])
        approval_kinds[kind] = approval_kinds.get(kind, 0) + 1
    expected_kinds = {
        "ledger_row": 1,
        "low_confidence_order": 1,
        "restock_proposal": 1,
    }
    if approval_kinds != expected_kinds:
        raise RuntimeError(
            f"judge queue differs from reviewed truth: {approval_kinds}")

    return {
        "prepared": True,
        "base": base,
        "synthetic_month": truth,
        "nightly": report,
        "ledger": {
            "recorded": ledger["recorded"],
            "gated": ledger["gated"],
            "order_ids": [str(value) for value in ledger["order_ids"]],
            "approval_ids": [str(value) for value in ledger["approval_ids"]],
        },
        "orders": {
            "swahili": _safe_order_receipt(swahili_order),
            "english": _safe_order_receipt(english_order),
            "needs_review": _safe_order_receipt(review_order),
        },
        "approvals": approval_kinds,
        "digest": digest["digest"],
    }

