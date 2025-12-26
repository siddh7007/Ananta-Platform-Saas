"""
BOM Workflow Integration

Integrates Temporal workflows with BOM upload API.
Provides endpoints to start, query, and manage BOM enrichment workflows.
"""

import logging
from typing import Optional, Dict, Any
from datetime import timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from temporalio.client import Client

from app.workflows.bom_enrichment import BOMEnrichmentRequest, BOMEnrichmentWorkflow
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class StartWorkflowRequest(BaseModel):
    """Request to start BOM enrichment workflow"""
    bom_id: str
    organization_id: str
    project_id: Optional[str] = None
    total_items: int


class WorkflowStatusResponse(BaseModel):
    """Workflow status response"""
    job_id: str
    workflow_id: str
    status: str
    progress: Optional[Dict[str, Any]] = None


async def get_temporal_client() -> Client:
    """
    Get Temporal client.

    Returns:
        Temporal client instance

    Raises:
        HTTPException: If Temporal is disabled or connection fails
    """
    if not settings.temporal_enabled:
        raise HTTPException(
            status_code=503,
            detail="Temporal workflows are disabled. Set TEMPORAL_ENABLED=true in config."
        )

    try:
        client = await Client.connect(
            settings.temporal_url,
            namespace=settings.temporal_namespace
        )
        return client
    except Exception as e:
        logger.error(f"Failed to connect to Temporal: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Temporal server: {str(e)}"
        )


@router.post("/start", response_model=WorkflowStatusResponse)
async def start_enrichment_workflow(request: StartWorkflowRequest):
    """
    Start BOM enrichment workflow.

    This endpoint:
    1. Validates the request
    2. Connects to Temporal
    3. Starts a BOMEnrichmentWorkflow
    4. Returns workflow ID and job ID

    Args:
        request: Workflow start request

    Returns:
        Workflow status with job_id and workflow_id

    Example:
        POST /api/bom/workflow/start
        {
            "bom_id": "uuid-123",
            "organization_id": "uuid-456",
            "total_items": 150
        }

        Response:
        {
            "job_id": "uuid-123",
            "workflow_id": "bom-enrichment-uuid-123",
            "status": "running"
        }
    """
    logger.info(f"[GATE: BOM Workflow] 🚀 Received workflow start request")
    logger.info(f"[GATE: BOM Workflow]   BOM ID: {request.bom_id}")
    logger.info(f"[GATE: BOM Workflow]   Organization ID: {request.organization_id}")
    logger.info(f"[GATE: BOM Workflow]   Total Items: {request.total_items}")

    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Create workflow request
        workflow_request = BOMEnrichmentRequest(
            job_id=request.bom_id,
            bom_id=request.bom_id,
            organization_id=request.organization_id,
            project_id=request.project_id,
            total_items=request.total_items
        )

        # Generate workflow ID
        workflow_id = f"bom-enrichment-{request.bom_id}"

        # Start workflow
        logger.info(f"[GATE: BOM Workflow] Starting Temporal workflow: {workflow_id}")
        logger.info(f"[GATE: BOM Workflow]   Task Queue: {settings.temporal_task_queue}")
        logger.info(f"[GATE: BOM Workflow]   Timeout: 2 hours")

        handle = await client.start_workflow(
            BOMEnrichmentWorkflow.run,
            workflow_request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            execution_timeout=timedelta(hours=2)
        )

        logger.info(f"[GATE: BOM Workflow] ✅ Workflow started successfully: {workflow_id}")
        logger.info(f"[GATE: BOM Workflow] ✅ Check Temporal UI at http://localhost:27021")

        return WorkflowStatusResponse(
            job_id=request.bom_id,
            workflow_id=workflow_id,
            status="running"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start enrichment workflow: {str(e)}"
        )


@router.get("/{job_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(job_id: str):
    """
    Get workflow status and progress.

    This endpoint:
    1. Connects to Temporal
    2. Gets workflow handle by ID
    3. Queries current progress
    4. Returns status and progress

    Args:
        job_id: BOM job ID (same as workflow ID suffix)

    Returns:
        Workflow status with progress

    Example:
        GET /api/bom/workflow/uuid-123/status

        Response:
        {
            "job_id": "uuid-123",
            "workflow_id": "bom-enrichment-uuid-123",
            "status": "running",
            "progress": {
                "total_items": 150,
                "enriched_items": 75,
                "failed_items": 2,
                "pending_items": 73,
                "percent_complete": 51.3
            }
        }
    """
    logger.info(f"📊 Getting workflow status for job: {job_id}")

    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Get workflow handle
        workflow_id = f"bom-enrichment-{job_id}"
        handle = client.get_workflow_handle(workflow_id)

        # Query progress
        try:
            progress = await handle.query(BOMEnrichmentWorkflow.get_progress)
            progress_dict = {
                "total_items": progress.total_items,
                "enriched_items": progress.enriched_items,
                "failed_items": progress.failed_items,
                "pending_items": progress.pending_items,
                "percent_complete": progress.percent_complete
            }
        except Exception as e:
            logger.warning(f"Failed to query progress: {e}")
            progress_dict = None

        # Get workflow status
        try:
            describe = await handle.describe()
            status = describe.status.name.lower()
        except Exception as e:
            logger.warning(f"Failed to describe workflow: {e}")
            status = "unknown"

        return WorkflowStatusResponse(
            job_id=job_id,
            workflow_id=workflow_id,
            status=status,
            progress=progress_dict
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow status: {str(e)}"
        )


@router.post("/{job_id}/cancel")
async def cancel_workflow(job_id: str):
    """
    Cancel a running workflow.

    Args:
        job_id: BOM job ID

    Returns:
        Cancellation confirmation

    Example:
        POST /api/bom/workflow/uuid-123/cancel

        Response:
        {
            "job_id": "uuid-123",
            "status": "cancelled"
        }
    """
    logger.info(f"⚠️  Cancelling workflow for job: {job_id}")

    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Get workflow handle
        workflow_id = f"bom-enrichment-{job_id}"
        handle = client.get_workflow_handle(workflow_id)

        # Cancel workflow
        await handle.cancel()

        logger.info(f"✅ Workflow cancelled: {workflow_id}")

        return {
            "job_id": job_id,
            "workflow_id": workflow_id,
            "status": "cancelled"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel workflow: {str(e)}"
        )
