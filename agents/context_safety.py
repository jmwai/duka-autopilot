"""Sanitize durable conversation history before any Gemini request."""
from __future__ import annotations

import hashlib

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest

from agents.screening import screen_text


def _text(content) -> str:
    return " ".join(
        part.text for part in (content.parts or []) if getattr(part, "text", None))


def _media_signature(content) -> tuple:
    """Identify a content by the media it carries, not by its position."""
    if content is None:
        return ()
    signature = []
    for part in (content.parts or []):
        blob = getattr(part, "inline_data", None)
        if blob is not None and getattr(blob, "data", None):
            signature.append((blob.mime_type, hashlib.sha256(blob.data).hexdigest()))
        elif getattr(part, "file_data", None) is not None:
            signature.append(("file", getattr(part.file_data, "file_uri", "")))
    return tuple(signature)


def _is_real_user_turn(content) -> bool:
    """Distinguish the person's message from ADK's synthetic user contents.

    ADK replays tool results and other agents' replies as role="user" too, so
    position alone cannot identify the turn being answered.
    """
    if content.role != "user":
        return False
    return not any(
        getattr(part, "function_response", None) or getattr(part, "function_call", None)
        for part in (content.parts or []))


def _fallback_turn_index(contents) -> int:
    return max(
        (index for index, content in enumerate(contents)
         if _is_real_user_turn(content)),
        default=-1,
    )


async def sanitize_model_history(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
):
    """Drop blocked prior turns and old inline media from a model request.

    The current user content remains multimodal. Earlier image/audio bytes are
    removed to bound managed Session replay and prevent a blocked historical
    prompt from reaching a later model call.

    The current turn is identified by the invocation's own ``user_content``,
    not by position: ADK appends tool results and "For context:" relays of
    another agent's reply as further role="user" contents, so the newest user
    content is usually not the message being answered. Keying on position
    stripped the ledger photograph from the very request that had to read it.
    """
    current_media = _media_signature(getattr(callback_context, "user_content", None))
    # If the invocation carries media but nothing in the request matches it -
    # a session backend that re-encodes or externalises blobs would do that -
    # fall back to position. Without this, no content is "current", every user
    # turn is stripped, and a voice note or photo with no text is left with no
    # parts at all: the model is asked to answer nothing.
    media_matched = bool(current_media) and any(
        _media_signature(content) == current_media
        for content in llm_request.contents)
    fallback_index = (-1 if media_matched
                      else _fallback_turn_index(llm_request.contents))

    sanitized = []
    for index, content in enumerate(llm_request.contents):
        text = _text(content)
        if content.role == "user" and text and not screen_text(text)["ok"]:
            continue
        copied = content.model_copy(deep=True)
        is_current = (_media_signature(content) == current_media if media_matched
                      else index == fallback_index)
        if content.role == "user" and not is_current:
            copied.parts = [
                part for part in (copied.parts or [])
                if not getattr(part, "inline_data", None)
                and not getattr(part, "file_data", None)
            ]
        # An empty text part is rejected outright by the API, and a content
        # with no parts left is not worth sending either.
        copied.parts = [part for part in (copied.parts or [])
                        if getattr(part, "text", None) != ""]
        if not copied.parts:
            continue
        sanitized.append(copied)

    # Never hand the model an empty request. If sanitizing removed everything,
    # the turn being answered is still the safest thing to send.
    if not sanitized:
        return None
    llm_request.contents = sanitized
    return None
