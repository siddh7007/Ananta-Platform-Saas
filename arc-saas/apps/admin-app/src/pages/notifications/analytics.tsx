import { useCustom } from "@refinedev/core";
import { useState, useMemo } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Send,
  Clock,
  BarChart3,
  PieChart,
  Filter,
  Calendar,
  Activity,
  Eye,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationAnalytics {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  bounced: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  byChannel: Record<string, number>;
  byWorkflow: Record<string, number>;
}

interface NotificationHistory {
  id: string;
  workflowId: string;
  workflowName?: string;
  subscriberId: string;
  channel: string;
  status: string;
  recipientEmail?: string;
  subject?: string;
  errorMessage?: string;
  errorCode?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdOn?: string;
}

// Channel icons
const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
  in_app: MessageSquare,
  webhook: Activity,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  sent: { bg: "bg-blue-100", text: "text-blue-700", icon: Send },
  delivered: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  failed: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700", icon: Clock },
  bounced: { bg: "bg-orange-100", text: "text-orange-700", icon: AlertTriangle },
  opened: { bg: "bg-purple-100", text: "text-purple-700", icon: Eye },
  clicked: { bg: "bg-pink-100", text: "text-pink-700", icon: MousePointerClick },
};

/**
 * Stats Card Component
 */
function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "default",
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: typeof Bell;
  trend?: { value: number; positive: boolean };
  color?: "default" | "success" | "danger" | "warning" | "info";
  subtitle?: string;
}) {
  const colorClasses = {
    default: "bg-card",
    success: "bg-green-50 border-green-200",
    danger: "bg-red-50 border-red-200",
    warning: "bg-yellow-50 border-yellow-200",
    info: "bg-blue-50 border-blue-200",
  };

  const iconColors = {
    default: "text-muted-foreground",
    success: "text-green-600",
    danger: "text-red-600",
    warning: "text-yellow-600",
    info: "text-blue-600",
  };

  return (
    <div className={cn("rounded-lg border p-4", colorClasses[color])}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColors[color])} />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend.positive ? "text-green-600" : "text-red-600"
          )}>
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * Channel Distribution Chart (Simple Bar)
 */
function ChannelDistribution({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No channel data available</p>
      </div>
    );
  }

  const sortedChannels = Object.entries(data)
    .sort(([, a], [, b]) => b - a);

  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

  return (
    <div className="space-y-3">
      {sortedChannels.map(([channel, count], index) => {
        const percentage = Math.round((count / total) * 100);
        const ChannelIcon = CHANNEL_ICONS[channel] || Bell;

        return (
          <div key={channel}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm capitalize">{channel.replace("_", " ")}</span>
              </div>
              <span className="text-sm font-medium">{count} ({percentage}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", colors[index % colors.length])}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Workflow Distribution Chart
 */
function WorkflowDistribution({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No workflow data available</p>
      </div>
    );
  }

  const sortedWorkflows = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10

  return (
    <div className="space-y-2">
      {sortedWorkflows.map(([workflow, count]) => {
        const percentage = Math.round((count / total) * 100);

        return (
          <div key={workflow} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{workflow}</p>
            </div>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm font-medium w-12 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Recent Failures List
 */
function RecentFailures({ failures }: { failures: NotificationHistory[] }) {
  if (failures.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p>No recent failures</p>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      {failures.map((failure) => {
        const ChannelIcon = CHANNEL_ICONS[failure.channel] || Bell;

        return (
          <div
            key={failure.id}
            className="p-3 bg-red-50 border border-red-100 rounded-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ChannelIcon className="h-4 w-4 text-red-600" />
                <span className="font-medium text-sm">
                  {failure.workflowName || failure.workflowId}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(failure.createdOn)}
              </span>
            </div>
            {failure.recipientEmail && (
              <p className="text-xs text-muted-foreground mt-1">
                To: {failure.recipientEmail}
              </p>
            )}
            {failure.errorMessage && (
              <p className="text-xs text-red-600 mt-1 line-clamp-2">
                {failure.errorMessage}
              </p>
            )}
            {failure.errorCode && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-mono">
                {failure.errorCode}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NotificationAnalytics() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  // Calculate date range
  const getDateParams = () => {
    const now = new Date();
    const params: { startDate?: string; endDate?: string } = {};

    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      params.startDate = startDate.toISOString();
      params.endDate = now.toISOString();
    }

    return params;
  };

  const dateParams = getDateParams();

  // Fetch analytics
  const { data: analyticsData, isLoading: analyticsLoading, refetch } = useCustom<NotificationAnalytics>({
    url: "/notifications/analytics",
    method: "get",
    config: {
      query: dateParams,
    },
  });

  // Fetch recent failures
  const { data: failuresData, isLoading: failuresLoading } = useCustom<NotificationHistory[]>({
    url: "/notifications/analytics/failures",
    method: "get",
    config: {
      query: { limit: 10 },
    },
  });

  const analytics = analyticsData?.data || {
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    bounced: 0,
    opened: 0,
    clicked: 0,
    deliveryRate: 0,
    byChannel: {},
    byWorkflow: {},
  };

  const failures = failuresData?.data || [];

  // Calculate additional metrics
  const successRate = analytics.total > 0
    ? Math.round(((analytics.delivered + analytics.opened + analytics.clicked) / analytics.total) * 100)
    : 0;

  const failureRate = analytics.total > 0
    ? Math.round(((analytics.failed + analytics.bounced) / analytics.total) * 100)
    : 0;

  const engagementRate = analytics.delivered > 0
    ? Math.round(((analytics.opened + analytics.clicked) / analytics.delivered) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Analytics</h1>
          <p className="text-muted-foreground">
            Track notification delivery and engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2 border rounded-md">
            <Calendar className="h-4 w-4 ml-3 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-2 py-2 text-sm bg-transparent border-0 focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatsCard
              title="Total Sent"
              value={analytics.total}
              icon={Send}
            />
            <StatsCard
              title="Delivered"
              value={analytics.delivered}
              icon={CheckCircle}
              color="success"
              subtitle={`${successRate}% success rate`}
            />
            <StatsCard
              title="Failed"
              value={analytics.failed + analytics.bounced}
              icon={XCircle}
              color={failureRate > 10 ? "danger" : "default"}
              subtitle={`${failureRate}% failure rate`}
            />
            <StatsCard
              title="Pending"
              value={analytics.pending}
              icon={Clock}
              color={analytics.pending > 100 ? "warning" : "default"}
            />
            <StatsCard
              title="Opened"
              value={analytics.opened}
              icon={Eye}
              color="info"
            />
            <StatsCard
              title="Clicked"
              value={analytics.clicked}
              icon={MousePointerClick}
              subtitle={`${engagementRate}% engagement`}
            />
          </div>

          {/* Delivery Rate Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Delivery Rate</h3>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-3xl font-bold">
                      {analytics.deliveryRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                  <div
                    style={{ width: `${analytics.deliveryRate}%` }}
                    className={cn(
                      "shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center rounded-full transition-all",
                      analytics.deliveryRate >= 90
                        ? "bg-green-500"
                        : analytics.deliveryRate >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {analytics.deliveryRate >= 90
                    ? "Excellent delivery performance"
                    : analytics.deliveryRate >= 70
                    ? "Good, but room for improvement"
                    : "Needs attention - check for issues"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Status Breakdown</h3>
                <PieChart className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                {Object.entries(STATUS_COLORS).map(([status, config]) => {
                  const count = analytics[status as keyof NotificationAnalytics] as number || 0;
                  const Icon = config.icon;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", config.bg.replace("bg-", "bg-").replace("-100", "-500"))} />
                        <span className="text-sm capitalize">{status}</span>
                      </div>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Engagement Funnel</h3>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-20 text-sm text-muted-foreground">Sent</div>
                  <div className="flex-1 h-6 bg-blue-100 rounded" />
                  <span className="text-sm font-medium w-12 text-right">{analytics.sent}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 text-sm text-muted-foreground">Delivered</div>
                  <div className="flex-1 h-6 bg-green-100 rounded" style={{ width: `${(analytics.delivered / (analytics.sent || 1)) * 100}%` }} />
                  <span className="text-sm font-medium w-12 text-right">{analytics.delivered}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 text-sm text-muted-foreground">Opened</div>
                  <div className="flex-1 h-6 bg-purple-100 rounded" style={{ width: `${(analytics.opened / (analytics.sent || 1)) * 100}%` }} />
                  <span className="text-sm font-medium w-12 text-right">{analytics.opened}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 text-sm text-muted-foreground">Clicked</div>
                  <div className="flex-1 h-6 bg-pink-100 rounded" style={{ width: `${(analytics.clicked / (analytics.sent || 1)) * 100}%` }} />
                  <span className="text-sm font-medium w-12 text-right">{analytics.clicked}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                By Channel
              </h3>
              <ChannelDistribution data={analytics.byChannel} />
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Top Workflows
              </h3>
              <WorkflowDistribution data={analytics.byWorkflow} />
            </div>
          </div>

          {/* Recent Failures */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Recent Failures
            </h3>
            {failuresLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : (
              <RecentFailures failures={failures} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
