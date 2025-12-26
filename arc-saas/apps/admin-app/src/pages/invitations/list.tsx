import { useList, useCreate, useUpdate, useDelete } from "@refinedev/core";
import { Plus, Mail, Clock, CheckCircle, XCircle, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserInvitation {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleKey: string;
  tenantId: string;
  status: number; // 0: Pending, 1: Accepted, 2: Expired, 3: Revoked
  expiresAt: string;
  acceptedAt?: string;
  invitedBy: string;
  createdOn: string;
}

const statusMap: Record<number, { label: string; color: string; icon: typeof Clock }> = {
  0: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  1: { label: "Accepted", color: "bg-green-100 text-green-700", icon: CheckCircle },
  2: { label: "Expired", color: "bg-gray-100 text-gray-700", icon: Clock },
  3: { label: "Revoked", color: "bg-red-100 text-red-700", icon: XCircle },
};

export function InvitationList() {
  const { data, isLoading, refetch } = useList<UserInvitation>({ resource: "user-invitations" });
  const { mutate: createInvitation } = useCreate();
  const { mutate: resendInvitation, isLoading: isResending } = useUpdate();
  const { mutate: deleteInvitation } = useDelete();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    roleKey: "member",
  });

  const getStatusInfo = (status: number) => {
    return statusMap[status] || { label: "Unknown", color: "bg-gray-100 text-gray-700", icon: Clock };
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createInvitation({
      resource: "user-invitations",
      values: formData,
    }, {
      onSuccess: () => {
        setShowCreateModal(false);
        setFormData({ email: "", firstName: "", lastName: "", roleKey: "member" });
        refetch();
      },
    });
  };

  const handleResend = (id: string) => {
    resendInvitation({
      resource: "user-invitations",
      id,
      values: {},
      meta: { method: "post", url: `/user-invitations/${id}/resend` },
    });
    setActionMenuOpen(null);
  };

  const handleRevoke = (id: string) => {
    if (confirm("Are you sure you want to revoke this invitation?")) {
      deleteInvitation({
        resource: "user-invitations",
        id,
      });
    }
    setActionMenuOpen(null);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Invitations</h1>
          <p className="text-muted-foreground">
            Manage pending and sent user invitations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Invitations", value: data?.data?.length || 0, color: "text-blue-600" },
          { label: "Pending", value: data?.data?.filter(i => i.status === 0).length || 0, color: "text-yellow-600" },
          { label: "Accepted", value: data?.data?.filter(i => i.status === 1).length || 0, color: "text-green-600" },
          { label: "Expired/Revoked", value: data?.data?.filter(i => i.status >= 2).length || 0, color: "text-gray-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Invitations Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invitee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No invitations sent yet. Click "Invite User" to get started.
                  </td>
                </tr>
              ) : (
                data?.data?.map((invitation) => {
                  const statusInfo = getStatusInfo(invitation.status);
                  const StatusIcon = statusInfo.icon;
                  const expired = invitation.status === 0 && isExpired(invitation.expiresAt);

                  return (
                    <tr key={invitation.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-medium">
                              {invitation.firstName && invitation.lastName
                                ? `${invitation.firstName} ${invitation.lastName}`
                                : invitation.email}
                            </span>
                            <p className="text-xs text-muted-foreground">{invitation.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {invitation.roleKey}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                            expired ? "bg-gray-100 text-gray-700" : statusInfo.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {expired ? "Expired" : statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(invitation.createdOn).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {invitation.status === 0 && (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === invitation.id ? null : invitation.id)}
                              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {actionMenuOpen === invitation.id && (
                              <div className="absolute right-0 mt-2 w-40 rounded-md border bg-popover shadow-lg z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleResend(invitation.id)}
                                    disabled={isResending}
                                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Resend
                                  </button>
                                  <button
                                    onClick={() => handleRevoke(invitation.id)}
                                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Revoke
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-background rounded-lg shadow-xl">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Invite User</h2>
                <p className="text-sm text-muted-foreground">
                  Send an invitation email to a new user
                </p>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={formData.roleKey}
                    onChange={(e) => setFormData({ ...formData, roleKey: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
