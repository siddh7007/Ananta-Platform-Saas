import { useList } from "@refinedev/core";
import { useState, useMemo } from "react";
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Building2,
  Shield,
  Settings,
  CreditCard,
  Mail,
  UserPlus,
  UserMinus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  tenantId?: string;
  tenantName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failure" | "warning";
  timestamp: string;
}

// Action category icons
const ACTION_ICONS: Record<string, typeof Activity> = {
  "tenant.": Building2,
  "user.": User,
  "invitation.": Mail,
  "role.": Shield,
  "subscription.": CreditCard,
  "settings.": Settings,
};

const getActionIcon = (action: string) => {
  for (const [prefix, Icon] of Object.entries(ACTION_ICONS)) {
    if (action.startsWith(prefix)) return Icon;
  }
  return Activity;
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  success: { color: "bg-green-100 text-green-700", icon: CheckCircle },
  failure: { color: "bg-red-100 text-red-700", icon: XCircle },
  warning: { color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
};


const ACTION_LABELS: Record<string, string> = {
  "tenant.created": "Tenant Created",
  "tenant.updated": "Tenant Updated",
  "tenant.suspended": "Tenant Suspended",
  "tenant.reactivated": "Tenant Reactivated",
  "tenant.provisioning.started": "Provisioning Started",
  "tenant.provisioning.completed": "Provisioning Completed",
  "tenant.provisioning.failed": "Provisioning Failed",
  "user.created": "User Created",
  "user.invited": "User Invited",
  "user.login": "User Login",
  "user.logout": "User Logout",
  "user.updated": "User Updated",
  "user.deleted": "User Deleted",
  "invitation.sent": "Invitation Sent",
  "invitation.accepted": "Invitation Accepted",
  "invitation.revoked": "Invitation Revoked",
  "invitation.expired": "Invitation Expired",
  "subscription.created": "Subscription Created",
  "subscription.upgraded": "Subscription Upgraded",
  "subscription.downgraded": "Subscription Downgraded",
  "subscription.cancelled": "Subscription Cancelled",
  "subscription.renewed": "Subscription Renewed",
  "role.created": "Role Created",
  "role.updated": "Role Updated",
  "role.deleted": "Role Deleted",
  "settings.updated": "Settings Updated",
};

export function AuditLogList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("7d");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Calculate date filter
  const dateFilterValue = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }, [dateFilter]);

  // Build filters for API call
  const filters = useMemo(() => {
    const result: Array<{ field: string; operator: "eq" | "gte" | "startswith"; value: unknown }> = [
      { field: "timestamp", operator: "gte", value: dateFilterValue },
    ];
    if (actionFilter !== "all") {
      result.push({ field: "action", operator: "startswith", value: actionFilter });
    }
    if (statusFilter !== "all") {
      result.push({ field: "status", operator: "eq", value: statusFilter });
    }
    return result;
  }, [actionFilter, statusFilter, dateFilterValue]);

  // Fetch from API with fallback to sample data
  const { data, isLoading, refetch } = useList<AuditLog>({
    resource: "audit-logs",
    pagination: { current: page, pageSize },
    sorters: [{ field: "timestamp", order: "desc" }],
    filters,
  });

  // Use API data only
  const logs = data?.data ?? [];

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tenantName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction =
      actionFilter === "all" || log.action.startsWith(actionFilter);
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesAction && matchesStatus;
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all administrative actions and system events
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Download className="mr-2 h-4 w-4" />
            Export
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Actions</option>
            <option value="tenant.">Tenant Actions</option>
            <option value="user.">User Actions</option>
            <option value="invitation.">Invitations</option>
            <option value="subscription.">Subscriptions</option>
            <option value="role.">Roles</option>
            <option value="settings.">Settings</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="rounded-lg border bg-card divide-y">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No audit logs found matching your filters.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const ActionIcon = getActionIcon(log.action);
            const statusConfig = STATUS_CONFIG[log.status];
            const StatusIcon = statusConfig?.icon || CheckCircle;

            return (
              <div key={log.id} className="p-4 hover:bg-muted/30">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      log.status === "success" && "bg-green-100",
                      log.status === "failure" && "bg-red-100",
                      log.status === "warning" && "bg-yellow-100"
                    )}
                  >
                    <ActionIcon
                      className={cn(
                        "h-5 w-5",
                        log.status === "success" && "text-green-600",
                        log.status === "failure" && "text-red-600",
                        log.status === "warning" && "text-yellow-600"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
                          statusConfig?.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {log.status}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">{log.actorName || log.actorId}</span>
                      {log.targetName && (
                        <>
                          {" "}
                          · Target:{" "}
                          <span className="font-medium">{log.targetName}</span>
                        </>
                      )}
                      {log.tenantName && (
                        <>
                          {" "}
                          · Tenant:{" "}
                          <span className="font-medium">{log.tenantName}</span>
                        </>
                      )}
                    </p>

                    {/* Details */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                        {Object.entries(log.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-muted-foreground">{key}:</span>{" "}
                            {String(value)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                      {log.ipAddress && (
                        <div>IP: {log.ipAddress}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} logs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center rounded-md border p-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={filteredLogs.length < pageSize}
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
