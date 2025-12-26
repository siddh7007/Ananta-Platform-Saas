import logging
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional, Dict, Any, List

import requests

from app.config import settings
from app.utils.minio_client import get_minio_client

logger = logging.getLogger(__name__)


@dataclass
class DirectusAuth:
    token: str
    expires_at: float


class DirectusFileService:
    """Minimal client for registering MinIO objects inside Directus."""

    def __init__(self) -> None:
        self._enabled = bool(
            settings.directus_url and settings.directus_admin_email and settings.directus_admin_password
        )
        self.base_url = settings.directus_url.rstrip("/") if settings.directus_url else None
        self.storage = settings.directus_storage_location or "s3audit"
        self._session = requests.Session()
        self._auth: Optional[DirectusAuth] = None

    def is_enabled(self) -> bool:
        return self._enabled and bool(self.base_url)

    def _ensure_auth(self) -> bool:
        if not self.is_enabled():
            return False

        now = time.time()
        if self._auth and now < self._auth.expires_at - 60:
            return True

        try:
            resp = self._session.post(
                f"{self.base_url}/auth/login",
                json={"email": settings.directus_admin_email, "password": settings.directus_admin_password},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            token = data.get("access_token")
            expires_in = data.get("expires", 900)
            if not token:
                logger.warning("Directus authentication returned no access token")
                return False
            self._auth = DirectusAuth(token=token, expires_at=now + int(expires_in))
            self._session.headers.update({"Authorization": f"Bearer {token}"})
            return True
        except Exception as exc:
            logger.warning(f"Failed to authenticate with Directus: {exc}")
            self._auth = None
            return False

    def _existing_file(self, object_key: str) -> Optional[Dict[str, Any]]:
        if not self._ensure_auth():
            return None
        try:
            resp = self._session.get(
                f"{self.base_url}/files",
                params={
                    "limit": 1,
                    "filter[storage][_eq]": self.storage,
                    "filter[filename_disk][_eq]": object_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            if data:
                return data[0]
        except Exception as exc:
            logger.debug(f"Directus existing file lookup failed for {object_key}: {exc}")
        return None

    def register_minio_object(
        self,
        bucket: str,
        object_key: str,
        filename_download: str,
        title: str,
        description: Optional[str] = None,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Ensure a Directus file entry exists for the given MinIO object."""
        if not self.is_enabled():
            return None

        existing = self._existing_file(object_key)
        if existing:
            return existing.get("id")

        minio = get_minio_client()
        presigned = minio.get_presigned_url(bucket, object_key, expires=timedelta(minutes=30))
        if not presigned:
            logger.warning(f"Unable to generate presigned URL for {bucket}/{object_key}, skipping Directus import")
            return None

        payload: Dict[str, Any] = {
            "url": presigned,
            "data": {
                "title": title,
                "description": description,
                "storage": self.storage,
                "filename_download": filename_download,
                "filename_disk": object_key,
                "metadata": {
                    "source_bucket": bucket,
                    "source_key": object_key,
                    **(metadata or {}),
                },
            },
        }
        if content_type:
            payload["data"]["type"] = content_type

        try:
            if not self._ensure_auth():
                return None
            resp = self._session.post(f"{self.base_url}/files/import", json=payload, timeout=30)
            resp.raise_for_status()
            file_id = resp.json().get("data", {}).get("id")
            logger.info(f"Registered Directus file for {object_key}: {file_id}")
            return file_id
        except Exception as exc:
            extra = ""
            response = getattr(exc, "response", None)
            if response is not None:
                try:
                    extra = f" | response={response.text}"
                except Exception:
                    extra = ""
            logger.warning(f"Failed to register Directus file for {object_key}: {exc}{extra}")
            return None

    def list_files(
        self,
        *,
        limit: int = 50,
        metadata_filters: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """List Directus files stored in the configured storage with optional metadata filters."""
        if not self._ensure_auth():
            return []

        params: Dict[str, Any] = {
            "limit": limit,
            "sort[]": "-created_on",
            "filter[storage][_eq]": self.storage,
        }
        if metadata_filters:
            for key, value in metadata_filters.items():
                if value:
                    params[f"filter[metadata][{key}][_eq]"] = value

        try:
            resp = self._session.get(f"{self.base_url}/files", params=params, timeout=15)
            resp.raise_for_status()
            return resp.json().get("data", [])
        except Exception as exc:
            logger.warning(f"Failed to list Directus files: {exc}")
            return []


_directus_service: Optional[DirectusFileService] = None


def get_directus_file_service() -> DirectusFileService:
    global _directus_service
    if _directus_service is None:
        _directus_service = DirectusFileService()
    return _directus_service
