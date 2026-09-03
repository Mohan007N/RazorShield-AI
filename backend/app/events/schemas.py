"""
RazorShield AI — Event Schemas.

Pydantic models for Kafka events to ensure type safety.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PaymentEvent(BaseModel):
    """Payment transaction event schema."""
    
    event_type: str = "payment.created"
    transaction_id: str
    merchant_id: str
    amount: float
    currency: str = "INR"
    payment_method: str
    customer_id: Optional[str] = None
    device_id: Optional[str] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "success"
    timestamp: datetime
    metadata: dict = Field(default_factory=dict)


class FraudAlertEvent(BaseModel):
    """Fraud alert event schema."""
    
    event_type: str = "fraud.alert.created"
    alert_id: str
    merchant_id: str
    alert_type: str
    risk_score: float
    anomaly_score: float
    spike_ratio: float
    risk_level: str
    summary: str
    features_snapshot: dict = Field(default_factory=dict)
    timestamp: datetime


class AuditEvent(BaseModel):
    """Audit event schema."""
    
    event_type: str
    investigation_id: Optional[str] = None
    alert_id: Optional[str] = None
    merchant_id: Optional[str] = None
    data: dict = Field(default_factory=dict)
    timestamp: datetime
