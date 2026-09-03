#!/usr/bin/env python3
"""
RazorShield AI — Risk Worker Entry Point.

Start the risk worker for real-time fraud detection.

Usage:
    python -m backend.app.workers.run_risk_worker
"""

import asyncio
import logging

from backend.app.workers.risk_worker import RiskWorker

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("RazorShield AI — Risk Worker")
    logger.info("=" * 60)

    worker = RiskWorker()
    asyncio.run(worker.run())


if __name__ == "__main__":
    main()
