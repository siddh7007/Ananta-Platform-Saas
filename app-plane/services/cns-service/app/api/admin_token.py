"""Admin token bootstrap endpoints.

These endpoints expose developer conveniences for automatically provisioning
super-admin tokens to the dashboard in local environments. They are disabled in
production to avoid leaking credentials.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/admin", tags=["Admin Token"])


class AdminTokenResponse(BaseModel):
    token: str
    environment: str


@router.get("/default-token", response_model=AdminTokenResponse)
def get_default_admin_token() -> AdminTokenResponse:
    """Return the configured admin API token for local development.

    The token is only returned when an `ADMIN_API_TOKEN` is configured and the
    service is running in a non-production environment. This allows the React
    dashboard to automatically bootstrap the token during developer workflows
    without requiring manual localStorage edits.
    """

    token = settings.admin_api_token
    if not token:
        raise HTTPException(status_code=404, detail="Admin token not configured")

    if settings.environment and settings.environment.lower() not in {"development", "local", "dev", "test"}:
        raise HTTPException(status_code=403, detail="Default token endpoint disabled in this environment")

    return AdminTokenResponse(token=token, environment=settings.environment)
