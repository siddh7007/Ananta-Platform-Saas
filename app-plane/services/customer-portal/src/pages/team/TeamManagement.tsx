/**
 * Team Management Page
 *
 * P3-5: Team management page with users table and invite form.
 * Allows admins to manage team members, send invitations, and update roles.
 *
 * Features:
 * - Team members table with avatar, role, status, last login
 * - Invite new members form with email and role selection
 * - Pending invitations list with resend/cancel actions
 * - Role management (admin+ only)
 * - Member removal (admin+ only)
 *
 * @module pages/team/TeamManagement
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Skeleton,
  Tooltip,
  Divider,
  Grid,
  InputAdornment,
  Menu,
} from '@mui/material';
import { usePermissions } from 'react-admin';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import MailIcon from '@mui/icons-material/Mail';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SearchIcon from '@mui/icons-material/Search';

import { useTeamMembers } from '../../hooks/useTeamMembers';
import {
  TeamMember,
  TeamInvitation,
  TeamRole,
  ROLE_CONFIG,
} from '../../services/teamService';
import { AccessibleField, AccessibleForm } from '../../components/ui';

export interface TeamManagementProps {
  /** Custom title */
  title?: string;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString();
}

/**
 * Get user initials for avatar
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Get role badge color
 */
function getRoleBadgeColor(role: TeamRole): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  return ROLE_CONFIG[role]?.color || 'default';
}

/**
 * Team Management Page Component
 */
export const TeamManagement: React.FC<TeamManagementProps> = ({
  title = 'Team',
  'data-testid': testId,
}) => {
  const { permissions } = usePermissions();

  // Check admin permissions
  const roleIsAdmin = ['owner', 'admin', 'super_admin'].includes(permissions as string);
  const flagIsAdmin = localStorage.getItem('is_admin') === 'true';
  const isAdmin = roleIsAdmin || flagIsAdmin;

  // Team data hook
  const {
    members,
    invitations,
    stats,
    isLoading,
    isInviting,
    isUpdating,
    error,
    refresh,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    updateMemberRole,
    removeMember,
  } = useTeamMembers();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('engineer');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // H2 Fix: Debounce search input
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  // Dialog states
  const [roleEditDialog, setRoleEditDialog] = useState<{
    open: boolean;
    member: TeamMember | null;
    newRole: TeamRole;
  }>({ open: false, member: null, newRole: 'analyst' });

  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    member: TeamMember | null;
  }>({ open: false, member: null });

  const [revokeDialog, setRevokeDialog] = useState<{
    open: boolean;
    invitation: TeamInvitation | null;
  }>({ open: false, invitation: null });

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{
    element: HTMLElement | null;
    memberId: string | null;
  }>({ element: null, memberId: null });

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Filter members by search query (using debounced value for performance)
  const filteredMembers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return members;

    const query = debouncedSearchQuery.toLowerCase();
    return members.filter(
      (member) =>
        member.fullName.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
    );
  }, [members, debouncedSearchQuery]);

  // Pending invitations only
  const pendingInvitations = useMemo(() => {
    return invitations.filter((inv) => inv.status === 'pending');
  }, [invitations]);

  /**
   * Handle invite submission
   */
  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setInviteError(null);

    try {
      await inviteMember({
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteEmail('');
      setInviteRole('engineer');
      setSnackbar({
        open: true,
        message: `Invitation sent to ${inviteEmail}`,
        severity: 'success',
      });
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  }, [inviteEmail, inviteRole, inviteMember]);

  /**
   * Handle role update
   */
  const handleRoleUpdate = useCallback(async () => {
    if (!roleEditDialog.member) return;

    try {
      await updateMemberRole(roleEditDialog.member.id, roleEditDialog.newRole);
      setRoleEditDialog({ open: false, member: null, newRole: 'analyst' });
      setSnackbar({
        open: true,
        message: `Role updated for ${roleEditDialog.member.fullName}`,
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to update role',
        severity: 'error',
      });
    }
  }, [roleEditDialog, updateMemberRole]);

  /**
   * Handle member removal
   */
  const handleRemoveMember = useCallback(async () => {
    if (!removeDialog.member) return;

    try {
      await removeMember(removeDialog.member.id);
      setRemoveDialog({ open: false, member: null });
      setSnackbar({
        open: true,
        message: `${removeDialog.member.fullName} has been removed`,
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to remove member',
        severity: 'error',
      });
    }
  }, [removeDialog, removeMember]);

  /**
   * Handle invitation revoke
   */
  const handleRevokeInvitation = useCallback(async () => {
    if (!revokeDialog.invitation) return;

    try {
      await revokeInvitation(revokeDialog.invitation.id);
      setRevokeDialog({ open: false, invitation: null });
      setSnackbar({
        open: true,
        message: 'Invitation cancelled',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to cancel invitation',
        severity: 'error',
      });
    }
  }, [revokeDialog, revokeInvitation]);

  /**
   * Handle resend invitation
   */
  const handleResendInvitation = useCallback(async (invitation: TeamInvitation) => {
    try {
      await resendInvitation(invitation.id);
      setSnackbar({
        open: true,
        message: `Invitation resent to ${invitation.email}`,
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to resend invitation',
        severity: 'error',
      });
    }
  }, [resendInvitation]);

  // Loading skeleton
  if (isLoading && members.length === 0) {
    return (
      <Box sx={{ p: 3 }} data-testid={testId}>
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }} data-testid={testId}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your team members and invitations
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refresh()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* H1 Fix: Error Alert with aria-live for screen readers */}
      <Box aria-live="polite" aria-atomic="true">
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}} role="alert">
            {error}
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Invite Form & Stats */}
        <Grid item xs={12} md={4}>
          {/* Invite Form */}
          {isAdmin && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PersonAddIcon color="primary" />
                  <Typography variant="h6" id="invite-form-title">Invite Team Member</Typography>
                </Box>

                <AccessibleForm
                  ariaLabel="Invite team member form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleInvite();
                  }}
                  isSubmitting={isInviting}
                >
                  <AccessibleField
                    label="Email Address"
                    required
                    hint="Enter the email address of the person you want to invite"
                    error={inviteError || undefined}
                  >
                    <TextField
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        setInviteError(null);
                      }}
                      placeholder="colleague@company.com"
                      fullWidth
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <MailIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </AccessibleField>

                  <AccessibleField
                    label="Role"
                    required
                    hint="Select the role for the new team member"
                  >
                    <FormControl fullWidth size="small">
                      <Select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                        aria-label="Select role for team member"
                      >
                        {Object.entries(ROLE_CONFIG)
                          .filter(([key]) => key !== 'owner') // Can't invite owners
                          .map(([key, config]) => (
                            <MenuItem key={key} value={key}>
                              <Box>
                                <Typography variant="body2">{config.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {config.description}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </AccessibleField>

                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={isInviting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                    disabled={isInviting || !inviteEmail.trim()}
                    fullWidth
                    aria-busy={isInviting}
                  >
                    {isInviting ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </AccessibleForm>
              </CardContent>
            </Card>
          )}

          {/* Team Stats */}
          {stats && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team Overview
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <GroupIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight={600}>
                        {stats.totalMembers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Team Members
                      </Typography>
                    </Box>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      By Role
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {Object.entries(stats.roleDistribution).map(([role, count]) => (
                        <Chip
                          key={role}
                          label={`${ROLE_CONFIG[role as TeamRole]?.label}: ${count}`}
                          size="small"
                          color={getRoleBadgeColor(role as TeamRole)}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>

                  {stats.pendingInvitations > 0 && (
                    <>
                      <Divider />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon color="warning" fontSize="small" />
                        <Typography variant="body2">
                          {stats.pendingInvitations} pending invitation{stats.pendingInvitations !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Members Table & Invitations */}
        <Grid item xs={12} md={8}>
          {/* Members Table */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" id="team-members-table-title">Team Members</Typography>
                <TextField
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  sx={{ width: 250 }}
                  inputProps={{
                    'aria-label': 'Search team members by name, email, or role',
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-labelledby="team-members-table-title">
                  <TableHead>
                    <TableRow>
                      <TableCell>Member</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Active</TableCell>
                      {isAdmin && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              src={member.avatarUrl}
                              sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}
                            >
                              {getInitials(member.fullName)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {member.fullName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {member.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ROLE_CONFIG[member.role]?.label || member.role}
                            size="small"
                            color={getRoleBadgeColor(member.role)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={member.status}
                            size="small"
                            color={member.status === 'active' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(member.lastLoginAt)}
                          </Typography>
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(e) => setMenuAnchor({ element: e.currentTarget, memberId: member.id })}
                              disabled={member.role === 'owner'}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}

                    {filteredMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4} align="center" sx={{ py: 4 }}>
                          <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {debouncedSearchQuery ? 'No members match your search' : 'No team members yet'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTimeIcon color="warning" />
                  <Typography variant="h6">Pending Invitations</Typography>
                  <Chip label={pendingInvitations.length} size="small" color="warning" />
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Sent</TableCell>
                        <TableCell>Expires</TableCell>
                        {isAdmin && <TableCell align="right">Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={invitation.id} hover>
                          <TableCell>
                            <Typography variant="body2">{invitation.email}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={ROLE_CONFIG[invitation.role]?.label || invitation.role}
                              size="small"
                              color={getRoleBadgeColor(invitation.role)}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatRelativeTime(invitation.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          {isAdmin && (
                            <TableCell align="right">
                              <Tooltip title="Resend">
                                <IconButton
                                  size="small"
                                  onClick={() => handleResendInvitation(invitation)}
                                  disabled={isUpdating}
                                >
                                  <RefreshIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton
                                  size="small"
                                  onClick={() => setRevokeDialog({ open: true, invitation })}
                                  disabled={isUpdating}
                                  color="error"
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Member Actions Menu */}
      <Menu
        anchorEl={menuAnchor.element}
        open={Boolean(menuAnchor.element)}
        onClose={() => setMenuAnchor({ element: null, memberId: null })}
      >
        <MenuItem
          onClick={() => {
            const member = members.find((m) => m.id === menuAnchor.memberId);
            if (member) {
              setRoleEditDialog({ open: true, member, newRole: member.role });
            }
            setMenuAnchor({ element: null, memberId: null });
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Change Role
        </MenuItem>
        <MenuItem
          onClick={() => {
            const member = members.find((m) => m.id === menuAnchor.memberId);
            if (member) {
              setRemoveDialog({ open: true, member });
            }
            setMenuAnchor({ element: null, memberId: null });
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Remove
        </MenuItem>
      </Menu>

      {/* Role Edit Dialog */}
      <Dialog
        open={roleEditDialog.open}
        onClose={() => setRoleEditDialog({ open: false, member: null, newRole: 'analyst' })}
        aria-labelledby="role-edit-dialog-title"
        aria-describedby="role-edit-dialog-description"
      >
        <DialogTitle id="role-edit-dialog-title">Change Role</DialogTitle>
        <DialogContent>
          <DialogContentText id="role-edit-dialog-description" sx={{ mb: 2 }}>
            Update the role for {roleEditDialog.member?.fullName}
          </DialogContentText>
          <AccessibleField
            label="New Role"
            required
            hint="Select the new role for this team member"
          >
            <FormControl fullWidth>
              <Select
                value={roleEditDialog.newRole}
                onChange={(e) => setRoleEditDialog({ ...roleEditDialog, newRole: e.target.value as TeamRole })}
                aria-label="Select new role"
              >
                {Object.entries(ROLE_CONFIG)
                  .filter(([key]) => key !== 'owner')
                  .map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Box>
                        <Typography variant="body2">{config.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {config.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </AccessibleField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleEditDialog({ open: false, member: null, newRole: 'analyst' })}>
            Cancel
          </Button>
          <Button
            onClick={handleRoleUpdate}
            variant="contained"
            disabled={isUpdating || roleEditDialog.newRole === roleEditDialog.member?.role}
            aria-busy={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialog.open} onClose={() => setRemoveDialog({ open: false, member: null })}>
        <DialogTitle>Remove Team Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{removeDialog.member?.fullName}</strong> from the team?
            They will lose access to all organization resources.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialog({ open: false, member: null })}>
            Cancel
          </Button>
          <Button onClick={handleRemoveMember} color="error" variant="contained" disabled={isUpdating}>
            {isUpdating ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Invitation Dialog */}
      <Dialog open={revokeDialog.open} onClose={() => setRevokeDialog({ open: false, invitation: null })}>
        <DialogTitle>Cancel Invitation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel the invitation to <strong>{revokeDialog.invitation?.email}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog({ open: false, invitation: null })}>
            Keep Invitation
          </Button>
          <Button onClick={handleRevokeInvitation} color="error" variant="contained" disabled={isUpdating}>
            {isUpdating ? 'Cancelling...' : 'Cancel Invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

TeamManagement.displayName = 'TeamManagement';

export default TeamManagement;
