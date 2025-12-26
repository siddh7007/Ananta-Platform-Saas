"""
Analytics API Endpoints

Provides enrichment metrics and statistics for CNS Analytics Dashboard.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.repositories.bom_repository import BOMRepository
from app.repositories.enrichment_repository import EnrichmentRepository
from app.repositories.catalog_repository import CatalogRepository

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Models
class EnrichmentStats(BaseModel):
    """Overall enrichment statistics"""
    total_bom_jobs: int
    total_components_processed: int
    total_enriched_from_suppliers: int
    total_matched_from_catalog: int
    total_failed_enrichment: int
    enrichment_success_rate: float
    avg_processing_time_ms: float


class SupplierUsageStats(BaseModel):
    """Supplier usage statistics"""
    supplier_name: str
    components_enriched: int
    percentage: float
    avg_match_confidence: Optional[float]


class QualityRoutingStats(BaseModel):
    """Quality routing breakdown"""
    production: int
    staging: int
    rejected: int
    failed: int
    total: int
    production_rate: float
    staging_rate: float
    rejection_rate: float


class BOMJobSummary(BaseModel):
    """BOM job summary for analytics"""
    job_id: str
    customer_id: Optional[int]
    customer_name: Optional[str]
    filename: str
    total_items: int
    items_auto_approved: int
    items_in_staging: int
    items_rejected: int
    items_failed: int
    processing_time_ms: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    enrichment_stats: Optional[Dict[str, Any]]


class TimeSeriesDataPoint(BaseModel):
    """Time series data point"""
    date: str
    count: int
    success_rate: float


class AnalyticsDashboardResponse(BaseModel):
    """Complete analytics dashboard data"""
    overview: EnrichmentStats
    quality_routing: QualityRoutingStats
    supplier_usage: List[SupplierUsageStats]
    recent_jobs: List[BOMJobSummary]
    time_series: List[TimeSeriesDataPoint]


@router.get("/overview", response_model=EnrichmentStats)
def get_enrichment_overview(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include in statistics"),
    db: Session = Depends(get_db)
):
    """
    Get overall enrichment statistics

    Returns aggregated metrics for BOM processing and component enrichment.

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/overview?days=30"
        ```
    """
    try:
        bom_repo = BOMRepository(db)

        # Calculate date range
        start_date = datetime.utcnow() - timedelta(days=days)

        # Get all completed BOM jobs in date range
        from app.models.bom import BOMJob
        jobs = db.query(BOMJob).filter(
            BOMJob.status == 'completed',
            BOMJob.completed_at >= start_date
        ).all()

        total_jobs = len(jobs)
        total_processed = sum(job.total_items for job in jobs)

        # Extract enrichment statistics from job results
        total_enriched = 0
        total_matched = 0
        total_failed_enrichment = 0
        total_processing_time = 0

        for job in jobs:
            if job.results_data and 'enrichment_stats' in job.results_data:
                stats = job.results_data['enrichment_stats']
                total_enriched += stats.get('newly_imported', 0)
                total_matched += stats.get('matched_existing', 0)
                total_failed_enrichment += stats.get('import_failed', 0)

            if job.processing_time_ms:
                total_processing_time += job.processing_time_ms

        # Calculate success rate
        enrichment_attempts = total_enriched + total_failed_enrichment
        success_rate = (total_enriched / enrichment_attempts * 100) if enrichment_attempts > 0 else 0.0

        # Calculate average processing time
        avg_processing_time = total_processing_time / total_jobs if total_jobs > 0 else 0.0

        return EnrichmentStats(
            total_bom_jobs=total_jobs,
            total_components_processed=total_processed,
            total_enriched_from_suppliers=total_enriched,
            total_matched_from_catalog=total_matched,
            total_failed_enrichment=total_failed_enrichment,
            enrichment_success_rate=round(success_rate, 2),
            avg_processing_time_ms=round(avg_processing_time, 2)
        )

    except Exception as e:
        logger.error(f"Error getting enrichment overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supplier-usage", response_model=List[SupplierUsageStats])
def get_supplier_usage(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
    db: Session = Depends(get_db)
):
    """
    Get supplier usage statistics

    Returns breakdown of which suppliers provided enrichment data.

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/supplier-usage?days=30"
        ```
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)

        # Get all completed BOM jobs
        from app.models.bom import BOMJob
        jobs = db.query(BOMJob).filter(
            BOMJob.status == 'completed',
            BOMJob.completed_at >= start_date
        ).all()

        # Aggregate supplier usage
        supplier_counts = {}

        for job in jobs:
            if job.results_data and 'enrichment_stats' in job.results_data:
                vendors_used = job.results_data['enrichment_stats'].get('vendors_used', {})
                for supplier, count in vendors_used.items():
                    supplier_counts[supplier] = supplier_counts.get(supplier, 0) + count

        # Calculate total and percentages
        total_enrichments = sum(supplier_counts.values())

        supplier_stats = []
        for supplier, count in sorted(supplier_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_enrichments * 100) if total_enrichments > 0 else 0.0
            supplier_stats.append(SupplierUsageStats(
                supplier_name=supplier.title(),
                components_enriched=count,
                percentage=round(percentage, 2),
                avg_match_confidence=None  # TODO: Add match confidence tracking
            ))

        return supplier_stats

    except Exception as e:
        logger.error(f"Error getting supplier usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quality-routing", response_model=QualityRoutingStats)
def get_quality_routing_stats(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
    db: Session = Depends(get_db)
):
    """
    Get quality routing statistics

    Returns breakdown of components routed to production/staging/rejected.

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/quality-routing?days=30"
        ```
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)

        from app.models.bom import BOMJob
        jobs = db.query(BOMJob).filter(
            BOMJob.status == 'completed',
            BOMJob.completed_at >= start_date
        ).all()

        # Aggregate routing stats
        production = sum(job.items_auto_approved for job in jobs)
        staging = sum(job.items_in_staging for job in jobs)
        rejected = sum(job.items_rejected for job in jobs)
        failed = sum(job.items_failed for job in jobs)
        total = production + staging + rejected + failed

        # Calculate percentages
        production_rate = (production / total * 100) if total > 0 else 0.0
        staging_rate = (staging / total * 100) if total > 0 else 0.0
        rejection_rate = (rejected / total * 100) if total > 0 else 0.0

        return QualityRoutingStats(
            production=production,
            staging=staging,
            rejected=rejected,
            failed=failed,
            total=total,
            production_rate=round(production_rate, 2),
            staging_rate=round(staging_rate, 2),
            rejection_rate=round(rejection_rate, 2)
        )

    except Exception as e:
        logger.error(f"Error getting quality routing stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent-jobs", response_model=List[BOMJobSummary])
def get_recent_jobs(
    limit: int = Query(default=10, ge=1, le=100, description="Number of recent jobs to return"),
    db: Session = Depends(get_db)
):
    """
    Get recent BOM jobs with enrichment statistics

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/recent-jobs?limit=10"
        ```
    """
    try:
        from app.models.bom import BOMJob
        jobs = db.query(BOMJob).filter(
            BOMJob.status.in_(['completed', 'failed'])
        ).order_by(desc(BOMJob.completed_at)).limit(limit).all()

        job_summaries = []
        for job in jobs:
            enrichment_stats = None
            if job.results_data and 'enrichment_stats' in job.results_data:
                enrichment_stats = job.results_data['enrichment_stats']

            job_summaries.append(BOMJobSummary(
                job_id=job.job_id,
                customer_id=job.customer_id,
                customer_name=job.customer_name,
                filename=job.filename,
                total_items=job.total_items,
                items_auto_approved=job.items_auto_approved,
                items_in_staging=job.items_in_staging,
                items_rejected=job.items_rejected,
                items_failed=job.items_failed,
                processing_time_ms=job.processing_time_ms,
                started_at=job.started_at,
                completed_at=job.completed_at,
                enrichment_stats=enrichment_stats
            ))

        return job_summaries

    except Exception as e:
        logger.error(f"Error getting recent jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/time-series", response_model=List[TimeSeriesDataPoint])
def get_time_series(
    days: int = Query(default=30, ge=7, le=365, description="Number of days to include"),
    db: Session = Depends(get_db)
):
    """
    Get time series data for enrichment success rate

    Returns daily aggregated statistics for charting.

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/time-series?days=30"
        ```
    """
    try:
        from app.models.bom import BOMJob

        start_date = datetime.utcnow() - timedelta(days=days)

        jobs = db.query(BOMJob).filter(
            BOMJob.status == 'completed',
            BOMJob.completed_at >= start_date
        ).all()

        # Group by date
        daily_stats = {}

        for job in jobs:
            if not job.completed_at:
                continue

            date_key = job.completed_at.date().isoformat()

            if date_key not in daily_stats:
                daily_stats[date_key] = {
                    'count': 0,
                    'enriched': 0,
                    'failed': 0
                }

            daily_stats[date_key]['count'] += job.total_items

            if job.results_data and 'enrichment_stats' in job.results_data:
                stats = job.results_data['enrichment_stats']
                daily_stats[date_key]['enriched'] += stats.get('newly_imported', 0)
                daily_stats[date_key]['failed'] += stats.get('import_failed', 0)

        # Convert to time series
        time_series = []
        for date, stats in sorted(daily_stats.items()):
            total_attempts = stats['enriched'] + stats['failed']
            success_rate = (stats['enriched'] / total_attempts * 100) if total_attempts > 0 else 0.0

            time_series.append(TimeSeriesDataPoint(
                date=date,
                count=stats['count'],
                success_rate=round(success_rate, 2)
            ))

        return time_series

    except Exception as e:
        logger.error(f"Error getting time series data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard", response_model=AnalyticsDashboardResponse)
def get_analytics_dashboard(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to include"),
    db: Session = Depends(get_db)
):
    """
    Get complete analytics dashboard data

    Single endpoint that returns all analytics data for dashboard rendering.

    Example:
        ```bash
        curl "http://localhost:27800/api/analytics/dashboard?days=30"
        ```
    """
    try:
        overview = get_enrichment_overview(days, db)
        quality_routing = get_quality_routing_stats(days, db)
        supplier_usage = get_supplier_usage(days, db)
        recent_jobs = get_recent_jobs(10, db)
        time_series = get_time_series(days, db)

        return AnalyticsDashboardResponse(
            overview=overview,
            quality_routing=quality_routing,
            supplier_usage=supplier_usage,
            recent_jobs=recent_jobs,
            time_series=time_series
        )

    except Exception as e:
        logger.error(f"Error getting analytics dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
