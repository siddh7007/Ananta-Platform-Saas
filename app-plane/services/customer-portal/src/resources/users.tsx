/**
 * Users Resource - User Management within Organizations
 *
 * Aligns with tenants/users schema in Supabase.
 */

import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  DateField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  Create,
  BooleanField,
  BooleanInput,
  SelectInput,
  ReferenceInput,
  ReferenceField,
  required,
  email,
  useRecordContext,
  FunctionField,
  TopToolbar,
  CreateButton,
  ExportButton,
  EditButton,
  useDelete,
  useRedirect,
  useNotify,
} from 'react-admin';
import {
  Chip,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import { supabase } from '../providers/dataProvider';
import { canManageOrganization, UserRole, normalizeRole } from '../utils/permissions';
import { Events } from '../services/eventPublisher';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
  // Legacy mappings for display
  member: 'Engineer',  // Deprecated: member → engineer
  viewer: 'Analyst',   // Deprecated: viewer → analyst
};

/**
 * User Role Badge
 */
const UserRoleField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const role = record.role || 'engineer';
  const isAdminType = role === 'admin' || role === 'owner' || role === 'super_admin';

  return (
    <Chip
      label={ROLE_LABELS[role] || role}
      size="small"
      color={isAdminType ? 'primary' : 'default'}
      icon={isAdminType ? <AdminPanelSettingsIcon /> : <PersonIcon />}
      sx={{ minWidth: '90px' }}
    />
  );
};

/**
 * User Status Badge
 */
const UserStatusField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const isActive = record.is_active !== false;
  return (
    <Chip
      label={isActive ? 'Active' : 'Inactive'}
      size="small"
      color={isActive ? 'success' : 'default'}
      sx={{ minWidth: '80px' }}
    />
  );
};

/**
 * User Delete Button - Admin/Owner Only
 * Prevents users from deleting themselves
 */
const UserDeleteButton: React.FC = () => {
  const record = useRecordContext();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteOne] = useDelete();
  const notify = useNotify();
  const redirect = useRedirect();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setIsLoading(false);
          return;
        }

        const userId = userData.user.id;
        setCurrentUserId(userId);

        const userTenantId = userData.user.user_metadata?.organization_id || localStorage.getItem('organization_id');
        setTenantId(userTenantId);

        // Get user's role
        const { data: membershipData } = await supabase
          .from('organization_memberships')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const role = normalizeRole(membershipData?.role);
        setUserRole(role);
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading || !record) return null;

  // Only admins/owners can delete users
  const canDeleteUser = userRole && canManageOrganization(userRole, 'manage_members');

  // Prevent deleting yourself
  const isSelf = record.id === currentUserId;

  if (!canDeleteUser || isSelf) return null;

  const handleDelete = async () => {
    try {
      // Publish delete event BEFORE deletion
      await Events.User.deleted(
        String(record.id),
        tenantId || '',
        currentUserId || ''
      );

      // Delete the user
      await deleteOne(
        'users',
        { id: record.id, previousData: record },
        {
          onSuccess: () => {
            notify(`User "${record.full_name || record.email}" deleted successfully`, { type: 'success' });
            redirect('/users');
          },
          onError: (error: any) => {
            notify(`Error deleting user: ${error.message}`, { type: 'error' });
          },
        }
      );
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    }
    setConfirmOpen(false);
  };

  return (
    <>
      <Button
        variant="contained"
        color="error"
        onClick={() => setConfirmOpen(true)}
        sx={{ ml: 1 }}
      >
        Delete User
      </Button>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ Confirm User Deletion
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete the user account and revoke all access.
          </Alert>

          <DialogContentText>
            Are you sure you want to delete user:
            <br />
            <br />
            <strong>{record.full_name || record.email}</strong>
            <br />
            <Typography variant="caption" color="text.secondary">
              {record.email}
            </Typography>
            <br />
            <br />
            This action cannot be undone. The user will lose access to all projects and data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete User
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * User List Actions
 */
const ListActions = () => (
  <TopToolbar>
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

/**
 * Users List View
 */
export const UserList = () => (
  <List
    actions={<ListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="full_name" label="Full Name" />
      <EmailField source="email" label="Email" />
      <ReferenceField source="organization_id" reference="organizations" label="Organization">
        <TextField source="name" />
      </ReferenceField>
      <FunctionField label="Role" render={UserRoleField} />
      <FunctionField label="Status" render={UserStatusField} />
      <BooleanField source="email_verified" label="Email Verified" />
      <BooleanField source="mfa_enabled" label="MFA Enabled" />
      <BooleanField source="can_view_all_tenant_components" label="View All Components" />
      <DateField source="created_at" label="Created" showTime />
    </Datagrid>
  </List>
);

/**
 * User Show Page Actions
 */
const UserShowActions: React.FC = () => (
  <TopToolbar>
    <EditButton />
    <UserDeleteButton />
  </TopToolbar>
);

/**
 * User Show View
 */
export const UserShow = () => (
  <Show actions={<UserShowActions />}>
    <SimpleShowLayout>
      <Grid container spacing={3}>
        {/* User Profile */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    mr: 2,
                    bgcolor: 'primary.main',
                    fontSize: '24px',
                  }}
                >
                  <FunctionField
                    render={(record: any) =>
                      record?.full_name?.charAt(0).toUpperCase() || 'U'
                    }
                  />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    <TextField source="full_name" />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <EmailField source="email" />
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 3 }}>
                <TextField source="id" label="User ID" />
                <FunctionField label="Role" render={UserRoleField} />
                <FunctionField label="Status" render={UserStatusField} />
                <BooleanField source="email_verified" label="Email Verified" />
                <BooleanField source="mfa_enabled" label="MFA Enabled" />
                <DateField source="created_at" label="Created" showTime />
                <DateField source="updated_at" label="Last Updated" showTime />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Permissions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Component Access Permissions
              </Typography>
              <Box sx={{ mt: 2 }}>
                <BooleanField
                  source="can_view_all_tenant_components"
                  label="Can View All Tenant Components"
                  valueLabelTrue="Yes - Can see all organization components"
                  valueLabelFalse="No - Can only see own components"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  This setting controls whether the user can see all components uploaded by anyone in their organization, or only components they personally created.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Organization */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <BusinessIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Organization
              </Typography>

              <Box sx={{ mt: 2 }}>
                <ReferenceField source="organization_id" reference="organizations">
                  <FunctionField
                    render={(org: any) => (
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          {org?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {org?.slug}
                        </Typography>
                      </Box>
                    )}
                  />
                </ReferenceField>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </SimpleShowLayout>
  </Show>
);

/**
 * User Edit View
 */
export const UserEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" label="ID" disabled />
      <TextInput
        source="first_name"
        label="First Name"
        validate={[required()]}
        fullWidth
      />
      <TextInput
        source="last_name"
        label="Last Name"
        validate={[required()]}
        fullWidth
      />
      <TextInput
        source="email"
        label="Email"
        type="email"
        validate={[required(), email()]}
        fullWidth
      />
      <ReferenceInput source="organization_id" reference="organizations">
        <SelectInput
          optionText="name"
          label="Organization"
          validate={[required()]}
          fullWidth
        />
      </ReferenceInput>
      <SelectInput
        source="role"
        label="Role"
        choices={[
          { id: 'owner', name: 'Owner' },
          { id: 'admin', name: 'Admin' },
          { id: 'engineer', name: 'Engineer' },
          { id: 'analyst', name: 'Analyst' },
        ]}
        validate={[required()]}
      />
      <BooleanInput source="is_active" label="Active" defaultValue />
      <BooleanInput source="email_verified" label="Email Verified" />
      <BooleanInput source="mfa_enabled" label="MFA Enabled" />

      <Box sx={(theme) => ({ mt: 3, p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: 2 })}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Component Access Permissions
        </Typography>
        <BooleanInput
          source="can_view_all_tenant_components"
          label="Can View All Tenant Components"
          defaultValue={true}
          helperText="If enabled: user can see all components in their organization. If disabled: user can only see components they created."
        />
      </Box>
    </SimpleForm>
  </Edit>
);

/**
 * User Create View
 */
export const UserCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput
        source="first_name"
        label="First Name"
        validate={[required()]}
        fullWidth
      />
      <TextInput
        source="last_name"
        label="Last Name"
        validate={[required()]}
        fullWidth
      />
      <TextInput
        source="email"
        label="Email"
        type="email"
        validate={[required(), email()]}
        fullWidth
      />
      <ReferenceInput source="organization_id" reference="organizations" perPage={100}>
        <SelectInput
          optionText="name"
          label="Organization"
          validate={[required()]}
          fullWidth
        />
      </ReferenceInput>
      <SelectInput
        source="role"
        label="Role"
        choices={[
          { id: 'owner', name: 'Owner' },
          { id: 'admin', name: 'Admin' },
          { id: 'engineer', name: 'Engineer' },
          { id: 'analyst', name: 'Analyst' },
        ]}
        validate={[required()]}
        defaultValue="engineer"
      />
      <BooleanInput source="is_active" label="Active" defaultValue />
      <BooleanInput source="email_verified" label="Email Verified" defaultValue={false} />
      <BooleanInput source="mfa_enabled" label="MFA Enabled" defaultValue={false} />

      <Box sx={(theme) => ({ mt: 3, p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: 2 })}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Component Access Permissions
        </Typography>
        <BooleanInput
          source="can_view_all_tenant_components"
          label="Can View All Tenant Components"
          defaultValue={true}
          helperText="If enabled: user can see all components in their organization. If disabled: user can only see components they created."
        />
      </Box>
    </SimpleForm>
  </Create>
);
