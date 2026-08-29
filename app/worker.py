"""Idempotent inbound worker for local dispatch and authenticated Pub/Sub push."""
from __future__ import annotations

import base64
import hashlib
import json
import logging

from agents.store import get_store

INBOUND_TOPIC = "inbound"
NIGHTLY_TOPIC = "nightly"
# The night shift belongs to the shop, not to a customer. It still needs an
# actor for the event receipt's conflict check and for the publish ordering
# key, which serialises it behind any other owner work already in flight.
NIGHTLY_ACTOR = "owner"
# A batch is a real model call, so the receipt's lease has to outlast a whole
# bounded run rather than the 120s a single customer turn needs.
NIGHTLY_LEASE_SECONDS = 900
MAX_MEDIA_BYTES = 6_000_000
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_AUDIO_MIMES = {"audio/ogg", "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4"}
logger = logging.getLogger(__name__)


class RetryableInboundError(RuntimeError):
    """Signals Pub/Sub to redeliver instead of acknowledging transient work."""


def _payload_hash(payload: dict) -> str:
    canonical = {key: value for key, value in payload.items()
                 if key not in {"pubsub_message_id", "delivery_attempt"}}
    encoded = json.dumps(
        canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def _retryable(exc: Exception) -> bool:
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if callable(status):
        try:
            status = status()
        except Exception:  # status inspection must not mask the real failure
            status = None
    if status in (408, 409, 425, 429, 500, 502, 503, 504):
        return True
    text = str(exc).lower()
    return any(marker in text for marker in (
        "429", "500", "502", "503", "504", "deadline", "timeout",
        "temporarily unavailable", "connection reset",
    ))


def _safe_order_receipt(result: object) -> dict | None:
    """Expose proof of the committed order without leaking customer scope."""
    raw = getattr(result, "order_result", None)
    if not isinstance(raw, dict) or raw.get("status") != "success":
        return None
    order_id = raw.get("order_id")
    total = raw.get("total")
    status = raw.get("status_detail")
    if order_id is None or type(total) is not int or not isinstance(status, str):
        return None
    return {
        "order_id": str(order_id),
        "status": status,
        "total": total,
        "needs_review": raw.get("needs_review") is True,
    }


async def handle_inbound(payload: dict) -> dict:
    """Claim and process one event, producing at most one business result."""
    store = get_store()
    event_id = str(payload.get("event_id") or "").strip()
    customer_id = str(payload.get("customer_id") or "").strip()
    if not event_id or len(event_id) > 200:
        raise ValueError("event_id is required and must be at most 200 characters")
    if not customer_id or len(customer_id) > 100:
        raise ValueError("customer_id is required and must be at most 100 characters")

    claim = store.claim_event(event_id, customer_id, _payload_hash(payload))
    if not claim["claimed"]:
        logger.info("inbound event replayed", extra={"event_id": event_id})
        return {
            "event_id": event_id,
            "duplicate": True,
            "event_status": claim["status"],
            "result": claim.get("result"),
        }

    text = str(payload.get("text", "") or "")
    if len(text) > 4_000:
        store.fail_event(event_id, "text exceeds 4000 characters", retryable=False)
        return {"event_id": event_id, "reply": None,
                "error": "text exceeds 4000 characters", "retryable": False,
                "suspended": False, "node_path": []}
    channel = payload.get("channel") or (
        "voice" if payload.get("audio_b64") else
        "photo" if payload.get("image_b64") else "chat")
    store.add_message(
        customer_id, "in", text or f"[{channel} message]", channel=channel,
        meta={"event_id": event_id}, dedupe_key=f"{event_id}:in")

    try:
        image_mime = payload.get("image_mime", "image/jpeg")
        audio_mime = payload.get("audio_mime", "audio/ogg")
        if payload.get("image_b64") and image_mime not in ALLOWED_IMAGE_MIMES:
            raise ValueError("unsupported image MIME type")
        if payload.get("audio_b64") and audio_mime not in ALLOWED_AUDIO_MIMES:
            raise ValueError("unsupported audio MIME type")
        image = (base64.b64decode(payload["image_b64"], validate=True)
                 if payload.get("image_b64") else None)
        audio = (base64.b64decode(payload["audio_b64"], validate=True)
                 if payload.get("audio_b64") else None)
        if image is not None and len(image) > MAX_MEDIA_BYTES:
            raise ValueError("image exceeds 6 MB decoded limit")
        if audio is not None and len(audio) > MAX_MEDIA_BYTES:
            raise ValueError("audio exceeds 6 MB decoded limit")

        from app import runner  # lazy: tests stub runner.run_turn
        result = await runner.run_turn(
            customer_id, text,
            image_bytes=image, image_mime=image_mime,
            audio_bytes=audio, audio_mime=audio_mime,
            source_event_id=event_id,
        )
    except Exception as exc:
        retryable = _retryable(exc)
        error = f"{exc.__class__.__name__}: {str(exc)[:300]}"
        store.fail_event(event_id, error, retryable=retryable)
        if retryable:
            logger.warning("inbound event retryable failure",
                           extra={"event_id": event_id, "error": error})
            raise RetryableInboundError(error) from exc
        store.add_message(
            customer_id, "out",
            "Samahani! This message could not be processed. Please check it "
            "and send it again. The shop has been notified.",
            channel=channel, meta={"event_id": event_id, "error_type": exc.__class__.__name__},
            dedupe_key=f"{event_id}:error")
        return {"event_id": event_id, "reply": None, "error": error,
                "retryable": False, "suspended": False, "node_path": []}

    order_receipt = _safe_order_receipt(result)
    response = {
        "event_id": event_id,
        "reply": result.reply,
        "suspended": result.suspended,
        "node_path": result.node_path,
        "tokens": {"input": result.input_tokens, "output": result.output_tokens},
        "duplicate": False,
    }
    if order_receipt:
        response["order"] = order_receipt
    message_meta = {
        "event_id": event_id,
        "node_path": result.node_path,
        "suspended": result.suspended,
        "cost_usd": round(result.cost_usd, 6),
        "wall_ms": result.wall_ms,
        "tokens": {"input": result.input_tokens, "output": result.output_tokens},
    }
    if order_receipt:
        message_meta["order"] = order_receipt
    store.add_message(
        customer_id, "out", result.reply, channel=channel,
        meta=message_meta,
        dedupe_key=f"{event_id}:out",
    )
    store.complete_event(event_id, response)
    logger.info(
        "inbound event completed",
        extra={"event_id": event_id,
               "node": result.node_path[-1] if result.node_path else "none"})
    return response


async def handle_nightly(payload: dict) -> dict:
    """Run one night shift off the bus so no HTTP request has to wait for it.

    The API answers 202 with the run id; the owner learns the outcome from
    the event receipt, which is why every exit path below writes one.
    """
    store = get_store()
    run_id = str(payload.get("run_id") or payload.get("event_id") or "").strip()
    if not run_id or len(run_id) > 200:
        raise ValueError("run_id is required and must be at most 200 characters")

    claim = store.claim_event(run_id, NIGHTLY_ACTOR, _payload_hash(payload),
                              lease_seconds=NIGHTLY_LEASE_SECONDS)
    if not claim["claimed"]:
        logger.info("nightly run replayed", extra={"run_id": run_id})
        return {"run_id": run_id, "duplicate": True,
                "event_status": claim["status"], "result": claim.get("result")}

    max_batches = payload.get("max_batches")
    try:
        from agents.nightly import run_nightly
        report = await run_nightly(
            fuzzy=payload.get("fuzzy", True) is not False,
            execution_surface=str(payload.get("execution_surface") or "worker"),
            max_batches=int(max_batches) if max_batches else None,
        )
    except Exception as exc:
        retryable = _retryable(exc)
        error = f"{exc.__class__.__name__}: {str(exc)[:300]}"
        store.fail_event(run_id, error, retryable=retryable)
        if retryable:
            logger.warning("nightly run retryable failure",
                           extra={"run_id": run_id, "error": error})
            raise RetryableInboundError(error) from exc
        logger.error("nightly run failed", extra={"run_id": run_id})
        return {"run_id": run_id, "error": error, "retryable": False}

    response = {"run_id": run_id, "duplicate": False, "report": report}
    store.complete_event(run_id, response)
    logger.info("nightly run completed",
                extra={"run_id": run_id,
                       "fuzzy_proposals": report.get("fuzzy_proposals")})
    return response


def register() -> None:
    from app.bus import subscribe
    subscribe(INBOUND_TOPIC, handle_inbound)
    subscribe(NIGHTLY_TOPIC, handle_nightly)
