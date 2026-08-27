"""Cloud Run Job entrypoints for nightly work, memory retry, and demo seed."""
from __future__ import annotations

import argparse
import asyncio
import json

from app.observability import (
    bind_context,
    configure_observability,
    shutdown_observability,
    tracer,
)


async def run(action: str, fuzzy: bool) -> dict:
    from agents.store import get_store

    store = get_store()
    store.init()
    if action == "seed":
        from agents.seed import DEMO_MEMORY_CUSTOMER_ID, seed
        from app.runner import _ingest_order_summary
        result = seed(force=False)
        memory_prepared = await _ingest_order_summary(DEMO_MEMORY_CUSTOMER_ID)
        if not memory_prepared:
            raise RuntimeError("demo memory source order is unavailable")
        return {"ok": True, "action": "seed", "result": result,
                "memory_prepared": True}
    if action == "memory":
        from app.runner import drain_memory_outbox
        return {"ok": True, "action": "memory",
                **await drain_memory_outbox(limit=100)}
    if action == "digest":
        from agents.digest import morning_digest
        return {"ok": True, "action": "digest",
                "result": morning_digest(persist=True)}
    if action == "nightly":
        from agents.nightly import run_nightly
        from agents.restock import check_restock
        report = await run_nightly(
            fuzzy=fuzzy, execution_surface="cloud_run_job")
        memory = {"completed": 0, "failed": 0}
        try:
            from app.runner import drain_memory_outbox
            memory = await drain_memory_outbox(limit=100)
        except Exception as exc:
            memory = {"completed": 0, "failed": 1,
                      "error_type": exc.__class__.__name__}
        return {"ok": True, "action": "nightly", "report": report,
                "restock": check_restock(), "memory": memory}
    raise ValueError(f"unknown action: {action}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action", choices=("nightly", "memory", "digest", "seed"),
        nargs="?", default="nightly")
    parser.add_argument("--no-fuzzy", action="store_true")
    args = parser.parse_args()
    configure_observability("job")
    try:
        with bind_context(job_action=args.action):
            with tracer().start_as_current_span(
                    f"duka.job.{args.action}") as span:
                span.set_attribute("duka.job.action", args.action)
                result = asyncio.run(run(args.action, not args.no_fuzzy))
        print(json.dumps(result, sort_keys=True, default=str))
    finally:
        shutdown_observability()


if __name__ == "__main__":
    main()
