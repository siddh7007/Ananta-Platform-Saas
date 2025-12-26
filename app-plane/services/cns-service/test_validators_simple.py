#!/usr/bin/env python3
"""
Simple Scope Validators Test Script

Tests the scope validation functions against the actual Supabase database.
This is a standalone script that doesn't require pytest.

Run with:
    cd app-plane/services/cns-service
    python test_validators_simple.py
"""

import os
import sys
import logging
from uuid import uuid4

from app.core.scope_validators import (
    validate_workspace_in_tenant,
    validate_project_in_workspace,
    validate_bom_in_project,
    validate_full_scope_chain,
    get_bom_hierarchy,
    get_project_hierarchy,
    clear_validation_cache
)
from app.models.dual_database import init_dual_database, get_dual_database
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main test runner"""
    logger.info("=" * 80)
    logger.info("Scope Validators - Simple Test Script")
    logger.info("=" * 80)

    # Initialize database
    logger.info("\n[Step 1] Initializing database connection...")
    init_dual_database()
    dual_db = get_dual_database()

    # Get Supabase session
    session_gen = dual_db.get_session("supabase")
    db = next(session_gen)
    logger.info("✅ Database connection established")

    try:
        # Fetch sample data
        logger.info("\n[Step 2] Fetching sample data from database...")
        query = text("""
            SELECT
                o.id as org_id,
                o.name as org_name,
                o.control_plane_tenant_id as tenant_id,
                w.id as workspace_id,
                w.name as workspace_name,
                p.id as project_id,
                p.name as project_name,
                b.id as bom_id,
                b.name as bom_name
            FROM organizations o
            LEFT JOIN workspaces w ON w.organization_id = o.id
            LEFT JOIN projects p ON p.workspace_id = w.id
            LEFT JOIN boms b ON b.project_id = p.id
            WHERE o.control_plane_tenant_id IS NOT NULL
            ORDER BY o.created_at DESC
            LIMIT 1
        """)

        result = db.execute(query).fetchone()

        if not result:
            logger.error("❌ No sample data found in database")
            logger.info("Please ensure the database has:")
            logger.info("  - At least one organization with control_plane_tenant_id")
            logger.info("  - At least one workspace in that organization")
            logger.info("  - At least one project in that workspace")
            logger.info("  - At least one BOM in that project")
            return False

        sample_data = {
            "org_id": str(result[0]),
            "org_name": result[1],
            "tenant_id": str(result[2]),
            "workspace_id": str(result[3]) if result[3] else None,
            "workspace_name": result[4] if result[4] else None,
            "project_id": str(result[5]) if result[5] else None,
            "project_name": result[6] if result[6] else None,
            "bom_id": str(result[7]) if result[7] else None,
            "bom_name": result[8] if result[8] else None,
        }

        logger.info(f"✅ Sample data found:")
        logger.info(f"   Organization: {sample_data['org_name']} ({sample_data['org_id'][:8]}...)")
        logger.info(f"   Tenant ID: {sample_data['tenant_id'][:8]}...")
        if sample_data["workspace_id"]:
            logger.info(f"   Workspace: {sample_data['workspace_name']} ({sample_data['workspace_id'][:8]}...)")
        if sample_data["project_id"]:
            logger.info(f"   Project: {sample_data['project_name']} ({sample_data['project_id'][:8]}...)")
        if sample_data["bom_id"]:
            logger.info(f"   BOM: {sample_data['bom_name']} ({sample_data['bom_id'][:8]}...)")

        # Test 1: Workspace Validation
        if sample_data["workspace_id"]:
            logger.info("\n[Test 1] Workspace Validation")
            logger.info("-" * 80)

            clear_validation_cache()

            # Valid workspace
            logger.info("Testing valid workspace...")
            is_valid = validate_workspace_in_tenant(
                db=db,
                workspace_id=sample_data["workspace_id"],
                tenant_id=sample_data["tenant_id"]
            )
            logger.info(f"   Result: {'✅ PASS' if is_valid else '❌ FAIL'}")
            assert is_valid, "Valid workspace should pass validation"

            # Invalid tenant
            logger.info("Testing invalid tenant...")
            fake_tenant_id = str(uuid4())
            is_valid = validate_workspace_in_tenant(
                db=db,
                workspace_id=sample_data["workspace_id"],
                tenant_id=fake_tenant_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL (should reject)'}")
            assert not is_valid, "Invalid tenant should fail validation"

            # Test cache
            logger.info("Testing cache (second call should hit cache)...")
            is_valid = validate_workspace_in_tenant(
                db=db,
                workspace_id=sample_data["workspace_id"],
                tenant_id=sample_data["tenant_id"]
            )
            logger.info(f"   Result: {'✅ PASS' if is_valid else '❌ FAIL'}")

        # Test 2: Project Validation
        if sample_data["project_id"]:
            logger.info("\n[Test 2] Project Validation")
            logger.info("-" * 80)

            clear_validation_cache()

            # Valid project
            logger.info("Testing valid project...")
            is_valid = validate_project_in_workspace(
                db=db,
                project_id=sample_data["project_id"],
                workspace_id=sample_data["workspace_id"]
            )
            logger.info(f"   Result: {'✅ PASS' if is_valid else '❌ FAIL'}")
            assert is_valid, "Valid project should pass validation"

            # Invalid workspace
            logger.info("Testing invalid workspace...")
            fake_workspace_id = str(uuid4())
            is_valid = validate_project_in_workspace(
                db=db,
                project_id=sample_data["project_id"],
                workspace_id=fake_workspace_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL (should reject)'}")
            assert not is_valid, "Invalid workspace should fail validation"

        # Test 3: BOM Validation
        if sample_data["bom_id"]:
            logger.info("\n[Test 3] BOM Validation")
            logger.info("-" * 80)

            clear_validation_cache()

            # Valid BOM
            logger.info("Testing valid BOM...")
            is_valid = validate_bom_in_project(
                db=db,
                bom_id=sample_data["bom_id"],
                project_id=sample_data["project_id"]
            )
            logger.info(f"   Result: {'✅ PASS' if is_valid else '❌ FAIL'}")
            assert is_valid, "Valid BOM should pass validation"

            # Invalid project
            logger.info("Testing invalid project...")
            fake_project_id = str(uuid4())
            is_valid = validate_bom_in_project(
                db=db,
                bom_id=sample_data["bom_id"],
                project_id=fake_project_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL (should reject)'}")
            assert not is_valid, "Invalid project should fail validation"

        # Test 4: Full Scope Chain
        if sample_data["bom_id"]:
            logger.info("\n[Test 4] Full Scope Chain Validation")
            logger.info("-" * 80)

            clear_validation_cache()

            # Valid full chain
            logger.info("Testing valid full chain (tenant → workspace → project → BOM)...")
            result = validate_full_scope_chain(
                db=db,
                tenant_id=sample_data["tenant_id"],
                bom_id=sample_data["bom_id"]
            )
            logger.info(f"   Overall valid: {result['valid']}")
            logger.info(f"   BOM valid: {result['bom_valid']}")
            logger.info(f"   Errors: {result['errors']}")
            logger.info(f"   Result: {'✅ PASS' if result['valid'] else '❌ FAIL'}")
            assert result["valid"], f"Valid chain should pass: {result['errors']}"

            # Invalid tenant
            logger.info("Testing invalid tenant...")
            fake_tenant_id = str(uuid4())
            result = validate_full_scope_chain(
                db=db,
                tenant_id=fake_tenant_id,
                bom_id=sample_data["bom_id"]
            )
            logger.info(f"   Overall valid: {result['valid']}")
            logger.info(f"   Errors: {result['errors']}")
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not result['valid'] else '❌ FAIL (should reject)'}")
            assert not result["valid"], "Invalid tenant should fail validation"

        # Test 5: Hierarchy Retrieval
        if sample_data["bom_id"]:
            logger.info("\n[Test 5] Hierarchy Retrieval")
            logger.info("-" * 80)

            # BOM hierarchy
            logger.info("Testing BOM hierarchy retrieval...")
            hierarchy = get_bom_hierarchy(db=db, bom_id=sample_data["bom_id"])
            logger.info(f"   Hierarchy: {hierarchy}")
            logger.info(f"   Result: {'✅ PASS' if hierarchy else '❌ FAIL'}")
            assert hierarchy is not None, "Should retrieve BOM hierarchy"
            assert hierarchy["tenant_id"] == sample_data["tenant_id"], "Tenant ID should match"

            # Project hierarchy
            logger.info("Testing project hierarchy retrieval...")
            hierarchy = get_project_hierarchy(db=db, project_id=sample_data["project_id"])
            logger.info(f"   Hierarchy: {hierarchy}")
            logger.info(f"   Result: {'✅ PASS' if hierarchy else '❌ FAIL'}")
            assert hierarchy is not None, "Should retrieve project hierarchy"

            # Non-existent BOM
            logger.info("Testing non-existent BOM...")
            fake_bom_id = str(uuid4())
            hierarchy = get_bom_hierarchy(db=db, bom_id=fake_bom_id)
            logger.info(f"   Hierarchy: {hierarchy}")
            logger.info(f"   Result: {'✅ PASS (correctly returned None)' if hierarchy is None else '❌ FAIL (should be None)'}")
            assert hierarchy is None, "Should return None for non-existent BOM"

        # All tests passed
        logger.info("\n" + "=" * 80)
        logger.info("✅ ALL TESTS PASSED")
        logger.info("=" * 80)
        logger.info("\nScope validators are working correctly!")
        logger.info("You can now use them in the CNS service endpoints.")
        return True

    except AssertionError as e:
        logger.error(f"\n❌ TEST FAILED: {e}")
        return False

    except Exception as e:
        logger.error(f"\n❌ UNEXPECTED ERROR: {e}", exc_info=True)
        return False

    finally:
        # Cleanup
        try:
            next(session_gen)
        except StopIteration:
            pass


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
