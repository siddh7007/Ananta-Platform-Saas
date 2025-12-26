"""
Dual Database Manager - Routes BOM uploads to correct database

Customer uploads → Supabase (customer-facing data)
Staff uploads → Components V2 (internal catalog)
"""

import os
import logging
from typing import Generator, Literal
from enum import Enum
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.base import Base

logger = logging.getLogger(__name__)

# Database types
DatabaseType = Literal["supabase", "components"]


class UploadSource(str, Enum):
    """Valid upload sources"""
    CUSTOMER = "customer"
    STAFF = "staff"


class DualDatabaseManager:
    """
    Manages connections to both Supabase and Components V2 databases
    Routes BOM operations based on source ('customer' vs 'staff')
    """

    def __init__(self):
        # Supabase database (customer-facing)
        supabase_url = os.getenv(
            "SUPABASE_DATABASE_URL",
            "postgresql://postgres:supabase-postgres-secure-2024@localhost:27801/supabase"
        )
        self.supabase_engine = create_engine(
            supabase_url,
            pool_size=10,
            max_overflow=5,
            pool_pre_ping=True,
            pool_recycle=3600,  # Recycle connections after 1 hour
            connect_args={
                "connect_timeout": 30,  # BUG-024: Add connection timeout
                "options": "-c statement_timeout=300000"  # 5 minute query timeout
            },
            echo=False
        )
        self.SupabaseSession = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.supabase_engine
        )
        logger.info(f"✅ Supabase database initialized: {supabase_url.split('@')[-1]} (30s conn timeout, 5m query timeout)")

        # Components V2 database (internal catalog)
        components_url = os.getenv(
            "COMPONENTS_V2_DATABASE_URL",
            "postgresql://postgres:postgres@localhost:27010/components_v2"
        )
        self.components_engine = create_engine(
            components_url,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,  # Recycle connections after 1 hour
            connect_args={
                "connect_timeout": 30,  # BUG-024: Add connection timeout
                "options": "-c statement_timeout=300000"  # 5 minute query timeout
            },
            echo=False
        )
        self.ComponentsSession = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.components_engine
        )
        logger.info(f"✅ Components V2 database initialized: {components_url.split('@')[-1]} (30s conn timeout, 5m query timeout)")

    def get_session(self, db_type: DatabaseType) -> Generator[Session, None, None]:
        """
        Get database session for specified database type

        Args:
            db_type: 'supabase' for customer uploads, 'components' for staff uploads

        Yields:
            SQLAlchemy Session

        Raises:
            ValueError: If db_type is not valid
        """
        # Validate db_type
        if db_type not in ("supabase", "components"):
            raise ValueError(
                f"Invalid database type: '{db_type}'. "
                f"Must be 'supabase' or 'components'. "
                f"This is a critical routing error!"
            )
        
        if db_type == "supabase":
            session = self.SupabaseSession()
        elif db_type == "components":
            session = self.ComponentsSession()
        else:
            # Should never reach here due to validation above
            raise ValueError(f"Impossible state: invalid db_type '{db_type}'")

        try:
            yield session
        finally:
            session.close()

    def get_db_type_for_source(self, source: str) -> DatabaseType:
        """
        Determine which database to use based on upload source

        Args:
            source: 'customer' or 'staff'

        Returns:
            DatabaseType: 'supabase' or 'components'

        Raises:
            ValueError: If source is not 'customer' or 'staff'

        Examples:
            >>> manager.get_db_type_for_source('customer')
            'supabase'

            >>> manager.get_db_type_for_source('staff')
            'components'
        """
        # Validate source type
        if not isinstance(source, str):
            raise ValueError(f"Source must be string, got {type(source).__name__}")
        
        # Normalize input
        source_lower = source.lower().strip()
        
        # Strict routing - no silent fallbacks
        if source_lower == "customer":
            logger.debug(f"Routing customer source to Supabase")
            return "supabase"
        elif source_lower == "staff":
            logger.debug(f"Routing staff source to Components V2")
            return "components"
        else:
            # CRITICAL: Raise error instead of silently defaulting
            logger.error(f"Unknown source '{source}'. Must be 'customer' or 'staff'. This is a critical routing error!")
            raise ValueError(
                f"Unknown source: '{source}'. "
                f"Must be either 'customer' or 'staff'. "
                f"Refusing to route to unknown database to prevent data corruption."
            )

    def create_all_tables(self, db_type: DatabaseType):
        """Create all tables in specified database"""
        if db_type == "supabase":
            Base.metadata.create_all(bind=self.supabase_engine)
            logger.info("Created tables in Supabase database")
        elif db_type == "components":
            Base.metadata.create_all(bind=self.components_engine)
            logger.info("Created tables in Components V2 database")

    def dispose(self):
        """Dispose all database connections"""
        self.supabase_engine.dispose()
        self.components_engine.dispose()
        logger.info("All database connections disposed")


# Global dual database manager
_dual_db: DualDatabaseManager = None


def init_dual_database() -> DualDatabaseManager:
    """
    Initialize global dual database manager

    Returns:
        DualDatabaseManager instance
    """
    global _dual_db
    _dual_db = DualDatabaseManager()
    return _dual_db


def get_dual_database() -> DualDatabaseManager:
    """
    Get global dual database manager

    Returns:
        DualDatabaseManager instance

    Raises:
        RuntimeError: If not initialized
    """
    if _dual_db is None:
        raise RuntimeError("Dual database not initialized. Call init_dual_database() first.")
    return _dual_db


def get_db_for_source(source: str) -> Generator[Session, None, None]:
    """
    Dependency injection function for FastAPI - routes to correct database

    Usage:
        @router.post("/bom/upload")
        def upload_bom(
            source: str = Form("customer"),
            db: Session = Depends(lambda: get_db_for_source(source))
        ):
            # db is now connected to the correct database based on source
            pass

    Args:
        source: 'customer' or 'staff'

    Yields:
        SQLAlchemy Session connected to the appropriate database
    """
    dual_db = get_dual_database()
    db_type = dual_db.get_db_type_for_source(source)
    logger.info(f"Routing {source} upload to {db_type} database")
    yield from dual_db.get_session(db_type)
