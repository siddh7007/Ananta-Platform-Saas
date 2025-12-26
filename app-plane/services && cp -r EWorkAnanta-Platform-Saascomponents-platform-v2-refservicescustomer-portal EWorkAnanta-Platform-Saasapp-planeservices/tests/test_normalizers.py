"""
Test suite for normalization functions

Tests all 52 normalization functions to ensure they work correctly.
Expanded to cover all parameters from V2 expansion.
"""

import pytest
from decimal import Decimal
from app.core.normalizers import (
    # Basic fields
    normalize_mpn,
    normalize_price,
    normalize_quantity,
    # Basic electrical
    normalize_resistance,
    normalize_capacitance,
    normalize_voltage,
    normalize_current,
    normalize_power,
    # Extended electrical
    normalize_tolerance,
    normalize_temperature_coefficient,
    normalize_inductance,
    normalize_esr,
    normalize_forward_voltage,
    normalize_reverse_voltage,
    normalize_dcr,
    normalize_saturation_current,
    normalize_vce_sat,
    # Physical
    normalize_pin_count,
    normalize_pitch,
    normalize_awg,
    normalize_package_type,
    normalize_operating_temperature,
    # Material/Type
    normalize_dielectric_type,
    normalize_mounting_type,
    normalize_gender,
    normalize_contact_material,
    normalize_insulation_material,
    normalize_conductor_count,
    normalize_conductor_material,
    # Compliance
    normalize_lifecycle_status,
    normalize_rohs_status,
    normalize_msl,
    # Manufacturing
    normalize_lead_time,
    normalize_moq,
    normalize_packaging_type,
    # Optoelectronics
    normalize_wavelength,
    normalize_luminous_intensity,
    normalize_color_temperature,
    # Transistor/MOSFET
    normalize_gate_charge,
    normalize_rds_on,
    normalize_switching_frequency,
    # Power Supply
    normalize_efficiency,
    # Batch
    extract_specs_from_description,
    normalize_component_data,
    validate_normalized_data,
)


class TestMPNNormalization:
    """Test MPN normalization"""

    def test_uppercase_conversion(self):
        assert normalize_mpn("stm32f407vgt6") == "STM32F407VGT6"

    def test_space_removal(self):
        assert normalize_mpn("LM 317") == "LM317"

    def test_dash_removal(self):
        assert normalize_mpn("stm32-f407-vgt6") == "STM32F407VGT6"

    def test_slash_preservation(self):
        assert normalize_mpn("TI/LM317T") == "TI/LM317T"

    def test_empty_input(self):
        assert normalize_mpn(None) == ""
        assert normalize_mpn("") == ""

    def test_already_normalized(self):
        assert normalize_mpn("STM32F407VGT6") == "STM32F407VGT6"


class TestPriceNormalization:
    """Test price normalization"""

    def test_dollar_sign_removal(self):
        assert normalize_price("$12.34") == Decimal("12.34")

    def test_comma_removal(self):
        assert normalize_price("£1,234.56") == Decimal("1234.56")

    def test_euro_symbol(self):
        assert normalize_price("€99.99") == Decimal("99.99")

    def test_range_format(self):
        # Should take first value
        assert normalize_price("$10 - $20") == Decimal("10")

    def test_plain_number(self):
        assert normalize_price("100") == Decimal("100")

    def test_float_input(self):
        assert normalize_price(12.34) == Decimal("12.34")

    def test_decimal_input(self):
        assert normalize_price(Decimal("12.34")) == Decimal("12.34")

    def test_empty_input(self):
        assert normalize_price(None) is None
        assert normalize_price("") is None

    def test_invalid_input(self):
        assert normalize_price("N/A") is None


class TestQuantityNormalization:
    """Test quantity normalization"""

    def test_comma_removal(self):
        assert normalize_quantity("1,234 In Stock") == 1234

    def test_plus_sign(self):
        assert normalize_quantity("5000+") == 5000

    def test_plain_number(self):
        assert normalize_quantity("100") == 100

    def test_int_input(self):
        assert normalize_quantity(100) == 100

    def test_empty_input(self):
        assert normalize_quantity(None) is None
        assert normalize_quantity("") is None

    def test_text_removal(self):
        assert normalize_quantity("Available: 500 units") == 500


class TestResistanceNormalization:
    """Test resistance normalization"""

    def test_kilo_ohm(self):
        assert normalize_resistance("10K") == 10000.0

    def test_mega_ohm(self):
        assert normalize_resistance("1.5M") == 1500000.0

    def test_plain_ohm(self):
        assert normalize_resistance("470 ohm") == 470.0

    def test_omega_symbol(self):
        assert normalize_resistance("100Ω") == 100.0

    def test_empty_input(self):
        assert normalize_resistance(None) is None

    def test_lowercase(self):
        assert normalize_resistance("10k") == 10000.0


class TestCapacitanceNormalization:
    """Test capacitance normalization"""

    def test_picofarad(self):
        assert normalize_capacitance("100pF") == pytest.approx(1e-10)

    def test_nanofarad(self):
        assert normalize_capacitance("10nF") == pytest.approx(1e-8)

    def test_microfarad(self):
        assert normalize_capacitance("100uF") == pytest.approx(1e-4)

    def test_micro_symbol(self):
        assert normalize_capacitance("1000µF") == pytest.approx(1e-3)

    def test_empty_input(self):
        assert normalize_capacitance(None) is None


class TestVoltageNormalization:
    """Test voltage normalization"""

    def test_volts(self):
        assert normalize_voltage("3.3V") == 3.3

    def test_millivolts(self):
        assert normalize_voltage("5000mV") == 5.0

    def test_kilovolts(self):
        assert normalize_voltage("1.2kV") == 1200.0

    def test_empty_input(self):
        assert normalize_voltage(None) is None


class TestCurrentNormalization:
    """Test current normalization"""

    def test_milliamps(self):
        assert normalize_current("100mA") == 0.1

    def test_microamps(self):
        assert normalize_current("500uA") == 0.0005

    def test_amps(self):
        assert normalize_current("2A") == 2.0

    def test_empty_input(self):
        assert normalize_current(None) is None


class TestPowerNormalization:
    """Test power normalization"""

    def test_milliwatts(self):
        assert normalize_power("100mW") == 0.1

    def test_watts(self):
        assert normalize_power("5W") == 5.0

    def test_kilowatts(self):
        assert normalize_power("1.5kW") == 1500.0

    def test_fraction_format(self):
        assert normalize_power("1/4W") == 0.25

    def test_empty_input(self):
        assert normalize_power(None) is None


class TestSpecExtraction:
    """Test specification extraction from descriptions"""

    def test_extract_package(self):
        desc = "STM32F407VGT6 ARM Cortex-M4 MCU in LQFP-100 package"
        specs = extract_specs_from_description(desc)
        assert specs["package"] == "LQFP-100"

    def test_extract_memory(self):
        desc = "MCU with 1MB Flash and 192KB RAM"
        specs = extract_specs_from_description(desc)
        assert specs["flash_size"] == "1MB"

    def test_extract_frequency(self):
        desc = "168MHz ARM Cortex-M4"
        specs = extract_specs_from_description(desc)
        assert specs["frequency"] == "168MHZ"

    def test_extract_temp_range(self):
        desc = "Operating temperature: -40 to 85°C"
        specs = extract_specs_from_description(desc)
        assert specs["temp_range"] == "-40C to 85C"

    def test_empty_description(self):
        specs = extract_specs_from_description(None)
        assert specs == {}


class TestComponentDataNormalization:
    """Test full component data normalization"""

    def test_normalize_complete_component(self):
        component = {
            "mpn": "stm32-f407-vgt6",
            "manufacturer": "stmicroelectronics",
            "price": "$12.50",
            "stock": "1,000 In Stock",
            "description": "ARM MCU 168MHz LQFP-100",
            "resistance": "10K",
        }

        normalized = normalize_component_data(component)

        assert normalized["mpn"] == "STM32F407VGT6"
        assert normalized["manufacturer"] == "STMICROELECTRONICS"
        assert normalized["price"] == Decimal("12.50")
        assert normalized["stock"] == 1000
        assert "extracted_specs" in normalized
        assert normalized["resistance"] == 10000.0

    def test_preserve_original_mpn(self):
        component = {"mpn": "stm32-f407-vgt6"}
        normalized = normalize_component_data(component)

        # Both original and normalized should be present
        assert "mpn" in normalized
        assert "mpn_normalized" in normalized
        assert normalized["mpn_normalized"] == "STM32F407VGT6"


class TestValidation:
    """Test data validation"""

    def test_valid_data(self):
        data = {
            "mpn": "STM32F407VGT6",
            "price": Decimal("12.50"),
            "stock": 1000,
        }
        issues = validate_normalized_data(data)
        assert len(issues) == 0

    def test_missing_mpn(self):
        data = {"price": Decimal("12.50")}
        issues = validate_normalized_data(data)
        assert "Missing required field: mpn" in issues

    def test_invalid_price(self):
        data = {
            "mpn": "STM32F407VGT6",
            "price": Decimal("-10.00")
        }
        issues = validate_normalized_data(data)
        assert any("Invalid price" in issue for issue in issues)

    def test_invalid_stock(self):
        data = {
            "mpn": "STM32F407VGT6",
            "stock": -100
        }
        issues = validate_normalized_data(data)
        assert any("Invalid stock" in issue for issue in issues)


# ============================================================================
# EXTENDED ELECTRICAL NORMALIZERS (NEW TESTS)
# ============================================================================

class TestToleranceNormalization:
    """Test tolerance normalization"""

    def test_with_plus_minus(self):
        assert normalize_tolerance("±5%") == 5.0
        assert normalize_tolerance("±10%") == 10.0
        assert normalize_tolerance("±1%") == 1.0

    def test_without_plus_minus(self):
        assert normalize_tolerance("5%") == 5.0
        assert normalize_tolerance("10%") == 10.0

    def test_fractional(self):
        assert normalize_tolerance("±0.5%") == 0.5
        assert normalize_tolerance("±0.1%") == 0.1

    def test_empty_input(self):
        assert normalize_tolerance(None) is None
        assert normalize_tolerance("") is None


class TestTemperatureCoefficientNormalization:
    """Test temperature coefficient normalization"""

    def test_ppm_per_celsius(self):
        assert normalize_temperature_coefficient("±50ppm/°C") == 50.0
        assert normalize_temperature_coefficient("±100ppm/°C") == 100.0
        assert normalize_temperature_coefficient("±15ppm/°C") == 15.0

    def test_without_plus_minus(self):
        assert normalize_temperature_coefficient("50ppm/°C") == 50.0
        assert normalize_temperature_coefficient("100ppm/C") == 100.0

    def test_empty_input(self):
        assert normalize_temperature_coefficient(None) is None


class TestInductanceNormalization:
    """Test inductance normalization"""

    def test_henries(self):
        assert normalize_inductance("1H") == 1.0
        assert normalize_inductance("10H") == 10.0

    def test_millihenries(self):
        assert normalize_inductance("1mH") == 0.001
        assert normalize_inductance("10mH") == 0.01
        assert normalize_inductance("100mH") == 0.1

    def test_microhenries(self):
        assert normalize_inductance("1µH") == pytest.approx(1e-6)
        assert normalize_inductance("10µH") == pytest.approx(1e-5)
        assert normalize_inductance("100µH") == pytest.approx(1e-4)
        assert normalize_inductance("10uH") == pytest.approx(1e-5)

    def test_nanohenries(self):
        assert normalize_inductance("1nH") == pytest.approx(1e-9)
        assert normalize_inductance("10nH") == pytest.approx(1e-8)

    def test_empty_input(self):
        assert normalize_inductance(None) is None


class TestESRNormalization:
    """Test ESR (Equivalent Series Resistance) normalization"""

    def test_milliohms(self):
        assert normalize_esr("50mΩ") == 0.05
        assert normalize_esr("100mΩ") == 0.1

    def test_ohms(self):
        assert normalize_esr("1Ω") == 1.0
        assert normalize_esr("10Ω") == 10.0

    def test_empty_input(self):
        assert normalize_esr(None) is None


class TestForwardVoltageNormalization:
    """Test forward voltage (Vf) normalization"""

    def test_volts(self):
        assert normalize_forward_voltage("0.7V") == pytest.approx(0.7)
        assert normalize_forward_voltage("1.2V") == pytest.approx(1.2)

    def test_millivolts(self):
        assert normalize_forward_voltage("700mV") == pytest.approx(0.7)
        assert normalize_forward_voltage("1200mV") == pytest.approx(1.2)

    def test_empty_input(self):
        assert normalize_forward_voltage(None) is None


class TestReverseVoltageNormalization:
    """Test reverse voltage (Vr) normalization"""

    def test_volts(self):
        assert normalize_reverse_voltage("50V") == 50.0
        assert normalize_reverse_voltage("100V") == 100.0

    def test_empty_input(self):
        assert normalize_reverse_voltage(None) is None


class TestDCRNormalization:
    """Test DCR (DC Resistance) normalization"""

    def test_ohms(self):
        assert normalize_dcr("1.5Ω") == 1.5
        assert normalize_dcr("10Ω") == 10.0

    def test_milliohms(self):
        assert normalize_dcr("500mΩ") == 0.5

    def test_empty_input(self):
        assert normalize_dcr(None) is None


class TestSaturationCurrentNormalization:
    """Test saturation current (Isat) normalization"""

    def test_amperes(self):
        assert normalize_saturation_current("5A") == 5.0
        assert normalize_saturation_current("10A") == 10.0

    def test_milliamperes(self):
        assert normalize_saturation_current("500mA") == 0.5

    def test_empty_input(self):
        assert normalize_saturation_current(None) is None


class TestVCESatNormalization:
    """Test VCE saturation normalization"""

    def test_volts(self):
        assert normalize_vce_sat("0.3V") == 0.3

    def test_millivolts(self):
        assert normalize_vce_sat("300mV") == 0.3

    def test_empty_input(self):
        assert normalize_vce_sat(None) is None


# ============================================================================
# PHYSICAL NORMALIZERS (NEW TESTS)
# ============================================================================

class TestPinCountNormalization:
    """Test pin count normalization"""

    def test_numeric_only(self):
        assert normalize_pin_count("8") == 8
        assert normalize_pin_count("16") == 16
        assert normalize_pin_count("100") == 100

    def test_with_text(self):
        assert normalize_pin_count("8 Pins") == 8
        assert normalize_pin_count("16 pins") == 16
        assert normalize_pin_count("24-Pin") == 24
        assert normalize_pin_count("100 positions") == 100

    def test_empty_input(self):
        assert normalize_pin_count(None) is None
        assert normalize_pin_count("") is None


class TestPitchNormalization:
    """Test pitch normalization"""

    def test_millimeters(self):
        assert normalize_pitch("0.5mm") == 0.5
        assert normalize_pitch("1.0mm") == 1.0
        assert normalize_pitch("2.54mm") == 2.54

    def test_inches_to_mm(self):
        # 0.1 inch = 2.54mm
        result = normalize_pitch("0.1\"")
        assert result == pytest.approx(2.54, abs=0.01)

    def test_empty_input(self):
        assert normalize_pitch(None) is None


class TestAWGNormalization:
    """Test AWG (wire gauge) normalization"""

    def test_awg_numbers(self):
        assert normalize_awg("24 AWG") == 24
        assert normalize_awg("22 AWG") == 22
        assert normalize_awg("18 AWG") == 18
        assert normalize_awg("AWG 24") == 24

    def test_just_number(self):
        assert normalize_awg("24") == 24
        assert normalize_awg("22") == 22

    def test_empty_input(self):
        assert normalize_awg(None) is None


class TestPackageTypeNormalization:
    """Test package type normalization"""

    def test_standard_packages(self):
        assert normalize_package_type("sot-23") == "SOT-23"
        assert normalize_package_type("SOT23") == "SOT-23"
        assert normalize_package_type("dip-8") == "DIP-8"
        assert normalize_package_type("DIP8") == "DIP-8"
        assert normalize_package_type("lqfp100") == "LQFP-100"

    def test_case_insensitive(self):
        assert normalize_package_type("sot-23") == "SOT-23"
        assert normalize_package_type("SOT-23") == "SOT-23"

    def test_empty_input(self):
        assert normalize_package_type(None) is None


class TestOperatingTemperatureNormalization:
    """Test operating temperature normalization"""

    def test_celsius_range(self):
        result = normalize_operating_temperature("-40 to 85°C")
        assert result == {"min": -40.0, "max": 85.0}

        result = normalize_operating_temperature("-55 to 125°C")
        assert result == {"min": -55.0, "max": 125.0}

    def test_alternate_formats(self):
        result = normalize_operating_temperature("-40°C to +85°C")
        assert result == {"min": -40.0, "max": 85.0}

    def test_empty_input(self):
        assert normalize_operating_temperature(None) is None


# ============================================================================
# MATERIAL/TYPE NORMALIZERS (NEW TESTS)
# ============================================================================

class TestDielectricTypeNormalization:
    """Test dielectric type normalization"""

    def test_standard_types(self):
        assert normalize_dielectric_type("c0g") == "C0G"
        assert normalize_dielectric_type("x7r") == "X7R"
        assert normalize_dielectric_type("y5v") == "Y5V"

    def test_case_insensitive(self):
        assert normalize_dielectric_type("C0G") == "C0G"
        assert normalize_dielectric_type("X7R") == "X7R"

    def test_empty_input(self):
        assert normalize_dielectric_type(None) is None


class TestMountingTypeNormalization:
    """Test mounting type normalization"""

    def test_surface_mount(self):
        assert normalize_mounting_type("Surface Mount") == "smt"
        assert normalize_mounting_type("SMT") == "smt"
        assert normalize_mounting_type("SMD") == "smt"

    def test_through_hole(self):
        assert normalize_mounting_type("Through Hole") == "through_hole"
        assert normalize_mounting_type("THT") == "through_hole"

    def test_other_types(self):
        assert normalize_mounting_type("Chassis Mount") == "chassis"

    def test_empty_input(self):
        assert normalize_mounting_type(None) is None


class TestGenderNormalization:
    """Test gender normalization"""

    def test_male(self):
        assert normalize_gender("Male") == "male"
        assert normalize_gender("Plug") == "male"
        assert normalize_gender("Pin") == "male"

    def test_female(self):
        assert normalize_gender("Female") == "female"
        assert normalize_gender("Receptacle") == "female"
        assert normalize_gender("Socket") == "female"

    def test_empty_input(self):
        assert normalize_gender(None) is None


class TestContactMaterialNormalization:
    """Test contact material normalization"""

    def test_materials(self):
        assert normalize_contact_material("Gold Plated") == "gold"
        assert normalize_contact_material("Tin") == "tin"
        assert normalize_contact_material("Silver") == "silver"

    def test_empty_input(self):
        assert normalize_contact_material(None) is None


class TestInsulationMaterialNormalization:
    """Test insulation material normalization"""

    def test_materials(self):
        assert normalize_insulation_material("PTFE") == "ptfe"
        assert normalize_insulation_material("Teflon") == "ptfe"
        assert normalize_insulation_material("PVC") == "pvc"

    def test_empty_input(self):
        assert normalize_insulation_material(None) is None


class TestConductorCountNormalization:
    """Test conductor count normalization"""

    def test_numeric(self):
        assert normalize_conductor_count("2") == 2
        assert normalize_conductor_count("4") == 4

    def test_with_text(self):
        assert normalize_conductor_count("2 conductor") == 2
        assert normalize_conductor_count("4-conductor") == 4

    def test_empty_input(self):
        assert normalize_conductor_count(None) is None


class TestConductorMaterialNormalization:
    """Test conductor material normalization"""

    def test_materials(self):
        assert normalize_conductor_material("Copper") == "copper"
        assert normalize_conductor_material("Tinned Copper") == "tinned_copper"
        assert normalize_conductor_material("Aluminum") == "aluminum"

    def test_empty_input(self):
        assert normalize_conductor_material(None) is None


# ============================================================================
# COMPLIANCE NORMALIZERS (NEW TESTS)
# ============================================================================

class TestLifecycleStatusNormalization:
    """Test lifecycle status normalization"""

    def test_active(self):
        assert normalize_lifecycle_status("Active") == "active"
        assert normalize_lifecycle_status("In Production") == "active"

    def test_nrnd(self):
        assert normalize_lifecycle_status("Not Recommended for New Designs") == "nrnd"
        assert normalize_lifecycle_status("NRND") == "nrnd"

    def test_obsolete(self):
        assert normalize_lifecycle_status("Obsolete") == "obsolete"
        assert normalize_lifecycle_status("Discontinued") == "obsolete"

    def test_empty_input(self):
        assert normalize_lifecycle_status(None) is None


class TestRoHSStatusNormalization:
    """Test RoHS status normalization"""

    def test_compliant(self):
        assert normalize_rohs_status("RoHS Compliant") == "compliant"
        assert normalize_rohs_status("Compliant") == "compliant"
        assert normalize_rohs_status("Yes") == "compliant"

    def test_non_compliant(self):
        assert normalize_rohs_status("Non-Compliant") == "non_compliant"
        assert normalize_rohs_status("No") == "non_compliant"

    def test_empty_input(self):
        assert normalize_rohs_status(None) is None


class TestMSLNormalization:
    """Test MSL (Moisture Sensitivity Level) normalization"""

    def test_msl_levels(self):
        assert normalize_msl("MSL 1") == 1
        assert normalize_msl("MSL 2") == 2
        assert normalize_msl("MSL 3") == 3
        assert normalize_msl("MSL 6") == 6

    def test_just_number(self):
        assert normalize_msl("1") == 1
        assert normalize_msl("3") == 3

    def test_empty_input(self):
        assert normalize_msl(None) is None


# ============================================================================
# MANUFACTURING NORMALIZERS (NEW TESTS)
# ============================================================================

class TestLeadTimeNormalization:
    """Test lead time normalization"""

    def test_weeks_to_days(self):
        assert normalize_lead_time("6 weeks") == 42
        assert normalize_lead_time("8 weeks") == 56

    def test_weeks_range(self):
        # Should take average
        assert normalize_lead_time("6-8 weeks") == 49

    def test_days(self):
        assert normalize_lead_time("30 days") == 30

    def test_in_stock(self):
        assert normalize_lead_time("In Stock") == 0
        assert normalize_lead_time("Stock") == 0

    def test_empty_input(self):
        assert normalize_lead_time(None) is None


class TestMOQNormalization:
    """Test MOQ (Minimum Order Quantity) normalization"""

    def test_simple_numbers(self):
        assert normalize_moq("100") == 100
        assert normalize_moq("1000") == 1000

    def test_with_commas(self):
        assert normalize_moq("1,000") == 1000
        assert normalize_moq("10,000") == 10000

    def test_with_text(self):
        assert normalize_moq("1,000 pcs") == 1000
        assert normalize_moq("MOQ: 500") == 500

    def test_empty_input(self):
        assert normalize_moq(None) is None


class TestPackagingTypeNormalization:
    """Test packaging type normalization"""

    def test_tape_and_reel(self):
        assert normalize_packaging_type("Tape and Reel") == "tape_and_reel"
        assert normalize_packaging_type("T&R") == "tape_and_reel"

    def test_other_types(self):
        assert normalize_packaging_type("Cut Tape") == "cut_tape"
        assert normalize_packaging_type("Tray") == "tray"
        assert normalize_packaging_type("Tube") == "tube"

    def test_empty_input(self):
        assert normalize_packaging_type(None) is None


# ============================================================================
# OPTOELECTRONICS NORMALIZERS (NEW TESTS)
# ============================================================================

class TestWavelengthNormalization:
    """Test wavelength normalization"""

    def test_nanometers(self):
        assert normalize_wavelength("850nm") == 850.0
        assert normalize_wavelength("1550nm") == 1550.0

    def test_micrometers_to_nm(self):
        assert normalize_wavelength("1.55µm") == 1550.0

    def test_empty_input(self):
        assert normalize_wavelength(None) is None


class TestLuminousIntensityNormalization:
    """Test luminous intensity normalization"""

    def test_millicandelas(self):
        assert normalize_luminous_intensity("100mcd") == 100.0
        assert normalize_luminous_intensity("5000mcd") == 5000.0

    def test_candelas_to_mcd(self):
        assert normalize_luminous_intensity("2cd") == 2000.0

    def test_empty_input(self):
        assert normalize_luminous_intensity(None) is None


class TestColorTemperatureNormalization:
    """Test color temperature normalization"""

    def test_kelvin(self):
        assert normalize_color_temperature("3000K") == 3000.0
        assert normalize_color_temperature("6500K") == 6500.0

    def test_empty_input(self):
        assert normalize_color_temperature(None) is None


# ============================================================================
# TRANSISTOR/MOSFET NORMALIZERS (NEW TESTS)
# ============================================================================

class TestGateChargeNormalization:
    """Test gate charge (Qg) normalization"""

    def test_nanocoulombs(self):
        assert normalize_gate_charge("50nC") == 50.0
        assert normalize_gate_charge("100nC") == 100.0

    def test_empty_input(self):
        assert normalize_gate_charge(None) is None


class TestRDSOnNormalization:
    """Test RDS(on) normalization"""

    def test_milliohms(self):
        assert normalize_rds_on("25mΩ") == 0.025
        assert normalize_rds_on("50mΩ") == 0.05

    def test_ohms(self):
        assert normalize_rds_on("0.025Ω") == 0.025

    def test_empty_input(self):
        assert normalize_rds_on(None) is None


class TestSwitchingFrequencyNormalization:
    """Test switching frequency normalization"""

    def test_hertz(self):
        assert normalize_switching_frequency("1000Hz") == 1000.0

    def test_kilohertz(self):
        assert normalize_switching_frequency("500kHz") == 500000.0

    def test_megahertz(self):
        assert normalize_switching_frequency("1MHz") == 1000000.0

    def test_empty_input(self):
        assert normalize_switching_frequency(None) is None


# ============================================================================
# POWER SUPPLY NORMALIZERS (NEW TESTS)
# ============================================================================

class TestEfficiencyNormalization:
    """Test efficiency normalization"""

    def test_percentage(self):
        assert normalize_efficiency("92%") == 92.0
        assert normalize_efficiency("85%") == 85.0

    def test_ratio_to_percentage(self):
        assert normalize_efficiency("0.92") == 92.0
        assert normalize_efficiency("0.85") == 85.0

    def test_empty_input(self):
        assert normalize_efficiency(None) is None
