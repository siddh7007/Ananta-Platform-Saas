import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  CircularProgress,
  Chip,
  Table,
  TableBody,
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
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
} from '@mui/icons-material';
import { CNS_API_BASE_URL, getAdminAuthHeaders } from '../config/api';
import { qualityColors, enrichmentStatusColors } from '../theme';

/**
 * CNS Analytics Dashboard
 *
 * Displays enrichment metrics, supplier usage, and BOM processing statistics.
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
  const [days] = useState(30);

  useEffect(() => {
    fetchDashboardData();
  }, [days]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${CNS_API_BASE_URL}/analytics/dashboard?days=${days}`, {
        headers: getAdminAuthHeaders(),
      });

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
  };

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
            color={enrichmentStatusColors.processing}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Components Processed"
            value={overview.total_components_processed.toLocaleString()}
            subtitle={`${overview.total_enriched_from_suppliers.toLocaleString()} from suppliers`}
            icon={<TrendingUpIcon />}
            color={enrichmentStatusColors.queued}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Enrichment Success"
            value={`${overview.enrichment_success_rate}%`}
            subtitle={`${overview.total_matched_from_catalog.toLocaleString()} from catalog`}
            icon={<CheckCircleIcon />}
            color={qualityColors.production}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Processing Time"
            value={`${Math.round(overview.avg_processing_time_ms)}ms`}
            subtitle="Per BOM job"
            icon={<CloudQueueIcon />}
            color={qualityColors.staging}
          />
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
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;
