import { useCustom } from "@refinedev/core";
import { useParams, useNavigate } from "react-router-dom";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Clock,
  Zap,
  Code,
  Copy,
  Check,
  Hash,
  Settings,
  ArrowRight,
  Play,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggers?: Array<{
    type: string;
    identifier: string;
    variables?: Array<{
      name: string;
      type?: string;
    }>;
  }>;
  steps?: Array<{
    active: boolean;
    template?: {
      type: string;
      content?: string;
      subject?: string;
      title?: string;
      _id?: string;
    };
    _id?: string;
  }>;
  tags?: string[];
  preferenceSettings?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    in_app?: boolean;
    chat?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  _environmentId?: string;
  _organizationId?: string;
}

// Channel type icons
const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
  in_app: MessageSquare,
  chat: MessageSquare,
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700 border-blue-200",
  sms: "bg-green-100 text-green-700 border-green-200",
  push: "bg-purple-100 text-purple-700 border-purple-200",
  in_app: "bg-orange-100 text-orange-700 border-orange-200",
  chat: "bg-pink-100 text-pink-700 border-pink-200",
};

const getChannelIcon = (type: string) => {
  return CHANNEL_ICONS[type] || Bell;
};

/**
 * Code Block with Copy functionality
 */
function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg bg-slate-900 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Step Card Component
 */
function StepCard({ step, index }: { step: NonNullable<NotificationTemplate["steps"]>[number]; index: number }) {
  const ChannelIcon = getChannelIcon(step.template?.type || "");
  const channelColor = CHANNEL_COLORS[step.template?.type || ""] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <div className="relative">
      {/* Connector line */}
      {index > 0 && (
        <div className="absolute left-6 -top-4 w-0.5 h-4 bg-border" />
      )}

      <div className={cn(
        "border rounded-lg p-4",
        step.active ? "bg-card" : "bg-muted/50"
      )}>
        <div className="flex items-start gap-4">
          {/* Step Number & Icon */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "h-12 w-12 rounded-lg flex items-center justify-center border",
              channelColor
            )}>
              <ChannelIcon className="h-6 w-6" />
            </div>
            <span className="text-xs text-muted-foreground mt-1">Step {index + 1}</span>
          </div>

          {/* Step Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium capitalize">
                {step.template?.type?.replace("_", " ") || "Unknown Channel"}
              </h4>
              <span className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                step.active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              )}>
                {step.active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Step Details */}
            {step.template?.subject && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">Subject:</span>
                <p className="text-sm font-medium">{step.template.subject}</p>
              </div>
            )}

            {step.template?.title && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">Title:</span>
                <p className="text-sm font-medium">{step.template.title}</p>
              </div>
            )}

            {step.template?.content && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Content Preview:</span>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans">{step.template.content}</pre>
                </div>
              </div>
            )}

            {step._id && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                ID: {step._id}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch template details
  const { data, isLoading, isError } = useCustom<NotificationTemplate>({
    url: `/notifications/templates/${id}`,
    method: "get",
    queryOptions: {
      enabled: !!id,
    },
  });

  const template = data?.data;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Generate example trigger code
  const generateTriggerCode = () => {
    if (!template) return "";

    const triggerId = template.triggers?.[0]?.identifier || template.name;
    const variables: Record<string, string> = {};

    template.triggers?.[0]?.variables?.forEach((v) => {
      variables[v.name] = `<${v.name}>`;
    });

    return `// Trigger notification
novu.trigger('${triggerId}', {
  to: {
    subscriberId: 'tenant-{tenantId}-{email}',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  payload: ${JSON.stringify(variables, null, 4)},
});`;
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="p-12 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium">Template not found</h3>
        <p className="text-muted-foreground mt-1">
          The template you're looking for doesn't exist or has been deleted.
        </p>
        <button
          onClick={() => navigate("/notifications/templates")}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to templates
        </button>
      </div>
    );
  }

  const triggerId = template.triggers?.[0]?.identifier;
  const variables = template.triggers?.[0]?.variables || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/notifications/templates")}
            className="inline-flex items-center justify-center rounded-md border p-2 hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
              <span
                className={cn(
                  "px-2.5 py-0.5 text-sm font-medium rounded-full",
                  template.active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                )}
              >
                {template.active ? "Active" : "Inactive"}
              </span>
            </div>
            {template.description && (
              <p className="text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications/templates")}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Play className="mr-2 h-4 w-4" />
            Test Send
          </button>
          <a
            href={`https://web.novu.co/workflows/${template.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Edit in Novu
          </a>
        </div>
      </div>

      {/* Template Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">Trigger ID</span>
          </div>
          <p className="font-mono text-sm break-all">{triggerId || template.id}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Steps</span>
          </div>
          <p className="text-2xl font-bold">{template.steps?.length || 0}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Last Updated</span>
          </div>
          <p className="text-sm">{formatDate(template.updatedAt)}</p>
        </div>
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-muted rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Template Variables */}
      {variables.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Code className="h-4 w-4" />
            Template Variables
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {variables.map((variable) => (
              <div
                key={variable.name}
                className="p-3 bg-muted rounded-lg"
              >
                <p className="font-mono text-sm text-primary">{`{{${variable.name}}}`}</p>
                {variable.type && (
                  <p className="text-xs text-muted-foreground mt-1">{variable.type}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Workflow Steps
        </h3>

        {template.steps && template.steps.length > 0 ? (
          <div className="space-y-4">
            {template.steps.map((step, index) => (
              <StepCard key={step._id || index} step={step} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No steps configured for this workflow</p>
          </div>
        )}
      </div>

      {/* Channel Preferences */}
      {template.preferenceSettings && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Default Channel Preferences
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(template.preferenceSettings).map(([channel, enabled]) => {
              const ChannelIcon = getChannelIcon(channel);
              return (
                <span
                  key={channel}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border",
                    enabled
                      ? CHANNEL_COLORS[channel] || "bg-green-100 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  )}
                >
                  <ChannelIcon className="h-4 w-4" />
                  <span className="capitalize">{channel.replace("_", " ")}</span>
                  {enabled ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Trigger Code Example */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Code className="h-4 w-4" />
          Trigger Code Example
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Use this code snippet to trigger this notification from your application:
        </p>
        <CodeBlock code={generateTriggerCode()} language="javascript" />
      </div>

      {/* Metadata */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium mb-3">Metadata</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Template ID:</span>
            <p className="font-mono">{template.id}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>
            <p>{formatDate(template.createdAt)}</p>
          </div>
          {template._environmentId && (
            <div>
              <span className="text-muted-foreground">Environment ID:</span>
              <p className="font-mono text-xs">{template._environmentId}</p>
            </div>
          )}
          {template._organizationId && (
            <div>
              <span className="text-muted-foreground">Organization ID:</span>
              <p className="font-mono text-xs">{template._organizationId}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
