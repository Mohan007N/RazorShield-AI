"""
RazorShield AI — Risk Worker.

Consumes payment events from Kafka, performs risk scoring,
detects anomalies, and generates alerts for high-risk transactions.

This is the core real-time fraud detection worker.
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys
from datetime import datetime, timedelta
from typing import Optional

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.database import async_session_maker
from backend.app.events.producer import event_producer
from backend.app.events.schemas import PaymentEvent
from backend.app.risk.aggregator import risk_aggregator
from backend.app.risk.anomaly.detector import MerchantAnomalyDetector
from backend.app.risk.inference.engine import risk_engine
from backend.app.services.alert_service import alert_service
from ml.features.engineering import FEATURE_NAMES

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


class RiskWorker:
    """
    Risk Worker — Real-time fraud detection pipeline.
    
    Flow:
        1. Consume payment event from Kafka
        2. Fetch merchant baseline from Redis/DB
        3. Compute real-time features (velocity, device, amount)
        4. Run XGBoost inference
        5. Run anomaly detection
        6. Aggregate risk scores
        7. Generate alert if risk is HIGH/CRITICAL
        8. Publish alert to fraud.alerts topic
    """

    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.redis: Optional[Redis] = None
        self.running = False
        self.anomaly_detector = MerchantAnomalyDetector()

    async def start(self):
        """Start the risk worker."""
        logger.info("Starting Risk Worker...")

        # Initialize Kafka consumer
        try:
            self.consumer = AIOKafkaConsumer(
                "payment.events",
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id="risk-worker-group",
                auto_offset_reset="latest",
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                session_timeout_ms=30000,
                max_poll_records=100,
            )
            await self.consumer.start()
            logger.info("Kafka consumer started: payment.events")
        except KafkaError as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            sys.exit(1)

        # Initialize Redis
        try:
            self.redis = Redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.redis.ping()
            logger.info(f"Redis connected: {settings.redis_url}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            sys.exit(1)

        # Load ML model
        try:
            risk_engine.ensure_loaded()
            logger.info(f"ML model loaded: {risk_engine.model_version}")
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            sys.exit(1)

        # Start event producer
        await event_producer.start()

        self.running = True
        logger.info("✓ Risk Worker ready. Waiting for events...")

        # Setup signal handlers
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda s, f: asyncio.create_task(self.stop()))

    async def stop(self):
        """Stop the risk worker gracefully."""
        logger.info("Stopping Risk Worker...")
        self.running = False

        if self.consumer:
            await self.consumer.stop()
        if self.redis:
            await self.redis.close()

        await event_producer.stop()
        logger.info("✓ Risk Worker stopped")

    async def run(self):
        """Main event processing loop."""
        await self.start()

        try:
            async for message in self.consumer:
                if not self.running:
                    break

                try:
                    await self.process_payment_event(message.value)
                except Exception as e:
                    logger.error(f"Error processing event: {e}", exc_info=True)
                    # Continue processing next event

        except Exception as e:
            logger.error(f"Fatal error in event loop: {e}", exc_info=True)
        finally:
            await self.stop()

    async def process_payment_event(self, event_data: dict):
        """
        Process a single payment event through the risk pipeline.
        
        Args:
            event_data: Deserialized payment event
        """
        try:
            event = PaymentEvent(**event_data)
        except Exception as e:
            logger.error(f"Invalid event schema: {e}")
            return

        transaction_id = event.transaction_id
        merchant_id = event.merchant_id

        logger.debug(f"Processing transaction {transaction_id} for merchant {merchant_id}")

        # ── Step 1: Update Redis with transaction ───────────────
        await self._update_redis_state(event)

        # ── Step 2: Fetch merchant baseline ─────────────────────
        baseline = await self._get_merchant_baseline(merchant_id)

        # ── Step 3: Compute real-time features ──────────────────
        features = await self._compute_features(event, baseline)

        # ── Step 4: Run XGBoost inference ───────────────────────
        ml_result = risk_engine.predict(features)
        ml_score = ml_result["fraud_probability"]

        # ── Step 5: Run anomaly detection ───────────────────────
        anomaly_result = self.anomaly_detector.detect_from_features(
            velocity_ratio=features.get("velocity_ratio", 1.0),
            txn_count_1m=features.get("txn_count_1m", 0),
            new_device_ratio=features.get("new_device_ratio", 0),
            payment_failure_rate=features.get("payment_failure_rate", 0),
            amount_deviation=features.get("amount_deviation", 0),
        )

        # ── Step 6: Aggregate risk scores ───────────────────────
        risk_result = risk_aggregator.assess(
            ml_score=ml_score,
            anomaly_result=anomaly_result,
            model_version=risk_engine.model_version,
        )

        logger.info(
            f"Transaction {transaction_id}: "
            f"ML={ml_score:.3f}, Anomaly={anomaly_result.anomaly_score:.3f}, "
            f"Risk={risk_result.overall_risk:.3f} ({risk_result.risk_level.value})"
        )

        # ── Step 7: Store risk assessment in DB ─────────────────
        await self._store_risk_assessment(event, ml_score, anomaly_result, risk_result, features)

        # ── Step 8: Generate alert if HIGH/CRITICAL ─────────────
        async with async_session_maker() as db:
            should_alert = await alert_service.should_alert(db, risk_result, merchant_id)

            if should_alert:
                logger.warning(
                    f"⚠️  FRAUD SPIKE DETECTED — Merchant {merchant_id} "
                    f"Risk: {risk_result.risk_level.value.upper()}"
                )

                # Create alert in DB
                current_rate = features.get("current_txn_rate", 0)
                baseline_rate = baseline.get("baseline_txn_rate", 100)

                alert = await alert_service.create_alert(
                    db=db,
                    merchant_id=merchant_id,
                    risk_result=risk_result,
                    current_txn_rate=current_rate,
                    baseline_txn_rate=baseline_rate,
                    features_snapshot=features,
                )
                await db.commit()

                # Publish alert to Kafka for investigation
                await event_producer.publish_alert(
                    alert_id=alert.id,
                    merchant_id=merchant_id,
                    alert_type=alert.alert_type,
                    risk_score=alert.risk_score,
                    anomaly_score=alert.anomaly_score,
                    spike_ratio=alert.spike_ratio,
                    risk_level=alert.risk_level,
                    summary=alert.summary,
                    features_snapshot=features,
                )

    async def _update_redis_state(self, event: PaymentEvent):
        """Update Redis with transaction for real-time feature computation."""
        merchant_id = event.merchant_id
        now = datetime.utcnow()

        # Store transaction metadata
        txn_key = f"txn:{merchant_id}:{event.transaction_id}"
        await self.redis.hset(
            txn_key,
            mapping={
                "amount": event.amount,
                "device_id": event.device_id or "",
                "customer_id": event.customer_id or "",
                "payment_method": event.payment_method,
                "status": event.status,
                "timestamp": now.isoformat(),
            },
        )
        await self.redis.expire(txn_key, 3600)  # Keep for 1 hour

        # Update time-windowed counters
        for window_minutes in [1, 5, 10, 30, 60]:
            counter_key = f"velocity:{merchant_id}:{window_minutes}m"
            await self.redis.zincrby(counter_key, 1, now.timestamp())
            await self.redis.expire(counter_key, window_minutes * 60)

        # Track devices
        if event.device_id:
            device_key = f"devices:{merchant_id}"
            await self.redis.sadd(device_key, event.device_id)
            await self.redis.expire(device_key, 3600)

            # New device tracking
            new_device_key = f"new_devices:{merchant_id}:1h"
            is_new = await self.redis.sadd(new_device_key, event.device_id)
            await self.redis.expire(new_device_key, 3600)

    async def _get_merchant_baseline(self, merchant_id: str) -> dict:
        """
        Fetch merchant baseline from Redis cache or DB.
        
        Returns baseline metrics for the merchant.
        """
        # Try Redis cache first
        cache_key = f"baseline:{merchant_id}"
        cached = await self.redis.hgetall(cache_key)

        if cached:
            return {
                "baseline_txn_rate": float(cached.get("txn_rate", 100)),
                "baseline_avg_amount": float(cached.get("avg_amount", 5000)),
                "baseline_failure_rate": float(cached.get("failure_rate", 0.02)),
            }

        # Fallback to DB
        async with async_session_maker() as db:
            from sqlalchemy import select
            from backend.app.db.models import Merchant

            result = await db.execute(
                select(Merchant).where(Merchant.id == merchant_id)
            )
            merchant = result.scalars().first()

            if merchant:
                baseline = {
                    "baseline_txn_rate": merchant.baseline_txn_rate,
                    "baseline_avg_amount": merchant.baseline_avg_amount,
                    "baseline_failure_rate": merchant.baseline_failure_rate,
                }

                # Cache in Redis
                await self.redis.hset(
                    cache_key,
                    mapping={
                        "txn_rate": baseline["baseline_txn_rate"],
                        "avg_amount": baseline["baseline_avg_amount"],
                        "failure_rate": baseline["baseline_failure_rate"],
                    },
                )
                await self.redis.expire(cache_key, 3600)

                return baseline

        # Default baseline
        return {
            "baseline_txn_rate": 100.0,
            "baseline_avg_amount": 5000.0,
            "baseline_failure_rate": 0.02,
        }

    async def _compute_features(self, event: PaymentEvent, baseline: dict) -> dict:
        """
        Compute real-time features for the transaction.
        
        Uses Redis for velocity and device features.
        """
        merchant_id = event.merchant_id
        now = datetime.utcnow()

        # ── Velocity features ────────────────────────────────────
        txn_counts = {}
        for window_minutes in [1, 5, 10, 30, 60]:
            counter_key = f"velocity:{merchant_id}:{window_minutes}m"
            cutoff = (now - timedelta(minutes=window_minutes)).timestamp()
            count = await self.redis.zcount(counter_key, cutoff, "+inf")
            txn_counts[f"txn_count_{window_minutes}m"] = float(count)

        current_rate = txn_counts.get("txn_count_1m", 0) * 60  # txn/hour
        velocity_ratio = current_rate / max(baseline["baseline_txn_rate"], 1)

        # ── Device features ──────────────────────────────────────
        device_key = f"devices:{merchant_id}"
        new_device_key = f"new_devices:{merchant_id}:1h"

        total_devices = await self.redis.scard(device_key)
        new_devices = await self.redis.scard(new_device_key)
        new_device_ratio = new_devices / max(total_devices, 1)

        # ── Amount features ──────────────────────────────────────
        amount = event.amount
        baseline_amount = baseline["baseline_avg_amount"]
        amount_deviation = abs(amount - baseline_amount) / max(baseline_amount, 1)

        # ── Payment features ─────────────────────────────────────
        # Simplified for MVP
        payment_failure_rate = baseline.get("baseline_failure_rate", 0.02)

        # Build full feature vector
        features = {
            "txn_count_1m": txn_counts.get("txn_count_1m", 0),
            "txn_count_5m": txn_counts.get("txn_count_5m", 0),
            "txn_count_10m": txn_counts.get("txn_count_10m", 0),
            "txn_count_30m": txn_counts.get("txn_count_30m", 0),
            "txn_count_1h": txn_counts.get("txn_count_60m", 0),
            "current_amount": amount,
            "avg_amount": baseline_amount,
            "amount_deviation": amount_deviation,
            "velocity_ratio": velocity_ratio,
            "current_txn_rate": current_rate,
            "new_device_ratio": new_device_ratio,
            "payment_failure_rate": payment_failure_rate,
            "unique_devices": float(total_devices),
            "hour": event.timestamp.hour,
            "day_of_week": event.timestamp.weekday(),
        }

        # Fill missing features with defaults
        for feature_name in FEATURE_NAMES:
            if feature_name not in features:
                features[feature_name] = 0.0

        return features

    async def _store_risk_assessment(
        self,
        event: PaymentEvent,
        ml_score: float,
        anomaly_result,
        risk_result,
        features: dict,
    ):
        """Store risk assessment in the database."""
        async with async_session_maker() as db:
            from backend.app.db.models import Transaction, TransactionFeatures, RiskAssessment

            # Create transaction record
            transaction = Transaction(
                id=event.transaction_id,
                merchant_id=event.merchant_id,
                timestamp=event.timestamp,
                amount=event.amount,
                currency=event.currency,
                payment_method=event.payment_method,
                customer_id=event.customer_id,
                device_id=event.device_id,
                location=event.location,
                ip_address=event.ip_address,
                status=event.status,
                source="razorpay",
            )
            db.add(transaction)

            # Create features record
            feature_record = TransactionFeatures(
                transaction_id=event.transaction_id,
                merchant_id=event.merchant_id,
                **{k: v for k, v in features.items() if k in [
                    "txn_count_1m", "txn_count_5m", "txn_count_10m",
                    "txn_count_30m", "txn_count_1h", "current_amount",
                    "avg_amount", "amount_deviation", "velocity_ratio",
                    "current_txn_rate", "new_device_ratio", "payment_failure_rate",
                    "hour", "day_of_week",
                ]},
            )
            db.add(feature_record)

            # Create risk assessment
            risk_assessment = RiskAssessment(
                transaction_id=event.transaction_id,
                merchant_id=event.merchant_id,
                ml_score=ml_score,
                anomaly_score=anomaly_result.anomaly_score,
                spike_ratio=anomaly_result.spike_ratio,
                overall_risk=risk_result.overall_risk,
                risk_level=risk_result.risk_level.value,
                model_version=risk_result.model_version,
            )
            db.add(risk_assessment)

            await db.commit()


async def main():
    """Main entry point for the risk worker."""
    worker = RiskWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
