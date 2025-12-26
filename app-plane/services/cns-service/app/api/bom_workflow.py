"""
BOM Workflow Integration

Integrates Temporal workflows with BOM upload API.
Provides endpoints to start, query, and manage BOM enrichment workflows.
Includes processing status for Queue Cards UI and pause/resume functionality.
"""

import logging
import json
from typing import Optional, Dict, Any, List
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from temporalio.client import Client
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis
import asyncio

from app.workflows.bom_enrichment import BOMEnrichmentRequest, BOMEnrichmentWorkflow
from app.workflows.bom_processing_workflow import BOMProcessingRequest, BOMProcessingWorkflow
from app.config import settings
from app.core.scope_decorators import require_bom
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User
from shared.event_bus import EventPublisher

logger = logging.getLogger(__name__)
router = APIRouter()


class StartWorkflowRequest(BaseModel):
    """Request to start BOM enrichment workflow (legacy)"""
    bom_id: str
    organization_id: str
    project_id: Optional[str] = None
    total_items: int


class StartProcessingRequest(BaseModel):
    """Request to start comprehensive BOM processing workflow"""
    bom_id: str
    organization_id: str
    filename: str
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    skip_enrichment: bool = False
    skip_risk_analysis: bool = False
    enrichment_level: str = "standard"
    priority: int = 5


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
async def start_enrichment_workflow(workflow_request: StartWorkflowRequest):
    """
    Start BOM enrichment workflow.

    NOTE: This endpoint accepts bom_id in request body, not path.
    Scope validation is not applied here as it's designed for internal workflow triggers.
    For user-facing BOM operations, use the /bom endpoints which have proper scope validation.

    This endpoint:
    1. Validates the request
    2. Connects to Temporal
    3. Starts a BOMEnrichmentWorkflow
    4. Returns workflow ID and job ID

    Args:
        workflow_request: Workflow start request

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
    logger.info(f"[GATE: BOM Workflow]   BOM ID: {workflow_request.bom_id}")
    logger.info(f"[GATE: BOM Workflow]   Organization ID: {workflow_request.organization_id}")
    logger.info(f"[GATE: BOM Workflow]   Total Items: {workflow_request.total_items}")

    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Create workflow request
        enrichment_request = BOMEnrichmentRequest(
            job_id=workflow_request.bom_id,
            bom_id=workflow_request.bom_id,
            organization_id=workflow_request.organization_id,
            project_id=workflow_request.project_id,
            total_items=workflow_request.total_items
        )

        # Generate workflow ID
        workflow_id = f"bom-enrichment-{workflow_request.bom_id}"

        # Start workflow
        logger.info(f"[GATE: BOM Workflow] Starting Temporal workflow: {workflow_id}")
        logger.info(f"[GATE: BOM Workflow]   Task Queue: {settings.temporal_task_queue}")
        logger.info(f"[GATE: BOM Workflow]   Timeout: 2 hours")

        handle = await client.start_workflow(
            BOMEnrichmentWorkflow.run,
            enrichment_request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            execution_timeout=timedelta(hours=2)
        )

        logger.info(f"[GATE: BOM Workflow] ✅ Workflow started successfully: {workflow_id}")
        logger.info(f"[GATE: BOM Workflow] ✅ Check Temporal UI at http://localhost:27021")

        return WorkflowStatusResponse(
            job_id=workflow_request.bom_id,
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


@router.post("/start-processing", response_model=WorkflowStatusResponse)
async def start_processing_workflow(processing_request: StartProcessingRequest):
    """
    Start comprehensive BOM processing workflow.

    This endpoint starts the end-to-end BOM processing workflow that handles:
    - Upload verification
    - Parsing validation
    - Component enrichment
    - Risk analysis
    - Completion and notifications

    The workflow creates a bom_processing_jobs record and tracks progress through
    multiple stages with pause/resume support.

    Args:
        processing_request: Processing workflow start request

    Returns:
        Workflow status with job_id and workflow_id

    Example:
        POST /api/bom/workflow/start-processing
        {
            "bom_id": "uuid-123",
            "organization_id": "uuid-456",
            "filename": "my_bom.csv",
            "enrichment_level": "standard",
            "priority": 5
        }

        Response:
        {
            "job_id": "uuid-123",
            "workflow_id": "bom-processing-uuid-123",
            "status": "running"
        }
    """
    logger.info(f"[GATE: BOM Processing] Starting comprehensive workflow")
    logger.info(f"[GATE: BOM Processing]   BOM ID: {processing_request.bom_id}")
    logger.info(f"[GATE: BOM Processing]   Organization ID: {processing_request.organization_id}")
    logger.info(f"[GATE: BOM Processing]   Filename: {processing_request.filename}")
    logger.info(f"[GATE: BOM Processing]   Enrichment Level: {processing_request.enrichment_level}")
    logger.info(f"[GATE: BOM Processing]   Priority: {processing_request.priority}")

    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Create workflow request
        workflow_request = BOMProcessingRequest(
            bom_id=processing_request.bom_id,
            organization_id=processing_request.organization_id,
            filename=processing_request.filename,
            project_id=processing_request.project_id,
            user_id=processing_request.user_id,
            user_email=processing_request.user_email,
            skip_enrichment=processing_request.skip_enrichment,
            skip_risk_analysis=processing_request.skip_risk_analysis,
            enrichment_level=processing_request.enrichment_level,
            priority=processing_request.priority
        )

        # Generate workflow ID
        workflow_id = f"bom-processing-{processing_request.bom_id}"

        # Start workflow
        logger.info(f"[GATE: BOM Processing] Starting Temporal workflow: {workflow_id}")
        logger.info(f"[GATE: BOM Processing]   Task Queue: {settings.temporal_task_queue}")
        logger.info(f"[GATE: BOM Processing]   Stages: Upload → Parse → Enrich → Risk → Complete")

        handle = await client.start_workflow(
            BOMProcessingWorkflow.run,
            workflow_request,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            execution_timeout=timedelta(hours=2)
        )

        logger.info(f"[GATE: BOM Processing] ✅ Workflow started successfully: {workflow_id}")
        logger.info(f"[GATE: BOM Processing] ✅ Check Temporal UI at http://localhost:27021")

        return WorkflowStatusResponse(
            job_id=processing_request.bom_id,
            workflow_id=workflow_id,
            status="running"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start processing workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start BOM processing workflow: {str(e)}"
        )


@router.get("/{bom_id}/status", response_model=WorkflowStatusResponse)
@require_bom(enforce=True, log_access=True)
async def get_workflow_status(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Get workflow status and progress.

    This endpoint:
    1. Connects to Temporal
    2. Gets workflow handle by ID
    3. Queries current progress
    4. Returns status and progress

    Args:
        bom_id: BOM ID (same as workflow ID suffix)

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
    job_id = bom_id  # Alias for backward compatibility
    logger.info(f"Getting workflow status for BOM: {bom_id}")

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


@router.post("/{bom_id}/cancel")
@require_bom(enforce=True, log_access=True)
async def cancel_workflow(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Cancel a running workflow.

    Args:
        bom_id: BOM ID

    Returns:
        Cancellation confirmation

    Example:
        POST /api/bom/workflow/uuid-123/cancel

        Response:
        {
            "bom_id": "uuid-123",
            "status": "cancelled"
        }
    """
    job_id = bom_id  # Alias for backward compatibility
    logger.info(f"Cancelling workflow for BOM: {bom_id}")

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


# =============================================================================
# PROCESSING STATUS ENDPOINTS (Queue Cards UI)
# =============================================================================

class ProcessingStageInfo(BaseModel):
    """Processing stage information for Queue Cards"""
    stage: str
    status: str
    progress: int = 0
    message: Optional[str] = None
    details: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    items_processed: Optional[int] = None
    total_items: Optional[int] = None
    error_message: Optional[str] = None


class ProcessingStatusResponse(BaseModel):
    """Full processing status for Queue Cards UI"""
    bom_id: str
    organization_id: str
    workflow_id: str
    status: str  # pending, running, paused, completed, failed, cancelled
    current_stage: str
    stages: Dict[str, ProcessingStageInfo]
    total_items: int = 0
    enriched_items: int = 0
    failed_items: int = 0
    risk_scored_items: int = 0
    health_grade: Optional[str] = None
    average_risk_score: Optional[float] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    paused_at: Optional[str] = None


@router.get("/{bom_id}/processing-status", response_model=ProcessingStatusResponse)
@require_bom(enforce=True, log_access=True)
async def get_processing_status(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Get BOM processing status for Queue Cards UI.

    Returns the full processing state including all stages,
    progress, and current status.

    Args:
        bom_id: BOM ID

    Returns:
        ProcessingStatusResponse with all stage information

    Example:
        GET /api/bom/workflow/{bom_id}/processing-status

        Response:
        {
            "bom_id": "uuid-123",
            "status": "running",
            "current_stage": "enrichment",
            "stages": {
                "raw_upload": {"status": "completed", "progress": 100, ...},
                "parsing": {"status": "completed", "progress": 100, ...},
                "enrichment": {"status": "in_progress", "progress": 45, ...},
                "risk_analysis": {"status": "pending", "progress": 0, ...},
                "complete": {"status": "pending", "progress": 0, ...}
            },
            "total_items": 50,
            "enriched_items": 23,
            ...
        }
    """
    logger.info(f"[ProcessingStatus] Getting status for BOM: {bom_id}")

    try:
        # Query bom_processing_jobs table
        query = text("""
            SELECT
                bom_id, organization_id, workflow_id, status, current_stage,
                stages, total_items, enriched_items, failed_items, risk_scored_items,
                health_grade, average_risk_score, error_message,
                started_at, completed_at, paused_at
            FROM bom_processing_jobs
            WHERE bom_id = :bom_id
        """)

        result = db.execute(query, {"bom_id": bom_id})
        row = result.fetchone()

        if not row:
            # No processing job found - check BOM's actual status from boms table
            # This handles legacy BOMs that were uploaded before the workflow system
            bom_query = text("""
                SELECT status, component_count, enrichment_progress, organization_id,
                       temporal_workflow_id, created_at, analyzed_at
                FROM boms
                WHERE id = :bom_id
            """)
            bom_result = db.execute(bom_query, {"bom_id": bom_id})
            bom_row = bom_result.fetchone()

            if not bom_row:
                raise HTTPException(status_code=404, detail=f"BOM {bom_id} not found")

            bom_data = bom_row._mapping
            bom_status = (bom_data.get("status") or "pending").lower()
            component_count = bom_data.get("component_count") or 0
            # enrichment_progress is a JSONB with {total, enriched, pending, failed}
            enrichment_progress = bom_data.get("enrichment_progress") or {}
            enriched_count = enrichment_progress.get("enriched", 0) if isinstance(enrichment_progress, dict) else 0
            org_id = str(bom_data.get("organization_id") or "")

            # Map BOM status to workflow status
            # completed, analyzing, processing, enriching, pending, failed, cancelled
            workflow_status = "pending"
            current_stage = "raw_upload"
            stages = {}

            if bom_status == "completed":
                workflow_status = "completed"
                current_stage = "complete"
                stages = {
                    "raw_upload": ProcessingStageInfo(stage="raw_upload", status="completed", progress=100),
                    "parsing": ProcessingStageInfo(stage="parsing", status="completed", progress=100),
                    "enrichment": ProcessingStageInfo(stage="enrichment", status="completed", progress=100),
                    "risk_analysis": ProcessingStageInfo(stage="risk_analysis", status="completed", progress=100),
                    "complete": ProcessingStageInfo(stage="complete", status="completed", progress=100),
                }
            elif bom_status in ("analyzing", "processing", "enriching"):
                workflow_status = "running"
                if bom_status == "analyzing":
                    current_stage = "parsing"
                elif bom_status == "enriching":
                    current_stage = "enrichment"
                else:
                    current_stage = "parsing"
                stages = {
                    "raw_upload": ProcessingStageInfo(stage="raw_upload", status="completed", progress=100),
                    "parsing": ProcessingStageInfo(stage="parsing", status="completed" if current_stage != "parsing" else "in_progress", progress=100 if current_stage != "parsing" else 50),
                    "enrichment": ProcessingStageInfo(stage="enrichment", status="in_progress" if current_stage == "enrichment" else "pending", progress=int((enriched_count / component_count * 100) if component_count > 0 else 0) if current_stage == "enrichment" else 0),
                    "risk_analysis": ProcessingStageInfo(stage="risk_analysis", status="pending", progress=0),
                    "complete": ProcessingStageInfo(stage="complete", status="pending", progress=0),
                }
            elif bom_status == "failed":
                workflow_status = "failed"
                current_stage = "enrichment"
                stages = {
                    "raw_upload": ProcessingStageInfo(stage="raw_upload", status="completed", progress=100),
                    "parsing": ProcessingStageInfo(stage="parsing", status="completed", progress=100),
                    "enrichment": ProcessingStageInfo(stage="enrichment", status="failed", progress=0),
                    "risk_analysis": ProcessingStageInfo(stage="risk_analysis", status="pending", progress=0),
                    "complete": ProcessingStageInfo(stage="complete", status="pending", progress=0),
                }
            elif bom_status == "cancelled":
                workflow_status = "cancelled"
                current_stage = "enrichment"
                stages = {
                    "raw_upload": ProcessingStageInfo(stage="raw_upload", status="completed", progress=100),
                    "parsing": ProcessingStageInfo(stage="parsing", status="completed", progress=100),
                    "enrichment": ProcessingStageInfo(stage="enrichment", status="skipped", progress=0),
                    "risk_analysis": ProcessingStageInfo(stage="risk_analysis", status="skipped", progress=0),
                    "complete": ProcessingStageInfo(stage="complete", status="skipped", progress=0),
                }
            else:
                # pending or unknown status
                stages = {
                    "raw_upload": ProcessingStageInfo(stage="raw_upload", status="pending", progress=0),
                    "parsing": ProcessingStageInfo(stage="parsing", status="pending", progress=0),
                    "enrichment": ProcessingStageInfo(stage="enrichment", status="pending", progress=0),
                    "risk_analysis": ProcessingStageInfo(stage="risk_analysis", status="pending", progress=0),
                    "complete": ProcessingStageInfo(stage="complete", status="pending", progress=0),
                }

            logger.info(f"[ProcessingStatus] BOM {bom_id} has no processing job, falling back to boms.status={bom_status} -> workflow_status={workflow_status}")

            return ProcessingStatusResponse(
                bom_id=bom_id,
                organization_id=org_id,
                workflow_id=bom_data.get("temporal_workflow_id") or "",
                status=workflow_status,
                current_stage=current_stage,
                stages=stages,
                total_items=component_count,
                enriched_items=enriched_count,
                failed_items=0,
                risk_scored_items=0,
                health_grade=None,
                average_risk_score=None,
                error_message=None,
                started_at=bom_data["created_at"].isoformat() if bom_data.get("created_at") else None,
                completed_at=bom_data["analyzed_at"].isoformat() if bom_data.get("analyzed_at") else None,
                paused_at=None,
            )

        m = row._mapping

        # Parse stages JSONB
        stages_data = m.get("stages") or {}
        if isinstance(stages_data, str):
            stages_data = json.loads(stages_data)

        # Convert to ProcessingStageInfo objects
        stages = {}
        for stage_name, stage_info in stages_data.items():
            stages[stage_name] = ProcessingStageInfo(**stage_info)

        return ProcessingStatusResponse(
            bom_id=str(m["bom_id"]),
            organization_id=str(m["organization_id"]),
            workflow_id=m["workflow_id"],
            status=m["status"],
            current_stage=m["current_stage"],
            stages=stages,
            total_items=m["total_items"] or 0,
            enriched_items=m["enriched_items"] or 0,
            failed_items=m["failed_items"] or 0,
            risk_scored_items=m["risk_scored_items"] or 0,
            health_grade=m["health_grade"],
            average_risk_score=float(m["average_risk_score"]) if m["average_risk_score"] else None,
            error_message=m["error_message"],
            started_at=m["started_at"].isoformat() if m["started_at"] else None,
            completed_at=m["completed_at"].isoformat() if m["completed_at"] else None,
            paused_at=m["paused_at"].isoformat() if m["paused_at"] else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get processing status: {str(e)}"
        )


@router.post("/{bom_id}/pause")
@require_bom(enforce=True, log_access=True)
async def pause_processing(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Pause BOM processing workflow.

    Sends a pause signal to the Temporal workflow via RabbitMQ.
    The workflow will pause at the next safe checkpoint.

    Args:
        bom_id: BOM ID

    Returns:
        Status confirmation
    """
    logger.info(f"[ProcessingStatus] Pausing workflow for BOM: {bom_id}")

    try:
        # Get workflow ID from database
        query = text("""
            SELECT workflow_id FROM bom_processing_jobs WHERE bom_id = :bom_id
        """)
        result = db.execute(query, {"bom_id": bom_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Processing job not found")

        workflow_id = row[0]

        # Publish pause event to RabbitMQ
        EventPublisher.admin_workflow_paused(
            workflow_id=workflow_id,
            admin_id=str(user.id) if hasattr(user, 'id') else "unknown"
        )

        return {
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "status": "pause_requested",
            "message": "Pause signal sent. Workflow will pause at next checkpoint."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to pause workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pause workflow: {str(e)}"
        )


@router.post("/{bom_id}/resume")
@require_bom(enforce=True, log_access=True)
async def resume_processing(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Resume paused BOM processing workflow.

    Sends a resume signal to the Temporal workflow via RabbitMQ.

    Args:
        bom_id: BOM ID

    Returns:
        Status confirmation
    """
    logger.info(f"[ProcessingStatus] Resuming workflow for BOM: {bom_id}")

    try:
        # Get workflow ID from database
        query = text("""
            SELECT workflow_id FROM bom_processing_jobs WHERE bom_id = :bom_id
        """)
        result = db.execute(query, {"bom_id": bom_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Processing job not found")

        workflow_id = row[0]

        # Publish resume event to RabbitMQ
        EventPublisher.admin_workflow_resumed(
            workflow_id=workflow_id,
            admin_id=str(user.id) if hasattr(user, 'id') else "unknown"
        )

        return {
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "status": "resume_requested",
            "message": "Resume signal sent. Workflow will continue processing."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resume workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume workflow: {str(e)}"
        )


class ProcessingJobListItem(BaseModel):
    """Processing job summary for list view"""
    bom_id: str
    bom_name: Optional[str] = None
    workflow_id: str
    status: str
    current_stage: str
    overall_progress: int = 0
    total_items: int = 0
    enriched_items: int = 0
    failed_items: int = 0
    health_grade: Optional[str] = None
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    can_pause: bool = False
    can_resume: bool = False
    can_cancel: bool = False


class ProcessingJobListResponse(BaseModel):
    """List of processing jobs"""
    jobs: List[ProcessingJobListItem]
    total: int


@router.get("/jobs", response_model=ProcessingJobListResponse)
async def list_processing_jobs(
    request: Request,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    List all BOM processing jobs for the organization.

    Returns a list of all processing jobs with their current status,
    allowing the UI to show workflow controls (pause/resume/cancel)
    for each BOM.

    Args:
        status_filter: Optional filter by status (running, paused, completed, etc.)

    Returns:
        ProcessingJobListResponse with list of jobs
    """
    # Extract organization_id from user context (tenant_id = organization_id)
    from app.core.auth_utils import get_tenant_id_from_auth_context

    organization_id = get_tenant_id_from_auth_context(user)
    logger.info(f"[ProcessingJobs] Listing jobs for organization: {organization_id}")

    try:
        # Build query - use direct parameter instead of session variable
        query_str = """
            SELECT
                j.bom_id, j.workflow_id, j.status, j.current_stage,
                j.total_items, j.enriched_items, j.failed_items,
                j.health_grade, j.started_at, j.updated_at,
                b.name as bom_name
            FROM bom_processing_jobs j
            LEFT JOIN boms b ON j.bom_id = b.id
            WHERE j.organization_id = :organization_id
        """

        params = {"organization_id": organization_id}
        if status_filter:
            query_str += " AND j.status = :status_filter"
            params["status_filter"] = status_filter

        query_str += " ORDER BY j.updated_at DESC"

        query = text(query_str)
        result = db.execute(query, params)
        rows = result.fetchall()

        jobs = []
        for row in rows:
            m = row._mapping

            # Calculate overall progress
            total = m["total_items"] or 1
            enriched = m["enriched_items"] or 0
            failed = m["failed_items"] or 0
            progress = int(((enriched + failed) / total) * 100)

            # Determine available actions
            status = m["status"]
            can_pause = status == "running"
            can_resume = status == "paused"
            can_cancel = status in ("running", "paused", "pending")

            jobs.append(ProcessingJobListItem(
                bom_id=str(m["bom_id"]),
                bom_name=m["bom_name"],
                workflow_id=m["workflow_id"],
                status=status,
                current_stage=m["current_stage"],
                overall_progress=progress,
                total_items=m["total_items"] or 0,
                enriched_items=m["enriched_items"] or 0,
                failed_items=m["failed_items"] or 0,
                health_grade=m["health_grade"],
                started_at=m["started_at"].isoformat() if m["started_at"] else None,
                updated_at=m["updated_at"].isoformat() if m["updated_at"] else None,
                can_pause=can_pause,
                can_resume=can_resume,
                can_cancel=can_cancel,
            ))

        return ProcessingJobListResponse(jobs=jobs, total=len(jobs))

    except Exception as e:
        logger.error(f"Failed to list processing jobs: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list processing jobs: {str(e)}"
        )


@router.post("/{bom_id}/restart")
@require_bom(enforce=True, log_access=True)
async def restart_processing(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """
    Restart BOM processing from the beginning.

    Cancels any existing workflow and starts a new one.

    Args:
        bom_id: BOM ID

    Returns:
        New workflow status
    """
    logger.info(f"[ProcessingStatus] Restarting workflow for BOM: {bom_id}")

    try:
        # Get existing job info
        query = text("""
            SELECT workflow_id, organization_id, total_items
            FROM bom_processing_jobs WHERE bom_id = :bom_id
        """)
        result = db.execute(query, {"bom_id": bom_id})
        row = result.fetchone()

        if row:
            m = row._mapping
            old_workflow_id = m["workflow_id"]
            organization_id = str(m["organization_id"])
            total_items = m["total_items"] or 0

            # Try to cancel existing workflow
            try:
                client = await get_temporal_client()
                handle = client.get_workflow_handle(old_workflow_id)
                await handle.cancel()
                logger.info(f"Cancelled old workflow: {old_workflow_id}")
            except Exception as e:
                logger.warning(f"Could not cancel old workflow: {e}")

            # Reset job status in database
            update_query = text("""
                UPDATE bom_processing_jobs SET
                    status = 'pending',
                    current_stage = 'raw_upload',
                    stages = '{}',
                    enriched_items = 0,
                    failed_items = 0,
                    risk_scored_items = 0,
                    health_grade = NULL,
                    average_risk_score = NULL,
                    error_message = NULL,
                    started_at = NULL,
                    completed_at = NULL,
                    paused_at = NULL,
                    updated_at = NOW()
                WHERE bom_id = :bom_id
            """)
            db.execute(update_query, {"bom_id": bom_id})
            db.commit()

        else:
            # Get BOM info for new job
            bom_query = text("""
                SELECT organization_id, (
                    SELECT COUNT(*) FROM bom_line_items WHERE bom_id = boms.id
                ) as total_items
                FROM boms WHERE id = :bom_id
            """)
            result = db.execute(bom_query, {"bom_id": bom_id})
            bom_row = result.fetchone()

            if not bom_row:
                raise HTTPException(status_code=404, detail="BOM not found")

            m = bom_row._mapping
            organization_id = str(m["organization_id"])
            total_items = m["total_items"] or 0

        # Start new workflow
        workflow_request = StartWorkflowRequest(
            bom_id=bom_id,
            organization_id=organization_id,
            total_items=total_items
        )

        response = await start_enrichment_workflow(workflow_request)

        return {
            "bom_id": bom_id,
            "workflow_id": response.workflow_id,
            "status": "restarted",
            "message": "BOM processing has been restarted"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to restart workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to restart workflow: {str(e)}"
        )


@router.get("/{bom_id}/processing-stream")
async def processing_status_stream(
    bom_id: str,
    request: Request,
):
    """
    SSE endpoint for real-time processing status updates.

    Subscribes to Redis Pub/Sub channel for the BOM and streams
    status updates to the client.

    Args:
        bom_id: BOM ID

    Returns:
        Server-Sent Events stream
    """
    logger.info(f"[ProcessingStream] Starting SSE stream for BOM: {bom_id}")

    async def event_generator():
        """Generate SSE events from Redis Pub/Sub"""
        try:
            # Connect to Redis using REDIS_URL for consistency
            import os
            redis_url = os.getenv("REDIS_URL", getattr(settings, 'redis_url', 'redis://redis:6379/2'))
            r = redis.from_url(redis_url, decode_responses=True)
            pubsub = r.pubsub()

            # Subscribe to BOM processing channel
            channel = f"bom:processing:{bom_id}"
            pubsub.subscribe(channel)

            logger.info(f"[ProcessingStream] Subscribed to channel: {channel}")

            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'channel': channel})}\n\n"

            # Listen for messages
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"[ProcessingStream] Client disconnected: {bom_id}")
                    break

                # Get message with timeout
                message = pubsub.get_message(timeout=1.0)

                if message and message['type'] == 'message':
                    data = message['data']
                    yield f"event: status_update\ndata: {data}\n\n"

                # Small sleep to prevent busy loop
                await asyncio.sleep(0.1)

        except Exception as e:
            logger.error(f"[ProcessingStream] Error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        finally:
            try:
                pubsub.unsubscribe(channel)
                pubsub.close()
            except:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class RawFileDownloadResponse(BaseModel):
    """Response for raw file download URL"""
    download_url: str
    filename: str
    expires_in_seconds: int


@router.get("/{bom_id}/download-raw")
async def get_raw_file_download_url(
    bom_id: str,
    db: Session = Depends(get_supabase_session),
) -> RawFileDownloadResponse:
    """
    Get a presigned URL to download the original raw BOM file from S3/MinIO.

    Returns a temporary URL (valid for 1 hour) that can be used to download
    the original uploaded file. This is useful for re-processing or archival.
    """
    from app.utils.minio_client import get_minio_client

    try:
        # Fetch BOM record to get raw_file_s3_key
        fetch_query = text("""
            SELECT id, name, raw_file_s3_key, metadata
            FROM boms
            WHERE id = :bom_id
        """)
        bom_row = db.execute(fetch_query, {"bom_id": bom_id}).mappings().first()

        if not bom_row:
            raise HTTPException(status_code=404, detail="BOM not found")

        raw_file_s3_key = bom_row.get("raw_file_s3_key")
        metadata = bom_row.get("metadata") or {}

        if not raw_file_s3_key:
            raise HTTPException(
                status_code=404,
                detail="No raw file associated with this BOM"
            )

        # Get filename from metadata or construct from BOM name
        filename = metadata.get("filename") or metadata.get("original_filename")
        if not filename:
            bom_name = bom_row.get("name") or bom_id
            filename = f"{bom_name}.csv"

        # Get MinIO client and generate presigned URL
        minio_client = get_minio_client()
        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="File storage is not available"
            )

        # Use default bucket for raw uploads
        s3_bucket = settings.minio_bucket_uploads or "customer-uploads"
        expires = timedelta(hours=1)
        download_url = minio_client.get_presigned_url(s3_bucket, raw_file_s3_key, expires=expires)

        if not download_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate download URL"
            )

        logger.info(f"[BOM Download] Generated URL for bom_id={bom_id}, key={raw_file_s3_key}")

        return RawFileDownloadResponse(
            download_url=download_url,
            filename=filename,
            expires_in_seconds=3600  # 1 hour
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BOM Download] Failed to get download URL for {bom_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get download URL: {str(e)}"
        )
