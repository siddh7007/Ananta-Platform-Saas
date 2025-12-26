/**
 * Export Service
 * CBP-P2-009: Export Functionality Enhancement
 *
 * Handles BOM export logic for multiple formats with field selection.
 */

import type { ExportFormat } from '@/components/bom/ExportDialog';

export interface BomLineItem {
  id: string;
  lineNumber: number;
  mpn: string;
  manufacturer: string;
  description: string;
  quantity: number;
  reference?: string;
  footprint?: string;
  value?: string;
  lifecycle?: string;
  leadTime?: string;
  stock?: number;
  rohs?: string;
  datasheet?: string;
  package?: string;
  unitPrice?: number;
  extendedPrice?: number;
  moq?: number;
  priceBreaks?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  fields: string[];
  includeEnrichment: boolean;
  bomName: string;
}

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  xml: 'application/xml',
};

const FIELD_LABELS: Record<string, string> = {
  lineNumber: 'Line Number',
  mpn: 'MPN',
  manufacturer: 'Manufacturer',
  description: 'Description',
  quantity: 'Quantity',
  reference: 'Reference Designator',
  footprint: 'Footprint',
  value: 'Value',
  lifecycle: 'Lifecycle Status',
  leadTime: 'Lead Time',
  stock: 'Stock Quantity',
  rohs: 'RoHS Status',
  datasheet: 'Datasheet URL',
  package: 'Package Type',
  unitPrice: 'Unit Price',
  extendedPrice: 'Extended Price',
  moq: 'Min Order Qty',
  priceBreaks: 'Price Breaks',
};

/**
 * Export BOM data to the specified format
 */
export async function exportBom(
  lineItems: BomLineItem[],
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { format, fields, bomName } = options;
    const filteredItems = filterFields(lineItems, fields);

    let content: string | Uint8Array;

    switch (format) {
      case 'csv':
        content = generateCsv(filteredItems, fields);
        break;
      case 'json':
        content = generateJson(filteredItems, bomName);
        break;
      case 'xml':
        content = generateXml(filteredItems, bomName, fields);
        break;
      case 'xlsx':
        content = await generateXlsx(filteredItems, fields);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const blob = new Blob(
      [content as BlobPart],
      { type: CONTENT_TYPES[format] }
    );

    return {
      success: true,
      blob,
      filename: sanitizeFilename(bomName, format),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Filter line items to only include selected fields
 */
function filterFields(
  items: BomLineItem[],
  fields: string[]
): Record<string, unknown>[] {
  return items.map((item) => {
    const filtered: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (field in item) {
        filtered[field] = item[field as keyof BomLineItem];
      }
    });
    return filtered;
  });
}

/**
 * Generate CSV export
 */
function generateCsv(
  items: Record<string, unknown>[],
  fields: string[]
): string {
  const headers = fields.map((f) => FIELD_LABELS[f] || f);
  const headerRow = headers.map(escapeCsvValue).join(',');

  const dataRows = items.map((item) =>
    fields.map((f) => escapeCsvValue(String(item[f] ?? ''))).join(',')
  );

  // Add BOM for Excel UTF-8 compatibility
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Escape a value for CSV format
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate JSON export
 */
function generateJson(
  items: Record<string, unknown>[],
  bomName: string
): string {
  const exportData = {
    exportInfo: {
      bomName,
      exportDate: new Date().toISOString(),
      itemCount: items.length,
    },
    lineItems: items,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate XML export
 */
function generateXml(
  items: Record<string, unknown>[],
  bomName: string,
  fields: string[]
): string {
  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const lineItemsXml = items
    .map((item) => {
      const fieldsXml = fields
        .map((field) => {
          const value = item[field];
          if (value === undefined || value === null) return '';
          return `      <${field}>${escapeXml(String(value))}</${field}>`;
        })
        .filter(Boolean)
        .join('\n');
      return `    <lineItem>\n${fieldsXml}\n    </lineItem>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bomExport>
  <exportInfo>
    <bomName>${escapeXml(bomName)}</bomName>
    <exportDate>${new Date().toISOString()}</exportDate>
    <itemCount>${items.length}</itemCount>
  </exportInfo>
  <lineItems>
${lineItemsXml}
  </lineItems>
</bomExport>`;
}

/**
 * Generate XLSX export using SheetJS library
 */
async function generateXlsx(
  items: Record<string, unknown>[],
  fields: string[]
): Promise<Uint8Array> {
  try {
    // Dynamic import of xlsx library
    const XLSX = await import('xlsx');

    // Transform items to use field labels as headers
    const transformedItems = items.map((item) => {
      const labeledItem: Record<string, unknown> = {};
      fields.forEach((field) => {
        const label = FIELD_LABELS[field] || field;
        labeledItem[label] = formatCellValue(item[field], field);
      });
      return labeledItem;
    });

    // Create worksheet from JSON data
    const ws = XLSX.utils.json_to_sheet(transformedItems);

    // Apply column widths based on content
    const columnWidths = fields.map((field) => {
      const label = FIELD_LABELS[field] || field;
      const maxLength = Math.max(
        label.length,
        ...transformedItems.map((item) => {
          const value = item[label];
          return value ? String(value).length : 0;
        })
      );
      return { wch: Math.min(maxLength + 2, 50) }; // Max width 50 chars
    });
    ws['!cols'] = columnWidths;

    // Create workbook and append worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM Export');

    // Write workbook to array buffer
    const arrayBuffer = XLSX.write(wb, {
      type: 'array',
      bookType: 'xlsx',
      compression: true,
    });

    return new Uint8Array(arrayBuffer);
  } catch (error) {
    throw new Error(
      `XLSX export failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Ensure xlsx package is installed: npm install xlsx'
    );
  }
}

/**
 * Format cell value based on field type
 */
function formatCellValue(value: unknown, field: string): unknown {
  if (value === undefined || value === null) {
    return '';
  }

  // Format currency fields
  if (field === 'unitPrice' || field === 'extendedPrice') {
    const numValue = Number(value);
    return isNaN(numValue) ? value : numValue;
  }

  // Format numeric fields
  if (field === 'quantity' || field === 'stock' || field === 'moq' || field === 'lineNumber') {
    const numValue = Number(value);
    return isNaN(numValue) ? value : numValue;
  }

  // Return string values as-is
  return value;
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string, format: ExportFormat): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);

  return `${sanitized || 'bom_export'}.${format}`;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export BOM via API call (when backend is ready)
 */
export async function exportBomViaApi(
  bomId: string,
  options: Omit<ExportOptions, 'bomName'>
): Promise<ExportResult> {
  try {
    const response = await fetch(`/api/boms/${bomId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: options.format,
        fields: options.fields,
        includeEnrichment: options.includeEnrichment,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = extractFilename(contentDisposition) || `bom_export.${options.format}`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Extract filename from Content-Disposition header
 */
function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1].replace(/['"]/g, '');
  }

  return null;
}

export default {
  exportBom,
  exportBomViaApi,
  downloadBlob,
};
