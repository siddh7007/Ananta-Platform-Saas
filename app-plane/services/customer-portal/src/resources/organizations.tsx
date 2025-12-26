/**
 * Organizations Resource - Multi-tenancy Management
 *
 * Allows admins to:
 * - Create and manage organizations
 * - View organization users and projects
 * - Set organization-level settings
 */

import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  Create,
  SelectInput,
  NumberInput,
  DateInput,
  required,
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import PublicIcon from '@mui/icons-material/Public';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { supabase } from '../providers/dataProvider';
import { canManageOrganization, UserRole, normalizeRole } from '../utils/permissions';
import { Events } from '../services/eventPublisher';

type OrganizationRecord = {
  subscription_status?: string;
  [key: string]: any;
};

/**
 * Organization Status Badge
 */
const OrganizationStatusField: React.FC<{ record?: OrganizationRecord }> = ({ record }) => {
  if (import.meta.env.DEV) {
    console.log('[OrganizationStatusField] record=', record);
  }

  if (!record) {
    if (import.meta.env.DEV) {
      console.warn('[OrganizationStatusField] No record context available');
    }
    return null;
  }

  const status = record.subscription_status || 'trial';
  const labelMap: Record<string, string> = {
    trial: 'Trial',
    active: 'Active',
    past_due: 'Past Due',
    canceled: 'Canceled',
    suspended: 'Suspended',
  };
  const isActive = ['trial', 'active'].includes(status);

  return (
    <Chip
      label={labelMap[status] || status}
      size="small"
      color={isActive ? 'success' : status === 'past_due' ? 'warning' : 'default'}
      sx={{ minWidth: '80px' }}
    />
  );
};

/**
 * Organization Delete Button - Owner Only with Comprehensive Cascade Warning
 * Shows counts for users, projects, and BOMs that will be deleted
 */
const OrganizationDeleteButton: React.FC = () => {
  const record = useRecordContext();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [bomCount, setBomCount] = useState<number>(0);
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

        // Get user's role
        const { data: membershipData } = await supabase
          .from('organization_memberships')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const role = normalizeRole(membershipData?.role);
        setUserRole(role);

        // Get counts for cascade warning
        if (record?.id) {
          // Count users
          const { count: uCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', record.id);

          // Count projects
          const { count: pCount } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', record.id);

          // Count BOMs
          const { count: bCount } = await supabase
            .from('boms')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', record.id);

          setUserCount(uCount || 0);
          setProjectCount(pCount || 0);
          setBomCount(bCount || 0);
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [record?.id]);

  if (isLoading || !record) return null;

  const canDeleteOrg = userRole && canManageOrganization(userRole, 'delete');

  if (!canDeleteOrg) return null;

  const handleDelete = async () => {
    try {
      // Publish delete event BEFORE deletion
      await Events.Organization.deleted(
        String(record.id),
        currentUserId || '',
        record.name
      );

      // Delete the organization (cascade will handle all related data)
      await deleteOne(
        'organizations',
        { id: record.id, previousData: record },
        {
          onSuccess: () => {
            notify(
              `Organization deleted successfully (${userCount} users, ${projectCount} projects, ${bomCount} BOMs also deleted)`,
              { type: 'success' }
            );
            redirect('/organizations');
          },
          onError: (error: any) => {
            notify(`Error deleting organization: ${error.message}`, { type: 'error' });
          },
        }
      );
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    }
    setConfirmOpen(false);
  };

  const totalDataPoints = userCount + projectCount + bomCount;

  return (
    <>
      <Button
        variant="contained"
        color="error"
        onClick={() => setConfirmOpen(true)}
        sx={{ ml: 1 }}
      >
        Delete Organization
      </Button>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ DELETE ENTIRE ORGANIZATION
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>CRITICAL WARNING:</strong> This will permanently delete ALL data for organization "{record.name}"
          </Alert>

          <DialogContentText sx={{ mb: 2 }}>
            This action will CASCADE DELETE:
          </DialogContentText>

          <Box sx={{ pl: 2, mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              • {userCount} User{userCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              • {projectCount} Project{projectCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              • {bomCount} BOM{bomCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Total: {totalDataPoints} data records
            </Typography>
          </Box>

          <DialogContentText>
            <strong>This action CANNOT be undone.</strong>
            <br />
            All organization data, subscriptions, and history will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            I Understand - Delete Everything
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * Check if user has admin role
 */
const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        const email = authData?.user?.email;

        if (!userId && !email) return;

        // Get user ID from users table
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (!userRow) return;

        // Check role in organization_memberships
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('role')
          .eq('user_id', userRow.id)
          .maybeSingle();

        // User is admin if they have 'admin' or 'super_admin' role
        setIsAdmin(membership?.role === 'admin' || membership?.role === 'super_admin' || membership?.role === 'owner');
      } catch (error) {
        console.error('Error checking admin role:', error);
      }
    };

    checkAdminRole();
  }, []);

  return isAdmin;
};

/**
 * Organization List Actions - Only show Create for admins
 */
const ListActions = () => {
  const isAdmin = useIsAdmin();

  return (
    <TopToolbar>
      {isAdmin && <CreateButton />}
      <ExportButton />
    </TopToolbar>
  );
};

/**
 * Organizations List View
 */
export const OrganizationList = () => (
  <List
    actions={<ListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="name" label="Organization Name" />
      <TextField source="slug" label="Slug" />
      <TextField source="plan_tier" label="Plan Tier" />
      <TextField source="subscription_status" label="Subscription Status" />
      <FunctionField
        label="Status"
        render={record => <OrganizationStatusField record={record} />}
      />
      <NumberField source="current_users_count" label="Active Users" />
      <NumberField source="current_components_count" label="Component Count" />
      <NumberField source="max_users" label="User Limit" />
      <DateField source="created_at" label="Created" showTime />
    </Datagrid>
  </List>
);

/**
 * Organization Show Page Actions - Edit/Delete only for admins
 */
const OrganizationShowActions: React.FC = () => {
  const isAdmin = useIsAdmin();

  return (
    <TopToolbar>
      {isAdmin && <EditButton />}
      {isAdmin && <OrganizationDeleteButton />}
    </TopToolbar>
  );
};

/**
 * Organization Show View
 */
export const OrganizationShow = () => (
  <Show actions={<OrganizationShowActions />}>
    <SimpleShowLayout>
      <TextField source="id" label="Organization ID" />
      <TextField source="name" label="Organization Name" />
      <TextField source="slug" label="Slug" />
      <FunctionField
        label="Status"
        render={record => <OrganizationStatusField record={record} />}
      />
      <TextField source="subscription_status" label="Subscription Status" />
      <TextField source="plan_tier" label="Plan Tier" />

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Billing Information
      </Typography>
      <TextField source="billing_email" label="Billing Email" />
      <TextField source="billing_contact_name" label="Billing Contact" />
      <TextField source="billing_phone" label="Billing Phone" />

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Limits & Usage
      </Typography>
      <NumberField source="current_users_count" label="Current Users" />
      <NumberField source="max_users" label="User Limit" />
      <NumberField source="current_components_count" label="Current Components" />
      <NumberField source="max_components" label="Component Limit" />
      <NumberField source="current_storage_gb" label="Storage Used (GB)" />
      <NumberField source="max_storage_gb" label="Storage Limit (GB)" />

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Settings
      </Typography>
      <TextField source="timezone" label="Timezone" />
      <TextField source="region" label="Region" />
      <TextField source="notes" label="Internal Notes" />

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Dates
      </Typography>
      <DateField source="trial_ends_at" label="Trial Ends" showTime />
      <DateField source="last_payment_at" label="Last Payment" showTime />
      <DateField source="created_at" label="Created" showTime />
      <DateField source="updated_at" label="Last Updated" showTime />
    </SimpleShowLayout>
  </Show>
);

/**
 * Organization Edit View
 */
export const OrganizationEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" label="ID" disabled />
      <TextInput
        source="name"
        label="Organization Name"
        validate={[required()]}
        fullWidth
      />
      <TextInput
        source="slug"
        label="Slug (URL-friendly name)"
        validate={[required()]}
        helperText="Lowercase, alphanumeric, hyphens only"
        fullWidth
      />
      <SelectInput
        source="subscription_status"
        label="Subscription Status"
        choices={[
          { id: 'trial', name: 'Trial' },
          { id: 'active', name: 'Active' },
          { id: 'past_due', name: 'Past Due' },
          { id: 'canceled', name: 'Canceled' },
          { id: 'suspended', name: 'Suspended' },
        ]}
        validate={[required()]}
        fullWidth
      />
      <SelectInput
        source="plan_tier"
        label="Plan Tier"
        choices={[
          { id: 'starter', name: 'Starter' },
          { id: 'standard', name: 'Standard' },
          { id: 'enterprise', name: 'Enterprise' },
        ]}
        validate={[required()]}
        fullWidth
      />
      <TextInput source="billing_email" label="Billing Email" type="email" fullWidth />
      <TextInput source="billing_contact_name" label="Billing Contact" fullWidth />
      <TextInput source="billing_phone" label="Billing Phone" fullWidth />
      <TextInput source="timezone" label="Timezone" fullWidth />
      <TextInput source="region" label="Region" fullWidth />
      <DateInput source="trial_ends_at" label="Trial Ends" />
      <DateInput source="last_payment_at" label="Last Payment" />
      <TextInput source="current_users_count" label="Active Users" disabled />
      <TextInput source="current_components_count" label="Component Count" disabled />
      <TextInput source="current_storage_gb" label="Storage Used (GB)" disabled />
      <NumberInput source="max_users" label="User Limit" min={1} />
      <NumberInput source="max_components" label="Component Limit" min={0} />
      <NumberInput source="max_storage_gb" label="Storage Limit (GB)" min={0} />
      <TextInput source="notes" label="Internal Notes" multiline rows={4} fullWidth />
    </SimpleForm>
  </Edit>
);

/**
 * Organization Create View
 */
export const OrganizationCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput
        source="name"
        label="Organization Name"
        validate={[required()]}
        fullWidth
      />
      <SelectInput
        source="subscription_status"
        label="Subscription Status"
        choices={[
          { id: 'trial', name: 'Trial' },
          { id: 'active', name: 'Active' },
          { id: 'past_due', name: 'Past Due' },
          { id: 'canceled', name: 'Canceled' },
          { id: 'suspended', name: 'Suspended' },
        ]}
        defaultValue="active"
        validate={[required()]}
        fullWidth
      />
      <SelectInput
        source="plan_tier"
        label="Plan Tier"
        choices={[
          { id: 'starter', name: 'Starter' },
          { id: 'standard', name: 'Standard' },
          { id: 'enterprise', name: 'Enterprise' },
        ]}
        defaultValue="standard"
        validate={[required()]}
        fullWidth
      />
      <TextInput source="billing_email" label="Billing Email" type="email" fullWidth />
      <TextInput source="billing_contact_name" label="Billing Contact" fullWidth />
      <TextInput source="billing_phone" label="Billing Phone" fullWidth />
      <TextInput source="timezone" label="Timezone" defaultValue="UTC" fullWidth />
      <TextInput source="region" label="Region" defaultValue="us-east-1" fullWidth />
      <NumberInput source="max_users" label="User Limit" min={1} defaultValue={10} />
      <NumberInput source="max_components" label="Component Limit" min={0} defaultValue={5000} />
      <NumberInput source="max_storage_gb" label="Storage Limit (GB)" min={0} defaultValue={100} />
      <TextInput source="notes" label="Internal Notes" multiline rows={4} fullWidth />
    </SimpleForm>
  </Create>
);
