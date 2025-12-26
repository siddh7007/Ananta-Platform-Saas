"""
Database module - Re-exports from app.models.base for compatibility
"""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy.orm import Session

from app.models.base import (
    Base,
    Database,
    TimestampMixin,
    init_database,
    get_database,
    get_db,
)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.

    Usage:
        from app.database import get_db_session

        with get_db_session() as db:
            db.query(Model).all()
    """
    database = get_database()
    # Create session directly from SessionLocal, not from the generator
    session = database.SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = [
    "Base",
    "Database",
    "TimestampMixin",
    "init_database",
    "get_database",
    "get_db",
    "get_db_session",
]
