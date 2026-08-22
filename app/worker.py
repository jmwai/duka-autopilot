"""Inbound worker - consumes bus events, runs the workflow, logs the reply.

One handler serves both worlds: LocalBus schedules it in-process; in the
cloud, Pub/Sub push POSTs the same payload to /pubsub/push which awaits it.
Every inbound and outbound message is persisted through the Store, so the
conversation survives restarts and the UI just polls /messages/{customer}.
"""
from __future__ import annotations

import base64

from agents.store import get_store

INBOUND_TOPIC = "inbound"


async def handle_inbound(payload: dict) -> dict:
    """payload: {customer_id, text?, image_b64?, image_mime?,
                 audio_b64?, audio_mime?, channel?}"""
    store = get_store()
    customer_id = payload["customer_id"]
    text = payload.get("text", "") or ""
    channel = payload.get("channel") or (
        "voice" if payload.get("audio_b64") else
        "photo" if payload.get("image_b64") else "chat")
    store.add_message(customer_id, "in", text or f"[{channel} message]", channel=channel)

    image = base64.b64decode(payload["image_b64"]) if payload.get("image_b64") else None
    audio = base64.b64decode(payload["audio_b64"]) if payload.get("audio_b64") else None

    from app import runner  # lazy: tests stub runner.run_turn
    try:
        result = await runner.run_turn(
            customer_id, text,
            image_bytes=image, image_mime=payload.get("image_mime", "image/jpeg"),
            audio_bytes=audio, audio_mime=payload.get("audio_mime", "audio/ogg"),
        )
    except Exception as exc:  # noqa: BLE001 - the consumer boundary, NOT a tool body:
        # a failed turn must never strand the customer in silence, and a
        # Pub/Sub push must not become a poison pill redelivering forever.
        # (The no-broad-except rule protects NodeInterruptedError inside the
        # graph; by the time an exception reaches here the turn is over.)
        print(f"[worker] turn failed for {customer_id}: {exc!r}")
        store.add_message(customer_id, "out",
                          "Samahani! Something went wrong on our side - please "
                          "try again in a moment. The shop has been notified.",
                          channel=channel, meta={"error": str(exc)[:300]})
        return {"reply": None, "error": str(exc)[:300], "suspended": False,
                "node_path": []}
    store.add_message(customer_id, "out", result.reply, channel=channel, meta={
        "node_path": result.node_path,
        "suspended": result.suspended,
        "cost_usd": round(result.cost_usd, 6),
        "wall_ms": result.wall_ms,
    })
    return {"reply": result.reply, "suspended": result.suspended,
            "node_path": result.node_path}


def register() -> None:
    from app.bus import subscribe
    subscribe(INBOUND_TOPIC, handle_inbound)
