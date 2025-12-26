import { useList, useCustom, useCustomMutation } from "@refinedev/core";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Search,
  Filter,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Settings,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  Info,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  source: string;
  status: "active" | "acknowledged" | "resolved";
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  metadata?: Record<string, unknown>;
}

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  condition: string;
  severity: "critical" | "warning" | "info";
  enabled: boolean;
  channels: string[];
  createdAt: string;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  warning: { label: "Warning", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertTriangle },
  info: { label: "Info", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-red-100 text-red-700" },
  acknowledged: { label: "Acknowledged", color: "bg-yellow-100 text-yellow-700" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700" },
};

/**
 * Alert Details Modal
 */
function AlertDetailsModal({
  alert,
  onClose,
  onAcknowledge,
  onResolve,
  isUpdating,
}: {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  isUpdating: boolean;
}) {
  const severityConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const SeverityIcon = severityConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <SeverityIcon className={cn("h-5 w-5", alert.severity === "critical" ? "text-red-600" : alert.severity === "warning" ? "text-yellow-600" : "text-blue-600")} />
            <h3 className="font-semibold">Alert Details</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-lg font-medium">{alert.title}</h4>
            <p className="text-muted-foreground mt-1">{alert.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Severity:</span>
              <span className={cn("ml-2 px-2 py-0.5 rounded text-xs font-medium", severityConfig.color)}>
                {severityConfig.label}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className={cn("ml-2 px-2 py-0.5 rounded text-xs font-medium", STATUS_CONFIG[alert.status].color)}>
                {STATUS_CONFIG[alert.status].label}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Source:</span>
              <span className="ml-2">{alert.source}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2">{new Date(alert.createdAt).toLocaleString()}</span>
            </div>
            {alert.acknowledgedAt && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Acknowledged:</span>
                <span className="ml-2">
                  {new Date(alert.acknowledgedAt).toLocaleString()}
                  {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                </span>
              </div>
            )}
            {alert.resolvedAt && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Resolved:</span>
                <span className="ml-2">{new Date(alert.resolvedAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div>
              <h5 className="font-medium mb-2">Additional Information</h5>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(alert.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
          {alert.status === "active" && (
            <button
              onClick={onAcknowledge}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md bg-yellow-600 text-white px-4 py-2 text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Acknowledge
            </button>
          )}
          {alert.status !== "resolved" && (
            <button
              onClick={onResolve}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<"alerts" | "rules">("alerts");

  // Fetch alerts from backend
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useCustom<Alert[]>({
    url: "/alerts",
    method: "get",
  });

  // Fetch alert rules
  const { data: rulesData, isLoading: rulesLoading, refetch: refetchRules } = useCustom<AlertRule[]>({
    url: "/alerts/rules",
    method: "get",
  });

  // Update alert mutation
  const { mutate: updateAlert, isLoading: isUpdating } = useCustomMutation();

  const alerts = alertsData?.data ?? [];
  const rules = rulesData?.data ?? [];

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        searchTerm === "" ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.source.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
      const matchesStatus = statusFilter === "all" || alert.status === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [alerts, searchTerm, severityFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical" && a.status === "active").length,
    warning: alerts.filter((a) => a.severity === "warning" && a.status === "active").length,
    acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  }), [alerts]);

  const handleAcknowledge = (alertId: string) => {
    updateAlert(
      {
        url: `/alerts/${alertId}/acknowledge`,
        method: "post",
        values: {},
      },
      {
        onSuccess: () => {
          refetchAlerts();
          setSelectedAlert(null);
        },
      }
    );
  };

  const handleResolve = (alertId: string) => {
    updateAlert(
      {
        url: `/alerts/${alertId}/resolve`,
        method: "post",
        values: {},
      },
      {
        onSuccess: () => {
          refetchAlerts();
          setSelectedAlert(null);
        },
      }
    );
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    updateAlert(
      {
        url: `/alerts/rules/${ruleId}`,
        method: "patch",
        values: { enabled },
      },
      {
        onSuccess: () => {
          refetchRules();
        },
      }
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

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
          <h1 className="text-2xl font-bold tracking-tight">Alert Center</h1>
          <p className="text-muted-foreground">
            Monitor and manage platform alerts and notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchAlerts();
              refetchRules();
            }}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bell className="h-4 w-4" />
            <span className="text-sm">Total Alerts</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 border-red-200">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Critical</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Warnings</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="h-4 w-4" />
            <span className="text-sm">Acknowledged</span>
          </div>
          <p className="text-2xl font-bold">{stats.acknowledged}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Resolved</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("alerts")}
            className={cn(
              "pb-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "alerts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Active Alerts
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={cn(
              "pb-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "rules"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Alert Rules
          </button>
        </div>
      </div>

      {activeTab === "alerts" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Alerts List */}
          {alertsLoading ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading alerts...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center border rounded-lg bg-card">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium">All Clear!</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm || severityFilter !== "all" || statusFilter !== "all"
                  ? "No alerts match your filters"
                  : "No active alerts at this time"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const severityConfig = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                const SeverityIcon = severityConfig.icon;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer",
                      severityConfig.color.replace("text-", "border-").split(" ")[0]
                    )}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <SeverityIcon className={cn("h-5 w-5 mt-0.5",
                          alert.severity === "critical" ? "text-red-600" :
                          alert.severity === "warning" ? "text-yellow-600" : "text-blue-600"
                        )} />
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{alert.source}</span>
                            <span>|</span>
                            <span>{formatDate(alert.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", STATUS_CONFIG[alert.status].color)}>
                          {STATUS_CONFIG[alert.status].label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Alert Rules */}
          {rulesLoading ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-12 text-center border rounded-lg bg-card">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Alert Rules</h3>
              <p className="text-muted-foreground mt-1">
                Configure alert rules to receive notifications for important events
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const severityConfig = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.info;

                return (
                  <div
                    key={rule.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", severityConfig.color)}>
                            {severityConfig.label}
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <code className="bg-muted px-1 py-0.5 rounded">{rule.condition}</code>
                          <span>|</span>
                          <span>{rule.channels.join(", ")}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          rule.enabled
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {rule.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <AlertDetailsModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={() => handleAcknowledge(selectedAlert.id)}
          onResolve={() => handleResolve(selectedAlert.id)}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}
