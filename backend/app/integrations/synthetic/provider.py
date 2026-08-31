"""
RazorShield AI — Synthetic Transaction Provider.

Used when Razorpay credentials are unavailable.
Generates realistic test transactions for development and demos.
"""

from __future__ import annotations

import hashlib
import random
import uuid
from datetime import datetime, timedelta

from backend.app.integrations.base import PaymentEventProvider
from backend.app.schemas.models import NormalizedTransaction, TransactionSource


PAYMENT_METHODS = ["upi", "card", "netbanking", "wallet"]
LOCATIONS = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune"]


class SyntheticProvider(PaymentEventProvider):
    """Generates synthetic transactions for development and testing."""

    @property
    def provider_name(self) -> str:
        return "synthetic"

    async def receive_event(self, raw_payload: dict) -> NormalizedTransaction:
        """Normalize a synthetic event."""
        return NormalizedTransaction(
            transaction_id=raw_payload.get("transaction_id", f"tx_syn_{uuid.uuid4().hex[:8]}"),
            merchant_id=raw_payload["merchant_id"],
            timestamp=datetime.fromisoformat(raw_payload.get("timestamp", datetime.utcnow().isoformat())),
            amount=raw_payload.get("amount", random.uniform(100, 50000)),
            currency=raw_payload.get("currency", "INR"),
            payment_method=raw_payload.get("payment_method", random.choice(PAYMENT_METHODS)),
            customer_id=raw_payload.get("customer_id"),
            device_id=raw_payload.get("device_id"),
            location=raw_payload.get("location"),
            ip_address=raw_payload.get("ip_address"),
            status=raw_payload.get("status", "success"),
            is_suspicious=raw_payload.get("is_suspicious", False),
            source=TransactionSource.SYNTHETIC,
            raw_payload=raw_payload,
        )

    async def validate_webhook(self, payload: bytes, signature: str) -> bool:
        """Synthetic webhooks are always valid."""
        return True

    async def generate_test_events(
        self,
        merchant_id: str,
        count: int,
        suspicious_ratio: float = 0.0,
    ) -> list[NormalizedTransaction]:
        """Generate a batch of test transactions."""
        transactions = []
        now = datetime.utcnow()
        suspicious_count = int(count * suspicious_ratio)

        for i in range(count):
            is_suspicious = i < suspicious_count
            ts = now - timedelta(seconds=random.uniform(0, 60))

            if is_suspicious:
                txn = self._generate_suspicious(merchant_id, ts, i)
            else:
                txn = self._generate_normal(merchant_id, ts, i)

            transactions.append(txn)

        return transactions

    def _generate_normal(
        self, merchant_id: str, timestamp: datetime, idx: int
    ) -> NormalizedTransaction:
        """Generate a normal transaction."""
        return NormalizedTransaction(
            transaction_id=f"tx_syn_{uuid.uuid4().hex[:8]}",
            merchant_id=merchant_id,
            timestamp=timestamp,
            amount=round(random.lognormvariate(8, 0.5), 2),
            currency="INR",
            payment_method=random.choices(PAYMENT_METHODS, weights=[0.45, 0.30, 0.15, 0.10])[0],
            customer_id=f"cust_{hashlib.md5(f'cust_{idx % 200}'.encode()).hexdigest()[:8]}",
            device_id=f"dev_{hashlib.md5(f'dev_{idx % 50}'.encode()).hexdigest()[:8]}",
            location=random.choice(LOCATIONS),
            status="success" if random.random() > 0.02 else "failed",
            is_suspicious=False,
            source=TransactionSource.SYNTHETIC,
        )

    def _generate_suspicious(
        self, merchant_id: str, timestamp: datetime, idx: int
    ) -> NormalizedTransaction:
        """Generate a suspicious transaction."""
        return NormalizedTransaction(
            transaction_id=f"tx_syn_{uuid.uuid4().hex[:8]}",
            merchant_id=merchant_id,
            timestamp=timestamp,
            amount=round(random.uniform(1, 100) if random.random() > 0.5 else random.uniform(50000, 200000), 2),
            currency="INR",
            payment_method="card",
            customer_id=f"cust_new_{uuid.uuid4().hex[:6]}",
            device_id=f"dev_new_{uuid.uuid4().hex[:6]}",
            location=random.choice(["Proxy_VPN", "Unknown", "Lagos"]),
            ip_address=f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}",
            status="success" if random.random() > 0.3 else "failed",
            is_suspicious=True,
            source=TransactionSource.SYNTHETIC,
        )


# Singleton
synthetic_provider = SyntheticProvider()
