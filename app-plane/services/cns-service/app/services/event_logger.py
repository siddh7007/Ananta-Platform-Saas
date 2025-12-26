"""
Event Logging Service for CNS

Comprehensive event logging that integrates with:
1. Database (enrichment_events table) - for persistence and querying
2. RabbitMQ (via EventPublisher) - for real-time streaming

This service provides a unified interface for logging all CNS processing events,
from workflow lifecycle to component-level enrichment progress.

Usage:
    from app.services.event_logger import EventLogger
    from app.database import get_db_session

    with get_db_session() as db:
        event_logger = EventLogger(db)
        event_logger.log_enrichment_progress(
            bom_id="uuid",
            organization_id="org-uuid",
            mpn="LM358",
            status="matched",
            confidence=0.95,
            source="DigiKey"
        )
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.types import DateTime as SQLDateTime

# Import event bus for RabbitMQ publishing
import sys
import os
parent_path = os.path.join(os.path.dirname(__file__), '..', '..', '..')
if os.path.exists(parent_path) and parent_path not in sys.path:
    sys.path.insert(0, parent_path)

try:
    from shared.event_bus import EventPublisher, event_bus
    EVENT_BUS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"EventPublisher not available: {e}. Events will only be logged to database.")
    EVENT_BUS_AVAILABLE = False

from app.models.base import Base, TimestampMixin

logger = logging.getLogger(__name__)


# ============================================================================
# DATABASE MODEL
# ============================================================================

class EnrichmentEvent(Base):
    """
    Enrichment events model - stores all CNS processing events

    Table: enrichment_events (Supabase database)

    Attributes:
        id: Primary key (UUID)
        event_id: Unique event identifier for deduplication
        event_type: Event type (processing_started, stage_started, enrichment_progress, etc.)
        routing_key: RabbitMQ routing key (e.g., 'cns.processing.started')
        bom_id: BOM identifier (UUID, required)
        tenant_id: Tenant/organization identifier (UUID, required) - for backwards compatibility
        organization_id: Organization identifier (text, optional) - preferred field
        project_id: Project identifier (UUID, optional)
        user_id: User who triggered the event (UUID, optional)
        source: Event source (customer, staff) - CHECK constraint enforced
        workflow_id: Temporal workflow ID (optional)
        state: Workflow state (JSONB, required)
        payload: Event payload with detailed data (JSONB, required)
        created_at: Event timestamp (auto-generated)
    """

    __tablename__ = "enrichment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    event_id = Column(String(255), nullable=False, unique=True)
    event_type = Column(String(100), nullable=False)
    routing_key = Column(String(255), nullable=True)

    # Identifiers
    bom_id = Column(UUID(as_uuid=True), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    organization_id = Column(Text, nullable=True)  # Optional
    project_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)

    # Event metadata
    source = Column(String(20), nullable=False)  # customer, staff (CHECK constraint)
    workflow_id = Column(String(255), nullable=True)

    # Event data
    state = Column(JSONB, nullable=False, server_default='{}')
    payload = Column(JSONB, nullable=False, server_default='{}')

    # Timestamp (managed by database)
    created_at = Column(SQLDateTime(timezone=True), server_default="now()")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": str(self.id),
            "event_id": self.event_id,
            "event_type": self.event_type,
            "routing_key": self.routing_key,
            "bom_id": str(self.bom_id) if self.bom_id else None,
            "organization_id": self.organization_id,
            "project_id": str(self.project_id) if self.project_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "source": self.source,
            "workflow_id": self.workflow_id,
            "state": self.state,
            "payload": self.payload,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ============================================================================
# EVENT LOGGER SERVICE
# ============================================================================

class EventLogger:
    """
    Unified event logging service for CNS

    Logs events to both database and RabbitMQ for:
    - Persistence and querying (database)
    - Real-time streaming and notifications (RabbitMQ)

    Handles errors gracefully - logging failures won't crash the application.
    """

    def __init__(self, db_session: Session):
        """
        Initialize event logger

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session
        self.logger = logging.getLogger(f"{__name__}.EventLogger")

    def _log_event(
        self,
        event_type: str,
        routing_key: str,
        bom_id: str,
        organization_id: str,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
        source: str = "customer",
        workflow_id: Optional[str] = None,
        state: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        priority: int = 5
    ) -> Optional[str]:
        """
        Internal method to log event to database and RabbitMQ

        Args:
            event_type: Event type identifier
            routing_key: RabbitMQ routing key
            bom_id: BOM identifier (required)
            organization_id: Organization identifier (required)
            project_id: Project identifier
            user_id: User identifier
            source: Event source (customer, staff) - defaults to "customer"
            workflow_id: Temporal workflow ID
            state: Current workflow state
            payload: Event-specific data
            priority: RabbitMQ message priority (0-10)

        Returns:
            Event ID if successful, None otherwise
        """
        event_id = str(uuid4())

        # Validate source (must match database CHECK constraint)
        if source not in ("customer", "staff"):
            self.logger.warning(f"Invalid source '{source}', defaulting to 'customer'")
            source = "customer"

        try:
            # 1. Persist to database
            # Note: tenant_id is set to organization_id for backwards compatibility
            event = EnrichmentEvent(
                event_id=event_id,
                event_type=event_type,
                routing_key=routing_key,
                bom_id=bom_id,
                tenant_id=organization_id,  # Required field (UUID)
                organization_id=organization_id,  # Optional field (text)
                project_id=project_id,
                user_id=user_id,
                source=source,
                workflow_id=workflow_id,
                state=state or {},
                payload=payload or {},
            )

            self.db.add(event)
            self.db.flush()  # Flush to get ID, but don't commit yet

            self.logger.debug(f"Event logged to database: {event_type} (id={event_id})")

            # 2. Publish to RabbitMQ for real-time streaming
            if EVENT_BUS_AVAILABLE:
                event_data = {
                    "event_id": event_id,
                    "bom_id": bom_id,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "user_id": user_id,
                    "source": source,
                    "workflow_id": workflow_id,
                    "state": state or {},
                    **(payload or {}),
                }

                try:
                    event_bus.publish(
                        routing_key=routing_key,
                        event_data=event_data,
                        event_type=event_type,
                        priority=priority
                    )
                    self.logger.debug(f"Event published to RabbitMQ: {routing_key}")
                except Exception as e:
                    # Log but don't fail - RabbitMQ is for real-time, not critical
                    self.logger.warning(f"Failed to publish event to RabbitMQ: {e}")

            return event_id

        except Exception as e:
            self.logger.error(f"Failed to log event {event_type}: {e}", exc_info=True)
            return None

    # ========================================================================
    # WORKFLOW LIFECYCLE EVENTS
    # ========================================================================

    def log_processing_started(
        self,
        bom_id: str,
        organization_id: str,
        workflow_id: str,
        source: str = "customer",
        total_items: int = 0,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Log processing workflow started event

        Args:
            bom_id: BOM identifier
            organization_id: Organization identifier
            workflow_id: Temporal workflow ID
            source: Event source (customer, staff, system)
            total_items: Total number of line items
            user_id: User who triggered processing
            project_id: Project identifier

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="processing_started",
            routing_key="cns.processing.started",
            bom_id=bom_id,
            organization_id=organization_id,
            project_id=project_id,
            user_id=user_id,
            source=source,
            workflow_id=workflow_id,
            state={
                "status": "started",
                "total_items": total_items,
                "processed_items": 0,
                "started_at": datetime.utcnow().isoformat(),
            },
            payload={
                "total_items": total_items,
                "message": f"Processing started for BOM with {total_items} items",
            },
            priority=7
        )

    def log_stage_started(
        self,
        bom_id: str,
        stage_name: str,
        organization_id: str,
        workflow_id: str,
        source: str = "customer",
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Log workflow stage started event

        Args:
            bom_id: BOM identifier
            stage_name: Stage name (parsing, validation, enrichment, risk_analysis)
            organization_id: Organization identifier
            workflow_id: Temporal workflow ID
            source: Event source
            user_id: User identifier
            metadata: Additional stage-specific metadata

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="stage_started",
            routing_key=f"cns.stage.{stage_name}.started",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            source=source,
            workflow_id=workflow_id,
            state={
                "current_stage": stage_name,
                "stage_status": "started",
                "started_at": datetime.utcnow().isoformat(),
            },
            payload={
                "stage_name": stage_name,
                "message": f"Stage '{stage_name}' started",
                **(metadata or {}),
            },
            priority=6
        )

    def log_stage_completed(
        self,
        bom_id: str,
        stage_name: str,
        organization_id: str,
        workflow_id: str,
        source: str = "customer",
        user_id: Optional[str] = None,
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Log workflow stage completed event

        Args:
            bom_id: BOM identifier
            stage_name: Stage name
            organization_id: Organization identifier
            workflow_id: Temporal workflow ID
            source: Event source
            user_id: User identifier
            duration_ms: Stage duration in milliseconds
            metadata: Additional stage results

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="stage_completed",
            routing_key=f"cns.stage.{stage_name}.completed",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            source=source,
            workflow_id=workflow_id,
            state={
                "current_stage": stage_name,
                "stage_status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
            },
            payload={
                "stage_name": stage_name,
                "duration_ms": duration_ms,
                "message": f"Stage '{stage_name}' completed",
                **(metadata or {}),
            },
            priority=6
        )

    # ========================================================================
    # ENRICHMENT PROGRESS EVENTS
    # ========================================================================

    def log_enrichment_progress(
        self,
        bom_id: str,
        organization_id: str,
        mpn: str,
        status: str,
        confidence: Optional[float] = None,
        source: Optional[str] = None,
        manufacturer: Optional[str] = None,
        component_id: Optional[str] = None,
        line_item_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        user_id: Optional[str] = None,
        enrichment_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Log component enrichment progress event

        Args:
            bom_id: BOM identifier
            organization_id: Organization identifier
            mpn: Manufacturer part number
            status: Enrichment status (matched, no_match, error, cached)
            confidence: Confidence score (0.0-1.0)
            source: Data source (DigiKey, Mouser, cache, etc.)
            manufacturer: Manufacturer name
            component_id: Component catalog ID
            line_item_id: BOM line item ID
            workflow_id: Temporal workflow ID
            user_id: User identifier
            enrichment_data: Additional enrichment data

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="enrichment_progress",
            routing_key="cns.enrichment.progress",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            workflow_id=workflow_id,
            source="system",
            payload={
                "mpn": mpn,
                "manufacturer": manufacturer,
                "status": status,
                "confidence": confidence,
                "data_source": source,
                "component_id": component_id,
                "line_item_id": line_item_id,
                "enrichment_data": enrichment_data or {},
            },
            priority=4  # Lower priority for frequent updates
        )

    # ========================================================================
    # RISK ANALYSIS EVENTS
    # ========================================================================

    def log_risk_alert(
        self,
        bom_id: str,
        organization_id: str,
        component_id: str,
        risk_score: float,
        risk_factors: List[str],
        mpn: Optional[str] = None,
        manufacturer: Optional[str] = None,
        workflow_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Log component risk alert event

        Args:
            bom_id: BOM identifier
            organization_id: Organization identifier
            component_id: Component identifier
            risk_score: Risk score (0-100)
            risk_factors: List of risk factors
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            workflow_id: Temporal workflow ID
            user_id: User identifier

        Returns:
            Event ID if successful
        """
        severity = "critical" if risk_score >= 80 else "high" if risk_score >= 60 else "medium"

        return self._log_event(
            event_type="risk_alert",
            routing_key=f"cns.risk.alert.{severity}",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            workflow_id=workflow_id,
            source="system",
            payload={
                "component_id": component_id,
                "mpn": mpn,
                "manufacturer": manufacturer,
                "risk_score": risk_score,
                "severity": severity,
                "risk_factors": risk_factors,
                "message": f"High risk component detected: {mpn} (score: {risk_score})",
            },
            priority=8 if severity == "critical" else 7
        )

    # ========================================================================
    # WORKFLOW CONTROL EVENTS
    # ========================================================================

    def log_workflow_paused(
        self,
        bom_id: str,
        workflow_id: str,
        organization_id: str,
        user_id: str,
        reason: Optional[str] = None,
    ) -> Optional[str]:
        """
        Log workflow paused event

        Args:
            bom_id: BOM identifier
            workflow_id: Temporal workflow ID
            organization_id: Organization identifier
            user_id: User who paused the workflow
            reason: Pause reason

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="workflow_paused",
            routing_key="cns.workflow.paused",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            workflow_id=workflow_id,
            source="staff",
            state={
                "status": "paused",
                "paused_at": datetime.utcnow().isoformat(),
                "paused_by": user_id,
            },
            payload={
                "reason": reason,
                "message": f"Workflow paused by user {user_id}",
            },
            priority=9  # High priority for control events
        )

    def log_workflow_resumed(
        self,
        bom_id: str,
        workflow_id: str,
        organization_id: str,
        user_id: str,
        reason: Optional[str] = None,
    ) -> Optional[str]:
        """
        Log workflow resumed event

        Args:
            bom_id: BOM identifier
            workflow_id: Temporal workflow ID
            organization_id: Organization identifier
            user_id: User who resumed the workflow
            reason: Resume reason

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="workflow_resumed",
            routing_key="cns.workflow.resumed",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            workflow_id=workflow_id,
            source="staff",
            state={
                "status": "running",
                "resumed_at": datetime.utcnow().isoformat(),
                "resumed_by": user_id,
            },
            payload={
                "reason": reason,
                "message": f"Workflow resumed by user {user_id}",
            },
            priority=9  # High priority for control events
        )

    # ========================================================================
    # ERROR EVENTS
    # ========================================================================

    def log_error(
        self,
        bom_id: str,
        organization_id: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        workflow_id: Optional[str] = None,
        user_id: Optional[str] = None,
        source: str = "system",
    ) -> Optional[str]:
        """
        Log error event

        Args:
            bom_id: BOM identifier
            organization_id: Organization identifier
            error_message: Error message
            error_details: Detailed error information
            error_code: Error code
            workflow_id: Temporal workflow ID
            user_id: User identifier
            source: Event source

        Returns:
            Event ID if successful
        """
        return self._log_event(
            event_type="error",
            routing_key="cns.error",
            bom_id=bom_id,
            organization_id=organization_id,
            user_id=user_id,
            workflow_id=workflow_id,
            source=source,
            payload={
                "error_code": error_code,
                "error_message": error_message,
                "error_details": error_details or {},
                "occurred_at": datetime.utcnow().isoformat(),
            },
            priority=8  # High priority for errors
        )

    # ========================================================================
    # QUERY METHODS
    # ========================================================================

    def get_events_by_bom(
        self,
        bom_id: str,
        event_types: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[EnrichmentEvent]:
        """
        Get events for a specific BOM

        Args:
            bom_id: BOM identifier
            event_types: Filter by event types (optional)
            limit: Maximum number of events to return

        Returns:
            List of enrichment events
        """
        query = self.db.query(EnrichmentEvent).filter(
            EnrichmentEvent.bom_id == bom_id
        )

        if event_types:
            query = query.filter(EnrichmentEvent.event_type.in_(event_types))

        return query.order_by(EnrichmentEvent.created_at.desc()).limit(limit).all()

    def get_events_by_workflow(
        self,
        workflow_id: str,
        limit: int = 100
    ) -> List[EnrichmentEvent]:
        """
        Get events for a specific workflow

        Args:
            workflow_id: Temporal workflow ID
            limit: Maximum number of events to return

        Returns:
            List of enrichment events
        """
        return self.db.query(EnrichmentEvent).filter(
            EnrichmentEvent.workflow_id == workflow_id
        ).order_by(EnrichmentEvent.created_at.desc()).limit(limit).all()

    def get_recent_errors(
        self,
        organization_id: str,
        hours: int = 24,
        limit: int = 50
    ) -> List[EnrichmentEvent]:
        """
        Get recent error events for an organization

        Args:
            organization_id: Organization identifier
            hours: Number of hours to look back
            limit: Maximum number of errors to return

        Returns:
            List of error events
        """
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        return self.db.query(EnrichmentEvent).filter(
            EnrichmentEvent.organization_id == organization_id,
            EnrichmentEvent.event_type == "error",
            EnrichmentEvent.created_at >= cutoff
        ).order_by(EnrichmentEvent.created_at.desc()).limit(limit).all()


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

__all__ = [
    "EventLogger",
    "EnrichmentEvent",
]
