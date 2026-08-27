"""Stable fingerprint for managed Sessions and resumable ADK invocations."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
from pathlib import Path

from agents.graph import autopilot_workflow
from app.constants import APP_NAME, USER_KEY_ALGORITHM


def topology_contract() -> dict:
    """Return only identities whose change can invalidate durable context."""
    nodes = sorted((
        {"name": node.name, "rerun_on_resume": bool(node.rerun_on_resume)}
        for node in autopilot_workflow.graph.nodes
    ), key=lambda node: node["name"])
    edges = sorted((
        {"from": edge.from_node.name, "to": edge.to_node.name,
         "route": edge.route}
        for edge in autopilot_workflow.graph.edges
    ), key=lambda edge: (edge["from"], edge["to"], edge["route"] or ""))
    return {
        "schema": 1,
        "app_name": APP_NAME,
        "user_key_algorithm": USER_KEY_ALGORITHM,
        "adk_version": importlib.metadata.version("google-adk"),
        "workflow_name": autopilot_workflow.name,
        "nodes": nodes,
        "edges": edges,
    }


def topology_fingerprint() -> str:
    encoded = json.dumps(
        topology_contract(), sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def manifest_status(path: Path | None = None) -> dict:
    manifest_path = path or (
        Path(__file__).resolve().parent.parent
        / "deployment" / "compatibility.json")
    actual = topology_fingerprint()
    try:
        expected = json.loads(manifest_path.read_text()).get("fingerprint")
    except (OSError, ValueError, TypeError):
        expected = None
    return {
        "compatible": bool(expected) and expected == actual,
        "expected": expected,
        "actual": actual,
    }
