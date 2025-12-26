"""
Enrichment History API Endpoints

Provides audit trail of all enrichment attempts (approved, rejected, errors).
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.models.base import get_db
from app.repositories.enrichment_repository import EnrichmentRepository

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Models
class HistoryEntry(BaseModel):
    """Enrichment history entry"""
    id: int
    mpn: str
    enrichment_data: Optional[dict]
    quality_score: Optional[float]
    status: str
    rejection_reason: Optional[str]
    error_message: Optional[str]
    issues: list
    enrichment_source: Optional[str]
    customer_id: Optional[int]
    bom_job_id: Optional[str]
    api_calls: list
    processing_time_ms: Optional[int]
    tier_reached: Optional[int]
    created_at: str
    created_by: Optional[int]


class HistoryListResponse(BaseModel):
    """History list response"""
    total: int
    entries: List[HistoryEntry]
    filters: dict


class HistoryStats(BaseModel):
    """History statistics"""
    total_attempts: int
    total_approved: int
    total_rejected: int
    total_errors: int
    average_quality: float
    average_processing_time_ms: float
    by_status: dict
    by_source: dict


@router.get("/{mpn}", response_model=HistoryListResponse)
def get_component_history(
    mpn: str,
    limit: int = Query(50, description="Maximum results", ge=1, le=500),
    offset: int = Query(0, description="Pagination offset", ge=0),
    db: Session = Depends(get_db)
):
    """
    Get enrichment history for a component

    Shows all enrichment attempts for a given MPN.

    Args:
        mpn: Manufacturer Part Number
        limit: Maximum results (default 50)
        offset: Pagination offset

    Returns:
        List of history entries

    Example:
        ```bash
        curl "http://localhost:8003/api/history/STM32F407VGT6"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)
    entries = enrichment_repo.get_history_by_mpn(mpn, limit=limit, offset=offset)

    results = [
        HistoryEntry(
            id=entry.id,
            mpn=entry.mpn,
            enrichment_data=entry.enrichment_data,
            quality_score=float(entry.quality_score) if entry.quality_score else None,
            status=entry.status,
            rejection_reason=entry.rejection_reason,
            error_message=entry.error_message,
            issues=entry.issues or [],
            enrichment_source=entry.enrichment_source,
            customer_id=entry.customer_id,
            bom_job_id=entry.bom_job_id,
            api_calls=entry.api_calls or [],
            processing_time_ms=entry.processing_time_ms,
            tier_reached=entry.tier_reached,
            created_at=entry.created_at.isoformat(),
            created_by=entry.created_by
        )
        for entry in entries
    ]

    return HistoryListResponse(
        total=len(results),
        entries=results,
        filters={"mpn": mpn}
    )


@router.get("/list/all", response_model=HistoryListResponse)
def get_all_history(
    status: Optional[str] = Query(None, description="Filter by status"),
    enrichment_source: Optional[str] = Query(None, description="Filter by source"),
    min_quality: Optional[float] = Query(None, description="Minimum quality score", ge=0, le=100),
    limit: int = Query(100, description="Maximum results", ge=1, le=1000),
    offset: int = Query(0, description="Pagination offset", ge=0),
    db: Session = Depends(get_db)
):
    """
    Get enrichment history with filters

    Args:
        status: Filter by status (approved, rejected, error)
        enrichment_source: Filter by source (customer_bom, staff_expansion)
        min_quality: Minimum quality score
        limit: Maximum results (default 100)
        offset: Pagination offset

    Returns:
        List of history entries

    Example:
        ```bash
        # Get all approved entries
        curl "http://localhost:8003/api/history/list/all?status=approved"

        # Get all rejected with quality >= 80
        curl "http://localhost:8003/api/history/list/all?status=rejected&min_quality=80"
        ```
    """
    from sqlalchemy import and_
    from app.models.enrichment import EnrichmentHistory

    # Build query
    query = db.query(EnrichmentHistory)

    # Apply filters
    filters_applied = {}
    if status:
        query = query.filter(EnrichmentHistory.status == status)
        filters_applied['status'] = status

    if enrichment_source:
        query = query.filter(EnrichmentHistory.enrichment_source == enrichment_source)
        filters_applied['enrichment_source'] = enrichment_source

    if min_quality is not None:
        query = query.filter(EnrichmentHistory.quality_score >= min_quality)
        filters_applied['min_quality'] = min_quality

    # Order by most recent first
    query = query.order_by(EnrichmentHistory.created_at.desc())

    # Pagination
    entries = query.limit(limit).offset(offset).all()

    results = [
        HistoryEntry(
            id=entry.id,
            mpn=entry.mpn,
            enrichment_data=entry.enrichment_data,
            quality_score=float(entry.quality_score) if entry.quality_score else None,
            status=entry.status,
            rejection_reason=entry.rejection_reason,
            error_message=entry.error_message,
            issues=entry.issues or [],
            enrichment_source=entry.enrichment_source,
            customer_id=entry.customer_id,
            bom_job_id=entry.bom_job_id,
            api_calls=entry.api_calls or [],
            processing_time_ms=entry.processing_time_ms,
            tier_reached=entry.tier_reached,
            created_at=entry.created_at.isoformat(),
            created_by=entry.created_by
        )
        for entry in entries
    ]

    return HistoryListResponse(
        total=len(results),
        entries=results,
        filters=filters_applied
    )


@router.get("/entry/{entry_id}", response_model=HistoryEntry)
def get_history_entry(
    entry_id: int,
    db: Session = Depends(get_db)
):
    """
    Get history entry by ID

    Args:
        entry_id: History entry ID

    Returns:
        History entry details

    Example:
        ```bash
        curl "http://localhost:8003/api/history/entry/123"
        ```
    """
    from app.models.enrichment import EnrichmentHistory

    entry = db.query(EnrichmentHistory).filter(EnrichmentHistory.id == entry_id).first()

    if not entry:
        raise HTTPException(status_code=404, detail=f"History entry not found: {entry_id}")

    return HistoryEntry(
        id=entry.id,
        mpn=entry.mpn,
        enrichment_data=entry.enrichment_data,
        quality_score=float(entry.quality_score) if entry.quality_score else None,
        status=entry.status,
        rejection_reason=entry.rejection_reason,
        error_message=entry.error_message,
        issues=entry.issues or [],
        enrichment_source=entry.enrichment_source,
        customer_id=entry.customer_id,
        bom_job_id=entry.bom_job_id,
        api_calls=entry.api_calls or [],
        processing_time_ms=entry.processing_time_ms,
        tier_reached=entry.tier_reached,
        created_at=entry.created_at.isoformat(),
        created_by=entry.created_by
    )


@router.get("/stats/summary", response_model=HistoryStats)
def get_history_stats(db: Session = Depends(get_db)):
    """
    Get history statistics

    Returns:
        Statistics about enrichment history

    Example:
        ```bash
        curl "http://localhost:8003/api/history/stats/summary"
        ```
    """
    enrichment_repo = EnrichmentRepository(db)
    stats = enrichment_repo.get_history_statistics()

    return HistoryStats(
        total_attempts=stats['total_attempts'],
        total_approved=stats['total_approved'],
        total_rejected=stats['total_rejected'],
        total_errors=stats['total_errors'],
        average_quality=stats['average_quality'],
        average_processing_time_ms=stats['average_processing_time_ms'],
        by_status=stats['by_status'],
        by_source=stats['by_source']
    )


@router.get("/rejected/recent", response_model=HistoryListResponse)
def get_recent_rejections(
    limit: int = Query(20, description="Maximum results", ge=1, le=100),
    min_quality: float = Query(70.0, description="Minimum quality score", ge=0, le=100),
    db: Session = Depends(get_db)
):
    """
    Get recent rejections

    Useful for identifying common rejection patterns.

    Args:
        limit: Maximum results (default 20)
        min_quality: Minimum quality score (default 70)

    Returns:
        List of recent rejected entries

    Example:
        ```bash
        # Get last 20 rejections with quality >= 70
        curl "http://localhost:8003/api/history/rejected/recent"
        ```
    """
    from app.models.enrichment import EnrichmentHistory

    entries = db.query(EnrichmentHistory).filter(
        EnrichmentHistory.status == 'rejected',
        EnrichmentHistory.quality_score >= min_quality
    ).order_by(
        EnrichmentHistory.created_at.desc()
    ).limit(limit).all()

    results = [
        HistoryEntry(
            id=entry.id,
            mpn=entry.mpn,
            enrichment_data=entry.enrichment_data,
            quality_score=float(entry.quality_score) if entry.quality_score else None,
            status=entry.status,
            rejection_reason=entry.rejection_reason,
            error_message=entry.error_message,
            issues=entry.issues or [],
            enrichment_source=entry.enrichment_source,
            customer_id=entry.customer_id,
            bom_job_id=entry.bom_job_id,
            api_calls=entry.api_calls or [],
            processing_time_ms=entry.processing_time_ms,
            tier_reached=entry.tier_reached,
            created_at=entry.created_at.isoformat(),
            created_by=entry.created_by
        )
        for entry in entries
    ]

    return HistoryListResponse(
        total=len(results),
        entries=results,
        filters={"status": "rejected", "min_quality": min_quality}
    )
