"""
RazorShield AI — Kafka Event Producer.

Produces payment events to Kafka for asynchronous processing by workers.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

try:
    from aiokafka import AIOKafkaProducer
    from aiokafka.errors import KafkaError
except ImportError:
    AIOKafkaProducer = None
    KafkaError = Exception

from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class EventProducer:
    """
    Kafka event producer for payment events.
    
    Publishes events to topics:
    - payment.events: Raw payment transactions
    - fraud.alerts: High-risk alerts
    """

    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self._started = False

    async def start(self):
        """Initialize and start the Kafka producer."""
        if not settings.kafka_enabled:
            logger.warning("Kafka is disabled. Events will not be produced.")
            return

        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                compression_type="gzip",
                acks="all",  # Wait for all replicas
                max_in_flight_requests_per_connection=5,
                retries=3,
                request_timeout_ms=30000,
            )
            await self.producer.start()
            self._started = True
            logger.info(f"Kafka producer started: {settings.kafka_bootstrap_servers}")
        except KafkaError as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            self._started = False

    async def stop(self):
        """Stop the Kafka producer."""
        if self.producer and self._started:
            await self.producer.stop()
            self._started = False
            logger.info("Kafka producer stopped")

    async def publish_payment_event(
        self,
        transaction_id: str,
        merchant_id: str,
        amount: float,
        currency: str,
        payment_method: str,
        customer_id: Optional[str] = None,
        device_id: Optional[str] = None,
        location: Optional[str] = None,
        ip_address: Optional[str] = None,
        status: str = "success",
        timestamp: Optional[datetime] = None,
        metadata: Optional[dict] = None,
    ) -> bool:
        """
        Publish a payment event to Kafka.
        
        Args:
            transaction_id: Unique transaction ID
            merchant_id: Merchant identifier
            amount: Transaction amount
            currency: Currency code
            payment_method: Payment method used
            customer_id: Customer identifier
            device_id: Device identifier
            location: Transaction location
            ip_address: Customer IP address
            status: Transaction status
            timestamp: Event timestamp
            metadata: Additional metadata
            
        Returns:
            True if published successfully, False otherwise
        """
        if not self._started:
            logger.warning("Kafka producer not started. Skipping event.")
            return False

        event = {
            "event_type": "payment.created",
            "transaction_id": transaction_id,
            "merchant_id": merchant_id,
            "amount": amount,
            "currency": currency,
            "payment_method": payment_method,
            "customer_id": customer_id,
            "device_id": device_id,
            "location": location,
            "ip_address": ip_address,
            "status": status,
            "timestamp": (timestamp or datetime.utcnow()).isoformat(),
            "metadata": metadata or {},
        }

        try:
            # Use merchant_id as partition key for ordered processing per merchant
            await self.producer.send_and_wait(
                topic="payment.events",
                value=event,
                key=merchant_id.encode("utf-8"),
            )
            logger.debug(f"Published payment event: {transaction_id}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to publish payment event {transaction_id}: {e}")
            return False

    async def publish_alert(
        self,
        alert_id: str,
        merchant_id: str,
        alert_type: str,
        risk_score: float,
        anomaly_score: float,
        spike_ratio: float,
        risk_level: str,
        summary: str,
        features_snapshot: Optional[dict] = None,
    ) -> bool:
        """
        Publish a fraud alert to Kafka.
        
        This triggers the LangGraph investigation workflow.
        
        Args:
            alert_id: Alert identifier
            merchant_id: Merchant identifier
            alert_type: Type of alert
            risk_score: ML risk score
            anomaly_score: Anomaly detection score
            spike_ratio: Transaction spike ratio
            risk_level: Risk level (low/medium/high/critical)
            summary: Alert summary
            features_snapshot: Feature values at alert time
            
        Returns:
            True if published successfully, False otherwise
        """
        if not self._started:
            logger.warning("Kafka producer not started. Skipping alert.")
            return False

        event = {
            "event_type": "fraud.alert.created",
            "alert_id": alert_id,
            "merchant_id": merchant_id,
            "alert_type": alert_type,
            "risk_score": risk_score,
            "anomaly_score": anomaly_score,
            "spike_ratio": spike_ratio,
            "risk_level": risk_level,
            "summary": summary,
            "features_snapshot": features_snapshot or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            await self.producer.send_and_wait(
                topic="fraud.alerts",
                value=event,
                key=merchant_id.encode("utf-8"),
            )
            logger.info(f"Published fraud alert: {alert_id} for merchant {merchant_id}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to publish alert {alert_id}: {e}")
            return False

    async def publish_audit_event(
        self,
        event_type: str,
        investigation_id: Optional[str] = None,
        alert_id: Optional[str] = None,
        merchant_id: Optional[str] = None,
        data: Optional[dict] = None,
    ) -> bool:
        """
        Publish an audit event to Kafka.
        
        Args:
            event_type: Type of audit event
            investigation_id: Investigation identifier
            alert_id: Alert identifier
            merchant_id: Merchant identifier
            data: Audit data payload
            
        Returns:
            True if published successfully, False otherwise
        """
        if not self._started:
            logger.warning("Kafka producer not started. Skipping audit event.")
            return False

        event = {
            "event_type": event_type,
            "investigation_id": investigation_id,
            "alert_id": alert_id,
            "merchant_id": merchant_id,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            await self.producer.send_and_wait(
                topic="audit.events",
                value=event,
            )
            logger.debug(f"Published audit event: {event_type}")
            return True
        except KafkaError as e:
            logger.error(f"Failed to publish audit event {event_type}: {e}")
            return False


# Singleton instance
event_producer = EventProducer()
