"""
RazorShield AI — Agent Investigation Tools.

Each tool has structured Pydantic input/output schemas.
Tools query DB/Redis data — they NEVER have arbitrary SQL access or receive secrets.
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime, timedelta
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Tool Input/Output Schemas ────────────────────────────────────

class MerchantBaselineInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID to look up")

class MerchantBaselineOutput(BaseModel):
    merchant_id: str
    name: str
    baseline_txn_rate: float = Field(description="Normal transactions per minute")
    baseline_avg_amount: float = Field(description="Normal average transaction amount in INR")
    baseline_failure_rate: float = Field(description="Normal payment failure rate")
    baseline_suspicious_rate: float = Field(description="Historical suspicious activity rate")
    risk_tier: str
    success: bool = True
    error: Optional[str] = None


class RecentActivityInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID to query")

class RecentActivityOutput(BaseModel):
    merchant_id: str
    current_txn_rate: float = Field(description="Current transactions per minute")
    txn_count_1m: float
    txn_count_5m: float
    txn_count_10m: float
    txn_count_30m: float
    velocity_ratio: float = Field(description="Current rate / baseline rate")
    avg_amount: float
    failure_rate: float
    suspicious_rate: float
    change_from_baseline: str = Field(description="Human-readable change description")
    success: bool = True
    error: Optional[str] = None


class DeviceActivityInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID to query")

class DeviceActivityOutput(BaseModel):
    merchant_id: str
    total_devices: int
    new_device_percentage: float = Field(description="Percentage of devices not seen before")
    device_concentration: str = Field(description="Description of device distribution")
    top_devices: list[dict] = Field(default_factory=list, description="Most active devices")
    accounts_per_device_avg: float
    success: bool = True
    error: Optional[str] = None


class TransactionPatternsInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID to analyze")

class TransactionPatternsOutput(BaseModel):
    merchant_id: str
    amount_distribution: dict = Field(default_factory=dict)
    payment_method_distribution: dict = Field(default_factory=dict)
    geographic_distribution: dict = Field(default_factory=dict)
    unusual_concentrations: list[str] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None


class ModelExplanationInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID for model explanation")
    alert_id: Optional[str] = Field(None, description="The alert ID if available")

class ModelExplanationOutput(BaseModel):
    merchant_id: str
    risk_score: float
    top_contributing_features: dict[str, float] = Field(
        default_factory=dict,
        description="SHAP feature contributions (positive = increases risk)"
    )
    model_version: str = ""
    explanation_note: str = (
        "Feature contributions computed from the actual model using SHAP. "
        "Positive values increase the risk score."
    )
    success: bool = True
    error: Optional[str] = None


class MerchantPolicyInput(BaseModel):
    merchant_id: str = Field(description="The merchant ID to get policy for")

class MerchantPolicyOutput(BaseModel):
    merchant_id: str
    risk_thresholds: dict = Field(default_factory=dict)
    allowed_actions: list[str] = Field(default_factory=list)
    review_requirements: dict = Field(default_factory=dict)
    escalation_contacts: list[str] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None


class CreateInvestigationInput(BaseModel):
    alert_id: str = Field(description="The alert ID to investigate")
    merchant_id: str = Field(description="The merchant ID")
    risk_score: float = Field(description="The risk score from the alert")

class CreateInvestigationOutput(BaseModel):
    investigation_id: str
    alert_id: str
    status: str
    success: bool = True
    error: Optional[str] = None


# ── Tool Data Provider ───────────────────────────────────────────

class ToolDataProvider:
    """
    Provides data to agent tools from the application's data layer.
    This abstracts DB/Redis access so tools never get direct SQL access.

    In production, this would query real DB/Redis.
    For the demo, it uses synthetic data loaded from the data service.
    """

    def __init__(self):
        self._merchant_data: dict[str, dict] = {}
        self._transaction_data: dict[str, list] = {}
        self._device_failure_enabled: bool = False

    def set_merchant_data(self, data: dict[str, dict]) -> None:
        """Load merchant baseline data."""
        self._merchant_data = data

    def set_transaction_data(self, data: dict[str, list]) -> None:
        """Load transaction data grouped by merchant."""
        self._transaction_data = data

    def enable_device_failure(self, enabled: bool = True) -> None:
        """Enable/disable device tool failure for demo purposes."""
        self._device_failure_enabled = enabled

    def get_merchant_baseline(self, merchant_id: str) -> MerchantBaselineOutput:
        """Retrieve merchant baseline information."""
        data = self._merchant_data.get(merchant_id)
        if not data:
            return MerchantBaselineOutput(
                merchant_id=merchant_id,
                name="Unknown",
                baseline_txn_rate=100,
                baseline_avg_amount=5000,
                baseline_failure_rate=0.02,
                baseline_suspicious_rate=0.02,
                risk_tier="standard",
            )
        return MerchantBaselineOutput(
            merchant_id=merchant_id,
            name=data.get("name", "Merchant"),
            baseline_txn_rate=data.get("baseline_txn_rate", 100),
            baseline_avg_amount=data.get("baseline_avg_amount", 5000),
            baseline_failure_rate=data.get("baseline_failure_rate", 0.02),
            baseline_suspicious_rate=data.get("baseline_suspicious_rate", 0.02),
            risk_tier=data.get("risk_tier", "standard"),
        )

    def get_recent_activity(self, merchant_id: str) -> RecentActivityOutput:
        """Get recent merchant transaction activity."""
        txns = self._transaction_data.get(merchant_id, [])
        data = self._merchant_data.get(merchant_id, {})
        baseline_rate = data.get("baseline_txn_rate", 100)

        if not txns:
            return RecentActivityOutput(
                merchant_id=merchant_id,
                current_txn_rate=0,
                txn_count_1m=0, txn_count_5m=0,
                txn_count_10m=0, txn_count_30m=0,
                velocity_ratio=0, avg_amount=0,
                failure_rate=0, suspicious_rate=0,
                change_from_baseline="No recent activity data available",
            )

        now = max(t.get("timestamp", datetime.utcnow()) for t in txns)
        if isinstance(now, str):
            now = datetime.fromisoformat(now)

        def count_in_window(minutes: int) -> int:
            cutoff = now - timedelta(minutes=minutes)
            return sum(1 for t in txns if _parse_ts(t.get("timestamp")) >= cutoff)

        c1m = count_in_window(1)
        c5m = count_in_window(5)
        c10m = count_in_window(10)
        c30m = count_in_window(30)
        current_rate = c1m  # per minute

        velocity_ratio = current_rate / max(baseline_rate / 60, 0.01)
        amounts = [t.get("amount", 0) for t in txns[-100:]]
        avg_amount = sum(amounts) / max(len(amounts), 1)

        recent = txns[-100:]
        failures = sum(1 for t in recent if t.get("status") == "failed")
        failure_rate = failures / max(len(recent), 1)

        suspicious = sum(1 for t in recent if t.get("is_suspicious"))
        suspicious_rate = suspicious / max(len(recent), 1)

        change_desc = f"{velocity_ratio:.1f}x baseline"
        if velocity_ratio > 5:
            change_desc = f"⚠️ SEVERE SPIKE: {velocity_ratio:.1f}x above baseline"
        elif velocity_ratio > 3:
            change_desc = f"⚠️ SPIKE: {velocity_ratio:.1f}x above baseline"
        elif velocity_ratio > 1.5:
            change_desc = f"Elevated: {velocity_ratio:.1f}x above baseline"

        return RecentActivityOutput(
            merchant_id=merchant_id,
            current_txn_rate=current_rate,
            txn_count_1m=c1m, txn_count_5m=c5m,
            txn_count_10m=c10m, txn_count_30m=c30m,
            velocity_ratio=round(velocity_ratio, 2),
            avg_amount=round(avg_amount, 2),
            failure_rate=round(failure_rate, 4),
            suspicious_rate=round(suspicious_rate, 4),
            change_from_baseline=change_desc,
        )

    def get_device_activity(self, merchant_id: str) -> DeviceActivityOutput:
        """Get device activity — can be configured to fail for demo."""
        if self._device_failure_enabled:
            return DeviceActivityOutput(
                merchant_id=merchant_id,
                total_devices=0,
                new_device_percentage=0,
                device_concentration="SERVICE UNAVAILABLE",
                accounts_per_device_avg=0,
                success=False,
                error="Device activity service is currently unavailable. "
                      "This is a known service degradation. "
                      "No device data should be assumed or fabricated.",
            )

        txns = self._transaction_data.get(merchant_id, [])
        devices = [t.get("device_id") for t in txns if t.get("device_id")]

        if not devices:
            return DeviceActivityOutput(
                merchant_id=merchant_id,
                total_devices=0,
                new_device_percentage=0,
                device_concentration="No device data available",
                accounts_per_device_avg=1.0,
            )

        unique_devices = set(devices)
        # Known devices: first 30% of timeline
        known_cutoff = len(txns) // 3
        known_devices = set(
            t.get("device_id") for t in txns[:known_cutoff] if t.get("device_id")
        )
        new_devices = unique_devices - known_devices
        new_pct = len(new_devices) / max(len(unique_devices), 1) * 100

        # Device concentration
        from collections import Counter
        device_counts = Counter(devices[-100:])
        top_devices = [
            {"device_id": d, "transaction_count": c}
            for d, c in device_counts.most_common(5)
        ]

        # Accounts per device
        device_customers: dict[str, set] = {}
        for t in txns[-100:]:
            did = t.get("device_id")
            cid = t.get("customer_id")
            if did and cid:
                device_customers.setdefault(did, set()).add(cid)
        avg_accounts = (
            sum(len(c) for c in device_customers.values()) / max(len(device_customers), 1)
        )

        concentration = "Normal distribution"
        if new_pct > 50:
            concentration = f"HIGH: {new_pct:.0f}% new devices detected"
        elif new_pct > 20:
            concentration = f"Elevated: {new_pct:.0f}% new devices detected"

        return DeviceActivityOutput(
            merchant_id=merchant_id,
            total_devices=len(unique_devices),
            new_device_percentage=round(new_pct, 1),
            device_concentration=concentration,
            top_devices=top_devices,
            accounts_per_device_avg=round(avg_accounts, 2),
        )

    def get_transaction_patterns(self, merchant_id: str) -> TransactionPatternsOutput:
        """Analyze transaction patterns."""
        txns = self._transaction_data.get(merchant_id, [])
        recent = txns[-200:] if txns else []

        if not recent:
            return TransactionPatternsOutput(
                merchant_id=merchant_id,
                unusual_concentrations=["No transaction data available"],
            )

        # Amount distribution
        amounts = [t.get("amount", 0) for t in recent]
        amount_dist = {
            "min": round(min(amounts), 2),
            "max": round(max(amounts), 2),
            "mean": round(sum(amounts) / len(amounts), 2),
            "median": round(sorted(amounts)[len(amounts) // 2], 2),
        }

        # Payment method distribution
        from collections import Counter
        pm_counts = Counter(t.get("payment_method", "unknown") for t in recent)
        total = sum(pm_counts.values())
        pm_dist = {k: round(v / total * 100, 1) for k, v in pm_counts.most_common()}

        # Geographic distribution
        geo_counts = Counter(t.get("location", "unknown") for t in recent)
        geo_dist = {k: round(v / total * 100, 1) for k, v in geo_counts.most_common(10)}

        # Detect unusual concentrations
        unusual = []
        for method, pct in pm_dist.items():
            if pct > 70:
                unusual.append(f"Payment method '{method}' concentration: {pct}%")
        for loc, pct in geo_dist.items():
            if pct > 50 and loc in ("Proxy_VPN", "Tor_Exit", "Unknown", "Lagos"):
                unusual.append(f"Unusual geographic concentration: {loc} ({pct}%)")

        # Amount anomalies
        if amount_dist["max"] > amount_dist["mean"] * 10:
            unusual.append(
                f"Extreme amount outlier: ₹{amount_dist['max']:,.0f} "
                f"(mean: ₹{amount_dist['mean']:,.0f})"
            )

        return TransactionPatternsOutput(
            merchant_id=merchant_id,
            amount_distribution=amount_dist,
            payment_method_distribution=pm_dist,
            geographic_distribution=geo_dist,
            unusual_concentrations=unusual if unusual else ["No unusual concentrations detected"],
        )

    def get_merchant_policy(self, merchant_id: str) -> MerchantPolicyOutput:
        """Get merchant risk policy configuration."""
        data = self._merchant_data.get(merchant_id, {})
        policy = data.get("policy_config", {})

        return MerchantPolicyOutput(
            merchant_id=merchant_id,
            risk_thresholds={
                "low": 0.3,
                "medium": 0.6,
                "high": 0.8,
                "critical": 0.95,
            },
            allowed_actions=[
                "monitor",
                "investigate",
                "escalate_for_review",
                "enhanced_verification",
            ],
            review_requirements={
                "high_risk": "Requires human review before action",
                "critical_risk": "Requires senior analyst approval",
                "auto_escalate_threshold": 0.95,
            },
            escalation_contacts=["risk-team@merchant.com", "fraud-ops@razorshield.ai"],
        )


def _parse_ts(ts: Any) -> datetime:
    """Parse a timestamp from various formats."""
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return datetime.utcnow()


# Singleton
tool_data_provider = ToolDataProvider()
