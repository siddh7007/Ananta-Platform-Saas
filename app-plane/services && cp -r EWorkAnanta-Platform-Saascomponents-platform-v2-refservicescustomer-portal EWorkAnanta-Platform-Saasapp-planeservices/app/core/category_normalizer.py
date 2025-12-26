"""
Category Normalization Engine

Maps vendor-specific category names to canonical hierarchical category structure.
Supports fuzzy matching and confidence scoring.

This is a standalone version adapted for CNS service (no Django dependencies).
Uses in-memory category mappings and SQLAlchemy for database operations.
"""

import re
import logging
from typing import Optional, Tuple, Dict, List
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class CategoryNormalizer:
    """
    Normalizes vendor category strings to canonical categories.

    Strategy:
    1. Exact match in category mapping cache
    2. Fuzzy match against known mappings
    3. Fuzzy match against canonical category names
    4. Parse hierarchical format (DigiKey style: "IC / Microcontrollers")
    5. Return best match with confidence score

    Note: This is an in-memory implementation. For production, integrate with
    database repository for category mappings.
    """

    def __init__(self):
        """Initialize category normalizer with canonical categories"""
        # In-memory canonical categories (will be loaded from DB in production)
        self._canonical_categories = self._load_canonical_categories()

        # Vendor category mappings cache (vendor -> vendor_category -> canonical)
        self._mapping_cache: Dict[str, Dict[str, Tuple[str, float]]] = {}

    def normalize_category(
        self,
        vendor: str,
        vendor_category: str,
        min_confidence: float = 0.6
    ) -> Tuple[Optional[str], float, str]:
        """
        Normalize vendor category to canonical category.

        Args:
            vendor: Vendor name (mouser, digikey, element14)
            vendor_category: Vendor's category string
            min_confidence: Minimum confidence score for fuzzy matches (0.0-1.0)

        Returns:
            Tuple of (canonical_category or None, confidence score, method used)

        Example:
            category, confidence, method = normalizer.normalize_category(
                'digikey',
                'Integrated Circuits (ICs) / Microcontrollers - MCU'
            )
            # Returns: ('Integrated Circuits > Microcontrollers', 0.95, 'hierarchy_parse')
        """
        if not vendor_category or not vendor_category.strip():
            return None, 0.0, "empty_category"

        vendor_category = vendor_category.strip()
        vendor = vendor.lower()

        # 1. Check exact mapping cache
        if vendor in self._mapping_cache:
            if vendor_category in self._mapping_cache[vendor]:
                canonical, confidence = self._mapping_cache[vendor][vendor_category]
                logger.debug(f"Cache hit: {vendor}/{vendor_category} -> {canonical}")
                return canonical, confidence, "exact_mapping"

        # 2. Fuzzy match against existing mappings for this vendor
        if vendor in self._mapping_cache:
            fuzzy_match = self._fuzzy_match_mappings(
                vendor, vendor_category, min_confidence
            )
            if fuzzy_match:
                canonical, confidence = fuzzy_match
                # Cache this new mapping
                self._add_to_cache(vendor, vendor_category, canonical, confidence * 0.95)
                logger.info(
                    f"Fuzzy mapping match: {vendor}/{vendor_category} -> {canonical} "
                    f"(confidence: {confidence * 0.95:.2f})"
                )
                return canonical, confidence * 0.95, "fuzzy_mapping"

        # 3. Parse hierarchical format (DigiKey/Mouser style)
        if '/' in vendor_category or '>' in vendor_category:
            parsed = self._parse_hierarchy(vendor_category, min_confidence)
            if parsed:
                canonical, confidence = parsed
                self._add_to_cache(vendor, vendor_category, canonical, confidence)
                logger.info(
                    f"Hierarchy parse: {vendor}/{vendor_category} -> {canonical} "
                    f"(confidence: {confidence:.2f})"
                )
                return canonical, confidence, "hierarchy_parse"

        # 4. Fuzzy match against canonical category names
        canonical_match = self._fuzzy_match_canonical(vendor_category, min_confidence)
        if canonical_match:
            canonical, confidence = canonical_match
            self._add_to_cache(vendor, vendor_category, canonical, confidence)
            logger.info(
                f"Canonical match: {vendor}/{vendor_category} -> {canonical} "
                f"(confidence: {confidence:.2f})"
            )
            return canonical, confidence, "canonical_match"

        # 5. No match found
        logger.warning(f"No category match found for: {vendor} / {vendor_category}")
        return None, 0.0, "no_match"

    def _fuzzy_match_mappings(
        self,
        vendor: str,
        vendor_category: str,
        min_confidence: float
    ) -> Optional[Tuple[str, float]]:
        """Find similar vendor category mapping using fuzzy matching"""
        if vendor not in self._mapping_cache:
            return None

        best_match = None
        best_ratio = 0.0

        for existing_vendor_cat, (canonical, _) in self._mapping_cache[vendor].items():
            ratio = SequenceMatcher(
                None,
                vendor_category.lower(),
                existing_vendor_cat.lower()
            ).ratio()

            if ratio > best_ratio and ratio >= min_confidence:
                best_ratio = ratio
                best_match = (canonical, ratio)

        return best_match

    def _fuzzy_match_canonical(
        self,
        vendor_category: str,
        min_confidence: float
    ) -> Optional[Tuple[str, float]]:
        """Match against canonical category names"""
        vendor_lower = vendor_category.lower()

        # Try exact match first
        for canonical in self._canonical_categories:
            if canonical.lower() == vendor_lower:
                return canonical, 1.0

        # Fuzzy match
        best_match = None
        best_ratio = 0.0

        for canonical in self._canonical_categories:
            ratio = SequenceMatcher(None, vendor_lower, canonical.lower()).ratio()

            if ratio > best_ratio and ratio >= min_confidence:
                best_ratio = ratio
                best_match = (canonical, ratio)

        return best_match

    def _parse_hierarchy(
        self,
        vendor_category: str,
        min_confidence: float
    ) -> Optional[Tuple[str, float]]:
        """
        Parse hierarchical category format.

        Examples:
        - "Integrated Circuits (ICs) / Microcontrollers - MCU" -> "Integrated Circuits > Microcontrollers"
        - "Connectors > USB Connectors" -> "Connectors > USB Connectors"
        """
        # DigiKey/Mouser use "/" or ">" as separator
        separator = '/' if '/' in vendor_category else '>'
        parts = [p.strip() for p in vendor_category.split(separator)]

        if len(parts) < 2:
            return None

        # Clean up parts (remove common suffixes like " - MCU")
        cleaned_parts = []
        for part in parts:
            # Remove trailing descriptors after dash
            if ' -' in part:
                part = part.split(' -')[0].strip()
            # Remove parenthetical suffixes like "(ICs)"
            if '(' in part:
                part = re.sub(r'\s*\([^)]*\)', '', part).strip()
            cleaned_parts.append(part)

        # Build canonical path
        canonical_path = ' > '.join(cleaned_parts)

        # Calculate confidence based on how many parts matched canonical categories
        matched_parts = sum(
            1 for part in cleaned_parts
            if any(part.lower() in cat.lower() for cat in self._canonical_categories)
        )
        confidence = 0.7 + (matched_parts / len(cleaned_parts)) * 0.3

        return canonical_path, min(confidence, 1.0)

    def _add_to_cache(
        self,
        vendor: str,
        vendor_category: str,
        canonical: str,
        confidence: float
    ) -> None:
        """Add mapping to cache"""
        if vendor not in self._mapping_cache:
            self._mapping_cache[vendor] = {}
        self._mapping_cache[vendor][vendor_category] = (canonical, confidence)

    def _load_canonical_categories(self) -> List[str]:
        """
        Load canonical categories (hardcoded for now, will load from DB)

        In production, this would query the database:
            SELECT DISTINCT path FROM categories ORDER BY path
        """
        return [
            # Top-level categories
            "Integrated Circuits",
            "Discrete Semiconductors",
            "Passive Components",
            "Connectors",
            "Electromechanical",
            "Power",
            "Sensors",
            "RF and Wireless",
            "Optoelectronics",
            "Cable and Wire",

            # Integrated Circuits subcategories
            "Integrated Circuits > Microcontrollers",
            "Integrated Circuits > Microprocessors",
            "Integrated Circuits > Memory",
            "Integrated Circuits > Amplifiers",
            "Integrated Circuits > Data Converters",
            "Integrated Circuits > Interface",
            "Integrated Circuits > Logic",
            "Integrated Circuits > Power Management",
            "Integrated Circuits > Clock and Timing",

            # Memory subcategories
            "Integrated Circuits > Memory > Flash",
            "Integrated Circuits > Memory > DRAM",
            "Integrated Circuits > Memory > SRAM",
            "Integrated Circuits > Memory > EEPROM",

            # Discrete Semiconductors
            "Discrete Semiconductors > Diodes",
            "Discrete Semiconductors > Transistors",
            "Discrete Semiconductors > MOSFETs",
            "Discrete Semiconductors > IGBTs",
            "Discrete Semiconductors > Rectifiers",

            # Passive Components
            "Passive Components > Resistors",
            "Passive Components > Capacitors",
            "Passive Components > Inductors",
            "Passive Components > Filters",
            "Passive Components > Crystals",

            # Capacitors subcategories
            "Passive Components > Capacitors > Ceramic",
            "Passive Components > Capacitors > Electrolytic",
            "Passive Components > Capacitors > Tantalum",
            "Passive Components > Capacitors > Film",

            # Resistors subcategories
            "Passive Components > Resistors > Chip Resistors",
            "Passive Components > Resistors > Through-Hole Resistors",
            "Passive Components > Resistors > Variable Resistors",
            "Passive Components > Resistors > Current Sense Resistors",

            # Connectors
            "Connectors > USB",
            "Connectors > HDMI",
            "Connectors > Ethernet",
            "Connectors > D-Sub",
            "Connectors > Pin Headers",
            "Connectors > Terminal Blocks",
            "Connectors > RF Coaxial",

            # Electromechanical
            "Electromechanical > Relays",
            "Electromechanical > Switches",
            "Electromechanical > Circuit Breakers",
            "Electromechanical > Fuses",
            "Electromechanical > Transformers",

            # Power
            "Power > AC-DC Converters",
            "Power > DC-DC Converters",
            "Power > Voltage Regulators",
            "Power > Power Supplies",
            "Power > Battery Management",

            # Sensors
            "Sensors > Temperature Sensors",
            "Sensors > Pressure Sensors",
            "Sensors > Motion Sensors",
            "Sensors > Proximity Sensors",
            "Sensors > Current Sensors",
            "Sensors > Voltage Sensors",

            # RF and Wireless
            "RF and Wireless > RF Modules",
            "RF and Wireless > Antennas",
            "RF and Wireless > RF Amplifiers",
            "RF and Wireless > RF Switches",

            # Optoelectronics
            "Optoelectronics > LEDs",
            "Optoelectronics > Laser Diodes",
            "Optoelectronics > Photodiodes",
            "Optoelectronics > Optocouplers",
            "Optoelectronics > Displays",
        ]


# Convenience function for direct use
def normalize_vendor_category(
    vendor: str,
    vendor_category: str,
    min_confidence: float = 0.6
) -> Tuple[Optional[str], float, str]:
    """
    Normalize vendor category to canonical category.

    Usage:
        from app.core.category_normalizer import normalize_vendor_category

        category, confidence, method = normalize_vendor_category(
            'mouser', 'ARM Microcontrollers - MCU'
        )
        if confidence >= 0.8:
            print(f"High confidence: {category}")

    Args:
        vendor: Vendor name
        vendor_category: Vendor's category string
        min_confidence: Minimum confidence threshold (default 0.6)

    Returns:
        Tuple of (canonical_category or None, confidence 0.0-1.0, method used)
    """
    normalizer = CategoryNormalizer()
    return normalizer.normalize_category(vendor, vendor_category, min_confidence)
