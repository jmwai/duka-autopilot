"""The Duka Autopilot workflow graph.

    START ─▶ screen ──blocked──▶ blocked (polite stop; owner is flagged)
                   └──clean───▶ classifier ─▶ router ──order──▶ intake_agent
                                                    ├─support─▶ support_agent ─▶ refund_gate ⏸
                                                    └─recon──▶ exact_recon ──fuzzy─▶ fuzzy_recon
                                                                           └─done──▶ recon_summary

Every hop is an Edge with an explicit route - drawn, not vibed. The graph
shape is ported (disclosed) from the talk repo; new here: the deterministic
`screen` node - untrusted input is screened BEFORE any LLM sees it, and
flagged traffic never routes. refund_gate is the graph-native HITL pause:
money never moves while the workflow is running; it SUSPENDS and the
owner's decision resumes the same invocation.
"""
from __future__ import annotations

from google.adk.workflow import Edge, RetryConfig, Workflow, START

from agents.coordinator import classifier, router
from agents.intake import intake_agent
from agents.ledger_agent import ledger_agent
from agents.recon_nodes import exact_recon, fuzzy_recon, recon_summary
from agents.refund_gate import refund_gate
from agents.screening import blocked, screen
from agents.support import support_agent

autopilot_workflow = Workflow(
    name="duka_autopilot",
    description="Always-on back office for Duka la Amani: orders, support, reconciliation - humans gate money.",
    retry_config=RetryConfig(max_attempts=3),
    edges=[
        (START, screen),
        Edge(from_node=screen, to_node=classifier, route="clean"),
        Edge(from_node=screen, to_node=blocked, route="blocked"),
        (classifier, router),
        Edge(from_node=router, to_node=intake_agent, route="order"),
        Edge(from_node=router, to_node=support_agent, route="support"),
        Edge(from_node=router, to_node=exact_recon, route="recon"),
        Edge(from_node=router, to_node=ledger_agent, route="ledger"),
        Edge(from_node=exact_recon, to_node=fuzzy_recon, route="fuzzy"),
        Edge(from_node=exact_recon, to_node=recon_summary, route="done"),
        (support_agent, refund_gate),
    ],
)
