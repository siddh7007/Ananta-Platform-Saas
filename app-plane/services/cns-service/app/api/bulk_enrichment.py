"""
Bulk Upload Enrichment Control API

Provides manual enrichment control for staff bulk uploads stored in Redis.

Features:
- Start enrichment (with staff approval)
- Pause enrichment
- Resume enrichment
- Stop/Cancel enrichment
- Delete enrichment job
- Get enrichment status
"""

import logging
from typing import Optional
from datetime import timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from temporalio.common import WorkflowIDReusePolicy

from app.utils.bulk_upload_redis import get_bulk_upload_storage
from app.core.temporal_client import get_temporal_client_manager
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bulk/enrichment", tags=["Bulk Upload Enrichment"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class StartBulkEnrichmentRequest(BaseModel):
    """Request to start enrichment for a bulk upload"""
    upload_id: str  # Upload ID from Redis
    organization_id: str  # Required organization ID for multi-tenancy
    project_id: Optional[str] = None
    priority: int = 5  # 1-9 scale (9=highest)


class EnrichmentControlRequest(BaseModel):
    """Request to pause/stop enrichment"""
    upload_id: str
    reason: Optional[str] = None


class BulkEnrichmentStatusResponse(BaseModel):
    """Enrichment status response"""
    upload_id: str
    workflow_id: str
    status: str  # pending | enriching | paused | completed | failed | cancelled
    progress: dict  # {total_items, enriched_items, failed_items, percent_complete}
    redis_expires_at: Optional[str]


# ============================================================================
# START ENRICHMENT (Manual Trigger by Staff)
# ============================================================================

@router.post("/start")
async def start_bulk_enrichment(request: StartBulkEnrichmentRequest):
    """
    Start enrichment workflow for a staff bulk upload

    Staff manually triggers this after reviewing the upload in CNS Dashboard.

    Flow:
    1. Check if upload exists in Redis
    2. Get line items count
    3. Start Temporal BOMEnrichmentWorkflow (source='staff')
    4. Update Redis status to 'enriching'
    5. Extend Redis TTL to 48h (during processing)
    6. Return workflow ID
    """
    logger.info(f"[Bulk Enrichment] Starting enrichment for upload: {request.upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(request.upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Check if upload exists
        if not redis_storage.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Upload not found in Redis: {request.upload_id} (may have expired)"
            )

        # Get metadata
        metadata = redis_storage.get_metadata()
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail=f"Upload metadata not found: {request.upload_id}"
            )

        # Get line items count
        total_items = redis_storage.get_line_items_count()
        if total_items == 0:
            raise HTTPException(
                status_code=400,
                detail="No line items to enrich"
            )

        logger.info(f"[Bulk Enrichment] Found {total_items} line items to enrich")

        # Validate priority
        if not (1 <= request.priority <= 9):
            raise HTTPException(
                status_code=400,
                detail="Priority must be between 1 (lowest) and 9 (highest)"
            )

        # Check Temporal connection
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected. Cannot start enrichment workflow."
            )

        # Import enrichment workflow
        from app.workflows.bom_enrichment import (
            BOMEnrichmentWorkflow,
            BOMEnrichmentRequest as WorkflowRequest
        )

        # Create workflow request
        enrichment_request = WorkflowRequest(
            job_id=request.upload_id,
            bom_id=request.upload_id,  # Use upload_id as bom_id for staff uploads
            organization_id=request.organization_id,
            project_id=request.project_id,
            total_items=total_items,
            source='staff',  # ✅ Mark as staff upload
            user_id=metadata.get('uploaded_by')
        )

        # Start workflow with timeout to avoid hanging if Temporal is slow/unreachable
        import asyncio

        workflow_id = f"bom-enrichment-{request.upload_id}"
        logger.info(f"[Bulk Enrichment] Starting Temporal workflow: {workflow_id}")

        try:
            handle = await asyncio.wait_for(
                temporal_client_manager.get_client().start_workflow(
                    BOMEnrichmentWorkflow.run,
                    enrichment_request,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    # Workflow discoverability and searchability
                    memo={
                        'organization_id': request.organization_id or 'staff',
                        'bom_id': request.upload_id,
                        'project_id': request.project_id or '',
                        'upload_id': request.upload_id,
                        'source': 'staff',
                        'uploaded_by': metadata.get('uploaded_by', 'unknown')
                    },
                    # ID reuse policy: reject duplicate workflow IDs
                    id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
                    # Timeouts (prevent runaway workflows)
                    execution_timeout=timedelta(hours=24),  # Max 24 hours for entire workflow
                    run_timeout=timedelta(hours=12)  # Max 12 hours per run (allows retries)
                ),
                timeout=10.0,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"[Bulk Enrichment] Timeout starting Temporal workflow for upload {request.upload_id}"
            )
            raise HTTPException(
                status_code=503,
                detail="Temporal workflow start timed out. Please try again.",
            )

        logger.info(f"✅ Enrichment workflow started: {workflow_id}")
        logger.info(f"   Run ID: {handle.first_execution_run_id}")

        # Update Redis status
        redis_storage.set_status("enriching", ttl_hours=48)

        # Initialize progress
        redis_storage.update_progress(
            total_items=total_items,
            enriched_items=0,
            failed_items=0,
            ttl_hours=48
        )

        # Extend TTL to 48h during processing
        redis_storage.extend_ttl(ttl_hours=48)

        # Update metadata
        metadata['enrichment_workflow_id'] = workflow_id
        metadata['enrichment_run_id'] = handle.first_execution_run_id
        metadata['enrichment_started_at'] = None  # Will be set by workflow
        metadata['priority'] = request.priority
        redis_storage.save_metadata(metadata, ttl_hours=48)

        return {
            "success": True,
            "upload_id": request.upload_id,
            "workflow_id": workflow_id,
            "run_id": handle.first_execution_run_id,
            "total_items": total_items,
            "priority": request.priority,
            "status": "enriching",
            "storage": "redis",
            "ttl_hours": 48,
            "message": "Enrichment workflow started successfully. Data will be preserved for 48 hours."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to start enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start enrichment: {str(e)}"
        )


# ============================================================================
# PAUSE ENRICHMENT
# ============================================================================

@router.post("/pause")
async def pause_bulk_enrichment(request: EnrichmentControlRequest):
    """
    Pause enrichment workflow for a bulk upload

    Sends pause signal to Temporal workflow.
    Staff can resume later.
    """
    logger.info(f"[Bulk Enrichment] Pausing enrichment for upload: {request.upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(request.upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{request.upload_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Send pause signal to workflow
        await handle.signal("pause")

        logger.info(f"✅ Pause signal sent to workflow: {workflow_id}")

        # Update Redis status
        redis_storage.set_status("paused", ttl_hours=48)

        # Update metadata
        metadata = redis_storage.get_metadata()
        if metadata:
            metadata['paused_at'] = None  # Will be set by workflow
            metadata['pause_reason'] = request.reason or "Staff paused"
            redis_storage.save_metadata(metadata, ttl_hours=48)

        return {
            "success": True,
            "upload_id": request.upload_id,
            "workflow_id": workflow_id,
            "status": "paused",
            "message": "Enrichment paused successfully"
        }

    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to pause enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pause enrichment: {str(e)}"
        )


# ============================================================================
# RESUME ENRICHMENT
# ============================================================================

@router.post("/resume")
async def resume_bulk_enrichment(request: EnrichmentControlRequest):
    """
    Resume paused enrichment workflow

    Sends resume signal to workflow.
    """
    logger.info(f"[Bulk Enrichment] Resuming enrichment for upload: {request.upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(request.upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{request.upload_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Send resume signal
        await handle.signal("resume")

        logger.info(f"✅ Resume signal sent to workflow: {workflow_id}")

        # Update Redis status
        redis_storage.set_status("enriching", ttl_hours=48)

        # Update metadata
        metadata = redis_storage.get_metadata()
        if metadata:
            metadata['resumed_at'] = None  # Will be set by workflow
            metadata['resume_reason'] = request.reason or "Staff resumed"
            redis_storage.save_metadata(metadata, ttl_hours=48)

        return {
            "success": True,
            "upload_id": request.upload_id,
            "workflow_id": workflow_id,
            "status": "enriching",
            "message": "Enrichment resumed successfully"
        }

    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to resume enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume enrichment: {str(e)}"
        )


# ============================================================================
# STOP ENRICHMENT
# ============================================================================

@router.post("/stop")
async def stop_bulk_enrichment(request: EnrichmentControlRequest):
    """
    Stop (cancel) enrichment workflow

    This terminates the workflow. Cannot be resumed.
    Data remains in Redis until TTL expires.
    """
    logger.info(f"[Bulk Enrichment] Stopping enrichment for upload: {request.upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(request.upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{request.upload_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Cancel workflow
        await handle.cancel()

        logger.info(f"✅ Workflow cancelled: {workflow_id}")

        # Update Redis status
        redis_storage.set_status("cancelled", ttl_hours=24)

        # Update metadata
        metadata = redis_storage.get_metadata()
        if metadata:
            metadata['cancelled_at'] = None  # Will be set by workflow
            metadata['cancel_reason'] = request.reason or "Staff stopped"
            redis_storage.save_metadata(metadata, ttl_hours=24)

        return {
            "success": True,
            "upload_id": request.upload_id,
            "workflow_id": workflow_id,
            "status": "cancelled",
            "message": "Enrichment stopped successfully. Data will expire in 24 hours."
        }

    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to stop enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stop enrichment: {str(e)}"
        )


# ============================================================================
# DELETE ENRICHMENT JOB
# ============================================================================

@router.delete("/{upload_id}")
async def delete_bulk_enrichment(upload_id: str):
    """
    Delete enrichment job and all related data from Redis

    This:
    1. Cancels workflow if running
    2. Deletes all Redis keys (metadata, line items, progress)
    3. Raw file remains in MinIO (if needed for audit)
    """
    logger.info(f"[Bulk Enrichment] Deleting enrichment job for upload: {upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Cancel workflow if running
        try:
            temporal_client_manager = get_temporal_client_manager()
            if temporal_client_manager and temporal_client_manager.is_connected():
                workflow_id = f"bom-enrichment-{upload_id}"
                handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)
                await handle.cancel()
                logger.info(f"Workflow cancelled: {workflow_id}")
        except Exception as e:
            logger.warning(f"Could not cancel workflow (may not be running): {e}")

        # Delete all Redis keys
        redis_storage.delete_all()

        logger.info(f"✅ Enrichment job deleted: {upload_id}")

        return {
            "success": True,
            "upload_id": upload_id,
            "message": "Enrichment job deleted successfully. Raw file remains in MinIO."
        }

    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to delete enrichment job: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete enrichment job: {str(e)}"
        )


# ============================================================================
# GET ENRICHMENT STATUS
# ============================================================================

@router.get("/{upload_id}/status")
async def get_bulk_enrichment_status(upload_id: str):
    """
    Get current enrichment status from Redis

    Returns:
    - Upload metadata
    - Enrichment progress (total, enriched, failed, %)
    - Workflow status (if running)
    - Redis TTL
    """
    logger.info(f"[Bulk Enrichment] Getting enrichment status for upload: {upload_id}")

    try:
        # Check Redis storage
        redis_storage = get_bulk_upload_storage(upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=503,
                detail="Redis storage not available"
            )

        # Check if upload exists
        if not redis_storage.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Upload not found in Redis: {upload_id} (may have expired)"
            )

        # Get metadata
        metadata = redis_storage.get_metadata()
        if not metadata:
            raise HTTPException(
                status_code=404,
                detail=f"Upload metadata not found: {upload_id}"
            )

        # Get status
        status = redis_storage.get_status() or 'pending'

        # Get progress
        progress = redis_storage.get_progress()

        # Get workflow status from Temporal (if running)
        workflow_status = None
        workflow_id = f"bom-enrichment-{upload_id}"

        try:
            temporal_client_manager = get_temporal_client_manager()
            if temporal_client_manager and temporal_client_manager.is_connected():
                handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)
                workflow_status = await handle.describe()
                logger.info(f"Workflow status: {workflow_status.status}")
        except Exception as e:
            logger.warning(f"Could not get workflow status: {e}")

        return {
            "upload_id": upload_id,
            "filename": metadata.get('filename'),
            "workflow_id": workflow_id,
            "status": status,
            "progress": progress or {
                "total_items": metadata.get('total_rows', 0),
                "enriched_items": 0,
                "failed_items": 0,
                "pending_items": metadata.get('total_rows', 0),
                "percent_complete": 0.0
            },
            "workflow_status": workflow_status.status.name if workflow_status else None,
            "storage": "redis",
            "created_at": metadata.get('created_at'),
            "enrichment_started_at": metadata.get('enrichment_started_at'),
            "redis_expires_at": None  # TODO: Calculate from TTL
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Bulk Enrichment] Failed to get enrichment status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get enrichment status: {str(e)}"
        )
