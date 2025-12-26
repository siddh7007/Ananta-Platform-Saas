import { useList, useNavigation, useDelete, useCustomMutation } from "@refinedev/core";
import { Plus, Eye, MoreHorizontal, UserPlus, Ban, CheckCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  status: number; // 0: Pending, 1: Active, 2: Suspended, 3: Deactivated
  tenantId: string;
  authId?: string;
  lastLogin?: string;
  createdOn: string;
}

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  1: { label: "Active", color: "bg-green-100 text-green-700" },
  2: { label: "Suspended", color: "bg-red-100 text-red-700" },
  3: { label: "Deactivated", color: "bg-gray-100 text-gray-700" },
};

export function UserList() {
  const { data, isLoading, refetch } = useList<User>({ resource: "users" });
  const { show, create } = useNavigation();
  const { mutate: deleteUser } = useDelete();
  const { mutate: customMutate } = useCustomMutation();
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const getStatusInfo = (status: number) => {
    return statusMap[status] || { label: "Unknown", color: "bg-gray-100 text-gray-700" };
  };

  const handleSuspend = async (userId: string) => {
    customMutate({
      url: `users/${userId}/suspend`,
      method: "post",
      values: {},
    }, {
      onSuccess: () => {
        refetch();
      },
      onError: () => {
        // Error displayed by Refine's notification provider
      },
    });
    setActionMenuOpen(null);
  };

  const handleActivate = (userId: string) => {
    customMutate({
      url: `users/${userId}/activate`,
      method: "post",
      values: {},
    }, {
      onSuccess: () => {
        refetch();
      },
      onError: () => {
        // Error displayed by Refine's notification provider
      },
    });
    setActionMenuOpen(null);
  };

  const handleDelete = async (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUser({
        resource: "users",
        id: userId,
      });
    }
    setActionMenuOpen(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage platform users and their roles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => create("user-invitations")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </button>
          <button
            onClick={() => create("users")}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
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
                    No users found. Invite users to get started.
                  </td>
                </tr>
              ) : (
                data?.data?.map((user) => {
                  const statusInfo = getStatusInfo(user.status);
                  return (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                            {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">
                              {user.firstName} {user.lastName}
                            </span>
                            {user.username && (
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                            statusInfo.color
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : "Never"
                        }
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(user.createdOn).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionMenuOpen === user.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover shadow-lg z-10">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    show("users", user.id);
                                    setActionMenuOpen(null);
                                  }}
                                  className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </button>
                                {user.status === 1 ? (
                                  <button
                                    onClick={() => handleSuspend(user.id)}
                                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted text-orange-600"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Suspend User
                                  </button>
                                ) : user.status === 2 ? (
                                  <button
                                    onClick={() => handleActivate(user.id)}
                                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted text-green-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Activate User
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
