"""
BOM File Parser

Parses CSV and Excel BOM files into structured component data.
"""

import io
import csv
import logging
from typing import List, Dict, Any
import pandas as pd

logger = logging.getLogger(__name__)


def parse_bom_file(content: bytes, file_ext: str) -> List[Dict[str, Any]]:
    """
    Parse BOM file into list of component dictionaries

    Supports CSV, Excel (.xlsx, .xls) formats.

    Expected columns (case-insensitive, flexible):
    - MPN / Part Number / Manufacturer Part Number (required)
    - Manufacturer / Mfg / Mfr (optional)
    - Quantity / Qty (optional)
    - Reference Designators / RefDes / Designator (optional)
    - Description (optional)

    Args:
        content: File content as bytes
        file_ext: File extension ('csv', 'xlsx', 'xls')

    Returns:
        List of component dictionaries with normalized keys:
        [
            {
                "mpn": "STM32F407VGT6",
                "manufacturer": "STMicroelectronics",
                "quantity": 10,
                "reference_designators": "U1,U2,U3",
                "description": "ARM MCU"
            },
            ...
        ]

    Raises:
        ValueError: If file cannot be parsed or no valid items found
    """
    if file_ext == 'csv':
        return _parse_csv(content)
    elif file_ext in ['xlsx', 'xls']:
        return _parse_excel(content, file_ext)
    else:
        raise ValueError(f"Unsupported file extension: {file_ext}")


def _parse_csv(content: bytes) -> List[Dict[str, Any]]:
    """Parse CSV file"""
    try:
        # Try UTF-8 first, then fallback to latin-1
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            text = content.decode('latin-1')

        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(text))
        rows = list(csv_reader)

        if not rows:
            raise ValueError("CSV file is empty")

        # Normalize column headers
        normalized_rows = []
        for row in rows:
            normalized_row = _normalize_row(row)
            if normalized_row:  # Skip empty rows
                normalized_rows.append(normalized_row)

        if not normalized_rows:
            raise ValueError("No valid rows found in CSV")

        logger.info(f"✅ Parsed CSV: {len(normalized_rows)} items")
        return normalized_rows

    except Exception as e:
        raise ValueError(f"CSV parsing error: {e}")


def _parse_excel(content: bytes, file_ext: str) -> List[Dict[str, Any]]:
    """Parse Excel file"""
    try:
        # Read Excel file
        df = pd.read_excel(io.BytesIO(content), engine='openpyxl' if file_ext == 'xlsx' else 'xlrd')

        if df.empty:
            raise ValueError("Excel file is empty")

        # Convert to list of dictionaries
        rows = df.to_dict('records')

        # Normalize rows
        normalized_rows = []
        for row in rows:
            normalized_row = _normalize_row(row)
            if normalized_row:
                normalized_rows.append(normalized_row)

        if not normalized_rows:
            raise ValueError("No valid rows found in Excel file")

        logger.info(f"✅ Parsed Excel: {len(normalized_rows)} items")
        return normalized_rows

    except Exception as e:
        raise ValueError(f"Excel parsing error: {e}")


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize row column names to standard keys

    Maps various column names to standard keys:
    - mpn
    - manufacturer
    - quantity
    - reference_designators
    - description

    Args:
        row: Raw row dictionary from CSV/Excel

    Returns:
        Normalized dictionary or None if invalid
    """
    normalized = {}

    # Map column names (case-insensitive)
    column_mappings = {
        'mpn': ['mpn', 'part number', 'part_number', 'partnumber', 'manufacturer part number', 'mfg part number', 'p/n'],
        'manufacturer': ['manufacturer', 'mfg', 'mfr', 'manufacturer name'],
        'quantity': ['quantity', 'qty', 'count'],
        'reference_designators': ['reference designators', 'refdes', 'designator', 'ref', 'references'],
        'description': ['description', 'desc', 'part description'],
        'category': ['category', 'part category', 'type'],
        'datasheet_url': ['datasheet', 'datasheet url', 'datasheet_url'],
        'price': ['price', 'unit price', 'cost'],
    }

    # Create lowercase key lookup
    lowercase_row = {k.lower().strip() if isinstance(k, str) else str(k): v for k, v in row.items()}

    # Map each field
    for standard_key, possible_names in column_mappings.items():
        for name in possible_names:
            if name in lowercase_row:
                value = lowercase_row[name]
                # Skip NaN, None, empty strings
                if pd.notna(value) and value != '' and str(value).strip():
                    normalized[standard_key] = _clean_value(value)
                    break

    # MPN is required
    if 'mpn' not in normalized:
        return None

    return normalized


def _clean_value(value: Any) -> Any:
    """
    Clean and convert value to appropriate type

    Args:
        value: Raw value from CSV/Excel

    Returns:
        Cleaned value
    """
    if pd.isna(value):
        return None

    # Convert to string and strip whitespace
    if isinstance(value, str):
        return value.strip()

    # Convert numbers to appropriate types
    if isinstance(value, (int, float)):
        # If it's a whole number, return as int
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    return str(value).strip()


def validate_bom_structure(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate BOM structure and return statistics

    Args:
        items: List of parsed BOM items

    Returns:
        Validation statistics:
        {
            "total_items": 100,
            "valid_items": 95,
            "missing_mpn": 5,
            "has_manufacturer": 90,
            "has_quantity": 85,
            "has_description": 70
        }
    """
    total = len(items)
    missing_mpn = sum(1 for item in items if not item.get('mpn'))
    has_manufacturer = sum(1 for item in items if item.get('manufacturer'))
    has_quantity = sum(1 for item in items if item.get('quantity'))
    has_description = sum(1 for item in items if item.get('description'))

    return {
        "total_items": total,
        "valid_items": total - missing_mpn,
        "missing_mpn": missing_mpn,
        "has_manufacturer": has_manufacturer,
        "has_quantity": has_quantity,
        "has_description": has_description,
        "completeness_score": round((has_manufacturer + has_quantity + has_description) / (total * 3) * 100, 1)
    }
