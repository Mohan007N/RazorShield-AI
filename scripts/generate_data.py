"""
RazorShield AI — Synthetic Transaction Dataset Generator.

Generates realistic synthetic transaction data with defensible labelling rules.
Normal transactions have stable velocity, typical amounts, and consistent device behavior.
Suspicious transactions exhibit velocity spikes, unusual amounts, new-device concentration,
and abnormal timing.

Usage:
    python -m scripts.generate_data

Output:
    ml/data/synthetic_transactions.csv
    ml/data/synthetic_labels_methodology.md
"""

from __future__ import annotations

import argparse
import hashlib
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# ── Configuration ────────────────────────────────────────────────

SEED = 42
NUM_MERCHANTS = 20
DAYS = 30  # 30 days of data
TOTAL_TARGET = 50_000  # approximate total transactions

PAYMENT_METHODS = ["upi", "card", "netbanking", "wallet", "emi"]
LOCATIONS = [
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad",
    "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow",
    "Chandigarh", "Kochi", "Goa", "Nagpur", "Indore",
]

# Merchant archetypes — different baselines
MERCHANT_PROFILES = [
    {"name": "HighVolume Electronics", "base_rate": 200, "avg_amount": 15000, "category": "electronics"},
    {"name": "Small Fashion Store", "base_rate": 30, "avg_amount": 2500, "category": "fashion"},
    {"name": "Premium Jewelry", "base_rate": 10, "avg_amount": 50000, "category": "jewelry"},
    {"name": "Food Delivery", "base_rate": 500, "avg_amount": 450, "category": "food"},
    {"name": "SaaS Platform", "base_rate": 80, "avg_amount": 5000, "category": "saas"},
    {"name": "Online Pharmacy", "base_rate": 60, "avg_amount": 1200, "category": "pharmacy"},
    {"name": "Travel Agency", "base_rate": 25, "avg_amount": 25000, "category": "travel"},
    {"name": "Grocery Store", "base_rate": 150, "avg_amount": 800, "category": "grocery"},
    {"name": "Gaming Platform", "base_rate": 100, "avg_amount": 1500, "category": "gaming"},
    {"name": "Education Platform", "base_rate": 40, "avg_amount": 8000, "category": "education"},
    {"name": "Health & Fitness", "base_rate": 35, "avg_amount": 3000, "category": "health"},
    {"name": "Auto Parts", "base_rate": 20, "avg_amount": 7000, "category": "automotive"},
    {"name": "Home Decor", "base_rate": 45, "avg_amount": 4500, "category": "home"},
    {"name": "Mobile Recharge", "base_rate": 300, "avg_amount": 200, "category": "telecom"},
    {"name": "Insurance", "base_rate": 15, "avg_amount": 20000, "category": "insurance"},
    {"name": "Marketplace Seller A", "base_rate": 120, "avg_amount": 3500, "category": "marketplace"},
    {"name": "Marketplace Seller B", "base_rate": 90, "avg_amount": 2800, "category": "marketplace"},
    {"name": "Digital Services", "base_rate": 70, "avg_amount": 999, "category": "digital"},
    {"name": "Luxury Fashion", "base_rate": 8, "avg_amount": 45000, "category": "luxury"},
    {"name": "Quick Commerce", "base_rate": 250, "avg_amount": 350, "category": "qcommerce"},
]


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)


def generate_merchant_id(idx: int) -> str:
    return f"merchant_{idx + 1:03d}"


def generate_device_pool(merchant_id: str, n_devices: int = 50) -> list[str]:
    """Generate a pool of known devices for a merchant's customers."""
    return [
        f"dev_{hashlib.md5(f'{merchant_id}_device_{i}'.encode()).hexdigest()[:8]}"
        for i in range(n_devices)
    ]


def generate_customer_pool(merchant_id: str, n_customers: int = 200) -> list[str]:
    """Generate a pool of known customers for a merchant."""
    return [
        f"cust_{hashlib.md5(f'{merchant_id}_cust_{i}'.encode()).hexdigest()[:8]}"
        for i in range(n_customers)
    ]


def generate_normal_transaction(
    merchant_id: str,
    profile: dict,
    timestamp: datetime,
    customer_pool: list[str],
    device_pool: list[str],
) -> dict[str, Any]:
    """Generate a single normal (non-suspicious) transaction."""
    amount = max(10, np.random.lognormal(
        mean=np.log(profile["avg_amount"]),
        sigma=0.4
    ))

    # Normal: mostly existing customers and devices
    customer_id = random.choice(customer_pool)
    device_id = random.choice(device_pool)
    location = random.choice(LOCATIONS[:8])  # normal: concentrated in major cities

    # Normal payment method distribution
    pm_weights = [0.45, 0.30, 0.10, 0.10, 0.05]
    payment_method = random.choices(PAYMENT_METHODS, weights=pm_weights, k=1)[0]

    # Normal: very low failure rate
    status = "success" if random.random() > 0.02 else "failed"

    return {
        "merchant_id": merchant_id,
        "timestamp": timestamp,
        "amount": round(amount, 2),
        "currency": "INR",
        "payment_method": payment_method,
        "customer_id": customer_id,
        "device_id": device_id,
        "location": location,
        "status": status,
        "is_suspicious": False,
    }


def generate_suspicious_transaction(
    merchant_id: str,
    profile: dict,
    timestamp: datetime,
    customer_pool: list[str],
    device_pool: list[str],
    attack_type: str,
) -> dict[str, Any]:
    """
    Generate a suspicious transaction based on attack pattern.

    Attack types:
    - velocity_spike: unusual transaction speed
    - amount_anomaly: unusual amounts
    - device_flood: many new devices
    - payment_method_concentration: single payment method
    - geographic_anomaly: unusual locations
    - combined: multiple suspicious signals
    """
    # Base — start from normal
    txn = generate_normal_transaction(
        merchant_id, profile, timestamp, customer_pool, device_pool
    )
    txn["is_suspicious"] = True

    if attack_type in ("velocity_spike", "combined"):
        # Velocity spike doesn't change individual txn, but occurs during a burst window
        pass

    if attack_type in ("amount_anomaly", "combined"):
        # Abnormal amount — either very high or very low
        if random.random() > 0.5:
            txn["amount"] = round(profile["avg_amount"] * random.uniform(5, 20), 2)
        else:
            txn["amount"] = round(random.uniform(1, 50), 2)

    if attack_type in ("device_flood", "combined"):
        # New device not in the known pool
        txn["device_id"] = f"dev_new_{hashlib.md5(f'new_{random.randint(0,99999)}'.encode()).hexdigest()[:8]}"

    if attack_type in ("payment_method_concentration", "combined"):
        # Heavy concentration on a single method (likely card for fraud)
        txn["payment_method"] = "card"

    if attack_type in ("geographic_anomaly", "combined"):
        # Unusual location
        unusual_locations = [
            "Lagos", "Unknown", "Proxy_VPN", "Tor_Exit",
            "Vladivostok", "RandomCity_XYZ",
        ]
        txn["location"] = random.choice(unusual_locations)

    # Higher failure rate for suspicious
    if random.random() > 0.70:
        txn["status"] = "failed"

    return txn


def generate_spike_window(
    merchant_id: str,
    profile: dict,
    spike_start: datetime,
    duration_minutes: int,
    spike_multiplier: float,
    customer_pool: list[str],
    device_pool: list[str],
) -> list[dict[str, Any]]:
    """Generate a burst of suspicious transactions during a spike window."""
    transactions = []
    spike_rate = profile["base_rate"] * spike_multiplier
    total_spike_txns = int(spike_rate * duration_minutes)

    attack_types = ["velocity_spike", "amount_anomaly", "device_flood",
                    "payment_method_concentration", "geographic_anomaly", "combined"]

    # Choose dominant attack pattern for this spike
    dominant = random.choice(attack_types)

    for i in range(total_spike_txns):
        offset = random.uniform(0, duration_minutes * 60)
        ts = spike_start + timedelta(seconds=offset)

        # 70-85% of spike transactions are suspicious
        if random.random() < random.uniform(0.70, 0.85):
            attack = dominant if random.random() < 0.6 else random.choice(attack_types)
            txn = generate_suspicious_transaction(
                merchant_id, profile, ts, customer_pool, device_pool, attack
            )
        else:
            txn = generate_normal_transaction(
                merchant_id, profile, ts, customer_pool, device_pool
            )

        transactions.append(txn)

    return transactions


def generate_dataset() -> pd.DataFrame:
    """Generate the complete synthetic dataset."""
    set_seed()

    all_transactions: list[dict[str, Any]] = []
    start_date = datetime(2024, 1, 1)
    end_date = start_date + timedelta(days=DAYS)

    for idx, profile in enumerate(MERCHANT_PROFILES):
        merchant_id = generate_merchant_id(idx)
        customer_pool = generate_customer_pool(merchant_id)
        device_pool = generate_device_pool(merchant_id)

        # Normal transactions spread across the full period
        daily_txn_count = int(profile["base_rate"] * 60 * 16)  # 16 active hours
        # Scale down to hit target
        scale_factor = TOTAL_TARGET / (sum(p["base_rate"] for p in MERCHANT_PROFILES) * 60 * 16 * DAYS)
        daily_txn_count = max(10, int(daily_txn_count * scale_factor))

        for day in range(DAYS):
            current_date = start_date + timedelta(days=day)

            for _ in range(daily_txn_count):
                # Business hours with some variation
                hour = np.random.choice(
                    range(24),
                    p=_hour_distribution()
                )
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                ts = current_date.replace(hour=hour, minute=minute, second=second)

                txn = generate_normal_transaction(
                    merchant_id, profile, ts, customer_pool, device_pool
                )
                all_transactions.append(txn)

        # Generate 1-3 spike events per merchant across the 30-day period
        num_spikes = random.randint(1, 3)
        for _ in range(num_spikes):
            spike_day = random.randint(5, DAYS - 2)  # not too early/late
            spike_hour = random.randint(8, 22)
            spike_start = start_date + timedelta(
                days=spike_day, hours=spike_hour,
                minutes=random.randint(0, 59)
            )

            spike_multiplier = random.uniform(3.0, 12.0)
            spike_duration = random.randint(2, 15)

            spike_txns = generate_spike_window(
                merchant_id, profile, spike_start, spike_duration,
                spike_multiplier, customer_pool, device_pool,
            )
            all_transactions.extend(spike_txns)

    # Create DataFrame
    df = pd.DataFrame(all_transactions)

    # Add transaction IDs
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["transaction_id"] = [f"tx_{i+1:06d}" for i in range(len(df))]

    # Add IP addresses
    df["ip_address"] = df.apply(
        lambda row: _generate_ip(row["is_suspicious"]), axis=1
    )

    # Reorder columns
    columns = [
        "transaction_id", "merchant_id", "timestamp", "amount", "currency",
        "payment_method", "customer_id", "device_id", "location",
        "ip_address", "status", "is_suspicious",
    ]
    df = df[columns]

    return df


def _hour_distribution() -> list[float]:
    """Realistic business hour distribution — peaks at 10-12 and 15-18."""
    dist = np.array([
        0.005, 0.003, 0.002, 0.002, 0.003, 0.008,  # 0-5
        0.015, 0.025, 0.04, 0.06, 0.08, 0.085,      # 6-11
        0.07, 0.06, 0.065, 0.075, 0.08, 0.075,       # 12-17
        0.06, 0.05, 0.045, 0.04, 0.03, 0.02,         # 18-23
    ])
    return (dist / dist.sum()).tolist()


def _generate_ip(is_suspicious: bool) -> str:
    """Generate a plausible IP address."""
    if is_suspicious and random.random() < 0.3:
        # Suspicious: sometimes from unusual ranges
        return f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}"
    # Normal Indian ISP-like ranges
    prefixes = ["103.21", "49.36", "157.49", "106.51", "182.69", "223.226"]
    prefix = random.choice(prefixes)
    return f"{prefix}.{random.randint(0,255)}.{random.randint(1,255)}"


def save_methodology(output_dir: Path, df: pd.DataFrame) -> None:
    """Save the labelling methodology documentation."""
    total = len(df)
    suspicious = df["is_suspicious"].sum()
    normal = total - suspicious

    methodology = f"""# Synthetic Dataset — Labelling Methodology

## Overview

This dataset is **entirely synthetic** and generated for development, testing, and
benchmarking of the RazorShield AI fraud-spike detection system.

**Performance metrics computed on this dataset represent synthetic benchmark results only.**
They do NOT represent real-world production performance.

## Dataset Statistics

- **Total transactions**: {total:,}
- **Normal transactions**: {normal:,} ({normal/total*100:.1f}%)
- **Suspicious transactions**: {suspicious:,} ({suspicious/total*100:.1f}%)
- **Merchants**: {NUM_MERCHANTS}
- **Date range**: 30 days (2024-01-01 to 2024-01-31)
- **Random seed**: {SEED}

## Labelling Rules

Transactions are labelled as `is_suspicious = True` when they are generated during a
**simulated fraud spike window** and exhibit one or more of the following patterns:

### 1. Velocity Spike
- Transaction rate exceeds 3x–12x the merchant's baseline rate
- Generated during a 2–15 minute burst window

### 2. Amount Anomaly
- Transaction amounts 5x–20x above the merchant average, OR
- Unusually small amounts (₹1–₹50)

### 3. Device Flood
- Device IDs not present in the merchant's historical device pool
- Simulates new/unknown devices used in rapid succession

### 4. Payment Method Concentration
- Heavy concentration on a single payment method (typically card)
- Deviates from the merchant's normal payment method distribution

### 5. Geographic Anomaly
- Locations not in the merchant's normal geographic footprint
- Includes proxy/VPN indicators

### 6. Combined
- Multiple suspicious signals present simultaneously

### Additional Suspicious Indicators
- Higher failure rate: ~30% vs ~2% for normal transactions
- 70–85% of transactions during a spike window are labelled suspicious

## Merchant Profiles

Each merchant has a unique baseline:
- Transaction rate (8–500/min)
- Average amount (₹200–₹50,000)
- Category (electronics, food, fashion, etc.)

This ensures the system must learn merchant-specific behavior, not a single global threshold.

## Limitations

1. Synthetic patterns may not capture all real-world fraud typologies
2. The attack patterns are stylized and may be easier to detect than real fraud
3. Class imbalance is less extreme than typical production data
4. Temporal patterns are simplified
5. No real customer behavior modeling

## Usage

This data should be used for:
- System development and integration testing
- ML model training and validation
- Demonstration and benchmarking

This data should NOT be used for:
- Production fraud detection without re-training on real data
- Claiming real-world detection performance
"""

    with open(output_dir / "synthetic_labels_methodology.md", "w") as f:
        f.write(methodology)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic transaction data")
    parser.add_argument("--output-dir", type=str, default="ml/data",
                        help="Output directory for generated data")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed")
    args = parser.parse_args()

    global SEED
    SEED = args.seed

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("RazorShield AI — Synthetic Data Generator")
    print("=" * 60)

    print("\nGenerating synthetic transactions...")
    df = generate_dataset()

    output_path = output_dir / "synthetic_transactions.csv"
    df.to_csv(output_path, index=False)

    print(f"\n✓ Generated {len(df):,} transactions")
    print(f"  Normal:     {(~df['is_suspicious']).sum():,}")
    print(f"  Suspicious: {df['is_suspicious'].sum():,}")
    print(f"  Merchants:  {df['merchant_id'].nunique()}")
    print(f"  Date range: {df['timestamp'].min()} → {df['timestamp'].max()}")
    print(f"\n✓ Saved to {output_path}")

    # Save methodology
    save_methodology(output_dir, df)
    print(f"✓ Saved labelling methodology to {output_dir / 'synthetic_labels_methodology.md'}")

    # Print per-merchant stats
    print("\n─── Per-Merchant Statistics ───")
    for mid in sorted(df["merchant_id"].unique()):
        mdf = df[df["merchant_id"] == mid]
        susp = mdf["is_suspicious"].sum()
        print(f"  {mid}: {len(mdf):>6,} txns, {susp:>5,} suspicious ({susp/len(mdf)*100:.1f}%)")

    print("\n" + "=" * 60)
    print("Done. Dataset is SYNTHETIC — see methodology file for details.")
    print("=" * 60)


if __name__ == "__main__":
    main()
