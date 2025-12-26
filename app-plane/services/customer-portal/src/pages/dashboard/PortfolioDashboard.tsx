/**
 * PortfolioDashboard Page Component
 * Owner-role portfolio overview with KPI metrics and activity monitoring
 * @module pages/dashboard
 */

import React, { useState, useEffect, useCallback, useRef, ErrorInfo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardGrid, { GridArea } from '../../components/dashboard/DashboardGrid';
import MetricCard from '../../components/dashboard/widgets/MetricCard';
import RiskDistributionChart from '../../components/dashboard/widgets/RiskDistributionChart';
import ActivityChart from '../../components/dashboard/widgets/ActivityChart';
import AlertsList from '../../components/dashboard/widgets/AlertsList';
import ActivityFeed from '../../components/dashboard/widgets/ActivityFeed';
import ExportButton from '../../components/dashboard/widgets/ExportButton';
import {
  MetricCardSkeleton,
  ChartSkeleton,
  AlertsListSkeleton,
  ActivityFeedSkeleton,
} from '../../components/dashboard/skeletons';
import type { PortfolioMetrics, ExportOptions, Alert } from '../../types/dashboard';

export interface PortfolioDashboardProps {
  /** Tenant ID for data fetching */
  tenantId?: string;
  /** Refresh interval in milliseconds (default: 5 minutes) */
  refreshInterval?: number;
  /** Custom data provider function */
  fetchMetrics?: () => Promise<PortfolioMetrics>;
}

/**
 * PortfolioDashboard provides a 5-minute daily check-in view for portfolio owners
 * Optimized for tablet (iPad) with touch-friendly interactions
 *
 * Features:
 * - Auto-refresh every 5 minutes
 * - Export to PDF/CSV
 * - Role-gated (owner, super_admin only)
 * - Responsive layout (mobile → tablet → desktop)
 */
export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  tenantId,
  refreshInterval = 300000, // 5 minutes
  fetchMetrics,
}) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Store fetchMetrics in ref to avoid interval recreation
  const fetchMetricsRef = useRef(fetchMetrics);
  useEffect(() => {
    fetchMetricsRef.current = fetchMetrics;
  }, [fetchMetrics]);

  // Fetch dashboard metrics
  const loadMetrics = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      // Use custom fetch function or default API call
      let data: PortfolioMetrics;
      if (fetchMetricsRef.current) {
        data = await fetchMetricsRef.current();
      } else {
        // Default implementation - would call actual API
        data = await fetchPortfolioMetrics(tenantId);
      }

      setMetrics(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId]);

  // Store loadMetrics in ref for interval usage
  const loadMetricsRef = useRef(loadMetrics);
  useEffect(() => {
    loadMetricsRef.current = loadMetrics;
  }, [loadMetrics]);

  // Initial load
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      loadMetricsRef.current(true);
    }, refreshInterval);

    return () => clearInterval(interval);
    // Note: loadMetricsRef is intentionally excluded to prevent interval recreation
  }, [refreshInterval]);

  // Handle manual refresh
  const handleRefresh = () => {
    loadMetrics(true);
  };

  // Handle export
  const handleExport = async (options: ExportOptions) => {
    if (!metrics) return;

    setIsExporting(true);

    try {
      // Export implementation would go here
      await exportDashboard(metrics, options);
    } catch (err) {
      console.error('Export failed:', err);
      throw err;
    } finally {
      setIsExporting(false);
    }
  };

  // Handle alert action click - use React Router for SPA navigation
  const handleAlertAction = useCallback((alert: Alert) => {
    if (alert.actionUrl) {
      // Use navigate for internal routes, window.location for external
      if (alert.actionUrl.startsWith('http://') || alert.actionUrl.startsWith('https://')) {
        window.location.href = alert.actionUrl;
      } else {
        navigate(alert.actionUrl);
      }
    }
  }, [navigate]);

  // Format metric values
  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString()}`;
  };

  const formatPercentage = (value: number): string => {
    return `${value}%`;
  };

  // Error State
  if (error && !metrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => loadMetrics()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading && !metrics) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6 flex items-center justify-between">
            <div className="skeleton-title w-64 h-8" />
            <div className="skeleton h-10 w-32 rounded-md" />
          </div>

          {/* Metrics Grid Skeleton */}
          <DashboardGrid>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />

            <GridArea colSpanTablet={1} colSpanDesktop={2}>
              <ChartSkeleton variant="donut" title="Risk Distribution" />
            </GridArea>

            <GridArea colSpanTablet={1} colSpanDesktop={2}>
              <ChartSkeleton variant="area" title="Enrichment Activity (7 Days)" />
            </GridArea>

            <GridArea colSpanTablet={2} colSpanDesktop={4}>
              <AlertsListSkeleton />
            </GridArea>

            <GridArea colSpanTablet={2} colSpanDesktop={4}>
              <ActivityFeedSkeleton />
            </GridArea>
          </DashboardGrid>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Dashboard Header */}
        <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh Indicator */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isRefreshing ? 'Refreshing...' : 'Auto 5m'}
              </span>
            </button>

            {/* Export Button */}
            <ExportButton onExport={handleExport} isLoading={isExporting} />
          </div>
        </header>

        {/* Dashboard Grid */}
        <DashboardGrid>
          {/* Top Row - KPI Metrics */}
          <MetricCard
            value={metrics.totalBoms}
            label="Total BOMs"
            trend={metrics.bomsTrend}
            comparison="across all projects"
          />

          <MetricCard
            value={metrics.atRiskBoms}
            label="At-Risk BOMs"
            trend={metrics.atRiskTrend}
            comparison="medium or higher"
          />

          <MetricCard
            value={metrics.avgEnrichmentScore}
            label="Enrichment Score"
            formatValue={formatPercentage}
            comparison="average across BOMs"
          />

          <MetricCard
            value={metrics.costMtd}
            label="Cost MTD"
            formatValue={formatCurrency}
            comparison={`vs ${formatCurrency(metrics.costBudget)} budget`}
          />

          {/* Second Row - Charts */}
          <GridArea colSpanTablet={1} colSpanDesktop={2}>
            <RiskDistributionChart data={metrics.riskDistribution} />
          </GridArea>

          <GridArea colSpanTablet={1} colSpanDesktop={2}>
            <ActivityChart data={metrics.enrichmentActivity} />
          </GridArea>

          {/* Third Row - Alerts */}
          <GridArea colSpanTablet={2} colSpanDesktop={4}>
            <AlertsList alerts={metrics.criticalAlerts} onActionClick={handleAlertAction} />
          </GridArea>

          {/* Fourth Row - Activity Feed */}
          <GridArea colSpanTablet={2} colSpanDesktop={4}>
            <ActivityFeed activities={metrics.recentActivity} />
          </GridArea>
        </DashboardGrid>
      </div>
    </div>
  );
};

/**
 * Fetch portfolio metrics from API
 * This is a placeholder - actual implementation would call the backend API
 */
async function fetchPortfolioMetrics(tenantId?: string): Promise<PortfolioMetrics> {
  // TODO: Replace with actual API call
  // const response = await fetch(`/api/dashboard/portfolio?tenantId=${tenantId}`);
  // return response.json();

  // Mock data for demonstration
  return {
    totalBoms: 47,
    bomsTrend: { value: 3, direction: 'up', period: 'this week' },
    atRiskBoms: 12,
    atRiskTrend: { value: 2, direction: 'down', period: 'this week' },
    avgEnrichmentScore: 92,
    costMtd: 2340,
    costBudget: 2100,
    riskDistribution: {
      low: 22,
      medium: 13,
      high: 9,
      critical: 3,
    },
    enrichmentActivity: [
      { date: '2025-12-08', count: 12, cost: 245 },
      { date: '2025-12-09', count: 18, cost: 380 },
      { date: '2025-12-10', count: 15, cost: 315 },
      { date: '2025-12-11', count: 22, cost: 465 },
      { date: '2025-12-12', count: 19, cost: 400 },
      { date: '2025-12-13', count: 25, cost: 535 },
      { date: '2025-12-14', count: 16, cost: 340 },
    ],
    criticalAlerts: [
      {
        id: '1',
        type: 'obsolete',
        severity: 'warning',
        message: '3 BOMs have more than 10% obsolete components',
        actionUrl: '/boms?filter=obsolete',
        createdAt: new Date('2025-12-14T08:30:00'),
      },
      {
        id: '2',
        type: 'quota',
        severity: 'warning',
        message: 'Enrichment quota at 85% for this month',
        actionUrl: '/settings/subscription',
        createdAt: new Date('2025-12-14T09:15:00'),
      },
      {
        id: '3',
        type: 'inactive_user',
        severity: 'warning',
        message: '2 team members have not logged in for 30 days',
        actionUrl: '/team',
        createdAt: new Date('2025-12-14T10:00:00'),
      },
    ],
    recentActivity: [
      {
        id: '1',
        userId: 'u1',
        userName: 'Emily Rodriguez',
        action: 'upload',
        target: 'PCB-Rev-3.xlsx',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: '2',
        userId: 'u2',
        userName: 'David Chen',
        action: 'compare',
        target: '5 components',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        id: '3',
        userId: 'system',
        userName: 'System',
        action: 'enrich',
        target: 'BOM-2024-047',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        id: '4',
        userId: 'u3',
        userName: 'Sarah Johnson',
        action: 'approve',
        target: 'BOM-2024-046',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        id: '5',
        userId: 'u1',
        userName: 'Emily Rodriguez',
        action: 'export',
        target: 'Q4 Component Report',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  };
}

/**
 * Export dashboard data
 * This is a placeholder - actual implementation would generate PDF/CSV
 */
async function exportDashboard(
  metrics: PortfolioMetrics,
  options: ExportOptions
): Promise<void> {
  // TODO: Implement actual export logic
  // For PDF: Use jsPDF or similar library
  // For CSV: Generate CSV string and trigger download

  console.log('Exporting dashboard:', options.format, metrics);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Trigger download (mock)
  const filename = `portfolio-dashboard-${new Date().toISOString().split('T')[0]}.${options.format}`;
  console.log(`Downloaded: ${filename}`);
}

PortfolioDashboard.displayName = 'PortfolioDashboard';

export default PortfolioDashboard;
