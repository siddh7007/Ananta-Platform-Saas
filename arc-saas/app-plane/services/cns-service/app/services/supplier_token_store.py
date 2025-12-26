"""
Supplier Token Store

Persists supplier OAuth tokens (e.g., DigiKey) so rotating refresh tokens survive restarts.
"""

import logging
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy import text

from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS supplier_tokens (
    supplier_name TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_tokens_expires_at
ON supplier_tokens(expires_at)
WHERE expires_at IS NOT NULL;
"""

# Track if table has been initialized (prevents repeated CREATE TABLE calls)
_table_initialized = False
_init_lock = None

def _get_init_lock():
    """Get or create initialization lock (thread-safe)"""
    global _init_lock
    if _init_lock is None:
        import threading
        _init_lock = threading.Lock()
    return _init_lock


def _get_components_session():
    dual_db = get_dual_database()
    session_gen = dual_db.get_session("components")
    db = next(session_gen)
    return db, session_gen


def _ensure_table_exists(db):
    """Ensure supplier_tokens table exists (runs once per process lifecycle)"""
    global _table_initialized

    if _table_initialized:
        return

    lock = _get_init_lock()
    with lock:
        # Double-check after acquiring lock
        if _table_initialized:
            return

        try:
            db.execute(text(CREATE_TABLE_SQL))
            db.commit()
            _table_initialized = True
            logger.info("✅ Supplier tokens table initialized")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to initialize supplier_tokens table: {e}")
            raise


def load_supplier_tokens(supplier_name: str) -> Dict[str, Optional[str]]:
    """Load stored tokens for a supplier."""
    db, session_gen = _get_components_session()
    try:
        _ensure_table_exists(db)

        row = db.execute(
            text(
                """
                SELECT supplier_name, access_token, refresh_token, expires_at
                FROM supplier_tokens
                WHERE supplier_name = :supplier_name
                """
            ),
            {"supplier_name": supplier_name},
        ).fetchone()

        if not row:
            return {}

        mapping = row._mapping
        return {
            "access_token": mapping.get("access_token"),
            "refresh_token": mapping.get("refresh_token"),
            "expires_at": mapping.get("expires_at"),
        }
    except Exception as exc:
        logger.warning(f"Failed to load supplier tokens for {supplier_name}: {exc}")
        return {}
    finally:
        try:
            session_gen.close()
        except Exception as e:
            logger.warning(f"Session cleanup failed: {e}")


def save_supplier_tokens(
    supplier_name: str,
    access_token: Optional[str],
    refresh_token: Optional[str],
    expires_at: Optional[datetime],
) -> None:
    """Persist supplier tokens (upsert)."""
    if not supplier_name:
        return

    db, session_gen = _get_components_session()
    try:
        _ensure_table_exists(db)

        db.execute(
            text(
                """
                INSERT INTO supplier_tokens (supplier_name, access_token, refresh_token, expires_at, updated_at)
                VALUES (:supplier_name, :access_token, :refresh_token, :expires_at, NOW())
                ON CONFLICT (supplier_name) DO UPDATE
                SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = NOW()
                """
            ),
            {
                "supplier_name": supplier_name,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": expires_at,
            },
        )
        db.commit()
        logger.info(f"Supplier tokens updated for {supplier_name}")
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to save supplier tokens for {supplier_name}: {exc}")
        raise  # Re-raise so caller knows save failed
    finally:
        try:
            session_gen.close()
        except Exception as e:
            logger.warning(f"Session cleanup failed: {e}")
