import { useList, useCustom, useCustomMutation } from "@refinedev/core";
import { useState, useMemo } from "react";
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
  Play,
  Clock,
  ChevronRight,
  Send,
  X,
  Loader2,
  Zap,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggers?: Array<{
    type: string;
    identifier: string;
  }>;
  steps?: Array<{
    active: boolean;
    template?: {
      type: string;
      content?: string;
    };
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface HealthStatus {
  healthy: boolean;
  message: string;
}

interface SendNotificationResult {
  success: boolean;
  transactionId?: string;
  error?: string;
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

/**
 * Test Notification Dialog
 */
function TestNotificationDialog({
  template,
  onClose,
  onSend,
  isSending,
}: {
  template: NotificationTemplate;
  onClose: () => void;
  onSend: (email: string, firstName?: string, lastName?: string, payload?: Record<string, unknown>) => void;
  isSending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customPayload, setCustomPayload] = useState("{}");
  const [payloadError, setPayloadError] = useState("");

  const handleSend = () => {
    let payload: Record<string, unknown> | undefined;
    try {
      if (customPayload.trim() && customPayload.trim() !== "{}") {
        payload = JSON.parse(customPayload);
      }
      setPayloadError("");
    } catch {
      setPayloadError("Invalid JSON");
      return;
    }

    onSend(email, firstName || undefined, lastName || undefined, payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Send Test Notification</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{template.name}</p>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Recipient Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Custom Payload (JSON)</label>
            <textarea
              value={customPayload}
              onChange={(e) => {
                setCustomPayload(e.target.value);
                setPayloadError("");
              }}
              placeholder='{"key": "value"}'
              rows={3}
              className={cn(
                "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
                payloadError && "border-red-500"
              )}
            />
            {payloadError && (
              <p className="text-xs text-red-500 mt-1">{payloadError}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!email || isSending}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [testResult, setTestResult] = useState<SendNotificationResult | null>(null);

  // Fetch templates from backend
  const { data: templatesData, isLoading, refetch } = useCustom<NotificationTemplate[]>({
    url: "/notifications/templates",
    method: "get",
  });

  // Fetch health status
  const { data: healthData } = useCustom<HealthStatus>({
    url: "/notifications/health",
    method: "get",
  });

  // Send test notification mutation
  const { mutate: sendTest, isLoading: isSending } = useCustomMutation<SendNotificationResult>();

  const templates = templatesData?.data ?? [];
  const health = healthData?.data ?? { healthy: false, message: "Unknown" };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        searchTerm === "" ||
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && template.active) ||
        (statusFilter === "inactive" && !template.active);
      return matchesSearch && matchesStatus;
    });
  }, [templates, searchTerm, statusFilter]);

  // Get unique channels from all templates
  const getTemplateChannels = (template: NotificationTemplate): string[] => {
    const channels: string[] = [];
    template.steps?.forEach((step) => {
      if (step.template?.type && !channels.includes(step.template.type)) {
        channels.push(step.template.type);
      }
    });
    return channels;
  };

  // Handle sending test notification
  const handleSendTest = (
    email: string,
    firstName?: string,
    lastName?: string,
    payload?: Record<string, unknown>
  ) => {
    if (!selectedTemplate) return;

    setTestResult(null);

    sendTest(
      {
        url: "/notifications/test",
        method: "post",
        values: {
          templateId: selectedTemplate.id,
          email,
          firstName,
          lastName,
          payload,
        },
      },
      {
        onSuccess: (data) => {
          setTestResult(data.data);
          if (data.data.success) {
            setSelectedTemplate(null);
          }
        },
        onError: (error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : "Failed to send test notification";
          setTestResult({
            success: false,
            error: errorMessage,
          });
        },
      }
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Templates</h1>
          <p className="text-muted-foreground">
            Manage and test notification workflows via Novu
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Health Status Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              health.healthy
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {health.healthy ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span>Novu: {health.healthy ? "Connected" : "Disconnected"}</span>
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

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={cn(
            "p-4 rounded-lg flex items-center justify-between",
            testResult.success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          )}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={testResult.success ? "text-green-700" : "text-red-700"}>
              {testResult.success
                ? `Test notification sent! Transaction ID: ${testResult.transactionId}`
                : `Failed: ${testResult.error}`}
            </span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="p-1 hover:bg-white/50 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center border rounded-lg bg-card">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No templates found</h3>
          <p className="text-muted-foreground mt-1">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create notification workflows in Novu to see them here"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const channels = getTemplateChannels(template);
            const triggerId = template.triggers?.[0]?.identifier;

            return (
              <div
                key={template.id}
                className="border rounded-lg bg-card p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        template.active ? "bg-primary/10" : "bg-muted"
                      )}
                    >
                      <Bell
                        className={cn(
                          "h-5 w-5",
                          template.active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      {triggerId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {triggerId}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      template.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {template.active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Channels */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {channels.length > 0 ? (
                    channels.map((channel) => {
                      const ChannelIcon = getChannelIcon(channel);
                      return (
                        <span
                          key={channel}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                        >
                          <ChannelIcon className="h-3 w-3" />
                          {channel}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">No channels configured</span>
                  )}
                </div>

                {/* Steps count */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {template.steps?.length || 0} steps
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatDate(template.updatedAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <button
                    onClick={() => setSelectedTemplate(template)}
                    disabled={!template.active}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium flex-1",
                      template.active
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Test Send
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md border p-1.5 hover:bg-muted"
                    title="View in Novu"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bell className="h-4 w-4" />
            <span className="text-sm">Total Templates</span>
          </div>
          <p className="text-2xl font-bold">{templates.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {templates.filter((t) => t.active).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Inactive</span>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">
            {templates.filter((t) => !t.active).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Email Templates</span>
          </div>
          <p className="text-2xl font-bold">
            {templates.filter((t) =>
              t.steps?.some((s) => s.template?.type === "email")
            ).length}
          </p>
        </div>
      </div>

      {/* Test Notification Dialog */}
      {selectedTemplate && (
        <TestNotificationDialog
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSend={handleSendTest}
          isSending={isSending}
        />
      )}
    </div>
  );
}
