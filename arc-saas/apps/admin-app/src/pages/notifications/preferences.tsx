import { useCustom, useCustomMutation } from "@refinedev/core";
import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Webhook,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Loader2,
  Info,
  CreditCard,
  ShoppingCart,
  Users,
  Shield,
  Cog,
  GitBranch,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Notification preference for a category
 */
interface NotificationPreference {
  id?: string;
  tenantId: string;
  category: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl?: string;
}

/**
 * Category metadata
 */
interface CategoryInfo {
  id: string;
  name: string;
  description: string;
}

// Category icons
const CATEGORY_ICONS: Record<string, typeof Bell> = {
  billing: CreditCard,
  subscription: ShoppingCart,
  user: Users,
  security: Shield,
  system: Cog,
  workflow: GitBranch,
};

// Channel configuration
const CHANNELS = [
  { id: "emailEnabled", name: "Email", icon: Mail, description: "Email notifications" },
  { id: "smsEnabled", name: "SMS", icon: Smartphone, description: "Text message notifications" },
  { id: "pushEnabled", name: "Push", icon: Bell, description: "Browser push notifications" },
  { id: "inAppEnabled", name: "In-App", icon: MessageSquare, description: "In-app notifications" },
  { id: "webhookEnabled", name: "Webhook", icon: Webhook, description: "Webhook delivery" },
] as const;

/**
 * Single preference card for a category
 */
function PreferenceCard({
  preference,
  categoryInfo,
  onChange,
  isSaving,
}: {
  preference: NotificationPreference;
  categoryInfo: CategoryInfo;
  onChange: (category: string, updates: Partial<NotificationPreference>) => void;
  isSaving: boolean;
}) {
  const [webhookUrl, setWebhookUrl] = useState(preference.webhookUrl || "");
  const [webhookError, setWebhookError] = useState("");
  const CategoryIcon = CATEGORY_ICONS[preference.category] || Bell;

  // Sync webhook URL when preference changes
  useEffect(() => {
    setWebhookUrl(preference.webhookUrl || "");
  }, [preference.webhookUrl]);

  const handleToggle = (channelId: keyof NotificationPreference, enabled: boolean) => {
    // If enabling webhook, validate URL exists
    if (channelId === "webhookEnabled" && enabled && !webhookUrl) {
      setWebhookError("Please enter a webhook URL first");
      return;
    }
    setWebhookError("");
    onChange(preference.category, { [channelId]: enabled });
  };

  const handleWebhookUrlChange = (url: string) => {
    setWebhookUrl(url);
    setWebhookError("");
  };

  const handleWebhookUrlBlur = () => {
    if (webhookUrl && preference.webhookEnabled) {
      // Validate URL format
      try {
        new URL(webhookUrl);
        onChange(preference.category, { webhookUrl });
      } catch {
        setWebhookError("Invalid URL format");
      }
    } else if (webhookUrl !== preference.webhookUrl) {
      onChange(preference.category, { webhookUrl: webhookUrl || undefined });
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      {/* Category Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CategoryIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{categoryInfo.name}</h3>
          <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Channel Toggles */}
      <div className="p-4 space-y-3">
        {CHANNELS.map((channel) => {
          const channelKey = channel.id as keyof NotificationPreference;
          const isEnabled = preference[channelKey] as boolean;
          const ChannelIcon = channel.icon;

          return (
            <div key={channel.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-xs text-muted-foreground">{channel.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(channelKey, !isEnabled)}
                disabled={isSaving}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  isEnabled ? "bg-primary" : "bg-muted-foreground/30",
                  isSaving && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    isEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          );
        })}

        {/* Webhook URL field (shown when webhook is enabled) */}
        {preference.webhookEnabled && (
          <div className="pt-2 border-t mt-2">
            <label className="block text-sm font-medium mb-1">Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => handleWebhookUrlChange(e.target.value)}
                onBlur={handleWebhookUrlBlur}
                placeholder="https://your-server.com/webhook"
                disabled={isSaving}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm",
                  webhookError && "border-red-500",
                  isSaving && "opacity-50"
                )}
              />
            </div>
            {webhookError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {webhookError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-2 bg-muted/20 border-t text-xs text-muted-foreground">
        Enabled channels:{" "}
        {CHANNELS.filter((c) => preference[c.id as keyof NotificationPreference] as boolean)
          .map((c) => c.name)
          .join(", ") || "None"}
      </div>
    </div>
  );
}

/**
 * Notification Preferences Page
 *
 * Allows tenants to configure which notification channels are enabled
 * for each category (billing, subscription, user, security, system, workflow).
 */
export function NotificationPreferences() {
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<NotificationPreference>>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  // Fetch preferences
  const {
    data: preferencesData,
    isLoading,
    refetch,
  } = useCustom<NotificationPreference[]>({
    url: "/notifications/preferences",
    method: "get",
  });

  // Fetch categories
  const { data: categoriesData } = useCustom<CategoryInfo[]>({
    url: "/notifications/preferences/categories",
    method: "get",
  });

  // Update preference mutation
  const { mutate: updatePreference } = useCustomMutation<NotificationPreference>();

  const preferences = preferencesData?.data ?? [];
  const categories = categoriesData?.data ?? [];

  // Create a map for easy lookup
  const preferencesMap = new Map(preferences.map((p) => [p.category, p]));
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));

  // Handle preference change - immediate save
  const handleChange = async (category: string, updates: Partial<NotificationPreference>) => {
    setPendingChanges((prev) => ({
      ...prev,
      [category]: { ...(prev[category] || {}), ...updates },
    }));

    setSaveStatus("saving");
    setSaveError("");

    updatePreference(
      {
        url: `/notifications/preferences/${category}`,
        method: "put",
        values: {
          ...(pendingChanges[category] || {}),
          ...updates,
        },
      },
      {
        onSuccess: () => {
          setSaveStatus("success");
          setPendingChanges((prev) => {
            const next = { ...prev };
            delete next[category];
            return next;
          });
          // Clear success status after a moment
          setTimeout(() => setSaveStatus("idle"), 2000);
          // Refetch to get updated data
          refetch();
        },
        onError: (error: unknown) => {
          setSaveStatus("error");
          const errorMessage = error instanceof Error ? error.message : "Failed to save preference";
          setSaveError(errorMessage);
        },
      }
    );
  };

  // Get effective preference (with pending changes merged)
  const getEffectivePreference = (category: string): NotificationPreference => {
    const base = preferencesMap.get(category) || {
      tenantId: "",
      category,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
      webhookEnabled: false,
    };
    const pending = pendingChanges[category] || {};
    return { ...base, ...pending };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Preferences</h1>
          <p className="text-muted-foreground">
            Configure notification channels for each category
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Save Status Badge */}
          {saveStatus !== "idle" && (
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                saveStatus === "saving" && "bg-blue-100 text-blue-700",
                saveStatus === "success" && "bg-green-100 text-green-700",
                saveStatus === "error" && "bg-red-100 text-red-700"
              )}
            >
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === "success" && (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>Error</span>
                </>
              )}
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {saveStatus === "error" && saveError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Channel Preferences</p>
          <p className="mt-1">
            Configure which notification channels are enabled for each category. Changes are saved
            automatically. When a notification is triggered, only enabled channels will receive it.
          </p>
        </div>
      </div>

      {/* Preferences Grid */}
      {isLoading ? (
        <div className="p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading preferences...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-12 text-center border rounded-lg bg-card">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Categories Found</h3>
          <p className="text-muted-foreground mt-1">
            Notification categories could not be loaded.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {categories.map((category) => (
            <PreferenceCard
              key={category.id}
              preference={getEffectivePreference(category.id)}
              categoryInfo={category}
              onChange={handleChange}
              isSaving={saveStatus === "saving" && !!pendingChanges[category.id]}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {CHANNELS.map((channel) => {
          const enabledCount = categories.filter(
            (c) => getEffectivePreference(c.id)[channel.id as keyof NotificationPreference] as boolean
          ).length;
          const ChannelIcon = channel.icon;

          return (
            <div key={channel.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ChannelIcon className="h-4 w-4" />
                <span className="text-sm">{channel.name}</span>
              </div>
              <p className="text-2xl font-bold">
                {enabledCount}/{categories.length}
              </p>
              <p className="text-xs text-muted-foreground">categories enabled</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
