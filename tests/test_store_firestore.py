"""FirestoreStore parity tests - run against the Firestore emulator.

Skipped cleanly when no emulator is up. To run:
    firebase emulators:exec --project demo-duka --only firestore \
        ".venv/bin/python -m pytest tests/test_store_firestore.py -q"
(FIRESTORE_EMULATOR_HOST is set by emulators:exec.)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("FIRESTORE_EMULATOR_HOST"),
    reason="Firestore emulator not running (FIRESTORE_EMULATOR_HOST unset)")


@pytest.fixture(autouse=True)
def firestore_backend(monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "firestore")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "demo-duka")
    from agents.store import get_store
    get_store().reset()
    from agents.seed import seed
    seed(force=True)
    yield


def test_seed_and_reads():
    from agents.store import get_store
    store = get_store()
    assert len(store.products()) == 12
    assert store.get_customer("254711000001")["name"] == "Mama Achieng"
    orders = store.orders_for_customer("254711000001", limit=5)
    assert orders and all(o["customer_id"] == "254711000001" for o in orders)
    assert orders[0]["items"], "items must be embedded in the order doc"


def test_payment_dedup_via_doc_ids():
    from agents.store import get_store
    store = get_store()
    rows = [{"ref": "DUPX000001", "phone": "254700000001", "payer_name": "T",
             "amount": 100, "paid_at": "2026-08-20 10:00:00"}] * 3
    assert store.add_payments(rows) == 1, "create() must reject duplicate refs"


def test_exact_pass_parity_on_demo_seed():
    """Same engine, same demo statement, same 2/6 result as SQLite."""
    from agents.recon_engine import run_exact_pass
    from agents.store import get_store
    stats = run_exact_pass(get_store())
    assert stats["matched"] == 2
    assert stats["residue_count"] == 4
    summary = get_store().payments_summary()
    assert summary["matched_exact"] == 2 and summary["unmatched"] == 4


def test_generator_and_engine_at_small_scale():
    from agents.recon_engine import run_exact_pass
    from agents.store import get_store
    from agents.synth.generate import generate_month
    truth = generate_month(rows=600, seed=11)
    assert truth["rows_inserted"] == truth["rows_generated"] - truth["dup_ref"]
    stats = run_exact_pass(get_store())
    assert stats["matched"] == truth["clean"] + 2
    assert stats["settle_rate"] > 0.9


def test_approvals_and_fuzzy_flow():
    from agents.store import get_store
    store = get_store()
    p = store.unmatched_payments(limit=1)[0]
    o = store.unpaid_orders()[0]
    aid = store.add_approval("fuzzy_match", {"payment_id": p["id"], "order_id": o["id"],
                                             "confidence": 0.9, "rationale": "t"})
    store.mark_payment_kind(p["id"], "fuzzy")
    got = store.get_approval(aid)
    assert got["status"] == "pending" and got["payload"]["order_id"] == o["id"]
    store.stamp_approval(aid, "inv-1", {**got["payload"], "interrupt_id": "i-1"})
    assert store.get_approval(aid)["invocation_id"] == "inv-1"
    store.resolve_approval(aid, "approved")
    store.link_payments([(p["id"], o["id"], "fuzzy")])
    store.set_order_status(o["id"], "paid")
    assert store.get_approval(aid)["status"] == "approved"
    assert all(x["id"] != o["id"] for x in store.unpaid_orders())


def test_messages_roundtrip():
    from agents.store import get_store
    store = get_store()
    store.add_message("254711000001", "in", "habari", channel="chat")
    store.add_message("254711000001", "out", "Karibu!", meta={"cost_usd": 0.001})
    msgs = store.messages_for("254711000001")
    assert [m["direction"] for m in msgs] == ["in", "out"]
    assert msgs[1]["meta"]["cost_usd"] == 0.001
