"""
File Download API Endpoints

Provides access to files stored in MinIO (BOM uploads, audit files, etc.)
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.utils.minio_client import MinIOClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/download")
async def download_file(
    s3_key: str = Query(..., description="S3 object key"),
    bucket: str = Query("bulk-uploads", description="S3 bucket name")
):
    """
    Download a file from MinIO storage.

    Args:
        s3_key: S3 object key (path to file)
        bucket: S3 bucket name (default: bulk-uploads)

    Returns:
        File as streaming response
    """
    try:
        # Get MinIO client
        minio_client = MinIOClient()

        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="MinIO storage is not available"
            )

        logger.info(f"📥 Downloading file: {s3_key} from bucket: {bucket}")

        # Get file from MinIO
        file_data = minio_client.download_file(bucket, s3_key)

        if not file_data:
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {s3_key} in bucket: {bucket}"
            )

        # Extract filename from s3_key
        filename = s3_key.split('/')[-1] if '/' in s3_key else s3_key

        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if filename.endswith('.csv'):
            content_type = "text/csv"
        elif filename.endswith('.xlsx'):
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif filename.endswith('.json'):
            content_type = "application/json"

        # Return file as streaming response
        return StreamingResponse(
            iter([file_data]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(file_data))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error downloading file {s3_key} from {bucket}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download file: {str(e)}"
        )
