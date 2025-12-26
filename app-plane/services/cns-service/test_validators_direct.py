#!/usr/bin/env python3
"""
Direct Scope Validators Test - Uses Direct Database Connection

This bypasses the dual_database manager and connects directly to test the validators.

Run with:
    cd app-plane/services/cns-service
    python test_validators_direct.py
"""

import os
import sys
import logging
from uuid import uuid4
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.scope_validators import (
    validate_workspace_in_tenant,
    validate_project_in_workspace,
    validate_bom_in_project,
    validate_full_scope_chain,
    get_bom_hierarchy,
    get_project_hierarchy,
    clear_validation_cache
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main test runner"""
    logger.info("=" * 80)
    logger.info("Scope Validators - Direct Database Test")
    logger.info("=" * 80)

    # Direct database connection (bypassing dual_database manager)
    database_url = "postgresql://postgres:postgres@localhost:27432/postgres"
    logger.info(f"\n[Step 1] Connecting to database: {database_url.split('@')[-1]}")

    try:
        engine = create_engine(
            database_url,
            pool_size=5,
            max_overflow=2,
            pool_pre_ping=True
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        logger.info("✅ Database connection established")

        # Test connection
        result = db.execute(text("SELECT 1")).fetchone()
        if not result:
            logger.error("❌ Database connection test failed")
            return False

        logger.info("✅ Database connection verified")

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
            logger.info("\nRequired data structure:")
            logger.info("  organizations.control_plane_tenant_id → Control Plane tenant UUID")
            logger.info("  workspaces.organization_id → organizations.id")
            logger.info("  projects.workspace_id → workspaces.id")
            logger.info("  boms.project_id → projects.id")
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

        # Run tests
        all_passed = True

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
            if not is_valid:
                all_passed = False

            # Invalid tenant
            logger.info("Testing invalid tenant (should fail)...")
            fake_tenant_id = str(uuid4())
            is_valid = validate_workspace_in_tenant(
                db=db,
                workspace_id=sample_data["workspace_id"],
                tenant_id=fake_tenant_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL'}")
            if is_valid:
                all_passed = False

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
            if not is_valid:
                all_passed = False

            # Invalid workspace
            logger.info("Testing invalid workspace (should fail)...")
            fake_workspace_id = str(uuid4())
            is_valid = validate_project_in_workspace(
                db=db,
                project_id=sample_data["project_id"],
                workspace_id=fake_workspace_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL'}")
            if is_valid:
                all_passed = False

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
            if not is_valid:
                all_passed = False

            # Invalid project
            logger.info("Testing invalid project (should fail)...")
            fake_project_id = str(uuid4())
            is_valid = validate_bom_in_project(
                db=db,
                bom_id=sample_data["bom_id"],
                project_id=fake_project_id
            )
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not is_valid else '❌ FAIL'}")
            if is_valid:
                all_passed = False

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
            if result['errors']:
                logger.info(f"   Errors: {result['errors']}")
            logger.info(f"   Result: {'✅ PASS' if result['valid'] else '❌ FAIL'}")
            if not result['valid']:
                all_passed = False

            # Invalid tenant
            logger.info("Testing invalid tenant (should fail)...")
            fake_tenant_id = str(uuid4())
            result = validate_full_scope_chain(
                db=db,
                tenant_id=fake_tenant_id,
                bom_id=sample_data["bom_id"]
            )
            logger.info(f"   Overall valid: {result['valid']}")
            logger.info(f"   Errors: {result['errors']}")
            logger.info(f"   Result: {'✅ PASS (correctly rejected)' if not result['valid'] else '❌ FAIL'}")
            if result['valid']:
                all_passed = False

        # Test 5: Hierarchy Retrieval
        if sample_data["bom_id"]:
            logger.info("\n[Test 5] Hierarchy Retrieval")
            logger.info("-" * 80)

            # BOM hierarchy
            logger.info("Testing BOM hierarchy retrieval...")
            hierarchy = get_bom_hierarchy(db=db, bom_id=sample_data["bom_id"])
            if hierarchy:
                logger.info(f"   BOM ID: {hierarchy['bom_id'][:8]}...")
                logger.info(f"   Project ID: {hierarchy['project_id'][:8]}...")
                logger.info(f"   Workspace ID: {hierarchy['workspace_id'][:8]}...")
                logger.info(f"   Tenant ID: {hierarchy['tenant_id'][:8]}...")
                logger.info(f"   Result: ✅ PASS")
            else:
                logger.info(f"   Result: ❌ FAIL (hierarchy is None)")
                all_passed = False

            # Project hierarchy
            logger.info("Testing project hierarchy retrieval...")
            hierarchy = get_project_hierarchy(db=db, project_id=sample_data["project_id"])
            if hierarchy:
                logger.info(f"   Project ID: {hierarchy['project_id'][:8]}...")
                logger.info(f"   Workspace ID: {hierarchy['workspace_id'][:8]}...")
                logger.info(f"   Tenant ID: {hierarchy['tenant_id'][:8]}...")
                logger.info(f"   Result: ✅ PASS")
            else:
                logger.info(f"   Result: ❌ FAIL (hierarchy is None)")
                all_passed = False

            # Non-existent BOM
            logger.info("Testing non-existent BOM (should return None)...")
            fake_bom_id = str(uuid4())
            hierarchy = get_bom_hierarchy(db=db, bom_id=fake_bom_id)
            logger.info(f"   Result: {'✅ PASS (correctly returned None)' if hierarchy is None else '❌ FAIL'}")
            if hierarchy is not None:
                all_passed = False

        # Final result
        logger.info("\n" + "=" * 80)
        if all_passed:
            logger.info("✅ ALL TESTS PASSED")
            logger.info("=" * 80)
            logger.info("\nScope validators are working correctly!")
            logger.info("Ready to use in CNS service endpoints.")
        else:
            logger.info("❌ SOME TESTS FAILED")
            logger.info("=" * 80)
            logger.info("\nPlease review the failures above.")

        return all_passed

    except Exception as e:
        logger.error(f"\n❌ ERROR: {e}", exc_info=True)
        return False

    finally:
        if 'db' in locals():
            db.close()
        if 'engine' in locals():
            engine.dispose()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
