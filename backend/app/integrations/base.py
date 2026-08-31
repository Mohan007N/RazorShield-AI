"""
RazorShield AI — Payment Event Provider Abstraction.

The rest of the application does not care which provider generated the transaction.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator

from backend.app.schemas.models import NormalizedTransaction


class PaymentEventProvider(ABC):
    """Abstract base class for payment event providers."""

    @abstractmethod
    async def receive_event(self, raw_payload: dict) -> NormalizedTransaction:
        """Normalize a raw payment event into the internal schema."""
        ...

    @abstractmethod
    async def validate_webhook(self, payload: bytes, signature: str) -> bool:
        """Validate webhook authenticity."""
        ...

    @abstractmethod
    async def generate_test_events(
        self, merchant_id: str, count: int, suspicious_ratio: float
    ) -> list[NormalizedTransaction]:
        """Generate test/synthetic events for development."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        ...
