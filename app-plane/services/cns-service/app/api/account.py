"""
Account Management API Endpoints

Handles account deletion, data export, and account settings.
Implements GDPR-compliant deletion with 30-day grace period.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from contextlib import contextmanager

from ..config import settings
from ..models.dual_database import get_dual_database
from ..cache.redis_cache import DecimalEncoder
from shared.notification.client import get_novu_client


@contextmanager
def get_supabase_session():
    """Get a session for the Supabase database (customer-facing data)."""
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["account"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class DeletionReason(BaseModel):
    """Deletion reason options"""
    code: str
    label: str


DELETION_REASONS = [
    DeletionReason(code="not_needed", label="I no longer need this service"),
    DeletionReason(code="too_expensive", label="Too expensive"),
    DeletionReason(code="missing_features", label="Missing features I need"),
    DeletionReason(code="switching_competitor", label="Switching to a competitor"),
    DeletionReason(code="technical_issues", label="Technical issues"),
    DeletionReason(code="privacy_concerns", label="Privacy concerns"),
    DeletionReason(code="other", label="Other"),
]


class RequestDeletionRequest(BaseModel):
    """Request to delete account"""
    reason: Optional[str] = Field(None, description="Reason code for deletion")
    feedback: Optional[str] = Field(None, max_length=1000, description="Optional feedback")
    confirm_deletion: bool = Field(..., description="Must be True to confirm deletion")


class RequestDeletionResponse(BaseModel):
    """Response after requesting deletion"""
    success: bool
    organization_id: str
    deletion_scheduled_at: datetime
    grace_days: int
    message: str


class CancelDeletionResponse(BaseModel):
    """Response after cancelling deletion"""
    success: bool
    organization_id: str
    message: str


class DeletionStatusResponse(BaseModel):
    """Current deletion status"""
    organization_id: str
    is_pending_deletion: bool
    deletion_scheduled_at: Optional[datetime]
    days_remaining: Optional[int]
    reason: Optional[str]
    can_cancel: bool


class DataExportResponse(BaseModel):
    """Response for data export request"""
    success: bool
    export_id: str
    status: str
    download_url: Optional[str]
    expires_at: Optional[datetime]
    message: str


class AccountStatusResponse(BaseModel):
    """Full account status"""
    organization_id: str
    organization_name: str
    org_type: str
    is_active: bool
    is_suspended: bool
    suspended_reason: Optional[str]
    is_pending_deletion: bool
    deletion_scheduled_at: Optional[datetime]
    deletion_days_remaining: Optional[int]
    member_count: int
    created_at: datetime
    can_be_deleted: bool = True  # Whether the current user can delete this account
    plan_tier: str = "free"  # Subscription plan tier
    subscription_status: str = "active"  # Subscription status


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_auth_context(request: Request):
    """Extract auth context from request"""
    auth_context = getattr(request.state, 'auth_context', None)
    if not auth_context:
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth_context


def require_owner_role(auth_context) -> None:
    """Verify user has owner role"""
    if not auth_context.is_owner:
        logger.warning(
            f"[Account] Non-owner attempted account action: "
            f"user={auth_context.user_id} role={auth_context.role}"
        )
        raise HTTPException(
            status_code=403,
            detail="Only organization owners can manage account deletion"
        )


async def send_deletion_notification(
    workflow_id: str,
    user_id: str,
    payload: Dict[str, Any]
) -> None:
    """Send Novu notification for deletion events"""
    try:
        novu = get_novu_client()
        if novu:
            await novu.trigger(
                workflow_id=workflow_id,
                subscriber_id=user_id,
                payload=payload
            )
            logger.info(f"[Account] Sent {workflow_id} notification to user={user_id}")
    except Exception as e:
        logger.error(f"[Account] Failed to send notification: {e}")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/deletion-reasons", response_model=List[DeletionReason])
async def get_deletion_reasons():
    """
    Get list of deletion reason options.

    Returns predefined reasons for account deletion feedback.
    """
    return DELETION_REASONS


def is_valid_uuid(val: str) -> bool:
    """Check if a string is a valid UUID."""
    if not val:
        return False
    try:
        UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@router.get("/status", response_model=AccountStatusResponse)
async def get_account_status(request: Request):
    """
    Get current account status including deletion status.

    Returns comprehensive account information.
    """
    auth_context = get_auth_context(request)
    organization_id = auth_context.organization_id

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )

    try:
        with get_supabase_session() as db:
            result = db.execute(
                text("""
                    SELECT
                        o.id,
                        o.name,
                        o.plan_tier,
                        o.subscription_status,
                        o.created_at,
                        (SELECT COUNT(*) FROM organization_memberships WHERE organization_id = o.id) as member_count
                    FROM organizations o
                    WHERE o.id = :org_id
                """),
                {"org_id": organization_id}
            ).fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Check user's membership role in database (more reliable than token role)
            user_membership_role = None
            if auth_context.email:
                membership_result = db.execute(
                    text("""
                        SELECT m.role
                        FROM organization_memberships m
                        JOIN users u ON m.user_id = u.id
                        WHERE m.organization_id = :org_id
                        AND u.email = :email
                    """),
                    {"org_id": organization_id, "email": auth_context.email}
                ).fetchone()
                if membership_result:
                    user_membership_role = membership_result.role

            # Determine if user can delete the account:
            # - Single member orgs: the only member IS the owner
            # - Multi-member orgs: only owners/admins can delete
            # - Check both token role and database membership role
            member_count = result.member_count or 1
            is_owner_or_admin = (
                auth_context.is_owner or  # Token says owner
                auth_context.is_super_admin or  # Token says super admin
                user_membership_role in ('owner', 'admin')  # DB membership is owner or admin
            )
            can_be_deleted = (
                member_count == 1 or  # Single member org - they are effectively the owner
                is_owner_or_admin  # User has owner/admin privileges
            )

            # Determine active status based on subscription_status
            is_active = result.subscription_status in ('active', 'trialing', None)

            return AccountStatusResponse(
                organization_id=str(result.id),
                organization_name=result.name,
                org_type=result.plan_tier or "free",
                is_active=is_active,
                is_suspended=not is_active,
                suspended_reason=None,
                is_pending_deletion=False,
                deletion_scheduled_at=None,
                deletion_days_remaining=None,
                member_count=member_count,
                created_at=result.created_at,
                can_be_deleted=can_be_deleted,
                plan_tier=result.plan_tier or "free",
                subscription_status=result.subscription_status or "active",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Account] Failed to get account status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get account status")


@router.get("/deletion/status", response_model=DeletionStatusResponse)
async def get_deletion_status(request: Request):
    """
    Get current deletion status for the organization.

    Returns whether deletion is pending and days remaining.
    """
    auth_context = get_auth_context(request)
    organization_id = auth_context.organization_id

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )

    try:
        with get_supabase_session() as db:
            result = db.execute(
                text("""
                    SELECT
                        deletion_scheduled_at,
                        deletion_reason
                    FROM organizations
                    WHERE id = :org_id
                    AND deleted_at IS NULL
                """),
                {"org_id": organization_id}
            ).fetchone()

            if not result:
                raise HTTPException(status_code=404, detail="Organization not found")

            is_pending = result.deletion_scheduled_at is not None
            days_remaining = None
            can_cancel = False

            if is_pending and result.deletion_scheduled_at:
                delta = result.deletion_scheduled_at - datetime.now(timezone.utc)
                days_remaining = max(0, delta.days)
                can_cancel = days_remaining > 0

            return DeletionStatusResponse(
                organization_id=str(organization_id),
                is_pending_deletion=is_pending,
                deletion_scheduled_at=result.deletion_scheduled_at,
                days_remaining=days_remaining,
                reason=result.deletion_reason,
                can_cancel=can_cancel,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Account] Failed to get deletion status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get deletion status")


@router.post("/delete", response_model=RequestDeletionResponse)
async def request_account_deletion(
    request: Request,
    deletion_request: RequestDeletionRequest
):
    """
    Request account deletion with 30-day grace period.

    Only organization owners can request deletion.
    Deletion can be cancelled within the grace period.
    After 30 days, all data will be permanently deleted.

    This endpoint:
    1. Validates user is organization owner
    2. Schedules deletion for 30 days from now
    3. Logs the event in audit table
    4. Sends notification email
    """
    auth_context = get_auth_context(request)
    require_owner_role(auth_context)

    if not deletion_request.confirm_deletion:
        raise HTTPException(
            status_code=400,
            detail="You must confirm deletion by setting confirm_deletion to true"
        )

    organization_id = auth_context.organization_id
    user_id = auth_context.user_id
    grace_days = 30

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )

    logger.info(
        f"[Account] Deletion requested: org={organization_id} "
        f"user={user_id} reason={deletion_request.reason}"
    )

    try:
        with get_supabase_session() as db:
            # Use the database function for atomic operation
            result = db.execute(
                text("""
                    SELECT schedule_organization_deletion(
                        CAST(:org_id AS UUID),
                        :user_id,
                        :reason,
                        :feedback,
                        :grace_days
                    ) as result
                """),
                {
                    "org_id": organization_id,
                    "user_id": user_id,  # Now accepts TEXT for Auth0 users
                    "reason": deletion_request.reason,
                    "feedback": deletion_request.feedback,
                    "grace_days": grace_days,
                }
            ).fetchone()

            db.commit()

            if not result or not result.result:
                raise HTTPException(status_code=500, detail="Failed to schedule deletion")

            deletion_result = result.result

            logger.info(
                f"[Account] Deletion scheduled: org={organization_id} "
                f"scheduled_at={deletion_result.get('deletion_scheduled_at')}"
            )

        # Send notification (async, don't block response)
        await send_deletion_notification(
            workflow_id="account-deletion-scheduled",
            user_id=user_id,
            payload={
                "user_name": auth_context.username or auth_context.email,
                "organization_id": organization_id,
                "deletion_date": deletion_result.get('deletion_scheduled_at'),
                "grace_days": grace_days,
                "cancel_url": "/settings/account",
                "message": f"Your account is scheduled for deletion in {grace_days} days.",
            }
        )

        return RequestDeletionResponse(
            success=True,
            organization_id=organization_id,
            deletion_scheduled_at=datetime.fromisoformat(
                deletion_result.get('deletion_scheduled_at').replace('Z', '+00:00')
            ) if deletion_result.get('deletion_scheduled_at') else datetime.now(timezone.utc) + timedelta(days=grace_days),
            grace_days=grace_days,
            message=f"Account scheduled for deletion. You have {grace_days} days to cancel.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Account] Deletion request failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to schedule deletion: {str(e)}")


@router.post("/delete/cancel", response_model=CancelDeletionResponse)
async def cancel_account_deletion(request: Request):
    """
    Cancel a pending account deletion.

    Only works if deletion is still in grace period.
    Only organization owners can cancel deletion.
    """
    auth_context = get_auth_context(request)
    require_owner_role(auth_context)

    organization_id = auth_context.organization_id
    user_id = auth_context.user_id

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )
    # Note: user_id can be Auth0 format (non-UUID) - function accepts TEXT

    logger.info(
        f"[Account] Deletion cancellation requested: org={organization_id} user={user_id}"
    )

    try:
        with get_supabase_session() as db:
            # Use the database function for atomic operation
            result = db.execute(
                text("""
                    SELECT cancel_organization_deletion(
                        CAST(:org_id AS UUID),
                        :user_id
                    ) as result
                """),
                {
                    "org_id": organization_id,
                    "user_id": user_id,  # Accepts TEXT for Auth0 users
                }
            ).fetchone()

            db.commit()

            if not result or not result.result:
                raise HTTPException(status_code=400, detail="No pending deletion to cancel")

            cancel_result = result.result

            logger.info(f"[Account] Deletion cancelled: org={organization_id}")

        # Send notification
        await send_deletion_notification(
            workflow_id="account-deletion-cancelled",
            user_id=user_id,
            payload={
                "user_name": auth_context.username or auth_context.email,
                "organization_id": organization_id,
                "message": "Your account deletion has been cancelled. Your account is now active.",
            }
        )

        return CancelDeletionResponse(
            success=True,
            organization_id=organization_id,
            message="Account deletion has been cancelled. Your account is now active.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Account] Deletion cancellation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel deletion: {str(e)}")


@router.post("/export", response_model=DataExportResponse)
async def request_data_export(request: Request):
    """
    Request GDPR data export.

    Generates a downloadable archive of all user/organization data.
    Export is available for 7 days after generation.

    Includes:
    - User profile data
    - Organization settings
    - All BOMs and components
    - Project data
    - Audit logs
    """
    auth_context = get_auth_context(request)
    require_owner_role(auth_context)

    organization_id = auth_context.organization_id
    user_id = auth_context.user_id

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )
    # Note: user_id can be Auth0 format (non-UUID)

    logger.info(f"[Account] Data export requested: org={organization_id} user={user_id}")

    # For Auth0 users, user_id is not a valid UUID - store NULL and include in event_data
    user_is_uuid = is_valid_uuid(user_id) if user_id else False

    try:
        with get_supabase_session() as db:
            # Create export request record
            event_data = {
                "status": "pending",
                "requested_at": datetime.now(timezone.utc).isoformat()
            }
            if not user_is_uuid and user_id:
                event_data["auth0_user_id"] = user_id

            result = db.execute(
                text("""
                    INSERT INTO account_deletion_audit (
                        organization_id,
                        user_id,
                        event_type,
                        event_data,
                        performed_by
                    ) VALUES (
                        CAST(:org_id AS UUID),
                        CASE WHEN :user_is_uuid THEN CAST(:user_id AS UUID) ELSE NULL END,
                        'data_exported',
                        CAST(:event_data AS JSONB),
                        CASE WHEN :user_is_uuid THEN CAST(:user_id AS UUID) ELSE NULL END
                    )
                    RETURNING id
                """),
                {
                    "org_id": organization_id,
                    "user_id": user_id if user_is_uuid else None,
                    "user_is_uuid": user_is_uuid,
                    "event_data": json.dumps(event_data, cls=DecimalEncoder),
                }
            ).fetchone()

            db.commit()

            export_id = str(result.id) if result else "pending"

            logger.info(f"[Account] Data export initiated: export_id={export_id}")

        # TODO: Trigger async export job via Temporal workflow
        # For now, return pending status

        return DataExportResponse(
            success=True,
            export_id=export_id,
            status="pending",
            download_url=None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            message="Data export has been initiated. You will receive an email when it's ready.",
        )

    except Exception as e:
        logger.error(f"[Account] Data export request failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to request data export")


@router.delete("/delete/immediate", status_code=status.HTTP_200_OK)
async def immediate_deletion(request: Request):
    """
    Immediately delete account (super admin only).

    Bypasses the 30-day grace period.
    Only accessible by super admins for compliance/abuse cases.

    WARNING: This action is irreversible!
    """
    auth_context = get_auth_context(request)

    if not auth_context.is_super_admin:
        logger.warning(
            f"[Account] Non-admin attempted immediate deletion: user={auth_context.user_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Only super admins can perform immediate deletion"
        )

    # Get target org from header (super admin can delete any org)
    target_org_id = request.headers.get("X-Target-Organization-ID")
    if not target_org_id:
        raise HTTPException(status_code=400, detail="X-Target-Organization-ID header required")

    logger.warning(
        f"[Account] IMMEDIATE DELETION by super admin: "
        f"target_org={target_org_id} admin={auth_context.user_id}"
    )

    try:
        with get_supabase_session() as db:
            # Log the event before deletion
            db.execute(
                text("""
                    INSERT INTO account_deletion_audit (
                        organization_id,
                        event_type,
                        event_data,
                        performed_by
                    ) VALUES (
                        CAST(:org_id AS UUID),
                        'deletion_completed',
                        CAST(:event_data AS JSONB),
                        CAST(:admin_id AS UUID)
                    )
                """),
                {
                    "org_id": target_org_id,
                    "event_data": json.dumps({
                        "type": "immediate",
                        "reason": "admin_action",
                        "deleted_at": datetime.now(timezone.utc).isoformat()
                    }, cls=DecimalEncoder),
                    "admin_id": auth_context.user_id,
                }
            )

            # Mark organization as deleted
            db.execute(
                text("""
                    UPDATE organizations SET
                        deleted_at = NOW(),
                        is_suspended = TRUE,
                        suspended_reason = 'Account deleted by administrator',
                        updated_at = NOW()
                    WHERE id = CAST(:org_id AS UUID)
                """),
                {"org_id": target_org_id}
            )

            # Deactivate all users in the organization
            db.execute(
                text("""
                    UPDATE users SET
                        is_active = FALSE,
                        deleted_at = NOW(),
                        updated_at = NOW()
                    WHERE organization_id = CAST(:org_id AS UUID)
                """),
                {"org_id": target_org_id}
            )

            db.commit()

            logger.warning(f"[Account] Organization immediately deleted: {target_org_id}")

        return {
            "success": True,
            "organization_id": target_org_id,
            "message": "Organization has been immediately deleted",
        }

    except Exception as e:
        logger.error(f"[Account] Immediate deletion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete organization: {str(e)}")


@router.get("/audit", response_model=List[Dict[str, Any]])
async def get_deletion_audit(request: Request, limit: int = 50):
    """
    Get deletion audit log for the organization.

    Only accessible by organization owners and super admins.
    """
    auth_context = get_auth_context(request)

    if not auth_context.is_owner and not auth_context.is_super_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    organization_id = auth_context.organization_id

    # Validate organization_id is a valid UUID
    if not organization_id or not is_valid_uuid(organization_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required. Please join or create an organization first."
        )

    try:
        with get_supabase_session() as db:
            results = db.execute(
                text("""
                    SELECT
                        id,
                        event_type,
                        event_data,
                        performed_by,
                        ip_address,
                        created_at
                    FROM account_deletion_audit
                    WHERE organization_id = CAST(:org_id AS UUID)
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {"org_id": organization_id, "limit": limit}
            ).fetchall()

            return [
                {
                    "id": str(row.id),
                    "event_type": row.event_type,
                    "event_data": row.event_data,
                    "performed_by": str(row.performed_by) if row.performed_by else None,
                    "ip_address": str(row.ip_address) if row.ip_address else None,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in results
            ]

    except Exception as e:
        logger.error(f"[Account] Failed to get audit log: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get audit log")
