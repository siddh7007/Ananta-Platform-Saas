"""
Component Data Normalization Engine

Provides normalization functions for component data from various sources.
Ported and enhanced from V1 for CNS (Component Normalization Service).

Functions:
- normalize_mpn: Normalize manufacturer part numbers
- normalize_price: Parse and normalize pricing data
- normalize_quantity: Parse quantity/stock numbers
- normalize_specs: Extract and normalize component specifications
- normalize_resistance: Parse resistance values (e.g., "10K" -> 10000.0)
- normalize_capacitance: Parse capacitance values (e.g., "100nF" -> 1e-7)
- normalize_voltage: Parse voltage values (e.g., "3.3V" -> 3.3)
"""

import re
import logging
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


# ===================================
# MPN (Manufacturer Part Number) Normalization
# ===================================

def normalize_mpn(mpn: Optional[str]) -> str:
    """
    Normalize manufacturer part number for matching.

    Rules:
    - Convert to uppercase
    - Remove spaces
    - Remove dashes
    - Keep alphanumeric characters and special symbols like / (for variants)

    Examples:
        "STM32F407VGT6" -> "STM32F407VGT6"
        "stm32-f407-vgt6" -> "STM32F407VGT6"
        "LM 317" -> "LM317"
        "TI/LM317T" -> "TI/LM317T"

    Args:
        mpn: Raw manufacturer part number

    Returns:
        Normalized MPN string (empty string if input is None/empty)
    """
    if not mpn:
        return ""

    # Convert to string and uppercase
    normalized = str(mpn).upper().strip()

    # Remove spaces and dashes (but keep slashes for manufacturer/part variants)
    normalized = normalized.replace(" ", "").replace("-", "")

    return normalized


# ===================================
# Price Normalization
# ===================================

def normalize_price(
    price: Optional[str | float | Decimal],
    currency: str = "USD"
) -> Optional[Decimal]:
    """
    Parse and normalize price from various formats.

    Handles:
    - Currency symbols (£, $, €, ¥)
    - Comma separators (1,234.56)
    - Range formats ("$10 - $20" -> takes first value)
    - Scientific notation (1.5e-3)

    Examples:
        "$12.34" -> Decimal("12.34")
        "£1,234.56" -> Decimal("1234.56")
        "€10 - €20" -> Decimal("10.00")
        "100" -> Decimal("100.00")

    Args:
        price: Price in various formats
        currency: Target currency (default: USD, for future conversion support)

    Returns:
        Decimal price value or None if parsing fails
    """
    if price is None or price == "":
        return None

    # Already a Decimal
    if isinstance(price, Decimal):
        return price

    # Already a float/int
    if isinstance(price, (int, float)):
        try:
            return Decimal(str(price))
        except Exception:
            return None

    # String parsing
    price_str = str(price).strip()

    if not price_str:
        return None

    # Remove currency symbols and commas
    cleaned = re.sub(r'[£$€¥,]', '', price_str)

    # Handle range format ("10 - 20" -> take first value)
    if '-' in cleaned:
        # Split and take first value
        parts = cleaned.split('-')
        if len(parts) >= 2:
            cleaned = parts[0].strip()

    # Extract first numeric value (handles "10 (min order: 100)" style)
    match = re.search(r'[\d.]+(?:e[+-]?\d+)?', cleaned)
    if match:
        cleaned = match.group(0)
    else:
        return None

    try:
        return Decimal(cleaned)
    except Exception as e:
        logger.warning(f"Failed to parse price '{price}': {e}")
        return None


# ===================================
# Quantity/Stock Normalization
# ===================================

def normalize_quantity(quantity: Optional[str | int]) -> Optional[int]:
    """
    Parse quantity/stock from strings like "1,234 In Stock" or "5000+".

    Examples:
        "1,234 In Stock" -> 1234
        "5000+" -> 5000
        "100" -> 100
        "N/A" -> None

    Args:
        quantity: Quantity in various formats

    Returns:
        Integer quantity or None if parsing fails
    """
    if quantity is None or quantity == "":
        return None

    # Already an int
    if isinstance(quantity, int):
        return quantity

    # String parsing
    quantity_str = str(quantity).strip()

    # Extract all digits (removes commas, "In Stock", "+", etc.)
    digits = re.sub(r'[^\d]', '', quantity_str)

    if not digits:
        return None

    try:
        return int(digits)
    except ValueError:
        return None


# ===================================
# Component Specifications Normalization
# ===================================

def normalize_resistance(value: Optional[str]) -> Optional[float]:
    """
    Parse resistance values with units.

    Handles:
    - K/k for kilo-ohms (10K -> 10000.0)
    - M for mega-ohms (1.5M -> 1500000.0)
    - Ω or ohm or ohms
    - Plain numbers (assumed ohms)

    Examples:
        "10K" -> 10000.0
        "1.5M" -> 1500000.0
        "470 ohm" -> 470.0
        "100Ω" -> 100.0

    Args:
        value: Resistance value with optional unit

    Returns:
        Resistance in ohms or None
    """
    if not value:
        return None

    # Keep original casing so we can distinguish
    # mega ("M") from milli ("m").
    value_str = str(value).strip()

    # Remove unit suffixes (ohm symbols/words) case-insensitively
    value_str = re.sub(r"(ohms?|Ω)", "", value_str, flags=re.IGNORECASE).strip()

    # Extract numeric value and optional multiplier (k, m, M, g, G)
    match = re.match(r"([\d.]+)\s*([kKmMgG]?)", value_str)
    if not match:
        return None

    number_str, unit_raw = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply multiplier with case-sensitive handling for 'm' vs 'M'
    if unit_raw in ("k", "K"):
        factor = 1e3
    elif unit_raw == "M":
        factor = 1e6  # mega-ohm
    elif unit_raw == "m":
        factor = 1e-3  # milli-ohm
    elif unit_raw in ("g", "G"):
        factor = 1e9
    else:
        factor = 1.0

    return number * factor


def normalize_capacitance(value: Optional[str]) -> Optional[float]:
    """
    Parse capacitance values with units.

    Handles:
    - pF (picofarads) = 1e-12
    - nF (nanofarads) = 1e-9
    - µF/uF (microfarads) = 1e-6
    - mF (millifarads) = 1e-3
    - F (farads) = 1

    Examples:
        "100pF" -> 1e-10
        "10nF" -> 1e-8
        "100uF" -> 1e-4
        "1000µF" -> 1e-3

    Args:
        value: Capacitance value with unit

    Returns:
        Capacitance in farads or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Normalize µ to U
    value_str = value_str.replace('µ', 'U')

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*([PNUMF]?)F?', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply unit multiplier
    multipliers = {
        'P': 1e-12,  # pico
        'N': 1e-9,   # nano
        'U': 1e-6,   # micro
        'M': 1e-3,   # milli
        'F': 1.0,    # farad
        '': 1e-6     # Default to µF if no unit
    }

    return number * multipliers.get(unit, 1e-6)


def normalize_voltage(value: Optional[str]) -> Optional[float]:
    """
    Parse voltage values with units.

    Handles:
    - mV (millivolts)
    - V (volts)
    - kV (kilovolts)

    Examples:
        "3.3V" -> 3.3
        "5000mV" -> 5.0
        "1.2kV" -> 1200.0

    Args:
        value: Voltage value with unit

    Returns:
        Voltage in volts or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*([MK]?)V?', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply unit multiplier
    multipliers = {
        'M': 1e-3,   # milli
        'K': 1e3,    # kilo
        '': 1.0      # volts
    }

    return number * multipliers.get(unit, 1.0)


def normalize_current(value: Optional[str]) -> Optional[float]:
    """
    Parse current values with units.

    Handles:
    - µA/uA (microamps)
    - mA (milliamps)
    - A (amps)

    Examples:
        "100mA" -> 0.1
        "500uA" -> 0.0005
        "2A" -> 2.0

    Args:
        value: Current value with unit

    Returns:
        Current in amps or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Normalize µ to U
    value_str = value_str.replace('µ', 'U')

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*([UM]?)A?', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply unit multiplier
    multipliers = {
        'U': 1e-6,   # micro
        'M': 1e-3,   # milli
        '': 1.0      # amps
    }

    return number * multipliers.get(unit, 1.0)


def normalize_power(value: Optional[str]) -> Optional[float]:
    """
    Parse power values with units.

    Handles:
    - mW (milliwatts)
    - W (watts)
    - kW (kilowatts)

    Examples:
        "100mW" -> 0.1
        "1/4W" -> 0.25
        "1.5kW" -> 1500.0

    Args:
        value: Power value with unit

    Returns:
        Power in watts or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Handle fraction format (1/4W -> 0.25W)
    if '/' in value_str:
        match = re.match(r'(\d+)/(\d+)\s*([MK]?)W?', value_str)
        if match:
            numerator, denominator, unit = match.groups()
            try:
                number = float(numerator) / float(denominator)
            except (ValueError, ZeroDivisionError):
                return None
        else:
            return None
    else:
        # Extract numeric value and unit
        match = re.match(r'([\d.]+)\s*([MK]?)W?', value_str)
        if not match:
            return None

        number_str, unit = match.groups()

        try:
            number = float(number_str)
        except ValueError:
            return None

    # Apply unit multiplier
    multipliers = {
        'M': 1e-3,   # milli
        'K': 1e3,    # kilo
        '': 1.0      # watts
    }

    return number * multipliers.get(unit, 1.0)


# ===================================
# Composite Specification Extraction
# ===================================

def extract_specs_from_description(description: Optional[str]) -> Dict[str, Any]:
    """
    Extract component specifications from description text.

    Looks for common patterns:
    - Resistance values
    - Capacitance values
    - Voltage ratings
    - Current ratings
    - Power ratings
    - Package types (SOT-23, TQFP-64, etc.)
    - Temperature ranges

    Example:
        "STM32F407VGT6 ARM Cortex-M4 MCU, 168MHz, 1MB Flash, LQFP-100"
        -> {
            "package": "LQFP-100",
            "flash_size": "1MB",
            "speed": "168MHz"
        }

    Args:
        description: Component description text

    Returns:
        Dictionary of extracted specifications
    """
    if not description:
        return {}

    specs = {}
    desc_upper = description.upper()

    # Extract package type (SOT-23, TQFP-64, DIP-8, etc.)
    package_match = re.search(r'\b([A-Z]{2,6}-?\d+[A-Z]?)\b', desc_upper)
    if package_match:
        specs['package'] = package_match.group(1)

    # Extract memory sizes (1MB, 512KB, etc.)
    memory_match = re.search(r'(\d+)\s*(KB|MB|GB)\s*(FLASH|RAM|ROM)', desc_upper)
    if memory_match:
        size, unit, mem_type = memory_match.groups()
        specs[f'{mem_type.lower()}_size'] = f"{size}{unit}"

    # Extract clock/frequency (168MHz, 1GHz, etc.)
    freq_match = re.search(r'(\d+)\s*(MHZ|GHZ)', desc_upper)
    if freq_match:
        specs['frequency'] = freq_match.group(0)

    # Extract temperature range (-40 to 85°C, etc.)
    temp_match = re.search(r'(-?\d+)\s*(?:TO|~)\s*(-?\d+)\s*°?C', desc_upper)
    if temp_match:
        specs['temp_range'] = f"{temp_match.group(1)}C to {temp_match.group(2)}C"

    # Extract voltage (if mentioned)
    voltage_patterns = [
        r'(\d+\.?\d*)\s*V(?:DC|AC)?',
        r'(\d+\.?\d*)\s*VOLT'
    ]
    for pattern in voltage_patterns:
        match = re.search(pattern, desc_upper)
        if match:
            specs['voltage'] = f"{match.group(1)}V"
            break

    return specs


# ===================================
# Batch Normalization
# ===================================

# ===================================
# Additional Parameter Normalizers (Expanding to 40+ fields)
# ===================================

def normalize_tolerance(value: Optional[str]) -> Optional[float]:
    """
    Normalize tolerance values to percentage.

    Examples:
        "±5%" -> 5.0
        "10%" -> 10.0
        "±0.1" -> 0.1

    Args:
        value: Tolerance string

    Returns:
        Tolerance as percentage or None
    """
    if not value:
        return None

    value_str = str(value).strip().replace('±', '').replace('%', '').strip()

    try:
        return float(value_str)
    except ValueError:
        return None


def normalize_temperature_coefficient(value: Optional[str]) -> Optional[float]:
    """
    Normalize temperature coefficient (tempco) to ppm/°C.

    Examples:
        "±50ppm/°C" -> 50.0
        "100 ppm/C" -> 100.0

    Args:
        value: Temperature coefficient string

    Returns:
        Tempco in ppm/°C or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Remove ±, ppm, /°C, /C
    cleaned = value_str.replace('±', '').replace('PPM', '').replace('/°C', '').replace('/C', '').strip()

    try:
        return float(cleaned)
    except ValueError:
        return None


def normalize_inductance(value: Optional[str]) -> Optional[float]:
    """
    Normalize inductance to Henries (H).

    Examples:
        "10µH" -> 0.00001
        "1mH" -> 0.001
        "100nH" -> 0.0000001

    Args:
        value: Inductance value with unit

    Returns:
        Inductance in Henries or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value
    match = re.match(r'([\d.]+)\s*([NΜUMH]?)H?', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply unit multiplier
    multipliers = {
        'N': 1e-9,   # nano
        'Μ': 1e-6,   # micro (Greek mu)
        'U': 1e-6,   # micro (ASCII u)
        'M': 1e-3,   # milli
        '': 1.0      # Henry
    }

    return number * multipliers.get(unit, 1.0)


def normalize_esr(value: Optional[str]) -> Optional[float]:
    """
    Normalize ESR (Equivalent Series Resistance) to Ohms.

    Examples:
        "50mΩ" -> 0.05
        "1.5Ω" -> 1.5

    Args:
        value: ESR value with unit

    Returns:
        ESR in Ohms or None
    """
    if not value:
        return None

    # ESR is just resistance
    return normalize_resistance(value)


def normalize_pin_count(value: Optional[str]) -> Optional[int]:
    """
    Normalize pin/position count.

    Examples:
        "24 Pins" -> 24
        "8-pin" -> 8
        "100" -> 100

    Args:
        value: Pin count string

    Returns:
        Number of pins or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value
    match = re.search(r'(\d+)', value_str)
    if not match:
        return None

    try:
        return int(match.group(1))
    except ValueError:
        return None


def normalize_pitch(value: Optional[str]) -> Optional[float]:
    """
    Normalize pitch/spacing to millimeters.

    Examples:
        "2.54mm" -> 2.54
        "0.1\"" -> 2.54
        "100mil" -> 2.54

    Args:
        value: Pitch value with unit

    Returns:
        Pitch in millimeters or None
    """
    if not value:
        return None

    value_str = str(value).strip()

    # Handle inches (convert to mm)
    if '"' in value_str or 'IN' in value_str.upper():
        match = re.match(r'([\d.]+)', value_str)
        if match:
            try:
                inches = float(match.group(1))
                return inches * 25.4
            except ValueError:
                return None

    # Handle mils (convert to mm)
    if 'MIL' in value_str.upper():
        match = re.match(r'([\d.]+)', value_str)
        if match:
            try:
                mils = float(match.group(1))
                return mils * 0.0254
            except ValueError:
                return None

    # Handle mm
    match = re.match(r'([\d.]+)\s*MM?', value_str.upper())
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None

    return None


def normalize_dielectric_type(value: Optional[str]) -> Optional[str]:
    """
    Normalize capacitor dielectric type.

    Examples:
        "X7R" -> "X7R"
        "c0g" -> "C0G"
        "Y5V" -> "Y5V"

    Args:
        value: Dielectric type string

    Returns:
        Normalized dielectric type or None
    """
    if not value:
        return None

    value_str = str(value).strip().upper()

    # Known dielectric types
    known_types = ['X7R', 'X5R', 'C0G', 'NP0', 'Y5V', 'Z5U', 'X7S', 'X7T', 'X8R']

    for known in known_types:
        if known in value_str:
            return known

    return value_str if len(value_str) <= 10 else None


def normalize_awg(value: Optional[str]) -> Optional[int]:
    """
    Normalize wire gauge (AWG).

    Examples:
        "24 AWG" -> 24
        "18AWG" -> 18
        "22" -> 22

    Args:
        value: AWG string

    Returns:
        AWG number or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value
    match = re.search(r'(\d+)', value_str)
    if not match:
        return None

    try:
        awg = int(match.group(1))
        # Validate AWG range (typically 0-40)
        if 0 <= awg <= 50:
            return awg
    except ValueError:
        pass

    return None


def normalize_forward_voltage(value: Optional[str]) -> Optional[float]:
    """
    Normalize forward voltage (Vf) for diodes/LEDs.

    Examples:
        "3.3V" -> 3.3
        "700mV" -> 0.7

    Args:
        value: Forward voltage with unit

    Returns:
        Voltage in Volts or None
    """
    # Vf is just voltage
    return normalize_voltage(value)


def normalize_reverse_voltage(value: Optional[str]) -> Optional[float]:
    """
    Normalize reverse/breakdown voltage (Vr) for diodes.

    Examples:
        "50V" -> 50.0
        "100V" -> 100.0

    Args:
        value: Reverse voltage with unit

    Returns:
        Voltage in Volts or None
    """
    # Vr is just voltage
    return normalize_voltage(value)


def normalize_lifecycle_status(value: Optional[str]) -> Optional[str]:
    """
    Normalize lifecycle status with comprehensive vendor variant mapping.

    Examples:
        "Active" -> "active"
        "Not Recommended for New Designs" -> "nrnd"
        "End of Life" -> "eol"
        "Obsolete" -> "obsolete"
        "Last Time Buy" -> "eol"
        "Preview" -> "preview"
        "1" -> "active" (Element14 numeric code)
        "2" -> "nrnd" (Element14 numeric code)

    Args:
        value: Lifecycle status string or numeric code

    Returns:
        Normalized status or None
    """
    if not value:
        return None

    value_str = str(value).strip()

    # Handle Element14 numeric lifecycle codes first (before converting to lowercase)
    if value_str.isdigit():
        numeric_code = int(value_str)
        element14_codes = {
            1: 'active',
            2: 'nrnd',
            3: 'obsolete',
            4: 'preview',
            5: 'eol',
            6: 'contact_manufacturer',
        }
        mapped = element14_codes.get(numeric_code)
        if mapped:
            logger.debug(f"Mapped Element14 lifecycle code {numeric_code} -> {mapped}")
            return mapped
        else:
            logger.warning(f"Unknown Element14 lifecycle code: {numeric_code}")
            return None

    # Convert to lowercase for text-based matching
    value_str = value_str.lower()

    # Active production (includes new releases, volume production)
    if any(x in value_str for x in ['active', 'production', 'new release', 'volume production', 'in production']):
        return 'active'

    # NRND (Not Recommended for New Designs)
    if any(x in value_str for x in ['nrnd', 'not recommended', 'not for new design']):
        return 'nrnd'

    # EOL (End of Life, Last Time Buy)
    if any(x in value_str for x in ['eol', 'end of life', 'last time buy', 'ltb', 'last buy']):
        return 'eol'

    # Obsolete/Discontinued
    if any(x in value_str for x in ['obsolete', 'discontinued']):
        return 'obsolete'

    # Preview/Engineering Sample
    if any(x in value_str for x in ['preview', 'engineering sample', 'sample', 'pre-production']):
        return 'preview'

    # Contact manufacturer
    if ('contact' in value_str and 'manufacturer' in value_str) or 'contact mfr' in value_str:
        return 'contact_manufacturer'

    # Unknown status - log warning
    logger.warning(f"Unknown lifecycle status: '{value}' - returning as-is")
    return value_str


def normalize_rohs_status(value: Optional[str]) -> Optional[str]:
    """
    Normalize RoHS compliance status.

    Examples:
        "RoHS Compliant" -> "compliant"
        "Non-Compliant" -> "non_compliant"
        "Exempt" -> "exempt"

    Args:
        value: RoHS status string

    Returns:
        Normalized status or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    # Check explicit non-compliant variants first so "Non-Compliant"
    # is not misclassified as compliant.
    if 'non' in value_str or value_str in ('no', 'n'):
        return 'non_compliant'
    if 'compliant' in value_str or value_str in ('yes', 'y'):
        return 'compliant'
    if 'exempt' in value_str:
        return 'exempt'

    return value_str


def normalize_mounting_type(value: Optional[str]) -> Optional[str]:
    """
    Normalize mounting type.

    Examples:
        "Surface Mount" -> "smt"
        "Through Hole" -> "through_hole"
        "Chassis Mount" -> "chassis"

    Args:
        value: Mounting type string

    Returns:
        Normalized mounting type or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    if 'surface' in value_str or 'smt' in value_str or 'smd' in value_str:
        return 'smt'
    # Treat THT (Through-Hole Technology) as through-hole as well
    elif 'through' in value_str or 'thru' in value_str or 'dip' in value_str or value_str == 'tht':
        return 'through_hole'
    elif 'chassis' in value_str or 'panel' in value_str:
        return 'chassis'

    return value_str


def normalize_package_type(value: Optional[str]) -> Optional[str]:
    """
    Normalize package type.

    Examples:
        "sot-23" -> "SOT-23"
        "TQFP-64" -> "TQFP-64"
        "dip8" -> "DIP-8"

    Args:
        value: Package type string

    Returns:
        Normalized package type or None
    """
    if not value:
        return None

    value_str = str(value).strip().upper()

    # Clean up spacing and dashes
    value_str = re.sub(r'([A-Z]+)(\d+)', r'\1-\2', value_str)

    return value_str if len(value_str) <= 20 else None


def normalize_operating_temperature(value: Optional[str]) -> Optional[Dict[str, float]]:
    """
    Normalize operating temperature range.

    Examples:
        "-40°C to 85°C" -> {"min": -40.0, "max": 85.0}
        "-55 to 125C" -> {"min": -55.0, "max": 125.0}

    Args:
        value: Temperature range string

    Returns:
        Dict with min/max temps in Celsius or None
    """
    if not value:
        return None

    # Work with a cleaned string so unit markers don't confuse the
    # numeric range extraction.
    raw_str = str(value).strip()
    value_str = raw_str.upper()

    # Strip degree symbols and unit letters (C/F)
    value_str = value_str.replace('°', '')
    value_str = value_str.replace('C', '').replace('F', '')

    # Extract range (-40 to 85, -40~85, -40 TO +85, etc.)
    # Allow optional leading '+' or '-' on both bounds.
    match = re.search(r'([+-]?\d+)\s*(?:TO|~|\.\.|-)?\s*([+-]?\d+)', value_str)
    if match:
        try:
            temp_min = float(match.group(1))
            temp_max = float(match.group(2))
            return {"min": temp_min, "max": temp_max}
        except ValueError:
            pass

    return None


def normalize_dcr(value: Optional[str]) -> Optional[float]:
    """
    Normalize DC Resistance (DCR) to Ohms.

    Examples:
        "50mΩ" -> 0.05
        "1.5Ω" -> 1.5

    Args:
        value: DCR value with unit

    Returns:
        DCR in Ohms or None
    """
    # DCR is just resistance
    return normalize_resistance(value)


def normalize_saturation_current(value: Optional[str]) -> Optional[float]:
    """
    Normalize saturation current to Amperes.

    Examples:
        "5A" -> 5.0
        "500mA" -> 0.5

    Args:
        value: Saturation current with unit

    Returns:
        Current in Amperes or None
    """
    # Saturation current is just current
    return normalize_current(value)


def normalize_gender(value: Optional[str]) -> Optional[str]:
    """
    Normalize connector gender.

    Examples:
        "Male" -> "male"
        "Female" -> "female"
        "Receptacle" -> "female"

    Args:
        value: Gender string

    Returns:
        Normalized gender or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    # Check for female first so "female" does not match the
    # substring "male".
    if 'female' in value_str or 'receptacle' in value_str or 'socket' in value_str:
        return 'female'
    if 'male' in value_str or 'plug' in value_str or 'pin' in value_str:
        return 'male'

    return value_str


def normalize_contact_material(value: Optional[str]) -> Optional[str]:
    """
    Normalize contact material.

    Examples:
        "Gold Plated" -> "gold"
        "Tin over Copper" -> "tin"

    Args:
        value: Contact material string

    Returns:
        Normalized material or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    if 'gold' in value_str:
        return 'gold'
    elif 'tin' in value_str:
        return 'tin'
    elif 'silver' in value_str:
        return 'silver'
    elif 'copper' in value_str:
        return 'copper'

    return value_str


def normalize_insulation_material(value: Optional[str]) -> Optional[str]:
    """
    Normalize insulation material for wire/cable.

    Examples:
        "PVC" -> "pvc"
        "Teflon (PTFE)" -> "ptfe"

    Args:
        value: Insulation material string

    Returns:
        Normalized material or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    if 'ptfe' in value_str or 'teflon' in value_str:
        return 'ptfe'
    elif 'pvc' in value_str:
        return 'pvc'
    elif 'silicone' in value_str:
        return 'silicone'
    elif 'pe' in value_str or 'polyethylene' in value_str:
        return 'polyethylene'

    return value_str


def normalize_wavelength(value: Optional[str]) -> Optional[float]:
    """
    Normalize wavelength to nanometers.

    Examples:
        "850nm" -> 850.0
        "1.55µm" -> 1550.0

    Args:
        value: Wavelength with unit

    Returns:
        Wavelength in nanometers or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*([ΜU]?M|NM)', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Convert to nanometers
    if unit == 'NM':
        return number
    elif unit in ['ΜM', 'UM']:  # micrometers
        return number * 1000.0
    elif unit == 'M':  # meters
        return number * 1e9

    return None


def normalize_luminous_intensity(value: Optional[str]) -> Optional[float]:
    """
    Normalize luminous intensity to millicandelas (mcd).

    Examples:
        "500mcd" -> 500.0
        "2cd" -> 2000.0

    Args:
        value: Luminous intensity with unit

    Returns:
        Intensity in millicandelas or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*(M?CD)', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Convert to mcd
    if unit == 'MCD':
        return number
    elif unit == 'CD':
        return number * 1000.0

    return None


def normalize_vce_sat(value: Optional[str]) -> Optional[float]:
    """
    Normalize VCE saturation voltage for transistors.

    Examples:
        "0.3V" -> 0.3
        "300mV" -> 0.3

    Args:
        value: VCE sat voltage with unit

    Returns:
        Voltage in Volts or None
    """
    # VCE sat is just voltage
    return normalize_voltage(value)


def normalize_gate_charge(value: Optional[str]) -> Optional[float]:
    """
    Normalize gate charge to nanocoulombs (nC).

    Examples:
        "50nC" -> 50.0
        "5pC" -> 0.005

    Args:
        value: Gate charge with unit

    Returns:
        Gate charge in nC or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*([PMN]?)C', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Convert to nC
    multipliers = {
        'P': 0.001,  # pico to nano
        'N': 1.0,    # nano
        'M': 1000.0, # micro to nano
        '': 1e9      # coulombs to nano
    }

    return number * multipliers.get(unit, 1.0)


def normalize_msl(value: Optional[str]) -> Optional[int]:
    """
    Normalize Moisture Sensitivity Level (MSL).

    Examples:
        "MSL 3" -> 3
        "Level 1" -> 1

    Args:
        value: MSL string

    Returns:
        MSL level (1-6) or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value
    match = re.search(r'(\d+)', value_str)
    if not match:
        return None

    try:
        msl = int(match.group(1))
        # Validate MSL range (1-6)
        if 1 <= msl <= 6:
            return msl
    except ValueError:
        pass

    return None


def normalize_lead_time(value: Optional[str]) -> Optional[int]:
    """
    Normalize lead time to days.

    Examples:
        "14 days" -> 14
        "6-8 weeks" -> 49 (average of range in days)
        "Stock" -> 0

    Args:
        value: Lead time string

    Returns:
        Lead time in days or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    # Stock items = 0 days
    if 'stock' in value_str or 'immediate' in value_str:
        return 0

    # Extract days
    day_match = re.search(r'(\d+)\s*(?:day|d\b)', value_str)
    if day_match:
        return int(day_match.group(1))

    # Extract weeks (convert to days)
    week_match = re.search(r'(\d+)(?:\s*-\s*(\d+))?\s*(?:week|wk)', value_str)
    if week_match:
        weeks_min = int(week_match.group(1))
        weeks_max = int(week_match.group(2)) if week_match.group(2) else weeks_min
        return int((weeks_min + weeks_max) / 2 * 7)  # Average in days

    # Extract just number (assume days)
    num_match = re.search(r'(\d+)', value_str)
    if num_match:
        return int(num_match.group(1))

    return None


def normalize_moq(value: Optional[str]) -> Optional[int]:
    """
    Normalize Minimum Order Quantity (MOQ).

    Examples:
        "100 pcs" -> 100
        "1,000" -> 1000
        "1" -> 1

    Args:
        value: MOQ string

    Returns:
        MOQ as integer or None
    """
    if not value:
        return None

    # Work in lowercase for easier token stripping
    value_str = str(value).lower()

    # Remove common text tokens
    for token in ['pcs', 'pieces', 'piece', 'moq', ':']:
        value_str = value_str.replace(token, '')

    # Remove commas and surrounding whitespace
    value_str = value_str.replace(',', '').strip()

    # Extract first integer from remaining string
    match = re.search(r'(\d+)', value_str)
    if not match:
        return None

    try:
        return int(match.group(1))
    except ValueError:
        return None


def normalize_packaging_type(value: Optional[str]) -> Optional[str]:
    """
    Normalize packaging type.

    Examples:
        "Tape and Reel" -> "tape_and_reel"
        "Cut Tape" -> "cut_tape"
        "Tray" -> "tray"

    Args:
        value: Packaging type string

    Returns:
        Normalized packaging type or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    # Handle common synonyms for tape & reel, including "T&R"
    compact = value_str.replace(' ', '')
    if ('tape' in value_str and 'reel' in value_str) or 't&r' in compact:
        return 'tape_and_reel'
    elif 'cut' in value_str and 'tape' in value_str:
        return 'cut_tape'
    elif 'tray' in value_str:
        return 'tray'
    elif 'tube' in value_str:
        return 'tube'
    elif 'bulk' in value_str:
        return 'bulk'
    elif 'reel' in value_str:
        return 'reel'

    return value_str


def normalize_conductor_count(value: Optional[str]) -> Optional[int]:
    """
    Normalize number of conductors for wire/cable.

    Examples:
        "4 Conductors" -> 4
        "24-conductor" -> 24

    Args:
        value: Conductor count string

    Returns:
        Number of conductors or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    # Extract numeric value
    match = re.search(r'(\d+)', value_str)
    if not match:
        return None

    try:
        return int(match.group(1))
    except ValueError:
        return None


def normalize_conductor_material(value: Optional[str]) -> Optional[str]:
    """
    Normalize conductor material for wire/cable.

    Examples:
        "Bare Copper" -> "copper"
        "Tinned Copper" -> "tinned_copper"
        "Aluminum" -> "aluminum"

    Args:
        value: Conductor material string

    Returns:
        Normalized material or None
    """
    if not value:
        return None

    value_str = str(value).lower().strip()

    if 'tinned' in value_str and 'copper' in value_str:
        return 'tinned_copper'
    elif 'copper' in value_str:
        return 'copper'
    elif 'aluminum' in value_str or 'aluminium' in value_str:
        return 'aluminum'
    elif 'silver' in value_str:
        return 'silver'

    return value_str


def normalize_rds_on(value: Optional[str]) -> Optional[float]:
    """
    Normalize RDS(on) - drain-source on-resistance for MOSFETs.

    Examples:
        "50mΩ" -> 0.05
        "1.5Ω" -> 1.5

    Args:
        value: RDS(on) value with unit

    Returns:
        Resistance in Ohms or None
    """
    # RDS(on) is just resistance
    return normalize_resistance(value)


def normalize_switching_frequency(value: Optional[str]) -> Optional[float]:
    """
    Normalize switching frequency to Hertz.

    Examples:
        "100kHz" -> 100000.0
        "1MHz" -> 1000000.0

    Args:
        value: Frequency with unit

    Returns:
        Frequency in Hz or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value and unit
    match = re.match(r'([\d.]+)\s*(K|M|G)?HZ?', value_str)
    if not match:
        return None

    number_str, unit = match.groups()

    try:
        number = float(number_str)
    except ValueError:
        return None

    # Apply unit multiplier
    multipliers = {
        'K': 1e3,    # kilo
        'M': 1e6,    # mega
        'G': 1e9,    # giga
        '': 1.0      # Hz
    }

    return number * multipliers.get(unit or '', 1.0)


def normalize_efficiency(value: Optional[str]) -> Optional[float]:
    """
    Normalize efficiency to percentage.

    Examples:
        "85%" -> 85.0
        "0.92" -> 92.0
        "95" -> 95.0

    Args:
        value: Efficiency value

    Returns:
        Efficiency as percentage or None
    """
    if not value:
        return None

    value_str = str(value).strip().replace('%', '').strip()

    try:
        number = float(value_str)
        # If value is between 0-1, assume it's a ratio (convert to percentage)
        if 0 < number <= 1:
            return number * 100
        # If value is already percentage (1-100)
        elif 1 < number <= 100:
            return number
    except ValueError:
        pass

    return None


def normalize_color_temperature(value: Optional[str]) -> Optional[int]:
    """
    Normalize color temperature for LEDs to Kelvin.

    Examples:
        "3000K" -> 3000
        "Warm White (2700K)" -> 2700

    Args:
        value: Color temperature string

    Returns:
        Temperature in Kelvin or None
    """
    if not value:
        return None

    value_str = str(value).upper().strip()

    # Extract numeric value (look for K)
    match = re.search(r'(\d+)\s*K', value_str)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass

    return None


def normalize_price_breaks(price_breaks: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Normalize price breaks array from vendor APIs.

    Handles various formats:
    - Mouser: [{"Quantity": "100", "Price": "$1.50", "Currency": "USD"}]
    - DigiKey: [{"BreakQuantity": 100, "UnitPrice": 1.5}]
    - Generic: [{"qty": 100, "price": 1.5}]

    Args:
        price_breaks: Raw price breaks array from vendor API

    Returns:
        Normalized price breaks: [{"quantity": 100, "unit_price": Decimal("1.50"), "currency": "USD"}]
    """
    if not price_breaks or not isinstance(price_breaks, list):
        return []

    normalized_breaks = []

    for break_point in price_breaks:
        if not isinstance(break_point, dict):
            continue

        # Extract quantity (various field names)
        qty = (
            break_point.get('quantity') or
            break_point.get('qty') or
            break_point.get('Quantity') or
            break_point.get('BreakQuantity')
        )

        # Extract price (various field names)
        price = (
            break_point.get('unit_price') or
            break_point.get('price') or
            break_point.get('Price') or
            break_point.get('UnitPrice')
        )

        # Extract currency
        currency = break_point.get('currency') or break_point.get('Currency') or 'USD'

        # Normalize values
        normalized_qty = normalize_quantity(qty)
        normalized_price = normalize_price(price, currency)

        if normalized_qty and normalized_price:
            normalized_breaks.append({
                'quantity': normalized_qty,
                'unit_price': normalized_price,
                'currency': currency
            })

    logger.debug(f"Normalized {len(normalized_breaks)} price breaks from {len(price_breaks)} raw entries")

    return normalized_breaks


def normalize_vendor_parameters(parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract and normalize vendor-specific parameters from nested dict.

    Maps vendor field names to canonical names and applies appropriate normalizers.

    Args:
        parameters: Raw parameters dict from vendor API
            Example (DigiKey):
            {
                "Operating Temperature": "-40°C ~ 85°C",
                "Supply Voltage - Min": "2.7V",
                "Supply Voltage - Max": "3.6V",
                "Package / Case": "LQFP-100",
                "Resistance": "10K"
            }

    Returns:
        Normalized parameters dict with canonical field names and normalized values
    """
    if not parameters or not isinstance(parameters, dict):
        return {}

    normalized = {}

    # Vendor parameter name mappings (field_name_lowercase → (canonical_name, normalizer_function))
    PARAM_MAPPINGS = {
        # Temperature
        'operating temperature': ('temp_range', normalize_operating_temperature),
        'operating_temperature': ('temp_range', normalize_operating_temperature),
        'operating temp': ('temp_range', normalize_operating_temperature),
        'temp range': ('temp_range', normalize_operating_temperature),
        'temp_range': ('temp_range', normalize_operating_temperature),
        'temperature range': ('temp_range', normalize_operating_temperature),
        'temperature_range': ('temp_range', normalize_operating_temperature),
        'storage temperature': ('storage_temperature', normalize_operating_temperature),
        'storage_temperature': ('storage_temperature', normalize_operating_temperature),

        # Voltage
        'supply voltage': ('voltage', normalize_voltage),
        'supply_voltage': ('voltage', normalize_voltage),
        'supply voltage - min': ('voltage_min', normalize_voltage),
        'supply voltage - max': ('voltage_max', normalize_voltage),
        'vcc': ('voltage', normalize_voltage),
        'vdd': ('voltage', normalize_voltage),
        'voltage rating': ('voltage', normalize_voltage),
        'voltage - rated': ('voltage', normalize_voltage),
        'operating voltage': ('voltage', normalize_voltage),
        'forward voltage': ('forward_voltage', normalize_forward_voltage),
        'reverse voltage': ('reverse_voltage', normalize_reverse_voltage),
        # Semiconductor-specific voltages
        'gate threshold voltage': ('gate_threshold_voltage', normalize_voltage),
        'gate-threshold voltage': ('gate_threshold_voltage', normalize_voltage),
        'gate_threshold_voltage': ('gate_threshold_voltage', normalize_voltage),
        'vgs(th)': ('gate_threshold_voltage', normalize_voltage),
        'vgs th': ('gate_threshold_voltage', normalize_voltage),
        'collector emitter voltage': ('collector_emitter_voltage', normalize_voltage),
        'collector-emitter voltage': ('collector_emitter_voltage', normalize_voltage),
        'collector_emitter_voltage': ('collector_emitter_voltage', normalize_voltage),
        'vce': ('collector_emitter_voltage', normalize_voltage),
        'vce(sat)': ('collector_emitter_voltage', normalize_voltage),

        # Current
        'current': ('current', normalize_current),
        'current rating': ('current', normalize_current),
        'current - max': ('current', normalize_current),
        'forward current': ('current', normalize_current),
        'saturation current': ('saturation_current', normalize_saturation_current),

        # Resistance
        'resistance': ('resistance', normalize_resistance),
        'resistance (ohms)': ('resistance', normalize_resistance),
        'esr': ('esr', normalize_esr),
        'dcr': ('dcr', normalize_dcr),
        'rds(on)': ('rds_on', normalize_rds_on),
        'rds on': ('rds_on', normalize_rds_on),

        # Capacitance
        'capacitance': ('capacitance', normalize_capacitance),
        'capacitance (f)': ('capacitance', normalize_capacitance),
        'cap': ('capacitance', normalize_capacitance),

        # Inductance
        'inductance': ('inductance', normalize_inductance),

        # Frequency
        'frequency': ('frequency', normalize_switching_frequency),
        'clock frequency': ('frequency', normalize_switching_frequency),
        'operating frequency': ('frequency', normalize_switching_frequency),
        'clock speed': ('frequency', normalize_switching_frequency),
        'cpu frequency': ('frequency', normalize_switching_frequency),
        'max frequency': ('frequency', normalize_switching_frequency),
        'switching frequency': ('switching_frequency', normalize_switching_frequency),
        'switching_frequency': ('switching_frequency', normalize_switching_frequency),
        'fsw': ('switching_frequency', normalize_switching_frequency),

        # Power
        'power': ('power', normalize_power),
        'power rating': ('power', normalize_power),
        'power - max': ('power', normalize_power),

        # Package
        'package / case': ('package', normalize_package_type),
        'package_/_case': ('package', normalize_package_type),
        'package___case': ('package', normalize_package_type),
        'package/case': ('package', normalize_package_type),
        'package type': ('package', normalize_package_type),
        'package_type': ('package', normalize_package_type),
        'package': ('package', normalize_package_type),
        'mounting type': ('mounting_type', normalize_mounting_type),
        'mounting_type': ('mounting_type', normalize_mounting_type),

        # Physical
        'pin count': ('pin_count', normalize_pin_count),
        'pins': ('pin_count', normalize_pin_count),
        'number of pins': ('pin_count', normalize_pin_count),
        'pitch': ('pitch', normalize_pitch),

        # Tolerance
        'tolerance': ('tolerance', normalize_tolerance),
        'tolerance (%)': ('tolerance', normalize_tolerance),

        # Lifecycle
        'lifecycle status': ('lifecycle_status', normalize_lifecycle_status),
        'part status': ('lifecycle_status', normalize_lifecycle_status),

        # Compliance
        'rohs': ('rohs_status', normalize_rohs_status),
        'rohs status': ('rohs_status', normalize_rohs_status),
        'rohs_status': ('rohs_status', normalize_rohs_status),
        'moisture sensitivity level': ('msl', normalize_msl),
        'msl level': ('msl', normalize_msl),
    }

    for param_name, param_value in parameters.items():
        if param_value is None or param_value == '':
            continue

        param_lower = str(param_name).lower().strip()

        if param_lower in PARAM_MAPPINGS:
            canonical_name, normalizer = PARAM_MAPPINGS[param_lower]
            try:
                normalized_value = normalizer(param_value)
                if normalized_value is not None:
                    normalized[canonical_name] = normalized_value
                    logger.debug(f"Normalized param '{param_name}': '{param_value}' → {canonical_name}={normalized_value}")
            except Exception as e:
                logger.warning(f"Failed to normalize parameter '{param_name}' with value '{param_value}': {e}")
                # Keep original value if normalization fails
                normalized[param_name] = param_value
        else:
            # Keep unmapped parameters as-is (but clean up the key)
            clean_key = param_name.strip().lower().replace(' ', '_').replace('/', '_').replace('-', '_')
            normalized[clean_key] = param_value

    logger.debug(f"Normalized {len(normalized)} parameters from {len(parameters)} raw vendor parameters")

    return normalized


def normalize_component_data(component_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize all fields in a component data dictionary.

    Now supports 40+ parameters across all component categories.

    Args:
        component_data: Raw component data from supplier API

    Returns:
        Normalized component data
    """
    normalized = component_data.copy()

    # Normalize MPN
    if 'mpn' in component_data:
        normalized['mpn'] = normalize_mpn(component_data['mpn'])
        normalized['mpn_normalized'] = normalized['mpn']  # Keep both

    # Normalize manufacturer
    if 'manufacturer' in component_data:
        mfr = component_data['manufacturer']
        if mfr:
            normalized['manufacturer'] = str(mfr).strip().upper()

    # Normalize pricing
    price_fields = ['price', 'unit_price', 'list_price']
    for field in price_fields:
        if field in component_data:
            normalized[field] = normalize_price(component_data[field])

    # Normalize quantity/stock
    quantity_fields = ['stock', 'quantity', 'in_stock', 'available']
    for field in quantity_fields:
        if field in component_data:
            normalized[field] = normalize_quantity(component_data[field])

    # Extract specs from description
    if 'description' in component_data:
        specs = extract_specs_from_description(component_data['description'])
        if specs:
            normalized['extracted_specs'] = specs

    # Normalize ALL specification fields (52+ parameters!)
    spec_normalizers = {
        # Basic electrical (original 5)
        'resistance': normalize_resistance,
        'capacitance': normalize_capacitance,
        'voltage': normalize_voltage,
        'current': normalize_current,
        'power': normalize_power,

        # Additional electrical (9)
        'tolerance': normalize_tolerance,
        'temperature_coefficient': normalize_temperature_coefficient,
        'tempco': normalize_temperature_coefficient,
        'inductance': normalize_inductance,
        'esr': normalize_esr,
        'forward_voltage': normalize_forward_voltage,
        'vf': normalize_forward_voltage,
        'reverse_voltage': normalize_reverse_voltage,
        'vr': normalize_reverse_voltage,
        'dcr': normalize_dcr,
        'saturation_current': normalize_saturation_current,
        'isat': normalize_saturation_current,

        # Mechanical/Physical (7)
        'pin_count': normalize_pin_count,
        'pins': normalize_pin_count,
        'positions': normalize_pin_count,
        'pitch': normalize_pitch,
        'awg': normalize_awg,
        'package': normalize_package_type,
        'package_type': normalize_package_type,

        # Material/Type (8 - added conductor fields)
        'dielectric': normalize_dielectric_type,
        'dielectric_type': normalize_dielectric_type,
        'mounting_type': normalize_mounting_type,
        'gender': normalize_gender,
        'contact_material': normalize_contact_material,
        'insulation': normalize_insulation_material,
        'insulation_material': normalize_insulation_material,
        'conductor_count': normalize_conductor_count,
        'conductors': normalize_conductor_count,
        'conductor_material': normalize_conductor_material,

        # Compliance/Lifecycle (8 - expanded for boolean compliance fields)
        'lifecycle_status': normalize_lifecycle_status,
        'rohs': normalize_rohs_status,
        'rohs_status': normalize_rohs_status,
        # Boolean compliance fields - handle both bool and string values
        'rohs_compliant': lambda x: x if isinstance(x, bool) else (
            True if str(x).lower() in ['yes', 'true', 'compliant', '1']
            else False if str(x).lower() in ['no', 'false', 'non-compliant', '0']
            else None
        ),
        'reach_compliant': lambda x: x if isinstance(x, bool) else (
            True if str(x).lower() in ['yes', 'true', 'compliant', '1']
            else False if str(x).lower() in ['no', 'false', 'non-compliant', '0']
            else None
        ),
        'halogen_free': lambda x: x if isinstance(x, bool) else (
            True if str(x).lower() in ['yes', 'true', 'compliant', '1', 'halogen-free']
            else False if str(x).lower() in ['no', 'false', 'non-compliant', '0']
            else None
        ),
        'aec_qualified': lambda x: x if isinstance(x, bool) else (
            True if str(x).lower() in ['yes', 'true', 'qualified', '1', 'aec-q']
            else False if str(x).lower() in ['no', 'false', 'not qualified', '0']
            else None
        ),
        'msl': normalize_msl,
        'moisture_sensitivity_level': normalize_msl,

        # Manufacturing/Supply Chain (6 - added lead_time_days, availability, eccn_code)
        'lead_time': normalize_lead_time,
        'lead_time_days': lambda x: int(x) if x is not None and str(x).isdigit() else None,  # Pass-through int
        'moq': normalize_moq,
        'minimum_order_quantity': normalize_moq,
        'packaging': normalize_packaging_type,
        'packaging_type': normalize_packaging_type,
        'availability': normalize_quantity,  # Use quantity normalizer for stock availability
        'eccn_code': lambda x: str(x).strip() if x else None,  # Pass-through string (export control)

        # Optoelectronics (3 - added color temp)
        'wavelength': normalize_wavelength,
        'luminous_intensity': normalize_luminous_intensity,
        'color_temperature': normalize_color_temperature,
        'color_temp': normalize_color_temperature,

        # Transistor/MOSFET-specific (4 - added RDS and switching freq)
        'vce_sat': normalize_vce_sat,
        'gate_charge': normalize_gate_charge,
        'qg': normalize_gate_charge,
        'rds_on': normalize_rds_on,
        'rds': normalize_rds_on,
        'switching_frequency': normalize_switching_frequency,
        'fsw': normalize_switching_frequency,

        # Power Supply/Converter (1 new)
        'efficiency': normalize_efficiency,

        # Temperature (1)
        'operating_temperature': normalize_operating_temperature,
        'temp_range': normalize_operating_temperature,
    }

    for field, normalizer in spec_normalizers.items():
        if field in component_data:
            normalized[field] = normalizer(component_data[field])

    # ============================================================================
    # NEW: Normalize price breaks array
    # ============================================================================
    if 'price_breaks' in component_data:
        normalized['price_breaks'] = normalize_price_breaks(component_data['price_breaks'])

    # ============================================================================
    # NEW: Extract and normalize vendor parameters from nested dict
    # ============================================================================
    if 'parameters' in component_data and isinstance(component_data['parameters'], dict):
        vendor_params = normalize_vendor_parameters(component_data['parameters'])
        # Merge normalized vendor params into extracted_specs
        if vendor_params:
            normalized['extracted_specs'] = {
                **normalized.get('extracted_specs', {}),
                **vendor_params
            }

    return normalized


# ===================================
# Validation Helpers
# ===================================

def validate_normalized_data(data: Dict[str, Any]) -> List[str]:
    """
    Validate normalized component data and return list of issues.

    Args:
        data: Normalized component data

    Returns:
        List of validation error/warning messages (empty if valid)
    """
    issues = []

    # Check for required fields
    if not data.get('mpn'):
        issues.append("Missing required field: mpn")

    # Validate price is positive
    if 'price' in data and data['price'] is not None:
        if data['price'] <= 0:
            issues.append(f"Invalid price: {data['price']} (must be positive)")

    # Validate quantity is non-negative
    if 'stock' in data and data['stock'] is not None:
        if data['stock'] < 0:
            issues.append(f"Invalid stock: {data['stock']} (must be non-negative)")

    return issues
