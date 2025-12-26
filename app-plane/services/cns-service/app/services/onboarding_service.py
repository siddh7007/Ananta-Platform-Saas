"""
Onboarding Notification Service

Handles welcome messages and onboarding notifications for new users:
- User welcome message (first login)
- Organization created notification
- Trial started notification
- Trial expiring reminder
- Member invited/joined notifications

Uses Novu for multi-channel delivery (in-app, email).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from dataclasses import dataclass

from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.config import settings

logger = logging.getLogger(__name__)

# Novu integration imports - optional
try:
    from shared.notification.config import NotificationConfig
    from shared.notification.providers import get_notification_provider
    from shared.notification.workflows import get_workflow, ALERT_WORKFLOWS
    from shared.notification.publisher import NotificationPublisher, NotificationEvent
    NOVU_AVAILABLE = True
except ImportError:
    NOVU_AVAILABLE = False
    logger.info("[OnboardingService] Novu integration not available")


@dataclass
class WelcomePayload:
    """Payload for welcome notification."""
    user_id: str
    user_name: str
    user_email: str
    organization_id: str
    organization_name: str
    role: str
    trial_days_remaining: Optional[int] = None
    getting_started_url: str = ""


@dataclass
class TrialPayload:
    """Payload for trial notifications."""
    organization_id: str
    organization_name: str
    trial_end_date: str
    trial_days: int
    features_available: Optional[list] = None
    upgrade_url: str = ""


class OnboardingService:
    """
    Manages onboarding notifications for new users and organizations.

    Sends notifications via Novu when configured, with database fallback.
    """

    def __init__(self):
        self.settings = settings  # Use global settings singleton
        self.novu_provider = None
        self.novu_config = None

        if NOVU_AVAILABLE:
            try:
                self.novu_config = NotificationConfig()
                if self.novu_config.enabled:
                    self.novu_provider = get_notification_provider()
                    logger.info("[OnboardingService] Novu provider initialized")
            except Exception as e:
                logger.warning(f"[OnboardingService] Failed to initialize Novu: {e}")

    def _get_supabase_session(self):
        """Get a session for the Supabase database."""
        dual_db = get_dual_database()
        return dual_db.SupabaseSession()

    async def send_welcome_notification(self, payload: WelcomePayload) -> bool:
        """
        Send welcome notification to a new user.

        This is called on first login or when user is first added to an organization.

        Args:
            payload: WelcomePayload with user and organization details

        Returns:
            True if notification was sent successfully
        """
        logger.info(f"[OnboardingService] Sending welcome notification to user={payload.user_id}")

        # Build notification payload
        notification_payload = {
            "user_name": payload.user_name,
            "user_email": payload.user_email,
            "organization_name": payload.organization_name,
            "role": payload.role,
            "getting_started_url": payload.getting_started_url or f"{self.settings.FRONTEND_URL}/getting-started",
            "trial_days_remaining": payload.trial_days_remaining,
        }

        # Send via Novu if available
        if self._can_use_novu():
            success = await self._send_via_novu(
                workflow_id="user-welcome",
                subscriber_id=payload.user_id,
                payload=notification_payload
            )
            if success:
                await self._mark_welcome_sent(payload.user_id, payload.organization_id)
                return True

        # Fallback: Store in database as in-app notification
        await self._store_notification(
            organization_id=payload.organization_id,
            user_id=payload.user_id,
            notification_type="USER_WELCOME",
            title=f"Welcome to {payload.organization_name}!",
            message=self._get_welcome_message(payload),
            context=notification_payload
        )
        await self._mark_welcome_sent(payload.user_id, payload.organization_id)

        return True

    async def send_trial_started_notification(
        self,
        organization_id: str,
        organization_name: str,
        admin_user_id: str,
        trial_end_date: str,
        trial_days: int = 14
    ) -> bool:
        """
        Send notification when a trial period starts.

        Args:
            organization_id: Organization UUID
            organization_name: Organization display name
            admin_user_id: User ID of the organization admin
            trial_end_date: ISO date string of trial end
            trial_days: Number of trial days

        Returns:
            True if notification was sent
        """
        logger.info(f"[OnboardingService] Sending trial started notification to org={organization_id}")

        notification_payload = {
            "organization_name": organization_name,
            "trial_end_date": trial_end_date,
            "trial_days": trial_days,
            "features_available": [
                "Unlimited BOM uploads",
                "Component enrichment",
                "Risk analysis",
                "Multi-user collaboration",
            ],
            "upgrade_url": f"{self.settings.FRONTEND_URL}/billing/upgrade",
        }

        if self._can_use_novu():
            success = await self._send_via_novu(
                workflow_id="trial-started",
                subscriber_id=admin_user_id,
                payload=notification_payload
            )
            if success:
                return True

        # Fallback
        await self._store_notification(
            organization_id=organization_id,
            user_id=admin_user_id,
            notification_type="TRIAL_STARTED",
            title="Your trial has started!",
            message=f"Welcome! Your {trial_days}-day trial of Components Platform ends on {trial_end_date}.",
            context=notification_payload
        )

        return True

    async def send_trial_expiring_notification(
        self,
        organization_id: str,
        organization_name: str,
        user_ids: list,
        trial_end_date: str,
        days_remaining: int
    ) -> int:
        """
        Send trial expiring reminder to organization admins.

        Args:
            organization_id: Organization UUID
            organization_name: Organization display name
            user_ids: List of admin user IDs to notify
            trial_end_date: ISO date string of trial end
            days_remaining: Days until trial expires

        Returns:
            Number of notifications sent
        """
        logger.info(f"[OnboardingService] Sending trial expiring notification to org={organization_id}, days_remaining={days_remaining}")

        notification_payload = {
            "organization_name": organization_name,
            "days_remaining": days_remaining,
            "trial_end_date": trial_end_date,
            "upgrade_url": f"{self.settings.FRONTEND_URL}/billing/upgrade",
        }

        sent_count = 0
        for user_id in user_ids:
            if self._can_use_novu():
                success = await self._send_via_novu(
                    workflow_id="trial-expiring",
                    subscriber_id=user_id,
                    payload=notification_payload
                )
                if success:
                    sent_count += 1
                    continue

            # Fallback
            await self._store_notification(
                organization_id=organization_id,
                user_id=user_id,
                notification_type="TRIAL_EXPIRING",
                title=f"Trial expires in {days_remaining} days",
                message=f"Your trial of Components Platform expires on {trial_end_date}. Upgrade now to keep your data.",
                context=notification_payload
            )
            sent_count += 1

        return sent_count

    async def send_organization_created_notification(
        self,
        organization_id: str,
        organization_name: str,
        organization_slug: str,
        admin_email: str,
        admin_user_id: str
    ) -> bool:
        """
        Send notification when organization is created.

        Args:
            organization_id: Organization UUID
            organization_name: Organization display name
            organization_slug: Organization URL slug
            admin_email: Admin email address
            admin_user_id: Admin user ID

        Returns:
            True if notification was sent
        """
        logger.info(f"[OnboardingService] Sending org created notification for org={organization_id}")

        notification_payload = {
            "organization_name": organization_name,
            "organization_slug": organization_slug,
            "admin_email": admin_email,
            "setup_checklist": [
                {"task": "Upload your first BOM", "completed": False},
                {"task": "Invite team members", "completed": False},
                {"task": "Configure alert preferences", "completed": False},
                {"task": "Set up risk thresholds", "completed": False},
            ],
            "dashboard_url": f"{self.settings.FRONTEND_URL}/",
        }

        if self._can_use_novu():
            success = await self._send_via_novu(
                workflow_id="organization-created",
                subscriber_id=admin_user_id,
                payload=notification_payload
            )
            if success:
                return True

        # Fallback
        await self._store_notification(
            organization_id=organization_id,
            user_id=admin_user_id,
            notification_type="ORGANIZATION_CREATED",
            title=f"Organization '{organization_name}' created!",
            message="Your organization is set up. Start by uploading your first BOM or inviting team members.",
            context=notification_payload
        )

        return True

    async def send_member_invited_notification(
        self,
        inviter_name: str,
        organization_name: str,
        invitee_email: str,
        invite_url: str,
        role: str,
        expires_at: str
    ) -> bool:
        """
        Send invitation email to a new member.

        Note: This is sent to email only (invitee doesn't have an account yet).

        Args:
            inviter_name: Name of person sending invite
            organization_name: Organization name
            invitee_email: Email of person being invited
            invite_url: URL to accept invitation
            role: Role being assigned
            expires_at: Expiration date of invite

        Returns:
            True if invitation was sent
        """
        logger.info(f"[OnboardingService] Sending member invite to email={invitee_email}")

        notification_payload = {
            "inviter_name": inviter_name,
            "organization_name": organization_name,
            "invite_url": invite_url,
            "role": role,
            "expires_at": expires_at,
        }

        if self._can_use_novu():
            # Use email as subscriber ID for non-existing users
            success = await self._send_via_novu(
                workflow_id="member-invited",
                subscriber_id=invitee_email,
                payload=notification_payload,
                email=invitee_email
            )
            if success:
                return True

        # Email-only notification - would need SMTP fallback
        logger.warning(f"[OnboardingService] Cannot send invite email - Novu not available for {invitee_email}")
        return False

    async def send_member_joined_notification(
        self,
        organization_id: str,
        new_member_name: str,
        new_member_email: str,
        organization_name: str,
        role: str,
        admin_user_ids: list
    ) -> int:
        """
        Notify admins when a new member joins.

        Args:
            organization_id: Organization UUID
            new_member_name: Name of new member
            new_member_email: Email of new member
            organization_name: Organization name
            role: Role assigned to new member
            admin_user_ids: List of admin user IDs to notify

        Returns:
            Number of notifications sent
        """
        logger.info(f"[OnboardingService] Sending member joined notification for {new_member_email}")

        notification_payload = {
            "new_member_name": new_member_name,
            "new_member_email": new_member_email,
            "organization_name": organization_name,
            "role": role,
        }

        sent_count = 0
        for admin_id in admin_user_ids:
            if self._can_use_novu():
                success = await self._send_via_novu(
                    workflow_id="member-joined",
                    subscriber_id=admin_id,
                    payload=notification_payload
                )
                if success:
                    sent_count += 1
                    continue

            # Fallback
            await self._store_notification(
                organization_id=organization_id,
                user_id=admin_id,
                notification_type="MEMBER_JOINED",
                title=f"New member joined",
                message=f"{new_member_name} ({new_member_email}) has joined as {role}.",
                context=notification_payload
            )
            sent_count += 1

        return sent_count

    async def check_welcome_sent(self, user_id: str, organization_id: str) -> bool:
        """
        Check if welcome notification was already sent to this user.

        Args:
            user_id: User UUID
            organization_id: Organization UUID

        Returns:
            True if welcome was already sent
        """
        session = self._get_supabase_session()
        try:
            result = session.execute(
                text("""
                    SELECT welcome_sent_at
                    FROM organization_memberships
                    WHERE user_id = CAST(:user_id AS UUID)
                    AND organization_id = CAST(:org_id AS UUID)
                """),
                {"user_id": user_id, "org_id": organization_id}
            )
            row = result.fetchone()
            return row is not None and row[0] is not None
        except Exception as e:
            logger.warning(f"[OnboardingService] Error checking welcome sent: {e}")
            return False
        finally:
            session.close()

    async def _mark_welcome_sent(self, user_id: str, organization_id: str):
        """Mark welcome notification as sent for user."""
        session = self._get_supabase_session()
        try:
            session.execute(
                text("""
                    UPDATE organization_memberships
                    SET welcome_sent_at = NOW()
                    WHERE user_id = CAST(:user_id AS UUID)
                    AND organization_id = CAST(:org_id AS UUID)
                """),
                {"user_id": user_id, "org_id": organization_id}
            )
            session.commit()
            logger.info(f"[OnboardingService] Marked welcome sent for user={user_id}")
        except Exception as e:
            session.rollback()
            logger.warning(f"[OnboardingService] Error marking welcome sent: {e}")
        finally:
            session.close()

    def _can_use_novu(self) -> bool:
        """Check if Novu is available and configured."""
        return (
            NOVU_AVAILABLE
            and self.novu_config is not None
            and self.novu_config.enabled
            and self.novu_provider is not None
        )

    async def _send_via_novu(
        self,
        workflow_id: str,
        subscriber_id: str,
        payload: Dict[str, Any],
        email: Optional[str] = None
    ) -> bool:
        """
        Send notification via Novu.

        Args:
            workflow_id: Novu workflow identifier
            subscriber_id: Subscriber ID (user ID or email)
            payload: Notification payload
            email: Optional email for subscriber creation

        Returns:
            True if sent successfully
        """
        try:
            # Ensure subscriber exists
            if email:
                await self.novu_provider.create_or_update_subscriber(
                    subscriber_id=subscriber_id,
                    email=email
                )

            # Trigger workflow
            result = await self.novu_provider.send_notification(
                workflow_id=workflow_id,
                subscriber_id=subscriber_id,
                payload=payload
            )

            logger.info(f"[OnboardingService] Novu notification sent: workflow={workflow_id}, subscriber={subscriber_id}")
            return result

        except Exception as e:
            logger.error(f"[OnboardingService] Novu send failed: {e}")
            return False

    async def _store_notification(
        self,
        organization_id: str,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Store notification in database as fallback."""
        session = self._get_supabase_session()
        try:
            session.execute(
                text("""
                    INSERT INTO alerts (
                        organization_id, user_id, alert_type, severity,
                        title, message, context, is_read, created_at
                    ) VALUES (
                        CAST(:org_id AS UUID),
                        CAST(:user_id AS UUID),
                        :alert_type,
                        'INFO',
                        :title,
                        :message,
                        :context::jsonb,
                        false,
                        NOW()
                    )
                """),
                {
                    "org_id": organization_id,
                    "user_id": user_id,
                    "alert_type": notification_type,
                    "title": title,
                    "message": message,
                    "context": str(context) if context else "{}",
                }
            )
            session.commit()
            logger.info(f"[OnboardingService] Notification stored in DB for user={user_id}")
        except Exception as e:
            session.rollback()
            logger.error(f"[OnboardingService] Failed to store notification: {e}")
        finally:
            session.close()

    def _get_welcome_message(self, payload: WelcomePayload) -> str:
        """Generate welcome message text."""
        message = f"""Welcome to {payload.organization_name}, {payload.user_name}!

You've been added as a {payload.role}. Here's how to get started:

1. Upload your first BOM to begin component analysis
2. Explore the risk dashboard to understand your component risks
3. Set up alert preferences to stay informed about changes

"""
        if payload.trial_days_remaining:
            message += f"You have {payload.trial_days_remaining} days remaining in your trial.\n"

        return message


# Singleton instance
_onboarding_service: Optional[OnboardingService] = None


def get_onboarding_service() -> OnboardingService:
    """Get or create OnboardingService singleton."""
    global _onboarding_service
    if _onboarding_service is None:
        _onboarding_service = OnboardingService()
    return _onboarding_service
