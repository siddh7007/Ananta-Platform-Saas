"""
Organization Settings API Endpoints

Provides endpoints for managing organization profile and settings:
- GET /api/organization/settings - Get organization settings
- PATCH /api/organization/settings - Update organization settings
- GET /api/organization/slug/check - Check slug availability
- GET /api/organization/settings/audit - Get settings change audit log
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr, field_validator
from sqlalchemy import text

from app.core.authorization import get_auth_context, AuthContext
from ..models.dual_database import get_dual_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organization", tags=["organization"])


# =====================================================
# Helper Functions
# =====================================================
@contextmanager
def get_supabase_session():
    """Get a session for the Supabase database."""
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# =====================================================
# Pydantic Models
# =====================================================
class OrganizationProfile(BaseModel):
    """Organization profile data."""
    id: str
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    billing_email: Optional[str] = None
    org_type: str = "individual"
    created_at: Optional[str] = None


class SecuritySettings(BaseModel):
    """Security policy settings."""
    require_mfa: bool = False
    session_timeout_minutes: int = 30
    password_policy: str = "strong"


class ApiSettings(BaseModel):
    """API and integration settings."""
    api_access_enabled: bool = True
    webhooks_enabled: bool = False
    webhook_url: Optional[str] = None


class DataRetentionSettings(BaseModel):
    """Data retention settings."""
    data_retention_days: int = 365
    audit_log_retention_days: int = 90


class SsoSettings(BaseModel):
    """SSO configuration settings."""
    sso_enabled: bool = False
    sso_provider: str = "saml"


class OrganizationSettingsResponse(BaseModel):
    """Full organization settings response."""
    profile: OrganizationProfile
    security: SecuritySettings
    api: ApiSettings
    data_retention: DataRetentionSettings
    sso: SsoSettings


class UpdateOrganizationProfileRequest(BaseModel):
    """Request to update organization profile."""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    slug: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    billing_email: Optional[str] = None

    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if v is not None:
            # Slug must be lowercase, alphanumeric with hyphens
            import re
            if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$', v):
                raise ValueError('Slug must be lowercase alphanumeric with hyphens, cannot start or end with hyphen')
        return v


class UpdateSecuritySettingsRequest(BaseModel):
    """Request to update security settings."""
    require_mfa: Optional[bool] = None
    session_timeout_minutes: Optional[int] = Field(None, ge=5, le=480)
    password_policy: Optional[str] = None

    @field_validator('password_policy')
    @classmethod
    def validate_password_policy(cls, v):
        if v is not None and v not in ['basic', 'strong', 'enterprise']:
            raise ValueError('password_policy must be one of: basic, strong, enterprise')
        return v


class UpdateApiSettingsRequest(BaseModel):
    """Request to update API settings."""
    api_access_enabled: Optional[bool] = None
    webhooks_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None


class UpdateDataRetentionRequest(BaseModel):
    """Request to update data retention settings."""
    data_retention_days: Optional[int] = Field(None, ge=30, le=3650)
    audit_log_retention_days: Optional[int] = Field(None, ge=30, le=365)


class UpdateSsoSettingsRequest(BaseModel):
    """Request to update SSO settings."""
    sso_enabled: Optional[bool] = None
    sso_provider: Optional[str] = None

    @field_validator('sso_provider')
    @classmethod
    def validate_sso_provider(cls, v):
        if v is not None and v not in ['saml', 'okta', 'azure', 'google']:
            raise ValueError('sso_provider must be one of: saml, okta, azure, google')
        return v


class UpdateOrganizationSettingsRequest(BaseModel):
    """Combined request to update any organization settings."""
    profile: Optional[UpdateOrganizationProfileRequest] = None
    security: Optional[UpdateSecuritySettingsRequest] = None
    api: Optional[UpdateApiSettingsRequest] = None
    data_retention: Optional[UpdateDataRetentionRequest] = None
    sso: Optional[UpdateSsoSettingsRequest] = None


class SlugCheckResponse(BaseModel):
    """Response for slug availability check."""
    slug: str
    available: bool
    suggested: Optional[str] = None


class AuditLogEntry(BaseModel):
    """Single audit log entry."""
    id: str
    changed_by: str
    changed_at: str
    setting_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Response for audit log query."""
    entries: list[AuditLogEntry]
    total: int


# =====================================================
# API Endpoints
# =====================================================
@router.get("/settings", response_model=OrganizationSettingsResponse)
async def get_organization_settings(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get organization settings.

    Returns the full organization settings including profile, security,
    API, data retention, and SSO configuration.

    Requires authentication. Returns settings for the user's organization.
    """
    org_id = auth.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization associated with user")

    logger.info(f"[OrgSettings] Getting settings for org: {org_id}")

    with get_supabase_session() as db:
        result = db.execute(
            text("""
                SELECT
                    id::TEXT,
                    name,
                    slug,
                    email,
                    phone,
                    address,
                    logo_url,
                    billing_email,
                    org_type,
                    created_at,
                    require_mfa,
                    session_timeout_minutes,
                    password_policy,
                    api_access_enabled,
                    webhooks_enabled,
                    webhook_url,
                    data_retention_days,
                    audit_log_retention_days,
                    sso_enabled,
                    sso_provider
                FROM organizations
                WHERE id = CAST(:org_id AS UUID)
                AND deleted_at IS NULL
            """),
            {"org_id": org_id}
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Organization not found")

        return OrganizationSettingsResponse(
            profile=OrganizationProfile(
                id=row.id,
                name=row.name,
                slug=row.slug,
                email=row.email,
                phone=row.phone,
                address=row.address,
                logo_url=row.logo_url,
                billing_email=row.billing_email,
                org_type=row.org_type or "individual",
                created_at=row.created_at.isoformat() if row.created_at else None,
            ),
            security=SecuritySettings(
                require_mfa=row.require_mfa or False,
                session_timeout_minutes=row.session_timeout_minutes or 30,
                password_policy=row.password_policy or "strong",
            ),
            api=ApiSettings(
                api_access_enabled=row.api_access_enabled if row.api_access_enabled is not None else True,
                webhooks_enabled=row.webhooks_enabled or False,
                webhook_url=row.webhook_url,
            ),
            data_retention=DataRetentionSettings(
                data_retention_days=row.data_retention_days or 365,
                audit_log_retention_days=row.audit_log_retention_days or 90,
            ),
            sso=SsoSettings(
                sso_enabled=row.sso_enabled or False,
                sso_provider=row.sso_provider or "saml",
            ),
        )


@router.patch("/settings", response_model=dict)
async def update_organization_settings(
    request: UpdateOrganizationSettingsRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Update organization settings.

    Allows updating profile, security, API, data retention, and SSO settings.
    Only organization admins/owners can update settings.

    Changes are logged to the audit trail.
    """
    org_id = auth.organization_id
    user_id = auth.user_id
    role = auth.role

    if not org_id:
        raise HTTPException(status_code=400, detail="No organization associated with user")

    # Check permission - only admin, owner, or super_admin can update
    if role not in ['admin', 'org_admin', 'owner', 'super_admin']:
        raise HTTPException(
            status_code=403,
            detail="Only organization administrators can update settings"
        )

    logger.info(f"[OrgSettings] Updating settings for org: {org_id} by user: {user_id}")

    # Build update fields
    updates = {}
    audit_entries = []

    if request.profile:
        profile_data = request.profile.model_dump(exclude_none=True)
        updates.update(profile_data)

    if request.security:
        security_data = request.security.model_dump(exclude_none=True)
        updates.update(security_data)

    if request.api:
        api_data = request.api.model_dump(exclude_none=True)
        updates.update(api_data)

    if request.data_retention:
        retention_data = request.data_retention.model_dump(exclude_none=True)
        updates.update(retention_data)

    if request.sso:
        sso_data = request.sso.model_dump(exclude_none=True)
        updates.update(sso_data)

    if not updates:
        return {"success": True, "message": "No changes to apply"}

    # Check slug availability if changing slug
    if 'slug' in updates:
        with get_supabase_session() as db:
            result = db.execute(
                text("""
                    SELECT check_slug_availability(:slug, CAST(:org_id AS UUID)) as available
                """),
                {"slug": updates['slug'], "org_id": org_id}
            )
            row = result.fetchone()
            if not row or not row.available:
                raise HTTPException(
                    status_code=400,
                    detail="This slug is already taken. Please choose a different one."
                )

    # Build and execute update query
    with get_supabase_session() as db:
        # Get current values for audit
        current_result = db.execute(
            text(f"""
                SELECT {', '.join(updates.keys())}
                FROM organizations
                WHERE id = CAST(:org_id AS UUID)
            """),
            {"org_id": org_id}
        )
        current_row = current_result.fetchone()

        if not current_row:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Build SET clause
        set_clauses = []
        params = {"org_id": org_id, "user_id": user_id}

        for i, (key, value) in enumerate(updates.items()):
            param_name = f"val_{i}"
            set_clauses.append(f"{key} = :{param_name}")
            params[param_name] = value

            # Log audit entry
            old_value = getattr(current_row, key, None)
            if old_value != value:
                audit_entries.append({
                    "setting_name": key,
                    "old_value": str(old_value) if old_value is not None else None,
                    "new_value": str(value) if value is not None else None,
                })

        # Execute update
        db.execute(
            text(f"""
                UPDATE organizations
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE id = CAST(:org_id AS UUID)
            """),
            params
        )

        # Insert audit entries
        for entry in audit_entries:
            db.execute(
                text("""
                    INSERT INTO organization_settings_audit
                    (organization_id, changed_by, setting_name, old_value, new_value)
                    VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), :setting_name, :old_value, :new_value)
                """),
                {
                    "org_id": org_id,
                    "user_id": user_id,
                    "setting_name": entry["setting_name"],
                    "old_value": entry["old_value"],
                    "new_value": entry["new_value"],
                }
            )

        logger.info(f"[OrgSettings] Updated {len(updates)} settings for org: {org_id}")

    return {
        "success": True,
        "message": f"Updated {len(updates)} setting(s)",
        "updated_fields": list(updates.keys())
    }


@router.get("/slug/check", response_model=SlugCheckResponse)
async def check_slug_availability(
    slug: str = Query(..., min_length=3, max_length=50),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Check if an organization slug is available.

    Returns availability status and a suggested alternative if not available.
    """
    org_id = auth.organization_id

    # Normalize slug
    import re
    normalized = slug.lower().strip()
    normalized = re.sub(r'[^a-z0-9-]', '-', normalized)
    normalized = re.sub(r'-+', '-', normalized)
    normalized = normalized.strip('-')

    with get_supabase_session() as db:
        result = db.execute(
            text("""
                SELECT check_slug_availability(:slug, CAST(:org_id AS UUID)) as available
            """),
            {"slug": normalized, "org_id": org_id}
        )
        row = result.fetchone()
        available = row.available if row else False

        suggested = None
        if not available:
            # Generate a suggested alternative
            for i in range(1, 100):
                suggested_slug = f"{normalized}-{i}"
                result = db.execute(
                    text("""
                        SELECT check_slug_availability(:slug, CAST(:org_id AS UUID)) as available
                    """),
                    {"slug": suggested_slug, "org_id": org_id}
                )
                row = result.fetchone()
                if row and row.available:
                    suggested = suggested_slug
                    break

        return SlugCheckResponse(
            slug=normalized,
            available=available,
            suggested=suggested
        )


@router.get("/settings/audit", response_model=AuditLogResponse)
async def get_settings_audit_log(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get the audit log of settings changes.

    Returns a paginated list of all settings changes for the organization.
    Only organization admins can view the audit log.
    """
    org_id = auth.organization_id
    role = auth.role

    if not org_id:
        raise HTTPException(status_code=400, detail="No organization associated with user")

    # Check permission
    if role not in ['admin', 'org_admin', 'owner', 'super_admin']:
        raise HTTPException(
            status_code=403,
            detail="Only organization administrators can view audit logs"
        )

    with get_supabase_session() as db:
        # Get total count
        count_result = db.execute(
            text("""
                SELECT COUNT(*) as total
                FROM organization_settings_audit
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": org_id}
        )
        total = count_result.fetchone().total

        # Get entries
        result = db.execute(
            text("""
                SELECT
                    a.id::TEXT,
                    a.changed_by::TEXT,
                    a.changed_at,
                    a.setting_name,
                    a.old_value,
                    a.new_value
                FROM organization_settings_audit a
                WHERE a.organization_id = CAST(:org_id AS UUID)
                ORDER BY a.changed_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"org_id": org_id, "limit": limit, "offset": offset}
        )

        entries = []
        for row in result:
            entries.append(AuditLogEntry(
                id=row.id,
                changed_by=row.changed_by,
                changed_at=row.changed_at.isoformat() if row.changed_at else "",
                setting_name=row.setting_name,
                old_value=row.old_value,
                new_value=row.new_value,
            ))

        return AuditLogResponse(entries=entries, total=total)
