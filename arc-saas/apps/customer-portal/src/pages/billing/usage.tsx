/**
 * Usage Dashboard Page
 *
 * Shows tenant's resource usage vs quotas with:
 * - Progress bars for each metric (current vs limit)
 * - Warning states when approaching/exceeding quotas
 * - Usage trend charts
 * - Breakdown by billing period
 */

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import {
  getUsageStatus,
  getUsageTrend,
  getUsageAnalytics,
} from '@/services/billing.service';
import type { UsageStatus, UsageTrend, UsageAnalytics } from '@/types/usage';
import {
  formatMetricName,
  getUsageStatusColor,
  formatUsageValue,
} from '@/types/usage';

export default function UsagePage() {
  const [usageStatus, setUsageStatus] = useState<UsageStatus[]>([]);
  const [trends, setTrends] = useState<Record<string, UsageTrend[]>>({});
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load usage data
  useEffect(() => {
    async function loadUsageData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load current status and analytics
        const [statusData, analyticsData] = await Promise.all([
          getUsageStatus().catch(() => []),
          getUsageAnalytics().catch(() => null),
        ]);

        setUsageStatus(statusData);
        setAnalytics(analyticsData);

        // Load trends for each metric (in parallel)
        if (statusData.length > 0) {
          const trendPromises = statusData.map(async (status) => {
            try {
              const trendData = await getUsageTrend(status.metricType, 6);
              return { metricType: status.metricType, data: trendData };
            } catch {
              return { metricType: status.metricType, data: [] };
            }
          });

          const trendResults = await Promise.all(trendPromises);
          const trendsMap = trendResults.reduce((acc, { metricType, data }) => {
            acc[metricType] = data;
            return acc;
          }, {} as Record<string, UsageTrend[]>);

          setTrends(trendsMap);
        }
      } catch (err) {
        console.error('Failed to load usage data:', err);
        setError('Failed to load usage information');
      } finally {
        setIsLoading(false);
      }
    }

    loadUsageData();
  }, []);

  // Render usage status card
  const renderUsageCard = (status: UsageStatus) => {
    const color = getUsageStatusColor(status);
    const hasLimit = status.hardLimit !== null;

    const colorClasses = {
      green: 'border-green-500 bg-green-50',
      yellow: 'border-yellow-500 bg-yellow-50',
      red: 'border-red-500 bg-red-50',
      gray: 'border-gray-300 bg-gray-50',
    };

    const barColorClasses = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      gray: 'bg-blue-500',
    };

    return (
      <div
        key={status.metricType}
        className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm">{formatMetricName(status.metricType)}</h3>
            <p className="text-xs text-muted-foreground">{status.unit}</p>
          </div>
          {status.isOverHardLimit && (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          {status.isOverSoftLimit && !status.isOverHardLimit && (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          )}
        </div>

        {/* Current usage */}
        <div className="mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatUsageValue(status.currentUsage, status.unit)}
            </span>
            {hasLimit && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-lg text-muted-foreground">
                  {formatUsageValue(status.hardLimit!, status.unit)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {hasLimit && (
          <div className="mb-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColorClasses[color]} transition-all`}
                style={{ width: `${Math.min(100, status.percentUsed)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status.percentUsed}% used
              {status.remainingAllowance !== null &&
                status.remainingAllowance >= 0 &&
                ` • ${formatUsageValue(status.remainingAllowance, status.unit)} remaining`}
            </p>
          </div>
        )}

        {!hasLimit && (
          <p className="text-xs text-muted-foreground">Unlimited</p>
        )}

        {/* Warnings */}
        {status.isOverHardLimit && (
          <div className="mt-2 text-xs text-red-700 font-medium">
            Hard limit exceeded - service may be throttled
          </div>
        )}
        {status.isOverSoftLimit && !status.isOverHardLimit && (
          <div className="mt-2 text-xs text-yellow-700 font-medium">
            Approaching limit - consider upgrading
          </div>
        )}

        {/* Mini trend */}
        {trends[status.metricType] && trends[status.metricType].length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              <span>Last 6 months</span>
            </div>
            <div className="flex items-end gap-1 h-8">
              {trends[status.metricType].slice(-6).map((trend, idx) => {
                const maxQuantity = Math.max(
                  ...trends[status.metricType].map(t => t.quantity),
                  1
                );
                const heightPercent = (trend.quantity / maxQuantity) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-blue-400 rounded-t"
                    style={{ height: `${heightPercent}%` }}
                    title={`${trend.period}: ${formatUsageValue(
                      trend.quantity,
                      status.unit
                    )}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Usage & Quotas
        </h1>
        <p className="text-muted-foreground">
          Monitor your resource usage and plan limits
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && analytics.totalOverageAmount && analytics.totalOverageAmount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">Overage Detected</h3>
              <p className="text-sm text-yellow-800 mt-1">
                You've exceeded your plan limits this billing period.
                Additional charges may apply.
              </p>
              {analytics.metrics.some(m => m.overageCost && m.overageCost > 0) && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-yellow-900">
                    Estimated overage cost: $
                    {analytics.metrics
                      .reduce((sum, m) => sum + (m.overageCost || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-8 w-24 bg-muted rounded mb-2" />
              <div className="h-2 bg-muted rounded mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Usage cards */}
      {!isLoading && usageStatus.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {usageStatus.map((status) => renderUsageCard(status))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && usageStatus.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium text-lg mb-1">No usage data available</h3>
          <p className="text-sm text-muted-foreground">
            Usage tracking will appear here once you start using the platform
          </p>
        </div>
      )}

      {/* Analytics period info */}
      {analytics && !isLoading && (
        <div className="text-xs text-muted-foreground text-center">
          Billing period: {analytics.period}
        </div>
      )}
    </div>
  );
}
