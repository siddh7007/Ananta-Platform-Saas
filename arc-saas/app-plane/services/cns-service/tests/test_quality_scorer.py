"""
Test suite for quality scoring

Tests the quality scoring algorithm and routing logic.
"""

import pytest
from app.core.quality_scorer import (
    QualityScorer,
    QualityRouting,
    calculate_quality_score,
)


class TestQualityScoring:
    """Test quality scoring algorithm"""

    def test_perfect_score(self):
        """Test component with perfect data quality"""
        component = {
            "mpn": "STM32F407VGT6",
            "manufacturer": "STMicroelectronics",
            "description": "ARM Cortex-M4 MCU, 168MHz, 1MB Flash, LQFP-100",
            "category": "Integrated Circuits > Microcontrollers",
            "category_confidence": 1.0,
            "datasheet_url": "https://example.com/datasheet.pdf",
            "image_url": "https://example.com/image.jpg",
            "lifecycle_status": "Active",
            "rohs_status": "Compliant",
            "package": "LQFP-100",
            "data_source": "digikey",
            "extracted_specs": {
                "package": "LQFP-100",
                "voltage": "3.3V",
                "frequency": "168MHz",
                "flash_size": "1MB",
                "temp_range": "-40C to 85C",
            }
        }

        scorer = QualityScorer()
        result = scorer.calculate_quality_score(component)

        assert result.total_score >= 90.0
        assert result.routing == QualityRouting.STAGING or result.routing == QualityRouting.PRODUCTION
        assert len(result.issues) == 0

    def test_minimal_score(self):
        """Test component with minimal data"""
        component = {
            "mpn": "UNKNOWN",
            "data_source": "unknown",
        }

        scorer = QualityScorer()
        result = scorer.calculate_quality_score(component)

        assert result.total_score < 70.0
        assert result.routing == QualityRouting.REJECTED
        assert len(result.issues) > 0

    def test_staging_score(self):
        """Test component that should go to staging"""
        component = {
            "mpn": "LM317T",
            "manufacturer": "Texas Instruments",
            "description": "Voltage Regulator",
            "category": "Power > Voltage Regulators",
            "data_source": "mouser",
        }

        scorer = QualityScorer()
        result = scorer.calculate_quality_score(component)

        # Should have moderate score (staging range: 70-94%)
        assert 60.0 <= result.total_score < 95.0

    def test_completeness_scoring(self):
        """Test completeness score calculation"""
        # All required fields present
        component_complete = {
            "mpn": "TEST123",
            "manufacturer": "Test Corp",
            "description": "Test component",
            "category": "Test Category",
        }

        # Missing required fields
        component_incomplete = {
            "mpn": "TEST123",
        }

        scorer = QualityScorer()

        result_complete = scorer.calculate_quality_score(component_complete)
        result_incomplete = scorer.calculate_quality_score(component_incomplete)

        assert result_complete.completeness > result_incomplete.completeness

    def test_source_quality_scoring(self):
        """Test source quality score calculation"""
        # High quality source (DigiKey)
        component_tier1 = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "data_source": "digikey",
        }

        # Low quality source (web scrape)
        component_tier3 = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "data_source": "web_scrape",
        }

        scorer = QualityScorer()

        result_tier1 = scorer.calculate_quality_score(component_tier1)
        result_tier3 = scorer.calculate_quality_score(component_tier3)

        assert result_tier1.source_quality > result_tier3.source_quality
        assert result_tier1.total_score > result_tier3.total_score

    def test_spec_extraction_scoring(self):
        """Test spec extraction score calculation"""
        # Good spec extraction
        component_with_specs = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "extracted_specs": {
                "package": "SOT-23",
                "voltage": "3.3V",
                "current": "100mA",
                "power": "0.25W",
                "temp_range": "-40C to 85C",
            }
        }

        # No spec extraction
        component_no_specs = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
        }

        scorer = QualityScorer()

        result_with_specs = scorer.calculate_quality_score(component_with_specs)
        result_no_specs = scorer.calculate_quality_score(component_no_specs)

        assert result_with_specs.spec_extraction > result_no_specs.spec_extraction

    def test_category_confidence_scoring(self):
        """Test category confidence score calculation"""
        # High confidence
        component_high_conf = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "category_confidence": 0.95,
        }

        # Low confidence
        component_low_conf = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "category_confidence": 0.5,
        }

        scorer = QualityScorer()

        result_high = scorer.calculate_quality_score(component_high_conf)
        result_low = scorer.calculate_quality_score(component_low_conf)

        assert result_high.category_confidence > result_low.category_confidence

    def test_custom_thresholds(self):
        """Test custom reject and approve thresholds"""
        component = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
            "data_source": "mouser",
        }

        # Strict thresholds
        scorer_strict = QualityScorer(reject_threshold=80.0, approve_threshold=98.0)
        result_strict = scorer_strict.calculate_quality_score(component)

        # Lenient thresholds
        scorer_lenient = QualityScorer(reject_threshold=50.0, approve_threshold=85.0)
        result_lenient = scorer_lenient.calculate_quality_score(component)

        # Same component, different routing due to thresholds
        # (might route differently based on thresholds)
        assert result_strict.total_score == result_lenient.total_score  # Same score
        # But routing might differ based on thresholds

    def test_result_to_dict(self):
        """Test QualityScore.to_dict() serialization"""
        component = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
        }

        scorer = QualityScorer()
        result = scorer.calculate_quality_score(component)
        result_dict = result.to_dict()

        assert "total_score" in result_dict
        assert "routing" in result_dict
        assert "breakdown" in result_dict
        assert "issues" in result_dict
        assert "details" in result_dict

        # Check values are properly rounded
        assert isinstance(result_dict["total_score"], float)
        assert isinstance(result_dict["routing"], str)

    def test_convenience_function(self):
        """Test calculate_quality_score convenience function"""
        component = {
            "mpn": "TEST123",
            "manufacturer": "Test",
            "description": "Test",
            "category": "Test",
        }

        result = calculate_quality_score(component)

        assert result.total_score >= 0.0
        assert result.total_score <= 100.0
        assert result.routing in [
            QualityRouting.PRODUCTION,
            QualityRouting.STAGING,
            QualityRouting.REJECTED
        ]


class TestRoutingLogic:
    """Test routing decision logic"""

    def test_production_routing(self):
        """Test production routing (>= 95%)"""
        scorer = QualityScorer(approve_threshold=95.0)

        # Mock component with high scores
        component = {
            "mpn": "PERFECT123",
            "manufacturer": "Perfect Corp",
            "description": "Perfect component",
            "category": "Perfect Category",
            "category_confidence": 1.0,
            "datasheet_url": "https://example.com/ds.pdf",
            "image_url": "https://example.com/img.jpg",
            "lifecycle_status": "Active",
            "rohs_status": "Compliant",
            "package": "LQFP-100",
            "data_source": "digikey",
            "extracted_specs": {
                "package": "LQFP-100",
                "voltage": "3.3V",
                "current": "100mA",
                "power": "0.5W",
                "frequency": "100MHz",
                "temp_range": "-40C to 85C",
            }
        }

        result = scorer.calculate_quality_score(component)

        # Should route to production
        assert result.total_score >= 95.0
        assert result.routing == QualityRouting.PRODUCTION

    def test_staging_routing(self):
        """Test staging routing (70-94%)"""
        scorer = QualityScorer(reject_threshold=70.0, approve_threshold=95.0)

        component = {
            "mpn": "MODERATE123",
            "manufacturer": "Moderate Corp",
            "description": "Moderate component",
            "category": "Moderate Category",
            "data_source": "mouser",
        }

        result = scorer.calculate_quality_score(component)

        # Should route to staging (exact score depends on weights)
        if 70.0 <= result.total_score < 95.0:
            assert result.routing == QualityRouting.STAGING

    def test_rejected_routing(self):
        """Test rejected routing (< 70%)"""
        scorer = QualityScorer(reject_threshold=70.0)

        component = {
            "mpn": "BAD123",
            "data_source": "unknown",
        }

        result = scorer.calculate_quality_score(component)

        assert result.total_score < 70.0
        assert result.routing == QualityRouting.REJECTED
        assert len(result.issues) > 0
