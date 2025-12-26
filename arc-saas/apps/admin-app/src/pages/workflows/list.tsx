import { useList, useNavigation, useCustomMutation, useNotification } from "@refinedev/core";
import { Eye, RefreshCw, Play, XCircle, Ban, MoreVertical, Search, Filter, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

interface Workflow {
  id: string;
  workflowId: string;
  workflowType: string;
  tenantId?: string;
  tenantName?: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  startTime: string;
  endTime?: string;
  runId: string;
}

interface WorkflowActionResult {
  success: boolean;
  workflowId: string;
  message: string;
  action: 'restart' | 'cancel';
  performedBy?: string;
  timestamp: string;
}

interface WorkflowListResponse {
  data: Workflow[];
  total: number;
  limit: number;
  offset: number;
}

export function WorkflowList() {
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("7d");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Calculate date filter value
  const dateFilterValue = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "all":
        return undefined;
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }, [dateFilter]);

  // Build meta params for backend query
  const metaParams = useMemo(() => {
    const params: Record<string, string | number> = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }
    if (typeFilter !== "all") {
      params.workflowType = typeFilter;
    }
    if (dateFilterValue) {
      params.startTimeFrom = dateFilterValue;
    }
    return params;
  }, [statusFilter, typeFilter, dateFilterValue, page, pageSize]);

  const { data, isLoading, refetch } = useList<Workflow>({
    resource: "workflows",
    meta: metaParams,
  });
  const { show } = useNavigation();
  const { open: notify } = useNotification();

  // Client-side search filter (for workflow ID search)
  const filteredWorkflows = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm) return data.data;
    return data.data.filter((w) =>
      w.workflowId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.tenantId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.workflowType.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.data, searchTerm]);

  // Action states
  const [actionWorkflowId, setActionWorkflowId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Restart mutation
  const { mutate: restartWorkflow, isLoading: isRestarting } = useCustomMutation<WorkflowActionResult>();

  // Cancel mutation
  const { mutate: cancelWorkflow, isLoading: isCancelling } = useCustomMutation<WorkflowActionResult>();

  // Terminate mutation
  const { mutate: terminateWorkflow, isLoading: isTerminating } = useCustomMutation<WorkflowActionResult>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      case "cancelled": return "bg-gray-100 text-gray-700";
      case "timed_out": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const canRestart = (status: string) => {
    return ['failed', 'cancelled', 'timed_out'].includes(status);
  };

  const canCancel = (status: string) => {
    return status === 'running';
  };

  const handleRestart = (workflow: Workflow) => {
    setActionWorkflowId(workflow.workflowId);
    setActiveMenu(null);

    restartWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/restart`,
        method: "post",
        values: { reason: "Manual restart from admin dashboard" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow restarted",
            description: result.data.message,
          });
          setActionWorkflowId(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to restart workflow",
            description: error.message,
          });
          setActionWorkflowId(null);
        },
      }
    );
  };

  const handleCancel = (workflow: Workflow) => {
    setActionWorkflowId(workflow.workflowId);
    setActiveMenu(null);

    cancelWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/cancel`,
        method: "post",
        values: { reason: "Manual cancellation from admin dashboard" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow cancelled",
            description: result.data.message,
          });
          setActionWorkflowId(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to cancel workflow",
            description: error.message,
          });
          setActionWorkflowId(null);
        },
      }
    );
  };

  const handleTerminate = (workflow: Workflow) => {
    if (!window.confirm(`Are you sure you want to forcefully terminate this workflow?\n\nThis action cannot be undone and may leave resources in an inconsistent state.`)) {
      return;
    }

    setActionWorkflowId(workflow.workflowId);
    setActiveMenu(null);

    terminateWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/terminate`,
        method: "post",
        values: { reason: "Force termination from admin dashboard" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow terminated",
            description: result.data.message,
          });
          setActionWorkflowId(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to terminate workflow",
            description: error.message,
          });
          setActionWorkflowId(null);
        },
      }
    );
  };

  const isActionInProgress = isRestarting || isCancelling || isTerminating;

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (val: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  // Total count from API response (or fallback to current data length)
  const totalCount = (data as any)?.total ?? data?.data?.length ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Monitor and manage Temporal workflow executions</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by workflow ID, tenant, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="timed_out">Timed Out</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="TenantProvisioningWorkflow">Provisioning</option>
            <option value="UserInvitationWorkflow">User Invitation</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => handleFilterChange(setDateFilter, e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Running
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Failed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-400" />
          Cancelled
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          Timed Out
        </span>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflow ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                    <p className="mt-2 text-muted-foreground">Loading workflows from Temporal...</p>
                  </td>
                </tr>
              ) : filteredWorkflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-8 w-8 text-muted-foreground/50" />
                      <p>No workflows found.</p>
                      <p className="text-xs">
                        {statusFilter !== "all" || typeFilter !== "all" || searchTerm
                          ? "Try adjusting your filters or search term."
                          : "Workflows appear here when tenant provisioning or other background tasks run."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWorkflows.map((workflow) => (
                  <tr
                    key={workflow.id}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      actionWorkflowId === workflow.workflowId && "opacity-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                        {workflow.workflowId.length > 24
                          ? `${workflow.workflowId.slice(0, 24)}...`
                          : workflow.workflowId}
                      </code>
                    </td>
                    <td className="px-6 py-4 font-medium">{workflow.workflowType}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {workflow.tenantId ? (
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {workflow.tenantId.slice(0, 8)}...
                        </code>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                        getStatusColor(workflow.status)
                      )}>
                        {workflow.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {new Date(workflow.startTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick actions */}
                        {canRestart(workflow.status) && (
                          <button
                            onClick={() => handleRestart(workflow)}
                            disabled={isActionInProgress}
                            title="Restart workflow"
                            className="inline-flex items-center justify-center rounded-md p-2 text-green-600 hover:bg-green-50 disabled:opacity-50"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {canCancel(workflow.status) && (
                          <button
                            onClick={() => handleCancel(workflow)}
                            disabled={isActionInProgress}
                            title="Cancel workflow"
                            className="inline-flex items-center justify-center rounded-md p-2 text-yellow-600 hover:bg-yellow-50 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* View details */}
                        <button
                          onClick={() => show("workflows", workflow.workflowId)}
                          title="View details"
                          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* More actions dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === workflow.id ? null : workflow.id)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenu === workflow.id && (
                            <div className="absolute right-0 mt-1 w-48 rounded-md border bg-popover shadow-lg z-10">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(workflow.workflowId);
                                    notify?.({ type: "success", message: "Copied workflow ID" });
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                                >
                                  Copy Workflow ID
                                </button>
                                {workflow.tenantId && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(workflow.tenantId!);
                                      notify?.({ type: "success", message: "Copied tenant ID" });
                                      setActiveMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                                  >
                                    Copy Tenant ID
                                  </button>
                                )}
                                {workflow.status === 'running' && (
                                  <button
                                    onClick={() => handleTerminate(workflow)}
                                    disabled={isActionInProgress}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Ban className="inline h-3 w-3 mr-2" />
                                    Force Terminate
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary footer with pagination */}
        {filteredWorkflows.length > 0 && (
          <div className="border-t px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredWorkflows.length} of {totalCount} workflow{totalCount !== 1 ? 's' : ''}
              {' | '}
              {filteredWorkflows.filter(w => w.status === 'running').length} running
              {' | '}
              {filteredWorkflows.filter(w => w.status === 'failed').length} failed
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center rounded-md border p-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center rounded-md border p-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
