#!/usr/bin/env python3
"""
RazorShield AI — Analytics Worker Entry Point.

Start the analytics worker for metric aggregation.

Usage:
    python -m backend.app.workers.run_analytics_worker
"""

import asyncio
import logging

from backend.app.workers.analytics_worker import AnalyticsWorker

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("RazorShield AI — Analytics Worker")
    logger.info("=" * 60)

    worker = AnalyticsWorker()
    asyncio.run(worker.run())


if __name__ == "__main__":
    main()
