"""Nightly pipeline - keyless. The fuzzy stage is exercised with a stubbed
run_turn that behaves like the model (records proposals via the real tool),
so batching, stop conditions, cost accounting and the report are all tested
deterministically."""
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


async def test_nightly_keyless_deterministic_only():
    from agents.nightly import run_nightly
    report = await run_nightly(fuzzy=False)
    assert report["exact_matched"] == 2
    assert report["residue_start"] == 4 and report["residue_end"] == 4
    assert report["fuzzy_batches"] == 0
    assert report["cost_usd"] == 0.0
    assert report["total_considered"] == 6
    assert report["model_calls"] == 0
    assert report["model_input_tokens"] == 0
    assert report["model_output_tokens"] == 0
    assert report["execution_surface"] == "library"
    assert report["status"] == "completed"
    # report persisted for the digest
    msgs = get_store().messages_for("owner")
    assert msgs and msgs[-1]["channel"] == "system"
    assert msgs[-1]["meta"]["exact_matched"] == 2


async def test_nightly_fuzzy_batches_and_stop_condition(monkeypatch):
    """Stub the graph turn: each 'batch' files one fuzzy proposal via the
    real tool, then goes quiet - the loop must stop when residue stops
    shrinking, not run to MAX_FUZZY_BATCHES."""
    from agents.tools.recon import record_fuzzy_match

    calls = {"n": 0}

    async def fake_run_turn(user, text, **kw):
        calls["n"] += 1
        store = get_store()
        if calls["n"] == 1:  # propose a match for one leftover, like the model would
            p = store.unmatched_payments(limit=1)[0]
            o = store.unpaid_orders()[0]
            record_fuzzy_match(p["id"], o["id"], 0.8, "name variant")
        # later batches: model finds nothing new
        class R:  # minimal TurnResult stand-in
            reply, node_path, suspended = "ok", ["exact_recon", "fuzzy_recon"], False
            cost_usd, wall_ms, input_tokens, output_tokens = 0.01, 5, 10, 5
        return R()

    from app import runner
    monkeypatch.setattr(runner, "run_turn", fake_run_turn)
    import agents.nightly as nightly
    monkeypatch.setattr(nightly, "run_turn", fake_run_turn, raising=False)

    report = await nightly.run_nightly(fuzzy=True)
    assert report["fuzzy_proposals"] == 1
    # 1 productive batch + 1 that changed nothing -> stop. Never 40.
    assert report["fuzzy_batches"] == 2
    assert report["residue_end"] == report["residue_start"] - 1
    assert report["fuzzy_stop_reason"] == "no_progress"

    # the trace shows the graph re-entry per batch, and the residue shrinking
    trace = report["fuzzy_batch_trace"]
    assert [b["batch"] for b in trace] == [1, 2]
    assert trace[0]["residue_before"] == 4 and trace[0]["residue_after"] == 3
    assert trace[0]["proposed"] == 1
    assert trace[0]["node_path"] == ["exact_recon", "fuzzy_recon"]
    assert trace[1]["proposed"] == 0

    # the proposal carries the model's own reasoning, resolved to real money
    (proposal,) = report["fuzzy_proposal_sample"]
    assert proposal["rationale"] == "name variant"
    assert proposal["confidence"] == 0.8
    assert proposal["payment_amount"] > 0
    assert proposal["customer_name"]
    assert proposal["approval_id"]


async def test_nightly_stop_reason_when_residue_clears(monkeypatch):
    """Every leftover gets proposed, so the loop stops because it is done."""
    from agents.tools.recon import record_fuzzy_match

    async def fake_run_turn(user, text, **kw):
        store = get_store()
        order = store.unpaid_orders()[0]
        for payment in store.unmatched_payments():
            record_fuzzy_match(payment["id"], order["id"], 0.6, "batch sweep")

        class R:
            reply, node_path, suspended = "ok", ["exact_recon", "fuzzy_recon"], False
            cost_usd, wall_ms, input_tokens, output_tokens = 0.01, 5, 10, 5
        return R()

    from app import runner
    monkeypatch.setattr(runner, "run_turn", fake_run_turn)
    import agents.nightly as nightly

    report = await nightly.run_nightly(fuzzy=True)
    assert report["fuzzy_batches"] == 1
    assert report["fuzzy_stop_reason"] == "residue_cleared"
    assert report["residue_end"] == 0
    assert len(report["fuzzy_proposal_sample"]) == report["fuzzy_proposals"] == 4


async def test_nightly_console_run_stops_at_its_batch_limit(monkeypatch):
    """A caller bound by a request timeout takes a couple of batches and
    leaves the rest; the report says so rather than implying it finished."""
    from agents.tools.recon import record_fuzzy_match

    async def fake_run_turn(user, text, **kw):
        store = get_store()
        payment = store.unmatched_payments(limit=1)[0]
        order = store.unpaid_orders()[0]
        record_fuzzy_match(payment["id"], order["id"], 0.7, "one per batch")

        class R:
            reply, node_path, suspended = "ok", ["exact_recon", "fuzzy_recon"], False
            cost_usd, wall_ms, input_tokens, output_tokens = 0.01, 5, 10, 5
        return R()

    from app import runner
    monkeypatch.setattr(runner, "run_turn", fake_run_turn)
    import agents.nightly as nightly

    report = await nightly.run_nightly(fuzzy=True, max_batches=2)
    assert report["fuzzy_batches"] == 2
    assert report["fuzzy_batch_limit"] == 2
    assert report["fuzzy_stop_reason"] == "batch_limit"
    assert report["residue_end"] == report["residue_start"] - 2 > 0


async def test_nightly_clamps_a_batch_limit_it_cannot_honour(monkeypatch):
    from agents.nightly import MAX_FUZZY_BATCHES, run_nightly

    report = await run_nightly(fuzzy=False, max_batches=10_000)
    assert report["fuzzy_batch_limit"] == MAX_FUZZY_BATCHES
    report = await run_nightly(fuzzy=False, max_batches=0)
    assert report["fuzzy_batch_limit"] == 1


async def test_nightly_keyless_run_reports_no_fuzzy_trace():
    from agents.nightly import run_nightly
    report = await run_nightly(fuzzy=False)
    assert report["fuzzy_stop_reason"] == "disabled"
    assert report["fuzzy_batch_trace"] == []
    assert report["fuzzy_proposal_sample"] == []
