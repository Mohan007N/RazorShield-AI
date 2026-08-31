"""
RazorShield AI — SQLAlchemy ORM Models.

All 11 core tables with proper foreign keys, indexes, and constraints.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base


# ── Helpers ──────────────────────────────────────────────────────

def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.utcnow()


# ── 1. Merchants ─────────────────────────────────────────────────

class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(128))
    risk_tier: Mapped[str] = mapped_column(String(32), default="standard")
    baseline_txn_rate: Mapped[float] = mapped_column(Float, default=100.0)
    baseline_avg_amount: Mapped[float] = mapped_column(Float, default=5000.0)
    baseline_failure_rate: Mapped[float] = mapped_column(Float, default=0.02)
    baseline_suspicious_rate: Mapped[float] = mapped_column(Float, default=0.02)
    policy_config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="merchant")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="merchant")


# ── 2. Transactions ─────────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    merchant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("merchants.id"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_id: Mapped[Optional[str]] = mapped_column(String(64))
    device_id: Mapped[Optional[str]] = mapped_column(String(64))
    location: Mapped[Optional[str]] = mapped_column(String(128))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    status: Mapped[str] = mapped_column(String(32), default="success")
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(32), default="synthetic")
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    merchant: Mapped["Merchant"] = relationship(back_populates="transactions")
    features: Mapped[Optional["TransactionFeatures"]] = relationship(
        back_populates="transaction", uselist=False
    )
    risk_assessment: Mapped[Optional["RiskAssessment"]] = relationship(
        back_populates="transaction", uselist=False
    )

    __table_args__ = (
        Index("ix_transactions_merchant_ts", "merchant_id", "timestamp"),
        Index("ix_transactions_customer", "customer_id"),
    )


# ── 3. Transaction Features ─────────────────────────────────────

class TransactionFeatures(Base):
    __tablename__ = "features"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: str(_uuid())
    )
    transaction_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("transactions.id"), unique=True, nullable=False
    )
    merchant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Velocity features
    txn_count_1m: Mapped[float] = mapped_column(Float, default=0)
    txn_count_5m: Mapped[float] = mapped_column(Float, default=0)
    txn_count_10m: Mapped[float] = mapped_column(Float, default=0)
    txn_count_30m: Mapped[float] = mapped_column(Float, default=0)
    txn_count_1h: Mapped[float] = mapped_column(Float, default=0)

    # Amount features
    current_amount: Mapped[float] = mapped_column(Float, default=0)
    avg_amount: Mapped[float] = mapped_column(Float, default=0)
    median_amount: Mapped[float] = mapped_column(Float, default=0)
    amount_deviation: Mapped[float] = mapped_column(Float, default=0)
    amount_ratio_to_baseline: Mapped[float] = mapped_column(Float, default=1.0)

    # Device features
    unique_devices: Mapped[int] = mapped_column(Integer, default=0)
    new_device_count: Mapped[int] = mapped_column(Integer, default=0)
    new_device_ratio: Mapped[float] = mapped_column(Float, default=0)
    accounts_per_device: Mapped[float] = mapped_column(Float, default=1.0)

    # Customer features
    unique_customers: Mapped[int] = mapped_column(Integer, default=0)
    new_customer_ratio: Mapped[float] = mapped_column(Float, default=0)

    # Payment features
    payment_method_entropy: Mapped[float] = mapped_column(Float, default=1.0)
    payment_failure_rate: Mapped[float] = mapped_column(Float, default=0)
    payment_method_spike: Mapped[float] = mapped_column(Float, default=0)

    # Time features
    hour: Mapped[int] = mapped_column(Integer, default=0)
    day_of_week: Mapped[int] = mapped_column(Integer, default=0)
    time_deviation: Mapped[float] = mapped_column(Float, default=0)

    # Merchant baseline deviation
    velocity_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    current_txn_rate: Mapped[float] = mapped_column(Float, default=0)
    current_suspicious_rate: Mapped[float] = mapped_column(Float, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    transaction: Mapped["Transaction"] = relationship(back_populates="features")


# ── 4. Risk Assessments ──────────────────────────────────────────

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: str(_uuid())
    )
    transaction_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("transactions.id"), unique=True, nullable=False
    )
    merchant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ml_score: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0)
    spike_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    overall_risk: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    feature_contributions: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    transaction: Mapped["Transaction"] = relationship(back_populates="risk_assessment")

    __table_args__ = (
        Index("ix_risk_merchant_ts", "merchant_id", "created_at"),
    )


# ── 5. Alerts ────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"alert_{_uuid().hex[:12]}"
    )
    merchant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("merchants.id"), nullable=False
    )
    alert_type: Mapped[str] = mapped_column(String(64), default="fraud_spike")
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0)
    spike_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    current_txn_rate: Mapped[float] = mapped_column(Float, default=0)
    baseline_txn_rate: Mapped[float] = mapped_column(Float, default=0)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    features_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    merchant: Mapped["Merchant"] = relationship(back_populates="alerts")
    investigation: Mapped[Optional["Investigation"]] = relationship(
        back_populates="alert", uselist=False
    )

    __table_args__ = (
        Index("ix_alerts_merchant", "merchant_id"),
        Index("ix_alerts_status", "status"),
        Index("ix_alerts_created", "created_at"),
    )


# ── 6. Investigations ───────────────────────────────────────────

class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"inv_{_uuid().hex[:12]}"
    )
    alert_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("alerts.id"), unique=True, nullable=False
    )
    merchant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    recommendation: Mapped[Optional[str]] = mapped_column(Text)
    recommendation_action: Mapped[Optional[str]] = mapped_column(String(64))
    tools_called: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    errors: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    alert: Mapped["Alert"] = relationship(back_populates="investigation")
    evidence: Mapped[list["InvestigationEvidence"]] = relationship(
        back_populates="investigation"
    )
    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="investigation")

    __table_args__ = (
        UniqueConstraint("alert_id", name="uq_investigation_alert"),
    )


# ── 7. Investigation Evidence ────────────────────────────────────

class InvestigationEvidence(Base):
    __tablename__ = "investigation_evidence"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"ev_{_uuid().hex[:12]}"
    )
    investigation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("investigations.id"), nullable=False
    )
    source_tool: Mapped[str] = mapped_column(String(64), nullable=False)
    source_record: Mapped[Optional[str]] = mapped_column(String(128))
    field: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    data_type: Mapped[str] = mapped_column(String(32), default="string")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)

    investigation: Mapped["Investigation"] = relationship(back_populates="evidence")

    __table_args__ = (
        Index("ix_evidence_investigation", "investigation_id"),
    )


# ── 8. Agent Runs ───────────────────────────────────────────────

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"run_{_uuid().hex[:12]}"
    )
    investigation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("investigations.id"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    node_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tool_name: Mapped[Optional[str]] = mapped_column(String(64))
    tool_input: Mapped[Optional[dict]] = mapped_column(JSON)
    tool_output: Mapped[Optional[dict]] = mapped_column(JSON)
    tool_success: Mapped[bool] = mapped_column(Boolean, default=True)
    tool_latency_ms: Mapped[Optional[float]] = mapped_column(Float)
    llm_reasoning: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    investigation: Mapped["Investigation"] = relationship(back_populates="agent_runs")

    __table_args__ = (
        Index("ix_agent_runs_investigation", "investigation_id"),
    )


# ── 9. Policy Decisions ─────────────────────────────────────────

class PolicyDecision(Base):
    __tablename__ = "policy_decisions"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"pol_{_uuid().hex[:12]}"
    )
    investigation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("investigations.id"), nullable=False
    )
    merchant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    agent_recommendation: Mapped[str] = mapped_column(String(64), nullable=False)
    policy_action: Mapped[str] = mapped_column(String(64), nullable=False)
    requires_human_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    human_approved: Mapped[Optional[bool]] = mapped_column(Boolean)
    human_approver: Mapped[Optional[str]] = mapped_column(String(128))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    reasoning: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_policy_investigation", "investigation_id"),
    )


# ── 10. Audit Logs ──────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"audit_{_uuid().hex[:12]}"
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    alert_id: Mapped[Optional[str]] = mapped_column(String(64))
    investigation_id: Mapped[Optional[str]] = mapped_column(String(64))
    merchant_id: Mapped[Optional[str]] = mapped_column(String(64))
    ml_score: Mapped[Optional[float]] = mapped_column(Float)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float)
    model_version: Mapped[Optional[str]] = mapped_column(String(32))
    tools_called: Mapped[Optional[list]] = mapped_column(JSON)
    tool_outputs: Mapped[Optional[dict]] = mapped_column(JSON)
    evidence_summary: Mapped[Optional[dict]] = mapped_column(JSON)
    agent_recommendation: Mapped[Optional[str]] = mapped_column(Text)
    policy_result: Mapped[Optional[str]] = mapped_column(String(64))
    human_approval_status: Mapped[Optional[str]] = mapped_column(String(32))
    final_result: Mapped[Optional[str]] = mapped_column(Text)
    metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_audit_alert", "alert_id"),
        Index("ix_audit_investigation", "investigation_id"),
        Index("ix_audit_timestamp", "timestamp"),
        Index("ix_audit_event_type", "event_type"),
    )


# ── 11. Model Versions ──────────────────────────────────────────

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"model_{_uuid().hex[:12]}"
    )
    version: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    model_type: Mapped[str] = mapped_column(String(64), default="xgboost")
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    training_data_info: Mapped[Optional[dict]] = mapped_column(JSON)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON)
    hyperparameters: Mapped[Optional[dict]] = mapped_column(JSON)
    feature_names: Mapped[Optional[list]] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_model_active", "is_active"),
    )
