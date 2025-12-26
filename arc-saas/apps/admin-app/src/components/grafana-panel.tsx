import { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Grafana configuration from environment
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3001";

interface GrafanaPanelProps {
  /** Dashboard UID in Grafana */
  dashboardUid: string;
  /** Panel ID within the dashboard */
  panelId?: number;
  /** Title to display above the panel */
  title?: string;
  /** Description text */
  description?: string;
  /** Time range (e.g., "1h", "24h", "7d") */
  timeRange?: string;
  /** Refresh interval in seconds (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Height of the panel */
  height?: number | string;
  /** Additional CSS classes */
  className?: string;
  /** Show panel toolbar (time range, refresh, etc.) */
  showToolbar?: boolean;
  /** Theme override (light/dark) */
  theme?: "light" | "dark";
  /** Custom variables to pass to the dashboard (e.g., {tenant: "abc123"}) */
  variables?: Record<string, string>;
  /** Org ID in Grafana */
  orgId?: number;
}

// Time range options
const TIME_RANGES = [
  { label: "Last 15 minutes", value: "15m" },
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
];

// Convert time range to Grafana format (from=now-1h&to=now)
function getTimeRangeParams(range: string): string {
  return `from=now-${range}&to=now`;
}

/**
 * GrafanaPanel - Embeds a Grafana dashboard or panel via iframe
 *
 * Features:
 * - Embed full dashboards or individual panels
 * - Configurable time range with dropdown
 * - Auto-refresh support
 * - Fullscreen mode
 * - Error handling for when Grafana is unavailable
 *
 * Example usage:
 * ```tsx
 * <GrafanaPanel
 *   dashboardUid="platform-health"
 *   panelId={1}
 *   title="API Response Time"
 *   timeRange="24h"
 *   height={300}
 * />
 * ```
 */
export function GrafanaPanel({
  dashboardUid,
  panelId,
  title,
  description,
  timeRange = "1h",
  refreshInterval = 0,
  height = 400,
  className,
  showToolbar = true,
  theme,
  variables = {},
  orgId = 1,
}: GrafanaPanelProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Build the iframe URL
  const buildIframeUrl = (): string => {
    const baseUrl = GRAFANA_URL;

    // Determine if embedding a panel or full dashboard
    const embedPath = panelId !== undefined
      ? `/d-solo/${dashboardUid}`  // Single panel embed
      : `/d/${dashboardUid}`;       // Full dashboard embed

    const params = new URLSearchParams();

    // Time range
    params.append("from", `now-${selectedTimeRange}`);
    params.append("to", "now");

    // Organization
    params.append("orgId", String(orgId));

    // Theme
    if (theme) {
      params.append("theme", theme);
    }

    // Panel ID (for single panel embed)
    if (panelId !== undefined) {
      params.append("panelId", String(panelId));
    }

    // Custom variables
    Object.entries(variables).forEach(([key, value]) => {
      params.append(`var-${key}`, value);
    });

    // Refresh interval
    if (refreshInterval > 0) {
      params.append("refresh", `${refreshInterval}s`);
    }

    // Kiosk mode for cleaner embed (hides Grafana UI chrome)
    params.append("kiosk", "1");

    return `${baseUrl}${embedPath}?${params.toString()}`;
  };

  const iframeUrl = buildIframeUrl();

  // Auto-refresh via key change
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey((k) => k + 1);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const openInGrafana = () => {
    // Open the dashboard in Grafana (not in kiosk mode)
    const url = panelId !== undefined
      ? `${GRAFANA_URL}/d/${dashboardUid}?${getTimeRangeParams(selectedTimeRange)}&viewPanel=${panelId}`
      : `${GRAFANA_URL}/d/${dashboardUid}?${getTimeRangeParams(selectedTimeRange)}`;
    window.open(url, "_blank");
  };

  const panelHeight = typeof height === "number" ? `${height}px` : height;
  const fullscreenHeight = "calc(100vh - 200px)";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        isFullscreen && "fixed inset-4 z-50 shadow-2xl",
        className
      )}
    >
      {/* Header */}
      {(title || showToolbar) && (
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {showToolbar && (
            <div className="flex items-center gap-2">
              {/* Time Range Selector */}
              <select
                value={selectedTimeRange}
                onChange={(e) => {
                  setSelectedTimeRange(e.target.value);
                  setRefreshKey((k) => k + 1);
                }}
                className="text-sm border rounded-md px-2 py-1 bg-background"
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              {/* Open in Grafana */}
              <button
                onClick={openInGrafana}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Open in Grafana"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="relative bg-background"
        style={{ height: isFullscreen ? fullscreenHeight : panelHeight }}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Loading Grafana panel...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center p-6">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive opacity-50" />
              <h4 className="mt-4 font-medium">Unable to load Grafana panel</h4>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Make sure Grafana is running at {GRAFANA_URL} and the dashboard exists.
              </p>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
                <button
                  onClick={openInGrafana}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Grafana
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grafana Iframe */}
        <iframe
          key={refreshKey}
          src={iframeUrl}
          className={cn(
            "w-full h-full border-0",
            (isLoading || hasError) && "invisible"
          )}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={title || "Grafana Dashboard"}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>

      {/* Fullscreen Backdrop */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}

/**
 * GrafanaDashboard - Embeds a full Grafana dashboard
 *
 * Simplified wrapper around GrafanaPanel for full dashboard embeds
 */
export function GrafanaDashboard({
  dashboardUid,
  title,
  description,
  timeRange = "1h",
  height = 600,
  className,
  variables = {},
}: Omit<GrafanaPanelProps, "panelId">) {
  return (
    <GrafanaPanel
      dashboardUid={dashboardUid}
      title={title}
      description={description}
      timeRange={timeRange}
      height={height}
      className={className}
      variables={variables}
      showToolbar={true}
    />
  );
}

/**
 * GrafanaStatusIndicator - Shows Grafana availability status
 */
export function GrafanaStatusIndicator() {
  const [status, setStatus] = useState<"checking" | "available" | "unavailable">("checking");

  useEffect(() => {
    const checkGrafana = async () => {
      try {
        // Try to fetch Grafana's API health endpoint
        const response = await fetch(`${GRAFANA_URL}/api/health`, {
          mode: "cors",
          credentials: "omit",
        });
        setStatus(response.ok ? "available" : "unavailable");
      } catch {
        setStatus("unavailable");
      }
    };

    checkGrafana();

    // Re-check every 30 seconds
    const interval = setInterval(checkGrafana, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        Checking Grafana...
      </span>
    );
  }

  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Grafana connected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-gray-400" />
      Grafana offline
    </span>
  );
}

export default GrafanaPanel;
