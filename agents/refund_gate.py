"""Graph-native HITL money gate.

The support agent can only REQUEST a refund (tool writes an approvals row and
a state flag). This FunctionNode is what actually stops the workflow:

  1st run   : refund requested -> stamp the approval row with the resume
              handles, return RequestInput -> the workflow SUSPENDS (WAITING).
  owner acts: /approvals/{id} resumes the invocation with a function_response
              carrying the decision (see app/runner.py resume_refund).
  rerun     : rerun_on_resume=True reruns this same function; the decision is
              in ctx.resume_inputs -> emit the customer-facing confirmation.

No broad try/except anywhere near this: swallowing the interrupt machinery
breaks the pause (ground rule).
"""
from __future__ import annotations

from google.adk.agents import Context
from google.adk.events.request_input import RequestInput
from google.adk.workflow import FunctionNode
from google.genai import types

from agents.store import get_store


def _say(text: str) -> types.Content:
    # returning Content (not a bare str) guarantees the text lands in
    # event.content and reaches the chat as the final reply
    return types.Content(role="model", parts=[types.Part.from_text(text=text)])


def gate_refund(ctx: Context):
    """Suspend on a pending refund request; confirm/decline after resume."""
    req = ctx.state.get("refund_request")
    if not req:
        return None  # no money in play this turn - stay out of the way

    store = get_store()
    interrupt_id = f"refund-{req['approval_id']}"
    decision = (ctx.resume_inputs or {}).get(interrupt_id)

    if decision is None:
        # First pass: persist the resume handles so the owner's decision can
        # find its way back to THIS suspended invocation, then suspend.
        pending = store.get_approval(req["approval_id"])
        payload = dict(pending["payload"]) if pending else dict(req)
        payload.update({"interrupt_id": interrupt_id, "session_id": ctx.session.id})
        store.stamp_approval(req["approval_id"], ctx.invocation_id, payload)
        return RequestInput(
            interrupt_id=interrupt_id,
            # customer-visible while the workflow is frozen - keep it warm
            message=f"So sorry for the trouble! Your refund request for order "
                    f"#{req['order_id']} is now with the shop owner for approval - "
                    f"we will confirm right here as soon as they decide.",
        )

    # Resumed: clear the flag, tell the customer the outcome.
    ctx.state["refund_request"] = None
    if (decision or {}).get("decision") == "approved":
        return _say(f"The owner approved the refund proposal for order "
                    f"#{req['order_id']}. The shop will complete it manually "
                    f"and confirm when that is done.")
    return _say(f"The owner reviewed your refund request for order "
                f"#{req['order_id']} and could not approve it. Please contact "
                f"the shop to talk it through.")


refund_gate = FunctionNode(func=gate_refund, name="refund_gate", rerun_on_resume=True)
