import React from 'react';
import {
  List,
  TextField,
  DateField,
  NumberField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  DatagridConfigurable,
  useRecordContext,
  Filter,
  SelectInput,
} from 'react-admin';
import { Box, Card, CardContent, Typography, Grid, Chip, IconButton, Tooltip, Stack } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';

/**
 * BOM Line Items Resource for CNS Dashboard
 *
 * Shows individual line items from uploaded BOMs (both customer and bulk uploads).
 * Each line item represents a component in the BOM.
 * Data source: Main Components V2 Database (bom_line_items table)
 */

/**
 * Line Item Filters
 */
const LineItemFilter: React.FC = (props) => (
  <Filter {...props}>
    <TextInput source="bom_id" label="BOM Upload ID" />
    <TextInput source="manufacturer_part_number" label="Part Number" alwaysOn />
    <TextInput source="manufacturer" label="Manufacturer" />
    <SelectInput
      source="enrichment_status"
      label="Enrichment Status"
      choices={[
        { id: 'pending', name: 'Pending' },
        { id: 'matched', name: 'Matched' },
        { id: 'partial', name: 'Partial' },
        { id: 'failed', name: 'Failed' },
      ]}
    />
  </Filter>
);

/**
 * Enrichment Status Badge
 */
const EnrichmentStatusBadge: React.FC<{ source?: string }> = ({ source = 'enrichment_status' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const status = String(record[source] || 'pending').toLowerCase();

  const statusConfig: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#9ca3af', fg: '#ffffff', label: 'Pending' },
    matched: { bg: '#22c55e', fg: '#ffffff', label: 'Matched' },
    partial: { bg: '#f59e0b', fg: '#ffffff', label: 'Partial' },
    failed: { bg: '#ef4444', fg: '#ffffff', label: 'Failed' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.fg,
      }}
    />
  );
};

/**
 * Line Item Actions Column
 */
const LineItemActions: React.FC = () => {
  const record = useRecordContext();
  if (!record) return null;

  return (
    <Stack direction="row" spacing={0.5} justifyContent="center">
      <Tooltip title="View Details">
        <IconButton
          size="small"
          color="info"
          onClick={(e) => {
            e.stopPropagation();
            window.location.hash = `#/bom-line-items/${record.id}/show`;
          }}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Re-Enrich">
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Implement re-enrich API call
            console.log('Re-enrich line item:', record.id);
          }}
          disabled={record.enrichment_status === 'matched'}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {record.matched_component_id && (
        <Tooltip title="View Linked Component">
          <IconButton
            size="small"
            color="success"
            onClick={(e) => {
              e.stopPropagation();
              window.location.hash = `#/components/${record.matched_component_id}/show`;
            }}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};

/**
 * BOM Line Items List
 */
export const BOMLineItemList: React.FC = () => (
  <List
    sort={{ field: 'line_number', order: 'ASC' }}
    perPage={50}
    filters={<LineItemFilter />}
  >
    <DatagridConfigurable
      rowClick="edit"
      bulkActionButtons={false}
      sx={{
        '& .RaDatagrid-headerCell': {
          fontWeight: 'bold',
          backgroundColor: '#f3f4f6',
        },
      }}
    >
      <TextField source="bom_id" label="BOM ID" />
      <NumberField source="line_number" label="#" />
      <TextField source="manufacturer_part_number" label="Part Number" />
      <TextField source="manufacturer" label="Manufacturer" />
      <TextField source="quantity" label="Qty" />
      <TextField source="reference_designator" label="Reference" />
      <TextField source="description" label="Description" />
      <EnrichmentStatusBadge source="enrichment_status" />
      <LineItemActions />
    </DatagridConfigurable>
  </List>
);

/**
 * BOM Line Item Show Page
 */
export const BOMLineItemShow: React.FC = () => {
  const record = useRecordContext();

  return (
    <Show>
      <SimpleShowLayout>
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Line Item Details
                </Typography>
                <NumberField source="line_number" label="Line Number" />
                <TextField source="bom_id" label="BOM Upload ID" />
                <TextField source="tenant_id" label="Tenant ID" />
                <TextField source="manufacturer_part_number" label="Part Number (MPN)" emptyText="Not specified" />
                <TextField source="manufacturer" label="Manufacturer" emptyText="Not specified" />
                <TextField source="quantity" label="Quantity" emptyText="Not specified" />
                <TextField source="reference_designator" label="Reference Designator" emptyText="Not specified" />
                <TextField source="description" label="Description" emptyText="Not specified" />
              </Grid>

              {/* Enrichment Status */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Enrichment Status
                </Typography>
                <EnrichmentStatusBadge source="enrichment_status" />
                {record?.enriched_data && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Enriched Data:
                    </Typography>
                    <pre style={{
                      background: '#f3f4f6',
                      padding: '12px',
                      borderRadius: '8px',
                      overflow: 'auto',
                      fontSize: '12px',
                      marginTop: '8px'
                    }}>
                      {JSON.stringify(record.enriched_data, null, 2)}
                    </pre>
                  </Box>
                )}
                {record?.matched_component_id && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="success.main">
                      Matched Component ID: {record.matched_component_id}
                    </Typography>
                  </Box>
                )}
              </Grid>

              {/* Raw Data */}
              <Grid item xs={12}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Raw Data from Upload
                </Typography>
                {record?.raw_data && (
                  <pre style={{
                    background: '#f3f4f6',
                    padding: '12px',
                    borderRadius: '8px',
                    overflow: 'auto',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(record.raw_data, null, 2)}
                  </pre>
                )}
              </Grid>

              {/* Timestamps */}
              <Grid item xs={12}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Timeline
                </Typography>
                <DateField source="created_at" label="Created At" showTime />
                <DateField source="updated_at" label="Last Updated" showTime />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </SimpleShowLayout>
    </Show>
  );
};

/**
 * BOM Line Item Edit Page
 * Allows editing of component information and enrichment status
 */
export const BOMLineItemEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <Typography variant="h6" gutterBottom>
        Edit Line Item
      </Typography>

      <NumberField source="line_number" label="Line Number" />
      <TextField source="bom_id" label="BOM Upload ID" />

      <TextInput source="manufacturer_part_number" label="Part Number (MPN)" fullWidth />
      <TextInput source="manufacturer" label="Manufacturer" fullWidth />
      <TextInput source="quantity" label="Quantity" fullWidth />
      <TextInput source="reference_designator" label="Reference Designator" fullWidth />
      <TextInput
        source="description"
        label="Description"
        multiline
        rows={3}
        fullWidth
      />

      <SelectInput
        source="enrichment_status"
        label="Enrichment Status"
        choices={[
          { id: 'pending', name: 'Pending' },
          { id: 'matched', name: 'Matched' },
          { id: 'partial', name: 'Partial Match' },
          { id: 'failed', name: 'Failed' },
        ]}
        fullWidth
      />

      <TextInput source="matched_component_id" label="Matched Component ID" fullWidth />

      <Box sx={{ mt: 2, p: 2, bgcolor: '#f3f4f6', borderRadius: 2 }}>
        <Typography variant="caption" color="textSecondary">
          Edit the component details as needed. Changes will be saved to the line item record.
        </Typography>
      </Box>
    </SimpleForm>
  </Edit>
);
