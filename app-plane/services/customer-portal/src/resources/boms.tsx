import React, { useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  Show,
  TabbedShowLayout,
  Tab,
  Edit,
  TabbedForm,
  FormTab,
  TextInput,
  NumberInput,
  SelectInput,
  ReferenceInput,
  ReferenceField,
  Create,
  required,
  useRecordContext,
  ReferenceManyField,
  ChipField,
  TopToolbar,
  CreateButton,
  ExportButton,
  DatagridConfigurable,
  useRefresh,
  useNotify,
  EditButton,
  DeleteButton,
  useDelete,
  useRedirect,
} from 'react-admin';
import { Card, CardContent, Grid, Typography, Box, Chip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { supabase } from '../providers/dataProvider';
import { canDelete, UserRole, normalizeRole } from '../utils/permissions';
import { Events } from '../services/eventPublisher';

// Lazy load BOMUploadWorkflow at module scope (NOT inside component)
// This prevents hook ordering issues caused by recreating the lazy reference on each render
const LazyBOMUploadWorkflow = React.lazy(() =>
  import('../bom/BOMUploadWorkflow').then(module => ({ default: module.BOMUploadWorkflow }))
);

/**
 * BOM (Bill of Materials) Resources
 *
 * Matches V1 functionality:
 * - BOM grade system (A-F) with color-coded badges
 * - Status tracking (Pending, Analyzing, Completed, Failed)
 * - Line items management
 * - Cost analysis
 * - Component count
 */

// Grade Configuration (Matching V1)
const GRADE_CONFIG: Record<string, { bgColor: string; textColor: string; label: string }> = {
  'A': { bgColor: '#22c55e', textColor: '#ffffff', label: 'Grade A' }, // green-500
  'B': { bgColor: '#84cc16', textColor: '#ffffff', label: 'Grade B' }, // lime-500
  'C': { bgColor: '#facc15', textColor: '#000000', label: 'Grade C' }, // yellow-400
  'D': { bgColor: '#fb923c', textColor: '#ffffff', label: 'Grade D' }, // orange-400
  'E': { bgColor: '#f97316', textColor: '#ffffff', label: 'Grade E' }, // orange-500
  'F': { bgColor: '#ef4444', textColor: '#ffffff', label: 'Grade F' }, // red-500
  'N/A': { bgColor: '#9ca3af', textColor: '#ffffff', label: 'N/A' }, // gray-400
};

// Status Configuration
const STATUS_CONFIG: Record<string, { bgColor: string; textColor: string; label: string }> = {
  draft: { bgColor: '#9ca3af', textColor: '#ffffff', label: 'Draft' },
  pending: { bgColor: '#9ca3af', textColor: '#ffffff', label: 'Pending' },
  analyzing: { bgColor: '#3b82f6', textColor: '#ffffff', label: 'Analyzing' },
  completed: { bgColor: '#22c55e', textColor: '#ffffff', label: 'Completed' },
  failed: { bgColor: '#ef4444', textColor: '#ffffff', label: 'Failed' },
  archived: { bgColor: '#6b7280', textColor: '#ffffff', label: 'Archived' },
};

/**
 * BOM Grade Field Component
 */
const BOMGradeField: React.FC<{ source?: string }> = ({ source = 'grade' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const grade = record[source] || 'N/A';
  const config = GRADE_CONFIG[grade] || GRADE_CONFIG['N/A'];

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.875rem',
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    />
  );
};

/**
 * BOM Status Field Component
 */
const BOMStatusField: React.FC<{ source?: string }> = ({ source = 'status' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const status = (record[source] || 'draft').toLowerCase();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['draft'];

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    />
  );
};

/**
 * BOM Delete Button with Role-Based Permissions
 * Only shows if user has permission to delete this BOM
 */
const BOMDeleteButton: React.FC = () => {
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
    const fetchUserRole = async () => {
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

        // Get user's role from organization memberships
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

    fetchUserRole();
  }, []);

  if (isLoading || !record) return null;

  const canDeleteBOM = userRole && canDelete(userRole, record.created_by, currentUserId);

  if (!canDeleteBOM) return null;

  const handleDelete = async () => {
    try {
      // Publish delete event BEFORE deletion
      await Events.BOM.deleted(
        String(record.id),
        tenantId || '',
        currentUserId || '',
        record.name
      );

      // Delete the BOM
      await deleteOne(
        'boms',
        { id: record.id, previousData: record },
        {
          onSuccess: () => {
            notify('BOM deleted successfully', { type: 'success' });
            redirect('/boms');
          },
          onError: (error: any) => {
            notify(`Error deleting BOM: ${error.message}`, { type: 'error' });
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
        Delete BOM
      </Button>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete BOM "{record.name}"?
            <br /><br />
            This action cannot be undone. All line items and analysis data will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * BOM List Actions
 */
const ListActions: React.FC = () => (
  <TopToolbar>
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

/**
 * BOM List Filters
 */
const bomFilters = [
  <ReferenceInput source="project_id" reference="projects" alwaysOn key="project-filter">
    <SelectInput optionText="name" label="Project" emptyText="All Projects" />
  </ReferenceInput>,
  <SelectInput
    source="status"
    label="Status"
    choices={[
      { id: 'draft', name: 'Draft' },
      { id: 'pending', name: 'Pending' },
      { id: 'analyzing', name: 'Analyzing' },
      { id: 'completed', name: 'Completed' },
      { id: 'failed', name: 'Failed' },
      { id: 'archived', name: 'Archived' },
    ]}
    key="status-filter"
  />,
  <SelectInput
    source="grade"
    label="Grade"
    choices={[
      { id: 'A', name: 'Grade A' },
      { id: 'B', name: 'Grade B' },
      { id: 'C', name: 'Grade C' },
      { id: 'D', name: 'Grade D' },
      { id: 'E', name: 'Grade E' },
      { id: 'F', name: 'Grade F' },
    ]}
    key="grade-filter"
  />,
];

/**
 * BOM List Page
 */
export const BOMList: React.FC = () => (
  <List
    actions={<ListActions />}
    filters={bomFilters}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <DatagridConfigurable
      rowClick="show"
      bulkActionButtons={false}
      sx={(theme) => ({
        '& .RaDatagrid-headerCell': {
          fontWeight: 600,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
          color: theme.palette.mode === 'dark' ? '#fff' : 'inherit',
          borderBottom: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : undefined,
        },
      })}
    >
      <TextField source="name" label="BOM Name" />
      <TextField source="version" label="Version" />
      <ReferenceField source="project_id" reference="projects" label="Project" emptyText="No Project">
        <TextField source="name" />
      </ReferenceField>
      <BOMGradeField source="grade" />
      <BOMStatusField source="status" />
      <NumberField
        source="component_count"
        label="Components"
        options={{ maximumFractionDigits: 0 }}
      />
      <NumberField
        source="total_cost"
        label="Total Cost"
        options={{
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }}
      />
      <NumberField
        source="high_risk_count"
        label="High Risk"
        options={{ maximumFractionDigits: 0 }}
        sx={(record: any) => ({
          color: record && record.high_risk_count > 0 ? '#ef4444' : 'inherit',
          fontWeight: record && record.high_risk_count > 0 ? 700 : 400,
        })}
      />
      <DateField source="created_at" label="Created" />
      <DateField source="last_analyzed_at" label="Last Analyzed" />
    </DatagridConfigurable>
  </List>
);

/**
 * BOM Show Page Actions
 */
const BOMShowActions: React.FC = () => (
  <TopToolbar>
    <EditButton />
    <BOMDeleteButton />
  </TopToolbar>
);

/**
 * BOM Show Page
 */
export const BOMShow: React.FC = () => (
  <Show actions={<BOMShowActions />}>
    <TabbedShowLayout>
      {/* Overview Tab */}
      <Tab label="Overview">
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  BOM Information
                </Typography>
                <TextField source="name" label="BOM Name" />
                <TextField source="version" label="Version" />
                <TextField source="description" label="Description" />
                <BOMGradeField source="grade" />
                <BOMStatusField source="status" />
              </Grid>

              {/* Metrics */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Metrics
                </Typography>
                <NumberField
                  source="component_count"
                  label="Total Components"
                  options={{ maximumFractionDigits: 0 }}
                />
                <NumberField
                  source="total_cost"
                  label="Total Cost"
                  options={{
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                  }}
                />
                <TextField source="workflow_status" label="Workflow Status" />
                <TextField source="source" label="Source" />
              </Grid>

              {/* Risk Analysis */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Risk Analysis
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      High Risk
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      <NumberField source="high_risk_count" options={{ maximumFractionDigits: 0 }} />
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Medium Risk
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      <NumberField source="medium_risk_count" options={{ maximumFractionDigits: 0 }} />
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Low Risk
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      <NumberField source="low_risk_count" options={{ maximumFractionDigits: 0 }} />
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Sync Information */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Synchronization
                </Typography>
                <DateField source="last_synced_at" label="Last Synced" showTime />
              </Grid>

              {/* Dates */}
              <Grid item xs={12}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Timeline
                </Typography>
                <DateField source="created_at" label="Created At" showTime />
                <DateField source="last_analyzed_at" label="Last Analyzed" showTime />
                <DateField source="updated_at" label="Last Updated" showTime />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Tab>
    </TabbedShowLayout>
  </Show>
);

/**
 * BOM Edit Page with Event Publishing
 */
export const BOMEdit: React.FC = () => {
  const notify = useNotify();

  const handleSave = async (data: any) => {
    // Get user context
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const tenantId = userData?.user?.user_metadata?.organization_id || localStorage.getItem('organization_id');

    // Detect changes by comparing with original data
    const changes: Record<string, any> = {};

    // Common fields to track
    const trackFields = ['name', 'version', 'description', 'status', 'workflow_status', 'source',
                         'component_count', 'total_cost', 'high_risk_count', 'medium_risk_count', 'low_risk_count'];

    // Only include changed fields (react-admin provides the full data object)
    trackFields.forEach(field => {
      if (data[field] !== undefined) {
        changes[field] = data[field];
      }
    });

    // Publish BOM edited event
    try {
      await Events.BOM.edited(
        data.id,
        tenantId || '',
        userId || '',
        changes
      );
      console.log('[BOM Edit] Event published for BOM:', data.id);
    } catch (error) {
      console.error('[BOM Edit] Failed to publish event:', error);
      // Non-blocking - don't fail the save
    }

    return data;
  };

  return (
    <Edit mutationOptions={{
      onSuccess: async (data: any) => {
        await handleSave(data);
      }
    }}>
      <TabbedForm>
        <FormTab label="Basic Information">
          <TextInput source="name" label="BOM Name" fullWidth validate={[required()]} />
          <TextInput source="version" label="Version" fullWidth />
          <TextInput source="description" label="Description" fullWidth multiline rows={3} />

          {/* Project field is read-only - BOMs cannot be moved between projects */}
          <ReferenceField source="project_id" reference="projects" label="Project" link={false}>
            <TextField source="name" />
          </ReferenceField>

          <SelectInput
            source="status"
            label="Status"
            choices={[
              { id: 'draft', name: 'Draft' },
              { id: 'pending', name: 'Pending' },
              { id: 'analyzing', name: 'Analyzing' },
              { id: 'completed', name: 'Completed' },
              { id: 'failed', name: 'Failed' },
              { id: 'archived', name: 'Archived' },
            ]}
            fullWidth
          />
          <SelectInput
            source="workflow_status"
            label="Workflow Status"
            choices={[
              { id: 'queued', name: 'Queued' },
              { id: 'processing', name: 'Processing' },
              { id: 'completed', name: 'Completed' },
              { id: 'failed', name: 'Failed' },
            ]}
            fullWidth
            emptyText="None"
          />
          <TextInput source="source" label="Source" fullWidth />
        </FormTab>

        <FormTab label="Metrics">
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <NumberInput source="component_count" label="Total Components" fullWidth />
              <NumberInput source="total_cost" label="Total Cost" fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <NumberInput source="high_risk_count" label="High Risk Count" fullWidth />
              <NumberInput source="medium_risk_count" label="Medium Risk Count" fullWidth />
              <NumberInput source="low_risk_count" label="Low Risk Count" fullWidth />
            </Grid>
          </Grid>
        </FormTab>
      </TabbedForm>
    </Edit>
  );
};

/**
 * BOM Create Page - Using 3-Step Wizard with Column Mapping Review
 */
export const BOMCreate: React.FC = () => {
  // Note: LazyBOMUploadWorkflow is loaded at module scope to prevent hook ordering issues
  return (
    <Box sx={{ p: 3 }}>
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyBOMUploadWorkflow />
      </React.Suspense>
    </Box>
  );
};
