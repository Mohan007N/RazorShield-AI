"""
RazorShield AI — Pydantic Schemas.

Request/response models for API endpoints, internal data transfer, and validation.
All schemas are provider-agnostic (normalized).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    ESCALATED = "escalated"
    FALSE_POSITIVE = "false_positive"


class InvestigationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ESCALATED = "escalated"


class PolicyAction(str, Enum):
    MONITOR = "monitor"
    INVESTIGATE = "investigate"
    ESCALATE = "escalate_for_review"
    ENHANCED_VERIFICATION = "enhanced_verification"
    BLOCK_PENDING_REVIEW = "block_pending_review"


class TransactionSource(str, Enum):
    RAZORPAY = "razorpay"
    SYNTHETIC = "synthetic"
    TEST = "test"


# ── Transaction Schemas ──────────────────────────────────────────

class NormalizedTransaction(BaseModel):
    """Provider-agnostic normalized transaction schema."""
    transaction_id: str
    merchant_id: str
    timestamp: datetime
    amount: float
    currency: str = "INR"
    payment_method: str
    customer_id: Optional[str] = None
    device_id: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "success"
    is_suspicious: bool = False
    source: TransactionSource = TransactionSource.SYNTHETIC
    raw_payload: Optional[dict] = None


class TransactionCreate(BaseModel):
    """API input for creating a transaction."""
    merchant_id: str
    amount: float
    currency: str = "INR"
    payment_method: str
    customer_id: Optional[str] = None
    device_id: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "success"


class TransactionResponse(BaseModel):
    """API response for a transaction."""
    transaction_id: str
    merchant_id: str
    timestamp: datetime
    amount: float
    currency: str
    payment_method: str
    status: str
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Feature Schemas ──────────────────────────────────────────────

class FeatureVector(BaseModel):
    """Complete feature vector for ML inference."""
    # Velocity
    txn_count_1m: float = 0
    txn_count_5m: float = 0
    txn_count_10m: float = 0
    txn_count_30m: float = 0
    txn_count_1h: float = 0

    # Amount
    current_amount: float = 0
    avg_amount: float = 0
    median_amount: float = 0
    amount_deviation: float = 0
    amount_ratio_to_baseline: float = 1.0

    # Device
    unique_devices: int = 0
    new_device_count: int = 0
    new_device_ratio: float = 0
    accounts_per_device: float = 1.0

    # Customer
    unique_customers: int = 0
    new_customer_ratio: float = 0

    # Payment
    payment_method_entropy: float = 1.0
    payment_failure_rate: float = 0
    payment_method_spike: float = 0

    # Time
    hour: int = 0
    day_of_week: int = 0
    time_deviation: float = 0

    # Merchant baseline deviation
    velocity_ratio: float = 1.0
    current_txn_rate: float = 0
    current_suspicious_rate: float = 0

    def to_list(self) -> list[float]:
        """Convert to ordered feature list for model input."""
        return [
            self.txn_count_1m, self.txn_count_5m, self.txn_count_10m,
            self.txn_count_30m, self.txn_count_1h,
            self.current_amount, self.avg_amount, self.median_amount,
            self.amount_deviation, self.amount_ratio_to_baseline,
            float(self.unique_devices), float(self.new_device_count),
            self.new_device_ratio, self.accounts_per_device,
            float(self.unique_customers), self.new_customer_ratio,
            self.payment_method_entropy, self.payment_failure_rate,
            self.payment_method_spike,
            float(self.hour), float(self.day_of_week), self.time_deviation,
            self.velocity_ratio, self.current_txn_rate,
            self.current_suspicious_rate,
        ]

    @classmethod
    def feature_names(cls) -> list[str]:
        """Ordered feature names matching to_list() output."""
        return [
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


# ── Risk Schemas ─────────────────────────────────────────────────

class RiskResult(BaseModel):
    """Combined risk assessment result."""
    ml_score: float = Field(..., ge=0, le=1)
    anomaly_score: float = Field(..., ge=0, le=1)
    spike_ratio: float = Field(..., ge=0)
    overall_risk: float = Field(..., ge=0, le=1)
    risk_level: RiskLevel
    model_version: str
    feature_contributions: Optional[dict[str, float]] = None


# ── Merchant Schemas ─────────────────────────────────────────────

class MerchantBaseline(BaseModel):
    """Merchant baseline statistics."""
    merchant_id: str
    name: str
    baseline_txn_rate: float
    baseline_avg_amount: float
    baseline_failure_rate: float
    baseline_suspicious_rate: float
    risk_tier: str
    policy_config: dict = Field(default_factory=dict)


class MerchantActivity(BaseModel):
    """Current merchant activity snapshot."""
    merchant_id: str
    current_txn_rate: float
    txn_count_1m: float
    txn_count_5m: float
    txn_count_10m: float
    txn_count_30m: float
    velocity_ratio: float
    avg_amount: float
    failure_rate: float
    suspicious_rate: float


# ── Alert Schemas ────────────────────────────────────────────────

class AlertCreate(BaseModel):
    """Internal alert creation schema."""
    merchant_id: str
    risk_score: float
    anomaly_score: float
    spike_ratio: float
    current_txn_rate: float
    baseline_txn_rate: float
    risk_level: RiskLevel
    summary: Optional[str] = None
    features_snapshot: Optional[dict] = None
    model_version: str


class AlertResponse(BaseModel):
    """API response for an alert."""
    id: str
    merchant_id: str
    alert_type: str
    risk_score: float
    anomaly_score: float
    spike_ratio: float
    current_txn_rate: float
    baseline_txn_rate: float
    risk_level: str
    summary: Optional[str]
    status: str
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Investigation Schemas ────────────────────────────────────────

class InvestigationResponse(BaseModel):
    """API response for an investigation."""
    id: str
    alert_id: str
    merchant_id: str
    status: str
    risk_score: float
    confidence: Optional[float]
    summary: Optional[str]
    recommendation: Optional[str]
    recommendation_action: Optional[str]
    tools_called: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    started_at: datetime
    completed_at: Optional[datetime]
    evidence: list["EvidenceResponse"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class EvidenceResponse(BaseModel):
    """API response for evidence."""
    id: str
    source_tool: str
    field: str
    value: str
    confidence: float
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Agent Schemas ────────────────────────────────────────────────

class AgentState(BaseModel):
    """State object for the LangGraph investigation agent."""
    alert_id: str
    merchant_id: str
    risk_score: float
    anomaly_score: float = 0
    spike_ratio: float = 1.0
    investigation_id: Optional[str] = None
    investigation_status: InvestigationStatus = InvestigationStatus.PENDING
    tool_results: dict[str, Any] = Field(default_factory=dict)
    evidence: list[dict] = Field(default_factory=list)
    confidence: Optional[float] = None
    recommendation: Optional[str] = None
    recommendation_action: Optional[PolicyAction] = None
    errors: list[str] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
    current_step: int = 0
    max_steps: int = 15


# ── Policy Schemas ───────────────────────────────────────────────

class PolicyInput(BaseModel):
    """Input for the policy engine."""
    risk_score: float
    anomaly_score: float
    risk_level: RiskLevel
    merchant_id: str
    investigation_evidence: list[dict] = Field(default_factory=list)
    agent_recommendation: str
    merchant_policy: dict = Field(default_factory=dict)


class PolicyResult(BaseModel):
    """Output from the policy engine."""
    allowed_action: PolicyAction
    requires_human_approval: bool
    reasoning: str
    risk_level: RiskLevel


# ── Audit Schemas ────────────────────────────────────────────────

class AuditRecord(BaseModel):
    """Complete audit trail record."""
    id: str
    event_type: str
    alert_id: Optional[str]
    investigation_id: Optional[str]
    merchant_id: Optional[str]
    ml_score: Optional[float]
    anomaly_score: Optional[float]
    model_version: Optional[str]
    tools_called: list[str] = Field(default_factory=list)
    evidence_summary: Optional[dict]
    agent_recommendation: Optional[str]
    policy_result: Optional[str]
    human_approval_status: Optional[str]
    final_result: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Model Metrics ────────────────────────────────────────────────

class ModelMetrics(BaseModel):
    """ML model evaluation metrics."""
    model_version: str
    model_type: str
    precision: float
    recall: float
    f1: float
    pr_auc: float
    false_positives: int
    false_negatives: int
    true_positives: int
    true_negatives: int
    false_positive_rate: float
    false_positive_cost: float
    cost_per_review: float
    test_set_size: int
    test_date_range: Optional[str] = None
    dataset_version: str = "synthetic_v1"
    confusion_matrix: list[list[int]] = Field(default_factory=list)
    threshold: float = 0.5
    is_synthetic_benchmark: bool = True


class BaselineComparison(BaseModel):
    """Comparison of multiple model baselines."""
    models: list[dict[str, Any]]
    best_model: str
    evaluation_note: str = (
        "All metrics computed on held-out synthetic test set. "
        "Performance on real-world data may differ."
    )


# ── System Metrics ───────────────────────────────────────────────

class SystemMetrics(BaseModel):
    """System performance metrics."""
    api_latency_ms: float
    ml_inference_latency_ms: float
    feature_lookup_latency_ms: float
    anomaly_detection_latency_ms: float
    agent_tool_latency_ms: Optional[float] = None
    end_to_end_latency_ms: Optional[float] = None
    active_alerts: int = 0
    total_transactions: int = 0
    total_investigations: int = 0


# ── Simulation ───────────────────────────────────────────────────

class SpikeSimulationRequest(BaseModel):
    """Request to simulate a fraud spike for testing."""
    merchant_id: str = "merchant_001"
    normal_txn_count: int = 120
    spike_txn_count: int = 900
    spike_duration_minutes: int = 5
    suspicious_ratio: float = 0.15
