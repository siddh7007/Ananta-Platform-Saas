/**
 * Platform Services Resource
 *
 * Manages admin views for platform services including endpoints, authentication,
 * quick actions, and category filtering.
 */

import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  FunctionField,
  Show,
  SimpleShowLayout,
  useRecordContext,
  Filter,
  SelectInput,
  SearchInput,
  TopToolbar,
  RefreshButton
} from 'react-admin';
import {
  Chip,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  Tooltip
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LinkIcon from '@mui/icons-material/Link';
import { Service, categoryMetadata } from '../config/services';

const categoryChoices = Object.entries(categoryMetadata).map(([id, meta]) => ({
  id,
  name: meta.label
}));

const enabledChoices = [
  { id: 'true', name: 'Enabled Only' },
  { id: 'false', name: 'Disabled Only' }
];

const parseEnabledFilter = (value: any) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value) === 'true';
};

const formatEnabledFilter = (value: any) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
};

/**
 * Category Field with the label/icon pair from metadata.
 */
export const CategoryField: React.FC<{ source?: string }> = ({ source = 'category' }) => {
  const record = useRecordContext<Service>();
  if (!record) return null;

  const category = record[source];
  const metadata = category ? categoryMetadata[category] : undefined;

  if (!metadata) {
    return <Chip label={category ?? 'Unknown'} size="small" />;
  }

  return (
    <Chip
      label={`${metadata.icon} ${metadata.label}`}
      size="small"
      sx={{ backgroundColor: '#f3f4f6', fontWeight: 500, minWidth: '140px' }}
    />
  );
};

/**
 * Displays the emoji icon with consistent sizing.
 */
export const ServiceIconField: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record) return null;

  return (
    <Box sx={{ fontSize: '24px', textAlign: 'center', width: '40px' }}>
      {record.icon}
    </Box>
  );
};

/**
 * Renders chips for direct and gateway URLs so the list view stays compact.
 */
const ServiceLinkChips: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record) return null;

  const open = (url: string) => window.open(url, '_blank', 'noopener');

  const chips: React.ReactNode[] = [];

  if (record.url && record.url.startsWith('http')) {
    chips.push(
      <Chip
        key="direct"
        label="Direct"
        size="small"
        variant="outlined"
        onClick={(event) => {
          event.stopPropagation();
          open(record.url!);
        }}
        sx={{ fontSize: '12px' }}
      />
    );
  }

  if (record.proxyUrl) {
    chips.push(
      <Chip
        key="gateway"
        label="Gateway"
        size="small"
        variant="outlined"
        icon={<LinkIcon fontSize="inherit" />}
        onClick={(event) => {
          event.stopPropagation();
          open(record.proxyUrl!);
        }}
        sx={{ fontSize: '12px' }}
      />
    );
  }

  if (!chips.length) {
    return <Typography variant="caption" color="text.secondary">-</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {chips}
    </Box>
  );
};

/**
 * Shows both direct and gateway endpoints in the show view.
 */
const ServiceEndpoints: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record) return null;

  const endpoints: Array<{ label: string; value: string }> = [];

  if (record.url) {
    endpoints.push({ label: 'Direct URL', value: record.url });
  }

  if (record.proxyUrl) {
    endpoints.push({ label: 'Gateway URL', value: record.proxyUrl });
  }

  if (!endpoints.length) {
    return <Typography variant="body2" color="text.secondary">No endpoints configured</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {endpoints.map((endpoint) => (
        <Typography key={endpoint.label} variant="body2">
          <strong>{endpoint.label}:</strong>{' '}
          <code>{endpoint.value}</code>
        </Typography>
      ))}
    </Box>
  );
};

/**
 * Displays the configured port when available.
 */
export const PortField: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record?.port) {
    return <Typography variant="caption" color="text.secondary">-</Typography>;
  }

  return (
    <Chip
      label={`:${record.port}`}
      size="small"
      variant="outlined"
      sx={{ fontFamily: 'monospace', fontSize: '12px' }}
    />
  );
};

/**
 * Shows the hex color preview used by the dashboard cards.
 */
export const ColorBadge: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record?.color) return null;

  return (
    <Box
      sx={{
        width: 40,
        height: 24,
        backgroundColor: record.color,
        borderRadius: 1,
        border: '1px solid #e5e7eb'
      }}
    />
  );
};

/**
 * Outputs credentials with formatting so they can be copied easily.
 */
const CredentialsDisplay: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record?.credentials) {
    return <Typography variant="body2">No credentials configured</Typography>;
  }

  const { username, password, apiKey, loginUrl, autoLogin } = record.credentials;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {username && (
        <Typography variant="body2">
          <strong>Username:</strong> <code>{username}</code>
        </Typography>
      )}
      {password && (
        <Typography variant="body2">
          <strong>Password:</strong> <code>{password}</code>
        </Typography>
      )}
      {apiKey && (
        <Typography variant="body2">
          <strong>API Key:</strong>{' '}
          <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{apiKey}</code>
        </Typography>
      )}
      {loginUrl && (
        <Typography variant="body2">
          <strong>Login URL:</strong> <code>{loginUrl}</code>
        </Typography>
      )}
      {autoLogin !== undefined && (
        <Typography variant="body2">
          <strong>Auto-Login:</strong> {autoLogin ? '✅ Enabled' : '❌ Disabled'}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Buttons for quick actions in list/show views.
 */
const ServiceActions: React.FC = () => {
  const record = useRecordContext<Service>();
  if (!record) return null;

  const openDirect = () => {
    if (record.url && record.url.startsWith('http')) {
      window.open(record.url, '_blank', 'noopener');
    }
  };

  const openGateway = () => {
    if (record.proxyUrl) {
      window.open(record.proxyUrl, '_blank', 'noopener');
    }
  };

  const copyCredentials = () => {
    if (!record.credentials) return;

    const lines = [
      `Service: ${record.name}`,
      record.url && `Direct URL: ${record.url}`,
      record.proxyUrl && `Gateway URL: ${record.proxyUrl}`,
      record.credentials.username && `Username: ${record.credentials.username}`,
      record.credentials.password && `Password: ${record.credentials.password}`,
      record.credentials.apiKey && `API Key: ${record.credentials.apiKey}`,
      record.credentials.loginUrl && `Login URL: ${record.credentials.loginUrl}`
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {record.url?.startsWith('http') && (
        <Button
          size="small"
          variant="contained"
          startIcon={<OpenInNewIcon />}
          onClick={openDirect}
          sx={{
            backgroundColor: record.color,
            '&:hover': { backgroundColor: record.color, opacity: 0.9 }
          }}
        >
          Open Direct
        </Button>
      )}
      {record.proxyUrl && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<LinkIcon />}
          onClick={openGateway}
        >
          Gateway
        </Button>
      )}
      {record.credentials && (
        <Tooltip title="Copy credentials to clipboard">
          <Button
            size="small"
            variant="outlined"
            startIcon={<VpnKeyIcon />}
            onClick={copyCredentials}
          >
            Copy Credentials
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};

/**
 * Shared filter bar for the list view.
 */
const ServiceFilter = (props: any) => (
  <Filter {...props}>
    <SearchInput source="q" alwaysOn placeholder="Search services..." />
    <SelectInput
      source="category"
      choices={categoryChoices}
      optionText="name"
      optionValue="id"
      allowEmpty
    />
    <SelectInput
      source="enabled"
      choices={enabledChoices}
      optionText="name"
      optionValue="id"
      allowEmpty
      parse={parseEnabledFilter}
      format={formatEnabledFilter}
    />
  </Filter>
);

const ListActions = () => (
  <TopToolbar>
    <RefreshButton />
  </TopToolbar>
);

export const PlatformServiceList = () => (
  <List
    filters={<ServiceFilter />}
    actions={<ListActions />}
    sort={{ field: 'category', order: 'ASC' }}
    perPage={50}
    exporter={false}
  >
    <Datagrid
      bulkActionButtons={false}
      rowClick="show"
      sx={{
        '& .RaDatagrid-headerCell': {
          fontWeight: 600,
          backgroundColor: '#f3f4f6'
        },
        '& .RaDatagrid-rowCell': {
          padding: '12px 8px'
        }
      }}
    >
      <FunctionField label="Icon" render={() => <ServiceIconField />} />
      <TextField source="name" label="Service Name" />
      <TextField source="description" label="Description" />
      <FunctionField label="Category" render={() => <CategoryField />} />
      <FunctionField label="Links" render={() => <ServiceLinkChips />} />
      <FunctionField label="Port" render={() => <PortField />} />
      <FunctionField label="Theme" render={() => <ColorBadge />} />
      <FunctionField label="Actions" render={() => <ServiceActions />} />
    </Datagrid>
  </List>
);

export const PlatformServiceShow = () => {
  const record = useRecordContext<Service>();

  return (
    <Show>
      <SimpleShowLayout>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ fontSize: '48px', mr: 2 }}>{record?.icon}</Box>
                  <Box>
                    <Typography variant="h5">{record?.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {record?.description}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Service Details</Typography>
                  <TextField source="id" label="Service ID" />
                  <FunctionField label="Category" render={() => <CategoryField />} />
                  <FunctionField label="Port" render={() => <PortField />} />
                  <FunctionField label="Endpoints" render={() => <ServiceEndpoints />} />
                  {record?.healthEndpoint && (
                    <TextField source="healthEndpoint" label="Health Endpoint" />
                  )}
                  {record?.notes && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      {record.notes}
                    </Alert>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <VpnKeyIcon sx={{ mr: 1 }} />
                  Authentication
                </Typography>

                {record?.credentials ? (
                  <Box sx={{ mt: 2 }}>
                    <CredentialsDisplay />
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    This service does not require authentication or uses SSO.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                <ServiceActions />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Configuration</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">SSO Required</Typography>
                    <Typography variant="body1">
                      {record?.requiresSSO ? '✅ Yes' : '❌ No'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Enabled</Typography>
                    <Typography variant="body1">
                      {record?.enabled ? '✅ Yes' : '❌ No'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Theme Color</Typography>
                    <Box sx={{ mt: 1 }}>
                      <ColorBadge />
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Health Check</Typography>
                    <Typography variant="body1">
                      {record?.healthEndpoint ? '✅ Configured' : '❌ None'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </SimpleShowLayout>
    </Show>
  );
};
