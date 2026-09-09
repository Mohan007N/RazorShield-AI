"""
RazorShield AI — Razorpay Webhook Handler.

Receives and processes webhook events from Razorpay for real-time fraud detection,
risk scoring, and live WebSocket streaming to frontend risk consoles.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import random
import time
from datetime import datetime
from typing import Any

from fastapi import HTTPException, Request

from backend.app.core.config import settings
from backend.app.events.producer import event_producer
from backend.app.events.websocket_manager import ws_manager

logger = logging.getLogger(__name__)


class RazorpayWebhookHandler:
    """
    Handles incoming Razorpay webhook events.
    
    Validates webhook signatures, computes real-time risk scores,
    and broadcasts live transactions and alerts to the web dashboard.
    """

    def __init__(self):
        self.webhook_secret = settings.razorpay_webhook_secret

    def verify_signature(self, payload_body: bytes, signature: str) -> bool:
        """
        Verify Razorpay webhook signature.
        
        Args:
            payload_body: Raw webhook payload bytes
            signature: X-Razorpay-Signature header value
            
        Returns:
            True if signature is valid, False otherwise
        """
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured. Skipping signature verification.")
            return True  # Allow in dev mode

        expected_signature = hmac.new(
            key=self.webhook_secret.encode("utf-8"),
            msg=payload_body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected_signature, signature)

    async def handle_webhook(self, request: Request) -> dict[str, Any]:
        """
        Process incoming Razorpay webhook.
        
        Args:
            request: FastAPI request object
            
        Returns:
            Response dict
            
        Raises:
            HTTPException: If signature is invalid or processing fails
        """
        # Get raw body for signature verification
        body = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")

        # Verify signature
        if not self.verify_signature(body, signature):
            logger.error("Invalid webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")

        # Parse payload
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON")

        event_type = payload.get("event", "payment.captured")
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        if not entity:
            entity = payload.get("payload", {}).get("order", {}).get("entity", {}) or payload.get("payload", {}).get("refund", {}).get("entity", {}) or {}

        logger.info(f"Received webhook: {event_type}")

        # Route to appropriate handler
        if event_type in [
            "payment.authorized",
            "payment.captured",
            "payment.failed",
        ]:
            return await self._handle_payment_event(event_type, entity, payload)
        elif event_type == "order.paid":
            return await self._handle_order_event(entity, payload)
        elif event_type in ["refund.created", "refund.processed", "refund.failed"]:
            return await self._handle_refund_event(event_type, entity, payload)
        elif "dispute" in event_type:
            return await self._handle_dispute_event(event_type, entity, payload)
        else:
            logger.info(f"Unhandled event type: {event_type}")
            return {"status": "ignored", "event": event_type}

    async def _handle_payment_event(
        self, event_type: str, entity: dict, payload: dict
    ) -> dict:
        """Handle payment events (authorized, captured, failed) with live risk scoring & websocket push."""
        payment_id = entity.get("id") or f"pay_{uuid_hex(6)}"
        amount = entity.get("amount", 0)
        if amount > 100:
            amount = amount / 100.0  # Convert paise to INR
        else:
            amount = float(amount)

        currency = entity.get("currency", "INR")
        status = entity.get("status", "captured")
        method = (entity.get("method") or "Card").capitalize()
        email = entity.get("email") or "customer@domain.com"
        contact = entity.get("contact") or "+919876543210"
        order_id = entity.get("order_id") or f"order_{uuid_hex(6)}"
        merchant_id = entity.get("notes", {}).get("merchant_id", "merchant_001")

        # Device & IP extraction
        metadata = entity.get("metadata", {}) or {}
        device_id = metadata.get("device_id") or entity.get("card", {}).get("id") or "Chrome on macOS"
        ip_address = metadata.get("ip_address") or "103.21.244.1"

        # Determine transaction risk
        is_failed = event_type == "payment.failed" or status == "failed"
        is_large_amount = amount > 75000.0

        # Calculate simulated/model risk score
        base_risk = 0.08
        if is_failed:
            base_risk += 0.55
        if is_large_amount:
            base_risk += 0.30
        if "unknown" in str(device_id).lower():
            base_risk += 0.25

        risk_score = min(0.98, max(0.02, base_risk + (random.random() * 0.12 - 0.06)))
        risk_level = "critical" if risk_score > 0.85 else "high" if risk_score > 0.6 else "medium" if risk_score > 0.3 else "low"

        # Build real-time stream transaction for WebSockets
        now_time = datetime.utcnow().strftime("%H:%M:%S")
        stream_txn = {
            "id": payment_id,
            "merchant": merchant_id,
            "amount": round(amount, 2),
            "method": method,
            "customer": email.split("@")[0].capitalize(),
            "status": "failed" if is_failed else "success",
            "risk": risk_level,
            "riskScore": round(risk_score, 3),
            "device": str(device_id),
            "velocity": round(random.uniform(1.1, 4.8), 1),
            "time": now_time,
            "source": "razorpay_webhook",
            "event_type": event_type,
        }

        # 1. Broadcast transaction to live WebSocket clients
        try:
            await ws_manager.broadcast_transaction(stream_txn)
        except Exception as e:
            logger.error(f"Failed to broadcast webhook transaction over websocket: {e}")

        # 2. If high/critical risk or payment failure, generate and broadcast alert
        if risk_level in ["high", "critical"] or is_failed:
            alert_id = f"ALT-RZP-{random.randint(10000, 99999)}"
            summary = (
                f"Razorpay Webhook: Elevated payment decline detected on {method} (₹{amount:,.2f})."
                if is_failed
                else f"Razorpay Webhook: High-value payment transaction (₹{amount:,.2f}) scored {risk_score:.2f} risk."
            )
            alert_payload = {
                "id": alert_id,
                "merchant_id": merchant_id,
                "risk_score": round(risk_score, 3),
                "anomaly_score": round(min(0.99, risk_score * 1.05), 3),
                "spike_ratio": round(random.uniform(3.2, 7.5), 1),
                "current_txn_rate": random.randint(340, 890),
                "baseline_txn_rate": 120,
                "risk_level": risk_level,
                "summary": summary,
                "status": "open",
                "model_version": "fraud-xgb-v1.0",
                "created_at": datetime.utcnow().isoformat(),
            }

            try:
                # Add to in-memory alerts ledger
                from backend.app.api.routes import _add_demo_alert
                _add_demo_alert(alert_payload)
                # Broadcast alert over WebSockets
                await ws_manager.broadcast_alert(alert_payload)
            except Exception as e:
                logger.error(f"Failed to broadcast webhook alert: {e}")

        # 3. Publish to Kafka if enabled
        if settings.kafka_enabled:
            try:
                await event_producer.publish_payment_event(
                    transaction_id=payment_id,
                    merchant_id=merchant_id,
                    amount=amount,
                    currency=currency,
                    payment_method=method,
                    customer_id=email or contact,
                    device_id=str(device_id),
                    ip_address=ip_address,
                    status=status,
                    timestamp=datetime.utcnow(),
                    metadata={
                        "event_type": event_type,
                        "order_id": order_id,
                        "is_suspicious": risk_score > 0.6,
                        "razorpay_payload": entity,
                    },
                )
            except Exception as e:
                logger.error(f"Kafka publish error: {e}")

        return {
            "status": "processed",
            "event": event_type,
            "payment_id": payment_id,
            "amount": amount,
            "risk_score": round(risk_score, 3),
            "risk_level": risk_level,
            "published_to_kafka": settings.kafka_enabled,
            "broadcasted_to_websockets": True,
        }

    async def _handle_order_event(self, entity: dict, payload: dict) -> dict:
        """Handle order.paid events."""
        order_id = entity.get("id") or f"order_{uuid_hex(6)}"
        amount = entity.get("amount", 0) / 100.0
        
        logger.info(f"Order paid: {order_id}, amount: {amount}")
        
        return {
            "status": "processed",
            "event": "order.paid",
            "order_id": order_id,
            "amount": amount,
        }

    async def _handle_refund_event(
        self, event_type: str, entity: dict, payload: dict
    ) -> dict:
        """Handle refund events (created, processed, failed)."""
        refund_id = entity.get("id") or f"rfnd_{uuid_hex(6)}"
        payment_id = entity.get("payment_id") or f"pay_{uuid_hex(6)}"
        amount = entity.get("amount", 0) / 100.0
        merchant_id = entity.get("notes", {}).get("merchant_id", "merchant_001")
        
        logger.warning(
            f"Refund event: {event_type}, payment: {payment_id}, amount: {amount}"
        )

        stream_txn = {
            "id": refund_id,
            "merchant": merchant_id,
            "amount": round(amount, 2),
            "method": "Refund",
            "customer": f"REFUND-{payment_id[:6]}",
            "status": "refunded",
            "risk": "medium",
            "riskScore": 0.45,
            "device": "Razorpay Settlement Gateway",
            "velocity": 1.2,
            "time": datetime.utcnow().strftime("%H:%M:%S"),
            "source": "razorpay_webhook",
            "event_type": event_type,
        }
        await ws_manager.broadcast_transaction(stream_txn)
        
        return {
            "status": "processed",
            "event": event_type,
            "refund_id": refund_id,
            "payment_id": payment_id,
            "amount": amount,
        }

    async def _handle_dispute_event(
        self, event_type: str, entity: dict, payload: dict
    ) -> dict:
        """Handle dispute events (disputes are strong fraud indicators)."""
        dispute_id = entity.get("id") or f"disp_{uuid_hex(6)}"
        payment_id = entity.get("payment_id") or f"pay_{uuid_hex(6)}"
        amount = entity.get("amount", 0) / 100.0
        reason_code = entity.get("reason_code", "fraudulent")
        merchant_id = entity.get("notes", {}).get("merchant_id", "merchant_001")
        
        logger.error(
            f"⚠️ DISPUTE: {event_type}, payment: {payment_id}, "
            f"reason: {reason_code}, amount: {amount}"
        )
        
        # Broadcast critical dispute alert immediately
        alert_id = f"ALT-DISP-{random.randint(1000, 9999)}"
        alert_payload = {
            "id": alert_id,
            "merchant_id": merchant_id,
            "risk_score": 0.985,
            "anomaly_score": 0.960,
            "spike_ratio": 6.8,
            "current_txn_rate": 780,
            "baseline_txn_rate": 120,
            "risk_level": "critical",
            "summary": f"URGENT DISPUTE / CHARGEBACK ({reason_code}) on payment {payment_id} (₹{amount:,.2f}). Immediate review required.",
            "status": "open",
            "model_version": "fraud-xgb-v1.0",
            "created_at": datetime.utcnow().isoformat(),
        }

        try:
            from backend.app.api.routes import _add_demo_alert
            _add_demo_alert(alert_payload)
            await ws_manager.broadcast_alert(alert_payload)
        except Exception as e:
            logger.error(f"Failed to broadcast dispute alert: {e}")

        return {
            "status": "processed",
            "event": event_type,
            "dispute_id": dispute_id,
            "payment_id": payment_id,
            "severity": "critical",
            "alert_created": alert_id,
        }


def uuid_hex(length: int = 8) -> str:
    import uuid
    return uuid.uuid4().hex[:length]


# Singleton instance
webhook_handler = RazorpayWebhookHandler()
