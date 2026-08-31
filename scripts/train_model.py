"""
RazorShield AI — XGBoost Model Training Pipeline.

Time-based split (70/15/15). Uses scale_pos_weight for class imbalance.
Never tunes on the held-out test set.

Usage:
    python -m scripts.train_model
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from xgboost import XGBClassifier

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.features.engineering import FEATURE_NAMES, extract_features_batch


def time_based_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Chronological time-based split.

    Returns (train, validation, test) DataFrames.
    """
    df = df.sort_values("timestamp").reset_index(drop=True)
    n = len(df)

    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train = df.iloc[:train_end].copy()
    val = df.iloc[train_end:val_end].copy()
    test = df.iloc[val_end:].copy()

    return train, val, test


def train_xgboost(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    class_weight_ratio: float | None = None,
) -> XGBClassifier:
    """
    Train XGBoost classifier with class weighting.

    Uses scale_pos_weight to handle class imbalance.
    """
    if class_weight_ratio is None:
        neg_count = (y_train == 0).sum()
        pos_count = (y_train == 1).sum()
        class_weight_ratio = neg_count / max(pos_count, 1)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        scale_pos_weight=class_weight_ratio,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        eval_metric="aucpr",
        early_stopping_rounds=20,
        random_state=42,
        use_label_encoder=False,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=True,
    )

    return model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train XGBoost fraud detection model")
    parser.add_argument("--data", type=str, default="ml/data/synthetic_transactions.csv")
    parser.add_argument("--output-dir", type=str, default="ml/models")
    parser.add_argument("--sample-rate", type=float, default=0.3,
                        help="Sample rate for feature extraction (speed vs completeness)")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("RazorShield AI — Model Training Pipeline")
    print("=" * 60)

    # ── Load data ────────────────────────────────────────────────
    print(f"\n1. Loading data from {args.data}...")
    df = pd.read_csv(args.data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    print(f"   Loaded {len(df):,} transactions")
    print(f"   Suspicious: {df['is_suspicious'].sum():,} ({df['is_suspicious'].mean()*100:.1f}%)")

    # ── Time-based split ─────────────────────────────────────────
    print("\n2. Time-based split (70/15/15)...")
    train_df, val_df, test_df = time_based_split(df)
    print(f"   Train: {len(train_df):,} ({train_df['is_suspicious'].mean()*100:.1f}% suspicious)")
    print(f"   Val:   {len(val_df):,} ({val_df['is_suspicious'].mean()*100:.1f}% suspicious)")
    print(f"   Test:  {len(test_df):,} ({test_df['is_suspicious'].mean()*100:.1f}% suspicious)")

    # Save test set metadata (DO NOT use test set for tuning)
    test_meta = {
        "test_set_size": len(test_df),
        "test_date_range": f"{test_df['timestamp'].min()} to {test_df['timestamp'].max()}",
        "test_suspicious_count": int(test_df["is_suspicious"].sum()),
        "test_normal_count": int((~test_df["is_suspicious"]).sum()),
    }

    # ── Feature extraction ───────────────────────────────────────
    print(f"\n3. Extracting features (sample_rate={args.sample_rate})...")

    print("   Training set...")
    train_features = extract_features_batch(train_df, sample_rate=args.sample_rate)

    print("   Validation set...")
    val_features = extract_features_batch(val_df, sample_rate=1.0)

    # DO NOT extract test features here — only during evaluation

    # ── Prepare matrices ─────────────────────────────────────────
    print("\n4. Preparing feature matrices...")
    X_train = train_features[FEATURE_NAMES].values.astype(np.float32)
    y_train = train_features["is_suspicious"].astype(int).values

    X_val = val_features[FEATURE_NAMES].values.astype(np.float32)
    y_val = val_features["is_suspicious"].astype(int).values

    # Replace NaN/inf with 0
    X_train = np.nan_to_num(X_train, nan=0.0, posinf=100.0, neginf=-100.0)
    X_val = np.nan_to_num(X_val, nan=0.0, posinf=100.0, neginf=-100.0)

    print(f"   X_train: {X_train.shape}")
    print(f"   X_val:   {X_val.shape}")
    print(f"   Class ratio: {(y_train==0).sum()} normal / {(y_train==1).sum()} suspicious")

    # ── Train model ──────────────────────────────────────────────
    print("\n5. Training XGBoost model...")
    model = train_xgboost(X_train, y_train, X_val, y_val)

    # ── Validation metrics ───────────────────────────────────────
    print("\n6. Validation metrics...")
    val_pred = model.predict(X_val)
    val_proba = model.predict_proba(X_val)[:, 1]

    print(classification_report(y_val, val_pred, target_names=["Normal", "Suspicious"]))

    val_metrics = {
        "precision": float(precision_score(y_val, val_pred, zero_division=0)),
        "recall": float(recall_score(y_val, val_pred, zero_division=0)),
        "f1": float(f1_score(y_val, val_pred, zero_division=0)),
    }
    print(f"   Validation F1: {val_metrics['f1']:.4f}")

    # ── Feature importance ───────────────────────────────────────
    print("\n7. Feature importance (top 10)...")
    importances = model.feature_importances_
    importance_dict = dict(zip(FEATURE_NAMES, importances.tolist()))
    sorted_imp = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)

    for name, imp in sorted_imp[:10]:
        print(f"   {name:30s} {imp:.4f}")

    # ── Save model ───────────────────────────────────────────────
    print("\n8. Saving model...")
    model_version = f"v1.0.0"
    model_path = output_dir / "xgboost_fraud.joblib"
    joblib.dump(model, model_path)
    print(f"   ✓ Model saved to {model_path}")

    # Save metadata
    metadata = {
        "model_version": model_version,
        "model_type": "xgboost",
        "training_date": datetime.utcnow().isoformat(),
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
        "training_samples": int(len(X_train)),
        "validation_samples": int(len(X_val)),
        "validation_metrics": val_metrics,
        "feature_importance": importance_dict,
        "hyperparameters": {
            "n_estimators": 200,
            "max_depth": 6,
            "learning_rate": 0.1,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 5,
        },
        "class_balance": {
            "train_normal": int((y_train == 0).sum()),
            "train_suspicious": int((y_train == 1).sum()),
        },
        "test_set_metadata": test_meta,
        "is_synthetic_data": True,
        "note": "Trained on synthetic data only. Performance does not represent real-world results.",
    }

    meta_path = output_dir / "model_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"   ✓ Metadata saved to {meta_path}")

    # Save test set for later evaluation (features NOT extracted yet)
    test_path = output_dir / "test_set.csv"
    test_df.to_csv(test_path, index=False)
    print(f"   ✓ Held-out test set saved to {test_path}")

    print("\n" + "=" * 60)
    print("Training complete. Run `python -m ml.evaluate` for final evaluation.")
    print("=" * 60)


if __name__ == "__main__":
    main()
