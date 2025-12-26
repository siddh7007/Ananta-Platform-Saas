"""
Audit Field-Diff Worker

Listens for `customer.bom.audit_ready`, downloads the audit CSVs, and
produces a side-by-side field-diff report to make it easier to see what
changed during enrichment.

MIGRATION STATUS: Refactored to use BaseRStreamConsumer (RabbitMQ Streams)
"""

import csv
import io
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import sys
from pathlib import Path

from app.workers.base_consumer import BaseRStreamConsumer
from app.utils.minio_client import get_minio_client

# Add repo root to path for shared imports
repo_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(repo_root))
from shared.event_bus import EventPublisher

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

AUDIT_BUCKET = "enrichment-audit"
FIELD_DIFF_FILENAME_TEMPLATE = "field_diff-{label}.csv"


class AuditFieldDiffWorker(BaseRStreamConsumer):
    """RabbitMQ Streams consumer that builds the audit field-diff CSV"""

    def __init__(self):
        super().__init__(
            stream='stream.platform.bom',
            consumer_name='audit-field-diff-consumer',
            routing_keys='customer.bom.audit_ready'
        )

    async def handle_message(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle customer.bom.audit_ready event.

        Args:
            event_data: Parsed message data
            routing_key: Message routing key
            priority: Message priority (0-255)

        Returns:
            (success: bool, error_type: str)
            - success: True if processed successfully
            - error_type: 'transient' (requeue) or 'permanent' (drop) on failure
        """
        try:
            job_id = event_data.get('job_id')
            bom_id = event_data.get('bom_id')
            label = event_data.get('label')
            files = event_data.get('files', [])

            if not job_id or not bom_id or not label:
                logger.warning("Invalid audit_ready payload (missing required fields), dropping message")
                return (False, 'permanent')

            logger.info(f"📥 Received audit_ready event for {job_id}")

            success = await self._process_payload(event_data)
            if success:
                return (True, '')
            else:
                logger.warning(f"Failed to process audit_ready event for {job_id}, will retry")
                return (False, 'transient')

        except Exception as exc:
            logger.error(f"Failed to handle audit_ready message: {exc}", exc_info=True)
            return (False, 'transient')

    async def _process_payload(self, payload: Dict[str, Any]) -> bool:
        job_id = payload.get("job_id")
        bom_id = payload.get("bom_id")
        label = payload.get("label")
        bucket = payload.get("bucket", AUDIT_BUCKET)
        prefix = payload.get("prefix", job_id)
        files = payload.get("files", [])

        if not job_id or not bom_id or not label:
            logger.warning("Invalid audit_ready payload, skipping field-diff generation")
            return False

        minio = get_minio_client()
        if not minio.is_enabled():
            logger.error("MinIO is not available, cannot build field diff")
            return False

        original_key = self._find_original_file(job_id, label, files)
        if not original_key:
            logger.warning("Original BOM audit CSV not provided, skipping diff")
            return False

        original_data = self._load_original_rows(bucket, job_id, original_key)
        normalized_data = self._load_normalized_objects(bucket, job_id)
        comparison_data = self._load_comparison_summaries(bucket, job_id)
        if not original_data and not normalized_data:
            logger.warning("No audit data available to build field diff")
            return False

        rows = self._build_diff_rows(original_data, normalized_data, comparison_data)
        if not rows:
            logger.warning("No diff rows generated")
            return False

        diff_filename = FIELD_DIFF_FILENAME_TEMPLATE.format(label=label)
        diff_object_key = f"{job_id}/{diff_filename}"
        if self._upload_diff_csv(bucket, diff_object_key, rows):
            EventPublisher.customer_bom_field_diff_ready(job_id, bom_id, label, diff_object_key)
            logger.info(f"✅ Field-diff report uploaded: {diff_object_key}")
            return True

        return False

    def _find_original_file(self, job_id: str, label: str, files: List[str]) -> Optional[str]:
        search = [f for f in files if f.startswith("bom_original")]
        if search:
            return search[0]
        return f"bom_original-{label}.csv"

    def _download_with_retry(self, bucket: str, object_path: str, max_retries: int = 3) -> Optional[bytes]:
        """Download file from MinIO with exponential backoff retry logic"""
        minio = get_minio_client()
        delay = 0.5
        for attempt in range(max_retries):
            try:
                data = minio.download_file(bucket, object_path)
                if data:
                    return data
                logger.warning(f"MinIO returned empty data for {object_path}, attempt {attempt + 1}/{max_retries}")
            except Exception as exc:
                logger.warning(f"MinIO download failed (attempt {attempt + 1}/{max_retries}): {exc}")
            
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 10)  # Cap backoff at 10 seconds
        
        return None

    def _load_original_rows(self, bucket: str, job_id: str, object_name: str) -> Dict[str, Dict[str, str]]:
        object_path = f"{job_id}/{object_name}"
        data = self._download_with_retry(bucket, object_path, max_retries=3)
        if not data:
            logger.warning(f"Failed to download original BOM CSV after retries: {object_path}")
            return {}
        try:
            decoded = data.decode("utf-8")
            reader = csv.DictReader(io.StringIO(decoded))
            rows = {}
            for row in reader:
                line_id = row.get("line_id")
                if line_id:
                    rows[line_id] = row
            return rows
        except Exception as exc:
            logger.error(f"Failed to parse original BOM CSV: {exc}")
            return {}

    def _load_normalized_objects(self, bucket: str, job_id: str) -> Dict[str, Dict[str, Any]]:
        minio = get_minio_client()
        prefix = f"{job_id}/_objects/normalized_data/"
        objects = minio.list_objects(bucket, prefix)
        data = {}
        for obj_path in objects:
            if not obj_path.endswith(".json"):
                continue
            json_bytes = self._download_with_retry(bucket, obj_path, max_retries=3)
            if not json_bytes:
                logger.warning(f"Skipping normalized object after failed retries: {obj_path}")
                continue
            try:
                record = json.loads(json_bytes.decode("utf-8"))
                line_id = record.get("line_id")
                if not line_id:
                    logger.warning(f"Normalized object missing line_id: {obj_path}")
                    continue
                data[line_id] = record
            except Exception as exc:
                logger.error(f"Failed to parse normalized object {obj_path}: {exc}")
        return data

    def _load_comparison_summaries(self, bucket: str, job_id: str) -> Dict[str, Dict[str, Any]]:
        minio = get_minio_client()
        prefix = f"{job_id}/_objects/comparison_summary/"
        objects = minio.list_objects(bucket, prefix)
        data = {}
        for obj_path in objects:
            if not obj_path.endswith(".json"):
                continue
            json_bytes = self._download_with_retry(bucket, obj_path, max_retries=3)
            if not json_bytes:
                logger.warning(f"Skipping comparison object after failed retries: {obj_path}")
                continue
            try:
                record = json.loads(json_bytes.decode("utf-8"))
                line_id = record.get("line_id")
                if not line_id:
                    logger.warning(f"Comparison object missing line_id: {obj_path}")
                    continue
                data[line_id] = record
            except Exception as exc:
                logger.error(f"Failed to parse comparison object {obj_path}: {exc}")
        return data

    def _build_diff_rows(
        self,
        original_rows: Dict[str, Dict[str, str]],
        normalized_rows: Dict[str, Dict[str, Any]],
        comparison_rows: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build diff rows with change detection and validation"""
        line_ids = set(original_rows.keys()) | set(normalized_rows.keys())
        diff_rows = []
        for line_id in sorted(line_ids):
            original = original_rows.get(line_id, {})
            normalized = normalized_rows.get(line_id, {})
            comparison = comparison_rows.get(line_id, {})
            
            # Extract key fields with defaults
            original_mpn = original.get("mpn", "").strip()
            normalized_mpn = normalized.get("mpn", "").strip()
            original_mfg = original.get("manufacturer", "").strip()
            normalized_mfg = normalized.get("manufacturer", "").strip()
            original_rd = original.get("reference_designator", "").strip()
            normalized_rd = normalized.get("reference_designator", "").strip()
            original_desc = original.get("description", "").strip()
            normalized_desc = normalized.get("normalized_description", "").strip()
            
            # Change detection: only include rows where something changed
            has_changes = (
                original_mpn != normalized_mpn or
                original_mfg != normalized_mfg or
                original_rd != normalized_rd or
                original_desc != normalized_desc or
                bool(comparison.get("changes_made"))
            )
            
            if not has_changes:
                continue  # Skip unchanged rows
            
            # Validate required fields
            if not line_id:
                logger.warning("Diff row missing line_id, skipping")
                continue
            
            diff_rows.append(
                {
                    "line_id": line_id,
                    "mpn_original": original_mpn,
                    "mpn_normalized": normalized_mpn,
                    "manufacturer_original": original_mfg,
                    "manufacturer_normalized": normalized_mfg,
                    "reference_designator_original": original_rd,
                    "reference_designator_normalized": normalized_rd,
                    "description_original": original_desc,
                    "description_normalized": normalized_desc,
                    "quantity_original": original.get("quantity", "").strip(),
                    "changes_made": comparison.get("changes_made", ""),
                    "quality_score": comparison.get("quality_score") or normalized.get("quality_score", ""),
                    "match_confidence": normalized.get("normalized_match_confidence", ""),
                    "enrichment_source": normalized.get("enrichment_source", ""),
                    "comparison_storage": comparison.get("storage_location", ""),
                }
            )
        
        logger.info(f"Built {len(diff_rows)} diff rows from {len(line_ids)} total line items")
        return diff_rows

    def _upload_diff_csv(self, bucket: str, object_key: str, rows: List[Dict[str, Any]]) -> bool:
        """Upload diff CSV with validation and retry logic"""
        if not rows:
            logger.warning("No rows to upload for field-diff CSV")
            return False
        
        minio = get_minio_client()
        output = io.StringIO()
        fieldnames = [
            "line_id",
            "mpn_original",
            "mpn_normalized",
            "manufacturer_original",
            "manufacturer_normalized",
            "reference_designator_original",
            "reference_designator_normalized",
            "description_original",
            "description_normalized",
            "quantity_original",
            "changes_made",
            "quality_score",
            "match_confidence",
            "enrichment_source",
            "comparison_storage",
        ]
        
        try:
            writer = csv.DictWriter(output, fieldnames=fieldnames, restval="")
            writer.writeheader()
            
            # Validate each row before writing
            valid_rows = 0
            for row in rows:
                if "line_id" not in row or not row["line_id"]:
                    logger.warning(f"Skipping row with missing line_id")
                    continue
                # Ensure all fields are strings
                row_sanitized = {k: str(v) if v is not None else "" for k, v in row.items()}
                writer.writerow(row_sanitized)
                valid_rows += 1
            
            if valid_rows == 0:
                logger.error("No valid rows to write to CSV")
                return False
            
            csv_bytes = output.getvalue().encode("utf-8")
            
            # Upload with retry
            success, error = self._upload_with_retry(bucket, object_key, csv_bytes, max_retries=3)
            if success:
                logger.info(f"✅ Uploaded field-diff CSV with {valid_rows} rows: {object_key}")
            else:
                logger.error(f"Failed to upload field-diff CSV after retries: {error}")
            return success
        except Exception as exc:
            logger.error(f"Failed to generate field-diff CSV: {exc}", exc_info=True)
            return False

    def _upload_with_retry(self, bucket: str, object_key: str, data: bytes, max_retries: int = 3) -> tuple:
        """Upload file to MinIO with exponential backoff retry logic"""
        minio = get_minio_client()
        delay = 0.5
        for attempt in range(max_retries):
            try:
                success, error = minio.upload_file(bucket, object_key, data, content_type="text/csv")
                if success:
                    return True, None
                logger.warning(f"MinIO upload returned failure (attempt {attempt + 1}/{max_retries}): {error}")
            except Exception as exc:
                logger.warning(f"MinIO upload exception (attempt {attempt + 1}/{max_retries}): {exc}")
            
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 10)
        
        return False, "Max retries exceeded for MinIO upload"


async def main():
    """Main entry point"""
    consumer = AuditFieldDiffWorker()
    await consumer.start()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
