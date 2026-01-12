"""
Novu Workflow Mappings

Maps existing alert types to Novu workflow identifiers.
Each workflow must be created in Novu Admin Dashboard (http://localhost:27852).
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


class NovuChannel(Enum):
    """Novu notification channels."""
    IN_APP = "in_app"
    EMAIL = "email"
    WEBHOOK = "webhook"
    SMS = "sms"
    PUSH = "push"


@dataclass
class WorkflowMapping:
    """Mapping from alert type to Novu workflow."""
    workflow_id: str
    display_name: str
    description: str
    default_channels: List[NovuChannel]
    is_critical: bool  # True = sync delivery, False = async via RabbitMQ
    payload_schema: Dict[str, Any]


# Alert Type → Novu Workflow Mapping
ALERT_WORKFLOWS: Dict[str, WorkflowMapping] = {
    "LIFECYCLE": WorkflowMapping(
        workflow_id="component-lifecycle-change",
        display_name="Lifecycle Status Change",
        description="Component moved to NRND, EOL, or Obsolete",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,  # Critical: sync delivery
        payload_schema={
            "component_mpn": "str",
            "component_manufacturer": "str",
            "old_status": "str",
            "new_status": "str",
            "affected_boms": "List[str]",
        }
    ),
    "RISK": WorkflowMapping(
        workflow_id="risk-threshold-exceeded",
        display_name="Risk Threshold Alert",
        description="Component risk score exceeded threshold",
        default_channels=[NovuChannel.IN_APP],
        is_critical=False,  # Non-critical: async via RabbitMQ
        payload_schema={
            "component_mpn": "str",
            "old_score": "int",
            "new_score": "int",
            "risk_level": "str",
            "top_factors": "List[str]",
        }
    ),
    "PRICE": WorkflowMapping(
        workflow_id="price-change-alert",
        display_name="Price Change Alert",
        description="Component price changed beyond threshold",
        default_channels=[NovuChannel.IN_APP],
        is_critical=False,
        payload_schema={
            "component_mpn": "str",
            "old_price": "float",
            "new_price": "float",
            "change_percent": "float",
            "supplier": "str",
        }
    ),
    "AVAILABILITY": WorkflowMapping(
        workflow_id="availability-alert",
        display_name="Availability Alert",
        description="Stock or lead time issues detected",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,  # Critical: sync delivery
        payload_schema={
            "component_mpn": "str",
            "current_stock": "int",
            "lead_time_days": "int",
            "supplier": "str",
        }
    ),
    "COMPLIANCE": WorkflowMapping(
        workflow_id="compliance-change-alert",
        display_name="Compliance Status Change",
        description="RoHS, REACH, or other compliance status changed",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,  # Critical: sync delivery
        payload_schema={
            "component_mpn": "str",
            "compliance_type": "str",
            "old_status": "str",
            "new_status": "str",
        }
    ),
    "PCN": WorkflowMapping(
        workflow_id="product-change-notification",
        display_name="Product Change Notification",
        description="Manufacturer issued PCN for component",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL, NovuChannel.WEBHOOK],
        is_critical=True,  # Critical: sync delivery
        payload_schema={
            "component_mpn": "str",
            "pcn_number": "str",
            "pcn_type": "str",
            "effective_date": "str",
            "summary": "str",
        }
    ),
    "ENRICHMENT_COMPLETE": WorkflowMapping(
        workflow_id="bom-enrichment-complete",
        display_name="BOM Enrichment Complete",
        description="BOM enrichment job finished",
        default_channels=[NovuChannel.IN_APP],
        is_critical=False,  # Non-critical: async
        payload_schema={
            "bom_name": "str",
            "total_components": "int",
            "enriched_count": "int",
            "failed_count": "int",
            "quality_summary": "str",
        }
    ),
    "DAILY_DIGEST": WorkflowMapping(
        workflow_id="daily-risk-digest",
        display_name="Daily Risk Digest",
        description="Daily summary of portfolio risk changes",
        default_channels=[NovuChannel.EMAIL],
        is_critical=False,  # Scheduled, async
        payload_schema={
            "date": "str",
            "new_high_risk_count": "int",
            "resolved_count": "int",
            "top_concerns": "List[Dict]",
        }
    ),
    # =====================================================
    # User Onboarding Workflows
    # =====================================================
    "USER_WELCOME": WorkflowMapping(
        workflow_id="user-welcome",
        display_name="Welcome New User",
        description="Welcome message for new users with onboarding tips",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,  # Welcome should be immediate
        payload_schema={
            "user_name": "str",
            "user_email": "str",
            "organization_name": "str",
            "role": "str",
            "getting_started_url": "str",
            "trial_days_remaining": "Optional[int]",
        }
    ),
    "TRIAL_STARTED": WorkflowMapping(
        workflow_id="trial-started",
        display_name="Trial Period Started",
        description="Notification when organization starts their trial",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,
        payload_schema={
            "organization_name": "str",
            "trial_end_date": "str",
            "trial_days": "int",
            "features_available": "List[str]",
            "upgrade_url": "str",
        }
    ),
    "TRIAL_EXPIRING": WorkflowMapping(
        workflow_id="trial-expiring",
        display_name="Trial Expiring Soon",
        description="Reminder that trial is about to expire",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,
        payload_schema={
            "organization_name": "str",
            "days_remaining": "int",
            "trial_end_date": "str",
            "upgrade_url": "str",
        }
    ),
    "ORGANIZATION_CREATED": WorkflowMapping(
        workflow_id="organization-created",
        display_name="Organization Created",
        description="Confirmation when new organization is set up",
        default_channels=[NovuChannel.IN_APP, NovuChannel.EMAIL],
        is_critical=True,
        payload_schema={
            "organization_name": "str",
            "organization_slug": "str",
            "admin_email": "str",
            "setup_checklist": "List[Dict]",
            "dashboard_url": "str",
        }
    ),
    "MEMBER_INVITED": WorkflowMapping(
        workflow_id="member-invited",
        display_name="Member Invited",
        description="Notification when a user is invited to join organization",
        default_channels=[NovuChannel.EMAIL],
        is_critical=True,
        payload_schema={
            "inviter_name": "str",
            "organization_name": "str",
            "invite_url": "str",
            "role": "str",
            "expires_at": "str",
        }
    ),
    "MEMBER_JOINED": WorkflowMapping(
        workflow_id="member-joined",
        display_name="Member Joined Organization",
        description="Notification when a new member joins the organization",
        default_channels=[NovuChannel.IN_APP],
        is_critical=False,
        payload_schema={
            "new_member_name": "str",
            "new_member_email": "str",
            "organization_name": "str",
            "role": "str",
        }
    ),
    # =====================================================
    # Workspace Workflows
    # =====================================================
    "WORKSPACE_INVITATION": WorkflowMapping(
        workflow_id="workspace-invitation",
        display_name="Workspace Invitation",
        description="Email invitation to join a workspace",
        default_channels=[NovuChannel.EMAIL],
        is_critical=True,  # Invitations should be delivered immediately
        payload_schema={
            "inviter_name": "str",
            "inviter_email": "str",
            "workspace_name": "str",
            "organization_name": "str",
            "role": "str",
            "invite_url": "str",
            "expires_at": "str",
        }
    ),
    "WORKSPACE_MEMBER_JOINED": WorkflowMapping(
        workflow_id="workspace-member-joined",
        display_name="Member Joined Workspace",
        description="Notification when a member joins a workspace",
        default_channels=[NovuChannel.IN_APP],
        is_critical=False,
        payload_schema={
            "new_member_name": "str",
            "new_member_email": "str",
            "workspace_name": "str",
            "organization_name": "str",
            "role": "str",
        }
    ),
}


def get_workflow(alert_type: str) -> Optional[WorkflowMapping]:
    """
    Get workflow mapping for alert type.

    Args:
        alert_type: Alert type string (e.g., "LIFECYCLE", "RISK")

    Returns:
        WorkflowMapping or None if not found
    """
    return ALERT_WORKFLOWS.get(alert_type.upper())


def is_critical_alert(alert_type: str) -> bool:
    """
    Check if alert type requires synchronous delivery.

    Critical alerts are delivered immediately via direct Novu API call.
    Non-critical alerts are queued via RabbitMQ for async processing.

    Args:
        alert_type: Alert type string

    Returns:
        True if alert should be delivered synchronously
    """
    workflow = ALERT_WORKFLOWS.get(alert_type.upper())
    return workflow.is_critical if workflow else False


def get_default_channels(alert_type: str) -> List[str]:
    """
    Get default notification channels for alert type.

    Args:
        alert_type: Alert type string

    Returns:
        List of channel names
    """
    workflow = ALERT_WORKFLOWS.get(alert_type.upper())
    if workflow:
        return [ch.value for ch in workflow.default_channels]
    return ["in_app"]  # Default to in-app only


def list_workflow_ids() -> List[str]:
    """
    Get list of all workflow IDs.

    Useful for initial Novu setup to know which workflows to create.

    Returns:
        List of Novu workflow ID strings
    """
    return [wf.workflow_id for wf in ALERT_WORKFLOWS.values()]
