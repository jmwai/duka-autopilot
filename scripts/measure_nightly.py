"""Measure the economics headline: one nightly run over a full synthetic month.

Needs model access (Vertex AI recommended) for the fuzzy batches; the exact
pass and the report are keyless. Writes docs/economics.md with the measured
numbers - the "50,000 rows for $X" slide comes from here, not from vibes.

Run:  python scripts/measure_nightly.py [--rows 50000] [--no-fuzzy]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DUKA_DB", "data/measure.db")


ROOT = Path(__file__).resolve().parent.parent


def _git_state() -> tuple[str, bool]:
    sha = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, check=True,
        capture_output=True, text=True).stdout.strip()
    dirty = bool(subprocess.run(
        ["git", "status", "--porcelain"], cwd=ROOT, check=True,
        capture_output=True, text=True).stdout.strip())
    return sha, dirty


async def main(rows: int, days: int, seed_value: int, fuzzy: bool,
               report_path: Path, raw_path: Path) -> None:
    from agents.nightly import run_nightly
    from agents.seed import seed
    from agents.synth.generate import generate_month

    seed(force=True)
    truth = generate_month(rows=rows, days=days, seed=seed_value)
    print(f"generated {truth['rows_inserted']} statement rows "
          f"({truth['orders_created']} orders, {truth['customers']} customers)")

    report = await run_nightly(fuzzy=fuzzy)
    for k, v in report.items():
        print(f"{k:>16}: {v}")

    sha, dirty = _git_state()
    measured_at = datetime.now(timezone.utc).isoformat()
    evidence = {
        "schema_version": 1,
        "measured_at": measured_at,
        "release_sha": sha,
        "dirty_worktree": dirty,
        "environment": {
            "backend": os.environ.get("DUKA_STORE", "sqlite"),
            "database": os.environ.get("DUKA_DB") if os.environ.get("DUKA_STORE", "sqlite") == "sqlite" else os.environ.get("FIRESTORE_DATABASE"),
            "model": os.environ.get("GEMINI_MODEL", "gemini-3.7-flash"),
            "model_location": os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "configuration": {
            "rows_requested": rows,
            "days": days,
            "seed": seed_value,
            "fuzzy_enabled": fuzzy,
        },
        "generator_truth": truth,
        "nightly_report": report,
    }
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n")

    status = ("local model-backed measurement; cloud reproduction pending"
              if fuzzy else
              "local deterministic baseline; model-backed cloud cost pending")
    model_cost = (f"${report['cost_usd']:.4f}"
                  if fuzzy else "not measured (fuzzy pass disabled)")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(f"""# Measured reconciliation economics

> Status: {status}
> Measured: {measured_at}
> Git SHA: `{sha}` ({'dirty worktree' if dirty else 'clean worktree'})
> Backend: `{evidence['environment']['backend']}` on Python {evidence['environment']['python']}
> Raw evidence: `{raw_path.relative_to(ROOT)}`

One synthetic month, generated with engineered noise (`agents/synth`),
reconciled by `agents/nightly.run_nightly` on `{os.environ.get('GEMINI_MODEL', 'gemini-3.7-flash')}`.
This run is a reproducible engineering baseline, not yet a Cloud Run or
Firestore performance claim. The release headline will be replaced only by a
matching immutable cloud Job artifact.

| metric | value |
|---|---|
| requested synthetic statement rows | {truth['rows_generated']:,} |
| unique synthetic rows inserted | {truth['rows_inserted']:,} |
| duplicate references dropped | {truth['dups_dropped']:,} |
| total rows considered, including 6 demo-seed rows | {report['statement']['total']:,} |
| settled deterministically | {report['exact_matched']:,} ({report['settle_rate']:.2%}) |
| exact pass wall time | {report['exact_wall_ms']} ms |
| residue sent to the LLM | {report['residue_start']:,} |
| fuzzy batches run | {report['fuzzy_batches']} |
| fuzzy proposals (to approval queue) | {report['fuzzy_proposals']} |
| still unmatched | {report['residue_end']:,} |
| measured LLM cost | {model_cost} |
| total wall time | {report['wall_ms']/1000:.1f} s |

When enabled, the LLM may only create proposals; it never marks an uncertain
payment paid. Every fuzzy proposal waits in the owner's approval queue.
""")
    print(f"\nwrote {report_path}")
    print(f"wrote {raw_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=50_000)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--no-fuzzy", action="store_true",
                    help="keyless: deterministic pass + report only")
    ap.add_argument("--report", type=Path, default=ROOT / "docs" / "economics.md")
    ap.add_argument("--raw", type=Path,
                    default=ROOT / "docs" / "evidence" / "benchmark-local.json")
    args = ap.parse_args()
    asyncio.run(main(
        args.rows, args.days, args.seed, fuzzy=not args.no_fuzzy,
        report_path=args.report, raw_path=args.raw))
