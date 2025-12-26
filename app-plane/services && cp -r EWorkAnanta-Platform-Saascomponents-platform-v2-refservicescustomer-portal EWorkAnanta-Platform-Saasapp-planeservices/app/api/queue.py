"""
Enrichment Queue API Endpoints

Manages components in staging (quality 70-94%) awaiting manual review.
"""

import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.repositories.enrichment_repository import EnrichmentRepository
from app.repositories.catalog_repository import CatalogRepository

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Models
class QueueItem(BaseModel):
    """Enrichment queue item"""
    id: int
    mpn: str
    enrichment_data: dict
    ai_suggestions: list
    quality_score: float
    issues: list
    enrichment_source: str
    customer_id: Optional[int]
    bom_job_id: Optional[str]
    status: str
    reviewed_by: Optional[int]
    reviewed_at: Optional[str]
    review_notes: Optional[str]
    created_at: str
    updated_at: str


class QueueListResponse(BaseModel):
    """Queue list response"""
    total: int
    items: List[QueueItem]
    filters: dict


class ApproveRequest(BaseModel):
    """Approve queue item request"""
    reviewed_by: int = Field(..., description="User ID of reviewer")
    review_notes: Optional[str] = Field(None, description="Optional review notes")


class RejectRequest(BaseModel):
    """Reject queue item request"""
    reviewed_by: int = Field(..., description="User ID of reviewer")
    rejection_reason: str = Field(..., description="Reason for rejection")
    review_notes: Optional[str] = Field(None, description="Optional review notes")


class QueueStats(BaseModel):
    """Queue statistics"""
    total_pending: int
    total_under_review: int
    total_approved: int
    total_rejected: int
    average_quality: float
    by_source: dict


@router.get("/pending", response_model=QueueListResponse)
def get_pending_reviews(
    min_quality: float = Query(70.0, description="Minimum quality score", ge=0, le=100),
    max_quality: float = Query(94.9, description="Maximum quality score", ge=0, le=100),
    status: str = Query("needs_review", description="Filter by status"),
    enrichment_source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    offset: int = Query(0, description="Pagination offset", ge=0),
    db: Session = Depends(get_db)
):
    """
    Get pending review queue items

    Returns components in staging queue (quality 70-94%) awaiting manual review.

    Args:
        min_quality: Minimum quality score (default 70)
        max_quality: Maximum quality score (default 94.9)
        status: Filter by status (needs_review, under_review, approved, rejected)
        enrichment_source: Filter by source (customer_bom, staff_expansion)
        limit: Maximum results (default 50)
        offset: Pagination offset

    Returns:
        List of queue items

    Example:
        ```bash
        # Get all pending reviews
        curl "http://localhost:8003/api/queue/pending"

        # Get high-quality staging items (80-94%)
        curl "http://localhost:8003/api/queue/pending?min_quality=80"

        # Get customer BOM items only
        curl "http://localhost:8003/api/queue/pending?enrichment_source=customer_bom"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)

    # Build filters
    filters = {
        'min_quality': min_quality,
        'max_quality': max_quality,
        'status': status
    }
    if enrichment_source:
        filters['enrichment_source'] = enrichment_source

    # Get queue items
    items = enrichment_repo.get_pending_reviews(
        limit=limit,
        min_quality=min_quality,
        max_quality=max_quality,
        status=status,
        enrichment_source=enrichment_source,
        offset=offset
    )

    # Convert to response models
    results = [
        QueueItem(
            id=item.id,
            mpn=item.mpn,
            enrichment_data=item.enrichment_data or {},
            ai_suggestions=item.ai_suggestions or [],
            quality_score=float(item.quality_score),
            issues=item.issues or [],
            enrichment_source=item.enrichment_source,
            customer_id=item.customer_id,
            bom_job_id=item.bom_job_id,
            status=item.status,
            reviewed_by=item.reviewed_by,
            reviewed_at=item.reviewed_at.isoformat() if item.reviewed_at else None,
            review_notes=item.review_notes,
            created_at=item.created_at.isoformat(),
            updated_at=item.updated_at.isoformat()
        )
        for item in items
    ]

    return QueueListResponse(
        total=len(results),
        items=results,
        filters=filters
    )


@router.get("/{item_id}", response_model=QueueItem)
def get_queue_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    """
    Get queue item by ID

    Args:
        item_id: Queue item ID

    Returns:
        Queue item details

    Example:
        ```bash
        curl "http://localhost:8003/api/queue/123"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)
    item = enrichment_repo.get_queue_item(item_id)

    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    return QueueItem(
        id=item.id,
        mpn=item.mpn,
        enrichment_data=item.enrichment_data or {},
        ai_suggestions=item.ai_suggestions or [],
        quality_score=float(item.quality_score),
        issues=item.issues or [],
        enrichment_source=item.enrichment_source,
        customer_id=item.customer_id,
        bom_job_id=item.bom_job_id,
        status=item.status,
        reviewed_by=item.reviewed_by,
        reviewed_at=item.reviewed_at.isoformat() if item.reviewed_at else None,
        review_notes=item.review_notes,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat()
    )


@router.post("/{item_id}/approve")
def approve_queue_item(
    item_id: int,
    request: ApproveRequest,
    db: Session = Depends(get_db)
):
    """
    Approve queue item and move to production catalog

    Args:
        item_id: Queue item ID
        request: Approval request with reviewer info

    Returns:
        Success message with catalog component ID

    Example:
        ```bash
        curl -X POST "http://localhost:8003/api/queue/123/approve" \\
          -H "Content-Type: application/json" \\
          -d '{"reviewed_by": 1, "review_notes": "Looks good"}'
        ```
    """
    enrichment_repo = EnrichmentRepository(db)
    catalog_repo = CatalogRepository(db)

    # Get queue item
    item = enrichment_repo.get_queue_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    # Check if already approved
    if item.status == 'approved':
        raise HTTPException(status_code=400, detail="Item already approved")

    try:
        # Create catalog component
        enrichment_data = item.enrichment_data or {}
        catalog_component = catalog_repo.create(
            mpn=item.mpn,
            manufacturer_id=enrichment_data.get('manufacturer_id'),
            category_id=enrichment_data.get('category_id'),
            description=enrichment_data.get('description'),
            datasheet_url=enrichment_data.get('datasheet_url'),
            image_url=enrichment_data.get('image_url'),
            lifecycle=enrichment_data.get('lifecycle_status'),
            rohs=enrichment_data.get('rohs_status'),
            reach=enrichment_data.get('reach_status'),
            specifications=enrichment_data.get('extracted_specs', {}),
            pricing=enrichment_data.get('pricing', []),
            quality_score=float(item.quality_score),
            enrichment_source=item.enrichment_source,
            created_by=request.reviewed_by
        )

        # Mark queue item as approved
        enrichment_repo.approve_queue_item(
            item_id,
            reviewed_by=request.reviewed_by,
            review_notes=request.review_notes
        )

        # Log to history
        enrichment_repo.create_history(
            mpn=item.mpn,
            enrichment_data=enrichment_data,
            quality_score=float(item.quality_score),
            status='approved',
            enrichment_source=item.enrichment_source,
            customer_id=item.customer_id,
            bom_job_id=item.bom_job_id,
            created_by=request.reviewed_by
        )

        logger.info(f"✅ Queue item approved: {item_id} → Catalog ID {catalog_component.id}")

        return {
            "message": "Queue item approved successfully",
            "catalog_id": catalog_component.id,
            "mpn": item.mpn,
            "reviewed_by": request.reviewed_by
        }

    except Exception as e:
        logger.error(f"❌ Error approving queue item {item_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error approving item: {str(e)}")


@router.post("/{item_id}/reject")
def reject_queue_item(
    item_id: int,
    request: RejectRequest,
    db: Session = Depends(get_db)
):
    """
    Reject queue item

    Args:
        item_id: Queue item ID
        request: Rejection request with reason

    Returns:
        Success message

    Example:
        ```bash
        curl -X POST "http://localhost:8003/api/queue/123/reject" \\
          -H "Content-Type: application/json" \\
          -d '{"reviewed_by": 1, "rejection_reason": "Incorrect specifications", "review_notes": "Need better datasheet"}'
        ```
    """
    enrichment_repo = EnrichmentRepository(db)

    # Get queue item
    item = enrichment_repo.get_queue_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    # Check if already rejected
    if item.status == 'rejected':
        raise HTTPException(status_code=400, detail="Item already rejected")

    try:
        # Mark queue item as rejected
        enrichment_repo.reject_queue_item(
            item_id,
            reviewed_by=request.reviewed_by,
            rejection_reason=request.rejection_reason,
            review_notes=request.review_notes
        )

        # Log to history
        enrichment_repo.create_history(
            mpn=item.mpn,
            enrichment_data=item.enrichment_data or {},
            quality_score=float(item.quality_score),
            status='rejected',
            rejection_reason=request.rejection_reason,
            issues=item.issues or [],
            enrichment_source=item.enrichment_source,
            customer_id=item.customer_id,
            bom_job_id=item.bom_job_id,
            created_by=request.reviewed_by
        )

        logger.info(f"✅ Queue item rejected: {item_id}")

        return {
            "message": "Queue item rejected successfully",
            "mpn": item.mpn,
            "rejection_reason": request.rejection_reason,
            "reviewed_by": request.reviewed_by
        }

    except Exception as e:
        logger.error(f"❌ Error rejecting queue item {item_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error rejecting item: {str(e)}")


@router.delete("/{item_id}")
def delete_queue_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete queue item

    Args:
        item_id: Queue item ID

    Returns:
        Success message

    Example:
        ```bash
        curl -X DELETE "http://localhost:8003/api/queue/123"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)

    # Get queue item
    item = enrichment_repo.get_queue_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    # Delete
    enrichment_repo.delete_queue_item(item_id)

    logger.info(f"✅ Queue item deleted: {item_id}")

    return {
        "message": "Queue item deleted successfully",
        "item_id": item_id,
        "mpn": item.mpn
    }


@router.get("/stats/summary", response_model=QueueStats)
def get_queue_stats(db: Session = Depends(get_db)):
    """
    Get queue statistics

    Returns:
        Statistics about enrichment queue

    Example:
        ```bash
        curl "http://localhost:8003/api/queue/stats/summary"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)
    stats = enrichment_repo.get_queue_statistics()

    return QueueStats(
        total_pending=stats['total_pending'],
        total_under_review=stats['total_under_review'],
        total_approved=stats['total_approved'],
        total_rejected=stats['total_rejected'],
        average_quality=stats['average_quality'],
        by_source=stats['by_source']
    )
