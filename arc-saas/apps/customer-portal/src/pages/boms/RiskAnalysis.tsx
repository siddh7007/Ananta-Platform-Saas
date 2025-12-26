/**
 * BOM Risk Analysis Page
 *
 * Displays comprehensive risk analysis for a BOM including:
 * - Overall risk summary and health grade
 * - Risk distribution (lifecycle, supply chain, pricing)
 * - High-risk components list with pagination
 * - Recommendations for risk mitigation
 * - Ability to recalculate and update criticality
 *
 * QA Fixes Applied:
 * - Pagination/load more for high-risk items
 * - Category-specific breakdown counts
 * - RBAC/minRole enforcement for actions
 * - Tenant guard for risk operations
 * - Normalized risk level comparisons (case-insensitive)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNotification } from '@refinedev/core';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Loader2,
  Sparkles,
  Info,
  Lock,
  Download,
  FileJson,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole, type AppRole } from '@/config/auth';
import {
  getBomRiskDetail,
  getBomLineItemsWithRisk,
  getAllBomLineItemsWithRisk,
  recalculateBomRisk,
  runRiskAnalysis,
  getHealthGradeColor,
  getHealthGradeDescription,
  mapRiskLevel,
  isHighRiskLevel,
  generateRiskReportClientSide,
  type BomRiskSummaryResponse,
  type BomLineItemRiskResponse,
} from '@/services/risk.service';
import { RISK_LEVEL_CONFIG, type RiskLevel } from '@/types/risk';

// Constants
const INITIAL_PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 25;
const MIN_ROLE_FOR_ACTIONS: AppRole = 'engineer';

// Risk level badge component
function RiskLevelBadge({ level }: { level: string }) {
  const mappedLevel = mapRiskLevel(level) as RiskLevel;
  const config = RISK_LEVEL_CONFIG[mappedLevel];

  return (
    <Badge className={`${config.bgColor} ${config.color} border ${config.borderColor}`}>
      {config.label}
    </Badge>
  );
}

// Health grade display component
function HealthGrade({ grade }: { grade: string }) {
  const colors = getHealthGradeColor(grade);
  const description = getHealthGradeDescription(grade);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl font-bold ${colors.bg} ${colors.text} border-2 ${colors.border}`}
          >
            {grade}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Trend indicator component
function TrendIndicator({ trend }: { trend: string }) {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    improving: {
      icon: <TrendingDown className="h-4 w-4" />,
      color: 'text-green-600',
      label: 'Risk decreasing',
    },
    stable: {
      icon: <Minus className="h-4 w-4" />,
      color: 'text-gray-500',
      label: 'Stable',
    },
    worsening: {
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'text-red-600',
      label: 'Risk increasing',
    },
  };

  const trendConfig = config[trend?.toLowerCase()] || config.stable;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${trendConfig.color}`}>
            {trendConfig.icon}
            <span className="text-sm">{trendConfig.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Compared to 7 days ago</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Risk distribution bar segment with interactive tooltip
function RiskBarSegment({
  count,
  total,
  label,
  bgColor,
  textColor,
}: {
  count: number;
  total: number;
  label: string;
  bgColor: string;
  textColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  if (pct === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${bgColor} transition-all hover:opacity-80 cursor-pointer relative group`}
            style={{ width: `${pct}%` }}
            role="graphics-symbol"
            aria-label={`${label}: ${count} components (${pct.toFixed(1)}%)`}
          >
            {/* Show count inside bar if segment is wide enough */}
            {pct >= 12 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {count}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-medium">
          <div className="flex flex-col gap-1">
            <div className={`font-semibold ${textColor}`}>{label} Risk</div>
            <div className="text-sm">
              <span className="font-bold">{count}</span> component{count !== 1 ? 's' : ''}{' '}
              <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Risk distribution bar component with interactive tooltips
function RiskDistributionBar({
  low,
  medium,
  high,
  critical,
  total,
}: {
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
}) {
  if (total === 0) return null;

  const segments = [
    { count: low, label: 'Low', bgColor: 'bg-green-500', textColor: 'text-green-600', dotColor: 'bg-green-500' },
    { count: medium, label: 'Medium', bgColor: 'bg-yellow-500', textColor: 'text-yellow-600', dotColor: 'bg-yellow-500' },
    { count: high, label: 'High', bgColor: 'bg-orange-500', textColor: 'text-orange-600', dotColor: 'bg-orange-500' },
    { count: critical, label: 'Critical', bgColor: 'bg-red-500', textColor: 'text-red-600', dotColor: 'bg-red-500' },
  ];

  return (
    <div className="space-y-3">
      {/* Bar chart with tooltips */}
      <div
        className="flex h-6 rounded-full overflow-hidden shadow-inner bg-muted/30"
        role="img"
        aria-label={`Risk distribution: ${low} low, ${medium} medium, ${high} high, ${critical} critical out of ${total} total`}
      >
        {segments.map((seg) => (
          <RiskBarSegment
            key={seg.label}
            count={seg.count}
            total={total}
            label={seg.label}
            bgColor={seg.bgColor}
            textColor={seg.textColor}
          />
        ))}
      </div>

      {/* Legend with interactive tooltips */}
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.count / total) * 100).toFixed(1) : '0.0';
          return (
            <TooltipProvider key={seg.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-help hover:opacity-70 transition-opacity">
                    <div className={`w-2.5 h-2.5 rounded-full ${seg.dotColor}`} />
                    <span className="text-muted-foreground">{seg.label}:</span>
                    <span className="font-medium">{seg.count}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{seg.count} of {total} components ({pct}%)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// No tenant selected warning
function NoTenantWarning() {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-600" />
          <div>
            <h3 className="font-medium text-yellow-900">No Tenant Selected</h3>
            <p className="text-sm text-yellow-700">
              Please select a tenant from the header to view risk analysis.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Insufficient permissions warning
function InsufficientPermissionsWarning({ action }: { action: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Lock className="h-4 w-4" />
            <span>{action} requires engineer role</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Contact an admin to request elevated permissions</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RiskAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { open: notify } = useNotification();
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();

  // RBAC check
  const userRole = (user?.role || 'analyst') as AppRole;
  const canPerformActions = hasMinimumRole(userRole, MIN_ROLE_FOR_ACTIONS);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ loaded: number; total: number } | null>(null);

  // Data states
  const [riskSummary, setRiskSummary] = useState<BomRiskSummaryResponse | null>(null);
  const [lineItems, setLineItems] = useState<BomLineItemRiskResponse[]>([]);
  const [lineItemsPagination, setLineItemsPagination] = useState<{
    total: number;
    hasMore: boolean;
    offset: number;
  }>({ total: 0, hasMore: false, offset: 0 });
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch risk data
  const fetchData = useCallback(async () => {
    if (!id || !currentTenant) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch BOM risk summary and initial line items in parallel
      const [summaryData, lineItemsResult] = await Promise.all([
        getBomRiskDetail(id),
        getBomLineItemsWithRisk(id, { limit: INITIAL_PAGE_SIZE, offset: 0 }),
      ]);

      setRiskSummary(summaryData);
      setLineItems(lineItemsResult.data);
      setLineItemsPagination({
        total: lineItemsResult.total,
        hasMore: lineItemsResult.hasMore,
        offset: lineItemsResult.data.length,
      });
    } catch (err) {
      console.error('Failed to fetch risk data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load risk analysis');
    } finally {
      setLoading(false);
    }
  }, [id, currentTenant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more line items
  const handleLoadMore = async () => {
    if (!id || loadingMore || !lineItemsPagination.hasMore) return;

    setLoadingMore(true);
    try {
      const result = await getBomLineItemsWithRisk(id, {
        limit: LOAD_MORE_SIZE,
        offset: lineItemsPagination.offset,
      });

      setLineItems((prev) => [...prev, ...result.data]);
      setLineItemsPagination({
        total: result.total,
        hasMore: result.hasMore,
        offset: lineItemsPagination.offset + result.data.length,
      });
    } catch (err) {
      notify?.({
        type: 'error',
        message: 'Failed to load more items',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle recalculate (with RBAC check)
  const handleRecalculate = async () => {
    if (!id || !canPerformActions || !currentTenant) return;

    setRecalculating(true);
    try {
      const result = await recalculateBomRisk(id);

      // Refresh data
      await fetchData();

      notify?.({
        type: 'success',
        message: 'Risk Recalculated',
        description: `Health grade: ${result.health_grade}, Average score: ${result.average_risk_score.toFixed(1)}`,
      });
    } catch (err) {
      notify?.({
        type: 'error',
        message: 'Recalculation Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRecalculating(false);
    }
  };

  // Handle run full analysis (with RBAC check)
  const handleRunAnalysis = async () => {
    if (!id || !canPerformActions || !currentTenant) return;

    setRecalculating(true);
    try {
      const result = await runRiskAnalysis({ bomId: id, forceRecalculate: true });

      notify?.({
        type: 'success',
        message: 'Analysis Started',
        description: result.message,
      });

      // Wait a bit and refresh
      setTimeout(async () => {
        await fetchData();
        setRecalculating(false);
      }, 3000);
    } catch (err) {
      notify?.({
        type: 'error',
        message: 'Analysis Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setRecalculating(false);
    }
  };

  // Handle export (CSV or JSON)
  const handleExport = async (format: 'csv' | 'json') => {
    if (!riskSummary || !currentTenant || !id) return;

    // Warn user for large exports
    const totalItems = lineItemsPagination.total;
    if (totalItems > 5000) {
      const confirmed = window.confirm(
        `This BOM has ${totalItems.toLocaleString()} components. Exporting may take a while. Continue?`
      );
      if (!confirmed) return;
    }

    setExporting(true);
    setExportProgress({ loaded: 0, total: totalItems });
    try {
      // Fetch ALL line items (not just currently loaded page) to ensure complete export
      const allLineItems = await getAllBomLineItemsWithRisk(id, (loaded, total) => {
        setExportProgress({ loaded, total });
      });

      // Generate report client-side using complete data
      const blob = generateRiskReportClientSide(riskSummary, allLineItems, format);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `risk-report-${riskSummary.bom_name || riskSummary.bom_id}-${new Date().toISOString().split('T')[0]}.${format}`;
      link.download = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify?.({
        type: 'success',
        message: 'Export Complete',
        description: `Risk report exported as ${format.toUpperCase()} (${allLineItems.length} items)`,
      });
    } catch (err) {
      notify?.({
        type: 'error',
        message: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  // Get high risk items (case-insensitive filtering)
  const highRiskItems = useMemo(() => {
    return lineItems.filter((item) => isHighRiskLevel(item.risk_level));
  }, [lineItems]);

  // Calculate category-specific breakdowns from line items
  const categoryBreakdown = useMemo(() => {
    if (!riskSummary) return null;

    // Use API-provided counts if available, otherwise derive from line items
    const lifecycleCount = riskSummary.lifecycle_risk_count ??
      lineItems.filter((item) => item.has_lifecycle_risk || item.lifecycle_status === 'obsolete' || item.lifecycle_status === 'eol').length;

    const supplyChainCount = riskSummary.supply_chain_risk_count ??
      riskSummary.single_source_risk_count ??
      lineItems.filter((item) => item.has_supply_chain_risk).length;

    const complianceCount = riskSummary.compliance_risk_count ??
      lineItems.filter((item) => item.has_compliance_risk).length;

    return {
      lifecycle: {
        label: 'Lifecycle Risk',
        description: 'Components at EOL, obsolete, or NRND status',
        count: lifecycleCount,
        color: 'text-red-600',
        icon: <XCircle className="h-5 w-5 text-red-600" />,
      },
      supplyChain: {
        label: 'Supply Chain Risk',
        description: 'Single source, low stock, or long lead times',
        count: supplyChainCount,
        color: 'text-orange-600',
        icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      },
      compliance: {
        label: 'Compliance Risk',
        description: 'RoHS, REACH, or regulatory concerns',
        count: complianceCount,
        color: 'text-yellow-600',
        icon: <Clock className="h-5 w-5 text-yellow-600" />,
      },
    };
  }, [riskSummary, lineItems]);

  // Tenant guard
  if (tenantLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="p-6">
        <NoTenantWarning />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !riskSummary) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Risk Analysis Unavailable</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'No risk data available for this BOM. Try running a risk analysis first.'}
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/boms/${id}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to BOM
              </Button>
              {canPerformActions ? (
                <Button onClick={handleRunAnalysis} disabled={recalculating}>
                  {recalculating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Run Risk Analysis
                </Button>
              ) : (
                <InsufficientPermissionsWarning action="Risk analysis" />
              )}
            </div>
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/boms/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Risk Analysis
            </h1>
            <p className="text-muted-foreground">
              {riskSummary.bom_name || 'Untitled BOM'}
              {riskSummary.project_name && (
                <span> &bull; {riskSummary.project_name}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting} className="min-w-[120px]">
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {exportProgress
                      ? `${Math.round((exportProgress.loaded / Math.max(exportProgress.total, 1)) * 100)}%`
                      : 'Preparing...'}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')} disabled={exporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')} disabled={exporting}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canPerformActions ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalculate
            </Button>
          ) : (
            <InsufficientPermissionsWarning action="Recalculate" />
          )}
          <Link to={`/boms/${id}`}>
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              View BOM
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health Grade */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Health Grade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <HealthGrade grade={riskSummary.health_grade} />
              <div className="text-right">
                <TrendIndicator trend={riskSummary.score_trend} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Risk Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Risk Score</CardDescription>
            <CardTitle className="text-3xl">
              {riskSummary.average_risk_score.toFixed(1)}
              <span className="text-lg text-muted-foreground">/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={riskSummary.average_risk_score}
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Total Components */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Components</CardDescription>
            <CardTitle className="text-3xl">{riskSummary.total_line_items}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {riskSummary.high_risk_count + riskSummary.critical_risk_count} require attention
            </p>
          </CardContent>
        </Card>

        {/* Critical Components */}
        <Card className={riskSummary.critical_risk_count > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription>Critical Risk</CardDescription>
            <CardTitle className={`text-3xl ${riskSummary.critical_risk_count > 0 ? 'text-red-600' : ''}`}>
              {riskSummary.critical_risk_count}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Components needing immediate action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Risk Distribution
          </CardTitle>
          <CardDescription>
            Breakdown of component risk levels across the BOM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RiskDistributionBar
            low={riskSummary.low_risk_count}
            medium={riskSummary.medium_risk_count}
            high={riskSummary.high_risk_count}
            critical={riskSummary.critical_risk_count}
            total={riskSummary.total_line_items}
          />
        </CardContent>
      </Card>

      {/* Category Breakdown Cards */}
      {categoryBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {categoryBreakdown.lifecycle.icon}
                <CardTitle className="text-base">{categoryBreakdown.lifecycle.label}</CardTitle>
              </div>
              <CardDescription>{categoryBreakdown.lifecycle.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${categoryBreakdown.lifecycle.color}`}>
                {categoryBreakdown.lifecycle.count} components
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {categoryBreakdown.supplyChain.icon}
                <CardTitle className="text-base">{categoryBreakdown.supplyChain.label}</CardTitle>
              </div>
              <CardDescription>{categoryBreakdown.supplyChain.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${categoryBreakdown.supplyChain.color}`}>
                {categoryBreakdown.supplyChain.count} components
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {categoryBreakdown.compliance.icon}
                <CardTitle className="text-base">{categoryBreakdown.compliance.label}</CardTitle>
              </div>
              <CardDescription>{categoryBreakdown.compliance.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${categoryBreakdown.compliance.color}`}>
                {categoryBreakdown.compliance.count} components
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* High Risk Components Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                High Risk Components
              </CardTitle>
              <CardDescription>
                Components requiring attention ({highRiskItems.length} of {lineItemsPagination.total} items loaded)
              </CardDescription>
            </div>
            {highRiskItems.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      These components have high or critical risk scores based on lifecycle,
                      supply chain, and pricing factors.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {highRiskItems.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-green-700">No High Risk Components</p>
              <p className="text-muted-foreground">
                All components are within acceptable risk thresholds.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MPN</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-center">Base Score</TableHead>
                    <TableHead className="text-center">Context Score</TableHead>
                    <TableHead className="text-center">Risk Level</TableHead>
                    <TableHead className="text-center">Criticality</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highRiskItems.map((item) => (
                    <TableRow key={item.line_item_id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{item.mpn || '-'}</TableCell>
                      <TableCell>{item.manufacturer || '-'}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.base_risk_score}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.contextual_risk_score >= 75 ? 'destructive' : 'secondary'}
                        >
                          {item.contextual_risk_score}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskLevelBadge level={item.risk_level} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {item.user_criticality_level}/10
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/boms/${id}?highlight=${item.line_item_id}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Load More Button */}
              {lineItemsPagination.hasMore && (
                <div className="p-4 border-t flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    Load More ({lineItemsPagination.total - lineItemsPagination.offset} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Top Risk Components from Summary */}
      {riskSummary.top_risk_components && riskSummary.top_risk_components.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Risk Components</CardTitle>
            <CardDescription>
              Components with the highest risk scores from the analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MPN</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead className="text-center">Risk Score</TableHead>
                  <TableHead className="text-center">Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskSummary.top_risk_components.map((item) => (
                  <TableRow key={item.line_item_id}>
                    <TableCell className="font-medium">{item.mpn || '-'}</TableCell>
                    <TableCell>{item.manufacturer || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.risk_score >= 75 ? 'destructive' : 'secondary'}>
                        {item.risk_score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <RiskLevelBadge level={item.risk_level} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommendations
          </CardTitle>
          <CardDescription>
            Suggested actions to reduce BOM risk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskSummary.critical_risk_count > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Address Critical Components</p>
                  <p className="text-sm text-red-700">
                    {riskSummary.critical_risk_count} components have critical risk.
                    Consider finding alternative parts or securing inventory.
                  </p>
                </div>
              </div>
            )}

            {riskSummary.high_risk_count > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-900">Review High Risk Components</p>
                  <p className="text-sm text-orange-700">
                    {riskSummary.high_risk_count} components have elevated risk.
                    Monitor these for supply chain or lifecycle issues.
                  </p>
                </div>
              </div>
            )}

            {riskSummary.score_trend?.toLowerCase() === 'worsening' && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-900">Risk Trend Increasing</p>
                  <p className="text-sm text-yellow-700">
                    Overall risk has increased compared to the previous analysis.
                    Review recent changes to component data.
                  </p>
                </div>
              </div>
            )}

            {riskSummary.critical_risk_count === 0 &&
              riskSummary.high_risk_count === 0 &&
              riskSummary.score_trend?.toLowerCase() !== 'worsening' && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">BOM Health is Good</p>
                  <p className="text-sm text-green-700">
                    No critical issues detected. Continue monitoring for changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RiskAnalysisPage;
