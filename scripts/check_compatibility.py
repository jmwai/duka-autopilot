"""Fail CI when durable ADK compatibility inputs change without review."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.compatibility import topology_contract, topology_fingerprint


def main(manifest_path: Path) -> int:
    manifest = json.loads(manifest_path.read_text())
    actual_fingerprint = topology_fingerprint()
    if manifest.get("fingerprint") == actual_fingerprint:
        print(f"durable topology compatible: {actual_fingerprint}")
        return 0
    print("durable topology changed; do not deploy over suspended invocations")
    print(f"expected: {manifest.get('fingerprint')}")
    print(f"actual:   {actual_fingerprint}")
    print("actual contract:")
    print(json.dumps(topology_contract(), indent=2, sort_keys=True))
    print("Drain/migrate suspended approvals, review the change, then update the manifest.")
    return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest", type=Path,
        default=Path(__file__).resolve().parent.parent
        / "deployment" / "compatibility.json")
    args = parser.parse_args()
    raise SystemExit(main(args.manifest))
