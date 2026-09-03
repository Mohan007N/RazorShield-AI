"""
RazorShield AI — Razorpay Webhook Handler.

Receives and processes webhook events from Razorpay for real-time fraud detection.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import HTTPException, Request

from backend.app.core.config import settings
from backend.app.events.producer import event_producer

logger = logging.getLogger(__name__)


class RazorpayWebhookHandler:
    """
    Handles incoming Razorpay webhook events.
    
    Validates webhook signatures and publishes events to Kafka for processing.
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

        event_type = payload.get("event")
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

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
        """Handle payment events (authorized, captured, failed)."""
        payment_id = entity.get("id")
        amount = entity.get("amount", 0) / 100  # Convert paise to rupees
        currency = entity.get("currency", "INR")
        status = entity.get("status")
        method = entity.get("method")
        email = entity.get("email")
        contact = entity.get("contact")
        order_id = entity.get("order_id")
        
        # Extract merchant/merchant-related info
        # In production, you'd map this to your merchant system
        merchant_id = entity.get("notes", {}).get("merchant_id", "razorpay_merchant")

        # Extract device/location info
        metadata = entity.get("metadata", {}) or {}
        device_id = metadata.get("device_id") or entity.get("card", {}).get("id")
        ip_address = metadata.get("ip_address")

        # Determine transaction status
        is_suspicious = False
        if event_type == "payment.failed":
            is_suspicious = True  # Failed payments can indicate fraud attempts
        elif status == "failed":
            is_suspicious = True

        # Publish to Kafka if enabled
        if settings.kafka_enabled:
            published = await event_producer.publish_payment_event(
                transaction_id=payment_id,
                merchant_id=merchant_id,
                amount=amount,
                currency=currency,
                payment_method=method,
                customer_id=email or contact,
                device_id=device_id,
                ip_address=ip_address,
                status=status,
                timestamp=datetime.utcnow(),
                metadata={
                    "event_type": event_type,
                    "order_id": order_id,
                    "is_suspicious": is_suspicious,
                    "razorpay_payload": entity,
                },
            )

            if published:
                logger.info(f"Published payment event to Kafka: {payment_id}")
            else:
                logger.error(f"Failed to publish payment event: {payment_id}")

        return {
            "status": "processed",
            "event": event_type,
            "payment_id": payment_id,
            "amount": amount,
            "published_to_kafka": settings.kafka_enabled,
        }

    async def _handle_order_event(self, entity: dict, payload: dict) -> dict:
        """Handle order.paid events."""
        order_id = entity.get("id")
        amount = entity.get("amount", 0) / 100
        
        logger.info(f"Order paid: {order_id}, amount: {amount}")
        
        return {
            "status": "processed",
            "event": "order.paid",
            "order_id": order_id,
        }

    async def _handle_refund_event(
        self, event_type: str, entity: dict, payload: dict
    ) -> dict:
        """Handle refund events (created, processed, failed)."""
        refund_id = entity.get("id")
        payment_id = entity.get("payment_id")
        amount = entity.get("amount", 0) / 100
        
        # Refunds can be fraud indicators (chargebacks)
        logger.warning(
            f"Refund event: {event_type}, payment: {payment_id}, amount: {amount}"
        )
        
        # TODO: Update risk assessment for the original transaction
        # TODO: Flag merchant for increased scrutiny
        
        return {
            "status": "processed",
            "event": event_type,
            "refund_id": refund_id,
            "payment_id": payment_id,
        }

    async def _handle_dispute_event(
        self, event_type: str, entity: dict, payload: dict
    ) -> dict:
        """Handle dispute events (disputes are strong fraud indicators)."""
        dispute_id = entity.get("id")
        payment_id = entity.get("payment_id")
        amount = entity.get("amount", 0) / 100
        reason_code = entity.get("reason_code")
        
        logger.error(
            f"⚠️ DISPUTE: {event_type}, payment: {payment_id}, "
            f"reason: {reason_code}, amount: {amount}"
        )
        
        # TODO: Automatically flag as high-risk
        # TODO: Trigger investigation
        # TODO: Update merchant risk profile
        
        return {
            "status": "processed",
            "event": event_type,
            "dispute_id": dispute_id,
            "payment_id": payment_id,
            "severity": "high",
        }


# Singleton instance
webhook_handler = RazorpayWebhookHandler()
