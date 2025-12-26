"""
Enrichment Auto-Trigger Consumer

Listens for ``customer.bom.upload_completed`` events and auto-starts
enrichment for organizations that have ``auto_enrichment`` enabled.

Event Flow:
  BOM Upload → Upload Workflow → customer.bom.upload_completed (RabbitMQ)
  → This Consumer → Check Org Setting → Start Enrichment

Usage:
    python -m app.workers.enrichment_consumer
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


class EnrichmentAutoTriggerConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Streams consumer for auto-starting enrichment workflows
    Extends BaseRStreamConsumer with enrichment-specific logic
    """

    def __init__(self):
        # Initialize base class with stream config
        super().__init__(
            stream='stream.platform.bom',
            consumer_name='enrichment-auto-consumer',
            routing_keys='customer.bom.upload_completed'
        )

    async def check_auto_enrichment_enabled(self, organization_id: str) -> bool:
        """
        Check if organization has auto-enrichment enabled

        Args:
            organization_id: Organization ID

        Returns:
            True if auto-enrichment is enabled, False otherwise
        """
        from sqlalchemy import text

        try:
            # Use base class database session helper
            with self.get_database_session("supabase") as db:
                query = text("""
                    SELECT auto_enrichment
                    FROM organizations
                    WHERE id = :organization_id
                """)

                result = db.execute(query, {"organization_id": organization_id})
                row = result.fetchone()

                if not row:
                    logger.warning(f"Organization not found: {organization_id}")
                    return False

                auto_enrichment = row[0]
                logger.info(f"Organization {organization_id}: auto_enrichment = {auto_enrichment}")
                return bool(auto_enrichment)

        except Exception as e:
            logger.error(f"Error checking auto-enrichment setting: {e}", exc_info=True)
            return False

    async def handle_message(self, event_data: Dict[str, Any], routing_key: str, priority: int) -> Tuple[bool, str]:
        """
        Handle ``customer.bom.upload_completed`` event.

        Checks if organization has auto-enrichment enabled.
        If yes, starts enrichment workflow automatically.
        If no, does nothing (user must manually trigger).

        Args:
            event_data: Event payload from RabbitMQ message
            routing_key: Message routing key
            priority: Priority level (1-9)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should requeue) or 'permanent' (should drop)
        """
        try:
            # [FLOW_3] Auto-Enrichment Consumer - Event-driven background processing
            logger.info(
                f"[FLOW_3][Auto-Enrichment] Received BOM upload_completed event: {event_data.get('bom_id')} "
                f"(priority={priority})",
                extra={
                    'bom_id': event_data.get('bom_id'),
                    'organization_id': event_data.get('organization_id'),
                    'routing_key': routing_key,
                    'flow': 'FLOW_3_AUTO_ENRICHMENT'
                }
            )

            # Extract event data
            bom_upload_id = event_data.get('bom_id')  # bom_uploads.id
            organization_id = event_data.get('organization_id')
            project_id = event_data.get('project_id')
            user_id = event_data.get('user_id')
            filename = event_data.get('filename')

            if not bom_upload_id or not organization_id:
                logger.error(f"Invalid event data: missing required fields")
                return (False, 'permanent')  # Malformed message, don't requeue

            # Check if organization has auto-enrichment enabled
            auto_enrichment_enabled = await self.check_auto_enrichment_enabled(organization_id)

            if not auto_enrichment_enabled:
                logger.info(
                    f"⏸️  Auto-enrichment DISABLED for org {organization_id}. "
                    f"User must manually start enrichment."
                )
                return (True, '')  # Ack message but don't process

            logger.info(f"✅ Auto-enrichment ENABLED for org {organization_id}")

            # Query Supabase for boms record created by upload workflow
            from sqlalchemy import text

            with self.get_database_session("supabase") as db:
                # Find boms record
                query = text("""
                    SELECT id, status, component_count, metadata
                    FROM boms
                    WHERE organization_id = :organization_id
                      AND metadata->>'bom_upload_id' = :bom_upload_id
                    ORDER BY created_at DESC
                    LIMIT 1
                """)

                result = db.execute(query, {
                    "organization_id": organization_id,
                    "bom_upload_id": bom_upload_id
                })
                bom = result.fetchone()

                if not bom:
                    logger.error(f"❌ BOM not found for upload: {bom_upload_id}")
                    return (False, 'transient')  # Race condition - requeue for retry

                bom_id = bom[0]
                status = bom[1]
                component_count = bom[2]
                metadata = bom[3] or {}

                logger.info(f"Found BOM {bom_id}: status={status}, items={component_count}")

                # Check if upload completed successfully
                if status != 'completed':
                    logger.warning(f"⏸️  BOM {bom_id} not ready (status={status}), skipping")
                    return (False, 'transient')  # Race condition - requeue for retry

                # Check if already enriching
                if status in ['enriching', 'enriched']:
                    logger.info(f"⏩ BOM {bom_id} already {status}, skipping")
                    return (True, '')  # Already handled, acknowledge message

                # Count pending line items
                count_query = text("""
                    SELECT COUNT(*)
                    FROM bom_line_items
                    WHERE bom_id = :bom_id
                      AND enrichment_status = 'pending'
                """)
                result = db.execute(count_query, {"bom_id": bom_id})
                pending_count = result.fetchone()[0]

                if pending_count == 0:
                    logger.warning(f"⚠️  No pending items to enrich for BOM {bom_id}")
                    return (False, 'permanent')  # No items to process, don't requeue

            logger.info(f"🚀 Auto-starting enrichment: BOM {bom_id} ({pending_count} items)")

            # Import workflow
            from datetime import timedelta
            from temporalio.common import WorkflowIDReusePolicy
            from app.workflows.bom_enrichment import (
                BOMEnrichmentWorkflow,
                BOMEnrichmentRequest
            )
            from app.config import settings

            # Create enrichment request
            enrichment_request = BOMEnrichmentRequest(
                job_id=bom_id,
                bom_id=bom_id, organization_id=organization_id,
                project_id=project_id,
                total_items=pending_count,
                source='customer',  # Customer Portal uploads
                user_id=user_id,
                workflow_id=f"bom-enrichment-{bom_id}"
            )

            # Start Temporal enrichment workflow
            workflow_id = f"bom-enrichment-{bom_id}"

            handle = await self.temporal_client.start_workflow(
                BOMEnrichmentWorkflow.run,
                enrichment_request,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                # Workflow discoverability and searchability
                memo={
                    'organization_id': organization_id,
                    'bom_id': bom_id,
                    'project_id': project_id or '',
                    'user_id': user_id or '',
                    'source': 'customer',
                    'auto_triggered': 'true'
                },
                # ID reuse policy: reject duplicate workflow IDs
                id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
                # Timeouts (prevent runaway workflows)
                execution_timeout=timedelta(hours=24),  # Max 24 hours for entire workflow
                run_timeout=timedelta(hours=12)  # Max 12 hours per run (allows retries)
            )

            logger.info(f"✅ Enrichment workflow started: {workflow_id}")
            logger.info(f"   Run ID: {handle.first_execution_run_id}")

            # Update boms status and enrichment_status (HARDENING: keep both in sync)
            with self.get_database_session("supabase") as db:
                update_query = text("""
                    UPDATE boms
                    SET
                        status = 'enriching',
                        enrichment_status = 'processing',
                        metadata = jsonb_set(
                            COALESCE(metadata, '{}'::jsonb),
                            '{enrichment_workflow_id}',
                            to_jsonb(:workflow_id::text)
                        ),
                        metadata = jsonb_set(
                            metadata,
                            '{enrichment_run_id}',
                            to_jsonb(:run_id::text)
                        ),
                        metadata = jsonb_set(
                            metadata,
                            '{auto_enrichment}',
                            'true'::jsonb
                        ),
                        metadata = jsonb_set(
                            metadata,
                            '{enrichment_started_at}',
                            to_jsonb(NOW()::text)
                        )
                    WHERE id = :bom_id
                """)

                db.execute(update_query, {
                    "bom_id": bom_id,
                    "workflow_id": workflow_id,
                    "run_id": handle.first_execution_run_id
                })
                db.commit()

            logger.info(f"✅ Auto-enrichment initiated for BOM {bom_id}")

            # Publish enrichment started event
            try:
                from shared.event_bus import EventPublisher
                EventPublisher.customer_bom_enrichment_started(
                    job_id=bom_id,
                    bom_id=bom_id,
                    total_items=pending_count
                )
            except Exception as e:
                logger.warning(
                    f"Failed to publish enrichment started event: {e}",
                    extra={'bom_id': bom_id, 'error_type': type(e).__name__},
                    exc_info=True
                )

            return (True, '')  # Success

        except Exception as e:
            logger.error(
                f"❌ Error handling BOM uploaded event: {e}",
                extra={
                    'bom_id': bom_upload_id,
                    'organization_id': organization_id,
                    'error_type': type(e).__name__,
                    'event_data': str(event_data)[:500]  # Truncate for logging
                },
                exc_info=True
            )
            return (False, 'transient')  # Unknown error - retry


async def main():
    """Main entry point"""
    consumer = EnrichmentAutoTriggerConsumer()

    try:
        await consumer.start()

    except KeyboardInterrupt:
        logger.info("⚠️  Consumer shutdown requested")

    except Exception as e:
        logger.error(f"❌ Consumer error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
