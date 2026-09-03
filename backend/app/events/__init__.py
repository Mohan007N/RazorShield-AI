"""
RazorShield AI — Kafka Event Streaming.

Event-driven architecture for real-time fraud detection.
"""

from backend.app.events.producer import event_producer
from backend.app.events.schemas import AuditEvent, FraudAlertEvent, PaymentEvent

__all__ = ["event_producer", "PaymentEvent", "FraudAlertEvent", "AuditEvent"]
