"""
BOM Repository

CRUD operations for BOM jobs.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.bom import BOMJob


class BOMRepository:
    """Repository for BOM job operations"""

    def __init__(self, db: Session):
        self.db = db

    def create_job(self, job_data: Dict[str, Any]) -> BOMJob:
        """Create new BOM job"""
        import logging
        logger = logging.getLogger(__name__)

        # Debug logging for multi-tenancy fields
        logger.info(f"Creating BOM job with data: organization_id={job_data.get('organization_id')}, "
                   f"project_id={job_data.get('project_id')}, source={job_data.get('source')}, "
                   f"priority={job_data.get('priority')}")

        job = BOMJob(**job_data)
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        # Verify fields were saved
        logger.info(f"BOM job created: job_id={job.job_id}, organization_id={job.organization_id}, "
                   f"project_id={job.project_id}, source={job.source}, priority={job.priority}")

        return job

    def get_by_id(self, job_id_pk: int) -> Optional[BOMJob]:
        """Get job by primary key ID"""
        return self.db.query(BOMJob).filter(BOMJob.id == job_id_pk).first()

    def get_by_job_id(self, job_id: str) -> Optional[BOMJob]:
        """Get job by job_id (UUID)"""
        return self.db.query(BOMJob).filter(BOMJob.job_id == job_id).first()

    def get_by_customer(
        self,
        customer_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[BOMJob]:
        """Get jobs by customer ID"""
        return self.db.query(BOMJob).filter(
            BOMJob.customer_id == customer_id
        ).order_by(
            BOMJob.created_at.desc()
        ).limit(limit).offset(offset).all()

    def get_recent_jobs(
        self,
        limit: int = 50,
        status_filter: Optional[str] = None
    ) -> List[BOMJob]:
        """Get recent BOM jobs"""
        query = self.db.query(BOMJob)

        if status_filter:
            query = query.filter(BOMJob.status == status_filter)

        return query.order_by(
            BOMJob.created_at.desc()
        ).limit(limit).all()

    def update_job(
        self,
        job_id: str,
        update_data: Dict[str, Any]
    ) -> Optional[BOMJob]:
        """Update BOM job"""
        job = self.get_by_job_id(job_id)
        if not job:
            return None

        for key, value in update_data.items():
            if hasattr(job, key):
                setattr(job, key, value)

        self.db.commit()
        self.db.refresh(job)
        return job

    def update_progress(
        self,
        job_id: str,
        progress: int,
        status: Optional[str] = None
    ) -> Optional[BOMJob]:
        """Update job progress"""
        update_data = {"progress": progress}
        if status:
            update_data["status"] = status

        return self.update_job(job_id, update_data)

    def update_job_status(
        self,
        job_id: str,
        status: str,
        **kwargs
    ) -> Optional[BOMJob]:
        """Update job status and optional fields"""
        update_data = {"status": status}
        update_data.update(kwargs)
        return self.update_job(job_id, update_data)

    def update_job_progress(
        self,
        job_id: str,
        progress: int,
        items_processed: int,
        items_auto_approved: int,
        items_in_staging: int,
        items_rejected: int,
        items_failed: int
    ) -> Optional[BOMJob]:
        """Update job progress with detailed item counts"""
        return self.update_job(job_id, {
            "progress": progress,
            "items_processed": items_processed,
            "items_auto_approved": items_auto_approved,
            "items_in_staging": items_in_staging,
            "items_rejected": items_rejected,
            "items_failed": items_failed
        })

    def complete_job(
        self,
        job_id: str,
        results_data: Dict[str, Any],
        processing_time_ms: int
    ) -> Optional[BOMJob]:
        """Mark job as completed"""
        from datetime import datetime

        return self.update_job(job_id, {
            "status": "completed",
            "progress": 100,
            "completed_at": datetime.utcnow(),
            "processing_time_ms": processing_time_ms,
            "results_data": results_data
        })

    def fail_job(
        self,
        job_id: str,
        error_message: str
    ) -> Optional[BOMJob]:
        """Mark job as failed"""
        from datetime import datetime

        return self.update_job(job_id, {
            "status": "failed",
            "error_message": error_message,
            "completed_at": datetime.utcnow()
        })

    def delete_job(self, job_id: str) -> bool:
        """Delete BOM job"""
        job = self.get_by_job_id(job_id)
        if not job:
            return False

        self.db.delete(job)
        self.db.commit()
        return True

    def count_total(self) -> int:
        """Count total jobs"""
        return self.db.query(func.count(BOMJob.id)).scalar()

    def get_stats(self) -> Dict[str, Any]:
        """Get BOM job statistics"""
        total = self.count_total()

        status_counts = dict(
            self.db.query(
                BOMJob.status,
                func.count(BOMJob.id)
            ).group_by(BOMJob.status).all()
        )

        avg_processing_time = self.db.query(
            func.avg(BOMJob.processing_time_ms)
        ).filter(
            BOMJob.status == 'completed'
        ).scalar()

        total_items = self.db.query(
            func.sum(BOMJob.total_items)
        ).scalar()

        return {
            "total_jobs": total,
            "status_distribution": status_counts,
            "average_processing_ms": float(avg_processing_time) if avg_processing_time else 0.0,
            "total_items_processed": int(total_items) if total_items else 0,
        }
