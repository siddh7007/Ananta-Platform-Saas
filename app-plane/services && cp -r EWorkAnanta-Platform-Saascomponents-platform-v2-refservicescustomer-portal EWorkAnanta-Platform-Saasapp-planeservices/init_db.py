"""
Initialize CNS Database Tables

Creates all tables defined in SQLAlchemy models.
"""

import sys
from app.models.base import Base, Database
from app.config import settings

# Import all models to register them with Base metadata
from app.models.bom import BOMJob
from app.models.catalog import CatalogComponent
from app.models.enrichment import EnrichmentQueue, EnrichmentHistory

def init_database():
    """Create all database tables"""
    import os
    database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:27010/components')

    print(f"Connecting to database: {database_url}")

    db = Database(database_url)

    print("Creating all tables...")
    Base.metadata.create_all(bind=db.engine)

    print("✅ Database tables created successfully!")

    # List created tables
    print("\nCreated tables:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - {table_name}")

if __name__ == "__main__":
    init_database()
