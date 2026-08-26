"""Small signed-session boundary for the judge-facing demo application."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import HTTPException, Request, Response

OWNER_COOKIE = "duka_owner_session"
OWNER_SESSION_SECONDS = 8 * 60 * 60


def cloud_mode() -> bool:
    return os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod")


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _session_secret() -> str:
    secret = os.environ.get("DUKA_SESSION_SECRET", "")
    if not secret:
        raise RuntimeError("DUKA_SESSION_SECRET is required in cloud mode")
    return secret


def create_owner_token(now: int | None = None) -> str:
    issued = int(time.time()) if now is None else now
    payload = _b64encode(json.dumps(
        {"role": "owner", "iat": issued, "exp": issued + OWNER_SESSION_SECONDS},
        sort_keys=True, separators=(",", ":")).encode())
    signature = hmac.new(
        _session_secret().encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64encode(signature)}"


def verify_owner_token(token: str, now: int | None = None) -> bool:
    try:
        payload, supplied = token.split(".", 1)
        expected = hmac.new(
            _session_secret().encode(), payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64decode(supplied), expected):
            return False
        claims = json.loads(_b64decode(payload))
        current = int(time.time()) if now is None else now
        return claims.get("role") == "owner" and current < int(claims.get("exp", 0))
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return False


def set_owner_cookie(response: Response) -> None:
    response.set_cookie(
        OWNER_COOKIE,
        create_owner_token(),
        max_age=OWNER_SESSION_SECONDS,
        httponly=True,
        secure=cloud_mode(),
        samesite="strict",
        path="/",
    )


def clear_owner_cookie(response: Response) -> None:
    response.delete_cookie(OWNER_COOKIE, path="/", samesite="strict")


def owner_authenticated(request: Request) -> bool:
    if not cloud_mode():
        return True
    token = request.cookies.get(OWNER_COOKIE, "")
    return bool(token and verify_owner_token(token))


def require_owner(request: Request) -> None:
    if not owner_authenticated(request):
        raise HTTPException(status_code=401, detail="owner authentication required")


def require_channel(request: Request) -> None:
    """Authorize a trusted inbound bridge or an authenticated owner session."""
    if not cloud_mode() or owner_authenticated(request):
        return
    expected = os.environ.get("DUKA_CHANNEL_KEY", "")
    supplied = request.headers.get("X-Duka-Channel-Key", "")
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="channel authentication required")
