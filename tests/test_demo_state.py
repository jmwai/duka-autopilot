"""Deterministic judging state: meaningful, bilingual, and idempotent."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def fresh_store(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    monkeypatch.setenv("DUKA_ENV", "local")
    monkeypatch.setenv("RELEASE_SHA", "judge-seed-test")


@pytest.mark.asyncio
async def test_judge_state_is_meaningful_bilingual_and_idempotent():
    from agents.demo_state import prepare_judge_state
    from agents.store import get_store

    result = await prepare_judge_state(
        rows=1_000,
        synthetic_seed=31,
        execution_surface="test_seed",
    )
    assert result["prepared"] is True
    assert result["nightly"]["execution_surface"] == "test_seed"
    assert result["nightly"]["exact_matched"] == (
        result["synthetic_month"]["clean"] + 2)
    assert result["nightly"]["settle_rate"] > 0.95
    assert result["nightly"]["model_calls"] == 0
    assert result["nightly"]["cost_usd"] == 0
    assert result["ledger"] == {
        "recorded": 2,
        "gated": 1,
        "order_ids": result["ledger"]["order_ids"],
        "approval_ids": result["ledger"]["approval_ids"],
    }
    assert len(result["ledger"]["order_ids"]) == 2
    assert len(result["ledger"]["approval_ids"]) == 1
    assert result["approvals"] == {
        "ledger_row": 1,
        "low_confidence_order": 1,
        "restock_proposal": 1,
    }
    assert result["digest"]["approvals_pending"] == 3
    assert result["digest"]["paid_last_24h"] >= 2
    assert result["digest"]["revenue_paid_last_24h"] >= 920

    store = get_store()
    swahili = store.messages_for("254711000001")
    english = store.messages_for("254711000008")
    assert any(message["meta"].get("language") == "sw-KE" for message in swahili)
    assert any(message["meta"].get("language") == "en-KE" for message in english)
    assert all(
        message["meta"].get("synthetic_seed") is True
        for message in swahili + english
    )

    counts_before = {
        "orders": len(store.list_orders(limit=2_000)),
        "approvals": len(store.pending_approvals()),
        "payments": store.payments_summary()["total"],
    }
    replay = await prepare_judge_state(rows=1_000, synthetic_seed=31)
    assert replay["prepared"] is False
    assert {
        "orders": len(store.list_orders(limit=2_000)),
        "approvals": len(store.pending_approvals()),
        "payments": store.payments_summary()["total"],
    } == counts_before


@pytest.mark.asyncio
async def test_judge_job_profile_uses_the_same_explicit_seed_boundary():
    from app.jobs import run

    result = await run(
        "seed",
        fuzzy=False,
        seed_profile="judge",
        seed_rows=1_000,
    )
    assert result["ok"] is True
    assert result["action"] == "seed"
    assert result["result"]["prepared"] is True
    assert result["result"]["approvals"] == {
        "ledger_row": 1,
        "low_confidence_order": 1,
        "restock_proposal": 1,
    }
    assert result["memory_prepared"] is True


@pytest.mark.asyncio
async def test_judge_state_rejects_unreviewed_scale():
    from agents.demo_state import prepare_judge_state

    with pytest.raises(ValueError, match="between 1,000 and 50,000"):
        await prepare_judge_state(rows=999)
    with pytest.raises(ValueError, match="between 1,000 and 50,000"):
        await prepare_judge_state(rows=50_001)
