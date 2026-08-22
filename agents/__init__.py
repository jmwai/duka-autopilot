"""Agents package.

The sys.path shim + conditional `agent` re-export exist for `adk eval
agents ...` and `adk web agents`: the ADK CLI execs this __init__ under the
module name "agent" (not "agents") and without the repo root on sys.path,
then reads `.agent.root_agent`.

The re-export is CONDITIONAL on that CLI context. A normal `import agents`
must not drag in the whole workflow (google.adk and friends) as a side
effect - it made store-only imports heavy, and it broke
`python -m agents.seed` (runpy warns when the module it is about to execute
was already imported as a side effect of the package import).
"""
import os
import sys

_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

if __name__ != "agents":  # ADK CLI execs this file as module "agent"
    from agents import agent  # noqa: E402,F401
