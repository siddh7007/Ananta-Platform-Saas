/**
 * Docker Container Management Resource
 *
 * Provides complete container management capabilities:
 * - Real-time container status
 * - CPU and memory stats
 * - Start/Stop/Restart/Kill actions
 * - Container logs viewer
 * - Health monitoring
 */

import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
  Show,
  SimpleShowLayout,
  useRecordContext,
  useRefresh,
  useNotify,
  TopToolbar,
  RefreshButton,
  SearchInput
} from 'react-admin';
import {
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import TerminalIcon from '@mui/icons-material/Terminal';

// Container status colors matching V1 design
const STATUS_COLORS = {
  running: { bg: '#22c55e', text: '#ffffff', label: 'Running' },  // GREEN
  exited: { bg: '#ef4444', text: '#ffffff', label: 'Stopped' },    // RED
  restarting: { bg: '#3b82f6', text: '#ffffff', label: 'Restarting' }, // BLUE
  paused: { bg: '#eab308', text: '#000000', label: 'Paused' },     // YELLOW
  dead: { bg: '#7f1d1d', text: '#ffffff', label: 'Dead' }          // DARK RED
};

// Health status colors
const HEALTH_COLORS = {
  healthy: { bg: '#22c55e', text: '#ffffff', label: 'Healthy' },   // GREEN
  unhealthy: { bg: '#ef4444', text: '#ffffff', label: 'Unhealthy' }, // RED
  starting: { bg: '#3b82f6', text: '#ffffff', label: 'Starting' },  // BLUE
  none: { bg: '#6b7280', text: '#ffffff', label: 'No Health Check' } // GRAY
};

interface Container {
  Name: string;
  Service: string;
  State: string;
  Status: string;
  stats?: {
    cpu_percent: number;
    memory_usage_mb: number;
    memory_limit_mb: number;
    memory_percent: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
  };
}

/**
 * Container Status Field with color-coded badges
 */
export const ContainerStatusField: React.FC<{ source?: string; label?: string }> = ({ source = 'State' }) => {
  const record = useRecordContext<Container>();
  if (!record) return null;

  const status = record[source] || 'unknown';
  const config = STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.exited;

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        backgroundColor: config.bg,
        color: config.text,
        fontWeight: 600,
        minWidth: '90px'
      }}
    />
  );
};

/**
 * CPU Usage Field with progress bar
 */
export const CPUField: React.FC = () => {
  const record = useRecordContext<Container>();
  if (!record?.stats) return <span>N/A</span>;

  const cpu = record.stats.cpu_percent;
  const color = cpu > 80 ? 'error' : cpu > 50 ? 'warning' : 'success';

  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption">{cpu.toFixed(1)}%</Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(cpu, 100)}
        color={color}
        sx={{ height: 6, borderRadius: 1, mt: 0.5 }}
      />
    </Box>
  );
};

/**
 * Memory Usage Field with progress bar
 */
export const MemoryField: React.FC = () => {
  const record = useRecordContext<Container>();
  if (!record?.stats) return <span>N/A</span>;

  const memPercent = record.stats.memory_percent;
  const memUsageMB = record.stats.memory_usage_mb;
  const color = memPercent > 80 ? 'error' : memPercent > 50 ? 'warning' : 'success';

  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption">
        {memUsageMB.toFixed(0)} MB ({memPercent.toFixed(1)}%)
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(memPercent, 100)}
        color={color}
        sx={{ height: 6, borderRadius: 1, mt: 0.5 }}
      />
    </Box>
  );
};

/**
 * Container Actions Component
 */
const ContainerActions: React.FC = () => {
  const record = useRecordContext<Container>();
  const refresh = useRefresh();
  const notify = useNotify();
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [logs, setLogs] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  if (!record) return null;

  const serviceName = record.Service || record.Name.replace('components-v2-', '');
  const isRunning = record.State === 'running';

  const performAction = async (action: string) => {
    setActionLoading(action);
    try {
      const backendUrl = 'http://localhost:27200';
      const method = action === 'kill' ? 'DELETE' : 'POST';

      const response = await fetch(`${backendUrl}/api/docker/${action}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName })
      });

      const data = await response.json();

      if (response.ok) {
        notify(data.message || `${action} completed successfully`, { type: 'success' });
        // Refresh list after 2 seconds
        setTimeout(() => refresh(), 2000);
      } else {
        notify(data.error || `Failed to ${action}`, { type: 'error' });
      }
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`http://localhost:27200/api/docker/logs?service=${serviceName}&tail=100`);
      const data = await response.json();
      setLogs(data.logs || 'No logs available');
      setLogsOpen(true);
    } catch (error: any) {
      setLogs(`Error fetching logs: ${error.message}`);
      setLogsOpen(true);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {isRunning ? (
          <>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<StopIcon />}
              onClick={() => performAction('stop')}
              disabled={actionLoading === 'stop'}
            >
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="info"
              startIcon={<RestartAltIcon />}
              onClick={() => performAction('restart')}
              disabled={actionLoading === 'restart'}
            >
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => {
                if (window.confirm(`Force kill ${serviceName}? This will terminate the container immediately.`)) {
                  performAction('kill');
                }
              }}
              disabled={actionLoading === 'kill'}
            >
              {actionLoading === 'kill' ? 'Killing...' : 'Kill'}
            </Button>
          </>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<PlayArrowIcon />}
            onClick={() => performAction('start')}
            disabled={actionLoading === 'start'}
          >
            {actionLoading === 'start' ? 'Starting...' : 'Start'}
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<TerminalIcon />}
          onClick={fetchLogs}
        >
          Logs
        </Button>
      </Box>

      {/* Logs Dialog */}
      <Dialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Container Logs: {serviceName}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              backgroundColor: '#1e1e1e',
              color: '#22c55e',
              fontFamily: 'monospace',
              fontSize: '12px',
              padding: 2,
              borderRadius: 1,
              maxHeight: '60vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {logs}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => fetchLogs()}>Refresh</Button>
          <Button onClick={() => setLogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * Container List View
 */
const containerFilters = [
  <SearchInput source="q" alwaysOn placeholder="Search containers..." />
];

const ListActions = () => (
  <TopToolbar>
    <RefreshButton />
  </TopToolbar>
);

export const ContainerList = () => (
  <List
    filters={containerFilters}
    actions={<ListActions />}
    sort={{ field: 'Name', order: 'ASC' }}
    perPage={25}
    exporter={false}
  >
    <Datagrid
      bulkActionButtons={false}
      rowClick="show"
      sx={{
        '& .RaDatagrid-headerCell': {
          fontWeight: 600,
          backgroundColor: '#f3f4f6'
        }
      }}
    >
      <TextField source="Service" label="Service Name" />
      <TextField source="Name" label="Container Name" />
      <ContainerStatusField source="State" label="Status" />
      <FunctionField label="CPU Usage" render={CPUField} />
      <FunctionField label="Memory Usage" render={MemoryField} />
      <FunctionField label="Actions" render={ContainerActions} />
    </Datagrid>
  </List>
);

/**
 * Container Show View with detailed stats
 */
export const ContainerShow = () => (
  <Show>
    <SimpleShowLayout>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Container Information</Typography>
              <TextField source="Name" label="Container Name" />
              <TextField source="Service" label="Service Name" />
              <TextField source="Id" label="Container ID" />
              <ContainerStatusField source="State" label="Status" />
              <TextField source="Status" label="Status Details" />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Resource Usage</Typography>
              <FunctionField label="CPU Usage" render={CPUField} />
              <FunctionField label="Memory Usage" render={MemoryField} />
              <FunctionField
                label="Network RX"
                render={(record: Container) =>
                  record?.stats
                    ? `${(record.stats.network_rx_bytes / 1024 / 1024).toFixed(2)} MB`
                    : 'N/A'
                }
              />
              <FunctionField
                label="Network TX"
                render={(record: Container) =>
                  record?.stats
                    ? `${(record.stats.network_tx_bytes / 1024 / 1024).toFixed(2)} MB`
                    : 'N/A'
                }
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Container Actions</Typography>
              <ContainerActions />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </SimpleShowLayout>
  </Show>
);
