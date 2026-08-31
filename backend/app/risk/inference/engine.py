"""
RazorShield AI — Risk Inference Engine.

Loads the trained XGBoost model and runs inference on feature vectors.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

from backend.app.core.config import settings
from ml.features.engineering import FEATURE_NAMES


class RiskInferenceEngine:
    """Loads and serves the trained XGBoost fraud detection model."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.model_path
        self.model = None
        self.model_version = settings.model_version
        self._loaded = False

    def load(self) -> None:
        """Load the model from disk."""
        path = Path(self.model_path)
        if not path.exists():
            raise FileNotFoundError(
                f"Model not found at {path}. Run `python -m scripts.train_model` first."
            )
        self.model = joblib.load(path)
        self._loaded = True

    def ensure_loaded(self) -> None:
        """Ensure model is loaded; load if not."""
        if not self._loaded:
            self.load()

    def predict(self, features: dict[str, float]) -> dict:
        """
        Run inference on a single feature vector.

        Args:
            features: Dict mapping feature names to values.

        Returns:
            Dict with fraud_probability, risk_score, and inference_latency_ms.
        """
        self.ensure_loaded()

        # Build ordered feature vector
        feature_vector = np.array(
            [features.get(name, 0.0) for name in FEATURE_NAMES],
            dtype=np.float32,
        ).reshape(1, -1)

        # Replace NaN/inf
        feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=100.0, neginf=-100.0)

        start = time.perf_counter()
        proba = self.model.predict_proba(feature_vector)[0, 1]
        latency_ms = (time.perf_counter() - start) * 1000

        return {
            "fraud_probability": float(round(proba, 4)),
            "risk_score": int(round(proba * 100)),
            "model_version": self.model_version,
            "inference_latency_ms": round(latency_ms, 2),
        }

    def predict_batch(self, feature_matrix: np.ndarray) -> np.ndarray:
        """Run batch inference. Returns array of fraud probabilities."""
        self.ensure_loaded()
        feature_matrix = np.nan_to_num(
            feature_matrix.astype(np.float32), nan=0.0, posinf=100.0, neginf=-100.0
        )
        return self.model.predict_proba(feature_matrix)[:, 1]

    def get_feature_importance(self) -> dict[str, float]:
        """Return feature importance from the trained model."""
        self.ensure_loaded()
        importances = self.model.feature_importances_
        return dict(zip(FEATURE_NAMES, importances.tolist()))


# Singleton instance
risk_engine = RiskInferenceEngine()
