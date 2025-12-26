/**
 * BOM Detail Page
 *
 * Displays detailed view of a BOM with:
 * - Summary statistics
 * - Paginated line items table
 * - Search and filtering
 * - Enrichment status indicators
 * - Export functionality
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOne, useList, useNotification } from '@refinedev/core';
import {
  FileText,
  ArrowLeft,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Shield,
  History,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SupplierPricingPanel } from '@/components/pricing';
import { ActivityLog } from '@/components/bom';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole } from '@/config/auth';
import type { AppRole } from '@/config/auth';
import { getBomStatusType, getBomStatusLabel, getEnrichmentStatusType, getEnrichmentStatusLabel } from '@/lib/bom-status';
import {
  exportBom,
  startEnrichment,
  getBomHistory,
  restoreBomVersion,
} from '@/services/bom.service';
import type { BomActivityEvent, BomVersion } from '@/types/activity';
import type {
  Bom,
  BomLineItem,
  BomStatus,
  EnrichmentStatus,
  BomSummaryStats,
} from '@/types/bom';
import { formatPrice } from '@/types/supplier';
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';
import { useProcessingStatus } from '@/hooks/useProcessingStatus';
import { ProcessingQueueView } from '@/components/bom/ProcessingQueueView';

// Helper to find best pricing option from a line item's pricing array
function getBestPricing(pricing?: Array<{ unitPrice?: number; currency?: string; stock?: number }>, quantity?: number) {
  if (!pricing || pricing.length === 0) return null;

  // Filter to suppliers with valid pricing
  const validPricing = pricing.filter((p) => p.unitPrice !== undefined && p.unitPrice !== null);
  if (validPricing.length === 0) return null;

  // If quantity specified, prefer suppliers with enough stock
  if (quantity) {
    const withStock = validPricing.filter((p) => (p.stock ?? 0) >= quantity);
    if (withStock.length > 0) {
      // Find lowest price among those with stock
      return withStock.reduce((best, curr) =>
        (curr.unitPrice ?? Infinity) < (best.unitPrice ?? Infinity) ? curr : best
      );
    }
  }

  // Fallback to lowest price regardless of stock
  return validPricing.reduce((best, curr) =>
    (curr.unitPrice ?? Infinity) < (best.unitPrice ?? Infinity) ? curr : best
  );
}

// Helper component to render BOM status badge
function BomStatusBadge({ status }: { status: BomStatus }) {
  return (
    <StatusBadge
      status={getBomStatusType(status)}
      customLabel={getBomStatusLabel(status)}
      size="sm"
    />
  );
}

// Helper component to render enrichment status badge
function EnrichmentStatusBadge({ status }: { status: EnrichmentStatus }) {
  return (
    <StatusBadge
      status={getEnrichmentStatusType(status)}
      customLabel={getEnrichmentStatusLabel(status)}
      size="sm"
    />
  );
}

// Lifecycle risk badge
function RiskBadge({ risk }: { risk?: string }) {
  if (!risk || risk === 'none') return null;

  const colors: Record<string, string> = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-orange-100 text-orange-800',
    high: 'bg-red-100 text-red-800',
    critical: 'bg-red-200 text-red-900',
  };

  return (
    <Badge className={`${colors[risk] || ''} text-xs`}>
      {risk}
    </Badge>
  );
}

// Constants for enrichment staleness detection
const ENRICHMENT_STALE_DAYS = 7; // Consider re-enrichment after 7 days

export function BomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { open: notify } = useNotification();
  // Access tenant context for future filtering - kept for consistency
  useTenant();
  // Role-based permissions for export/edit controls
  const { user } = useAuth();
  const userRole = (user?.role || 'analyst') as AppRole;
  const canEnrich = hasMinimumRole(userRole, 'engineer');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Enrichment state
  const [showEnrichConfirm, setShowEnrichConfirm] = useState(false);
  const [isEnrichmentInitiated, setIsEnrichmentInitiated] = useState(false);

  // Supplier pricing dialog state
  const [selectedLineItem, setSelectedLineItem] = useState<BomLineItem | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);

  // Activity log state
  const [activities, setActivities] = useState<BomActivityEvent[]>([]);
  const [versions, setVersions] = useState<BomVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  // Server-side pagination state for activities
  const [totalActivities, setTotalActivities] = useState<number | undefined>();
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [isLoadingMoreActivities, setIsLoadingMoreActivities] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 50;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch BOM details (moved up before useMemo that depends on bom)
  const {
    data: bomData,
    isLoading: bomLoading,
    refetch: refetchBom,
  } = useOne<Bom>({
    resource: 'boms',
    id: id!,
    dataProviderName: 'cns', // Route to CNS service (port 27200)
  });

  const bom = bomData?.data;

  // SSE hook for real-time enrichment progress
  const {
    progress: sseProgress,
    progressPercent: sseProgressPercent,
    isComplete: sseIsComplete,
    isFailed: sseIsFailed,
    error: sseError,
    isProcessing: sseIsProcessing,
    connectionStatus,
    disconnect: disconnectSSE,
  } = useEnrichmentSSE(id || '', {
    autoConnect: isEnrichmentInitiated, // Only connect when enrichment is initiated
    bomStatus: bom?.status, // Pass BOM status to validate before connecting
    onProgress: (state) => {
      console.log('[SSE] Progress update:', state);
    },
    onComplete: (event) => {
      console.log('[SSE] Enrichment completed:', event);
      notify?.({
        type: 'success',
        message: 'Enrichment Complete',
        description: `${event.state?.enriched_items || 0} of ${event.state?.total_items || 0} lines enriched`,
      });
      // Refresh BOM data
      refetchBom();
      refetchLineItems();
      setIsEnrichmentInitiated(false);
    },
    onError: (error) => {
      console.error('[SSE] Enrichment error:', error);
      notify?.({
        type: 'error',
        message: 'Enrichment Failed',
        description: error,
      });
      setIsEnrichmentInitiated(false);
    },
  });

  // Log SSE connection status changes
  useEffect(() => {
    console.log('[SSE] Connection status changed:', connectionStatus);
  }, [connectionStatus]);

  // Processing status hook for multi-stage queue view
  const {
    status: processingStatus,
    stages: processingStages,
    currentStage: processingCurrentStage,
    isLoading: processingStatusLoading,
    connectionStatus: processingConnectionStatus,
    pause: pauseProcessing,
    resume: resumeProcessing,
    cancel: cancelProcessing,
    isPaused: isProcessingPaused,
    isComplete: isProcessingComplete,
    isFailed: isProcessingFailed,
    // Enhanced UI data for Queue Cards
    componentQueue,
    riskAnalysis,
    componentStatus,
    alertsCount,
  } = useProcessingStatus({
    bomId: id || '',
    enabled: !!id,
    onComplete: () => {
      // Refresh BOM data when processing completes
      refetchBom();
      refetchLineItems();
    },
  });

  // Determine if we should show the processing queue view
  const showProcessingView = useMemo(() => {
    if (!processingStatus) return false;
    // Show if processing is active (running/paused) or recently completed with stages
    const hasStages = processingStages.length > 0;
    const isActive = processingStatus.status === 'running' || processingStatus.status === 'paused';
    const recentlyCompleted = processingStatus.status === 'completed' &&
      processingStatus.completed_at &&
      (Date.now() - new Date(processingStatus.completed_at).getTime()) < 5 * 60 * 1000; // Within last 5 min
    return hasStages && (isActive || recentlyCompleted || isProcessingFailed);
  }, [processingStatus, processingStages, isProcessingFailed]);

  // Check if BOM needs re-enrichment (stale data)
  const needsReEnrichment = useMemo(() => {
    if (!bom) return false;
    // Don't show re-enrich for in-progress or failed states
    if (bom.status === 'pending' || bom.status === 'analyzing' ||
        bom.status === 'processing' || bom.status === 'enriching' ||
        bom.status === 'failed') {
      return false;
    }

    // Never enriched
    if (!bom.lastEnrichedAt) return true;

    // Check if enrichment is stale
    const lastEnriched = new Date(bom.lastEnrichedAt);
    const daysSinceEnrichment = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceEnrichment > ENRICHMENT_STALE_DAYS;
  }, [bom]);

  // Fetch line items with pagination and filters
  const {
    data: lineItemsData,
    isLoading: lineItemsLoading,
    refetch: refetchLineItems,
  } = useList<BomLineItem>({
    resource: `boms/${id}/line_items`,  // CNS endpoint uses underscore: /api/boms/{id}/line_items
    dataProviderName: 'cns', // Route to CNS service (port 27200)
    pagination: { current: page, pageSize },
    filters: [
      ...(debouncedSearch
        ? [{ field: 'search', operator: 'contains' as const, value: debouncedSearch }]
        : []),
      ...(statusFilter !== 'all'
        ? [{ field: 'enrichment_status', operator: 'eq' as const, value: statusFilter }]
        : []),
    ],
    queryOptions: { enabled: !!id },
  });

  const lineItems = lineItemsData?.data || [];
  const totalItems = lineItemsData?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Calculate summary stats from line items
  const summaryStats = useMemo((): BomSummaryStats | null => {
    if (!bom) return null;

    const stats: BomSummaryStats = {
      totalLines: bom.lineCount,
      enrichedLines: bom.enrichedCount,
      matchedLines: 0,
      partialMatches: 0,
      notFound: 0,
      obsoleteCount: 0,
      eolCount: 0,
      singleSourceCount: 0,
      enrichmentCoverage: bom.lineCount > 0 ? (bom.enrichedCount / bom.lineCount) * 100 : 0,
      pricingCoverage: 0,
    };

    // Count from current page line items (would need full data for accurate counts)
    lineItems.forEach((item) => {
      if (item.enrichmentStatus === 'matched') stats.matchedLines++;
      if (item.enrichmentStatus === 'enriched') stats.partialMatches++;
      if (item.enrichmentStatus === 'no_match') stats.notFound++;
      if (item.obsolete) stats.obsoleteCount++;
      if (item.singleSource) stats.singleSourceCount++;
      if (item.pricing && item.pricing.length > 0) stats.pricingCoverage++;
    });

    return stats;
  }, [bom, lineItems]);

  // Cleanup SSE connection on unmount - always disconnect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Always disconnect on unmount regardless of state
      disconnectSSE();
    };
  }, [disconnectSSE]);

  // Fetch activity history when activity log is opened
  useEffect(() => {
    if (!showActivityLog || !id) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      setActivityPage(1);

      try {
        const historyData = await getBomHistory(id, { limit: ACTIVITY_PAGE_SIZE, page: 1 });
        const fetchedActivities = historyData.activities || [];
        setActivities(fetchedActivities);
        setVersions(historyData.versions || []);
        // Track pagination state
        const total = historyData.total ?? fetchedActivities.length;
        setTotalActivities(total);
        setHasMoreActivities(fetchedActivities.length < total);
      } catch (error) {
        console.error('Failed to fetch BOM history:', error);
        setHistoryError(
          error instanceof Error ? error.message : 'Failed to load activity history'
        );
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [showActivityLog, id]);

  // Handle loading more activities from server
  const handleLoadMoreActivities = useCallback(async () => {
    if (!id || isLoadingMoreActivities || !hasMoreActivities) return;

    setIsLoadingMoreActivities(true);
    const nextPage = activityPage + 1;

    try {
      const historyData = await getBomHistory(id, { limit: ACTIVITY_PAGE_SIZE, page: nextPage });
      const newActivities = historyData.activities || [];

      // Append new activities to existing ones
      setActivities((prev) => [...prev, ...newActivities]);
      setActivityPage(nextPage);

      // Update pagination state
      const total = historyData.total ?? totalActivities ?? activities.length + newActivities.length;
      setTotalActivities(total);
      setHasMoreActivities(activities.length + newActivities.length < total);
    } catch (error) {
      console.error('Failed to load more activities:', error);
      notify?.({
        type: 'error',
        message: 'Failed to load more activities',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoadingMoreActivities(false);
    }
  }, [id, activityPage, isLoadingMoreActivities, hasMoreActivities, activities.length, totalActivities, notify]);

  // Handle version restore
  const handleRestoreVersion = useCallback(
    async (version: BomVersion) => {
      if (!id) return;

      setIsRestoring(true);

      try {
        await restoreBomVersion({
          bomId: id,
          versionId: version.id,
          comment: `Restored from version ${version.versionNumber}`,
        });

        notify?.({
          type: 'success',
          message: 'Version Restored',
          description: `BOM restored to version ${version.versionNumber}`,
        });

        // Refresh data
        refetchBom();
        refetchLineItems();

        // Refresh history
        const historyData = await getBomHistory(id, { limit: 50 });
        setActivities(historyData.activities || []);
        setVersions(historyData.versions || []);
      } catch (error) {
        notify?.({
          type: 'error',
          message: 'Restore Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setIsRestoring(false);
      }
    },
    [id, notify, refetchBom, refetchLineItems]
  );

  // Handle start enrichment
  const handleStartEnrichment = useCallback(async () => {
    if (!id) return;

    setShowEnrichConfirm(false);

    try {
      // Start the enrichment process via API
      await startEnrichment({
        bomId: id,
        options: {
          enrichmentLevel: 'standard',
          includeAlternates: true,
          includeObsolescence: true,
        },
      });

      // Initiate SSE connection
      setIsEnrichmentInitiated(true);

      notify?.({
        type: 'success',
        message: 'Enrichment Started',
        description: 'Your BOM is being enriched. This may take a few minutes.',
      });
    } catch (error) {
      notify?.({
        type: 'error',
        message: 'Failed to Start Enrichment',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [id, notify]);

  // Handle export
  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    if (!id) return;

    try {
      const blob = await exportBom({
        bomId: id,
        format,
        includeEnrichment: true,
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bom_${id.substring(0, 8)}_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      notify?.({
        type: 'success',
        message: 'Export successful',
        description: `BOM exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      notify?.({
        type: 'error',
        message: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetchBom();
    refetchLineItems();
  };

  if (bomLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!bom) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">BOM Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The requested BOM could not be found or you don't have access.
            </p>
            <Button onClick={() => navigate('/boms')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to BOMs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/boms')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{bom.name}</h1>
            <p className="text-muted-foreground">
              {bom.fileName} &bull; {bom.lineCount.toLocaleString()} lines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BomStatusBadge status={bom.status} />

          {/* Re-Enrich Button - show when data is stale or BOM is completed */}
          {canEnrich && !sseIsProcessing && (needsReEnrichment || bom.status === 'completed' || bom.status === 'mapping_pending') && (
            <Button
              variant={needsReEnrichment ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowEnrichConfirm(true)}
              className={needsReEnrichment ? 'animate-pulse' : ''}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {needsReEnrichment ? 'Re-Enrich (Stale)' : 'Re-Enrich'}
            </Button>
          )}

          {/* Enriching indicator with SSE progress */}
          {sseIsProcessing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-md text-blue-700 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Enriching...
                {sseProgressPercent > 0 && (
                  <span className="ml-1">{sseProgressPercent}%</span>
                )}
                {connectionStatus !== 'connected' && (
                  <span className="ml-1 text-xs text-orange-600">({connectionStatus})</span>
                )}
              </span>
            </div>
          )}

          <Link to={`/boms/${id}/risk`}>
            <Button variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-2" />
              Risk Analysis
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActivityLog(true)}
          >
            <History className="h-4 w-4 mr-2" />
            Activity
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={sseIsProcessing}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(v) => handleExport(v as 'csv' | 'xlsx' | 'json')}>
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2" />
              Export
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Multi-Stage Processing Queue View */}
      {showProcessingView && processingStatus && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="py-6">
            <ProcessingQueueView
              bomId={id || ''}
              fileName={bom?.fileName || bom?.name || 'BOM'}
              stages={processingStages}
              currentStage={processingCurrentStage}
              sseProgress={sseProgress}
              connectionStatus={processingConnectionStatus}
              // Enhanced UI props
              componentQueue={componentQueue}
              riskAnalysis={riskAnalysis ?? undefined}
              componentStatus={componentStatus ?? undefined}
              alertsCount={alertsCount}
              isPaused={isProcessingPaused}
              // Actions
              onPause={processingStatus?.status === 'running' ? pauseProcessing : undefined}
              onResume={isProcessingPaused ? resumeProcessing : undefined}
              onCancel={processingStatus?.status === 'running' ? cancelProcessing : undefined}
              onViewDetails={() => {
                // Could navigate to a detailed processing log
                setShowActivityLog(true);
              }}
              onViewBomDetails={() => {
                // Scroll to BOM details section
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Legacy Enrichment Progress Banner with SSE (fallback when no processing stages) */}
      {!showProcessingView && sseIsProcessing && sseProgress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-900">Enriching BOM data...</span>
                    {sseProgress.current_item && (
                      <Badge variant="outline" className="text-xs">
                        Processing: {sseProgress.current_item.mpn}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-blue-700">
                    {sseProgress.enriched_items} / {sseProgress.total_items} enriched
                    {sseProgress.failed_items > 0 && (
                      <span className="text-orange-600 ml-2">({sseProgress.failed_items} errors)</span>
                    )}
                  </span>
                </div>
                <Progress value={sseProgress.percent_complete} className="h-2" />
                {sseProgress.estimated_time_remaining && sseProgress.estimated_time_remaining > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Est. time remaining: {Math.ceil(sseProgress.estimated_time_remaining / 60)} min
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Lines</CardDescription>
              <CardTitle className="text-2xl">{summaryStats.totalLines.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Enrichment Coverage</CardDescription>
              <CardTitle className="text-2xl">{summaryStats.enrichmentCoverage.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={summaryStats.enrichmentCoverage} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Matched</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {summaryStats.enrichedLines.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-orange-300 transition-colors" onClick={() => navigate(`/boms/${id}/risk`)}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                Risk Flags
                <Shield className="h-4 w-4 text-orange-600" />
              </CardDescription>
              <CardTitle className="text-2xl text-orange-600">
                {summaryStats.obsoleteCount + summaryStats.singleSourceCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {summaryStats.obsoleteCount} obsolete, {summaryStats.singleSourceCount} single-source
              <span className="block mt-1 text-blue-600 hover:underline">View Risk Analysis</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Line Items</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search MPN, manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="not_found">Not Found</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lineItemsLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading line items...</p>
            </div>
          ) : lineItems.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {debouncedSearch || statusFilter !== 'all'
                  ? 'No items match your filters'
                  : 'No line items found'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="w-48">MPN</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="w-20 text-center">Qty</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                    <TableHead className="w-24 text-right">Price</TableHead>
                    <TableHead className="w-20 text-right">Stock</TableHead>
                    <TableHead className="w-16">Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="text-muted-foreground">
                        {item.lineNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.mpn}</div>
                        {item.componentData?.datasheetUrl && (
                          <a
                            href={item.componentData.datasheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Datasheet
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>{item.manufacturer || item.componentData?.manufacturer || '-'}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {item.description || item.componentData?.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <EnrichmentStatusBadge status={item.enrichmentStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const bestPrice = getBestPricing(item.pricing, item.quantity);
                          return (
                            <button
                              type="button"
                              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              onClick={() => {
                                setSelectedLineItem(item);
                                setShowPricingDialog(true);
                              }}
                              title="View supplier pricing"
                            >
                              {bestPrice && bestPrice.unitPrice !== undefined ? (
                                <span className="font-medium text-blue-600 hover:underline">
                                  {formatPrice(bestPrice.unitPrice, bestPrice.currency)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground hover:text-foreground">
                                  View Pricing
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const bestPrice = getBestPricing(item.pricing, item.quantity);
                          const stock = bestPrice?.stock;
                          const meetsQty = stock !== undefined && item.quantity && stock >= item.quantity;
                          return (
                            <button
                              type="button"
                              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                              onClick={() => {
                                setSelectedLineItem(item);
                                setShowPricingDialog(true);
                              }}
                              title="View stock availability"
                            >
                              {stock !== undefined ? (
                                <Badge
                                  variant={meetsQty ? 'default' : stock === 0 ? 'destructive' : 'outline'}
                                  className={`text-xs hover:opacity-80 ${
                                    !meetsQty && stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : ''
                                  }`}
                                >
                                  {stock.toLocaleString()}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground hover:text-foreground text-xs">
                                  Check
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {item.obsolete && (
                          <Badge variant="destructive" className="text-xs">EOL</Badge>
                        )}
                        <RiskBadge risk={item.lifecycleRisk} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalItems)} of{' '}
                  {totalItems.toLocaleString()} items
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {new Date(bom.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Updated</dt>
              <dd className="font-medium">
                {new Date(bom.updatedAt).toLocaleDateString()}
              </dd>
            </div>
            {bom.lastEnrichedAt && (
              <div>
                <dt className="text-muted-foreground">Last Enriched</dt>
                <dd className="font-medium">
                  {new Date(bom.lastEnrichedAt).toLocaleDateString()}
                </dd>
              </div>
            )}
            {bom.createdByName && (
              <div>
                <dt className="text-muted-foreground">Created By</dt>
                <dd className="font-medium">{bom.createdByName}</dd>
              </div>
            )}
            {bom.enrichmentSource && (
              <div>
                <dt className="text-muted-foreground">Enrichment Source</dt>
                <dd className="font-medium capitalize">{bom.enrichmentSource}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Re-Enrichment Confirmation Dialog */}
      {showEnrichConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowEnrichConfirm(false)}
          />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Re-Enrich BOM</h3>
            </div>

            <p className="text-muted-foreground mb-4">
              This will re-process all {bom.lineCount.toLocaleString()} line items to fetch
              the latest component data, pricing, and availability information.
            </p>

            {needsReEnrichment && bom.lastEnrichedAt && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-md text-amber-800 text-sm mb-4">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Last enriched{' '}
                  {Math.round((Date.now() - new Date(bom.lastEnrichedAt).getTime()) / (1000 * 60 * 60 * 24))}{' '}
                  days ago. Data may be outdated.
                </span>
              </div>
            )}

            <div className="bg-muted/50 rounded-md p-3 mb-6 text-sm">
              <p className="font-medium mb-2">This will update:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Component matching and specifications</li>
                <li>Current pricing from distributors</li>
                <li>Stock availability</li>
                <li>Lifecycle status and risk flags</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEnrichConfirm(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleStartEnrichment}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Enrichment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Supplier Pricing
              {selectedLineItem && (
                <Badge variant="outline" className="font-mono">
                  {selectedLineItem.mpn}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLineItem && (
            <SupplierPricingPanel
              mpn={selectedLineItem.mpn}
              manufacturer={selectedLineItem.manufacturer || selectedLineItem.componentData?.manufacturer}
              requiredQuantity={selectedLineItem.quantity}
              onSelectSupplier={(supplier) => {
                notify?.({
                  type: 'success',
                  message: 'Supplier Selected',
                  description: `Selected ${supplier.supplier_name} at ${supplier.currency} ${supplier.unit_price?.toFixed(2) || 'N/A'}`,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={showActivityLog} onOpenChange={setShowActivityLog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Activity Log
              {bom && (
                <Badge variant="outline" className="font-normal">
                  {bom.name}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ActivityLog
            bomId={id!}
            activities={activities}
            versions={versions}
            isLoading={historyLoading}
            error={historyError || undefined}
            onRestoreVersion={handleRestoreVersion}
            isRestoring={isRestoring}
            maxItems={20}
            totalActivities={totalActivities}
            hasMoreActivities={hasMoreActivities}
            onLoadMoreActivities={handleLoadMoreActivities}
            isLoadingMore={isLoadingMoreActivities}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BomDetailPage;
