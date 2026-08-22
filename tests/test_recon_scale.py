"""Scale reconciliation: generator ground truth vs engine behavior.

Keyless and deterministic - the whole point of the architecture is that the
part handling 97% of the money never needs an LLM, so it can be tested
exactly. Run: pytest tests/
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from agents.store import get_store

ROWS = 4000  # small month: fast in CI, same code path as 50k


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DUKA_STORE", "sqlite")
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka.db"))
    from agents.seed import seed
    seed(force=True)


def _generate(rows=ROWS, seed=7):
    from agents.synth.generate import generate_month
    return generate_month(rows=rows, seed=seed)


def test_generator_is_deterministic(tmp_path, monkeypatch):
    t1 = _generate()
    monkeypatch.setenv("DUKA_DB", str(tmp_path / "duka2.db"))
    from agents.seed import seed
    seed(force=True)
    t2 = _generate()
    t1.pop("wall_ms"), t2.pop("wall_ms")
    assert t1 == t2, "same seed must produce identical ground truth"


def test_dup_refs_dropped_deterministically():
    truth = _generate()
    assert truth["dups_dropped"] == truth["dup_ref"]
    assert truth["rows_inserted"] == truth["rows_generated"] - truth["dup_ref"]


def test_exact_pass_settles_engineered_majority():
    truth = _generate()
    from agents.recon_engine import run_exact_pass
    stats = run_exact_pass(get_store())

    # Every clean row (and both halves of no split/partial/variant/unknown)
    # must be settled by code alone. The demo seed adds 2 more exact matches
    # and 4 engineered leftovers on top of the synthetic month.
    assert stats["matched"] == truth["clean"] + 2
    expected_residue = (truth["name_variant"] + truth["partial"]
                        + truth["split_rows"] + truth["unknown"] + 4)
    assert stats["residue_count"] == expected_residue

    # the headline number: deterministic settle rate ~97%
    assert stats["settle_rate"] > 0.95
    # and it must be FAST - indexed pass, bulk writeback
    assert stats["wall_ms"] < 10_000


def test_exact_pass_is_idempotent():
    _generate()
    from agents.recon_engine import run_exact_pass
    run_exact_pass(get_store())
    second = run_exact_pass(get_store())
    assert second["matched"] == 0, "second pass must not re-match"


def test_store_summary_agrees_with_engine():
    truth = _generate()
    from agents.recon_engine import run_exact_pass
    stats = run_exact_pass(get_store())
    summary = get_store().payments_summary()
    assert summary["matched_exact"] == stats["matched"]
    assert summary["unmatched"] == stats["residue_count"]
    assert summary["total"] == truth["rows_inserted"] + 6  # + demo statement
