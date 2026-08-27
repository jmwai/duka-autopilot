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


def _get_text(url: str, timeout: float = 10.0) -> str:
    request = urllib.request.Request(
        url, headers={"User-Agent": "duka-release-smoke/1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned HTTP {response.status}")
        return response.read().decode("utf-8", errors="replace")


def _status(url: str, timeout: float = 10.0) -> int:
    request = urllib.request.Request(
        url, headers={"User-Agent": "duka-release-smoke/1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


def verify(base_url: str, release_sha: str, attempts: int = 12) -> dict:
    base_url = base_url.rstrip("/")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            health = _get_json(f"{base_url}/health")
            ready = _get_json(f"{base_url}/ready")
            web_version = _get_json(f"{base_url}/version")
            api_version = _get_json(f"{base_url}/api/version")
            shell = _get_text(f"{base_url}/")
            denied_status = _status(f"{base_url}/api/pubsub/push")
            if health.get("ok") is not True or ready.get("ok") is not True:
                raise RuntimeError("health or readiness did not report ok=true")
            if web_version.get("release_sha") != release_sha:
                raise RuntimeError(
                    "frontend release SHA mismatch: "
                    f"expected {release_sha}, got {web_version.get('release_sha')}")
            if api_version.get("release_sha") != release_sha:
                raise RuntimeError(
                    "backend release SHA mismatch: "
                    f"expected {release_sha}, got {api_version.get('release_sha')}")
            topology = api_version.get("durable_topology") or {}
            if topology.get("compatible") is not True:
                raise RuntimeError(
                    f"durable topology is incompatible: {topology}")
            if "Duka Autopilot" not in shell:
                raise RuntimeError("public HTML shell does not identify Duka Autopilot")
            if denied_status != 404:
                raise RuntimeError(
                    "BFF exposed a forbidden worker route: "
                    f"expected 404, got {denied_status}")
            return {
                "health": health,
                "ready": ready,
                "web_version": web_version,
                "api_version": api_version,
                "forbidden_route_status": denied_status,
            }
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
