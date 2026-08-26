"""Observability preserves causal IDs without leaking business payloads."""
from __future__ import annotations

import json
import logging

import pytest

from opentelemetry import trace
from opentelemetry.trace import (
    NonRecordingSpan,
    SpanContext,
    TraceFlags,
    TraceState,
    use_span,
)


def _span() -> NonRecordingSpan:
    return NonRecordingSpan(SpanContext(
        trace_id=0x1234567890ABCDEF1234567890ABCDEF,
        span_id=0x1234567890ABCDEF,
        is_remote=False,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
        trace_state=TraceState(),
    ))


def test_json_log_redacts_ids_blobs_and_correlates_trace(monkeypatch):
    from app.observability import JsonFormatter, bind_context

    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "demo-duka")
    monkeypatch.setenv("DUKA_ENV", "dev")
    monkeypatch.setenv("RELEASE_SHA", "deadbeef")
    monkeypatch.setenv("K_REVISION", "duka-dev-worker-00007")
    record = logging.LogRecord(
        name="duka.test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="customer 254711000001 payload " + "A" * 160,
        args=(), exc_info=None,
    )
    with use_span(_span(), end_on_exit=False), bind_context(
            event_id="evt-1", customer_key="u_safe"):
        payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == (
        "customer [redacted-id] payload [redacted-blob]")
    assert payload["event_id"] == "evt-1"
    assert payload["customer_key"] == "u_safe"
    assert payload["environment"] == "dev"
    assert payload["release_sha"] == "deadbeef"
    assert payload["revision"] == "duka-dev-worker-00007"
    assert payload["logging.googleapis.com/trace"].endswith(
        "/traces/1234567890abcdef1234567890abcdef")
    assert payload["logging.googleapis.com/spanId"] == "1234567890abcdef"


def test_trace_context_round_trips_through_pubsub_attributes():
    from app.observability import extracted_context, inject_context

    attributes: dict[str, str] = {}
    expected = _span().get_span_context()
    with use_span(NonRecordingSpan(expected), end_on_exit=False):
        inject_context(attributes)
    assert attributes["traceparent"].endswith("-01")
    with extracted_context(attributes):
        actual = trace.get_current_span().get_span_context()
        assert actual.trace_id == expected.trace_id
        assert actual.span_id == expected.span_id


def test_request_id_rejects_untrusted_values():
    from app.observability import request_id

    assert request_id("safe-request_1") == "safe-request_1"
    generated = request_id("bad id\nforged")
    assert len(generated) == 32 and generated.isalnum()


@pytest.mark.asyncio
async def test_pubsub_publish_carries_trace_and_customer_ordering(
        monkeypatch):
    from google.cloud import pubsub_v1
    from app.bus import PubSubBus

    published = {}

    class Future:
        def result(self):
            return "message-1"

    class Publisher:
        def __init__(self, publisher_options):
            assert publisher_options.enable_message_ordering is True

        def topic_path(self, project, topic):
            return f"projects/{project}/topics/{topic}"

        def publish(self, topic_path, data, **attributes):
            published.update({
                "topic_path": topic_path,
                "data": data,
                "attributes": attributes,
            })
            return Future()

        def resume_publish(self, topic_path, ordering_key):
            raise AssertionError("successful publish must not resume the key")

    monkeypatch.setattr(pubsub_v1, "PublisherClient", Publisher)
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "demo-duka")
    bus = PubSubBus()
    with use_span(_span(), end_on_exit=False):
        await bus.publish("inbound", {
            "event_id": "evt-traced",
            "customer_id": "opaque-customer",
            "text": "not inspected by this test",
        })
    assert published["topic_path"].endswith("/duka-inbound")
    assert published["attributes"]["event_id"] == "evt-traced"
    assert published["attributes"]["ordering_key"] == "opaque-customer"
    assert published["attributes"]["traceparent"].endswith("-01")
