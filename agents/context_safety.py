"""Sanitize durable conversation history before any Gemini request."""
from __future__ import annotations

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest

from agents.screening import screen_text


def _text(content) -> str:
    return " ".join(
        part.text for part in (content.parts or []) if getattr(part, "text", None))


async def sanitize_model_history(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
):
    """Drop blocked prior turns and old inline media from a model request.

    The current user content remains multimodal. Earlier image/audio bytes are
    removed to bound managed Session replay and prevent a blocked historical
    prompt from reaching a later model call.
    """
    del callback_context  # the request already contains the resolved history
    last_user_index = max(
        (index for index, content in enumerate(llm_request.contents)
         if content.role == "user"),
        default=-1,
    )
    sanitized = []
    for index, content in enumerate(llm_request.contents):
        text = _text(content)
        if content.role == "user" and text and not screen_text(text)["ok"]:
            continue
        copied = content.model_copy(deep=True)
        if content.role == "user" and index != last_user_index:
            copied.parts = [
                part for part in (copied.parts or [])
                if not getattr(part, "inline_data", None)
                and not getattr(part, "file_data", None)
            ]
            if not copied.parts:
                continue
        sanitized.append(copied)
    llm_request.contents = sanitized
    return None
