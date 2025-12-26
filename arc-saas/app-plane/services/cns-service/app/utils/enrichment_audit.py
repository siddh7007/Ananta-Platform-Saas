"""
Enrichment Audit Trail - CSV/S3 Export

Saves enrichment data to CSV files in MinIO for debugging and quality validation:
- Original BOM data
- Raw vendor API responses
- Normalized data
- Comparison summary

Files stored in MinIO: enrichment-audit/{job_id}/{file_name}.csv
"""

import csv
import io
import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.utils.minio_client import MinIOClient
from app.utils.directus_client import get_directus_file_service
from app.config import settings

logger = logging.getLogger(__name__)

# MinIO bucket for audit files
AUDIT_BUCKET = "enrichment-audit"


class EnrichmentAuditWriter:
    """Writes enrichment audit trail to CSV files in MinIO/S3"""

    def __init__(self):
        """Initialize MinIO client"""
        self.minio = MinIOClient()
        self.directus = get_directus_file_service()

        if self.minio.is_enabled():
            # Ensure audit bucket exists
            self.minio.ensure_bucket_exists(AUDIT_BUCKET)
            logger.info("Enrichment audit trail MinIO initialized")
        else:
            logger.warning("Enrichment audit trail disabled (MinIO not available)")

    def _is_enabled(self) -> bool:
        """
        Check if audit trail is enabled.

        Priority:
        1. Database enrichment_config (if available)
        2. Environment variable (fallback)
        3. Default: True

        Returns:
            True if audit trail is enabled
        """
        # First, try to get from database enrichment_config
        try:
            from sqlalchemy import text
            from app.models.dual_database import get_dual_database

            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            # Query active enrichment config
            query = text("""
                SELECT enable_enrichment_audit
                FROM enrichment_config
                WHERE is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            """)

            result = db.execute(query)
            row = result.fetchone()

            if row and hasattr(row, 'enable_enrichment_audit'):
                enabled = row.enable_enrichment_audit
                logger.debug(f"Audit trail enabled from database config: {enabled}")
                return enabled
        except Exception as e:
            logger.debug(f"Could not load audit setting from database, using env variable: {e}")

        # Fallback to environment variable
        enabled = settings.enable_enrichment_audit if hasattr(settings, 'enable_enrichment_audit') else True
        logger.debug(f"Audit trail enabled from environment: {enabled}")
        return enabled

    def _register_directus_file(
        self,
        object_name: str,
        title: str,
        description: Optional[str] = None,
    ) -> None:
        """Register a MinIO object in Directus for download visibility."""
        try:
            if not self.directus or not self.directus.is_enabled():
                return

            filename = object_name.split('/')[-1]
            job_id = object_name.split('/')[0] if '/' in object_name else None
            metadata = {}
            if job_id:
                metadata['job_id'] = job_id

            self.directus.register_minio_object(
                bucket=AUDIT_BUCKET,
                object_key=object_name,
                filename_download=filename,
                title=title,
                description=description,
                content_type='text/csv',
                metadata=metadata,
            )
        except Exception as exc:
            logger.debug(f"Directus registration skipped for {object_name}: {exc}")

    def save_bom_original(self, job_id: str, line_items: List[Dict[str, Any]]) -> bool:
        """
        Save original BOM upload data to CSV.

        Args:
            job_id: Job/BOM identifier
            line_items: List of original BOM line items

        Returns:
            True if saved successfully
        """
        if not self._is_enabled() or not self.minio.is_enabled():
            return False

        try:
            # Build CSV in memory
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=[
                'line_id', 'mpn', 'manufacturer', 'quantity',
                'reference_designator', 'description', 'notes'
            ])
            writer.writeheader()

            for item in line_items:
                writer.writerow({
                    'line_id': item.get('id') or item.get('line_id'),
                    'mpn': item.get('manufacturer_part_number') or item.get('mpn', ''),
                    'manufacturer': item.get('manufacturer', ''),
                    'quantity': item.get('quantity', ''),
                    'reference_designator': item.get('reference_designator', ''),
                    'description': item.get('description', ''),
                    'notes': item.get('notes', '')
                })

            # Upload to MinIO
            csv_bytes = output.getvalue().encode('utf-8')
            label = self._build_bom_label(job_id)
            object_name = f"{job_id}/bom_original-{label}.csv"

            success, error = self.minio.upload_file(
                bucket=AUDIT_BUCKET,
                object_name=object_name,
                file_data=csv_bytes,
                content_type='text/csv'
            )

            if success:
                logger.info(f"✅ Saved BOM original: {object_name} ({len(line_items)} items)")
                self._register_directus_file(
                    object_name=object_name,
                    title=f"BOM Original ({job_id})",
                    description="Original BOM data captured before enrichment",
                )
            else:
                logger.error(f"❌ Failed to save BOM original: {error}")

            return success

        except Exception as e:
            logger.error(f"Error saving BOM original: {e}", exc_info=True)
            return False

    def save_vendor_response(
        self,
        job_id: str,
        line_id: str,
        mpn: str,
        manufacturer: str,
        vendor_name: str,
        vendor_data: Dict[str, Any]
    ) -> bool:
        """
        Append vendor API response to CSV (one row per enrichment).

        Args:
            job_id: Job identifier
            line_id: Line item ID
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            vendor_name: Vendor name (mouser, digikey, etc.)
            vendor_data: Raw vendor response data

        Returns:
            True if saved successfully
        """
        if not self._is_enabled() or not self.minio.is_enabled():
            return False

        try:
            # Create row data
            row_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'line_id': line_id,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'vendor': vendor_name,
                # Basic fields
                'raw_category': vendor_data.get('category', ''),
                'raw_description': vendor_data.get('description', ''),
                'raw_unit_price': vendor_data.get('unit_price', ''),
                'raw_currency': vendor_data.get('currency', ''),
                'raw_availability': vendor_data.get('availability', ''),
                'raw_lifecycle': vendor_data.get('lifecycle_status', ''),
                'raw_datasheet_url': vendor_data.get('datasheet_url', ''),
                # NEW: All additional Mouser fields
                'raw_image_url': vendor_data.get('image_url', ''),
                'raw_model_3d_url': vendor_data.get('model_3d_url', ''),
                'raw_lead_time_days': vendor_data.get('lead_time_days', ''),
                'raw_package': vendor_data.get('package', ''),
                'raw_rohs_compliant': vendor_data.get('rohs_compliant', ''),
                'raw_reach_compliant': vendor_data.get('reach_compliant', ''),
                'raw_halogen_free': vendor_data.get('halogen_free', ''),
                'raw_aec_qualified': vendor_data.get('aec_qualified', ''),
                'raw_eccn_code': vendor_data.get('eccn_code', ''),
                'raw_supplier_sku': vendor_data.get('supplier_sku', ''),
                'raw_supplier_url': vendor_data.get('supplier_url', ''),
                'raw_match_confidence': vendor_data.get('match_confidence', ''),
                'raw_price_breaks_count': len(vendor_data.get('price_breaks', [])),
                'raw_parameters_count': len(vendor_data.get('parameters', {})),
                'raw_parameters_json': json.dumps(vendor_data.get('parameters', {}), default=str),
                'raw_price_breaks_json': json.dumps(vendor_data.get('price_breaks', []), default=str),
                'raw_full_json': json.dumps(vendor_data, default=str)  # Full JSON for deep analysis
            }

            # Write as individual JSON object (no race conditions)
            success = self._write_audit_object(job_id, line_id, 'vendor_responses', row_data)

            if success:
                logger.debug(f"✅ Saved vendor response: {vendor_name}/{mpn}")

            return success

        except Exception as e:
            logger.error(f"Error saving vendor response: {e}", exc_info=True)
            return False

    def save_normalized_data(
        self,
        job_id: str,
        line_id: str,
        mpn: str,
        manufacturer: str,
        normalized_data: Dict[str, Any]
    ) -> bool:
        """
        Append normalized enrichment data to CSV.

        Args:
            job_id: Job identifier
            line_id: Line item ID
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            normalized_data: Normalized enrichment data

        Returns:
            True if saved successfully
        """
        if not self._is_enabled() or not self.minio.is_enabled():
            return False

        try:
            # Create row data
            row_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'line_id': line_id,
                'mpn': mpn,
                'manufacturer': manufacturer,
                # Basic fields
                'normalized_category': normalized_data.get('category', ''),
                'normalized_description': normalized_data.get('description', ''),
                'normalized_unit_price': normalized_data.get('unit_price', ''),
                'normalized_currency': normalized_data.get('currency', ''),
                'normalized_lifecycle': normalized_data.get('lifecycle_status', ''),
                'normalized_package': normalized_data.get('package', ''),
                # NEW: All additional normalized fields
                'normalized_datasheet_url': normalized_data.get('datasheet_url', ''),
                'normalized_image_url': normalized_data.get('image_url', ''),
                'normalized_model_3d_url': normalized_data.get('model_3d_url', ''),
                'normalized_availability': normalized_data.get('availability', ''),
                'normalized_stock_status': normalized_data.get('stock_status', ''),
                'normalized_moq': normalized_data.get('moq', ''),
                'normalized_lead_time_days': normalized_data.get('lead_time_days', ''),
                'normalized_rohs_compliant': normalized_data.get('rohs_compliant', ''),
                'normalized_reach_compliant': normalized_data.get('reach_compliant', ''),
                'normalized_halogen_free': normalized_data.get('halogen_free', ''),
                'normalized_aec_qualified': normalized_data.get('aec_qualified', ''),
                'normalized_eccn_code': normalized_data.get('eccn_code', ''),
                'normalized_price_breaks_count': len(normalized_data.get('price_breaks', [])),
                'normalized_parameters_count': len(normalized_data.get('parameters', {})) if 'parameters' in normalized_data else len(normalized_data.get('extracted_specs', {})),
                'normalized_match_confidence': normalized_data.get('match_confidence', ''),
                'quality_score': normalized_data.get('quality_score', 0),
                'enrichment_source': normalized_data.get('enrichment_source', ''),
                'api_source': normalized_data.get('api_source', ''),
                'normalized_parameters_json': json.dumps(normalized_data.get('parameters', normalized_data.get('extracted_specs', {})), default=str),
                'normalized_price_breaks_json': json.dumps(normalized_data.get('price_breaks', []), default=str),
                'normalized_full_json': json.dumps(normalized_data, default=str)
            }

            # Write as individual JSON object (no race conditions)
            success = self._write_audit_object(job_id, line_id, 'normalized_data', row_data)

            if success:
                logger.debug(f"✅ Saved normalized data: {mpn}")

            return success

        except Exception as e:
            logger.error(f"Error saving normalized data: {e}", exc_info=True)
            return False

    def save_comparison_summary(
        self,
        job_id: str,
        line_id: str,
        mpn: str,
        manufacturer: str,
        vendor_name: str,
        quality_score: float,
        changes_made: List[str],
        storage_location: str
    ) -> bool:
        """
        Append comparison summary row (vendor vs normalized).

        Args:
            job_id: Job identifier
            line_id: Line item ID
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            vendor_name: Vendor source
            quality_score: Calculated quality score
            changes_made: List of normalization changes
            storage_location: 'database' or 'redis'

        Returns:
            True if saved successfully
        """
        if not self._is_enabled() or not self.minio.is_enabled():
            return False

        try:
            row_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'line_id': line_id,
                'mpn': mpn,
                'manufacturer': manufacturer,
                'vendor': vendor_name,
                'quality_score': quality_score,
                'changes_made': ','.join(changes_made),
                'storage_location': storage_location,
                'normalization_date': datetime.utcnow().isoformat()
            }

            # Write as individual JSON object (no race conditions)
            success = self._write_audit_object(job_id, line_id, 'comparison_summary', row_data)

            if success:
                logger.debug(f"✅ Saved comparison summary: {mpn} (quality={quality_score})")

            return success

        except Exception as e:
            logger.error(f"Error saving comparison summary: {e}", exc_info=True)
            return False

    def _write_audit_object(
        self,
        job_id: str,
        line_id: str,
        audit_type: str,
        data: Dict[str, Any]
    ) -> bool:
        """
        Write individual audit object (per-line, no race conditions).

        Objects are stored as JSON files and combined into CSVs at workflow completion.

        Args:
            job_id: Job/BOM ID
            line_id: Line item ID
            audit_type: Type of audit data (vendor_responses, normalized_data, comparison_summary)
            data: Data to write

        Returns:
            True if successful
        """
        try:
            # Object path: {job_id}/_objects/{audit_type}/{line_id}.json
            object_name = f"{job_id}/_objects/{audit_type}/{line_id}.json"

            # Serialize to JSON
            json_data = json.dumps(data, default=str)
            json_bytes = json_data.encode('utf-8')

            # Upload to MinIO
            success, error = self.minio.upload_file(
                bucket=AUDIT_BUCKET,
                object_name=object_name,
                file_data=json_bytes,
                content_type='application/json'
            )

            if success:
                logger.debug(f"💾 Wrote audit object: {audit_type}/{line_id}")
            else:
                logger.error(f"Failed to write audit object: {error}")

            return success

        except Exception as e:
            logger.error(f"Error writing audit object: {e}", exc_info=True)
            return False

    def finalize_audit_csvs(self, job_id: str) -> bool:
        """
        Combine individual JSON objects into final CSV files.

        Call this at workflow completion to generate downloadable CSVs.

        Args:
            job_id: Job/BOM ID

        Returns:
            True if successful
        """
        if not self._is_enabled() or not self.minio.is_enabled():
            return False

        logger.info(f"📊 Finalizing audit CSVs for job: {job_id}")

        try:
            # Finalize each audit type
            audit_types = {
                'vendor_responses': [
                    'timestamp', 'line_id', 'mpn', 'manufacturer', 'vendor',
                    'raw_category', 'raw_description', 'raw_unit_price', 'raw_currency',
                    'raw_availability', 'raw_lifecycle', 'raw_datasheet_url',
                    'raw_image_url', 'raw_model_3d_url', 'raw_lead_time_days', 'raw_package',
                    'raw_rohs_compliant', 'raw_reach_compliant', 'raw_halogen_free', 'raw_aec_qualified',
                    'raw_eccn_code', 'raw_supplier_sku', 'raw_supplier_url', 'raw_match_confidence',
                    'raw_price_breaks_count', 'raw_parameters_count',
                    'raw_parameters_json', 'raw_price_breaks_json', 'raw_full_json'
                ],
                'normalized_data': [
                    'timestamp', 'line_id', 'mpn', 'manufacturer',
                    'normalized_category', 'normalized_description', 'normalized_unit_price',
                    'normalized_currency', 'normalized_lifecycle', 'normalized_package',
                    'normalized_datasheet_url', 'normalized_image_url', 'normalized_model_3d_url',
                    'normalized_availability', 'normalized_stock_status', 'normalized_moq',
                    'normalized_lead_time_days', 'normalized_rohs_compliant', 'normalized_reach_compliant',
                    'normalized_halogen_free', 'normalized_aec_qualified', 'normalized_eccn_code',
                    'normalized_price_breaks_count', 'normalized_parameters_count', 'normalized_match_confidence',
                    'quality_score', 'enrichment_source', 'api_source',
                    'normalized_parameters_json', 'normalized_price_breaks_json', 'normalized_full_json'
                ],
                'comparison_summary': [
                    'timestamp', 'line_id', 'mpn', 'manufacturer', 'vendor',
                    'quality_score', 'changes_made', 'storage_location', 'normalization_date'
                ]
            }

            label = self._build_bom_label(job_id)

            for audit_type, fieldnames in audit_types.items():
                # List all JSON objects for this audit type
                prefix = f"{job_id}/_objects/{audit_type}/"
                objects = self.minio.list_objects(AUDIT_BUCKET, prefix)

                if not objects:
                    logger.warning(f"No objects found for {audit_type}, skipping CSV generation")
                    continue

                # Collect all rows
                rows = []
                for obj_name in objects:
                    try:
                        json_bytes = self.minio.download_file(AUDIT_BUCKET, obj_name)
                        if json_bytes:
                            row_data = json.loads(json_bytes.decode('utf-8'))
                            rows.append(row_data)
                    except Exception as e:
                        logger.warning(f"Failed to read object {obj_name}: {e}")

                if not rows:
                    logger.warning(f"No valid rows for {audit_type}, skipping CSV")
                    continue

                # Generate CSV
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

                # Upload CSV
                csv_bytes = output.getvalue().encode('utf-8')
                csv_object_name = f"{job_id}/{audit_type}-{label}.csv"

                success, error = self.minio.upload_file(
                    bucket=AUDIT_BUCKET,
                    object_name=csv_object_name,
                    file_data=csv_bytes,
                    content_type='text/csv'
                )

                if success:
                    logger.info(f"✅ Generated {audit_type}.csv ({len(rows)} rows)")
                    self._register_directus_file(
                        object_name=csv_object_name,
                        title=f"{audit_type.replace('_', ' ').title()} ({job_id})",
                        description=f"{audit_type} audit CSV for job {job_id}",
                    )
                else:
                    logger.error(f"❌ Failed to upload {audit_type}.csv: {error}")

            logger.info(f"✅ Finalized all audit CSVs for job: {job_id}")
            return True

        except Exception as e:
            logger.error(f"Error finalizing audit CSVs: {e}", exc_info=True)
            return False

    def _append_to_csv(self, object_name: str, row_data: Dict[str, Any], fieldnames: List[str]) -> bool:
        """
        DEPRECATED: Use _write_audit_object + finalize_audit_csvs instead.

        This method has race conditions when multiple workers write concurrently.
        Kept for backward compatibility only.

        Args:
            object_name: S3 object path
            row_data: Row to append
            fieldnames: CSV column names

        Returns:
            True if successful
        """
        logger.warning("_append_to_csv is deprecated, use _write_audit_object + finalize_audit_csvs instead")
        try:
            # Try to download existing file
            existing_content = None
            try:
                existing_content = self.minio.download_file(AUDIT_BUCKET, object_name)
            except:
                # File doesn't exist yet, will create new
                pass

            # Build CSV content
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=fieldnames)

            if existing_content:
                # Append to existing
                output.write(existing_content.decode('utf-8'))
            else:
                # New file, write header
                writer.writeheader()

            # Append new row
            writer.writerow(row_data)

            # Upload back to MinIO
            csv_bytes = output.getvalue().encode('utf-8')
            success, error = self.minio.upload_file(
                bucket=AUDIT_BUCKET,
                object_name=object_name,
                file_data=csv_bytes,
                content_type='text/csv'
            )

            if not success:
                logger.error(f"Failed to upload CSV: {error}")

            return success

        except Exception as e:
            logger.error(f"Error appending to CSV: {e}", exc_info=True)
            return False

    def _build_bom_label(self, job_id: str) -> str:
        """Build a human-friendly label for a BOM.

        Combines BOM name (when available) with the BOM/job ID to make
        audit filenames self-explanatory, e.g.:

            comparison_summary-My_Project_BOM-<bom_id>.csv

        If the BOM name cannot be resolved, falls back to just the ID.
        """
        label_id = job_id
        bom_name: Optional[str] = None

        # Best-effort lookup of BOM name from Supabase. Any failure
        # simply results in using the ID-only label.
        try:
            from sqlalchemy import text
            from app.models.dual_database import get_dual_database

            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))
            try:
                result = db.execute(
                    text("SELECT name FROM boms WHERE id = :id LIMIT 1"),
                    {"id": job_id},
                )
                row = result.fetchone()
                if row is not None:
                    # row may be Row or mapping; support both
                    if hasattr(row, "name"):
                        bom_name = row.name
                    else:
                        mapping = getattr(row, "_mapping", None)
                        if mapping and "name" in mapping:
                            bom_name = mapping["name"]
            finally:
                try:
                    next(dual_db.get_session("supabase"))
                except StopIteration:
                    pass
        except Exception:
            logger.debug(
                "Could not resolve BOM name for audit label; using ID only",
                exc_info=True,
            )

        if not bom_name:
            return label_id

        # Sanitize BOM name for use in filenames
        safe = bom_name.strip()
        safe = safe.replace(" ", "_")
        safe = re.sub(r"[^A-Za-z0-9_\-]+", "", safe)
        safe = safe[:40] or label_id

        return f"{safe}-{label_id}"

    def get_label(self, job_id: str) -> str:
        """Return the human-friendly label used for audit filenames"""
        return self._build_bom_label(job_id)


# Global singleton instance
_audit_writer: Optional[EnrichmentAuditWriter] = None


def get_audit_writer() -> EnrichmentAuditWriter:
    """Get global audit writer instance"""
    global _audit_writer
    if _audit_writer is None:
        _audit_writer = EnrichmentAuditWriter()
    return _audit_writer
