"""
Initialize CNS Database Tables

Creates all tables defined in SQLAlchemy models.

This script supports the dual-database architecture:
- Components-V2 (DATABASE_URL): Internal catalog tables
- Supabase (SUPABASE_DATABASE_URL): Customer data tables

Usage:
    python init_db.py                    # Initialize both databases
    python init_db.py --components-only  # Initialize Components-V2 only
    python init_db.py --supabase-only    # Initialize Supabase only
"""

import argparse
import os
import sys
from app.models.base import Base, Database
from app.config import settings

# Import all models to register them with Base metadata
from app.models.bom import BOMJob
from app.models.catalog import CatalogComponent
from app.models.enrichment import EnrichmentQueue, EnrichmentHistory


def mask_url(url: str) -> str:
    """Mask password in database URL for logging."""
    if not url:
        return "(not set)"
    try:
        if "@" in url:
            prefix = url.split("@")[0]
            suffix = url.split("@")[1]
            if ":" in prefix:
                user_part = prefix.rsplit(":", 1)[0]
                return f"{user_part}:****@{suffix}"
        return url
    except Exception:
        return url[:20] + "..."


def init_components_v2_database():
    """Initialize Components-V2 database (internal catalog)."""
    database_url = os.getenv(
        'COMPONENTS_V2_DATABASE_URL',
        os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:27010/components_v2')
    )

    print(f"\n[Components-V2] Connecting to: {mask_url(database_url)}")

    # Check for common misconfiguration
    if "localhost:5432" in database_url:
        print("[WARNING] DATABASE_URL points to localhost:5432 (default PostgreSQL)")
        print("          Expected: localhost:27010 for Components-V2")
        print("          See README.md for dual-database configuration.")

    db = Database(database_url)

    print("[Components-V2] Creating tables...")
    Base.metadata.create_all(bind=db.engine)

    print("[Components-V2] Tables created successfully!")

    # List created tables
    print("\n[Components-V2] Created tables:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - {table_name}")


def init_supabase_database():
    """Initialize Supabase database (customer data)."""
    database_url = os.getenv(
        'SUPABASE_DATABASE_URL',
        'postgresql://postgres:postgres@localhost:27432/postgres'
    )

    print(f"\n[Supabase] Connecting to: {mask_url(database_url)}")

    # Check for common misconfiguration
    if "localhost:5432" in database_url:
        print("[WARNING] SUPABASE_DATABASE_URL points to localhost:5432 (default PostgreSQL)")
        print("          Expected: localhost:27432 for Supabase")
        print("          See README.md for dual-database configuration.")

    db = Database(database_url)

    # Note: Supabase tables are typically managed by migrations, not ORM
    # This just verifies connectivity
    print("[Supabase] Connection verified!")
    print("[Supabase] Note: Supabase tables are managed by SQL migrations, not ORM")


def init_database():
    """Initialize both databases (backward compatible)."""
    print("=" * 60)
    print("CNS Database Initialization - Dual Database Architecture")
    print("=" * 60)

    # Log configuration
    print("\nConfiguration:")
    print(f"  DATABASE_URL: {mask_url(os.getenv('DATABASE_URL', ''))}")
    print(f"  SUPABASE_DATABASE_URL: {mask_url(os.getenv('SUPABASE_DATABASE_URL', ''))}")
    print(f"  COMPONENTS_V2_DATABASE_URL: {mask_url(os.getenv('COMPONENTS_V2_DATABASE_URL', ''))}")

    # Initialize Components-V2 (catalog tables via ORM)
    init_components_v2_database()

    # Verify Supabase connectivity (tables managed by migrations)
    init_supabase_database()

    print("\n" + "=" * 60)
    print("Database initialization complete!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize CNS database tables")
    parser.add_argument(
        "--components-only",
        action="store_true",
        help="Initialize only Components-V2 database"
    )
    parser.add_argument(
        "--supabase-only",
        action="store_true",
        help="Initialize only Supabase database (verify connectivity)"
    )
    args = parser.parse_args()

    if args.components_only:
        init_components_v2_database()
    elif args.supabase_only:
        init_supabase_database()
    else:
        init_database()
