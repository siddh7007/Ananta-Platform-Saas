/**
 * Team Members Component
 * CBP-P2-005: Organization Management - Team Members Tab
 */

import { useState } from 'react';
import { useList, useDelete, useUpdate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MoreHorizontal,
  UserMinus,
  Shield,
  Mail,
  UserPlus,
  Crown,
} from 'lucide-react';
import { InviteUserDialog } from './InviteUserDialog';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { formatDistanceToNow } from 'date-fns';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  joinedAt: string;
  lastActive?: string;
}

interface TeamMembersProps {
  canManage?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  engineer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  analyst: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Mock data for development
const MOCK_MEMBERS: TeamMember[] = [
  {
    id: '1',
    email: 'owner@company.com',
    name: 'John Owner',
    role: 'owner',
    status: 'active',
    joinedAt: '2024-01-15T00:00:00Z',
    lastActive: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'admin@company.com',
    name: 'Jane Admin',
    role: 'admin',
    status: 'active',
    joinedAt: '2024-02-20T00:00:00Z',
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    email: 'engineer1@company.com',
    name: 'Bob Engineer',
    role: 'engineer',
    status: 'active',
    joinedAt: '2024-03-10T00:00:00Z',
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    email: 'analyst@company.com',
    name: 'Alice Analyst',
    role: 'analyst',
    status: 'active',
    joinedAt: '2024-04-05T00:00:00Z',
    lastActive: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function TeamMembers({ canManage = false }: TeamMembersProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<TeamMember | null>(null);
  const [removeUser, setRemoveUser] = useState<TeamMember | null>(null);

  // API integration - uncomment when ready
  // const { data, isLoading, refetch } = useList<TeamMember>({
  //   resource: 'team-members',
  //   sorters: [{ field: 'role', order: 'desc' }],
  // });
  // const { mutate: deleteMember, isLoading: isDeleting } = useDelete();

  // Mock data for development
  const isLoading = false;
  const isDeleting = false;
  const members = MOCK_MEMBERS;
  const refetch = () => {};

  const handleRemoveMember = () => {
    if (!removeUser) return;

    // API call
    // deleteMember(
    //   { resource: 'team-members', id: removeUser.id },
    //   { onSuccess: () => { setRemoveUser(null); refetch(); } }
    // );

    // Mock - just close dialog
    setRemoveUser(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? 's' : ''} in your organization
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                {canManage && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar} alt="" />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.name}</p>
                          {member.role === 'owner' && (
                            <Crown
                              className="h-4 w-4 text-amber-500"
                              aria-label="Organization owner"
                            />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[member.role] || ''}>
                      {ROLE_LABELS[member.role] || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === 'active' ? 'default' : 'secondary'}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.lastActive
                      ? formatDistanceToNow(new Date(member.lastActive), {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={member.role === 'owner'}
                            aria-label="Member actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setChangeRoleUser(member)}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Invite
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setRemoveUser(member)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={() => {
          setInviteDialogOpen(false);
          refetch();
        }}
      />

      {/* Change Role Dialog */}
      {changeRoleUser && (
        <ChangeRoleDialog
          open={!!changeRoleUser}
          onOpenChange={() => setChangeRoleUser(null)}
          member={changeRoleUser}
          onSuccess={() => {
            setChangeRoleUser(null);
            refetch();
          }}
        />
      )}

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeUser} onOpenChange={() => setRemoveUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{removeUser?.name}</strong> from the organization?
              They will lose access to all resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TeamMembers;
