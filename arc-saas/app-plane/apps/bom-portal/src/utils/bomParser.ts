/**
 * BOM File Parser - Client-side column detection
 *
 * Parses CSV/Excel files and auto-detects column mappings
 */

import * as XLSX from 'xlsx';

export interface ColumnMapping {
  source: string;
  target: 'manufacturer_part_number' | 'manufacturer' | 'quantity' | 'reference_designator' | 'description' | 'ignore';
  confidence?: number;
}

export interface ParsedBOM {
  rows: Record<string, any>[];
  columns: string[];
  detected_mappings: ColumnMapping[];
  unmapped_columns: string[];
  total_rows: number;
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
  if (cleanHeader.toLowerCase().includes('part')) {
    return { target: 'manufacturer_part_number', confidence: 0.5 };
  }
  if (cleanHeader.toLowerCase().includes('qty')) {
    return { target: 'quantity', confidence: 0.5 };
  }
  if (cleanHeader.toLowerCase().includes('ref')) {
    return { target: 'reference_designator', confidence: 0.5 };
  }

  return { target: 'ignore', confidence: 0 };
}

/**
 * Parse CSV file
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

        // Parse CSV manually (simple implementation)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
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
        const rows: Record<string, any>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length === headers.length) {
            const row: Record<string, any> = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx];
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
        });
      } catch (error: any) {
        reject(new Error(`CSV parse error: ${error.message}`));
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
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (jsonData.length === 0) {
          throw new Error('Empty sheet');
        }

        const headers = jsonData[0].map(String);
        const rows: Record<string, any>[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row: Record<string, any> = {};
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
      } catch (error: any) {
        reject(new Error(`Excel parse error: ${error.message}`));
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
      return parseCSV(file);
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}
