import React from 'react';
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
  Create,
  Filter,
  useRecordContext,
  ReferenceManyField,
  ArrayField,
  SingleFieldList,
  ChipField,
  TopToolbar,
  CreateButton,
  ExportButton,
  FilterButton,
  DatagridConfigurable,
  useRefresh,
  useNotify,
} from 'react-admin';
import { Card, CardContent, Grid, Typography, Box, Chip } from '@mui/material';

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
  'PENDING': { bgColor: '#9ca3af', textColor: '#ffffff', label: 'Pending' }, // gray-400
  'ANALYZING': { bgColor: '#3b82f6', textColor: '#ffffff', label: 'Analyzing' }, // blue-500
  'COMPLETED': { bgColor: '#22c55e', textColor: '#ffffff', label: 'Completed' }, // green-500
  'FAILED': { bgColor: '#ef4444', textColor: '#ffffff', label: 'Failed' }, // red-500
};

/**
 * BOM Grade Field Component
 */
const BOMGradeField: React.FC<{ source?: string; label?: string }> = ({ source = 'grade' }) => {
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
const BOMStatusField: React.FC<{ source?: string; label?: string }> = ({ source = 'status' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const status = record[source] || 'PENDING';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['PENDING'];

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
 * BOM List Filters
 */
const BOMFilters: React.FC = (props) => (
  <Filter {...props}>
    <TextInput label="Search Name" source="name" alwaysOn />
    <SelectInput
      label="Grade"
      source="grade"
      choices={[
        { id: 'A', name: 'Grade A' },
        { id: 'B', name: 'Grade B' },
        { id: 'C', name: 'Grade C' },
        { id: 'D', name: 'Grade D' },
        { id: 'E', name: 'Grade E' },
        { id: 'F', name: 'Grade F' },
      ]}
    />
    <SelectInput
      label="Status"
      source="status"
      choices={[
        { id: 'PENDING', name: 'Pending' },
        { id: 'ANALYZING', name: 'Analyzing' },
        { id: 'COMPLETED', name: 'Completed' },
        { id: 'FAILED', name: 'Failed' },
      ]}
    />
  </Filter>
);

/**
 * BOM List Actions
 */
const ListActions: React.FC = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

/**
 * BOM List Page
 */
export const BOMList: React.FC = () => (
  <List
    filters={<BOMFilters />}
    actions={<ListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <DatagridConfigurable
      rowClick="show"
      bulkActionButtons={false}
      sx={{
        '& .RaDatagrid-headerCell': {
          fontWeight: 'bold',
          backgroundColor: '#f3f4f6',
        },
      }}
    >
      <TextField source="name" label="BOM Name" />
      <TextField source="version" label="Version" />
      <BOMGradeField source="grade" label="Grade" />
      <BOMStatusField source="status" label="Status" />
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
      <DateField source="last_analyzed" label="Last Analyzed" />
    </DatagridConfigurable>
  </List>
);

/**
 * BOM Show Page
 */
export const BOMShow: React.FC = () => (
  <Show>
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
                  source="unique_components"
                  label="Unique Components"
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
                <NumberField
                  source="average_component_cost"
                  label="Average Component Cost"
                  options={{
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  }}
                />
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

              {/* Compliance */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Compliance
                </Typography>
                <NumberField
                  source="non_compliant_count"
                  label="Non-Compliant Components"
                  options={{ maximumFractionDigits: 0 }}
                />
                <NumberField
                  source="eol_obsolete_count"
                  label="EOL/Obsolete Components"
                  options={{ maximumFractionDigits: 0 }}
                />
              </Grid>

              {/* Dates */}
              <Grid item xs={12}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Timeline
                </Typography>
                <DateField source="created_at" label="Created At" showTime />
                <DateField source="last_analyzed" label="Last Analyzed" showTime />
                <DateField source="updated_at" label="Last Updated" showTime />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Tab>

      {/* Line Items Tab */}
      <Tab label="Line Items">
        <ReferenceManyField
          reference="bom_line_items"
          target="bom_id"
          label="BOM Line Items"
        >
          <Datagrid rowClick="edit">
            <NumberField source="line_number" label="Line #" />
            <TextField source="component.manufacturer_part_number" label="MPN" />
            <TextField source="component.manufacturer" label="Manufacturer" />
            <TextField source="designator" label="Designator" />
            <NumberField source="quantity" label="Quantity" />
            <NumberField
              source="unit_price"
              label="Unit Price"
              options={{
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              }}
            />
            <NumberField
              source="extended_price"
              label="Extended Price"
              options={{
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              }}
            />
          </Datagrid>
        </ReferenceManyField>
      </Tab>
    </TabbedShowLayout>
  </Show>
);

/**
 * BOM Edit Page
 */
export const BOMEdit: React.FC = () => (
  <Edit>
    <TabbedForm>
      <FormTab label="Basic Information">
        <TextInput source="name" label="BOM Name" fullWidth required />
        <TextInput source="version" label="Version" fullWidth />
        <TextInput source="description" label="Description" fullWidth multiline rows={3} />
        <SelectInput
          source="status"
          label="Status"
          choices={[
            { id: 'PENDING', name: 'Pending' },
            { id: 'ANALYZING', name: 'Analyzing' },
            { id: 'COMPLETED', name: 'Completed' },
            { id: 'FAILED', name: 'Failed' },
          ]}
          fullWidth
        />
      </FormTab>

      <FormTab label="Metrics">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <NumberInput source="component_count" label="Total Components" fullWidth />
            <NumberInput source="unique_components" label="Unique Components" fullWidth />
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

/**
 * BOM Create Page
 */
export const BOMCreate: React.FC = () => (
  <Create>
    <TabbedForm>
      <FormTab label="Basic Information">
        <TextInput source="name" label="BOM Name" fullWidth required />
        <TextInput source="version" label="Version" defaultValue="1.0" fullWidth />
        <TextInput source="description" label="Description" fullWidth multiline rows={3} />
        <SelectInput
          source="status"
          label="Status"
          choices={[
            { id: 'PENDING', name: 'Pending' },
            { id: 'ANALYZING', name: 'Analyzing' },
            { id: 'COMPLETED', name: 'Completed' },
            { id: 'FAILED', name: 'Failed' },
          ]}
          defaultValue="PENDING"
          fullWidth
        />
      </FormTab>
    </TabbedForm>
  </Create>
);
