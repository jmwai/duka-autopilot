#!/usr/bin/env python3
"""Fail a release when the public web/BFF and private API disagree."""
from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request


def _get_json(url: str, timeout: float = 10.0) -> dict:
    request = urllib.request.Request(
        url, headers={"User-Agent": "duka-release-smoke/1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned HTTP {response.status}")
        return json.load(response)


def verify(base_url: str, release_sha: str, attempts: int = 12) -> dict:
    base_url = base_url.rstrip("/")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            health = _get_json(f"{base_url}/health")
            ready = _get_json(f"{base_url}/ready")
            version = _get_json(f"{base_url}/version")
            if health.get("ok") is not True or ready.get("ok") is not True:
                raise RuntimeError("health or readiness did not report ok=true")
            if version.get("release_sha") != release_sha:
                raise RuntimeError(
                    "release SHA mismatch: "
                    f"expected {release_sha}, got {version.get('release_sha')}")
            topology = version.get("durable_topology") or {}
            if topology.get("compatible") is not True:
                raise RuntimeError(
                    f"durable topology is incompatible: {topology}")
            return {"health": health, "ready": ready, "version": version}
        except (OSError, ValueError, RuntimeError, urllib.error.HTTPError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(min(5 * attempt, 20))
    raise RuntimeError(f"release smoke failed after {attempts} attempts: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--release-sha", required=True)
    parser.add_argument("--attempts", type=int, default=12)
    args = parser.parse_args()
    print(json.dumps(
        verify(args.url, args.release_sha, args.attempts),
        indent=2,
        sort_keys=True,
    ))


if __name__ == "__main__":
    main()
