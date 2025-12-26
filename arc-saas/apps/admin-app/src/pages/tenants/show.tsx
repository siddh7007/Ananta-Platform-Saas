import { useShow, useNavigation, useList, useUpdate, useCustomMutation } from "@refinedev/core";
import { useParams } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Globe,
  Calendar,
  CreditCard,
  Users,
  Settings,
  Activity,
  Shield,
  RefreshCw,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Mail,
  UserPlus,
  MoreHorizontal,
  Loader2,
  Server,
  Database,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

interface Tenant {
  id: string;
  name: string;
  key: string;
  status: number | "pending" | "provisioning" | "active" | "suspended" | "deprovisioning" | "failed";
  tier: string;
  domain?: string;
  domains?: string[];
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  createdAt: string;
  createdOn?: string;
  updatedAt?: string;
  provisioningStatus?: ProvisioningStatus;
  subscription?: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd: string;
    amount?: number;
    currency?: string;
  };
  metadata?: Record<string, unknown>;
  contacts?: Array<{ email: string; firstName?: string; lastName?: string; isPrimary?: boolean }>;
}

// Map numeric status from backend to string status for frontend
const mapNumericStatus = (status: number | string): string => {
  if (typeof status === 'string') return status;
  const statusMap: Record<number, string> = {
    0: 'active',
    1: 'pending', // PENDINGPROVISION
    2: 'provisioning',
    3: 'failed', // PROVISIONFAILED
    4: 'deprovisioning',
    5: 'suspended', // INACTIVE
  };
  return statusMap[status] ?? 'pending';
};

interface ProvisioningStatus {
  step: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  steps: {
    name: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    message?: string;
  }[];
}

interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: "active" | "invited" | "disabled";
  lastLogin?: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  status: "success" | "failure" | "warning";
  timestamp: string;
  ipAddress?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending Provision", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  provisioning: { label: "Provisioning", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  active: { label: "Active", color: "bg-green-100 text-green-700", icon: CheckCircle },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-700", icon: Pause },
  deprovisioning: { label: "Deprovisioning", color: "bg-orange-100 text-orange-700", icon: Loader2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
};

const USER_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  invited: "bg-blue-100 text-blue-700",
  disabled: "bg-gray-100 text-gray-500",
};

export function TenantShow() {
  const { id } = useParams();
  const { list, show: showResource } = useNavigation();
  const { queryResult } = useShow<Tenant>({ resource: "tenants", id });
  const { data, isLoading, refetch } = queryResult;
  const tenant = data?.data;

  const { mutate: updateTenant, isLoading: isUpdating } = useUpdate();
  const { mutate: customMutate } = useCustomMutation();

  const [activeTab, setActiveTab] = useState("overview");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "", roleKey: "user" });

  // Fetch tenant users using the correct endpoint: /tenant-users/by-tenant/{tenantId}
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useList<TenantUser>({
    resource: `tenant-users/by-tenant/${id}`,
    pagination: { pageSize: 50 },
    queryOptions: {
      enabled: !!id, // Only fetch when id is available
    },
  });

  // Fetch audit logs for this tenant using the tenant-scoped endpoint
  const { data: auditLogsData, isLoading: auditLogsLoading, isError: auditLogsError } = useList<AuditLog>({
    resource: `audit-logs/by-tenant/${id}`,
    pagination: { pageSize: 50 },
    queryOptions: {
      enabled: !!id && activeTab === "activity", // Only fetch when on Activity tab
      retry: false, // Don't retry on permission errors
    },
  });

  const users = usersData?.data || [];
  const auditLogs = auditLogsData?.data || [];

  const handleSuspend = () => {
    if (confirm("Are you sure you want to suspend this tenant? Users will lose access.")) {
      updateTenant(
        { resource: "tenants", id: id!, values: { status: "suspended" } },
        { onSuccess: () => refetch() }
      );
    }
  };

  const handleReactivate = () => {
    updateTenant(
      { resource: "tenants", id: id!, values: { status: "active" } },
      { onSuccess: () => refetch() }
    );
  };

  const handleRetryProvisioning = () => {
    // Generate a subscription ID and dates for the SubscriptionDTO (retry provisioning)
    const subscriptionId = crypto.randomUUID();
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

    customMutate(
      {
        url: `/tenants/${id}/provision`,
        method: "post",
        values: {
          id: subscriptionId,
          subscriberId: id,
          startDate: startDate,
          endDate: endDate,
          status: 1, // Active subscription
          planId: "plan-basic", // Default plan for retry
          invoiceId: `inv-${subscriptionId.slice(0, 8)}`,
        },
      },
      { onSuccess: () => refetch() }
    );
  };

  const handleProvision = () => {
    // Generate a subscription ID and dates for the SubscriptionDTO
    const subscriptionId = crypto.randomUUID();
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

    customMutate(
      {
        url: `/tenants/${id}/provision`,
        method: "post",
        values: {
          id: subscriptionId,
          subscriberId: id,
          startDate: startDate,
          endDate: endDate,
          status: 1, // Active subscription
          planId: "plan-basic", // Default plan, could be made configurable
          invoiceId: `inv-${subscriptionId.slice(0, 8)}`,
        },
      },
      { onSuccess: () => refetch() }
    );
  };

  const handleInviteUser = () => {
    // Use the correct endpoint: POST /user-invitations with tenantId in the body
    // API requires: email, roleKey, tenantId (firstName/lastName/invitedBy are optional)
    customMutate(
      {
        url: `/user-invitations`,
        method: "post",
        values: {
          email: inviteForm.email,
          firstName: inviteForm.firstName || undefined,
          lastName: inviteForm.lastName || undefined,
          roleKey: inviteForm.roleKey,
          tenantId: id,
          // invitedBy is optional - admin invitations don't have a DB user record
        },
      },
      {
        onSuccess: () => {
          setShowInviteModal(false);
          setInviteForm({ email: "", firstName: "", lastName: "", roleKey: "user" });
          refetchUsers();
        },
        onError: () => {
          // Error displayed by Refine's notification provider
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Tenant not found</p>
      </div>
    );
  }

  // Map numeric status to string status
  const tenantStatus = mapNumericStatus(tenant.status);
  const statusConfig = STATUS_CONFIG[tenantStatus] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => list("tenants")} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                statusConfig.color
              )}
            >
              <StatusIcon className={cn("h-3 w-3", tenantStatus === "provisioning" && "animate-spin")} />
              {statusConfig.label}
            </span>
          </div>
          <p className="text-muted-foreground">
            <code className="bg-muted px-1 rounded">{tenant.key}</code> · Created {(tenant.createdOn || tenant.createdAt) ? new Date(tenant.createdOn || tenant.createdAt).toLocaleDateString() : "-"}
          </p>
        </div>
        <div className="flex gap-2">
          {tenantStatus === "pending" && (
            <button
              onClick={handleProvision}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Play className="mr-2 h-4 w-4" />
              Provision Tenant
            </button>
          )}
          {tenantStatus === "active" && (
            <button
              onClick={handleSuspend}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Pause className="mr-2 h-4 w-4" />
              Suspend
            </button>
          )}
          {tenantStatus === "suspended" && (
            <button
              onClick={handleReactivate}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Play className="mr-2 h-4 w-4" />
              Reactivate
            </button>
          )}
          {tenantStatus === "failed" && (
            <button
              onClick={handleRetryProvisioning}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Provisioning
            </button>
          )}
        </div>
      </div>

      {/* Provisioning Progress (if in progress or failed) */}
      {(tenantStatus === "provisioning" || tenantStatus === "failed") && tenant.provisioningStatus && (
        <div className={cn(
          "rounded-lg border p-4",
          tenantStatus === "failed" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {tenantStatus === "failed" ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              )}
              <span className={cn("font-medium", tenantStatus === "failed" ? "text-red-800" : "text-blue-800")}>
                {tenantStatus === "failed" ? "Provisioning Failed" : `Provisioning: ${tenant.provisioningStatus.step}`}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {tenant.provisioningStatus.progress}% complete
            </span>
          </div>
          <div className="h-2 rounded-full bg-white overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                tenantStatus === "failed" ? "bg-red-500" : "bg-blue-500"
              )}
              style={{ width: `${tenant.provisioningStatus.progress}%` }}
            />
          </div>
          {tenant.provisioningStatus.error && (
            <p className="mt-2 text-sm text-red-700">{tenant.provisioningStatus.error}</p>
          )}
          {tenant.provisioningStatus.steps && (
            <div className="mt-3 space-y-1">
              {tenant.provisioningStatus.steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {step.status === "completed" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {step.status === "in_progress" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                  {step.status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
                  {step.status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
                  <span className={cn(step.status === "pending" && "text-muted-foreground")}>
                    {step.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Basic Info */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Tenant Details
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Tenant ID</dt>
                  <dd className="font-mono text-sm">{tenant.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Key</dt>
                  <dd><code className="bg-muted px-2 py-1 rounded">{tenant.key}</code></dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Tier</dt>
                  <dd className="font-medium capitalize">{tenant.tier}</dd>
                </div>
              </dl>
            </div>

            {/* Domain & Access */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                Domain & Access
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">App URL</dt>
                  <dd className="flex items-center gap-2">
                    <a
                      href={`https://${tenant.domain || `${tenant.key}.app.example.com`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {tenant.domain || `${tenant.key}.app.example.com`}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Keycloak Realm</dt>
                  <dd className="font-mono text-sm">tenant-{tenant.key}</dd>
                </div>
              </dl>
            </div>

            {/* Admin Contact */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                Admin Contact
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Name</dt>
                  <dd className="font-medium">
                    {tenant.adminFirstName} {tenant.adminLastName}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd>{tenant.adminEmail}</dd>
                </div>
              </dl>
            </div>

            {/* Infrastructure */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                Infrastructure
              </h3>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Keycloak
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    SSL/TLS
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Enabled</span>
                </div>
              </dl>
            </div>

            {/* Quick Stats */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Quick Stats
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{users.filter(u => u.status === "active").length}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{users.filter(u => u.status === "invited").length}</p>
                  <p className="text-xs text-muted-foreground">Pending Invites</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            {tenant.metadata && Object.keys(tenant.metadata).length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  Metadata
                </h3>
                <dl className="space-y-2">
                  {Object.entries(tenant.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-mono">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Tenant Users</h3>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Login</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        No users yet. Invite users to get started.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize">{user.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize",
                            USER_STATUS_COLORS[user.status]
                          )}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="mt-6">
          {tenant.subscription ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Current Subscription</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium">{tenant.subscription.planName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <span className={cn(
                        "inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize",
                        tenant.subscription.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {tenant.subscription.status}
                      </span>
                    </dd>
                  </div>
                  {tenant.subscription.amount && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Amount</dt>
                      <dd className="font-medium">
                        ${tenant.subscription.amount}/{tenant.subscription.currency === "year" ? "yr" : "mo"}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Current Period Ends</dt>
                    <dd>{new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <div className="mt-6 pt-4 border-t">
                  <button
                    onClick={() => showResource("subscriptions", tenant.subscription!.id)}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted w-full"
                  >
                    View Subscription Details
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
              <p className="text-muted-foreground mb-4">This tenant doesn't have an active subscription.</p>
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recent Activity</h3>
            </div>
            <div className="divide-y">
              {auditLogsLoading ? (
                <div className="p-12 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                  <p className="mt-2 text-muted-foreground">Loading activity...</p>
                </div>
              ) : auditLogsError ? (
                <div className="p-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Permission Required</h3>
                  <p className="text-muted-foreground">
                    You don't have permission to view audit logs for this tenant.
                  </p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No activity logs yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-4">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      log.status === "success" ? "bg-green-100" : log.status === "failure" ? "bg-red-100" : "bg-yellow-100"
                    )}>
                      {log.status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {log.status === "failure" && <XCircle className="h-4 w-4 text-red-600" />}
                      {log.status === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{log.action}</p>
                        {log.targetType && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">{log.targetType}</span>
                        )}
                      </div>
                      {log.targetName && (
                        <p className="text-sm text-muted-foreground">Target: {log.targetName}</p>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {JSON.stringify(log.details).slice(0, 100)}
                          {JSON.stringify(log.details).length > 100 && '...'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        by {log.actorName || log.actorEmail || log.actorId} · {new Date(log.timestamp).toLocaleString()}
                        {log.ipAddress && <span className="ml-2">({log.ipAddress})</span>}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowInviteModal(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-background rounded-lg shadow-xl">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Invite User</h2>
                <p className="text-sm text-muted-foreground">
                  Send an invitation to join {tenant.name}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input
                      type="text"
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <select
                    value={inviteForm.roleKey}
                    onChange={(e) => setInviteForm({ ...inviteForm, roleKey: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteUser}
                  disabled={!inviteForm.email}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
