"""
Test Script for Scope Decorators and Dependencies

Tests both decorator-based and dependency-based scope validation.

Run:
    python test_decorators.py
"""

import asyncio
from typing import Dict, Optional
from unittest.mock import Mock, MagicMock, AsyncMock, patch
from dataclasses import dataclass

# Mock FastAPI components
class MockRequest:
    def __init__(self):
        self.state = Mock()
        self.url = Mock()
        self.url.path = "/test/endpoint"

class MockSession:
    def __init__(self, query_result=None):
        self.query_result = query_result

    def execute(self, query, params):
        result = Mock()
        if self.query_result is not None:
            result.fetchone.return_value = self.query_result
        else:
            result.fetchone.return_value = None
        return result

    def close(self):
        pass

@dataclass
class MockUser:
    id: str
    organization_id: str
    is_platform_admin: bool = False


# =============================================================================
# Test Decorators
# =============================================================================

async def test_require_workspace_decorator():
    """Test @require_workspace decorator."""
    print("\n[TEST] Testing @require_workspace decorator...")

    from app.core.scope_decorators import require_workspace

    # Create mock dependencies
    workspace_id = "workspace-123"
    tenant_id = "tenant-456"
    user = MockUser(id="user-789", organization_id=tenant_id)
    request = MockRequest()

    # Mock database session that returns valid result
    db = MockSession(query_result=(1,))  # Valid workspace

    # Define a test endpoint
    @require_workspace(enforce=True, log_access=True)
    async def test_endpoint(
        workspace_id: str,
        request: MockRequest,
        db: MockSession,
        user: MockUser
    ):
        return {"workspace_id": workspace_id, "scope": request.state.validated_scope}

    # Mock the validator to return True
    with patch("app.core.scope_decorators.validate_workspace_in_tenant", return_value=True):
        result = await test_endpoint(
            workspace_id=workspace_id,
            request=request,
            db=db,
            user=user
        )

        # Verify result
        assert result["workspace_id"] == workspace_id
        assert request.state.validated_scope["tenant_id"] == tenant_id
        assert request.state.validated_scope["workspace_id"] == workspace_id
        print("  OK Workspace decorator validated successfully")

    # Test validation failure
    print("  Testing validation failure...")
    request2 = MockRequest()
    with patch("app.core.scope_decorators.validate_workspace_in_tenant", return_value=False):
        try:
            await test_endpoint(
                workspace_id="invalid-workspace",
                request=request2,
                db=db,
                user=user
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "403" in str(e) or "Forbidden" in str(e)
            print("  OK Validation failure handled correctly")


async def test_require_project_decorator():
    """Test @require_project decorator."""
    print("\n[TEST] Testing @require_project decorator...")

    from app.core.scope_decorators import require_project

    # Create mock dependencies
    project_id = "project-123"
    workspace_id = "workspace-456"
    tenant_id = "tenant-789"
    user = MockUser(id="user-111", organization_id=tenant_id)
    request = MockRequest()

    # Mock database session
    db = MockSession(query_result=(workspace_id,))

    # Define test endpoint
    @require_project(enforce=True)
    async def test_endpoint(
        project_id: str,
        request: MockRequest,
        db: MockSession,
        user: MockUser
    ):
        return {"project_id": project_id, "scope": request.state.validated_scope}

    # Mock validator
    mock_validation_result = {
        "valid": True,
        "errors": []
    }

    with patch("app.core.scope_decorators.validate_full_scope_chain", return_value=mock_validation_result):
        result = await test_endpoint(
            project_id=project_id,
            request=request,
            db=db,
            user=user
        )

        assert result["project_id"] == project_id
        assert request.state.validated_scope["tenant_id"] == tenant_id
        assert request.state.validated_scope["project_id"] == project_id
        print("  OK Project decorator validated successfully")


async def test_staff_can_cross_scope():
    """Test @staff_can_cross_scope decorator."""
    print("\n[TEST] Testing @staff_can_cross_scope decorator...")

    from app.core.scope_decorators import staff_can_cross_scope

    # Test with staff user
    staff_user = MockUser(id="staff-123", organization_id="tenant-456", is_platform_admin=True)
    request = MockRequest()

    @staff_can_cross_scope
    async def test_endpoint(request: MockRequest, user: MockUser):
        return {"is_staff_override": getattr(request.state, "is_staff_override", False)}

    result = await test_endpoint(request=request, user=staff_user)
    assert result["is_staff_override"] == True
    print("  OK Staff user granted cross-scope access")

    # Test with regular user
    regular_user = MockUser(id="user-123", organization_id="tenant-456", is_platform_admin=False)
    request2 = MockRequest()

    result2 = await test_endpoint(request=request2, user=regular_user)
    assert result2["is_staff_override"] == False
    print("  OK Regular user did not get cross-scope access")


# =============================================================================
# Test Dependencies
# =============================================================================

async def test_require_workspace_context():
    """Test require_workspace_context dependency."""
    print("\n[TEST] Testing require_workspace_context dependency...")

    from app.dependencies.scope_deps import require_workspace_context

    # Create mocks
    workspace_id = "workspace-abc"
    tenant_id = "tenant-def"
    user = MockUser(id="user-ghi", organization_id=tenant_id)
    request = MockRequest()
    db = MockSession()

    # Mock validator
    with patch("app.dependencies.scope_deps.validate_workspace_in_tenant", return_value=True):
        scope = await require_workspace_context(
            request=request,
            x_workspace_id=workspace_id,
            db=db,
            user=user
        )

        assert scope["workspace_id"] == workspace_id
        assert scope["tenant_id"] == tenant_id
        print("  OK Workspace context dependency returned valid scope")

    # Test validation failure
    print("  Testing validation failure...")
    with patch("app.dependencies.scope_deps.validate_workspace_in_tenant", return_value=False):
        try:
            await require_workspace_context(
                request=request,
                x_workspace_id="invalid-workspace",
                db=db,
                user=user
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "403" in str(e) or "Forbidden" in str(e)
            print("  OK Invalid workspace rejected correctly")


async def test_require_project_context():
    """Test require_project_context dependency."""
    print("\n[TEST] Testing require_project_context dependency...")

    from app.dependencies.scope_deps import require_project_context

    # Create mocks
    project_id = "project-111"
    workspace_id = "workspace-222"
    tenant_id = "tenant-333"
    user = MockUser(id="user-444", organization_id=tenant_id)
    request = MockRequest()
    db = MockSession()

    # Mock validator
    mock_validation = {
        "valid": True,
        "errors": []
    }

    with patch("app.dependencies.scope_deps.validate_full_scope_chain", return_value=mock_validation):
        scope = await require_project_context(
            request=request,
            x_workspace_id=workspace_id,
            x_project_id=project_id,
            db=db,
            user=user
        )

        assert scope["workspace_id"] == workspace_id
        assert scope["project_id"] == project_id
        assert scope["tenant_id"] == tenant_id
        print("  OK Project context dependency returned valid scope")


async def test_get_optional_workspace_context():
    """Test get_optional_workspace_context dependency."""
    print("\n[TEST] Testing get_optional_workspace_context dependency...")

    from app.dependencies.scope_deps import get_optional_workspace_context

    # Create mocks
    workspace_id = "workspace-xyz"
    tenant_id = "tenant-abc"
    user = MockUser(id="user-def", organization_id=tenant_id)
    request = MockRequest()
    db = MockSession()

    # Test with valid workspace
    with patch("app.dependencies.scope_deps.validate_workspace_in_tenant", return_value=True):
        scope = await get_optional_workspace_context(
            request=request,
            x_workspace_id=workspace_id,
            db=db,
            user=user
        )

        assert scope is not None
        assert scope["workspace_id"] == workspace_id
        print("  OK Optional workspace context returned scope when valid")

    # Test without workspace header
    scope_none = await get_optional_workspace_context(
        request=request,
        x_workspace_id=None,
        db=db,
        user=user
    )

    assert scope_none is None
    print("  OK Optional workspace context returned None when no header")


# =============================================================================
# Integration Test
# =============================================================================

async def test_integration():
    """Integration test combining decorator and dependency."""
    print("\n[TEST] Integration test - decorator + dependency...")

    from app.core.scope_decorators import require_workspace
    from app.dependencies.scope_deps import require_workspace_context

    workspace_id = "workspace-int-123"
    tenant_id = "tenant-int-456"
    user = MockUser(id="user-int-789", organization_id=tenant_id)
    request = MockRequest()
    db = MockSession()

    # Test endpoint with both decorator and dependency
    @require_workspace(enforce=True, log_access=False)
    async def test_endpoint(
        workspace_id: str,
        request: MockRequest,
        db: MockSession,
        user: MockUser
    ):
        # Also call dependency
        scope = await require_workspace_context(
            request=request,
            x_workspace_id=workspace_id,
            db=db,
            user=user
        )
        return {"decorator_scope": request.state.validated_scope, "dependency_scope": scope}

    with patch("app.core.scope_decorators.validate_workspace_in_tenant", return_value=True):
        with patch("app.dependencies.scope_deps.validate_workspace_in_tenant", return_value=True):
            result = await test_endpoint(
                workspace_id=workspace_id,
                request=request,
                db=db,
                user=user
            )

            # Both should return same scope
            assert result["decorator_scope"]["workspace_id"] == workspace_id
            assert result["dependency_scope"]["workspace_id"] == workspace_id
            print("  OK Decorator and dependency returned consistent scope")


# =============================================================================
# Main Test Runner
# =============================================================================

async def run_all_tests():
    """Run all tests."""
    print("=" * 70)
    print("SCOPE DECORATORS & DEPENDENCIES TEST SUITE")
    print("=" * 70)

    tests = [
        test_require_workspace_decorator,
        test_require_project_decorator,
        test_staff_can_cross_scope,
        test_require_workspace_context,
        test_require_project_context,
        test_get_optional_workspace_context,
        test_integration,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            await test()
            passed += 1
        except Exception as e:
            print(f"  FAIL FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 70)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
