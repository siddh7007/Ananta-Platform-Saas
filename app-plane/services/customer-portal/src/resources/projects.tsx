/**
 * Projects Resource - BOM Project Management
 *
 * Allows users to:
 * - Create BOM projects under their organization
 * - Organize BOMs by project
 * - Track project status and progress
 * - Manage project members
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
  TabbedShowLayout,
  Tab,
  Edit,
  SimpleForm,
  TextInput,
  Create,
  SelectInput,
  DateInput,
  ReferenceInput,
  ReferenceField,
  ReferenceManyField,
  FormDataConsumer,
  required,
  useRecordContext,
  useNotify,
  useRefresh,
  FunctionField,
  TopToolbar,
  CreateButton,
  ExportButton,
  EditButton,
  useDelete,
  useRedirect,
} from 'react-admin';
import {
  Chip,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ListAltIcon from '@mui/icons-material/ListAlt';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { supabase } from '../providers/dataProvider';
import { canDelete, UserRole, normalizeRole } from '../utils/permissions';
import { Events } from '../services/eventPublisher';
import { useFormContext, useWatch } from 'react-hook-form';

/**
 * Auto-populate project_code and description based on project name
 */
const AutoPopulateFields: React.FC<{ populatedRef: React.MutableRefObject<{ code: boolean; desc: boolean }> }> = ({ populatedRef }) => {
  const { setValue } = useFormContext();
  const name = useWatch({ name: 'name' });
  const projectCode = useWatch({ name: 'project_code' });
  const description = useWatch({ name: 'description' });

  React.useEffect(() => {
    if (name && name.trim()) {
      // Auto-populate project code if empty
      const hasProjectCode = projectCode && projectCode.trim().length > 0;
      if (!hasProjectCode && !populatedRef.current.code) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const nameSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 10);
        const code = `${nameSlug}-${year}${month}`;
        console.log('Auto-populating project_code:', code);
        setValue('project_code', code);
        populatedRef.current.code = true;
      }

      // Auto-populate description with project name if empty
      const hasDescription = description && description.trim().length > 0;
      if (!hasDescription && !populatedRef.current.desc) {
        console.log('Auto-populating description:', name);
        setValue('description', name);
        populatedRef.current.desc = true;
      }
    } else {
      // Reset when name is cleared
      populatedRef.current = { code: false, desc: false };
    }
  }, [name, projectCode, description, setValue, populatedRef]);

  return null;
};

/**
 * Project Status Badge - REMOVED (status column doesn't exist in projects table)
 */
const ProjectStatusField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  // Status field removed - projects table doesn't have a status column
  return (
    <Chip
      label="Active"
      size="small"
      color="success"
      sx={{ minWidth: '90px' }}
    />
  );
};

/**
 * Project Progress Bar
 */
const ProjectProgressField: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  const completedBoms = record.completed_boms || 0;
  const totalBoms = record.total_boms || 0;
  const percentage = totalBoms > 0 ? (completedBoms / totalBoms) * 100 : 0;

  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption">{completedBoms}/{totalBoms} BOMs</Typography>
        <Typography variant="caption" fontWeight={600}>{percentage.toFixed(0)}%</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={percentage === 100 ? 'success' : 'primary'}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
};

/**
 * Project Delete Button with Role-Based Permissions
 * Only allows deletion of EMPTY projects (no BOMs)
 * Button is disabled if project has BOMs - user must delete BOMs first
 */
const ProjectDeleteButton: React.FC = () => {
  const record = useRecordContext();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
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

        // Get BOM count for this project
        if (record?.id) {
          const { count } = await supabase
            .from('boms')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', record.id);

          setBomCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [record?.id]);

  if (isLoading || !record) return null;

  const canDeleteProject = userRole && canDelete(userRole, record.created_by, currentUserId);

  if (!canDeleteProject) return null;

  const handleDelete = async () => {
    // Prevent deletion if project has BOMs
    if (bomCount > 0) {
      notify(`Cannot delete project with ${bomCount} BOM${bomCount !== 1 ? 's' : ''}. Please delete all BOMs first.`, { type: 'error' });
      setConfirmOpen(false);
      return;
    }

    try {
      // Publish delete event BEFORE deletion
      await Events.Project.deleted(
        String(record.id),
        tenantId || '',
        currentUserId || '',
        record.name,
        bomCount
      );

      // Delete the empty project
      await deleteOne(
        'projects',
        { id: record.id, previousData: record },
        {
          onSuccess: () => {
            notify('Project deleted successfully', { type: 'success' });
            redirect('/projects');
          },
          onError: (error: any) => {
            notify(`Error deleting project: ${error.message}`, { type: 'error' });
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
      <Tooltip title={bomCount > 0 ? `Cannot delete project with ${bomCount} BOM${bomCount !== 1 ? 's' : ''}. Delete BOMs first.` : ''}>
        <span>
          <Button
            variant="contained"
            color="error"
            onClick={() => setConfirmOpen(true)}
            disabled={bomCount > 0}
            sx={{ ml: 1 }}
          >
            Delete Project
          </Button>
        </span>
      </Tooltip>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>⚠️ Confirm Project Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete project "<strong>{record.name}</strong>"?
            <br /><br />
            {bomCount > 0 ? (
              <Typography color="error" fontWeight="bold">
                ❌ Cannot delete: This project has {bomCount} BOM{bomCount !== 1 ? 's' : ''}. Please delete all BOMs before deleting the project.
              </Typography>
            ) : (
              <Typography color="success.main" fontWeight="bold">
                ✓ This project is empty and can be safely deleted.
              </Typography>
            )}
            <br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={bomCount > 0}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * Project List Actions
 */
const ListActions = () => (
  <TopToolbar>
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

/**
 * Projects List View
 */
export const ProjectList = () => (
  <List
    actions={<ListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="name" label="Project Name" />
      <TextField source="project_code" label="Code" />
      <ReferenceField source="organization_id" reference="organizations" label="Organization">
        <TextField source="name" />
      </ReferenceField>
      <FunctionField
        label="Status"
        render={ProjectStatusField}
      />
      <FunctionField
        label="Progress"
        render={ProjectProgressField}
      />
      <NumberField source="total_boms" label="BOMs" />
      <NumberField source="total_components" label="Components" />
      <DateField source="created_at" label="Created" />
    </Datagrid>
  </List>
);

/**
 * Project Show Page Actions
 */
const ProjectShowActions: React.FC = () => (
  <TopToolbar>
    <EditButton />
    <ProjectDeleteButton />
  </TopToolbar>
);

/**
 * Project Show View
 */
export const ProjectShow = () => (
  <Show actions={<ProjectShowActions />}>
    <TabbedShowLayout>
      {/* Overview Tab */}
      <Tab label="Overview">
        <Grid container spacing={3}>
          {/* Project Details */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FolderIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h6">
                      <TextField source="name" />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Project ID: <TextField source="id" />
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <FunctionField
                    label="Status"
                    render={ProjectStatusField}
                  />
                  <TextField source="visibility" label="Visibility" />
                  <TextField source="project_code" label="Project Code" />
                  <TextField source="description" label="Description" />
                  <DateField source="start_date" label="Start Date" />
                  <DateField source="end_date" label="End Date" />
                  <DateField source="last_activity_at" label="Last Activity" showTime />
                  <DateField source="created_at" label="Created" showTime />
                  <DateField source="updated_at" label="Last Updated" showTime />
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

                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <PeopleIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                    Project Owner
                  </Typography>
                  <ReferenceField source="project_owner_id" reference="users">
                    <TextField source="full_name" />
                  </ReferenceField>

                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    Created By
                  </Typography>
                  <ReferenceField source="created_by" reference="users">
                    <TextField source="full_name" />
                  </ReferenceField>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Project Progress */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ListAltIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  BOM Progress
                </Typography>

                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total BOMs
                      </Typography>
                      <Typography variant="h4" color="primary.main">
                        <NumberField source="total_boms" />
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Completed
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        <NumberField source="completed_boms" />
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        In Progress
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        <NumberField source="in_progress_boms" />
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Components
                      </Typography>
                      <Typography variant="h4">
                        <NumberField source="total_components" />
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <FunctionField render={ProjectProgressField} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Tab>

      {/* BOMs Tab */}
      <Tab label="BOMs">
        <ReferenceManyField reference="boms" target="project_id" label="">
          <Datagrid rowClick="show">
            <TextField source="name" label="BOM Name" />
            <TextField source="version" label="Version" />
            <TextField source="grade" label="Grade" />
            <TextField source="status" label="Status" />
            <NumberField source="component_count" label="Components" />
            <NumberField
              source="total_cost"
              label="Total Cost"
              options={{ style: 'currency', currency: 'USD' }}
            />
            <NumberField source="high_risk_count" label="High Risk" />
            <DateField source="created_at" label="Created" />
            <DateField source="last_analyzed_at" label="Last Analyzed" />
          </Datagrid>
        </ReferenceManyField>
      </Tab>

      {/* Project Enrichment Tab - Component Catalog with All Parameters */}
      <Tab label="Project Enrichment">
        <ReferenceManyField reference="bom_line_items" target="project_id" label="">
          <Datagrid rowClick="show">
            {/* Core Identification */}
            <TextField source="manufacturer_part_number" label="MPN" />
            <TextField source="manufacturer" label="Manufacturer" />
            <TextField source="description" label="Description" />
            <NumberField source="quantity" label="Qty" />
            <TextField source="reference_designator" label="Reference" />

            {/* BOM Reference */}
            <ReferenceField source="bom_id" reference="boms" label="BOM" link="show">
              <TextField source="name" />
            </ReferenceField>

            {/* Enrichment Data - Technical Parameters */}
            <FunctionField
              label="Category"
              render={(record: any) => record?.enriched_data?.category || '-'}
            />
            <FunctionField
              label="Lifecycle"
              render={(record: any) => record?.enriched_data?.lifecycle_status || '-'}
            />
            <FunctionField
              label="Stock"
              render={(record: any) => {
                const stock = record?.enriched_data?.stock_quantity;
                return stock !== undefined && stock !== null ? stock.toLocaleString() : '-';
              }}
            />

            {/* Pricing */}
            <FunctionField
              label="Unit Price"
              render={(record: any) => {
                const price = record?.enriched_data?.unit_price;
                return price ? `$${Number(price).toFixed(2)}` : '-';
              }}
            />
            <FunctionField
              label="Total Price"
              render={(record: any) => {
                const price = record?.enriched_data?.unit_price;
                const qty = record?.quantity;
                return price && qty ? `$${(Number(price) * Number(qty)).toFixed(2)}` : '-';
              }}
            />

            {/* Compliance */}
            <FunctionField
              label="RoHS"
              render={(record: any) => {
                const rohs = record?.enriched_data?.rohs_compliant;
                if (rohs === true || rohs === 'true' || rohs === 'COMPLIANT') return <Chip label="Yes" size="small" color="success" />;
                if (rohs === false || rohs === 'false' || rohs === 'NON_COMPLIANT') return <Chip label="No" size="small" color="error" />;
                return <Chip label="Unknown" size="small" sx={{ bgcolor: '#9ca3af' }} />;
              }}
            />
            <FunctionField
              label="REACH"
              render={(record: any) => {
                const reach = record?.enriched_data?.reach_compliant;
                if (reach === true || reach === 'true' || reach === 'COMPLIANT') return <Chip label="Yes" size="small" color="success" />;
                if (reach === false || reach === 'false' || reach === 'NON_COMPLIANT') return <Chip label="No" size="small" color="error" />;
                return <Chip label="Unknown" size="small" sx={{ bgcolor: '#9ca3af' }} />;
              }}
            />

            {/* Additional Parameters */}
            <FunctionField
              label="Packaging"
              render={(record: any) => record?.enriched_data?.packaging || '-'}
            />
            <FunctionField
              label="Lead Time"
              render={(record: any) => {
                const days = record?.enriched_data?.lead_time_days;
                return days ? `${days} days` : '-';
              }}
            />
            <FunctionField
              label="MOQ"
              render={(record: any) => {
                const moq = record?.enriched_data?.minimum_order_quantity;
                return moq !== undefined && moq !== null ? moq.toLocaleString() : '-';
              }}
            />

            {/* Datasheet */}
            <FunctionField
              label="Datasheet"
              render={(record: any) => {
                const url = record?.enriched_data?.datasheet_url;
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                    View
                  </a>
                ) : '-';
              }}
            />

            {/* Timestamps */}
            <DateField source="created_at" label="Created" />
            <DateField source="updated_at" label="Updated" />
          </Datagrid>
        </ReferenceManyField>
      </Tab>
    </TabbedShowLayout>
  </Show>
);

/**
 * Project Edit View with dependent user selects
 */
export const ProjectEdit = () => {
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(null);
  const record = useRecordContext();

  // Initialize selected org from record
  React.useEffect(() => {
    if (record?.organization_id && !selectedOrgId) {
      setSelectedOrgId(record.organization_id);
    }
  }, [record, selectedOrgId]);

  return (
    <Edit>
      <SimpleForm>
        <TextInput source="id" label="ID" disabled />
        <TextInput
          source="name"
          label="Project Name"
          validate={[required()]}
          fullWidth
        />
        <TextInput
          source="description"
          label="Description"
          multiline
          rows={3}
          fullWidth
        />
        <TextInput
          source="project_code"
          label="Project Code"
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
        {/* Watch for organization selection changes and update local state */}
        <FormDataConsumer>
          {({ formData }) => {
            const value = formData?.organization_id as string | undefined;
            React.useEffect(() => {
              setSelectedOrgId(value ?? null);
            }, [value]);
            return null;
          }}
        </FormDataConsumer>
        <ReferenceInput
          source="project_owner_id"
          reference="users"
          perPage={100}
          filter={selectedOrgId ? { organization_id: selectedOrgId } : {}}
        >
          <SelectInput
            optionText="full_name"
            label="Project Owner"
            validate={[required()]}
            fullWidth
            disabled={!selectedOrgId}
            helperText={!selectedOrgId ? "Please select an organization first" : ""}
          />
        </ReferenceInput>
        <ReferenceInput
          source="created_by"
          reference="users"
          perPage={100}
          filter={selectedOrgId ? { organization_id: selectedOrgId } : {}}
        >
          <SelectInput
            optionText="full_name"
            label="Created By"
            fullWidth
            disabled={!selectedOrgId}
          />
        </ReferenceInput>
        <SelectInput
          source="visibility"
          label="Visibility"
          choices={[
            { id: 'private', name: 'Private' },
            { id: 'internal', name: 'Internal' },
            { id: 'public', name: 'Public' },
          ]}
          defaultValue="private"
          validate={[required()]}
        />
        <DateInput source="start_date" label="Start Date" />
        {/* End date removed - not needed for BOM projects */}
      </SimpleForm>
    </Edit>
  );
};

/**
 * Project Create View with dependent user selects
 */
export const ProjectCreate = () => {
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(null);
  const [defaultTenantId, setDefaultTenantId] = React.useState<string | null>(null);
  const [defaultOwnerId, setDefaultOwnerId] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [orgName, setOrgName] = React.useState<string>('');
  const notify = useNotify();
  const refresh = useRefresh();

  // Ref to track if we've auto-populated fields (persists across renders)
  const populatedRef = React.useRef({ code: false, desc: false });

  // Resolve current user -> tenant, owner id, admin flag; prefill defaults
  // Works with both Supabase Auth and Auth0 Direct JWT (Option A)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try Supabase auth first (for Supabase JWT mode)
        const { data: auth } = await supabase.auth.getUser();
        let email = auth?.user?.email;

        // Fallback to localStorage for Auth0 Direct JWT mode
        if (!email) {
          email = localStorage.getItem('user_email');
        }

        if (!email) {
          console.warn('[ProjectCreate] No email found from Supabase or localStorage');
          // Still try to use localStorage values for org/user if available
          const localOrgId = localStorage.getItem('organization_id');
          const localUserId = localStorage.getItem('user_id');
          if (localOrgId && !cancelled) {
            setDefaultTenantId(localOrgId);
            setSelectedOrgId(localOrgId);
          }
          if (localUserId && !cancelled) {
            setDefaultOwnerId(localUserId);
          }
          return;
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('id, organization_id')
          .eq('email', email)
          .maybeSingle();
        if (!cancelled && userRow) {
          const tid = (userRow as any).organization_id || null;
          const uid = (userRow as any).id || null;
          setDefaultTenantId(tid);
          setSelectedOrgId(tid);
          setDefaultOwnerId(uid);

          // Check role in organization_memberships
          const { data: membership } = await supabase
            .from('organization_memberships')
            .select('role')
            .eq('user_id', uid)
            .maybeSingle();
          setIsAdmin(membership?.role === 'super_admin');
          if (tid) {
            const { data: org } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', tid)
              .maybeSingle();
            if (!cancelled && org) setOrgName((org as any).name || '');
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const SeedUserButton: React.FC<{ tenantId?: string }> = ({ tenantId }) => {
    const handleClick = async () => {
      if (!tenantId) return;
      const ts = Date.now();
      const email = `sample.user.${ts}@example.com`;
      const payload = {
        organization_id: tenantId,
        email,
        first_name: 'Sample',
        last_name: 'User',
        role: 'admin',
        is_active: true,
      } as const;
      const { error } = await supabase.from('users').insert(payload);
      if (error) {
        notify(`Failed to create sample user: ${error.message}`, { type: 'error' });
        return;
      }
      notify(`Sample user created: ${email}`, { type: 'info' });
      refresh();
    };

    return (
      <Button
        variant="outlined"
        size="small"
        sx={{ ml: 1 }}
        onClick={handleClick}
        disabled={!tenantId}
      >
        Create Sample User
      </Button>
    );
  };

  return (
    <Create>
      <SimpleForm
        defaultValues={{
          organization_id: defaultTenantId || undefined,
          created_by: defaultOwnerId || undefined, // Correct column name
        }}
      >
        <TextInput
          source="name"
          label="Project Name"
          validate={[required()]}
          fullWidth
          inputProps={{ maxLength: 200 }}
          helperText="A descriptive name for your project (max 200 characters)"
        />
        <AutoPopulateFields populatedRef={populatedRef} />
        <TextInput
          source="project_code"
          label="Project Code (Optional)"
          fullWidth
          inputProps={{ maxLength: 50 }}
          helperText="Auto-generated code - you can edit if needed (max 50 characters)"
        />
        <TextInput
          source="description"
          label="Description"
          multiline
          rows={3}
          fullWidth
          inputProps={{ maxLength: 2000 }}
          helperText="Auto-filled with project name - add more details (max 2000 characters)"
        />
        {/* Organization ID - hidden for all users, auto-assigned to user's organization */}
        <TextInput source="organization_id" defaultValue={defaultTenantId || undefined} sx={{ display: 'none' }} />
        {/* Watch for organization selection changes and update local state */}
        <FormDataConsumer>
          {({ formData }) => {
            const value = formData?.organization_id as string | undefined;
            React.useEffect(() => {
              setSelectedOrgId(value ?? null);
            }, [value]);
            return null;
          }}
        </FormDataConsumer>
        {/* Project Owner - Admins can assign to others, regular users auto-assigned to themselves */}
        {isAdmin ? (
          <ReferenceInput
            source="created_by"
            reference="users"
            perPage={100}
            filter={defaultTenantId ? { organization_id: defaultTenantId } : {}}
            defaultValue={defaultOwnerId || undefined}
          >
            <SelectInput
              optionText="full_name"
              label="Project Owner"
              validate={[required()]}
              fullWidth
              helperText="Assign this project to a team member (defaults to you)"
            />
          </ReferenceInput>
        ) : (
          <TextInput source="created_by" defaultValue={defaultOwnerId || undefined} sx={{ display: 'none' }} />
        )}
      </SimpleForm>
    </Create>
  );
};
