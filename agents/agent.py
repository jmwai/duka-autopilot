"""ADK eval and inspector entrypoint.

`adk eval agents` and `adk web agents` look for a module named ``agent`` that
exposes ``root_agent``. Importing this module never seeds or mutates business
data; ``python -m agents.seed`` is the explicit local/demo seed operation.
"""
from __future__ import annotations

from agents.graph import autopilot_workflow

root_agent = autopilot_workflow
