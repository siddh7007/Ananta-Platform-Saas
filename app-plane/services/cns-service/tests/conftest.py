"""
Pytest configuration and shared fixtures for CNS Service tests.
"""
import pytest
from typing import Dict, Any, List
from datetime import datetime


# ============================================================================
# NORMALIZER TEST FIXTURES
# ============================================================================

@pytest.fixture
def sample_raw_component_data() -> Dict[str, Any]:
    """Sample raw component data with various formats for testing normalization."""
    return {
        # Basic fields
        "mpn": "stm32f407vgt6",
        "manufacturer": "stmicroelectronics",
        "description": "ARM Cortex-M4 32-bit MCU+FPU, 1MB Flash, 192KB RAM",

        # Basic electrical
        "voltage": "3.6V",
        "current": "500mA",
        "power": "1/4W",
        "resistance": "10kΩ",
        "capacitance": "100µF",

        # Extended electrical
        "tolerance": "±5%",
        "tempco": "±50ppm/°C",
        "inductance": "10µH",
        "esr": "50mΩ",
        "forward_voltage": "700mV",
        "reverse_voltage": "50V",
        "dcr": "1.5Ω",
        "saturation_current": "5A",
        "vce_sat": "300mV",

        # Physical
        "package": "lqfp100",
        "pins": "100",
        "pitch": "0.5mm",
        "operating_temperature": "-40 to 85°C",
        "awg": "24 AWG",

        # Material/Type
        "dielectric": "X7R",
        "mounting_type": "Surface Mount",
        "gender": "Male",
        "contact_material": "Gold Plated",
        "insulation": "PTFE",

        # Compliance
        "lifecycle_status": "Active",
        "rohs": "RoHS Compliant",
        "msl": "MSL 3",

        # Manufacturing
        "lead_time": "6-8 weeks",
        "moq": "1,000 pcs",
        "packaging": "Tape and Reel",

        # Optoelectronics
        "wavelength": "850nm",
        "luminous_intensity": "2cd",
        "color_temperature": "3000K",

        # MOSFET/Power
        "gate_charge": "50nC",
        "rds_on": "25mΩ",
        "switching_frequency": "500kHz",
        "efficiency": "92%",

        # Pricing
        "price": "$5.25 USD",
        "stock": "In Stock: 1,000+",
    }


@pytest.fixture
def sample_normalized_component_data() -> Dict[str, Any]:
    """Expected normalized output for sample_raw_component_data."""
    return {
        # Basic fields
        "mpn": "STM32F407VGT6",
        "manufacturer": "STMICROELECTRONICS",
        "description": "ARM Cortex-M4 32-bit MCU+FPU, 1MB Flash, 192KB RAM",

        # Basic electrical
        "voltage": 3.6,
        "current": 0.5,
        "power": 0.25,
        "resistance": 10000.0,
        "capacitance": 0.0001,

        # Extended electrical
        "tolerance": 5.0,
        "tempco": 50.0,
        "inductance": 0.00001,
        "esr": 0.05,
        "forward_voltage": 0.7,
        "reverse_voltage": 50.0,
        "dcr": 1.5,
        "saturation_current": 5.0,
        "vce_sat": 0.3,

        # Physical
        "package": "LQFP-100",
        "pins": 100,
        "pitch": 0.5,
        "operating_temperature": {"min": -40.0, "max": 85.0},
        "awg": 24,

        # Material/Type
        "dielectric": "X7R",
        "mounting_type": "smt",
        "gender": "male",
        "contact_material": "gold",
        "insulation": "ptfe",

        # Compliance
        "lifecycle_status": "active",
        "rohs": "compliant",
        "msl": 3,

        # Manufacturing
        "lead_time": 49,  # Average of 6-8 weeks in days
        "moq": 1000,
        "packaging": "tape_and_reel",

        # Optoelectronics
        "wavelength": 850.0,
        "luminous_intensity": 2000.0,
        "color_temperature": 3000.0,

        # MOSFET/Power
        "gate_charge": 50.0,
        "rds_on": 0.025,
        "switching_frequency": 500000.0,
        "efficiency": 92.0,

        # Pricing
        "price": 5.25,
        "stock": 1000,
    }


@pytest.fixture
def edge_case_values() -> List[Dict[str, Any]]:
    """Edge cases and boundary values for normalizer testing."""
    return [
        # Empty/null values
        {"input": None, "expected": None},
        {"input": "", "expected": None},
        {"input": "N/A", "expected": None},
        {"input": "TBD", "expected": None},

        # Whitespace
        {"input": "  10kΩ  ", "expected": 10000.0},
        {"input": "\t100µF\n", "expected": 0.0001},

        # Multiple formats
        {"input": "1K", "expected": 1000.0},
        {"input": "1k", "expected": 1000.0},
        {"input": "1 K", "expected": 1000.0},
        {"input": "1,000", "expected": 1000.0},

        # Boundary values
        {"input": "0", "expected": 0.0},
        {"input": "0.0", "expected": 0.0},
        {"input": "999999999", "expected": 999999999.0},
    ]


@pytest.fixture
def resistance_test_cases() -> List[Dict[str, Any]]:
    """Comprehensive test cases for resistance normalization."""
    return [
        # Standard units
        {"input": "1Ω", "expected": 1.0},
        {"input": "10Ω", "expected": 10.0},
        {"input": "100Ω", "expected": 100.0},
        {"input": "1kΩ", "expected": 1000.0},
        {"input": "10kΩ", "expected": 10000.0},
        {"input": "100kΩ", "expected": 100000.0},
        {"input": "1MΩ", "expected": 1000000.0},
        {"input": "10MΩ", "expected": 10000000.0},

        # Alternate notations
        {"input": "1 Ohm", "expected": 1.0},
        {"input": "1 ohms", "expected": 1.0},
        {"input": "1K", "expected": 1000.0},
        {"input": "1k", "expected": 1000.0},
        {"input": "1 K", "expected": 1000.0},
        {"input": "10K", "expected": 10000.0},

        # Fractional values
        {"input": "0.1Ω", "expected": 0.1},
        {"input": "0.5kΩ", "expected": 500.0},
        {"input": "2.2kΩ", "expected": 2200.0},
        {"input": "4.7MΩ", "expected": 4700000.0},

        # Milliohms
        {"input": "50mΩ", "expected": 0.05},
        {"input": "100mΩ", "expected": 0.1},
        {"input": "500 milliohms", "expected": 0.5},

        # Edge cases
        {"input": None, "expected": None},
        {"input": "", "expected": None},
        {"input": "invalid", "expected": None},
    ]


@pytest.fixture
def capacitance_test_cases() -> List[Dict[str, Any]]:
    """Comprehensive test cases for capacitance normalization."""
    return [
        # Standard units
        {"input": "1F", "expected": 1.0},
        {"input": "1mF", "expected": 0.001},
        {"input": "1µF", "expected": 0.000001},
        {"input": "1uF", "expected": 0.000001},
        {"input": "1nF", "expected": 1e-9},
        {"input": "1pF", "expected": 1e-12},

        # Common values
        {"input": "10µF", "expected": 0.00001},
        {"input": "100µF", "expected": 0.0001},
        {"input": "1000µF", "expected": 0.001},
        {"input": "10nF", "expected": 1e-8},
        {"input": "100nF", "expected": 1e-7},
        {"input": "100pF", "expected": 1e-10},

        # Alternate notations
        {"input": "1 uF", "expected": 0.000001},
        {"input": "10 microfarad", "expected": 0.00001},
        {"input": "100 nanofarad", "expected": 1e-7},

        # Fractional values
        {"input": "0.1µF", "expected": 1e-7},
        {"input": "4.7µF", "expected": 4.7e-6},
        {"input": "22µF", "expected": 2.2e-5},

        # Edge cases
        {"input": None, "expected": None},
        {"input": "", "expected": None},
        {"input": "invalid", "expected": None},
    ]


@pytest.fixture
def voltage_test_cases() -> List[Dict[str, Any]]:
    """Comprehensive test cases for voltage normalization."""
    return [
        # Standard units
        {"input": "1V", "expected": 1.0},
        {"input": "3.3V", "expected": 3.3},
        {"input": "5V", "expected": 5.0},
        {"input": "12V", "expected": 12.0},
        {"input": "24V", "expected": 24.0},

        # Kilovolts
        {"input": "1kV", "expected": 1000.0},
        {"input": "3.3kV", "expected": 3300.0},
        {"input": "10kV", "expected": 10000.0},

        # Millivolts
        {"input": "100mV", "expected": 0.1},
        {"input": "500mV", "expected": 0.5},
        {"input": "700mV", "expected": 0.7},

        # Alternate notations
        {"input": "1 Volt", "expected": 1.0},
        {"input": "5 volts", "expected": 5.0},
        {"input": "3.3 V", "expected": 3.3},

        # Edge cases
        {"input": None, "expected": None},
        {"input": "", "expected": None},
    ]


# ============================================================================
# QUALITY SCORING TEST FIXTURES
# ============================================================================

@pytest.fixture
def quality_test_components() -> List[Dict[str, Any]]:
    """Components with varying quality for quality scoring tests."""
    return [
        # High quality (95%+)
        {
            "mpn": "STM32F407VGT6",
            "manufacturer": "STMICROELECTRONICS",
            "category": "Microcontrollers",
            "voltage": 3.6,
            "current": 0.5,
            "package": "LQFP-100",
            "pins": 100,
            "operating_temperature": {"min": -40.0, "max": 85.0},
            "rohs": "compliant",
            "lifecycle_status": "active",
            "price": 5.25,
        },

        # Medium quality (70-94%)
        {
            "mpn": "UNKNOWN_PART",
            "manufacturer": "UNKNOWN_MFG",
            "category": "Resistors",
            "resistance": 10000.0,
            "tolerance": 5.0,
        },

        # Low quality (<70%)
        {
            "mpn": "unknown",
            "category": "Unknown",
        },
    ]


# ============================================================================
# API TEST FIXTURES
# ============================================================================

@pytest.fixture
def mock_supplier_response() -> Dict[str, Any]:
    """Mock supplier API response for testing."""
    return {
        "status": "success",
        "source": "mouser",
        "data": {
            "mpn": "STM32F407VGT6",
            "manufacturer": "STMicroelectronics",
            "description": "ARM Cortex-M4 32-bit MCU+FPU",
            "price": 5.25,
            "stock": 1000,
            "datasheet_url": "https://example.com/datasheet.pdf",
        },
        "confidence": 0.95,
    }


# ============================================================================
# HELPER FUNCTIONS FOR TESTS
# ============================================================================

def assert_normalized_value(actual: Any, expected: Any, tolerance: float = 1e-9):
    """Helper to compare normalized values with tolerance for floats."""
    if expected is None:
        assert actual is None
    elif isinstance(expected, float):
        assert actual is not None
        assert abs(actual - expected) < tolerance
    elif isinstance(expected, dict):
        assert isinstance(actual, dict)
        for key in expected:
            assert_normalized_value(actual[key], expected[key], tolerance)
    else:
        assert actual == expected
