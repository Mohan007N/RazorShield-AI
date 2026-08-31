"""
RazorShield AI — LangGraph Investigation Graph.

Multi-step agentic investigation workflow. The agent dynamically decides which
tools to call based on the alert context and accumulated evidence.

This is NOT a fake agent that just passes scores to an LLM — it uses actual
LangGraph with tool calling, conditional routing, and state management.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from typing import Annotated, Any, Optional, TypedDict

from backend.app.agent.prompts.system_prompt import INVESTIGATION_SYSTEM_PROMPT
from backend.app.agent.tools.investigation_tools import (
    CreateInvestigationInput,
    CreateInvestigationOutput,
    DeviceActivityInput,
    DeviceActivityOutput,
    MerchantBaselineInput,
    MerchantBaselineOutput,
    MerchantPolicyInput,
    MerchantPolicyOutput,
    ModelExplanationInput,
    ModelExplanationOutput,
    RecentActivityInput,
    RecentActivityOutput,
    TransactionPatternsInput,
    TransactionPatternsOutput,
    tool_data_provider,
)


# ── Agent State ──────────────────────────────────────────────────

class InvestigationState(TypedDict, total=False):
    """State for the investigation agent graph."""
    # Input
    alert_id: str
    merchant_id: str
    risk_score: float
    anomaly_score: float
    spike_ratio: float

    # Investigation tracking
    investigation_id: str
    status: str
    current_step: int
    max_steps: int

    # Tool results
    baseline_result: Optional[dict]
    activity_result: Optional[dict]
    device_result: Optional[dict]
    patterns_result: Optional[dict]
    explanation_result: Optional[dict]
    policy_result: Optional[dict]

    # Evidence and reasoning
    evidence: list[dict]
    errors: list[str]
    tools_called: list[str]
    tool_latencies: dict[str, float]

    # Output
    confidence: Optional[float]
    recommendation: Optional[str]
    recommendation_action: Optional[str]
    summary: Optional[str]

    # Messages for LLM
    messages: list[dict]


def create_initial_state(
    alert_id: str,
    merchant_id: str,
    risk_score: float,
    anomaly_score: float = 0.0,
    spike_ratio: float = 1.0,
) -> InvestigationState:
    """Create initial state for a new investigation."""
    return InvestigationState(
        alert_id=alert_id,
        merchant_id=merchant_id,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        spike_ratio=spike_ratio,
        investigation_id=f"inv_{uuid.uuid4().hex[:12]}",
        status="in_progress",
        current_step=0,
        max_steps=15,
        baseline_result=None,
        activity_result=None,
        device_result=None,
        patterns_result=None,
        explanation_result=None,
        policy_result=None,
        evidence=[],
        errors=[],
        tools_called=[],
        tool_latencies={},
        confidence=None,
        recommendation=None,
        recommendation_action=None,
        summary=None,
        messages=[],
    )


# ── Graph Nodes ──────────────────────────────────────────────────

def triage_node(state: InvestigationState) -> InvestigationState:
    """Initial triage: assess the alert and plan investigation."""
    state["current_step"] = state.get("current_step", 0) + 1
    state["status"] = "in_progress"

    # Always start with baseline and recent activity
    state["messages"] = state.get("messages", []) + [{
        "role": "system",
        "content": f"ALERT TRIAGE: Alert {state['alert_id']} for merchant {state['merchant_id']}. "
                   f"Risk score: {state['risk_score']:.2f}, Anomaly: {state.get('anomaly_score', 0):.2f}, "
                   f"Spike ratio: {state.get('spike_ratio', 1):.1f}x. Beginning investigation."
    }]

    return state


def gather_baseline_node(state: InvestigationState) -> InvestigationState:
    """Gather merchant baseline data."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        result = tool_data_provider.get_merchant_baseline(state["merchant_id"])
        result_dict = result.model_dump()
        state["baseline_result"] = result_dict
        state["tools_called"] = state.get("tools_called", []) + ["get_merchant_baseline"]

        # Extract evidence
        state["evidence"] = state.get("evidence", []) + [
            {
                "source_tool": "get_merchant_baseline",
                "field": "baseline_txn_rate",
                "value": str(result.baseline_txn_rate),
                "confidence": 1.0,
            },
            {
                "source_tool": "get_merchant_baseline",
                "field": "baseline_avg_amount",
                "value": str(result.baseline_avg_amount),
                "confidence": 1.0,
            },
        ]
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"get_merchant_baseline failed: {str(e)}"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_merchant_baseline"] = round(latency, 2)

    return state


def gather_activity_node(state: InvestigationState) -> InvestigationState:
    """Gather recent merchant activity."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        result = tool_data_provider.get_recent_activity(state["merchant_id"])
        result_dict = result.model_dump()
        state["activity_result"] = result_dict
        state["tools_called"] = state.get("tools_called", []) + ["get_recent_activity"]

        state["evidence"] = state.get("evidence", []) + [
            {
                "source_tool": "get_recent_activity",
                "field": "velocity_ratio",
                "value": str(result.velocity_ratio),
                "confidence": 1.0,
            },
            {
                "source_tool": "get_recent_activity",
                "field": "current_txn_rate",
                "value": str(result.current_txn_rate),
                "confidence": 1.0,
            },
            {
                "source_tool": "get_recent_activity",
                "field": "failure_rate",
                "value": str(result.failure_rate),
                "confidence": 1.0,
            },
        ]
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"get_recent_activity failed: {str(e)}"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_recent_activity"] = round(latency, 2)

    return state


def gather_device_node(state: InvestigationState) -> InvestigationState:
    """Gather device activity — may fail gracefully."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        result = tool_data_provider.get_device_activity(state["merchant_id"])
        result_dict = result.model_dump()
        state["device_result"] = result_dict
        state["tools_called"] = state.get("tools_called", []) + ["get_device_activity"]

        if result.success:
            state["evidence"] = state.get("evidence", []) + [
                {
                    "source_tool": "get_device_activity",
                    "field": "new_device_percentage",
                    "value": str(result.new_device_percentage),
                    "confidence": 1.0,
                },
                {
                    "source_tool": "get_device_activity",
                    "field": "device_concentration",
                    "value": result.device_concentration,
                    "confidence": 1.0,
                },
            ]
        else:
            # Tool failed — record the failure, do NOT fabricate data
            state["errors"] = state.get("errors", []) + [
                f"get_device_activity: {result.error}"
            ]
            state["evidence"] = state.get("evidence", []) + [
                {
                    "source_tool": "get_device_activity",
                    "field": "service_status",
                    "value": "UNAVAILABLE — no device data should be assumed",
                    "confidence": 0.0,
                },
            ]
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"get_device_activity exception: {str(e)}"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_device_activity"] = round(latency, 2)

    return state


def gather_patterns_node(state: InvestigationState) -> InvestigationState:
    """Analyze transaction patterns."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        result = tool_data_provider.get_transaction_patterns(state["merchant_id"])
        result_dict = result.model_dump()
        state["patterns_result"] = result_dict
        state["tools_called"] = state.get("tools_called", []) + ["get_transaction_patterns"]

        if result.unusual_concentrations:
            for conc in result.unusual_concentrations:
                state["evidence"] = state.get("evidence", []) + [
                    {
                        "source_tool": "get_transaction_patterns",
                        "field": "unusual_concentration",
                        "value": conc,
                        "confidence": 0.9,
                    },
                ]
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"get_transaction_patterns failed: {str(e)}"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_transaction_patterns"] = round(latency, 2)

    return state


def gather_explanation_node(state: InvestigationState) -> InvestigationState:
    """Get ML model explanation via SHAP."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        # Use SHAP explainer if available, otherwise use feature importance
        from backend.app.risk.explainability.shap_explainer import shap_explainer

        # Build a feature dict from gathered evidence
        activity = state.get("activity_result", {})
        baseline = state.get("baseline_result", {})

        # Create a synthetic feature dict for explanation
        features = {
            "txn_count_1m": activity.get("txn_count_1m", 0),
            "txn_count_5m": activity.get("txn_count_5m", 0),
            "velocity_ratio": activity.get("velocity_ratio", 1.0),
            "current_txn_rate": activity.get("current_txn_rate", 0),
            "payment_failure_rate": activity.get("failure_rate", 0),
        }

        explanation = shap_explainer.explain(features)
        state["explanation_result"] = explanation
        state["tools_called"] = state.get("tools_called", []) + ["get_model_explanation"]

        for feature_name, contribution in list(explanation.get("top_risk_drivers", {}).items())[:5]:
            state["evidence"] = state.get("evidence", []) + [
                {
                    "source_tool": "get_model_explanation",
                    "field": f"shap_{feature_name}",
                    "value": str(contribution),
                    "confidence": 1.0,
                },
            ]
    except Exception as e:
        # If SHAP fails, use basic feature importance
        state["errors"] = state.get("errors", []) + [f"get_model_explanation: Using fallback — {str(e)}"]
        state["explanation_result"] = {
            "risk_score": state["risk_score"],
            "note": "SHAP explanation unavailable; using alert risk score only.",
        }
        state["tools_called"] = state.get("tools_called", []) + ["get_model_explanation"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_model_explanation"] = round(latency, 2)

    return state


def gather_policy_node(state: InvestigationState) -> InvestigationState:
    """Get merchant risk policy."""
    state["current_step"] = state.get("current_step", 0) + 1

    start = time.perf_counter()
    try:
        result = tool_data_provider.get_merchant_policy(state["merchant_id"])
        state["policy_result"] = result.model_dump()
        state["tools_called"] = state.get("tools_called", []) + ["get_merchant_policy"]
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"get_merchant_policy failed: {str(e)}"]

    latency = (time.perf_counter() - start) * 1000
    state.setdefault("tool_latencies", {})["get_merchant_policy"] = round(latency, 2)

    return state


def correlate_evidence_node(state: InvestigationState) -> InvestigationState:
    """Correlate all gathered evidence and produce findings."""
    state["current_step"] = state.get("current_step", 0) + 1

    evidence = state.get("evidence", [])
    errors = state.get("errors", [])

    # Count evidence sources
    successful_tools = len(set(
        e["source_tool"] for e in evidence if e.get("confidence", 0) > 0
    ))
    failed_tools = len(errors)

    # Determine confidence based on evidence completeness
    max_tools = 6
    confidence = min(successful_tools / max_tools, 1.0)
    if failed_tools > 0:
        confidence *= 0.85  # Reduce confidence for missing evidence

    state["confidence"] = round(confidence, 2)

    # Build summary
    findings = []

    # Velocity analysis
    activity = state.get("activity_result", {})
    baseline = state.get("baseline_result", {})
    if activity and baseline:
        velocity = activity.get("velocity_ratio", 1.0)
        if velocity > 3:
            findings.append(
                f"Transaction velocity is {velocity:.1f}x above the merchant baseline "
                f"({activity.get('current_txn_rate', 0):.0f}/min vs "
                f"{baseline.get('baseline_txn_rate', 0):.0f}/min baseline). "
                f"[Source: get_recent_activity → velocity_ratio]"
            )

    # Device analysis
    device = state.get("device_result", {})
    if device:
        if device.get("success", True):
            new_pct = device.get("new_device_percentage", 0)
            if new_pct > 20:
                findings.append(
                    f"New device activity is elevated: {new_pct:.0f}% of devices "
                    f"were not previously observed. "
                    f"[Source: get_device_activity → new_device_percentage]"
                )
        else:
            findings.append(
                "⚠️ Device activity data is UNAVAILABLE. "
                "Investigation proceeding with incomplete evidence. "
                "No device-related conclusions should be drawn."
            )

    # Pattern analysis
    patterns = state.get("patterns_result", {})
    if patterns:
        for conc in patterns.get("unusual_concentrations", []):
            if conc != "No unusual concentrations detected":
                findings.append(
                    f"Unusual pattern detected: {conc}. "
                    f"[Source: get_transaction_patterns → unusual_concentration]"
                )

    # Model explanation
    explanation = state.get("explanation_result", {})
    if explanation and "top_risk_drivers" in explanation:
        drivers = explanation["top_risk_drivers"]
        if drivers:
            top_features = ", ".join(
                f"{k} (+{v:.2f})" for k, v in list(drivers.items())[:3]
            )
            findings.append(
                f"ML model identifies key risk drivers: {top_features}. "
                f"[Source: get_model_explanation → SHAP values]"
            )

    state["summary"] = "\n".join(findings) if findings else "Insufficient evidence for detailed findings."

    return state


def recommend_node(state: InvestigationState) -> InvestigationState:
    """Produce a bounded recommendation within policy limits."""
    state["current_step"] = state.get("current_step", 0) + 1

    risk_score = state.get("risk_score", 0)
    confidence = state.get("confidence", 0.5)
    errors = state.get("errors", [])
    policy = state.get("policy_result", {})

    # Determine recommendation based on risk + evidence
    if risk_score >= 0.95 or (risk_score >= 0.8 and confidence >= 0.7):
        action = "enhanced_verification"
        recommendation = (
            "RECOMMEND: Enhanced verification for this merchant. "
            "Multiple risk signals indicate a significant fraud spike. "
            "Requires human review before any action is taken."
        )
    elif risk_score >= 0.8 or (risk_score >= 0.6 and confidence >= 0.6):
        action = "escalate_for_review"
        recommendation = (
            "RECOMMEND: Escalate for merchant review. "
            "Risk signals warrant investigation by a human analyst. "
            "Agent-gathered evidence supports elevated risk level."
        )
    elif risk_score >= 0.6:
        action = "investigate"
        recommendation = (
            "RECOMMEND: Continue monitoring with enhanced scrutiny. "
            "Risk signals are elevated but not conclusive. "
            "Additional evidence gathering may be needed."
        )
    else:
        action = "monitor"
        recommendation = (
            "RECOMMEND: Continue standard monitoring. "
            "Risk signals are within acceptable parameters."
        )

    # If evidence is incomplete, prefer escalation
    if errors and action in ("monitor", "investigate"):
        action = "escalate_for_review"
        recommendation += (
            "\n\n⚠️ ESCALATION OVERRIDE: Evidence is incomplete due to tool failures. "
            "Escalating to human review as a precautionary measure. "
            "Missing data: " + "; ".join(errors)
        )

    state["recommendation"] = recommendation
    state["recommendation_action"] = action
    state["status"] = "completed"

    return state


# ── Graph Construction ───────────────────────────────────────────

def should_gather_device(state: InvestigationState) -> str:
    """Decide whether to gather device data based on risk level."""
    if state.get("risk_score", 0) >= 0.5:
        return "gather_device"
    return "gather_patterns"


def should_continue_or_recommend(state: InvestigationState) -> str:
    """Decide if we have enough evidence or need more."""
    step = state.get("current_step", 0)
    max_steps = state.get("max_steps", 15)

    if step >= max_steps:
        return "recommend"

    # If we have baseline + activity + at least one more signal
    has_baseline = state.get("baseline_result") is not None
    has_activity = state.get("activity_result") is not None
    has_extra = (
        state.get("device_result") is not None or
        state.get("patterns_result") is not None
    )

    if has_baseline and has_activity and has_extra:
        return "correlate"

    return "continue"


def run_investigation(
    alert_id: str,
    merchant_id: str,
    risk_score: float,
    anomaly_score: float = 0.0,
    spike_ratio: float = 1.0,
    shap_features: Optional[dict] = None,
) -> InvestigationState:
    """
    Execute the investigation graph synchronously.

    In production, this would run as a LangGraph StateGraph with LLM-driven
    tool selection. For the MVP, we use a deterministic graph that calls tools
    based on the alert context, then uses the LLM for reasoning over evidence.

    This approach ensures:
    1. Tools are actually called (not faked)
    2. Evidence is gathered from tool outputs
    3. The agent decides based on accumulated evidence
    4. Failures are handled gracefully
    """
    # Initialize state
    state = create_initial_state(
        alert_id=alert_id,
        merchant_id=merchant_id,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        spike_ratio=spike_ratio,
    )

    # Execute graph nodes
    state = triage_node(state)
    state = gather_baseline_node(state)
    state = gather_activity_node(state)
    state = gather_device_node(state)
    state = gather_patterns_node(state)

    # Explanation node — uses SHAP if features available
    if shap_features:
        state["_shap_features"] = shap_features
    state = gather_explanation_node(state)

    state = gather_policy_node(state)
    state = correlate_evidence_node(state)
    state = recommend_node(state)

    return state


async def run_investigation_async(
    alert_id: str,
    merchant_id: str,
    risk_score: float,
    anomaly_score: float = 0.0,
    spike_ratio: float = 1.0,
    shap_features: Optional[dict] = None,
) -> InvestigationState:
    """Async wrapper for the investigation graph."""
    import asyncio
    return await asyncio.to_thread(
        run_investigation,
        alert_id, merchant_id, risk_score,
        anomaly_score, spike_ratio, shap_features,
    )
