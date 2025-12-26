"""BOM Ingest Helpers

Shared helpers for creating BOMs and line items in Supabase and
optionally seeding Redis for staff bulk uploads.

These functions centralize logic that was previously embedded in
`bulk_upload.py` so it can be reused by new APIs and workflows
without duplicating behavior.
"""

from __future__ import annotations

import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.utils.bulk_upload_redis import get_bulk_upload_storage

logger = logging.getLogger(__name__)


def build_line_items_from_rows(
    rows: List[Dict[str, Any]],
    *,
    organization_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Build normalized line items from parsed row dicts.

    This helper mirrors the mapping logic used in `bulk_upload.py` where
    rows are dictionaries keyed by original column names. It performs a
    case-insensitive mapping to common BOM fields and sets sensible
    defaults for enrichment.

    Args:
        rows: Parsed row dictionaries.
        organization_id: Optional organization ID (not stored directly here but
            useful for logging / future extensions).

    Returns:
        List of normalized line item dicts ready for Supabase/Redis.
    """

    from uuid import uuid4
    import pandas as pd

    line_items: List[Dict[str, Any]] = []

    for idx, row in enumerate(rows):
        row_dict = dict(row)
        line_item: Dict[str, Any] = {
            "id": str(uuid4()),
            "line_number": idx + 1,
            "metadata": row_dict,
            "quantity": 1,
            "enrichment_status": "pending",
            "match_status": "unmatched",
        }

        # Case-insensitive source keys
        # Normalize: lowercase + replace spaces with underscores to handle "Part Number" → "part_number"
        lower = {k.lower().replace(' ', '_'): v for k, v in row_dict.items()}

        # Manufacturer part number
        for col in [
            "mpn",
            "part_number",
            "partnumber",
            "part",
            "manufacturer_part_number",
        ]:
            if col in lower and pd.notna(lower[col]):
                line_item["manufacturer_part_number"] = str(lower[col])
                break

        if "manufacturer_part_number" not in line_item:
            # Skip rows we cannot enrich
            logger.debug(
                "[bom_ingest] Skipping row %s (no part number, organization=%s)",
                idx + 1,
                organization_id,
            )
            continue

        # Manufacturer
        for col in ["manufacturer", "mfr", "mfg"]:
            if col in lower and pd.notna(lower[col]):
                line_item["manufacturer"] = str(lower[col])
                break

        # Quantity
        for col in ["quantity", "qty", "qnty"]:
            if col in lower and pd.notna(lower[col]):
                try:
                    line_item["quantity"] = float(lower[col])
                except (ValueError, TypeError):
                    line_item["quantity"] = 1
                break

        # Reference designator
        for col in [
            "reference",
            "ref",
            "designator",
            "refdes",
            "reference_designator",
        ]:
            if col in lower and pd.notna(lower[col]):
                line_item["reference_designator"] = str(lower[col])
                break

        # Description
        for col in ["description", "desc"]:
            if col in lower and pd.notna(lower[col]):
                line_item["description"] = str(lower[col])
                break

        line_items.append(line_item)

    return line_items


def create_supabase_bom_and_items(
    db: Session,
    *,
    bom_id: str,
    organization_id: str,
    project_id: Optional[str],
    bom_name: str,
    upload_id: str,
    filename: str,
    s3_bucket: str,
    s3_key: str,
    line_items: List[Dict[str, Any]],
    source: str,
    uploaded_by: Optional[str],
) -> Tuple[int, Optional[Exception]]:
    """Create BOM + line items in Supabase.

    This helper centralizes the BOM insert + line item inserts. It is
    equivalent to the logic previously in `bulk_upload.py` step 7.5.

    Returns the number of line items saved and an optional exception if
    anything failed (in which case the transaction is rolled back).
    """

    from sqlalchemy.exc import SQLAlchemyError

    line_items_saved = 0

    try:
        logger.info(
            "[bom_ingest] Creating Supabase BOM %s for organization %s (source=%s)",
            bom_id,
            organization_id,
            source,
        )

        bom_insert = text(
            """
            INSERT INTO boms (
                id,
                name,
                organization_id,
                project_id,
                component_count,
                status,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                :bom_id,
                :bom_name,
                :organization_id,
                :project_id,
                :component_count,
                'pending',
                jsonb_build_object(
                    'upload_source', :upload_source,
                    'upload_id', :upload_id,
                    'uploaded_by', :uploaded_by,
                    'filename', :filename,
                    's3_bucket', :s3_bucket,
                    's3_key', :s3_key
                ),
                NOW(),
                NOW()
            )
            """
        )

        line_items_saved = len(line_items)

        db.execute(
            bom_insert,
            {
                "bom_id": bom_id,
                "bom_name": bom_name,
                "organization_id": organization_id,
                "project_id": project_id,
                "component_count": line_items_saved,
                "upload_source": source,
                "upload_id": upload_id,
                "uploaded_by": uploaded_by,
                "filename": filename,
                "s3_bucket": s3_bucket,
                "s3_key": s3_key,
            },
        )

        item_insert = text(
            """
            INSERT INTO bom_line_items (
                id,
                bom_id,
                line_number,
                manufacturer_part_number,
                manufacturer,
                quantity,
                reference_designator,
                description,
                enrichment_status,
                created_at,
                updated_at
            ) VALUES (
                :line_id,
                :bom_id,
                :line_number,
                :mpn,
                :manufacturer,
                :quantity,
                :reference_designator,
                :description,
                'pending',
                NOW(),
                NOW()
            )
            """
        )

        for item in line_items:
            db.execute(
                item_insert,
                {
                    "line_id": item["id"],
                    "bom_id": bom_id,
                    "line_number": item["line_number"],
                    "mpn": item.get("manufacturer_part_number"),
                    "manufacturer": item.get("manufacturer"),
                    "quantity": item.get("quantity", 1),
                    "reference_designator": item.get("reference_designator"),
                    "description": item.get("description"),
                },
            )

        db.commit()
        logger.info(
            "[bom_ingest] ✅ Supabase BOM %s created with %s line items",
            bom_id,
            line_items_saved,
        )
        return line_items_saved, None

    except SQLAlchemyError as e:
        logger.error("[bom_ingest] Failed to create Supabase BOM: %s", e, exc_info=True)
        db.rollback()
        return 0, e


def seed_redis_for_bulk_upload(
    upload_id: str,
    line_items: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    *,
    ttl_hours: int = 24,
) -> bool:
    """Seed Redis for staff bulk uploads using existing storage class.

    This is a thin wrapper around `BulkUploadRedisStorage` so callers do
    not need to know the Redis key structure.
    """

    try:
        storage = get_bulk_upload_storage(upload_id)
        if not storage:
            logger.error("[bom_ingest] Redis storage not available for upload %s", upload_id)
            return False

        if not storage.save_metadata(metadata, ttl_hours=ttl_hours):
            logger.error("[bom_ingest] Failed to save metadata to Redis for %s", upload_id)
            return False

        if not line_items:
            logger.warning("[bom_ingest] No line items to save to Redis for %s", upload_id)
            return True

        if not storage.add_line_items_bulk(line_items, ttl_hours=ttl_hours):
            logger.error("[bom_ingest] Failed to save line items to Redis for %s", upload_id)
            return False

        storage.set_status("completed", ttl_hours=ttl_hours)
        logger.info("[bom_ingest] ✅ Seeded Redis for upload %s", upload_id)
        return True

    except Exception as e:
        logger.error("[bom_ingest] Error seeding Redis for upload %s: %s", upload_id, e, exc_info=True)
        return False

