"""
Test Scope Validators

Tests the scope validation functions against the actual Supabase database.

This test script verifies:
1. Individual validator functions work correctly
2. Full scope chain validation works
3. Caching works as expected
4. Invalid IDs are properly rejected
5. Hierarchy retrieval functions work

Run with:
    cd app-plane/services/cns-service
    python -m pytest tests/test_scope_validators.py -v
"""

import os
import sys
import logging
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

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
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_test_database():
    """Initialize database connection for tests"""
    # Initialize dual database manager
    init_dual_database()
    dual_db = get_dual_database()

    # Get Supabase session (where the hierarchy lives)
    session_gen = dual_db.get_session("supabase")
    db = next(session_gen)

    logger.info("✅ Test database connection established")
    return db, session_gen


def get_sample_data(db):
    """
    Fetch sample data from the database for testing.

    Returns:
        Dict with sample IDs from the database
    """
    try:
        # Get a sample organization with tenant
        query = text("""
            SELECT
                o.id as org_id,
                o.control_plane_tenant_id as tenant_id,
                w.id as workspace_id,
                p.id as project_id,
                b.id as bom_id
            FROM organizations o
            LEFT JOIN workspaces w ON w.organization_id = o.id
            LEFT JOIN projects p ON p.workspace_id = w.id
            LEFT JOIN boms b ON b.project_id = p.id
            WHERE o.control_plane_tenant_id IS NOT NULL
            LIMIT 1
        """)

        result = db.execute(query).fetchone()

        if not result:
            logger.warning("No sample data found in database")
            return None

        sample_data = {
            "org_id": str(result[0]),
            "tenant_id": str(result[1]),
            "workspace_id": str(result[2]) if result[2] else None,
            "project_id": str(result[3]) if result[3] else None,
            "bom_id": str(result[4]) if result[4] else None
        }

        logger.info(f"Sample data fetched: {sample_data}")
        return sample_data

    except Exception as e:
        logger.error(f"Error fetching sample data: {e}", exc_info=True)
        return None


def test_workspace_validation(db, sample_data):
    """Test workspace in tenant validation"""
    logger.info("\n=== Testing Workspace Validation ===")

    if not sample_data or not sample_data["workspace_id"]:
        logger.warning("Skipping workspace validation - no sample workspace")
        return

    # Clear cache to ensure fresh validation
    clear_validation_cache()

    # Test valid workspace
    is_valid = validate_workspace_in_tenant(
        db=db,
        workspace_id=sample_data["workspace_id"],
        tenant_id=sample_data["tenant_id"]
    )

    logger.info(f"Valid workspace test: {is_valid}")
    assert is_valid, "Valid workspace should pass validation"

    # Test with invalid tenant
    fake_tenant_id = str(uuid4())
    is_valid = validate_workspace_in_tenant(
        db=db,
        workspace_id=sample_data["workspace_id"],
        tenant_id=fake_tenant_id
    )

    logger.info(f"Invalid tenant test: {is_valid}")
    assert not is_valid, "Invalid tenant should fail validation"

    # Test caching (should hit cache on second call)
    is_valid = validate_workspace_in_tenant(
        db=db,
        workspace_id=sample_data["workspace_id"],
        tenant_id=sample_data["tenant_id"]
    )

    logger.info(f"Cached result test: {is_valid}")
    assert is_valid, "Cached result should be valid"

    logger.info("✅ Workspace validation tests passed")


def test_project_validation(db, sample_data):
    """Test project in workspace validation"""
    logger.info("\n=== Testing Project Validation ===")

    if not sample_data or not sample_data["project_id"]:
        logger.warning("Skipping project validation - no sample project")
        return

    clear_validation_cache()

    # Test valid project
    is_valid = validate_project_in_workspace(
        db=db,
        project_id=sample_data["project_id"],
        workspace_id=sample_data["workspace_id"]
    )

    logger.info(f"Valid project test: {is_valid}")
    assert is_valid, "Valid project should pass validation"

    # Test with invalid workspace
    fake_workspace_id = str(uuid4())
    is_valid = validate_project_in_workspace(
        db=db,
        project_id=sample_data["project_id"],
        workspace_id=fake_workspace_id
    )

    logger.info(f"Invalid workspace test: {is_valid}")
    assert not is_valid, "Invalid workspace should fail validation"

    logger.info("✅ Project validation tests passed")


def test_bom_validation(db, sample_data):
    """Test BOM in project validation"""
    logger.info("\n=== Testing BOM Validation ===")

    if not sample_data or not sample_data["bom_id"]:
        logger.warning("Skipping BOM validation - no sample BOM")
        return

    clear_validation_cache()

    # Test valid BOM
    is_valid = validate_bom_in_project(
        db=db,
        bom_id=sample_data["bom_id"],
        project_id=sample_data["project_id"]
    )

    logger.info(f"Valid BOM test: {is_valid}")
    assert is_valid, "Valid BOM should pass validation"

    # Test with invalid project
    fake_project_id = str(uuid4())
    is_valid = validate_bom_in_project(
        db=db,
        bom_id=sample_data["bom_id"],
        project_id=fake_project_id
    )

    logger.info(f"Invalid project test: {is_valid}")
    assert not is_valid, "Invalid project should fail validation"

    logger.info("✅ BOM validation tests passed")


def test_full_scope_chain(db, sample_data):
    """Test full scope chain validation"""
    logger.info("\n=== Testing Full Scope Chain Validation ===")

    if not sample_data or not sample_data["bom_id"]:
        logger.warning("Skipping full scope chain validation - no sample BOM")
        return

    clear_validation_cache()

    # Test valid full chain with BOM
    result = validate_full_scope_chain(
        db=db,
        tenant_id=sample_data["tenant_id"],
        bom_id=sample_data["bom_id"]
    )

    logger.info(f"Valid full chain result: {result}")
    assert result["valid"], f"Valid chain should pass: {result['errors']}"
    assert result["bom_valid"] is True, "BOM should be valid"

    # Test with invalid tenant
    fake_tenant_id = str(uuid4())
    result = validate_full_scope_chain(
        db=db,
        tenant_id=fake_tenant_id,
        bom_id=sample_data["bom_id"]
    )

    logger.info(f"Invalid tenant result: {result}")
    assert not result["valid"], "Invalid tenant should fail validation"
    assert len(result["errors"]) > 0, "Should have error messages"

    # Test project-level validation
    if sample_data["project_id"]:
        result = validate_full_scope_chain(
            db=db,
            tenant_id=sample_data["tenant_id"],
            project_id=sample_data["project_id"]
        )

        logger.info(f"Project-level validation result: {result}")
        assert result["valid"], f"Project validation should pass: {result['errors']}"
        assert result["project_valid"] is True, "Project should be valid"

    # Test workspace-level validation
    if sample_data["workspace_id"]:
        result = validate_full_scope_chain(
            db=db,
            tenant_id=sample_data["tenant_id"],
            workspace_id=sample_data["workspace_id"]
        )

        logger.info(f"Workspace-level validation result: {result}")
        assert result["valid"], f"Workspace validation should pass: {result['errors']}"
        assert result["workspace_valid"] is True, "Workspace should be valid"

    logger.info("✅ Full scope chain validation tests passed")


def test_hierarchy_retrieval(db, sample_data):
    """Test hierarchy retrieval functions"""
    logger.info("\n=== Testing Hierarchy Retrieval ===")

    if not sample_data or not sample_data["bom_id"]:
        logger.warning("Skipping hierarchy retrieval - no sample BOM")
        return

    # Test BOM hierarchy
    hierarchy = get_bom_hierarchy(db=db, bom_id=sample_data["bom_id"])

    logger.info(f"BOM hierarchy: {hierarchy}")
    assert hierarchy is not None, "Should retrieve BOM hierarchy"
    assert hierarchy["bom_id"] == sample_data["bom_id"], "BOM ID should match"
    assert hierarchy["tenant_id"] == sample_data["tenant_id"], "Tenant ID should match"

    # Test project hierarchy
    if sample_data["project_id"]:
        hierarchy = get_project_hierarchy(db=db, project_id=sample_data["project_id"])

        logger.info(f"Project hierarchy: {hierarchy}")
        assert hierarchy is not None, "Should retrieve project hierarchy"
        assert hierarchy["project_id"] == sample_data["project_id"], "Project ID should match"
        assert hierarchy["tenant_id"] == sample_data["tenant_id"], "Tenant ID should match"

    # Test with non-existent IDs
    fake_bom_id = str(uuid4())
    hierarchy = get_bom_hierarchy(db=db, bom_id=fake_bom_id)

    logger.info(f"Non-existent BOM hierarchy: {hierarchy}")
    assert hierarchy is None, "Should return None for non-existent BOM"

    logger.info("✅ Hierarchy retrieval tests passed")


def run_all_tests():
    """Run all validation tests"""
    logger.info("=" * 80)
    logger.info("Starting Scope Validators Tests")
    logger.info("=" * 80)

    # Setup database
    db, session_gen = setup_test_database()

    try:
        # Get sample data
        sample_data = get_sample_data(db)

        if not sample_data:
            logger.error("No sample data available - cannot run tests")
            logger.info("Please ensure the database has at least one organization with tenant_id")
            return False

        # Run tests
        test_workspace_validation(db, sample_data)
        test_project_validation(db, sample_data)
        test_bom_validation(db, sample_data)
        test_full_scope_chain(db, sample_data)
        test_hierarchy_retrieval(db, sample_data)

        logger.info("\n" + "=" * 80)
        logger.info("✅ ALL TESTS PASSED")
        logger.info("=" * 80)
        return True

    except AssertionError as e:
        logger.error(f"\n❌ TEST FAILED: {e}", exc_info=True)
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
    success = run_all_tests()
    sys.exit(0 if success else 1)
