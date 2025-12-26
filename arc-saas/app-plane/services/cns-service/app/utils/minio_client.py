"""
MinIO/S3 Client for File Storage

Provides utilities for uploading and downloading files to/from MinIO or AWS S3.
Supports multiple storage backends: local MinIO, AWS S3, Google Cloud Storage.
"""

import io
import logging
from typing import Optional, Tuple, BinaryIO
from datetime import timedelta
from minio import Minio
from minio.error import S3Error
from app.config import settings

logger = logging.getLogger(__name__)


class MinIOClient:
    """MinIO/S3 client wrapper with error handling"""

    def __init__(self):
        """Initialize MinIO client from settings"""
        self.client = None
        self.enabled = settings.minio_enabled

        if not self.enabled:
            logger.warning("MinIO is disabled. File storage will not work.")
            return

        try:
            self.client = Minio(
                endpoint=settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=settings.minio_secure
            )
            logger.info(f"MinIO client initialized: {settings.minio_endpoint}")
        except Exception as e:
            logger.error(f"Failed to initialize MinIO client: {e}")
            self.enabled = False

    def is_enabled(self) -> bool:
        """Check if MinIO is enabled and client is initialized"""
        return self.enabled and self.client is not None

    def ensure_bucket_exists(self, bucket_name: str) -> bool:
        """Ensure bucket exists, create if it doesn't"""
        if not self.is_enabled():
            return False

        try:
            if not self.client.bucket_exists(bucket_name):
                self.client.make_bucket(bucket_name)
                logger.info(f"Created MinIO bucket: {bucket_name}")
            return True
        except S3Error as e:
            logger.error(f"Failed to ensure bucket exists: {bucket_name} - {e}")
            return False

    def upload_file(
        self,
        bucket: str,
        object_name: str,
        file_data: bytes,
        content_type: str = 'application/octet-stream'
    ) -> Tuple[bool, Optional[str]]:
        """
        Upload file to MinIO

        Args:
            bucket: Bucket name (e.g., 'bulk-uploads')
            object_name: Object key/path (e.g., 'uploads/tenant-id/upload-id/file.csv')
            file_data: File content as bytes
            content_type: MIME type

        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        if not self.is_enabled():
            return False, "MinIO is not enabled"

        try:
            # Ensure bucket exists
            if not self.ensure_bucket_exists(bucket):
                return False, f"Bucket {bucket} does not exist and could not be created"

            # Upload file
            self.client.put_object(
                bucket,
                object_name,
                io.BytesIO(file_data),
                length=len(file_data),
                content_type=content_type
            )

            logger.info(f"Uploaded file to MinIO: {bucket}/{object_name} ({len(file_data)} bytes)")
            return True, None

        except S3Error as e:
            error_msg = f"MinIO upload failed: {e}"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error during upload: {e}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg

    def get_presigned_url(
        self,
        bucket: str,
        object_name: str,
        expires: timedelta = timedelta(days=7)
    ) -> Optional[str]:
        """
        Generate presigned URL for file download

        Args:
            bucket: Bucket name
            object_name: Object key/path
            expires: URL expiration time (default: 7 days)

        Returns:
            Presigned URL or None if error
        """
        if not self.is_enabled():
            return None

        try:
            url = self.client.presigned_get_object(bucket, object_name, expires=expires)
            logger.info(f"Generated presigned URL for {bucket}/{object_name} (expires in {expires})")
            return url
        except S3Error as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None

    def download_file(self, bucket: str, object_name: str) -> Optional[bytes]:
        """
        Download file from MinIO

        Args:
            bucket: Bucket name
            object_name: Object key/path

        Returns:
            File content as bytes or None if error
        """
        if not self.is_enabled():
            return None

        try:
            response = self.client.get_object(bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()

            logger.info(f"Downloaded file from MinIO: {bucket}/{object_name} ({len(data)} bytes)")
            return data

        except S3Error as e:
            logger.error(f"Failed to download file: {e}")
            return None

    def delete_file(self, bucket: str, object_name: str) -> bool:
        """Delete file from MinIO"""
        if not self.is_enabled():
            return False

        try:
            self.client.remove_object(bucket, object_name)
            logger.info(f"Deleted file from MinIO: {bucket}/{object_name}")
            return True
        except S3Error as e:
            logger.error(f"Failed to delete file: {e}")
            return False

    def list_objects(self, bucket: str, prefix: str = '') -> list:
        """List objects in bucket with optional prefix filter"""
        if not self.is_enabled():
            return []

        try:
            objects = self.client.list_objects(bucket, prefix=prefix)
            return [obj.object_name for obj in objects]
        except S3Error as e:
            logger.error(f"Failed to list objects: {e}")
            return []


# Singleton instance
_minio_client: Optional[MinIOClient] = None


def get_minio_client() -> MinIOClient:
    """Get singleton MinIO client instance"""
    global _minio_client
    if _minio_client is None:
        _minio_client = MinIOClient()
    return _minio_client


def generate_s3_key(organization_id: str, upload_id: str, filename: str) -> str:
    """
    Generate S3 object key for upload

    Format: uploads/{organization_id}/{upload_id}/{filename}

    Example: uploads/a1111111-1111-1111-1111-111111111111/20deb4be.../sample.csv
    """
    return f"uploads/{organization_id}/{upload_id}/{filename}"


def upload_to_minio(
    file_content: bytes,
    organization_id: str,
    upload_id: str,
    filename: str,
    content_type: str = 'application/octet-stream',
    bucket: str = 'bulk-uploads'
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Upload file to MinIO and generate presigned URL

    Args:
        file_content: File content as bytes
        organization_id: Organization UUID
        upload_id: Upload UUID
        filename: Original filename
        content_type: MIME type
        bucket: MinIO bucket (default: bulk-uploads)

    Returns:
        Tuple of (s3_key, s3_url, error_message)
        - s3_key: Object key/path if successful
        - s3_url: Presigned URL if successful
        - error_message: Error message if failed
    """
    client = get_minio_client()

    if not client.is_enabled():
        return None, None, "MinIO is not enabled"

    # Generate S3 key
    s3_key = generate_s3_key(organization_id, upload_id, filename)

    # Upload file
    success, error = client.upload_file(bucket, s3_key, file_content, content_type)

    if not success:
        return None, None, error

    # Generate presigned URL (valid for 7 days)
    s3_url = client.get_presigned_url(bucket, s3_key, expires=timedelta(days=7))

    if not s3_url:
        return s3_key, None, "Failed to generate presigned URL"

    return s3_key, s3_url, None
