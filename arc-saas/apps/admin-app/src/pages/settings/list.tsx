import { useState, useEffect } from "react";
import { useList, useCustomMutation } from "@refinedev/core";
import {
  Settings,
  Globe,
  Mail,
  Shield,
  Database,
  Bell,
  Palette,
  Key,
  Server,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Settings categories
type SettingsCategory = "general" | "email" | "security" | "integrations" | "notifications" | "appearance";

interface SettingField {
  key: string;
  label: string;
  description?: string;
  type: "text" | "email" | "url" | "number" | "toggle" | "select" | "secret" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: typeof Settings;
  fields: SettingField[];
}

const SETTINGS_SECTIONS: Record<SettingsCategory, SettingsSection> = {
  general: {
    id: "general",
    title: "General Settings",
    description: "Configure basic platform settings",
    icon: Globe,
    fields: [
      {
        key: "platformName",
        label: "Platform Name",
        description: "The name displayed across the platform",
        type: "text",
        placeholder: "My SaaS Platform",
        required: true,
      },
      {
        key: "platformUrl",
        label: "Platform URL",
        description: "The base URL for your platform",
        type: "url",
        placeholder: "https://app.example.com",
        required: true,
      },
      {
        key: "supportEmail",
        label: "Support Email",
        description: "Email address for customer support",
        type: "email",
        placeholder: "support@example.com",
      },
      {
        key: "defaultTimezone",
        label: "Default Timezone",
        type: "select",
        options: [
          { value: "UTC", label: "UTC" },
          { value: "America/New_York", label: "Eastern Time (US)" },
          { value: "America/Los_Angeles", label: "Pacific Time (US)" },
          { value: "Europe/London", label: "London" },
          { value: "Europe/Paris", label: "Paris" },
          { value: "Asia/Tokyo", label: "Tokyo" },
          { value: "Asia/Singapore", label: "Singapore" },
        ],
      },
      {
        key: "defaultLanguage",
        label: "Default Language",
        type: "select",
        options: [
          { value: "en", label: "English" },
          { value: "es", label: "Spanish" },
          { value: "fr", label: "French" },
          { value: "de", label: "German" },
          { value: "ja", label: "Japanese" },
        ],
      },
      {
        key: "maintenanceMode",
        label: "Maintenance Mode",
        description: "Enable to show maintenance page to users",
        type: "toggle",
      },
    ],
  },
  email: {
    id: "email",
    title: "Email Configuration",
    description: "Configure email delivery settings",
    icon: Mail,
    fields: [
      {
        key: "smtpHost",
        label: "SMTP Host",
        type: "text",
        placeholder: "smtp.example.com",
      },
      {
        key: "smtpPort",
        label: "SMTP Port",
        type: "number",
        placeholder: "587",
      },
      {
        key: "smtpUser",
        label: "SMTP Username",
        type: "text",
        placeholder: "user@example.com",
      },
      {
        key: "smtpPassword",
        label: "SMTP Password",
        type: "secret",
        placeholder: "••••••••",
      },
      {
        key: "smtpSecure",
        label: "Use TLS/SSL",
        description: "Enable secure connection for SMTP",
        type: "toggle",
      },
      {
        key: "fromEmail",
        label: "From Email Address",
        description: "Default sender email address",
        type: "email",
        placeholder: "noreply@example.com",
      },
      {
        key: "fromName",
        label: "From Name",
        description: "Default sender name",
        type: "text",
        placeholder: "My SaaS Platform",
      },
    ],
  },
  security: {
    id: "security",
    title: "Security Settings",
    description: "Configure security and authentication",
    icon: Shield,
    fields: [
      {
        key: "sessionTimeout",
        label: "Session Timeout (minutes)",
        description: "Automatically log out users after inactivity",
        type: "number",
        placeholder: "30",
      },
      {
        key: "maxLoginAttempts",
        label: "Max Login Attempts",
        description: "Lock account after failed attempts",
        type: "number",
        placeholder: "5",
      },
      {
        key: "lockoutDuration",
        label: "Lockout Duration (minutes)",
        description: "How long to lock accounts after max attempts",
        type: "number",
        placeholder: "15",
      },
      {
        key: "requireMfa",
        label: "Require MFA",
        description: "Require multi-factor authentication for all users",
        type: "toggle",
      },
      {
        key: "passwordMinLength",
        label: "Minimum Password Length",
        type: "number",
        placeholder: "8",
      },
      {
        key: "passwordRequireSpecial",
        label: "Require Special Characters",
        description: "Passwords must contain special characters",
        type: "toggle",
      },
      {
        key: "passwordRequireNumbers",
        label: "Require Numbers",
        description: "Passwords must contain numbers",
        type: "toggle",
      },
      {
        key: "allowedDomains",
        label: "Allowed Email Domains",
        description: "Comma-separated list of allowed domains (empty for all)",
        type: "textarea",
        placeholder: "example.com, company.org",
      },
    ],
  },
  integrations: {
    id: "integrations",
    title: "Integrations",
    description: "Configure third-party integrations",
    icon: Server,
    fields: [
      {
        key: "stripeSecretKey",
        label: "Stripe Secret Key",
        type: "secret",
        placeholder: "sk_live_...",
      },
      {
        key: "stripePublishableKey",
        label: "Stripe Publishable Key",
        type: "text",
        placeholder: "pk_live_...",
      },
      {
        key: "stripeWebhookSecret",
        label: "Stripe Webhook Secret",
        type: "secret",
        placeholder: "whsec_...",
      },
      {
        key: "keycloakUrl",
        label: "Keycloak URL",
        type: "url",
        placeholder: "https://auth.example.com",
      },
      {
        key: "keycloakRealm",
        label: "Keycloak Realm",
        type: "text",
        placeholder: "master",
      },
      {
        key: "keycloakClientId",
        label: "Keycloak Client ID",
        type: "text",
        placeholder: "admin-app",
      },
      {
        key: "keycloakClientSecret",
        label: "Keycloak Client Secret",
        type: "secret",
        placeholder: "••••••••",
      },
      {
        key: "temporalAddress",
        label: "Temporal Server Address",
        type: "text",
        placeholder: "localhost:7233",
      },
      {
        key: "temporalNamespace",
        label: "Temporal Namespace",
        type: "text",
        placeholder: "default",
      },
    ],
  },
  notifications: {
    id: "notifications",
    title: "Notification Settings",
    description: "Configure system notifications",
    icon: Bell,
    fields: [
      {
        key: "emailNotifications",
        label: "Email Notifications",
        description: "Send email notifications for important events",
        type: "toggle",
      },
      {
        key: "notifyOnNewTenant",
        label: "New Tenant Notification",
        description: "Notify admins when a new tenant registers",
        type: "toggle",
      },
      {
        key: "notifyOnProvisioningFailure",
        label: "Provisioning Failure Alert",
        description: "Alert when tenant provisioning fails",
        type: "toggle",
      },
      {
        key: "notifyOnSubscriptionChange",
        label: "Subscription Change Notification",
        description: "Notify on subscription upgrades/downgrades",
        type: "toggle",
      },
      {
        key: "notifyOnPaymentFailure",
        label: "Payment Failure Alert",
        description: "Alert when a payment fails",
        type: "toggle",
      },
      {
        key: "adminNotificationEmails",
        label: "Admin Notification Emails",
        description: "Comma-separated list of admin emails for alerts",
        type: "textarea",
        placeholder: "admin@example.com, ops@example.com",
      },
      {
        key: "slackWebhookUrl",
        label: "Slack Webhook URL",
        description: "Send notifications to Slack channel",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
      },
    ],
  },
  appearance: {
    id: "appearance",
    title: "Appearance",
    description: "Customize platform appearance",
    icon: Palette,
    fields: [
      {
        key: "primaryColor",
        label: "Primary Color",
        description: "Main brand color (hex)",
        type: "text",
        placeholder: "#6366f1",
      },
      {
        key: "logoUrl",
        label: "Logo URL",
        description: "URL to your platform logo",
        type: "url",
        placeholder: "https://example.com/logo.png",
      },
      {
        key: "faviconUrl",
        label: "Favicon URL",
        description: "URL to your favicon",
        type: "url",
        placeholder: "https://example.com/favicon.ico",
      },
      {
        key: "defaultTheme",
        label: "Default Theme",
        type: "select",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "System" },
        ],
      },
      {
        key: "customCss",
        label: "Custom CSS",
        description: "Additional CSS for customization",
        type: "textarea",
        placeholder: "/* Custom styles */",
      },
    ],
  },
};

const CATEGORY_LIST: { id: SettingsCategory; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Globe },
  { id: "email", label: "Email", icon: Mail },
  { id: "security", label: "Security", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Server },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
];

// Default values for settings fields (used when API returns no value)
const SETTINGS_DEFAULTS: Record<string, unknown> = {
  defaultTimezone: "UTC",
  defaultLanguage: "en",
  maintenanceMode: false,
  smtpSecure: true,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
  requireMfa: false,
  passwordMinLength: 8,
  passwordRequireSpecial: true,
  passwordRequireNumbers: true,
  emailNotifications: true,
  notifyOnNewTenant: true,
  notifyOnProvisioningFailure: true,
  notifyOnSubscriptionChange: true,
  notifyOnPaymentFailure: true,
  defaultTheme: "system",
};

export function SettingsList() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [settings, setSettings] = useState<Record<string, unknown>>(SETTINGS_DEFAULTS);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings from API
  const { data: settingsData, isLoading, refetch } = useList<{ key: string; value: unknown }>({
    resource: "settings",
    pagination: { pageSize: 100 },
  });

  const { mutate: saveSettingsMutation } = useCustomMutation();

  // Load settings from API when data is available
  useEffect(() => {
    if (settingsData?.data && settingsData.data.length > 0) {
      const loadedSettings: Record<string, unknown> = {};
      settingsData.data.forEach((item) => {
        loadedSettings[item.key] = item.value;
      });
      setSettings((prev) => ({ ...prev, ...loadedSettings }));
    }
  }, [settingsData]);

  const currentSection = SETTINGS_SECTIONS[activeCategory];

  const handleSettingChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveSettingsMutation(
        {
          url: "settings/bulk",
          method: "put",
          values: { settings },
        },
        {
          onSuccess: () => {
            setHasChanges(false);
            refetch();
          },
          onError: () => {
            // Error displayed by Refine's notification provider
          },
          onSettled: () => {
            setIsSaving(false);
          },
        }
      );
    } catch {
      setIsSaving(false);
    }
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  const renderField = (field: SettingField) => {
    const value = settings[field.key];

    switch (field.type) {
      case "toggle":
        return (
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => handleSettingChange(field.key, !value)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              value ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                value ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        );

      case "select":
        return (
          <select
            value={(value as string) || ""}
            onChange={(e) => handleSettingChange(field.key, e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <textarea
            value={(value as string) || ""}
            onChange={(e) => handleSettingChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        );

      case "secret":
        return (
          <div className="relative">
            <input
              type={showSecrets[field.key] ? "text" : "password"}
              value={(value as string) || ""}
              onChange={(e) => handleSettingChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="flex h-10 w-full rounded-md border border-input bg-background pl-3 pr-20 py-2 text-sm font-mono"
            />
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                type="button"
                onClick={() => toggleSecretVisibility(field.key)}
                className="p-2 hover:bg-muted rounded"
              >
                {showSecrets[field.key] ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {Boolean(value) && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(value as string)}
                  className="p-2 hover:bg-muted rounded"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            value={(value as number) || ""}
            onChange={(e) => handleSettingChange(field.key, parseInt(e.target.value, 10) || "")}
            placeholder={field.placeholder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        );

      default:
        return (
          <input
            type={field.type}
            value={(value as string) || ""}
            onChange={(e) => handleSettingChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure your platform settings and integrations
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <span className="inline-flex items-center gap-1 px-3 py-2 text-sm text-yellow-600 bg-yellow-50 rounded-md">
              <AlertTriangle className="h-4 w-4" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {CATEGORY_LIST.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </nav>

          {/* Quick Links */}
          <div className="mt-8 pt-6 border-t">
            <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Links
            </h4>
            <div className="mt-2 space-y-1">
              <a
                href="#"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Key className="h-4 w-4" />
                API Keys
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
              <a
                href="#"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Database className="h-4 w-4" />
                Database
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="rounded-lg border bg-card">
            {/* Section Header */}
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <currentSection.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{currentSection.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {currentSection.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="p-6 space-y-6">
              {currentSection.fields.map((field) => (
                <div key={field.key} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium leading-none">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    {field.type === "toggle" && renderField(field)}
                  </div>
                  {field.description && (
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                  {field.type !== "toggle" && (
                    <div className="mt-1">{renderField(field)}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Section Footer */}
            {activeCategory === "integrations" && (
              <div className="p-6 border-t bg-muted/30">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Integration Status</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Stripe: Connected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Keycloak: Connected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Temporal: Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
