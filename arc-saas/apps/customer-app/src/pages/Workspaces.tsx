/**
 * Team Management Page
 *
 * This page was originally designed as "Workspaces" but has been repurposed
 * to show Team Members since the backend (tenant-management-service) doesn't
 * have a workspaces concept. Instead, it uses /tenant-users endpoints.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, MoreHorizontal, Mail, Shield, Loader2, UserPlus } from "lucide-react";
import { useTenant } from "../lib/tenant-context";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  createdAt?: string;
}

interface UserInvitation {
  id: string;
  email: string;
  role?: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
}

interface InviteUserInput {
  email: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Full access to all features" },
  { value: "member", label: "Member", description: "Standard access" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

export default function Workspaces() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newInvite, setNewInvite] = useState<InviteUserInput>({
    email: "",
    role: "member",
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => api.get<TenantUser[]>("/tenant-users"),
  });

  // Fetch pending invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ["user-invitations"],
    queryFn: () => api.get<UserInvitation[]>("/user-invitations"),
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: (data: InviteUserInput) => api.post<UserInvitation>("/user-invitations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
      setIsInviteOpen(false);
      setNewInvite({ email: "", role: "member" });
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/user-invitations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const handleInviteUser = () => {
    if (!newInvite.email.trim()) return;
    inviteMutation.mutate(newInvite);
  };

  const handleCancelInvitation = (id: string) => {
    if (confirm("Are you sure you want to cancel this invitation?")) {
      deleteInvitationMutation.mutate(id);
    }
  };

  const isLoading = membersLoading || invitationsLoading;
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            Manage team members for {tenant?.name}
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={newInvite.email}
                  onChange={(e) =>
                    setNewInvite({ ...newInvite, email: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newInvite.role}
                  onValueChange={(value) => setNewInvite({ ...newInvite, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInviteUser}
                disabled={!newInvite.email.trim() || inviteMutation.isPending}
              >
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48 mt-2" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {membersError && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive mb-4">Failed to load team members</p>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["tenant-users"] })}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {!isLoading && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-amber-50/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Invited as {invitation.role || 'member'}
                        {invitation.expiresAt && ` • Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-amber-600">
                      Pending
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      {!isLoading && !membersError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'} in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Invite your first team member to start collaborating.
                </p>
                <Button onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-medium text-primary">
                          {(member.firstName?.[0] || member.email[0]).toUpperCase()}
                          {(member.lastName?.[0] || '').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {member.role || 'Member'}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>Change Role</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Remove from Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
