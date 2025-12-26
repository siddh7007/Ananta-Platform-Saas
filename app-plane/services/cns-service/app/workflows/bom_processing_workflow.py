"""
BOM Processing Workflow - End-to-End Persistent Pipeline

A comprehensive Temporal workflow that orchestrates the complete BOM processing
lifecycle with:
- Persistent state tracking via database
- Pause/Resume capability via signals
- Real-time progress updates via Redis Pub/Sub → SSE
- Multi-stage processing: Upload → Parse → Enrich → Risk Analysis → Complete

Event-Driven Architecture:
  RabbitMQ Events → Temporal Workers → Redis Pub/Sub → SSE → Frontend

Workflow Stages:
  1. RAW_UPLOAD - File received and stored in S3/MinIO
  2. PARSING - CSV/XLSX parsed, validated, line items created
  3. ENRICHMENT - Components enriched by invoking BOMEnrichmentWorkflow as child workflow
     - Reuses existing enrichment logic (catalog lookup, supplier APIs, audit logging)
     - Progress tracked in both workflows (parent + child)
  4. RISK_ANALYSIS - Risk scores calculated for each component
  5. COMPLETE - All processing done, results ready

Integration with Existing Enrichment:
  - During ENRICHMENT stage, this workflow starts BOMEnrichmentWorkflow as a child
  - BOMEnrichmentWorkflow handles:
    * bulk_prefilter_components (catalog lookup)
    * enrich_component (supplier API calls)
    * update_bom_progress (Supabase updates)
    * log_enrichment_audit_batch (audit trail)
  - This prevents code duplication and ensures consistency

Signals:
  - pause: Pause processing at next safe checkpoint
  - resume: Resume processing from paused state
  - cancel: Cancel workflow and cleanup

Queries:
  - get_status: Get current workflow status and progress

Usage:
    from app.workflows.bom_processing_workflow import (
        BOMProcessingWorkflow,
        BOMProcessingRequest
    )

    handle = await client.start_workflow(
        BOMProcessingWorkflow.run,
        BOMProcessingRequest(bom_id=bom_id, organization_id=org_id, ...),
        id=f"bom-processing-{bom_id}",
        task_queue="bom-processing"
    )
"""

import logging
from datetime import timedelta, datetime
from enum import Enum
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


def _get_workflow_timestamp() -> str:
    """Get a deterministic timestamp for use in workflow code.

    Uses workflow.now() which is safe for Temporal's deterministic execution.
    Falls back to datetime.utcnow() when not in workflow context (e.g., activities).
    """
    try:
        # workflow.now() returns a timedelta since epoch in workflow context
        # Convert to ISO format string
        return workflow.now().isoformat()
    except Exception:
        # Fallback for activity context or outside workflow
        return datetime.utcnow().isoformat()


class ProcessingStage(str, Enum):
    """BOM processing stages"""
    RAW_UPLOAD = "raw_upload"
    PARSING = "parsing"
    ENRICHMENT = "enrichment"
    RISK_ANALYSIS = "risk_analysis"
    COMPLETE = "complete"


class StageStatus(str, Enum):
    """Stage status values"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    PAUSED = "paused"


class WorkflowStatus(str, Enum):
    """Overall workflow status"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class StageInfo:
    """Information about a processing stage"""
    stage: str
    status: str = StageStatus.PENDING.value
    progress: int = 0
    message: str = ""
    details: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    items_processed: int = 0
    total_items: int = 0
    error_message: Optional[str] = None


@dataclass
class BOMProcessingRequest:
    """Request to start BOM processing workflow"""
    bom_id: str
    organization_id: str
    filename: str
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    # Processing options
    skip_enrichment: bool = False
    skip_risk_analysis: bool = False
    enrichment_level: str = "standard"  # basic, standard, comprehensive
    priority: int = 5  # 1-9, higher = more urgent


@dataclass
class BOMProcessingState:
    """Workflow state - persisted and queryable"""
    bom_id: str
    organization_id: str
    workflow_id: str = ""
    status: str = WorkflowStatus.PENDING.value
    current_stage: str = ProcessingStage.RAW_UPLOAD.value
    stages: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # Progress tracking
    total_items: int = 0
    enriched_items: int = 0
    failed_items: int = 0
    risk_scored_items: int = 0
    # Timestamps
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    paused_at: Optional[str] = None
    # Results
    health_grade: Optional[str] = None
    average_risk_score: Optional[float] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bom_id": self.bom_id,
            "organization_id": self.organization_id,
            "workflow_id": self.workflow_id,
            "status": self.status,
            "current_stage": self.current_stage,
            "stages": self.stages,
            "total_items": self.total_items,
            "enriched_items": self.enriched_items,
            "failed_items": self.failed_items,
            "risk_scored_items": self.risk_scored_items,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "paused_at": self.paused_at,
            "health_grade": self.health_grade,
            "average_risk_score": self.average_risk_score,
            "error_message": self.error_message,
        }


@workflow.defn
class BOMProcessingWorkflow:
    """
    End-to-end BOM processing workflow with pause/resume support.

    This workflow orchestrates the complete BOM lifecycle:
    1. Validates upload completed
    2. Parses and validates data
    3. Enriches components
    4. Calculates risk scores
    5. Finalizes and notifies

    Supports pause/resume via Temporal signals.
    Persists state to database for UI display.
    Publishes progress to Redis for SSE streaming.
    """

    def __init__(self):
        self.state: Optional[BOMProcessingState] = None
        self.is_paused = False
        self.cancel_requested = False

    # =========================================================================
    # SIGNALS - Control workflow execution
    # =========================================================================

    @workflow.signal
    async def pause(self) -> None:
        """Pause workflow at next safe checkpoint"""
        workflow.logger.info("Pause signal received")
        self.is_paused = True
        if self.state:
            self.state.status = WorkflowStatus.PAUSED.value
            self.state.paused_at = _get_workflow_timestamp()
            # Publish pause event
            await workflow.execute_activity(
                publish_workflow_event,
                {
                    "bom_id": self.state.bom_id,
                    "event_type": "workflow_paused",
                    "state": self.state.to_dict()
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

    @workflow.signal
    async def resume(self) -> None:
        """Resume paused workflow"""
        workflow.logger.info("Resume signal received")
        self.is_paused = False
        if self.state:
            self.state.status = WorkflowStatus.RUNNING.value
            self.state.paused_at = None
            # Publish resume event
            await workflow.execute_activity(
                publish_workflow_event,
                {
                    "bom_id": self.state.bom_id,
                    "event_type": "workflow_resumed",
                    "state": self.state.to_dict()
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

    @workflow.signal
    async def cancel(self) -> None:
        """Cancel workflow"""
        workflow.logger.info("Cancel signal received")
        self.cancel_requested = True
        if self.state:
            self.state.status = WorkflowStatus.CANCELLED.value

    # =========================================================================
    # QUERIES - Get workflow state
    # =========================================================================

    @workflow.query
    def get_status(self) -> Dict[str, Any]:
        """Get current workflow status"""
        if not self.state:
            return {"status": "not_started"}
        return self.state.to_dict()

    @workflow.query
    def is_workflow_paused(self) -> bool:
        """Check if workflow is paused"""
        return self.is_paused

    # =========================================================================
    # MAIN WORKFLOW
    # =========================================================================

    @workflow.run
    async def run(self, request: BOMProcessingRequest) -> Dict[str, Any]:
        """
        Main workflow execution
        """
        workflow_id = workflow.info().workflow_id

        # Initialize state
        self.state = BOMProcessingState(
            bom_id=request.bom_id,
            organization_id=request.organization_id,
            workflow_id=workflow_id,
            status=WorkflowStatus.RUNNING.value,
            started_at=_get_workflow_timestamp()
        )

        # Initialize all stages
        for stage in ProcessingStage:
            skip = False
            if stage == ProcessingStage.ENRICHMENT and request.skip_enrichment:
                skip = True
            elif stage == ProcessingStage.RISK_ANALYSIS and request.skip_risk_analysis:
                skip = True

            self.state.stages[stage.value] = {
                "stage": stage.value,
                "status": StageStatus.SKIPPED.value if skip else StageStatus.PENDING.value,
                "progress": 0,
                "items_processed": 0,
                "total_items": 0,
            }

        workflow.logger.info(f"Starting BOM processing workflow: {request.bom_id}")

        try:
            # Persist initial state
            await self._save_state()

            # Stage 1: Raw Upload (already done, just verify)
            await self._run_stage(
                ProcessingStage.RAW_UPLOAD,
                verify_upload,
                {"bom_id": request.bom_id, "organization_id": request.organization_id}
            )

            if self.cancel_requested:
                return self._finalize_cancelled()

            # Stage 2: Parsing (verify line items exist)
            result = await self._run_stage(
                ProcessingStage.PARSING,
                verify_parsing,
                {"bom_id": request.bom_id}
            )

            if result:
                self.state.total_items = result.get("total_items", 0)

            if self.cancel_requested:
                return self._finalize_cancelled()

            # Stage 3: Enrichment
            if not request.skip_enrichment:
                enrichment_result = await self._run_enrichment_stage(request)
                if enrichment_result:
                    self.state.enriched_items = enrichment_result.get("enriched", 0)
                    self.state.failed_items = enrichment_result.get("failed", 0)

            if self.cancel_requested:
                return self._finalize_cancelled()

            # Stage 4: Risk Analysis
            if not request.skip_risk_analysis:
                risk_result = await self._run_risk_analysis_stage(request)
                if risk_result:
                    self.state.health_grade = risk_result.get("health_grade")
                    self.state.average_risk_score = risk_result.get("average_risk_score")
                    self.state.risk_scored_items = risk_result.get("scored_items", 0)

            # Stage 5: Complete
            await self._complete_stage(ProcessingStage.COMPLETE, "BOM processing completed successfully")

            # Finalize workflow
            self.state.status = WorkflowStatus.COMPLETED.value
            self.state.completed_at = _get_workflow_timestamp()
            await self._save_state()

            # Publish completion event
            await workflow.execute_activity(
                publish_workflow_event,
                {
                    "bom_id": request.bom_id,
                    "event_type": "workflow_completed",
                    "state": self.state.to_dict()
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

            return self.state.to_dict()

        except Exception as e:
            workflow.logger.error(f"Workflow failed: {e}")
            self.state.status = WorkflowStatus.FAILED.value
            self.state.error_message = str(e)
            await self._save_state()

            # Publish failure event
            await workflow.execute_activity(
                publish_workflow_event,
                {
                    "bom_id": request.bom_id,
                    "event_type": "workflow_failed",
                    "state": self.state.to_dict(),
                    "error": str(e)
                },
                start_to_close_timeout=timedelta(seconds=10)
            )

            raise

    # =========================================================================
    # STAGE HELPERS
    # =========================================================================

    async def _run_stage(
        self,
        stage: ProcessingStage,
        activity_fn,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Run a single processing stage with checkpoint handling"""

        # Wait if paused
        while self.is_paused and not self.cancel_requested:
            await workflow.sleep(timedelta(seconds=5))

        if self.cancel_requested:
            return None

        # Mark stage as in progress
        self.state.current_stage = stage.value
        self.state.stages[stage.value]["status"] = StageStatus.IN_PROGRESS.value
        self.state.stages[stage.value]["started_at"] = _get_workflow_timestamp()
        await self._save_state()

        try:
            # Execute activity
            result = await workflow.execute_activity(
                activity_fn,
                params,
                start_to_close_timeout=timedelta(minutes=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    backoff_coefficient=2.0
                )
            )

            # Mark stage as completed
            self.state.stages[stage.value]["status"] = StageStatus.COMPLETED.value
            self.state.stages[stage.value]["progress"] = 100
            self.state.stages[stage.value]["completed_at"] = _get_workflow_timestamp()
            await self._save_state()

            return result

        except Exception as e:
            # Mark stage as failed
            self.state.stages[stage.value]["status"] = StageStatus.FAILED.value
            self.state.stages[stage.value]["error_message"] = str(e)
            await self._save_state()
            raise

    async def _run_enrichment_stage(self, request: BOMProcessingRequest) -> Optional[Dict[str, Any]]:
        """
        Run enrichment stage by invoking the existing BOMEnrichmentWorkflow as a child workflow.

        This ensures we reuse all existing enrichment logic:
        - Catalog lookup (bulk_prefilter_components)
        - Supplier API enrichment (enrich_component activity)
        - Progress tracking (update_bom_progress)
        - Audit logging (log_enrichment_audit_batch)
        - Rate limiting configuration
        """
        from app.workflows.bom_enrichment import BOMEnrichmentWorkflow, BOMEnrichmentRequest

        stage = ProcessingStage.ENRICHMENT

        while self.is_paused and not self.cancel_requested:
            await workflow.sleep(timedelta(seconds=5))

        if self.cancel_requested:
            return None

        # Mark stage as in progress
        self.state.current_stage = stage.value
        self.state.stages[stage.value]["status"] = StageStatus.IN_PROGRESS.value
        self.state.stages[stage.value]["started_at"] = _get_workflow_timestamp()
        self.state.stages[stage.value]["total_items"] = self.state.total_items
        await self._save_state()

        try:
            # Get total items count
            total_items_result = await workflow.execute_activity(
                get_line_item_count,
                {"bom_id": request.bom_id},
                start_to_close_timeout=timedelta(seconds=10)
            )
            total_items = total_items_result.get("count", self.state.total_items)

            # Create enrichment request
            # Note: BOMEnrichmentRequest has user_id, not user_email
            enrichment_request = BOMEnrichmentRequest(
                bom_id=request.bom_id,
                organization_id=request.organization_id,
                user_id=request.user_id or "system",  # Use user_id from request
                total_items=total_items,
                source="customer",  # BOM processing is for customer BOMs
                job_id=f"enrichment-{request.bom_id}",
                workflow_id=f"bom-enrichment-{request.bom_id}",
                bom_name=request.filename or f"BOM-{request.bom_id[:8]}",
                project_id=request.project_id
            )

            # Execute enrichment as a child workflow
            # This inherits the parent workflow's execution context while running independently
            workflow.logger.info(f"[BOMProcessing] Starting enrichment child workflow for {request.bom_id}")

            enrichment_result = await workflow.execute_child_workflow(
                BOMEnrichmentWorkflow.run,
                enrichment_request,
                id=f"bom-enrichment-{request.bom_id}",
                retry_policy=RetryPolicy(
                    maximum_attempts=2,
                    initial_interval=timedelta(seconds=10),
                )
            )

            workflow.logger.info(f"[BOMProcessing] Enrichment child workflow completed: {enrichment_result}")

            # Update stage with results
            # BOMEnrichmentWorkflow returns: {enriched_items, failed_items, total_items, ...}
            enriched_count = enrichment_result.get("enriched_items", 0)
            failed_count = enrichment_result.get("failed_items", 0)

            workflow.logger.info(f"[BOMProcessing] Enrichment result: enriched={enriched_count}, failed={failed_count}")

            self.state.stages[stage.value]["status"] = StageStatus.COMPLETED.value
            self.state.stages[stage.value]["progress"] = 100
            self.state.stages[stage.value]["items_processed"] = enriched_count + failed_count
            self.state.stages[stage.value]["completed_at"] = _get_workflow_timestamp()
            await self._save_state()

            return {
                "enriched": enriched_count,
                "failed": failed_count,
                "skipped": 0
            }

        except Exception as e:
            self.state.stages[stage.value]["status"] = StageStatus.FAILED.value
            self.state.stages[stage.value]["error_message"] = str(e)
            await self._save_state()
            raise

    async def _run_risk_analysis_stage(self, request: BOMProcessingRequest) -> Optional[Dict[str, Any]]:
        """Run risk analysis stage"""

        stage = ProcessingStage.RISK_ANALYSIS

        while self.is_paused and not self.cancel_requested:
            await workflow.sleep(timedelta(seconds=5))

        if self.cancel_requested:
            return None

        # Mark stage as in progress
        self.state.current_stage = stage.value
        self.state.stages[stage.value]["status"] = StageStatus.IN_PROGRESS.value
        self.state.stages[stage.value]["started_at"] = _get_workflow_timestamp()
        await self._save_state()

        try:
            result = await workflow.execute_activity(
                run_risk_analysis,
                {
                    "bom_id": request.bom_id,
                    "organization_id": request.organization_id,
                },
                start_to_close_timeout=timedelta(minutes=30),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=5),
                )
            )

            self.state.stages[stage.value]["status"] = StageStatus.COMPLETED.value
            self.state.stages[stage.value]["progress"] = 100
            self.state.stages[stage.value]["completed_at"] = _get_workflow_timestamp()
            await self._save_state()

            return result

        except Exception as e:
            self.state.stages[stage.value]["status"] = StageStatus.FAILED.value
            self.state.stages[stage.value]["error_message"] = str(e)
            await self._save_state()
            raise

    async def _complete_stage(self, stage: ProcessingStage, message: str) -> None:
        """Mark a stage as complete"""
        self.state.current_stage = stage.value
        self.state.stages[stage.value]["status"] = StageStatus.COMPLETED.value
        self.state.stages[stage.value]["progress"] = 100
        self.state.stages[stage.value]["message"] = message
        self.state.stages[stage.value]["completed_at"] = _get_workflow_timestamp()
        await self._save_state()

    async def _save_state(self) -> None:
        """Save workflow state to database and publish to Redis"""
        await workflow.execute_activity(
            save_workflow_state,
            self.state.to_dict(),
            start_to_close_timeout=timedelta(seconds=30)
        )

    def _finalize_cancelled(self) -> Dict[str, Any]:
        """Handle cancelled workflow"""
        self.state.status = WorkflowStatus.CANCELLED.value
        return self.state.to_dict()


# =============================================================================
# ACTIVITIES
# =============================================================================

@activity.defn
async def verify_upload(params: Dict[str, Any]) -> Dict[str, Any]:
    """Verify BOM upload exists and is valid"""
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    bom_id = params["bom_id"]
    org_id = params["organization_id"]

    logger.info(f"[BOMProcessing] Verifying upload: {bom_id}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Check bom_uploads exists
        query = text("""
            SELECT id, filename, status, total_rows, file_size
            FROM bom_uploads
            WHERE id = :bom_id AND organization_id = :org_id
        """)

        result = db.execute(query, {"bom_id": bom_id, "org_id": org_id})
        row = result.fetchone()

        if not row:
            # Try boms table instead
            query2 = text("""
                SELECT id, name, status, component_count
                FROM boms
                WHERE id = :bom_id AND organization_id = :org_id
            """)
            result2 = db.execute(query2, {"bom_id": bom_id, "org_id": org_id})
            row = result2.fetchone()

        if not row:
            raise ValueError(f"BOM not found: {bom_id}")

        m = row._mapping
        logger.info(f"[BOMProcessing] Upload verified: {m.get('filename') or m.get('name')}")

        return {
            "success": True,
            "filename": m.get("filename") or m.get("name"),
            "status": m.get("status"),
            "total_rows": m.get("total_rows") or m.get("component_count") or 0,
        }

    except Exception as e:
        logger.error(f"[BOMProcessing] Verify upload failed: {e}")
        raise


@activity.defn
async def verify_parsing(params: Dict[str, Any]) -> Dict[str, Any]:
    """Verify line items have been parsed and saved"""
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    bom_id = params["bom_id"]

    logger.info(f"[BOMProcessing] Verifying parsing: {bom_id}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("""
            SELECT COUNT(*) as count
            FROM bom_line_items
            WHERE bom_id = :bom_id
        """)

        result = db.execute(query, {"bom_id": bom_id})
        row = result.fetchone()
        total_items = row[0] if row else 0

        logger.info(f"[BOMProcessing] Found {total_items} line items")

        return {
            "success": True,
            "total_items": total_items,
        }

    except Exception as e:
        logger.error(f"[BOMProcessing] Verify parsing failed: {e}")
        raise


@activity.defn
async def get_line_item_count(params: Dict[str, Any]) -> Dict[str, Any]:
    """Get the count of line items for a BOM"""
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    bom_id = params["bom_id"]

    logger.info(f"[BOMProcessing] Getting line item count: {bom_id}")

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        query = text("SELECT COUNT(*) FROM bom_line_items WHERE bom_id = :bom_id")
        result = db.execute(query, {"bom_id": bom_id})
        count = result.scalar() or 0

        logger.info(f"[BOMProcessing] Found {count} line items")

        return {"count": count}

    except Exception as e:
        logger.error(f"[BOMProcessing] Failed to get line item count: {e}")
        return {"count": 0}


@activity.defn
async def run_risk_analysis(params: Dict[str, Any]) -> Dict[str, Any]:
    """Run risk analysis"""
    from app.services.risk_calculation_service import RiskCalculationService
    from app.models.dual_database import get_dual_database

    bom_id = params["bom_id"]
    org_id = params["organization_id"]

    logger.info(f"[BOMProcessing] Starting risk analysis: {bom_id}")

    try:
        # Initialize risk calculator with database session
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))
        risk_calc = RiskCalculationService()

        # Calculate risk for BOM
        result = await risk_calc.calculate_bom_risk_summary(bom_id, org_id, db)

        logger.info(f"[BOMProcessing] Risk analysis completed: grade={result.health_grade}")

        return {
            "success": True,
            "health_grade": result.health_grade.value if result.health_grade else "N/A",
            "average_risk_score": result.average_risk_score or 0,
            "scored_items": result.total_components or 0,
        }

    except Exception as e:
        logger.error(f"[BOMProcessing] Risk analysis failed: {e}")
        return {
            "success": False,
            "health_grade": "N/A",
            "average_risk_score": 0,
            "error": str(e),
        }


@activity.defn
async def save_workflow_state(state: Dict[str, Any]) -> None:
    """Save workflow state to database and publish to Redis"""
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import json
    import redis
    import os

    bom_id = state["bom_id"]

    logger.info(f"[BOMProcessing] Saving state: {bom_id} (status={state['status']})")

    try:
        # Save to database
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Upsert bom_processing_jobs record
        # Use CAST() instead of :: to avoid SQLAlchemy text() parsing issues
        query = text("""
            INSERT INTO bom_processing_jobs (
                bom_id, organization_id, workflow_id, status, current_stage,
                stages, total_items, enriched_items, failed_items, risk_scored_items,
                health_grade, average_risk_score, error_message,
                started_at, completed_at, paused_at, updated_at
            ) VALUES (
                :bom_id, :organization_id, :workflow_id, :status, :current_stage,
                CAST(:stages AS jsonb), :total_items, :enriched_items, :failed_items, :risk_scored_items,
                :health_grade, :average_risk_score, :error_message,
                CAST(:started_at AS timestamptz), CAST(:completed_at AS timestamptz), CAST(:paused_at AS timestamptz), NOW()
            )
            ON CONFLICT (bom_id) DO UPDATE SET
                status = EXCLUDED.status,
                current_stage = EXCLUDED.current_stage,
                stages = EXCLUDED.stages,
                total_items = EXCLUDED.total_items,
                enriched_items = EXCLUDED.enriched_items,
                failed_items = EXCLUDED.failed_items,
                risk_scored_items = EXCLUDED.risk_scored_items,
                health_grade = EXCLUDED.health_grade,
                average_risk_score = EXCLUDED.average_risk_score,
                error_message = EXCLUDED.error_message,
                completed_at = EXCLUDED.completed_at,
                paused_at = EXCLUDED.paused_at,
                updated_at = NOW()
        """)

        db.execute(query, {
            "bom_id": state["bom_id"],
            "organization_id": state["organization_id"],
            "workflow_id": state["workflow_id"],
            "status": state["status"],
            "current_stage": state["current_stage"],
            "stages": json.dumps(state["stages"]),
            "total_items": state["total_items"],
            "enriched_items": state["enriched_items"],
            "failed_items": state["failed_items"],
            "risk_scored_items": state["risk_scored_items"],
            "health_grade": state.get("health_grade"),
            "average_risk_score": state.get("average_risk_score"),
            "error_message": state.get("error_message"),
            "started_at": state.get("started_at"),
            "completed_at": state.get("completed_at"),
            "paused_at": state.get("paused_at"),
        })
        db.commit()
        logger.info(f"[BOMProcessing] State saved to database: {bom_id}")

        # Publish to Redis for SSE (use REDIS_URL from config or fallback)
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/2")
        try:
            r = redis.from_url(redis_url, decode_responses=True)
            channel = f"bom:processing:{bom_id}"
            r.publish(channel, json.dumps(state))
            logger.info(f"[BOMProcessing] State published to Redis channel: {channel}")
        except Exception as redis_err:
            logger.warning(f"[BOMProcessing] Failed to publish to Redis (non-fatal): {redis_err}")

    except Exception as e:
        logger.error(f"[BOMProcessing] Failed to save state: {e}")
        # Don't raise - state saving is non-critical


@activity.defn
async def publish_workflow_event(params: Dict[str, Any]) -> None:
    """Publish workflow event to RabbitMQ and Redis"""
    import json
    import redis
    import os

    bom_id = params["bom_id"]
    event_type = params["event_type"]
    state = params.get("state", {})

    logger.info(f"[BOMProcessing] Publishing event: {event_type} for {bom_id}")

    try:
        # Publish to Redis for SSE
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", "27012"))

        r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

        event = {
            "event_type": event_type,
            "bom_id": bom_id,
            "timestamp": datetime.utcnow().isoformat(),
            "state": state,
        }

        channel = f"bom:processing:{bom_id}"
        r.publish(channel, json.dumps(event))

        # Also publish to RabbitMQ
        from shared.event_bus import event_bus

        event_bus.publish(
            f"customer.bom.processing.{event_type}",
            event,
            priority=7
        )

    except Exception as e:
        logger.warning(f"[BOMProcessing] Failed to publish event: {e}")
        # Don't raise - event publishing is non-critical
