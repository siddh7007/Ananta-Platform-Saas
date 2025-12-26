"""
Unified BOM Stream Consumer

Consumes events from RabbitMQ Stream (stream.platform.bom) and starts
unified BOM processing workflow for ALL sources:
- Customer Portal uploads (customer.bom.uploaded)
- CNS Bulk uploads (cns.bom.bulk_uploaded)
- Snapshot-based uploads (bom.parsed)

Uses RabbitMQ Streams for:
- Offset-based consumption (replay capability)
- Append-only event log (audit trail)
- Multiple consumers can read same events

Event Flow:
  BOM Upload → Stream → This Consumer → BOMUnifiedWorkflow (Temporal)

Usage:
    python -m app.workers.unified_bom_stream_consumer
"""

import os
import sys
import asyncio
import json
import logging
import time
from typing import Dict, Any, Optional
import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# RabbitMQ Configuration
RABBITMQ_CONFIG = {
    'host': os.getenv('RABBITMQ_HOST', 'localhost'),
    'port': int(os.getenv('RABBITMQ_PORT', '27250')),
    'user': os.getenv('RABBITMQ_USER', 'admin'),
    'password': os.getenv('RABBITMQ_PASS', 'admin123_change_in_production'),
    'virtual_host': os.getenv('RABBITMQ_VHOST', '/'),
}

# Stream Configuration
STREAM_NAME = 'stream.platform.bom'
STREAM_OFFSET = os.getenv('STREAM_OFFSET', 'last')  # "first", "last", or numeric offset


class UnifiedBOMStreamConsumer:
    """
    RabbitMQ Stream consumer for unified BOM processing

    Consumes from stream.platform.bom and routes all BOM events
    (customer uploads, CNS bulk, snapshots) to BOMUnifiedWorkflow.
    """

    def __init__(self, stream_offset: str = 'last'):
        self.connection = None
        self.channel = None
        self.temporal_client = None
        self.stream_offset = stream_offset
        self.messages_processed = 0

    def connect_rabbitmq(self, max_retries: int = 10, initial_delay: float = 1.0):
        """
        Connect to RabbitMQ with exponential backoff retry logic

        Args:
            max_retries: Maximum number of connection attempts
            initial_delay: Initial delay in seconds (doubles each retry)
        """
        delay = initial_delay

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Connecting to RabbitMQ at {RABBITMQ_CONFIG['host']}:{RABBITMQ_CONFIG['port']} "
                    f"(attempt {attempt + 1}/{max_retries})"
                )

                credentials = pika.PlainCredentials(
                    RABBITMQ_CONFIG['user'],
                    RABBITMQ_CONFIG['password']
                )

                parameters = pika.ConnectionParameters(
                    host=RABBITMQ_CONFIG['host'],
                    port=RABBITMQ_CONFIG['port'],
                    virtual_host=RABBITMQ_CONFIG['virtual_host'],
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )

                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()

                # Verify stream exists
                self.channel.queue_declare(
                    queue=STREAM_NAME,
                    passive=True  # Just check existence
                )

                logger.info(f"[OK] Connected to RabbitMQ")
                logger.info(f"[OK] Stream verified: {STREAM_NAME}")
                logger.info(f"[OK] Stream offset: {self.stream_offset}")
                return  # Success!

            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(
                        f"[FAIL] Failed to connect to RabbitMQ after {max_retries} attempts: {e}"
                    )
                    raise

                logger.warning(
                    f"[WARN] RabbitMQ connection failed (attempt {attempt + 1}/{max_retries}): {e}"
                )
                logger.info(f"[WAIT] Retrying in {delay:.1f}s...")
                time.sleep(delay)
                delay = min(delay * 2, 60)  # Exponential backoff, max 60s

    async def connect_temporal(self, max_retries: int = 10, initial_delay: float = 1.0):
        """
        Connect to Temporal with exponential backoff retry logic

        Args:
            max_retries: Maximum number of connection attempts
            initial_delay: Initial delay in seconds (doubles each retry)
        """
        from temporalio.client import Client

        temporal_host = os.getenv('TEMPORAL_HOST', 'localhost:7233')
        temporal_namespace = os.getenv('TEMPORAL_NAMESPACE', 'default')
        delay = initial_delay

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Connecting to Temporal at {temporal_host} "
                    f"(attempt {attempt + 1}/{max_retries})"
                )

                self.temporal_client = await Client.connect(
                    temporal_host,
                    namespace=temporal_namespace
                )

                logger.info("[OK] Connected to Temporal")
                return  # Success!

            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(
                        f"[FAIL] Failed to connect to Temporal after {max_retries} attempts: {e}"
                    )
                    raise

                logger.warning(
                    f"[WARN] Temporal connection failed (attempt {attempt + 1}/{max_retries}): {e}"
                )
                logger.info(f"[WAIT] Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)  # Exponential backoff, max 60s

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

    async def handle_bom_event(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int = 5
    ) -> tuple[bool, str]:
        """
        Handle BOM event from stream and start unified workflow

        Args:
            event_data: Event payload from stream message
            routing_key: Event routing key
            priority: Priority level (1-9, from message properties)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should requeue) or 'permanent' (should drop)
        """
        try:
            self.messages_processed += 1

            source = self.determine_event_source(routing_key)

            logger.info(
                f"[EVENT #{self.messages_processed}] Received BOM event: "
                f"routing_key={routing_key}, source={source}, priority={priority}"
            )

            # Extract common fields
            bom_id = event_data.get('bom_id')
            tenant_id = event_data.get('organization_id')
            project_id = event_data.get('project_id')

            if not bom_id or not tenant_id:
                logger.error(
                    f"[FAIL] Invalid event data: missing bom_id or tenant_id "
                    f"(bom_id={bom_id}, organization_id={tenant_id})"
                )
                return (False, 'permanent')  # Malformed message, don't requeue

            # Import workflow
            from datetime import timedelta
            from temporalio.common import WorkflowIDReusePolicy
            from app.workflows.bom_enrichment import (
                BOMUnifiedWorkflow,
                BOMUnifiedRequest
            )
            from app.config import settings

            # Create unified request
            unified_request = BOMUnifiedRequest(
                bom_id=bom_id, organization_id=tenant_id,
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
                    'organization_id': organization_id,
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

            return (True, '')  # Success

        except Exception as e:
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

    def callback(
        self,
        ch: BlockingChannel,
        method: Basic.Deliver,
        properties: BasicProperties,
        body: bytes
    ):
        """
        RabbitMQ stream message callback

        Called for each message from the stream. Processes event and
        starts unified workflow.
        """
        try:
            event_data = json.loads(body)
            routing_key = method.routing_key
            priority = properties.priority or 5

            logger.debug(
                f"[MESSAGE] Processing: routing_key={routing_key}, "
                f"delivery_tag={method.delivery_tag}"
            )

            # Run async handler in new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            success, error_type = loop.run_until_complete(
                self.handle_bom_event(event_data, routing_key, priority)
            )

            loop.close()

            if success:
                # Stream messages are always auto-acked
                logger.debug(f"[OK] Message processed successfully")
            else:
                logger.warning(
                    f"[WARN] Message processing failed: error_type={error_type}"
                )

        except json.JSONDecodeError as e:
            logger.error(f"[FAIL] Invalid JSON in stream message: {e}")
        except Exception as e:
            logger.error(
                f"[FAIL] Error processing stream message: {e}",
                exc_info=True
            )

    async def start(self):
        """Start consuming messages from stream"""
        logger.info("=" * 80)
        logger.info("Unified BOM Stream Consumer Starting")
        logger.info("=" * 80)
        logger.info(f"Stream: {STREAM_NAME}")
        logger.info(f"Offset: {self.stream_offset}")
        logger.info(f"Mode: Event Sourcing (RabbitMQ Streams)")
        logger.info("")

        # Connect to services
        self.connect_rabbitmq()
        await self.connect_temporal()

        logger.info("")
        logger.info("Event Routing:")
        logger.info("  - customer.bom.* → source=customer")
        logger.info("  - cns.bom.* → source=staff_bulk")
        logger.info("  - bom.parsed → source=snapshot")
        logger.info("")
        logger.info("Workflow: BOMUnifiedWorkflow")
        logger.info("  1. Determine BOM state (uploaded, parsed, ingested)")
        logger.info("  2. Execute required stages (parse, ingest, enrich)")
        logger.info("  3. Publish progress to stream")
        logger.info("")

        # Start consuming from stream with offset
        consume_args = {
            "x-stream-offset": self.stream_offset  # Offset-based consumption
        }

        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(
            queue=STREAM_NAME,
            on_message_callback=self.callback,
            auto_ack=True,  # Streams use offset, not traditional ack
            arguments=consume_args
        )

        logger.info("[READY] Consumer started. Polling stream for events...")
        logger.info("Press Ctrl+C to stop")
        logger.info("=" * 80)

        # Start consuming (blocks until shutdown)
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("")
            logger.info("[STOP] Consumer shutdown requested")
            self.stop()

    def stop(self):
        """Stop consumer and close connections"""
        logger.info("[SHUTDOWN] Stopping consumer...")

        if self.channel:
            try:
                self.channel.stop_consuming()
                self.channel.close()
            except Exception as e:
                logger.warning(f"[WARN] Error closing channel: {e}")

        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                logger.warning(f"[WARN] Error closing connection: {e}")

        logger.info(f"[OK] Consumer stopped (processed {self.messages_processed} messages)")


async def main():
    """Main entry point"""
    consumer = UnifiedBOMStreamConsumer(stream_offset=STREAM_OFFSET)

    try:
        await consumer.start()
    except KeyboardInterrupt:
        logger.info("")
        logger.info("[STOP] Consumer shutdown requested")
    except Exception as e:
        logger.error(f"[FAIL] Consumer error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
