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
  DatagridConfigurable,
  EditButton,
  useRecordContext,
  ReferenceField,
  Filter,
  ReferenceInput,
  SelectInput,
  useNotify,
} from 'react-admin';
import { Box, Card, CardContent, Typography, Grid, Chip } from '@mui/material';
import { supabase } from '../providers/dataProvider';
import { publishCustomEvent } from '../services/eventPublisher';

/**
 * BOM Line Items Resource
 *
 * Shows individual line items from uploaded BOMs.
 * Each line item represents a component in the BOM.
 */

/**
 * Line Item Filters
 */
const LineItemFilter: React.FC = (props) => (
  <Filter {...props}>
    <ReferenceInput source="bom_id" reference="boms" label="BOM">
      <SelectInput optionText="name" />
    </ReferenceInput>
    <TextInput source="manufacturer_part_number" label="Part Number" alwaysOn />
    <TextInput source="manufacturer" label="Manufacturer" />
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
 * BOM Line Items List
 */
export const BOMLineItemList: React.FC = () => {
  React.useEffect(() => {
    console.log('[BOMLineItemList] Component rendered');
  }, []);

  return (
    <List
      sort={{ field: 'line_number', order: 'ASC' }}
      perPage={50}
      filters={<LineItemFilter />}
    >
    <DatagridConfigurable
      rowClick="edit"
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
      <NumberField source="line_number" label="#" />
      <ReferenceField source="bom_id" reference="boms" label="BOM" link="show">
        <TextField source="name" />
      </ReferenceField>
      <TextField source="manufacturer_part_number" label="Part Number (MPN)" />
      <TextField source="manufacturer" label="Manufacturer" />
      <TextField source="quantity" label="Qty" />
      <TextField source="reference_designator" label="Reference" />
      <TextField source="description" label="Description" />
      <EnrichmentStatusBadge source="enrichment_status" />
      <EditButton label="Edit" />
    </DatagridConfigurable>
  </List>
  );
};

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
                <ReferenceField source="bom_id" reference="boms" label="BOM" link="show">
                  <TextField source="name" />
                </ReferenceField>
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
 * BOM Line Item Edit Page with Event Publishing
 * Allows editing of component information
 */
export const BOMLineItemEdit: React.FC = () => {
  const notify = useNotify();

  const handleSave = async (data: any) => {
    // Get user context
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const tenantId = userData?.user?.user_metadata?.organization_id || localStorage.getItem('organization_id');

    // Track changes
    const changes: Record<string, any> = {
      line_item_id: data.id,
      bom_id: data.bom_id,
      line_number: data.line_number,
    };

    const trackFields = ['manufacturer_part_number', 'manufacturer', 'quantity', 'reference_designator', 'description', 'enrichment_status'];
    trackFields.forEach(field => {
      if (data[field] !== undefined) {
        changes[field] = data[field];
      }
    });

    // Publish line item edited event
    try {
      await publishCustomEvent(
        'customer.bom.line_item.edited',
        'line_item_edited',
        {
          line_item_id: data.id,
          bom_id: data.bom_id,
          organization_id: tenantId,
          user_id: userId,
          changes,
          timestamp: new Date().toISOString(),
        },
        5 // Medium-high priority
      );
      console.log('[Line Item Edit] Event published for line item:', data.id);
    } catch (error) {
      console.error('[Line Item Edit] Failed to publish event:', error);
      // Non-blocking - don't fail the save
    }

    return data;
  };

  return (
    <Edit
      mutationMode="pessimistic"
      mutationOptions={{
        onSuccess: async (data: any) => {
          console.log('[Line Item Edit] 🎉 Save SUCCESS, data:', data);
          await handleSave(data);
        },
        onError: (error: any) => {
          console.error('[Line Item Edit] ❌ Save FAILED, error:', error);
        }
      }}
      transform={(data: any) => {
        console.log('[Line Item Edit] 📝 Transform called, data:', data);
        return data;
      }}
    >
      <SimpleForm>
        <Typography variant="h6" gutterBottom>
          Edit Line Item
        </Typography>

        <TextInput source="line_number" label="Line Number" disabled fullWidth />

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
            { id: 'completed', name: 'Completed' },
          ]}
          fullWidth
        />

        <Box sx={(theme) => ({ mt: 2, p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: 2 })}>
          <Typography variant="caption" color="textSecondary">
            💡 <strong>Tip:</strong> After editing, go to Recent Uploads → Click your BOM → "Re-Enrich Failed Items" to re-process this component.
          </Typography>
        </Box>
      </SimpleForm>
    </Edit>
  );
};
