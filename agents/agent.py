"""Eval/inspector/engine entrypoint. `adk eval agents`, `adk web agents` and
the deployed Agent Engine all look for a module named `agent` exposing
`root_agent` - that's the graph.

Self-seeding is OPT-IN via DUKA_AUTOSEED=1 (the Agent Engine deploy sets it:
that container has no app/ layer and no pre-seeded store, so it seeds an
ephemeral demo store into /tmp on import; a real cloud deployment sets
DUKA_STORE=firestore instead and never needs it). Locally nothing is seeded
by import - `python -m agents.seed` is the one explicit way to seed, and it
must never be pre-empted by an import side effect.
"""
from __future__ import annotations

import os

if os.environ.get("DUKA_AUTOSEED", "").lower() in ("1", "true"):
    os.environ.setdefault("DUKA_DB", "/tmp/duka.db")
    from agents.seed import seed
    seed()  # no-op if already seeded

from agents.graph import autopilot_workflow  # noqa: E402

root_agent = autopilot_workflow
