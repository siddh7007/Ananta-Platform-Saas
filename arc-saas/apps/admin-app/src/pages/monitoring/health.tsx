import { useState, useEffect, useCallback } from "react";
import { useCustom } from "@refinedev/core";
import {
  Activity,
  Server,
  Database,
  Cloud,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  Shield,
  GitBranch,
  Mail,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GrafanaPanel, GrafanaStatusIndicator } from "@/components/grafana-panel";

// Grafana dashboard UIDs from environment
const GRAFANA_DASHBOARD_HEALTH = import.meta.env.VITE_GRAFANA_DASHBOARD_PLATFORM_HEALTH || "platform-health";
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3001";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latency?: number;
  lastCheck: string;
  details?: string;
  uptime?: string;
  version?: string;
}

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: "normal" | "warning" | "critical";
  threshold?: { warning: number; critical: number };
}

const STATUS_CONFIG = {
  healthy: { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle, label: "Healthy" },
  degraded: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle, label: "Degraded" },
  unhealthy: { color: "bg-red-100 text-red-700 border-red-200", icon: XCircle, label: "Unhealthy" },
  unknown: { color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertTriangle, label: "Unknown" },
};

const SERVICE_ICONS: Record<string, typeof Server> = {
  "API Gateway": Server,
  "Tenant Service": Cloud,
  "Subscription Service": Zap,
  "User Service": Shield,
  PostgreSQL: Database,
  Redis: Database,
  Keycloak: Shield,
  Temporal: GitBranch,
  "Email Service": Mail,
  Stripe: Zap,
};

// Default empty metrics
const DEFAULT_METRICS: SystemMetric[] = [
  { name: "CPU Usage", value: 0, unit: "%", status: "normal", threshold: { warning: 70, critical: 90 } },
  { name: "Memory Usage", value: 0, unit: "%", status: "normal", threshold: { warning: 80, critical: 95 } },
  { name: "Disk Usage", value: 0, unit: "%", status: "normal", threshold: { warning: 75, critical: 90 } },
  { name: "Network I/O", value: 0, unit: "MB/s", status: "normal" },
  { name: "Active Connections", value: 0, unit: "", status: "normal" },
  { name: "Request Rate", value: 0, unit: "req/min", status: "normal" },
];

export function SystemHealthDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric[]>(DEFAULT_METRICS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch health data from API
  const { data: healthData, refetch: refetchHealth, isLoading } = useCustom({
    url: "/health",
    method: "get",
  });

  // Update services when health data is available
  useEffect(() => {
    if (healthData?.data?.services) {
      setServices(healthData.data.services);
    }
    if (healthData?.data?.metrics) {
      const apiMetrics = healthData.data.metrics;
      setMetrics([
        { name: "CPU Usage", value: apiMetrics.cpu || 0, unit: "%", status: "normal", threshold: { warning: 70, critical: 90 } },
        { name: "Memory Usage", value: apiMetrics.memory?.percentage || 0, unit: "%", status: "normal", threshold: { warning: 80, critical: 95 } },
        { name: "Disk Usage", value: apiMetrics.disk || 0, unit: "%", status: "normal", threshold: { warning: 75, critical: 90 } },
        { name: "Network I/O", value: apiMetrics.network || 0, unit: "MB/s", status: "normal" },
        { name: "Active Connections", value: apiMetrics.connections || 0, unit: "", status: "normal" },
        { name: "Request Rate", value: apiMetrics.requestRate || 0, unit: "req/min", status: "normal" },
      ]);
    }
  }, [healthData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchHealth();
    } catch {
      // Error handled by useCustom hook
    }
    setLastRefresh(new Date());
    setIsRefreshing(false);
  }, [refetchHealth]);

  // Calculate overall status
  const overallStatus = services.some((s) => s.status === "unhealthy")
    ? "unhealthy"
    : services.some((s) => s.status === "degraded")
    ? "degraded"
    : "healthy";

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const unhealthyCount = services.filter((s) => s.status === "unhealthy").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            Monitor the health of all platform services
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh
          </label>
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

      {/* Overall Status Banner */}
      <div
        className={cn(
          "rounded-lg border p-6",
          overallStatus === "healthy" && "bg-green-50 border-green-200",
          overallStatus === "degraded" && "bg-yellow-50 border-yellow-200",
          overallStatus === "unhealthy" && "bg-red-50 border-red-200"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center",
                overallStatus === "healthy" && "bg-green-100",
                overallStatus === "degraded" && "bg-yellow-100",
                overallStatus === "unhealthy" && "bg-red-100"
              )}
            >
              {overallStatus === "healthy" && <CheckCircle className="h-6 w-6 text-green-600" />}
              {overallStatus === "degraded" && <AlertTriangle className="h-6 w-6 text-yellow-600" />}
              {overallStatus === "unhealthy" && <XCircle className="h-6 w-6 text-red-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                System Status:{" "}
                <span
                  className={cn(
                    overallStatus === "healthy" && "text-green-700",
                    overallStatus === "degraded" && "text-yellow-700",
                    overallStatus === "unhealthy" && "text-red-700"
                  )}
                >
                  {overallStatus === "healthy" && "All Systems Operational"}
                  {overallStatus === "degraded" && "Partial System Degradation"}
                  {overallStatus === "unhealthy" && "System Issues Detected"}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {healthyCount} healthy, {degradedCount} degraded, {unhealthyCount} unhealthy
              </p>
            </div>
          </div>
          <div className="flex gap-8 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{degradedCount}</p>
              <p className="text-xs text-muted-foreground">Degraded</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{unhealthyCount}</p>
              <p className="text-xs text-muted-foreground">Unhealthy</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.name} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{metric.name}</span>
              {metric.name === "CPU Usage" && <Cpu className="h-4 w-4 text-muted-foreground" />}
              {metric.name === "Memory Usage" && <HardDrive className="h-4 w-4 text-muted-foreground" />}
              {metric.name === "Disk Usage" && <Database className="h-4 w-4 text-muted-foreground" />}
              {metric.name === "Network I/O" && <Wifi className="h-4 w-4 text-muted-foreground" />}
              {metric.name === "Active Connections" && <Activity className="h-4 w-4 text-muted-foreground" />}
              {metric.name === "Request Rate" && <Zap className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="mt-2 text-2xl font-bold">
              {metric.value.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {metric.unit}
              </span>
            </p>
            {metric.threshold && (
              <div className="mt-2">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      metric.value < metric.threshold.warning && "bg-green-500",
                      metric.value >= metric.threshold.warning && metric.value < metric.threshold.critical && "bg-yellow-500",
                      metric.value >= metric.threshold.critical && "bg-red-500"
                    )}
                    style={{ width: `${Math.min(metric.value, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Services Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Service Status</h3>
        {isLoading ? (
          <div className="rounded-lg border p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading service status...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No service health data available.</p>
            <p className="text-sm mt-2">The health API endpoint needs to be configured to return service status.</p>
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const config = STATUS_CONFIG[service.status];
            const StatusIcon = config.icon;
            const ServiceIcon = SERVICE_ICONS[service.name] || Server;

            return (
              <div
                key={service.name}
                className={cn(
                  "rounded-lg border p-4 transition-all hover:shadow-md",
                  service.status === "unhealthy" && "border-red-200",
                  service.status === "degraded" && "border-yellow-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <ServiceIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{service.name}</h4>
                      {service.version && (
                        <p className="text-xs text-muted-foreground">v{service.version}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border",
                      config.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  {service.latency !== undefined && (
                    <div>
                      <p className="text-muted-foreground">Latency</p>
                      <p className="font-medium">{service.latency}ms</p>
                    </div>
                  )}
                  {service.uptime && (
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">{service.uptime}</p>
                    </div>
                  )}
                </div>

                {service.details && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">{service.details}</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Grafana Dashboards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Grafana Dashboards</h3>
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
          {/* Platform Health Overview */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_HEALTH}
            panelId={1}
            title="Service Health Timeline"
            description="Health status of all services over time"
            timeRange="1h"
            height={300}
          />

          {/* Response Time Panel */}
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_HEALTH}
            panelId={2}
            title="API Response Times"
            description="Average response time by endpoint"
            timeRange="1h"
            height={300}
          />
        </div>

        {/* Full Dashboard Embed */}
        <div className="mt-6">
          <GrafanaPanel
            dashboardUid={GRAFANA_DASHBOARD_HEALTH}
            title="Platform Health Dashboard"
            description="Complete platform health overview from Grafana"
            timeRange="1h"
            height={500}
          />
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Recent Incidents</h3>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium">Email Service Latency Spike</p>
                <p className="text-sm text-muted-foreground">
                  High latency detected in email delivery service. Investigation ongoing.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Started 15 minutes ago · Ongoing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Database Connection Pool Exhaustion</p>
                <p className="text-sm text-muted-foreground">
                  Resolved: Connection pool size increased and connections optimized.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Resolved 2 hours ago · Duration: 12 minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
