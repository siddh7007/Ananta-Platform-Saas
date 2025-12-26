"""
Base SQLAlchemy models and database configuration
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# Declarative base for all models
Base = declarative_base()


class TimestampMixin:
    """
    Mixin for models with created_at and updated_at timestamps

    Usage:
        class MyModel(Base, TimestampMixin):
            __tablename__ = "my_table"
            id = Column(Integer, primary_key=True)
    """
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# Database session management
class Database:
    """
    Database connection and session management

    Usage:
        from app.models.base import get_db

        # In FastAPI endpoint
        @app.get("/components")
        def list_components(db: Session = Depends(get_db)):
            components = db.query(CatalogComponent).all()
            return components
    """

    def __init__(self, database_url: str, pool_size: int = 20, max_overflow: int = 10):
        """
        Initialize database connection

        Args:
            database_url: PostgreSQL connection string
            pool_size: Connection pool size
            max_overflow: Maximum overflow connections
        """
        self.engine = create_engine(
            database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,  # Verify connections before using
            echo=False  # Set to True for SQL query logging
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )

    def get_session(self) -> Generator[Session, None, None]:
        """
        Get database session (for dependency injection)

        Yields:
            SQLAlchemy Session
        """
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def create_all_tables(self):
        """Create all tables (for development/testing only)"""
        Base.metadata.create_all(bind=self.engine)

    def drop_all_tables(self):
        """Drop all tables (for testing only)"""
        Base.metadata.drop_all(bind=self.engine)


# Global database instance (initialized in main.py)
_db: Database = None


def init_database(database_url: str, pool_size: int = 20, max_overflow: int = 10) -> Database:
    """
    Initialize global database instance

    Args:
        database_url: PostgreSQL connection string
        pool_size: Connection pool size
        max_overflow: Maximum overflow connections

    Returns:
        Database instance
    """
    global _db
    _db = Database(database_url, pool_size, max_overflow)
    return _db


def get_database() -> Database:
    """
    Get global database instance

    Returns:
        Database instance

    Raises:
        RuntimeError: If database not initialized
    """
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _db


def get_db() -> Generator[Session, None, None]:
    """
    Dependency injection function for FastAPI

    Usage:
        from app.models.base import get_db
        from fastapi import Depends

        @app.get("/components")
        def list_components(db: Session = Depends(get_db)):
            return db.query(CatalogComponent).all()

    Yields:
        SQLAlchemy Session
    """
    db = get_database()
    yield from db.get_session()
