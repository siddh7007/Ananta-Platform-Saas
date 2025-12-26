"""
Unified BOM Stream Consumer

Consumes events from RabbitMQ Stream (stream.platform.bom) and starts
unified BOM processing workflow for ALL sources:
- Customer Portal uploads (customer.bom.uploaded)
- CNS Bulk uploads (cns.bom.bulk_uploaded)
- Snapshot-based uploads (bom.parsed)

Uses RabbitMQ Streams via rstream for:
- Offset-based consumption (replay capability)
- Append-only event log (audit trail)
- Multiple consumers can read same events

Event Flow:
  BOM Upload → Stream → This Consumer → BOMUnifiedWorkflow (Temporal)

Usage:
    python -m app.workers.unified_bom_stream_consumer
"""

import os
import asyncio
import logging
from typing import Dict, Any, Tuple
from datetime import timedelta

from app.workers.base_consumer import BaseRStreamConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UnifiedBOMStreamConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Stream consumer for unified BOM processing.

    Consumes from stream.platform.bom and routes all BOM events
    (customer uploads, CNS bulk, snapshots) to BOMUnifiedWorkflow.

    Extends BaseRStreamConsumer to use rstream (RabbitMQ Streams protocol).
    """

    def __init__(self):
        super().__init__(
            stream='stream.platform.bom',
            consumer_name='unified-bom-consumer',
            routing_keys=[
                'customer.bom.uploaded',
                'customer.bom.*',  # All customer BOM events
                'cns.bom.bulk_uploaded',
                'cns.bom.*',  # All CNS BOM events
                'bom.parsed',
            ]
        )

    def determine_event_source(self, routing_key: str) -> str:
        """
        Determine BOM source from routing key

        Args:
            routing_key: RabbitMQ routing key

        Returns:
            Source identifier: "customer", "staff_bulk", or "snapshot"
        """
        if routing_key.startswith('customer.bom.'):
            return 'customer'
        elif routing_key.startswith('cns.bom.'):
            return 'staff_bulk'
        elif routing_key == 'bom.parsed':
            return 'snapshot'
        else:
            return 'unknown'

    async def handle_message(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle BOM event from stream and start unified workflow.

        Args:
            event_data: Event payload from stream message
            routing_key: Event routing key
            priority: Priority level (1-9, from message properties)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should retry) or 'permanent' (should drop)
        """
        try:
            source = self.determine_event_source(routing_key)

            logger.info(
                f"[BOM-EVENT] Received: routing_key={routing_key}, "
                f"source={source}, priority={priority}"
            )

            # Extract common fields
            bom_id = event_data.get('bom_id')
            tenant_id = event_data.get('organization_id') or event_data.get('tenant_id')
            project_id = event_data.get('project_id')

            if not bom_id or not tenant_id:
                logger.error(
                    f"[FAIL] Invalid event data: missing bom_id or tenant_id "
                    f"(bom_id={bom_id}, organization_id={tenant_id})"
                )
                return (False, 'permanent')  # Malformed message, don't retry

            # Import workflow components
            from temporalio.common import WorkflowIDReusePolicy
            from app.workflows.bom_enrichment import (
                BOMUnifiedWorkflow,
                BOMUnifiedRequest
            )
            from app.config import settings

            # Create unified request
            unified_request = BOMUnifiedRequest(
                bom_id=bom_id,
                organization_id=tenant_id,
                project_id=project_id,
                source=source,
                bom_name=event_data.get('bom_name', f"BOM {bom_id[:8]}"),
                uploaded_by=event_data.get('uploaded_by'),
                filename=event_data.get('filename'),
                parsed_s3_key=event_data.get('parsed_s3_key'),
                upload_id=event_data.get('upload_id'),
                priority=priority,
                routing_key=routing_key
            )

            # Start unified workflow
            workflow_id = f"bom-unified-{bom_id}"

            logger.info(
                f"[WORKFLOW] Starting BOMUnifiedWorkflow: {workflow_id} "
                f"(source={source}, priority={priority})"
            )

            handle = await self.temporal_client.start_workflow(
                BOMUnifiedWorkflow.run,
                unified_request,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                # Workflow discoverability
                memo={
                    'organization_id': tenant_id,
                    'bom_id': bom_id,
                    'project_id': project_id or '',
                    'source': source,
                    'routing_key': routing_key,
                    'event_sourced': 'true'  # Mark as stream-sourced
                },
                # ID reuse policy
                id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
                # Timeouts
                execution_timeout=timedelta(hours=24),
                run_timeout=timedelta(hours=12)
            )

            logger.info(
                f"[OK] BOMUnifiedWorkflow started: {workflow_id} "
                f"(run_id={handle.first_execution_run_id})"
            )

            # Log to enrichment_events table
            await self._log_workflow_started(
                bom_id=bom_id,
                tenant_id=tenant_id,
                workflow_id=workflow_id,
                source=source,
                routing_key=routing_key
            )

            return (True, '')  # Success

        except Exception as e:
            error_msg = str(e).lower()

            # Check for duplicate workflow (expected for retries)
            # Handle both error message formats
            if 'already started' in error_msg or 'already running' in error_msg:
                logger.info(
                    f"[SKIP] Workflow already running for BOM: {event_data.get('bom_id')}"
                )
                return (True, '')  # Not an error, just already processed

            logger.error(
                f"[FAIL] Error handling BOM event: {e}",
                exc_info=True,
                extra={
                    'routing_key': routing_key,
                    'bom_id': event_data.get('bom_id'),
                    'priority': priority
                }
            )
            return (False, 'transient')  # Unknown error - retry

    async def _log_workflow_started(
        self,
        bom_id: str,
        tenant_id: str,
        workflow_id: str,
        source: str,
        routing_key: str
    ):
        """Log workflow start to enrichment_events table"""
        try:
            from sqlalchemy import text
            import json

            with self.get_database_session("supabase") as db:
                query = text("""
                    INSERT INTO enrichment_events (
                        bom_id,
                        organization_id,
                        event_type,
                        event_data,
                        created_at
                    ) VALUES (
                        :bom_id,
                        :organization_id,
                        'workflow_started',
                        CAST(:event_data AS jsonb),
                        NOW()
                    )
                """)

                db.execute(query, {
                    'bom_id': bom_id,
                    'organization_id': tenant_id,
                    'event_data': json.dumps({
                        'workflow_id': workflow_id,
                        'source': source,
                        'routing_key': routing_key,
                        'event_sourced': True
                    })
                })
                db.commit()
                logger.debug(f"[AUDIT] Logged workflow start for BOM: {bom_id}")

        except Exception as e:
            logger.warning(f"[WARN] Failed to log workflow start: {e}")


async def main():
    """Main entry point"""
    consumer = UnifiedBOMStreamConsumer()
    await consumer.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nUnified BOM Stream Consumer stopped")
