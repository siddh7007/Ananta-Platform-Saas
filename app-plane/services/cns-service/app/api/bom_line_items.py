"""
BOM Line Items API - CRUD Operations

Provides endpoints for managing BOM line items:
- List line items for a BOM
- Get single line item
- Update line item (edit MPN, quantity, etc.)
- Delete line item
- Bulk update line items

Authorization:
    All endpoints enforce tenant isolation via app-layer RLS.
    Users can only access BOMs belonging to their organization.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
import time
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status, Path
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.dual_database import get_dual_database, DatabaseType
from app.core.input_validation import (
    ValidatedMPN,
    ValidatedComponent,
    ValidatedSupplier,
    InputSanitizer
)
from app.services.component_catalog import get_component_catalog
# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    get_optional_auth_context,
    AuthContextError,
)
from app.config import PLATFORM_SUPER_ADMIN_ORG

# CNS Projects Alignment - Scope Validation Decorators
from app.core.scope_decorators import require_bom
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/boms", tags=["BOM Line Items"])


# Pydantic Models
class ComponentData(BaseModel):
    """Enriched component data from Component Vault"""
    id: Optional[str] = None
    manufacturer_part_number: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    datasheet_url: Optional[str] = None
    image_url: Optional[str] = None
    lifecycle_status: Optional[str] = None
    risk_level: Optional[str] = None
    rohs_compliant: Optional[bool] = None
    reach_compliant: Optional[bool] = None
    aec_qualified: Optional[bool] = None
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    moq: Optional[int] = None
    lead_time_days: Optional[int] = None
    stock_status: Optional[str] = None
    quality_score: Optional[float] = None
    enrichment_source: Optional[str] = None


class BOMLineItemResponse(BaseModel):
    """BOM line item response"""
    id: Union[str, UUID]
    bom_id: Union[str, UUID]
    line_number: Optional[int] = None  # Can be NULL in database
    manufacturer_part_number: Optional[str] = None
    manufacturer: Optional[str] = None
    quantity: int = 1
    reference_designator: Optional[str] = None
    description: Optional[str] = None
    enrichment_status: str = "pending"
    component_id: Optional[Union[str, UUID]] = None
    enrichment_error: Optional[str] = None
    # Enrichment result fields - stored directly in bom_line_items
    lifecycle_status: Optional[str] = None
    match_confidence: Optional[float] = None
    component_storage: Optional[str] = None  # 'catalog' or 'redis' or None
    redis_component_key: Optional[str] = None
    # Additional enrichment fields from bom_line_items table
    category: Optional[str] = None
    subcategory: Optional[str] = None
    datasheet_url: Optional[str] = None
    unit_price: Optional[float] = None
    risk_level: Optional[str] = None
    compliance_status: Optional[Dict[str, Any]] = None  # JSONB field
    specifications: Optional[Dict[str, Any]] = None  # JSONB field
    pricing: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None  # JSONB - can be array or object
    metadata: Optional[Dict[str, Any]] = None  # JSONB field
    enriched_at: Optional[Union[str, datetime]] = None
    # Component data from Component Vault (enriched metadata) - fallback/additional data
    component_data: Optional[ComponentData] = None
    created_at: Union[str, datetime]
    updated_at: Union[str, datetime]

    @field_validator('id', 'bom_id', 'component_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID objects to strings"""
        if isinstance(v, UUID):
            return str(v)
        return v

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def convert_datetime_to_str(cls, v):
        """Convert datetime objects to ISO format strings"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class BOMLineItemUpdate(BaseModel):
    """Update BOM line item"""
    manufacturer_part_number: Optional[ValidatedMPN] = Field(None, description="MPN with injection prevention")
    manufacturer: Optional[ValidatedSupplier] = Field(None, description="Manufacturer name with XSS prevention")
    quantity: Optional[int] = Field(None, ge=1, description="Quantity must be >= 1")
    reference_designator: Optional[str] = None
    description: Optional[str] = None

    @field_validator('reference_designator', 'description', mode='before')
    @classmethod
    def sanitize_optional_fields(cls, v):
        """Sanitize optional string fields to prevent XSS"""
        if v is None:
            return v
        return InputSanitizer.sanitize_string(v)


class BOMLineItemBulkUpdate(BaseModel):
    """Bulk update multiple line items"""
    updates: List[Dict[str, Any]] = Field(
        ...,
        description="List of {id, field, value} updates"
    )


class BOMLineItemListResponse(BaseModel):
    """Paginated list of line items"""
    items: List[BOMLineItemResponse]
    total: int
    page: int
    page_size: int
    bom_id: Union[str, UUID]

    @field_validator('bom_id', mode='before')
    @classmethod
    def convert_bom_id_to_str(cls, v):
        """Convert UUID to string if needed"""
        if isinstance(v, UUID):
            return str(v)
        return v


@router.get("/{bom_id}/line_items", response_model=BOMLineItemListResponse)
@require_bom(enforce=True, log_access=True)  # Phase 2: Automatic scope validation
async def list_bom_line_items(
    bom_id: str,  # Path parameter
    request: Request,  # Required for decorator
    page: int = 1,
    page_size: int = 100,
    enrichment_status: Optional[str] = None,
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
):
    """
    List all line items for a BOM with automatic scope validation.

    **Phase 2: CNS Projects Alignment**

    Supports pagination and filtering by enrichment status.

    Authorization:
        - Automatic validation: bom → project → workspace → organization
        - Users can only access BOMs in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives organization_id from validated BOM FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    try:
        # Extract validated scope from request state (set by @require_bom decorator)
        scope = request.state.validated_scope
        # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "...", "bom_id": "..."}

        organization_id = scope["tenant_id"]  # Server-derived from validated FK chain
        # bom_id already validated by decorator

        logger.info(
            f"[BOM Line Items] Listing line items for BOM {bom_id} "
            f"(org={organization_id}, user={user.id}, page={page})"
        )

        # Build query - include ALL enrichment fields from bom_line_items table
        query = text("""
            SELECT
                id,
                bom_id,
                line_number,
                manufacturer_part_number,
                manufacturer,
                quantity,
                reference_designator,
                description,
                enrichment_status,
                component_id,
                enrichment_error,
                lifecycle_status,
                match_confidence,
                component_storage,
                redis_component_key,
                category,
                subcategory,
                datasheet_url,
                unit_price,
                risk_level,
                compliance_status,
                specifications,
                pricing,
                metadata,
                enriched_at,
                created_at,
                updated_at
            FROM bom_line_items
            WHERE bom_id = :bom_id
            """ + (
            " AND enrichment_status = :enrichment_status" if enrichment_status else ""
        ) + """
            ORDER BY line_number
            LIMIT :limit OFFSET :offset
        """)

        # Count query
        count_query = text("""
            SELECT COUNT(*)
            FROM bom_line_items
            WHERE bom_id = :bom_id
            """ + (
            " AND enrichment_status = :enrichment_status" if enrichment_status else ""
        ))

        # Execute queries
        params = {
            'bom_id': bom_id,
            'limit': page_size,
            'offset': (page - 1) * page_size
        }

        if enrichment_status:
            params['enrichment_status'] = enrichment_status

        result = db.execute(query, params)
        rows = result.fetchall()

        # Collect component lookups for items with MPN + manufacturer
        # Build list of (mpn, manufacturer) for bulk lookup
        component_lookups = []
        row_data_list = []
        for row in rows:
            row_data_list.append(row)
            if row.manufacturer_part_number and row.manufacturer:
                component_lookups.append({
                    'mpn': row.manufacturer_part_number,
                    'manufacturer': row.manufacturer
                })

        # Bulk lookup component data from Component Vault
        component_data_map = {}
        if component_lookups:
            try:
                catalog_service = get_component_catalog()
                component_data_map = catalog_service.bulk_lookup_components(component_lookups)
                logger.info(
                    f"[BOM Line Items] Fetched {len([v for v in component_data_map.values() if v])} "
                    f"component records from Component Vault for {len(component_lookups)} items"
                )
            except Exception as catalog_error:
                logger.warning(
                    f"[BOM Line Items] Failed to fetch component data from vault: {catalog_error}"
                )

        # Build response items with component data
        items = []
        for row in row_data_list:
            # Look up component data by (mpn, manufacturer) tuple
            component_data = None
            if row.manufacturer_part_number and row.manufacturer:
                catalog_data = component_data_map.get(
                    (row.manufacturer_part_number, row.manufacturer)
                )
                if catalog_data:
                    component_data = ComponentData(
                        id=str(catalog_data.get('id')) if catalog_data.get('id') else None,
                        manufacturer_part_number=catalog_data.get('manufacturer_part_number'),
                        manufacturer=catalog_data.get('manufacturer'),
                        category=catalog_data.get('category'),
                        subcategory=catalog_data.get('subcategory'),
                        description=catalog_data.get('description'),
                        datasheet_url=catalog_data.get('datasheet_url'),
                        image_url=catalog_data.get('image_url'),
                        lifecycle_status=catalog_data.get('lifecycle_status'),
                        risk_level=catalog_data.get('risk_level'),
                        rohs_compliant=catalog_data.get('rohs_compliant'),
                        reach_compliant=catalog_data.get('reach_compliant'),
                        aec_qualified=catalog_data.get('aec_qualified'),
                        unit_price=float(catalog_data.get('unit_price')) if catalog_data.get('unit_price') else None,
                        currency=catalog_data.get('currency'),
                        moq=catalog_data.get('moq'),
                        lead_time_days=catalog_data.get('lead_time_days'),
                        stock_status=catalog_data.get('stock_status'),
                        quality_score=float(catalog_data.get('quality_score')) if catalog_data.get('quality_score') else None,
                        enrichment_source=catalog_data.get('enrichment_source'),
                    )

            # Build response - include fields from bom_line_items, fall back to component_data
            items.append(BOMLineItemResponse(
                id=row.id,
                bom_id=row.bom_id,
                line_number=row.line_number,
                manufacturer_part_number=row.manufacturer_part_number,
                manufacturer=row.manufacturer,
                quantity=row.quantity or 1,
                reference_designator=row.reference_designator,
                description=row.description,
                enrichment_status=row.enrichment_status or 'pending',
                component_id=row.component_id,
                enrichment_error=row.enrichment_error,
                lifecycle_status=row.lifecycle_status,
                match_confidence=float(row.match_confidence) if row.match_confidence else None,
                component_storage=row.component_storage,
                redis_component_key=row.redis_component_key,
                # Enrichment fields from bom_line_items table
                category=row.category,
                subcategory=row.subcategory,
                datasheet_url=row.datasheet_url,
                unit_price=float(row.unit_price) if row.unit_price else None,
                risk_level=row.risk_level,
                compliance_status=row.compliance_status,
                specifications=row.specifications,
                pricing=row.pricing,
                metadata=row.metadata,
                enriched_at=row.enriched_at.isoformat() if row.enriched_at else None,
                # Component Vault data (fallback/additional enrichment)
                component_data=component_data,
                created_at=row.created_at.isoformat(),
                updated_at=row.updated_at.isoformat()
            ))

        # Get total count
        count_result = db.execute(count_query, {k: v for k, v in params.items() if k != 'limit' and k != 'offset'})
        total = count_result.fetchone()[0]

        return BOMLineItemListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            bom_id=bom_id
        )

    except Exception as e:
        logger.error(
            f"Error listing line items for BOM {bom_id}: {e}",
            extra={
                'bom_id': bom_id,
                'page': page,
                'page_size': page_size,
                'error_type': type(e).__name__
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list line items: {str(e)}"
        )
    finally:
        # CRITICAL: Always close database session to prevent pool exhaustion
        if db is not None:
            try:
                db.close()
            except Exception as close_error:
                logger.warning(
                    f"Error closing database session: {close_error}",
                    exc_info=True
                )


@router.get("/{bom_id}/line_items/{item_id}", response_model=BOMLineItemResponse)
@require_bom(enforce=True, log_access=True)  # Phase 2: Automatic scope validation
async def get_bom_line_item(
    bom_id: str,  # Path parameter
    item_id: str,  # Path parameter
    request: Request,  # Required for decorator
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
):
    """
    Get a single line item by ID with automatic scope validation.

    **Phase 2: CNS Projects Alignment**

    Authorization:
        - Automatic validation: bom → project → workspace → organization
        - Users can only access line items from BOMs in their organization
        - Staff users can bypass scope validation
    """
    try:
        # Extract validated scope from request state (set by @require_bom decorator)
        scope = request.state.validated_scope
        organization_id = scope["tenant_id"]  # Server-derived

        logger.info(
            f"[BOM Line Items] Getting line item {item_id} from BOM {bom_id} "
            f"(org={organization_id}, user={user.id})"
        )

        query = text("""
            SELECT
                id, bom_id, line_number,
                manufacturer_part_number, manufacturer, quantity,
                reference_designator, description,
                enrichment_status, component_id, enrichment_error,
                lifecycle_status, match_confidence, component_storage, redis_component_key,
                created_at, updated_at
            FROM bom_line_items
            WHERE id = :item_id AND bom_id = :bom_id
        """)

        result = db.execute(query, {'item_id': item_id, 'bom_id': bom_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Line item not found: {item_id}"
            )

        return BOMLineItemResponse(
            id=row.id,
            bom_id=row.bom_id,
            line_number=row.line_number,
            manufacturer_part_number=row.manufacturer_part_number,
            manufacturer=row.manufacturer,
            quantity=row.quantity or 1,
            reference_designator=row.reference_designator,
            description=row.description,
            enrichment_status=row.enrichment_status or 'pending',
            component_id=row.component_id,
            enrichment_error=row.enrichment_error,
            lifecycle_status=row.lifecycle_status,
            match_confidence=float(row.match_confidence) if row.match_confidence else None,
            component_storage=row.component_storage,
            redis_component_key=row.redis_component_key,
            created_at=row.created_at.isoformat(),
            updated_at=row.updated_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting line item: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get line item: {str(e)}"
        )


@router.patch("/{bom_id}/line_items/{item_id}", response_model=BOMLineItemResponse)
async def update_bom_line_item(
    update_data: BOMLineItemUpdate,
    bom_id: str = Path(..., description="BOM ID"),
    item_id: str = Path(..., description="Line item ID")
):
    """
    Update a BOM line item

    Allows editing:
    - MPN (manufacturer_part_number)
    - Manufacturer
    - Quantity
    - Reference designator
    - Description

    If MPN or manufacturer changes, enrichment_status is reset to 'pending'.
    """
    try:
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Check if item exists
        check_query = text("""
            SELECT id, manufacturer_part_number, manufacturer
            FROM bom_line_items
            WHERE id = :item_id AND bom_id = :bom_id
        """)

        check_result = db.execute(check_query, {'item_id': item_id, 'bom_id': bom_id})
        existing = check_result.fetchone()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Line item not found: {item_id}"
            )

        # Build dynamic update query
        update_fields = []
        params = {'item_id': item_id, 'bom_id': bom_id}

        # Check if MPN or manufacturer changed (need to reset enrichment)
        reset_enrichment = False

        if update_data.manufacturer_part_number is not None:
            update_fields.append("manufacturer_part_number = :mpn")
            # Convert ValidatedMPN to string for database storage
            params['mpn'] = str(update_data.manufacturer_part_number)
            if str(update_data.manufacturer_part_number) != existing.manufacturer_part_number:
                reset_enrichment = True

        if update_data.manufacturer is not None:
            update_fields.append("manufacturer = :manufacturer")
            # Convert ValidatedSupplier to string for database storage
            params['manufacturer'] = str(update_data.manufacturer)
            if str(update_data.manufacturer) != existing.manufacturer:
                reset_enrichment = True

        if update_data.quantity is not None:
            update_fields.append("quantity = :quantity")
            params['quantity'] = update_data.quantity

        if update_data.reference_designator is not None:
            update_fields.append("reference_designator = :reference")
            params['reference'] = update_data.reference_designator

        if update_data.description is not None:
            update_fields.append("description = :description")
            params['description'] = update_data.description

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Reset enrichment if MPN/manufacturer changed
        if reset_enrichment:
            update_fields.append("enrichment_status = 'pending'")
            update_fields.append("component_id = NULL")
            update_fields.append("enrichment_error = NULL")

        update_fields.append("updated_at = NOW()")

        # Execute update
        update_query = text(f"""
            UPDATE bom_line_items
            SET {', '.join(update_fields)}
            WHERE id = :item_id AND bom_id = :bom_id
        """)

        db.execute(update_query, params)
        db.commit()

        logger.info(
            f"✅ Updated line item: {item_id}",
            extra={'bom_id': bom_id, 'reset_enrichment': reset_enrichment}
        )

        # Return updated item
        return await get_bom_line_item(bom_id, item_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating line item: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update line item: {str(e)}"
        )


@router.delete("/{bom_id}/line_items/{item_id}")
async def delete_bom_line_item(
    bom_id: str = Path(..., description="BOM ID"),
    item_id: str = Path(..., description="Line item ID")
):
    """
    Delete a BOM line item

    Updates the BOM's component_count after deletion.
    """
    try:
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Delete line item
        delete_query = text("""
            DELETE FROM bom_line_items
            WHERE id = :item_id AND bom_id = :bom_id
        """)

        result = db.execute(delete_query, {'item_id': item_id, 'bom_id': bom_id})

        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Line item not found: {item_id}"
            )

        # Update BOM component count
        update_bom_query = text("""
            UPDATE boms
            SET
                component_count = (
                    SELECT COUNT(*) FROM bom_line_items WHERE bom_id = :bom_id
                ),
                updated_at = NOW()
            WHERE id = :bom_id
        """)

        db.execute(update_bom_query, {'bom_id': bom_id})
        db.commit()

        logger.info(f"✅ Deleted line item: {item_id}", extra={'bom_id': bom_id})

        return {"message": "Line item deleted successfully", "id": item_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting line item: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete line item: {str(e)}"
        )


class BulkResetResponse(BaseModel):
    """Response for bulk reset operation"""
    bom_id: str
    items_reset: int
    message: str


@router.post("/{bom_id}/line_items/bulk-reset-failed", response_model=BulkResetResponse)
async def bulk_reset_failed_line_items(
    bom_id: str = Path(..., description="BOM ID")
):
    """
    Bulk reset all failed line items to pending status

    This endpoint resets all line items with enrichment_status='failed' back to 'pending',
    allowing them to be re-enriched when the workflow runs again.

    Use Cases:
    - Retry all failed components after fixing rate limiting config
    - Retry all failed components after supplier API issues resolved
    - Retry all failed components after updating component data

    What gets reset:
    - enrichment_status → 'pending'
    - component_id → NULL
    - enrichment_error → NULL

    Returns:
    - Number of items reset
    """
    try:
        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        # Reset all failed items to pending
        reset_query = text("""
            UPDATE bom_line_items
            SET
                enrichment_status = 'pending',
                component_id = NULL,
                enrichment_error = NULL,
                updated_at = NOW()
            WHERE bom_id = :bom_id
              AND enrichment_status = 'failed'
        """)

        result = db.execute(reset_query, {'bom_id': bom_id})
        items_reset = result.rowcount
        db.commit()

        logger.info(
            f"✅ Bulk reset {items_reset} failed items to pending",
            extra={'bom_id': bom_id}
        )

        return BulkResetResponse(
            bom_id=bom_id,
            items_reset=items_reset,
            message=f"Successfully reset {items_reset} failed items to pending status"
        )

    except Exception as e:
        logger.error(f"Error bulk resetting failed items: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk reset failed items: {str(e)}"
        )
