"""
Enrichment Repository

CRUD operations for enrichment queue and history.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.enrichment import EnrichmentQueue, EnrichmentHistory


class EnrichmentRepository:
    """Repository for enrichment queue and history operations"""

    def __init__(self, db: Session):
        self.db = db

    # ===== Enrichment Queue Operations =====

    def create_queue_item(self, item_data: Dict[str, Any]) -> EnrichmentQueue:
        """Add item to enrichment queue"""
        item = EnrichmentQueue(**item_data)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_queue_item(self, item_id: int) -> Optional[EnrichmentQueue]:
        """Get queue item by ID"""
        return self.db.query(EnrichmentQueue).filter(
            EnrichmentQueue.id == item_id
        ).first()

    def get_queue_by_mpn(self, mpn: str) -> List[EnrichmentQueue]:
        """Get all queue items for an MPN"""
        return self.db.query(EnrichmentQueue).filter(
            EnrichmentQueue.mpn == mpn
        ).all()

    def get_pending_reviews(
        self,
        limit: int = 50,
        offset: int = 0,
        min_quality: float = 70.0,
        max_quality: float = 94.9,
        status: str = 'needs_review',
        enrichment_source: Optional[str] = None
    ) -> List[EnrichmentQueue]:
        """Get items needing review with optional filters."""
        query = self.db.query(EnrichmentQueue).filter(
            EnrichmentQueue.quality_score >= min_quality,
            EnrichmentQueue.quality_score <= max_quality,
            EnrichmentQueue.status == status
        )

        if enrichment_source:
            query = query.filter(EnrichmentQueue.enrichment_source == enrichment_source)

        return query.order_by(
            EnrichmentQueue.quality_score.desc(),
            EnrichmentQueue.created_at.asc()
        ).limit(limit).offset(offset).all()

    def update_queue_item(
        self,
        item_id: int,
        update_data: Dict[str, Any]
    ) -> Optional[EnrichmentQueue]:
        """Update queue item"""
        item = self.get_queue_item(item_id)
        if not item:
            return None

        for key, value in update_data.items():
            if hasattr(item, key):
                setattr(item, key, value)

        self.db.commit()
        self.db.refresh(item)
        return item

    def approve_queue_item(
        self,
        item_id: int,
        reviewed_by: int,
        review_notes: Optional[str] = None
    ) -> Optional[EnrichmentQueue]:
        """Approve queue item"""
        from datetime import datetime
        return self.update_queue_item(item_id, {
            "status": "approved",
            "reviewed_by": reviewed_by,
            "reviewed_at": datetime.utcnow(),
            "review_notes": review_notes
        })

    def reject_queue_item(
        self,
        item_id: int,
        reviewed_by: int,
        review_notes: str
    ) -> Optional[EnrichmentQueue]:
        """Reject queue item"""
        from datetime import datetime
        return self.update_queue_item(item_id, {
            "status": "rejected",
            "reviewed_by": reviewed_by,
            "reviewed_at": datetime.utcnow(),
            "review_notes": review_notes
        })

    def delete_queue_item(self, item_id: int) -> bool:
        """Delete queue item"""
        item = self.get_queue_item(item_id)
        if not item:
            return False

        self.db.delete(item)
        self.db.commit()
        return True

    def count_pending_reviews(self) -> int:
        """Count items needing review"""
        return self.db.query(func.count(EnrichmentQueue.id)).filter(
            EnrichmentQueue.status == 'needs_review'
        ).scalar()

    def get_queue_stats(self) -> Dict[str, Any]:
        """Get enrichment queue statistics"""
        total = self.db.query(func.count(EnrichmentQueue.id)).scalar()

        status_counts = dict(
            self.db.query(
                EnrichmentQueue.status,
                func.count(EnrichmentQueue.id)
            ).group_by(EnrichmentQueue.status).all()
        )

        avg_quality = self.db.query(
            func.avg(EnrichmentQueue.quality_score)
        ).scalar()

        return {
            "total_items": total,
            "status_distribution": status_counts,
            "average_quality": float(avg_quality) if avg_quality else 0.0,
        }

    # ===== Enrichment History Operations =====

    def create_history_entry(self, history_data: Dict[str, Any]) -> EnrichmentHistory:
        """Create enrichment history entry"""
        from datetime import datetime
        if 'created_at' not in history_data:
            history_data['created_at'] = datetime.utcnow()

        entry = EnrichmentHistory(**history_data)
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_history_by_mpn(
        self,
        mpn: str,
        limit: int = 10
    ) -> List[EnrichmentHistory]:
        """Get enrichment history for an MPN"""
        return self.db.query(EnrichmentHistory).filter(
            EnrichmentHistory.mpn == mpn
        ).order_by(
            EnrichmentHistory.created_at.desc()
        ).limit(limit).all()

    def get_recent_history(
        self,
        limit: int = 100,
        status_filter: Optional[str] = None
    ) -> List[EnrichmentHistory]:
        """Get recent enrichment history"""
        query = self.db.query(EnrichmentHistory)

        if status_filter:
            query = query.filter(EnrichmentHistory.status == status_filter)

        return query.order_by(
            EnrichmentHistory.created_at.desc()
        ).limit(limit).all()

    def get_history_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get enrichment history statistics"""
        from datetime import datetime, timedelta

        since = datetime.utcnow() - timedelta(days=days)

        total = self.db.query(func.count(EnrichmentHistory.id)).filter(
            EnrichmentHistory.created_at >= since
        ).scalar()

        status_counts = dict(
            self.db.query(
                EnrichmentHistory.status,
                func.count(EnrichmentHistory.id)
            ).filter(
                EnrichmentHistory.created_at >= since
            ).group_by(EnrichmentHistory.status).all()
        )

        avg_processing_time = self.db.query(
            func.avg(EnrichmentHistory.processing_time_ms)
        ).filter(
            EnrichmentHistory.created_at >= since
        ).scalar()

        return {
            "period_days": days,
            "total_attempts": total,
            "status_distribution": status_counts,
            "average_processing_ms": float(avg_processing_time) if avg_processing_time else 0.0,
        }
