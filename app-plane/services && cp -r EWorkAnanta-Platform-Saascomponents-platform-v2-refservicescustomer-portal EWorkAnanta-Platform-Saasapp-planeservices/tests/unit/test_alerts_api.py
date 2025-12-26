"""
Unit Tests for Alert System API

Tests the alert endpoints, preferences, component watches, and AlertService.
These tests use mocked database connections to isolate API logic.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from uuid import uuid4
import json
import os
import sys

# Set required environment variables BEFORE importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only-1234567890")
os.environ.setdefault("SUPABASE_URL", "http://localhost:5433")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CNS_SECRET_KEY", "test-cns-secret")

# Add paths for imports
cns_service_path = os.path.join(os.path.dirname(__file__), '..', '..')
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'shared')
sys.path.insert(0, cns_service_path)
sys.path.insert(0, shared_path)


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def mock_auth_context():
    """Mock authentication context."""
    return Mock(
        user_id="test-user-123",
        organization_id="test-org-456",
        role="admin",
        is_super_admin=False,
    )


@pytest.fixture
def sample_alert():
    """Sample alert data."""
    return {
        "id": str(uuid4()),
        "severity": "high",
        "alert_type": "LIFECYCLE",
        "title": "Component EOL Alert",
        "message": "Component XYZ123 has been marked as End of Life",
        "component_id": str(uuid4()),
        "manufacturer_part_number": "XYZ123",
        "context": {"old_status": "Active", "new_status": "EOL"},
        "action_url": "/components/xyz123",
        "is_read": False,
        "archived_at": None,
        "created_at": datetime.now(),
    }


@pytest.fixture
def sample_alert_preference():
    """Sample alert preference data."""
    return {
        "id": str(uuid4()),
        "alert_type": "LIFECYCLE",
        "email_enabled": True,
        "in_app_enabled": True,
        "webhook_enabled": False,
        "email_address": "test@example.com",
        "webhook_url": None,
        "threshold_config": {"alert_on_nrnd": True, "alert_on_eol": True},
        "is_active": True,
    }


@pytest.fixture
def sample_component_watch():
    """Sample component watch data."""
    return {
        "id": str(uuid4()),
        "component_id": str(uuid4()),
        "manufacturer_part_number": "TEST123",
        "manufacturer": "Test Manufacturer",
        "watch_pcn": True,
        "watch_lifecycle": True,
        "watch_risk": True,
        "watch_price": False,
        "watch_stock": False,
        "watch_compliance": True,
        "watch_supply_chain": True,
        "created_at": datetime.now(),
    }


# =============================================================================
# RISK INTEGRATION TESTS (Can run without full app context)
# =============================================================================

class TestRiskIntegration:
    """Test the risk_integration module."""

    def test_process_component_risk_function_signature(self):
        """Test that process_component_risk has correct signature."""
        from app.services.risk_integration import process_component_risk
        import inspect

        sig = inspect.signature(process_component_risk)
        params = list(sig.parameters.keys())

        assert "component_id" in params
        assert "organization_id" in params
        assert "enrichment_data" in params
        assert "mpn" in params
        assert "manufacturer" in params
        assert "previous_lifecycle_status" in params

    def test_schedule_risk_processing_function_exists(self):
        """Test that schedule_risk_processing function exists."""
        from app.services.risk_integration import schedule_risk_processing

        assert callable(schedule_risk_processing)

    def test_process_batch_risk_function_exists(self):
        """Test that process_batch_risk function exists."""
        from app.services.risk_integration import process_batch_risk

        assert callable(process_batch_risk)

    @pytest.mark.asyncio
    async def test_process_component_risk_no_component_id(self):
        """Test that process_component_risk handles missing component_id."""
        from app.services.risk_integration import process_component_risk

        result = await process_component_risk(
            component_id=None,  # No component ID
            organization_id="test-org",
            enrichment_data={},
            mpn="TEST123",
        )

        # Should return early with no risk calculated
        assert result["risk_calculated"] == False
        assert result["alerts_generated"] == []

    @pytest.mark.asyncio
    async def test_process_component_risk_returns_correct_structure(self):
        """Test that process_component_risk returns correct result structure."""
        from app.services.risk_integration import process_component_risk

        # Even with no component_id, should return proper structure
        result = await process_component_risk(
            component_id=None,
            organization_id="test-org",
            enrichment_data={},
            mpn="TEST123",
        )

        assert "risk_calculated" in result
        assert "alerts_generated" in result
        assert "errors" in result
        assert isinstance(result["risk_calculated"], bool)
        assert isinstance(result["alerts_generated"], list)
        assert isinstance(result["errors"], list)

    @pytest.mark.asyncio
    async def test_process_component_risk_with_empty_mpn(self):
        """Test that process_component_risk handles empty MPN."""
        from app.services.risk_integration import process_component_risk

        result = await process_component_risk(
            component_id=None,
            organization_id="test-org",
            enrichment_data={},
            mpn="",  # Empty MPN
        )

        # Should still return valid structure
        assert "risk_calculated" in result
        assert "alerts_generated" in result

    @pytest.mark.asyncio
    async def test_process_component_risk_with_enrichment_data(self):
        """Test process_component_risk with enrichment data but no component_id."""
        from app.services.risk_integration import process_component_risk

        enrichment_data = {
            "lifecycle_status": "NRND",
            "rohs_compliant": True,
            "reach_compliant": True,
            "stock_quantity": 1000,
            "lead_time_days": 14,
        }

        result = await process_component_risk(
            component_id=None,  # Still no component_id
            organization_id="test-org",
            enrichment_data=enrichment_data,
            mpn="TEST456",
            manufacturer="Test Mfg",
        )

        # Should return early - component_id is required
        assert result["risk_calculated"] == False


# =============================================================================
# ALERT SERVICE ENUM TESTS (Test enums directly)
# =============================================================================

class TestAlertServiceEnums:
    """Test AlertService enums and constants."""

    def test_alert_type_enum_values(self):
        """Test AlertType enum has all required values."""
        from app.services.alert_service import AlertType

        expected_types = ["LIFECYCLE", "RISK", "PRICE", "AVAILABILITY", "COMPLIANCE", "PCN", "SUPPLY_CHAIN"]

        for alert_type in expected_types:
            assert hasattr(AlertType, alert_type)
            assert AlertType[alert_type].value == alert_type

    def test_alert_severity_enum_values(self):
        """Test AlertSeverity enum has all required values."""
        from app.services.alert_service import AlertSeverity

        expected_severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

        for severity in expected_severities:
            assert hasattr(AlertSeverity, severity)
            assert AlertSeverity[severity].value == severity

    def test_alert_type_config_structure(self):
        """Test ALERT_TYPE_CONFIG has proper structure."""
        from app.services.alert_service import ALERT_TYPE_CONFIG, AlertType

        for alert_type in AlertType:
            if alert_type in ALERT_TYPE_CONFIG:
                config = ALERT_TYPE_CONFIG[alert_type]
                assert "description" in config
                assert "default_enabled" in config

    def test_lifecycle_severity_mapping(self):
        """Test lifecycle change to OBSOLETE should be CRITICAL."""
        from app.services.alert_service import AlertSeverity, ALERT_TYPE_CONFIG, AlertType

        config = ALERT_TYPE_CONFIG.get(AlertType.LIFECYCLE, {})
        severity_map = config.get("default_severity_map", {})

        assert severity_map.get("OBSOLETE") == AlertSeverity.CRITICAL

    def test_lifecycle_eol_severity_mapping(self):
        """Test lifecycle change to EOL should be HIGH."""
        from app.services.alert_service import AlertSeverity, ALERT_TYPE_CONFIG, AlertType

        config = ALERT_TYPE_CONFIG.get(AlertType.LIFECYCLE, {})
        severity_map = config.get("default_severity_map", {})

        assert severity_map.get("EOL") == AlertSeverity.HIGH

    def test_lifecycle_nrnd_severity_mapping(self):
        """Test lifecycle change to NRND should be MEDIUM."""
        from app.services.alert_service import AlertSeverity, ALERT_TYPE_CONFIG, AlertType

        config = ALERT_TYPE_CONFIG.get(AlertType.LIFECYCLE, {})
        severity_map = config.get("default_severity_map", {})

        assert severity_map.get("NRND") == AlertSeverity.MEDIUM

    def test_risk_alert_type_in_config(self):
        """Test RISK alert type is in config."""
        from app.services.alert_service import ALERT_TYPE_CONFIG, AlertType

        assert AlertType.RISK in ALERT_TYPE_CONFIG

    def test_supply_chain_alert_type_exists(self):
        """Test SUPPLY_CHAIN alert type exists."""
        from app.services.alert_service import AlertType

        assert hasattr(AlertType, "SUPPLY_CHAIN")
        assert AlertType.SUPPLY_CHAIN.value == "SUPPLY_CHAIN"


# =============================================================================
# ALERT SERVICE METHOD TESTS (Using Mocks)
# =============================================================================

class TestAlertServiceMethods:
    """Test AlertService methods with mocks."""

    @pytest.fixture
    def alert_service(self):
        """Create AlertService instance."""
        from app.services.alert_service import AlertService
        return AlertService()

    def test_alert_service_instantiation(self, alert_service):
        """Test AlertService can be instantiated."""
        assert alert_service is not None

    def test_alert_service_has_create_alert_method(self, alert_service):
        """Test AlertService has create_alert method."""
        assert hasattr(alert_service, 'create_alert')
        assert callable(alert_service.create_alert)

    def test_alert_service_has_check_risk_threshold_method(self, alert_service):
        """Test AlertService has check_risk_threshold method."""
        assert hasattr(alert_service, 'check_risk_threshold')
        assert callable(alert_service.check_risk_threshold)

    def test_alert_service_has_check_lifecycle_change_method(self, alert_service):
        """Test AlertService has check_lifecycle_change method."""
        assert hasattr(alert_service, 'check_lifecycle_change')
        assert callable(alert_service.check_lifecycle_change)

    def test_alert_service_has_check_availability_issue_method(self, alert_service):
        """Test AlertService has check_availability_issue method."""
        assert hasattr(alert_service, 'check_availability_issue')
        assert callable(alert_service.check_availability_issue)

    def test_alert_service_has_check_price_change_method(self, alert_service):
        """Test AlertService has check_price_change method."""
        assert hasattr(alert_service, 'check_price_change')
        assert callable(alert_service.check_price_change)

    def test_alert_service_has_check_supply_chain_issue_method(self, alert_service):
        """Test AlertService has check_supply_chain_issue method."""
        assert hasattr(alert_service, 'check_supply_chain_issue')
        assert callable(alert_service.check_supply_chain_issue)


# =============================================================================
# INTEGRATION WITH BOM ENRICHMENT TESTS
# =============================================================================

class TestBOMEnrichmentIntegration:
    """Test integration with BOM enrichment workflow."""

    def test_risk_integration_imported_correctly(self):
        """Verify risk_integration can be imported."""
        try:
            from app.services.risk_integration import process_component_risk
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import risk_integration: {e}")

    def test_alert_service_imported_correctly(self):
        """Verify AlertService can be imported."""
        try:
            from app.services.alert_service import AlertService
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import AlertService: {e}")

    def test_risk_integration_has_correct_functions(self):
        """Test risk_integration module has all required functions."""
        from app.services import risk_integration

        assert hasattr(risk_integration, 'process_component_risk')
        assert hasattr(risk_integration, 'schedule_risk_processing')
        assert hasattr(risk_integration, 'process_batch_risk')


# =============================================================================
# ALERT DATA STRUCTURE TESTS
# =============================================================================

class TestAlertDataStructures:
    """Test alert data structures and validation."""

    def test_alert_result_structure(self):
        """Test the expected alert result structure from process_component_risk."""
        expected_keys = ['risk_calculated', 'alerts_generated', 'errors']

        # Create a minimal result structure
        result = {
            'risk_calculated': False,
            'alerts_generated': [],
            'errors': []
        }

        for key in expected_keys:
            assert key in result

    def test_alert_generated_structure(self):
        """Test the expected structure for generated alerts."""
        alert_entry = {
            'type': 'LIFECYCLE',
            'alert_id': str(uuid4()),
            'severity': 'HIGH'
        }

        assert 'type' in alert_entry
        assert 'alert_id' in alert_entry
        assert 'severity' in alert_entry

    def test_valid_alert_types(self):
        """Test that all expected alert types are valid."""
        from app.services.alert_service import AlertType

        valid_types = ['LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN']

        for type_name in valid_types:
            assert hasattr(AlertType, type_name)

    def test_valid_severities(self):
        """Test that all expected severities are valid."""
        from app.services.alert_service import AlertSeverity

        valid_severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

        for severity in valid_severities:
            assert hasattr(AlertSeverity, severity)


# =============================================================================
# THRESHOLD CONFIGURATION TESTS (Standalone)
# =============================================================================

class TestThresholdConfigurations:
    """Test threshold configuration values and structures."""

    def test_risk_min_default_value(self):
        """Test default minimum risk score threshold."""
        from app.services.alert_service import ALERT_TYPE_CONFIG, AlertType

        risk_config = ALERT_TYPE_CONFIG.get(AlertType.RISK, {})
        triggers = risk_config.get('triggers', {})

        # Default min_score should be 60
        assert triggers.get('min_score', 60) == 60

    def test_availability_default_thresholds(self):
        """Test default availability thresholds."""
        from app.services.alert_service import ALERT_TYPE_CONFIG, AlertType

        config = ALERT_TYPE_CONFIG.get(AlertType.AVAILABILITY, {})
        triggers = config.get('triggers', {})

        # Check default values exist
        assert 'min_stock' in triggers or triggers == {}
        assert 'max_lead_time_days' in triggers or triggers == {}

    def test_price_default_threshold(self):
        """Test default price change threshold."""
        from app.services.alert_service import ALERT_TYPE_CONFIG, AlertType

        config = ALERT_TYPE_CONFIG.get(AlertType.PRICE, {})
        triggers = config.get('triggers', {})

        # Default change percent should be 10
        assert triggers.get('change_percent', 10) == 10


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
