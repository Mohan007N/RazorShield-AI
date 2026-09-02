"""
RazorShield AI — Model Evaluation Pipeline.

Evaluates trained models on the held-out test set.
Computes precision, recall, F1, PR-AUC, confusion matrix, and false-positive cost.
Also evaluates baseline models for honest comparison.

Usage:
    python -m ml.evaluate

Output:
    ml/models/evaluation_results.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    auc,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.features.engineering import FEATURE_NAMES, extract_features_batch


# ── Baseline Models ──────────────────────────────────────────────

class ThresholdBaseline:
    """Simple threshold on velocity ratio."""

    def __init__(self, threshold: float = 3.0):
        self.threshold = threshold

    def predict(self, X: np.ndarray) -> np.ndarray:
        velocity_idx = FEATURE_NAMES.index("velocity_ratio")
        return (X[:, velocity_idx] > self.threshold).astype(int)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        velocity_idx = FEATURE_NAMES.index("velocity_ratio")
        scores = np.clip(X[:, velocity_idx] / 20.0, 0, 1)
        return np.column_stack([1 - scores, scores])


class AnomalyBaseline:
    """Anomaly detector combining z-scores of key features."""

    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold
        self.means: np.ndarray | None = None
        self.stds: np.ndarray | None = None

    def fit(self, X: np.ndarray) -> "AnomalyBaseline":
        self.means = X.mean(axis=0)
        self.stds = X.std(axis=0)
        self.stds[self.stds == 0] = 1.0
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        scores = self.anomaly_scores(X)
        return (scores > self.threshold).astype(int)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        scores = self.anomaly_scores(X)
        return np.column_stack([1 - scores, scores])

    def anomaly_scores(self, X: np.ndarray) -> np.ndarray:
        if self.means is None:
            raise RuntimeError("Model not fitted")
        z = np.abs((X - self.means) / self.stds)
        # Use key features: velocity, devices, failure rate
        key_features = ["velocity_ratio", "new_device_ratio", "payment_failure_rate",
                        "amount_deviation", "txn_count_1m"]
        key_indices = [FEATURE_NAMES.index(f) for f in key_features]
        key_z = z[:, key_indices]
        raw = key_z.mean(axis=1)
        return np.clip(raw / (raw.max() + 1e-8), 0, 1)


class CombinedRiskEngine:
    """Combines XGBoost + anomaly scores."""

    def __init__(self, xgb_model, anomaly_model: AnomalyBaseline,
                 ml_weight: float = 0.6, anomaly_weight: float = 0.4):
        self.xgb = xgb_model
        self.anomaly = anomaly_model
        self.ml_weight = ml_weight
        self.anomaly_weight = anomaly_weight

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        ml_proba = self.xgb.predict_proba(X)[:, 1]
        anomaly_proba = self.anomaly.anomaly_scores(X)
        combined = self.ml_weight * ml_proba + self.anomaly_weight * anomaly_proba
        combined = np.clip(combined, 0, 1)
        return np.column_stack([1 - combined, combined])

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        proba = self.predict_proba(X)[:, 1]
        return (proba > threshold).astype(int)


def evaluate_model(
    name: str,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray,
    cost_per_fp: float = 100.0,
) -> dict:
    """Compute comprehensive evaluation metrics."""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)

    # PR-AUC
    precisions, recalls, _ = precision_recall_curve(y_true, y_proba)
    pr_auc = auc(recalls, precisions)

    fp_rate = fp / max(fp + tn, 1)
    fp_cost = fp * cost_per_fp

    return {
        "model_name": name,
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "pr_auc": round(float(pr_auc), 4),
        "true_positives": int(tp),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "false_positive_rate": round(float(fp_rate), 4),
        "false_positive_cost": round(float(fp_cost), 2),
        "cost_per_review": cost_per_fp,
        "confusion_matrix": cm.tolist(),
    }


def main() -> None:
    model_dir = Path("ml/models")
    cost_per_fp = 100.0  # configurable

    print("=" * 60)
    print("RazorShield AI — Model Evaluation (Held-Out Test Set)")
    print("=" * 60)

    # ── Load model ───────────────────────────────────────────────
    model_path = model_dir / "xgboost_fraud.joblib"
    if not model_path.exists():
        print(f"ERROR: Model not found at {model_path}")
        print("Run `python -m scripts.train_model` first.")
        sys.exit(1)

    model = joblib.load(model_path)
    print(f"[+] Loaded model from {model_path}")

    # Load metadata
    meta_path = model_dir / "model_metadata.json"
    with open(meta_path, encoding="utf-8") as f:
        metadata = json.load(f)

    # ── Load test set ────────────────────────────────────────────
    test_path = model_dir / "test_set.csv"
    if not test_path.exists():
        print(f"ERROR: Test set not found at {test_path}")
        sys.exit(1)

    test_df = pd.read_csv(test_path)
    test_df["timestamp"] = pd.to_datetime(test_df["timestamp"], format="mixed")
    print(f"[+] Loaded test set: {len(test_df):,} transactions")

    # ── Extract features ─────────────────────────────────────────
    print("\nExtracting features from held-out test set...")
    test_features = extract_features_batch(test_df, sample_rate=0.05)

    X_test = test_features[FEATURE_NAMES].values.astype(np.float32)
    y_test = test_features["is_suspicious"].astype(int).values
    X_test = np.nan_to_num(X_test, nan=0.0, posinf=100.0, neginf=-100.0)

    print(f"   Test samples: {len(X_test):,}")
    print(f"   Positive: {(y_test==1).sum():,}, Negative: {(y_test==0).sum():,}")

    # ── Evaluate all models ──────────────────────────────────────
    results = []

    # 1. Simple threshold baseline
    print("\n--- 1. Threshold Baseline ---")
    threshold_model = ThresholdBaseline(threshold=3.0)
    y_pred_t = threshold_model.predict(X_test)
    y_proba_t = threshold_model.predict_proba(X_test)[:, 1]
    res_t = evaluate_model("Threshold (velocity > 3x)", y_test, y_pred_t, y_proba_t, cost_per_fp)
    results.append(res_t)
    print(f"   Precision={res_t['precision']:.4f}  Recall={res_t['recall']:.4f}  F1={res_t['f1']:.4f}")

    # 2. Anomaly detector
    print("\n--- 2. Anomaly Detector ---")
    anomaly_model = AnomalyBaseline(threshold=0.5)
    # Fit on first 70% of test data (simulating normal training data)
    anomaly_model.fit(X_test[:int(len(X_test)*0.3)])
    y_pred_a = anomaly_model.predict(X_test)
    y_proba_a = anomaly_model.predict_proba(X_test)[:, 1]
    res_a = evaluate_model("Anomaly Detector (z-score)", y_test, y_pred_a, y_proba_a, cost_per_fp)
    results.append(res_a)
    print(f"   Precision={res_a['precision']:.4f}  Recall={res_a['recall']:.4f}  F1={res_a['f1']:.4f}")

    # 3. XGBoost alone
    print("\n--- 3. XGBoost ---")
    y_pred_xgb = model.predict(X_test)
    y_proba_xgb = model.predict_proba(X_test)[:, 1]
    res_xgb = evaluate_model("XGBoost", y_test, y_pred_xgb, y_proba_xgb, cost_per_fp)
    results.append(res_xgb)
    print(f"   Precision={res_xgb['precision']:.4f}  Recall={res_xgb['recall']:.4f}  F1={res_xgb['f1']:.4f}")
    print(f"\n{classification_report(y_test, y_pred_xgb, target_names=['Normal', 'Suspicious'])}")

    # 4. Combined risk engine
    print("\n--- 4. Combined Risk Engine ---")
    combined_model = CombinedRiskEngine(model, anomaly_model)
    y_pred_c = combined_model.predict(X_test)
    y_proba_c = combined_model.predict_proba(X_test)[:, 1]
    res_c = evaluate_model("Combined Risk Engine", y_test, y_pred_c, y_proba_c, cost_per_fp)
    results.append(res_c)
    print(f"   Precision={res_c['precision']:.4f}  Recall={res_c['recall']:.4f}  F1={res_c['f1']:.4f}")

    # ── Comparison table ─────────────────────────────────────────
    print("\n" + "=" * 90)
    print(f"{'Model':<35s} {'Precision':>10s} {'Recall':>10s} {'F1':>10s} {'PR-AUC':>10s} {'FP Cost':>10s}")
    print("-" * 90)
    for r in results:
        print(f"{r['model_name']:<35s} {r['precision']:>10.4f} {r['recall']:>10.4f} "
              f"{r['f1']:>10.4f} {r['pr_auc']:>10.4f} INR {r['false_positive_cost']:>8.0f}")
    print("=" * 90)

    # Determine best model honestly
    best = max(results, key=lambda x: x["f1"])
    print(f"\nBest F1: {best['model_name']} ({best['f1']:.4f})")

    # ── Save evaluation results ──────────────────────────────────
    evaluation_output = {
        "evaluation_date": pd.Timestamp.utcnow().isoformat(),
        "model_version": metadata.get("model_version", "unknown"),
        "dataset_version": "synthetic_v1",
        "is_synthetic_benchmark": True,
        "note": "All metrics computed on held-out synthetic test set. "
                "Performance on real-world data may differ significantly.",
        "test_set": {
            "size": int(len(X_test)),
            "positive": int((y_test == 1).sum()),
            "negative": int((y_test == 0).sum()),
            "date_range": metadata.get("test_set_metadata", {}).get("test_date_range", "unknown"),
        },
        "cost_assumption": {
            "false_positive_review_cost": cost_per_fp,
            "note": "This is a configurable assumption, not a measured value.",
        },
        "results": results,
        "best_model": best["model_name"],
        "comparison_note": (
            "Comparison is between models evaluated on the same held-out test set. "
            "The best model is determined by F1 score. This does not guarantee "
            "superiority in production settings."
        ),
    }

    output_path = model_dir / "evaluation_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(evaluation_output, f, indent=2)
    print(f"\n[+] Results saved to {output_path}")

    print("\n[*] IMPORTANT: These metrics are from a SYNTHETIC benchmark.")
    print("   They do NOT represent real-world production performance.")


if __name__ == "__main__":
    main()
