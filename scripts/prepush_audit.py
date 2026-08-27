#!/usr/bin/env python3
"""Fail-closed local audit before Duka's first private Git push.

This intentionally uses only Git and the Python standard library so the same
check runs on a clean machine and in GitHub Actions. It scans both the proposed
working tree and every reachable historical patch. It is a high-confidence
credential detector, not a replacement for GitHub secret scanning.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


EXPECTED_REMOTES = {
    "git@github.com:jmwai/duka-autopilot.git",
    "https://github.com/jmwai/duka-autopilot",
    "https://github.com/jmwai/duka-autopilot.git",
}
EXPECTED_BRANCH = "dev"

SECRET_PATTERNS = {
    "google_api_key": re.compile(rb"AIza[0-9A-Za-z_-]{35}"),
    "github_token": re.compile(
        rb"(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})"),
    "aws_access_key": re.compile(rb"(?:AKIA|ASIA)[0-9A-Z]{16}"),
    "private_key": re.compile(
        rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "slack_token": re.compile(rb"xox[baprs]-[0-9A-Za-z-]{20,}"),
    "stripe_live_key": re.compile(rb"sk_live_[0-9A-Za-z]{20,}"),
}

FORBIDDEN_BASENAMES = {
    ".env",
    "application_default_credentials.json",
    "credentials.json",
    "service-account.json",
    "service_account.json",
    "id_rsa",
    "id_ed25519",
}


def _git(*args: str) -> bytes:
    result = subprocess.run(
        ["git", *args], check=False, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(
            f"git {' '.join(args)} failed: "
            f"{result.stderr.decode(errors='replace').strip()}")
    return result.stdout


def _candidate_paths() -> list[str]:
    output = _git(
        "ls-files", "--cached", "--others", "--exclude-standard", "-z")
    return sorted(filter(None, output.decode().split("\0")))


def _push_reachable_paths() -> list[str]:
    paths: list[str] = []
    for line in _git(
            "rev-list", "--objects", "--branches", "--tags").decode().splitlines():
        if " " in line:
            paths.append(line.split(" ", 1)[1])
    return sorted(set(paths))


def _forbidden_path(path: str) -> bool:
    name = Path(path).name.lower()
    return (
        name in FORBIDDEN_BASENAMES
        or (name.startswith(".env.") and name != ".env.example")
        or name.endswith((".pem", ".p12", ".pfx"))
        or (
            name.startswith(("service-account-", "service_account_"))
            and name.endswith(".json")
        )
    )


def _remote_matches(remote: str) -> bool:
    """Accept only the local SSH or GitHub Actions HTTPS spelling."""
    return remote in EXPECTED_REMOTES


def _secret_hits(payload: bytes, source: str) -> list[dict[str, object]]:
    hits: list[dict[str, object]] = []
    for label, pattern in SECRET_PATTERNS.items():
        for match in pattern.finditer(payload):
            line = payload.count(b"\n", 0, match.start()) + 1
            hits.append({"type": label, "source": source, "line": line})
    return hits


def audit() -> dict[str, object]:
    remote = _git("remote", "get-url", "origin").decode().strip()
    branch = _git("branch", "--show-current").decode().strip()
    candidate_paths = _candidate_paths()
    historical_paths = _push_reachable_paths()

    path_hits = sorted({
        path for path in candidate_paths + historical_paths
        if _forbidden_path(path)
    })

    secret_hits: list[dict[str, object]] = []
    for path in candidate_paths:
        try:
            payload = Path(path).read_bytes()
        except (FileNotFoundError, IsADirectoryError):
            continue
        secret_hits.extend(_secret_hits(payload, f"candidate:{path}"))

    historical_patch = _git(
        "log", "--branches", "--tags", "-p", "--format=")
    secret_hits.extend(_secret_hits(
        historical_patch, "branch_or_tag_reachable_git_history"))

    commit_messages = _git(
        "log", "--branches", "--tags", "--format=%B%x00").decode(
        errors="replace")
    forbidden_trailers = sorted({
        trailer
        for trailer in ("Co-Authored-By:", "Claude-Session:")
        if trailer.lower() in commit_messages.lower()
    })

    staged = bool(_git("diff", "--cached", "--name-only").strip())
    unstaged = bool(_git("diff", "--name-only").strip())
    untracked = bool(_git("ls-files", "--others", "--exclude-standard").strip())
    failures: list[str] = []
    if not _remote_matches(remote):
        failures.append("origin does not match the locked private repository")
    if branch != EXPECTED_BRANCH:
        failures.append("current branch is not the locked development branch")
    if path_hits:
        failures.append("forbidden credential-like filenames are reachable")
    if secret_hits:
        failures.append("high-confidence credential material was detected")
    if forbidden_trailers:
        failures.append("removed commit trailers are still reachable")

    return {
        "ok": not failures,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "remote": remote,
        "branch": branch,
        "candidate_file_count": len(candidate_paths),
        "push_reachable_path_count": len(historical_paths),
        "worktree": {
            "staged_changes": staged,
            "unstaged_changes": unstaged,
            "untracked_files": untracked,
        },
        "forbidden_paths": path_hits,
        "secret_hits": secret_hits,
        "forbidden_commit_trailers": forbidden_trailers,
        "failures": failures,
        "notes": [
            "GitHub visibility and remote branch emptiness require a separate "
            "read-only external check immediately before first push.",
            "A dirty worktree is reported but is not itself a failure; push is "
            "forbidden until the candidate is reviewed and committed.",
            "Only branch/tag-reachable history is a normal push surface. Local "
            "backup/original refs are excluded; mirror pushes are forbidden.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = audit()
    except RuntimeError as exc:
        result = {"ok": False, "failures": [str(exc)]}
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(rendered, end="")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
