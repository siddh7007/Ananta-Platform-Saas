/**
 * usePortfolioExport Hook
 * @module hooks/usePortfolioExport
 *
 * React hook for exporting portfolio data as PDF or CSV.
 * Handles file download and loading states.
 */

import { useState, useCallback } from 'react';
import { ExportFormat } from '../types/dashboard';
import { exportPortfolioPDF, exportPortfolioCSV } from '../services/portfolio.service';

export interface UsePortfolioExportReturn {
  /** Export portfolio as PDF */
  exportPDF: (tenantId: string, filename?: string) => Promise<void>;
  /** Export portfolio as CSV */
  exportCSV: (tenantId: string, filename?: string) => Promise<void>;
  /** Generic export function */
  exportData: (tenantId: string, format: ExportFormat, filename?: string) => Promise<void>;
  /** Loading state during export */
  isExporting: boolean;
  /** Error state */
  error: Error | null;
  /** Current export format being processed */
  exportingFormat: ExportFormat | null;
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename with timestamp
 */
function generateFilename(format: ExportFormat, customName?: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const baseName = customName || `portfolio-dashboard-${timestamp}`;
  return `${baseName}.${format}`;
}

/**
 * Hook to export portfolio data
 *
 * @example
 * ```tsx
 * const { exportPDF, exportCSV, isExporting } = usePortfolioExport();
 *
 * return (
 *   <>
 *     <Button
 *       onClick={() => exportPDF(tenantId)}
 *       disabled={isExporting}
 *     >
 *       Export PDF
 *     </Button>
 *     <Button
 *       onClick={() => exportCSV(tenantId)}
 *       disabled={isExporting}
 *     >
 *       Export CSV
 *     </Button>
 *   </>
 * );
 * ```
 */
export function usePortfolioExport(): UsePortfolioExportReturn {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  /**
   * Generic export function
   */
  const exportData = useCallback(
    async (tenantId: string, format: ExportFormat, filename?: string) => {
      if (!tenantId) {
        const error = new Error('Tenant ID is required for export');
        setError(error);
        throw error;
      }

      setIsExporting(true);
      setError(null);
      setExportingFormat(format);

      try {
        let blob: Blob;

        // Call appropriate export function based on format
        if (format === 'pdf') {
          blob = await exportPortfolioPDF(tenantId);
        } else if (format === 'csv') {
          blob = await exportPortfolioCSV(tenantId);
        } else {
          throw new Error(`Unsupported export format: ${format}`);
        }

        // Download the file
        const downloadFilename = generateFilename(format, filename);
        downloadBlob(blob, downloadFilename);

        console.log(`[usePortfolioExport] Successfully exported ${format.toUpperCase()}`);
      } catch (err) {
        const error = err instanceof Error
          ? err
          : new Error(`Failed to export portfolio as ${format.toUpperCase()}`);

        setError(error);
        console.error('[usePortfolioExport] Export error:', error);
        throw error;
      } finally {
        setIsExporting(false);
        setExportingFormat(null);
      }
    },
    []
  );

  /**
   * Export as PDF
   */
  const exportPDF = useCallback(
    async (tenantId: string, filename?: string) => {
      return exportData(tenantId, 'pdf', filename);
    },
    [exportData]
  );

  /**
   * Export as CSV
   */
  const exportCSV = useCallback(
    async (tenantId: string, filename?: string) => {
      return exportData(tenantId, 'csv', filename);
    },
    [exportData]
  );

  return {
    exportPDF,
    exportCSV,
    exportData,
    isExporting,
    error,
    exportingFormat,
  };
}
