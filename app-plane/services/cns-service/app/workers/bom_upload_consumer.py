"""
BOM Upload Event Consumer - Unified for CBP and CNS

Listens for BOTH 'customer.bom.uploaded' AND 'cns.bom.bulk_uploaded' events
from RabbitMQ and starts Temporal workflows to process BOM uploads.

Supports:
- Customer Portal (CBP) uploads: priority=7 (HIGH)
- CNS Bulk uploads: priority=5 (MEDIUM)
- Single Temporal scheduler handles both with varying priorities

Event Flow:
  CBP/CNS → Supabase bom_uploads → RabbitMQ Event → This Consumer → Temporal Workflow

Event Formats:
  CBP: customer.bom.uploaded (priority=7)
  {
    "bom_id": "uuid",
    "project_id": "uuid",
    "organization_id": "uuid",
    "filename": "bom.csv",
    "status": "pending",
    "total_rows": 100,
    "timestamp": "2025-11-10T12:34:56Z"
  }

  CNS: cns.bom.bulk_uploaded (priority=5)
  {
    "bom_id": "uuid",
    "organization_id": "uuid",
    "admin_id": "uuid",
    "filename": "bulk.csv",
    "file_size": 12345,
    "s3_key": "organization_id/upload_id/file.csv",
    "s3_bucket": "uploads",
    "storage_backend": "minio"
  }

Usage:
    python -m app.workers.bom_upload_consumer
"""

import asyncio
import logging
from typing import Dict, Any, Tuple
from app.workers.base_consumer import BaseRStreamConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BOMUploadConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Streams consumer for BOM upload events
    Extends BaseRStreamConsumer with upload processing logic
    """

    def __init__(self):
        # Initialize base class with stream config
        super().__init__(
            stream='stream.platform.bom',
            consumer_name='bom-upload-consumer',
            routing_keys=['customer.bom.uploaded', 'cns.bom.bulk_uploaded']
        )

    async def handle_message(self, event_data: Dict[str, Any], routing_key: str, priority: int) -> Tuple[bool, str]:
        """
        Handle BOM uploaded events (both CBP and CNS) by starting Temporal workflow

        Args:
            event_data: Event payload from RabbitMQ message
            routing_key: Event routing key (customer.bom.uploaded or cns.bom.bulk_uploaded)
            priority: Priority level (1-9, from RabbitMQ message properties)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should retry) or 'permanent' (should drop) or '' (success)
        """
        try:
            # Determine upload source
            is_cns_bulk = routing_key == 'cns.bom.bulk_uploaded'
            source_label = "CNS Bulk" if is_cns_bulk else "CBP"

            logger.info(
                f"📥 Received {source_label} upload event: {event_data.get('upload_id')} "
                f"(priority={priority}, source={routing_key})"
            )

            # Extract common fields
            bom_upload_id = event_data.get('upload_id')  # bom_uploads.id (NOT bom_id from boms table!)
            organization_id = event_data.get('organization_id')
            filename = event_data.get('filename')

            if not bom_upload_id or not organization_id:
                logger.error(f"Invalid event data: missing required fields")
                return (False, 'permanent')

            # Extract source-specific fields
            if is_cns_bulk:
                # CNS bulk upload - has S3 location
                s3_key = event_data.get('s3_key')
                s3_bucket = event_data.get('s3_bucket')
                admin_id = event_data.get('admin_id')
                project_id = event_data.get('project_id')  # Optional for CNS

                logger.info(f"   S3 Location: s3://{s3_bucket}/{s3_key}")
                logger.info(f"   Admin: {admin_id}")
            else:
                # CBP upload - already parsed client-side
                project_id = event_data.get('project_id')
                total_rows = event_data.get('total_rows', 0)

                logger.info(f"   Project: {project_id}")
                logger.info(f"   Total rows: {total_rows}")

            # Import workflow class
            from app.workflows.bom_upload_workflow import (
                BOMUploadProcessWorkflow,
                BOMUploadProcessRequest
            )

            # Create workflow request with priority and source info
            request = BOMUploadProcessRequest(
                bom_upload_id=bom_upload_id, organization_id=organization_id,
                project_id=project_id,
                filename=filename,
                priority=priority  # Pass priority to workflow
            )

            # Start Temporal workflow
            workflow_id = f"bom-upload-{bom_upload_id}"
            logger.info(
                f"🚀 Starting Temporal workflow: {workflow_id} "
                f"(priority={priority}, source={source_label})"
            )

            # Start workflow with priority metadata
            handle = await self.temporal_client.start_workflow(
                BOMUploadProcessWorkflow.run,
                request,
                id=workflow_id,
                task_queue="bom-upload-processing",
                # Add metadata for observability
                memo={
                    'source': source_label,
                    'priority': priority,
                    'event_type': routing_key,
                    'organization_id': organization_id
                }
            )

            logger.info(f"✅ Workflow started: {workflow_id}")
            logger.info(f"   Run ID: {handle.first_execution_run_id}")
            logger.info(f"   Priority: {priority} ({source_label})")
            logger.info(f"   Task Queue: bom-upload-processing (shared scheduler)")

            return (True, '')

        except Exception as e:
            logger.error(
                f"❌ Error handling BOM uploaded event: {e}",
                exc_info=True,
                extra={
                    'event_type': routing_key,
                    'bom_id': event_data.get('bom_id'),
                    'priority': priority
                }
            )
            return (False, 'transient')


async def main():
    """Main entry point"""
    consumer = BOMUploadConsumer()
    await consumer.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 Goodbye!")
