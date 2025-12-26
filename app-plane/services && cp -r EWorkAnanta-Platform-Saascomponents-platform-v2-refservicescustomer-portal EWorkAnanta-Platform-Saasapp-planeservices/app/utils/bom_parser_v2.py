"""
Enhanced BOM Parser V2 with Auto-Detection (ported from V1)

Supports CSV, Excel, TXT with automatic column detection using regex patterns.
"""

import csv
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from io import StringIO, BytesIO
from dataclasses import dataclass

logger = logging.getLogger(__name__)

def gate_log(message: str, **context):
    """Gate logging helper - logs only if ENABLE_GATE_LOGGING is True"""
    from app.config import settings
    if settings.enable_gate_logging:
        logger.info(f"[GATE: Parser] {message}", extra=context if context else {})


class BOMParseError(Exception):
    """Raised when BOM file parsing fails"""
    pass


@dataclass
class ParseStats:
    """Statistics from parsing operation"""
    total_rows: int
    valid_rows: int
    file_type: str
    encoding_used: str
    detected_columns: Dict[str, Optional[str]]
    unmapped_columns: List[str]


class BOMParserV2:
    """
    Enhanced BOM parser with V1-style auto-detection.

    Auto-detects columns for:
    - Part Number/MPN
    - Manufacturer
    - Quantity
    - Reference Designator
    - Description, Value, Package
    """

    COLUMN_PATTERNS = {
        'part_number': [
            r'^part[\s_-]?number$',
            r'^mpn$',
            r'^p[\s/-]?n$',
            r'^manufacturer[\s_-]?part[\s_-]?number$',
            r'^mfr[\s_-]?p[\s/-]?n$',
            r'^part$',
            r'^component$',
        ],
        'manufacturer': [
            r'^manufacturer$',
            r'^mfr$',
            r'^mfg$',
            r'^vendor$',
        ],
        'quantity': [
            r'^quantity$',
            r'^qty$',
            r'^qnty$',
            r'^amount$',
        ],
        'reference': [
            r'^reference$',
            r'^ref[\s_-]?des$',
            r'^designator$',
            r'^ref$',
            r'^reference[\s_-]?designator$',
        ],
        'description': [
            r'^description$',
            r'^desc$',
        ],
        'value': [
            r'^value$',
            r'^val$',
        ],
        'package': [
            r'^package$',
            r'^footprint$',
        ],
    }

    def __init__(self, file_content: bytes, filename: str):
        self.file_content = file_content
        self.filename = filename.lower()
        self.file_type = self._detect_file_type()
        self.parse_stats: Optional[ParseStats] = None

    def _detect_file_type(self) -> str:
        """Detect file type from extension"""
        if self.filename.endswith('.csv') or self.filename.endswith('.tsv'):
            return 'csv'
        elif self.filename.endswith(('.xlsx', '.xls')):
            return 'excel'
        elif self.filename.endswith('.txt'):
            return 'txt'
        else:
            try:
                self.file_content.decode('utf-8')
                return 'txt'
            except UnicodeDecodeError:
                raise BOMParseError(f"Unsupported file type: {self.filename}")

    def parse(self) -> Tuple[List[Dict[str, Any]], ParseStats]:
        """
        Parse BOM file with auto-detection

        Returns:
            (items, parse_stats)
        """
        gate_log("Parse started", bom_file=self.filename, file_type=self.file_type)

        try:
            if self.file_type == 'csv':
                items, stats = self._parse_csv()
            elif self.file_type == 'excel':
                items, stats = self._parse_excel()
            elif self.file_type == 'txt':
                items, stats = self._parse_txt()
            else:
                raise BOMParseError(f"Unsupported file type: {self.file_type}")

            gate_log("Parse complete", bom_file=self.filename, total_rows=stats.total_rows,
                    valid_rows=stats.valid_rows, encoding=stats.encoding_used)
            return items, stats

        except BOMParseError as e:
            gate_log("Parse failed", bom_file=self.filename, error=str(e))
            raise

    def _parse_csv(self) -> Tuple[List[Dict[str, Any]], ParseStats]:
        """Parse CSV with encoding/delimiter auto-detection"""
        # Try different encodings
        content = None
        encoding_used = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                content = self.file_content.decode(encoding)
                encoding_used = encoding
                logger.info(f"Decoded CSV with {encoding}")
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if not content:
            raise BOMParseError("Could not decode CSV with any known encoding")

        # Detect CSV dialect
        sample = content[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        except csv.Error:
            dialect = csv.excel

        # Parse CSV
        reader = csv.DictReader(StringIO(content), dialect=dialect)
        rows = list(reader)

        if not rows:
            raise BOMParseError("CSV file is empty")

        # Auto-detect columns
        column_map = self._detect_columns(list(rows[0].keys()))

        # Extract parts
        items = self._extract_parts(rows, column_map)

        # Build stats
        stats = ParseStats(
            total_rows=len(rows),
            valid_rows=len(items),
            file_type='csv',
            encoding_used=encoding_used,
            detected_columns=column_map,
            unmapped_columns=self._get_unmapped_columns(rows[0].keys(), column_map)
        )

        self.parse_stats = stats
        return items, stats

    def _parse_excel(self) -> Tuple[List[Dict[str, Any]], ParseStats]:
        """Parse Excel file"""
        try:
            import openpyxl
        except ImportError:
            raise BOMParseError("openpyxl required for Excel. Install: pip install openpyxl")

        workbook = openpyxl.load_workbook(BytesIO(self.file_content), read_only=True)
        sheet = workbook.active
        rows_raw = list(sheet.iter_rows(values_only=True))

        if not rows_raw or len(rows_raw) < 2:
            raise BOMParseError("Excel file empty or no data rows")

        # First row = headers
        headers = [str(cell).strip() if cell else f"Column{i}" for i, cell in enumerate(rows_raw[0])]

        # Convert to dicts
        rows = []
        for row_values in rows_raw[1:]:
            if not any(row_values):
                continue
            row_dict = {headers[i]: (row_values[i] if i < len(row_values) else None)
                       for i in range(len(headers))}
            rows.append(row_dict)

        if not rows:
            raise BOMParseError("Excel file has no data rows")

        # Auto-detect columns
        column_map = self._detect_columns(headers)

        # Extract parts
        items = self._extract_parts(rows, column_map)

        # Build stats
        stats = ParseStats(
            total_rows=len(rows),
            valid_rows=len(items),
            file_type='excel',
            encoding_used='N/A',
            detected_columns=column_map,
            unmapped_columns=self._get_unmapped_columns(headers, column_map)
        )

        self.parse_stats = stats
        return items, stats

    def _parse_txt(self) -> Tuple[List[Dict[str, Any]], ParseStats]:
        """Parse plain text (one part per line)"""
        content = None
        encoding_used = None
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                content = self.file_content.decode(encoding)
                encoding_used = encoding
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if not content:
            raise BOMParseError("Could not decode TXT file")

        lines = content.splitlines()
        items = []

        for line_num, line in enumerate(lines, start=1):
            part = line.strip()
            if part and part.lower() not in ['', 'part number', 'mpn']:
                items.append({
                    'mpn': part,
                    'manufacturer': None,
                    'quantity': 1,
                    'reference_designator': None,
                    'description': None,
                })

        stats = ParseStats(
            total_rows=len(lines),
            valid_rows=len(items),
            file_type='txt',
            encoding_used=encoding_used,
            detected_columns={'part_number': 'N/A (plain text)'},
            unmapped_columns=[]
        )

        self.parse_stats = stats
        return items, stats

    def _detect_columns(self, headers: List[str]) -> Dict[str, Optional[str]]:
        """Auto-detect column mappings using regex patterns"""
        column_map = {
            'part_number': None,
            'manufacturer': None,
            'quantity': None,
            'reference': None,
            'description': None,
            'value': None,
            'package': None,
        }

        # Normalize headers
        normalized = {h: h.strip().lower().replace('_', ' ').replace('-', ' ')
                     for h in headers if h}

        # Match patterns
        for field, patterns in self.COLUMN_PATTERNS.items():
            for header, norm in normalized.items():
                for pattern in patterns:
                    if re.match(pattern, norm, re.IGNORECASE):
                        column_map[field] = header
                        break
                if column_map[field]:
                    break

        logger.info(f"Detected columns: {column_map}")
        gate_log("Column detection complete", detected_columns=column_map, available_headers=headers)

        # Validate: must have part_number
        if not column_map['part_number']:
            gate_log("Column detection failed: No part number column", available_headers=headers)
            raise BOMParseError(
                f"Could not detect part number column.\n"
                f"Available: {list(headers)}\n"
                f"Expected: Part Number, MPN, PartNumber, Part, P/N"
            )

        return column_map

    def _extract_parts(self, rows: List[Dict[str, Any]],
                       column_map: Dict[str, Optional[str]]) -> List[Dict[str, Any]]:
        """Extract parts from rows using column map"""
        results = []

        for line_num, row in enumerate(rows, start=2):
            part_number = row.get(column_map['part_number'], '').strip() if column_map['part_number'] else ''

            # Skip empty/invalid
            if not part_number or part_number.lower() in ['', 'n/a', 'none', 'null']:
                continue

            manufacturer = row.get(column_map['manufacturer'], '').strip() if column_map['manufacturer'] else ''

            quantity = None
            if column_map['quantity']:
                qty_str = str(row.get(column_map['quantity'], '')).strip()
                try:
                    quantity = int(float(qty_str)) if qty_str else None
                except (ValueError, TypeError):
                    pass

            reference = row.get(column_map['reference'], '').strip() if column_map['reference'] else ''
            description = row.get(column_map['description'], '').strip() if column_map['description'] else ''

            results.append({
                'mpn': part_number,
                'manufacturer': manufacturer,
                'quantity': quantity or 1,
                'reference_designator': reference,
                'description': description,
            })

        logger.info(f"Extracted {len(results)} parts from BOM")
        return results

    def _get_unmapped_columns(self, headers: List[str], column_map: Dict[str, Optional[str]]) -> List[str]:
        """Get list of columns that weren't mapped"""
        mapped = set(v for v in column_map.values() if v)
        return [h for h in headers if h and h not in mapped]
