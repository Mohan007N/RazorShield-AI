"""
RazorShield AI — Feature Engineering Pipeline.

Deterministic, testable feature extraction from transaction data.
Produces the 25-dimensional feature vector defined in the schema.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd
from scipy.stats import entropy as scipy_entropy


# ── Feature Names (canonical order) ──────────────────────────────

FEATURE_NAMES = [
    "txn_count_1m", "txn_count_5m", "txn_count_10m",
    "txn_count_30m", "txn_count_1h",
    "current_amount", "avg_amount", "median_amount",
    "amount_deviation", "amount_ratio_to_baseline",
    "unique_devices", "new_device_count",
    "new_device_ratio", "accounts_per_device",
    "unique_customers", "new_customer_ratio",
    "payment_method_entropy", "payment_failure_rate",
    "payment_method_spike",
    "hour", "day_of_week", "time_deviation",
    "velocity_ratio", "current_txn_rate",
    "current_suspicious_rate",
]


def compute_velocity_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
) -> dict[str, float]:
    """Compute transaction velocity in various time windows."""
    current_ts = df.loc[idx, "timestamp"]

    windows = {
        "txn_count_1m": pd.Timedelta(minutes=1),
        "txn_count_5m": pd.Timedelta(minutes=5),
        "txn_count_10m": pd.Timedelta(minutes=10),
        "txn_count_30m": pd.Timedelta(minutes=30),
        "txn_count_1h": pd.Timedelta(hours=1),
    }

    result = {}
    for name, window in windows.items():
        start = current_ts - window
        count = ((merchant_df["timestamp"] >= start) &
                 (merchant_df["timestamp"] <= current_ts)).sum()
        result[name] = float(count)

    return result


def compute_amount_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
    baseline_avg: float = 5000.0,
) -> dict[str, float]:
    """Compute amount-related features."""
    current_amount = float(df.loc[idx, "amount"])

    # Use last 1 hour of transactions for statistics
    current_ts = df.loc[idx, "timestamp"]
    recent = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(hours=1)
    ]["amount"]

    avg = float(recent.mean()) if len(recent) > 0 else baseline_avg
    median = float(recent.median()) if len(recent) > 0 else baseline_avg
    std = float(recent.std()) if len(recent) > 1 else 0

    deviation = abs(current_amount - avg) / max(std, 1.0) if std > 0 else 0
    ratio = current_amount / max(baseline_avg, 1.0)

    return {
        "current_amount": current_amount,
        "avg_amount": avg,
        "median_amount": median,
        "amount_deviation": min(deviation, 50.0),  # cap extreme values
        "amount_ratio_to_baseline": min(ratio, 100.0),
    }


def compute_device_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
    known_devices: Optional[set[str]] = None,
) -> dict[str, float]:
    """Compute device-related features."""
    current_ts = df.loc[idx, "timestamp"]

    # Last 10 minutes window
    recent = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(minutes=10)
    ]

    devices = recent["device_id"].dropna()
    unique = devices.nunique()

    if known_devices is None:
        # Use first 70% of merchant history as "known"
        cutoff = merchant_df["timestamp"].quantile(0.3)
        known_devices = set(
            merchant_df[merchant_df["timestamp"] <= cutoff]["device_id"].dropna().unique()
        )

    new_devices = set(devices.unique()) - known_devices
    new_count = len(new_devices)
    new_ratio = new_count / max(unique, 1)

    # Accounts per device
    if len(devices) > 0 and unique > 0:
        customers_per = recent.groupby("device_id")["customer_id"].nunique()
        accounts_per_device = float(customers_per.mean())
    else:
        accounts_per_device = 1.0

    return {
        "unique_devices": unique,
        "new_device_count": new_count,
        "new_device_ratio": new_ratio,
        "accounts_per_device": accounts_per_device,
    }


def compute_customer_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
) -> dict[str, float]:
    """Compute customer-related features."""
    current_ts = df.loc[idx, "timestamp"]

    recent = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(minutes=10)
    ]

    customers = recent["customer_id"].dropna()
    unique = customers.nunique()

    # Known customers from history
    cutoff = merchant_df["timestamp"].quantile(0.3)
    known = set(
        merchant_df[merchant_df["timestamp"] <= cutoff]["customer_id"].dropna().unique()
    )

    new_customers = set(customers.unique()) - known
    new_ratio = len(new_customers) / max(unique, 1)

    return {
        "unique_customers": unique,
        "new_customer_ratio": new_ratio,
    }


def compute_payment_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
) -> dict[str, float]:
    """Compute payment method distribution features."""
    current_ts = df.loc[idx, "timestamp"]

    recent = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(minutes=10)
    ]

    methods = recent["payment_method"].value_counts(normalize=True)

    # Shannon entropy of payment method distribution
    if len(methods) > 1:
        pm_entropy = float(scipy_entropy(methods.values))
    else:
        pm_entropy = 0.0

    # Failure rate
    if len(recent) > 0:
        failure_rate = float((recent["status"] == "failed").mean())
    else:
        failure_rate = 0.0

    # Payment method spike: max concentration minus uniform distribution
    if len(methods) > 0:
        max_concentration = float(methods.max())
        uniform = 1.0 / max(len(methods), 1)
        pm_spike = max_concentration - uniform
    else:
        pm_spike = 0.0

    return {
        "payment_method_entropy": pm_entropy,
        "payment_failure_rate": failure_rate,
        "payment_method_spike": pm_spike,
    }


def compute_time_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
) -> dict[str, float]:
    """Compute time-based features."""
    ts = pd.Timestamp(df.loc[idx, "timestamp"])

    hour = ts.hour
    dow = ts.dayofweek

    # Time deviation: how far from merchant's typical active hours
    historical_hours = pd.to_datetime(merchant_df["timestamp"], format="mixed").dt.hour
    if len(historical_hours) > 0:
        typical_hour = float(historical_hours.median())
        time_dev = abs(hour - typical_hour) / 12.0  # normalize to [0, 1]
    else:
        time_dev = 0.0

    return {
        "hour": hour,
        "day_of_week": dow,
        "time_deviation": time_dev,
    }


def compute_baseline_features(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
    baseline_rate: float = 100.0,
) -> dict[str, float]:
    """Compute merchant baseline deviation features."""
    current_ts = df.loc[idx, "timestamp"]

    # Current rate: transactions in last 1 minute
    recent_1m = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(minutes=1)
    ]
    current_rate = float(len(recent_1m))

    velocity_ratio = current_rate / max(baseline_rate / 60.0, 0.01)  # per-second baseline

    # Current suspicious rate (if labels exist)
    recent_10m = merchant_df[
        merchant_df["timestamp"] >= current_ts - pd.Timedelta(minutes=10)
    ]
    if len(recent_10m) > 0 and "is_suspicious" in recent_10m.columns:
        suspicious_rate = float(recent_10m["is_suspicious"].mean())
    else:
        suspicious_rate = 0.0

    return {
        "velocity_ratio": min(velocity_ratio, 100.0),
        "current_txn_rate": current_rate,
        "current_suspicious_rate": suspicious_rate,
    }


def extract_features_for_row(
    df: pd.DataFrame,
    idx: int,
    merchant_df: pd.DataFrame,
    baseline_rate: float = 100.0,
    baseline_avg_amount: float = 5000.0,
    known_devices: Optional[set[str]] = None,
) -> dict[str, float]:
    """Extract all features for a single transaction row."""
    features = {}
    features.update(compute_velocity_features(df, idx, merchant_df))
    features.update(compute_amount_features(df, idx, merchant_df, baseline_avg_amount))
    features.update(compute_device_features(df, idx, merchant_df, known_devices))
    features.update(compute_customer_features(df, idx, merchant_df))
    features.update(compute_payment_features(df, idx, merchant_df))
    features.update(compute_time_features(df, idx, merchant_df))
    features.update(compute_baseline_features(df, idx, merchant_df, baseline_rate))
    return features


def extract_features_batch(
    df: pd.DataFrame,
    merchant_baselines: Optional[dict[str, dict]] = None,
    sample_rate: float = 1.0,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Extract features for all transactions in a DataFrame.

    For training, we sample to speed up computation while maintaining
    representation of both classes.

    Args:
        df: Transaction DataFrame with columns matching NormalizedTransaction.
        merchant_baselines: Dict of merchant_id → {base_rate, avg_amount}.
        sample_rate: Fraction of transactions to process (1.0 = all).
        verbose: Print progress.

    Returns:
        DataFrame with all features + transaction_id + is_suspicious.
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="mixed")
    df = df.sort_values("timestamp").reset_index(drop=True)

    if sample_rate < 1.0:
        # Stratified sampling — preserve class balance according to sample_rate
        suspicious = df[df["is_suspicious"] == True].sample(
            frac=sample_rate, random_state=42
        )
        normal = df[df["is_suspicious"] == False].sample(
            frac=sample_rate, random_state=42
        )
        df = pd.concat([suspicious, normal]).sort_values("timestamp").reset_index(drop=True)

    if merchant_baselines is None:
        merchant_baselines = _compute_baselines(df)

    # Pre-group by merchant for efficiency
    merchant_groups = {mid: group for mid, group in df.groupby("merchant_id")}

    # Compute known devices per merchant (from first 30% of data)
    merchant_known_devices = {}
    for mid, mdf in merchant_groups.items():
        cutoff = mdf["timestamp"].quantile(0.3)
        merchant_known_devices[mid] = set(
            mdf[mdf["timestamp"] <= cutoff]["device_id"].dropna().unique()
        )

    all_features = []
    total = len(df)

    for i in range(total):
        if verbose and i % 5000 == 0:
            print(f"  Processing {i:,}/{total:,} ({i/total*100:.0f}%)")

        mid = df.loc[i, "merchant_id"]
        mdf = merchant_groups[mid]
        baseline = merchant_baselines.get(mid, {"base_rate": 100, "avg_amount": 5000})

        features = extract_features_for_row(
            df, i, mdf,
            baseline_rate=baseline["base_rate"],
            baseline_avg_amount=baseline["avg_amount"],
            known_devices=merchant_known_devices.get(mid),
        )
        features["transaction_id"] = df.loc[i, "transaction_id"]
        features["is_suspicious"] = df.loc[i, "is_suspicious"]
        all_features.append(features)

    result = pd.DataFrame(all_features)

    if verbose:
        print(f"  [+] Extracted {len(result):,} feature vectors")
        print(f"  Features: {len(FEATURE_NAMES)}")

    return result


def _compute_baselines(df: pd.DataFrame) -> dict[str, dict]:
    """Compute baseline statistics from the first portion of data."""
    baselines = {}
    for mid, mdf in df.groupby("merchant_id"):
        # Use first 30% as baseline period
        cutoff = mdf["timestamp"].quantile(0.3)
        baseline_data = mdf[mdf["timestamp"] <= cutoff]

        if len(baseline_data) > 0:
            duration_min = max(
                (baseline_data["timestamp"].max() - baseline_data["timestamp"].min()).total_seconds() / 60,
                1.0
            )
            base_rate = len(baseline_data) / duration_min
            avg_amount = float(baseline_data["amount"].mean())
        else:
            base_rate = 100
            avg_amount = 5000

        baselines[mid] = {
            "base_rate": base_rate,
            "avg_amount": avg_amount,
        }

    return baselines
