import { useState, useMemo } from "react";
import { useCustom, useList } from "@refinedev/core";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Users,
  Building2,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Loader2,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GrafanaPanel, GrafanaStatusIndicator } from "@/components/grafana-panel";

// Grafana dashboard UIDs from environment
const GRAFANA_DASHBOARD_METRICS = import.meta.env.VITE_GRAFANA_DASHBOARD_API_PERFORMANCE || "api-performance";
const GRAFANA_DASHBOARD_TENANTS = import.meta.env.VITE_GRAFANA_DASHBOARD_TENANT_METRICS || "tenant-metrics";
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3001";

interface MetricCard {
  name: string;
  value: string | number;
  change?: number;
  changeType?: "increase" | "decrease";
  trend?: "up" | "down" | "neutral";
  sparkline?: number[];
  icon: typeof Activity;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

// Plan prices for MRR calculation
const PLAN_PRICES: Record<string, number> = {
  "plan-basic": 29,
  "plan-standard": 79,
  "plan-premium": 199,
};

// Simple sparkline component
function Sparkline({ data, color = "text-primary" }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 80;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={cn("overflow-visible", color)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Simple bar chart component
function BarChart({ data, height = 120 }: { data: TimeSeriesData[]; height?: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No data available
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length;

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-1">
        {data.map((d, i) => {
          const barHeight = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t"
              style={{ height: `${barHeight}%` }}
              title={`${new Date(d.timestamp).toLocaleTimeString()}: ${d.value.toLocaleString()}`}
            />
          );
        })}
      </div>
      {/* Y-axis labels */}
      <div className="absolute -left-10 inset-y-0 flex flex-col justify-between text-xs text-muted-foreground">
        <span>{max.toLocaleString()}</span>
        <span>{Math.floor(max / 2).toLocaleString()}</span>
        <span>0</span>
      </div>
    </div>
  );
}

// Line chart component
function LineChart({ data, height = 120 }: { data: TimeSeriesData[]; height?: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No data available
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const width = 100;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = ((max - d.value) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,100 ${points} ${width},100`;

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#gradient)" />
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Y-axis labels */}
      <div className="absolute -left-12 inset-y-0 flex flex-col justify-between text-xs text-muted-foreground">
        <span>{max}ms</span>
        <span>{Math.floor((max + min) / 2)}ms</span>
        <span>{min}ms</span>
      </div>
    </div>
  );
}

export function MetricsDashboard() {
  const [timeRange, setTimeRange] = useState("24h");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real data from API
  const { data: tenantsData, isLoading: tenantsLoading, refetch: refetchTenants } = useList({ resource: "tenants" });
  const { data: subscriptionsData, isLoading: subsLoading, refetch: refetchSubs } = useList({ resource: "subscriptions" });
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useList({ resource: "tenant-users" });

  // Fetch metrics from health endpoint
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useCustom({
    url: "health",
    method: "get",
  });

  // Calculate real metrics from API data
  const metrics: MetricCard[] = useMemo(() => {
    const totalTenants = tenantsData?.total || tenantsData?.data?.length || 0;
    const activeUsers = usersData?.total || usersData?.data?.length || 0;
    const activeSubs = subscriptionsData?.data?.filter((s: any) => s.status === "active").length || 0;

    // Calculate MRR from subscriptions
    const mrr = subscriptionsData?.data
      ?.filter((s: any) => s.status === "active")
      .reduce((total: number, sub: any) => {
        const price = PLAN_PRICES[sub.planId] || 0;
        return total + price;
      }, 0) || 0;

    // Get metrics from health endpoint if available
    const apiMetrics = healthData?.data?.metrics || {};
    const avgLatency = apiMetrics.avgResponseTime || 0;
    const errorRate = apiMetrics.errorRate || 0;
    const requestCount = apiMetrics.requestCount || 0;

    return [
      {
        name: "API Requests",
        value: requestCount > 0 ? requestCount.toLocaleString() : "N/A",
        icon: Zap,
      },
      {
        name: "Active Users",
        value: activeUsers.toLocaleString(),
        icon: Users,
      },
      {
        name: "Active Tenants",
        value: totalTenants.toLocaleString(),
        icon: Building2,
      },
      {
        name: "Revenue (MRR)",
        value: `$${mrr.toLocaleString()}`,
        icon: CreditCard,
      },
      {
        name: "Avg Response Time",
        value: avgLatency > 0 ? `${avgLatency}ms` : "N/A",
        icon: Clock,
      },
      {
        name: "Error Rate",
        value: errorRate > 0 ? `${errorRate.toFixed(2)}%` : "N/A",
        icon: AlertTriangle,
      },
    ];
  }, [tenantsData, subscriptionsData, usersData, healthData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchTenants(), refetchSubs(), refetchUsers(), refetchHealth()]);
    setIsRefreshing(false);
  };

  const isLoading = tenantsLoading || subsLoading || usersLoading || healthLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Metrics</h1>
          <p className="text-muted-foreground">
            Real-time performance and usage metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div key={metric.name} className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {metric.name}
                    </span>
                  </div>
                  {metric.change !== undefined && metric.trend && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        metric.trend === "up" ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {metric.trend === "up" ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {metric.change}%
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-bold">{metric.value}</span>
                  {metric.sparkline && (
                    <Sparkline
                      data={metric.sparkline}
                      color={metric.trend === "up" ? "text-green-500" : "text-red-500"}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grafana Dashboards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Grafana Metrics</h3>
            <GrafanaStatusIndicator />
          </div>
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Open Grafana
          </a>
        </div>

        {/* Grafana Panels Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Request Volume Panel */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_METRICS}
            panelId={1}
            title="Request Volume"
            description="API requests over time"
            timeRange={timeRange}
            height={300}
          />

          {/* Response Time Panel */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_METRICS}
            panelId={2}
            title="Response Time"
            description="Average API latency (ms)"
            timeRange={timeRange}
            height={300}
          />
        </div>

        {/* Additional Metrics */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Error Rate Panel */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_METRICS}
            panelId={3}
            title="Error Rate"
            description="HTTP error rate percentage"
            timeRange={timeRange}
            height={300}
          />

          {/* Throughput Panel */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_METRICS}
            panelId={4}
            title="Throughput"
            description="Requests per second"
            timeRange={timeRange}
            height={300}
          />
        </div>
      </div>

      {/* Tenant Metrics Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Tenant Metrics</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Active Tenants */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_TENANTS}
            panelId={1}
            title="Active Tenants"
            description="Tenant activity over time"
            timeRange={timeRange}
            height={300}
          />

          {/* Tenant Usage */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_TENANTS}
            panelId={2}
            title="API Usage by Tenant"
            description="Request distribution across tenants"
            timeRange={timeRange}
            height={300}
          />
        </div>
      </div>

      {/* Endpoint Performance - Full Dashboard */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Endpoint Performance</h3>
        <GrafanaPanel
          dashboardUid={GRAFANA_DASHBOARD_METRICS}
          title="API Performance Dashboard"
          description="Detailed endpoint metrics from Grafana"
          timeRange={timeRange}
          height={500}
        />
      </div>
    </div>
  );
}
