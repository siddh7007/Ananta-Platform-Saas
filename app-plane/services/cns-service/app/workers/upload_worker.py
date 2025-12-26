"""
Temporal Worker for BOM Upload Processing

Runs as a background process to execute BOMUploadProcessWorkflow for audit/tracking.

Usage:
    python -m app.workers.upload_worker
"""

import asyncio
import logging
from temporalio.client import Client
from temporalio.worker import Worker

from app.workflows.bom_upload_workflow import (
    BOMUploadProcessWorkflow,
    fetch_bom_upload,
    count_existing_line_items,
    update_bom_upload_status,
    publish_upload_completion_event
)
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """
    Start Temporal worker for BOM upload audit workflows.

    The worker:
    - Connects to Temporal server
    - Registers BOMUploadProcessWorkflow
    - Polls for tasks on the 'bom-upload-processing' queue
    - Executes upload audit workflows in background
    """
    logger.info("🚀 Starting Temporal worker for BOM upload processing...")
    logger.info(f"Temporal Host: {settings.temporal_host}")
    logger.info(f"Task Queue: bom-upload-processing")
    logger.info(f"Namespace: {settings.temporal_namespace}")

    # Initialize database connection (needed for upload activities)
    from app.models.dual_database import init_dual_database
    try:
        init_dual_database()
        logger.info(f"✅ Dual database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")

    try:
        # Connect to Temporal server
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )
        logger.info("✅ Connected to Temporal server")

        # Create worker with workflows and activities
        worker = Worker(
            client,
            task_queue="bom-upload-processing",  # Dedicated queue for upload workflows
            workflows=[BOMUploadProcessWorkflow],
            activities=[
                fetch_bom_upload,
                count_existing_line_items,
                update_bom_upload_status,
                publish_upload_completion_event
            ],
            max_concurrent_workflow_tasks=5,   # Process up to 5 uploads at once
            max_concurrent_activities=10       # Process up to 10 activities at once
        )

        logger.info("✅ Worker configured")
        logger.info("📋 Registered workflows:")
        logger.info("   - BOMUploadProcessWorkflow")
        logger.info("📋 Registered activities:")
        logger.info("   - fetch_bom_upload")
        logger.info("   - count_existing_line_items")
        logger.info("   - update_bom_upload_status")
        logger.info("   - publish_upload_completion_event")
        logger.info("")
        logger.info("🔄 Worker started. Polling for tasks...")

        # Run worker (blocks until shutdown)
        await worker.run()

    except KeyboardInterrupt:
        logger.info("⚠️  Worker shutdown requested")
    except Exception as e:
        logger.error(f"❌ Worker error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())