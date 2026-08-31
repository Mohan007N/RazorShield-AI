"""
RazorShield AI — Statistical Anomaly Detector.

Uses rolling z-score + EWMA to detect sudden merchant-level deviations.
Outputs anomaly_score, spike_severity, and spike_ratio.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class AnomalyResult:
    """Result from the anomaly detector."""
    anomaly_score: float       # 0-1 normalized anomaly score
    spike_severity: str        # none / low / medium / high / critical
    spike_ratio: float         # current_rate / baseline_rate
    z_score: float             # raw z-score
    ewma_deviation: float      # EWMA-based deviation
    is_anomalous: bool         # above threshold


class MerchantAnomalyDetector:
    """
    Detects anomalous merchant-level activity using rolling z-score
    and Exponentially Weighted Moving Average (EWMA).

    This is a simple, interpretable statistical method chosen for
    explainability. For production, ensemble with ML-based detectors.
    """

    def __init__(
        self,
        z_score_threshold: float = 3.0,
        ewma_alpha: float = 0.3,
        min_history: int = 10,
    ):
        """
        Args:
            z_score_threshold: z-score above which activity is anomalous.
            ewma_alpha: EWMA smoothing factor (0-1). Higher = more reactive.
            min_history: Minimum data points before anomaly detection activates.
        """
        self.z_threshold = z_score_threshold
        self.alpha = ewma_alpha
        self.min_history = min_history

    def detect(
        self,
        current_rate: float,
        baseline_rate: float,
        baseline_std: float,
        historical_rates: Optional[list[float]] = None,
    ) -> AnomalyResult:
        """
        Detect if the current transaction rate is anomalous.

        Args:
            current_rate: Current transactions per minute.
            baseline_rate: Historical average transactions per minute.
            baseline_std: Standard deviation of historical rates.
            historical_rates: Optional list of recent rate observations.

        Returns:
            AnomalyResult with scored anomaly assessment.
        """
        # ── Z-score ──────────────────────────────────────────────
        if baseline_std > 0:
            z_score = (current_rate - baseline_rate) / baseline_std
        else:
            z_score = (current_rate - baseline_rate) / max(baseline_rate * 0.1, 1.0)

        # ── EWMA deviation ───────────────────────────────────────
        ewma_dev = 0.0
        if historical_rates and len(historical_rates) >= self.min_history:
            ewma = self._compute_ewma(historical_rates)
            ewma_std = self._compute_ewma_std(historical_rates, ewma)
            if ewma_std > 0:
                ewma_dev = (current_rate - ewma) / ewma_std
            else:
                ewma_dev = (current_rate - ewma) / max(ewma * 0.1, 1.0)

        # ── Spike ratio ─────────────────────────────────────────
        spike_ratio = current_rate / max(baseline_rate, 0.01)

        # ── Combined anomaly score ───────────────────────────────
        # Normalize z-score to 0-1 using sigmoid-like function
        z_normalized = self._sigmoid(z_score, center=self.z_threshold, steepness=1.0)

        # EWMA weight
        ewma_normalized = self._sigmoid(ewma_dev, center=2.0, steepness=0.8)

        # Spike ratio component
        spike_normalized = self._sigmoid(spike_ratio, center=3.0, steepness=0.5)

        # Weighted combination
        anomaly_score = (
            0.4 * z_normalized +
            0.3 * ewma_normalized +
            0.3 * spike_normalized
        )
        anomaly_score = min(max(anomaly_score, 0.0), 1.0)

        # ── Severity classification ──────────────────────────────
        severity = self._classify_severity(anomaly_score, spike_ratio)

        # ── Is anomalous? ────────────────────────────────────────
        is_anomalous = (
            z_score > self.z_threshold or
            anomaly_score > 0.6 or
            spike_ratio > 5.0
        )

        return AnomalyResult(
            anomaly_score=round(anomaly_score, 4),
            spike_severity=severity,
            spike_ratio=round(spike_ratio, 2),
            z_score=round(z_score, 4),
            ewma_deviation=round(ewma_dev, 4),
            is_anomalous=is_anomalous,
        )

    def detect_from_features(
        self,
        velocity_ratio: float,
        txn_count_1m: float,
        new_device_ratio: float,
        payment_failure_rate: float,
        amount_deviation: float,
    ) -> AnomalyResult:
        """
        Simplified detection using pre-computed features.
        Useful during real-time inference when full history isn't available.
        """
        # Composite z-score from multiple signals
        signals = [
            velocity_ratio / 3.0,      # 3x is "normal" threshold
            new_device_ratio * 5.0,     # 20% new devices = 1.0
            payment_failure_rate * 10,  # 10% failure = 1.0
            amount_deviation / 3.0,     # 3 std = 1.0
        ]
        composite_z = sum(signals) / len(signals) * 3.0

        anomaly_score = self._sigmoid(composite_z, center=3.0, steepness=0.8)
        severity = self._classify_severity(anomaly_score, velocity_ratio)

        return AnomalyResult(
            anomaly_score=round(anomaly_score, 4),
            spike_severity=severity,
            spike_ratio=round(velocity_ratio, 2),
            z_score=round(composite_z, 4),
            ewma_deviation=0.0,
            is_anomalous=anomaly_score > 0.6,
        )

    def _compute_ewma(self, rates: list[float]) -> float:
        """Compute EWMA of rate observations."""
        ewma = rates[0]
        for rate in rates[1:]:
            ewma = self.alpha * rate + (1 - self.alpha) * ewma
        return ewma

    def _compute_ewma_std(self, rates: list[float], ewma: float) -> float:
        """Compute standard deviation around EWMA."""
        deviations = [(r - ewma) ** 2 for r in rates]
        ewma_var = deviations[0]
        for d in deviations[1:]:
            ewma_var = self.alpha * d + (1 - self.alpha) * ewma_var
        return np.sqrt(ewma_var)

    @staticmethod
    def _sigmoid(x: float, center: float = 0, steepness: float = 1.0) -> float:
        """Sigmoid normalization to [0, 1]."""
        return 1.0 / (1.0 + np.exp(-steepness * (x - center)))

    @staticmethod
    def _classify_severity(score: float, spike_ratio: float) -> str:
        """Classify anomaly severity."""
        if score >= 0.9 or spike_ratio >= 10:
            return "critical"
        elif score >= 0.7 or spike_ratio >= 5:
            return "high"
        elif score >= 0.5 or spike_ratio >= 3:
            return "medium"
        elif score >= 0.3 or spike_ratio >= 2:
            return "low"
        return "none"
