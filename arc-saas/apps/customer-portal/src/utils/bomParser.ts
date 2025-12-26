/**
 * BOM File Parser - Client-side column detection
 *
 * Parses CSV/Excel files and auto-detects column mappings
 * Based on working implementation from old CBP (app-plane/services/customer-portal)
 */

import * as XLSX from 'xlsx';

export interface ColumnMapping {
  source: string;
  target: 'manufacturer_part_number' | 'manufacturer' | 'quantity' | 'reference_designator' | 'description' | 'footprint' | 'ignore';
  confidence: number;
}

export interface ParsedBOM {
  rows: Record<string, unknown>[];
  columns: string[];
  detected_mappings: ColumnMapping[];
  unmapped_columns: string[];
  total_rows: number;
  detected_delimiter?: string;
}

/**
 * Column name patterns for auto-detection
 */
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  manufacturer_part_number: [
    /^(part[\s_-]?number|pn|mpn|manufacturer[\s_-]?part[\s_-]?number|mfr[\s_-]?part|part[\s_-]?no)$/i,
    /^p[\s_-]?n$/i,
  ],
  manufacturer: [
    /^(manufacturer|mfr|mfg|brand|supplier|vendor)$/i,
  ],
  quantity: [
    /^(quantity|qty|count|amount|q)$/i,
  ],
  reference_designator: [
    /^(reference|ref|designator|ref[\s_-]?des|reference[\s_-]?designator|location|position)$/i,
  ],
  description: [
    /^(description|desc|title|name|notes|comment)$/i,
  ],
  footprint: [
    /^(footprint|package|case|pkg)$/i,
  ],
};

/**
 * Auto-detect column mapping based on header name
 */
function detectColumnMapping(header: string): { target: ColumnMapping['target']; confidence: number } {
  const cleanHeader = header.trim();

  for (const [targetField, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanHeader)) {
        return {
          target: targetField as ColumnMapping['target'],
          confidence: 0.9
        };
      }
    }
  }

  // Fuzzy matching (lower confidence)
  const lowerHeader = cleanHeader.toLowerCase();
  if (lowerHeader.includes('part')) {
    return { target: 'manufacturer_part_number', confidence: 0.5 };
  }
  if (lowerHeader.includes('qty') || lowerHeader.includes('quantity')) {
    return { target: 'quantity', confidence: 0.5 };
  }
  if (lowerHeader.includes('ref')) {
    return { target: 'reference_designator', confidence: 0.5 };
  }
  if (lowerHeader.includes('mfr') || lowerHeader.includes('mfg') || lowerHeader.includes('manufacturer')) {
    return { target: 'manufacturer', confidence: 0.5 };
  }
  if (lowerHeader.includes('desc')) {
    return { target: 'description', confidence: 0.5 };
  }
  if (lowerHeader.includes('footprint') || lowerHeader.includes('package')) {
    return { target: 'footprint', confidence: 0.5 };
  }

  return { target: 'ignore', confidence: 0 };
}

/**
 * Auto-detect the delimiter used in CSV content
 * Supports: comma, semicolon, tab, pipe
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';

  // Count occurrences of common delimiters in the first line
  const delimiters = [',', ';', '\t', '|'];
  const counts: Record<string, number> = {};

  for (const delim of delimiters) {
    // Count occurrences outside of quoted strings
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        count++;
      }
    }
    counts[delim] = count;
  }

  // Find the delimiter with the most occurrences
  let bestDelim = ',';
  let maxCount = 0;

  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestDelim = delim;
    }
  }

  console.log('[bomParser] Detected delimiter:', bestDelim === '\t' ? 'TAB' : bestDelim, 'with', maxCount, 'occurrences');

  return bestDelim;
}

/**
 * Parse CSV file with auto-detected delimiter
 */
async function parseCSV(file: File): Promise<ParsedBOM> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

        if (lines.length === 0) {
          throw new Error('Empty file');
        }

        // Auto-detect the delimiter
        const delimiter = detectDelimiter(text);

        // Parse CSV line with detected delimiter
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]);

        // Debug log for troubleshooting
        console.log('[bomParser] Parsed headers:', headers);
        console.log('[bomParser] Header count:', headers.length);

        const rows: Record<string, unknown>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          // Allow rows with same or fewer columns (some trailing columns may be empty)
          if (values.length >= 1) {
            const row: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] ?? '';
            });
            rows.push(row);
          }
        }

        const detected_mappings: ColumnMapping[] = [];
        const unmapped_columns: string[] = [];

        headers.forEach(header => {
          const detection = detectColumnMapping(header);
          detected_mappings.push({
            source: header,
            target: detection.target,
            confidence: detection.confidence,
          });

          if (detection.target === 'ignore') {
            unmapped_columns.push(header);
          }
        });

        resolve({
          rows,
          columns: headers,
          detected_mappings,
          unmapped_columns,
          total_rows: rows.length,
          detected_delimiter: delimiter,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error(`CSV parse error: ${message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
async function parseExcel(file: File): Promise<ParsedBOM> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Use first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

        if (jsonData.length === 0) {
          throw new Error('Empty sheet');
        }

        const headers = (jsonData[0] as unknown[]).map(String);
        const rows: Record<string, unknown>[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row: Record<string, unknown> = {};
          headers.forEach((header, idx) => {
            row[header] = jsonData[i][idx];
          });
          rows.push(row);
        }

        const detected_mappings: ColumnMapping[] = [];
        const unmapped_columns: string[] = [];

        headers.forEach(header => {
          const detection = detectColumnMapping(header);
          detected_mappings.push({
            source: header,
            target: detection.target,
            confidence: detection.confidence,
          });

          if (detection.target === 'ignore') {
            unmapped_columns.push(header);
          }
        });

        resolve({
          rows,
          columns: headers,
          detected_mappings,
          unmapped_columns,
          total_rows: rows.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error(`Excel parse error: ${message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Main parse function - detects file type and parses accordingly
 */
export async function parseBOMFile(file: File): Promise<ParsedBOM> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
    case 'txt':
      return parseCSV(file);
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    default:
      throw new Error(`Unsupported file type: ${extension}. Use CSV or Excel files.`);
  }
}

/**
 * Validate that required columns are mapped
 */
export function validateMappings(mappings: ColumnMapping[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required MPN column
  const hasMPN = mappings.some((m) => m.target === 'manufacturer_part_number');
  if (!hasMPN) {
    errors.push('Part Number (MPN) column is required');
  }

  // Check for duplicates
  const targetCounts: Record<string, number> = {};
  mappings.forEach((m) => {
    if (m.target !== 'ignore') {
      targetCounts[m.target] = (targetCounts[m.target] || 0) + 1;
    }
  });

  Object.entries(targetCounts).forEach(([target, count]) => {
    if (count > 1) {
      errors.push(`Multiple columns mapped to "${target}"`);
    }
  });

  // Warnings for recommended columns
  const hasQty = mappings.some((m) => m.target === 'quantity');
  if (!hasQty) {
    warnings.push('Quantity column not mapped - will default to 1');
  }

  const hasMfr = mappings.some((m) => m.target === 'manufacturer');
  if (!hasMfr) {
    warnings.push('Manufacturer column not mapped - enrichment may be less accurate');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default {
  parseBOMFile,
  validateMappings,
};
