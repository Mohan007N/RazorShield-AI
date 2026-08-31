"""
RazorShield AI — Deterministic Policy Engine.

The LLM does NOT decide financial actions. This engine maps risk levels
to allowed actions based on configurable merchant policies.
"""

from __future__ import annotations

from backend.app.core.config import settings
from backend.app.schemas.models import PolicyAction, PolicyInput, PolicyResult, RiskLevel


class PolicyEngine:
    """
    Deterministic policy engine.

    Maps risk level → allowed action using configurable rules.
    The agent can RECOMMEND actions; only the policy engine + action gate
    can authorize them.
    """

    # Default policy matrix
    DEFAULT_POLICY = {
        RiskLevel.LOW: {
            "action": PolicyAction.MONITOR,
            "requires_approval": False,
            "reasoning": "Risk is within acceptable parameters. Standard monitoring continues.",
        },
        RiskLevel.MEDIUM: {
            "action": PolicyAction.INVESTIGATE,
            "requires_approval": False,
            "reasoning": "Elevated risk detected. Enhanced monitoring and investigation recommended.",
        },
        RiskLevel.HIGH: {
            "action": PolicyAction.ESCALATE,
            "requires_approval": True,
            "reasoning": "High risk detected. Escalating for human review before any action.",
        },
        RiskLevel.CRITICAL: {
            "action": PolicyAction.ENHANCED_VERIFICATION,
            "requires_approval": True,
            "reasoning": "Critical risk detected. Enhanced verification required with senior analyst approval.",
        },
    }

    def evaluate(self, policy_input: PolicyInput) -> PolicyResult:
        """
        Evaluate the agent's recommendation against merchant policy.

        The policy engine overrides the agent recommendation if it exceeds
        the merchant's configured action boundaries.
        """
        risk_level = policy_input.risk_level

        # Get merchant-specific policy or default
        merchant_policy = policy_input.merchant_policy or {}
        policy_matrix = merchant_policy.get("policy_matrix", self.DEFAULT_POLICY)

        if isinstance(policy_matrix, dict) and risk_level in policy_matrix:
            policy = policy_matrix[risk_level]
        else:
            policy = self.DEFAULT_POLICY.get(risk_level, self.DEFAULT_POLICY[RiskLevel.LOW])

        # Determine the actual action
        if isinstance(policy["action"], str):
            allowed_action = PolicyAction(policy["action"])
        else:
            allowed_action = policy["action"]

        requires_approval = policy.get("requires_approval", False)

        # Additional check: if evidence is incomplete, always require approval
        evidence_count = len(policy_input.investigation_evidence)
        has_errors = any(
            e.get("confidence", 1.0) == 0 for e in policy_input.investigation_evidence
        )
        if has_errors and not requires_approval:
            requires_approval = True
            reasoning = (
                policy["reasoning"] +
                " NOTE: Investigation had incomplete evidence — human approval required."
            )
        else:
            reasoning = policy["reasoning"]

        return PolicyResult(
            allowed_action=allowed_action,
            requires_human_approval=requires_approval,
            reasoning=reasoning,
            risk_level=risk_level,
        )


# Singleton
policy_engine = PolicyEngine()
