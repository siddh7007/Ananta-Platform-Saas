"""
BOM Enrichment Control API Endpoints

Provides manual control over BOM enrichment workflows:
- Start enrichment
- Pause enrichment
- Stop enrichment
- Delete enrichment job
- Get enrichment status

Used by both Customer Portal and CNS Dashboard.
"""

import logging
from typing import Optional
from datetime import timedelta
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from temporalio.common import WorkflowIDReusePolicy
from temporalio.exceptions import WorkflowAlreadyStartedError

from app.core.temporal_client import get_temporal_client_manager
from app.config import settings, PLATFORM_SUPER_ADMIN_ORG
from app.utils.activity_log import record_audit_log_entry
from shared.event_bus import EventPublisher

# CNS Projects Alignment - Scope Validation Decorators
from app.core.scope_decorators import require_bom
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class StartEnrichmentRequest(BaseModel):
    """Request to start BOM enrichment

    Note: bom_id comes from URL path parameter, not request body
    """
    organization_id: str
    project_id: Optional[str] = None
    user_id: Optional[str] = Field(default=None, description="User ID for notifications")
    priority: int = Field(default=5, ge=1, le=9)  # 1-9 scale (9=highest)
    initiated_by: str = Field(
        default="customer_portal",
        description="Which client initiated enrichment (e.g., 'cns-dashboard', 'customer_portal')"
    )

    @field_validator('organization_id')
    @classmethod
    def validate_organization_id(cls, v: str) -> str:
        """Validate organization_id is not empty"""
        if not v or not v.strip():
            raise ValueError("organization_id cannot be empty")
        return v.strip()

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v: int) -> int:
        """Validate priority is in 1-9 range"""
        if not (1 <= v <= 9):
            raise ValueError("priority must be between 1 and 9")
        return v


class EnrichmentControlRequest(BaseModel):
    """Request to pause/stop enrichment"""
    bom_id: str
    reason: Optional[str] = None  # Optional reason for pause/stop


class EnrichmentStatusResponse(BaseModel):
    """Enrichment workflow status"""
    bom_id: str
    workflow_id: str
    run_id: str
    status: str  # running | paused | completed | failed | cancelled
    progress: dict  # {total_items, enriched_items, failed_items, percent_complete}
    started_at: Optional[str]
    completed_at: Optional[str]
    error_message: Optional[str]


# ============================================================================
# HELPER: Synchronous database operations for start_enrichment
# ============================================================================

def _validate_and_count_bom_items_sync(
    bom_id: str,
    organization_id: str,
) -> dict:
    """
    Synchronous helper to validate BOM and count pending line items.

    This runs in a thread pool to avoid blocking the async event loop.

    Returns:
        dict with keys: bom_id, bom_name, total_items, error (if any)
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    dual_db = get_dual_database()
    db_session_gen = dual_db.get_session("supabase")
    db = next(db_session_gen)

    result = {
        "bom_id": bom_id,
        "bom_name": None,
        "total_items": 0,
        "error": None,
        "error_code": None,
        "http_status": None,
    }

    try:
        # STEP 1: Verify BOM exists and belongs to this organization
        logger.info(f"[Enrichment] Verifying BOM {bom_id} belongs to organization {organization_id}")
        bom_check_query = text("""
            SELECT organization_id, status, component_count, name
            FROM boms
            WHERE id = :bom_id
        """)
        bom_result = db.execute(bom_check_query, {"bom_id": bom_id})
        bom_row = bom_result.fetchone()

        if not bom_row:
            logger.warning(f"[Enrichment] BOM {bom_id} not found in database")
            result["error"] = "BOM not found"
            result["http_status"] = 404
            return result

        bom_organization_id = str(bom_row[0])
        result["bom_name"] = bom_row[3]

        # Special case: Platform Super Admin org is accessible to all staff
        is_platform_admin_bom = bom_organization_id == PLATFORM_SUPER_ADMIN_ORG

        if bom_organization_id != organization_id and not is_platform_admin_bom:
            logger.warning(
                f"[Enrichment] Organization mismatch: BOM belongs to {bom_organization_id}, "
                f"request from {organization_id}"
            )
            result["error"] = "BOM not found for this tenant"
            result["http_status"] = 404
            return result

        # Log bypass access for audit purposes
        if is_platform_admin_bom and bom_organization_id != organization_id:
            logger.info(f"[Enrichment] Access granted via Platform Super Admin bypass: user_org={organization_id} bom={bom_id}")

        logger.info(f"[Enrichment] BOM verified: organization={bom_organization_id}, status={bom_row[1]}")

        # STEP 2: Get line items count for this BOM
        logger.info(f"[Enrichment] Counting pending line items for bom_id={bom_id}")
        count_query = text("""
            SELECT COUNT(*) as total
            FROM bom_line_items
            WHERE bom_id = :bom_id
              AND enrichment_status = 'pending'
        """)
        try:
            count_result = db.execute(count_query, {"bom_id": bom_id})
            row = count_result.fetchone()
            total_items = row[0] if row else 0
            logger.info(f"[Enrichment] Query returned total_items={total_items}")
        except Exception as e:
            logger.error(f"[Enrichment] Error querying bom_line_items: {e}", exc_info=True)
            db.rollback()
            total_items = 0

        # BACKWARD-COMPATIBILITY HACK: Resolve upload ID to BOM ID
        if total_items == 0:
            logger.warning(
                "[Enrichment] No pending items for BOM %s; attempting fallback lookup via bom_upload_id",
                bom_id,
            )
            try:
                db.rollback()
            except Exception:
                pass

            try:
                fallback_query = text("""
                    SELECT id
                    FROM boms
                    WHERE organization_id = :organization_id
                      AND (
                        metadata->>'bom_upload_id' = :upload_id
                        OR metadata->>'upload_id' = :upload_id
                      )
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
                fb_result = db.execute(fallback_query, {"upload_id": bom_id, "organization_id": organization_id})
                fb_row = fb_result.fetchone()

                if fb_row:
                    real_bom_id = str(fb_row[0])
                    logger.info(
                        "[Enrichment] Resolved upload ID %s to BOM %s via metadata.bom_upload_id",
                        bom_id,
                        real_bom_id,
                    )
                    result["bom_id"] = real_bom_id

                    # Re-count pending items using the resolved BOM ID
                    count_result = db.execute(count_query, {"bom_id": real_bom_id})
                    row = count_result.fetchone()
                    total_items = row[0] if row else 0

                    # Refresh BOM name
                    try:
                        name_row = db.execute(
                            text("SELECT name FROM boms WHERE id = :bom_id"),
                            {"bom_id": real_bom_id},
                        ).fetchone()
                        if name_row:
                            result["bom_name"] = name_row[0]
                    except Exception:
                        logger.debug("[Enrichment] Failed to refresh BOM name after fallback", exc_info=True)
            except Exception as e:
                logger.error(f"[Enrichment] Fallback query failed: {e}", exc_info=True)
                db.rollback()
                total_items = 0

        result["total_items"] = total_items

        if total_items == 0:
            result["error"] = "No pending line items to enrich. BOM may already be enriched."
            result["error_code"] = "NO_PENDING_ITEMS"
            result["http_status"] = 400

        return result

    except Exception as e:
        logger.error(f"[Enrichment] Database error in validation: {e}", exc_info=True)
        result["error"] = str(e)
        result["http_status"] = 500
        return result
    finally:
        # Always close the session
        try:
            db.close()
        except Exception:
            pass
        try:
            next(db_session_gen)
        except StopIteration:
            pass


def _update_bom_after_workflow_start_sync(
    bom_id: str,
    workflow_id: str,
    run_id: str,
    priority: int,
    organization_id: str,
    project_id: Optional[str],
    total_items: int,
    bom_name: Optional[str],
    initiated_by: str,
) -> bool:
    """
    Synchronous helper to update BOM status after workflow starts.

    This runs in a thread pool to avoid blocking the async event loop.
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    dual_db = get_dual_database()
    db_session_gen = dual_db.get_session("supabase")
    db = next(db_session_gen)

    try:
        update_query = text("""
            UPDATE boms
            SET
                status = 'analyzing',
                enrichment_status = 'processing',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'enrichment_workflow_id', :workflow_id,
                    'enrichment_run_id', :run_id,
                    'enrichment_started_at', NOW()::text,
                    'priority', :priority
                ),
                updated_at = NOW()
            WHERE id = :bom_id
        """)

        db.execute(update_query, {
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "priority": priority
        })

        # Record audit log
        try:
            bulk_initiated = initiated_by != "customer_portal"
            event_type = "cns.bulk.enrichment_started" if bulk_initiated else "customer.enrichment_started"
            routing_key = "cns.enrichment.started" if bulk_initiated else "customer.enrichment.started"
            record_audit_log_entry(
                db,
                event_type=event_type,
                routing_key=routing_key,
                organization_id=organization_id,
                user_id=initiated_by,
                username=initiated_by,
                source=initiated_by,
                event_data={
                    "bom_id": bom_id,
                    "bom_name": bom_name,
                    "job_id": bom_id,
                    "upload_id": bom_id,
                    "project_id": project_id,
                    "total_items": total_items,
                    "priority": priority,
                    "initiated_by": initiated_by,
                    "organization_id": organization_id,
                },
            )
        except Exception:
            logger.warning("[Enrichment] Failed to record audit log entry for enrichment start", exc_info=True)

        db.commit()
        return True

    except Exception as e:
        logger.error(f"[Enrichment] Failed to update BOM after workflow start: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        try:
            db.close()
        except Exception:
            pass
        try:
            next(db_session_gen)
        except StopIteration:
            pass


# ============================================================================
# START ENRICHMENT
# ============================================================================

@router.post("/boms/{bom_id}/enrichment/start")
async def start_enrichment(
    bom_id: str,
    request: StartEnrichmentRequest
):
    """
    Start enrichment workflow for a BOM

    User manually triggers this from BOM Jobs page after upload completes.

    Flow:
    1. Fetch bom_line_items count (in thread pool to avoid blocking)
    2. Start Temporal BOMEnrichmentWorkflow
    3. Update boms status to 'enriching' (in thread pool)
    4. Return workflow ID

    Example:
        POST /api/boms/e5f6g7h8-.../enrichment/start
        {
            "organization_id": "org-456",
            "project_id": "proj-123",
            "priority": 7
        }
    """
    import asyncio

    # [FLOW_2] Manual Start - CBP, CNS Dashboard
    logger.info(
        f"[FLOW_2][Manual Start] Starting enrichment for BOM: {bom_id}",
        extra={
            'bom_id': bom_id,
            'organization_id': request.organization_id,
            'priority': request.priority,
            'initiated_by': request.initiated_by,
            'flow': 'FLOW_2_MANUAL_START'
        }
    )
    logger.info(f"[DEBUG] Enrichment request received: bom_id={bom_id}, org={request.organization_id}, priority={request.priority}")

    try:
        # Get Temporal client FIRST (fast check, no DB needed)
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            try:
                EventPublisher.customer_bom_enrichment_failed(
                    job_id=bom_id,
                    bom_id=bom_id, organization_id=request.organization_id,
                    error_code="TEMPORAL_UNAVAILABLE",
                    error_message="Temporal not connected. Cannot start enrichment workflow.",
                    stage="temporal_client",
                )
            except Exception:
                logger.warning("[Enrichment] Failed to publish enrichment_failed event for Temporal unavailable", exc_info=True)

            raise HTTPException(
                status_code=503,
                detail="Temporal not connected. Cannot start enrichment workflow."
            )

        # Verify temporal_client is not None
        temporal_client = temporal_client_manager.get_client()
        if temporal_client is None:
            logger.error("[Enrichment] Temporal client is None despite is_connected() returning True")
            raise HTTPException(
                status_code=503,
                detail="Temporal client unavailable. Please try again."
            )

        # CRITICAL FIX: Run sync database operations in thread pool
        # This prevents blocking the asyncio event loop
        validation_result = await run_in_threadpool(
            _validate_and_count_bom_items_sync,
            bom_id,
            request.organization_id,
        )

        # Handle validation errors
        if validation_result.get("error"):
            error_code = validation_result.get("error_code")
            if error_code == "NO_PENDING_ITEMS":
                try:
                    EventPublisher.customer_bom_enrichment_failed(
                        job_id=validation_result["bom_id"],
                        bom_id=validation_result["bom_id"],
                        organization_id=request.organization_id,
                        error_code="NO_PENDING_ITEMS",
                        error_message=validation_result["error"],
                        stage="validation",
                    )
                except Exception:
                    logger.warning("[Enrichment] Failed to publish enrichment_failed event", exc_info=True)

            raise HTTPException(
                status_code=validation_result.get("http_status", 500),
                detail=validation_result["error"] if not error_code else {
                    "code": error_code,
                    "message": validation_result["error"],
                    "bom_id": validation_result["bom_id"],
                }
            )

        # Extract validated data
        resolved_bom_id = validation_result["bom_id"]
        bom_name = validation_result["bom_name"]
        total_items = validation_result["total_items"]

        logger.info(f"Found {total_items} pending line items to enrich for BOM {resolved_bom_id}")

        # Import enrichment workflow
        from app.workflows.bom_enrichment import (
            BOMEnrichmentWorkflow,
            BOMEnrichmentRequest as WorkflowRequest
        )

        # Create workflow request
        enrichment_request = WorkflowRequest(
            job_id=resolved_bom_id,
            bom_id=resolved_bom_id,
            organization_id=request.organization_id,
            project_id=request.project_id,
            total_items=total_items,
            bom_name=bom_name,
            user_id=request.user_id,
        )

        # Start workflow with timeout
        workflow_id = f"bom-enrichment-{resolved_bom_id}"
        logger.info(f"Starting Temporal workflow: {workflow_id} (priority={request.priority})")

        try:
            handle = await asyncio.wait_for(
                temporal_client.start_workflow(
                    BOMEnrichmentWorkflow.run,
                    enrichment_request,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    memo={
                        'tenant_id': request.organization_id,
                        'bom_id': resolved_bom_id,
                        'project_id': request.project_id or '',
                        'priority': str(request.priority),
                        'source': 'customer'
                    },
                    id_reuse_policy=WorkflowIDReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
                    execution_timeout=timedelta(hours=24),
                    run_timeout=timedelta(hours=12)
                ),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            logger.error(f"[Enrichment] Timeout starting Temporal workflow for BOM {resolved_bom_id}")
            raise HTTPException(
                status_code=503,
                detail="Temporal workflow start timed out. Please try again."
            )

        logger.info(f"Enrichment workflow started: {workflow_id}, run_id={handle.first_execution_run_id}")

        # Update BOM status in thread pool (non-blocking)
        await run_in_threadpool(
            _update_bom_after_workflow_start_sync,
            resolved_bom_id,
            workflow_id,
            handle.first_execution_run_id,
            request.priority,
            request.organization_id,
            request.project_id,
            total_items,
            bom_name,
            request.initiated_by,
        )

        return {
            "success": True,
            "bom_id": resolved_bom_id,
            "workflow_id": workflow_id,
            "run_id": handle.first_execution_run_id,
            "total_items": total_items,
            "priority": request.priority,
            "status": "enriching",
            "message": "Enrichment workflow started successfully"
        }

    except HTTPException:
        raise
    except WorkflowAlreadyStartedError as e:
        logger.info(f"Enrichment workflow already running for BOM {bom_id}: {e}")
        raise HTTPException(
            status_code=409,
            detail={
                "code": "WORKFLOW_ALREADY_RUNNING",
                "message": "Enrichment is already in progress for this BOM",
                "bom_id": bom_id,
                "workflow_id": f"bom-enrichment-{bom_id}",
                "suggestion": "Connect to SSE stream to monitor progress"
            }
        )
    except Exception as e:
        logger.error(f"Failed to start enrichment: {e}", exc_info=True)
        try:
            EventPublisher.customer_bom_enrichment_failed(
                job_id=bom_id,
                bom_id=bom_id, organization_id=request.organization_id,
                error_code="INTERNAL_ERROR",
                error_message=str(e),
                stage="start_enrichment",
            )
        except Exception:
            logger.warning("[Enrichment] Failed to publish enrichment_failed event for internal error", exc_info=True)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to start enrichment: {str(e)}"
        )


# ============================================================================
# PAUSE ENRICHMENT
# ============================================================================

@router.post("/boms/{bom_id}/enrichment/pause")
async def pause_enrichment(
    bom_id: str,
    request: EnrichmentControlRequest
):
    """
    Pause enrichment workflow

    NOTE: Temporal doesn't support true "pause" - this sends a signal
    to the workflow to stop processing new items temporarily.

    User can resume later from BOM Jobs page.
    """
    logger.info(f"Pausing enrichment for BOM: {bom_id}")

    try:
        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{bom_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Send pause signal to workflow
        await handle.signal("pause")

        logger.info(f"✅ Pause signal sent to workflow: {workflow_id}")

        # Update database
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        db_gen_pause = dual_db.get_session("supabase")
        db = next(db_gen_pause)

        # HARDENING: Update both status and enrichment_status
        update_query = text("""
            UPDATE boms
            SET
                status = 'paused',
                enrichment_status = 'pending',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'paused_at', NOW()::text,
                    'pause_reason', :reason
                ),
                updated_at = NOW()
            WHERE id = :bom_id
        """)

        db.execute(update_query, {
            "bom_id": bom_id,
            "reason": request.reason or "User paused"
        })
        db.commit()

        return {
            "success": True,
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "status": "paused",
            "message": "Enrichment paused successfully"
        }

    except Exception as e:
        logger.error(f"Failed to pause enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pause enrichment: {str(e)}"
        )
    finally:
        # Ensure Supabase session is closed for pause handler
        if 'db_gen_pause' in locals():
            try:
                next(db_gen_pause)
            except StopIteration:
                pass


# ============================================================================
# RESUME ENRICHMENT
# ============================================================================

@router.post("/boms/{bom_id}/enrichment/resume")
async def resume_enrichment(bom_id: str):
    """
    Resume paused enrichment workflow

    Sends resume signal to workflow.
    """
    logger.info(f"Resuming enrichment for BOM: {bom_id}")

    try:
        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{bom_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Send resume signal
        await handle.signal("resume")

        logger.info(f"✅ Resume signal sent to workflow: {workflow_id}")

        # Update database
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # HARDENING: Update both status and enrichment_status
        update_query = text("""
            UPDATE boms
            SET
                status = 'analyzing',
                enrichment_status = 'processing',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'resumed_at', NOW()::text
                ),
                updated_at = NOW()
            WHERE id = :bom_id
        """)

        db.execute(update_query, {"bom_id": bom_id})
        db.commit()

        return {
            "success": True,
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "status": "enriching",
            "message": "Enrichment resumed successfully"
        }

    except Exception as e:
        logger.error(f"Failed to resume enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume enrichment: {str(e)}"
        )


# ============================================================================
# STOP ENRICHMENT
# ============================================================================

@router.post("/boms/{bom_id}/enrichment/stop")
async def stop_enrichment(
    bom_id: str,
    request: EnrichmentControlRequest
):
    """
    Stop (cancel) enrichment workflow

    This terminates the workflow. Cannot be resumed.
    """
    logger.info(f"Stopping enrichment for BOM: {bom_id}")

    try:
        # Get Temporal client
        temporal_client_manager = get_temporal_client_manager()
        if not temporal_client_manager or not temporal_client_manager.is_connected():
            raise HTTPException(
                status_code=503,
                detail="Temporal not connected"
            )

        # Get workflow handle
        workflow_id = f"bom-enrichment-{bom_id}"
        handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)

        # Cancel workflow
        await handle.cancel()

        logger.info(f"✅ Workflow cancelled: {workflow_id}")

        # Update database
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # HARDENING: Update both status and enrichment_status
        update_query = text("""
            UPDATE boms
            SET
                status = 'cancelled',
                enrichment_status = 'failed',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'cancelled_at', NOW()::text,
                    'cancel_reason', :reason
                ),
                updated_at = NOW()
            WHERE id = :bom_id
        """)

        db.execute(update_query, {
            "bom_id": bom_id,
            "reason": request.reason or "User stopped"
        })
        db.commit()

        return {
            "success": True,
            "bom_id": bom_id,
            "workflow_id": workflow_id,
            "status": "cancelled",
            "message": "Enrichment stopped successfully"
        }

    except Exception as e:
        logger.error(f"Failed to stop enrichment: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stop enrichment: {str(e)}"
        )


# ============================================================================
# DELETE ENRICHMENT JOB
# ============================================================================

@router.delete("/boms/{bom_id}/enrichment")
async def delete_enrichment_job(bom_id: str):
    """
    Delete enrichment job and all related data

    This:
    1. Cancels workflow if running
    2. Deletes bom_line_items records
    3. Deletes boms record
    4. Marks bom_uploads as 'deleted'
    """
    logger.info(f"Deleting enrichment job for BOM: {bom_id}")

    try:
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Cancel workflow if running
        try:
            temporal_client_manager = get_temporal_client_manager()
            if temporal_client_manager and temporal_client_manager.is_connected():
                workflow_id = f"bom-enrichment-{bom_id}"
                handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)
                await handle.cancel()
                logger.info(f"Workflow cancelled: {workflow_id}")
        except Exception as e:
            logger.warning(f"Could not cancel workflow (may not be running): {e}")

        # Delete line items (CASCADE will handle this, but explicit is better)
        delete_items_query = text("""
            DELETE FROM bom_line_items
            WHERE bom_id = :bom_id
        """)
        db.execute(delete_items_query, {"bom_id": bom_id})

        # Delete BOM
        delete_bom_query = text("""
            DELETE FROM boms
            WHERE id = :bom_id
        """)
        db.execute(delete_bom_query, {"bom_id": bom_id})

        # Mark bom_uploads as deleted
        update_upload_query = text("""
            UPDATE bom_uploads
            SET
                status = 'deleted',
                enrichment_job_id = NULL,
                updated_at = NOW()
            WHERE enrichment_job_id = :bom_id
        """)
        db.execute(update_upload_query, {"bom_id": bom_id})

        db.commit()

        logger.info(f"✅ Enrichment job deleted: {bom_id}")

        return {
            "success": True,
            "bom_id": bom_id,
            "message": "Enrichment job deleted successfully"
        }

    except Exception as e:
        logger.error(f"Failed to delete enrichment job: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete enrichment job: {str(e)}"
        )


# ============================================================================
# GET ENRICHMENT STATUS
# ============================================================================

@router.get("/boms/{bom_id}/enrichment/status")
@require_bom(enforce=True, log_access=True)  # Phase 2: Automatic scope validation
async def get_enrichment_status(
    bom_id: str,  # Path parameter
    request: Request,  # Required for decorator
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
):
    """
    Get current enrichment status with automatic scope validation.

    **Phase 2: CNS Projects Alignment**

    Returns:
    - Workflow status (running, paused, completed, etc.)
    - Progress (total_items, enriched_items, failed_items, %)
    - Timestamps

    Authorization:
        - Automatic validation: bom → project → workspace → organization
        - Users can only access enrichment status for BOMs in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives organization_id from validated BOM FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    try:
        # Extract validated scope from request state (set by @require_bom decorator)
        scope = request.state.validated_scope
        organization_id = scope["tenant_id"]  # Server-derived from validated FK chain

        logger.info(
            f"[BOM Enrichment] Getting enrichment status for BOM {bom_id} "
            f"(org={organization_id}, user={user.id})"
        )

        from sqlalchemy import text

        # Get BOM record
        bom_query = text("""
            SELECT
                id,
                organization_id,
                status,
                component_count,
                metadata,
                created_at,
                updated_at
            FROM boms
            WHERE id = :bom_id
        """)

        result = db.execute(bom_query, {"bom_id": bom_id})
        bom = result.fetchone()

        if not bom:
            raise HTTPException(status_code=404, detail="BOM not found")

        bom_dict = dict(bom._mapping)

        # Get workflow status from Temporal (if running)
        workflow_status = None
        workflow_id = f"bom-enrichment-{bom_id}"

        try:
            temporal_client_manager = get_temporal_client_manager()
            if temporal_client_manager and temporal_client_manager.is_connected():
                handle = temporal_client_manager.get_client().get_workflow_handle(workflow_id)
                workflow_status = await handle.describe()
                logger.info(f"Workflow status: {workflow_status.status}")
        except Exception as e:
            logger.warning(f"Could not get workflow status: {e}")

        # Query actual line item counts from database (not from metadata which may be stale)
        metadata = bom_dict.get('metadata') or {}

        # Get real counts from bom_line_items table
        counts_query = text("""
            SELECT
                COUNT(*) FILTER (WHERE enrichment_status = 'enriched') as enriched_items,
                COUNT(*) FILTER (WHERE enrichment_status = 'failed') as failed_items,
                COUNT(*) FILTER (WHERE enrichment_status = 'pending' OR enrichment_status IS NULL) as pending_items,
                COUNT(*) as total_items
            FROM bom_line_items
            WHERE bom_id = :bom_id
        """)
        counts_result = db.execute(counts_query, {"bom_id": bom_id}).fetchone()

        if counts_result:
            enriched_items = counts_result.enriched_items or 0
            failed_items = counts_result.failed_items or 0
            pending_items = counts_result.pending_items or 0
            total_items = counts_result.total_items or 0
        else:
            # Fallback to component_count if no line items yet
            enriched_items = 0
            failed_items = 0
            total_items = bom_dict.get('component_count', 0)
            pending_items = total_items

        # Calculate percent complete from actual counts
        percent_complete = 0.0
        if total_items > 0:
            percent_complete = ((enriched_items + failed_items) / total_items) * 100.0

        return {
            "bom_id": bom_id,
            "organization_id": str(bom_dict.get('organization_id', '')),
            "workflow_id": workflow_id,
            "run_id": metadata.get('enrichment_run_id'),
            "status": bom_dict['status'],
            "progress": {
                "total_items": total_items,
                "enriched_items": enriched_items,
                "failed_items": failed_items,
                "pending_items": max(0, pending_items),
                "percent_complete": round(percent_complete, 1)
            },
            "started_at": metadata.get('enrichment_started_at'),
            "completed_at": metadata.get('enrichment_completed_at'),
            "workflow_status": workflow_status.status.name if workflow_status else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get enrichment status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get enrichment status: {str(e)}"
        )
    finally:
        # Always close the database session to prevent connection pool exhaustion
        if db:
            try:
                db.close()
            except Exception:
                pass


# ============================================================================
# BOM COMPONENTS - DETAIL VIEW
# ============================================================================

@router.get("/boms/{bom_id}/components")
@require_bom(enforce=True, log_access=True)  # Phase 2: Automatic scope validation
async def get_bom_components(
    bom_id: str,  # Path parameter
    request: Request,  # Required for decorator
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    enrichment_status: Optional[str] = None,  # pending, completed, failed
    project_id: Optional[str] = None,  # Optional project filter
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
):
    """
    Get paginated component list for a BOM with enriched data.

    **Phase 2: CNS Projects Alignment**

    Fetches BOMs from Supabase and enrichment data from:
    - Component Vault (component_catalog) for high-quality components (component_id)
    - Redis cache for low-quality components (redis_component_key)

    Returns:
    - line_items with enrichment data
    - supplier info, pricing, parameters
    - quality scores
    - pagination metadata

    Query Parameters:
    - page: Page number (default: 1)
    - page_size: Items per page (default: 50, max: 200)
    - search: Search in MPN, manufacturer, description
    - enrichment_status: Filter by status (pending, completed, failed)
    - project_id: Project ID for filtering (optional)

    Authorization:
        - Automatic validation: bom → project → workspace → organization
        - Users can only access components from BOMs in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives organization_id from validated BOM FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import json

    try:
        # Extract validated scope from request state (set by @require_bom decorator)
        scope = request.state.validated_scope
        organization_id = scope["tenant_id"]  # Server-derived from validated FK chain

        logger.info(
            f"[BOM Components] Getting components for BOM {bom_id} "
            f"(org={organization_id}, user={user.id}, page={page})"
        )

        # Validate pagination
        page = max(1, page)
        page_size = min(max(1, page_size), 200)  # Cap at 200
        offset = (page - 1) * page_size

        # Get database sessions
        dual_db = get_dual_database()
        supabase_db = db  # Use session from decorator
        components_db = next(dual_db.get_session("components"))  # Component catalog in Components V2

        # Build base query for BOM line items (from Supabase)
        base_conditions = ["bom_id = :bom_id"]
        params = {"bom_id": bom_id, "offset": offset, "limit": page_size}

        # Add search filter
        if search:
            base_conditions.append("""
                (manufacturer_part_number ILIKE :search
                 OR manufacturer ILIKE :search
                 OR description ILIKE :search)
            """)
            params["search"] = f"%{search}%"

        # Add status filter
        if enrichment_status:
            base_conditions.append("enrichment_status = :status")
            params["status"] = enrichment_status

        where_clause = " AND ".join(base_conditions)

        # Query BOM line items from Supabase
        query = text(f"""
            SELECT
                id,
                line_number,
                reference_designator,
                manufacturer_part_number,
                manufacturer,
                description,
                quantity,
                enrichment_status,
                component_id,
                redis_component_key,
                component_storage,
                created_at,
                updated_at
            FROM bom_line_items
            WHERE {where_clause}
            ORDER BY line_number
            OFFSET :offset
            LIMIT :limit
        """)

        result = supabase_db.execute(query, params)

        # Fetch enrichment data for each line item from appropriate source
        items = []
        redis_client = None  # Lazy init

        for row in result:
            row_dict = dict(row._mapping)
            component_id = row_dict.get("component_id")
            redis_key = row_dict.get("redis_component_key")
            storage_type = row_dict.get("component_storage") or "none"

            enrichment_data = {}

            # Fetch from Component Vault (high quality ≥80)
            if component_id:
                logger.debug(f"[BOM Components] Fetching from catalog: component_id={component_id}")
                catalog_query = text("""
                    SELECT
                        category,
                        subcategory,
                        description,
                        datasheet_url,
                        image_url,
                        lifecycle_status,
                        quality_score,
                        unit_price,
                        currency,
                        moq,
                        lead_time_days,
                        stock_status,
                        rohs_compliant,
                        reach_compliant,
                        aec_qualified,
                        supplier_data,
                        specifications
                    FROM component_catalog
                    WHERE id = :component_id
                    LIMIT 1
                """)
                catalog_result = components_db.execute(
                    catalog_query,
                    {"component_id": component_id}
                ).fetchone()

                if catalog_result:
                    catalog_dict = dict(catalog_result._mapping)

                    # Extract supplier info from supplier_data JSONB
                    supplier_data = catalog_dict.get("supplier_data") or {}
                    supplier = supplier_data.get("supplier") if isinstance(supplier_data, dict) else None
                    supplier_part_number = supplier_data.get("supplier_part_number") if isinstance(supplier_data, dict) else None
                    stock_quantity = supplier_data.get("stock_quantity") if isinstance(supplier_data, dict) else None

                enrichment_data = {
                    "supplier": supplier,
                    "supplier_part_number": supplier_part_number,
                        "price": float(catalog_dict["unit_price"]) if catalog_dict.get("unit_price") else None,
                        "stock_quantity": stock_quantity,
                        "category": catalog_dict.get("category"),
                        "subcategory": catalog_dict.get("subcategory"),
                        "lifecycle_status": catalog_dict.get("lifecycle_status"),
                        "datasheet_url": catalog_dict.get("datasheet_url"),
                        "image_url": catalog_dict.get("image_url"),
                        "quality_score": float(catalog_dict["quality_score"]) if catalog_dict.get("quality_score") else None,
                        "parameters": catalog_dict.get("specifications"),
                        "lead_time_days": catalog_dict.get("lead_time_days"),
                        "minimum_order_quantity": catalog_dict.get("moq"),
                        "rohs_compliant": catalog_dict.get("rohs_compliant"),
                        "reach_compliant": catalog_dict.get("reach_compliant"),
                        "aec_qualified": catalog_dict.get("aec_qualified"),
                        "currency": catalog_dict.get("currency"),
                        "stock_status": catalog_dict.get("stock_status"),
                    "description": catalog_dict.get("description"),
                }
                if component_id:
                    enrichment_data["component_id"] = component_id

            # Fetch from Redis (low quality <80)
            elif redis_key:
                logger.debug(f"[BOM Components] Fetching from Redis: key={redis_key}")
                try:
                    if redis_client is None:
                        from app.cache.redis_cache import get_sync_redis_client
                        redis_client = get_sync_redis_client()

                    if redis_client is None:
                        logger.warning("[BOM Components] Redis not available, skipping redis_component_key=%s", redis_key)
                    else:
                        redis_data_str = redis_client.get(redis_key)
                        if redis_data_str:
                            redis_data = json.loads(redis_data_str)
                            enrichment_data = {
                                "supplier": redis_data.get("supplier"),
                                "supplier_part_number": redis_data.get("supplier_part_number"),
                                "price": redis_data.get("unit_price"),
                                "stock_quantity": redis_data.get("stock_quantity"),
                                "category": redis_data.get("category"),
                                "subcategory": redis_data.get("subcategory"),
                                "lifecycle_status": redis_data.get("lifecycle_status"),
                                "datasheet_url": redis_data.get("datasheet_url"),
                                "image_url": redis_data.get("image_url"),
                                "quality_score": redis_data.get("quality_score"),
                                "parameters": redis_data.get("specifications"),
                                "lead_time_days": redis_data.get("lead_time_days"),
                                "minimum_order_quantity": redis_data.get("moq"),
                                "rohs_compliant": redis_data.get("rohs_compliant"),
                                "reach_compliant": redis_data.get("reach_compliant"),
                                "aec_qualified": redis_data.get("aec_qualified"),
                                "currency": redis_data.get("currency"),
                                "stock_status": redis_data.get("stock_status"),
                                "description": redis_data.get("description"),
                                "component_id": redis_data.get("component_id"),
                            }
                        else:
                            logger.warning(f"[BOM Components] Redis key not found: {redis_key}")
                except Exception as redis_error:
                    logger.error(f"[BOM Components] Redis fetch error: {redis_error}")

            # Build response item
            items.append({
                "id": str(row_dict["id"]),
                "line_number": row_dict.get("line_number") or (offset + len(items) + 1),
                "manufacturer_part_number": row_dict["manufacturer_part_number"],
                "manufacturer": row_dict["manufacturer"],
                "quantity": int(row_dict["quantity"]) if row_dict.get("quantity") else 1,
                "reference_designator": row_dict.get("reference_designator"),
                "description": row_dict.get("description"),
                "enrichment_status": row_dict.get("enrichment_status") or "pending",
                "match_status": ("matched" if enrichment_data else "unmatched"),
                "created_at": row_dict["created_at"].isoformat() if row_dict.get("created_at") else None,
                "updated_at": row_dict["updated_at"].isoformat() if row_dict.get("updated_at") else None,
                # Flattened enrichment data for table display
                "supplier": enrichment_data.get("supplier"),
                "supplier_part_number": enrichment_data.get("supplier_part_number"),
                "price": enrichment_data.get("price"),
                "stock": enrichment_data.get("stock_quantity"),
                "category": enrichment_data.get("category"),
                "lifecycle_status": enrichment_data.get("lifecycle_status"),
                "quality_score": enrichment_data.get("quality_score"),
                "datasheet_url": enrichment_data.get("datasheet_url"),
                # Full enrichment data for detail view
                "enrichment_data": enrichment_data,
                # Storage info for debugging
                "component_storage": storage_type,
                # Component vault ID for Phase 2 detail dialog
                "component_id": component_id,
            })

        # Get total count (from Supabase)
        count_query = text(f"""
            SELECT COUNT(*) as total
            FROM bom_line_items
            WHERE {where_clause}
        """)
        count_params = {k: v for k, v in params.items() if k not in ['offset', 'limit']}
        count_result = supabase_db.execute(count_query, count_params).fetchone()
        total = count_result.total if count_result else 0

        total_pages = (total + page_size - 1) // page_size

        logger.info(
            f"[BOM Components] Retrieved {len(items)} components for BOM {bom_id} "
            f"(page {page}/{total_pages}, total: {total})"
        )

        return {
            "bom_id": bom_id,
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            "filters": {
                "search": search,
                "enrichment_status": enrichment_status
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching BOM components: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch BOM components: {str(e)}"
        )
