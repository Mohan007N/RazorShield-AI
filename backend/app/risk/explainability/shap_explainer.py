"""
RazorShield AI — SHAP Explainability Module.

Generates SHAP explanations for XGBoost predictions.
Values are computed from the actual model — never fabricated.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import shap

from backend.app.risk.inference.engine import risk_engine
from ml.features.engineering import FEATURE_NAMES


class SHAPExplainer:
    """Generates SHAP-based feature contribution explanations."""

    def __init__(self):
        self._explainer: Optional[shap.TreeExplainer] = None

    def _ensure_explainer(self) -> None:
        """Initialize SHAP TreeExplainer from the loaded model."""
        if self._explainer is None:
            risk_engine.ensure_loaded()
            self._explainer = shap.TreeExplainer(risk_engine.model)

    def explain(self, features: dict[str, float]) -> dict:
        """
        Explain a single prediction using SHAP values.

        Args:
            features: Dict mapping feature names to values.

        Returns:
            Dict with risk_score, base_value, and feature_contributions.
        """
        self._ensure_explainer()

        # Build feature vector
        feature_vector = np.array(
            [features.get(name, 0.0) for name in FEATURE_NAMES],
            dtype=np.float32,
        ).reshape(1, -1)
        feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=100.0, neginf=-100.0)

        # Compute SHAP values
        shap_values = self._explainer.shap_values(feature_vector)

        # For binary classification, shap_values may be a list or 2D array
        if isinstance(shap_values, list):
            # Take the positive class
            sv = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
        elif len(shap_values.shape) == 3:
            sv = shap_values[0, :, 1]
        else:
            sv = shap_values[0]

        # Build contribution dict
        contributions = {}
        for name, value in zip(FEATURE_NAMES, sv):
            contributions[name] = round(float(value), 4)

        # Sort by absolute contribution
        sorted_contributions = dict(
            sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)
        )

        # Top contributors (positive = increases risk, negative = decreases risk)
        top_positive = {k: v for k, v in sorted_contributions.items() if v > 0}
        top_negative = {k: v for k, v in sorted_contributions.items() if v < 0}

        # Get the prediction
        prediction = risk_engine.predict(features)

        return {
            "risk_score": prediction["fraud_probability"],
            "base_value": round(float(self._explainer.expected_value
                                      if isinstance(self._explainer.expected_value, float)
                                      else self._explainer.expected_value[1]), 4),
            "feature_contributions": sorted_contributions,
            "top_risk_drivers": dict(list(top_positive.items())[:5]),
            "top_risk_reducers": dict(list(top_negative.items())[:5]),
            "model_version": prediction["model_version"],
            "note": "SHAP values computed from the actual trained model. "
                    "Positive values increase the risk score, negative values decrease it.",
        }

    def explain_batch(self, feature_matrix: np.ndarray) -> list[dict[str, float]]:
        """Explain multiple predictions."""
        self._ensure_explainer()
        feature_matrix = np.nan_to_num(
            feature_matrix.astype(np.float32), nan=0.0, posinf=100.0, neginf=-100.0
        )

        shap_values = self._explainer.shap_values(feature_matrix)

        if isinstance(shap_values, list):
            sv_matrix = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        elif len(shap_values.shape) == 3:
            sv_matrix = shap_values[:, :, 1]
        else:
            sv_matrix = shap_values

        results = []
        for i in range(len(sv_matrix)):
            contrib = {name: round(float(v), 4) for name, v in zip(FEATURE_NAMES, sv_matrix[i])}
            results.append(contrib)

        return results


# Singleton
shap_explainer = SHAPExplainer()
