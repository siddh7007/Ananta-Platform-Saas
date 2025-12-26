import { useShow, useNavigation, useUpdate, useList, useCreate, useDelete } from "@refinedev/core";
import { useParams } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  Clock,
  Ban,
  CheckCircle,
  Building2,
  Key,
  Activity,
  Plus,
  Trash2,
  X,
  Loader2,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserIdentityPanel } from "@/components/user-identity";

// Available roles that can be assigned to users
const AVAILABLE_ROLES = [
  { key: "super-admin", label: "Super Admin", description: "Full system access" },
  { key: "admin", label: "Admin", description: "Administrative access" },
  { key: "manager", label: "Manager", description: "Team management access" },
  { key: "member", label: "Member", description: "Standard user access" },
  { key: "viewer", label: "Viewer", description: "Read-only access" },
];

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  status: number;
  tenantId: string;
  authId?: string;
  phone?: string;
  lastLogin?: string;
  createdOn: string;
  modifiedOn?: string;
}

interface UserRole {
  id: string;
  userId: string;
  roleKey: string;
  tenantId?: string;
  scopeType: "tenant" | "workspace" | "project";
  scopeId?: string;
  permissions?: string[];
  createdOn: string;
  modifiedOn?: string;
}

const statusMap: Record<number, { label: string; color: string; bgColor: string }> = {
  0: { label: "Pending", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  1: { label: "Active", color: "text-green-700", bgColor: "bg-green-100" },
  2: { label: "Suspended", color: "text-red-700", bgColor: "bg-red-100" },
  3: { label: "Deactivated", color: "text-gray-700", bgColor: "bg-gray-100" },
};

type ActiveTab = 'profile' | 'identity';

export function UserShow() {
  const { id } = useParams();
  const { list } = useNavigation();
  const { queryResult } = useShow<User>({ resource: "users", id });
  const { mutate: updateUser, isLoading: isUpdating } = useUpdate();

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');

  // Role management state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  // Fetch user roles
  const { data: rolesData, isLoading: isLoadingRoles, refetch: refetchRoles } = useList<UserRole>({
    resource: "user-roles",
    filters: [{ field: "userId", operator: "eq", value: id || "" }],
    queryOptions: {
      enabled: !!id,
    },
  });

  // Create role mutation
  const { mutate: createRole, isLoading: isCreatingRole } = useCreate();

  // Delete role mutation
  const { mutate: deleteRole, isLoading: isDeletingRole } = useDelete();

  const user = queryResult?.data?.data;
  const isLoading = queryResult?.isLoading;
  const userRoles = rolesData?.data || [];

  const getStatusInfo = (status: number) => {
    return statusMap[status] || { label: "Unknown", color: "text-gray-700", bgColor: "bg-gray-100" };
  };

  const handleSuspend = () => {
    if (user && confirm("Are you sure you want to suspend this user?")) {
      updateUser({
        resource: "users",
        id: user.id,
        values: { status: 2 },
      });
    }
  };

  const handleActivate = () => {
    if (user) {
      updateUser({
        resource: "users",
        id: user.id,
        values: { status: 1 },
      });
    }
  };

  const handleAssignRole = () => {
    if (!user || !selectedRole) return;

    createRole(
      {
        resource: "user-roles",
        values: {
          userId: user.id,
          roleKey: selectedRole,
          tenantId: user.tenantId,
          scopeType: "tenant",
        },
      },
      {
        onSuccess: () => {
          setIsRoleModalOpen(false);
          setSelectedRole("");
          refetchRoles();
        },
        onError: () => {
          alert("Failed to assign role. Please try again.");
        },
      }
    );
  };

  const handleRevokeRole = (roleId: string, roleKey: string) => {
    if (!confirm(`Are you sure you want to revoke the "${roleKey}" role from this user?`)) {
      return;
    }

    deleteRole(
      {
        resource: "user-roles",
        id: roleId,
      },
      {
        onSuccess: () => {
          refetchRoles();
        },
        onError: () => {
          alert("Failed to revoke role. Please try again.");
        },
      }
    );
  };

  const handleRefresh = () => {
    queryResult?.refetch?.();
    refetchRoles();
  };

  // Get roles that can still be assigned (not already assigned)
  const assignedRoleKeys = userRoles.map((r) => r.roleKey);
  const availableRolesForAssignment = AVAILABLE_ROLES.filter(
    (r) => !assignedRoleKeys.includes(r.key)
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo(user.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => list("users")}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-medium">
              {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {user.status === 1 ? (
            <button
              onClick={handleSuspend}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend User
            </button>
          ) : user.status === 2 ? (
            <button
              onClick={handleActivate}
              disabled={isUpdating}
              className="inline-flex items-center justify-center rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate User
            </button>
          ) : null}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'profile'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            <Activity className="h-4 w-4" />
            Profile & Roles
          </button>
          <button
            onClick={() => setActiveTab('identity')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'identity'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            <Fingerprint className="h-4 w-4" />
            Identity & Security
          </button>
        </nav>
      </div>

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* User Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">User Information</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">First Name</label>
                    <p className="font-medium">{user.firstName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Last Name</label>
                    <p className="font-medium">{user.lastName || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {user.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Username</label>
                    <p className="font-medium">{user.username || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <p className="font-medium">{user.phone || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <p>
                      <span className={cn("inline-flex px-2 py-1 text-xs font-medium rounded-full", statusInfo.bgColor, statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Details Card */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Account Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Tenant ID
                    </label>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{user.tenantId}</code>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Auth ID (IdP)
                    </label>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{user.authId || "Not linked"}</code>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created
                    </label>
                    <p className="font-medium">
                      {new Date(user.createdOn).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last Login
                    </label>
                    <p className="font-medium">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Roles Card */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Roles & Permissions
                </h2>
                <button
                  onClick={() => setIsRoleModalOpen(true)}
                  disabled={availableRolesForAssignment.length === 0}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assign Role
                </button>
              </div>
              <div className="p-6">
                {isLoadingRoles ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : userRoles.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No roles assigned to this user.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {userRoles.map((role) => {
                      const roleInfo = AVAILABLE_ROLES.find((r) => r.key === role.roleKey);
                      return (
                        <div
                          key={role.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <div className="font-medium">
                              {roleInfo?.label || role.roleKey}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {roleInfo?.description || `Scope: ${role.scopeType}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Assigned: {new Date(role.createdOn).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeRole(role.id, role.roleKey)}
                            disabled={isDeletingRole}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-md"
                            title="Revoke role"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Role Assignment Modal */}
            {isRoleModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4">
                  <div className="p-6 border-b flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Assign Role</h3>
                    <button
                      onClick={() => {
                        setIsRoleModalOpen(false);
                        setSelectedRole("");
                      }}
                      className="p-2 hover:bg-muted rounded-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Select Role
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                      >
                        <option value="">Select a role...</option>
                        {availableRolesForAssignment.map((role) => (
                          <option key={role.key} value={role.key}>
                            {role.label} - {role.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Scope: Tenant-level access
                    </div>
                  </div>
                  <div className="p-6 border-t flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsRoleModalOpen(false);
                        setSelectedRole("");
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignRole}
                      disabled={!selectedRole || isCreatingRole}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isCreatingRole ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                          Assigning...
                        </>
                      ) : (
                        "Assign Role"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Quick Stats
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Roles Assigned</span>
                  <span className="font-medium">{userRoles.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Account Age</span>
                  <span className="font-medium">
                    {Math.floor((Date.now() - new Date(user.createdOn).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">IdP Linked</span>
                  <span className={cn(
                    "font-medium",
                    user.authId ? "text-green-600" : "text-yellow-600"
                  )}>
                    {user.authId ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Navigation */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Quick Actions</h2>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('identity')}
                  className="w-full inline-flex items-center justify-start rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Manage Sessions
                </button>
                <button
                  onClick={() => setActiveTab('identity')}
                  className="w-full inline-flex items-center justify-start rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  View MFA Status
                </button>
                <button
                  onClick={() => setActiveTab('identity')}
                  className="w-full inline-flex items-center justify-start rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Identity Tab Content */}
      {activeTab === 'identity' && (
        <UserIdentityPanel
          userId={user.id}
          userEmail={user.email}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
