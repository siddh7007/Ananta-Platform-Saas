"""
Audit Trail API Endpoints

Provides access to enrichment audit CSV files stored in MinIO.
"""

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.utils.enrichment_audit import get_audit_writer, AUDIT_BUCKET
from app.utils.minio_client import MinIOClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/download/{job_id}/{filename}")
async def download_audit_file(job_id: str, filename: str):
    """
    Download audit CSV file for a specific job.

    Args:
        job_id: BOM job ID
        filename: Audit filename (bom_original.csv, vendor_responses.csv, etc.)

    Returns:
        CSV file as streaming response
    """
    # Validate filename (security check)
    allowed_files = [
        'bom_original.csv',
        'vendor_responses.csv',
        'normalized_data.csv',
        'comparison_summary.csv'
    ]

    if filename not in allowed_files:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid filename. Allowed files: {', '.join(allowed_files)}"
        )

    try:
        # Get MinIO client
        minio_client = MinIOClient()

        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="MinIO storage is not available"
            )

        # Build object path
        object_name = f"{job_id}/{filename}"

        # Download file from MinIO
        file_data = minio_client.download_file(AUDIT_BUCKET, object_name)

        if not file_data:
            raise HTTPException(
                status_code=404,
                detail=f"Audit file not found: {filename} (job may not have audit data)"
            )

        logger.info(f"Downloaded audit file: {object_name} ({len(file_data)} bytes)")

        # Return as streaming response
        return StreamingResponse(
            iter([file_data]),
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename="{job_id}_{filename}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading audit file: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download audit file: {str(e)}"
        )


@router.get("/list/{job_id}")
async def list_audit_files(job_id: str):
    """
    List available audit files for a job.

    Args:
        job_id: BOM job ID

    Returns:
        List of available audit files with metadata
    """
    try:
        minio_client = MinIOClient()

        if not minio_client.is_enabled():
            return {
                'job_id': job_id,
                'files': [],
                'storage_available': False
            }

        # Check which files exist
        available_files = []
        audit_files = [
            'bom_original.csv',
            'vendor_responses.csv',
            'normalized_data.csv',
            'comparison_summary.csv'
        ]

        for filename in audit_files:
            object_name = f"{job_id}/{filename}"
            file_data = minio_client.download_file(AUDIT_BUCKET, object_name)

            if file_data:
                available_files.append({
                    'filename': filename,
                    'size_bytes': len(file_data),
                    'available': True
                })
            else:
                available_files.append({
                    'filename': filename,
                    'size_bytes': 0,
                    'available': False
                })

        return {
            'job_id': job_id,
            'files': available_files,
            'storage_available': True
        }

    except Exception as e:
        logger.error(f"Error listing audit files: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list audit files: {str(e)}"
        )
