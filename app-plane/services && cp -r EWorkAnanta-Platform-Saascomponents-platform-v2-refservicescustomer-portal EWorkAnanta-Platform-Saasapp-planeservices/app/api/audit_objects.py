"""
Audit Trail Objects API

Provides access to per-line JSON audit objects for real-time monitoring.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import logging
import json
import re
from datetime import datetime
from sqlalchemy import text

from app.utils.minio_client import MinIOClient
from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-objects", tags=["Audit Objects"])

AUDIT_BUCKET = "enrichment-audit"

# UUID validation pattern for job_id and line_id
UUID_PATTERN = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', re.IGNORECASE)


def validate_uuid(value: str, param_name: str) -> None:
    """Validate that a parameter is a valid UUID to prevent path traversal."""
    if not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {param_name}: must be a valid UUID format"
        )


def check_minio_available() -> MinIOClient:
    """Check if MinIO is available and return client, or raise 503."""
    minio = MinIOClient()
    if not minio.is_enabled():
        raise HTTPException(
            status_code=503,
            detail="Audit trail storage is currently unavailable. Please try again later or contact support."
        )
    return minio


@router.get("/{job_id}/line-items")
async def list_audit_line_items(job_id: str) -> List[Dict[str, Any]]:
    """
    List all line items with audit data for a job.

    Returns summary info for each line item (mpn, manufacturer, quality, etc.)
    """
    try:
        # Validate job_id to prevent path traversal
        validate_uuid(job_id, "job_id")

        # Check MinIO availability
        minio = check_minio_available()

        # List all comparison summary objects (one per line item)
        prefix = f"{job_id}/_objects/comparison_summary/"
        objects = minio.list_objects(AUDIT_BUCKET, prefix)

        line_items = []
        for obj_path in objects:
            if not obj_path.endswith('.json'):
                continue

            # Download and parse
            json_bytes = minio.download_file(AUDIT_BUCKET, obj_path)
            if not json_bytes:
                continue

            data = json.loads(json_bytes.decode('utf-8'))
            line_id = obj_path.split('/')[-1].replace('.json', '')

            # Check existence of vendor response
            vendor_path = f"{job_id}/_objects/vendor_responses/{line_id}.json"
            has_vendor_response = False
            try:
                vendor_bytes = minio.download_file(AUDIT_BUCKET, vendor_path)
                has_vendor_response = bool(vendor_bytes)
            except:
                pass

            # Get normalized data for additional context
            norm_path = f"{job_id}/_objects/normalized_data/{line_id}.json"
            norm_data = {}
            has_normalized_data = False
            try:
                norm_bytes = minio.download_file(AUDIT_BUCKET, norm_path)
                if norm_bytes:
                    norm_data = json.loads(norm_bytes.decode('utf-8'))
                    has_normalized_data = True
            except:
                pass

            line_items.append({
                'line_id': line_id,
                'mpn': data.get('mpn', ''),
                'manufacturer': data.get('manufacturer', ''),
                'vendor': data.get('vendor', ''),
                'quality_score': data.get('quality_score', 0),
                'storage_location': data.get('storage_location', ''),
                'timestamp': data.get('timestamp', ''),
                'category': norm_data.get('normalized_category', ''),
                'lifecycle': norm_data.get('normalized_lifecycle', ''),
                'has_vendor_response': has_vendor_response,
                'has_normalized_data': has_normalized_data,
                'has_comparison': True  # We know this exists since we're iterating comparison objects
            })

        # Sort by timestamp
        line_items.sort(key=lambda x: x['timestamp'], reverse=True)

        return line_items

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing audit line items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/line-items/{line_id}/vendor-response")
async def get_vendor_response(job_id: str, line_id: str) -> Dict[str, Any]:
    """Get vendor API response for a specific line item."""
    try:
        # Validate parameters
        validate_uuid(job_id, "job_id")
        validate_uuid(line_id, "line_id")

        # Check MinIO availability
        minio = check_minio_available()

        object_path = f"{job_id}/_objects/vendor_responses/{line_id}.json"

        json_bytes = minio.download_file(AUDIT_BUCKET, object_path)
        if not json_bytes:
            raise HTTPException(status_code=404, detail="Vendor response not found")

        return json.loads(json_bytes.decode('utf-8'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vendor response: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/line-items/{line_id}/normalized-data")
async def get_normalized_data(job_id: str, line_id: str) -> Dict[str, Any]:
    """Get normalized enrichment data for a specific line item."""
    try:
        # Validate parameters
        validate_uuid(job_id, "job_id")
        validate_uuid(line_id, "line_id")

        # Check MinIO availability
        minio = check_minio_available()

        object_path = f"{job_id}/_objects/normalized_data/{line_id}.json"

        json_bytes = minio.download_file(AUDIT_BUCKET, object_path)
        if not json_bytes:
            raise HTTPException(status_code=404, detail="Normalized data not found")

        return json.loads(json_bytes.decode('utf-8'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching normalized data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/line-items/{line_id}/comparison")
async def get_comparison_summary(job_id: str, line_id: str) -> Dict[str, Any]:
    """Get comparison summary for a specific line item."""
    try:
        # Validate parameters
        validate_uuid(job_id, "job_id")
        validate_uuid(line_id, "line_id")

        # Check MinIO availability
        minio = check_minio_available()

        object_path = f"{job_id}/_objects/comparison_summary/{line_id}.json"

        json_bytes = minio.download_file(AUDIT_BUCKET, object_path)
        if not json_bytes:
            raise HTTPException(status_code=404, detail="Comparison summary not found")

        return json.loads(json_bytes.decode('utf-8'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comparison summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}/line-items/{line_id}/side-by-side")
async def get_side_by_side_comparison(job_id: str, line_id: str) -> Dict[str, Any]:
    """
    Get all audit data for a line item in one call (side-by-side view).

    Returns vendor response, normalized data, and comparison summary together.
    """
    try:
        # Validate parameters
        validate_uuid(job_id, "job_id")
        validate_uuid(line_id, "line_id")

        # Check MinIO availability
        minio = check_minio_available()

        result = {
            'line_id': line_id,
            'vendor_response': None,
            'normalized_data': None,
            'comparison': None,
            'errors': []
        }

        # Fetch vendor response
        try:
            vendor_path = f"{job_id}/_objects/vendor_responses/{line_id}.json"
            vendor_bytes = minio.download_file(AUDIT_BUCKET, vendor_path)
            if vendor_bytes:
                result['vendor_response'] = json.loads(vendor_bytes.decode('utf-8'))
        except Exception as e:
            result['errors'].append(f"Vendor response: {str(e)}")

        # Fetch normalized data
        try:
            norm_path = f"{job_id}/_objects/normalized_data/{line_id}.json"
            norm_bytes = minio.download_file(AUDIT_BUCKET, norm_path)
            if norm_bytes:
                result['normalized_data'] = json.loads(norm_bytes.decode('utf-8'))
        except Exception as e:
            result['errors'].append(f"Normalized data: {str(e)}")

        # Fetch comparison
        try:
            comp_path = f"{job_id}/_objects/comparison_summary/{line_id}.json"
            comp_bytes = minio.download_file(AUDIT_BUCKET, comp_path)
            if comp_bytes:
                result['comparison'] = json.loads(comp_bytes.decode('utf-8'))
        except Exception as e:
            result['errors'].append(f"Comparison: {str(e)}")

        if not any([result['vendor_response'], result['normalized_data'], result['comparison']]):
            raise HTTPException(status_code=404, detail="No audit data found for this line item")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching side-by-side data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
async def list_enrichment_jobs(
    limit: int = 50,
    organization_id: Optional[str] = Query(None, description="Filter by organization ID")
) -> List[Dict[str, Any]]:
    """
    List all enrichment jobs with audit trails.

    Returns list of jobs sorted by timestamp (newest first).
    Includes metadata from database: filename, organization, user, timestamp.
    """
    try:
        # Check MinIO availability
        minio = check_minio_available()

        # Get database connection for metadata
        dual_db = get_dual_database()
        db_gen = dual_db.get_session("supabase")
        db = next(db_gen)

        # List all top-level folders in audit bucket
        objects = minio.list_objects(AUDIT_BUCKET, "")

        # Extract unique job IDs (only valid UUIDs)
        job_ids = set()
        for obj_path in objects:
            parts = obj_path.split('/')
            if parts and UUID_PATTERN.match(parts[0]):
                job_ids.add(parts[0])

        # Fetch metadata from database for all job_ids in batch
        metadata_map = {}
        if job_ids:
            try:
                # Query cns_bulk_uploads table for upload metadata
                # The job_id matches the upload id in the database
                job_ids_list = list(job_ids)
                placeholders = ', '.join([f':id{i}' for i in range(len(job_ids_list))])

                sql_query = text(f"""
                    SELECT id, filename, original_name, organization_id, uploaded_by, created_at, status
                    FROM cns_bulk_uploads
                    WHERE id IN ({placeholders})
                """)

                # Apply organization filter if provided
                if organization_id:
                    sql_query = text(f"""
                        SELECT id, filename, original_name, organization_id, uploaded_by, created_at, status
                        FROM cns_bulk_uploads
                        WHERE id IN ({placeholders})
                        AND organization_id = :org_id
                    """)

                # Build parameters dict
                params = {f'id{i}': str(job_id) for i, job_id in enumerate(job_ids_list)}
                if organization_id:
                    params['org_id'] = organization_id

                result = db.execute(sql_query, params)
                records = result.fetchall()

                for record in records:
                    metadata_map[str(record.id)] = {
                        'filename': record.original_name or record.filename,
                        'organization_id': str(record.organization_id) if record.organization_id else None,
                        'uploaded_by': str(record.uploaded_by) if record.uploaded_by else None,
                        'created_at': record.created_at.isoformat() if record.created_at else None,
                        'status': record.status
                    }
            except Exception as db_err:
                logger.warning(f"Failed to fetch metadata from database: {db_err}")
                # Continue without metadata - will show job_id only
            finally:
                try:
                    next(db_gen, None)  # Cleanup generator
                except:
                    pass

        jobs = []
        for job_id in sorted(job_ids):
            # Skip if organization filter is active but no metadata or wrong org
            if organization_id and (job_id not in metadata_map):
                continue

            # Get BOM original to extract metadata
            try:
                bom_path = f"{job_id}/bom_original.csv"
                bom_bytes = minio.download_file(AUDIT_BUCKET, bom_path)

                # Count line items
                prefix = f"{job_id}/_objects/comparison_summary/"
                line_items = [o for o in minio.list_objects(AUDIT_BUCKET, prefix) if o.endswith('.json')]

                # Get metadata from database if available
                metadata = metadata_map.get(job_id, {})

                jobs.append({
                    'job_id': job_id,
                    'total_items': len(line_items),
                    'has_audit_trail': len(line_items) > 0,
                    'bom_available': bool(bom_bytes),
                    # Additional metadata from database
                    'filename': metadata.get('filename'),
                    'organization_id': metadata.get('organization_id'),
                    'uploaded_by': metadata.get('uploaded_by'),
                    'created_at': metadata.get('created_at'),
                    'status': metadata.get('status')
                })
            except:
                # Job folder exists but incomplete, skip
                continue

        # Sort by created_at if available, otherwise by job_id
        jobs.sort(key=lambda x: x.get('created_at') or x['job_id'], reverse=True)

        return jobs[:limit]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing enrichment jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
