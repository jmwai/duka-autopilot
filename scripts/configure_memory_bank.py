"""Render or approval-gated apply Duka's Memory Bank customization.

Terraform creates and protects the context resource but the Google provider
does not yet expose Memory Bank customization configs. This script fills that
gap through the official Vertex AI SDK. Rendering is the default and performs
no network call; ``--apply`` mutates the named context and requires the same
explicit cloud approval as a Terraform apply.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.memory_config import build_memory_bank_config, validate_memory_bank_config


def resource_name(project: str, location: str, context_id: str) -> str:
    if context_id.startswith("projects/"):
        expected = f"projects/{project}/locations/{location}/reasoningEngines/"
        if not context_id.startswith(expected):
            raise ValueError("context resource does not match project/location")
        return context_id
    if not context_id or "/" in context_id:
        raise ValueError("context ID must be a short ID or full resource name")
    return f"projects/{project}/locations/{location}/reasoningEngines/{context_id}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--location", default="global")
    parser.add_argument("--context-id", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.project:
        parser.error("--project or GOOGLE_CLOUD_PROJECT is required")

    name = resource_name(args.project, args.location, args.context_id)
    memory_config = build_memory_bank_config(args.project, args.location)
    validate_memory_bank_config(memory_config)
    payload = {
        "name": name,
        "config": {"context_spec": {"memory_bank_config": memory_config}},
    }
    if not args.apply:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return

    import vertexai

    client = vertexai.Client(project=args.project, location=args.location)
    updated = client.agent_engines.update(**payload)
    print(json.dumps({
        "applied": True,
        "resource": updated.api_resource.name,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
