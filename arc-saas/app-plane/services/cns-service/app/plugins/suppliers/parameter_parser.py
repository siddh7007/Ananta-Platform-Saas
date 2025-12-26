"""
Parameter Parser Utility

Parses supplier parameter values into structured data.
Handles various formats: numeric values, ranges, units, etc.

Examples:
- "72MHz" → {"value": 72, "unit": "MHz", "type": "numeric"}
- "2V ~ 3.6V" → {"min": 2, "max": 3.6, "unit": "V", "type": "range"}
- "±5%" → {"value": 5, "unit": "%", "tolerance": "±", "type": "tolerance"}
- "Active" → {"value": "Active", "type": "text"}
"""

import re
from typing import Dict, Any, Optional, Union
import logging

logger = logging.getLogger(__name__)


class ParameterParser:
    """
    Parse component parameter values into structured data.

    Handles various parameter formats from supplier APIs.
    """

    # Common unit patterns
    UNIT_PATTERNS = {
        # Electrical
        'voltage': ['V', 'mV', 'kV'],
        'current': ['A', 'mA', 'µA', 'uA', 'nA'],
        'resistance': ['Ω', 'Ohm', 'ohm', 'kΩ', 'MΩ', 'mΩ'],
        'capacitance': ['F', 'pF', 'nF', 'µF', 'uF', 'mF'],
        'inductance': ['H', 'pH', 'nH', 'µH', 'uH', 'mH'],
        'frequency': ['Hz', 'kHz', 'MHz', 'GHz'],
        'power': ['W', 'mW', 'kW'],

        # Physical
        'temperature': ['°C', 'C', '°F', 'F', 'K'],
        'time': ['s', 'ms', 'µs', 'us', 'ns', 'min', 'h'],
        'length': ['m', 'mm', 'cm', 'µm', 'um', 'nm', 'in', 'mil'],
        'weight': ['g', 'kg', 'mg', 'oz', 'lb'],

        # Other
        'percentage': ['%'],
        'rpm': ['rpm', 'RPM'],
        'bits': ['bit', 'bits', 'B', 'KB', 'MB', 'GB'],
    }

    # Flatten all units into a single list for regex matching
    ALL_UNITS = []
    for category in UNIT_PATTERNS.values():
        ALL_UNITS.extend(category)

    @staticmethod
    def parse(param_name: str, param_value: str) -> Dict[str, Any]:
        """
        Parse parameter value into structured data.

        Args:
            param_name: Parameter name (e.g., "Operating Temperature")
            param_value: Parameter value (e.g., "-40°C ~ 85°C")

        Returns:
            Structured parameter data:
            {
                "type": "range",  # or "numeric", "text", "tolerance", "list"
                "value": 72,      # for numeric/text
                "min": -40,       # for range
                "max": 85,        # for range
                "unit": "°C",     # if present
                "raw": "-40°C ~ 85°C"  # original value
            }
        """
        if not param_value or not isinstance(param_value, str):
            return {
                "type": "empty",
                "value": None,
                "raw": param_value
            }

        value_str = param_value.strip()

        # Check for range format: "X ~ Y", "X to Y", "X - Y"
        range_result = ParameterParser._parse_range(value_str)
        if range_result:
            return {**range_result, "raw": param_value}

        # Check for tolerance format: "±X%", "X ±Y"
        tolerance_result = ParameterParser._parse_tolerance(value_str)
        if tolerance_result:
            return {**tolerance_result, "raw": param_value}

        # Check for list format: "A, B, C" or "A / B / C"
        list_result = ParameterParser._parse_list(value_str)
        if list_result:
            return {**list_result, "raw": param_value}

        # Check for numeric with unit: "72MHz", "3.3V", "100kΩ"
        numeric_result = ParameterParser._parse_numeric(value_str)
        if numeric_result:
            return {**numeric_result, "raw": param_value}

        # Default: treat as text
        return {
            "type": "text",
            "value": value_str,
            "raw": param_value
        }

    @staticmethod
    def _parse_range(value: str) -> Optional[Dict[str, Any]]:
        """
        Parse range format: "X ~ Y", "X to Y", "X - Y"

        Examples:
        - "-40°C ~ 85°C" → {"type": "range", "min": -40, "max": 85, "unit": "°C"}
        - "2V to 3.6V" → {"type": "range", "min": 2, "max": 3.6, "unit": "V"}
        - "10 - 100" → {"type": "range", "min": 10, "max": 100}
        """
        # Try different range separators
        for separator in ['~', ' to ', ' - ']:
            if separator in value:
                parts = value.split(separator)
                if len(parts) == 2:
                    # Extract numeric values and unit
                    min_val, min_unit = ParameterParser._extract_number_and_unit(parts[0].strip())
                    max_val, max_unit = ParameterParser._extract_number_and_unit(parts[1].strip())

                    if min_val is not None and max_val is not None:
                        # Use unit from max value if available, otherwise from min
                        unit = max_unit or min_unit

                        return {
                            "type": "range",
                            "min": min_val,
                            "max": max_val,
                            "unit": unit
                        }

        return None

    @staticmethod
    def _parse_tolerance(value: str) -> Optional[Dict[str, Any]]:
        """
        Parse tolerance format: "±X%", "X ±Y"

        Examples:
        - "±5%" → {"type": "tolerance", "value": 5, "unit": "%", "tolerance": "±"}
        - "3.3V ±0.1V" → {"type": "tolerance", "value": 3.3, "tolerance_value": 0.1, "unit": "V"}
        """
        # Pattern: ±X or +/- X
        if '±' in value or '+/-' in value:
            # Split on tolerance symbol
            if '±' in value:
                parts = value.split('±')
                tolerance_symbol = '±'
            else:
                parts = value.split('+/-')
                tolerance_symbol = '±'

            if len(parts) == 2:
                nominal_val, nominal_unit = ParameterParser._extract_number_and_unit(parts[0].strip())
                tolerance_val, tolerance_unit = ParameterParser._extract_number_and_unit(parts[1].strip())

                if tolerance_val is not None:
                    result = {
                        "type": "tolerance",
                        "tolerance": tolerance_symbol,
                        "tolerance_value": tolerance_val,
                        "unit": tolerance_unit or nominal_unit
                    }

                    if nominal_val is not None:
                        result["value"] = nominal_val

                    return result

            # Just ±X format (no nominal value)
            elif len(parts) == 1:
                tolerance_val, tolerance_unit = ParameterParser._extract_number_and_unit(parts[0].strip())
                if tolerance_val is not None:
                    return {
                        "type": "tolerance",
                        "tolerance": tolerance_symbol,
                        "tolerance_value": tolerance_val,
                        "unit": tolerance_unit
                    }

        return None

    @staticmethod
    def _parse_list(value: str) -> Optional[Dict[str, Any]]:
        """
        Parse list format: "A, B, C" or "A / B / C"

        Examples:
        - "Red, Green, Blue" → {"type": "list", "values": ["Red", "Green", "Blue"]}
        - "0.1µF / 0.22µF / 0.47µF" → {"type": "list", "values": [0.1, 0.22, 0.47], "unit": "µF"}
        """
        # Check for comma or slash separators
        for separator in [',', '/']:
            if separator in value and value.count(separator) >= 1:
                parts = [p.strip() for p in value.split(separator)]

                # Try to parse as numeric values
                numeric_values = []
                common_unit = None

                for part in parts:
                    num_val, unit = ParameterParser._extract_number_and_unit(part)
                    if num_val is not None:
                        numeric_values.append(num_val)
                        if unit:
                            common_unit = unit
                    else:
                        # Not all numeric, treat as text list
                        return {
                            "type": "list",
                            "values": parts
                        }

                # All numeric
                if len(numeric_values) == len(parts):
                    result = {
                        "type": "list",
                        "values": numeric_values
                    }
                    if common_unit:
                        result["unit"] = common_unit
                    return result

        return None

    @staticmethod
    def _parse_numeric(value: str) -> Optional[Dict[str, Any]]:
        """
        Parse numeric format: "72MHz", "3.3V", "100kΩ"

        Examples:
        - "72MHz" → {"type": "numeric", "value": 72, "unit": "MHz"}
        - "3.3V" → {"type": "numeric", "value": 3.3, "unit": "V"}
        - "100" → {"type": "numeric", "value": 100}
        """
        num_val, unit = ParameterParser._extract_number_and_unit(value)

        if num_val is not None:
            result = {
                "type": "numeric",
                "value": num_val
            }
            if unit:
                result["unit"] = unit
            return result

        return None

    @staticmethod
    def _extract_number_and_unit(value: str) -> tuple[Optional[Union[int, float]], Optional[str]]:
        """
        Extract numeric value and unit from string.

        Args:
            value: String like "72MHz", "3.3V", "-40°C"

        Returns:
            Tuple of (numeric_value, unit) or (None, None) if not numeric
        """
        # Pattern: optional sign, number (int or float), optional unit
        # Supports: -40, 3.3, 72MHz, 100kΩ
        pattern = r'^([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-zA-ZΩ°µ%]+)?$'

        match = re.match(pattern, value.strip())
        if match:
            number_str = match.group(1)
            unit = match.group(2) if match.group(2) else None

            # Parse number
            try:
                # Try int first
                if '.' not in number_str and 'e' not in number_str.lower():
                    number = int(number_str)
                else:
                    number = float(number_str)

                return number, unit
            except ValueError:
                pass

        return None, None


def extract_compliance_data(parameters: Dict[str, Any]) -> Dict[str, bool]:
    """
    Extract compliance information from parameter dictionary.

    Common compliance fields:
    - RoHS Compliant
    - REACH Compliant
    - Halogen Free
    - AEC-Q100 Qualified

    Args:
        parameters: Dictionary of parameter name -> value

    Returns:
        Dictionary of compliance flags:
        {
            "rohs_compliant": True,
            "reach_compliant": True,
            "halogen_free": False,
            "aec_qualified": False
        }
    """
    compliance = {
        "rohs_compliant": None,
        "reach_compliant": None,
        "halogen_free": None,
        "aec_qualified": None,
    }

    # Normalize parameter names to lowercase for matching
    normalized_params = {k.lower(): v for k, v in parameters.items()}

    # Check for RoHS
    for key in ['rohs', 'rohs compliant', 'rohs status']:
        if key in normalized_params:
            value = str(normalized_params[key]).lower()
            compliance["rohs_compliant"] = value in ['yes', 'compliant', 'rohs compliant', 'rohs6']

    # Check for REACH
    for key in ['reach', 'reach compliant', 'reach status']:
        if key in normalized_params:
            value = str(normalized_params[key]).lower()
            compliance["reach_compliant"] = value in ['yes', 'compliant', 'reach compliant']

    # Check for Halogen Free
    for key in ['halogen free', 'halogen-free', 'halogen status']:
        if key in normalized_params:
            value = str(normalized_params[key]).lower()
            compliance["halogen_free"] = value in ['yes', 'halogen free', 'halogen-free']

    # Check for AEC-Q100
    for key in ['aec-q100', 'aec q100', 'automotive qualification']:
        if key in normalized_params:
            value = str(normalized_params[key]).lower()
            compliance["aec_qualified"] = 'aec-q' in value or value in ['yes', 'qualified']

    return compliance
