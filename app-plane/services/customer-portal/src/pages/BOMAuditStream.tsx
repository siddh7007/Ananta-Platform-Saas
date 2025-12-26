import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import { usePermissions } from 'react-admin';
import { supabase } from '../providers/dataProvider';

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
 * BOMAuditStream
 *
 * Customer-facing view over audit_logs focused on BOM-related events
 * for the current tenant. Allows drilling into the history for a
 * specific BOM via the `bomId` query parameter.
 */
export const BOMAuditStream: React.FC = () => {
  const location = useLocation();
  const { permissions } = usePermissions();
  const isAdmin =
    permissions === 'owner' || permissions === 'admin' || permissions === 'super_admin';
  const showDebugIds = useMemo(() => {
    try {
      return isAdmin && localStorage.getItem('cbp_show_debug_ids') === 'true';
    } catch {
      return false;
    }
  }, [isAdmin]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [category, setCategory] = useState<'all' | 'upload' | 'bom_enrichment' | 'component'>('all');

  // Tenant is enforced by RLS, but we can still filter locally by organization_id
  const tenantId = localStorage.getItem('organization_id') || undefined;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('audit_logs')
          .select('id, event_type, routing_key, timestamp, source, organization_id, event_data')
          .in('routing_key', [
            'customer.bom.uploaded',
            'customer.bom.upload_completed',
            'customer.bom.enrichment_started',
            'customer.bom.enrichment_progress',
            'customer.bom.enrichment_completed',
            'customer.bom.enrichment_failed',
            'enrichment.component.enriched',
            'enrichment.component.failed',
          ])
          .order('timestamp', { ascending: false })
          .limit(200);

        // Apply simple time range constraint
        const now = Date.now();
        let since: string | null = null;
        if (timeRange === '24h') {
          since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        } else if (timeRange === '7d') {
          since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (timeRange === '30d') {
          since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        if (since) {
          query = query.gte('timestamp', since);
        }

        if (tenantId) {
          query = query.eq('organization_id', tenantId);
        }

        const { data, error } = await query;

        if (error) throw error;

        setRows((data || []) as AuditLogRow[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load BOM audit stream';
        setError(message);
        // eslint-disable-next-line no-console
        console.error('[BOMAuditStream] Error loading audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [tenantId, timeRange]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const bomIdFilter = searchParams.get('bomId');

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Category filter
      if (category === 'upload') {
        if (!(row.routing_key === 'customer.bom.uploaded' || row.routing_key === 'customer.bom.upload_completed')) {
          return false;
        }
      } else if (category === 'bom_enrichment') {
        if (!row.routing_key.startsWith('customer.bom.enrichment_')) return false;
      } else if (category === 'component') {
        if (!row.routing_key.startsWith('enrichment.component.')) return false;
      }

      // BOM filter (from query string)
      if (bomIdFilter) {
        const data = row.event_data || {};
        const candidate = data.bom_id || data.job_id || data.upload_id || '';
        if (!String(candidate).startsWith(bomIdFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, category, bomIdFilter]);

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
              Failed to load BOM audit stream
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
          BOM Audit Trail
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Recent BOM upload and enrichment events for your organization.
        </Typography>
      </Box>

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
                  label={
                    showDebugIds
                      ? `Filtered by BOM ID prefix: ${bomIdFilter.substring(0, 8)}...`
                      : 'Filtered by selected BOM'
                  }
                  size="small"
                  color="info"
                />
              )}
            </Stack>
          </Box>
        </Stack>
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
                <TableCell>Time</TableCell>
                <TableCell>Routing Key</TableCell>
                <TableCell>Event Type</TableCell>
                <TableCell>BOM / Upload</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => {
                const data = row.event_data || {};
                const bomId = data.bom_id || data.job_id || data.upload_id || '';
                const status = data.state?.status || data.status || '';

                return (
                  <TableRow key={row.id} hover>
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
                      {showDebugIds && bomId ? (
                        <Typography variant="body2" fontFamily="monospace">
                          #{String(bomId).substring(0, 8)}...
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          BOM event
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {row.source || 'customer-portal'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {status ? (
                        <Chip
                          label={status}
                          size="small"
                          color={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'default'}
                        />
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          &nbsp;
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
