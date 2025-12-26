"""
Quality Queue API Endpoints

Staff interface to review all enriched components from Redis by quality score.
Allows filtering, approving (move to database), and rejecting (delete from Redis).
"""

import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.cache.redis_cache import get_cache
from app.cache.component_redis_storage import (
    get_low_quality_component,
    delete_low_quality_component,
)
from app.services.component_catalog import ComponentCatalogService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quality-queue", tags=["Quality Queue"])


# ============================================================
# STATS ENDPOINT - MUST BE BEFORE PATH PARAMETER ROUTES
# ============================================================

@router.get("/stats/summary")
async def get_quality_queue_stats():
    """
    Get statistics about the quality queue.

    Returns:
        Counts and averages for components in the Redis queue
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        raise HTTPException(status_code=503, detail="Redis cache not available")

    try:
        client = cache.get_client()
        if not client:
            raise HTTPException(status_code=503, detail="Redis client not available")

        stats = {
            "total": 0,
            "staging_count": 0,  # 70-94%
            "rejected_count": 0,  # <70%
            "average_quality": 0.0,
            "by_source": {},
        }

        quality_scores = []

        pattern = "low_quality_component:*"
        cursor = 0

        while True:
            cursor, keys = client.scan(cursor, match=pattern, count=100)

            for key in keys:
                key_str = key.decode('utf-8') if isinstance(key, bytes) else key
                component_record = cache.get(key_str)

                if not component_record:
                    continue

                stats["total"] += 1
                quality_score = float(component_record.get('quality_score', 0))
                quality_scores.append(quality_score)

                if quality_score >= 70:
                    stats["staging_count"] += 1
                else:
                    stats["rejected_count"] += 1

                # Track by source
                source = component_record.get('api_source') or component_record.get('enrichment_source') or 'unknown'
                stats["by_source"][source] = stats["by_source"].get(source, 0) + 1

            if cursor == 0:
                break

        if quality_scores:
            stats["average_quality"] = round(sum(quality_scores) / len(quality_scores), 1)

        return stats

    except Exception as e:
        logger.error(f"Error fetching quality queue stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


# ============================================================
# PYDANTIC MODELS
# ============================================================

# Pydantic Models
class QueueItem(BaseModel):
    """Quality queue item from Redis"""
    id: str  # Redis key
    mpn: str
    manufacturer: str
    category: Optional[str] = None
    quality_score: float
    flagged_reason: str = "Low quality score"
    data_completeness: float = 0.0
    sources_used: List[str] = []
    submitted_at: str
    job_id: Optional[str] = None


class QueueListResponse(BaseModel):
    """Queue list response"""
    total: int
    items: List[QueueItem]


class ApproveResponse(BaseModel):
    """Approve response"""
    success: bool
    message: str
    component_id: Optional[str] = None


class RejectResponse(BaseModel):
    """Reject response"""
    success: bool
    message: str


def _get_flagged_reason(quality_score: float) -> str:
    """Generate flagged reason based on quality score"""
    if quality_score < 50:
        return "Very low quality - missing critical data"
    elif quality_score < 70:
        return "Low quality - needs re-enrichment"
    elif quality_score < 80:
        return "Below threshold - review required"
    elif quality_score < 95:
        return "Staging quality - manual approval needed"
    else:
        return "High quality"


def _calculate_data_completeness(enrichment_data: dict) -> float:
    """Calculate data completeness percentage"""
    required_fields = ['mpn', 'manufacturer', 'description', 'category']
    high_priority_fields = ['price_breaks', 'stock_quantity', 'lifecycle_status', 'parameters', 'datasheet_url']
    optional_fields = ['rohs_compliant', 'reach_compliant', 'lead_time_days', 'image_url', 'packaging']

    total_weight = 0.0
    filled_weight = 0.0

    # Required fields: 50% weight
    for field in required_fields:
        total_weight += 12.5  # 50% / 4 fields
        if enrichment_data.get(field):
            filled_weight += 12.5

    # High priority: 35% weight
    for field in high_priority_fields:
        total_weight += 7  # 35% / 5 fields
        if enrichment_data.get(field):
            filled_weight += 7

    # Optional: 15% weight
    for field in optional_fields:
        total_weight += 3  # 15% / 5 fields
        if enrichment_data.get(field):
            filled_weight += 3

    return round((filled_weight / total_weight) * 100, 1) if total_weight > 0 else 0.0


@router.get("", response_model=QueueListResponse)
async def get_quality_queue(
    status: str = Query("staging", description="Filter: 'staging' (70-94%), 'rejected' (<70%), 'all'"),
    min_quality: Optional[float] = Query(None, description="Minimum quality score"),
    max_quality: Optional[float] = Query(None, description="Maximum quality score"),
    limit: int = Query(100, description="Maximum results", ge=1, le=500),
):
    """
    Get components from Redis quality queue.

    Scans Redis for all low-quality components and returns them filtered by quality score.

    Args:
        status: Filter preset - 'staging' (70-94%), 'rejected' (<70%), 'all'
        min_quality: Optional minimum quality score override
        max_quality: Optional maximum quality score override
        limit: Maximum results to return

    Returns:
        List of queue items with quality scores and metadata
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        raise HTTPException(status_code=503, detail="Redis cache not available")

    try:
        client = cache.get_client()
        if not client:
            raise HTTPException(status_code=503, detail="Redis client not available")

        # Determine quality score range based on filter
        if min_quality is None and max_quality is None:
            if status == "staging":
                min_quality = 70.0
                max_quality = 94.9
            elif status == "rejected":
                min_quality = 0.0
                max_quality = 69.9
            else:  # "all"
                min_quality = 0.0
                max_quality = 100.0

        # Default values if only one is provided
        if min_quality is None:
            min_quality = 0.0
        if max_quality is None:
            max_quality = 100.0

        # Scan for low-quality component keys
        pattern = "low_quality_component:*"
        items: List[QueueItem] = []

        cursor = 0
        while len(items) < limit:
            cursor, keys = client.scan(cursor, match=pattern, count=100)

            for key in keys:
                if len(items) >= limit:
                    break

                # Decode key if bytes
                key_str = key.decode('utf-8') if isinstance(key, bytes) else key

                component_record = cache.get(key_str)
                if not component_record:
                    continue

                quality_score = float(component_record.get('quality_score', 0))

                # Apply quality score filter
                if quality_score < min_quality or quality_score > max_quality:
                    continue

                enrichment_data = component_record.get('enrichment_data', {})

                # Extract sources used
                sources = []
                api_source = component_record.get('api_source') or enrichment_data.get('api_source')
                if api_source:
                    sources.append(api_source)
                enrichment_source = component_record.get('enrichment_source') or enrichment_data.get('enrichment_source')
                if enrichment_source and enrichment_source not in sources:
                    sources.append(enrichment_source)

                items.append(QueueItem(
                    id=key_str,
                    mpn=component_record.get('mpn', ''),
                    manufacturer=component_record.get('manufacturer', ''),
                    category=enrichment_data.get('category'),
                    quality_score=quality_score,
                    flagged_reason=_get_flagged_reason(quality_score),
                    data_completeness=_calculate_data_completeness(enrichment_data),
                    sources_used=sources,
                    submitted_at=component_record.get('stored_at', datetime.utcnow().isoformat()),
                    job_id=enrichment_data.get('job_id'),
                ))

            if cursor == 0:
                break

        # Sort by quality score (lowest first for review priority)
        items.sort(key=lambda x: x.quality_score)

        logger.info(f"Quality queue: Found {len(items)} items (filter={status}, range={min_quality}-{max_quality})")

        return QueueListResponse(
            total=len(items),
            items=items
        )

    except Exception as e:
        logger.error(f"Error fetching quality queue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching quality queue: {str(e)}")


@router.get("/{item_id:path}")
async def get_queue_item(item_id: str):
    """
    Get a specific queue item by its Redis key.

    Args:
        item_id: Redis key (e.g., "low_quality_component:MANUFACTURER:MPN")

    Returns:
        Full component data from Redis
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        raise HTTPException(status_code=503, detail="Redis cache not available")

    component_record = cache.get(item_id)
    if not component_record:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    enrichment_data = component_record.get('enrichment_data', {})

    return {
        "id": item_id,
        "mpn": component_record.get('mpn', ''),
        "manufacturer": component_record.get('manufacturer', ''),
        "quality_score": component_record.get('quality_score', 0),
        "enrichment_data": enrichment_data,
        "stored_at": component_record.get('stored_at'),
        "api_source": component_record.get('api_source'),
        "enrichment_source": component_record.get('enrichment_source'),
        "needs_reenrichment": component_record.get('needs_reenrichment', True),
    }


@router.post("/{item_id:path}/approve", response_model=ApproveResponse)
async def approve_queue_item(item_id: str):
    """
    Approve a component from Redis and move it to the database catalog.

    This promotes a low-quality component from Redis temporary storage
    to the permanent PostgreSQL catalog.

    Args:
        item_id: Redis key (e.g., "low_quality_component:MANUFACTURER:MPN")

    Returns:
        Success status and new component ID
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        raise HTTPException(status_code=503, detail="Redis cache not available")

    component_record = cache.get(item_id)
    if not component_record:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    try:
        mpn = component_record.get('mpn', '')
        manufacturer = component_record.get('manufacturer', '')
        enrichment_data = component_record.get('enrichment_data', {})

        # Use ComponentCatalogService to upsert to database
        catalog_service = ComponentCatalogService()

        # Prepare enrichment data for catalog upsert
        # Merge top-level fields with enrichment_data
        catalog_data = {
            **enrichment_data,
            'quality_score': component_record.get('quality_score', 0),
            'api_source': component_record.get('api_source'),
        }

        # Use upsert_component (correct method name)
        component_id = catalog_service.upsert_component(
            mpn=mpn,
            manufacturer=manufacturer,
            enrichment_data=catalog_data,
            enrichment_source='quality_queue_approval'
        )

        if component_id:
            # Delete from Redis after successful save
            delete_low_quality_component(mpn, manufacturer)

            logger.info(f"✅ Approved and moved to catalog: {mpn} (ID: {component_id})")

            return ApproveResponse(
                success=True,
                message=f"Component {mpn} approved and moved to catalog",
                component_id=str(component_id)
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to save component to catalog")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving queue item {item_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error approving component: {str(e)}")


@router.post("/{item_id:path}/reject", response_model=RejectResponse)
async def reject_queue_item(item_id: str):
    """
    Reject a component from the quality queue.

    This removes the component from Redis temporary storage.

    Args:
        item_id: Redis key (e.g., "low_quality_component:MANUFACTURER:MPN")

    Returns:
        Success status
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        raise HTTPException(status_code=503, detail="Redis cache not available")

    component_record = cache.get(item_id)
    if not component_record:
        raise HTTPException(status_code=404, detail=f"Queue item not found: {item_id}")

    try:
        mpn = component_record.get('mpn', '')
        manufacturer = component_record.get('manufacturer', '')

        # Delete from Redis
        success = delete_low_quality_component(mpn, manufacturer)

        if success:
            logger.info(f"✅ Rejected and removed from queue: {mpn}")
            return RejectResponse(
                success=True,
                message=f"Component {mpn} rejected and removed from queue"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to remove component from Redis")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting queue item {item_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error rejecting component: {str(e)}")
