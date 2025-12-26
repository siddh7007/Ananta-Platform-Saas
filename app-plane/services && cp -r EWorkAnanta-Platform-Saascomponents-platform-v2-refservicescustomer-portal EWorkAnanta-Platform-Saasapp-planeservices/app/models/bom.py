"""
BOM Job Model

SQLAlchemy model for BOM upload and enrichment jobs.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base, TimestampMixin


class BOMJob(Base, TimestampMixin):
    """
    BOM job model

    Tracks BOM upload and enrichment jobs.
    """

    __tablename__ = "bom_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(100), unique=True, nullable=False, index=True)

    # Customer Information
    customer_id = Column(Integer, nullable=True)
    customer_name = Column(String(255), nullable=True)

    # File Information
    filename = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes
    total_items = Column(Integer, nullable=True)

    # Processing Status
    status = Column(String(50), nullable=False, server_default='pending')
    progress = Column(Integer, nullable=False, server_default='0')  # 0-100

    # Processing Results
    items_processed = Column(Integer, nullable=False, server_default='0')
    items_auto_approved = Column(Integer, nullable=False, server_default='0')
    items_in_staging = Column(Integer, nullable=False, server_default='0')
    items_rejected = Column(Integer, nullable=False, server_default='0')
    items_failed = Column(Integer, nullable=False, server_default='0')

    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    # Error Tracking
    error_message = Column(Text, nullable=True)

    # Results
    results_data = Column(JSONB, nullable=True)

    # Multi-Tenancy Support (Migration 010)
    organization_id = Column(Integer, nullable=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    source = Column(String(50), nullable=True, server_default='customer', index=True)
    source_metadata = Column(JSONB, nullable=True)
    priority = Column(Integer, nullable=True, server_default='5')

    def __repr__(self):
        return f"<BOMJob(id={self.id}, job_id='{self.job_id}', status='{self.status}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "filename": self.filename,
            "file_size": self.file_size,
            "total_items": self.total_items,
            "status": self.status,
            "progress": self.progress,
            "items_processed": self.items_processed,
            "items_auto_approved": self.items_auto_approved,
            "items_in_staging": self.items_in_staging,
            "items_rejected": self.items_rejected,
            "items_failed": self.items_failed,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "processing_time_ms": self.processing_time_ms,
            "error_message": self.error_message,
            "results_data": self.results_data,
            "organization_id": self.organization_id,
            "project_id": self.project_id,
            "source": self.source,
            "priority": self.priority,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
