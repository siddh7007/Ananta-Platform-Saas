"""
Usage Limit Checking Functions

Functions for checking organization limits and tiers.
These can be used to enforce plan limits at the application layer.
"""

import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


# Default plan limits by tier
# These should be synced with the database seed values
DEFAULT_PLAN_LIMITS: Dict[str, Dict[str, int]] = {
    "free": {
        "max_members": 1,
        "max_projects": 2,
        "max_bom_uploads_per_month": 5,
        "max_components_per_bom": 100,
        "max_api_calls_per_month": 100,
    },
    "starter": {
        "max_members": 5,
        "max_projects": 10,
        "max_bom_uploads_per_month": 50,
        "max_components_per_bom": 500,
        "max_api_calls_per_month": 5000,
    },
    "professional": {
        "max_members": 25,
        "max_projects": 50,
        "max_bom_uploads_per_month": 200,
        "max_components_per_bom": 2000,
        "max_api_calls_per_month": 50000,
    },
    "enterprise": {
        "max_members": -1,  # Unlimited
        "max_projects": -1,
        "max_bom_uploads_per_month": -1,
        "max_components_per_bom": -1,
        "max_api_calls_per_month": -1,
    },
}


# Features available by tier
DEFAULT_TIER_FEATURES: Dict[str, list] = {
    "free": [
        "basic_enrichment",
        "csv_export",
    ],
    "starter": [
        "basic_enrichment",
        "csv_export",
        "excel_export",
        "email_support",
        "team_collaboration",
    ],
    "professional": [
        "basic_enrichment",
        "advanced_enrichment",
        "csv_export",
        "excel_export",
        "api_access",
        "priority_support",
        "team_collaboration",
        "custom_fields",
    ],
    "enterprise": [
        "basic_enrichment",
        "advanced_enrichment",
        "csv_export",
        "excel_export",
        "api_access",
        "dedicated_support",
        "team_collaboration",
        "custom_fields",
        "sso_saml",
        "sla_guarantee",
        "custom_integrations",
        "audit_logs",
    ],
}


def get_organization_tier(
    organization_id: str,
    db_session=None,
    default_tier: str = "free"
) -> str:
    """
    Get the subscription tier for an organization.

    Args:
        organization_id: Organization UUID
        db_session: Optional database session for lookup
        default_tier: Default tier if not found

    Returns:
        Tier string ("free", "starter", "professional", "enterprise")

    Note:
        If db_session is provided, this will query the subscriptions table.
        Otherwise, it returns the default_tier.
    """
    if not db_session:
        logger.debug(
            f"[Billing] No DB session, using default tier '{default_tier}' "
            f"for org={organization_id}"
        )
        return default_tier

    try:
        from sqlalchemy import text

        result = db_session.execute(
            text("""
                SELECT sp.tier
                FROM subscriptions s
                JOIN subscription_plans sp ON s.plan_id = sp.id
                WHERE s.organization_id = :org_id
                AND s.status IN ('active', 'trialing')
                ORDER BY s.created_at DESC
                LIMIT 1
            """),
            {"org_id": organization_id}
        ).scalar()

        if result:
            logger.debug(f"[Billing] Org={organization_id} tier={result}")
            return result
        else:
            logger.debug(f"[Billing] No subscription found for org={organization_id}, using default")
            return default_tier

    except Exception as e:
        logger.error(f"[Billing] Error getting org tier: {e}")
        return default_tier


def check_organization_limit(
    organization_id: str,
    limit_name: str,
    current_usage: int = 0,
    db_session=None,
) -> Tuple[bool, Optional[int], Optional[int]]:
    """
    Check if an organization is within a specific limit.

    Args:
        organization_id: Organization UUID
        limit_name: Name of the limit (e.g., "max_members", "max_bom_uploads_per_month")
        current_usage: Current usage count
        db_session: Optional database session

    Returns:
        Tuple of (is_allowed, limit_value, remaining)
        - is_allowed: True if action is within limits
        - limit_value: The limit value (-1 for unlimited, None if invalid)
        - remaining: Number remaining (None if unlimited)
    """
    tier = get_organization_tier(organization_id, db_session)
    limits = DEFAULT_PLAN_LIMITS.get(tier, DEFAULT_PLAN_LIMITS["free"])

    limit_value = limits.get(limit_name)

    if limit_value is None:
        logger.warning(f"[Billing] Unknown limit name: {limit_name}")
        return False, None, None

    # -1 means unlimited
    if limit_value == -1:
        logger.debug(
            f"[Billing] Unlimited {limit_name} for org={organization_id} tier={tier}"
        )
        return True, -1, None

    remaining = max(0, limit_value - current_usage)
    is_allowed = current_usage < limit_value

    logger.debug(
        f"[Billing] Limit check: org={organization_id} {limit_name}={current_usage}/{limit_value} "
        f"allowed={is_allowed} remaining={remaining}"
    )

    return is_allowed, limit_value, remaining


def organization_has_feature(
    organization_id: str,
    feature_name: str,
    db_session=None,
) -> bool:
    """
    Check if an organization has access to a specific feature.

    Args:
        organization_id: Organization UUID
        feature_name: Name of the feature (e.g., "api_access", "sso_saml")
        db_session: Optional database session

    Returns:
        True if the feature is available for this organization's tier
    """
    tier = get_organization_tier(organization_id, db_session)
    features = DEFAULT_TIER_FEATURES.get(tier, DEFAULT_TIER_FEATURES["free"])

    has_feature = feature_name in features

    logger.debug(
        f"[Billing] Feature check: org={organization_id} tier={tier} "
        f"feature={feature_name} has_access={has_feature}"
    )

    return has_feature
