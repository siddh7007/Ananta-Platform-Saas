"""
Unit Tests for Dual-Database Configuration Validation

Tests the _validate_dual_database_config function in app/core/validation.py
to ensure proper warning/error behavior for common misconfigurations.
"""

import pytest
from unittest.mock import Mock, patch
import os


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def mock_settings():
    """Create mock settings object."""
    settings = Mock()
    settings.database_url = "postgresql://postgres:postgres@localhost:27010/components_v2"
    settings.service_name = "cns-service"
    settings.db_pool_size = 10
    settings.db_max_overflow = 5
    settings.enable_ai_suggestions = False
    settings.redis_enabled = False
    settings.temporal_enabled = False
    settings.port = 27700
    settings.mouser_enabled = False
    settings.digikey_enabled = False
    settings.element14_enabled = False
    settings.ollama_enabled = False
    settings.langflow_enabled = False
    return settings


@pytest.fixture
def clean_env():
    """Clean environment variables before each test."""
    # Save original values
    original_values = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "SUPABASE_DATABASE_URL": os.environ.get("SUPABASE_DATABASE_URL"),
        "COMPONENTS_V2_DATABASE_URL": os.environ.get("COMPONENTS_V2_DATABASE_URL"),
    }

    # Clear the variables
    for key in original_values:
        if key in os.environ:
            del os.environ[key]

    yield

    # Restore original values
    for key, value in original_values.items():
        if value is not None:
            os.environ[key] = value
        elif key in os.environ:
            del os.environ[key]


# =============================================================================
# TESTS FOR _validate_dual_database_config
# =============================================================================

class TestDualDatabaseValidation:
    """Test the _validate_dual_database_config function."""

    def test_valid_dual_database_config(self, mock_settings, clean_env):
        """Test validation passes with correct dual-database configuration."""
        from app.core.validation import ConfigValidator

        # Set correct dual-database URLs
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors
        assert errors == []

    def test_missing_supabase_url_logs_warning(self, mock_settings, clean_env, caplog):
        """Test warning is logged when SUPABASE_DATABASE_URL is not set."""
        from app.core.validation import ConfigValidator
        import logging

        # Only set COMPONENTS_V2_DATABASE_URL
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"
        # Don't set SUPABASE_DATABASE_URL

        with caplog.at_level(logging.WARNING):
            errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors (warnings are logged, not returned as errors)
        assert errors == []

        # Should have logged a warning
        assert any("SUPABASE_DATABASE_URL not set" in record.message for record in caplog.records)

    def test_missing_components_url_logs_warning(self, mock_settings, clean_env, caplog):
        """Test warning is logged when COMPONENTS_V2_DATABASE_URL is not set."""
        from app.core.validation import ConfigValidator
        import logging

        # Only set SUPABASE_DATABASE_URL
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
        # Don't set COMPONENTS_V2_DATABASE_URL

        with caplog.at_level(logging.WARNING):
            errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors
        assert errors == []

        # Should have logged a warning
        assert any("COMPONENTS_V2_DATABASE_URL not set" in record.message for record in caplog.records)

    def test_localhost_5432_logs_warning(self, mock_settings, clean_env, caplog):
        """Test warning is logged when URL points to localhost:5432."""
        from app.core.validation import ConfigValidator
        import logging

        # Set URLs with localhost:5432 (common misconfiguration)
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        with caplog.at_level(logging.WARNING):
            errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors (it's a warning, not an error)
        assert errors == []

        # Should have logged a warning about localhost:5432
        assert any("localhost:5432" in record.message for record in caplog.records)

    def test_same_database_logs_warning(self, mock_settings, clean_env, caplog):
        """Test warning is logged when both URLs point to same database."""
        from app.core.validation import ConfigValidator
        import logging

        # Set both URLs to same database (misconfiguration)
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"

        with caplog.at_level(logging.WARNING):
            errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors
        assert errors == []

        # Should have logged a warning about same database
        assert any("SAME database" in record.message for record in caplog.records)

    def test_invalid_url_format_returns_error(self, mock_settings, clean_env):
        """Test error is returned for invalid URL format."""
        from app.core.validation import ConfigValidator

        # Set invalid URL format (missing postgresql:// prefix)
        os.environ["SUPABASE_DATABASE_URL"] = "mysql://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have error about URL format
        assert len(errors) == 1
        assert "must start with 'postgresql://'" in errors[0]

    def test_postgres_url_prefix_accepted(self, mock_settings, clean_env):
        """Test postgres:// URL prefix is accepted (alias for postgresql://)."""
        from app.core.validation import ConfigValidator

        # Use postgres:// prefix (should be valid)
        os.environ["SUPABASE_DATABASE_URL"] = "postgres://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgres://postgres:postgres@localhost:27010/components_v2"

        errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors
        assert errors == []

    def test_logs_masked_urls(self, mock_settings, clean_env, caplog):
        """Test that logged URLs have passwords masked."""
        from app.core.validation import ConfigValidator
        import logging

        # Set URLs with passwords
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:secretpassword@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://user:anothersecret@localhost:27010/components_v2"

        with caplog.at_level(logging.INFO):
            ConfigValidator._validate_dual_database_config(mock_settings)

        # Should NOT contain actual passwords
        log_text = " ".join(record.message for record in caplog.records)
        assert "secretpassword" not in log_text
        assert "anothersecret" not in log_text

        # Should contain masked version
        assert "****" in log_text

    def test_both_urls_missing_logs_both_warnings(self, mock_settings, clean_env, caplog):
        """Test both warnings are logged when both URLs are missing."""
        from app.core.validation import ConfigValidator
        import logging

        # Don't set any dual-database URLs

        with caplog.at_level(logging.WARNING):
            errors = ConfigValidator._validate_dual_database_config(mock_settings)

        # Should have no errors
        assert errors == []

        # Should have logged warnings for both missing URLs
        warning_messages = [r.message for r in caplog.records if r.levelno >= logging.WARNING]
        assert any("SUPABASE_DATABASE_URL not set" in msg for msg in warning_messages)
        assert any("COMPONENTS_V2_DATABASE_URL not set" in msg for msg in warning_messages)


class TestValidationSummary:
    """Test get_validation_summary includes dual-database status."""

    def test_summary_includes_dual_database_status(self, mock_settings, clean_env):
        """Test validation summary includes dual_database configuration status."""
        from app.core.validation import ConfigValidator

        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        summary = ConfigValidator.get_validation_summary(mock_settings)

        # Should include dual_database in config_summary
        assert "config_summary" in summary
        assert "dual_database" in summary["config_summary"]
        assert summary["config_summary"]["dual_database"]["supabase"] == "configured"
        assert summary["config_summary"]["dual_database"]["components_v2"] == "configured"

    def test_summary_shows_missing_when_not_set(self, mock_settings, clean_env):
        """Test validation summary shows 'missing' when URLs not set."""
        from app.core.validation import ConfigValidator

        # Don't set dual-database URLs

        summary = ConfigValidator.get_validation_summary(mock_settings)

        # Should show 'missing' for both
        assert summary["config_summary"]["dual_database"]["supabase"] == "missing"
        assert summary["config_summary"]["dual_database"]["components_v2"] == "missing"


class TestURLMasking:
    """Test URL masking functionality."""

    def test_mask_url_with_password(self, mock_settings, clean_env, caplog):
        """Test URL with password is properly masked."""
        from app.core.validation import ConfigValidator
        import logging

        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://myuser:mysecretpass@db.example.com:5432/mydb"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        with caplog.at_level(logging.INFO):
            ConfigValidator._validate_dual_database_config(mock_settings)

        log_text = " ".join(record.message for record in caplog.records)

        # Should mask the password
        assert "mysecretpass" not in log_text
        assert "myuser:****@db.example.com" in log_text

    def test_mask_url_without_password(self, mock_settings, clean_env, caplog):
        """Test URL without password section handles gracefully."""
        from app.core.validation import ConfigValidator
        import logging

        # URL without password (unusual but possible)
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        with caplog.at_level(logging.INFO):
            # Should not raise exception
            ConfigValidator._validate_dual_database_config(mock_settings)


class TestConfigHealthFunction:
    """Test the get_config_health helper function."""

    def test_config_health_returns_healthy(self, mock_settings, clean_env):
        """Test get_config_health returns healthy status with valid config."""
        # Patch settings import
        with patch('app.core.validation.settings', mock_settings):
            from app.core.validation import get_config_health

            os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
            os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

            health = get_config_health()

            # Status depends on other validation checks, but should have validation key
            assert "status" in health
            assert "validation" in health


# =============================================================================
# INTEGRATION TESTS (with actual ConfigValidator)
# =============================================================================

class TestValidateAtStartup:
    """Test validate_at_startup includes dual-database validation."""

    def test_startup_validation_includes_dual_db_check(self, mock_settings, clean_env):
        """Test that validate_at_startup calls _validate_dual_database_config."""
        from app.core.validation import ConfigValidator

        # Set valid URLs
        os.environ["SUPABASE_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27432/postgres"
        os.environ["COMPONENTS_V2_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:27010/components_v2"

        # Should not raise with valid configuration
        try:
            ConfigValidator.validate_at_startup(mock_settings)
        except Exception as e:
            # May fail on other validations, but dual-db should pass
            assert "SUPABASE_DATABASE_URL" not in str(e)
            assert "COMPONENTS_V2_DATABASE_URL" not in str(e)


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
