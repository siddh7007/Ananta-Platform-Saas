"""
Tests for Rate Limiting Middleware

Tests the rate limiting functionality for:
- Admin token endpoints (10 requests per minute)
- Regular authenticated endpoints (100 requests per minute)
- IP whitelisting
- Constant-time token comparison
"""

import pytest
import time
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.middleware.rate_limit import (
    RateLimitMiddleware,
    setup_rate_limit_middleware,
    validate_admin_token,
    is_ip_whitelisted,
    get_client_ip,
    ADMIN_TOKEN_RATE_LIMIT,
    AUTHENTICATED_RATE_LIMIT,
)


@pytest.fixture
def app():
    """Create a test FastAPI app with rate limiting."""
    test_app = FastAPI()

    # Add test endpoints
    @test_app.get("/api/admin/default-token")
    async def admin_endpoint():
        return {"token": "test-token"}

    @test_app.get("/api/data")
    async def data_endpoint():
        return {"data": "test-data"}

    @test_app.get("/health")
    async def health_endpoint():
        return {"status": "ok"}

    # Setup rate limiting
    setup_rate_limit_middleware(test_app)

    return test_app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


class TestAdminTokenValidation:
    """Test admin token validation with constant-time comparison."""

    @patch('app.middleware.rate_limit.settings')
    def test_valid_admin_token(self, mock_settings):
        """Test that valid admin token passes validation."""
        mock_settings.admin_api_token = "test-admin-token-12345"
        assert validate_admin_token("test-admin-token-12345") is True

    @patch('app.middleware.rate_limit.settings')
    def test_invalid_admin_token(self, mock_settings):
        """Test that invalid admin token fails validation."""
        mock_settings.admin_api_token = "test-admin-token-12345"
        assert validate_admin_token("wrong-token") is False

    @patch('app.middleware.rate_limit.settings')
    def test_missing_admin_token_config(self, mock_settings):
        """Test that missing config rejects all tokens."""
        mock_settings.admin_api_token = None
        assert validate_admin_token("any-token") is False

    @patch('app.middleware.rate_limit.settings')
    def test_timing_attack_resistance(self, mock_settings):
        """Test that validation is resistant to timing attacks."""
        mock_settings.admin_api_token = "test-admin-token-12345"

        # Both comparisons should take similar time
        # (constant-time comparison prevents timing analysis)
        import timeit

        # Time valid token comparison
        valid_time = timeit.timeit(
            lambda: validate_admin_token("test-admin-token-12345"),
            number=1000
        )

        # Time invalid token comparison
        invalid_time = timeit.timeit(
            lambda: validate_admin_token("wrong-token-000000000"),
            number=1000
        )

        # Times should be within 50% of each other (constant-time property)
        # Note: This is a heuristic test, not cryptographically rigorous
        ratio = max(valid_time, invalid_time) / min(valid_time, invalid_time)
        assert ratio < 1.5, f"Timing ratio too high: {ratio:.2f} (possible timing attack vector)"


class TestIPWhitelisting:
    """Test IP whitelisting for admin tokens."""

    @patch('app.middleware.rate_limit.ADMIN_TOKEN_ALLOWED_IPS', [])
    def test_whitelist_disabled(self):
        """Test that empty whitelist allows all IPs."""
        assert is_ip_whitelisted("192.168.1.100") is True
        assert is_ip_whitelisted("10.0.0.1") is True

    @patch('app.middleware.rate_limit.ADMIN_TOKEN_ALLOWED_IPS', ["192.168.1.100", "10.0.0.50"])
    def test_whitelist_enabled_allowed(self):
        """Test that whitelisted IP is allowed."""
        assert is_ip_whitelisted("192.168.1.100") is True
        assert is_ip_whitelisted("10.0.0.50") is True

    @patch('app.middleware.rate_limit.ADMIN_TOKEN_ALLOWED_IPS', ["192.168.1.100"])
    def test_whitelist_enabled_blocked(self):
        """Test that non-whitelisted IP is blocked."""
        assert is_ip_whitelisted("10.0.0.1") is False
        assert is_ip_whitelisted("192.168.1.101") is False


class TestClientIPExtraction:
    """Test client IP extraction with proxy handling."""

    def test_direct_connection(self):
        """Test IP extraction from direct connection."""
        from fastapi import Request
        from starlette.datastructures import Headers

        # Mock request with client IP
        request = MagicMock(spec=Request)
        request.headers = Headers({})
        request.client.host = "192.168.1.100"

        with patch('app.middleware.rate_limit.settings') as mock_settings:
            mock_settings.trusted_proxy_count = 0
            ip = get_client_ip(request)
            assert ip == "192.168.1.100"

    def test_x_real_ip_header(self):
        """Test IP extraction from X-Real-IP header (most trusted)."""
        from fastapi import Request
        from starlette.datastructures import Headers

        request = MagicMock(spec=Request)
        request.headers = Headers({"X-Real-IP": "203.0.113.100"})
        request.client.host = "192.168.1.1"

        ip = get_client_ip(request)
        assert ip == "203.0.113.100"

    def test_x_forwarded_for_single_proxy(self):
        """Test IP extraction from X-Forwarded-For with single proxy."""
        from fastapi import Request
        from starlette.datastructures import Headers

        request = MagicMock(spec=Request)
        request.headers = Headers({"X-Forwarded-For": "203.0.113.100, 10.0.0.1"})
        request.client.host = "10.0.0.1"

        with patch('app.middleware.rate_limit.settings') as mock_settings:
            mock_settings.trusted_proxy_count = 1
            ip = get_client_ip(request)
            # With trusted_proxy_count=1, take the IP before the proxy
            assert ip == "203.0.113.100"


class TestRateLimiting:
    """Test rate limiting functionality."""

    @patch('app.middleware.rate_limit.settings')
    @patch('app.middleware.rate_limit._rate_limit_store')
    def test_admin_token_rate_limit(self, mock_store, mock_settings, client):
        """Test that admin token requests are rate limited to 10/min."""
        mock_settings.admin_api_token = "test-admin-token"
        mock_settings.admin_token_allowed_ips = None

        # Mock store to simulate rate limit
        mock_store.increment.return_value = 1

        # First request should succeed
        response = client.get(
            "/api/admin/default-token",
            headers={"Authorization": "Bearer test-admin-token"}
        )
        assert response.status_code in [200, 404]  # 404 if endpoint not fully configured

        # Simulate exceeding rate limit
        mock_store.increment.return_value = ADMIN_TOKEN_RATE_LIMIT + 1

        # Next request should be rate limited
        response = client.get(
            "/api/admin/default-token",
            headers={"Authorization": "Bearer test-admin-token"}
        )
        assert response.status_code == 429
        assert "rate limit" in response.json()["detail"].lower()
        assert "Retry-After" in response.headers

    @patch('app.middleware.rate_limit.settings')
    @patch('app.middleware.rate_limit._rate_limit_store')
    def test_authenticated_rate_limit(self, mock_store, mock_settings, client):
        """Test that authenticated requests are rate limited to 100/min."""
        # Mock store
        mock_store.increment.return_value = AUTHENTICATED_RATE_LIMIT + 1

        # Request with auth should be rate limited after 100 requests
        response = client.get(
            "/api/data",
            headers={"Authorization": "Bearer some-jwt-token"}
        )
        assert response.status_code == 429

    @patch('app.middleware.rate_limit.settings')
    def test_health_check_exempt(self, mock_settings, client):
        """Test that health check endpoints are exempt from rate limiting."""
        # Health check should always work, even without auth
        response = client.get("/health")
        assert response.status_code == 200

    @patch('app.middleware.rate_limit.settings')
    @patch('app.middleware.rate_limit.ADMIN_TOKEN_ALLOWED_IPS', ["192.168.1.100"])
    def test_ip_whitelist_enforcement(self, mock_settings, client):
        """Test that IP whitelist is enforced for admin tokens."""
        mock_settings.admin_api_token = "test-admin-token"

        # Request from non-whitelisted IP should be blocked
        response = client.get(
            "/api/admin/default-token",
            headers={
                "Authorization": "Bearer test-admin-token",
                "X-Real-IP": "10.0.0.1"  # Not in whitelist
            }
        )
        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"].lower()


class TestRateLimitStore:
    """Test the Redis-backed rate limit store."""

    def test_increment_memory_fallback(self):
        """Test that in-memory store works when Redis unavailable."""
        from app.middleware.rate_limit import RateLimitStore

        store = RateLimitStore()
        store.use_redis = False  # Force in-memory mode

        # First increment
        count = store.increment("test_key", 60)
        assert count == 1

        # Second increment
        count = store.increment("test_key", 60)
        assert count == 2

    def test_get_nonexistent_key(self):
        """Test getting a non-existent key returns 0."""
        from app.middleware.rate_limit import RateLimitStore

        store = RateLimitStore()
        store.use_redis = False

        count = store.get("nonexistent_key")
        assert count == 0

    def test_expiration(self):
        """Test that keys expire after the window."""
        from app.middleware.rate_limit import RateLimitStore

        store = RateLimitStore()
        store.use_redis = False

        # Increment with very short window
        count = store.increment("test_key", 1)
        assert count == 1

        # Wait for expiration
        time.sleep(1.1)

        # Next increment should reset to 1
        count = store.increment("test_key", 1)
        assert count == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
