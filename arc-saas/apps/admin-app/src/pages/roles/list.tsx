import React, { useState } from "react";
import { useList, useCreate, useUpdate, useDelete, useCustom, useCustomMutation } from "@refinedev/core";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  Lock,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Cloud,
  CloudOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  key: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
  userCount?: number;
  createdAt: string;
}

interface Permission {
  key: string;
  name: string;
  description: string;
  category: string;
}

interface KeycloakRole {
  id?: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
}

interface KeycloakStatus {
  connected: boolean;
  url: string;
  error?: string;
}

// Permission categories and definitions
const PERMISSION_CATEGORIES = [
  {
    id: "tenants",
    name: "Tenant Management",
    permissions: [
      { key: "ViewTenant", name: "View Tenants", description: "View tenant list and details" },
      { key: "CreateTenant", name: "Create Tenants", description: "Create new tenants" },
      { key: "UpdateTenant", name: "Update Tenants", description: "Edit tenant information" },
      { key: "DeleteTenant", name: "Delete Tenants", description: "Delete or deactivate tenants" },
      { key: "ProvisionTenant", name: "Provision Tenants", description: "Trigger tenant provisioning" },
    ],
  },
  {
    id: "users",
    name: "User Management",
    permissions: [
      { key: "ViewUser", name: "View Users", description: "View user list and profiles" },
      { key: "CreateUser", name: "Create Users", description: "Create new users" },
      { key: "UpdateUser", name: "Update Users", description: "Edit user information" },
      { key: "DeleteUser", name: "Delete Users", description: "Delete or disable users" },
    ],
  },
  {
    id: "invitations",
    name: "Invitations",
    permissions: [
      { key: "ViewInvitation", name: "View Invitations", description: "View invitation list" },
      { key: "CreateInvitation", name: "Create Invitations", description: "Send new invitations" },
      { key: "ResendInvitation", name: "Resend Invitations", description: "Resend pending invitations" },
      { key: "RevokeInvitation", name: "Revoke Invitations", description: "Cancel pending invitations" },
    ],
  },
  {
    id: "subscriptions",
    name: "Subscriptions & Billing",
    permissions: [
      { key: "ViewSubscription", name: "View Subscriptions", description: "View subscription details" },
      { key: "CreateSubscription", name: "Create Subscriptions", description: "Create new subscriptions" },
      { key: "UpdateSubscription", name: "Update Subscriptions", description: "Modify subscriptions" },
      { key: "DeleteSubscription", name: "Delete Subscriptions", description: "Cancel subscriptions" },
      { key: "ViewBillingInvoice", name: "View Invoices", description: "View billing invoices" },
    ],
  },
  {
    id: "plans",
    name: "Plans",
    permissions: [
      { key: "ViewPlan", name: "View Plans", description: "View available plans" },
      { key: "CreatePlan", name: "Create Plans", description: "Create new plans" },
      { key: "UpdatePlan", name: "Update Plans", description: "Modify plan details" },
      { key: "DeletePlan", name: "Delete Plans", description: "Remove plans" },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    permissions: [
      { key: "ViewSettings", name: "View Settings", description: "View system settings" },
      { key: "UpdateSettings", name: "Update Settings", description: "Modify system settings" },
      { key: "ViewAuditLogs", name: "View Audit Logs", description: "Access audit trail" },
    ],
  },
];

// System role keys (used for identifying system-managed roles from API)
const SYSTEM_ROLE_KEYS = ["super_admin", "owner", "admin", "engineer", "analyst"];

export function RoleList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    PERMISSION_CATEGORIES.map(c => c.id)
  );
  const [roleForm, setRoleForm] = useState({
    name: "",
    key: "",
    description: "",
    permissions: [] as string[],
  });
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch roles from API, fall back to defaults if no data
  const { data, isLoading, refetch } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 100 },
  });
  const { mutate: createRole } = useCreate();
  const { mutate: updateRole } = useUpdate();
  const { mutate: deleteRole } = useDelete();

  // Keycloak integration hooks
  const { data: keycloakStatus, isLoading: statusLoading, refetch: refetchStatus } = useCustom<KeycloakStatus>({
    url: "/keycloak/status",
    method: "get",
  });

  const { data: keycloakRoles, isLoading: kcRolesLoading, refetch: refetchKcRoles } = useCustom<KeycloakRole[]>({
    url: "/keycloak/roles",
    method: "get",
  });

  const { mutate: syncRoleToKeycloak, isLoading: syncLoading } = useCustomMutation();
  const [syncingRoleKey, setSyncingRoleKey] = useState<string | null>(null);

  // Use API data only - mark system roles based on key
  const roles = (data?.data ?? []).map(role => ({
    ...role,
    isSystem: SYSTEM_ROLE_KEYS.includes(role.key),
  }));

  // Get Keycloak status info
  const kcStatus = keycloakStatus?.data as KeycloakStatus | undefined;
  const kcRolesList = (keycloakRoles?.data as KeycloakRole[] | undefined) || [];

  // Check if a role exists in Keycloak
  const isRoleInKeycloak = (roleKey: string): boolean => {
    return kcRolesList.some(r => r.name === roleKey);
  };

  // Sync a role to Keycloak
  const handleSyncToKeycloak = (role: Role) => {
    setSyncingRoleKey(role.key);
    setSyncError(null); // Clear previous error
    syncRoleToKeycloak(
      {
        url: "/keycloak/roles/sync",
        method: "post",
        values: {
          key: role.key,
          name: role.name,
          description: role.description,
        },
      },
      {
        onSuccess: () => {
          refetchKcRoles();
          setSyncingRoleKey(null);
          setSyncError(null);
        },
        onError: (error) => {
          setSyncingRoleKey(null);
          const errorMessage = (error as { message?: string })?.message;
          setSyncError(
            errorMessage || `Failed to sync role '${role.name}' to Keycloak. Please check the server logs.`
          );
        },
      }
    );
  };

  // Clear sync error after timeout
  React.useEffect(() => {
    if (syncError) {
      const timer = setTimeout(() => setSyncError(null), 10000); // Auto-clear after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [syncError]);

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const togglePermission = (permissionKey: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  const toggleAllInCategory = (categoryId: string) => {
    const category = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    const categoryPermissions = category.permissions.map((p) => p.key);
    const allSelected = categoryPermissions.every((p) =>
      roleForm.permissions.includes(p)
    );

    setRoleForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !categoryPermissions.includes(p))
        : [...new Set([...prev.permissions, ...categoryPermissions])],
    }));
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      key: role.key,
      description: role.description || "",
      permissions: [...role.permissions],
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingRole(null);
    setRoleForm({ name: "", key: "", description: "", permissions: [] });
  };

  const handleSave = () => {
    const roleData = {
      name: roleForm.name,
      key: roleForm.key,
      description: roleForm.description,
      permissions: roleForm.permissions,
    };

    if (editingRole) {
      updateRole(
        {
          resource: "roles",
          id: editingRole.id,
          values: roleData,
        },
        {
          onSuccess: () => {
            refetch();
            closeModal();
          },
          onError: () => {
            // Error displayed by Refine's notification provider
          },
        }
      );
    } else {
      createRole(
        {
          resource: "roles",
          values: roleData,
        },
        {
          onSuccess: () => {
            refetch();
            closeModal();
          },
          onError: () => {
            // Error displayed by Refine's notification provider
          },
        }
      );
    }
  };

  const handleDeleteRole = (roleId: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      deleteRole(
        {
          resource: "roles",
          id: roleId,
        },
        {
          onSuccess: () => {
            refetch();
          },
          onError: () => {
            // Error displayed by Refine's notification provider
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage user roles and their permission sets
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Keycloak Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : kcStatus?.connected ? (
              <Cloud className="h-4 w-4 text-green-500" />
            ) : (
              <CloudOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">
              {statusLoading
                ? "Checking..."
                : kcStatus?.connected
                ? "Keycloak Connected"
                : "Keycloak Disconnected"}
            </span>
            <button
              onClick={() => {
                refetchStatus();
                refetchKcRoles();
              }}
              className="p-1 rounded hover:bg-muted"
              title="Refresh Keycloak status"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search roles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
        />
      </div>

      {/* Sync Error Alert */}
      {syncError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Keycloak Sync Failed</p>
              <p className="text-sm text-red-600 dark:text-red-300">{syncError}</p>
            </div>
          </div>
          <button
            onClick={() => setSyncError(null)}
            className="flex-shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-800"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/2 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded w-5/6" />
              </div>
            </div>
          ))
        ) : filteredRoles.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No roles found.
          </div>
        ) : (
          filteredRoles.map((role) => (
            <div key={role.id} className="rounded-lg border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{role.name}</h3>
                    <code className="text-xs bg-muted px-1 rounded">{role.key}</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role.isSystem && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      System
                    </span>
                  )}
                  {/* Keycloak sync status */}
                  {kcStatus?.connected && (
                    isRoleInKeycloak(role.key) ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <Cloud className="h-3 w-3" />
                        Synced
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSyncToKeycloak(role)}
                        disabled={syncingRoleKey === role.key}
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-orange-200"
                        title="Click to sync this role to Keycloak"
                      >
                        {syncingRoleKey === role.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Sync to Keycloak
                      </button>
                    )
                  )}
                </div>
              </div>

              {role.description && (
                <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  <span>{role.permissions.length} permissions</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{role.userCount || 0} users</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(role)}
                  disabled={role.isSystem}
                  className={cn(
                    "flex-1 inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted",
                    role.isSystem && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  disabled={role.isSystem}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10",
                    role.isSystem && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Permission Matrix */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Overview of permissions assigned to each role
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase"
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {PERMISSION_CATEGORIES.map((category) => (
                <React.Fragment key={category.id}>
                  <tr className="bg-muted/50">
                    <td colSpan={roles.length + 1} className="px-6 py-2 font-medium text-sm">
                      {category.name}
                    </td>
                  </tr>
                  {category.permissions.map((permission) => (
                    <tr key={permission.key}>
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                      </td>
                      {roles.map((role) => (
                        <td key={`${role.id}-${permission.key}`} className="px-4 py-3 text-center">
                          {role.permissions.includes(permission.key) ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-300 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keycloak Roles Section */}
      {kcStatus?.connected && (
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Keycloak Realm Roles
                </h2>
                <p className="text-sm text-muted-foreground">
                  Roles defined in your Keycloak realm
                </p>
              </div>
              <button
                onClick={() => refetchKcRoles()}
                disabled={kcRolesLoading}
                className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {kcRolesLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
          <div className="p-6">
            {kcRolesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : kcRolesList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No roles found in Keycloak realm
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {kcRolesList.map((kcRole) => {
                  const platformRole = roles.find(r => r.key === kcRole.name);
                  return (
                    <div
                      key={kcRole.id || kcRole.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{kcRole.name}</p>
                          {kcRole.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {kcRole.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {platformRole ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Linked
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          Keycloak Only
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRole) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-background rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">
                  {editingRole ? "Edit Role" : "Create Role"}
                </h2>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role Name</label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) =>
                        setRoleForm({ ...roleForm, name: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="e.g., Editor"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role Key</label>
                    <input
                      type="text"
                      value={roleForm.key}
                      onChange={(e) =>
                        setRoleForm({
                          ...roleForm,
                          key: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder="e.g., editor"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, description: e.target.value })
                    }
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Brief description of this role..."
                  />
                </div>

                {/* Permissions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Permissions ({roleForm.permissions.length} selected)
                  </label>
                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                    {PERMISSION_CATEGORIES.map((category) => {
                      const isExpanded = expandedCategories.includes(category.id);
                      const categoryPermissions = category.permissions.map((p) => p.key);
                      const selectedInCategory = categoryPermissions.filter((p) =>
                        roleForm.permissions.includes(p)
                      ).length;
                      const allSelected =
                        selectedInCategory === categoryPermissions.length;

                      return (
                        <div key={category.id}>
                          <button
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">{category.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({selectedInCategory}/{categoryPermissions.length})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAllInCategory(category.id);
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              {allSelected ? "Deselect All" : "Select All"}
                            </button>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-2">
                              {category.permissions.map((permission) => (
                                <label
                                  key={permission.key}
                                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permissions.includes(permission.key)}
                                    onChange={() => togglePermission(permission.key)}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <div>
                                    <p className="text-sm font-medium">{permission.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {permission.description}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!roleForm.name || !roleForm.key}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingRole ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
