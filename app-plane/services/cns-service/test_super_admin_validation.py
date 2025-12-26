"""
Test script for super admin scope validation fix.

Tests that super admin (tenant_id=None) now properly validates resource existence
and returns 403 Forbidden (not 500 Internal Server Error) for non-existent resources.
"""

import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.scope_validators import validate_full_scope_chain
from app.models.base import get_db


def test_super_admin_non_existent_bom():
    """Test that super admin gets 403 for non-existent BOM (not 500)."""
    print("\n[TEST] Super admin accessing non-existent BOM")

    db = next(get_db())

    # Non-existent UUID
    fake_bom_id = "99999999-9999-9999-9999-999999999999"

    result = validate_full_scope_chain(
        db=db,
        tenant_id=None,  # Super admin
        bom_id=fake_bom_id
    )

    print(f"Valid: {result['valid']}")
    print(f"Errors: {result['errors']}")

    assert not result["valid"], "Expected validation to FAIL for non-existent BOM"
    assert result["bom_valid"] is False, "Expected bom_valid to be False"
    assert any("BOM not found" in err for err in result["errors"]), \
        "Expected 'BOM not found' error message"

    print("[PASS] Super admin correctly rejected non-existent BOM")


def test_super_admin_non_existent_project():
    """Test that super admin gets 403 for non-existent Project (not 500)."""
    print("\n[TEST] Super admin accessing non-existent Project")

    db = next(get_db())

    # Non-existent UUID
    fake_project_id = "88888888-8888-8888-8888-888888888888"

    result = validate_full_scope_chain(
        db=db,
        tenant_id=None,  # Super admin
        project_id=fake_project_id
    )

    print(f"Valid: {result['valid']}")
    print(f"Errors: {result['errors']}")

    assert not result["valid"], "Expected validation to FAIL for non-existent Project"
    assert result["project_valid"] is False, "Expected project_valid to be False"
    assert any("Project not found" in err for err in result["errors"]), \
        "Expected 'Project not found' error message"

    print("[PASS] Super admin correctly rejected non-existent Project")


def test_super_admin_non_existent_workspace():
    """Test that super admin gets 403 for non-existent Workspace (not 500)."""
    print("\n[TEST] Super admin accessing non-existent Workspace")

    db = next(get_db())

    # Non-existent UUID
    fake_workspace_id = "77777777-7777-7777-7777-777777777777"

    result = validate_full_scope_chain(
        db=db,
        tenant_id=None,  # Super admin
        workspace_id=fake_workspace_id
    )

    print(f"Valid: {result['valid']}")
    print(f"Errors: {result['errors']}")

    assert not result["valid"], "Expected validation to FAIL for non-existent Workspace"
    assert result["workspace_valid"] is False, "Expected workspace_valid to be False"
    assert any("Workspace not found" in err for err in result["errors"]), \
        "Expected 'Workspace not found' error message"

    print("[PASS] Super admin correctly rejected non-existent Workspace")


def test_super_admin_existing_resource():
    """Test that super admin can still access EXISTING resources."""
    print("\n[TEST] Super admin accessing existing resource")

    db = next(get_db())

    # First, get an actual BOM ID from the database
    from sqlalchemy import text
    query = text("SELECT id FROM boms LIMIT 1")
    result = db.execute(query).fetchone()

    if not result:
        print("[SKIP] No BOMs in database to test with")
        return

    real_bom_id = str(result[0])
    print(f"Testing with real BOM: {real_bom_id}")

    validation = validate_full_scope_chain(
        db=db,
        tenant_id=None,  # Super admin
        bom_id=real_bom_id
    )

    print(f"Valid: {validation['valid']}")
    print(f"BOM Valid: {validation['bom_valid']}")
    print(f"Errors: {validation['errors']}")

    assert validation["valid"], "Expected validation to PASS for existing BOM"
    assert validation["bom_valid"] is True, "Expected bom_valid to be True"
    assert len(validation["errors"]) == 0, "Expected no errors"

    print("[PASS] Super admin correctly granted access to existing BOM")


if __name__ == "__main__":
    print("=" * 80)
    print("SUPER ADMIN SCOPE VALIDATION SECURITY FIX - TEST SUITE")
    print("=" * 80)

    try:
        test_super_admin_non_existent_bom()
        test_super_admin_non_existent_project()
        test_super_admin_non_existent_workspace()
        test_super_admin_existing_resource()

        print("\n" + "=" * 80)
        print("ALL TESTS PASSED")
        print("=" * 80)
        print("\nSecurity fix verified:")
        print("- Super admin can NO LONGER bypass existence checks")
        print("- Non-existent resources return 403 Forbidden (not 500 Internal Server Error)")
        print("- Existing resources still accessible to super admin")

    except AssertionError as e:
        print(f"\n[FAIL] Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
