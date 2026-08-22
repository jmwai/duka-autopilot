"""Agents package.

The sys.path shim + `agent` re-export exist for `adk eval agents ...` and
`adk web agents`: the ADK CLI execs this __init__ under the module name
"agent" (not "agents") and without the repo root on sys.path, then reads
`.agent.root_agent`. Normal app imports are unaffected.
"""
import os
import sys

_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from agents import agent  # noqa: E402,F401
