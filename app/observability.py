"""PII-safe structured logs and OpenTelemetry trace propagation.

Cloud Run captures JSON written to stdout. In dev/prod, spans are exported
directly to Google Cloud's Telemetry OTLP endpoint with ADC; local mode keeps a
no-op tracer and ordinary logging. Context values are allowlisted and never
include raw customer IDs, prompts, media, credentials, or request bodies.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Iterator, Mapping
from uuid import uuid4

from opentelemetry import propagate, trace
from opentelemetry.context import attach, detach

_context: ContextVar[dict[str, object]] = ContextVar(
    "duka_observability_context", default={})
_configured = False
_trace_provider = None
_service_name = "duka-local"

_ALLOWED_FIELDS = {
    "approval_id",
    "customer_key",
    "delivery_attempt",
    "environment",
    "event_id",
    "invocation_id",
    "job_action",
    "node",
    "pubsub_message_id",
    "release_sha",
    "request_id",
    "revision",
    "session_id",
}
_ID_PATTERN = re.compile(r"(?<![A-Za-z0-9_])(?:\+?254|0)\d{8,12}(?![A-Za-z0-9_])")
_BLOB_PATTERN = re.compile(r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{128,}={0,2}")
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def cloud_mode() -> bool:
    return os.environ.get("DUKA_ENV", "local").lower() in ("dev", "prod")


def _safe_text(value: object, limit: int = 1_000) -> str:
    text = str(value)
    text = _ID_PATTERN.sub("[redacted-id]", text)
    text = _BLOB_PATTERN.sub("[redacted-blob]", text)
    return text[:limit]


def request_id(value: str | None) -> str:
    return value if value and _REQUEST_ID_PATTERN.fullmatch(value) else uuid4().hex


@contextmanager
def bind_context(**fields: object) -> Iterator[None]:
    clean = {
        key: _safe_text(value, 256)
        for key, value in fields.items()
        if key in _ALLOWED_FIELDS and value not in (None, "")
    }
    token = _context.set({**_context.get(), **clean})
    try:
        yield
    finally:
        _context.reset(token)


@contextmanager
def extracted_context(carrier: Mapping[str, str]) -> Iterator[None]:
    """Make W3C context from Pub/Sub/HTTP attributes current for child spans."""
    token = attach(propagate.extract(carrier=dict(carrier)))
    try:
        yield
    finally:
        detach(token)


def inject_context(carrier: dict[str, str]) -> None:
    propagate.inject(carrier=carrier)


class JsonFormatter(logging.Formatter):
    """Cloud Logging JSON with trace correlation and an allowlisted payload."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "environment": os.environ.get("DUKA_ENV", "local").lower(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": record.levelname,
            "message": _safe_text(record.getMessage()),
            "logger": record.name,
            "release_sha": os.environ.get("RELEASE_SHA", "local"),
            "revision": os.environ.get("K_REVISION", "local"),
            "service": _service_name,
        }
        payload.update(_context.get())
        for field in _ALLOWED_FIELDS:
            value = getattr(record, field, None)
            if value not in (None, ""):
                payload[field] = _safe_text(value, 256)

        span_context = trace.get_current_span().get_span_context()
        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        if span_context.is_valid and project:
            trace_id = f"{span_context.trace_id:032x}"
            payload["logging.googleapis.com/trace"] = (
                f"projects/{project}/traces/{trace_id}")
            payload["logging.googleapis.com/spanId"] = (
                f"{span_context.span_id:016x}")
            payload["logging.googleapis.com/trace_sampled"] = (
                bool(span_context.trace_flags.sampled))
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _configure_structured_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)
    for noisy in ("google.auth", "google.api_core", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def configure_observability(role: str) -> None:
    """Configure one process once; cloud configuration fails closed."""
    global _configured, _service_name, _trace_provider
    environment = os.environ.get("DUKA_ENV", "local").lower()
    _service_name = f"duka-{environment}-{role}"
    if _configured or not cloud_mode():
        return
    _configured = True
    _configure_structured_logging()
    if os.environ.get("DUKA_TRACE_ENABLED", "true").lower() != "true":
        logging.getLogger(__name__).warning("trace export explicitly disabled")
        return

    import google.auth
    import google.auth.transport.requests
    import grpc
    from google.auth.transport.grpc import AuthMetadataPlugin
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased

    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        raise RuntimeError("cloud observability requires GOOGLE_CLOUD_PROJECT")
    sample_rate = max(0.0, min(
        1.0, float(os.environ.get("DUKA_TRACE_SAMPLE_RATE", "1.0"))))
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"])
    auth_plugin = AuthMetadataPlugin(
        credentials=credentials,
        request=google.auth.transport.requests.Request(),
    )
    channel_credentials = grpc.composite_channel_credentials(
        grpc.ssl_channel_credentials(),
        grpc.metadata_call_credentials(auth_plugin),
    )
    resource = Resource.create({
        "service.name": _service_name,
        "service.version": os.environ.get("RELEASE_SHA", "unknown"),
        "deployment.environment.name": environment,
        "gcp.project_id": project,
    })
    provider = TracerProvider(
        resource=resource,
        sampler=ParentBased(TraceIdRatioBased(sample_rate)),
    )
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
        credentials=channel_credentials,
        endpoint="https://telemetry.googleapis.com:443/v1/traces",
    )))
    trace.set_tracer_provider(provider)
    _trace_provider = provider
    logging.getLogger(__name__).info("observability configured")


def tracer(name: str = "duka-autopilot"):
    return trace.get_tracer(name)


def shutdown_observability() -> None:
    if _trace_provider is not None:
        _trace_provider.shutdown()


def instrument_fastapi(app, role: str) -> None:
    configure_observability(role)

    @app.middleware("http")
    async def trace_request(request, call_next):
        incoming = request_id(request.headers.get("x-request-id"))
        with extracted_context(request.headers), bind_context(request_id=incoming):
            with tracer().start_as_current_span(
                    f"HTTP {request.method}") as span:
                span.set_attribute("http.request.method", request.method)
                try:
                    response = await call_next(request)
                except Exception as exc:
                    span.record_exception(exc)
                    span.set_attribute("error.type", exc.__class__.__name__)
                    raise
                route = request.scope.get("route")
                route_path = getattr(route, "path", "unmatched")
                span.update_name(f"{request.method} {route_path}")
                span.set_attribute("http.route", route_path)
                span.set_attribute("http.response.status_code", response.status_code)
                response.headers["x-request-id"] = incoming
                return response
