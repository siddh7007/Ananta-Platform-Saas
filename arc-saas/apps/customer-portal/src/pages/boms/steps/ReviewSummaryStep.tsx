import {
  FileText,
  Info,
  AlertTriangle,
  Upload,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ReviewSummaryStep Component
 *
 * Final review step before BOM upload showing:
 * - File information
 * - BOM metadata (name, description)
 * - Line item count
 * - Enrichment settings
 * - Project context (if applicable)
 * - Validation warnings
 * - Error alerts
 */

interface ReviewSummaryStepProps {
  file: File | null;
  bomName: string;
  bomDescription: string;
  preview: { totalRows: number } | null;
  mapping: {
    mpn?: string;
    manufacturer?: string;
    quantity?: string;
    description?: string;
  };
  autoEnrich: boolean;
  enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
  validationWarnings: string[];
  error: string | null;
  isUploading: boolean;
  onBack: () => void;
  onUpload: () => Promise<void>;
}

const ENRICHMENT_LEVEL_LABELS: Record<
  'basic' | 'standard' | 'comprehensive',
  string
> = {
  basic: 'Basic',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

const ENRICHMENT_LEVEL_COLORS: Record<
  'basic' | 'standard' | 'comprehensive',
  string
> = {
  basic: 'bg-gray-100 text-gray-800',
  standard: 'bg-blue-100 text-blue-800',
  comprehensive: 'bg-purple-100 text-purple-800',
};

export function ReviewSummaryStep({
  file,
  bomName,
  bomDescription,
  preview,
  mapping,
  autoEnrich,
  enrichmentLevel,
  validationWarnings,
  error,
  isUploading,
  onBack,
  onUpload,
}: ReviewSummaryStepProps) {
  // Get project info from localStorage
  const currentProjectId = localStorage.getItem('current_project_id');
  const currentProjectName = localStorage.getItem('current_project_name');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">Review & Upload</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Please review the summary below before uploading your BOM
        </p>
      </div>

      {/* Upload Summary Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Upload Summary</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* File Name */}
          <div>
            <p className="text-xs text-muted-foreground">File Name</p>
            <p className="mt-1 text-sm font-medium truncate">
              {file?.name || 'N/A'}
            </p>
          </div>

          {/* BOM Name */}
          <div>
            <p className="text-xs text-muted-foreground">BOM Name</p>
            <p className="mt-1 text-sm font-medium">
              {bomName || 'Untitled BOM'}
            </p>
          </div>

          {/* Line Items */}
          <div>
            <p className="text-xs text-muted-foreground">Line Items</p>
            <p className="mt-1 text-sm font-medium">{preview?.totalRows || 0}</p>
          </div>

          {/* Description */}
          {bomDescription && (
            <div className="sm:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-1 text-sm">{bomDescription}</p>
            </div>
          )}

          {/* Enrichment Setting */}
          <div className="sm:col-span-3">
            <p className="text-xs text-muted-foreground">Enrichment</p>
            <div className="mt-1 flex items-center gap-2">
              {autoEnrich ? (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      ENRICHMENT_LEVEL_COLORS[enrichmentLevel]
                    )}
                  >
                    {ENRICHMENT_LEVEL_LABELS[enrichmentLevel]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Auto-enrichment enabled
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                  Disabled
                </span>
              )}
            </div>
          </div>

          {/* Column Mapping Summary */}
          <div className="sm:col-span-3">
            <p className="text-xs text-muted-foreground">Mapped Columns</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {mapping.mpn && (
                <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                  MPN: {mapping.mpn}
                </span>
              )}
              {mapping.manufacturer && (
                <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                  Manufacturer: {mapping.manufacturer}
                </span>
              )}
              {mapping.quantity && (
                <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                  Quantity: {mapping.quantity}
                </span>
              )}
              {mapping.description && (
                <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                  Description: {mapping.description}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Context Banner */}
      {currentProjectId && currentProjectName && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Info className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-blue-800">Project Context</p>
            <p className="mt-1 text-sm text-blue-700">
              This BOM will be uploaded to project:{' '}
              <strong>{currentProjectName}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Validation Warnings</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-700">
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={onUpload}
          disabled={isUploading || !file || !bomName}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload BOM
            </>
          )}
        </button>
      </div>
    </div>
  );
}
