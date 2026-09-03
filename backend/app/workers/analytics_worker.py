"""
RazorShield AI — Analytics Worker.

Aggregates metrics, updates merchant baselines, and maintains
historical performance data.

Runs periodically to:
1. Update merchant baseline statistics
2. Aggregate risk metrics
3. Compute model performance metrics
4. Update cached analytics
"""

from __future__ import annotations

import asyncio
import logging
import signal
from datetime import datetime, timedelta
from typing import Optional

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.database import async_session_maker
from backend.app.db.models import (
    Alert,
    Merchant,
    RiskAssessment,
    Transaction,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


class AnalyticsWorker:
    """
    Analytics Worker — Maintains aggregate metrics and baselines.
    
    Runs periodic jobs:
    - Update merchant baselines (every 5 minutes)
    - Aggregate risk metrics (every 1 minute)
    - Compute model performance (every 15 minutes)
    """

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.running = False

    async def start(self):
        """Start the analytics worker."""
        logger.info("Starting Analytics Worker...")

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
            raise

        self.running = True
        logger.info("✓ Analytics Worker ready")

        # Setup signal handlers
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda s, f: asyncio.create_task(self.stop()))

    async def stop(self):
        """Stop the analytics worker gracefully."""
        logger.info("Stopping Analytics Worker...")
        self.running = False

        if self.redis:
            await self.redis.close()

        logger.info("✓ Analytics Worker stopped")

    async def run(self):
        """Main event loop — runs periodic analytics jobs."""
        await self.start()

        try:
            # Schedule periodic jobs
            tasks = [
                self._run_periodic(self.update_merchant_baselines, interval=300),  # 5 min
                self._run_periodic(self.aggregate_risk_metrics, interval=60),      # 1 min
                self._run_periodic(self.compute_model_performance, interval=900),  # 15 min
            ]

            await asyncio.gather(*tasks)

        except Exception as e:
            logger.error(f"Fatal error in analytics worker: {e}", exc_info=True)
        finally:
            await self.stop()

    async def _run_periodic(self, coro, interval: int):
        """Run a coroutine periodically."""
        while self.running:
            try:
                await coro()
            except Exception as e:
                logger.error(f"Error in periodic task {coro.__name__}: {e}", exc_info=True)

            await asyncio.sleep(interval)

    async def update_merchant_baselines(self):
        """
        Update merchant baseline statistics based on historical data.
        
        Computes rolling averages for:
        - Transaction rate
        - Average amount
        - Failure rate
        - Suspicious rate
        """
        logger.info("Updating merchant baselines...")

        async with async_session_maker() as db:
            # Get all active merchants
            result = await db.execute(
                select(Merchant).where(Merchant.is_active == True)
            )
            merchants = result.scalars().all()

            for merchant in merchants:
                try:
                    await self._update_merchant_baseline(db, merchant)
                except Exception as e:
                    logger.error(
                        f"Error updating baseline for merchant {merchant.id}: {e}",
                        exc_info=True,
                    )

            await db.commit()

        logger.info(f"✓ Updated baselines for {len(merchants)} merchants")

    async def _update_merchant_baseline(self, db: AsyncSession, merchant: Merchant):
        """Update baseline for a single merchant."""
        merchant_id = merchant.id
        lookback = datetime.utcnow() - timedelta(days=7)

        # Query transactions from last 7 days
        txn_query = (
            select(
                func.count(Transaction.id).label("total_count"),
                func.avg(Transaction.amount).label("avg_amount"),
                func.sum(
                    func.case((Transaction.status == "failed", 1), else_=0)
                ).label("failed_count"),
                func.sum(
                    func.case((Transaction.is_suspicious == True, 1), else_=0)
                ).label("suspicious_count"),
            )
            .where(Transaction.merchant_id == merchant_id)
            .where(Transaction.timestamp >= lookback)
        )
        result = await db.execute(txn_query)
        stats = result.first()

        if not stats or stats.total_count == 0:
            return  # No recent data

        # Compute baseline metrics
        total_count = stats.total_count
        time_window_minutes = 7 * 24 * 60  # 7 days in minutes
        baseline_txn_rate = (total_count / time_window_minutes) * 60  # txn/hour

        avg_amount = stats.avg_amount or merchant.baseline_avg_amount
        failure_rate = (stats.failed_count or 0) / total_count
        suspicious_rate = (stats.suspicious_count or 0) / total_count

        # Update merchant baseline
        merchant.baseline_txn_rate = baseline_txn_rate
        merchant.baseline_avg_amount = avg_amount
        merchant.baseline_failure_rate = failure_rate
        merchant.baseline_suspicious_rate = suspicious_rate
        merchant.updated_at = datetime.utcnow()

        # Cache in Redis
        cache_key = f"baseline:{merchant_id}"
        await self.redis.hset(
            cache_key,
            mapping={
                "txn_rate": baseline_txn_rate,
                "avg_amount": avg_amount,
                "failure_rate": failure_rate,
                "suspicious_rate": suspicious_rate,
            },
        )
        await self.redis.expire(cache_key, 3600)

        logger.debug(
            f"Updated baseline for {merchant_id}: "
            f"rate={baseline_txn_rate:.1f}/hr, "
            f"amount={avg_amount:.2f}, "
            f"failure={failure_rate:.3f}"
        )

    async def aggregate_risk_metrics(self):
        """
        Aggregate risk metrics for dashboards and monitoring.
        
        Computes:
        - Total alerts by risk level
        - Average risk scores
        - Alert resolution times
        """
        logger.debug("Aggregating risk metrics...")

        async with async_session_maker() as db:
            # Get alert counts by risk level
            alert_query = (
                select(
                    Alert.risk_level,
                    func.count(Alert.id).label("count"),
                    func.avg(Alert.risk_score).label("avg_score"),
                )
                .where(Alert.created_at >= datetime.utcnow() - timedelta(hours=24))
                .group_by(Alert.risk_level)
            )
            result = await db.execute(alert_query)
            alert_stats = result.all()

            # Cache in Redis
            metrics = {}
            for stat in alert_stats:
                metrics[f"alerts_24h_{stat.risk_level}"] = stat.count
                metrics[f"avg_risk_{stat.risk_level}"] = round(stat.avg_score, 3)

            if metrics:
                await self.redis.hset("metrics:alerts:24h", mapping=metrics)
                await self.redis.expire("metrics:alerts:24h", 3600)

            # Get risk assessment stats
            risk_query = (
                select(
                    func.count(RiskAssessment.id).label("total"),
                    func.avg(RiskAssessment.ml_score).label("avg_ml_score"),
                    func.avg(RiskAssessment.anomaly_score).label("avg_anomaly_score"),
                )
                .where(RiskAssessment.created_at >= datetime.utcnow() - timedelta(hours=1))
            )
            result = await db.execute(risk_query)
            risk_stats = result.first()

            if risk_stats and risk_stats.total > 0:
                risk_metrics = {
                    "transactions_1h": risk_stats.total,
                    "avg_ml_score_1h": round(risk_stats.avg_ml_score, 3),
                    "avg_anomaly_score_1h": round(risk_stats.avg_anomaly_score, 3),
                }
                await self.redis.hset("metrics:risk:1h", mapping=risk_metrics)
                await self.redis.expire("metrics:risk:1h", 3600)

        logger.debug("✓ Risk metrics aggregated")

    async def compute_model_performance(self):
        """
        Compute ML model performance metrics.
        
        Tracks:
        - Prediction distribution
        - Alert precision/recall (if labels available)
        - Model drift indicators
        """
        logger.info("Computing model performance metrics...")

        async with async_session_maker() as db:
            # Get risk score distribution
            lookback = datetime.utcnow() - timedelta(hours=24)

            distribution_query = (
                select(
                    func.count(
                        func.case((RiskAssessment.risk_level == "low", 1))
                    ).label("low"),
                    func.count(
                        func.case((RiskAssessment.risk_level == "medium", 1))
                    ).label("medium"),
                    func.count(
                        func.case((RiskAssessment.risk_level == "high", 1))
                    ).label("high"),
                    func.count(
                        func.case((RiskAssessment.risk_level == "critical", 1))
                    ).label("critical"),
                )
                .where(RiskAssessment.created_at >= lookback)
            )
            result = await db.execute(distribution_query)
            dist = result.first()

            if dist:
                total = dist.low + dist.medium + dist.high + dist.critical
                if total > 0:
                    performance = {
                        "total_predictions_24h": total,
                        "pct_low": round((dist.low / total) * 100, 2),
                        "pct_medium": round((dist.medium / total) * 100, 2),
                        "pct_high": round((dist.high / total) * 100, 2),
                        "pct_critical": round((dist.critical / total) * 100, 2),
                    }

                    await self.redis.hset("metrics:model:24h", mapping=performance)
                    await self.redis.expire("metrics:model:24h", 3600)

                    logger.info(
                        f"✓ Model metrics: {total} predictions, "
                        f"{performance['pct_high'] + performance['pct_critical']:.1f}% high-risk"
                    )


async def main():
    """Main entry point for the analytics worker."""
    worker = AnalyticsWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
