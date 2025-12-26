/**
 * useBOMUpload Hook
 *
 * Handles BOM file parsing and upload to the API.
 * Part of the split useBOMWorkflow hook.
 *
 * @module hooks/bom-workflow/useBOMUpload
 */

import { useCallback } from 'react';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';
import type { QueueItem, ColumnMapping } from '../../bom/workflow';

// ============================================================
// Types
// ============================================================

export interface UseBOMUploadOptions {
  /** Organization ID for uploads */
  organizationId: string;
  /** Callback to update queue item */
  onUpdateItem: (itemId: string, updates: Partial<QueueItem>) => void;
  /** Callback when BOM is created and ready for enrichment */
  onBomCreated?: (bomId: string, lineItems?: unknown[]) => void;
}

export interface UseBOMUploadReturn {
  /** Parse a file and detect columns */
  parseFile: (itemId: string, file: File) => Promise<void>;
  /** Confirm mappings and upload the BOM */
  confirmAndEnrich: (item: QueueItem) => Promise<string | null>;
}

// ============================================================
// Helper Functions
// ============================================================

function normalizeField(field: string): ColumnMapping['target'] | null {
  const normalized = field.toLowerCase().replace(/[_\s-]/g, '');
  if (['partnumber', 'mpn', 'pn', 'partno', 'mfpn'].includes(normalized)) return 'mpn';
  if (['manufacturer', 'mfr', 'mfg', 'vendor', 'make'].includes(normalized)) return 'manufacturer';
  if (['quantity', 'qty', 'count', 'amount'].includes(normalized)) return 'quantity';
  if (['reference', 'refdes', 'designator', 'ref'].includes(normalized)) return 'reference';
  if (['description', 'desc', 'name', 'partdesc'].includes(normalized)) return 'description';
  return null;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useBOMUpload(options: UseBOMUploadOptions): UseBOMUploadReturn {
  const { organizationId, onUpdateItem, onBomCreated } = options;

  const parseFile = useCallback(
    async (itemId: string, file: File) => {
      onUpdateItem(itemId, { status: 'parsing' });

      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'staff');

        const response = await fetch(`${CNS_API_URL}/bom/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Parse failed');
        }

        const result = await response.json();

        // Build column mappings with sample data
        const mappings: ColumnMapping[] = [];

        if (result.detected_columns) {
          Object.entries(result.detected_columns).forEach(([field, sourceCol]) => {
            if (sourceCol) {
              const normalizedField = normalizeField(field);
              const samples =
                result.preview_data
                  ?.slice(0, 3)
                  .map((row: Record<string, unknown>) => String(row[sourceCol as string] || '')) || [];
              mappings.push({
                source: sourceCol as string,
                target: normalizedField || 'ignore',
                sampleData: samples,
              });
            }
          });
        }

        if (result.unmapped_columns) {
          result.unmapped_columns.forEach((col: string) => {
            const samples =
              result.preview_data?.slice(0, 3).map((row: Record<string, unknown>) => String(row[col] || '')) ||
              [];
            mappings.push({ source: col, target: 'ignore', sampleData: samples });
          });
        }

        onUpdateItem(itemId, {
          status: 'mapping',
          totalRows: result.total_items,
          detectedColumns: result.detected_columns,
          unmappedColumns: result.unmapped_columns,
          previewData: result.preview_data,
          columnMappings: mappings,
          expanded: true,
        });
      } catch (err) {
        onUpdateItem(itemId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Parse failed',
        });
      }
    },
    [onUpdateItem]
  );

  const confirmAndEnrich = useCallback(
    async (item: QueueItem): Promise<string | null> => {
      if (!item.file || !item.columnMappings) return null;

      onUpdateItem(item.id, { status: 'saving' });

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('bom_name', `BOM Upload - ${item.file.name}`);
        formData.append('organization_id', organizationId);
        formData.append('source', 'staff_bulk');
        formData.append('priority', 'normal');
        formData.append('start_enrichment', 'true');
        formData.append('uploaded_by', localStorage.getItem('username') || 'cns-dashboard');

        // Column mappings: {canonical: csv_column}
        const mappingsObj: Record<string, string> = {};
        item.columnMappings.forEach((m) => {
          if (m.target !== 'ignore') {
            mappingsObj[m.target] = m.source;
          }
        });
        formData.append('column_mappings', JSON.stringify(mappingsObj));

        const response = await fetch(`${CNS_API_URL}/boms/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Upload failed');
        }

        const result = await response.json();
        const bomId = result.bom_id;

        onUpdateItem(item.id, {
          status: 'completed',
          bomId,
          expanded: false,
        });

        // Notify parent hook
        if (onBomCreated) {
          onBomCreated(bomId, result.line_items);
        }

        return bomId;
      } catch (err) {
        onUpdateItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
        return null;
      }
    },
    [organizationId, onUpdateItem, onBomCreated]
  );

  return {
    parseFile,
    confirmAndEnrich,
  };
}

export default useBOMUpload;
