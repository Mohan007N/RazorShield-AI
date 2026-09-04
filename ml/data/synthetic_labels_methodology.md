# Synthetic Dataset — Labelling Methodology

## Overview

This dataset is **entirely synthetic** and generated for development, testing, and
benchmarking of the RazorShield AI fraud-spike detection system.

**Performance metrics computed on this dataset represent synthetic benchmark results only.**
They do NOT represent real-world production performance.

## Dataset Statistics

- **Total transactions**: 297,589
- **Normal transactions**: 105,563 (35.5%)
- **Suspicious transactions**: 192,026 (64.5%)
- **Merchants**: 20
- **Date range**: 30 days (2024-01-01 to 2024-01-31)
- **Random seed**: 42

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
