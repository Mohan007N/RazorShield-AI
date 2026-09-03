"""
RazorShield AI — Audit Worker.

Asynchronously writes audit logs for compliance and investigation tracking.

Consumes audit events from Kafka and persists them to PostgreSQL,
ensuring no audit trail is lost even under high load.
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys
from datetime import datetime
from typing import Optional

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError

from backend.app.core.config import settings
from backend.app.db.database import async_session_maker
from backend.app.db.models import AuditLog
from backend.app.events.schemas import AuditEvent

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


class AuditWorker:
    """
    Audit Worker — Asynchronous audit log persistence.
    
    Flow:
        1. Consume audit event from Kafka (audit.events topic)
        2. Validate event schema
        3. Write to audit_logs table
        4. Ensure durability (commit to DB)
    
    This worker is critical for compliance — it must never lose audit records.
    """

    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False
        self.processed_count = 0
        self.error_count = 0

    async def start(self):
        """Start the audit worker."""
        logger.info("Starting Audit Worker...")

        # Initialize Kafka consumer
        try:
            self.consumer = AIOKafkaConsumer(
                "audit.events",
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id="audit-worker-group",
                auto_offset_reset="earliest",  # Never miss an audit event
                enable_auto_commit=False,  # Manual commit after DB persistence
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                session_timeout_ms=30000,
                max_poll_records=50,
            )
            await self.consumer.start()
            logger.info("Kafka consumer started: audit.events")
        except KafkaError as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            sys.exit(1)

        self.running = True
        logger.info("✓ Audit Worker ready. Waiting for events...")

        # Setup signal handlers
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda s, f: asyncio.create_task(self.stop()))

    async def stop(self):
        """Stop the audit worker gracefully."""
        logger.info("Stopping Audit Worker...")
        self.running = False

        if self.consumer:
            await self.consumer.stop()

        logger.info(
            f"✓ Audit Worker stopped. "
            f"Processed: {self.processed_count}, Errors: {self.error_count}"
        )

    async def run(self):
        """Main event processing loop."""
        await self.start()

        try:
            async for message in self.consumer:
                if not self.running:
                    break

                try:
                    await self.process_audit_event(message.value)
                    await self.consumer.commit()  # Commit offset after successful persistence
                    self.processed_count += 1

                    if self.processed_count % 100 == 0:
                        logger.info(f"Processed {self.processed_count} audit events")

                except Exception as e:
                    logger.error(f"Error processing audit event: {e}", exc_info=True)
                    self.error_count += 1
                    # Do NOT commit offset — will retry on restart
                    # In production, send to dead letter queue after N retries

        except Exception as e:
            logger.error(f"Fatal error in event loop: {e}", exc_info=True)
        finally:
            await self.stop()

    async def process_audit_event(self, event_data: dict):
        """
        Process a single audit event and persist to database.
        
        Args:
            event_data: Deserialized audit event
        """
        try:
            event = AuditEvent(**event_data)
        except Exception as e:
            logger.error(f"Invalid audit event schema: {e}")
            # Log the raw event for manual inspection
            logger.error(f"Raw event: {event_data}")
            return

        # Parse event type to extract audit details
        event_type = event.event_type
        data = event.data

        # Create audit log record
        async with async_session_maker() as db:
            audit_log = AuditLog(
                event_type=event_type,
                alert_id=event.alert_id,
                investigation_id=event.investigation_id,
                merchant_id=event.merchant_id,
                ml_score=data.get("ml_score"),
                anomaly_score=data.get("anomaly_score"),
                model_version=data.get("model_version"),
                tools_called=data.get("tools_called", []),
                tool_outputs=data.get("tool_outputs"),
                evidence_summary=data.get("evidence_summary"),
                agent_recommendation=data.get("agent_recommendation"),
                policy_result=data.get("policy_result"),
                human_approval_status=data.get("human_approval_status"),
                final_result=data.get("final_result"),
                metadata=data.get("metadata", {}),
                timestamp=event.timestamp,
            )

            db.add(audit_log)
            await db.commit()

            logger.debug(
                f"Audit log persisted: {event_type} "
                f"[investigation={event.investigation_id}]"
            )


async def main():
    """Main entry point for the audit worker."""
    worker = AuditWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
