import { useCustom } from "@refinedev/core";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Filter,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  Hash,
  Database,
  Cloud,
  BarChart3,
  Activity,
  Eye,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationHistoryItem {
  id: string;
  transactionId?: string;
  templateId?: string;
  templateName?: string;
  workflowId?: string;
  workflowName?: string;
  subscriberId: string;
  channel: string;
  status: "sent" | "error" | "pending" | "warning" | "delivered" | "failed" | "bounced" | "opened" | "clicked";
  createdAt?: string;
  createdOn?: string;
  recipientEmail?: string;
  subject?: string;
  errorMessage?: string;
  payload?: Record<string, unknown>;
}

interface HistoryResponse {
  data: NotificationHistoryItem[];
  total: number;
  hasMore: boolean;
}

// Channel type icons
const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
  in_app: MessageSquare,
  chat: MessageSquare,
};

const getChannelIcon = (type: string) => {
  return CHANNEL_ICONS[type] || Bell;
};

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  sent: { color: "bg-blue-100 text-blue-700", icon: CheckCircle, label: "Sent" },
  delivered: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Delivered" },
  error: { color: "bg-red-100 text-red-700", icon: XCircle, label: "Error" },
  failed: { color: "bg-red-100 text-red-700", icon: XCircle, label: "Failed" },
  pending: { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: "Pending" },
  warning: { color: "bg-orange-100 text-orange-700", icon: AlertTriangle, label: "Warning" },
  bounced: { color: "bg-orange-100 text-orange-700", icon: AlertTriangle, label: "Bounced" },
  opened: { color: "bg-purple-100 text-purple-700", icon: Eye, label: "Opened" },
  clicked: { color: "bg-pink-100 text-pink-700", icon: MousePointerClick, label: "Clicked" },
};

export function NotificationHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [dataSource, setDataSource] = useState<"novu" | "local">("novu");
  const pageSize = 20;

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit: pageSize,
    };
    if (channelFilter !== "all") {
      params.channel = channelFilter;
    }
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }
    return params;
  }, [page, channelFilter, statusFilter]);

  // Determine API endpoint based on data source
  const apiUrl = dataSource === "novu" ? "/notifications/history" : "/notifications/local-history";

  // Fetch notification history
  const { data: historyData, isLoading, refetch } = useCustom<HistoryResponse>({
    url: apiUrl,
    method: "get",
    config: {
      query: queryParams,
    },
  });

  const historyItems = historyData?.data?.data ?? [];
  const total = historyData?.data?.total ?? 0;
  const hasMore = historyData?.data?.hasMore ?? false;

  // Apply client-side search filter (status filter is now server-side)
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      const templateName = item.templateName || item.workflowName || item.templateId || item.workflowId;
      const transactionId = item.transactionId || "";
      const matchesSearch =
        searchTerm === "" ||
        templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subscriberId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.recipientEmail?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [historyItems, searchTerm]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Extract email from subscriber ID (format: tenant-{tenantId}-{sanitizedEmail})
  const extractEmailHint = (subscriberId: string): string => {
    const parts = subscriberId.split("-");
    if (parts.length >= 3) {
      // Last part is the sanitized email
      return parts.slice(2).join("-").replace(/_/g, ".");
    }
    return subscriberId;
  };

  // Get stats
  const stats = useMemo(() => {
    return {
      total: historyItems.length,
      sent: historyItems.filter((i) => i.status === "sent").length,
      error: historyItems.filter((i) => i.status === "error").length,
      pending: historyItems.filter((i) => i.status === "pending").length,
    };
  }, [historyItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification History</h1>
          <p className="text-muted-foreground">
            View delivery history for notifications sent to your tenant
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Data Source Toggle */}
          <div className="flex items-center border rounded-md">
            <button
              onClick={() => {
                setDataSource("novu");
                setPage(0);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-l-md transition-colors",
                dataSource === "novu"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Cloud className="h-4 w-4" />
              Novu
            </button>
            <button
              onClick={() => {
                setDataSource("local");
                setPage(0);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-r-md transition-colors",
                dataSource === "local"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Database className="h-4 w-4" />
              Local
            </button>
          </div>
          <button
            onClick={() => navigate("/notifications/analytics")}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Data Source Info */}
      <div className={cn(
        "p-3 rounded-lg flex items-center gap-2 text-sm",
        dataSource === "novu" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
      )}>
        {dataSource === "novu" ? (
          <>
            <Cloud className="h-4 w-4" />
            <span>Showing notifications from <strong>Novu API</strong> - real-time delivery data</span>
          </>
        ) : (
          <>
            <Database className="h-4 w-4" />
            <span>Showing notifications from <strong>local database</strong> - persistent audit trail</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bell className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Delivered</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.error}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by template, subscriber, transaction..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="in_app">In-App</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="bounced">Bounced</option>
            <option value="opened">Opened</option>
            <option value="clicked">Clicked</option>
          </select>
        </div>
      </div>

      {/* History List */}
      <div className="rounded-lg border bg-card divide-y">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading history...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notification history found.</p>
            <p className="text-sm mt-1">
              {searchTerm || channelFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Notifications sent to your tenant will appear here"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const ChannelIcon = getChannelIcon(item.channel);
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            // Handle different field names between Novu and local history
            const templateName = item.templateName || item.workflowName || item.templateId || item.workflowId;
            const timestamp = item.createdAt || item.createdOn;
            const transactionId = item.transactionId || item.id;
            const recipientDisplay = item.recipientEmail || extractEmailHint(item.subscriberId || "");

            // Status-based color classes
            const statusBgColors: Record<string, string> = {
              sent: "bg-blue-100",
              delivered: "bg-green-100",
              error: "bg-red-100",
              failed: "bg-red-100",
              pending: "bg-yellow-100",
              warning: "bg-orange-100",
              bounced: "bg-orange-100",
              opened: "bg-purple-100",
              clicked: "bg-pink-100",
            };
            const statusTextColors: Record<string, string> = {
              sent: "text-blue-600",
              delivered: "text-green-600",
              error: "text-red-600",
              failed: "text-red-600",
              pending: "text-yellow-600",
              warning: "text-orange-600",
              bounced: "text-orange-600",
              opened: "text-purple-600",
              clicked: "text-pink-600",
            };

            return (
              <div key={item.id} className="p-4 hover:bg-muted/30">
                <div className="flex items-start gap-4">
                  {/* Channel Icon */}
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      statusBgColors[item.status] || "bg-gray-100"
                    )}
                  >
                    <ChannelIcon
                      className={cn(
                        "h-5 w-5",
                        statusTextColors[item.status] || "text-gray-600"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {templateName}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
                          statusConfig.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-muted rounded capitalize">
                        {item.channel?.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[200px]" title={item.recipientEmail || item.subscriberId}>
                          {recipientDisplay}
                        </span>
                      </div>
                      {transactionId && (
                        <div className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          <span className="font-mono text-xs truncate max-w-[150px]" title={transactionId}>
                            {transactionId.slice(0, 8)}...
                          </span>
                        </div>
                      )}
                      {item.subject && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]" title={item.subject}>
                            {item.subject}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Error message for failed items */}
                    {item.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 line-clamp-2">
                        {item.errorMessage}
                      </div>
                    )}

                    {/* Timestamp */}
                    {timestamp && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(timestamp)}
                        <span className="mx-1">·</span>
                        {new Date(timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {(filteredItems.length > 0 || page > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredItems.length} of {total} notifications
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center justify-center rounded-md border p-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="inline-flex items-center justify-center rounded-md border p-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
