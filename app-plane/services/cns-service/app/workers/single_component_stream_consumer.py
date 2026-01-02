"""
Single Component Enrichment Stream Consumer

Consumes events from RabbitMQ Stream (stream.component.enrich) and starts
SingleComponentEnrichmentWorkflow for on-demand component enrichment.

Use Cases:
- Component Search "Enrich" button click
- API-triggered single component enrichment
- Missing component data enrichment

Event Flow:
  Enrich Request → Stream → This Consumer → SingleComponentEnrichmentWorkflow (Temporal)

Usage:
    python -m app.workers.single_component_stream_consumer
"""

import os
import asyncio
import logging
from typing import Dict, Any, Tuple
from datetime import timedelta
import time

from app.workers.base_consumer import BaseRStreamConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SingleComponentStreamConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Stream consumer for single component enrichment.

    Consumes from stream.component.enrich and routes enrichment requests
    to SingleComponentEnrichmentWorkflow in Temporal.

    Events consumed:
    - component.enrich.request: Start enrichment for a single component
    - component.enrich.force: Force re-enrichment (bypass cache)
    - component.enrich.batch: Batch of components (processed sequentially)

    Extends BaseRStreamConsumer to use rstream (RabbitMQ Streams protocol).
    """

    def __init__(self):
        super().__init__(
            stream='stream.component.enrich',
            consumer_name='single-component-enrichment-consumer',
            routing_keys=[
                'component.enrich.request',
                'component.enrich.force',
                'component.enrich.batch',
                'component.enrich.*',  # All component enrichment events
            ]
        )

    async def handle_message(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle component enrichment event from stream and start workflow.

        Args:
            event_data: Event payload from stream message
            routing_key: Event routing key
            priority: Priority level (1-9, from message properties)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should retry) or 'permanent' (should drop)
        """
        try:
            event_type = event_data.get('event_type', routing_key)

            logger.info(
                f"[COMPONENT-ENRICH] Received: routing_key={routing_key}, "
                f"event_type={event_type}, priority={priority}"
            )

            # Handle batch events
            if routing_key == 'component.enrich.batch':
                return await self._handle_batch(event_data, priority)

            # Handle single component enrichment
            return await self._handle_single(event_data, routing_key, priority)

        except Exception as e:
            error_msg = str(e).lower()

            # Check for duplicate workflow (expected for retries)
            if 'already started' in error_msg or 'already running' in error_msg:
                mpn = event_data.get('mpn', 'unknown')
                logger.info(
                    f"[SKIP] Workflow already running for component: {mpn}"
                )
                return (True, '')  # Not an error, just already processed

            logger.error(
                f"[FAIL] Error handling component enrichment event: {e}",
                exc_info=True,
                extra={
                    'routing_key': routing_key,
                    'mpn': event_data.get('mpn'),
                    'priority': priority
                }
            )
            return (False, 'transient')  # Unknown error - retry

    async def _handle_single(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle single component enrichment request.

        Args:
            event_data: Event payload with component details
            routing_key: Event routing key
            priority: Priority level

        Returns:
            Tuple of (success, error_type)
        """
        # Extract and validate required fields with type checking
        mpn = event_data.get('mpn')
        organization_id = event_data.get('organization_id')

        # Validate MPN - must be non-empty string
        if not mpn:
            logger.error("[FAIL] Invalid event data: missing mpn")
            return (False, 'permanent')  # Malformed message, don't retry

        if not isinstance(mpn, str):
            logger.error(f"[FAIL] Invalid event data: mpn must be string, got {type(mpn).__name__}")
            return (False, 'permanent')

        mpn = mpn.strip()
        if not mpn or len(mpn) < 2:
            logger.error(f"[FAIL] Invalid event data: mpn must be at least 2 characters")
            return (False, 'permanent')

        # Validate organization_id - must be non-empty string
        if not organization_id:
            logger.error("[FAIL] Invalid event data: missing organization_id")
            return (False, 'permanent')

        if not isinstance(organization_id, str):
            logger.error(f"[FAIL] Invalid event data: organization_id must be string, got {type(organization_id).__name__}")
            return (False, 'permanent')

        # Extract and validate optional fields
        manufacturer = event_data.get('manufacturer')
        if manufacturer is not None and not isinstance(manufacturer, str):
            logger.warning(f"[WARN] manufacturer should be string, got {type(manufacturer).__name__} - ignoring")
            manufacturer = None

        force_refresh = routing_key == 'component.enrich.force' or event_data.get('force_refresh', False)
        enable_suppliers = event_data.get('enable_suppliers', True)
        enable_ai = event_data.get('enable_ai', False)
        enable_web_scraping = event_data.get('enable_web_scraping', False)
        requested_by = event_data.get('requested_by')
        request_source = event_data.get('request_source', 'stream')
        correlation_id = event_data.get('correlation_id')

        # Import workflow components
        from temporalio.common import WorkflowIDReusePolicy
        from app.workflows.single_component_workflow import (
            SingleComponentEnrichmentWorkflow,
            SingleComponentRequest
        )
        from app.config import settings

        # Generate workflow ID
        timestamp = int(time.time())
        safe_mpn = mpn.replace('/', '_').replace(' ', '_')[:50]  # Sanitize MPN for workflow ID
        workflow_id = f"single-component-{safe_mpn}-{timestamp}"

        # Create workflow request
        request = SingleComponentRequest(
            workflow_id=workflow_id,
            mpn=mpn,
            manufacturer=manufacturer,
            organization_id=organization_id,
            force_refresh=force_refresh,
            enable_suppliers=enable_suppliers,
            enable_ai=enable_ai,
            enable_web_scraping=enable_web_scraping,
            requested_by=requested_by,
            request_source=request_source,
            correlation_id=correlation_id
        )

        logger.info(
            f"[WORKFLOW] Starting SingleComponentEnrichmentWorkflow: {workflow_id} "
            f"(mpn={mpn}, manufacturer={manufacturer or 'auto'}, force={force_refresh})"
        )

        # Start workflow
        handle = await self.temporal_client.start_workflow(
            SingleComponentEnrichmentWorkflow.run,
            request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            # Workflow discoverability in Temporal UI
            memo={
                'mpn': mpn,
                'manufacturer': manufacturer or '',
                'organization_id': organization_id,
                'force_refresh': str(force_refresh),
                'routing_key': routing_key,
                'event_sourced': 'true',
                'request_source': request_source
            },
            # ID reuse policy - allow re-enrichment after completion
            id_reuse_policy=WorkflowIDReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
            # Timeouts
            execution_timeout=timedelta(minutes=10),
            run_timeout=timedelta(minutes=5)
        )

        logger.info(
            f"[OK] SingleComponentEnrichmentWorkflow started: {workflow_id} "
            f"(run_id={handle.first_execution_run_id})"
        )

        # Log to enrichment_events table
        await self._log_workflow_started(
            mpn=mpn,
            manufacturer=manufacturer,
            organization_id=organization_id,
            workflow_id=workflow_id,
            routing_key=routing_key,
            correlation_id=correlation_id
        )

        return (True, '')  # Success

    async def _handle_batch(
        self,
        event_data: Dict[str, Any],
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle batch component enrichment request.

        Processes components sequentially to avoid overwhelming APIs.

        Args:
            event_data: Event payload with components array
            priority: Priority level

        Returns:
            Tuple of (success, error_type)
        """
        components = event_data.get('components', [])
        organization_id = event_data.get('organization_id')

        if not components:
            logger.error("[FAIL] Batch event has no components")
            return (False, 'permanent')

        if not organization_id:
            logger.error("[FAIL] Batch event missing organization_id")
            return (False, 'permanent')

        logger.info(f"[BATCH] Processing {len(components)} components")

        success_count = 0
        fail_count = 0

        for i, component in enumerate(components):
            # Build single event from batch item
            single_event = {
                'mpn': component.get('mpn'),
                'manufacturer': component.get('manufacturer'),
                'organization_id': organization_id,
                'force_refresh': event_data.get('force_refresh', False),
                'enable_suppliers': event_data.get('enable_suppliers', True),
                'enable_ai': event_data.get('enable_ai', False),
                'enable_web_scraping': event_data.get('enable_web_scraping', False),
                'requested_by': event_data.get('requested_by'),
                'request_source': 'batch',
                'correlation_id': event_data.get('correlation_id')
            }

            try:
                success, error_type = await self._handle_single(
                    single_event,
                    'component.enrich.request',
                    priority
                )
                if success:
                    success_count += 1
                else:
                    fail_count += 1

                # Small delay between batch items to avoid rate limiting
                if i < len(components) - 1:
                    await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"[BATCH] Failed component {i+1}: {e}")
                fail_count += 1

        logger.info(
            f"[BATCH] Completed: {success_count} succeeded, {fail_count} failed"
        )

        # Consider batch successful if at least one component succeeded
        return (success_count > 0, '' if success_count > 0 else 'transient')

    async def _log_workflow_started(
        self,
        mpn: str,
        manufacturer: str | None,
        organization_id: str,
        workflow_id: str,
        routing_key: str,
        correlation_id: str | None
    ):
        """Log workflow start to enrichment_events table"""
        try:
            from sqlalchemy import text
            import json

            with self.get_database_session("supabase") as db:
                query = text("""
                    INSERT INTO enrichment_events (
                        organization_id,
                        event_type,
                        event_data,
                        created_at
                    ) VALUES (
                        :organization_id,
                        'single_component_workflow_started',
                        CAST(:event_data AS jsonb),
                        NOW()
                    )
                """)

                db.execute(query, {
                    'organization_id': organization_id,
                    'event_data': json.dumps({
                        'workflow_id': workflow_id,
                        'mpn': mpn,
                        'manufacturer': manufacturer,
                        'routing_key': routing_key,
                        'correlation_id': correlation_id,
                        'event_sourced': True
                    })
                })
                db.commit()
                logger.debug(f"[AUDIT] Logged workflow start for MPN: {mpn}")

        except Exception as e:
            logger.warning(f"[WARN] Failed to log workflow start: {e}")


async def main():
    """Main entry point"""
    consumer = SingleComponentStreamConsumer()
    await consumer.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nSingle Component Stream Consumer stopped")
