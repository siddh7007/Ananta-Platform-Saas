"""
Event Bus - RabbitMQ Event Publishing Library
==============================================

Shared library for publishing events to RabbitMQ across all platform services.

Usage:
    from shared.event_bus import event_bus

    # Publish event
    await event_bus.publish(
        'customer.bom.uploaded',
        {
            'bom_id': 'uuid',
            'organization_id': 'uuid',
            'user_id': 'uuid',
            'filename': 'bom.csv'
        }
    )

Environment Variables:
    RABBITMQ_HOST: RabbitMQ hostname (default: localhost)
    RABBITMQ_PORT: RabbitMQ port (default: 27250)
    RABBITMQ_USER: RabbitMQ username (default: admin)
    RABBITMQ_PASS: RabbitMQ password
"""

import os
import json
import time
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager
import pika
from pika.adapters.asyncio_connection import AsyncioConnection
from pika import SelectConnection

from .logger_config import get_logger

logger = get_logger('event_bus')

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal, UUID, and datetime objects"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, uuid.UUID):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super(DecimalEncoder, self).default(obj)


# Configuration
RABBITMQ_CONFIG = {
    'host': os.getenv('RABBITMQ_HOST', 'localhost'),
    'port': int(os.getenv('RABBITMQ_PORT', '27250')),
    'user': os.getenv('RABBITMQ_USER', 'admin'),
    'password': os.getenv('RABBITMQ_PASS', 'admin123_change_in_production'),
    'virtual_host': os.getenv('RABBITMQ_VHOST', '/'),
    'exchange': 'platform.events'
}


def get_retry_config(priority: int) -> dict:
    """
    Get retry configuration based on event priority.
    Higher priority events get more retries and shorter initial delays.

    Returns:
        dict: {'max_retries': int, 'initial_delay': float (seconds)}
    """
    if priority >= 8:
        # Critical/High priority: 5 retries, 0.1s initial delay
        return {'max_retries': 5, 'initial_delay': 0.1}
    elif priority >= 5:
        # Medium-high priority: 3 retries, 0.2s initial delay
        return {'max_retries': 3, 'initial_delay': 0.2}
    else:
        # Normal/Low priority: 2 retries, 0.5s initial delay
        return {'max_retries': 2, 'initial_delay': 0.5}


class EventBus:
    """
    RabbitMQ event publisher with connection pooling and retry logic
    """

    def __init__(
        self,
        host: str = None,
        port: int = None,
        user: str = None,
        password: str = None,
        exchange: str = None
    ):
        self.host = host or RABBITMQ_CONFIG['host']
        self.port = port or RABBITMQ_CONFIG['port']
        self.user = user or RABBITMQ_CONFIG['user']
        self.password = password or RABBITMQ_CONFIG['password']
        self.virtual_host = RABBITMQ_CONFIG['virtual_host']
        self.exchange = exchange or RABBITMQ_CONFIG['exchange']

        self.connection = None
        self.channel = None
        self._is_connected = False

    def connect(self):
        """Establish connection to RabbitMQ"""
        if self._is_connected:
            return

        try:
            credentials = pika.PlainCredentials(self.user, self.password)
            parameters = pika.ConnectionParameters(
                host=self.host,
                port=self.port,
                virtual_host=self.virtual_host,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )

            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            self._is_connected = True

            logger.info(f"Connected to RabbitMQ at {self.host}:{self.port}")

        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            self._is_connected = False
            raise

    def disconnect(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            self._is_connected = False
            logger.info("Disconnected from RabbitMQ")

    def publish(
        self,
        routing_key: str,
        event_data: Dict[str, Any],
        event_type: Optional[str] = None,
        priority: int = 0
    ):
        """
        Publish event to RabbitMQ with exponential backoff retry

        Args:
            routing_key: Routing key (e.g., 'customer.bom.uploaded')
            event_data: Event payload
            event_type: Optional event type (defaults to routing_key)
            priority: Message priority (0-9, higher = more important)

        Example:
            event_bus.publish(
                'customer.bom.uploaded',
                {
                    'bom_id': 'uuid',
                    'tenant_id': 'uuid',
                    'filename': 'bom.csv'
                },
                priority=7
            )

        Retry Strategy (based on priority):
            Priority 0-4: 2 retries, 0.5s initial delay, max 1.0s delay
            Priority 5-7: 3 retries, 0.2s initial delay, max 0.8s delay
            Priority 8-10: 5 retries, 0.1s initial delay, max 1.6s delay
        """
        # Get retry configuration based on priority
        retry_config = get_retry_config(priority)
        max_retries = retry_config['max_retries']
        initial_delay = retry_config['initial_delay']

        # Ensure core metadata fields are present for all events
        # event_id: stable identifier for deduplication and analytics
        # schema_version: allows evolving event shape over time
        if 'event_id' not in event_data:
            event_data['event_id'] = str(uuid.uuid4())
        if 'schema_version' not in event_data:
            event_data['schema_version'] = 1

        # Build event payload
        event = {
            'event_type': event_type or routing_key,
            'timestamp': datetime.utcnow().isoformat(),
            **event_data,
        }

        last_error = None

        for attempt in range(max_retries + 1):
            try:
                # Check actual connection/channel state (not just the flag)
                # RabbitMQ can close channels independently
                if not self._is_connected or \
                   not self.connection or self.connection.is_closed or \
                   not self.channel or self.channel.is_closed:
                    # Reset state and reconnect
                    self._is_connected = False
                    self.connect()

                # Publish message
                self.channel.basic_publish(
                    exchange=self.exchange,
                    routing_key=routing_key,
                    body=json.dumps(event, cls=DecimalEncoder),
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # Persistent
                        content_type='application/json',
                        priority=priority,
                        timestamp=int(datetime.utcnow().timestamp())
                    )
                )

                if attempt > 0:
                    logger.info(f"Published event {routing_key} after {attempt} retries")
                else:
                    logger.debug(f"Published event: {routing_key}")

                return  # Success!

            except Exception as e:
                last_error = e

                # If this was the last attempt, log and raise
                if attempt == max_retries:
                    logger.error(
                        f"Failed to publish event {routing_key} after {max_retries} retries: {e}"
                    )
                    raise

                # Calculate exponential backoff delay: initial_delay * 2^attempt
                delay = initial_delay * (2 ** attempt)

                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries + 1} failed for {routing_key}, "
                    f"retrying in {delay:.2f}s... Error: {str(e)}"
                )

                # Reset connection for retry
                try:
                    self.disconnect()
                except:
                    pass  # Ignore errors during disconnect

                # Wait before retry
                time.sleep(delay)

    def __enter__(self):
        """Context manager support"""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager support"""
        self.disconnect()


# Singleton instance
_event_bus_instance = None


def get_event_bus() -> EventBus:
    """Get singleton EventBus instance"""
    global _event_bus_instance
    if _event_bus_instance is None:
        _event_bus_instance = EventBus()
        # Don't connect at import time - will connect lazily when needed
    return _event_bus_instance


# Convenience alias - lazy initialization, connection happens when first publish() is called
event_bus = get_event_bus()


# ============================================================================
# EVENT HELPERS (Pre-defined event publishers)
# ============================================================================

class EventPublisher:
    """
    Helper class with pre-defined event publishers for common events
    """

    @staticmethod
    def customer_bom_uploaded(bom_id: str, organization_id: str, user_id: str, filename: str, total_items: int, upload_id: str = None, project_id: str = None):
        """Publish customer BOM uploaded event (high priority - user waiting)"""
        event_bus.publish(
            'customer.bom.uploaded',
            {
                'upload_id': upload_id,  # bom_uploads.id (for workflow processing)
                'bom_id': bom_id,        # boms.id (for reference)
                'project_id': project_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'filename': filename,
                'total_items': total_items
            },
            event_type='bom_uploaded',
            priority=7  # High priority - user waiting
        )
        logger.info(f"[Event] customer.bom.uploaded published: upload_id={upload_id}, bom_id={bom_id}, items={total_items}")

    @staticmethod
    def customer_bom_upload_completed(bom_upload_id: str, organization_id: str, project_id: str = None, user_id: str = None, priority: int = 7):
        """
        Publish customer BOM upload completion event (triggers auto-enrichment).

        This event is published AFTER the upload workflow completes processing,
        when BOM records and line items have been created in the database.
        Replaces hardcoded delays in auto-enrichment consumer.
        """
        event_bus.publish(
            'customer.bom.upload_completed',
            {
                'bom_id': bom_upload_id,
                'organization_id': organization_id,
                'project_id': project_id,
                'user_id': user_id
            },
            event_type='bom_upload_completed',
            priority=priority  # High priority - triggers enrichment workflow
        )
        logger.info(f"[Event] customer.bom.upload_completed published: bom_upload_id={bom_upload_id}")

    @staticmethod
    def bom_parsed(
        bom_id: str,
        organization_id: str,
        source: str,
        bom_name: str,
        parsed_s3_key: str,
        uploaded_by: str,
        project_id: Optional[str] = None,
    ):
        """Publish BOM parsed event (triggers ingestion workflow)

        This event is emitted after a raw BOM file has been parsed and
        normalized into a snapshot. The ingestion workflow listens for
        this event to create Supabase BOMs and start enrichment.
        """
        event_bus.publish(
            'bom.parsed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'project_id': project_id,
                'source': source,  # 'customer' or 'staff_bulk'
                'bom_name': bom_name,
                'parsed_s3_key': parsed_s3_key,
                'uploaded_by': uploaded_by,
            },
            event_type='bom_parsed',
            priority=8  # High priority - triggers ingestion workflow
        )
        logger.info(f"[Event] bom.parsed published: bom_id={bom_id}, parsed_s3_key={parsed_s3_key}")

    @staticmethod
    def cns_bulk_uploaded(
        bom_id: str,
        organization_id: str,
        admin_id: str,
        filename: str,
        file_size: int,
        s3_key: str,
        s3_bucket: str,
        total_items: int = 0
    ):
        """Publish CNS bulk upload event (medium priority - background job)"""
        event_bus.publish(
            'cns.bom.bulk_uploaded',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'admin_id': admin_id,
                'filename': filename,
                'file_size': file_size,
                's3_key': s3_key,
                's3_bucket': s3_bucket,
                'total_items': total_items,
                'storage_backend': 'minio'
            },
            event_type='bulk_uploaded',
            priority=5  # Medium priority - batch processing
        )
        logger.info(f"[Event] cns.bom.bulk_uploaded published: bom_id={bom_id}, s3_key={s3_key}")

    @staticmethod
    def customer_bom_edited(bom_id: str, organization_id: str, user_id: str, changes: Dict[str, Any]):
        """Publish customer BOM edited event"""
        event_bus.publish(
            'customer.bom.edited',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'changes': changes
            },
            priority=5
        )
        logger.info(f"[Event] customer.bom.edited published: bom_id={bom_id}")

    @staticmethod
    def customer_bom_deleted(bom_id: str, organization_id: str, user_id: str, bom_name: str = None):
        """Publish customer BOM deleted event"""
        event_bus.publish(
            'customer.bom.deleted',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'bom_name': bom_name
            },
            priority=5
        )
        logger.info(f"[Event] customer.bom.deleted published: bom_id={bom_id}")

    @staticmethod
    def customer_bom_validated(bom_id: str, organization_id: str, grade: str, issues: int):
        """Publish customer BOM validated event"""
        event_bus.publish(
            'customer.bom.validated',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'grade': grade,
                'issues': issues
            },
            priority=5
        )
        logger.info(f"[Event] customer.bom.validated published: bom_id={bom_id}, grade={grade}")

    @staticmethod
    def customer_project_created(project_id: str, organization_id: str, user_id: str, project_name: str):
        """Publish customer project created event"""
        event_bus.publish(
            'customer.project.created',
            {
                'project_id': project_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'project_name': project_name
            },
            priority=5
        )
        logger.info(f"[Event] customer.project.created published: project_id={project_id}")

    @staticmethod
    def customer_project_edited(project_id: str, organization_id: str, user_id: str, changes: Dict[str, Any]):
        """Publish customer project edited event"""
        event_bus.publish(
            'customer.project.edited',
            {
                'project_id': project_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'changes': changes
            },
            priority=5
        )
        logger.info(f"[Event] customer.project.edited published: project_id={project_id}")

    @staticmethod
    def customer_project_deleted(project_id: str, tenant_id: str, user_id: str, project_name: str = None, bom_count: int = 0):
        """Publish customer project deleted event"""
        event_bus.publish(
            'customer.project.deleted',
            {
                'project_id': project_id,
                'organization_id': organization_id,
                'user_id': user_id,
                'project_name': project_name,
                'bom_count': bom_count
            },
            priority=5
        )
        logger.info(f"[Event] customer.project.deleted published: project_id={project_id}")

    @staticmethod
    def customer_organization_deleted(organization_id: str, user_id: str, organization_name: str = None):
        """Publish customer organization deleted event"""
        event_bus.publish(
            'customer.organization.deleted',
            {
                'organization_id': organization_id,
                'user_id': user_id,
                'organization_name': organization_name
            },
            priority=6
        )
        logger.info(f"[Event] customer.organization.deleted published: org_id={organization_id}")

    @staticmethod
    def customer_organization_member_added(organization_id: str, user_id: str, new_member_id: str, role: str):
        """Publish customer organization member added event"""
        event_bus.publish(
            'customer.organization.member_added',
            {
                'organization_id': organization_id,
                'user_id': user_id,
                'new_member_id': new_member_id,
                'role': role
            },
            priority=5
        )
        logger.info(f"[Event] customer.organization.member_added published: org_id={organization_id}")

    @staticmethod
    def customer_organization_member_removed(organization_id: str, user_id: str, removed_member_id: str):
        """Publish customer organization member removed event"""
        event_bus.publish(
            'customer.organization.member_removed',
            {
                'organization_id': organization_id,
                'user_id': user_id,
                'removed_member_id': removed_member_id
            },
            priority=5
        )
        logger.info(f"[Event] customer.organization.member_removed published: org_id={organization_id}")

    @staticmethod
    def customer_user_deleted(deleted_user_id: str, tenant_id: str, admin_id: str):
        """Publish customer user deleted event"""
        event_bus.publish(
            'customer.user.deleted',
            {
                'deleted_user_id': deleted_user_id,
                'organization_id': organization_id,
                'admin_id': admin_id
            },
            priority=6
        )
        logger.info(f"[Event] customer.user.deleted published: user_id={deleted_user_id}")

    @staticmethod
    def customer_bom_enrichment_started(job_id: str, bom_id: str, total_items: int):
        """Publish enrichment started event"""
        event_bus.publish(
            'customer.bom.enrichment_started',
            {
                'job_id': job_id,
                'bom_id': bom_id,
                'total_items': total_items,
                'state': {
                    'status': 'enriching',
                    'total_items': total_items,
                    'enriched_items': 0,
                    'failed_items': 0,
                    'pending_items': total_items,
                    'percent_complete': 0.0,
                    'started_at': datetime.utcnow().isoformat(),
                    'completed_at': None,
                    'failed_at': None,
                },
                'schema_version': 1,
            },
            priority=5
        )

    @staticmethod
    def customer_bom_enrichment_progress(job_id: str, processed: int, total: int, current_mpn: str):
        """Publish enrichment progress event"""
        percent = round((processed / total * 100), 2) if total > 0 else 0.0
        pending = max(total - processed, 0)
        event_bus.publish(
            'customer.bom.enrichment_progress',
            {
                'job_id': job_id,
                'processed': processed,
                'total': total,
                'current_mpn': current_mpn,
                'progress_percent': percent,
                'state': {
                    'status': 'enriching',
                    'total_items': total,
                    'enriched_items': processed,
                    'failed_items': 0,
                    'pending_items': pending,
                    'percent_complete': percent,
                    'started_at': None,
                    'completed_at': None,
                    'failed_at': None,
                },
                'schema_version': 1,
            },
            priority=7  # Lower priority for frequent updates
        )

    @staticmethod
    def customer_bom_enrichment_completed(
        job_id: str,
        succeeded: int,
        failed: int,
        user_email: str,
        bom_id: str = None,
        organization_id: str = None,
        user_id: str = None
    ):
        """
        Publish enrichment completed event.

        This event triggers downstream processes:
        - RiskAnalysisConsumer: Starts BOM risk analysis workflow

        Args:
            job_id: Enrichment job ID (often same as bom_id)
            succeeded: Number of components successfully enriched
            failed: Number of components that failed enrichment
            user_email: Email of user who triggered enrichment
            bom_id: BOM ID (optional, defaults to job_id)
            organization_id: Organization ID (optional, for downstream consumers)
            user_id: User ID (optional, for downstream consumers)
        """
        total = succeeded + failed
        percent = round((succeeded / total * 100), 2) if total > 0 else 0.0
        event_bus.publish(
            'customer.bom.enrichment_completed',
            {
                'job_id': job_id,
                'bom_id': bom_id or job_id,  # Default to job_id if not provided
                'organization_id': organization_id,
                'user_id': user_id,
                'succeeded': succeeded,
                'failed': failed,
                'user_email': user_email,
                'state': {
                    'status': 'completed',
                    'total_items': total,
                    'enriched_items': succeeded,
                    'failed_items': failed,
                    'pending_items': 0,
                    'percent_complete': percent,
                    'started_at': None,
                    'completed_at': datetime.utcnow().isoformat(),
                    'failed_at': None,
                },
                'schema_version': 2,  # Updated schema with bom_id, org_id
            },
            priority=8  # High priority for completion
        )

    # ==========================================================================
    # RISK ANALYSIS EVENTS
    # ==========================================================================

    @staticmethod
    def customer_bom_risk_analysis_started(
        bom_id: str,
        organization_id: str,
        workflow_id: str,
        user_id: str = None,
        total_items: int = 0
    ):
        """
        Publish event when risk analysis workflow starts.

        Args:
            bom_id: BOM ID being analyzed
            organization_id: Organization ID
            workflow_id: Temporal workflow ID
            user_id: User who triggered analysis (optional)
            total_items: Number of line items to analyze
        """
        event_bus.publish(
            'customer.bom.risk_analysis_started',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'workflow_id': workflow_id,
                'user_id': user_id,
                'total_items': total_items,
                'started_at': datetime.utcnow().isoformat(),
                'schema_version': 1,
            },
            priority=7
        )

    @staticmethod
    def customer_bom_risk_analysis_completed(
        bom_id: str,
        organization_id: str,
        workflow_id: str,
        health_grade: str,
        average_risk_score: float,
        total_items: int,
        scored_items: int,
        risk_distribution: Dict[str, int] = None,
        user_id: str = None
    ):
        """
        Publish event when risk analysis workflow completes.

        This event can be used by downstream consumers for:
        - Sending notifications (alerts for high-risk BOMs)
        - Updating dashboards in real-time
        - Triggering follow-up workflows

        Args:
            bom_id: BOM ID that was analyzed
            organization_id: Organization ID
            workflow_id: Temporal workflow ID
            health_grade: BOM health grade (A-F)
            average_risk_score: Average risk score (0-100)
            total_items: Total line items in BOM
            scored_items: Number of items that received risk scores
            risk_distribution: Distribution by risk level (low/medium/high/critical)
            user_id: User who triggered analysis (optional)
        """
        event_bus.publish(
            'customer.bom.risk_analysis_completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'workflow_id': workflow_id,
                'user_id': user_id,
                'health_grade': health_grade,
                'average_risk_score': average_risk_score,
                'total_items': total_items,
                'scored_items': scored_items,
                'risk_distribution': risk_distribution or {},
                'completed_at': datetime.utcnow().isoformat(),
                'schema_version': 1,
            },
            priority=8  # High priority for completion events
        )

    @staticmethod
    def customer_bom_risk_analysis_failed(
        bom_id: str,
        organization_id: str,
        workflow_id: str,
        error_message: str,
        error_code: str = None,
        user_id: str = None
    ):
        """
        Publish event when risk analysis workflow fails.

        Args:
            bom_id: BOM ID that failed analysis
            organization_id: Organization ID
            workflow_id: Temporal workflow ID
            error_message: Error description
            error_code: Error code (optional)
            user_id: User who triggered analysis (optional)
        """
        event_bus.publish(
            'customer.bom.risk_analysis_failed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'workflow_id': workflow_id,
                'user_id': user_id,
                'error_code': error_code,
                'error_message': error_message,
                'failed_at': datetime.utcnow().isoformat(),
                'schema_version': 1,
            },
            priority=9  # Critical priority for failures
        )

    # ==========================================================================
    # AUDIT EVENTS
    # ==========================================================================

    @staticmethod
    def customer_bom_audit_ready(job_id: str, bom_id: str, label: str, files: List[str]):
        """Publish audit-ready event after CSV generation"""
        event_bus.publish(
            'customer.bom.audit_ready',
            {
                'job_id': job_id,
                'bom_id': bom_id,
                'label': label,
                'bucket': 'enrichment-audit',
                'prefix': job_id,
                'files': files,
                'timestamp': datetime.utcnow().isoformat(),
                'schema_version': 1
            },
            priority=8
        )

    @staticmethod
    def customer_bom_field_diff_ready(job_id: str, bom_id: str, label: str, object_key: str):
        """Publish event when the field-diff CSV is ready"""
        event_bus.publish(
            'customer.bom.field_diff_ready',
            {
                'job_id': job_id,
                'bom_id': bom_id,
                'label': label,
                'bucket': 'enrichment-audit',
                'object_key': object_key,
                'timestamp': datetime.utcnow().isoformat(),
                'schema_version': 1
            },
            priority=6
        )

    @staticmethod
    def customer_bom_enrichment_failed(
        job_id: str,
        bom_id: str,
        organization_id: str,
        upload_id: Optional[str] = None,
        project_id: Optional[str] = None,
        state: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        stage: Optional[str] = None,
    ):
        """Publish enrichment failed event (BOM-level).

        This event is emitted when the enrichment workflow cannot
        complete for a BOM (validation errors, workflow failures,
        supplier outages, etc.).
        """
        event_bus.publish(
            'customer.bom.enrichment_failed',
            {
                'job_id': job_id,
                'bom_id': bom_id,
                'organization_id': organization_id,
                'upload_id': upload_id,
                'project_id': project_id,
                'state': state or {},
                'error_code': error_code,
                'error_message': error_message,
                'stage': stage,
            },
            priority=8,
        )

    @staticmethod
    def enrichment_component_enriched(job_id: str, mpn: str, quality_score: float, source: str):
        """Publish component enriched event"""
        event_bus.publish(
            'enrichment.component.enriched',
            {
                'job_id': job_id,
                'mpn': mpn,
                'quality_score': quality_score,
                'source': source
            }
        )

    @staticmethod
    def enrichment_component_failed(
        job_id: str,
        bom_id: str,
        organization_id: str,
        line_item_id: str,
        line_number: int,
        mpn: str,
        manufacturer: str,
        quantity: Optional[int] = None,
        reference_designator: Optional[str] = None,
        supplier: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Publish component-level enrichment failure event."""
        event_bus.publish(
            'enrichment.component.failed',
            {
                'job_id': job_id,
                'bom_id': bom_id,
                'organization_id': organization_id,
                'line_item_id': line_item_id,
                'line_number': line_number,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'quantity': quantity,
                'reference_designator': reference_designator,
                'supplier': supplier,
                'error_code': error_code,
                'error_message': error_message,
            },
            priority=6,
        )

    @staticmethod
    def enrichment_catalog_hit(job_id: str, mpn: str):
        """Publish catalog hit event (component found in cache)"""
        event_bus.publish(
            'enrichment.catalog.hit',
            {
                'job_id': job_id,
                'mpn': mpn
            }
        )

    @staticmethod
    def enrichment_catalog_miss(job_id: str, mpn: str):
        """Publish catalog miss event (component not in cache)"""
        event_bus.publish(
            'enrichment.catalog.miss',
            {
                'job_id': job_id,
                'mpn': mpn
            }
        )

    @staticmethod
    def enrichment_api_called(
        job_id: str,
        supplier: str,
        mpn: str,
        response_time_ms: int,
        status_code: Optional[int] = None,
        result_count: Optional[int] = None,
        error_code: Optional[str] = None,
    ):
        """Publish supplier API call event with structured metadata."""
        event_bus.publish(
            f'enrichment.api.{supplier}_called',
            {
                'job_id': job_id,
                'supplier': supplier,
                'mpn': mpn,
                'response_time_ms': response_time_ms,
                'status_code': status_code,
                'result_count': result_count,
                'error_code': error_code,
                'schema_version': 1,
            },
        )

    @staticmethod
    def admin_workflow_paused(workflow_id: str, job_id: str, admin_user_id: str, reason: str):
        """Publish admin workflow paused event"""
        event_bus.publish(
            'admin.workflow.paused',
            {
                'workflow_id': workflow_id,
                'job_id': job_id,
                'admin_user_id': admin_user_id,
                'reason': reason
            },
            priority=9  # Very high priority
        )

    @staticmethod
    def admin_workflow_cancelled(workflow_id: str, job_id: str, admin_user_id: str, reason: str, affected_user_email: str):
        """Publish admin workflow cancelled event"""
        event_bus.publish(
            'admin.workflow.cancelled',
            {
                'workflow_id': workflow_id,
                'job_id': job_id,
                'admin_user_id': admin_user_id,
                'reason': reason,
                'affected_user_email': affected_user_email
            },
            priority=9
        )

    @staticmethod
    def user_login(user_id: str, email: str, ip_address: str, user_agent: str):
        """Publish user login event"""
        event_bus.publish(
            'auth.user.login',
            {
                'user_id': user_id,
                'email': email,
                'ip_address': ip_address,
                'user_agent': user_agent
            }
        )

    @staticmethod
    def user_logout(user_id: str, email: str):
        """Publish user logout event"""
        event_bus.publish(
            'auth.user.logout',
            {
                'user_id': user_id,
                'email': email
            }
        )

    @staticmethod
    def user_signup(user_id: str, email: str, organization_id: str, role: str = 'owner', plan: str = 'free', status: str = 'trialing', trial_end: str = None, full_name: str = None):
        """Publish new user signup event (used to trigger onboarding emails and Novu subscriber creation)."""
        event_bus.publish(
            'auth.user.signup',
            {
                'event_type': 'user_signup',  # Required by Novu consumer
                'user_id': user_id,
                'email': email,
                'organization_id': organization_id,
                'role': role,
                'plan': plan,
                'status': status,
                'trial_end': trial_end,
                'full_name': full_name,
            },
            priority=8,
        )
        logger.info(f"[Event] auth.user.signup published: user_id={user_id}, email={email}, plan={plan}, status={status}")

    @staticmethod
    def cns_bulk_upload_started(bulk_upload_id: str, job_id: str, admin_user_id: str, total_items: int):
        """Publish CNS bulk upload started event"""
        event_bus.publish(
            'cns.bulk_upload.started',
            {
                'bulk_upload_id': bulk_upload_id,
                'job_id': job_id,
                'admin_user_id': admin_user_id,
                'total_items': total_items
            }
        )

    @staticmethod
    def cns_catalog_component_added(component_id: str, mpn: str, manufacturer: str, quality_score: float):
        """Publish component added to catalog event"""
        event_bus.publish(
            'cns.catalog.component_added',
            {
                'component_id': component_id,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'quality_score': quality_score
            }
        )

    # ========================================================================
    # QUEUE STAGE COMPLETION EVENTS
    # ========================================================================

    @staticmethod
    def workflow_stage_completed(
        bom_id: str,
        organization_id: str,
        stage: str,
        workflow_id: str = None,
        user_id: str = None,
        duration_ms: int = None,
        items_processed: int = None,
        total_items: int = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Publish workflow stage completed event.

        This is a unified event for tracking queue progression.
        Each stage completion is logged for audit/monitoring purposes.

        Args:
            bom_id: BOM ID being processed
            organization_id: Organization ID
            stage: Stage name (raw_upload, parsing, enrichment, risk_analysis, complete)
            workflow_id: Temporal workflow ID (optional)
            user_id: User who initiated the workflow (optional)
            duration_ms: Stage duration in milliseconds (optional)
            items_processed: Number of items processed in this stage (optional)
            total_items: Total items in the BOM (optional)
            metadata: Additional stage-specific data (optional)
        """
        event_bus.publish(
            f'workflow.stage.{stage}.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': stage,
                'workflow_id': workflow_id,
                'user_id': user_id,
                'duration_ms': duration_ms,
                'items_processed': items_processed,
                'total_items': total_items,
                'completed_at': datetime.utcnow().isoformat(),
                **(metadata or {}),
            },
            event_type='stage_completed',
            priority=7  # High priority for stage completions
        )
        logger.info(f"[Event] workflow.stage.{stage}.completed: bom_id={bom_id}, items={items_processed}/{total_items}")

    @staticmethod
    def workflow_upload_completed(
        bom_id: str,
        organization_id: str,
        user_id: str = None,
        filename: str = None,
        file_size: int = None,
        s3_key: str = None,
        duration_ms: int = None
    ):
        """
        Publish upload stage completed event.

        Emitted when a BOM file has been successfully uploaded to storage.
        """
        event_bus.publish(
            'workflow.stage.raw_upload.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': 'raw_upload',
                'user_id': user_id,
                'filename': filename,
                'file_size': file_size,
                's3_key': s3_key,
                'duration_ms': duration_ms,
                'completed_at': datetime.utcnow().isoformat(),
            },
            event_type='upload_completed',
            priority=7
        )
        logger.info(f"[Event] workflow.stage.raw_upload.completed: bom_id={bom_id}, file={filename}")

    @staticmethod
    def workflow_parsing_completed(
        bom_id: str,
        organization_id: str,
        user_id: str = None,
        total_items: int = 0,
        valid_items: int = 0,
        invalid_items: int = 0,
        duration_ms: int = None
    ):
        """
        Publish parsing stage completed event.

        Emitted when a BOM file has been successfully parsed and validated.
        """
        event_bus.publish(
            'workflow.stage.parsing.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': 'parsing',
                'user_id': user_id,
                'total_items': total_items,
                'valid_items': valid_items,
                'invalid_items': invalid_items,
                'duration_ms': duration_ms,
                'completed_at': datetime.utcnow().isoformat(),
            },
            event_type='parsing_completed',
            priority=7
        )
        logger.info(f"[Event] workflow.stage.parsing.completed: bom_id={bom_id}, items={total_items}, valid={valid_items}")

    @staticmethod
    def workflow_enrichment_completed(
        bom_id: str,
        organization_id: str,
        user_id: str = None,
        total_items: int = 0,
        enriched_items: int = 0,
        failed_items: int = 0,
        cached_items: int = 0,
        duration_ms: int = None,
        avg_confidence: float = None
    ):
        """
        Publish enrichment stage completed event.

        Emitted when all components in a BOM have been enriched (or failed).
        """
        success_rate = (enriched_items / total_items * 100) if total_items > 0 else 0.0
        event_bus.publish(
            'workflow.stage.enrichment.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': 'enrichment',
                'user_id': user_id,
                'total_items': total_items,
                'enriched_items': enriched_items,
                'failed_items': failed_items,
                'cached_items': cached_items,
                'success_rate': round(success_rate, 2),
                'avg_confidence': avg_confidence,
                'duration_ms': duration_ms,
                'completed_at': datetime.utcnow().isoformat(),
            },
            event_type='enrichment_stage_completed',
            priority=8  # High priority - triggers risk analysis
        )
        logger.info(f"[Event] workflow.stage.enrichment.completed: bom_id={bom_id}, enriched={enriched_items}/{total_items}, success_rate={success_rate:.1f}%")

    @staticmethod
    def workflow_risk_analysis_stage_completed(
        bom_id: str,
        organization_id: str,
        user_id: str = None,
        health_grade: str = None,
        average_risk_score: float = None,
        total_items: int = 0,
        scored_items: int = 0,
        risk_distribution: Dict[str, int] = None,
        duration_ms: int = None
    ):
        """
        Publish risk analysis stage completed event.

        Emitted when risk analysis for all components is complete.
        """
        event_bus.publish(
            'workflow.stage.risk_analysis.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': 'risk_analysis',
                'user_id': user_id,
                'health_grade': health_grade,
                'average_risk_score': average_risk_score,
                'total_items': total_items,
                'scored_items': scored_items,
                'risk_distribution': risk_distribution or {},
                'duration_ms': duration_ms,
                'completed_at': datetime.utcnow().isoformat(),
            },
            event_type='risk_analysis_stage_completed',
            priority=8
        )
        logger.info(f"[Event] workflow.stage.risk_analysis.completed: bom_id={bom_id}, grade={health_grade}, scored={scored_items}/{total_items}")

    @staticmethod
    def workflow_processing_complete(
        bom_id: str,
        organization_id: str,
        user_id: str = None,
        total_items: int = 0,
        enriched_items: int = 0,
        failed_items: int = 0,
        health_grade: str = None,
        total_duration_ms: int = None,
        stages_completed: List[str] = None
    ):
        """
        Publish workflow complete event.

        Emitted when all processing stages are finished for a BOM.
        This is the final event in the queue progression.
        """
        success_rate = (enriched_items / total_items * 100) if total_items > 0 else 0.0
        event_bus.publish(
            'workflow.stage.complete.completed',
            {
                'bom_id': bom_id,
                'organization_id': organization_id,
                'stage': 'complete',
                'user_id': user_id,
                'total_items': total_items,
                'enriched_items': enriched_items,
                'failed_items': failed_items,
                'success_rate': round(success_rate, 2),
                'health_grade': health_grade,
                'total_duration_ms': total_duration_ms,
                'stages_completed': stages_completed or ['raw_upload', 'parsing', 'enrichment', 'risk_analysis', 'complete'],
                'completed_at': datetime.utcnow().isoformat(),
            },
            event_type='workflow_complete',
            priority=8  # High priority for final completion
        )
        logger.info(f"[Event] workflow.stage.complete: bom_id={bom_id}, grade={health_grade}, success_rate={success_rate:.1f}%")

    # ========================================================================
    # ADMIN WORKFLOW EVENTS
    # ========================================================================

    @staticmethod
    def admin_workflow_action(workflow_id: str, action: str, admin_id: str, metadata: Dict[str, Any] = None):
        """
        Publish admin workflow action event

        Actions: submitted, paused, resumed, cancelled, deleted
        These events are consumed by Temporal workers to control workflow execution
        """
        event_bus.publish(
            f'admin.workflow.{action}',
            {
                'workflow_id': workflow_id,
                'action': action,
                'admin_id': admin_id,
                'timestamp': datetime.utcnow().isoformat(),
                **(metadata or {})
            },
            priority=8  # High priority for admin actions
        )

    @staticmethod
    def admin_bom_deleted(job_id: str, admin_id: str, filename: str = None):
        """Publish admin BOM deletion event"""
        event_bus.publish(
            'admin.bom.deleted',
            {
                'job_id': job_id,
                'admin_id': admin_id,
                'filename': filename,
                'timestamp': datetime.utcnow().isoformat()
            },
            priority=7
        )

    @staticmethod
    def admin_bom_updated(job_id: str, admin_id: str, changes: Dict[str, Any]):
        """Publish admin BOM update event"""
        event_bus.publish(
            'admin.bom.updated',
            {
                'job_id': job_id,
                'admin_id': admin_id,
                'changes': changes,
                'timestamp': datetime.utcnow().isoformat()
            },
            priority=6
        )

    @staticmethod
    def admin_workflow_submitted(job_id: str, admin_id: str, total_items: int):
        """Publish admin workflow submission event (trigger enrichment)"""
        event_bus.publish(
            'admin.workflow.submitted',
            {
                'job_id': job_id,
                'admin_id': admin_id,
                'total_items': total_items,
                'timestamp': datetime.utcnow().isoformat()
            },
            priority=8  # High priority - triggers workflow
        )

    @staticmethod
    def admin_workflow_paused(workflow_id: str, admin_id: str):
        """Publish admin workflow pause event"""
        event_bus.publish(
            'admin.workflow.paused',
            {
                'workflow_id': workflow_id,
                'admin_id': admin_id,
                'timestamp': datetime.utcnow().isoformat()
            },
            priority=9  # Very high - immediate action needed
        )

    @staticmethod
    def admin_workflow_resumed(workflow_id: str, admin_id: str):
        """Publish admin workflow resume event"""
        event_bus.publish(
            'admin.workflow.resumed',
            {
                'workflow_id': workflow_id,
                'admin_id': admin_id,
                'timestamp': datetime.utcnow().isoformat()
            },
            priority=9  # Very high - immediate action needed
        )


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == '__main__':
    """
    Example usage of the event bus
    """
    import sys

    # Test connection
    logger.info("Testing EventBus connection...")

    try:
        with EventBus() as bus:
            logger.info("Connected to RabbitMQ")

            # Publish test event
            bus.publish(
                'test.event',
                {
                    'message': 'Hello from EventBus!',
                    'test_id': '12345'
                }
            )
            logger.info("Test event published")

            # Use event helpers
            EventPublisher.user_login(
                user_id='test-user-id',
                email='test@example.com',
                ip_address='127.0.0.1',
                user_agent='TestClient/1.0'
            )
            logger.info("User login event published")

        logger.info("\nEventBus test successful!")
        sys.exit(0)

    except Exception as e:
        logger.error(f"\nEventBus test failed: {e}", exc_info=True)
        sys.exit(1)
