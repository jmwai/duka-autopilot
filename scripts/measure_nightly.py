"""Measure the economics headline: one nightly run over a full synthetic month.

Needs model access (Vertex AI recommended) for the fuzzy batches; the exact
pass and the report are keyless. Writes docs/economics.md with the measured
numbers - the "50,000 rows for $X" slide comes from here, not from vibes.

Run:  python scripts/measure_nightly.py [--rows 50000] [--no-fuzzy]
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DUKA_DB", "data/measure.db")


async def main(rows: int, fuzzy: bool) -> None:
    from agents.nightly import run_nightly
    from agents.seed import seed
    from agents.synth.generate import generate_month

    seed(force=True)
    truth = generate_month(rows=rows, seed=2026)
    print(f"generated {truth['rows_inserted']} statement rows "
          f"({truth['orders_created']} orders, {truth['customers']} customers)")

    report = await run_nightly(fuzzy=fuzzy)
    for k, v in report.items():
        print(f"{k:>16}: {v}")

    doc = Path(__file__).resolve().parent.parent / "docs" / "economics.md"
    doc.parent.mkdir(exist_ok=True)
    doc.write_text(f"""# Measured economics - nightly reconciliation

One synthetic month, generated with engineered noise (`agents/synth`),
reconciled by `agents/nightly.run_nightly` on `{os.environ.get('GEMINI_MODEL', 'gemini-3.7-flash')}`.

| metric | value |
|---|---|
| statement rows | {truth['rows_inserted']:,} |
| settled deterministically | {report['exact_matched']:,} ({report['settle_rate']:.2%}) |
| exact pass wall time | {report['exact_wall_ms']} ms |
| residue sent to the LLM | {report['residue_start']:,} |
| fuzzy batches run | {report['fuzzy_batches']} |
| fuzzy proposals (to approval queue) | {report['fuzzy_proposals']} |
| still unmatched | {report['residue_end']:,} |
| **measured LLM cost for the month** | **${report['cost_usd']:.4f}** |
| total wall time | {report['wall_ms']/1000:.1f} s |

The LLM never marks anything paid; every proposal waits in the owner's
approval queue. Deterministic first is not a slogan - it is the line item
that keeps this affordable for a duka.
""")
    print(f"\nwrote {doc}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=50_000)
    ap.add_argument("--no-fuzzy", action="store_true",
                    help="keyless: deterministic pass + report only")
    args = ap.parse_args()
    asyncio.run(main(args.rows, fuzzy=not args.no_fuzzy))
