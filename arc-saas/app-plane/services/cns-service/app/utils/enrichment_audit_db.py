"""
Enrichment Audit Trail - Database Writer for Directus

Writes enrichment audit data to PostgreSQL tables for Directus UI visualization.
Works alongside CSV export (enrichment_audit.py) for comprehensive auditing.

Tables:
- audit_enrichment_runs: Master record for each enrichment
- audit_field_comparisons: Field-by-field supplier vs normalized comparison
- audit_supplier_quality: Daily supplier quality aggregates
"""

import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class EnrichmentAuditDB:
    """Writes enrichment audit trail to PostgreSQL for Directus UI"""

    def __init__(self, db_session: Session, auto_commit: bool = True):
        """
        Initialize audit DB writer

        Args:
            db_session: SQLAlchemy database session (Components V2 DB)
            auto_commit: Whether to auto-commit after each operation (default True)
        """
        self.db = db_session
        self.auto_commit = auto_commit

    @contextmanager
    def transaction(self):
        """
        Transaction context manager for batch operations

        Usage:
            with audit_db.transaction():
                run_id = audit_db.create_enrichment_run(...)
                audit_db.add_field_comparison(...)
                # Commits on successful exit, rolls back on exception
        """
        try:
            yield self
            if not self.auto_commit:
                self.db.commit()
        except Exception as e:
            logger.error(f"Transaction failed, rolling back: {e}", exc_info=True)
            self.db.rollback()
            raise

    def commit(self):
        """Explicitly commit pending changes"""
        try:
            self.db.commit()
            logger.debug("Audit transaction committed")
        except Exception as e:
            logger.error(f"Failed to commit audit transaction: {e}", exc_info=True)
            self.db.rollback()
            raise

    def rollback(self):
        """Explicitly rollback pending changes"""
        try:
            self.db.rollback()
            logger.debug("Audit transaction rolled back")
        except Exception as e:
            logger.error(f"Failed to rollback audit transaction: {e}", exc_info=True)
            raise

    def create_enrichment_run(
        self,
        upload_id: str,
        line_id: str,
        mpn: str,
        manufacturer: Optional[str],
        supplier_name: str,
        successful: bool,
        quality_score: Optional[float] = None,
        storage_location: Optional[str] = None,
        supplier_match_confidence: Optional[float] = None,
        processing_time_ms: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> str:
        """
        Create master enrichment run record

        Args:
            upload_id: Bulk upload ID
            line_id: BOM line item ID
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            supplier_name: Supplier used (mouser/digikey/element14)
            successful: Whether enrichment succeeded
            quality_score: Quality score (0-100)
            storage_location: Where component saved ('database' or 'redis')
            supplier_match_confidence: Confidence from supplier (0-100)
            processing_time_ms: Processing time in milliseconds
            error_message: Error message if failed

        Returns:
            UUID of created enrichment run
        """
        try:
            run_id = str(uuid4())

            query = text("""
                INSERT INTO audit_enrichment_runs (
                    id, upload_id, line_id, mpn, manufacturer,
                    enrichment_timestamp, successful, quality_score,
                    storage_location, supplier_name, supplier_match_confidence,
                    processing_time_ms, error_message
                ) VALUES (
                    :id, :upload_id, :line_id, :mpn, :manufacturer,
                    NOW(), :successful, :quality_score,
                    :storage_location, :supplier_name, :supplier_match_confidence,
                    :processing_time_ms, :error_message
                )
            """)

            self.db.execute(query, {
                'id': run_id,
                'upload_id': upload_id,
                'line_id': line_id,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'successful': successful,
                'quality_score': quality_score,
                'storage_location': storage_location,
                'supplier_name': supplier_name,
                'supplier_match_confidence': supplier_match_confidence,
                'processing_time_ms': processing_time_ms,
                'error_message': error_message,
            })

            if self.auto_commit:
                self.db.commit()
            logger.debug(f"Created enrichment run audit: {run_id} for {mpn}")
            return run_id

        except Exception as e:
            logger.error(f"Failed to create enrichment run audit: {e}", exc_info=True)
            if self.auto_commit:
                self.db.rollback()
            raise

    def add_field_comparison(
        self,
        enrichment_run_id: str,
        field_name: str,
        supplier_value: Any,
        normalized_value: Any,
        field_category: Optional[str] = None,
        change_type: Optional[str] = None,
        change_reason: Optional[str] = None,
        confidence: Optional[float] = None,
        supplier_data_quality: Optional[str] = None,
    ) -> bool:
        """
        Add field-level comparison between supplier and normalized data

        Args:
            enrichment_run_id: UUID from create_enrichment_run()
            field_name: Name of field being compared
            supplier_value: Raw value from supplier API
            normalized_value: Value after normalization
            field_category: Category (compliance, technical, pricing, identification)
            change_type: Type of change (cleaned, mapped, extracted, unchanged, missing)
            change_reason: Human-readable explanation of why it changed
            confidence: Confidence in normalized value (0-100)
            supplier_data_quality: Quality assessment (good, incomplete, invalid, missing)

        Returns:
            True if saved successfully
        """
        try:
            # Convert values to strings for comparison
            supplier_str = self._value_to_string(supplier_value)
            normalized_str = self._value_to_string(normalized_value)
            changed = (supplier_str != normalized_str)

            # Auto-detect change type if not provided
            if not change_type:
                change_type = self._detect_change_type(supplier_str, normalized_str)

            # Auto-detect quality if not provided
            if not supplier_data_quality:
                supplier_data_quality = self._assess_data_quality(supplier_str)

            query = text("""
                INSERT INTO audit_field_comparisons (
                    id, enrichment_run_id, field_name, field_category,
                    supplier_value, normalized_value, changed,
                    change_type, change_reason, confidence,
                    supplier_data_quality, normalization_applied
                ) VALUES (
                    :id, :enrichment_run_id, :field_name, :field_category,
                    :supplier_value, :normalized_value, :changed,
                    :change_type, :change_reason, :confidence,
                    :supplier_data_quality, :normalization_applied
                )
            """)

            self.db.execute(query, {
                'id': str(uuid4()),
                'enrichment_run_id': enrichment_run_id,
                'field_name': field_name,
                'field_category': field_category,
                'supplier_value': supplier_str,
                'normalized_value': normalized_str,
                'changed': changed,
                'change_type': change_type,
                'change_reason': change_reason,
                'confidence': confidence,
                'supplier_data_quality': supplier_data_quality,
                'normalization_applied': changed,
            })

            if self.auto_commit:
                self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Failed to save field comparison for {field_name}: {e}", exc_info=True)
            if self.auto_commit:
                self.db.rollback()
            raise

    def add_bulk_field_comparisons(
        self,
        enrichment_run_id: str,
        supplier_data: Dict[str, Any],
        normalized_data: Dict[str, Any],
        field_categories: Optional[Dict[str, str]] = None,
    ) -> int:
        """
        Bulk add field comparisons for all fields in supplier and normalized data

        Args:
            enrichment_run_id: UUID from create_enrichment_run()
            supplier_data: Raw supplier API response data
            normalized_data: Normalized component data
            field_categories: Optional mapping of field_name → category

        Returns:
            Number of field comparisons added
        """
        count = 0

        # Get all unique field names from both datasets
        all_fields = set(supplier_data.keys()) | set(normalized_data.keys())

        # Default field categories
        if not field_categories:
            field_categories = self._get_default_field_categories()

        for field_name in all_fields:
            supplier_value = supplier_data.get(field_name)
            normalized_value = normalized_data.get(field_name)
            category = field_categories.get(field_name, 'other')

            success = self.add_field_comparison(
                enrichment_run_id=enrichment_run_id,
                field_name=field_name,
                supplier_value=supplier_value,
                normalized_value=normalized_value,
                field_category=category,
            )

            if success:
                count += 1

        logger.info(f"Added {count} field comparisons for enrichment run {enrichment_run_id}")
        return count

    def flag_for_review(
        self,
        enrichment_run_id: str,
        reason: str = "Quality issues detected"
    ) -> bool:
        """
        Flag enrichment run for manual review in Directus

        Args:
            enrichment_run_id: UUID of enrichment run
            reason: Reason for flagging

        Returns:
            True if flagged successfully
        """
        try:
            query = text("""
                UPDATE audit_enrichment_runs
                SET needs_review = TRUE,
                    review_notes = :reason
                WHERE id = :run_id
            """)

            self.db.execute(query, {
                'run_id': enrichment_run_id,
                'reason': reason,
            })

            if self.auto_commit:
                self.db.commit()
            logger.info(f"Flagged enrichment run {enrichment_run_id} for review: {reason}")
            return True

        except Exception as e:
            logger.error(f"Failed to flag enrichment run for review: {e}", exc_info=True)
            if self.auto_commit:
                self.db.rollback()
            raise

    def update_supplier_quality_stats(self, date: Optional[str] = None) -> bool:
        """
        Update daily supplier quality statistics

        Args:
            date: Date to update (YYYY-MM-DD), defaults to today

        Returns:
            True if updated successfully
        """
        try:
            if not date:
                date = datetime.now().date().isoformat()

            query = text("SELECT update_supplier_quality_stats(:date)")
            self.db.execute(query, {'date': date})

            if self.auto_commit:
                self.db.commit()

            logger.info(f"Updated supplier quality stats for {date}")
            return True

        except Exception as e:
            logger.error(f"Failed to update supplier quality stats: {e}", exc_info=True)
            if self.auto_commit:
                self.db.rollback()
            raise

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _value_to_string(self, value: Any) -> str:
        """Convert any value to string for comparison"""
        if value is None:
            return ''
        elif isinstance(value, bool):
            return 'true' if value else 'false'
        elif isinstance(value, (list, dict)):
            import json
            return json.dumps(value, sort_keys=True)
        else:
            return str(value).strip()

    def _detect_change_type(self, supplier_str: str, normalized_str: str) -> str:
        """Auto-detect type of change between supplier and normalized value"""
        if supplier_str == normalized_str:
            return 'unchanged'
        elif not supplier_str:
            return 'missing'
        elif not normalized_str:
            return 'removed'
        elif supplier_str.lower() == normalized_str.lower():
            return 'cleaned'  # Just case/whitespace changes
        else:
            return 'mapped'  # Value transformation

    def _assess_data_quality(self, supplier_str: str) -> str:
        """Assess quality of supplier data"""
        if not supplier_str:
            return 'missing'
        elif len(supplier_str) < 2:
            return 'incomplete'
        elif supplier_str.lower() in ['n/a', 'na', 'null', 'none', 'unknown', '-']:
            return 'invalid'
        else:
            return 'good'

    def _get_default_field_categories(self) -> Dict[str, str]:
        """Get default field category mappings"""
        return {
            # Identification
            'mpn': 'identification',
            'manufacturer': 'identification',
            'manufacturer_part_number': 'identification',
            'description': 'identification',
            'supplier_sku': 'identification',

            # Compliance
            'rohs_compliant': 'compliance',
            'reach_compliant': 'compliance',
            'halogen_free': 'compliance',
            'aec_qualified': 'compliance',
            'eccn_code': 'compliance',
            'hts_code': 'compliance',
            'country_of_origin': 'compliance',

            # Technical
            'category': 'technical',
            'subcategory': 'technical',
            'category_path': 'technical',
            'product_family': 'technical',
            'product_series': 'technical',
            'package': 'technical',
            'lifecycle_status': 'technical',
            'parameters': 'technical',
            'specifications': 'technical',

            # Pricing
            'unit_price': 'pricing',
            'currency': 'pricing',
            'price_breaks': 'pricing',
            'moq': 'pricing',

            # Availability
            'availability': 'availability',
            'stock_status': 'availability',
            'lead_time_days': 'availability',

            # Documentation
            'datasheet_url': 'documentation',
            'image_url': 'documentation',
            'model_3d_url': 'documentation',
        }


# ========================================================================
# CONTEXT MANAGER FOR AUTO-COMMIT
# ========================================================================

class AuditTransaction:
    """Context manager for audit operations with auto-commit"""

    def __init__(self, db_session: Session):
        self.audit_db = EnrichmentAuditDB(db_session)
        self.enrichment_run_id = None

    def __enter__(self) -> EnrichmentAuditDB:
        return self.audit_db

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Commit or rollback on exit"""
        if exc_type is None:
            try:
                self.audit_db.db.commit()
            except Exception as e:
                logger.error(f"Failed to commit audit transaction: {e}")
                self.audit_db.db.rollback()
        else:
            logger.error(f"Audit transaction failed: {exc_val}")
            self.audit_db.db.rollback()
