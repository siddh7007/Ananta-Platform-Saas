"""
Column Mapping Templates API

Provides organization-scoped column mapping templates for BOM uploads.
Replaces localStorage-based templates with persistent, shared templates.

Endpoints:
- GET /api/organizations/{org_id}/column-templates - List all templates
- POST /api/organizations/{org_id}/column-templates - Create new template
- PUT /api/organizations/{org_id}/column-templates/{id} - Update template
- DELETE /api/organizations/{org_id}/column-templates/{id} - Delete template
- POST /api/organizations/{org_id}/column-templates/{id}/set-default - Set as default
"""

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import text

from ..auth.dependencies import (
    User,
    OrgContext,
    get_current_user,
    get_org_context,
    get_supabase_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Column Mapping Templates"])


# ============================================================================
# Pydantic Models
# ============================================================================

class ColumnMappingTemplate(BaseModel):
    """Column mapping template response model."""
    id: str
    name: str
    description: Optional[str] = None
    mappings: Dict[str, str]
    isDefault: bool
    createdAt: str
    updatedAt: str

    class Config:
        # Allow field alias for camelCase response
        populate_by_name = True


class CreateTemplateRequest(BaseModel):
    """Create column mapping template request."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    mappings: Dict[str, str] = Field(..., min_items=1)
    isDefault: bool = Field(default=False)

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

    @validator('mappings')
    def validate_mappings(cls, v):
        if not v:
            raise ValueError('Mappings cannot be empty')
        # Ensure all values are strings
        for key, value in v.items():
            if not isinstance(value, str):
                raise ValueError(f'Mapping value for "{key}" must be a string')
        return v


class UpdateTemplateRequest(BaseModel):
    """Update column mapping template request."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    mappings: Optional[Dict[str, str]] = None
    isDefault: Optional[bool] = None

    @validator('name')
    def validate_name(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip() if v else v

    @validator('mappings')
    def validate_mappings(cls, v):
        if v is not None:
            if not v:
                raise ValueError('Mappings cannot be empty')
            # Ensure all values are strings
            for key, value in v.items():
                if not isinstance(value, str):
                    raise ValueError(f'Mapping value for "{key}" must be a string')
        return v


class TemplateListResponse(BaseModel):
    """List of templates with default indicator."""
    templates: List[ColumnMappingTemplate]
    defaultTemplateId: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def row_to_template(row: Any) -> ColumnMappingTemplate:
    """Convert database row to template model."""
    return ColumnMappingTemplate(
        id=str(row.id),
        name=row.name,
        description=row.description,
        mappings=row.mappings,
        isDefault=row.is_default,
        createdAt=row.created_at.isoformat() if row.created_at else datetime.utcnow().isoformat(),
        updatedAt=row.updated_at.isoformat() if row.updated_at else datetime.utcnow().isoformat(),
    )


# ============================================================================
# API Endpoints
# ============================================================================

@router.get(
    "/{org_id}/column-templates",
    response_model=TemplateListResponse,
    summary="List column mapping templates",
    description="Get all column mapping templates for an organization"
)
async def list_templates(
    org_id: str,
    context: OrgContext = Depends(get_org_context)
):
    """
    List all column mapping templates for the organization.

    Returns all templates with the default template ID indicated.
    """
    # Verify org_id matches context
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    with get_supabase_session() as session:
        # Fetch all templates for the organization
        result = session.execute(
            text("""
                SELECT id, name, description, mappings, is_default, created_at, updated_at
                FROM column_mapping_templates
                WHERE organization_id = :org_id
                ORDER BY is_default DESC, name ASC
            """),
            {"org_id": org_id}
        )
        rows = result.fetchall()

        templates = [row_to_template(row) for row in rows]
        default_template_id = next(
            (t.id for t in templates if t.isDefault),
            None
        )

        logger.info(
            f"Listed {len(templates)} column mapping templates for org {org_id}",
            extra={
                "organization_id": org_id,
                "template_count": len(templates),
                "default_id": default_template_id,
            }
        )

        return TemplateListResponse(
            templates=templates,
            defaultTemplateId=default_template_id
        )


@router.post(
    "/{org_id}/column-templates",
    response_model=ColumnMappingTemplate,
    status_code=status.HTTP_201_CREATED,
    summary="Create column mapping template",
    description="Create a new column mapping template for the organization"
)
async def create_template(
    org_id: str,
    request: CreateTemplateRequest,
    context: OrgContext = Depends(get_org_context)
):
    """
    Create a new column mapping template.

    Requires engineer role or higher.
    If isDefault=true, automatically unsets any existing default.
    """
    # Verify org_id matches context
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    # Require engineer role or higher
    if not context.is_engineer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires engineer role or higher to create templates"
        )

    with get_supabase_session() as session:
        # Check for duplicate name
        existing = session.execute(
            text("""
                SELECT id FROM column_mapping_templates
                WHERE organization_id = :org_id AND name = :name
            """),
            {"org_id": org_id, "name": request.name}
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template with name '{request.name}' already exists"
            )

        # Insert new template
        result = session.execute(
            text("""
                INSERT INTO column_mapping_templates
                (organization_id, name, description, mappings, is_default, created_by)
                VALUES (:org_id, :name, :description, :mappings::jsonb, :is_default, :created_by)
                RETURNING id, name, description, mappings, is_default, created_at, updated_at
            """),
            {
                "org_id": org_id,
                "name": request.name,
                "description": request.description,
                "mappings": str(request.mappings).replace("'", '"'),  # Convert to JSON string
                "is_default": request.isDefault,
                "created_by": context.user.id,
            }
        )
        row = result.fetchone()
        session.commit()

        template = row_to_template(row)

        logger.info(
            f"Created column mapping template '{request.name}' for org {org_id}",
            extra={
                "organization_id": org_id,
                "template_id": template.id,
                "template_name": request.name,
                "is_default": request.isDefault,
                "user_id": context.user.id,
            }
        )

        return template


@router.put(
    "/{org_id}/column-templates/{template_id}",
    response_model=ColumnMappingTemplate,
    summary="Update column mapping template",
    description="Update an existing column mapping template"
)
async def update_template(
    org_id: str,
    template_id: str,
    request: UpdateTemplateRequest,
    context: OrgContext = Depends(get_org_context)
):
    """
    Update a column mapping template.

    Requires engineer role or higher.
    Can update name, description, mappings, and default status.
    """
    # Verify org_id matches context
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    # Require engineer role or higher
    if not context.is_engineer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires engineer role or higher to update templates"
        )

    with get_supabase_session() as session:
        # Check template exists and belongs to org
        existing = session.execute(
            text("""
                SELECT id FROM column_mapping_templates
                WHERE id = :template_id AND organization_id = :org_id
            """),
            {"template_id": template_id, "org_id": org_id}
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        # Check for duplicate name if updating name
        if request.name:
            duplicate = session.execute(
                text("""
                    SELECT id FROM column_mapping_templates
                    WHERE organization_id = :org_id AND name = :name AND id != :template_id
                """),
                {"org_id": org_id, "name": request.name, "template_id": template_id}
            ).fetchone()

            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Template with name '{request.name}' already exists"
                )

        # Build update query dynamically
        updates = []
        params = {"template_id": template_id, "org_id": org_id}

        if request.name is not None:
            updates.append("name = :name")
            params["name"] = request.name

        if request.description is not None:
            updates.append("description = :description")
            params["description"] = request.description

        if request.mappings is not None:
            updates.append("mappings = :mappings::jsonb")
            params["mappings"] = str(request.mappings).replace("'", '"')

        if request.isDefault is not None:
            updates.append("is_default = :is_default")
            params["is_default"] = request.isDefault

        if not updates:
            # No updates provided, just return current state
            result = session.execute(
                text("""
                    SELECT id, name, description, mappings, is_default, created_at, updated_at
                    FROM column_mapping_templates
                    WHERE id = :template_id AND organization_id = :org_id
                """),
                {"template_id": template_id, "org_id": org_id}
            )
            row = result.fetchone()
            return row_to_template(row)

        # Execute update
        result = session.execute(
            text(f"""
                UPDATE column_mapping_templates
                SET {', '.join(updates)}
                WHERE id = :template_id AND organization_id = :org_id
                RETURNING id, name, description, mappings, is_default, created_at, updated_at
            """),
            params
        )
        row = result.fetchone()
        session.commit()

        template = row_to_template(row)

        logger.info(
            f"Updated column mapping template {template_id} for org {org_id}",
            extra={
                "organization_id": org_id,
                "template_id": template_id,
                "updates": list(params.keys()),
                "user_id": context.user.id,
            }
        )

        return template


@router.delete(
    "/{org_id}/column-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete column mapping template",
    description="Delete a column mapping template"
)
async def delete_template(
    org_id: str,
    template_id: str,
    context: OrgContext = Depends(get_org_context)
):
    """
    Delete a column mapping template.

    Requires engineer role or higher.
    """
    # Verify org_id matches context
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    # Require engineer role or higher
    if not context.is_engineer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires engineer role or higher to delete templates"
        )

    with get_supabase_session() as session:
        # Check template exists and belongs to org
        existing = session.execute(
            text("""
                SELECT id, is_default FROM column_mapping_templates
                WHERE id = :template_id AND organization_id = :org_id
            """),
            {"template_id": template_id, "org_id": org_id}
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        # Delete the template
        session.execute(
            text("""
                DELETE FROM column_mapping_templates
                WHERE id = :template_id AND organization_id = :org_id
            """),
            {"template_id": template_id, "org_id": org_id}
        )
        session.commit()

        logger.info(
            f"Deleted column mapping template {template_id} for org {org_id}",
            extra={
                "organization_id": org_id,
                "template_id": template_id,
                "was_default": existing.is_default,
                "user_id": context.user.id,
            }
        )


@router.post(
    "/{org_id}/column-templates/{template_id}/set-default",
    response_model=ColumnMappingTemplate,
    summary="Set default template",
    description="Set a template as the organization's default"
)
async def set_default_template(
    org_id: str,
    template_id: str,
    context: OrgContext = Depends(get_org_context)
):
    """
    Set a template as the organization's default.

    Requires engineer role or higher.
    Automatically unsets any existing default.
    """
    # Verify org_id matches context
    if context.organization.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    # Require engineer role or higher
    if not context.is_engineer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires engineer role or higher to set default template"
        )

    with get_supabase_session() as session:
        # Check template exists and belongs to org
        existing = session.execute(
            text("""
                SELECT id FROM column_mapping_templates
                WHERE id = :template_id AND organization_id = :org_id
            """),
            {"template_id": template_id, "org_id": org_id}
        ).fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        # Set as default (trigger will unset others)
        result = session.execute(
            text("""
                UPDATE column_mapping_templates
                SET is_default = TRUE
                WHERE id = :template_id AND organization_id = :org_id
                RETURNING id, name, description, mappings, is_default, created_at, updated_at
            """),
            {"template_id": template_id, "org_id": org_id}
        )
        row = result.fetchone()
        session.commit()

        template = row_to_template(row)

        logger.info(
            f"Set column mapping template {template_id} as default for org {org_id}",
            extra={
                "organization_id": org_id,
                "template_id": template_id,
                "user_id": context.user.id,
            }
        )

        return template
