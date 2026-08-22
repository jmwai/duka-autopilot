"""Eval/inspector/engine entrypoint. `adk eval agents`, `adk web agents` and
the deployed Agent Engine all look for a module named `agent` exposing
`root_agent` - that's the graph.

On Agent Engine the container has no app/ layer and no pre-seeded store, so
this module seeds an ephemeral demo store on import (no-op locally where the
FastAPI startup already seeded, or wherever DUKA_DB points at seeded data).
The cloud deployment flips DUKA_STORE=firestore instead.
"""
from __future__ import annotations

import os

os.environ.setdefault("DUKA_DB", "/tmp/duka.db")

from agents.seed import seed  # noqa: E402

seed()  # no-op if already seeded

from agents.graph import autopilot_workflow  # noqa: E402

root_agent = autopilot_workflow
