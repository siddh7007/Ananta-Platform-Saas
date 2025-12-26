"""
Enrichment Audit Wrapper

Wraps enrichment operations to automatically log to audit tables for Directus visibility.
Non-intrusive decorator pattern - does not modify enrichment logic.
"""

import logging
import time
from typing import Optional, Dict, Any
from functools import wraps
from datetime import datetime

from sqlalchemy.orm import Session

from app.utils.enrichment_audit_db import EnrichmentAuditDB
from app.services.enrichment_service import EnrichmentResult

logger = logging.getLogger(__name__)


class EnrichmentAuditWrapper:
    """
    Wraps enrichment operations with automatic audit logging

    Usage:
        audit_wrapper = EnrichmentAuditWrapper(db, upload_id="bulk_123")

        # Wrap enrichment result
        audit_wrapper.log_enrichment(
            line_id="line_456",
            enrichment_result=result,
            supplier_data=raw_supplier_data,
            normalized_data=normalized_data
        )
    """

    def __init__(
        self,
        db: Session,
        upload_id: str,
        enable_field_comparison: bool = True,
        enable_auto_review_flagging: bool = True
    ):
        """
        Initialize audit wrapper

        Args:
            db: Database session (Components V2 DB)
            upload_id: Bulk upload or BOM ID
            enable_field_comparison: Log field-by-field comparisons
            enable_auto_review_flagging: Auto-flag low quality for review
        """
        self.db = db
        self.upload_id = upload_id
        self.enable_field_comparison = enable_field_comparison
        self.enable_auto_review_flagging = enable_auto_review_flagging

        # Create audit DB writer
        self.audit_db = EnrichmentAuditDB(db)

    def log_enrichment(
        self,
        line_id: str,
        mpn: str,
        manufacturer: Optional[str],
        enrichment_result: EnrichmentResult,
        supplier_data: Optional[Dict[str, Any]] = None,
        normalized_data: Optional[Dict[str, Any]] = None,
        storage_location: Optional[str] = None
    ) -> Optional[str]:
        """
        Log enrichment operation to audit tables

        Args:
            line_id: BOM line item ID
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            enrichment_result: Result from enrichment service
            supplier_data: Raw supplier API data (for field comparison)
            normalized_data: Normalized component data (for field comparison)
            storage_location: Where component saved ('database' or 'redis')

        Returns:
            UUID of created enrichment run (or None if failed)
        """
        try:
            # Determine supplier used
            supplier_name = None
            if enrichment_result.tiers_used:
                # If suppliers tier was used, extract supplier name from data
                if 'suppliers' in enrichment_result.tiers_used:
                    supplier_name = enrichment_result.data.get('enrichment_source', 'unknown')
                    if supplier_name == 'manual_promotion':
                        supplier_name = 'unknown'

            # Auto-detect storage location if not provided
            if not storage_location:
                storage_location = self._detect_storage_location(enrichment_result)

            # Create enrichment run audit record
            enrichment_run_id = self.audit_db.create_enrichment_run(
                upload_id=self.upload_id,
                line_id=line_id,
                mpn=mpn,
                manufacturer=manufacturer,
                supplier_name=supplier_name,
                successful=enrichment_result.success,
                quality_score=enrichment_result.quality_score,
                storage_location=storage_location,
                supplier_match_confidence=None,  # TODO: Extract from supplier response
                processing_time_ms=int(enrichment_result.processing_time_ms),
                error_message=enrichment_result.error if not enrichment_result.success else None,
            )

            if not enrichment_run_id:
                logger.warning(f"Failed to create enrichment run audit for {mpn}")
                return None

            # Add field-by-field comparison (if enabled and data available)
            if self.enable_field_comparison and supplier_data and normalized_data:
                self.audit_db.add_bulk_field_comparisons(
                    enrichment_run_id=enrichment_run_id,
                    supplier_data=supplier_data,
                    normalized_data=normalized_data,
                )

            # Auto-flag for review if quality issues detected
            if self.enable_auto_review_flagging:
                self._auto_flag_for_review(
                    enrichment_run_id=enrichment_run_id,
                    enrichment_result=enrichment_result
                )

            logger.debug(f"Logged enrichment audit: {enrichment_run_id} for {mpn}")
            return enrichment_run_id

        except Exception as e:
            # Don't fail enrichment if audit logging fails
            logger.error(f"Failed to log enrichment audit for {mpn}: {e}", exc_info=True)
            return None

    def _detect_storage_location(self, result: EnrichmentResult) -> str:
        """Auto-detect storage location based on quality score"""
        if result.quality_score >= 80:
            return "database"
        else:
            return "redis"

    def _auto_flag_for_review(
        self,
        enrichment_run_id: str,
        enrichment_result: EnrichmentResult
    ):
        """Auto-flag enrichment for review if quality issues detected"""
        reasons = []

        # Low quality score
        if enrichment_result.quality_score < 80:
            reasons.append(f"Quality score {enrichment_result.quality_score:.1f} below threshold (80)")

        # Enrichment failed
        if not enrichment_result.success:
            reasons.append("Enrichment failed")

        # No supplier data
        if 'suppliers' not in enrichment_result.tiers_used:
            reasons.append("No supplier data available")

        # Flag if any issues found
        if reasons:
            reason_text = "; ".join(reasons)
            self.audit_db.flag_for_review(
                enrichment_run_id=enrichment_run_id,
                reason=reason_text
            )


def with_audit_logging(upload_id: str, line_id: str):
    """
    Decorator to add audit logging to enrichment functions

    Usage:
        @with_audit_logging(upload_id="bulk_123", line_id="line_456")
        async def enrich_component(mpn, manufacturer, db):
            # ... enrichment logic ...
            return EnrichmentResult(...)

    Note: Function must accept 'db' parameter and return EnrichmentResult
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get db session from kwargs
            db = kwargs.get('db')
            if not db:
                # Try to find db in args (if passed positionally)
                for arg in args:
                    if isinstance(arg, Session):
                        db = arg
                        break

            if not db:
                logger.warning("No database session found, skipping audit logging")
                return await func(*args, **kwargs)

            # Execute enrichment
            start_time = time.time()
            result = await func(*args, **kwargs)
            processing_time_ms = int((time.time() - start_time) * 1000)
            result.processing_time_ms = processing_time_ms

            # Log to audit tables
            try:
                audit_wrapper = EnrichmentAuditWrapper(db, upload_id=upload_id)
                mpn = kwargs.get('mpn') or args[0] if len(args) > 0 else 'unknown'
                manufacturer = kwargs.get('manufacturer') or args[1] if len(args) > 1 else None

                audit_wrapper.log_enrichment(
                    line_id=line_id,
                    mpn=mpn,
                    manufacturer=manufacturer,
                    enrichment_result=result,
                )
            except Exception as e:
                logger.error(f"Audit logging failed: {e}", exc_info=True)

            return result

        return wrapper
    return decorator


# ============================================================================
# BATCH AUDIT LOGGING HELPER
# ============================================================================

class BatchAuditLogger:
    """
    Helper for batch enrichment operations

    Usage:
        batch_logger = BatchAuditLogger(db, upload_id="bulk_123")

        for line_item in line_items:
            result = await enrich_component(...)
            batch_logger.log(line_item['line_id'], result, supplier_data, normalized_data)

        # At end of batch
        batch_logger.finalize()
    """

    def __init__(self, db: Session, upload_id: str):
        self.db = db
        self.upload_id = upload_id
        self.audit_wrapper = EnrichmentAuditWrapper(db, upload_id=upload_id)

        # Statistics
        self.stats = {
            'total': 0,
            'logged': 0,
            'failed': 0,
            'flagged_for_review': 0,
        }

    def log(
        self,
        line_id: str,
        mpn: str,
        manufacturer: Optional[str],
        enrichment_result: EnrichmentResult,
        supplier_data: Optional[Dict[str, Any]] = None,
        normalized_data: Optional[Dict[str, Any]] = None,
        storage_location: Optional[str] = None
    ):
        """Log single enrichment operation"""
        self.stats['total'] += 1

        enrichment_run_id = self.audit_wrapper.log_enrichment(
            line_id=line_id,
            mpn=mpn,
            manufacturer=manufacturer,
            enrichment_result=enrichment_result,
            supplier_data=supplier_data,
            normalized_data=normalized_data,
            storage_location=storage_location
        )

        if enrichment_run_id:
            self.stats['logged'] += 1
        else:
            self.stats['failed'] += 1

    def finalize(self) -> Dict[str, int]:
        """
        Finalize batch logging and return statistics

        Returns:
            Statistics dict with total, logged, failed counts
        """
        # Update supplier quality stats for this batch date
        try:
            self.audit_wrapper.audit_db.update_supplier_quality_stats()
            logger.info(f"Updated supplier quality stats for {self.upload_id}")
        except Exception as e:
            logger.error(f"Failed to update supplier quality stats: {e}", exc_info=True)

        logger.info(f"Batch audit logging completed: {self.stats}")
        return self.stats
