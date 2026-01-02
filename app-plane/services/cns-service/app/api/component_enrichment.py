"""
Single Component Enrichment API

Endpoints for triggering and monitoring single component enrichment workflows.

Features:
- Start enrichment via Temporal workflow (direct)
- Start enrichment via RabbitMQ Stream (event-driven)
- Query workflow status from Temporal
- SSE stream for real-time progress
- Batch enrichment support

All enrichment steps are visible in Temporal UI with full input/output data.
"""

import asyncio
import json
import logging
import time
from typing import AsyncGenerator, Dict, Any, List, Optional
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.cache.redis_cache import get_redis_client
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/component", tags=["single-component-enrichment"])


# =============================================================================
# Request/Response Models
# =============================================================================

class SingleComponentEnrichRequest(BaseModel):
    """Request model for single component enrichment"""
    mpn: str = Field(..., description="Manufacturer Part Number to enrich")
    manufacturer: Optional[str] = Field(None, description="Manufacturer name (optional, will be auto-detected if not provided)")
    organization_id: str = Field(..., description="Organization ID for multi-tenant isolation")
    force_refresh: bool = Field(False, description="Force re-enrichment even if component exists in catalog")
    enable_suppliers: bool = Field(True, description="Enable supplier API enrichment (DigiKey, Mouser, etc.)")
    enable_ai: bool = Field(False, description="Enable AI-based category/specs enhancement")
    enable_web_scraping: bool = Field(False, description="Enable web scraping for additional data")
    correlation_id: Optional[str] = Field(None, description="Optional correlation ID for tracking")


class BatchComponentEnrichRequest(BaseModel):
    """Request model for batch component enrichment"""
    components: List[Dict[str, str]] = Field(..., description="List of components [{mpn, manufacturer?}, ...]")
    organization_id: str = Field(..., description="Organization ID")
    force_refresh: bool = Field(False, description="Force re-enrichment for all components")
    enable_suppliers: bool = Field(True, description="Enable supplier APIs")
    enable_ai: bool = Field(False, description="Enable AI enhancement")
    enable_web_scraping: bool = Field(False, description="Enable web scraping")
    correlation_id: Optional[str] = Field(None, description="Batch correlation ID")


class SingleComponentEnrichResponse(BaseModel):
    """Response model for enrichment request"""
    workflow_id: str = Field(..., description="Temporal workflow ID")
    status: str = Field(..., description="Workflow status (started, queued)")
    mpn: str = Field(..., description="MPN being enriched")
    manufacturer: Optional[str] = Field(None, description="Manufacturer")
    status_url: str = Field(..., description="URL to check workflow status")
    stream_url: str = Field(..., description="URL for SSE progress stream")
    temporal_ui_url: str = Field(..., description="URL to view workflow in Temporal UI")


class BatchEnrichResponse(BaseModel):
    """Response model for batch enrichment"""
    batch_id: str = Field(..., description="Batch correlation ID")
    workflow_count: int = Field(..., description="Number of workflows started")
    workflows: List[Dict[str, str]] = Field(..., description="List of workflow IDs and MPNs")
    status: str = Field(..., description="Batch status")


class WorkflowStatusResponse(BaseModel):
    """Response model for workflow status"""
    workflow_id: str
    status: str  # running, completed, failed, cancelled, timed_out
    mpn: str
    manufacturer: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    result: Optional[Dict[str, Any]]  # Full result when completed
    progress: Optional[Dict[str, Any]]  # Progress info when running
    error: Optional[str]  # Error message when failed


# =============================================================================
# SSE Streaming for Progress
# =============================================================================

class SSEMessage:
    """Server-Sent Event message formatter"""

    @staticmethod
    def format(data: dict, event: str = None, id: str = None, retry: int = None) -> str:
        """Format data as SSE message"""
        message = ""
        if event:
            message += f"event: {event}\n"
        if id:
            message += f"id: {id}\n"
        if retry:
            message += f"retry: {retry}\n"
        message += f"data: {json.dumps(data)}\n\n"
        return message


async def component_enrichment_event_stream(workflow_id: str) -> AsyncGenerator[str, None]:
    """
    Async generator for SSE-formatted component enrichment events.

    Subscribes to Redis channel `component:enrich:{workflow_id}` for progress updates.

    Args:
        workflow_id: Workflow ID to stream events for

    Yields:
        SSE-formatted event strings
    """
    redis_client: Redis = None
    pubsub = None

    try:
        redis_client = await get_redis_client()
        pubsub = redis_client.pubsub()

        # Channel must match what workflow publishes to (single_component_workflow.py line 1088)
        channel = f"single-component:{workflow_id}"
        await pubsub.subscribe(channel)

        logger.info(f"[SSE] Client connected to stream for workflow: {workflow_id}")

        # Send initial connection confirmation
        yield SSEMessage.format(
            {"type": "connected", "workflow_id": workflow_id, "message": "Stream connected"},
            event="connected"
        )

        keepalive_interval = 30
        last_keepalive = asyncio.get_event_loop().time()

        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=1.0
                )

                if message and message['type'] == 'message':
                    try:
                        event_data = json.loads(message['data'])
                        event_type = event_data.get('event_type', 'progress')

                        yield SSEMessage.format(
                            event_data,
                            event=event_type,
                            id=event_data.get('event_id')
                        )

                        logger.debug(f"[SSE] Sent event {event_type} for workflow {workflow_id}")

                        # If enrichment completed or failed, close stream
                        if event_type in ['completed', 'failed', 'cancelled']:
                            yield SSEMessage.format(
                                {"type": "stream_end", "reason": event_type},
                                event="stream_end"
                            )
                            logger.info(f"[SSE] Stream ended for workflow {workflow_id}: {event_type}")
                            break

                    except json.JSONDecodeError as e:
                        logger.error(f"[SSE] Failed to decode event data: {e}")
                        continue

                # Send keepalive
                current_time = asyncio.get_event_loop().time()
                if current_time - last_keepalive > keepalive_interval:
                    yield ": keepalive\n\n"
                    last_keepalive = current_time

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                logger.info(f"[SSE] Client disconnected from workflow {workflow_id}")
                break

    except RedisError as e:
        logger.error(f"[SSE] Redis error for workflow {workflow_id}: {e}")
        yield SSEMessage.format(
            {"type": "error", "message": "Redis connection error"},
            event="error"
        )
    except Exception as e:
        logger.error(f"[SSE] Unexpected error for workflow {workflow_id}: {e}", exc_info=True)
        yield SSEMessage.format(
            {"type": "error", "message": "Internal server error"},
            event="error"
        )
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe()
                await pubsub.close()
            except Exception as e:
                logger.warning(f"[SSE] Error during pubsub cleanup: {e}")


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/enrich", response_model=SingleComponentEnrichResponse)
async def start_component_enrichment(
    request: Request,
    body: SingleComponentEnrichRequest
):
    """
    Start single component enrichment workflow.

    This endpoint starts a Temporal workflow that enriches a single component
    with data from multiple sources (catalog, suppliers, AI, web scraping).

    Each enrichment step is visible in Temporal UI with full input/output data
    for debugging and monitoring.

    Args:
        body: Enrichment request with MPN and options

    Returns:
        Workflow ID and URLs to track progress

    Example:
        ```bash
        curl -X POST "http://localhost:27200/api/component/enrich" \\
          -H "Content-Type: application/json" \\
          -H "Authorization: Bearer $TOKEN" \\
          -d '{
            "mpn": "STM32F407VGT6",
            "manufacturer": "STMicroelectronics",
            "organization_id": "org-123",
            "enable_suppliers": true
          }'
        ```
    """
    try:
        from temporalio.client import Client
        from temporalio.common import WorkflowIDReusePolicy
        from app.workflows.single_component_workflow import (
            SingleComponentEnrichmentWorkflow,
            SingleComponentRequest
        )

        # Generate workflow ID
        timestamp = int(time.time())
        safe_mpn = body.mpn.replace('/', '_').replace(' ', '_')[:50]
        workflow_id = f"single-component-{safe_mpn}-{timestamp}"

        # Get request metadata
        requested_by = None
        auth_context = getattr(request.state, 'auth_context', None)
        if auth_context:
            # AuthContext is a dataclass, access attributes directly
            requested_by = getattr(auth_context, 'user_id', None)

        # Create workflow request
        workflow_request = SingleComponentRequest(
            workflow_id=workflow_id,
            mpn=body.mpn,
            manufacturer=body.manufacturer,
            organization_id=body.organization_id,
            force_refresh=body.force_refresh,
            enable_suppliers=body.enable_suppliers,
            enable_ai=body.enable_ai,
            enable_web_scraping=body.enable_web_scraping,
            requested_by=requested_by,
            request_source='api',
            correlation_id=body.correlation_id
        )

        # Connect to Temporal
        temporal_host = settings.temporal_host
        temporal_namespace = settings.temporal_namespace

        logger.info(f"[ENRICH] Connecting to Temporal at {temporal_host}")

        client = await Client.connect(
            temporal_host,
            namespace=temporal_namespace
        )

        # Start workflow
        logger.info(
            f"[ENRICH] Starting workflow: {workflow_id} "
            f"(mpn={body.mpn}, manufacturer={body.manufacturer or 'auto'})"
        )

        handle = await client.start_workflow(
            SingleComponentEnrichmentWorkflow.run,
            workflow_request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            memo={
                'mpn': body.mpn,
                'manufacturer': body.manufacturer or '',
                'organization_id': body.organization_id,
                'force_refresh': str(body.force_refresh),
                'request_source': 'api',
            },
            id_reuse_policy=WorkflowIDReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
            execution_timeout=timedelta(minutes=10),
            run_timeout=timedelta(minutes=5)
        )

        logger.info(
            f"[ENRICH] Workflow started: {workflow_id} "
            f"(run_id={handle.first_execution_run_id})"
        )

        # Build response URLs
        base_url = str(request.base_url).rstrip('/')
        temporal_ui_base = getattr(settings, 'temporal_ui_url', None) or "http://localhost:27021"

        return SingleComponentEnrichResponse(
            workflow_id=workflow_id,
            status="started",
            mpn=body.mpn,
            manufacturer=body.manufacturer,
            status_url=f"{base_url}/api/component/enrich/{workflow_id}/status",
            stream_url=f"{base_url}/api/component/enrich/{workflow_id}/stream",
            temporal_ui_url=f"{temporal_ui_base}/namespaces/{temporal_namespace}/workflows/{workflow_id}"
        )

    except Exception as e:
        error_msg = str(e).lower()

        # Handle duplicate workflow
        if 'already started' in error_msg or 'already running' in error_msg:
            raise HTTPException(
                status_code=409,
                detail=f"Enrichment already in progress for MPN: {body.mpn}"
            )

        logger.error(f"[ENRICH] Failed to start workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start enrichment workflow: {str(e)}"
        )


@router.post("/enrich/batch", response_model=BatchEnrichResponse)
async def start_batch_enrichment(
    request: Request,
    body: BatchComponentEnrichRequest
):
    """
    Start batch component enrichment.

    Starts individual workflows for each component in the batch.
    Components are processed in parallel (up to concurrency limit).

    Args:
        body: Batch enrichment request

    Returns:
        Batch ID and list of workflow IDs
    """
    import uuid

    batch_id = body.correlation_id or str(uuid.uuid4())
    workflows = []
    errors = []

    for component in body.components:
        mpn = component.get('mpn')
        if not mpn:
            errors.append({'error': 'Missing MPN', 'component': component})
            continue

        try:
            # Create individual request
            single_request = SingleComponentEnrichRequest(
                mpn=mpn,
                manufacturer=component.get('manufacturer'),
                organization_id=body.organization_id,
                force_refresh=body.force_refresh,
                enable_suppliers=body.enable_suppliers,
                enable_ai=body.enable_ai,
                enable_web_scraping=body.enable_web_scraping,
                correlation_id=batch_id
            )

            # Start workflow (reuse single enrichment logic)
            response = await start_component_enrichment(request, single_request)
            workflows.append({
                'mpn': mpn,
                'workflow_id': response.workflow_id,
                'status_url': response.status_url
            })

            # Small delay to avoid overwhelming Temporal
            await asyncio.sleep(0.1)

        except HTTPException as e:
            errors.append({'mpn': mpn, 'error': e.detail})
        except Exception as e:
            errors.append({'mpn': mpn, 'error': str(e)})

    return BatchEnrichResponse(
        batch_id=batch_id,
        workflow_count=len(workflows),
        workflows=workflows,
        status="started" if workflows else "failed"
    )


@router.get("/enrich/{workflow_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(workflow_id: str):
    """
    Get enrichment workflow status from Temporal.

    Queries the Temporal workflow to get current status and result.

    Args:
        workflow_id: Workflow ID to query

    Returns:
        Workflow status and result (if completed)
    """
    try:
        from temporalio.client import Client, WorkflowExecutionStatus

        # Connect to Temporal
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        # Get workflow handle
        handle = client.get_workflow_handle(workflow_id)

        # Describe workflow
        desc = await handle.describe()

        # Map Temporal status to our status
        status_map = {
            WorkflowExecutionStatus.RUNNING: "running",
            WorkflowExecutionStatus.COMPLETED: "completed",
            WorkflowExecutionStatus.FAILED: "failed",
            WorkflowExecutionStatus.CANCELED: "cancelled",
            WorkflowExecutionStatus.TERMINATED: "terminated",
            WorkflowExecutionStatus.TIMED_OUT: "timed_out",
        }

        status = status_map.get(desc.status, "unknown")

        # Extract MPN from memo (memo is an async method in temporalio)
        try:
            import asyncio
            if callable(desc.memo):
                memo_result = desc.memo()
                if asyncio.iscoroutine(memo_result):
                    memo = await memo_result
                else:
                    memo = memo_result
            else:
                memo = desc.memo or {}
        except Exception as e:
            logger.warning(f"[STATUS] Failed to get memo: {e}")
            memo = {}
        mpn = memo.get('mpn', workflow_id.replace('single-component-', '').rsplit('-', 1)[0])
        manufacturer = memo.get('manufacturer')

        # Get result if completed
        result = None
        error = None
        progress = None

        if status == "completed":
            try:
                result = await handle.result()
            except Exception as e:
                logger.warning(f"[STATUS] Failed to get result: {e}")

        elif status == "failed":
            try:
                # Try to get failure info
                await handle.result()
            except Exception as e:
                error = str(e)

        elif status == "running":
            # Try to query progress
            try:
                progress = await handle.query("get_progress")
            except Exception as e:
                logger.debug(f"[STATUS] Progress query failed (normal if not implemented): {e}")

        return WorkflowStatusResponse(
            workflow_id=workflow_id,
            status=status,
            mpn=mpn,
            manufacturer=manufacturer,
            started_at=desc.start_time.isoformat() if desc.start_time else None,
            completed_at=desc.close_time.isoformat() if desc.close_time else None,
            result=result,
            progress=progress,
            error=error
        )

    except Exception as e:
        error_msg = str(e).lower()

        if 'not found' in error_msg:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow not found: {workflow_id}"
            )

        logger.error(f"[STATUS] Error querying workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query workflow status: {str(e)}"
        )


@router.options("/enrich/{workflow_id}/stream")
async def stream_options(request: Request, workflow_id: str):
    """CORS preflight handler for SSE endpoint"""
    from fastapi.responses import Response

    origin = request.headers.get("origin") or "*"
    if settings.cors_allow_credentials and origin:
        allow_origin = origin
    else:
        allow_origin = "*"

    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Credentials": "true" if settings.cors_allow_credentials else "false",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "3600",
        }
    )


@router.get("/enrich/{workflow_id}/stream")
async def stream_enrichment_progress(
    request: Request,
    workflow_id: str,
    token: str = Query(None, description="Auth token for SSE (since EventSource doesn't support headers)")
):
    """
    SSE endpoint for real-time enrichment progress.

    Streams progress updates as the workflow executes each activity.

    Authentication:
        Pass token as query parameter since EventSource doesn't support custom headers.

    Args:
        workflow_id: Workflow ID to stream
        token: Auth token (query param)

    Returns:
        SSE stream with progress events

    Example:
        ```javascript
        const eventSource = new EventSource(
            '/api/component/enrich/single-component-xxx/stream?token=xxx'
        );

        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            console.log('Step:', data.current_step, 'Progress:', data.percent_complete);
        });

        eventSource.addEventListener('completed', (e) => {
            console.log('Enrichment complete!');
            eventSource.close();
        });
        ```
    """
    if not workflow_id:
        raise HTTPException(status_code=400, detail="Workflow ID is required")

    # Validate token (simplified - uses same logic as enrichment_stream.py)
    admin_token = getattr(settings, 'admin_api_token', None)
    auth_context = getattr(request.state, 'auth_context', None)

    if not auth_context:
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")

        if token.startswith('eyJ'):
            from app.middleware.auth_middleware import validate_auth0_token, validate_supabase_token

            claims = None
            try:
                claims = await validate_auth0_token(token)
            except Exception:
                pass

            if not claims:
                try:
                    claims = await validate_supabase_token(token)
                except Exception:
                    pass

            if not claims:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
        else:
            if not admin_token or token != admin_token:
                raise HTTPException(status_code=401, detail="Invalid token")

    origin = request.headers.get("origin") or "*"
    if settings.cors_allow_credentials and origin:
        allow_origin = origin
    else:
        allow_origin = "*"

    return StreamingResponse(
        component_enrichment_event_stream(workflow_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Credentials": "true" if settings.cors_allow_credentials else "false",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@router.post("/enrich/{workflow_id}/cancel")
async def cancel_enrichment(workflow_id: str):
    """
    Cancel a running enrichment workflow.

    Sends a cancel signal to the Temporal workflow. The workflow will
    complete the current activity before cancelling.

    Args:
        workflow_id: Workflow ID to cancel

    Returns:
        Cancellation status
    """
    try:
        from temporalio.client import Client

        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        handle = client.get_workflow_handle(workflow_id)

        # Send cancel signal to workflow
        await handle.signal("cancel")

        logger.info(f"[CANCEL] Sent cancel signal to workflow: {workflow_id}")

        return {
            "workflow_id": workflow_id,
            "status": "cancel_requested",
            "message": "Cancel signal sent. Workflow will stop after current activity completes."
        }

    except Exception as e:
        error_msg = str(e).lower()

        if 'not found' in error_msg:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow not found: {workflow_id}"
            )

        logger.error(f"[CANCEL] Error cancelling workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel workflow: {str(e)}"
        )


@router.get("/health")
async def component_enrichment_health():
    """Health check for component enrichment service"""
    try:
        from temporalio.client import Client

        # Check Temporal connection
        client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace
        )

        # Check Redis connection
        redis_client = await get_redis_client()
        await redis_client.ping()

        return {
            "status": "healthy",
            "temporal": "connected",
            "redis": "connected",
            "namespace": settings.temporal_namespace,
            "task_queue": settings.temporal_task_queue
        }

    except Exception as e:
        logger.error(f"[HEALTH] Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )
