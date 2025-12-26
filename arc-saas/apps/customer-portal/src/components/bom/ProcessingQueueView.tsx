/**
 * ProcessingQueueView Component
 *
 * Queue Card-based BOM processing view matching original CBP design:
 *
 * Layout:
 * 1. Upload Queue - File-level progress (Pending/Processing/Completed/Failed)
 * 2. Enrichment Queue - Component-level progress with individual MPN list
 * 3. Analysis Queue - Risk analysis status (Pending/Analyzing/Complete)
 * 4. Alerts Queue - Alert stats with quick actions and preferences
 * 5. BOM Processing Complete - Collapsible summary card with detailed stats
 *
 * Features:
 * - 4-column progress grids for each queue
 * - Component Queue showing individual MPNs being processed
 * - Success Rate calculation
 * - Risk Analysis with grade and category scores
 * - Alert stats by severity and type
 * - Collapsible final summary
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import {
  Upload,
  FileSearch,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Clock,
  XCircle,
  FileText,
  RefreshCw,
  Eye,
  BarChart3,
  Bell,
  Pause,
  Play,
  ShieldCheck,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Package,
  AlertCircle,
  Zap,
  FileWarning,
  Link2,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EnrichmentProgressState, SSEConnectionStatus } from '@/hooks/useEnrichmentSSE';

// ============================================================================
// Types
// ============================================================================

export type ProcessingStage =
  | 'raw_upload'
  | 'parsing'
  | 'enrichment'
  | 'risk_analysis'
  | 'complete';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface StageInfo {
  stage: ProcessingStage;
  status: StageStatus;
  progress: number;
  message?: string;
  details?: string;
  startedAt?: Date;
  completedAt?: Date;
  itemsProcessed?: number;
  totalItems?: number;
}

/** Individual component in the enrichment queue */
export interface ComponentQueueItem {
  mpn: string;
  manufacturer?: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  matchConfidence?: number;
  errorMessage?: string;
  /** Component description from BOM or enrichment */
  description?: string;
  /** Lifecycle status (Active, NRND, EOL, Obsolete) */
  lifecycleStatus?: string;
  /** Risk level (low, medium, high, critical) */
  riskLevel?: string;
}

/** Queue progress statistics */
export interface QueueProgressStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

/** Risk analysis data */
export interface RiskAnalysisData {
  status: 'pending' | 'analyzing' | 'complete';
  itemsAnalyzed: number;
  totalItems: number;
  overallScore?: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  highRiskCount: number;
  categoryScores?: {
    lifecycle: number;
    supplyChain: number;
    compliance: number;
  };
}

/** Component status breakdown */
export interface ComponentStatusBreakdown {
  productionReady: number;
  staging: number;
  needsReview: number;
  notFound: number;
}

/** Alerts queue data - stats by severity and type */
export interface AlertsQueueData {
  total: number;
  unread: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  byType?: {
    LIFECYCLE: number;
    RISK: number;
    PRICE: number;
    AVAILABILITY: number;
    COMPLIANCE: number;
    PCN: number;
    SUPPLY_CHAIN: number;
  };
}

/** Enrichment summary data */
export interface EnrichmentSummaryData {
  totalComponents: number;
  enrichedCount: number;
  failedCount: number;
  successRate: number;
  avgMatchConfidence?: number;
}

/** Alert type item for type breakdown display */
export interface AlertTypeItem {
  type: keyof NonNullable<AlertsQueueData['byType']>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

// ============================================================================
// Constants - Severity Colors
// ============================================================================

/** Standardized severity color mappings for consistent UI with dark mode support */
export const SEVERITY_COLORS = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-300 dark:border-red-800',
    ring: 'ring-red-400 dark:ring-red-600',
    // Badge variants (darker bg for badges)
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-950',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-300 dark:border-orange-800',
    ring: 'ring-orange-400 dark:ring-orange-600',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  medium: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-300 dark:border-yellow-800',
    ring: 'ring-yellow-400 dark:ring-yellow-600',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  low: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
    ring: 'ring-blue-400 dark:ring-blue-600',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  info: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
    ring: 'ring-gray-400 dark:ring-gray-600',
    badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
} as const;

/** Risk grade color mappings with dark mode support */
export const RISK_GRADE_COLORS = {
  A: 'bg-green-500 dark:bg-green-600',
  B: 'bg-green-400 dark:bg-green-500',
  C: 'bg-yellow-500 dark:bg-yellow-600',
  D: 'bg-orange-500 dark:bg-orange-600',
  F: 'bg-red-500 dark:bg-red-600',
} as const;

/** Status color mappings for queue stats with dark mode support */
export const STATUS_COLORS = {
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-600 dark:text-gray-400',
    icon: 'text-gray-400 dark:text-gray-500',
    border: 'border-gray-200 dark:border-gray-700',
  },
  processing: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  completed: {
    bg: 'bg-green-50 dark:bg-green-950',
    text: 'text-green-700 dark:text-green-400',
    icon: 'text-green-500 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-400 dark:text-red-500',
    border: 'border-red-200 dark:border-red-800',
  },
  success: {
    text: 'text-green-600 dark:text-green-400',
  },
  // Neutral state for inactive items
  inactive: {
    bg: 'bg-white dark:bg-gray-800',
  },
} as const;

export interface ProcessingQueueViewProps {
  bomId: string;
  fileName: string;
  stages: StageInfo[];
  currentStage: ProcessingStage;
  sseProgress?: EnrichmentProgressState | null;
  connectionStatus?: SSEConnectionStatus;
  // Component queue for enrichment stage
  componentQueue?: ComponentQueueItem[];
  // Risk analysis data
  riskAnalysis?: RiskAnalysisData | null;
  // Component status breakdown (for complete state)
  componentStatus?: ComponentStatusBreakdown | null;
  // Alerts data (rich stats)
  alertsData?: AlertsQueueData | null;
  // Legacy: Alerts count (simple)
  alertsCount?: number;
  // Enrichment summary (for results)
  enrichmentSummary?: EnrichmentSummaryData | null;
  // Core Actions
  onViewDetails?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnrichNow?: () => void;
  onSkip?: () => void;
  onViewBomDetails?: () => void;
  onViewRiskDashboard?: () => void;
  onViewAlerts?: () => void;
  onUploadAnother?: () => void;
  // Context Links - Upload Stage
  onDownloadRawFile?: () => void;
  onViewParsedBom?: () => void;
  // Context Links - Enrichment Stage
  onViewLineItems?: () => void;
  onViewEnrichedComponents?: () => void;
  onViewComponentReview?: (componentId?: string) => void;
  onRerunEnrichment?: () => void;
  // Context Links - Analysis Stage
  onViewComponentAnalysis?: () => void;
  onViewDetailedAnalysis?: () => void;
  onConfigureAlerts?: () => void;
  onRerunRiskAnalysis?: () => void;
  // Context Links - Alerts Stage
  onViewAlertPreferences?: () => void;
  onMarkAllAlertsRead?: () => void;
  onViewCriticalAlerts?: () => void;
  // Context Links - Results
  onViewPassedComponents?: () => void;
  onViewFailedComponents?: () => void;
  onExportResults?: () => void;
  // State flags
  isPaused?: boolean;
  /** Whether complete summary should default to expanded (default: true) */
  defaultExpandedComplete?: boolean;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/** Queue Progress Grid - 4-column status display with actual progress bar */
function QueueProgressGrid({
  stats,
  label = 'Queue Progress',
  showSuccessRate = true,
  unit = 'items',
}: {
  stats: QueueProgressStats;
  label?: string;
  showSuccessRate?: boolean;
  unit?: string;
}) {
  // Calculate progress percentage
  const progressPercent = stats.total > 0
    ? Math.round(((stats.completed + stats.failed) / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {stats.completed + stats.failed} / {stats.total} {unit}
        </span>
      </div>

      {/* Actual Progress Bar - Non-negotiable */}
      <Progress
        value={progressPercent}
        className="h-2"
        aria-label={`${label} progress: ${progressPercent}%`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label={`${label} status breakdown`}>
        {/* Pending */}
        <div className={cn("rounded-lg border p-3 text-center", STATUS_COLORS.pending.bg)} role="status" aria-label={`${stats.pending} pending ${unit}`}>
          <Clock className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.pending.icon)} aria-hidden="true" />
          <div className="text-lg font-semibold">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </div>

        {/* Processing/Enriching */}
        <div className={cn("rounded-lg border p-3 text-center", STATUS_COLORS.processing.bg)} role="status" aria-label={`${stats.processing} ${unit === 'components' ? 'enriching' : 'processing'} ${unit}`}>
          <RefreshCw className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.processing.icon, stats.processing > 0 && "animate-spin")} aria-hidden="true" />
          <div className="text-lg font-semibold">{stats.processing}</div>
          <div className="text-xs text-muted-foreground">{unit === 'components' ? 'Enriching' : 'Processing'}</div>
        </div>

        {/* Completed */}
        <div className={cn("rounded-lg border p-3 text-center", STATUS_COLORS.completed.bg)} role="status" aria-label={`${stats.completed} completed ${unit}`}>
          <CheckCircle className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.completed.icon)} aria-hidden="true" />
          <div className={cn("text-lg font-semibold", STATUS_COLORS.completed.text)}>{stats.completed}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </div>

        {/* Failed */}
        <div className={cn("rounded-lg border p-3 text-center", STATUS_COLORS.failed.bg)} role="status" aria-label={`${stats.failed} failed ${unit}`}>
          <XCircle className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.failed.icon)} aria-hidden="true" />
          <div className="text-lg font-semibold">{stats.failed}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
      </div>

      {showSuccessRate && stats.total > 0 && (stats.completed + stats.failed) > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Success Rate: <span className={cn("font-medium", STATUS_COLORS.success.text)}>{stats.successRate}%</span>
        </div>
      )}
    </div>
  );
}

/** Component Queue List - Shows individual MPNs being processed */
function ComponentQueueList({
  items,
  maxVisible = 20,
  isLoading = false,
}: {
  items: ComponentQueueItem[];
  maxVisible?: number;
  isLoading?: boolean;
}) {
  // Defensive validation - ensure items is an array
  if (!Array.isArray(items)) {
    console.error('[ComponentQueueList] Received non-array items:', items);
    return null;
  }

  const visibleItems = items.slice(0, maxVisible);
  const remainingCount = items.length - maxVisible;

  // Show loading state when items array is empty but processing is active
  if (items.length === 0 && isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">Component Queue</div>
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading component queue...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  // Helper to get lifecycle status color
  const getLifecycleColor = (status?: string) => {
    if (!status) return 'text-muted-foreground';
    const s = status.toLowerCase();
    if (s === 'active' || s === 'production') return 'text-green-600';
    if (s === 'nrnd' || s === 'not recommended') return 'text-yellow-600';
    if (s === 'eol' || s === 'end of life') return 'text-orange-600';
    if (s === 'obsolete' || s === 'discontinued') return 'text-red-600';
    return 'text-muted-foreground';
  };

  // Helper to get confidence badge color
  const getConfidenceColor = (confidence?: number) => {
    if (confidence === undefined) return 'bg-gray-100 text-gray-600';
    if (confidence >= 90) return 'bg-green-100 text-green-700';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-700';
    if (confidence >= 50) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        Component Queue ({items.length})
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto" role="list" aria-label="Component processing queue">
        {visibleItems.map((item, index) => (
          <div
            key={`${item.mpn}-${index}`}
            className="rounded border bg-white dark:bg-gray-800 px-3 py-2"
          >
            {/* Top row: Status icon + MPN + Manufacturer + Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.status === 'done' && (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {item.status === 'processing' && (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                )}
                {item.status === 'pending' && (
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                {item.status === 'failed' && (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium truncate">{item.mpn}</span>
                    {item.manufacturer && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.manufacturer}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                {/* Match Confidence Badge */}
                {item.status === 'done' && item.matchConfidence !== undefined && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    getConfidenceColor(item.matchConfidence)
                  )}>
                    {item.matchConfidence}%
                  </span>
                )}
                {/* Lifecycle Status Badge */}
                {item.lifecycleStatus && item.status === 'done' && (
                  <span className={cn('text-xs font-medium', getLifecycleColor(item.lifecycleStatus))}>
                    {item.lifecycleStatus}
                  </span>
                )}
                {/* Status Badge */}
                {item.status === 'done' && !item.matchConfidence && (
                  <Badge variant="success" className="text-xs">Done</Badge>
                )}
                {item.status === 'failed' && (
                  <Badge variant="destructive" className="text-xs">Failed</Badge>
                )}
              </div>
            </div>
            {/* Bottom row: Description (if available) */}
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1 pl-6">
                {item.description}
              </p>
            )}
            {/* Error message for failed items */}
            {item.status === 'failed' && item.errorMessage && (
              <p className="text-xs text-red-500 mt-1 pl-6 line-clamp-1">
                {item.errorMessage}
              </p>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">
            +{remainingCount} more components
          </div>
        )}
      </div>
    </div>
  );
}

/** Upload Queue Card */
function UploadQueueCard({
  fileName,
  rowCount,
  status,
  message,
  nextStepMessage,
  onEnrichNow,
  onSkip,
  onViewDetails,
  bomId,
  onDownloadRawFile,
  onViewParsedBom,
}: {
  fileName: string;
  rowCount?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  nextStepMessage?: string;
  onEnrichNow?: () => void;
  onSkip?: () => void;
  onViewDetails?: () => void;
  bomId?: string;
  onDownloadRawFile?: () => void;
  onViewParsedBom?: () => void;
}) {
  // Build stats for upload queue (single file)
  const uploadStats: QueueProgressStats = {
    pending: status === 'pending' ? 1 : 0,
    processing: status === 'processing' ? 1 : 0,
    completed: status === 'completed' ? 1 : 0,
    failed: status === 'failed' ? 1 : 0,
    total: 1,
    successRate: status === 'completed' ? 100 : status === 'failed' ? 0 : 0,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-blue-500" />
            Upload Queue
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />0
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />0
            </Badge>
            <Badge variant="success" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />{status === 'completed' ? 1 : 0}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <QueueProgressGrid stats={uploadStats} unit="files" />

        {/* File entry */}
        <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-gray-800 p-3">
          <div className="flex items-center gap-3">
            {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'processing' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            {status === 'pending' && <Clock className="h-5 w-5 text-gray-400" />}
            {status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
            <div>
              <span className="font-medium">{fileName}</span>
              {rowCount && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rowCount} rows
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : 'secondary'}>
              {status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'processing' ? 'Processing' : 'Pending'}
            </Badge>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Success callout with next step */}
        {status === 'completed' && (onEnrichNow || nextStepMessage) && (
          <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-800">
                  Upload Complete: {fileName}
                </p>
                {message && (
                  <p className="text-sm text-green-700 mt-1">{message}</p>
                )}
                {nextStepMessage && (
                  <p className="text-sm text-green-700 mt-2">
                    <span className="font-medium">Next Step:</span> {nextStepMessage}
                  </p>
                )}
                {(onEnrichNow || onSkip || onViewDetails) && (
                  <div className="flex gap-2 mt-3">
                    {onEnrichNow && (
                      <Button size="sm" onClick={onEnrichNow}>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Enrich Now
                      </Button>
                    )}
                    {onSkip && (
                      <Button variant="outline" size="sm" onClick={onSkip}>
                        Skip for Now
                      </Button>
                    )}
                    {onViewDetails && (
                      <Button variant="ghost" size="sm" onClick={onViewDetails}>
                        <Eye className="h-4 w-4 mr-1" />
                        View Upload Details
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Context Links */}
        {status === 'completed' && bomId && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Quick Links</div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              {onDownloadRawFile && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                  onClick={onDownloadRawFile}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Download Raw File
                </Button>
              )}
              {onViewParsedBom && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewParsedBom}
                  >
                    <FileSearch className="h-3 w-3 mr-1" />
                    View Parsed BOM ({rowCount ?? 0} rows)
                  </Button>
                </>
              )}
              {onViewDetails && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewDetails}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    BOM Overview
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </div>
            {/* Summary Stats */}
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>{rowCount ?? 0} line items parsed</span>
              <span>File: {fileName}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Enrichment Queue Card */
function EnrichmentQueueCard({
  fileName,
  componentQueue,
  totalComponents,
  enrichedCount,
  failedCount,
  status,
  bomId,
  onViewBomDetails,
  onViewRiskDashboard,
  onViewLineItems,
  onViewEnrichedComponents,
  onViewComponentReview,
  onRerunEnrichment,
  onViewPassedComponents,
  onViewFailedComponents,
}: {
  fileName: string;
  componentQueue: ComponentQueueItem[];
  totalComponents: number;
  enrichedCount: number;
  failedCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bomId?: string;
  onViewBomDetails?: () => void;
  onViewRiskDashboard?: () => void;
  onViewLineItems?: () => void;
  onViewEnrichedComponents?: () => void;
  onViewComponentReview?: () => void;
  onRerunEnrichment?: () => void;
  onViewPassedComponents?: () => void;
  onViewFailedComponents?: () => void;
}) {
  // FIX: Derive counts from componentQueue if available, as it's more reliable
  // The componentQueue is built from bom_line_items which has the actual enrichment_status
  // The enrichedCount/failedCount props come from bom_processing_jobs which may lag behind
  const queueDoneCount = componentQueue.filter(c => c.status === 'done').length;
  const queueFailedCount = componentQueue.filter(c => c.status === 'failed').length;
  const queueProcessingCount = componentQueue.filter(c => c.status === 'processing').length;
  const queuePendingCount = componentQueue.filter(c => c.status === 'pending').length;

  // Use componentQueue counts if they're meaningful, otherwise fall back to props
  // ComponentQueue is limited to 20 items for performance, so for larger BOMs we need both
  const hasQueueData = componentQueue.length > 0;
  const queueCoversAllItems = componentQueue.length >= totalComponents ||
    (queueDoneCount + queueFailedCount + queueProcessingCount + queuePendingCount) >= totalComponents;

  // If componentQueue has more complete/failed items than the props, trust the queue
  // This handles the case where bom_processing_jobs hasn't been updated yet
  const effectiveEnrichedCount = queueCoversAllItems || queueDoneCount > enrichedCount
    ? queueDoneCount
    : enrichedCount;
  const effectiveFailedCount = queueCoversAllItems || queueFailedCount > failedCount
    ? queueFailedCount
    : failedCount;

  const pendingCount = totalComponents - effectiveEnrichedCount - effectiveFailedCount;
  const processingCount = hasQueueData ? queueProcessingCount : 0;

  const enrichmentStats: QueueProgressStats = {
    pending: Math.max(0, pendingCount - processingCount),
    processing: processingCount,
    completed: effectiveEnrichedCount,
    failed: effectiveFailedCount,
    total: totalComponents,
    successRate: totalComponents > 0 && (effectiveEnrichedCount + effectiveFailedCount) > 0
      ? Math.round((effectiveEnrichedCount / (effectiveEnrichedCount + effectiveFailedCount)) * 100)
      : 0,
  };

  return (
    <Card className={cn(status === 'processing' && 'ring-2 ring-purple-500 ring-offset-2')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Enrichment Queue
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />{enrichmentStats.pending}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />{enrichmentStats.processing}
            </Badge>
            <Badge variant="success" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />{enrichmentStats.completed}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <QueueProgressGrid stats={enrichmentStats} unit="components" />

        {/* File info */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-sm">{fileName}</span>
            <p className="text-xs text-muted-foreground">
              {totalComponents} components - {status === 'completed' ? 'Enrichment Complete' : 'Enriching...'}
            </p>
          </div>
          {status === 'completed' && onViewBomDetails && (
            <Button variant="outline" size="sm" onClick={onViewBomDetails}>
              View Details
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>

        {/* Component Queue */}
        {(componentQueue.length > 0 || status === 'processing') && (
          <ComponentQueueList
            items={componentQueue}
            isLoading={status === 'processing' && componentQueue.length === 0}
          />
        )}

        {/* Success message */}
        {status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Successfully enriched {effectiveEnrichedCount} components.
          </div>
        )}

        {/* Actions */}
        {status === 'completed' && (onViewBomDetails || onViewRiskDashboard) && (
          <div className="flex gap-2 pt-2 border-t">
            {onViewBomDetails && (
              <Button size="sm" onClick={onViewBomDetails}>
                <Eye className="h-4 w-4 mr-1" />
                View BOM Details
              </Button>
            )}
            {onViewRiskDashboard && (
              <Button variant="outline" size="sm" onClick={onViewRiskDashboard}>
                <BarChart3 className="h-4 w-4 mr-1" />
                Risk Dashboard
              </Button>
            )}
          </div>
        )}

        {/* Context Links */}
        {bomId && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Quick Links</div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              {onViewLineItems && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                  onClick={onViewLineItems}
                >
                  <FileSearch className="h-3 w-3 mr-1" />
                  All Line Items
                </Button>
              )}
              {onViewEnrichedComponents && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-green-600 hover:text-green-800"
                    onClick={onViewEnrichedComponents}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enriched ({effectiveEnrichedCount})
                  </Button>
                </>
              )}
              {onViewPassedComponents && effectiveEnrichedCount > 0 && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-green-600 hover:text-green-800"
                    onClick={onViewPassedComponents}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Passed ({effectiveEnrichedCount})
                  </Button>
                </>
              )}
              {onViewFailedComponents && effectiveFailedCount > 0 && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-red-600 hover:text-red-800"
                    onClick={onViewFailedComponents}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed ({effectiveFailedCount})
                  </Button>
                </>
              )}
              {onViewComponentReview && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewComponentReview}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Component Review
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </div>

            {/* Summary Stats Row */}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>{effectiveEnrichedCount}/{totalComponents} enriched</span>
              <span>Success Rate: <span className="text-green-600 font-medium">{enrichmentStats.successRate}%</span></span>
              {effectiveFailedCount > 0 && <span className="text-red-500">{effectiveFailedCount} failed</span>}
            </div>

            {/* Rerun Action */}
            {status === 'completed' && onRerunEnrichment && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={onRerunEnrichment}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-run Enrichment
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Analysis Queue Card */
function AnalysisQueueCard({
  riskAnalysis,
  bomId,
  onViewRiskDashboard,
  onViewAlerts,
  onViewHighRiskItems,
  onViewComponentAnalysis,
  onViewDetailedAnalysis,
  onConfigureAlerts,
  onRerunRiskAnalysis,
}: {
  riskAnalysis?: RiskAnalysisData;
  bomId?: string;
  onViewRiskDashboard?: () => void;
  onViewAlerts?: () => void;
  onViewHighRiskItems?: () => void;
  onViewComponentAnalysis?: () => void;
  onViewDetailedAnalysis?: () => void;
  onConfigureAlerts?: () => void;
  onRerunRiskAnalysis?: () => void;
}) {
  const status = riskAnalysis?.status || 'pending';

  return (
    <Card className={cn(status === 'analyzing' && 'ring-2 ring-orange-500 ring-offset-2')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            Analysis Queue
          </CardTitle>
          <Badge variant={status === 'complete' ? 'success' : status === 'analyzing' ? 'info' : 'secondary'}>
            {status === 'complete' ? 'Complete' : status === 'analyzing' ? 'Analyzing' : 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Risk Analysis</span>
          <span className="text-sm text-muted-foreground">
            {riskAnalysis?.itemsAnalyzed || 0} items analyzed
          </span>
        </div>

        {/* Progress Bar - Non-negotiable */}
        <Progress
          value={
            riskAnalysis?.totalItems && riskAnalysis.totalItems > 0
              ? Math.round((riskAnalysis.itemsAnalyzed / riskAnalysis.totalItems) * 100)
              : status === 'complete' ? 100 : 0
          }
          className="h-2"
          aria-label={`Risk analysis progress: ${
            riskAnalysis?.totalItems && riskAnalysis.totalItems > 0
              ? Math.round((riskAnalysis.itemsAnalyzed / riskAnalysis.totalItems) * 100)
              : status === 'complete' ? 100 : 0
          }%`}
        />

        {/* 3-column status grid - responsive for mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className={cn(
            "rounded-lg border p-3 text-center",
            status === 'pending'
              ? cn(STATUS_COLORS.pending.bg, STATUS_COLORS.pending.border)
              : STATUS_COLORS.inactive.bg
          )}>
            <Clock className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.pending.icon)} />
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className={cn(
            "rounded-lg border p-3 text-center",
            status === 'analyzing'
              ? cn(STATUS_COLORS.processing.bg, STATUS_COLORS.processing.border)
              : STATUS_COLORS.inactive.bg
          )}>
            {status === 'analyzing' ? (
              <Loader2 className={cn("mx-auto h-4 w-4 animate-spin mb-1", STATUS_COLORS.processing.icon)} />
            ) : (
              <BarChart3 className={cn("mx-auto h-4 w-4 mb-1", STATUS_COLORS.pending.icon)} />
            )}
            <div className="text-xs text-muted-foreground">Analyzing</div>
          </div>
          <div className={cn(
            "rounded-lg border p-3 text-center",
            status === 'complete'
              ? cn(STATUS_COLORS.completed.bg, STATUS_COLORS.completed.border)
              : STATUS_COLORS.inactive.bg
          )}>
            <CheckCircle className={cn(
              "mx-auto h-4 w-4 mb-1",
              status === 'complete' ? STATUS_COLORS.completed.icon : STATUS_COLORS.pending.icon
            )} />
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>

        {/* Risk Score */}
        {status === 'complete' && riskAnalysis?.overallScore !== undefined && (
          <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-gray-800 p-4">
            <span className="text-sm">Overall Risk Score</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{riskAnalysis.overallScore}</span>
              <Badge
                variant={riskAnalysis.overallScore < 40 ? 'success' : riskAnalysis.overallScore < 70 ? 'warning' : 'destructive'}
              >
                {riskAnalysis.overallScore < 40 ? 'Low Risk' : riskAnalysis.overallScore < 70 ? 'Medium Risk' : 'High Risk'}
              </Badge>
            </div>
          </div>
        )}

        {/* High Risk Components */}
        {status === 'complete' && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className={cn(
              "h-4 w-4",
              (riskAnalysis?.highRiskCount || 0) > 0 ? 'text-red-500' : 'text-gray-400'
            )} />
            <span className="font-medium">High Risk Components</span>
            {(riskAnalysis?.highRiskCount || 0) === 0 ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                No high-risk components detected
              </span>
            ) : (
              <Badge variant="destructive">{riskAnalysis?.highRiskCount} found</Badge>
            )}
          </div>
        )}

        {/* Actions */}
        {status === 'complete' && (onViewRiskDashboard || onViewAlerts) && (
          <div className="flex gap-2 pt-2 border-t">
            {onViewRiskDashboard && (
              <Button variant="outline" size="sm" onClick={onViewRiskDashboard}>
                <BarChart3 className="h-4 w-4 mr-1" />
                Risk Dashboard
              </Button>
            )}
            {onViewAlerts && (
              <Button variant="ghost" size="sm" onClick={onViewAlerts}>
                <Bell className="h-4 w-4 mr-1" />
                View All Alerts
              </Button>
            )}
          </div>
        )}

        {/* Context Links */}
        {bomId && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Quick Links</div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              {onViewRiskDashboard && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                  onClick={onViewRiskDashboard}
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Full Risk Report
                </Button>
              )}
              {onViewDetailedAnalysis && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewDetailedAnalysis}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Detailed Analysis
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
              {onViewComponentAnalysis && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewComponentAnalysis}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Component Analysis
                  </Button>
                </>
              )}
              {(riskAnalysis?.highRiskCount || 0) > 0 && onViewHighRiskItems && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-red-600 hover:text-red-800"
                    onClick={onViewHighRiskItems}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {riskAnalysis?.highRiskCount} High Risk
                  </Button>
                </>
              )}
            </div>

            {/* Alert Configuration Row */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs items-center">
              {onViewAlerts && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-orange-600 hover:text-orange-800"
                  onClick={onViewAlerts}
                >
                  <Bell className="h-3 w-3 mr-1" />
                  Default Alerts
                </Button>
              )}
              {onConfigureAlerts && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onConfigureAlerts}
                  >
                    <Bell className="h-3 w-3 mr-1" />
                    Configure Alerts
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </div>

            {/* Summary Stats Row */}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Risk Score: <span className={cn(
                "font-medium",
                (riskAnalysis?.overallScore ?? 0) < 40 ? "text-green-600" :
                (riskAnalysis?.overallScore ?? 0) < 70 ? "text-yellow-600" : "text-red-600"
              )}>{riskAnalysis?.overallScore ?? '--'}</span></span>
              <span>Grade: <span className="font-medium">{riskAnalysis?.grade ?? '--'}</span></span>
              <span>Analyzed: {riskAnalysis?.itemsAnalyzed ?? 0}/{riskAnalysis?.totalItems ?? 0}</span>
            </div>

            {/* Rerun Action */}
            {status === 'complete' && onRerunRiskAnalysis && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={onRerunRiskAnalysis}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-run Risk Analysis
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Alerts Queue Card - Shows alert statistics and quick actions */
function AlertsQueueCard({
  alertsData,
  alertsCount = 0,
  bomId,
  onViewAlerts,
  onViewAlertPreferences,
  onMarkAllAlertsRead,
  onViewCriticalAlerts,
}: {
  alertsData?: AlertsQueueData | null;
  alertsCount?: number;
  bomId?: string;
  onViewAlerts?: () => void;
  onViewAlertPreferences?: () => void;
  onMarkAllAlertsRead?: () => void;
  onViewCriticalAlerts?: () => void;
}) {
  // Calculate totals from alertsData or use simple alertsCount
  const total = alertsData?.total ?? alertsCount;
  const unread = alertsData?.unread ?? alertsCount;
  const hasCritical = (alertsData?.bySeverity?.critical ?? 0) > 0;
  const hasHigh = (alertsData?.bySeverity?.high ?? 0) > 0;

  // Severity cards configuration using centralized color constants
  const severityCards = alertsData?.bySeverity ? [
    {
      label: 'Critical',
      severity: 'critical' as const,
      value: alertsData.bySeverity.critical,
      icon: AlertCircle,
    },
    {
      label: 'High',
      severity: 'high' as const,
      value: alertsData.bySeverity.high,
      icon: TrendingDown,
    },
    {
      label: 'Medium',
      severity: 'medium' as const,
      value: alertsData.bySeverity.medium,
      icon: Bell,
    },
    {
      label: 'Low',
      severity: 'low' as const,
      value: alertsData.bySeverity.low,
      icon: Package,
    },
  ] : null;

  // Alert type breakdown with explicit typing (if available)
  const typeBreakdown: AlertTypeItem[] | null = alertsData?.byType ? ([
    { type: 'LIFECYCLE', label: 'Lifecycle', icon: Clock, count: alertsData.byType.LIFECYCLE },
    { type: 'RISK', label: 'Risk', icon: AlertTriangle, count: alertsData.byType.RISK },
    { type: 'PRICE', label: 'Price', icon: TrendingDown, count: alertsData.byType.PRICE },
    { type: 'AVAILABILITY', label: 'Availability', icon: Package, count: alertsData.byType.AVAILABILITY },
    { type: 'COMPLIANCE', label: 'Compliance', icon: ShieldCheck, count: alertsData.byType.COMPLIANCE },
    { type: 'PCN', label: 'PCN', icon: FileWarning, count: alertsData.byType.PCN },
    { type: 'SUPPLY_CHAIN', label: 'Supply Chain', icon: Link2, count: alertsData.byType.SUPPLY_CHAIN },
  ] as AlertTypeItem[]).filter(t => t.count > 0) : null;

  return (
    <Card className={cn(
      hasCritical && 'ring-2 ring-red-400 ring-offset-2',
      hasHigh && !hasCritical && 'ring-2 ring-orange-400 ring-offset-2'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-amber-500" />
            Alerts Queue
          </CardTitle>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {unread} unread
              </Badge>
            )}
            <Badge variant={total === 0 ? 'success' : hasCritical ? 'destructive' : 'secondary'}>
              {total} {total === 1 ? 'alert' : 'alerts'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity Grid - 4-column layout using SEVERITY_COLORS constants */}
        {severityCards && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Alert severity breakdown">
            {severityCards.map((card) => {
              const Icon = card.icon;
              const colors = SEVERITY_COLORS[card.severity];
              const hasValue = card.value > 0;
              return (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-lg border p-3 text-center",
                    hasValue ? colors.bg : 'bg-gray-50',
                    hasValue ? colors.border : 'border-gray-200'
                  )}
                  role="status"
                  aria-label={`${card.value} ${card.label.toLowerCase()} alerts`}
                >
                  <Icon className={cn(
                    "mx-auto h-4 w-4 mb-1",
                    hasValue ? colors.text : 'text-gray-400'
                  )} aria-hidden="true" />
                  <div className={cn(
                    "text-lg font-semibold",
                    hasValue ? colors.text : 'text-gray-500'
                  )}>
                    {card.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Simple count fallback when no severity data */}
        {!severityCards && (
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className={cn(
                "text-4xl font-bold",
                total === 0 ? 'text-green-600' : total > 5 ? 'text-red-600' : 'text-amber-600'
              )}>
                {total}
              </div>
              <div className="text-sm text-muted-foreground">
                {total === 0 ? 'No alerts generated' : 'alerts generated'}
              </div>
            </div>
          </div>
        )}

        {/* Alert Type Breakdown */}
        {typeBreakdown && typeBreakdown.length > 0 && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Alert Types</div>
            <div className="flex flex-wrap gap-2">
              {typeBreakdown.map((item) => {
                const Icon = item.icon;
                return (
                  <Badge key={item.type} variant="outline" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {item.label}: {item.count}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* No alerts message */}
        {total === 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
            <CheckCircle className="h-4 w-4" />
            No critical issues detected
          </div>
        )}

        {/* Quick Actions */}
        {(onViewAlerts || onViewAlertPreferences || onMarkAllAlertsRead) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {onViewAlerts && total > 0 && (
              <Button variant="outline" size="sm" onClick={onViewAlerts}>
                <Bell className="h-4 w-4 mr-1" />
                View All Alerts
              </Button>
            )}
            {onViewCriticalAlerts && hasCritical && (
              <Button variant="destructive" size="sm" onClick={onViewCriticalAlerts}>
                <AlertCircle className="h-4 w-4 mr-1" />
                Critical Alerts
              </Button>
            )}
            {onMarkAllAlertsRead && unread > 0 && (
              <Button variant="ghost" size="sm" onClick={onMarkAllAlertsRead}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>
        )}

        {/* Context Links */}
        {bomId && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Settings</div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              {onViewAlertPreferences && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                  onClick={onViewAlertPreferences}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Alert Preferences
                </Button>
              )}
              {onViewAlerts && (
                <>
                  {onViewAlertPreferences && <span className="text-muted-foreground">|</span>}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={onViewAlerts}
                  >
                    <Bell className="h-3 w-3 mr-1" />
                    Alert Center
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** BOM Processing Complete Summary - Collapsible with detailed stats */
function ProcessingCompleteSummary({
  fileName,
  totalComponents,
  riskAnalysis,
  componentStatus,
  alertsData,
  alertsCount = 0,
  enrichmentSummary,
  onViewBomDetails,
  onViewRiskDashboard,
  onViewAlerts,
  onUploadAnother,
  onExportResults,
  onDownloadRawFile,
  defaultExpanded = true,
  onCollapseWorkflow,
}: {
  fileName: string;
  totalComponents: number;
  riskAnalysis?: RiskAnalysisData;
  componentStatus?: ComponentStatusBreakdown;
  alertsData?: AlertsQueueData | null;
  alertsCount?: number;
  enrichmentSummary?: EnrichmentSummaryData | null;
  onViewBomDetails?: () => void;
  onViewRiskDashboard?: () => void;
  onViewAlerts?: () => void;
  onUploadAnother?: () => void;
  onExportResults?: () => void;
  onDownloadRawFile?: () => void;
  /** Whether to show expanded by default (false = collapsed to show upload zone) */
  defaultExpanded?: boolean;
  /** Callback to collapse entire workflow (global collapse) */
  onCollapseWorkflow?: () => void;
}) {
  // Use defaultExpanded prop to control initial state
  // When onCollapseWorkflow is provided, this component is controlled externally
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use centralized RISK_GRADE_COLORS constant for consistent styling
  const getRiskGradeColor = (grade?: string): string => {
    if (grade && grade in RISK_GRADE_COLORS) {
      return RISK_GRADE_COLORS[grade as keyof typeof RISK_GRADE_COLORS];
    }
    return 'bg-gray-400';
  };

  // Compute effective alerts count
  const effectiveAlertsCount = alertsData?.total ?? alertsCount;
  const criticalCount = alertsData?.bySeverity?.critical ?? 0;
  const highCount = alertsData?.bySeverity?.high ?? 0;

  // Compute success rate from enrichmentSummary or derive from riskAnalysis
  const successRate = enrichmentSummary?.successRate ??
    (totalComponents > 0 && riskAnalysis?.itemsAnalyzed
      ? Math.round((riskAnalysis.itemsAnalyzed / totalComponents) * 100)
      : null);

  return (
    <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-gray-900">
      {/* Header - Always visible with summary stats */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle className="text-lg text-green-800 dark:text-green-200">
                BOM Processing Complete
              </CardTitle>
              <p className="text-sm text-green-600 dark:text-green-400">
                {fileName} - {totalComponents} components analyzed
              </p>
            </div>
          </div>
          {/* Collapse/Expand button - when onCollapseWorkflow provided, collapse entire workflow */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (onCollapseWorkflow) {
                // Collapse entire workflow (all cards)
                onCollapseWorkflow();
              } else {
                // Fallback: toggle just this card's internal state
                setIsExpanded(!isExpanded);
              }
            }}
            className="text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 hover:bg-green-100 dark:hover:bg-green-900"
            aria-expanded={isExpanded}
            aria-label={onCollapseWorkflow ? 'Collapse workflow' : (isExpanded ? 'Collapse details' : 'Expand details')}
          >
            {/* When controlled externally, always show "Collapse Workflow" since we're always expanded */}
            {onCollapseWorkflow ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Collapse Workflow
              </>
            ) : isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Expand
              </>
            )}
          </Button>
        </div>

        {/* Summary stats row */}
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {/* Grade Badge */}
          {riskAnalysis?.grade && (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold",
                getRiskGradeColor(riskAnalysis.grade)
              )}>
                {riskAnalysis.grade}
              </div>
              <span className="text-muted-foreground">Grade</span>
            </div>
          )}

          {/* Risk Score */}
          {riskAnalysis?.overallScore !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "font-semibold",
                riskAnalysis.overallScore < 40 ? 'text-green-600 dark:text-green-400' :
                riskAnalysis.overallScore < 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              )}>
                {riskAnalysis.overallScore}
              </span>
              <span className="text-muted-foreground">Risk Score</span>
            </div>
          )}

          {/* Success Rate */}
          {successRate !== null && (
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "font-semibold",
                successRate >= 90 ? 'text-green-600 dark:text-green-400' :
                successRate >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              )}>
                {successRate}%
              </span>
              <span className="text-muted-foreground">Success Rate</span>
            </div>
          )}

          {/* Alerts */}
          <div className="flex items-center gap-1.5">
            {effectiveAlertsCount === 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">No alerts</span>
              </>
            ) : (
              <>
                <Bell className={cn(
                  "h-4 w-4",
                  criticalCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                )} />
                <span className={cn(
                  "font-semibold",
                  criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {effectiveAlertsCount}
                </span>
                <span className="text-muted-foreground">alerts</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Full detailed content - collapsible (defaults to expanded) */}
      {isExpanded && (
        <CardContent className="space-y-6 pt-4">
          {/* 3-column summary - responsive for mobile */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Risk Analysis */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Risk Analysis</span>
              </div>
              <div className="flex items-center gap-3">
                {riskAnalysis?.grade && (
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-white text-xl font-bold",
                    getRiskGradeColor(riskAnalysis.grade)
                  )}>
                    {riskAnalysis.grade}
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold">
                    {riskAnalysis?.overallScore ?? '--'}
                  </div>
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                </div>
              </div>
              {riskAnalysis?.categoryScores && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Lifecycle</span>
                    <Progress
                      value={riskAnalysis.categoryScores?.lifecycle ?? 0}
                      className="w-20 h-1.5"
                      aria-label={`Lifecycle risk: ${riskAnalysis.categoryScores?.lifecycle ?? 0}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Supply Chain</span>
                    <Progress
                      value={riskAnalysis.categoryScores?.supplyChain ?? 0}
                      className="w-20 h-1.5"
                      aria-label={`Supply chain risk: ${riskAnalysis.categoryScores?.supplyChain ?? 0}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Compliance</span>
                    <Progress
                      value={riskAnalysis.categoryScores?.compliance ?? 0}
                      className="w-20 h-1.5"
                      aria-label={`Compliance risk: ${riskAnalysis.categoryScores?.compliance ?? 0}%`}
                    />
                  </div>
                </div>
              )}
              {riskAnalysis?.highRiskCount !== undefined && riskAnalysis.highRiskCount > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {riskAnalysis.highRiskCount} high-risk components
                  </div>
                </div>
              )}
            </div>

            {/* Component Status */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Component Status</span>
              </div>
              {componentStatus ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Production Ready
                    </span>
                    <span className="font-medium">{componentStatus.productionReady}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      Staging
                    </span>
                    <span className="font-medium">{componentStatus.staging}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm">
                      <XCircle className="h-3 w-3 text-red-500" />
                      Needs Review
                    </span>
                    <span className="font-medium">{componentStatus.needsReview}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      Not Found
                    </span>
                    <span className="font-medium">{componentStatus.notFound}</span>
                  </div>
                </div>
              ) : enrichmentSummary ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Enriched
                    </span>
                    <span className="font-medium">{enrichmentSummary.enrichedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm">
                      <XCircle className="h-3 w-3 text-red-500" />
                      Failed
                    </span>
                    <span className="font-medium">{enrichmentSummary.failedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-medium">{enrichmentSummary.successRate}%</span>
                  </div>
                  {enrichmentSummary.avgMatchConfidence !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Avg Confidence</span>
                      <span className="font-medium">{enrichmentSummary.avgMatchConfidence}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data available</div>
              )}
            </div>

            {/* Alerts Summary */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Alerts Summary</span>
              </div>
              {alertsData?.bySeverity ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      Critical
                    </span>
                    <span className="font-medium">{alertsData.bySeverity.critical}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                      <TrendingDown className="h-3 w-3" />
                      High
                    </span>
                    <span className="font-medium">{alertsData.bySeverity.high}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
                      <Bell className="h-3 w-3" />
                      Medium
                    </span>
                    <span className="font-medium">{alertsData.bySeverity.medium}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                      <Package className="h-3 w-3" />
                      Low
                    </span>
                    <span className="font-medium">{alertsData.bySeverity.low}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-4xl font-bold text-gray-700 dark:text-gray-200">{effectiveAlertsCount}</div>
                  <div className="text-xs text-muted-foreground">alerts generated</div>
                </div>
              )}
              {effectiveAlertsCount === 0 && (
                <div className="flex items-center justify-center gap-1 text-sm text-green-600 dark:text-green-400 mt-2">
                  <CheckCircle className="h-3 w-3" />
                  No critical alerts
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-muted-foreground mb-3">Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              {onViewBomDetails && (
                <Button size="sm" onClick={onViewBomDetails}>
                  <Eye className="h-4 w-4 mr-1" />
                  View Full BOM Details
                </Button>
              )}
              {onViewRiskDashboard && (
                <Button variant="outline" size="sm" onClick={onViewRiskDashboard}>
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Risk Dashboard
                </Button>
              )}
              {onViewAlerts && effectiveAlertsCount > 0 && (
                <Button variant="outline" size="sm" onClick={onViewAlerts}>
                  <Bell className="h-4 w-4 mr-1" />
                  Alert Center
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                      {criticalCount}
                    </Badge>
                  )}
                </Button>
              )}
              {onExportResults && (
                <Button variant="outline" size="sm" onClick={onExportResults}>
                  <Download className="h-4 w-4 mr-1" />
                  Export Results
                </Button>
              )}
              {onDownloadRawFile && (
                <Button variant="ghost" size="sm" onClick={onDownloadRawFile}>
                  <FileText className="h-4 w-4 mr-1" />
                  Download Original
                </Button>
              )}
              {onUploadAnother && (
                <Button variant="ghost" size="sm" onClick={onUploadAnother}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Another BOM
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProcessingQueueView({
  bomId,
  fileName,
  stages,
  currentStage,
  sseProgress,
  connectionStatus,
  componentQueue = [],
  riskAnalysis,
  componentStatus,
  alertsData,
  alertsCount = 0,
  enrichmentSummary,
  // Core Actions
  onViewDetails,
  onCancel,
  onRetry,
  onPause,
  onResume,
  onEnrichNow,
  onSkip,
  onViewBomDetails,
  onViewRiskDashboard,
  onViewAlerts,
  onUploadAnother,
  // Context Links - Upload Stage
  onDownloadRawFile,
  onViewParsedBom,
  // Context Links - Enrichment Stage
  onViewLineItems,
  onViewEnrichedComponents,
  onViewComponentReview,
  onRerunEnrichment,
  // Context Links - Analysis Stage
  onViewComponentAnalysis,
  onViewDetailedAnalysis,
  onConfigureAlerts,
  onRerunRiskAnalysis,
  // Context Links - Alerts Stage
  onViewAlertPreferences,
  onMarkAllAlertsRead,
  onViewCriticalAlerts,
  // Context Links - Results
  onViewPassedComponents,
  onViewFailedComponents,
  onExportResults,
  // State flags
  isPaused = false,
  defaultExpandedComplete = true,
  className,
}: ProcessingQueueViewProps) {
  // Refs for auto-scrolling to active cards
  const uploadCardRef = useRef<HTMLDivElement>(null);
  const enrichmentCardRef = useRef<HTMLDivElement>(null);
  const analysisCardRef = useRef<HTMLDivElement>(null);
  const alertsCardRef = useRef<HTMLDivElement>(null);
  const completeCardRef = useRef<HTMLDivElement>(null);

  // Global collapse state for all queue cards - when complete, use defaultExpandedComplete
  // Workflow cards start expanded during processing, collapse when complete (if defaultExpandedComplete=false)
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(true);

  // Get stage info for each queue
  const uploadStage = stages.find(s => s.stage === 'raw_upload' || s.stage === 'parsing');
  const enrichmentStage = stages.find(s => s.stage === 'enrichment');
  const riskStage = stages.find(s => s.stage === 'risk_analysis');

  // Calculate upload status
  const uploadStatus = useMemo(() => {
    const rawUpload = stages.find(s => s.stage === 'raw_upload');
    const parsing = stages.find(s => s.stage === 'parsing');
    if (parsing?.status === 'completed') return 'completed';
    if (parsing?.status === 'in_progress' || rawUpload?.status === 'in_progress') return 'processing';
    if (parsing?.status === 'failed' || rawUpload?.status === 'failed') return 'failed';
    return 'pending';
  }, [stages]);

  // Get row count from parsing stage
  const rowCount = useMemo(() => {
    const parsing = stages.find(s => s.stage === 'parsing');
    return parsing?.totalItems;
  }, [stages]);

  // Calculate enrichment stats from SSE progress or stage with validation
  const enrichmentData = useMemo(() => {
    // Validate and sanitize SSE data to prevent NaN/negative values from corrupt data
    const rawTotal = sseProgress?.total_items ?? enrichmentStage?.totalItems ?? 0;
    const rawEnriched = sseProgress?.enriched_items ?? enrichmentStage?.itemsProcessed ?? 0;
    const rawFailed = sseProgress?.failed_items ?? 0;

    // Ensure non-negative integers
    const total = Math.max(0, Math.floor(Number(rawTotal) || 0));
    const enriched = Math.max(0, Math.floor(Number(rawEnriched) || 0));
    const failed = Math.max(0, Math.floor(Number(rawFailed) || 0));

    let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';

    if (enrichmentStage?.status === 'completed') status = 'completed';
    else if (enrichmentStage?.status === 'in_progress') status = 'processing';
    else if (enrichmentStage?.status === 'failed') status = 'failed';

    return { total, enriched, failed, status };
  }, [sseProgress, enrichmentStage]);

  // Check if processing is complete
  // Consider both stage status AND riskAnalysis prop status
  const isComplete = stages.every(s => s.status === 'completed' || s.status === 'skipped') ||
    riskAnalysis?.status === 'complete';
  const hasFailed = stages.some(s => s.status === 'failed');

  // Auto-collapse workflow cards when processing completes (if defaultExpandedComplete is false)
  const prevIsCompleteRef = useRef(isComplete);
  useEffect(() => {
    // Only trigger on transition to complete
    if (isComplete && !prevIsCompleteRef.current && !defaultExpandedComplete) {
      setIsWorkflowExpanded(false);
    }
    prevIsCompleteRef.current = isComplete;
  }, [isComplete, defaultExpandedComplete]);

  // Total components for complete summary
  const totalComponents = enrichmentData.total;

  // Auto-scroll to the currently active card
  useEffect(() => {
    const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
      if (ref.current) {
        ref.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };

    // Check analysis active state inline (variable defined later in component)
    const analysisActive = riskStage?.status === 'in_progress' || riskAnalysis?.status === 'analyzing';

    // Determine which card to scroll to based on current state
    if (isComplete && !hasFailed && completeCardRef.current) {
      scrollToRef(completeCardRef);
    } else if (analysisActive && analysisCardRef.current) {
      scrollToRef(analysisCardRef);
    } else if (enrichmentData.status === 'processing' && enrichmentCardRef.current) {
      scrollToRef(enrichmentCardRef);
    }
    // Upload card is always visible, no need to scroll
  }, [isComplete, hasFailed, enrichmentData.status, riskStage?.status, riskAnalysis?.status]);

  // NOTE: We NO LONGER return early for isComplete
  // The full unified flow should be displayed so user can see:
  // 1. All queue cards (Upload, Enrichment, Analysis, Alerts)
  // 2. The ProcessingCompleteSummary at the bottom
  // User decides when to navigate away

  // Determine which queue is active
  // Consider both stage status AND riskAnalysis prop status
  const isUploadActive = uploadStatus === 'processing';
  const isEnrichmentActive = enrichmentData.status === 'processing';
  const isAnalysisActive = riskStage?.status === 'in_progress' || riskAnalysis?.status === 'analyzing';
  const isAnalysisComplete = riskStage?.status === 'completed' || riskAnalysis?.status === 'complete';

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Pause/Resume */}
      {(onPause || onResume) && (isEnrichmentActive || isAnalysisActive) && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Pause className="h-4 w-4 text-yellow-600" />
            ) : (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            <span className="text-sm font-medium">
              {isPaused ? 'Processing Paused' : 'Processing Active'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Button variant="outline" size="sm" onClick={onResume}>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onPause}>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Workflow Summary Header - shown when complete and collapsed */}
      {isComplete && !hasFailed && !isWorkflowExpanded && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/50 p-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg text-green-800 dark:text-green-200">
                    BOM Processing Complete
                  </CardTitle>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {fileName} - {totalComponents} components analyzed
                    {riskAnalysis?.grade && ` • Grade: ${riskAnalysis.grade}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsWorkflowExpanded(true)}
                className="text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 hover:bg-green-100 dark:hover:bg-green-900"
                aria-expanded={isWorkflowExpanded}
                aria-label="Expand workflow details"
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Details
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Workflow Cards Container - collapsible when complete */}
      {isWorkflowExpanded && (
        <>
          {/* Upload Queue */}
          <div ref={uploadCardRef}>
            <UploadQueueCard
              fileName={fileName}
              rowCount={rowCount}
              status={uploadStatus}
              bomId={bomId}
              message={rowCount ? `${rowCount} components ready for enrichment` : undefined}
              nextStepMessage={uploadStatus === 'completed' ? 'Enrich your BOM to get real-time pricing, availability, and datasheets from suppliers.' : undefined}
              onEnrichNow={uploadStatus === 'completed' && onEnrichNow ? onEnrichNow : undefined}
              onSkip={uploadStatus === 'completed' && onSkip ? onSkip : undefined}
              onViewDetails={uploadStatus === 'completed' && onViewDetails ? onViewDetails : undefined}
              onDownloadRawFile={onDownloadRawFile}
              onViewParsedBom={onViewParsedBom || onViewDetails}
            />
          </div>
        </>
      )}

      {/* Enrichment Queue - Show when upload is complete or enrichment is active (and expanded) */}
      {isWorkflowExpanded && (uploadStatus === 'completed' || isEnrichmentActive || enrichmentData.status === 'completed') && (
        <div ref={enrichmentCardRef}>
          <EnrichmentQueueCard
            fileName={fileName}
            componentQueue={componentQueue}
            totalComponents={enrichmentData.total}
            enrichedCount={enrichmentData.enriched}
            failedCount={enrichmentData.failed}
            status={enrichmentData.status}
            bomId={bomId}
            onViewBomDetails={enrichmentData.status === 'completed' ? onViewBomDetails : undefined}
            onViewRiskDashboard={enrichmentData.status === 'completed' ? onViewRiskDashboard : undefined}
            onViewLineItems={onViewLineItems || onViewDetails}
            onViewEnrichedComponents={onViewEnrichedComponents}
            onViewComponentReview={onViewComponentReview}
            onRerunEnrichment={onRerunEnrichment}
            onViewPassedComponents={onViewPassedComponents}
            onViewFailedComponents={onViewFailedComponents}
          />
        </div>
      )}

      {/* Analysis Queue - ONLY show when enrichment is COMPLETED (and expanded) */}
      {/* This ensures the sequential queue flow: Upload -> Enrichment -> Analysis */}
      {isWorkflowExpanded && enrichmentData.status === 'completed' && (
        <div ref={analysisCardRef}>
          <AnalysisQueueCard
            riskAnalysis={riskAnalysis ?? undefined}
            bomId={bomId}
            onViewRiskDashboard={isAnalysisComplete ? onViewRiskDashboard : undefined}
            onViewAlerts={isAnalysisComplete ? onViewAlerts : undefined}
            onViewHighRiskItems={onViewAlerts}
            onViewComponentAnalysis={onViewComponentAnalysis}
            onViewDetailedAnalysis={onViewDetailedAnalysis}
            onConfigureAlerts={onConfigureAlerts}
            onRerunRiskAnalysis={onRerunRiskAnalysis}
          />
        </div>
      )}

      {/* Alerts Queue - ONLY show when Analysis Queue is COMPLETED (and expanded) */}
      {/* Sequential queue flow: Upload -> Enrichment -> Analysis -> Alerts */}
      {isWorkflowExpanded && isAnalysisComplete && (
        <div ref={alertsCardRef}>
          <AlertsQueueCard
            alertsData={alertsData}
            alertsCount={alertsCount}
            bomId={bomId}
            onViewAlerts={onViewAlerts}
            onViewAlertPreferences={onViewAlertPreferences}
            onMarkAllAlertsRead={onMarkAllAlertsRead}
            onViewCriticalAlerts={onViewCriticalAlerts}
          />
        </div>
      )}

      {/* Processing Complete Summary - Show when workflow is complete and expanded (not as early return) */}
      {/* User can see full flow and decide when to navigate away */}
      {isWorkflowExpanded && isComplete && !hasFailed && (
        <div ref={completeCardRef}>
          <ProcessingCompleteSummary
            fileName={fileName}
            totalComponents={totalComponents}
            riskAnalysis={riskAnalysis ?? undefined}
            componentStatus={componentStatus ?? undefined}
            alertsData={alertsData}
            alertsCount={alertsCount}
            enrichmentSummary={enrichmentSummary}
            onViewBomDetails={onViewBomDetails || onViewDetails}
            onViewRiskDashboard={onViewRiskDashboard}
            onViewAlerts={onViewAlerts}
            onUploadAnother={onUploadAnother}
            onExportResults={onExportResults}
            onDownloadRawFile={onDownloadRawFile}
            defaultExpanded={true}
            onCollapseWorkflow={() => setIsWorkflowExpanded(false)}
          />
        </div>
      )}

      {/* Actions */}
      {(onCancel || onRetry) && (
        <div className="flex justify-center gap-3 pt-4">
          {onCancel && (isUploadActive || isEnrichmentActive || isAnalysisActive) && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {onRetry && hasFailed && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcessingQueueView;
