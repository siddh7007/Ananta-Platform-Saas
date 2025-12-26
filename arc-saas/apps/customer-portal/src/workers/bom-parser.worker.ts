/**
 * Web Worker for BOM file parsing
 * Offloads heavy CSV/Excel processing from main thread
 */

import * as XLSX from 'xlsx';

export interface WorkerMessage {
  type: 'parse' | 'abort';
  payload?: {
    file: ArrayBuffer;
    fileName: string;
    fileType: string;
  };
}

// Abort flag for cancellation support
let aborted = false;

export interface WorkerResponse {
  type: 'success' | 'error' | 'progress';
  payload: ParsedBOM | { error: string } | { progress: number; message: string };
}

export interface ColumnMapping {
  source: string;
  target:
    | 'manufacturer_part_number'
    | 'manufacturer'
    | 'quantity'
    | 'reference_designator'
    | 'description'
    | 'footprint'
    | 'ignore';
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

// Column patterns for auto-detection
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  manufacturer_part_number: [
    /^(part[\s_-]?number|pn|mpn|manufacturer[\s_-]?part[\s_-]?number|mfr[\s_-]?part|part[\s_-]?no|mfr[\s_-]?pn)$/i,
    /^p[\s_-]?n$/i,
    /^component[\s_-]?id$/i,
  ],
  manufacturer: [
    /^(manufacturer|mfr|mfg|brand|vendor)$/i,
    /^mfr[\s_-]?name$/i,
  ],
  quantity: [/^(quantity|qty|count|amount|q|num)$/i],
  reference_designator: [
    /^(reference|ref|designator|ref[\s_-]?des|reference[\s_-]?designator|location|position)$/i,
  ],
  description: [/^(description|desc|title|name|notes|comment|part[\s_-]?description)$/i],
  footprint: [/^(footprint|package|case|pkg|form[\s_-]?factor)$/i],
};

function detectColumnMapping(header: string): {
  target: ColumnMapping['target'];
  confidence: number;
} {
  const cleanHeader = header.trim();

  for (const [targetField, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanHeader)) {
        return {
          target: targetField as ColumnMapping['target'],
          confidence: 0.9,
        };
      }
    }
  }

  const lowerHeader = cleanHeader.toLowerCase();
  if (lowerHeader.includes('part') && !lowerHeader.includes('desc')) {
    return { target: 'manufacturer_part_number', confidence: 0.5 };
  }
  if (lowerHeader.includes('qty') || lowerHeader.includes('quantity')) {
    return { target: 'quantity', confidence: 0.5 };
  }
  if (lowerHeader.includes('ref') && !lowerHeader.includes('pref')) {
    return { target: 'reference_designator', confidence: 0.5 };
  }
  if (lowerHeader.includes('mfr') || lowerHeader.includes('manufacturer')) {
    return { target: 'manufacturer', confidence: 0.5 };
  }
  if (lowerHeader.includes('desc') || lowerHeader.includes('description')) {
    return { target: 'description', confidence: 0.5 };
  }
  if (lowerHeader.includes('footprint') || lowerHeader.includes('package')) {
    return { target: 'footprint', confidence: 0.5 };
  }

  return { target: 'ignore', confidence: 0 };
}

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || '';
  const delimiters = [',', '\t', ';', '|'];
  let maxCount = 0;
  let detected = ',';

  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detected = delimiter;
    }
  }

  return detected;
}

function parseCSV(content: string): { rows: Record<string, unknown>[]; columns: string[] } {
  const delimiter = detectDelimiter(content);
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return { rows: [], columns: [] };
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, unknown> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return { rows, columns: headers };
}

function parseExcel(buffer: ArrayBuffer): { rows: Record<string, unknown>[]; columns: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return { rows: data, columns };
}

function parseBOM(buffer: ArrayBuffer, fileName: string, fileType: string): ParsedBOM {
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  let detectedDelimiter: string | undefined;

  // Report progress
  self.postMessage({
    type: 'progress',
    payload: { progress: 10, message: 'Reading file...' },
  } as WorkerResponse);

  if (fileType.includes('csv') || fileName.endsWith('.csv')) {
    const decoder = new TextDecoder('utf-8');
    const content = decoder.decode(buffer);
    detectedDelimiter = detectDelimiter(content);
    const parsed = parseCSV(content);
    rows = parsed.rows;
    columns = parsed.columns;
  } else {
    const parsed = parseExcel(buffer);
    rows = parsed.rows;
    columns = parsed.columns;
  }

  self.postMessage({
    type: 'progress',
    payload: { progress: 50, message: 'Detecting column mappings...' },
  } as WorkerResponse);

  // Auto-detect column mappings
  const detected_mappings: ColumnMapping[] = [];
  const unmapped_columns: string[] = [];

  for (const column of columns) {
    const mapping = detectColumnMapping(column);
    if (mapping.target !== 'ignore') {
      detected_mappings.push({
        source: column,
        target: mapping.target,
        confidence: mapping.confidence,
      });
    } else {
      unmapped_columns.push(column);
    }
  }

  self.postMessage({
    type: 'progress',
    payload: { progress: 90, message: 'Finalizing...' },
  } as WorkerResponse);

  return {
    rows,
    columns,
    detected_mappings,
    unmapped_columns,
    total_rows: rows.length,
    detected_delimiter: detectedDelimiter,
  };
}

/**
 * Check if operation was aborted
 */
function checkAborted(): void {
  if (aborted) {
    throw new Error('Operation aborted');
  }
}

// Web Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'abort') {
    aborted = true;
    self.postMessage({
      type: 'error',
      payload: { error: 'Operation aborted by user' },
    } as WorkerResponse);
    return;
  }

  if (type === 'parse' && payload) {
    // Reset abort flag for new parse operation
    aborted = false;

    try {
      checkAborted();
      const result = parseBOM(payload.file, payload.fileName, payload.fileType);

      // Check abort before sending result
      if (!aborted) {
        self.postMessage({
          type: 'success',
          payload: result,
        } as WorkerResponse);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      // Don't report abort as error (already handled)
      if (message !== 'Operation aborted') {
        self.postMessage({
          type: 'error',
          payload: { error: message },
        } as WorkerResponse);
      }
    }
  }
};

export {};
