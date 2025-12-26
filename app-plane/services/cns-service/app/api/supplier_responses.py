"""
Admin Supplier Responses API

Provides access to raw supplier API response data for debugging.

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    Requires ADMIN role.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.utils.supplier_response_store import get_supplier_response_store

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/supplier-responses", tags=["Admin Supplier Responses"])


@router.get("")
@require_role(Role.ADMIN)
async def list_supplier_responses(
    job_id: Optional[str] = Query(default=None),
    line_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    auth: AuthContext = Depends(get_auth_context),
):
    """List supplier API responses for debugging. Requires ADMIN role."""
    logger.info(f"[Admin] list_supplier_responses: user={auth.user_id} job_id={job_id}")
    store = get_supplier_response_store()
    responses = store.list_responses(job_id=job_id, line_id=line_id, limit=limit)
    return {"data": responses}
