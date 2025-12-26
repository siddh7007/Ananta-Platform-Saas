import { useCustom, useCustomMutation } from "@refinedev/core";
import { useState } from "react";
import {
  Activity,
  Database,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Loader2,
  BarChart3,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageStatus {
  metricType: string;
  metricName: string;
  currentUsage: number;
  softLimit: number;
  hardLimit: number;
  percentUsed: number;
  isOverSoftLimit: boolean;
  isOverHardLimit: boolean;
  unit: string;
  remainingAllowance: number;
}

interface UsageSummary {
  id: string;
  metricType: string;
  billingPeriod: string;
  totalQuantity: number;
  includedQuantity: number;
  overageQuantity: number;
  overageAmount: number;
  unit: string;
  eventCount: number;
}

interface UsageTrendPoint {
  period: string;
  quantity: number;
  eventCount: number;
}

interface UsageAnalytics {
  period: string;
  metrics: Array<{
    metricType: string;
    metricName: string;
    totalUsage: number;
    includedUsage: number;
    overageUsage: number;
    overageAmount: number;
    unit: string;
  }>;
  totalOverageAmount: number;
}

const METRIC_ICONS: Record<string, typeof Activity> = {
  api_calls: Zap,
  storage_gb: Database,
  users: Users,
  workflows: Activity,
  integrations: BarChart3,
  custom: Activity,
};

const METRIC_COLORS: Record<string, string> = {
  api_calls: "bg-blue-500",
  storage_gb: "bg-purple-500",
  users: "bg-green-500",
  workflows: "bg-orange-500",
  integrations: "bg-pink-500",
  custom: "bg-gray-500",
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function UsageDashboard() {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Fetch usage status
  const {
    data: statusData,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useCustom<UsageStatus[]>({
    url: "/usage/status",
    method: "get",
  });

  // Fetch usage analytics
  const { data: analyticsData, isLoading: analyticsLoading } =
    useCustom<UsageAnalytics>({
      url: "/usage/analytics",
      method: "get",
    });

  // Fetch usage trend for selected metric
  const { data: trendData, isLoading: trendLoading } = useCustom<
    UsageTrendPoint[]
  >({
    url: `/usage/trends/${selectedMetric || "api_calls"}`,
    method: "get",
    config: {
      query: { months: 6 },
    },
  });

  // Initialize quotas mutation
  const { mutate: initializeQuotas, isLoading: initLoading } =
    useCustomMutation();

  const usageStatus = (statusData?.data as UsageStatus[]) || [];
  const analytics = analyticsData?.data as UsageAnalytics | undefined;
  const trends = (trendData?.data as UsageTrendPoint[]) || [];

  // Calculate summary stats
  const totalOverage = analytics?.totalOverageAmount || 0;
  const warningCount = usageStatus.filter((s) => s.isOverSoftLimit && !s.isOverHardLimit).length;
  const criticalCount = usageStatus.filter((s) => s.isOverHardLimit).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage & Quotas</h1>
          <p className="text-muted-foreground">
            Monitor your resource consumption and plan limits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchStatus()}
            disabled={statusLoading}
            className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {statusLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Period</p>
              <p className="text-xl font-bold">{analytics?.period || "-"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Metrics Tracked</p>
              <p className="text-xl font-bold">{usageStatus.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                warningCount > 0 || criticalCount > 0
                  ? "bg-yellow-100"
                  : "bg-gray-100"
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-5 w-5",
                  criticalCount > 0
                    ? "text-red-600"
                    : warningCount > 0
                    ? "text-yellow-600"
                    : "text-gray-400"
                )}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quota Alerts</p>
              <p className="text-xl font-bold">
                {warningCount + criticalCount}
                {criticalCount > 0 && (
                  <span className="text-sm text-red-600 ml-1">
                    ({criticalCount} critical)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                totalOverage > 0 ? "bg-red-100" : "bg-gray-100"
              )}
            >
              <TrendingUp
                className={cn(
                  "h-5 w-5",
                  totalOverage > 0 ? "text-red-600" : "text-gray-400"
                )}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overage Charges</p>
              <p className="text-xl font-bold">{formatCurrency(totalOverage)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Meters */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Resource Usage</h2>
          <p className="text-sm text-muted-foreground">
            Current consumption against your plan limits
          </p>
        </div>
        <div className="p-6">
          {statusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : usageStatus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No quotas configured yet.</p>
              <button
                onClick={() =>
                  initializeQuotas({
                    url: "/usage/quotas/initialize",
                    method: "post",
                    values: { planId: "plan-basic" },
                  })
                }
                disabled={initLoading}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {initLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Initialize Quotas
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {usageStatus.map((status) => {
                const Icon = METRIC_ICONS[status.metricType] || Activity;
                const bgColor = METRIC_COLORS[status.metricType] || "bg-gray-500";
                const progressColor = status.isOverHardLimit
                  ? "bg-red-500"
                  : status.isOverSoftLimit
                  ? "bg-yellow-500"
                  : "bg-green-500";

                return (
                  <div
                    key={status.metricType}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-colors",
                      selectedMetric === status.metricType
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedMetric(status.metricType)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center text-white",
                            bgColor
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{status.metricName}</span>
                      </div>
                      {status.isOverHardLimit && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          Over Limit
                        </span>
                      )}
                      {status.isOverSoftLimit && !status.isOverHardLimit && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                          Warning
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatNumber(status.currentUsage)} / {formatNumber(status.hardLimit)}{" "}
                          {status.unit}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            status.isOverHardLimit
                              ? "text-red-600"
                              : status.isOverSoftLimit
                              ? "text-yellow-600"
                              : "text-green-600"
                          )}
                        >
                          {status.percentUsed.toFixed(1)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", progressColor)}
                          style={{
                            width: `${Math.min(status.percentUsed, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Soft limit: {formatNumber(status.softLimit)}</span>
                        <span>
                          {status.remainingAllowance > 0
                            ? `${formatNumber(status.remainingAllowance)} remaining`
                            : "Quota exceeded"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Usage Trend */}
      {selectedMetric && (
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Trend:{" "}
              {usageStatus.find((s) => s.metricType === selectedMetric)?.metricName ||
                selectedMetric}
            </h2>
            <p className="text-sm text-muted-foreground">
              6-month usage history
            </p>
          </div>
          <div className="p-6">
            {trendLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : trends.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No historical data available
              </p>
            ) : (
              <div className="space-y-4">
                {/* Simple bar chart representation */}
                <div className="flex items-end gap-2 h-40">
                  {trends.map((point, index) => {
                    const maxQuantity = Math.max(...trends.map((t) => t.quantity));
                    const heightPercent =
                      maxQuantity > 0 ? (point.quantity / maxQuantity) * 100 : 0;

                    return (
                      <div
                        key={point.period}
                        className="flex-1 flex flex-col items-center"
                      >
                        <div className="w-full flex flex-col items-center">
                          <span className="text-xs text-muted-foreground mb-1">
                            {formatNumber(point.quantity)}
                          </span>
                          <div
                            className="w-full bg-primary/80 rounded-t transition-all"
                            style={{ height: `${Math.max(heightPercent, 4)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground mt-2">
                          {point.period.slice(-2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(trends.reduce((sum, t) => sum + t.eventCount, 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Avg/Month</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(
                        trends.reduce((sum, t) => sum + t.quantity, 0) / trends.length
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Peak</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(Math.max(...trends.map((t) => t.quantity)))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && analytics.metrics.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Period Summary</h2>
            <p className="text-sm text-muted-foreground">
              Billing period: {analytics.period}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Total Usage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Included
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Overage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Overage Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.metrics.map((metric) => (
                  <tr key={metric.metricType}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-6 w-6 rounded flex items-center justify-center text-white text-xs",
                            METRIC_COLORS[metric.metricType] || "bg-gray-500"
                          )}
                        >
                          {(() => {
                            const Icon = METRIC_ICONS[metric.metricType] || Activity;
                            return <Icon className="h-3 w-3" />;
                          })()}
                        </div>
                        <span className="font-medium">{metric.metricName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {formatNumber(metric.totalUsage)} {metric.unit}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {formatNumber(metric.includedUsage)} {metric.unit}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {metric.overageUsage > 0 ? (
                        <span className="text-yellow-600">
                          +{formatNumber(metric.overageUsage)} {metric.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {metric.overageAmount > 0 ? (
                        <span className="text-red-600 font-medium">
                          {formatCurrency(metric.overageAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td colSpan={4} className="px-6 py-3 text-right font-medium">
                    Total Overage Charges
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-red-600">
                    {formatCurrency(analytics.totalOverageAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
