/**
 * RiskAlertsTab Component
 *
 * Tab 3 of the Customer Portal - Risk Analysis dashboard and Alerts table
 * scoped by selected tenant/workspace.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SnoozeIcon from '@mui/icons-material/Snooze';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { API_CONFIG, getAuthHeaders } from '../../config/api';

export interface RiskAlertsTabProps {
  tenantId: string | null;
  workspaceId: string | null;
  /** When true, ignores tenant/workspace filters (admin mode) */
  adminModeAllTenants?: boolean;
}

export interface RiskAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  componentMpn: string;
  componentId: string;
  alertType: 'eol' | 'obsolete' | 'price_increase' | 'single_source' | 'lead_time' | 'compliance';
  bomId: string;
  bomName: string;
  createdAt: string;
  status: 'active' | 'acknowledged' | 'dismissed' | 'snoozed';
  details: string;
}

export interface RiskSummary {
  lifecycle: { high: number; medium: number; low: number; total: number };
  supplyChain: { high: number; medium: number; low: number; total: number };
  compliance: { high: number; medium: number; low: number; total: number };
}

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  high: { bg: '#fee2e2', text: '#dc2626', icon: <ErrorIcon sx={{ fontSize: 16, color: '#dc2626' }} /> },
  medium: { bg: '#fef3c7', text: '#d97706', icon: <WarningIcon sx={{ fontSize: 16, color: '#d97706' }} /> },
  low: { bg: '#dcfce7', text: '#166534', icon: <InfoIcon sx={{ fontSize: 16, color: '#166534' }} /> },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  eol: 'EOL Notice',
  obsolete: 'Obsolete',
  price_increase: 'Price Increase',
  single_source: 'Single Source',
  lead_time: 'Lead Time',
  compliance: 'Compliance Issue',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${diffWeeks}w ago`;
}

// Risk Summary Card Component
interface RiskSummaryCategoryCardProps {
  title: string;
  icon: React.ReactNode;
  data: { high: number; medium: number; low: number; total: number };
  description: string;
  loading?: boolean;
}

function RiskSummaryCategoryCard({ title, icon, data, description, loading }: RiskSummaryCategoryCardProps) {
  const dominantSeverity = data.high > 0 ? 'high' : data.medium > 0 ? 'medium' : 'low';
  const colors = SEVERITY_COLORS[dominantSeverity];

  if (loading) {
    return (
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width={80} height={40} />
          <Skeleton variant="text" width="80%" height={20} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: data.total > 0 ? colors.text : 'divider',
        borderWidth: data.total > 0 ? 2 : 1,
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {icon}
          <Typography variant="subtitle2" fontWeight={600} textTransform="uppercase">
            {title}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="baseline" mb={1}>
          {data.high > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <ErrorIcon sx={{ fontSize: 14, color: '#dc2626' }} />
              <Typography variant="body2" fontWeight={600} color="#dc2626">
                {data.high}
              </Typography>
            </Box>
          )}
          {data.medium > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <WarningIcon sx={{ fontSize: 14, color: '#d97706' }} />
              <Typography variant="body2" fontWeight={600} color="#d97706">
                {data.medium}
              </Typography>
            </Box>
          )}
          {data.low > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <InfoIcon sx={{ fontSize: 14, color: '#166534' }} />
              <Typography variant="body2" fontWeight={600} color="#166534">
                {data.low}
              </Typography>
            </Box>
          )}
          {data.total === 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />
              <Typography variant="body2" fontWeight={600} color="#22c55e">
                Clear
              </Typography>
            </Box>
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

// Alert Action Menu Component
interface AlertActionMenuProps {
  alert: RiskAlert;
  onAction: (alertId: string, action: 'view' | 'acknowledge' | 'dismiss' | 'snooze') => void;
}

function AlertActionMenu({ alert, onAction }: AlertActionMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: 'view' | 'acknowledge' | 'dismiss' | 'snooze') => {
    onAction(alert.id, action);
    handleClose();
  };

  return (
    <>
      <IconButton size="small" onClick={handleClick}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => handleAction('view')}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} /> View Details
        </MenuItem>
        {alert.status === 'active' && (
          <>
            <MenuItem onClick={() => handleAction('acknowledge')}>
              <CheckIcon fontSize="small" sx={{ mr: 1 }} /> Acknowledge
            </MenuItem>
            <MenuItem onClick={() => handleAction('snooze')}>
              <SnoozeIcon fontSize="small" sx={{ mr: 1 }} /> Snooze (7 days)
            </MenuItem>
            <MenuItem onClick={() => handleAction('dismiss')}>
              <CloseIcon fontSize="small" sx={{ mr: 1 }} /> Dismiss
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}

// Alerts Table Component
interface AlertsTableProps {
  alerts: RiskAlert[];
  loading: boolean;
  onAlertAction: (alertId: string, action: 'view' | 'acknowledge' | 'dismiss' | 'snooze') => void;
}

function AlertsTable({ alerts, loading, onAlertAction }: AlertsTableProps) {
  if (loading) {
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={100}>Severity</TableCell>
              <TableCell>Component</TableCell>
              <TableCell>Alert Type</TableCell>
              <TableCell>BOM</TableCell>
              <TableCell width={100}>Date</TableCell>
              <TableCell width={80} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton variant="text" width={60} /></TableCell>
                <TableCell><Skeleton variant="text" width={120} /></TableCell>
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={100} /></TableCell>
                <TableCell><Skeleton variant="text" width={60} /></TableCell>
                <TableCell><Skeleton variant="circular" width={24} height={24} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (alerts.length === 0) {
    return (
      <Box textAlign="center" py={6}>
        <CheckCircleIcon sx={{ fontSize: 48, color: '#22c55e', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No active alerts
        </Typography>
        <Typography variant="body2" color="text.disabled">
          All risks are under control
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={100}>Severity</TableCell>
            <TableCell>Component</TableCell>
            <TableCell>Alert Type</TableCell>
            <TableCell>BOM</TableCell>
            <TableCell width={100}>Date</TableCell>
            <TableCell width={80} align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {alerts.map((alert) => {
            const severity = SEVERITY_COLORS[alert.severity];
            return (
              <TableRow key={alert.id} hover>
                <TableCell>
                  <Chip
                    icon={severity.icon as React.ReactElement}
                    label={alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    size="small"
                    sx={{
                      bgcolor: severity.bg,
                      color: severity.text,
                      fontWeight: 600,
                      '& .MuiChip-icon': { color: severity.text },
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                    {alert.componentMpn}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
                    {alert.bomName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {formatRelativeTime(alert.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <AlertActionMenu alert={alert} onAction={onAlertAction} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function RiskAlertsTab({ tenantId, workspaceId, adminModeAllTenants = false }: RiskAlertsTabProps) {
  // State
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [page, setPage] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const limit = 10;
  const totalPages = Math.ceil(totalAlerts / limit);

  // Fetch risk summary with AbortController for request cancellation
  const fetchSummary = useCallback(async (signal?: AbortSignal) => {
    setSummaryLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_CONFIG.BASE_URL}/risk/summary`, window.location.origin);

      // Add filters (unless admin mode is bypassing tenant filter)
      if (!adminModeAllTenants) {
        if (tenantId) url.searchParams.set('organization_id', tenantId);
        if (workspaceId) url.searchParams.set('workspace_id', workspaceId);
      }

      console.log('[RiskAlertsTab] Fetching risk summary:', url.toString());

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        signal,
      });

      // Check if request was aborted
      if (signal?.aborted) return;

      if (!response.ok) {
        const errorText = `Failed to fetch risk summary: ${response.status} ${response.statusText}`;
        console.error('[RiskAlertsTab]', errorText);
        setError(errorText);
        setSummary(null);
        return;
      }

      const data = await response.json();
      console.log('[RiskAlertsTab] Risk summary fetched:', data);
      setSummary(data);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch risk summary';
      console.error('[RiskAlertsTab] Error fetching risk summary:', err);
      setError(errorMessage);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [tenantId, workspaceId, adminModeAllTenants]);

  // Fetch alerts with AbortController for request cancellation
  const fetchAlerts = useCallback(async (signal?: AbortSignal) => {
    setAlertsLoading(true);
    try {
      const url = new URL(`${API_CONFIG.BASE_URL}/alerts`, window.location.origin);

      // Add filters (unless admin mode is bypassing tenant filter)
      if (!adminModeAllTenants) {
        if (tenantId) url.searchParams.set('organization_id', tenantId);
        if (workspaceId) url.searchParams.set('workspace_id', workspaceId);
      }
      if (severityFilter !== 'all') url.searchParams.set('severity', severityFilter);
      // API uses offset-based pagination, not page-based
      url.searchParams.set('offset', String((page - 1) * limit));
      url.searchParams.set('limit', String(limit));

      console.log('[RiskAlertsTab] Fetching alerts:', url.toString());

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        signal,
      });

      // Check if request was aborted
      if (signal?.aborted) return;

      if (!response.ok) {
        const errorText = `Failed to fetch alerts: ${response.status} ${response.statusText}`;
        console.error('[RiskAlertsTab]', errorText);
        // Set error but don't overwrite summary error if it exists
        if (!error) setError(errorText);
        setAlerts([]);
        setTotalAlerts(0);
        return;
      }

      const data = await response.json();
      // API returns { items: [...], total: number, unread_count: number }
      const items = Array.isArray(data) ? data : (data.items || data.data || []);
      console.log('[RiskAlertsTab] Alerts fetched:', items.length, 'total:', data.total || items.length);
      setAlerts(items);
      setTotalAlerts(data.total || items.length);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      console.error('[RiskAlertsTab] Error fetching alerts:', err);
      setAlerts([]);
      setTotalAlerts(0);
    } finally {
      setAlertsLoading(false);
    }
  }, [tenantId, workspaceId, adminModeAllTenants, severityFilter, page]);

  // Refetch when filters change with AbortController cleanup
  useEffect(() => {
    const abortController = new AbortController();
    fetchSummary(abortController.signal);
    return () => abortController.abort();
  }, [fetchSummary]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchAlerts(abortController.signal);
    return () => abortController.abort();
  }, [fetchAlerts]);

  // Handle alert actions
  const handleAlertAction = useCallback(
    async (alertId: string, action: 'view' | 'acknowledge' | 'dismiss' | 'snooze') => {
      if (action === 'view') {
        // TODO: Open component detail or navigate
        console.log('View alert:', alertId);
        return;
      }

      try {
        const url = `${API_CONFIG.BASE_URL}/alerts/${alertId}/${action}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: action === 'snooze' ? JSON.stringify({ days: 7 }) : undefined,
        });

        if (!response.ok) {
          console.error(`Failed to ${action} alert:`, response.status);
          return;
        }

        // Refresh alerts after action
        fetchAlerts();
      } catch (error) {
        console.error(`Error ${action}ing alert:`, error);
      }
    },
    [fetchAlerts]
  );

  // Handle bulk actions
  const handleExportAlerts = () => {
    // TODO: Implement CSV export
    console.log('Export alerts');
  };

  const handleMarkAllAcknowledged = async () => {
    // TODO: Implement bulk acknowledge
    console.log('Mark all as acknowledged');
  };

  // Scope indicator
  const scopeText = useMemo(() => {
    if (adminModeAllTenants) return 'All tenants (Admin Mode)';
    if (!tenantId) return 'All tenants';
    const tenantPart = `Tenant: ${tenantId.substring(0, 8)}...`;
    const workspacePart = workspaceId ? ` / Workspace: ${workspaceId.substring(0, 8)}...` : '';
    return tenantPart + workspacePart;
  }, [tenantId, workspaceId, adminModeAllTenants]);

  return (
    <Box>
      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Risk Summary Dashboard */}
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Risk Summary
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <RiskSummaryCategoryCard
            title="Lifecycle Risk"
            icon={<ErrorIcon sx={{ color: '#dc2626' }} />}
            data={summary?.lifecycle || { high: 0, medium: 0, low: 0, total: 0 }}
            description="EOL, NRND, and obsolete components"
            loading={summaryLoading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <RiskSummaryCategoryCard
            title="Supply Chain"
            icon={<WarningIcon sx={{ color: '#d97706' }} />}
            data={summary?.supplyChain || { high: 0, medium: 0, low: 0, total: 0 }}
            description="Single-source and limited availability"
            loading={summaryLoading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <RiskSummaryCategoryCard
            title="Compliance"
            icon={<CheckCircleIcon sx={{ color: '#22c55e' }} />}
            data={summary?.compliance || { high: 0, medium: 0, low: 0, total: 0 }}
            description="RoHS, REACH, and regulatory issues"
            loading={summaryLoading}
          />
        </Grid>
      </Grid>

      {/* Alerts Section */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={600}>
          Active Alerts
        </Typography>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Export alerts to CSV">
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportAlerts}
            >
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Mark all visible alerts as acknowledged">
            <Button
              variant="outlined"
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllAcknowledged}
            >
              Mark All
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Severity Filter */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1}>
          {(['all', 'high', 'medium', 'low'] as SeverityFilter[]).map((sev) => (
            <Chip
              key={sev}
              label={sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
              color={severityFilter === sev ? (sev === 'all' ? 'primary' : 'default') : 'default'}
              variant={severityFilter === sev ? 'filled' : 'outlined'}
              onClick={() => {
                setSeverityFilter(sev);
                setPage(1);
              }}
              sx={{
                cursor: 'pointer',
                ...(severityFilter === sev && sev !== 'all'
                  ? {
                      bgcolor: SEVERITY_COLORS[sev].bg,
                      color: SEVERITY_COLORS[sev].text,
                      borderColor: SEVERITY_COLORS[sev].text,
                    }
                  : {}),
              }}
            />
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Results scoped to: {scopeText}
        </Typography>
      </Box>

      {/* Alerts Table */}
      <AlertsTable alerts={alerts} loading={alertsLoading} onAlertAction={handleAlertAction} />

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
          <Typography variant="caption" color="text.secondary">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalAlerts)} of {totalAlerts} alerts
          </Typography>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Box>
  );
}
