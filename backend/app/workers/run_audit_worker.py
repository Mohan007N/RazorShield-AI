#!/usr/bin/env python3
"""
RazorShield AI — Audit Worker Entry Point.

Start the audit worker for async audit log persistence.

Usage:
    python -m backend.app.workers.run_audit_worker
"""

import asyncio
import logging

from backend.app.workers.audit_worker import AuditWorker

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("RazorShield AI — Audit Worker")
    logger.info("=" * 60)

    worker = AuditWorker()
    asyncio.run(worker.run())


if __name__ == "__main__":
    main()
