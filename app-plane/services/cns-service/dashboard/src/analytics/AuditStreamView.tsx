import React, { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Collapse,
  Tooltip,
  TextField,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import { CNS_API_URL, getAuthHeaders } from '../config/api';
import { useTenant } from '../contexts/TenantContext';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

interface AuditLogRow {
  id: string;
  event_type: string;
  routing_key: string;
  timestamp: string;
  source: string | null;
  organization_id: string | null;
  event_data: any;
}

/**
 * AuditStreamView
 *
 * Lightweight view over audit_logs focused on BOM upload + enrichment events.
 * Reads from the CNS admin API (backed by audit-logger persisting to Postgres)
 * and shows a reverse-chronological stream.
 */
export const AuditStreamView: React.FC = () => {
  const { tenantId, adminModeAllTenants } = useTenant();
  const location = useLocation();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [category, setCategory] = useState<'all' | 'upload' | 'bom_enrichment' | 'component'>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [uploadFilter, setUploadFilter] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          limit: '200',
          time_range: timeRange,
        });

        if (!adminModeAllTenants && tenantId) {
          params.set('organization_id', tenantId);
        }

        const headers: Record<string, string> = { Accept: 'application/json' };
        const authHeaders = getAuthHeaders();
        if (authHeaders) {
          if (authHeaders instanceof Headers) {
            authHeaders.forEach((value, key) => {
              headers[key] = value;
            });
          } else if (Array.isArray(authHeaders)) {
            authHeaders.forEach(([key, value]) => {
              headers[key] = value;
            });
          } else {
            Object.assign(headers, authHeaders as Record<string, string>);
          }
        }

        const response = await fetch(`${CNS_API_URL}/admin/audit/logs?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = (await response.json()) as AuditLogRow[];
        setRows(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audit stream';
        setError(message);
        // eslint-disable-next-line no-console
        console.error('[AuditStreamView] Error loading audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [tenantId, adminModeAllTenants, timeRange]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const bomIdFilter = searchParams.get('bomId');

  const filteredRows = useMemo(() => {
    const normalizeBomId = (value: string | null) => (value ? String(value).toLowerCase() : null);
    const normalizedBomFilter = normalizeBomId(bomIdFilter);
    const orgSearch = orgFilter.trim().toLowerCase();
    const projectSearch = projectFilter.trim().toLowerCase();
    const uploadSearch = uploadFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesCategory = (() => {
        if (category === 'all') return true;
        if (category === 'upload') {
          return row.routing_key === 'customer.bom.uploaded' || row.routing_key === 'customer.bom.upload_completed';
        }
        if (category === 'bom_enrichment') {
          return row.routing_key.startsWith('customer.bom.enrichment_');
        }
        if (category === 'component') {
          return row.routing_key.startsWith('enrichment.component.');
        }
        return true;
      })();

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedBomFilter) {
        return true;
      }

      const data = row.event_data || {};
      const candidateIds = [
        data.bom_id,
        data.job_id,
        data.upload_id,
        data.bomId,
        data.rtf_bom_id,
        data?.bom?.id,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      if (!candidateIds.some((candidate) => candidate.includes(normalizedBomFilter))) {
        return false;
      }

      if (orgSearch) {
        const orgCandidates = [row.organization_id, data.organization_id]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (!orgCandidates.some((candidate) => candidate.includes(orgSearch))) {
          return false;
        }
      }

      if (projectSearch) {
        const projectCandidates = [data.project_id]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (!projectCandidates.some((candidate) => candidate.includes(projectSearch))) {
          return false;
        }
      }

      if (uploadSearch) {
        const uploadCandidates = [data.upload_id, data.job_id, data.bom_id]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (!uploadCandidates.some((candidate) => candidate.includes(uploadSearch))) {
          return false;
        }
      }

      return true;
    });
  }, [rows, category, bomIdFilter, orgFilter, projectFilter, uploadFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const uploads = filteredRows.filter((r) =>
      r.routing_key === 'customer.bom.uploaded' || r.routing_key === 'customer.bom.upload_completed'
    ).length;
    const bomEnrichment = filteredRows.filter((r) => r.routing_key.startsWith('customer.bom.enrichment_')).length;
    const componentEvents = filteredRows.filter((r) => r.routing_key.startsWith('enrichment.component.')).length;

    const failures = filteredRows.filter((r) =>
      r.routing_key === 'customer.bom.enrichment_failed' || r.routing_key === 'enrichment.component.failed'
    ).length;

    return { total, uploads, bomEnrichment, componentEvents, failures };
  }, [filteredRows]);

  const renderIdChip = (value?: string | null, label?: string) => {
    if (!value) {
      return (
        <Typography variant="caption" color="textSecondary">
          n/a
        </Typography>
      );
    }

    const str = String(value);
    const display = str.length > 12 ? `${str.substring(0, 12)}…` : str;
    return (
      <Tooltip title={str} placement="top">
        <Chip
          label={label ? `${label}: ${display}` : display}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace' }}
        />
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="error" gutterBottom>
              Failed to load BOM event stream
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {error}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          BOM Upload & Enrichment Event Stream
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Stream of recent BOM upload and enrichment events from audit_logs
          (via RabbitMQ → Audit Logger).
        </Typography>
      </Box>

      {/* Filters and summary */}
      <Box mb={2}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Time Range
            </Typography>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) setTimeRange(value);
              }}
            >
              <ToggleButton value="24h">24h</ToggleButton>
              <ToggleButton value="7d">7d</ToggleButton>
              <ToggleButton value="30d">30d</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Category
            </Typography>
            <ToggleButtonGroup
              value={category}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) setCategory(value);
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="upload">Uploads</ToggleButton>
              <ToggleButton value="bom_enrichment">BOM Enrichment</ToggleButton>
              <ToggleButton value="component">Component Events</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Summary
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Total: ${stats.total}`} size="small" />
              <Chip label={`Uploads: ${stats.uploads}`} size="small" />
              <Chip label={`BOM events: ${stats.bomEnrichment}`} size="small" />
              <Chip label={`Component events: ${stats.componentEvents}`} size="small" />
              {stats.failures > 0 && (
                <Chip label={`Failures: ${stats.failures}`} size="small" color="error" />
              )}
              {bomIdFilter && (
                <Chip
                  label={`Filtered by BOM: ${bomIdFilter.length > 12 ? `${bomIdFilter.substring(0, 12)}…` : bomIdFilter}`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>
          </Box>
        </Stack>
        <Box mt={2} display="flex" gap={2} flexWrap="wrap">
          <TextField
            label="Organization ID"
            size="small"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            placeholder="Filter by org"
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Project ID"
            size="small"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="Filter by project"
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Upload / Job ID"
            size="small"
            value={uploadFilter}
            onChange={(e) => setUploadFilter(e.target.value)}
            placeholder="Filter by upload/job"
            sx={{ minWidth: 220 }}
          />
        </Box>
      </Box>

      {filteredRows.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="textSecondary" align="center">
              No BOM-related events found. Upload a BOM and start enrichment to see activity here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">&nbsp;</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Routing Key</TableCell>
                <TableCell>Event Type</TableCell>
                  <TableCell>BOM Name</TableCell>
                  <TableCell>BOM / Upload IDs</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Project</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => {
                const data = row.event_data || {};
                const bomId = data.bom_id || data.job_id || data.upload_id || '';
                const status = data.state?.status || data.status || '';
                const tenantChipLabel = row.organization_id ? row.organization_id : adminModeAllTenants ? 'All tenants' : tenantId ?? 'unknown';
                const isExpanded = expandedRowId === row.id;

                return (
                  <Fragment key={row.id}>
                    <TableRow hover>
                      <TableCell padding="checkbox">
                        <Tooltip title={isExpanded ? 'Collapse details' : 'Expand details'}>
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedRowId((current) => (current === row.id ? null : row.id));
                            }}
                            aria-label="toggle event details"
                          >
                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(row.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {row.routing_key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.event_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {row.event_data?.bom_name ? (
                          <Typography variant="body2" fontWeight={600}>
                            {row.event_data.bom_name}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            n/a
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="column" spacing={0.5} alignItems="flex-start">
                          {renderIdChip(bomId, 'BOM')}
                          {renderIdChip(data.upload_id, 'Upload')}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={tenantChipLabel} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {data.project_id ? (
                          <Chip label={data.project_id} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            n/a
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="textSecondary">
                          {row.source || 'unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {status ? (
                          <Chip label={status} size="small" color={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'default'} />
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            &nbsp;
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Event Payload
                            </Typography>
                            <Paper variant="outlined" sx={{ backgroundColor: '#111827', color: '#f9fafb', p: 2, maxHeight: 240, overflow: 'auto' }}>
                              <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                                {JSON.stringify(row.event_data ?? {}, null, 2)}
                              </pre>
                            </Paper>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
