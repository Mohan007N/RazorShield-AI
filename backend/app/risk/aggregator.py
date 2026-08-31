"""
RazorShield AI — Risk Aggregator.

Combines ML score + anomaly score + baseline deviation into overall risk.
Aggregation logic is configurable and documented.
"""

from __future__ import annotations

from backend.app.core.config import settings
from backend.app.risk.anomaly.detector import AnomalyResult, MerchantAnomalyDetector
from backend.app.schemas.models import RiskLevel, RiskResult


class RiskAggregator:
    """
    Combines multiple risk signals into an overall risk assessment.

    Aggregation formula:
        overall_risk = (ml_weight * ml_score) +
                       (anomaly_weight * anomaly_score) +
                       (spike_weight * normalized_spike)

    The weights are configurable. This formula is a starting point;
    it is not claimed to be optimal. The evaluation pipeline
    compares this combined approach against individual models.
    """

    def __init__(
        self,
        ml_weight: float = 0.50,
        anomaly_weight: float = 0.30,
        spike_weight: float = 0.20,
    ):
        self.ml_weight = ml_weight
        self.anomaly_weight = anomaly_weight
        self.spike_weight = spike_weight
        self.anomaly_detector = MerchantAnomalyDetector()

    def assess(
        self,
        ml_score: float,
        anomaly_result: AnomalyResult,
        model_version: str,
        feature_contributions: dict[str, float] | None = None,
    ) -> RiskResult:
        """
        Produce a combined risk assessment.

        Args:
            ml_score: XGBoost fraud probability (0-1).
            anomaly_result: Result from the anomaly detector.
            model_version: Version string of the ML model used.
            feature_contributions: Optional SHAP values.

        Returns:
            RiskResult with all scores and risk level.
        """
        # Normalize spike ratio to 0-1 (cap at 20x)
        normalized_spike = min(anomaly_result.spike_ratio / 20.0, 1.0)

        # Weighted combination
        overall = (
            self.ml_weight * ml_score +
            self.anomaly_weight * anomaly_result.anomaly_score +
            self.spike_weight * normalized_spike
        )
        overall = min(max(overall, 0.0), 1.0)

        # Determine risk level
        risk_level = self._classify_risk(overall)

        return RiskResult(
            ml_score=round(ml_score, 4),
            anomaly_score=anomaly_result.anomaly_score,
            spike_ratio=anomaly_result.spike_ratio,
            overall_risk=round(overall, 4),
            risk_level=risk_level,
            model_version=model_version,
            feature_contributions=feature_contributions,
        )

    def _classify_risk(self, score: float) -> RiskLevel:
        """Map overall risk score to risk level."""
        if score >= settings.risk_threshold_critical:
            return RiskLevel.CRITICAL
        elif score >= settings.risk_threshold_high:
            return RiskLevel.HIGH
        elif score >= settings.risk_threshold_medium:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    @property
    def aggregation_doc(self) -> str:
        """Document the current aggregation logic."""
        return (
            f"Risk Aggregation Formula:\n"
            f"  overall_risk = ({self.ml_weight} × ml_score) + "
            f"({self.anomaly_weight} × anomaly_score) + "
            f"({self.spike_weight} × normalized_spike_ratio)\n"
            f"\nRisk Thresholds:\n"
            f"  LOW: < {settings.risk_threshold_medium}\n"
            f"  MEDIUM: {settings.risk_threshold_medium} – {settings.risk_threshold_high}\n"
            f"  HIGH: {settings.risk_threshold_high} – {settings.risk_threshold_critical}\n"
            f"  CRITICAL: ≥ {settings.risk_threshold_critical}\n"
        )


# Singleton
risk_aggregator = RiskAggregator()
