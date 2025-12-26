import { Settings, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColumnMappingTemplateSelector } from '@/components/bom/ColumnMappingTemplateSelector';
import { BomColumnMapping, BomFilePreview } from '@/types/bom';

interface ColumnMappingStepProps {
  preview: BomFilePreview | null;
  mapping: BomColumnMapping;
  onMappingChange: (mapping: BomColumnMapping) => void;
  onValidate: () => boolean;
  onBack: () => void;
  onNext: () => void;
}

export function ColumnMappingStep({
  preview,
  mapping,
  onMappingChange,
  onValidate,
  onBack,
  onNext,
}: ColumnMappingStepProps) {
  const handleContinue = () => {
    if (onValidate()) {
      onNext();
    }
  };

  const getPreviewValue = (columnKey: string | undefined): string => {
    if (!columnKey || !preview) return '-';
    const columnIndex = preview.headers.indexOf(columnKey);
    return columnIndex !== -1 ? (preview.rows[0]?.[columnIndex] || '-') : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Map Your Columns</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Match your file columns to BOM fields. We've auto-detected some mappings.
      </p>

      {/* Template Selector */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Column Mapping Templates</h3>
            <p className="text-xs text-muted-foreground">
              Load a saved template or save your current mapping for future use
            </p>
          </div>
        </div>
        <ColumnMappingTemplateSelector
          currentMapping={mapping}
          onMappingChange={onMappingChange}
        />
      </div>

      {/* Field Mapping Dropdowns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries({
          mpn: { label: 'MPN / Part Number', required: true },
          manufacturer: { label: 'Manufacturer', required: false },
          quantity: { label: 'Quantity', required: false },
          description: { label: 'Description', required: false },
          referenceDesignator: { label: 'Reference Designator', required: false },
          footprint: { label: 'Footprint / Package', required: false },
        }).map(([key, config]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium">
              {config.label}
              {config.required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <select
              value={(mapping as unknown as Record<string, string | undefined>)[key] || ''}
              onChange={(e) =>
                onMappingChange({
                  ...mapping,
                  [key]: e.target.value || undefined,
                })
              }
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm',
                config.required && !mapping[key as keyof BomColumnMapping]
                  ? 'border-red-300'
                  : ''
              )}
            >
              <option value="">Select column...</option>
              {preview?.headers.map((h, i) => (
                <option key={i} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Mapped Preview Table */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Mapped Preview</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-primary">MPN</th>
                <th className="px-3 py-2 text-left font-medium">Manufacturer</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {preview?.rows.slice(0, 5).map((row, i) => {
                const getVal = (col: string | undefined) =>
                  col ? row[preview.headers.indexOf(col)] || '-' : '-';
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{getVal(mapping.mpn)}</td>
                    <td className="px-3 py-2">{getVal(mapping.manufacturer)}</td>
                    <td className="px-3 py-2">{getVal(mapping.quantity)}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{getVal(mapping.description)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!mapping.mpn}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
