"""
Onboarding API Endpoints

Handles user onboarding and welcome notifications:
- POST /api/onboarding/welcome - Trigger welcome notification for current user
- GET /api/onboarding/status - Get onboarding status for organization
- POST /api/onboarding/checklist/{step} - Mark onboarding step complete
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core.authorization import get_auth_context, AuthContext
from ..models.dual_database import get_dual_database
from ..services.onboarding_service import get_onboarding_service, WelcomePayload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


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
class OnboardingChecklist(BaseModel):
    """Onboarding checklist status."""
    first_bom_uploaded: bool = False
    first_enrichment_complete: bool = False
    team_member_invited: bool = False
    alert_preferences_configured: bool = False
    risk_thresholds_set: bool = False


class OnboardingStatus(BaseModel):
    """Full onboarding status for organization."""
    organization_id: str
    organization_name: str
    checklist: OnboardingChecklist
    onboarding_completed_at: Optional[str] = None
    user_welcome_sent: bool = False
    user_first_login_at: Optional[str] = None
    trial_days_remaining: Optional[int] = None


class WelcomeResponse(BaseModel):
    """Response from welcome notification."""
    success: bool
    message: str
    already_sent: bool = False


class ChecklistUpdateResponse(BaseModel):
    """Response from checklist update."""
    success: bool
    step: str
    completed: bool
    all_complete: bool


# =====================================================
# API Endpoints
# =====================================================
@router.post("/welcome", response_model=WelcomeResponse)
async def trigger_welcome_notification(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger welcome notification for the current user.

    This endpoint is called on first login to send a welcome message.
    It's idempotent - if welcome was already sent, it won't send again.
    """
    user_id = auth.user_id
    organization_id = auth.organization_id

    if not organization_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")

    logger.info(f"[Onboarding] Welcome request for user={user_id}, org={organization_id}")

    # Get onboarding service
    onboarding_service = get_onboarding_service()

    # Check if welcome was already sent
    already_sent = await onboarding_service.check_welcome_sent(user_id, organization_id)
    if already_sent:
        logger.info(f"[Onboarding] Welcome already sent for user={user_id}")
        return WelcomeResponse(
            success=True,
            message="Welcome notification was already sent",
            already_sent=True
        )

    # Get user and organization details
    # Auth0 user_id is a string like 'google-oauth2|104091950411565213800'
    with get_supabase_session() as session:
        result = session.execute(
            text("""
                SELECT
                    u.id as internal_user_id,
                    u.email,
                    COALESCE(u.full_name, u.email) as user_name,
                    o.name as org_name,
                    om.role,
                    o.trial_ends_at
                FROM users u
                JOIN organization_memberships om ON om.user_id = u.id
                JOIN organizations o ON o.id = om.organization_id
                WHERE u.auth0_user_id = :user_id
                AND o.id = CAST(:org_id AS UUID)
            """),
            {"user_id": user_id, "org_id": organization_id}
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User or organization not found")

        internal_user_id, user_email, user_name, org_name, role, trial_ends_at = row

        # Calculate trial days remaining
        trial_days_remaining = None
        if trial_ends_at:
            delta = trial_ends_at - datetime.now(timezone.utc)
            trial_days_remaining = max(0, delta.days)

        # Update first login timestamp using the internal user UUID
        session.execute(
            text("""
                UPDATE organization_memberships
                SET first_login_at = COALESCE(first_login_at, NOW())
                WHERE user_id = :internal_user_id
                AND organization_id = CAST(:org_id AS UUID)
            """),
            {"internal_user_id": internal_user_id, "org_id": organization_id}
        )

    # Save internal_user_id for event logging (it's a UUID from the database)
    db_user_id = str(internal_user_id)

    # Build payload and send welcome
    payload = WelcomePayload(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        organization_id=organization_id,
        organization_name=org_name,
        role=role or "member",
        trial_days_remaining=trial_days_remaining
    )

    success = await onboarding_service.send_welcome_notification(payload)

    if success:
        # Log the event using the internal user UUID
        with get_supabase_session() as session:
            session.execute(
                text("""
                    INSERT INTO onboarding_events (organization_id, user_id, event_type, event_data)
                    VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), 'user_welcome_sent', :data::jsonb)
                """),
                {
                    "org_id": organization_id,
                    "user_id": db_user_id,
                    "data": '{"role": "' + (role or "member") + '"}'
                }
            )

    return WelcomeResponse(
        success=success,
        message="Welcome notification sent successfully" if success else "Failed to send welcome notification",
        already_sent=False
    )


@router.get("/status", response_model=OnboardingStatus)
async def get_onboarding_status(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get onboarding status for the current user's organization.

    Returns checklist progress, completion status, and trial information.
    """
    user_id = auth.user_id
    organization_id = auth.organization_id

    if not organization_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")

    with get_supabase_session() as session:
        # Auth0 user_id is a string like 'google-oauth2|104091950411565213800'
        # We need to look up the internal user UUID from the users table
        result = session.execute(
            text("""
                SELECT
                    o.id,
                    o.name,
                    COALESCE(o.onboarding_checklist, '{}'::jsonb) as checklist,
                    o.onboarding_completed_at,
                    o.trial_ends_at,
                    om.welcome_sent_at,
                    om.first_login_at
                FROM organizations o
                JOIN organization_memberships om ON om.organization_id = o.id
                JOIN users u ON u.id = om.user_id
                WHERE o.id = CAST(:org_id AS UUID)
                AND u.auth0_user_id = :user_id
            """),
            {"org_id": organization_id, "user_id": user_id}
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Organization not found")

        org_id, org_name, checklist_json, completed_at, trial_ends_at, welcome_sent, first_login = row

        # Calculate trial days remaining
        trial_days_remaining = None
        if trial_ends_at:
            delta = trial_ends_at - datetime.now(timezone.utc)
            trial_days_remaining = max(0, delta.days)

        # Parse checklist
        checklist = OnboardingChecklist(
            first_bom_uploaded=checklist_json.get('first_bom_uploaded', False) if checklist_json else False,
            first_enrichment_complete=checklist_json.get('first_enrichment_complete', False) if checklist_json else False,
            team_member_invited=checklist_json.get('team_member_invited', False) if checklist_json else False,
            alert_preferences_configured=checklist_json.get('alert_preferences_configured', False) if checklist_json else False,
            risk_thresholds_set=checklist_json.get('risk_thresholds_set', False) if checklist_json else False,
        )

        return OnboardingStatus(
            organization_id=str(org_id),
            organization_name=org_name,
            checklist=checklist,
            onboarding_completed_at=completed_at.isoformat() if completed_at else None,
            user_welcome_sent=welcome_sent is not None,
            user_first_login_at=first_login.isoformat() if first_login else None,
            trial_days_remaining=trial_days_remaining
        )


@router.post("/checklist/{step}", response_model=ChecklistUpdateResponse)
async def update_checklist_step(
    step: str,
    completed: bool = True,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Mark an onboarding checklist step as complete.

    Valid steps:
    - first_bom_uploaded
    - first_enrichment_complete
    - team_member_invited
    - alert_preferences_configured
    - risk_thresholds_set
    """
    organization_id = auth.organization_id

    if not organization_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")

    valid_steps = [
        'first_bom_uploaded',
        'first_enrichment_complete',
        'team_member_invited',
        'alert_preferences_configured',
        'risk_thresholds_set'
    ]

    if step not in valid_steps:
        raise HTTPException(status_code=400, detail=f"Invalid step. Valid steps: {', '.join(valid_steps)}")

    logger.info(f"[Onboarding] Updating checklist step={step} completed={completed} for org={organization_id}")

    with get_supabase_session() as session:
        # Look up internal user UUID from Auth0 user ID
        user_result = session.execute(
            text("SELECT id FROM users WHERE auth0_user_id = :auth0_id"),
            {"auth0_id": auth.user_id}
        )
        user_row = user_result.fetchone()
        internal_user_id = str(user_row[0]) if user_row else None

        result = session.execute(
            text("SELECT update_onboarding_checklist(CAST(:org_id AS UUID), :step, :completed)"),
            {"org_id": organization_id, "step": step, "completed": completed}
        )
        all_complete = result.scalar()

        # Log the event using internal user UUID
        if internal_user_id:
            session.execute(
                text("""
                    INSERT INTO onboarding_events (organization_id, user_id, event_type, event_data)
                    VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), 'onboarding_step_completed', :data::jsonb)
                """),
                {
                    "org_id": organization_id,
                    "user_id": internal_user_id,
                    "data": f'{{"step": "{step}", "completed": {str(completed).lower()}}}'
                }
            )

            # If all steps complete, log completion event
            if all_complete:
                session.execute(
                    text("""
                        INSERT INTO onboarding_events (organization_id, user_id, event_type, event_data)
                        VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), 'onboarding_completed', '{}')
                    """),
                    {"org_id": organization_id, "user_id": internal_user_id}
                )

    return ChecklistUpdateResponse(
        success=True,
        step=step,
        completed=completed,
        all_complete=all_complete or False
    )


@router.post("/trial-started")
async def trigger_trial_started_notification(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Trigger trial started notification.

    This is typically called internally when a new organization is created,
    but can be triggered manually for testing.
    """
    if not auth.is_admin and not auth.is_super_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    organization_id = auth.organization_id
    user_id = auth.user_id

    if not organization_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")

    with get_supabase_session() as session:
        result = session.execute(
            text("""
                SELECT name, trial_ends_at
                FROM organizations
                WHERE id = CAST(:org_id AS UUID)
            """),
            {"org_id": organization_id}
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Organization not found")

        org_name, trial_ends_at = row

        if not trial_ends_at:
            raise HTTPException(status_code=400, detail="Organization is not on a trial")

        # Calculate trial days
        delta = trial_ends_at - datetime.now(timezone.utc)
        trial_days = max(0, delta.days)

    # Send notification
    onboarding_service = get_onboarding_service()
    success = await onboarding_service.send_trial_started_notification(
        organization_id=organization_id,
        organization_name=org_name,
        admin_user_id=user_id,
        trial_end_date=trial_ends_at.isoformat(),
        trial_days=trial_days
    )

    return {"success": success, "message": "Trial started notification sent" if success else "Failed to send notification"}
