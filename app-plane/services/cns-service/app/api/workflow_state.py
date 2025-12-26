"""
Workflow State API Endpoints

Provides endpoints for saving and loading user workflow state to/from S3/MinIO:
- GET /api/workflow/state - Get user's current workflow state
- PUT /api/workflow/state - Save user's workflow state
- DELETE /api/workflow/state - Clear user's workflow state

State is stored as JSON in MinIO at:
  workflow-state/{organization_id}/{user_id}/bom-upload-state.json

This allows users to:
- Resume BOM uploads from any browser/device
- Persist state across sessions
- Clear stale state when starting fresh
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.authorization import get_auth_context, AuthContext
from app.utils.minio_client import get_minio_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"])

# Bucket for workflow state storage
WORKFLOW_STATE_BUCKET = "workflow-state"


# =====================================================
# Pydantic Models
# =====================================================

class BomQueueItem(BaseModel):
    """A single BOM in the upload queue."""
    bomId: str
    bomName: str
    fileName: str
    totalComponents: int = 0
    projectId: Optional[str] = None
    projectName: Optional[str] = None
    addedAt: int  # Unix timestamp
    isActive: bool = False


class ActiveWorkflow(BaseModel):
    """Currently active workflow state."""
    bomId: str
    bomName: str
    fileName: str
    totalComponents: int = 0
    currentStepId: str
    projectId: Optional[str] = None
    projectName: Optional[str] = None


class WorkflowState(BaseModel):
    """Complete workflow state for a user."""
    version: int = 1
    userId: str
    organizationId: str
    lastUpdated: str  # ISO timestamp
    activeWorkflow: Optional[ActiveWorkflow] = None
    bomQueue: List[BomQueueItem] = Field(default_factory=list)


class SaveWorkflowStateRequest(BaseModel):
    """Request to save workflow state."""
    activeWorkflow: Optional[ActiveWorkflow] = None
    bomQueue: List[BomQueueItem] = Field(default_factory=list)


class WorkflowStateResponse(BaseModel):
    """Response with workflow state."""
    success: bool
    state: Optional[WorkflowState] = None
    message: Optional[str] = None


# =====================================================
# Helper Functions
# =====================================================

def get_state_object_key(organization_id: str, user_id: str) -> str:
    """Generate S3 object key for workflow state."""
    return f"{organization_id}/{user_id}/bom-upload-state.json"


def load_state_from_s3(organization_id: str, user_id: str) -> Optional[WorkflowState]:
    """Load workflow state from S3/MinIO."""
    client = get_minio_client()
    if not client.is_enabled():
        logger.warning("MinIO not enabled, cannot load workflow state")
        return None

    object_key = get_state_object_key(organization_id, user_id)

    try:
        data = client.download_file(WORKFLOW_STATE_BUCKET, object_key)
        if data is None:
            logger.debug(f"No workflow state found for {organization_id}/{user_id}")
            return None

        state_dict = json.loads(data.decode('utf-8'))
        return WorkflowState(**state_dict)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in workflow state: {e}")
        return None
    except Exception as e:
        logger.debug(f"Could not load workflow state: {e}")
        return None


def save_state_to_s3(state: WorkflowState) -> bool:
    """Save workflow state to S3/MinIO."""
    client = get_minio_client()
    if not client.is_enabled():
        logger.warning("MinIO not enabled, cannot save workflow state")
        return False

    object_key = get_state_object_key(state.organizationId, state.userId)

    try:
        state_json = state.model_dump_json(indent=2)
        success, error = client.upload_file(
            bucket=WORKFLOW_STATE_BUCKET,
            object_name=object_key,
            file_data=state_json.encode('utf-8'),
            content_type='application/json'
        )

        if not success:
            logger.error(f"Failed to save workflow state: {error}")
            return False

        logger.info(f"Saved workflow state for {state.organizationId}/{state.userId}")
        return True
    except Exception as e:
        logger.error(f"Error saving workflow state: {e}")
        return False


def delete_state_from_s3(organization_id: str, user_id: str) -> bool:
    """Delete workflow state from S3/MinIO."""
    client = get_minio_client()
    if not client.is_enabled():
        logger.warning("MinIO not enabled, cannot delete workflow state")
        return False

    object_key = get_state_object_key(organization_id, user_id)

    try:
        success = client.delete_file(WORKFLOW_STATE_BUCKET, object_key)
        if success:
            logger.info(f"Deleted workflow state for {organization_id}/{user_id}")
        return success
    except Exception as e:
        logger.error(f"Error deleting workflow state: {e}")
        return False


# =====================================================
# API Endpoints
# =====================================================

@router.get("/state", response_model=WorkflowStateResponse)
async def get_workflow_state(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get the current user's workflow state.

    Returns the persisted BOM upload workflow state including:
    - Active workflow (if any)
    - BOM upload queue

    This allows users to resume their work from any browser/device.
    """
    organization_id = auth.organization_id
    user_id = auth.user_id

    if not organization_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing organization or user context")

    state = load_state_from_s3(organization_id, user_id)

    if state is None:
        return WorkflowStateResponse(
            success=True,
            state=None,
            message="No workflow state found"
        )

    return WorkflowStateResponse(
        success=True,
        state=state
    )


@router.put("/state", response_model=WorkflowStateResponse)
async def save_workflow_state(
    request: SaveWorkflowStateRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Save the current user's workflow state.

    Persists the BOM upload workflow state to S3/MinIO so it can be
    resumed from any browser/device.
    """
    organization_id = auth.organization_id
    user_id = auth.user_id

    if not organization_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing organization or user context")

    # Create full state object
    state = WorkflowState(
        version=1,
        userId=user_id,
        organizationId=organization_id,
        lastUpdated=datetime.now(timezone.utc).isoformat(),
        activeWorkflow=request.activeWorkflow,
        bomQueue=request.bomQueue
    )

    success = save_state_to_s3(state)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save workflow state")

    return WorkflowStateResponse(
        success=True,
        state=state,
        message="Workflow state saved"
    )


@router.delete("/state", response_model=WorkflowStateResponse)
async def delete_workflow_state(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Delete/clear the current user's workflow state.

    Use this when starting fresh to clear any persisted state.
    """
    organization_id = auth.organization_id
    user_id = auth.user_id

    if not organization_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing organization or user context")

    success = delete_state_from_s3(organization_id, user_id)

    # Return success even if file didn't exist
    return WorkflowStateResponse(
        success=True,
        state=None,
        message="Workflow state cleared"
    )
