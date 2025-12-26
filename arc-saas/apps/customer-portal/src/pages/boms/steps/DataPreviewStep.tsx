import { FileText, X, Table, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataPreviewStepProps {
  file: File | null;
  preview: {
    headers: string[];
    rows: string[][];
    totalRows: number;
  } | null;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function DataPreviewStep({
  file,
  preview,
  onReset,
  onBack,
  onNext,
}: DataPreviewStepProps) {
  return (
    <div className="space-y-6">
      {/* File Info Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">{file?.name}</p>
            <p className="text-sm text-muted-foreground">
              {preview?.totalRows.toLocaleString()} rows detected
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Remove file"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Data Preview Table */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Data Preview</h3>
          <span className="text-sm text-muted-foreground">(first 10 rows)</span>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  #
                </th>
                {preview?.headers.map((h, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview?.rows.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {i + 1}
                  </td>
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-2">
                      {cell || <span className="text-muted-foreground/50">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
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
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
