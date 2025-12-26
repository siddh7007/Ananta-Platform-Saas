"""BOM Ingest Status API

Provides a simple endpoint to query the status of the
`BOMIngestAndEnrichWorkflow` for a given BOM ID.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.workflows.temporal_client import get_workflow_status

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/boms", tags=["BOM Ingest Status"])


class IngestStatusResponse(BaseModel):
  bom_id: str
  workflow_id: str
  status: str
  temporal_status: str
  progress: dict
  errors: list


@router.get("/{bom_id}/ingest/status", response_model=IngestStatusResponse)
async def get_bom_ingest_status(bom_id: str) -> IngestStatusResponse:
  """Get status for the ingest+enrich workflow for a BOM.

  Looks up the Temporal workflow `bom-ingest-and-enrich-{bom_id}` and
  returns its state. If no workflow is found or Temporal is
  unreachable, returns a 404/503 with a useful error.
  """

  # Validate BOM ID format early to avoid noisy Temporal lookups on
  # obviously invalid identifiers.
  try:
    UUID(bom_id)
  except ValueError:
    raise HTTPException(400, detail="Invalid BOM ID format")

  workflow_id = f"bom-ingest-and-enrich-{bom_id}"
  logger.info("[BOM Ingest Status] Checking status for %s", workflow_id)

  try:
    status = await get_workflow_status(workflow_id)
  except Exception as exc:
    logger.error(
      "[BOM Ingest Status] Failed to query Temporal for %s: %s",
      workflow_id,
      exc,
      exc_info=True,
    )
    raise HTTPException(503, detail="Failed to query ingest workflow status")

  # Distinguish between workflow-not-found and other errors using the
  # error_type field returned by get_workflow_status.
  if status.get("status") == "error" and not status.get("progress"):
    errors = status.get("errors") or []
    error_type = errors[0].get("error_type") if errors else None
    if error_type == "WorkflowNotFoundError":
      raise HTTPException(404, detail="No ingest workflow found for this BOM")
    raise HTTPException(503, detail="Workflow service unavailable")

  return IngestStatusResponse(
    bom_id=bom_id,
    workflow_id=status.get("workflow_id", workflow_id),
    status=status.get("status", "unknown"),
    temporal_status=status.get("temporal_status", "UNKNOWN"),
    progress=status.get("progress", {}),
    errors=status.get("errors", []),
  )
