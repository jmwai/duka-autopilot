"""Small dependency-free HTTP abuse boundary for every Cloud Run surface."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

ASGIApp = Callable[[dict, Callable[[], Awaitable[dict]],
                    Callable[[dict], Awaitable[None]]], Awaitable[None]]

DEFAULT_MAX_REQUEST_BYTES = 8_500_000
_BODY_METHODS = {"POST", "PUT", "PATCH"}
_DEFAULT_POLICIES = {
    "/auth/login": (10, 60),
    "/chat": (60, 60),
    "/inbound": (120, 60),
    "/pubsub/push": (240, 60),
}


class _SlidingWindow:
    def __init__(self) -> None:
        self._events: dict[tuple[str, str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: tuple[str, str, str], limit: int,
              window_seconds: int, now: float | None = None) -> tuple[bool, int]:
        current = time.monotonic() if now is None else now
        cutoff = current - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(window_seconds - (current - events[0])) + 1)
                return False, retry_after
            events.append(current)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


_windows = _SlidingWindow()


def reset_request_limits() -> None:
    """Clear process-local counters for isolated tests and local rehearsals."""
    _windows.reset()


def _positive_int(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


def _client_key(scope: dict) -> str:
    # Never retain/log a raw address. Cloud Run also supplies an upstream IAM
    # boundary; this process-local limiter is defense in depth, not identity.
    client = scope.get("client") or ("unknown", 0)
    return hashlib.sha256(str(client[0]).encode()).hexdigest()[:20]


async def _json_response(send: Callable[[dict], Awaitable[None]], status: int,
                         body: dict, headers: list[tuple[bytes, bytes]] | None = None) -> None:
    encoded = json.dumps(body, separators=(",", ":")).encode()
    response_headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(encoded)).encode()),
        (b"cache-control", b"no-store"),
    ]
    response_headers.extend(headers or [])
    await send({"type": "http.response.start", "status": status,
                "headers": response_headers})
    await send({"type": "http.response.body", "body": encoded})


class RequestSecurityMiddleware:
    """Enforce total body size and bounded request rates before parsing JSON.

    Counters are intentionally per instance: Cloud Run IAM, max instances, and
    max concurrency are the outer controls. This layer limits accidental or
    abusive bursts reaching model/business code without persisting IP data.
    """

    def __init__(self, app: ASGIApp, role: str) -> None:
        self.app = app
        self.role = role

    async def __call__(self, scope: dict, receive: Callable[[], Awaitable[dict]],
                       send: Callable[[dict], Awaitable[None]]) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        policy = _DEFAULT_POLICIES.get(path)
        if policy:
            limit = _positive_int(
                "DUKA_RATE_LIMIT_" + path.strip("/").replace("/", "_").upper(),
                policy[0],
            )
            allowed, retry_after = _windows.allow(
                (self.role, path, _client_key(scope)), limit, policy[1])
            if not allowed:
                await _json_response(
                    send, 429, {"error": "request rate limit exceeded"},
                    [(b"retry-after", str(retry_after).encode())],
                )
                return

        if scope.get("method") not in _BODY_METHODS:
            await self.app(scope, receive, send)
            return

        max_bytes = _positive_int("DUKA_MAX_REQUEST_BYTES", DEFAULT_MAX_REQUEST_BYTES)
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        try:
            content_length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            content_length = 0
        if content_length > max_bytes:
            await _json_response(send, 413, {"error": "request body too large"})
            return

        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message.get("type") == "http.disconnect":
                return
            if message.get("type") != "http.request":
                continue
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > max_bytes:
                await _json_response(send, 413, {"error": "request body too large"})
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        delivered = False

        async def replay() -> dict:
            nonlocal delivered
            if delivered:
                return {"type": "http.request", "body": b"", "more_body": False}
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay, send)
