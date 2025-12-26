"""
Quality Scoring Engine

Calculates quality scores for component data to determine routing:
- Auto-approve (>= 95%): Direct to production catalog
- Staging review (70-94%): Human review in staging queue
- Rejected (< 70%): Needs manual cleanup

Scoring factors:
1. Data completeness (40%): How many required fields are populated
2. Data source quality (30%): Tier 1 supplier > Tier 2 > Web scrape
3. Specification extraction (20%): Technical specs parsed successfully
4. Category confidence (10%): Confidence of category normalization

"""

import logging
from typing import Dict, Any, List, Optional
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class QualityRouting(str, Enum):
    """Quality routing destinations"""
    PRODUCTION = "production"      # Auto-approved (>= 95%)
    STAGING = "staging"            # Needs review (70-94%)
    REJECTED = "rejected"          # Needs cleanup (< 70%)


@dataclass
class QualityScore:
    """
    Quality score result with detailed breakdown
    """
    total_score: float              # Total score 0-100
    routing: QualityRouting         # Where to route this component
    breakdown: Dict[str, float]     # Score breakdown by category
    issues: List[str]               # List of quality issues found
    completeness: float             # Data completeness score (0-100)
    source_quality: float           # Data source quality score (0-100)
    spec_extraction: float          # Spec extraction score (0-100)
    category_confidence: float      # Category confidence score (0-100)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "total_score": round(self.total_score, 2),
            "routing": self.routing.value,
            "breakdown": {k: round(v, 2) for k, v in self.breakdown.items()},
            "issues": self.issues,
            "details": {
                "completeness": round(self.completeness, 2),
                "source_quality": round(self.source_quality, 2),
                "spec_extraction": round(self.spec_extraction, 2),
                "category_confidence": round(self.category_confidence, 2),
            }
        }


class QualityScorer:
    """
    Calculate quality scores for component data

    Configuration:
    - reject_threshold: Minimum score for staging (default 70)
    - approve_threshold: Minimum score for auto-approval (default 95)
    - weights: Custom weights for score factors (default from config)

    Usage:
        scorer = QualityScorer()
        result = scorer.calculate_quality_score(component_data)

        if result.routing == QualityRouting.PRODUCTION:
            # Auto-approve to production
        elif result.routing == QualityRouting.STAGING:
            # Send to staging for review
        else:
            # Reject or flag for cleanup
    """

    # Default weights for score factors (must sum to 1.0)
    DEFAULT_WEIGHTS = {
        "completeness": 0.40,       # 40% - Data completeness
        "source_quality": 0.30,     # 30% - Data source reliability
        "spec_extraction": 0.20,    # 20% - Technical specs extracted
        "category_confidence": 0.10  # 10% - Category mapping confidence
    }

    # Required fields for completeness scoring
    REQUIRED_FIELDS = [
        "mpn",                  # Manufacturer Part Number (critical)
        "manufacturer",         # Manufacturer name (critical)
        "description",          # Component description
        "category",             # Component category
    ]

    # High-priority fields (heavily weighted for quality)
    HIGH_PRIORITY_FIELDS = [
        "price_breaks",         # Pricing data (critical for procurement)
        "stock_quantity",       # Stock availability (critical for sourcing)
        "lifecycle_status",     # Product lifecycle (critical for long-term availability)
        "parameters",           # Technical specifications (critical for design)
        "datasheet_url",        # Technical documentation (critical for engineering)
    ]

    # Recommended fields (bonus points)
    RECOMMENDED_FIELDS = [
        "image_url",
        "rohs_compliant",       # RoHS compliance status
        "reach_compliant",      # REACH compliance status
        "halogen_free",         # Halogen-free status
        "aec_qualified",        # Automotive qualification
        "package",              # Package type
        "lead_time_days",       # Lead time information
        "supplier_part_number", # Supplier's part number
        "packaging",            # Packaging type (reel, tube, etc.)
        "minimum_order_quantity", # MOQ
        "eccn_code",            # Export control classification
        "hts_code",             # Harmonized tariff schedule code
    ]

    # Data source tier quality scores
    SOURCE_QUALITY_SCORES = {
        # Tier 1: Official distributors with verified data
        "mouser": 100,
        "digikey": 100,
        "element14": 95,
        "newark": 95,
        "avnet": 90,
        "arrow": 90,

        # Tier 2: Aggregators with good data quality
        "octopart": 85,
        "findchips": 80,
        "siliconexpert": 90,

        # Tier 3: Web scraping / unknown
        "web_scrape": 50,
        "unknown": 40,
        "manual_entry": 70,
    }

    def __init__(
        self,
        reject_threshold: float = 70.0,
        approve_threshold: float = 95.0,
        weights: Optional[Dict[str, float]] = None
    ):
        """
        Initialize quality scorer

        Args:
            reject_threshold: Minimum score for staging (default 70)
            approve_threshold: Minimum score for auto-approval (default 95)
            weights: Custom weights (must sum to 1.0)
        """
        self.reject_threshold = reject_threshold
        self.approve_threshold = approve_threshold
        self.weights = weights or self.DEFAULT_WEIGHTS

        # Validate weights sum to 1.0
        weight_sum = sum(self.weights.values())
        if not (0.99 <= weight_sum <= 1.01):  # Allow small floating point errors
            raise ValueError(
                f"Weights must sum to 1.0, got {weight_sum}. "
                f"Weights: {self.weights}"
            )

    def calculate_quality_score(self, component_data: Dict[str, Any]) -> QualityScore:
        """
        Calculate quality score for component data

        Args:
            component_data: Component data dictionary

        Returns:
            QualityScore object with total score and routing decision
        """
        issues = []

        # 1. Calculate completeness score (40%)
        completeness = self._score_completeness(component_data, issues)

        # 2. Calculate source quality score (30%)
        source_quality = self._score_source_quality(component_data, issues)

        # 3. Calculate spec extraction score (20%)
        spec_extraction = self._score_spec_extraction(component_data, issues)

        # 4. Calculate category confidence score (10%)
        category_confidence = self._score_category_confidence(component_data, issues)

        # Calculate weighted total
        breakdown = {
            "completeness": completeness,
            "source_quality": source_quality,
            "spec_extraction": spec_extraction,
            "category_confidence": category_confidence,
        }

        total_score = sum(
            score * self.weights[factor]
            for factor, score in breakdown.items()
        )

        # BUG-026: Validate quality score stays within bounds (0-100)
        if total_score < 0:
            logger.warning(f"Quality score below 0: {total_score}, clamping to 0")
            total_score = 0
        elif total_score > 100:
            logger.warning(f"Quality score above 100: {total_score}, clamping to 100")
            total_score = 100

        # Determine routing
        if total_score >= self.approve_threshold:
            routing = QualityRouting.PRODUCTION
        elif total_score >= self.reject_threshold:
            routing = QualityRouting.STAGING
        else:
            routing = QualityRouting.REJECTED

        return QualityScore(
            total_score=total_score,
            routing=routing,
            breakdown=breakdown,
            issues=issues,
            completeness=completeness,
            source_quality=source_quality,
            spec_extraction=spec_extraction,
            category_confidence=category_confidence,
        )

    def _score_completeness(
        self,
        data: Dict[str, Any],
        issues: List[str]
    ) -> float:
        """
        Score data completeness (0-100)

        Scoring (three-tier system):
        - Required fields: 50% of completeness score (must have)
        - High-priority fields: 35% of completeness score (pricing, stock, parameters, lifecycle, datasheet)
        - Recommended fields: 15% of completeness score (compliance, packaging, regulatory)
        """
        required_score = 0.0
        required_present = 0

        # Check required fields (50% of completeness score)
        for field in self.REQUIRED_FIELDS:
            if self._is_field_populated(data, field):
                required_present += 1
            else:
                issues.append(f"Missing required field: {field}")

        if self.REQUIRED_FIELDS:
            required_score = (required_present / len(self.REQUIRED_FIELDS)) * 50

        # Check high-priority fields (35% of completeness score)
        high_priority_score = 0.0
        high_priority_present = 0
        high_priority_missing = []

        for field in self.HIGH_PRIORITY_FIELDS:
            if self._is_field_populated(data, field):
                high_priority_present += 1
            else:
                high_priority_missing.append(field)

        if self.HIGH_PRIORITY_FIELDS:
            high_priority_score = (high_priority_present / len(self.HIGH_PRIORITY_FIELDS)) * 35

        # Report missing high-priority fields (critical for quality)
        if high_priority_missing:
            issues.append(f"Missing high-priority fields: {', '.join(high_priority_missing)}")

        # Check recommended fields (15% of completeness score)
        recommended_score = 0.0
        recommended_present = 0

        for field in self.RECOMMENDED_FIELDS:
            if self._is_field_populated(data, field):
                recommended_present += 1

        if self.RECOMMENDED_FIELDS:
            recommended_score = (recommended_present / len(self.RECOMMENDED_FIELDS)) * 15

        total = required_score + high_priority_score + recommended_score

        logger.debug(
            f"Completeness: {total:.1f}% "
            f"(required: {required_present}/{len(self.REQUIRED_FIELDS)}, "
            f"high-priority: {high_priority_present}/{len(self.HIGH_PRIORITY_FIELDS)}, "
            f"recommended: {recommended_present}/{len(self.RECOMMENDED_FIELDS)})"
        )

        return total

    def _score_source_quality(
        self,
        data: Dict[str, Any],
        issues: List[str]
    ) -> float:
        """
        Score data source quality (0-100)

        Uses predefined quality scores for each data source.
        Checks api_source (supplier name), then enrichment_source, then data_source.
        """
        # Check for api_source first (supplier name: 'mouser', 'digikey', etc.)
        # Then enrichment_source ('catalog', 'supplier_api')
        # Then fallback to data_source for backward compatibility
        source = (
            data.get("api_source") or
            data.get("enrichment_source") or
            data.get("data_source") or
            "unknown"
        )

        # Normalize source name
        source_lower = str(source).lower().strip()

        # Look up quality score
        score = self.SOURCE_QUALITY_SCORES.get(
            source_lower,
            self.SOURCE_QUALITY_SCORES["unknown"]
        )

        if score < 70:
            issues.append(f"Low quality data source: {source} ({score}%)")

        logger.debug(f"Source quality: {score}% (source: {source})")

        return float(score)

    def _score_spec_extraction(
        self,
        data: Dict[str, Any],
        issues: List[str]
    ) -> float:
        """
        Score specification extraction quality (0-100)

        Checks for:
        - Parameters dictionary (from supplier API parsers)
        - Technical parameters parsed
        - Package information
        - Electrical specifications
        """
        score = 0.0

        # Check for parameters dictionary (supplier parsers use 'parameters' field)
        # Also check 'extracted_specs' for backward compatibility
        parameters = data.get("parameters") or data.get("extracted_specs", {})

        if not parameters:
            issues.append("No technical specifications extracted")
            return 0.0

        # If parameters is a dict, count the number of non-empty values
        # Supplier parsers return parameters as dict with various technical specs
        if isinstance(parameters, dict):
            populated_count = sum(
                1 for value in parameters.values()
                if value is not None and value != "" and value != "N/A"
            )

            # Score based on parameter count
            # 0 params = 0%, 1-3 params = 30%, 4-6 params = 60%, 7+ params = 100%
            if populated_count == 0:
                score = 0.0
            elif populated_count <= 3:
                score = 30.0
            elif populated_count <= 6:
                score = 60.0
            else:
                score = min(100.0, 60.0 + (populated_count - 6) * 5)  # 5% per additional param

            if score < 30:
                issues.append(
                    f"Low specification coverage: {populated_count} parameters extracted"
                )

            logger.debug(
                f"Spec extraction: {score:.1f}% "
                f"({populated_count} parameters extracted)"
            )
        else:
            # Legacy format check
            logger.warning(f"Unexpected parameters format: {type(parameters)}")
            score = 0.0
            issues.append("Parameters in unexpected format")

        return score

    def _score_category_confidence(
        self,
        data: Dict[str, Any],
        issues: List[str]
    ) -> float:
        """
        Score category normalization confidence (0-100)

        Uses category_confidence field if available, otherwise checks
        if category field is populated.
        """
        # Check for explicit category confidence
        if "category_confidence" in data:
            confidence = float(data["category_confidence"])
            score = confidence * 100  # Convert 0-1 to 0-100

            if score < 60:
                issues.append(
                    f"Low category confidence: {score:.1f}% "
                    f"(category: {data.get('category', 'unknown')})"
                )

            logger.debug(
                f"Category confidence: {score:.1f}% "
                f"(category: {data.get('category', 'unknown')})"
            )

            return score

        # Fallback: Check if category is populated
        if self._is_field_populated(data, "category"):
            return 80.0  # Assume moderate confidence if category exists
        else:
            issues.append("No category assigned")
            return 0.0

    def _is_field_populated(self, data: Dict[str, Any], field: str) -> bool:
        """
        Check if a field is populated with meaningful data

        Args:
            data: Component data dictionary
            field: Field name to check

        Returns:
            True if field has meaningful data
        """
        if field not in data:
            return False

        value = data[field]

        # Check for None
        if value is None:
            return False

        # String fields: Check for non-empty meaningful values
        if isinstance(value, str):
            if not value.strip():
                return False
            # Check for placeholder values
            placeholder_values = ["n/a", "na", "unknown", "tbd", "null", "none"]
            if value.lower() in placeholder_values:
                return False
            return True

        # Numeric fields: Accept 0 as valid (stock can be 0, MOQ can be 0, etc.)
        if isinstance(value, (int, float, Decimal)):
            return True  # Any numeric value is considered populated

        # List fields (e.g., price_breaks): Check for non-empty list
        if isinstance(value, list):
            if not value:
                return False
            # Special handling for price_breaks: check if it has actual price data
            if field == "price_breaks":
                # Price breaks should have at least one entry with quantity and price
                return any(
                    isinstance(item, dict) and
                    item.get("quantity") is not None and
                    item.get("price") is not None
                    for item in value
                )
            return True

        # Dict fields (e.g., parameters): Check for non-empty dict with meaningful values
        if isinstance(value, dict):
            if not value:
                return False
            # Parameters should have at least one non-empty value
            if field == "parameters":
                return any(
                    v is not None and v != "" and v != "N/A"
                    for v in value.values()
                )
            return True

        # Boolean fields: Accept any boolean value (True or False both valid)
        if isinstance(value, bool):
            return True

        # Any other non-None value is considered populated
        return True


# Convenience function for direct use
def calculate_quality_score(
    component_data: Dict[str, Any],
    reject_threshold: float = 70.0,
    approve_threshold: float = 95.0
) -> QualityScore:
    """
    Calculate quality score for component data

    Usage:
        from app.core.quality_scorer import calculate_quality_score

        result = calculate_quality_score(component_data)

        print(f"Score: {result.total_score:.1f}%")
        print(f"Routing: {result.routing}")
        print(f"Issues: {result.issues}")

    Args:
        component_data: Component data dictionary
        reject_threshold: Minimum score for staging (default 70)
        approve_threshold: Minimum score for auto-approval (default 95)

    Returns:
        QualityScore object
    """
    scorer = QualityScorer(
        reject_threshold=reject_threshold,
        approve_threshold=approve_threshold
    )
    return scorer.calculate_quality_score(component_data)
