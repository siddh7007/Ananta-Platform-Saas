/**
 * Export Dialog Component
 * CBP-P2-009: Export Functionality Enhancement
 *
 * Provides export capabilities with multiple format options,
 * field selection, and template support for BOM data.
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileCode,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportLogger } from '@/lib/logger';

export type ExportFormat = 'xlsx' | 'csv' | 'json' | 'xml';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bomId: string;
  bomName: string;
  lineItemCount?: number;
}

interface ExportField {
  id: string;
  label: string;
  default: boolean;
  category: 'basic' | 'enrichment' | 'pricing';
}

const EXPORT_FORMATS = [
  {
    value: 'xlsx' as const,
    label: 'Excel',
    extension: '.xlsx',
    icon: FileSpreadsheet,
    description: 'Best for spreadsheet editing',
  },
  {
    value: 'csv' as const,
    label: 'CSV',
    extension: '.csv',
    icon: FileText,
    description: 'Universal compatibility',
  },
  {
    value: 'json' as const,
    label: 'JSON',
    extension: '.json',
    icon: FileJson,
    description: 'For developers & APIs',
  },
  {
    value: 'xml' as const,
    label: 'XML',
    extension: '.xml',
    icon: FileCode,
    description: 'Legacy system integration',
  },
];

const EXPORTABLE_FIELDS: ExportField[] = [
  // Basic fields
  { id: 'lineNumber', label: 'Line Number', default: true, category: 'basic' },
  { id: 'mpn', label: 'MPN', default: true, category: 'basic' },
  { id: 'manufacturer', label: 'Manufacturer', default: true, category: 'basic' },
  { id: 'description', label: 'Description', default: true, category: 'basic' },
  { id: 'quantity', label: 'Quantity', default: true, category: 'basic' },
  { id: 'reference', label: 'Reference Designator', default: false, category: 'basic' },
  { id: 'footprint', label: 'Footprint', default: false, category: 'basic' },
  { id: 'value', label: 'Value', default: false, category: 'basic' },

  // Enrichment fields
  { id: 'lifecycle', label: 'Lifecycle Status', default: false, category: 'enrichment' },
  { id: 'leadTime', label: 'Lead Time', default: false, category: 'enrichment' },
  { id: 'stock', label: 'Stock Quantity', default: false, category: 'enrichment' },
  { id: 'rohs', label: 'RoHS Status', default: false, category: 'enrichment' },
  { id: 'datasheet', label: 'Datasheet URL', default: false, category: 'enrichment' },
  { id: 'package', label: 'Package Type', default: false, category: 'enrichment' },

  // Pricing fields
  { id: 'unitPrice', label: 'Unit Price', default: false, category: 'pricing' },
  { id: 'extendedPrice', label: 'Extended Price', default: false, category: 'pricing' },
  { id: 'moq', label: 'Min Order Qty', default: false, category: 'pricing' },
  { id: 'priceBreaks', label: 'Price Breaks', default: false, category: 'pricing' },
];

const FIELD_CATEGORIES = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'enrichment', label: 'Enrichment Data' },
  { id: 'pricing', label: 'Pricing Data' },
] as const;

export function ExportDialog({
  open,
  onOpenChange,
  bomId,
  bomName,
  lineItemCount,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(EXPORTABLE_FIELDS.filter((f) => f.default).map((f) => f.id))
  );
  const [includeEnrichment, setIncludeEnrichment] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFields(new Set(EXPORTABLE_FIELDS.map((f) => f.id)));
  }, []);

  const selectDefault = useCallback(() => {
    setSelectedFields(
      new Set(EXPORTABLE_FIELDS.filter((f) => f.default).map((f) => f.id))
    );
  }, []);

  const selectCategory = useCallback((category: string) => {
    const categoryFields = EXPORTABLE_FIELDS
      .filter((f) => f.category === category)
      .map((f) => f.id);

    setSelectedFields((prev) => {
      const next = new Set(prev);
      const allSelected = categoryFields.every((id) => next.has(id));

      if (allSelected) {
        // Deselect all in category
        categoryFields.forEach((id) => next.delete(id));
      } else {
        // Select all in category
        categoryFields.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch(`/api/boms/${bomId}/export`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     format,
      //     fields: Array.from(selectedFields),
      //     includeEnrichment,
      //   }),
      // });

      // Mock export for development
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate file download
      const mockData = generateMockExportData(format, Array.from(selectedFields));
      const blob = new Blob([mockData], { type: getContentType(format) });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(bomName)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        setExportSuccess(false);
      }, 1500);
    } catch (error) {
      exportLogger.error('BOM export failed', error, {
        bomId,
        bomName,
        format,
        fieldCount: selectedFields.size,
      });
      setExportError(
        error instanceof Error ? error.message : 'Failed to export BOM. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isExporting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        // Reset state when closing
        setExportError(null);
        setExportSuccess(false);
      }
    }
  };

  const selectedFormat = EXPORT_FORMATS.find((f) => f.value === format)!;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" aria-hidden="true" />
            Export BOM
          </DialogTitle>
          <DialogDescription>
            Export "{bomName}" {lineItemCount && `(${lineItemCount} line items)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label id="format-label">Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              aria-labelledby="format-label"
            >
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FORMATS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <label
                      key={f.value}
                      className={cn(
                        'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                        'hover:bg-muted/50 transition-colors',
                        format === f.value && 'border-primary bg-primary/5'
                      )}
                    >
                      <RadioGroupItem value={f.value} id={`format-${f.value}`} />
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block">
                          {f.label}
                          <span className="text-muted-foreground ml-1">{f.extension}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{f.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label id="fields-label">Fields to Export</Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 text-xs"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectDefault}
                  className="h-7 text-xs"
                >
                  Default
                </Button>
              </div>
            </div>

            <ScrollArea className="h-48 border rounded-lg p-3">
              <div className="space-y-4" role="group" aria-labelledby="fields-label">
                {FIELD_CATEGORIES.map((category) => {
                  const categoryFields = EXPORTABLE_FIELDS.filter(
                    (f) => f.category === category.id
                  );
                  const allSelected = categoryFields.every((f) =>
                    selectedFields.has(f.id)
                  );
                  const someSelected = categoryFields.some((f) =>
                    selectedFields.has(f.id)
                  );

                  return (
                    <div key={category.id} className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              (el as unknown as HTMLInputElement).indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onCheckedChange={() => selectCategory(category.id)}
                          aria-label={`Select all ${category.label}`}
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          {category.label}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 pl-6">
                        {categoryFields.map((field) => (
                          <label
                            key={field.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedFields.has(field.id)}
                              onCheckedChange={() => toggleField(field.id)}
                              id={`field-${field.id}`}
                            />
                            <span className="text-sm">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              {selectedFields.size} of {EXPORTABLE_FIELDS.length} fields selected
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeEnrichment}
                onCheckedChange={(v) => setIncludeEnrichment(!!v)}
                id="include-enrichment"
              />
              <span className="text-sm">
                Include enrichment data (pricing, stock, lifecycle)
              </span>
            </label>
          </div>

          {/* Error Alert */}
          {exportError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {exportSuccess && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Export completed successfully!</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.size === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Export as {selectedFormat.label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
}

function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
  }
}

function generateMockExportData(format: ExportFormat, fields: string[]): string {
  // Generate mock data for development
  const mockRows = [
    { lineNumber: 1, mpn: 'STM32F103C8T6', manufacturer: 'STMicroelectronics', description: 'MCU 32-bit ARM Cortex M3', quantity: 10 },
    { lineNumber: 2, mpn: 'GRM21BR71H104KA01L', manufacturer: 'Murata', description: 'Capacitor 100nF 50V', quantity: 50 },
    { lineNumber: 3, mpn: 'RC0603FR-0710KL', manufacturer: 'Yageo', description: 'Resistor 10K 1%', quantity: 100 },
  ];

  switch (format) {
    case 'json':
      return JSON.stringify({ bomExport: mockRows }, null, 2);
    case 'csv':
      const headers = fields.join(',');
      const rows = mockRows.map((row) =>
        fields.map((f) => (row as Record<string, unknown>)[f] ?? '').join(',')
      );
      return [headers, ...rows].join('\n');
    case 'xml':
      return `<?xml version="1.0" encoding="UTF-8"?>
<bom>
${mockRows.map((row) => `  <lineItem>
    ${fields.map((f) => `<${f}>${(row as Record<string, unknown>)[f] ?? ''}</${f}>`).join('\n    ')}
  </lineItem>`).join('\n')}
</bom>`;
    default:
      // For xlsx, we'd typically use a library - return CSV as fallback
      return generateMockExportData('csv', fields);
  }
}

export default ExportDialog;
