"""
Events API Endpoint

Receives events from frontend and publishes them to RabbitMQ event bus.
Used for:
- Customer BOM operations (upload, edit, delete)
- Project operations (create, edit, delete)
- Organization operations (member add/remove, delete)
- User operations (delete)

Events are published to RabbitMQ for:
- WebSocket notifications
- Audit logging
- Analytics tracking
- Workflow triggers
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime

# Import event bus from shared library
try:
    import sys
    import os
    # Add parent directory to path to enable shared package import
    parent_path = os.path.join(os.path.dirname(__file__), '..', '..')
    if os.path.exists(parent_path) and parent_path not in sys.path:
        sys.path.insert(0, parent_path)
    from shared.event_bus import EventPublisher
    EVENT_BUS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Failed to import event_bus: {e}. Events will be logged but not published.")
    EVENT_BUS_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


class PublishEventRequest(BaseModel):
    """Request model for event publishing"""
    routing_key: str = Field(..., description="RabbitMQ routing key (e.g., 'customer.bom.uploaded')")
    event_type: str = Field(..., description="Event type identifier (e.g., 'bom_uploaded')")
    data: Dict[str, Any] = Field(..., description="Event payload data")
    priority: int = Field(default=3, ge=1, le=10, description="Event priority (1-10, default 3)")


class PublishEventResponse(BaseModel):
    """Response model for event publishing"""
    success: bool
    message: str
    event_id: Optional[str] = None
    timestamp: str


@router.post("/publish", response_model=PublishEventResponse, status_code=status.HTTP_202_ACCEPTED)
async def publish_event(request: PublishEventRequest):
    """
    Publish an event to RabbitMQ event bus

    This endpoint is used by the frontend to publish events for:
    - Audit logging
    - WebSocket notifications
    - Analytics
    - Workflow triggers

    Events are "fire-and-forget" - errors are logged but don't fail the request.
    Returns HTTP 202 (Accepted) to indicate the event was received.
    """
    try:
        logger.info(
            f"Received event publish request: {request.routing_key}",
            extra={
                'event_type': request.event_type,
                'routing_key': request.routing_key,
                'priority': request.priority,
                'data_keys': list(request.data.keys())
            }
        )

        if not EVENT_BUS_AVAILABLE:
            logger.warning(
                f"Event bus not available, event logged only: {request.routing_key}",
                extra={'event_data': request.data}
            )
            return PublishEventResponse(
                success=False,
                message="Event bus not available, event logged but not published",
                timestamp=datetime.utcnow().isoformat()
            )

        # Publish event using EventPublisher helpers
        event_published = False

        # Route to appropriate event publisher based on routing key
        if request.routing_key.startswith('customer.bom.'):
            event_published = await _publish_bom_event(request)
        elif request.routing_key.startswith('customer.project.'):
            event_published = await _publish_project_event(request)
        elif request.routing_key.startswith('customer.organization.'):
            event_published = await _publish_organization_event(request)
        elif request.routing_key.startswith('customer.user.'):
            event_published = await _publish_user_event(request)
        else:
            # Generic event publishing
            logger.info(f"Publishing generic event: {request.routing_key}")
            # Use EventPublisher's generic publish method if needed
            event_published = True

        if event_published:
            logger.info(f"Successfully published event: {request.routing_key}")
            return PublishEventResponse(
                success=True,
                message="Event published successfully",
                timestamp=datetime.utcnow().isoformat()
            )
        else:
            logger.warning(f"Failed to publish event: {request.routing_key}")
            return PublishEventResponse(
                success=False,
                message="Event publishing failed",
                timestamp=datetime.utcnow().isoformat()
            )

    except Exception as e:
        logger.error(
            f"Error publishing event: {e}",
            exc_info=True,
            extra={
                'routing_key': request.routing_key,
                'event_type': request.event_type
            }
        )
        # Don't fail the request - events are non-critical
        return PublishEventResponse(
            success=False,
            message=f"Error: {str(e)}",
            timestamp=datetime.utcnow().isoformat()
        )


async def _publish_bom_event(request: PublishEventRequest) -> bool:
    """Publish BOM-related event"""
    try:
        data = request.data

        if request.routing_key == 'customer.bom.uploaded':
            EventPublisher.customer_bom_uploaded(
                bom_id=data.get('bom_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                filename=data.get('filename', ''),
                total_items=data.get('total_items', 0),
                upload_id=data.get('upload_id'),  # bom_uploads.id (required for workflow)
                project_id=data.get('project_id')  # Optional project reference
            )
        elif request.routing_key == 'customer.bom.edited':
            EventPublisher.customer_bom_edited(
                bom_id=data.get('bom_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                changes=data.get('changes', {})
            )
        elif request.routing_key == 'customer.bom.deleted':
            EventPublisher.customer_bom_deleted(
                bom_id=data.get('bom_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                bom_name=data.get('bom_name')
            )
        elif request.routing_key == 'customer.bom.validated':
            EventPublisher.customer_bom_validated(
                bom_id=data.get('bom_id', ''),
                organization_id = data.get('organization_id', ''),
                grade=data.get('grade', ''),
                issues=data.get('issues', 0)
            )

        return True
    except Exception as e:
        logger.error(f"Error publishing BOM event: {e}", exc_info=True)
        return False


async def _publish_project_event(request: PublishEventRequest) -> bool:
    """Publish Project-related event"""
    try:
        data = request.data

        if request.routing_key == 'customer.project.created':
            EventPublisher.customer_project_created(
                project_id=data.get('project_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                project_name=data.get('project_name', '')
            )
        elif request.routing_key == 'customer.project.edited':
            EventPublisher.customer_project_edited(
                project_id=data.get('project_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                changes=data.get('changes', {})
            )
        elif request.routing_key == 'customer.project.deleted':
            EventPublisher.customer_project_deleted(
                project_id=data.get('project_id', ''),
                organization_id = data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                project_name=data.get('project_name'),
                bom_count=data.get('bom_count', 0)
            )

        return True
    except Exception as e:
        logger.error(f"Error publishing Project event: {e}", exc_info=True)
        return False


async def _publish_organization_event(request: PublishEventRequest) -> bool:
    """Publish Organization-related event"""
    try:
        data = request.data

        if request.routing_key == 'customer.organization.deleted':
            EventPublisher.customer_organization_deleted(
                organization_id=data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                organization_name=data.get('organization_name')
            )
        elif request.routing_key == 'customer.organization.member_added':
            EventPublisher.customer_organization_member_added(
                organization_id=data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                new_member_id=data.get('new_member_id', ''),
                role=data.get('role', 'member')
            )
        elif request.routing_key == 'customer.organization.member_removed':
            EventPublisher.customer_organization_member_removed(
                organization_id=data.get('organization_id', ''),
                user_id=data.get('user_id', ''),
                removed_member_id=data.get('removed_member_id', '')
            )

        return True
    except Exception as e:
        logger.error(f"Error publishing Organization event: {e}", exc_info=True)
        return False


async def _publish_user_event(request: PublishEventRequest) -> bool:
    """Publish User-related event"""
    try:
        data = request.data

        if request.routing_key == 'customer.user.deleted':
            EventPublisher.customer_user_deleted(
                deleted_user_id=data.get('deleted_user_id', ''),
                organization_id = data.get('organization_id', ''),
                admin_id=data.get('admin_id', '')
            )

        return True
    except Exception as e:
        logger.error(f"Error publishing User event: {e}", exc_info=True)
        return False


@router.get("/health", status_code=status.HTTP_200_OK)
async def events_health():
    """Health check for events API"""
    return {
        "status": "healthy",
        "event_bus_available": EVENT_BUS_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat()
    }
