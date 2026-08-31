"""
RazorShield AI — Alert Service.

Generates fraud-spike alerts when risk conditions are met.
Idempotent alert creation using merchant_id + time window deduplication.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Alert, Merchant
from backend.app.schemas.models import AlertCreate, AlertResponse, RiskLevel, RiskResult


class AlertService:
    """Manages fraud-spike alert creation and retrieval."""

    # Minimum time between alerts for the same merchant (prevents duplicates)
    DEDUP_WINDOW = timedelta(minutes=5)

    async def should_alert(
        self,
        db: AsyncSession,
        risk_result: RiskResult,
        merchant_id: str,
    ) -> bool:
        """Determine if an alert should be generated."""
        # Only alert on HIGH or CRITICAL
        if risk_result.risk_level not in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            return False

        # Check for recent alerts (deduplication)
        cutoff = datetime.utcnow() - self.DEDUP_WINDOW
        stmt = (
            select(Alert)
            .where(Alert.merchant_id == merchant_id)
            .where(Alert.created_at >= cutoff)
            .where(Alert.status.in_(["open", "investigating"]))
        )
        result = await db.execute(stmt)
        existing = result.scalars().first()

        return existing is None

    async def create_alert(
        self,
        db: AsyncSession,
        merchant_id: str,
        risk_result: RiskResult,
        current_txn_rate: float,
        baseline_txn_rate: float,
        features_snapshot: Optional[dict] = None,
    ) -> Alert:
        """
        Create a new fraud-spike alert.

        Returns the created Alert ORM instance.
        """
        alert_id = f"alert_{uuid.uuid4().hex[:12]}"

        summary = (
            f"FRAUD SPIKE DETECTED — Merchant {merchant_id}. "
            f"Current rate: {current_txn_rate:.0f}/min "
            f"(baseline: {baseline_txn_rate:.0f}/min, "
            f"spike: {risk_result.spike_ratio:.1f}x). "
            f"Risk: {risk_result.risk_level.value.upper()}."
        )

        alert = Alert(
            id=alert_id,
            merchant_id=merchant_id,
            alert_type="fraud_spike",
            risk_score=risk_result.overall_risk,
            anomaly_score=risk_result.anomaly_score,
            spike_ratio=risk_result.spike_ratio,
            current_txn_rate=current_txn_rate,
            baseline_txn_rate=baseline_txn_rate,
            risk_level=risk_result.risk_level.value,
            summary=summary,
            features_snapshot=features_snapshot,
            model_version=risk_result.model_version,
            status="open",
        )

        db.add(alert)
        await db.flush()
        return alert

    async def get_alert(self, db: AsyncSession, alert_id: str) -> Optional[Alert]:
        """Retrieve an alert by ID."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        return result.scalars().first()

    async def list_alerts(
        self,
        db: AsyncSession,
        status: Optional[str] = None,
        merchant_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[Alert]:
        """List alerts with optional filtering."""
        stmt = select(Alert).order_by(Alert.created_at.desc()).limit(limit)

        if status:
            stmt = stmt.where(Alert.status == status)
        if merchant_id:
            stmt = stmt.where(Alert.merchant_id == merchant_id)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def update_status(
        self, db: AsyncSession, alert_id: str, status: str
    ) -> Optional[Alert]:
        """Update alert status."""
        alert = await self.get_alert(db, alert_id)
        if alert:
            alert.status = status
            if status == "resolved":
                alert.resolved_at = datetime.utcnow()
            await db.flush()
        return alert


# Singleton
alert_service = AlertService()
