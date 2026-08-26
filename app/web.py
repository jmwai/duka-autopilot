"""Public Cloud Run frontend and narrow BFF for the private API service."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from app.http_security import RequestSecurityMiddleware
from app.observability import inject_context, instrument_fastapi, tracer

app = FastAPI(title="Duka Autopilot Web")
app.add_middleware(RequestSecurityMiddleware, role="web")
instrument_fastapi(app, "web")
STATIC = Path(__file__).parent / "static"

_ALLOWED: dict[str, tuple[str, ...]] = {
    "GET": (
        "version", "messages/", "customers", "products", "orders",
        "approvals", "recon/report", "digest/morning", "metrics/costs",
    ),
    "POST": (
        "auth/login", "auth/logout", "chat", "inbound", "sessions/new",
        "orders", "approvals/", "ledger", "recon/run", "recon/exact",
        "recon/nightly", "restock/check", "memory/drain",
    ),
}


def _allowed(method: str, path: str) -> bool:
    return any(path == prefix or path.startswith(prefix)
               for prefix in _ALLOWED.get(method, ()))


async def _identity_token(audience: str) -> str:
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token

    return await asyncio.to_thread(
        id_token.fetch_id_token, GoogleRequest(), audience)


async def _proxy(request: Request, path: str) -> Response:
    target = os.environ.get("DUKA_API_URL", "").rstrip("/")
    if not target:
        return JSONResponse(
            {"error": "frontend backend target is not configured"},
            status_code=503)
    headers: dict[str, str] = {}
    for key in ("content-type", "accept", "cookie", "x-request-id"):
        value = request.headers.get(key)
        if value:
            headers[key] = value
    if os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod"):
        headers["authorization"] = f"Bearer {await _identity_token(target)}"
    inject_context(headers)
    route_label = next(
        (prefix for prefix in _ALLOWED.get(request.method, ())
         if path == prefix or path.startswith(prefix)),
        "unknown",
    )
    try:
        with tracer().start_as_current_span("duka.bff.proxy") as span:
            span.set_attribute("duka.bff.route", route_label)
            async with httpx.AsyncClient(timeout=65.0) as client:
                upstream = await client.request(
                    request.method, f"{target}/{path}",
                    params=request.query_params, content=await request.body(),
                    headers=headers)
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        return JSONResponse(
            {"error": "private API unavailable", "type": exc.__class__.__name__},
            status_code=503)
    response_headers = {}
    if upstream.headers.get("set-cookie"):
        response_headers["set-cookie"] = upstream.headers["set-cookie"]
    if upstream.headers.get("content-type"):
        response_headers["content-type"] = upstream.headers["content-type"]
    return Response(
        content=upstream.content, status_code=upstream.status_code,
        headers=response_headers)


@app.get("/health")
@app.get("/healthz")
def health() -> dict:
    return {"ok": True, "role": "web"}


@app.get("/ready")
def ready():
    missing = [
        key for key in ("DUKA_API_URL",)
        if not os.environ.get(key)
    ]
    if os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod"):
        missing.extend(
            key for key in ("GOOGLE_CLOUD_PROJECT", "DUKA_TRACE_ENABLED")
            if not os.environ.get(key))
    if missing:
        return JSONResponse(
            {"ok": False, "missing": missing}, status_code=503)
    return {"ok": True, "role": "web"}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.api_route("/{path:path}", methods=["GET", "POST"])
async def bff(request: Request, path: str):
    if not _allowed(request.method, path):
        return JSONResponse({"error": "route is not exposed by the BFF"},
                            status_code=404)
    return await _proxy(request, path)
