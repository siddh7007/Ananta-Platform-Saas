"""
Enhanced BOM File Parser with V1 Features

Supports:
- Multiple file formats: CSV, Excel (.xlsx, .xls), TXT (plain text)
- International encodings: UTF-8, Latin-1, GB2312 (Chinese), Shift-JIS (Japanese), CP1252, ISO-8859-1
- CSV dialect auto-detection: comma, semicolon, tab delimiters
- Regex-based column pattern matching for various CAD tools (Altium, KiCad, Eagle)
- Vendor SKU detection (DigiKey, Mouser, Element14)
- Import statistics tracking
"""

import csv
import re
import logging
from typing import List, Dict, Any, Optional
from io import StringIO, BytesIO
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class BOMParseStats:
    """Statistics from BOM parsing operation"""
    total_rows: int = 0
    valid_rows: int = 0
    skipped_rows: int = 0
    encoding_used: Optional[str] = None
    dialect_detected: Optional[str] = None
    vendor_skus_detected: Dict[str, int] = None

    def __post_init__(self):
        if self.vendor_skus_detected is None:
            self.vendor_skus_detected = {}


class BOMParseError(Exception):
    """Raised when BOM file parsing fails"""
    pass


class EnhancedBOMParser:
    """
    Enhanced BOM parser with V1 production features.

    Features:
    - International encoding support (7 encodings)
    - CSV dialect auto-detection
    - Excel .xls and .xlsx support
    - Plain text format support
    - Vendor SKU detection
    - Regex-based column pattern matching
    """

    # International encoding list (UTF-8, Latin-1, Chinese, Japanese, Windows encodings)
    ENCODINGS = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1', 'gb2312', 'shift-jis']

    # Regex patterns for column auto-detection (supports various CAD tools)
    COLUMN_PATTERNS = {
        'part_number': [
            r'^part[\s_-]?number$',
            r'^mpn$',
            r'^p[\s/-]?n$',
            r'^manufacturer[\s_-]?part[\s_-]?number$',
            r'^mfr[\s_-]?p[\s/-]?n$',
            r'^part$',
            r'^component$',
            r'^device$',
        ],
        'manufacturer': [
            r'^manufacturer$',
            r'^mfr$',
            r'^mfg$',
            r'^vendor$',
            r'^supplier$',
        ],
        'quantity': [
            r'^quantity$',
            r'^qty$',
            r'^qnty$',
            r'^amount$',
            r'^count$',
        ],
        'reference': [
            r'^reference$',
            r'^ref[\s_-]?des$',
            r'^designator$',
            r'^ref$',
            r'^reference[\s_-]?designator$',
            r'^component[\s_-]?reference$',
        ],
        'description': [
            r'^description$',
            r'^desc$',
            r'^name$',
        ],
        'value': [
            r'^value$',
            r'^val$',
        ],
        'package': [
            r'^package$',
            r'^footprint$',
            r'^case$',
        ],
        'datasheet': [
            r'^datasheet$',
            r'^datasheet[\s_-]?url$',
        ],
        'category': [
            r'^category$',
            r'^type$',
            r'^class$',
        ],
    }

    # Vendor SKU detection patterns
    VENDOR_PATTERNS = {
        'digikey': r'-\d*ND$',  # e.g., 296-1234-1-ND, STM32-ND
        'mouser': r'^\d{2,3}-',  # e.g., 511-STM32, 595-TPS54340
        'element14': r'^\d{6,8}$',  # e.g., 2063182, 12345678
        'arrow': r'^ARROW-',  # e.g., ARROW-STM32F407
        'avnet': r'^AV-',  # e.g., AV-12345
    }

    def __init__(self, file_content: bytes, filename: str):
        """
        Initialize enhanced BOM parser.

        Args:
            file_content: Raw file bytes
            filename: Original filename (used to detect format)
        """
        self.file_content = file_content
        self.filename = filename.lower()
        self.file_type = self._detect_file_type()
        self.stats = BOMParseStats()

    def _detect_file_type(self) -> str:
        """Detect file type from filename extension"""
        if self.filename.endswith('.csv'):
            return 'csv'
        elif self.filename.endswith('.xlsx'):
            return 'xlsx'
        elif self.filename.endswith('.xls'):
            return 'xls'
        elif self.filename.endswith('.txt'):
            return 'txt'
        else:
            # Try to detect from content
            try:
                self.file_content.decode('utf-8')
                return 'txt'  # Assume plain text if decodable
            except UnicodeDecodeError:
                raise BOMParseError(f"Unsupported file type: {self.filename}")

    def parse(self) -> tuple[List[Dict[str, Any]], BOMParseStats]:
        """
        Parse the BOM file and extract part numbers.

        Returns:
            Tuple of (parsed items, statistics)
        """
        if self.file_type == 'csv':
            items = self._parse_csv()
        elif self.file_type == 'xlsx':
            items = self._parse_excel_xlsx()
        elif self.file_type == 'xls':
            items = self._parse_excel_xls()
        elif self.file_type == 'txt':
            items = self._parse_txt()
        else:
            raise BOMParseError(f"Unsupported file type: {self.file_type}")

        # Update stats
        self.stats.total_rows = len(items) + self.stats.skipped_rows
        self.stats.valid_rows = len(items)

        # Detect vendor SKUs in parsed items
        self._detect_vendor_skus(items)

        return items, self.stats

    def _decode_with_fallback(self, content: bytes) -> tuple[str, str]:
        """
        Try multiple encodings to decode content.

        Returns:
            Tuple of (decoded content, encoding used)
        """
        for encoding in self.ENCODINGS:
            try:
                decoded = content.decode(encoding)
                logger.info(f"✅ Decoded with {encoding} encoding")
                return decoded, encoding
            except (UnicodeDecodeError, LookupError):
                continue

        raise BOMParseError(f"Could not decode file with any known encoding: {', '.join(self.ENCODINGS)}")

    def _parse_csv(self) -> List[Dict[str, Any]]:
        """Parse CSV file with dialect auto-detection"""
        try:
            # Decode with international encoding support
            content, encoding = self._decode_with_fallback(self.file_content)
            self.stats.encoding_used = encoding

            # Detect CSV dialect (comma, semicolon, tab)
            sample = content[:4096]
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
                self.stats.dialect_detected = f"delimiter={repr(dialect.delimiter)}"
                logger.info(f"✅ Detected CSV dialect: {self.stats.dialect_detected}")
            except csv.Error:
                dialect = csv.excel  # Default to comma-separated
                self.stats.dialect_detected = "default (comma)"

            # Parse CSV
            reader = csv.DictReader(StringIO(content), dialect=dialect)
            rows = list(reader)

            if not rows:
                raise BOMParseError("CSV file is empty")

            # Auto-detect column mappings
            column_map = self._detect_columns(rows[0].keys())

            # Extract part numbers
            return self._extract_parts(rows, column_map)

        except Exception as e:
            logger.error(f"❌ CSV parse error: {e}")
            raise BOMParseError(f"Failed to parse CSV: {str(e)}")

    def _parse_excel_xlsx(self) -> List[Dict[str, Any]]:
        """Parse Excel .xlsx file"""
        try:
            import openpyxl
        except ImportError:
            raise BOMParseError("openpyxl library required for .xlsx parsing. Install with: pip install openpyxl")

        try:
            # Load workbook
            workbook = openpyxl.load_workbook(BytesIO(self.file_content), read_only=True)
            sheet = workbook.active

            # Read all rows
            rows_raw = list(sheet.iter_rows(values_only=True))

            if not rows_raw or len(rows_raw) < 2:
                raise BOMParseError("Excel file is empty or has no data rows")

            # First row is header
            headers = [str(cell).strip() if cell else f"Column{i}" for i, cell in enumerate(rows_raw[0])]

            # Convert to list of dicts
            rows = []
            for row_values in rows_raw[1:]:
                if not any(row_values):  # Skip completely empty rows
                    self.stats.skipped_rows += 1
                    continue
                row_dict = {headers[i]: (row_values[i] if i < len(row_values) else None)
                           for i in range(len(headers))}
                rows.append(row_dict)

            if not rows:
                raise BOMParseError("Excel file has no data rows")

            # Auto-detect column mappings
            column_map = self._detect_columns(headers)

            # Extract part numbers
            return self._extract_parts(rows, column_map)

        except Exception as e:
            logger.error(f"❌ Excel .xlsx parse error: {e}")
            raise BOMParseError(f"Failed to parse Excel .xlsx: {str(e)}")

    def _parse_excel_xls(self) -> List[Dict[str, Any]]:
        """Parse Excel .xls file (legacy format)"""
        try:
            import xlrd
        except ImportError:
            raise BOMParseError("xlrd library required for .xls parsing. Install with: pip install xlrd")

        try:
            # Load workbook
            workbook = xlrd.open_workbook(file_contents=self.file_content)
            sheet = workbook.sheet_by_index(0)

            if sheet.nrows < 2:
                raise BOMParseError("Excel file is empty or has no data rows")

            # First row is header
            headers = [str(sheet.cell_value(0, col)).strip() or f"Column{col}"
                      for col in range(sheet.ncols)]

            # Convert to list of dicts
            rows = []
            for row_idx in range(1, sheet.nrows):
                row_values = [sheet.cell_value(row_idx, col) for col in range(sheet.ncols)]

                # Skip completely empty rows
                if not any(row_values):
                    self.stats.skipped_rows += 1
                    continue

                row_dict = {headers[i]: row_values[i] for i in range(len(headers))}
                rows.append(row_dict)

            if not rows:
                raise BOMParseError("Excel file has no data rows")

            # Auto-detect column mappings
            column_map = self._detect_columns(headers)

            # Extract part numbers
            return self._extract_parts(rows, column_map)

        except Exception as e:
            logger.error(f"❌ Excel .xls parse error: {e}")
            raise BOMParseError(f"Failed to parse Excel .xls: {str(e)}")

    def _parse_txt(self) -> List[Dict[str, Any]]:
        """Parse plain text file (one part number per line)"""
        try:
            # Decode with international encoding support
            content, encoding = self._decode_with_fallback(self.file_content)
            self.stats.encoding_used = encoding

            # Split into lines and clean
            lines = content.splitlines()
            part_numbers = []

            for line_num, line in enumerate(lines, start=1):
                line = line.strip()

                # Skip empty lines and comments
                if not line or line.startswith('#') or line.startswith('//'):
                    self.stats.skipped_rows += 1
                    continue

                # Extract first word/token as part number
                # Supports formats: "STM32F407VGT6" or "STM32F407VGT6,10" or "STM32F407VGT6 10"
                parts = re.split(r'[,\s\t]+', line, maxsplit=2)
                part_number = parts[0].strip()

                if not part_number:
                    self.stats.skipped_rows += 1
                    continue

                # Optional quantity (second token)
                quantity = None
                if len(parts) > 1:
                    try:
                        quantity = int(parts[1].strip())
                    except (ValueError, AttributeError):
                        pass

                part_numbers.append({
                    'mpn': part_number,
                    'quantity': quantity,
                    'line_number': line_num,
                })

            if not part_numbers:
                raise BOMParseError("TXT file contains no valid part numbers")

            return part_numbers

        except Exception as e:
            logger.error(f"❌ TXT parse error: {e}")
            raise BOMParseError(f"Failed to parse TXT: {str(e)}")

    def _detect_columns(self, headers: List[str]) -> Dict[str, Optional[str]]:
        """
        Auto-detect column mappings from headers using regex patterns.

        Args:
            headers: List of column names from file

        Returns:
            Dict mapping field types to actual column names
        """
        column_map = {
            'part_number': None,
            'manufacturer': None,
            'quantity': None,
            'reference': None,
            'description': None,
            'value': None,
            'package': None,
            'datasheet': None,
            'category': None,
        }

        # Normalize headers for matching
        normalized_headers = {h: h.strip().lower().replace('_', ' ').replace('-', ' ')
                             for h in headers if h}

        # Match each field type using regex patterns
        for field, patterns in self.COLUMN_PATTERNS.items():
            for header, normalized in normalized_headers.items():
                for pattern in patterns:
                    if re.match(pattern, normalized, re.IGNORECASE):
                        column_map[field] = header
                        break
                if column_map[field]:
                    break

        logger.info(f"✅ Detected column mapping: {column_map}")

        # Validate: must have at least part_number
        if not column_map['part_number']:
            raise BOMParseError(
                f"Could not detect part number column. Available columns: {list(headers)}\n"
                f"Expected column names: Part Number, MPN, PartNumber, Part, P/N"
            )

        return column_map

    def _extract_parts(self, rows: List[Dict[str, Any]],
                      column_map: Dict[str, Optional[str]]) -> List[Dict[str, Any]]:
        """
        Extract part numbers and metadata from parsed rows.

        Args:
            rows: List of row dicts from CSV/Excel
            column_map: Mapping of field types to column names

        Returns:
            List of part number entries with normalized keys
        """
        results = []

        for line_num, row in enumerate(rows, start=2):  # Start at 2 (accounting for header)
            # Extract mapped fields
            part_number = self._get_value(row, column_map['part_number'])

            # Skip rows without part number
            if not part_number or str(part_number).lower() in ['', 'n/a', 'none', 'null']:
                self.stats.skipped_rows += 1
                continue

            # Build normalized item
            item = {
                'mpn': str(part_number).strip(),
                'line_number': line_num,
            }

            # Extract optional fields
            if column_map['manufacturer']:
                manufacturer = self._get_value(row, column_map['manufacturer'])
                if manufacturer:
                    item['manufacturer'] = str(manufacturer).strip()

            if column_map['quantity']:
                quantity = self._get_value(row, column_map['quantity'])
                if quantity:
                    try:
                        item['quantity'] = int(float(quantity))
                    except (ValueError, TypeError):
                        pass

            if column_map['reference']:
                reference = self._get_value(row, column_map['reference'])
                if reference:
                    item['reference_designators'] = str(reference).strip()

            if column_map['description']:
                description = self._get_value(row, column_map['description'])
                if description:
                    item['description'] = str(description).strip()

            if column_map['value']:
                value = self._get_value(row, column_map['value'])
                if value:
                    item['value'] = str(value).strip()

            if column_map['package']:
                package = self._get_value(row, column_map['package'])
                if package:
                    item['package'] = str(package).strip()

            if column_map['datasheet']:
                datasheet = self._get_value(row, column_map['datasheet'])
                if datasheet:
                    item['datasheet_url'] = str(datasheet).strip()

            if column_map['category']:
                category = self._get_value(row, column_map['category'])
                if category:
                    item['category'] = str(category).strip()

            results.append(item)

        logger.info(f"✅ Extracted {len(results)} valid items from BOM")
        return results

    def _get_value(self, row: Dict[str, Any], column_name: Optional[str]) -> Optional[Any]:
        """Safely get value from row"""
        if not column_name:
            return None
        value = row.get(column_name)
        if value is None or value == '':
            return None
        return value

    def _detect_vendor_skus(self, items: List[Dict[str, Any]]) -> None:
        """
        Detect vendor SKUs in part numbers and update statistics.

        Args:
            items: List of parsed items
        """
        vendor_counts = {}

        for item in items:
            mpn = item.get('mpn', '')
            vendor = self.detect_vendor_from_mpn(mpn)
            if vendor:
                vendor_counts[vendor] = vendor_counts.get(vendor, 0) + 1
                item['detected_vendor'] = vendor

        self.stats.vendor_skus_detected = vendor_counts

        if vendor_counts:
            logger.info(f"✅ Detected vendor SKUs: {vendor_counts}")

    @staticmethod
    def detect_vendor_from_mpn(mpn: str) -> Optional[str]:
        """
        Detect vendor from part number pattern.

        Common patterns:
        - DigiKey: ends with -ND, -1-ND, -CT-ND, etc.
        - Mouser: starts with 2-3 digits followed by dash (e.g., 511-STM32)
        - Element14: 6-8 digit numeric SKU
        - Arrow: starts with ARROW-
        - Avnet: starts with AV-

        Args:
            mpn: Part number / SKU to check

        Returns:
            Vendor name if detected, None otherwise
        """
        if not mpn:
            return None

        pn = mpn.strip().upper()

        # Check each vendor pattern
        if re.search(r'-\d*ND$', pn):
            return 'digikey'
        if re.match(r'^\d{2,3}-', pn):
            return 'mouser'
        if re.match(r'^\d{6,8}$', pn):
            return 'element14'
        if pn.startswith('ARROW-'):
            return 'arrow'
        if pn.startswith('AV-'):
            return 'avnet'

        return None


def normalize_mpn(mpn: str) -> str:
    """
    Normalize MPN for consistent searching.

    - Remove extra whitespace
    - Uppercase for consistency
    - Preserve legitimate separators

    Args:
        mpn: Raw part number string

    Returns:
        Normalized part number
    """
    # Remove leading/trailing whitespace
    pn = mpn.strip()

    # Remove all internal whitespace
    pn = re.sub(r'\s+', '', pn)

    # Uppercase
    pn = pn.upper()

    return pn
