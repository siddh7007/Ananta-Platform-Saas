#!/usr/bin/env python3
"""
Test script for Column Mapping Templates API

This script demonstrates the full CRUD lifecycle of column mapping templates.
It's designed to be run manually for verification during development.

Usage:
    python scripts/test_column_mapping_templates.py
"""

import sys
import json
import uuid
from datetime import datetime

# Mock auth context for testing
class MockAuthContext:
    """Mock authentication context for testing"""

    def __init__(self, org_id: str, user_id: str, role: str = "engineer"):
        self.organization_id = org_id
        self.user_id = user_id
        self.role = role

    @property
    def is_engineer(self):
        return self.role in ("owner", "admin", "engineer")


def test_column_mapping_templates():
    """Test column mapping templates CRUD operations"""

    print("=" * 80)
    print("Column Mapping Templates API Test")
    print("=" * 80)
    print()

    # Test configuration
    org_id = "a1111111-1111-1111-1111-111111111111"  # Ananta Platform
    user_id = str(uuid.uuid4())

    print(f"Organization ID: {org_id}")
    print(f"User ID: {user_id}")
    print()

    # Import after configuration
    from sqlalchemy import text
    from app.models.dual_database import get_dual_database

    dual_db = get_dual_database()

    print("Step 1: Create Test Templates")
    print("-" * 80)

    # Create template 1
    template1_mappings = {
        "mpn": "Part Number",
        "manufacturer": "Manufacturer",
        "description": "Description",
        "quantity": "Qty"
    }

    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                INSERT INTO column_mapping_templates
                (organization_id, name, description, mappings, is_default, created_by)
                VALUES (:org_id, :name, :description, :mappings::jsonb, :is_default, :created_by)
                RETURNING id, name, is_default
            """),
            {
                "org_id": org_id,
                "name": "Test Template 1",
                "description": "First test template",
                "mappings": json.dumps(template1_mappings),
                "is_default": True,
                "created_by": user_id,
            }
        )
        row = result.fetchone()
        template1_id = str(row.id)
        session.commit()
        print(f"✅ Created template 1: {row.name} (ID: {template1_id}, Default: {row.is_default})")

    # Create template 2
    template2_mappings = {
        "mpn": "MPN",
        "manufacturer": "Mfg",
        "description": "Desc"
    }

    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                INSERT INTO column_mapping_templates
                (organization_id, name, description, mappings, is_default, created_by)
                VALUES (:org_id, :name, :description, :mappings::jsonb, :is_default, :created_by)
                RETURNING id, name, is_default
            """),
            {
                "org_id": org_id,
                "name": "Test Template 2",
                "description": "Second test template",
                "mappings": json.dumps(template2_mappings),
                "is_default": False,
                "created_by": user_id,
            }
        )
        row = result.fetchone()
        template2_id = str(row.id)
        session.commit()
        print(f"✅ Created template 2: {row.name} (ID: {template2_id}, Default: {row.is_default})")

    print()
    print("Step 2: List Templates")
    print("-" * 80)

    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                SELECT id, name, description, mappings, is_default, created_at
                FROM column_mapping_templates
                WHERE organization_id = :org_id
                ORDER BY is_default DESC, name ASC
            """),
            {"org_id": org_id}
        )
        rows = result.fetchall()

        print(f"Found {len(rows)} templates:")
        for row in rows:
            default_marker = "⭐ DEFAULT" if row.is_default else ""
            print(f"  - {row.name} {default_marker}")
            print(f"    ID: {row.id}")
            print(f"    Mappings: {json.dumps(row.mappings, indent=6)}")
            print()

    print("Step 3: Test Default Template Trigger")
    print("-" * 80)
    print("Setting template 2 as default (should auto-unset template 1)...")

    with dual_db.SupabaseSession() as session:
        session.execute(
            text("""
                UPDATE column_mapping_templates
                SET is_default = TRUE
                WHERE id = :template_id AND organization_id = :org_id
            """),
            {"template_id": template2_id, "org_id": org_id}
        )
        session.commit()

    # Verify only one default
    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                SELECT id, name, is_default
                FROM column_mapping_templates
                WHERE organization_id = :org_id
                ORDER BY name
            """),
            {"org_id": org_id}
        )
        rows = result.fetchall()

        default_count = sum(1 for row in rows if row.is_default)
        print(f"Default templates: {default_count} (should be 1)")

        for row in rows:
            status = "DEFAULT" if row.is_default else "not default"
            print(f"  - {row.name}: {status}")

        if default_count == 1:
            print("✅ Default template trigger working correctly!")
        else:
            print(f"❌ ERROR: Found {default_count} default templates (expected 1)")

    print()
    print("Step 4: Update Template")
    print("-" * 80)

    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                UPDATE column_mapping_templates
                SET
                    description = :description,
                    mappings = :mappings::jsonb
                WHERE id = :template_id AND organization_id = :org_id
                RETURNING name, description, updated_at
            """),
            {
                "template_id": template1_id,
                "org_id": org_id,
                "description": "Updated description",
                "mappings": json.dumps({"mpn": "Updated Part #", "manufacturer": "Updated Mfr"}),
            }
        )
        row = result.fetchone()
        session.commit()
        print(f"✅ Updated template: {row.name}")
        print(f"   Description: {row.description}")
        print(f"   Updated at: {row.updated_at}")

    print()
    print("Step 5: Test Unique Constraint")
    print("-" * 80)
    print("Attempting to create duplicate name (should fail)...")

    try:
        with dual_db.SupabaseSession() as session:
            session.execute(
                text("""
                    INSERT INTO column_mapping_templates
                    (organization_id, name, description, mappings, created_by)
                    VALUES (:org_id, :name, :description, :mappings::jsonb, :created_by)
                """),
                {
                    "org_id": org_id,
                    "name": "Test Template 1",  # Duplicate name
                    "description": "Duplicate",
                    "mappings": json.dumps({}),
                    "created_by": user_id,
                }
            )
            session.commit()
        print("❌ ERROR: Duplicate name was allowed (constraint failed)")
    except Exception as e:
        if "uq_org_template_name" in str(e):
            print("✅ Unique constraint working correctly!")
        else:
            print(f"❌ Unexpected error: {e}")

    print()
    print("Step 6: Cleanup")
    print("-" * 80)

    with dual_db.SupabaseSession() as session:
        result = session.execute(
            text("""
                DELETE FROM column_mapping_templates
                WHERE organization_id = :org_id
                AND id IN (:id1, :id2)
            """),
            {"org_id": org_id, "id1": template1_id, "id2": template2_id}
        )
        deleted_count = result.rowcount
        session.commit()
        print(f"✅ Deleted {deleted_count} test templates")

    print()
    print("=" * 80)
    print("All tests completed successfully!")
    print("=" * 80)


if __name__ == "__main__":
    # Add parent directory to path for imports
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    try:
        test_column_mapping_templates()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
