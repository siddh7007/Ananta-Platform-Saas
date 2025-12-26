"""
AI Development Cycle API
Provides endpoints for closed-loop AI-powered development using Temporal
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from asgiref.sync import async_to_sync
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny  # TODO: Change to IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as http_status

from temporalio.client import Client as TemporalClient, WorkflowHandle
from temporalio.common import RetryPolicy

# Import workflow and data classes
from temporal_worker.workflows import AIDevCycleInput, AIDevCycleWorkflow

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)

# Global Temporal client (initialized on first use)
_temporal_client: Optional[TemporalClient] = None


# ============================================================================
# Temporal Client Management
# ============================================================================

async def get_temporal_client() -> TemporalClient:
    """
    Get or create Temporal client connection

    Returns singleton client instance
    """
    global _temporal_client

    if _temporal_client is None:
        temporal_host = os.getenv("TEMPORAL_HOST", "temporal")

        # Check if port is already included in TEMPORAL_HOST
        if ":" in temporal_host:
            temporal_address = temporal_host
        else:
            temporal_port = os.getenv("TEMPORAL_PORT", "7233")
            temporal_address = f"{temporal_host}:{temporal_port}"

        logger.info(f"Connecting to Temporal at {temporal_address}")

        _temporal_client = await TemporalClient.connect(
            temporal_address,
            namespace="default"
        )

        logger.info("Temporal client connected successfully")

    return _temporal_client


async def get_workflow_handle(workflow_id: str) -> WorkflowHandle:
    """Get handle to existing workflow"""
    client = await get_temporal_client()
    return client.get_workflow_handle(workflow_id)


# ============================================================================
# API Endpoints
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])  # TODO: Change to IsAuthenticated after testing
def trigger_ai_dev_cycle(request):
    """
    Trigger AI development cycle via Temporal workflow

    POST /api/ai-dev/trigger
    {
        "service": "backend",  // or "dashboard", "frontend"
        "description": "Fix failing unit tests for Component model",
        "max_iterations": 3,  // optional, default 3
        "require_approval": true  // optional, default true
    }

    Returns:
    {
        "success": true,
        "workflow_id": "ai-dev-backend-...",
        "run_id": "...",
        "temporal_ui_url": "http://localhost:27241/namespaces/default/workflows/...",
        "message": "Workflow started successfully"
    }
    """
    service = request.data.get('service')
    if service not in ['backend', 'dashboard', 'frontend']:
        return Response(
            {'error': 'Invalid service. Must be: backend, dashboard, or frontend'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    description = request.data.get('description', 'AI development cycle')
    max_iterations = request.data.get('max_iterations', 3)
    require_approval = request.data.get('require_approval', True)

    # Generate workflow ID
    workflow_id = f"ai-dev-{service}-{uuid.uuid4()}"

    try:
        # Create workflow input
        workflow_input = AIDevCycleInput(
            service=service,
            description=description,
            workflow_id=workflow_id,
            max_iterations=max_iterations,
            require_approval=require_approval
        )

        # Start workflow asynchronously
        async def start_workflow():
            client = await get_temporal_client()

            handle = await client.start_workflow(
                AIDevCycleWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue="ai-dev-cycle",
                retry_policy=RetryPolicy(maximum_attempts=1)  # Don't retry workflows
            )

            return handle

        # Run in async context
        handle = async_to_sync(start_workflow)()

        logger.info(f"AI dev cycle workflow started: {workflow_id}")

        # Get Temporal UI URL from environment
        temporal_ui_host = os.getenv("TEMPORAL_UI_HOST", "localhost")
        temporal_ui_port = os.getenv("TEMPORAL_UI_PORT", "27021")
        temporal_ui_url = f"http://{temporal_ui_host}:{temporal_ui_port}/namespaces/default/workflows/{workflow_id}"

        return Response({
            'success': True,
            'workflow_id': workflow_id,
            'run_id': handle.first_execution_run_id,
            'temporal_ui_url': temporal_ui_url,
            'message': 'Workflow started successfully'
        })

    except Exception as e:
        logger.error(f"Failed to start AI dev cycle: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to start workflow: {str(e)}'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_workflow_status(request, workflow_id: str):
    """
    Get status of AI dev cycle workflow

    GET /api/ai-dev/status/<workflow_id>

    Returns:
    {
        "workflow_id": "ai-dev-backend-...",
        "status": "running",  // running, completed, failed, cancelled
        "current_state": {
            "iteration": 2,
            "fixes_applied": 5,
            "awaiting_approval": false
        },
        "result": null  // or final result if completed
    }
    """
    try:
        async def get_status():
            handle = await get_workflow_handle(workflow_id)

            # Query current status
            current_state = await handle.query(AIDevCycleWorkflow.get_status)

            # Try to get result (will return None if not completed)
            try:
                result = await handle.result()
                workflow_status = "completed"
            except Exception:
                result = None
                # Check if workflow is still running
                describe = await handle.describe()
                if describe.status.name == "RUNNING":
                    workflow_status = "running"
                elif describe.status.name == "FAILED":
                    workflow_status = "failed"
                elif describe.status.name == "CANCELLED":
                    workflow_status = "cancelled"
                else:
                    workflow_status = describe.status.name.lower()

            return {
                "workflow_id": workflow_id,
                "status": workflow_status,
                "current_state": current_state,
                "result": result.__dict__ if result else None
            }

        status_info = async_to_sync(get_status)()

        return Response(status_info)

    except Exception as e:
        logger.error(f"Failed to get workflow status: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to get status: {str(e)}'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def approve_suggestions(request, workflow_id: str):
    """
    Approve AI-generated code suggestions

    POST /api/ai-dev/approve/<workflow_id>
    {
        "approved": true,
        "suggestions": [
            {
                "file_path": "catalog/models.py",
                "old_code": "...",
                "new_code": "...",
                "line_start": 45,
                "line_end": 45,
                "description": "Fix validation error"
            }
        ]
    }

    Returns:
    {
        "success": true,
        "workflow_id": "ai-dev-backend-...",
        "message": "Approval signal sent"
    }
    """
    approved = request.data.get('approved', True)
    suggestions = request.data.get('suggestions', [])

    try:
        async def send_approval():
            handle = await get_workflow_handle(workflow_id)

            if approved and suggestions:
                await handle.signal(AIDevCycleWorkflow.approve_suggestions, suggestions)
                message = f"Approved {len(suggestions)} suggestion(s)"
            else:
                await handle.signal(AIDevCycleWorkflow.reject_suggestions)
                message = "Rejected all suggestions"

            return message

        message = async_to_sync(send_approval)()

        logger.info(f"Approval signal sent to workflow {workflow_id}")

        return Response({
            'success': True,
            'workflow_id': workflow_id,
            'message': message
        })

    except Exception as e:
        logger.error(f"Failed to send approval: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to send approval: {str(e)}'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def apply_code_fixes(request):
    """
    Apply AI-generated code fixes to filesystem

    This endpoint is called by Temporal activities, not directly by users.
    For user-initiated actions, use the approve_suggestions endpoint.

    POST /api/ai-dev/apply-fixes
    {
        "workflow_id": "ai-dev-backend-...",
        "fixes": [...]
    }

    Returns:
    {
        "success": true,
        "applied": 3,
        "failed": 0,
        "results": [...]
    }
    """
    # This is typically called by Temporal activities
    # For now, return a message directing users to use approve_suggestions

    return Response({
        'message': 'This endpoint is for internal use by Temporal activities. '
                   'To apply fixes, use POST /api/ai-dev/approve/<workflow_id>'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def list_workflows(request):
    """
    List AI dev cycle workflows

    GET /api/ai-dev/workflows?service=backend&status=running&limit=50

    Query Parameters:
    - service (optional): Filter by service (backend/dashboard/frontend)
    - status (optional): Filter by status (running/completed/failed)
    - limit (optional): Max number of results (default: 50)

    Returns:
    {
        "workflows": [
            {
                "workflow_id": "ai-dev-backend-...",
                "service": "backend",
                "status": "completed",
                "started_at": "2025-10-28T15:10:00Z",
                "completed_at": "2025-10-28T15:25:00Z"
            }
        ],
        "total": 10,
        "limit": 50
    }
    """
    # service_filter = request.GET.get('service')
    # status_filter = request.GET.get('status')
    limit = int(request.GET.get('limit', 50))

    try:
        async def list_all_workflows():
            client = await get_temporal_client()

            # List workflows (this is a simplified version)
            # In production, you'd want to use Temporal's workflow search/list API

            workflows = []

            # For now, return empty list with note
            # Full implementation would query Temporal's workflow history

            return {
                "workflows": workflows,
                "total": len(workflows),
                "limit": limit,
                "note": "Full workflow listing requires Temporal Cloud or advanced search setup"
            }

        result = async_to_sync(list_all_workflows)()

        return Response(result)

    except Exception as e:
        logger.error(f"Failed to list workflows: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to list workflows: {str(e)}'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )
