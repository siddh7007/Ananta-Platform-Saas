"""
Temporal Client Helper for BOM Enrichment Workflows

Provides convenient methods to:
- Connect to Temporal server
- Start BOM enrichment workflows
- Query workflow progress
- Cancel workflows

Usage:
    from app.workflows.temporal_client import start_bom_enrichment

    # Start enrichment workflow
    workflow_id = await start_bom_enrichment(
        job_id="abc-123",
        bom_id="bom-456", organization_id="tenant-789",
        total_items=250
    )
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import asdict, is_dataclass
from temporalio.client import Client, WorkflowExecutionStatus
from temporalio.common import RetryPolicy
from app.workflows.bom_enrichment import (
    BOMEnrichmentWorkflow,
    BOMEnrichmentRequest
)
from app.workflows.bom_risk_workflow import (
    BOMRiskAnalysisWorkflow,
    BOMRiskRequest
)
from app.workflows.bom_processing_workflow import (
    BOMProcessingWorkflow,
    BOMProcessingRequest
)
from app.config import settings

logger = logging.getLogger(__name__)

# Temporal connection configuration
TEMPORAL_HOST = settings.temporal_host
TEMPORAL_NAMESPACE = settings.temporal_namespace
TASK_QUEUE = settings.temporal_task_queue

# Global client instance (reused across requests)
_temporal_client: Optional[Client] = None


def _serialize_dataclass(obj: Any) -> Any:
    """
    Recursively serialize dataclass objects to dictionaries.

    Args:
        obj: Object to serialize (may be dataclass, dict, list, or primitive)

    Returns:
        JSON-serializable version of the object
    """
    if is_dataclass(obj):
        return asdict(obj)
    elif isinstance(obj, dict):
        return {key: _serialize_dataclass(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_serialize_dataclass(item) for item in obj]
    else:
        return obj


async def get_temporal_client() -> Client:
    """
    Get or create Temporal client connection.

    Returns:
        Connected Temporal client

    Note:
        Client is cached globally for performance.
        Automatically reconnects if connection is lost.
    """
    global _temporal_client

    if _temporal_client is None:
        try:
            logger.info(f"Connecting to Temporal at {TEMPORAL_HOST}, namespace: {TEMPORAL_NAMESPACE}")
            _temporal_client = await Client.connect(
                TEMPORAL_HOST,
                namespace=TEMPORAL_NAMESPACE,
            )
            logger.info("✅ Temporal client connected successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Temporal: {e}")
            raise

    return _temporal_client


async def start_bom_enrichment(
    job_id: str,
    bom_id: str,
    organization_id: str,
    total_items: int,
    project_id: Optional[str] = None
) -> str:
    """
    Start BOM enrichment workflow in Temporal.

    Args:
        job_id: BOM job ID (from bom_jobs table)
        bom_id: BOM ID (from boms table)
        tenant_id: Tenant/customer ID
        total_items: Number of line items to enrich
        project_id: Optional project ID

    Returns:
        Workflow ID (for tracking/querying)

    Raises:
        Exception if workflow fails to start

    Example:
        workflow_id = await start_bom_enrichment(
            job_id="abc-123-uuid",
            bom_id="bom-456-uuid", organization_id="tenant-789-uuid",
            total_items=250,
            project_id="project-101-uuid"
        )
        # Returns: "bom-enrichment-abc-123-uuid"
    """
    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Create enrichment request
        request = BOMEnrichmentRequest(
            job_id=job_id,
            bom_id=bom_id, organization_id=tenant_id,
            project_id=project_id,
            total_items=total_items
        )

        # Generate workflow ID (unique, deterministic)
        workflow_id = f"bom-enrichment-{job_id}"

        logger.info(f"Starting BOM enrichment workflow: {workflow_id}")
        logger.info(f"  Job ID: {job_id}")
        logger.info(f"  BOM ID: {bom_id}")
        logger.info(f"  Tenant ID: {tenant_id}")
        logger.info(f"  Total Items: {total_items}")

        # Start workflow
        handle = await client.start_workflow(
            BOMEnrichmentWorkflow.run,
            request,
            id=workflow_id,
            task_queue=TASK_QUEUE,
            retry_policy=RetryPolicy(
                initial_interval_seconds=1,
                backoff_coefficient=2.0,
                maximum_interval_seconds=300,  # 5 minutes
                maximum_attempts=5
            )
        )

        logger.info(f"✅ BOM enrichment workflow started: {workflow_id}")
        return workflow_id

    except Exception as e:
        logger.error(f"❌ Failed to start BOM enrichment workflow: {e}", exc_info=True)
        raise


async def start_bom_processing(
    bom_id: str,
    organization_id: str,
    filename: str,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    skip_enrichment: bool = False,
    skip_risk_analysis: bool = False,
    enrichment_level: str = "standard",
    priority: int = 5
) -> str:
    """
    Start comprehensive BOM processing workflow in Temporal.

    This starts the end-to-end BOM processing workflow that handles:
    - Upload verification
    - Parsing validation
    - Component enrichment
    - Risk analysis
    - Completion and notifications

    Args:
        bom_id: BOM ID (from boms table)
        organization_id: Organization/tenant ID
        filename: Original filename
        project_id: Optional project ID
        user_id: User who uploaded the BOM
        user_email: User email
        skip_enrichment: Skip enrichment stage (testing)
        skip_risk_analysis: Skip risk analysis stage (testing)
        enrichment_level: Enrichment depth (basic, standard, comprehensive)
        priority: Processing priority (1-9, higher = more urgent)

    Returns:
        Workflow ID (for tracking/querying)

    Raises:
        Exception if workflow fails to start

    Example:
        workflow_id = await start_bom_processing(
            bom_id="bom-456-uuid",
            organization_id="tenant-789-uuid",
            filename="my_bom.csv",
            project_id="project-101-uuid",
            user_id="user-202-uuid",
            user_email="user@example.com"
        )
        # Returns: "bom-processing-bom-456-uuid"
    """
    try:
        # Get Temporal client
        client = await get_temporal_client()

        # Create processing request
        request = BOMProcessingRequest(
            bom_id=bom_id,
            organization_id=organization_id,
            filename=filename,
            project_id=project_id,
            user_id=user_id,
            user_email=user_email,
            skip_enrichment=skip_enrichment,
            skip_risk_analysis=skip_risk_analysis,
            enrichment_level=enrichment_level,
            priority=priority
        )

        # Generate workflow ID (unique, deterministic)
        workflow_id = f"bom-processing-{bom_id}"

        logger.info(f"Starting BOM processing workflow: {workflow_id}")
        logger.info(f"  BOM ID: {bom_id}")
        logger.info(f"  Organization ID: {organization_id}")
        logger.info(f"  Filename: {filename}")
        logger.info(f"  Project ID: {project_id or 'None'}")
        logger.info(f"  Enrichment Level: {enrichment_level}")
        logger.info(f"  Priority: {priority}")

        # Start workflow
        handle = await client.start_workflow(
            BOMProcessingWorkflow.run,
            request,
            id=workflow_id,
            task_queue=TASK_QUEUE,
            retry_policy=RetryPolicy(
                initial_interval_seconds=1,
                backoff_coefficient=2.0,
                maximum_interval_seconds=300,  # 5 minutes
                maximum_attempts=5
            )
        )

        logger.info(f"✅ BOM processing workflow started: {workflow_id}")
        return workflow_id

    except Exception as e:
        logger.error(f"❌ Failed to start BOM processing workflow: {e}", exc_info=True)
        raise


async def get_workflow_status(workflow_id: str, timeout_seconds: int = 5) -> Dict[str, Any]:
    """
    Get BOM enrichment workflow status and progress.

    Uses handle.describe() for accurate workflow state tracking.

    Args:
        workflow_id: Workflow ID (e.g., "bom-enrichment-abc-123")
        timeout_seconds: Query timeout in seconds (default: 5)

    Returns:
        Dict with workflow status and progress:
        {
            "workflow_id": "bom-enrichment-abc-123",
            "status": "running" | "completed" | "failed" | "cancelled" | "terminated",
            "progress": {
                "total_items": 250,
                "enriched_items": 180,
                "failed_items": 5,
                "pending_items": 65,
                "percent_complete": 72.0
            },
            "errors": [],
            "temporal_status": "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TERMINATED"
        }

    Raises:
        Exception if workflow not found or query fails
    """
    try:
        client = await get_temporal_client()

        # Get workflow handle
        handle = client.get_workflow_handle(workflow_id)

        # Step 1: Get workflow execution description (accurate state)
        try:
            import asyncio
            description = await asyncio.wait_for(
                handle.describe(),
                timeout=timeout_seconds
            )
            temporal_status = description.status
        except asyncio.TimeoutError:
            logger.warning(f"Timeout getting workflow description for {workflow_id}")
            temporal_status = None
        except Exception as e:
            logger.warning(f"Failed to get workflow description for {workflow_id}: {e}")
            temporal_status = None

        # Step 2: Map Temporal status to application status
        status_map = {
            WorkflowExecutionStatus.RUNNING: "running",
            WorkflowExecutionStatus.COMPLETED: "completed",
            WorkflowExecutionStatus.FAILED: "failed",
            WorkflowExecutionStatus.CANCELLED: "cancelled",
            WorkflowExecutionStatus.TERMINATED: "terminated",
            WorkflowExecutionStatus.CONTINUED_AS_NEW: "running",
            WorkflowExecutionStatus.TIMED_OUT: "failed"
        }

        application_status = status_map.get(temporal_status, "unknown") if temporal_status else "unknown"

        # Step 3: Get progress data
        progress_data = {}
        errors = []

        if temporal_status == WorkflowExecutionStatus.RUNNING:
            # Workflow is running - query progress
            try:
                progress = await asyncio.wait_for(
                    handle.query(BOMEnrichmentWorkflow.get_progress),
                    timeout=timeout_seconds
                )
                # Serialize dataclass to dict
                progress_data = _serialize_dataclass(progress)
            except asyncio.TimeoutError:
                logger.warning(f"Timeout querying progress for {workflow_id}")
                progress_data = {"error": "timeout_querying_progress"}
            except Exception as e:
                logger.warning(f"Failed to query progress for {workflow_id}: {e}")
                progress_data = {"error": str(e)}

        elif temporal_status == WorkflowExecutionStatus.COMPLETED:
            # Workflow completed - get result
            try:
                result = await asyncio.wait_for(
                    handle.result(),
                    timeout=timeout_seconds
                )
                # Extract progress from result summary
                progress_data = {
                    "total_items": result.get("total_items", 0),
                    "enriched_items": result.get("enriched_items", 0),
                    "failed_items": result.get("failed_items", 0),
                    "pending_items": 0,
                    "percent_complete": 100.0
                }
                errors = result.get("errors", [])
            except asyncio.TimeoutError:
                logger.warning(f"Timeout getting result for {workflow_id}")
                progress_data = {"error": "timeout_getting_result"}
            except Exception as e:
                logger.warning(f"Failed to get result for {workflow_id}: {e}")
                progress_data = {"error": str(e)}

        elif temporal_status in [WorkflowExecutionStatus.FAILED, WorkflowExecutionStatus.TIMED_OUT]:
            # Workflow failed - try to get error info
            try:
                await asyncio.wait_for(handle.result(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                progress_data = {"error": "timeout_getting_error"}
            except Exception as e:
                errors = [{"error_type": type(e).__name__, "error_message": str(e)}]
                progress_data = {}

        elif temporal_status == WorkflowExecutionStatus.CANCELLED:
            # Workflow was cancelled
            progress_data = {"cancelled": True}
            errors = [{"error_type": "WorkflowCancelled", "error_message": "Workflow was cancelled by user"}]

        return {
            "workflow_id": workflow_id,
            "status": application_status,
            "progress": progress_data,
            "errors": errors,
            "temporal_status": temporal_status.name if temporal_status else "UNKNOWN"
        }

    except Exception as e:
        logger.error(f"Failed to get workflow status for {workflow_id}: {e}", exc_info=True)
        return {
            "workflow_id": workflow_id,
            "status": "error",
            "progress": {},
            "errors": [{"error_type": type(e).__name__, "error_message": str(e)}],
            "temporal_status": "ERROR"
        }


async def cancel_workflow(workflow_id: str) -> bool:
    """
    Cancel a running BOM enrichment workflow.

    Args:
        workflow_id: Workflow ID to cancel

    Returns:
        True if cancelled successfully, False otherwise

    Example:
        success = await cancel_workflow("bom-enrichment-abc-123")
    """
    try:
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)
        await handle.cancel()
        logger.info(f"✅ Workflow cancelled: {workflow_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to cancel workflow {workflow_id}: {e}")
        return False


async def close_temporal_client():
    """
    Close Temporal client connection.

    Call this on application shutdown.
    """
    global _temporal_client
    if _temporal_client:
        await _temporal_client.close()
        _temporal_client = None
        logger.info("Temporal client closed")


async def start_bom_risk_analysis(
    organization_id: str,
    bom_id: Optional[str] = None,
    force_recalculate: bool = False,
    user_id: Optional[str] = None
) -> str:
    """
    Start BOM risk analysis workflow in Temporal.

    Args:
        organization_id: Organization ID to process
        bom_id: Optional specific BOM ID (if None, process all BOMs)
        force_recalculate: Recalculate even if scores exist
        user_id: User who triggered the analysis

    Returns:
        Workflow ID for tracking

    Example:
        # Analyze all BOMs in org
        workflow_id = await start_bom_risk_analysis(org_id="abc-123")

        # Analyze specific BOM
        workflow_id = await start_bom_risk_analysis(org_id="abc", bom_id="bom-456")
    """
    try:
        client = await get_temporal_client()

        request = BOMRiskRequest(
            organization_id=organization_id,
            bom_id=bom_id,
            force_recalculate=force_recalculate,
            user_id=user_id
        )

        # Generate unique workflow ID
        import uuid
        suffix = bom_id[:8] if bom_id else str(uuid.uuid4())[:8]
        workflow_id = f"bom-risk-{organization_id[:8]}-{suffix}"

        logger.info(f"Starting BOM risk analysis workflow: {workflow_id}")
        logger.info(f"  Organization: {organization_id}")
        logger.info(f"  BOM: {bom_id or 'ALL'}")
        logger.info(f"  Force recalculate: {force_recalculate}")

        handle = await client.start_workflow(
            BOMRiskAnalysisWorkflow.run,
            request,
            id=workflow_id,
            task_queue=TASK_QUEUE,
            retry_policy=RetryPolicy(
                initial_interval_seconds=2,
                backoff_coefficient=2.0,
                maximum_interval_seconds=60,
                maximum_attempts=3
            )
        )

        logger.info(f"✅ BOM risk analysis workflow started: {workflow_id}")
        return workflow_id

    except Exception as e:
        logger.error(f"❌ Failed to start BOM risk analysis workflow: {e}", exc_info=True)
        raise


async def get_risk_workflow_result(workflow_id: str, timeout_seconds: int = 60) -> Dict[str, Any]:
    """
    Wait for BOM risk analysis workflow to complete and get result.

    Args:
        workflow_id: Workflow ID to wait for
        timeout_seconds: Maximum time to wait

    Returns:
        Workflow result with BOM risk summaries
    """
    import asyncio
    try:
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)

        result = await asyncio.wait_for(
            handle.result(),
            timeout=timeout_seconds
        )

        return result

    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": "Workflow timed out",
            "workflow_id": workflow_id
        }
    except Exception as e:
        logger.error(f"Failed to get risk workflow result: {e}")
        return {
            "success": False,
            "error": str(e),
            "workflow_id": workflow_id
        }


# Export public API
__all__ = [
    "get_temporal_client",
    "start_bom_enrichment",
    "start_bom_processing",
    "get_workflow_status",
    "cancel_workflow",
    "close_temporal_client",
    "start_bom_risk_analysis",
    "get_risk_workflow_result",
]
