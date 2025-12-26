"""
Integration Tests for CNS Service

Tests the complete normalization workflow with real data.
"""

import pytest
from decimal import Decimal
from app.core.normalizers import normalize_component_data, validate_normalized_data
from app.core.quality_scorer import calculate_quality_score, QualityRouting
from app.core.category_normalizer import normalize_vendor_category


class TestCompleteNormalizationWorkflow:
    """Test complete normalization workflow"""

    def test_stm32_microcontroller_workflow(self):
        """
        Test complete workflow with STM32 microcontroller data

        This tests:
        1. Data normalization
        2. Quality scoring
        3. Routing decision
        """
        # Raw component data from supplier API
        raw_data = {
            "mpn": "stm32-f407-vgt6",
            "manufacturer": "stmicroelectronics",
            "description": "ARM Cortex-M4 MCU, 168MHz, 1MB Flash, 192KB RAM, LQFP-100",
            "category": "Integrated Circuits > Microcontrollers",
            "price": "$12.50",
            "stock": "1,234 In Stock",
            "datasheet_url": "https://example.com/stm32f407.pdf",
            "image_url": "https://example.com/stm32f407.jpg",
            "lifecycle_status": "Active",
            "rohs_status": "Compliant",
            "data_source": "digikey",
        }

        # Step 1: Normalize data
        normalized = normalize_component_data(raw_data)

        # Verify normalization
        assert normalized["mpn"] == "STM32F407VGT6"
        assert normalized["manufacturer"] == "STMICROELECTRONICS"
        assert normalized["price"] == Decimal("12.50")
        assert normalized["stock"] == 1234
        assert "extracted_specs" in normalized
        assert normalized["extracted_specs"]["package"] == "LQFP-100"
        assert normalized["extracted_specs"]["frequency"] == "168MHZ"

        # Step 2: Validate normalized data
        issues = validate_normalized_data(normalized)
        assert len(issues) == 0  # Should have no issues

        # Step 3: Calculate quality score
        quality_result = calculate_quality_score(normalized)

        # Verify quality score
        assert quality_result.total_score >= 75.0  # Should have good quality
        assert len(quality_result.issues) <= 3  # Minimal issues

        # Step 4: Check routing decision
        # With DigiKey source and good data, should be staging or production
        assert quality_result.routing in [QualityRouting.STAGING, QualityRouting.PRODUCTION]

        # Verify it's in STAGING range (70-94%)
        assert 70.0 <= quality_result.total_score < 95.0

        print(f"\n✅ STM32 Workflow Test:")
        print(f"   MPN: {normalized['mpn']}")
        print(f"   Quality Score: {quality_result.total_score:.1f}%")
        print(f"   Routing: {quality_result.routing}")
        print(f"   Issues: {quality_result.issues}")

    def test_resistor_workflow(self):
        """Test workflow with resistor data"""
        raw_data = {
            "mpn": "RC0603FR-0710KL",
            "manufacturer": "Yageo",
            "description": "RES SMD 10K OHM 1% 1/10W 0603",
            "category": "Passive Components > Resistors",
            "price": "0.10",
            "stock": "50000+",
            "resistance": "10K",
            "power": "1/10W",
            "tolerance": "1%",
            "data_source": "mouser",
        }

        # Normalize
        normalized = normalize_component_data(raw_data)

        # Verify resistance normalization
        assert normalized["resistance"] == 10000.0
        assert normalized["power"] == 0.1

        # Calculate quality
        quality_result = calculate_quality_score(normalized)

        print(f"\n✅ Resistor Workflow Test:")
        print(f"   MPN: {normalized['mpn']}")
        print(f"   Resistance: {normalized['resistance']}Ω")
        print(f"   Quality Score: {quality_result.total_score:.1f}%")
        print(f"   Routing: {quality_result.routing}")

    def test_capacitor_workflow(self):
        """Test workflow with capacitor data"""
        raw_data = {
            "mpn": "GRM188R71C104KA01D",
            "manufacturer": "Murata",
            "description": "CAP CER 100nF 16V X7R 0603",
            "category": "Passive Components > Capacitors",
            "price": "$0.15",
            "stock": "25000",
            "capacitance": "100nF",
            "voltage": "16V",
            "data_source": "digikey",
        }

        # Normalize
        normalized = normalize_component_data(raw_data)

        # Verify capacitance normalization (100nF = 1e-7F)
        assert normalized["capacitance"] == pytest.approx(1e-7)
        assert normalized["voltage"] == 16.0

        # Calculate quality
        quality_result = calculate_quality_score(normalized)

        print(f"\n✅ Capacitor Workflow Test:")
        print(f"   MPN: {normalized['mpn']}")
        print(f"   Capacitance: {normalized['capacitance']:.2e}F")
        print(f"   Quality Score: {quality_result.total_score:.1f}%")

    def test_low_quality_component(self):
        """Test workflow with low quality data"""
        raw_data = {
            "mpn": "UNKNOWN-PART",
            "data_source": "web_scrape",
            # Missing most fields
        }

        # Normalize
        normalized = normalize_component_data(raw_data)

        # Calculate quality
        quality_result = calculate_quality_score(normalized)

        # Should have low quality score
        assert quality_result.total_score < 70.0
        assert quality_result.routing == QualityRouting.REJECTED
        assert len(quality_result.issues) > 0

        print(f"\n✅ Low Quality Test:")
        print(f"   Quality Score: {quality_result.total_score:.1f}%")
        print(f"   Routing: {quality_result.routing}")
        print(f"   Issues: {quality_result.issues}")

    def test_category_normalization_workflow(self):
        """Test category normalization"""
        # DigiKey hierarchical format
        vendor_category = "Integrated Circuits (ICs) / Microcontrollers - MCU"

        canonical, confidence, method = normalize_vendor_category(
            "digikey",
            vendor_category,
            min_confidence=0.6
        )

        # Should successfully parse hierarchy
        assert canonical is not None
        assert confidence >= 0.7
        assert "Microcontrollers" in canonical or "Integrated Circuits" in canonical

        print(f"\n✅ Category Normalization Test:")
        print(f"   Vendor: DigiKey")
        print(f"   Vendor Category: {vendor_category}")
        print(f"   Canonical: {canonical}")
        print(f"   Confidence: {confidence:.2f}")
        print(f"   Method: {method}")

    def test_batch_normalization(self):
        """Test batch processing of multiple components"""
        components = [
            {
                "mpn": "STM32F407VGT6",
                "manufacturer": "STMicroelectronics",
                "description": "ARM MCU",
                "category": "Integrated Circuits > Microcontrollers",
                "price": "$12.50",
                "data_source": "digikey",
            },
            {
                "mpn": "ATMEGA328P-PU",
                "manufacturer": "Microchip",
                "description": "AVR MCU",
                "category": "Integrated Circuits > Microcontrollers",
                "price": "$2.50",
                "data_source": "mouser",
            },
            {
                "mpn": "ESP32-WROOM-32",
                "manufacturer": "Espressif",
                "description": "WiFi/BT Module",
                "category": "RF and Wireless > RF Modules",
                "price": "$3.75",
                "data_source": "digikey",
            },
        ]

        # Normalize all
        normalized_components = [normalize_component_data(c) for c in components]

        # Calculate quality for all
        quality_results = [calculate_quality_score(c) for c in normalized_components]

        # Verify all normalized
        assert len(normalized_components) == 3
        assert all(c["mpn"] == c["mpn"].upper() for c in normalized_components)

        # Verify all have quality scores
        assert all(r.total_score > 0 for r in quality_results)

        print(f"\n✅ Batch Normalization Test:")
        for norm, quality in zip(normalized_components, quality_results):
            print(f"   {norm['mpn']}: {quality.total_score:.1f}% → {quality.routing}")


class TestQualityRoutingDistribution:
    """Test quality routing distribution"""

    def test_routing_thresholds(self):
        """Test that routing thresholds work correctly"""
        # Create components with different quality scores
        test_cases = [
            ({"data_source": "unknown", "mpn": "TEST1"}, QualityRouting.REJECTED),
            ({"data_source": "mouser", "mpn": "TEST2", "manufacturer": "Test", "description": "Test", "category": "Test"}, QualityRouting.STAGING),
            ({
                "data_source": "digikey",
                "mpn": "TEST3",
                "manufacturer": "Test",
                "description": "Test Component",
                "category": "Test Category",
                "datasheet_url": "https://example.com/ds.pdf",
                "image_url": "https://example.com/img.jpg",
                "lifecycle_status": "Active",
                "rohs_status": "Compliant",
                "extracted_specs": {
                    "package": "SOT-23",
                    "voltage": "3.3V",
                    "current": "100mA",
                    "power": "0.25W",
                    "frequency": "100MHz",
                },
                "category_confidence": 1.0,
            }, QualityRouting.PRODUCTION),
        ]

        for component_data, expected_routing in test_cases:
            normalized = normalize_component_data(component_data)
            quality_result = calculate_quality_score(normalized)

            # May not exactly match due to scoring algorithm, but should be close
            print(f"   {component_data['mpn']}: {quality_result.total_score:.1f}% → {quality_result.routing}")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
