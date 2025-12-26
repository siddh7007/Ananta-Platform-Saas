import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  CircularProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
    Button,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
} from '@mui/icons-material';

/**
 * CNS Analytics Dashboard
 *
 * Displays enrichment metrics, supplier usage, and BOM processing statistics.
 *
 * Features:
 * - Real-time enrichment statistics
 * - Supplier usage breakdown
 * - Quality routing visualization
 * - Recent BOM jobs with enrichment details
 * - Time series trends
 */

interface EnrichmentStats {
  total_bom_jobs: number;
  total_components_processed: number;
  total_enriched_from_suppliers: number;
  total_matched_from_catalog: number;
  total_failed_enrichment: number;
  enrichment_success_rate: number;
  avg_processing_time_ms: number;
}

interface QualityRoutingStats {
  production: number;
  staging: number;
  rejected: number;
  failed: number;
  total: number;
  production_rate: number;
  staging_rate: number;
  rejection_rate: number;
}

interface SupplierUsageStats {
  supplier_name: string;
  components_enriched: number;
  percentage: number;
}

interface BOMJobSummary {
  job_id: string;
  customer_id?: number;
  customer_name?: string;
  filename: string;
  total_items: number;
  items_auto_approved: number;
  items_in_staging: number;
  items_rejected: number;
  items_failed: number;
  processing_time_ms?: number;
  started_at?: string;
  completed_at?: string;
  enrichment_stats?: {
    matched_existing: number;
    newly_imported: number;
    import_failed: number;
    vendors_used: Record<string, number>;
  };
}

interface DashboardData {
  overview: EnrichmentStats;
  quality_routing: QualityRoutingStats;
  supplier_usage: SupplierUsageStats[];
  recent_jobs: BOMJobSummary[];
}

interface MappingGaps {
  rows_count: number;
  sample_rows: { source_id?: string; source_path?: string; gap_reason?: string }[];
  report_path?: string;
  last_modified?: string | null;
}

const CNS_API_BASE_URL = process.env.NEXT_PUBLIC_CNS_API_URL || 'http://localhost:27800/api';
const ADMIN_API_TOKEN = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || '';

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <Card elevation={2}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography color="textSecondary" variant="overline" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div" gutterBottom>
            {value}
          </Typography>
          {subtitle && (
            <Typography color="textSecondary" variant="body2">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}20`,
            borderRadius: 2,
            p: 1.5,
            color: color,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Main Analytics Dashboard
 */
export const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mappingGaps, setMappingGaps] = useState<MappingGaps | null>(null);
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${CNS_API_BASE_URL}/analytics/dashboard?days=${days}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const fetchMappingGaps = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
      const res = await fetch(`${CNS_API_BASE_URL}/admin/mapping-gaps`, { headers });
      if (!res.ok) {
        setMappingGaps(null);
        return;
      }
      const json = await res.json();
      setMappingGaps(json as MappingGaps);
    } catch (err) {
      console.error('Failed to fetch mapping gaps', err);
      setMappingGaps(null);
    }
  }, []);

  const fetchAdminEvents = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
      const res = await fetch(`${CNS_API_BASE_URL}/admin/audit/logs?time_range=24h&limit=5`, { headers });
      if (!res.ok) {
        setAdminEvents([]);
        return;
      }
      const json = await res.json();
      const filtered = (json || []).filter((ev: any) => ev.routing_key && ev.routing_key.startsWith('admin.'));
      setAdminEvents(filtered);
    } catch (err) {
      console.error('Failed to fetch admin events', err);
      setAdminEvents([]);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchMappingGaps();
    fetchAdminEvents();
  }, [fetchDashboardData, fetchMappingGaps, fetchAdminEvents]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Card>
          <CardContent>
            <Typography color="error" variant="h6">
              Error loading analytics
            </Typography>
            <Typography color="textSecondary">{error}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  const { overview, quality_routing, supplier_usage, recent_jobs } = data;

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          CNS Analytics Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Component enrichment metrics and BOM processing statistics
        </Typography>
      </Box>

      {/* Overview Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="BOM Jobs Processed"
            value={overview.total_bom_jobs.toLocaleString()}
            subtitle={`Last ${days} days`}
            icon={<StorageIcon />}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Components Processed"
            value={overview.total_components_processed.toLocaleString()}
            subtitle={`${overview.total_enriched_from_suppliers.toLocaleString()} from suppliers`}
            icon={<TrendingUpIcon />}
            color="#8b5cf6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Enrichment Success"
            value={`${overview.enrichment_success_rate}%`}
            subtitle={`${overview.total_matched_from_catalog.toLocaleString()} from catalog`}
            icon={<CheckCircleIcon />}
            color="#22c55e"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Processing Time"
            value={`${Math.round(overview.avg_processing_time_ms)}ms`}
            subtitle="Per BOM job"
            icon={<CloudQueueIcon />}
            color="#facc15"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="textSecondary" variant="overline" gutterBottom>
                    Mapping Gaps
                  </Typography>
                  <Typography variant="h4" component="div" gutterBottom>
                    {mappingGaps ? mappingGaps.rows_count.toLocaleString() : '—'}
                  </Typography>
                  <Typography color="textSecondary" variant="body2">
                    Last modified: {mappingGaps && mappingGaps.last_modified ? new Date(mappingGaps.last_modified).toLocaleString() : '—'}
                  </Typography>
                </Box>
                <Box sx={{ backgroundColor: '#ef444420', borderRadius: 2, p: 1.5, color: '#ef4444' }}>
                  <ErrorIcon />
                </Box>
              </Box>
              {mappingGaps && mappingGaps.sample_rows && mappingGaps.sample_rows.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2">Sample rows</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Source ID</TableCell>
                          <TableCell>Source Path</TableCell>
                          <TableCell>Gap Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mappingGaps.sample_rows.map((r, i) => (
                          <TableRow key={i} hover>
                            <TableCell>{r.source_id || '-'}</TableCell>
                            <TableCell>{r.source_path || '-'}</TableCell>
                            <TableCell>{r.gap_reason || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
                <Box mt={2} display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    disabled={!mappingGaps || mappingGaps.rows_count === 0}
                    onClick={async () => {
                      try {
                        const headers: Record<string, string> = {};
                        if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
                        const res = await fetch(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, { headers });
                        if (!res.ok) {
                          window.open(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, '_blank', 'noopener');
                          return;
                        }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = mappingGaps?.report_path?.split('/').pop() || 'mapping_gaps.csv';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('Download failed', err);
                        window.open(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, '_blank', 'noopener');
                      }
                    }}
                  >
                    Download CSV
                  </Button>
                </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Quality Routing */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quality Routing
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Component routing based on quality scores
              </Typography>

              <Box mt={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">
                    Production (≥95%)
                  </Typography>
                  <Chip
                    label={`${quality_routing.production_rate}%`}
                    size="small"
                    color="success"
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={quality_routing.production_rate}
                  color="success"
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">
                    Staging (70-94%)
                  </Typography>
                  <Chip
                    label={`${quality_routing.staging_rate}%`}
                    size="small"
                    color="warning"
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={quality_routing.staging_rate}
                  color="warning"
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">
                    Rejected (&lt;70%)
                  </Typography>
                  <Chip
                    label={`${quality_routing.rejection_rate}%`}
                    size="small"
                    color="error"
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={quality_routing.rejection_rate}
                  color="error"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Box mt={3} display="flex" justifyContent="space-around">
                <Box textAlign="center">
                  <Typography variant="h5" color="success.main">
                    {quality_routing.production.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Auto-Approved
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h5" color="warning.main">
                    {quality_routing.staging.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Manual Review
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h5" color="error.main">
                    {quality_routing.rejected.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Rejected
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Supplier Usage */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Supplier API Usage
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Component enrichment by supplier
              </Typography>

              {supplier_usage.length > 0 ? (
                <Box mt={2}>
                  {supplier_usage.map((supplier, index) => (
                    <Box key={index} mb={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {supplier.supplier_name}
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center">
                          <Typography variant="body2" color="textSecondary">
                            {supplier.components_enriched.toLocaleString()} components
                          </Typography>
                          <Chip
                            label={`${supplier.percentage}%`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={supplier.percentage}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box mt={2} textAlign="center" py={4}>
                  <Typography color="textSecondary">
                    No supplier enrichment data available
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Configure supplier APIs to enable enrichment
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent BOM Jobs */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent BOM Jobs
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Latest BOM processing jobs with enrichment statistics
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Filename</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Total Items</TableCell>
                      <TableCell align="right">Matched Existing</TableCell>
                      <TableCell align="right">Newly Imported</TableCell>
                      <TableCell align="right">Failed</TableCell>
                      <TableCell align="right">Processing Time</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent_jobs.map((job) => (
                      <TableRow key={job.job_id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {job.filename}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {job.customer_name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{job.total_items}</TableCell>
                        <TableCell align="right">
                          {job.enrichment_stats?.matched_existing || 0}
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="primary" variant="body2" fontWeight={600}>
                            {job.enrichment_stats?.newly_imported || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="error" variant="body2">
                            {job.enrichment_stats?.import_failed || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {job.processing_time_ms ? `${job.processing_time_ms}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${job.items_auto_approved} approved`}
                            size="small"
                            color="success"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        {/* Admin Event Logs */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Admin Events
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Recent admin events (mapping gaps, workflow notices)
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Event</TableCell>
                      <TableCell>Routing Key</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adminEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No admin events in the last 24 hours
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminEvents.map((ev, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}</TableCell>
                          <TableCell>{ev.event_type}</TableCell>
                          <TableCell>{ev.routing_key}</TableCell>
                          <TableCell>
                            {ev.event_data && ev.event_data.report_path ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={async () => {
                                  try {
                                    const headers: Record<string, string> = {};
                                    if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
                                    const res = await fetch(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, { headers });
                                    if (!res.ok) {
                                      window.open(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, '_blank', 'noopener');
                                      return;
                                    }
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = ev.event_data.report_path.split('/').pop() || 'mapping_gaps.csv';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(url);
                                  } catch (err) {
                                    console.error('Download failed', err);
                                    window.open(`${CNS_API_BASE_URL}/admin/mapping-gaps/download`, '_blank', 'noopener');
                                  }
                                }}
                              >
                                Download CSV
                              </Button>
                            ) : (
                              <Typography variant="caption" color="textSecondary">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;
