"""
RazorShield AI — Audit Trail Service.

Creates immutable audit records for every investigation.
The system must never lose the original investigation record.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import AuditLog


class AuditService:
    """Creates and retrieves immutable audit records."""

    async def create_audit_record(
        self,
        db: AsyncSession,
        event_type: str,
        alert_id: Optional[str] = None,
        investigation_id: Optional[str] = None,
        merchant_id: Optional[str] = None,
        ml_score: Optional[float] = None,
        anomaly_score: Optional[float] = None,
        model_version: Optional[str] = None,
        tools_called: Optional[list[str]] = None,
        tool_outputs: Optional[dict] = None,
        evidence_summary: Optional[dict] = None,
        agent_recommendation: Optional[str] = None,
        policy_result: Optional[str] = None,
        human_approval_status: Optional[str] = None,
        final_result: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> AuditLog:
        """Create an immutable audit log entry."""
        audit = AuditLog(
            id=f"audit_{uuid.uuid4().hex[:12]}",
            event_type=event_type,
            alert_id=alert_id,
            investigation_id=investigation_id,
            merchant_id=merchant_id,
            ml_score=ml_score,
            anomaly_score=anomaly_score,
            model_version=model_version,
            tools_called=tools_called or [],
            tool_outputs=tool_outputs,
            evidence_summary=evidence_summary,
            agent_recommendation=agent_recommendation,
            policy_result=policy_result,
            human_approval_status=human_approval_status,
            final_result=final_result,
            metadata=metadata,
            timestamp=datetime.utcnow(),
        )
        db.add(audit)
        await db.flush()
        return audit

    async def get_audit_trail(
        self,
        db: AsyncSession,
        investigation_id: Optional[str] = None,
        alert_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[AuditLog]:
        """Retrieve audit trail for an investigation or alert."""
        stmt = select(AuditLog).order_by(AuditLog.timestamp.asc()).limit(limit)

        if investigation_id:
            stmt = stmt.where(AuditLog.investigation_id == investigation_id)
        elif alert_id:
            stmt = stmt.where(AuditLog.alert_id == alert_id)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def list_recent_audits(
        self,
        db: AsyncSession,
        limit: int = 50,
        event_type: Optional[str] = None,
    ) -> list[AuditLog]:
        """List recent audit records."""
        stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
        if event_type:
            stmt = stmt.where(AuditLog.event_type == event_type)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    def create_sync_audit_record(
        self,
        event_type: str,
        **kwargs: Any,
    ) -> dict:
        """Create an audit record dict for sync contexts (returned to caller for persistence)."""
        return {
            "id": f"audit_{uuid.uuid4().hex[:12]}",
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs,
        }


# Singleton
audit_service = AuditService()
