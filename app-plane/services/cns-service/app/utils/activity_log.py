"""
Activity Log helpers.

Provides utilities to write audit_log entries so CNS dashboards can display
consistent events (bulk uploads, enrichment actions, etc.).
"""

import json
import logging
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def record_audit_log_entry(
    db: Session,
    *,
    event_type: str,
    routing_key: str,
    organization_id: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    email: Optional[str] = None,
    source: str = "cns-dashboard",
    event_data: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Insert an entry into Supabase's audit_logs table.

    Args:
        db: SQLAlchemy session connected to Supabase.
        event_type: Logical event name (e.g. 'cns.bulk.uploaded').
        routing_key: Event routing key (e.g. 'cns.bom.bulk_uploaded').
        organization_id: Organization UUID associated with the event.
        user_id / username / email: Actor metadata (optional).
        source: Human-readable source string.
        event_data: Extra JSON payload.

    Returns:
        bool: True if audit log was recorded successfully, False otherwise.
              Callers handling critical/destructive events should check this
              and abort if False to maintain audit compliance.
    """
    payload = {
        "event_type": event_type,
        "routing_key": routing_key,
        "organization_id": organization_id,
        "user_id": user_id,
        "username": username,
        "email": email,
        "source": source,
        "event_data": json.dumps(event_data or {}),
    }

    try:
        db.execute(
            text(
                """
                INSERT INTO audit_logs (
                    event_type,
                    routing_key,
                    organization_id,
                    user_id,
                    username,
                    email,
                    source,
                    event_data
                ) VALUES (
                    :event_type,
                    :routing_key,
                    :organization_id,
                    :user_id,
                    :username,
                    :email,
                    :source,
                    CAST(:event_data AS jsonb)
                )
                """
            ),
            payload,
        )
        return True
    except Exception as exc:
        logger.warning(
            "[ActivityLog] Failed to record audit log entry (%s): %s",
            event_type,
            exc,
            exc_info=True,
        )
        return False
