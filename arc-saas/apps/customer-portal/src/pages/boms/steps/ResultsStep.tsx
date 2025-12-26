import { BarChart3, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultsStepProps {
  jobId: string | null;
  enrichmentResults: {
    total: number;
    matched: number;
    failed: number;
    healthGrade?: string;
    averageRiskScore?: number;
    riskBreakdown?: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  } | null;
  error: string | null;
  onViewBom: () => void;
  onUploadAnother: () => void;
}

/**
 * ResultsStep Component
 *
 * Displays enrichment results after BOM processing completes.
 * Shows success metrics, health grade, risk analysis, and action buttons.
 *
 * Extracted from BomUpload.tsx renderResults() function (lines 1381-1510)
 */
export function ResultsStep({
  enrichmentResults,
  error,
  onViewBom,
  onUploadAnother,
}: ResultsStepProps) {
  if (!enrichmentResults) {
    return null;
  }

  const { total, matched, failed, healthGrade, averageRiskScore, riskBreakdown } =
    enrichmentResults;

  const pendingCount = total - matched - failed;
  const hasRiskData = riskBreakdown && Object.values(riskBreakdown).some((v) => v > 0);

  /**
   * Get color classes for health grade badge
   * Grades: A (excellent) to F (fail)
   */
  const getGradeColor = (grade?: string): string => {
    if (!grade) return 'bg-gray-100 text-gray-600';
    const gradeColors: Record<string, string> = {
      A: 'bg-green-100 text-green-700',
      B: 'bg-green-50 text-green-600',
      C: 'bg-yellow-100 text-yellow-700',
      D: 'bg-orange-100 text-orange-700',
      F: 'bg-red-100 text-red-700',
    };
    return gradeColors[grade.toUpperCase()] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <BarChart3 className="h-10 w-10 text-green-600" />
        </div>
        <h3 className="mt-6 text-xl font-semibold">Processing Complete</h3>
        <p className="mt-2 text-muted-foreground">
          Here's a summary of your BOM enrichment and risk analysis
        </p>
      </div>

      {/* Enrichment Results Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Successfully Enriched */}
        <div className="rounded-lg border bg-green-50 p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{matched}</div>
          <div className="mt-1 text-sm text-muted-foreground">Successfully Enriched</div>
        </div>

        {/* Manual Mapping Needed */}
        <div className="rounded-lg border bg-yellow-50 p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Manual Mapping Needed</div>
        </div>

        {/* Failed Items */}
        <div className="rounded-lg border bg-red-50 p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{failed}</div>
          <div className="mt-1 text-sm text-muted-foreground">Failed Items</div>
        </div>
      </div>

      {/* Risk Analysis Results (only show if available) */}
      {(hasRiskData || healthGrade || averageRiskScore !== undefined) && (
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h4 className="font-medium">Risk Analysis Results</h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Health Grade */}
            {healthGrade && (
              <div className="rounded-lg border bg-white p-4 text-center">
                <div
                  className={cn(
                    'mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold',
                    getGradeColor(healthGrade)
                  )}
                >
                  {healthGrade}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">BOM Health Grade</div>
              </div>
            )}

            {/* Average Risk Score */}
            {averageRiskScore !== undefined && (
              <div className="rounded-lg border bg-white p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  {averageRiskScore.toFixed(1)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Avg Risk Score</div>
              </div>
            )}

            {/* Risk Analyzed Count */}
            {riskBreakdown && (
              <div className="rounded-lg border bg-white p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {Object.values(riskBreakdown).reduce((sum, val) => sum + val, 0)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Risk Analyzed</div>
              </div>
            )}
          </div>

          {/* Risk Breakdown Bar Chart */}
          {hasRiskData && riskBreakdown && (
            <div className="mt-4 space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">Risk Breakdown</h5>
              <div className="space-y-1">
                {/* Low Risk */}
                {riskBreakdown.low > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm text-muted-foreground">Low</span>
                    <div className="flex-1 h-6 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(riskBreakdown.low / total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-green-700">
                      {riskBreakdown.low}
                    </span>
                  </div>
                )}

                {/* Medium Risk */}
                {riskBreakdown.medium > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm text-muted-foreground">Medium</span>
                    <div className="flex-1 h-6 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-yellow-500"
                        style={{
                          width: `${(riskBreakdown.medium / total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-yellow-700">
                      {riskBreakdown.medium}
                    </span>
                  </div>
                )}

                {/* High Risk */}
                {riskBreakdown.high > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm text-muted-foreground">High</span>
                    <div className="flex-1 h-6 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-orange-500"
                        style={{
                          width: `${(riskBreakdown.high / total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-orange-700">
                      {riskBreakdown.high}
                    </span>
                  </div>
                )}

                {/* Critical Risk */}
                {riskBreakdown.critical > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-sm text-muted-foreground">Critical</span>
                    <div className="flex-1 h-6 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-red-500"
                        style={{
                          width: `${(riskBreakdown.critical / total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-red-700">
                      {riskBreakdown.critical}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overall Progress */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-medium">Overall Progress</h4>
          <span className="text-sm text-muted-foreground">
            {matched} / {total} items
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (matched / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Processing Error</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={onViewBom}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          View BOM Details
        </button>
        <button
          onClick={onUploadAnother}
          className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
        >
          <BarChart3 className="h-4 w-4" />
          Upload Another BOM
        </button>
      </div>
    </div>
  );
}
