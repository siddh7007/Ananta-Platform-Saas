"""
Enrichment Queue and History Models

SQLAlchemy models for component enrichment workflow.
"""

from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base, TimestampMixin


class EnrichmentQueue(Base, TimestampMixin):
    """
    Enrichment queue model (staging for review)

    Stores components with quality 70-94% needing manual review.

    Attributes:
        id: Primary key
        mpn: Manufacturer Part Number
        enrichment_data: Complete normalized component data (JSONB)
        ai_suggestions: AI-generated suggestions (JSONB array)
        quality_score: Quality score (70-94)
        issues: List of quality issues (JSONB array)
        enrichment_source: Source (customer_bom, staff_expansion)
        customer_id: Customer ID (if from BOM upload)
        bom_job_id: BOM job ID reference
        status: Review status (needs_review, under_review, approved, rejected)
        reviewed_by: User ID of reviewer
        reviewed_at: Review timestamp
        review_notes: Reviewer notes
    """

    __tablename__ = "enrichment_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mpn = Column(String(255), nullable=False, index=True)

    # Enrichment Data (JSONB)
    enrichment_data = Column(JSONB, nullable=False, server_default='{}')
    ai_suggestions = Column(JSONB, nullable=False, server_default='[]')

    # Quality & Issues
    quality_score = Column(Numeric(5, 2), nullable=False)
    issues = Column(JSONB, nullable=False, server_default='[]')

    # Source Information
    enrichment_source = Column(String(50), nullable=False)
    customer_id = Column(Integer, nullable=True)
    bom_job_id = Column(String(100), nullable=True)

    # Status & Review
    status = Column(String(50), nullable=False, server_default='needs_review')
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    __table_args__ = (
        Index('idx_enrichment_queue_quality', 'quality_score'),
        Index('idx_enrichment_queue_status', 'status'),
        Index('idx_enrichment_queue_source', 'enrichment_source'),
        Index('idx_enrichment_queue_data', 'enrichment_data', postgresql_using='gin'),
    )

    def __repr__(self):
        return f"<EnrichmentQueue(id={self.id}, mpn='{self.mpn}', status='{self.status}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "mpn": self.mpn,
            "enrichment_data": self.enrichment_data,
            "ai_suggestions": self.ai_suggestions,
            "quality_score": float(self.quality_score) if self.quality_score else None,
            "issues": self.issues,
            "enrichment_source": self.enrichment_source,
            "customer_id": self.customer_id,
            "bom_job_id": self.bom_job_id,
            "status": self.status,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_notes": self.review_notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class EnrichmentHistory(Base):
    """
    Enrichment history model (audit log)

    Stores all enrichment attempts (approved, rejected, errors).
    """

    __tablename__ = "enrichment_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mpn = Column(String(255), nullable=False, index=True)

    # Enrichment Attempt Data
    enrichment_data = Column(JSONB, nullable=True)
    quality_score = Column(Numeric(5, 2), nullable=True)

    # Status & Outcome
    status = Column(String(50), nullable=False)  # 'approved', 'rejected', 'error'
    rejection_reason = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Issues
    issues = Column(JSONB, nullable=False, server_default='[]')

    # Source
    enrichment_source = Column(String(50), nullable=True)
    customer_id = Column(Integer, nullable=True)
    bom_job_id = Column(String(100), nullable=True)

    # API Calls Made
    api_calls = Column(JSONB, nullable=False, server_default='[]')

    # Processing Metadata
    processing_time_ms = Column(Integer, nullable=True)
    tier_reached = Column(Integer, nullable=True)  # 1-4

    # Audit
    created_at = Column(DateTime, nullable=False)
    created_by = Column(Integer, nullable=True)

    __table_args__ = (
        Index('idx_enrichment_history_status', 'status'),
        Index('idx_enrichment_history_quality', 'quality_score'),
    )

    def __repr__(self):
        return f"<EnrichmentHistory(id={self.id}, mpn='{self.mpn}', status='{self.status}')>"
