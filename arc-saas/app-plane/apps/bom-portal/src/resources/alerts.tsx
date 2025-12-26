import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  Show,
  SimpleShowLayout,
  useRecordContext,
  TopToolbar,
  ExportButton,
  DatagridConfigurable,
  BooleanField,
  RichTextField,
} from 'react-admin';
import { Card, CardContent, Grid, Typography, Box, Chip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * Alerts Resource
 *
 * Matches V1 functionality:
 * - Alert severity levels (Critical, High, Medium, Low, Info)
 * - Color-coded badges
 * - Alert types (Lifecycle, Risk, Compliance, Price)
 * - Read/Unread status
 * - Filtering by severity and type
 */

// Severity Configuration
const SEVERITY_CONFIG: Record<string, {
  bgColor: string;
  textColor: string;
  label: string;
  icon: React.ReactElement;
}> = {
  critical: {
    bgColor: '#ef4444',
    textColor: '#ffffff',
    label: 'Critical',
    icon: <ErrorIcon sx={{ fontSize: 16 }} />,
  },
  warning: {
    bgColor: '#f59e0b',
    textColor: '#000000',
    label: 'Warning',
    icon: <WarningIcon sx={{ fontSize: 16 }} />,
  },
  info: {
    bgColor: '#3b82f6',
    textColor: '#ffffff',
    label: 'Info',
    icon: <InfoIcon sx={{ fontSize: 16 }} />,
  },
};

// Alert Type Configuration
const ALERT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  'LIFECYCLE': { color: '#8b5cf6', label: 'Lifecycle' }, // purple-500
  'RISK': { color: '#ef4444', label: 'Risk' }, // red-500
  'COMPLIANCE': { color: '#f59e0b', label: 'Compliance' }, // amber-500
  'PRICE': { color: '#10b981', label: 'Price' }, // emerald-500
  'STOCK': { color: '#3b82f6', label: 'Stock' }, // blue-500
  'QUALITY': { color: '#ec4899', label: 'Quality' }, // pink-500
  'OTHER': { color: '#6b7280', label: 'Other' }, // gray-500
};

/**
 * Alert Severity Field Component
 */
const AlertSeverityField: React.FC<{ source?: string }> = ({ source = 'severity' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const severity = record[source] || 'INFO';
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG['INFO'];

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      sx={{
        fontWeight: 700,
        backgroundColor: config.bgColor,
        color: config.textColor,
        '& .MuiChip-icon': {
          color: config.textColor,
        },
      }}
    />
  );
};

/**
 * Alert Type Field Component
 */
const AlertTypeField: React.FC<{ source?: string }> = ({ source = 'alert_type' }) => {
  const record = useRecordContext();
  if (!record) return null;

  const alertType = record[source] || 'OTHER';
  const config = ALERT_TYPE_CONFIG[alertType] || ALERT_TYPE_CONFIG['OTHER'];

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.color,
        color: '#ffffff',
      }}
    />
  );
};

/**
 * Alert List Actions
 */
const ListActions: React.FC = () => (
  <TopToolbar>
    <ExportButton />
  </TopToolbar>
);

/**
 * Alert List Page
 */
export const AlertList: React.FC = () => (
  <List
    actions={<ListActions />}
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
        '& .RaDatagrid-row': {
          '&.unread': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : '#eff6ff',
            fontWeight: 600,
          },
        },
      })}
      rowSx={(record) => ({
        className: !record.is_read ? 'unread' : '',
      })}
    >
      <AlertSeverityField source="severity" />
      <AlertTypeField source="alert_type" />
      <TextField source="title" label="Title" />
      <TextField source="component.manufacturer_part_number" label="MPN" />
      <TextField source="component.manufacturer" label="Manufacturer" />
      <BooleanField source="is_read" label="Read" />
      <DateField source="created_at" label="Created" showTime />
    </DatagridConfigurable>
  </List>
);

/**
 * Alert Show Page
 */
export const AlertShow: React.FC = () => (
  <Show>
    <SimpleShowLayout>
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Alert Header */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <AlertSeverityField source="severity" />
                <AlertTypeField source="alert_type" />
                <BooleanField source="is_read" label="Read" />
              </Box>
              <Typography variant="h5" gutterBottom>
                <TextField source="title" />
              </Typography>
            </Grid>

            {/* Alert Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Alert Information
              </Typography>
              <TextField source="title" label="Title" />
              <RichTextField source="message" label="Message" />
              <TextField source="action_url" label="Action URL" />
              <BooleanField source="is_actionable" label="Actionable" />
            </Grid>

            {/* Related Component */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Related Component
              </Typography>
              <TextField source="component.manufacturer_part_number" label="MPN" />
              <TextField source="component.manufacturer" label="Manufacturer" />
              <TextField source="component.category" label="Category" />
              <TextField source="component.description" label="Description" />
            </Grid>

            {/* Metadata */}
            <Grid item xs={12}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Metadata
              </Typography>
              <DateField source="created_at" label="Created At" showTime />
              <DateField source="acknowledged_at" label="Acknowledged At" showTime />
              <TextField source="acknowledged_by" label="Acknowledged By" />
            </Grid>

            {/* Full Message */}
            <Grid item xs={12}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Full Message
              </Typography>
              <Box
                sx={(theme) => ({
                  p: 2,
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                })}
              >
                <RichTextField source="message" />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </SimpleShowLayout>
  </Show>
);
