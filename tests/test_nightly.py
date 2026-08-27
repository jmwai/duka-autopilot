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
