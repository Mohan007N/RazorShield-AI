"""
RazorShield AI — Action Gate.

Separate layer between agent recommendation and actual execution.
The agent can recommend; it cannot directly execute sensitive operations.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from backend.app.schemas.models import PolicyAction, PolicyResult


class ActionGateResult:
    """Result of action gating."""

    def __init__(
        self,
        gate_id: str,
        action: PolicyAction,
        is_authorized: bool,
        requires_human_review: bool,
        human_review_status: str,
        reasoning: str,
    ):
        self.gate_id = gate_id
        self.action = action
        self.is_authorized = is_authorized
        self.requires_human_review = requires_human_review
        self.human_review_status = human_review_status
        self.reasoning = reasoning
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "gate_id": self.gate_id,
            "action": self.action.value,
            "is_authorized": self.is_authorized,
            "requires_human_review": self.requires_human_review,
            "human_review_status": self.human_review_status,
            "reasoning": self.reasoning,
            "timestamp": self.timestamp.isoformat(),
        }


class ActionGate:
    """
    Gates agent-recommended actions.

    Flow:
        Agent recommendation → Policy engine → Action gate → Authorized action / Human review

    Sensitive operations ALWAYS require explicit human approval.
    """

    # Actions that can be auto-approved (low risk)
    AUTO_APPROVE_ACTIONS = {PolicyAction.MONITOR}

    # Actions requiring human review
    HUMAN_REVIEW_ACTIONS = {
        PolicyAction.ESCALATE,
        PolicyAction.ENHANCED_VERIFICATION,
        PolicyAction.BLOCK_PENDING_REVIEW,
    }

    def evaluate(
        self,
        policy_result: PolicyResult,
        agent_recommendation: str,
        investigation_id: Optional[str] = None,
    ) -> ActionGateResult:
        """
        Evaluate whether the policy-approved action can proceed.

        Args:
            policy_result: Output from the policy engine.
            agent_recommendation: The agent's recommendation text.
            investigation_id: ID of the investigation for audit.

        Returns:
            ActionGateResult indicating authorization status.
        """
        gate_id = f"gate_{uuid.uuid4().hex[:12]}"
        action = policy_result.allowed_action

        # Auto-approve low-risk monitoring
        if action in self.AUTO_APPROVE_ACTIONS and not policy_result.requires_human_approval:
            return ActionGateResult(
                gate_id=gate_id,
                action=action,
                is_authorized=True,
                requires_human_review=False,
                human_review_status="not_required",
                reasoning="Low-risk action auto-approved by policy engine.",
            )

        # Moderate actions: auto-approve if policy doesn't require approval
        if action == PolicyAction.INVESTIGATE and not policy_result.requires_human_approval:
            return ActionGateResult(
                gate_id=gate_id,
                action=action,
                is_authorized=True,
                requires_human_review=False,
                human_review_status="not_required",
                reasoning="Investigation action approved. No financial impact.",
            )

        # Sensitive actions: require human review
        if action in self.HUMAN_REVIEW_ACTIONS or policy_result.requires_human_approval:
            return ActionGateResult(
                gate_id=gate_id,
                action=action,
                is_authorized=False,
                requires_human_review=True,
                human_review_status="pending",
                reasoning=(
                    f"Action '{action.value}' requires human approval. "
                    f"Policy: {policy_result.reasoning}"
                ),
            )

        # Default: require human review for safety
        return ActionGateResult(
            gate_id=gate_id,
            action=action,
            is_authorized=False,
            requires_human_review=True,
            human_review_status="pending",
            reasoning="Default safety: action gated for human review.",
        )

    def approve(self, gate_result: ActionGateResult, approver: str) -> ActionGateResult:
        """Human approves a gated action."""
        gate_result.is_authorized = True
        gate_result.human_review_status = "approved"
        gate_result.reasoning += f" Approved by {approver} at {datetime.utcnow().isoformat()}."
        return gate_result

    def reject(self, gate_result: ActionGateResult, approver: str, reason: str) -> ActionGateResult:
        """Human rejects a gated action."""
        gate_result.is_authorized = False
        gate_result.human_review_status = "rejected"
        gate_result.reasoning += f" Rejected by {approver}: {reason}."
        return gate_result


# Singleton
action_gate = ActionGate()
