"""
Alert System API Endpoints

This module provides endpoints for managing alerts, user preferences,
and component watching functionality.

Alert Types:
- LIFECYCLE: Component lifecycle status changes (NRND, EOL, Obsolete)
- RISK: Risk score threshold exceeded
- PRICE: Price changes beyond threshold
- AVAILABILITY: Stock/availability issues
- COMPLIANCE: Compliance status changes
- PCN: Product Change Notifications
- SUPPLY_CHAIN: Supply chain issues (scarcity, single-source, supplier diversity)

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.core.authorization import (
    AuthContext,
    get_auth_context,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

def is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID format (for Auth0 vs Supabase user IDs)."""
    if not value:
        return False
    try:
        UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False

def get_user_uuid(user_id: str) -> str:
    """
    Get a valid UUID for the user_id.

    For Supabase users (already UUID format): returns as-is
    For Auth0 users (e.g., 'google-oauth2|123...'): generates deterministic UUID5

    This allows storing Auth0 user IDs in UUID columns without schema changes.
    """
    if is_valid_uuid(user_id):
        return user_id
    # Generate a deterministic UUID5 from the Auth0 user_id
    # Using NAMESPACE_URL as base namespace with a custom prefix
    namespace = uuid.UUID('6ba7b811-9dad-11d1-80b4-00c04fd430c8')  # NAMESPACE_URL
    return str(uuid.uuid5(namespace, f"auth0:{user_id}"))


def get_database_user_id(auth: 'AuthContext', db) -> Optional[str]:
    """
    Get the actual database user ID for an auth context.

    For Supabase users with UUID user_id, verifies the user exists in database.
    For Auth0 users (non-UUID user_id), looks up by email since middleware creates
    user records in Supabase users table.

    Returns None if user not found - this triggers NULL user_id storage (org-level).
    """
    # Option 1: user_id is already a valid UUID - verify it exists
    if is_valid_uuid(auth.user_id):
        try:
            logger.info(f"[Alerts] Verifying UUID user exists: {auth.user_id}")
            result = db.execute(
                text("SELECT id FROM users WHERE id = CAST(:user_id AS UUID) LIMIT 1"),
                {"user_id": auth.user_id}
            ).fetchone()
            if result:
                logger.info(f"[Alerts] UUID user verified: {result[0]}")
                return str(result[0])
            else:
                logger.warning(f"[Alerts] UUID user not found in database: {auth.user_id}")
        except Exception as e:
            logger.warning(f"Failed to verify UUID user: {e}")

    # Option 2: Auth0 user - look up by email (middleware creates users in Supabase)
    if auth.email:
        try:
            logger.info(f"[Alerts] Looking up user by email: {auth.email}")
            result = db.execute(
                text("SELECT id FROM users WHERE email = :email LIMIT 1"),
                {"email": auth.email}
            ).fetchone()
            if result:
                logger.info(f"[Alerts] Found user by email: {result[0]}")
                return str(result[0])
            else:
                logger.warning(f"[Alerts] User not found by email: {auth.email}")
        except Exception as e:
            logger.warning(f"Failed to lookup user by email: {e}")

    # Fallback: Use NULL user_id for organization-level preferences
    logger.info(f"[Alerts] Using org-level preferences for user_id={auth.user_id}, email={auth.email}")
    return None


# =============================================================================
# RESPONSE MODELS
# =============================================================================

class Alert(BaseModel):
    """Alert record"""
    id: str
    severity: str  # critical, high, medium, low, info
    alert_type: str  # LIFECYCLE, RISK, PRICE, AVAILABILITY, COMPLIANCE, PCN, SUPPLY_CHAIN
    title: str
    message: str
    component_id: Optional[str] = None
    component_mpn: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    action_url: Optional[str] = None
    is_read: bool = False
    archived_at: Optional[datetime] = None
    created_at: datetime


class AlertList(BaseModel):
    """Paginated alert list"""
    items: List[Alert]
    total: int
    unread_count: int


class AlertPreference(BaseModel):
    """Alert preference for a specific type"""
    id: Optional[str] = None
    alert_type: str
    email_enabled: bool = True
    in_app_enabled: bool = True
    webhook_enabled: bool = False
    email_address: Optional[str] = None
    webhook_url: Optional[str] = None
    threshold_config: Optional[Dict[str, Any]] = None
    is_active: bool = True


class ComponentWatch(BaseModel):
    """Component watch configuration"""
    id: Optional[str] = None
    component_id: str
    component_mpn: Optional[str] = None
    manufacturer: Optional[str] = None
    watch_pcn: bool = True
    watch_lifecycle: bool = True
    watch_risk: bool = True
    watch_price: bool = False
    watch_stock: bool = False
    watch_compliance: bool = True
    watch_supply_chain: bool = True
    created_at: Optional[datetime] = None


class CreateAlertPreferenceRequest(BaseModel):
    """Request to create/update alert preference"""
    alert_type: str
    is_active: Optional[bool] = None  # None means don't change
    email_enabled: Optional[bool] = None  # None means don't change
    in_app_enabled: Optional[bool] = None  # None means don't change
    webhook_enabled: Optional[bool] = None  # None means don't change
    email_address: Optional[str] = None
    webhook_url: Optional[str] = None
    threshold_config: Optional[Dict[str, Any]] = None


class CreateComponentWatchRequest(BaseModel):
    """Request to add component to watch list"""
    component_id: str
    watch_pcn: bool = True
    watch_lifecycle: bool = True
    watch_risk: bool = True
    watch_price: bool = False
    watch_stock: bool = False
    watch_compliance: bool = True
    watch_supply_chain: bool = True


class UpdateComponentWatchRequest(BaseModel):
    """Request to update component watch settings"""
    watch_pcn: Optional[bool] = None
    watch_lifecycle: Optional[bool] = None
    watch_risk: Optional[bool] = None
    watch_price: Optional[bool] = None
    watch_stock: Optional[bool] = None
    watch_compliance: Optional[bool] = None
    watch_supply_chain: Optional[bool] = None


class UnreadCountResponse(BaseModel):
    """Unread alert count response"""
    unread_count: int


class ThresholdOption(BaseModel):
    """A single configurable threshold option"""
    key: str
    label: str
    description: str
    type: str  # "number", "percent", "boolean", "select"
    default_value: Any
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None  # For select type


class AlertTypeConfig(BaseModel):
    """Configuration schema for an alert type"""
    alert_type: str
    description: str
    default_enabled: bool
    thresholds: List[ThresholdOption]


class AlertPreferenceWithThresholds(BaseModel):
    """Alert preference with detailed threshold configuration"""
    id: Optional[str] = None
    alert_type: str
    description: str
    email_enabled: bool = True
    in_app_enabled: bool = True
    webhook_enabled: bool = False
    email_address: Optional[str] = None
    webhook_url: Optional[str] = None
    threshold_config: Optional[Dict[str, Any]] = None
    threshold_options: List[ThresholdOption] = []
    is_active: bool = True


# Threshold configuration definitions for each alert type
ALERT_THRESHOLD_OPTIONS = {
    "LIFECYCLE": {
        "description": "Alerts when component lifecycle status changes to concerning states",
        "thresholds": [
            ThresholdOption(
                key="alert_on_nrnd",
                label="Alert on NRND",
                description="Alert when status changes to Not Recommended for New Designs",
                type="boolean",
                default_value=True,
            ),
            ThresholdOption(
                key="alert_on_eol",
                label="Alert on EOL",
                description="Alert when status changes to End of Life",
                type="boolean",
                default_value=True,
            ),
            ThresholdOption(
                key="alert_on_obsolete",
                label="Alert on Obsolete",
                description="Alert when status changes to Obsolete",
                type="boolean",
                default_value=True,
            ),
        ]
    },
    "RISK": {
        "description": "Alerts when component risk score exceeds thresholds",
        "thresholds": [
            ThresholdOption(
                key="risk_min",
                label="Minimum Risk Score",
                description="Minimum risk score to trigger an alert (0-100)",
                type="number",
                default_value=60,
                min_value=0,
                max_value=100,
                unit="score",
            ),
            ThresholdOption(
                key="critical_threshold",
                label="Critical Risk Threshold",
                description="Risk score that triggers a CRITICAL severity alert",
                type="number",
                default_value=85,
                min_value=0,
                max_value=100,
                unit="score",
            ),
        ]
    },
    "PRICE": {
        "description": "Alerts when component price changes significantly",
        "thresholds": [
            ThresholdOption(
                key="increase_percent",
                label="Price Increase Threshold",
                description="Minimum price increase percentage to trigger alert",
                type="percent",
                default_value=10,
                min_value=1,
                max_value=100,
                unit="%",
            ),
            ThresholdOption(
                key="decrease_percent",
                label="Price Decrease Threshold",
                description="Price decrease percentage that may indicate EOL clearance",
                type="percent",
                default_value=20,
                min_value=1,
                max_value=100,
                unit="%",
            ),
        ]
    },
    "AVAILABILITY": {
        "description": "Alerts on stock shortages and extended lead times",
        "thresholds": [
            ThresholdOption(
                key="min_stock",
                label="Minimum Stock Level",
                description="Alert when stock falls below this quantity",
                type="number",
                default_value=100,
                min_value=0,
                max_value=10000,
                unit="units",
            ),
            ThresholdOption(
                key="max_lead_time_days",
                label="Maximum Lead Time",
                description="Alert when lead time exceeds this many days",
                type="number",
                default_value=84,
                min_value=1,
                max_value=365,
                unit="days",
            ),
            ThresholdOption(
                key="alert_on_zero_stock",
                label="Alert on Zero Stock",
                description="Always alert when stock is zero",
                type="boolean",
                default_value=True,
            ),
        ]
    },
    "COMPLIANCE": {
        "description": "Alerts on regulatory compliance status changes",
        "thresholds": [
            ThresholdOption(
                key="alert_on_rohs",
                label="Alert on RoHS Non-Compliance",
                description="Alert when component becomes RoHS non-compliant",
                type="boolean",
                default_value=True,
            ),
            ThresholdOption(
                key="alert_on_reach",
                label="Alert on REACH Non-Compliance",
                description="Alert when component becomes REACH non-compliant",
                type="boolean",
                default_value=True,
            ),
        ]
    },
    "PCN": {
        "description": "Alerts on Product Change Notifications from manufacturers",
        "thresholds": [
            ThresholdOption(
                key="alert_on_pcn",
                label="Alert on PCN",
                description="Alert when manufacturer issues a Product Change Notification",
                type="boolean",
                default_value=True,
            ),
        ]
    },
    "SUPPLY_CHAIN": {
        "description": "Alerts on supply chain risks including scarcity and single-source",
        "thresholds": [
            ThresholdOption(
                key="min_suppliers",
                label="Minimum Supplier Count",
                description="Alert when fewer than this many suppliers are available",
                type="number",
                default_value=2,
                min_value=1,
                max_value=10,
                unit="suppliers",
            ),
            ThresholdOption(
                key="scarcity_stock_threshold",
                label="Scarcity Stock Level",
                description="Alert when global stock falls below this level",
                type="number",
                default_value=500,
                min_value=0,
                max_value=100000,
                unit="units",
            ),
            ThresholdOption(
                key="extended_lead_time_days",
                label="Extended Lead Time Alert",
                description="Alert when lead time exceeds this many days",
                type="number",
                default_value=120,
                min_value=30,
                max_value=365,
                unit="days",
            ),
            ThresholdOption(
                key="alert_on_single_source",
                label="Single Source Alert",
                description="Alert when only one supplier is available",
                type="boolean",
                default_value=True,
            ),
        ]
    },
}


# =============================================================================
# ALERT ENDPOINTS
# =============================================================================

@router.get("", response_model=AlertList)
async def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    component_id: Optional[str] = Query(None, description="Filter by component"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    List alerts for the current user with optional filters.

    Supports filtering by severity, type, read status, and component.
    Returns paginated results with total count and unread count.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(f"[Alerts] list_alerts: user={auth.user_id}, org={auth.organization_id}")

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            filters = ["user_id = CAST(:user_id AS UUID)", "deleted_at IS NULL"]
        else:
            filters = ["organization_id = CAST(:org_id AS UUID)", "deleted_at IS NULL"]

        params: Dict[str, Any] = {
            "user_id": auth.user_id,
            "org_id": auth.organization_id,
            "limit": limit,
            "offset": offset
        }

        if severity:
            filters.append("severity = :severity")
            params["severity"] = severity
        if alert_type:
            filters.append("alert_type = :alert_type")
            params["alert_type"] = alert_type
        if is_read is not None:
            filters.append("is_read = :is_read")
            params["is_read"] = is_read
        if component_id:
            filters.append("component_id = :component_id")
            params["component_id"] = component_id

        where_sql = f"WHERE {' AND '.join(filters)}"

        # Get alerts
        sql = f"""
            SELECT
                a.id,
                a.severity,
                a.alert_type,
                a.title,
                a.message,
                a.component_id,
                a.context,
                a.action_url,
                a.is_read,
                a.archived_at,
                a.created_at
            FROM alerts a
            {where_sql}
            AND (a.snoozed_until IS NULL OR a.snoozed_until < NOW())
            ORDER BY a.created_at DESC
            LIMIT :limit OFFSET :offset
        """

        rows = db.execute(text(sql), params).fetchall()

        items = []
        for row in rows:
            m = row._mapping
            items.append(Alert(
                id=str(m["id"]),
                severity=m["severity"],
                alert_type=m["alert_type"],
                title=m["title"],
                message=m["message"],
                component_id=str(m["component_id"]) if m["component_id"] else None,
                component_mpn=None,  # Components table not available
                context=m.get("context"),
                action_url=m.get("action_url"),
                is_read=m["is_read"],
                archived_at=m.get("archived_at"),
                created_at=m["created_at"],
            ))

        # Get total count
        count_sql = f"SELECT COUNT(*) FROM alerts a {where_sql}"
        total = db.execute(text(count_sql), params).scalar() or 0

        # Get unread count (use same filter logic as main query)
        unread_params = {"user_id": auth.user_id, "org_id": auth.organization_id}
        if is_valid_uuid(auth.user_id):
            unread_sql = """
                SELECT COUNT(*) FROM alerts
                WHERE user_id = CAST(:user_id AS UUID) AND is_read = FALSE AND deleted_at IS NULL
            """
        else:
            unread_sql = """
                SELECT COUNT(*) FROM alerts
                WHERE organization_id = CAST(:org_id AS UUID) AND is_read = FALSE AND deleted_at IS NULL
            """
        unread_count = db.execute(text(unread_sql), unread_params).scalar() or 0

        return AlertList(
            items=items,
            total=int(total),
            unread_count=int(unread_count)
        )

    except Exception as e:
        # Handle missing tables gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Alerts] Alert tables not yet configured - returning empty list")
            return AlertList(items=[], total=0, unread_count=0)
        logger.error(f"Failed to list alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch alerts")


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get the count of unread alerts for the current user.

    Used for badge display in UI navigation.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            sql = """
                SELECT COUNT(*) FROM alerts
                WHERE user_id = CAST(:user_id AS UUID)
                AND is_read = FALSE
                AND deleted_at IS NULL
                AND (snoozed_until IS NULL OR snoozed_until < NOW())
            """
        else:
            sql = """
                SELECT COUNT(*) FROM alerts
                WHERE organization_id = CAST(:org_id AS UUID)
                AND is_read = FALSE
                AND deleted_at IS NULL
                AND (snoozed_until IS NULL OR snoozed_until < NOW())
            """
        params = {"user_id": auth.user_id, "org_id": auth.organization_id}

        count = db.execute(text(sql), params).scalar() or 0

        return UnreadCountResponse(unread_count=int(count))

    except Exception as e:
        logger.error(f"Failed to get unread count: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch unread count")


@router.get("/stats")
async def get_alert_stats(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get aggregate alert statistics for the current user.

    Returns counts by type, severity, and recent alerts.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        params = {"user_id": auth.user_id, "org_id": auth.organization_id}

        # Determine filter based on Auth0 vs Supabase user_id
        if is_valid_uuid(auth.user_id):
            user_filter = "user_id = CAST(:user_id AS UUID)"
        else:
            user_filter = "organization_id = CAST(:org_id AS UUID)"

        # Get total and unread
        count_sql = f"""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count
            FROM alerts
            WHERE {user_filter} AND deleted_at IS NULL
        """
        count_row = db.execute(text(count_sql), params).fetchone()
        count_map = count_row._mapping if count_row else {}

        # Get counts by type
        type_sql = f"""
            SELECT alert_type, COUNT(*) as count
            FROM alerts
            WHERE {user_filter} AND deleted_at IS NULL
            GROUP BY alert_type
        """
        type_rows = db.execute(text(type_sql), params).fetchall()
        by_type = {row._mapping["alert_type"]: row._mapping["count"] for row in type_rows}

        # Get counts by severity
        severity_sql = f"""
            SELECT severity, COUNT(*) as count
            FROM alerts
            WHERE {user_filter} AND deleted_at IS NULL
            GROUP BY severity
        """
        severity_rows = db.execute(text(severity_sql), params).fetchall()
        by_severity = {row._mapping["severity"]: row._mapping["count"] for row in severity_rows}

        # Get recent 24h count
        recent_sql = f"""
            SELECT COUNT(*) as count
            FROM alerts
            WHERE {user_filter}
            AND deleted_at IS NULL
            AND created_at > NOW() - INTERVAL '24 hours'
        """
        recent_row = db.execute(text(recent_sql), params).fetchone()
        recent_24h = recent_row._mapping["count"] if recent_row else 0

        return {
            "total_alerts": count_map.get("total", 0),
            "unread_count": count_map.get("unread_count", 0),
            "by_type": by_type,
            "by_severity": by_severity,
            "recent_24h": recent_24h,
        }

    except Exception as e:
        # Handle missing tables gracefully
        error_msg = str(e).lower()
        if "relation" in error_msg and "does not exist" in error_msg:
            logger.warning(f"[Alerts] Alert tables not yet configured - returning empty stats")
            return {
                "total_alerts": 0,
                "unread_count": 0,
                "by_type": {},
                "by_severity": {},
                "recent_24h": 0,
            }
        logger.error(f"Failed to get alert stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch alert statistics")


@router.post("/mark-all-read")
async def mark_all_alerts_read(
    auth: AuthContext = Depends(get_auth_context)
):
    """Mark all unread alerts as read for the current user."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            sql = """
                UPDATE alerts
                SET is_read = TRUE
                WHERE user_id = CAST(:user_id AS UUID) AND is_read = FALSE AND deleted_at IS NULL
            """
        else:
            sql = """
                UPDATE alerts
                SET is_read = TRUE
                WHERE organization_id = CAST(:org_id AS UUID) AND is_read = FALSE AND deleted_at IS NULL
            """
        params = {"user_id": auth.user_id, "org_id": auth.organization_id}

        result = db.execute(text(sql), params)
        db.commit()

        return {"success": True, "marked_count": result.rowcount}

    except Exception as e:
        logger.error(f"Failed to mark all alerts read: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update alerts")


# =============================================================================
# ALERT PREFERENCES ENDPOINTS
# =============================================================================

@router.get("/threshold-options", response_model=List[AlertTypeConfig])
async def get_threshold_options():
    """
    Get available threshold configuration options for all alert types.

    Returns the configurable threshold settings for each alert type,
    including field types, default values, min/max ranges, and descriptions.
    """
    configs = []
    default_enabled_types = ["LIFECYCLE", "RISK", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]

    for alert_type, config in ALERT_THRESHOLD_OPTIONS.items():
        configs.append(AlertTypeConfig(
            alert_type=alert_type,
            description=config["description"],
            default_enabled=alert_type in default_enabled_types,
            thresholds=config["thresholds"],
        ))

    return configs


@router.get("/preferences", response_model=List[AlertPreference])
async def get_alert_preferences(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all alert preferences for the current user.

    Returns preferences for each alert type, or defaults if not set.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        # If no valid organization_id, return defaults only
        rows = []
        if auth.organization_id and is_valid_uuid(auth.organization_id):
            # Look up the actual database user ID for Auth0 users
            user_uuid = get_database_user_id(auth, db)

            if user_uuid:
                sql = """
                    SELECT
                        id,
                        alert_type,
                        email_enabled,
                        in_app_enabled,
                        webhook_enabled,
                        email_address,
                        webhook_url,
                        threshold_config,
                        is_active
                    FROM alert_preferences
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND user_id = CAST(:user_id AS UUID)
                """
                params = {"user_id": user_uuid, "org_id": auth.organization_id}
                rows = db.execute(text(sql), params).fetchall()

        preferences = []
        found_types = set()

        for row in rows:
            m = row._mapping
            found_types.add(m["alert_type"])
            preferences.append(AlertPreference(
                id=str(m["id"]),
                alert_type=m["alert_type"],
                email_enabled=m["email_enabled"],
                in_app_enabled=m["in_app_enabled"],
                webhook_enabled=m["webhook_enabled"],
                email_address=m.get("email_address"),
                webhook_url=m.get("webhook_url"),
                threshold_config=m.get("threshold_config"),
                is_active=m["is_active"],
            ))

        # Add defaults for missing types
        default_types = ["LIFECYCLE", "RISK", "PRICE", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]
        for alert_type in default_types:
            if alert_type not in found_types:
                preferences.append(AlertPreference(
                    alert_type=alert_type,
                    email_enabled=alert_type in ["LIFECYCLE", "RISK", "COMPLIANCE", "SUPPLY_CHAIN"],
                    in_app_enabled=True,
                    webhook_enabled=False,
                    is_active=alert_type in ["LIFECYCLE", "RISK", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"],
                ))

        return preferences

    except Exception as e:
        logger.error(f"Failed to get alert preferences: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch preferences")


@router.get("/preferences/with-thresholds", response_model=List[AlertPreferenceWithThresholds])
async def get_alert_preferences_with_thresholds(
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all alert preferences with threshold configuration options.

    Returns preferences for each alert type including:
    - Current user settings
    - Available threshold options with types and ranges
    - Default values for unconfigured thresholds
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        # If no valid organization_id, return defaults only
        rows = []
        if auth.organization_id and is_valid_uuid(auth.organization_id):
            # Look up the actual database user ID for Auth0 users
            user_uuid = get_database_user_id(auth, db)

            if user_uuid:
                sql = """
                    SELECT
                        id,
                        alert_type,
                        email_enabled,
                        in_app_enabled,
                        webhook_enabled,
                        email_address,
                        webhook_url,
                        threshold_config,
                        is_active
                    FROM alert_preferences
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND user_id = CAST(:user_id AS UUID)
                """
                params = {"user_id": user_uuid, "org_id": auth.organization_id}
                rows = db.execute(text(sql), params).fetchall()

        # Build lookup of existing preferences
        existing_prefs = {}
        for row in rows:
            m = row._mapping
            existing_prefs[m["alert_type"]] = m

        preferences = []
        default_types = ["LIFECYCLE", "RISK", "PRICE", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]

        for alert_type in default_types:
            config = ALERT_THRESHOLD_OPTIONS.get(alert_type, {"description": "", "thresholds": []})
            existing = existing_prefs.get(alert_type)

            if existing:
                pref = AlertPreferenceWithThresholds(
                    id=str(existing["id"]),
                    alert_type=alert_type,
                    description=config["description"],
                    email_enabled=existing["email_enabled"],
                    in_app_enabled=existing["in_app_enabled"],
                    webhook_enabled=existing["webhook_enabled"],
                    email_address=existing.get("email_address"),
                    webhook_url=existing.get("webhook_url"),
                    threshold_config=existing.get("threshold_config"),
                    threshold_options=config["thresholds"],
                    is_active=existing["is_active"],
                )
            else:
                # Return defaults
                pref = AlertPreferenceWithThresholds(
                    alert_type=alert_type,
                    description=config["description"],
                    email_enabled=alert_type in ["LIFECYCLE", "RISK", "COMPLIANCE", "SUPPLY_CHAIN"],
                    in_app_enabled=True,
                    webhook_enabled=False,
                    threshold_config=None,
                    threshold_options=config["thresholds"],
                    is_active=alert_type in ["LIFECYCLE", "RISK", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"],
                )

            preferences.append(pref)

        return preferences

    except Exception as e:
        logger.error(f"Failed to get alert preferences with thresholds: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch preferences")


@router.put("/preferences", response_model=AlertPreference)
async def update_alert_preference(
    preference: CreateAlertPreferenceRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Create or update an alert preference.

    Valid alert types: LIFECYCLE, RISK, PRICE, AVAILABILITY, COMPLIANCE, PCN, SUPPLY_CHAIN
    """
    valid_types = ["LIFECYCLE", "RISK", "PRICE", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]
    if preference.alert_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid alert type. Valid types: {valid_types}"
        )

    # Validate organization_id exists and is valid UUID
    org_id = auth.organization_id
    if not org_id or not is_valid_uuid(org_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required to save preferences. Please join or create an organization first."
        )

    try:
        db = next(get_dual_database().get_session("supabase"))
        import json

        # Try to get the database user ID - may be None for Auth0 users
        user_uuid = get_database_user_id(auth, db)
        use_user_id = user_uuid is not None
        # For Auth0 users without a database user record, use NULL user_id
        # This uses the partial index: idx_alert_prefs_org_type_auth0 (WHERE user_id IS NULL)

        if use_user_id:
            check_sql = """
                SELECT id FROM alert_preferences
                WHERE user_id = CAST(:user_id AS UUID)
                AND organization_id = CAST(:org_id AS UUID)
                AND alert_type = :alert_type
            """
            check_params = {
                "user_id": user_uuid,
                "org_id": auth.organization_id,
                "alert_type": preference.alert_type,
            }
        else:
            # Auth0 user without database record - use NULL user_id
            check_sql = """
                SELECT id FROM alert_preferences
                WHERE user_id IS NULL
                AND organization_id = CAST(:org_id AS UUID)
                AND alert_type = :alert_type
            """
            check_params = {
                "org_id": auth.organization_id,
                "alert_type": preference.alert_type,
            }

        existing = db.execute(text(check_sql), check_params).fetchone()

        if existing:
            # UPDATE existing preference - build dynamic update for non-None fields
            pref_id = existing[0]

            # Get current values to merge with
            current_sql = """
                SELECT email_enabled, in_app_enabled, webhook_enabled,
                       email_address, webhook_url, threshold_config, is_active
                FROM alert_preferences WHERE id = :pref_id
            """
            current = db.execute(text(current_sql), {"pref_id": pref_id}).fetchone()
            current_map = current._mapping if current else {}

            # Build update fields - only update non-None values from request
            update_fields = []
            params = {"pref_id": pref_id}

            if preference.is_active is not None:
                update_fields.append("is_active = :is_active")
                params["is_active"] = preference.is_active
            if preference.email_enabled is not None:
                update_fields.append("email_enabled = :email_enabled")
                params["email_enabled"] = preference.email_enabled
            if preference.in_app_enabled is not None:
                update_fields.append("in_app_enabled = :in_app_enabled")
                params["in_app_enabled"] = preference.in_app_enabled
            if preference.webhook_enabled is not None:
                update_fields.append("webhook_enabled = :webhook_enabled")
                params["webhook_enabled"] = preference.webhook_enabled
            if preference.email_address is not None:
                update_fields.append("email_address = :email_address")
                params["email_address"] = preference.email_address
            if preference.webhook_url is not None:
                update_fields.append("webhook_url = :webhook_url")
                params["webhook_url"] = preference.webhook_url
            if preference.threshold_config is not None:
                update_fields.append("threshold_config = :threshold_config")
                params["threshold_config"] = json.dumps(preference.threshold_config)

            update_fields.append("updated_at = NOW()")

            update_sql = f"""
                UPDATE alert_preferences SET
                    {', '.join(update_fields)}
                WHERE id = :pref_id
                RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                          email_address, webhook_url, threshold_config, is_active
            """
            row = db.execute(text(update_sql), params).fetchone()
        else:
            # INSERT new preference - use defaults for None values
            # Default enabled types
            default_enabled_types = ["LIFECYCLE", "RISK", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]
            default_email_types = ["LIFECYCLE", "RISK", "COMPLIANCE", "SUPPLY_CHAIN"]

            params = {
                "org_id": auth.organization_id,
                "alert_type": preference.alert_type,
                "is_active": preference.is_active if preference.is_active is not None else (preference.alert_type in default_enabled_types),
                "email_enabled": preference.email_enabled if preference.email_enabled is not None else (preference.alert_type in default_email_types),
                "in_app_enabled": preference.in_app_enabled if preference.in_app_enabled is not None else True,
                "webhook_enabled": preference.webhook_enabled if preference.webhook_enabled is not None else False,
                "email_address": preference.email_address,
                "webhook_url": preference.webhook_url,
                "threshold_config": json.dumps(preference.threshold_config) if preference.threshold_config else None,
            }

            if use_user_id:
                insert_sql = """
                    INSERT INTO alert_preferences (
                        user_id, organization_id, alert_type,
                        is_active, email_enabled, in_app_enabled, webhook_enabled,
                        email_address, webhook_url, threshold_config,
                        updated_at
                    ) VALUES (
                        CAST(:user_id AS UUID), CAST(:org_id AS UUID), :alert_type,
                        :is_active, :email_enabled, :in_app_enabled, :webhook_enabled,
                        :email_address, :webhook_url, :threshold_config,
                        NOW()
                    )
                    RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                              email_address, webhook_url, threshold_config, is_active
                """
                params["user_id"] = user_uuid
            else:
                # Auth0 user - insert with NULL user_id
                insert_sql = """
                    INSERT INTO alert_preferences (
                        user_id, organization_id, alert_type,
                        is_active, email_enabled, in_app_enabled, webhook_enabled,
                        email_address, webhook_url, threshold_config,
                        updated_at
                    ) VALUES (
                        NULL, CAST(:org_id AS UUID), :alert_type,
                        :is_active, :email_enabled, :in_app_enabled, :webhook_enabled,
                        :email_address, :webhook_url, :threshold_config,
                        NOW()
                    )
                    RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                              email_address, webhook_url, threshold_config, is_active
                """
            row = db.execute(text(insert_sql), params).fetchone()

        db.commit()

        m = row._mapping
        return AlertPreference(
            id=str(m["id"]),
            alert_type=m["alert_type"],
            email_enabled=m["email_enabled"],
            in_app_enabled=m["in_app_enabled"],
            webhook_enabled=m["webhook_enabled"],
            email_address=m.get("email_address"),
            webhook_url=m.get("webhook_url"),
            threshold_config=m.get("threshold_config"),
            is_active=m["is_active"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update alert preference: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update preference")


class UpdateThresholdsRequest(BaseModel):
    """Request to update just the threshold configuration"""
    threshold_config: Dict[str, Any]


@router.put("/preferences/{alert_type}/thresholds", response_model=AlertPreferenceWithThresholds)
async def update_alert_thresholds(
    alert_type: str,
    request: UpdateThresholdsRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Update threshold configuration for a specific alert type.

    This endpoint allows updating just the threshold settings without
    changing other preference options like email/in_app/webhook settings.

    Valid alert types: LIFECYCLE, RISK, PRICE, AVAILABILITY, COMPLIANCE, PCN, SUPPLY_CHAIN
    """
    valid_types = ["LIFECYCLE", "RISK", "PRICE", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]
    if alert_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid alert type. Valid types: {valid_types}"
        )

    # Validate organization_id exists and is valid UUID
    org_id = auth.organization_id
    if not org_id or not is_valid_uuid(org_id):
        raise HTTPException(
            status_code=400,
            detail="Valid organization required to save preferences. Please join or create an organization first."
        )

    try:
        db = next(get_dual_database().get_session("supabase"))
        import json

        # Try to get the database user ID - may be None for Auth0 users
        user_uuid = get_database_user_id(auth, db)
        use_user_id = user_uuid is not None

        # For Auth0 users without a database user record, use NULL user_id
        if use_user_id:
            check_sql = """
                SELECT id FROM alert_preferences
                WHERE user_id = CAST(:user_id AS UUID)
                AND organization_id = CAST(:org_id AS UUID)
                AND alert_type = :alert_type
            """
            check_params = {
                "user_id": user_uuid,
                "org_id": auth.organization_id,
                "alert_type": alert_type,
            }
        else:
            check_sql = """
                SELECT id FROM alert_preferences
                WHERE user_id IS NULL
                AND organization_id = CAST(:org_id AS UUID)
                AND alert_type = :alert_type
            """
            check_params = {
                "org_id": auth.organization_id,
                "alert_type": alert_type,
            }

        existing = db.execute(text(check_sql), check_params).fetchone()

        if existing:
            # UPDATE existing preference - only threshold_config
            params = {
                "pref_id": existing[0],
                "threshold_config": json.dumps(request.threshold_config) if request.threshold_config else None,
            }
            update_sql = """
                UPDATE alert_preferences SET
                    threshold_config = :threshold_config,
                    updated_at = NOW()
                WHERE id = :pref_id
                RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                          email_address, webhook_url, threshold_config, is_active
            """
            row = db.execute(text(update_sql), params).fetchone()
        else:
            # INSERT new preference with default values
            # Default enabled types
            default_enabled_types = ["LIFECYCLE", "RISK", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]
            default_email_types = ["LIFECYCLE", "RISK", "COMPLIANCE", "SUPPLY_CHAIN"]

            params = {
                "org_id": auth.organization_id,
                "alert_type": alert_type,
                "is_active": alert_type in default_enabled_types,
                "email_enabled": alert_type in default_email_types,
                "in_app_enabled": True,
                "webhook_enabled": False,
                "threshold_config": json.dumps(request.threshold_config) if request.threshold_config else None,
            }

            if use_user_id:
                insert_sql = """
                    INSERT INTO alert_preferences (
                        user_id, organization_id, alert_type,
                        is_active, email_enabled, in_app_enabled, webhook_enabled,
                        threshold_config, updated_at
                    ) VALUES (
                        CAST(:user_id AS UUID), CAST(:org_id AS UUID), :alert_type,
                        :is_active, :email_enabled, :in_app_enabled, :webhook_enabled,
                        :threshold_config, NOW()
                    )
                    RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                              email_address, webhook_url, threshold_config, is_active
                """
                params["user_id"] = user_uuid
            else:
                insert_sql = """
                    INSERT INTO alert_preferences (
                        user_id, organization_id, alert_type,
                        is_active, email_enabled, in_app_enabled, webhook_enabled,
                        threshold_config, updated_at
                    ) VALUES (
                        NULL, CAST(:org_id AS UUID), :alert_type,
                        :is_active, :email_enabled, :in_app_enabled, :webhook_enabled,
                        :threshold_config, NOW()
                    )
                    RETURNING id, alert_type, email_enabled, in_app_enabled, webhook_enabled,
                              email_address, webhook_url, threshold_config, is_active
                """
            row = db.execute(text(insert_sql), params).fetchone()

        db.commit()

        m = row._mapping
        config = ALERT_THRESHOLD_OPTIONS.get(alert_type, {"description": "", "thresholds": []})

        return AlertPreferenceWithThresholds(
            id=str(m["id"]),
            alert_type=m["alert_type"],
            description=config["description"],
            email_enabled=m["email_enabled"],
            in_app_enabled=m["in_app_enabled"],
            webhook_enabled=m["webhook_enabled"],
            email_address=m.get("email_address"),
            webhook_url=m.get("webhook_url"),
            threshold_config=m.get("threshold_config"),
            threshold_options=config["thresholds"],
            is_active=m["is_active"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update thresholds for {alert_type}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update thresholds")


@router.post("/preferences/reset")
async def reset_alert_preferences(
    auth: AuthContext = Depends(get_auth_context)
):
    """Reset all alert preferences to defaults."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # Delete existing preferences - use org_id only for Auth0 compatibility
        sql = """
            DELETE FROM alert_preferences
            WHERE organization_id = CAST(:org_id AS UUID)
        """
        params = {"org_id": auth.organization_id}

        db.execute(text(sql), params)
        db.commit()

        return {"success": True, "message": "Preferences reset to defaults"}

    except Exception as e:
        logger.error(f"Failed to reset alert preferences: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset preferences")


# =============================================================================
# COMPONENT WATCHES ENDPOINTS
# =============================================================================

@router.get("/watches", response_model=List[ComponentWatch])
async def list_component_watches(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    List all components the user is watching.

    Returns watch configuration for each component.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        sql = """
            SELECT
                cw.id,
                cw.component_id,
                cw.watch_pcn,
                cw.watch_lifecycle,
                cw.watch_risk,
                cw.watch_price,
                cw.watch_stock,
                cw.watch_compliance,
                cw.watch_supply_chain,
                cw.created_at
            FROM component_watches cw
            WHERE cw.user_id = CAST(:user_id AS UUID)
            ORDER BY cw.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        # For Auth0 users with non-UUID user_id, return empty list
        if not is_valid_uuid(auth.user_id):
            return []
        
        params = {
            "user_id": auth.user_id,
            "limit": limit,
            "offset": offset
        }

        rows = db.execute(text(sql), params).fetchall()

        watches = []
        for row in rows:
            m = row._mapping
            watches.append(ComponentWatch(
                id=str(m["id"]),
                component_id=str(m["component_id"]),
                component_mpn=None,  # Components table not available
                manufacturer=None,   # Components table not available
                watch_pcn=m["watch_pcn"],
                watch_lifecycle=m["watch_lifecycle"],
                watch_risk=m["watch_risk"],
                watch_price=m["watch_price"],
                watch_stock=m["watch_stock"],
                watch_compliance=m["watch_compliance"],
                watch_supply_chain=m.get("watch_supply_chain", True),
                created_at=m["created_at"],
            ))

        return watches

    except Exception as e:
        logger.error(f"Failed to list component watches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch watches")


@router.post("/watches", response_model=ComponentWatch)
async def add_component_watch(
    watch: CreateComponentWatchRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Add a component to the user's watch list.

    If already watching, updates the watch settings.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        # Upsert watch
        sql = """
            INSERT INTO component_watches (
                user_id, component_id,
                watch_pcn, watch_lifecycle, watch_risk,
                watch_price, watch_stock, watch_compliance, watch_supply_chain
            ) VALUES (
                :user_id, :component_id,
                :watch_pcn, :watch_lifecycle, :watch_risk,
                :watch_price, :watch_stock, :watch_compliance, :watch_supply_chain
            )
            ON CONFLICT (user_id, component_id)
            DO UPDATE SET
                watch_pcn = :watch_pcn,
                watch_lifecycle = :watch_lifecycle,
                watch_risk = :watch_risk,
                watch_price = :watch_price,
                watch_stock = :watch_stock,
                watch_compliance = :watch_compliance,
                watch_supply_chain = :watch_supply_chain
            RETURNING id, component_id, watch_pcn, watch_lifecycle, watch_risk,
                      watch_price, watch_stock, watch_compliance, watch_supply_chain, created_at
        """

        params = {
            "user_id": auth.user_id,
            "component_id": watch.component_id,
            "watch_pcn": watch.watch_pcn,
            "watch_lifecycle": watch.watch_lifecycle,
            "watch_risk": watch.watch_risk,
            "watch_price": watch.watch_price,
            "watch_stock": watch.watch_stock,
            "watch_compliance": watch.watch_compliance,
            "watch_supply_chain": watch.watch_supply_chain,
        }

        row = db.execute(text(sql), params).fetchone()
        db.commit()

        # Get component details
        comp_sql = """
            SELECT manufacturer_part_number, manufacturer
            FROM components WHERE id = :component_id
        """
        comp_row = db.execute(text(comp_sql), {"component_id": watch.component_id}).fetchone()

        m = row._mapping
        return ComponentWatch(
            id=str(m["id"]),
            component_id=str(m["component_id"]),
            component_mpn=comp_row._mapping.get("manufacturer_part_number") if comp_row else None,
            manufacturer=comp_row._mapping.get("manufacturer") if comp_row else None,
            watch_pcn=m["watch_pcn"],
            watch_lifecycle=m["watch_lifecycle"],
            watch_risk=m["watch_risk"],
            watch_price=m["watch_price"],
            watch_stock=m["watch_stock"],
            watch_compliance=m["watch_compliance"],
            watch_supply_chain=m.get("watch_supply_chain", True),
            created_at=m["created_at"],
        )

    except Exception as e:
        logger.error(f"Failed to add component watch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to add watch")


@router.put("/watches/{component_id}", response_model=ComponentWatch)
async def update_component_watch(
    component_id: str,
    update: UpdateComponentWatchRequest,
    auth: AuthContext = Depends(get_auth_context)
):
    """Update watch settings for a specific component."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # Build dynamic update
        updates = []
        params: Dict[str, Any] = {
            "user_id": auth.user_id,
            "component_id": component_id
        }

        if update.watch_pcn is not None:
            updates.append("watch_pcn = :watch_pcn")
            params["watch_pcn"] = update.watch_pcn
        if update.watch_lifecycle is not None:
            updates.append("watch_lifecycle = :watch_lifecycle")
            params["watch_lifecycle"] = update.watch_lifecycle
        if update.watch_risk is not None:
            updates.append("watch_risk = :watch_risk")
            params["watch_risk"] = update.watch_risk
        if update.watch_price is not None:
            updates.append("watch_price = :watch_price")
            params["watch_price"] = update.watch_price
        if update.watch_stock is not None:
            updates.append("watch_stock = :watch_stock")
            params["watch_stock"] = update.watch_stock
        if update.watch_compliance is not None:
            updates.append("watch_compliance = :watch_compliance")
            params["watch_compliance"] = update.watch_compliance
        if update.watch_supply_chain is not None:
            updates.append("watch_supply_chain = :watch_supply_chain")
            params["watch_supply_chain"] = update.watch_supply_chain

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        sql = f"""
            UPDATE component_watches
            SET {', '.join(updates)}
            WHERE user_id = :user_id AND component_id = :component_id
            RETURNING id, component_id, watch_pcn, watch_lifecycle, watch_risk,
                      watch_price, watch_stock, watch_compliance, watch_supply_chain, created_at
        """

        row = db.execute(text(sql), params).fetchone()
        db.commit()

        if not row:
            raise HTTPException(status_code=404, detail="Watch not found")

        # Get component details
        comp_sql = """
            SELECT manufacturer_part_number, manufacturer
            FROM components WHERE id = :component_id
        """
        comp_row = db.execute(text(comp_sql), {"component_id": component_id}).fetchone()

        m = row._mapping
        return ComponentWatch(
            id=str(m["id"]),
            component_id=str(m["component_id"]),
            component_mpn=comp_row._mapping.get("manufacturer_part_number") if comp_row else None,
            manufacturer=comp_row._mapping.get("manufacturer") if comp_row else None,
            watch_pcn=m["watch_pcn"],
            watch_lifecycle=m["watch_lifecycle"],
            watch_risk=m["watch_risk"],
            watch_price=m["watch_price"],
            watch_stock=m["watch_stock"],
            watch_compliance=m["watch_compliance"],
            watch_supply_chain=m.get("watch_supply_chain", True),
            created_at=m["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update component watch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update watch")


@router.delete("/watches/{component_id}")
async def remove_component_watch(
    component_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Remove a component from the user's watch list."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        sql = """
            DELETE FROM component_watches
            WHERE user_id = :user_id AND component_id = :component_id
            RETURNING id
        """
        params = {"user_id": auth.user_id, "component_id": component_id}

        result = db.execute(text(sql), params)
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Watch not found")

        return {"success": True, "message": "Watch removed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove component watch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to remove watch")


# =============================================================================
# ALERT ID ROUTES (Must be at end to avoid matching specific paths)
# =============================================================================
# NOTE: These routes use {alert_id} parameter and MUST be defined after all
# specific path routes like /preferences, /watches, /threshold-options to
# prevent FastAPI from matching those paths as alert IDs.

@router.get("/by-id/{alert_id}", response_model=Alert)
async def get_alert(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Get a specific alert by ID."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            user_filter = "a.user_id = CAST(:user_id AS UUID)"
        else:
            user_filter = "a.organization_id = CAST(:org_id AS UUID)"

        sql = f"""
            SELECT
                a.id,
                a.severity,
                a.alert_type,
                a.title,
                a.message,
                a.component_id,
                a.context,
                a.action_url,
                a.is_read,
                a.archived_at,
                a.created_at
            FROM alerts a
            WHERE a.id = CAST(:alert_id AS UUID) AND {user_filter} AND a.deleted_at IS NULL
        """
        params = {"alert_id": alert_id, "user_id": auth.user_id, "org_id": auth.organization_id}

        row = db.execute(text(sql), params).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")

        m = row._mapping
        return Alert(
            id=str(m["id"]),
            severity=m["severity"],
            alert_type=m["alert_type"],
            title=m["title"],
            message=m["message"],
            component_id=str(m["component_id"]) if m["component_id"] else None,
            component_mpn=None,  # Components table not available
            context=m.get("context"),
            action_url=m.get("action_url"),
            is_read=m["is_read"],
            archived_at=m.get("archived_at"),
            created_at=m["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get alert {alert_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch alert")


@router.put("/by-id/{alert_id}/read")
async def mark_alert_read_by_id(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Mark a specific alert as read."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            user_filter = "user_id = CAST(:user_id AS UUID)"
        else:
            user_filter = "organization_id = CAST(:org_id AS UUID)"

        sql = f"""
            UPDATE alerts
            SET is_read = TRUE
            WHERE id = CAST(:alert_id AS UUID) AND {user_filter} AND deleted_at IS NULL
            RETURNING id
        """
        params = {"alert_id": alert_id, "user_id": auth.user_id, "org_id": auth.organization_id}

        result = db.execute(text(sql), params)
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert marked as read"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark alert read {alert_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update alert")


@router.put("/by-id/{alert_id}/archive")
async def archive_alert_by_id(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Archive an alert (soft delete)."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            user_filter = "user_id = CAST(:user_id AS UUID)"
        else:
            user_filter = "organization_id = CAST(:org_id AS UUID)"

        sql = f"""
            UPDATE alerts
            SET archived_at = NOW(), is_read = TRUE
            WHERE id = CAST(:alert_id AS UUID) AND {user_filter} AND deleted_at IS NULL
            RETURNING id
        """
        params = {"alert_id": alert_id, "user_id": auth.user_id, "org_id": auth.organization_id}

        result = db.execute(text(sql), params)
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert archived"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to archive alert {alert_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to archive alert")


@router.delete("/by-id/{alert_id}")
async def delete_alert_by_id(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Delete an alert (soft delete)."""
    try:
        db = next(get_dual_database().get_session("supabase"))

        # For Auth0 users with non-UUID user_id, filter by organization_id instead
        if is_valid_uuid(auth.user_id):
            user_filter = "user_id = CAST(:user_id AS UUID)"
        else:
            user_filter = "organization_id = CAST(:org_id AS UUID)"

        sql = f"""
            UPDATE alerts
            SET deleted_at = NOW()
            WHERE id = CAST(:alert_id AS UUID) AND {user_filter} AND deleted_at IS NULL
            RETURNING id
        """
        params = {"alert_id": alert_id, "user_id": auth.user_id, "org_id": auth.organization_id}

        result = db.execute(text(sql), params)
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")

        return {"success": True, "message": "Alert deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete alert {alert_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete alert")


@router.post("/by-id/{alert_id}/read")
async def mark_alert_read_post_by_id(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Mark a specific alert as read (POST variant for frontend compatibility)."""
    return await mark_alert_read_by_id(alert_id, auth)


@router.post("/by-id/{alert_id}/dismiss")
async def dismiss_alert_post_by_id(
    alert_id: str,
    auth: AuthContext = Depends(get_auth_context)
):
    """Dismiss an alert (POST variant for frontend compatibility)."""
    return await archive_alert_by_id(alert_id, auth)