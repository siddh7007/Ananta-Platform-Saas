"""
Smoke Tests for Health Endpoints

These tests verify the FastAPI wiring for health endpoints stays intact.
Run during CI to catch routing/import issues early.

Usage:
    pytest tests/integration/test_health_endpoints_smoke.py -v

    # With fake database URLs for CI
    SUPABASE_DATABASE_URL=postgresql://fake:fake@localhost:5432/fake \
    COMPONENTS_V2_DATABASE_URL=postgresql://fake:fake@localhost:5433/fake \
    pytest tests/integration/test_health_endpoints_smoke.py -v
"""

import pytest
from fastapi.testclient import TestClient
import os


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def clean_env():
    """Clean and set fake database URLs for testing."""
    original_values = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "SUPABASE_DATABASE_URL": os.environ.get("SUPABASE_DATABASE_URL"),
        "COMPONENTS_V2_DATABASE_URL": os.environ.get("COMPONENTS_V2_DATABASE_URL"),
    }

    # Set fake URLs for testing (ensures validation logic runs)
    os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:27010/test_db"
    os.environ["SUPABASE_DATABASE_URL"] = "postgresql://test:test@localhost:27432/supabase"
    os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://test:test@localhost:27010/components_v2"

    yield

    # Restore original values
    for key, value in original_values.items():
        if value is not None:
            os.environ[key] = value
        elif key in os.environ:
            del os.environ[key]


@pytest.fixture
def client(clean_env):
    """Create FastAPI test client."""
    # Import app after setting environment variables
    from app.main import app
    return TestClient(app)


# =============================================================================
# SMOKE TESTS - Verify endpoints exist and respond
# =============================================================================

class TestHealthEndpointSmoke:
    """Smoke tests to verify health endpoints are wired correctly."""

    def test_health_config_endpoint_exists(self, client):
        """Verify /health/config endpoint exists and returns JSON."""
        response = client.get("/health/config")

        # Should return 200 (not 404)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        # Should return JSON
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"

        # Should have expected top-level keys
        assert "status" in data, "Response should have 'status' key"
        assert "database_urls" in data, "Response should have 'database_urls' key"
        assert "dual_database_configured" in data, "Response should have 'dual_database_configured' key"

    def test_health_config_dual_db_endpoint_exists(self, client):
        """Verify /health/config/dual-db endpoint exists and returns JSON."""
        response = client.get("/health/config/dual-db")

        # Should return 200 (not 404)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        # Should return JSON
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"

        # Should have expected top-level keys
        assert "status" in data, "Response should have 'status' key"
        assert "supabase" in data, "Response should have 'supabase' key"
        assert "components_v2" in data, "Response should have 'components_v2' key"
        assert "routing_valid" in data, "Response should have 'routing_valid' key"

    def test_basic_health_endpoint_exists(self, client):
        """Verify basic /health endpoint exists."""
        response = client.get("/health")

        # Should return 200 (not 404)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        # Should return JSON
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        assert "status" in data, "Response should have 'status' key"


class TestHealthConfigResponseStructure:
    """Tests for /health/config response structure."""

    def test_config_response_has_database_urls(self, client):
        """Verify database_urls contains all expected keys."""
        response = client.get("/health/config")
        data = response.json()

        db_urls = data.get("database_urls", {})
        assert "DATABASE_URL" in db_urls, "Should have DATABASE_URL"
        assert "SUPABASE_DATABASE_URL" in db_urls, "Should have SUPABASE_DATABASE_URL"
        assert "COMPONENTS_V2_DATABASE_URL" in db_urls, "Should have COMPONENTS_V2_DATABASE_URL"

    def test_config_response_masks_passwords(self, client):
        """Verify passwords are masked in response."""
        response = client.get("/health/config")
        data = response.json()

        db_urls = data.get("database_urls", {})

        # None of the URLs should contain "test" password (from our fixture)
        for key, url in db_urls.items():
            if url and url != "(not set)":
                # Password should be masked with ****
                assert "****" in url or "@" not in url, f"{key} should have masked password"

    def test_config_response_has_warnings_list(self, client):
        """Verify warnings is a list."""
        response = client.get("/health/config")
        data = response.json()

        assert "warnings" in data, "Should have 'warnings' key"
        assert isinstance(data["warnings"], list), "warnings should be a list"

    def test_config_response_has_errors_list(self, client):
        """Verify errors is a list."""
        response = client.get("/health/config")
        data = response.json()

        assert "errors" in data, "Should have 'errors' key"
        assert isinstance(data["errors"], list), "errors should be a list"

    def test_config_response_has_status_enum(self, client):
        """Verify status is one of expected values."""
        response = client.get("/health/config")
        data = response.json()

        valid_statuses = {"healthy", "warning", "error"}
        assert data["status"] in valid_statuses, f"Status should be one of {valid_statuses}"


class TestDualDbResponseStructure:
    """Tests for /health/config/dual-db response structure."""

    def test_dual_db_response_has_supabase_details(self, client):
        """Verify supabase section has expected keys."""
        response = client.get("/health/config/dual-db")
        data = response.json()

        supabase = data.get("supabase", {})
        assert "status" in supabase, "supabase should have 'status'"
        assert "url_set" in supabase, "supabase should have 'url_set'"
        assert "connected" in supabase, "supabase should have 'connected'"

    def test_dual_db_response_has_components_v2_details(self, client):
        """Verify components_v2 section has expected keys."""
        response = client.get("/health/config/dual-db")
        data = response.json()

        components = data.get("components_v2", {})
        assert "status" in components, "components_v2 should have 'status'"
        assert "url_set" in components, "components_v2 should have 'url_set'"
        assert "connected" in components, "components_v2 should have 'connected'"

    def test_dual_db_response_has_warnings(self, client):
        """Verify warnings is present."""
        response = client.get("/health/config/dual-db")
        data = response.json()

        assert "warnings" in data, "Should have 'warnings' key"
        assert isinstance(data["warnings"], list), "warnings should be a list"


class TestMisconfigurationDetection:
    """Tests for misconfiguration detection logic."""

    def test_detects_localhost_5432_warning(self):
        """Verify localhost:5432 misconfiguration is detected."""
        # Set a misconfigured URL
        original = os.environ.get("SUPABASE_DATABASE_URL")
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://test:test@localhost:5432/postgres"
        os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:27010/test"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://test:test@localhost:27010/components"

        try:
            from app.main import app
            client = TestClient(app)

            response = client.get("/health/config")
            data = response.json()

            # Should have a warning about localhost:5432
            warnings = data.get("warnings", [])
            has_5432_warning = any("5432" in w for w in warnings)
            assert has_5432_warning, "Should warn about localhost:5432"
        finally:
            if original:
                os.environ["SUPABASE_DATABASE_URL"] = original

    def test_detects_same_database_warning(self):
        """Verify same-database misconfiguration is detected."""
        # Set both URLs to same database
        os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:27432/postgres"
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://test:test@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://test:test@localhost:27432/postgres"

        try:
            from app.main import app
            client = TestClient(app)

            response = client.get("/health/config")
            data = response.json()

            # Should have a warning about same database
            warnings = data.get("warnings", [])
            has_same_db_warning = any("SAME" in w.upper() for w in warnings)
            assert has_same_db_warning, "Should warn about same database"
        finally:
            pass  # clean_env fixture will restore


# =============================================================================
# CI INTEGRATION TESTS
# =============================================================================

class TestCIIntegration:
    """Tests designed for CI pipeline integration."""

    def test_endpoints_return_json_content_type(self, client):
        """Verify endpoints return application/json content type."""
        endpoints = ["/health/config", "/health/config/dual-db"]

        for endpoint in endpoints:
            response = client.get(endpoint)
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type, f"{endpoint} should return JSON"

    def test_endpoints_do_not_require_auth(self, client):
        """Verify health endpoints are accessible without authentication."""
        endpoints = ["/health/config", "/health/config/dual-db"]

        for endpoint in endpoints:
            response = client.get(endpoint)
            # Should NOT be 401 or 403
            assert response.status_code not in [401, 403], f"{endpoint} should not require auth"

    def test_endpoints_respond_quickly(self, client):
        """Verify endpoints respond within reasonable time (for CI)."""
        import time

        endpoints = ["/health/config"]  # Skip dual-db as it tries real connections

        for endpoint in endpoints:
            start = time.time()
            response = client.get(endpoint)
            elapsed = time.time() - start

            # Should respond within 5 seconds (generous for CI)
            assert elapsed < 5.0, f"{endpoint} took {elapsed:.2f}s (should be < 5s)"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
