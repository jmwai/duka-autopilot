"""EventBus seam - how inbound events reach the agents asynchronously.

The channel API never runs an agent inline for webhook traffic: it publishes
an event and returns immediately (event-driven workflow with autonomous
routing - the Taskmaster shape). Two backends behind one interface:

  LocalBus  (default) - in-process asyncio dispatch. Same handler code,
              no infra, deterministic to test (`await wait_idle()`).
  PubSubBus - google-cloud-pubsub publisher. In the cloud, the topic's PUSH
              subscription delivers each event as an HTTP POST to
              /pubsub/push on the worker (Cloud Run), which calls the SAME
              handler. The bus is the only thing that changes between local
              and cloud - the seam mirrors the Store seam.

DUKA_BUS=local (default) | pubsub
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Awaitable, Callable

Handler = Callable[[dict], Awaitable[dict]]

_handlers: dict[str, Handler] = {}


def subscribe(topic: str, handler: Handler) -> None:
    """Register the coroutine that consumes a topic (worker startup)."""
    _handlers[topic] = handler


def get_handler(topic: str) -> Handler:
    if topic not in _handlers:
        raise KeyError(f"no handler subscribed for topic '{topic}'")
    return _handlers[topic]


class LocalBus:
    """In-process dispatch: publish schedules the handler and returns."""

    def __init__(self) -> None:
        self._pending: set[asyncio.Task] = set()

    async def publish(self, topic: str, payload: dict) -> None:
        task = asyncio.create_task(get_handler(topic)(payload))
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def wait_idle(self) -> None:
        """Drain in-flight events - used by tests and graceful shutdown."""
        while self._pending:
            await asyncio.gather(*list(self._pending), return_exceptions=True)


class PubSubBus:
    """Publish to a Pub/Sub topic; delivery happens via /pubsub/push."""

    def __init__(self) -> None:
        from google.cloud import pubsub_v1
        self._client = pubsub_v1.PublisherClient(
            publisher_options=pubsub_v1.types.PublisherOptions(
                enable_message_ordering=True))
        self._project = os.environ["GOOGLE_CLOUD_PROJECT"]

    async def publish(self, topic: str, payload: dict) -> None:
        topic_path = self._client.topic_path(
            self._project, os.environ.get("PUBSUB_TOPIC_PREFIX", "duka-") + topic)
        data = json.dumps(payload).encode()
        attributes = ({"event_id": str(payload["event_id"])}
                      if payload.get("event_id") else {})
        from app.observability import inject_context, tracer
        inject_context(attributes)
        ordering_key = str(payload.get("customer_id") or payload.get("event_id") or "")
        with tracer().start_as_current_span("duka.pubsub.publish") as span:
            span.set_attribute("messaging.system", "gcp_pubsub")
            span.set_attribute("messaging.destination.name", topic)
            future = self._client.publish(
                topic_path, data, ordering_key=ordering_key, **attributes)
            try:
                await asyncio.to_thread(future.result)  # surface publish errors
            except Exception:
                if ordering_key:
                    self._client.resume_publish(topic_path, ordering_key)
                raise

    async def wait_idle(self) -> None:  # delivery is Pub/Sub's job in cloud mode
        return None


_bus = None


def get_bus():
    global _bus
    if _bus is None:
        _bus = PubSubBus() if os.environ.get("DUKA_BUS", "local") == "pubsub" else LocalBus()
    return _bus


def reset_bus() -> None:
    """Testing hook: drop the cached bus so env changes take effect."""
    global _bus
    _bus = None
