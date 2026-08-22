"""Proactive restock - deterministic, idempotent, human-gated."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    from agents.seed import seed
    seed(force=True)


def test_no_proposal_when_stock_healthy(monkeypatch):
    from agents import restock
    monkeypatch.setattr(restock, "REORDER_POINT", 0)  # nothing is ever "low"
    out = restock.check_restock()
    assert out == {"low": [], "proposed": False, "approval_id": None,
                   "skipped_pending": False}


def test_low_stock_drafts_one_gated_proposal():
    from agents.restock import REORDER_POINT, TARGET_STOCK, check_restock
    out = check_restock()
    # demo seed ships some products at/below the reorder point (by design)
    assert out["proposed"] is True and out["low"]
    props = [a for a in get_store().pending_approvals()
             if a["kind"] == "restock_proposal"]
    assert len(props) == 1
    lines = props[0]["payload"]["lines"]
    assert all(l["stock"] <= REORDER_POINT for l in lines)
    assert all(l["order_qty"] == TARGET_STOCK - l["stock"] for l in lines)
    # nothing changed on the shelf - approval moves goods, not the scan
    skus = {l["sku"] for l in lines}
    for p in get_store().products():
        if p["sku"] in skus:
            assert p["stock"] <= REORDER_POINT


def test_scan_is_idempotent_while_pending():
    from agents.restock import check_restock
    first = check_restock()
    second = check_restock()
    assert second["proposed"] is False and second["skipped_pending"] is True
    assert second["approval_id"] == first["approval_id"]
    props = [a for a in get_store().pending_approvals()
             if a["kind"] == "restock_proposal"]
    assert len(props) == 1, "the owner must never be nagged with duplicates"


async def test_nightly_includes_restock():
    from agents.nightly import run_nightly
    report = await run_nightly(fuzzy=False)
    assert report["restock_proposed"] is True
    assert report["restock_low_count"] > 0
    msgs = get_store().messages_for("owner")
    assert "Restock proposal drafted" in msgs[-1]["text"]
