import React from 'react';
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
  NumberInput,
  SelectInput,
  Create,
  Filter,
  useRecordContext,
  ReferenceField,
  BooleanField,
  BooleanInput,
  TopToolbar,
  CreateButton,
  ExportButton,
  FilterButton,
  SelectColumnsButton,
  DatagridConfigurable,
} from 'react-admin';
import { Card, CardContent, Grid, Typography, Box, Chip } from '@mui/material';
import { RiskLevelField } from '../components/fields/RiskLevelField';
import { LifecycleStatusField } from '../components/fields/LifecycleStatusField';
import { MultiComplianceField, RoHSComplianceField, REACHComplianceField } from '../components/fields/ComplianceField';

/**
 * Component List Page
 *
 * Matches V1 functionality:
 * - Customizable columns
 * - Advanced filtering (category, risk, lifecycle, compliance)
 * - Grid/Table views
 * - Color-coded badges
 * - Export functionality
 */

// List Filters
const ComponentFilters: React.FC = (props) => (
  <Filter {...props}>
    <TextInput label="Search MPN" source="manufacturer_part_number" alwaysOn />
    <TextInput label="Search Manufacturer" source="manufacturer" />
    <TextInput label="Search Description" source="description" />
    <SelectInput
      label="Risk Level"
      source="risk_level"
      choices={[
        { id: 'GREEN', name: 'Low Risk' },
        { id: 'YELLOW', name: 'Medium Risk' },
        { id: 'ORANGE', name: 'High Risk' },
        { id: 'RED', name: 'Critical Risk' },
      ]}
    />
    <SelectInput
      label="Lifecycle Status"
      source="lifecycle_status"
      choices={[
        { id: 'ACTIVE', name: 'Active' },
        { id: 'NRND', name: 'NRND' },
        { id: 'EOL', name: 'EOL' },
        { id: 'OBSOLETE', name: 'Obsolete' },
      ]}
    />
    <SelectInput
      label="RoHS Compliant"
      source="rohs_compliant"
      choices={[
        { id: 'COMPLIANT', name: 'Compliant' },
        { id: 'NON_COMPLIANT', name: 'Non-Compliant' },
        { id: 'UNKNOWN', name: 'Unknown' },
      ]}
    />
    <BooleanInput label="Has Alternatives" source="has_alternatives" />
  </Filter>
);

// List Actions
const ListActions: React.FC = () => (
  <TopToolbar>
    <FilterButton />
    <SelectColumnsButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
);

// Component List
export const ComponentList: React.FC = () => (
  <List
    filters={<ComponentFilters />}
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
      <TextField source="manufacturer_part_number" label="MPN" />
      <TextField source="manufacturer" label="Manufacturer" />
      <TextField source="category" label="Category" />
      <RiskLevelField source="risk_level" label="Risk" />
      <LifecycleStatusField source="lifecycle_status" label="Lifecycle" />
      <RoHSComplianceField source="rohs_compliant" label="RoHS" />
      <NumberField
        source="stock_quantity"
        label="Stock"
        options={{ maximumFractionDigits: 0 }}
      />
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
      <DateField source="last_updated" label="Last Updated" />
    </DatagridConfigurable>
  </List>
);

/**
 * Component Show Page
 *
 * Detailed view with all component information
 */
export const ComponentShow: React.FC = () => (
  <Show>
    <SimpleShowLayout>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Component Details
          </Typography>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Basic Information
              </Typography>
              <TextField source="manufacturer_part_number" label="Manufacturer Part Number" />
              <TextField source="manufacturer" label="Manufacturer" />
              <TextField source="category" label="Category" />
              <TextField source="description" label="Description" />
              <TextField source="datasheet_url" label="Datasheet URL" />
            </Grid>

            {/* Risk & Compliance */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Risk & Compliance
              </Typography>
              <RiskLevelField source="risk_level" />
              <LifecycleStatusField source="lifecycle_status" />
              <MultiComplianceField />
              <DateField source="lifecycle_change_date" label="Lifecycle Change Date" />
            </Grid>

            {/* Pricing & Inventory */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Pricing & Inventory
              </Typography>
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
              <NumberField source="stock_quantity" label="Stock Quantity" />
              <NumberField source="moq" label="Minimum Order Quantity (MOQ)" />
              <TextField source="lead_time_days" label="Lead Time (days)" />
            </Grid>

            {/* Alternative Components */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Alternatives & Quality
              </Typography>
              <BooleanField source="has_alternatives" label="Has Alternatives" />
              <NumberField
                source="quality_score"
                label="Quality Score"
                options={{ maximumFractionDigits: 2 }}
              />
              <TextField source="alternative_components" label="Alternative Components" />
            </Grid>

            {/* Metadata */}
            <Grid item xs={12}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Metadata
              </Typography>
              <DateField source="created_at" label="Created At" showTime />
              <DateField source="last_updated" label="Last Updated" showTime />
              <TextField source="data_source" label="Data Source" />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </SimpleShowLayout>
  </Show>
);

/**
 * Component Edit Page
 */
export const ComponentEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextInput source="manufacturer_part_number" label="Manufacturer Part Number" fullWidth required />
          <TextInput source="manufacturer" label="Manufacturer" fullWidth required />
          <TextInput source="category" label="Category" fullWidth />
          <TextInput source="description" label="Description" fullWidth multiline rows={3} />
          <TextInput source="datasheet_url" label="Datasheet URL" fullWidth />
        </Grid>

        <Grid item xs={12} md={6}>
          <SelectInput
            source="risk_level"
            label="Risk Level"
            choices={[
              { id: 'GREEN', name: 'Low Risk' },
              { id: 'YELLOW', name: 'Medium Risk' },
              { id: 'ORANGE', name: 'High Risk' },
              { id: 'RED', name: 'Critical Risk' },
            ]}
            fullWidth
          />
          <SelectInput
            source="lifecycle_status"
            label="Lifecycle Status"
            choices={[
              { id: 'ACTIVE', name: 'Active' },
              { id: 'NRND', name: 'NRND' },
              { id: 'EOL', name: 'EOL' },
              { id: 'OBSOLETE', name: 'Obsolete' },
            ]}
            fullWidth
          />
          <SelectInput
            source="rohs_compliant"
            label="RoHS Compliance"
            choices={[
              { id: 'COMPLIANT', name: 'Compliant' },
              { id: 'NON_COMPLIANT', name: 'Non-Compliant' },
              { id: 'UNKNOWN', name: 'Unknown' },
              { id: 'EXEMPT', name: 'Exempt' },
            ]}
            fullWidth
          />
          <SelectInput
            source="reach_compliant"
            label="REACH Compliance"
            choices={[
              { id: 'COMPLIANT', name: 'Compliant' },
              { id: 'NON_COMPLIANT', name: 'Non-Compliant' },
              { id: 'UNKNOWN', name: 'Unknown' },
            ]}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <NumberInput source="unit_price" label="Unit Price (USD)" fullWidth />
          <NumberInput source="stock_quantity" label="Stock Quantity" fullWidth />
          <NumberInput source="moq" label="Minimum Order Quantity (MOQ)" fullWidth />
          <NumberInput source="lead_time_days" label="Lead Time (days)" fullWidth />
        </Grid>

        <Grid item xs={12} md={6}>
          <BooleanInput source="has_alternatives" label="Has Alternatives" />
          <NumberInput source="quality_score" label="Quality Score (0-100)" fullWidth />
          <TextInput source="alternative_components" label="Alternative Components (comma-separated)" fullWidth multiline rows={2} />
        </Grid>
      </Grid>
    </SimpleForm>
  </Edit>
);

/**
 * Component Create Page
 */
export const ComponentCreate: React.FC = () => (
  <Create>
    <SimpleForm>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextInput source="manufacturer_part_number" label="Manufacturer Part Number" fullWidth required />
          <TextInput source="manufacturer" label="Manufacturer" fullWidth required />
          <TextInput source="category" label="Category" fullWidth />
          <TextInput source="description" label="Description" fullWidth multiline rows={3} />
          <TextInput source="datasheet_url" label="Datasheet URL" fullWidth />
        </Grid>

        <Grid item xs={12} md={6}>
          <SelectInput
            source="risk_level"
            label="Risk Level"
            choices={[
              { id: 'GREEN', name: 'Low Risk' },
              { id: 'YELLOW', name: 'Medium Risk' },
              { id: 'ORANGE', name: 'High Risk' },
              { id: 'RED', name: 'Critical Risk' },
            ]}
            defaultValue="GREEN"
            fullWidth
          />
          <SelectInput
            source="lifecycle_status"
            label="Lifecycle Status"
            choices={[
              { id: 'ACTIVE', name: 'Active' },
              { id: 'NRND', name: 'NRND' },
              { id: 'EOL', name: 'EOL' },
              { id: 'OBSOLETE', name: 'Obsolete' },
            ]}
            defaultValue="ACTIVE"
            fullWidth
          />
          <SelectInput
            source="rohs_compliant"
            label="RoHS Compliance"
            choices={[
              { id: 'COMPLIANT', name: 'Compliant' },
              { id: 'NON_COMPLIANT', name: 'Non-Compliant' },
              { id: 'UNKNOWN', name: 'Unknown' },
              { id: 'EXEMPT', name: 'Exempt' },
            ]}
            defaultValue="UNKNOWN"
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <NumberInput source="unit_price" label="Unit Price (USD)" defaultValue={0} fullWidth />
          <NumberInput source="stock_quantity" label="Stock Quantity" defaultValue={0} fullWidth />
          <NumberInput source="moq" label="Minimum Order Quantity (MOQ)" defaultValue={1} fullWidth />
        </Grid>
      </Grid>
    </SimpleForm>
  </Create>
);
