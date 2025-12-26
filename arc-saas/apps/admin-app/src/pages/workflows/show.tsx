import { useShow, useNavigation, useCustomMutation, useNotification } from "@refinedev/core";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Ban,
  RefreshCw,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowEvent {
  id: string;
  eventType: string;
  timestamp: string;
  details?: string;
}

interface Workflow {
  id: string;
  workflowId: string;
  runId: string;
  workflowType: string;
  tenantId?: string;
  tenantName?: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  startTime: string;
  endTime?: string;
  events?: WorkflowEvent[];
  error?: string;
  result?: any;
  memo?: Record<string, unknown>;
  searchAttributes?: Record<string, unknown>;
}

interface WorkflowActionResult {
  success: boolean;
  workflowId: string;
  message: string;
  action: 'restart' | 'cancel';
  performedBy?: string;
  timestamp: string;
}

export function WorkflowShow() {
  const { id } = useParams();
  const { list } = useNavigation();
  const { queryResult } = useShow<Workflow>({ resource: "workflows", id });
  const { data, isLoading } = queryResult;
  const refetch = queryResult?.refetch;
  const workflow = data?.data;
  const { open: notify } = useNotification();

  // Action mutations
  const { mutate: restartWorkflow, isLoading: isRestarting } = useCustomMutation<WorkflowActionResult>();
  const { mutate: cancelWorkflow, isLoading: isCancelling } = useCustomMutation<WorkflowActionResult>();
  const { mutate: terminateWorkflow, isLoading: isTerminating } = useCustomMutation<WorkflowActionResult>();

  const isActionInProgress = isRestarting || isCancelling || isTerminating;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running": return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case "completed": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  const canRestart = (status: string) => {
    return ['failed', 'cancelled', 'timed_out'].includes(status);
  };

  const canCancel = (status: string) => {
    return status === 'running';
  };

  const handleRestart = () => {
    if (!workflow) return;

    restartWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/restart`,
        method: "post",
        values: { reason: "Manual restart from workflow details page" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow restarted",
            description: result.data.message,
          });
          // Navigate to the new workflow
          list("workflows");
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to restart workflow",
            description: error.message,
          });
        },
      }
    );
  };

  const handleCancel = () => {
    if (!workflow) return;

    cancelWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/cancel`,
        method: "post",
        values: { reason: "Manual cancellation from workflow details page" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow cancelled",
            description: result.data.message,
          });
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to cancel workflow",
            description: error.message,
          });
        },
      }
    );
  };

  const handleTerminate = () => {
    if (!workflow) return;

    if (!window.confirm(
      `Are you sure you want to forcefully terminate this workflow?\n\n` +
      `This action cannot be undone and may leave resources in an inconsistent state.`
    )) {
      return;
    }

    terminateWorkflow(
      {
        url: `/workflows/${workflow.workflowId}/terminate`,
        method: "post",
        values: { reason: "Force termination from workflow details page" },
      },
      {
        onSuccess: (result) => {
          notify?.({
            type: "success",
            message: "Workflow terminated",
            description: result.data.message,
          });
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Failed to terminate workflow",
            description: error.message,
          });
        },
      }
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notify?.({ type: "success", message: `Copied ${label}` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading workflow details...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="mt-4 text-lg font-semibold">Workflow not found</h2>
        <p className="mt-2 text-muted-foreground">
          The workflow may have been deleted or the ID is invalid.
        </p>
        <button
          onClick={() => list("workflows")}
          className="mt-4 inline-flex items-center px-4 py-2 border rounded-md hover:bg-muted"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to workflows
        </button>
      </div>
    );
  }

  const duration = workflow.endTime
    ? Math.round((new Date(workflow.endTime).getTime() - new Date(workflow.startTime).getTime()) / 1000)
    : null;

  // Format duration nicely
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => list("workflows")} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {getStatusIcon(workflow.status)}
            <h1 className="text-2xl font-bold tracking-tight">{workflow.workflowType}</h1>
            <span className={cn("inline-flex px-2 py-1 text-xs font-medium rounded-full", getStatusColor(workflow.status))}>
              {workflow.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-muted-foreground font-mono">{workflow.workflowId}</code>
            <button
              onClick={() => copyToClipboard(workflow.workflowId, "Workflow ID")}
              className="p-1 hover:bg-muted rounded"
              title="Copy workflow ID"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </button>

          {canRestart(workflow.status) && (
            <button
              onClick={handleRestart}
              disabled={isActionInProgress}
              className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-2" />
              Restart
            </button>
          )}

          {canCancel(workflow.status) && (
            <>
              <button
                onClick={handleCancel}
                disabled={isActionInProgress}
                className="inline-flex items-center px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={isActionInProgress}
                className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                <Ban className="h-4 w-4 mr-2" />
                Terminate
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Details card */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Run ID</dt>
              <dd className="font-mono text-sm flex items-center gap-1">
                {workflow.runId?.slice(0, 16)}...
                <button
                  onClick={() => copyToClipboard(workflow.runId, "Run ID")}
                  className="p-1 hover:bg-muted rounded"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </dd>
            </div>

            {workflow.tenantId && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tenant ID</dt>
                <dd className="font-mono text-sm flex items-center gap-1">
                  {workflow.tenantId.slice(0, 8)}...
                  <button
                    onClick={() => copyToClipboard(workflow.tenantId!, "Tenant ID")}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                </dd>
              </div>
            )}

            <div className="flex justify-between">
              <dt className="text-muted-foreground">Started</dt>
              <dd>{new Date(workflow.startTime).toLocaleString()}</dd>
            </div>

            {workflow.endTime && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ended</dt>
                <dd>{new Date(workflow.endTime).toLocaleString()}</dd>
              </div>
            )}

            {duration !== null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">{formatDuration(duration)}</dd>
              </div>
            )}

            {workflow.status === 'running' && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Running for</dt>
                <dd className="font-medium text-blue-600">
                  {formatDuration(Math.round((Date.now() - new Date(workflow.startTime).getTime()) / 1000))}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Error card */}
        {workflow.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Error</h2>
            <pre className="text-sm text-red-600 whitespace-pre-wrap overflow-auto max-h-48">
              {workflow.error}
            </pre>
          </div>
        )}

        {/* Result card (for completed workflows) */}
        {workflow.result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <h2 className="text-lg font-semibold text-green-700 mb-2">Result</h2>
            <pre className="text-sm text-green-600 whitespace-pre-wrap overflow-auto max-h-48">
              {JSON.stringify(workflow.result, null, 2)}
            </pre>
          </div>
        )}

        {/* Memo card (if present) */}
        {workflow.memo && Object.keys(workflow.memo).length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Workflow Memo</h2>
            <dl className="space-y-3">
              {Object.entries(workflow.memo).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="text-sm font-mono">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Event history */}
      {workflow.events && workflow.events.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Event History</h2>
          <div className="space-y-3">
            {workflow.events.map((event, index) => (
              <div key={event.id || index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{event.eventType}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.details && (
                    <p className="text-sm text-muted-foreground mt-1">{event.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={`http://localhost:27021/namespaces/arc-saas/workflows/${workflow.workflowId}/${workflow.runId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 border rounded-md hover:bg-muted text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View in Temporal UI
          </a>
          {workflow.tenantId && (
            <button
              onClick={() => copyToClipboard(
                `docker exec arc-saas-temporal temporal workflow show --namespace arc-saas --workflow-id "${workflow.workflowId}" --address temporal:7233`,
                "Temporal CLI command"
              )}
              className="inline-flex items-center px-3 py-2 border rounded-md hover:bg-muted text-sm"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy CLI Command
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
