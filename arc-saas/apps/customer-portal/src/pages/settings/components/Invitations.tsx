/**
 * Invitations Component
 * CBP-P2-005: Organization Management - Invitations Tab
 */

import { useState } from 'react';
import { useList, useDelete, useCreate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Mail,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  UserPlus,
} from 'lucide-react';
import { InviteUserDialog } from './InviteUserDialog';
import { useToast } from '@/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    id: string;
    name: string;
  };
}

interface InvitationsProps {
  canManage?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// Mock data for development
const MOCK_INVITATIONS: Invitation[] = [
  {
    id: '1',
    email: 'newengineer@company.com',
    role: 'engineer',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: { id: '1', name: 'John Owner' },
  },
  {
    id: '2',
    email: 'analyst2@company.com',
    role: 'analyst',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: { id: '2', name: 'Jane Admin' },
  },
  {
    id: '3',
    email: 'olduser@company.com',
    role: 'engineer',
    status: 'expired',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: { id: '1', name: 'John Owner' },
  },
];

export function Invitations({ canManage = false }: InvitationsProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteInvitation, setDeleteInvitation] = useState<Invitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  // API integration - uncomment when ready
  // const { data, isLoading, refetch } = useList<Invitation>({
  //   resource: 'invitations',
  //   sorters: [{ field: 'createdAt', order: 'desc' }],
  // });

  // Mock data for development
  const isLoading = false;
  const invitations = MOCK_INVITATIONS;
  const refetch = () => {};

  const handleCopyLink = (invitation: Invitation) => {
    const link = `${window.location.origin}/accept-invite?token=${invitation.id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(invitation.id);
    success('Link copied', 'Invitation link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResendInvite = async (invitation: Invitation) => {
    // API call to resend
    success('Invitation resent', `Resent invitation to ${invitation.email}`);
  };

  const handleRevokeInvite = () => {
    if (!deleteInvitation) return;
    // API call to revoke
    setDeleteInvitation(null);
    success('Invitation revoked', `Invitation to ${deleteInvitation.email} has been revoked`);
  };

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
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
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              {pendingCount} pending invitation{pendingCount !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Send Invite
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-4 text-muted-foreground">No invitations yet</p>
              {canManage && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  Send your first invitation
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Expires</TableHead>
                  {canManage && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[invitation.role] || invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[invitation.status]}>
                        {invitation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.invitedBy.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.status === 'pending'
                        ? formatDistanceToNow(new Date(invitation.expiresAt), {
                            addSuffix: true,
                          })
                        : '-'}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Invitation actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {invitation.status === 'pending' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleCopyLink(invitation)}
                                >
                                  {copiedId === invitation.id ? (
                                    <Check className="h-4 w-4 mr-2" />
                                  ) : (
                                    <Copy className="h-4 w-4 mr-2" />
                                  )}
                                  Copy Link
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(invitation)}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Resend Invite
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => setDeleteInvitation(invitation)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {invitation.status === 'pending' ? 'Revoke' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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

      {/* Revoke/Delete Confirmation */}
      <AlertDialog
        open={!!deleteInvitation}
        onOpenChange={() => setDeleteInvitation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteInvitation?.status === 'pending'
                ? 'Revoke Invitation'
                : 'Delete Invitation'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteInvitation?.status === 'pending'
                ? `This will revoke the invitation to ${deleteInvitation?.email}. They will no longer be able to join the organization.`
                : `This will remove the invitation record for ${deleteInvitation?.email}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvitation?.status === 'pending' ? 'Revoke' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default Invitations;
