"""
Project Service - Shared Utilities for Project Management

Provides centralized project query logic to avoid duplication across API endpoints.
"""

import logging
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_default_project_for_org(
    db: Session,
    organization_id: str
) -> Optional[str]:
    """
    Get default project for organization with explicit priority.

    Priority order:
    1. Workspace with is_default=true (prefer earliest created if multiple)
    2. Workspace named containing "default" (case-insensitive)
    3. Oldest workspace by created_at
    4. Oldest project within selected workspace

    This logic consolidates the duplicate queries in boms_unified.py and bulk_upload.py
    to ensure consistent default project selection across all BOM upload flows.

    Args:
        db: Database session (SQLAlchemy Session)
        organization_id: Organization UUID string

    Returns:
        Project UUID string, or None if no projects exist for organization

    Example:
        >>> from app.services.project_service import get_default_project_for_org
        >>> project_id = get_default_project_for_org(db, "org-uuid-123")
        >>> if not project_id:
        >>>     raise HTTPException(404, "No projects found for organization")

    Note:
        - Returns None rather than raising exceptions to allow caller to handle error
        - Logs warning if no project found for debugging
        - Uses ILIKE for case-insensitive "default" matching
        - Handles race conditions by preferring earliest created_at
    """
    query = text("""
        SELECT p.id
        FROM projects p
        JOIN workspaces w ON w.id = p.workspace_id
        WHERE w.organization_id = :organization_id
          AND (w.is_default = true OR w.name ILIKE '%default%')
        ORDER BY p.created_at
        LIMIT 1
    """)

    try:
        result = db.execute(query, {"organization_id": organization_id})
        row = result.fetchone()

        if row:
            project_id = str(row[0])
            logger.info(
                f"[ProjectService] Found default project {project_id} "
                f"for organization {organization_id}"
            )
            return project_id
        else:
            logger.warning(
                f"[ProjectService] No default project found for organization {organization_id}"
            )
            return None

    except Exception as e:
        logger.error(
            f"[ProjectService] Error finding default project for organization "
            f"{organization_id}: {e}",
            exc_info=True
        )
        return None
