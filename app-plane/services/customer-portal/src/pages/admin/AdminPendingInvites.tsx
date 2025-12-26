/**
 * AdminPendingInvites
 *
 * Pending invitations table with resend/cancel actions.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MailIcon from '@mui/icons-material/Mail';
import CancelIcon from '@mui/icons-material/Cancel';
import { formatRelativeTime, formatDateTime } from '../../utils/dateUtils';

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invited_at: string;
  invited_by: string;
  expires_at: string;
}

interface AdminPendingInvitesProps {
  invites: PendingInvite[];
  onResend: (id: string) => void;
  onCancel: (id: string) => void;
  onInviteNew?: () => void;
}

export function AdminPendingInvites({
  invites,
  onResend,
  onCancel,
  onInviteNew,
}: AdminPendingInvitesProps) {
  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Pending Invitations
          </Typography>
          {onInviteNew && (
            <Button
              variant="contained"
              startIcon={<PeopleIcon />}
              onClick={onInviteNew}
            >
              Invite Member
            </Button>
          )}
        </Box>

        {invites.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <MailIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No pending invitations</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Invited By</TableCell>
                  <TableCell>Invited</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Chip label={invite.role} size="small" />
                    </TableCell>
                    <TableCell>{invite.invited_by}</TableCell>
                    <TableCell>{formatRelativeTime(invite.invited_at)}</TableCell>
                    <TableCell>{formatDateTime(invite.expires_at)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Resend Invite">
                        <IconButton size="small" onClick={() => onResend(invite.id)}>
                          <MailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancel Invite">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onCancel(invite.id)}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminPendingInvites;
