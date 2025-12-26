/**
 * BOMResultsSummary Component
 *
 * Displays enrichment results summary with risk analysis, alerts, and quick actions.
 * Shows after enrichment completes on the unified BOM intake page.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  Paper,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import GavelIcon from '@mui/icons-material/Gavel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../../providers/dataProvider';
import { riskColors, getRiskLevel, gradeColors } from '../../theme';

interface BOMResultsSummaryProps {
  bomId: string;
  filename: string;
  totalComponents: number;
  enrichedCount: number;
  failedCount: number;
  onStartNew: () => void;
}

interface RiskSummary {
  overall_score: number;
  grade: string;
  factors: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  alerts_generated: number;
  high_risk_components: number;
}

interface ComponentBreakdown {
  production_ready: number;
  staging: number;
  needs_review: number;
  not_found: number;
}

export function BOMResultsSummary({
  bomId,
  filename,
  totalComponents,
  enrichedCount,
  failedCount,
  onStartNew,
}: BOMResultsSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [breakdown, setBreakdown] = useState<ComponentBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch risk analysis and breakdown
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);

        // Fetch BOM with risk analysis
        const { data: bomData, error: bomError } = await supabase
          .from('boms')
          .select('risk_score, risk_grade, risk_factors, metadata')
          .eq('id', bomId)
          .single();

        if (bomError) throw bomError;

        // Fetch alerts count for this BOM
        const { count: alertCount } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('bom_id', bomId);

        // Fetch component breakdown - quality_score is in specifications or metadata JSONB
        const { data: lineItems, error: lineError } = await supabase
          .from('bom_line_items')
          .select('enrichment_status, specifications, metadata')
          .eq('bom_id', bomId);

        if (lineError) {
          console.warn('[BOMResultsSummary] Failed to fetch line items:', lineError);
          // Don't throw - we can still show partial results
        }

        // Debug log for troubleshooting - only log if there's an issue
        if (lineError || (lineItems && lineItems.length === 0)) {
          console.warn('[BOMResultsSummary] Line items issue:', {
            bomId,
            count: lineItems?.length || 0,
            hasError: !!lineError,
            error: lineError?.message,
          });
        }

        // Calculate breakdown based on enrichment_status and quality from enrichment_data
        const componentBreakdown: ComponentBreakdown = {
          production_ready: 0,
          staging: 0,
          needs_review: 0,
          not_found: 0,
        };

        lineItems?.forEach((item) => {
          // Extract quality_score from specifications or metadata JSONB if available
          const qualityScore = item.specifications?.quality_score ?? item.metadata?.quality_score ?? null;
          const status = item.enrichment_status;

          if (status === 'enriched' || status === 'production' || (qualityScore !== null && qualityScore >= 80)) {
            componentBreakdown.production_ready++;
          } else if (status === 'staging' || (qualityScore !== null && qualityScore >= 50 && qualityScore < 80)) {
            componentBreakdown.staging++;
          } else if (status === 'not_found') {
            componentBreakdown.not_found++;
          } else if (status === 'failed') {
            componentBreakdown.needs_review++;
          } else {
            // Pending or unknown status
            componentBreakdown.needs_review++;
          }
        });

        // Log the breakdown with sample data for debugging
        console.log('[BOMResultsSummary] Component breakdown:', {
          ...componentBreakdown,
          lineItemCount: lineItems?.length || 0,
          sampleStatuses: lineItems?.slice(0, 3).map(i => i.enrichment_status),
        });

        // Count high risk components (low quality or failed)
        const highRiskCount = lineItems?.filter(item => {
          const qualityScore = item.specifications?.quality_score ?? item.metadata?.quality_score ?? null;
          const status = item.enrichment_status;
          // High risk if: failed, not_found, or low quality score
          return status === 'failed' || status === 'not_found' || (qualityScore !== null && qualityScore < 50);
        }).length || 0;

        setRiskSummary({
          overall_score: bomData?.risk_score || 0,
          grade: bomData?.risk_grade || 'N/A',
          factors: bomData?.risk_factors || {
            lifecycle: 0,
            supply_chain: 0,
            compliance: 0,
            obsolescence: 0,
            single_source: 0,
          },
          alerts_generated: alertCount || 0,
          high_risk_components: highRiskCount,
        });

        setBreakdown(componentBreakdown);
      } catch (err: any) {
        console.error('[BOMResultsSummary] Error fetching results:', err);
        setError(err.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    if (bomId) {
      fetchResults();
    }
  }, [bomId]);

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'error';
    if (score >= 40) return 'warning';
    return 'success';
  };

  const getGradeColor = (grade: string) => {
    return gradeColors[grade as keyof typeof gradeColors] || gradeColors.C;
  };

  if (loading) {
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ mr: 2 }} />
            <Typography>Analyzing results...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card
      sx={{
        mt: 2,
        border: '2px solid',
        borderColor: 'success.main',
        bgcolor: 'success.50',
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              BOM Processing Complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filename} • {totalComponents} components analyzed
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Risk Score Card */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AssessmentIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Risk Analysis
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: getGradeColor(riskSummary?.grade || 'C'),
                    color: 'white',
                  }}
                >
                  <Typography variant="h4" fontWeight={700}>
                    {riskSummary?.grade || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {riskSummary?.overall_score || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Risk Score
                  </Typography>
                </Box>
              </Box>

              {/* Risk Factors Mini */}
              <Stack spacing={0.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Lifecycle</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={riskSummary?.factors.lifecycle || 0}
                    sx={{ width: 80, height: 4, borderRadius: 1 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Supply Chain</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={riskSummary?.factors.supply_chain || 0}
                    color="warning"
                    sx={{ width: 80, height: 4, borderRadius: 1 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Compliance</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={riskSummary?.factors.compliance || 0}
                    color="success"
                    sx={{ width: 80, height: 4, borderRadius: 1 }}
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Enrichment Summary */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <InventoryIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Component Status
                </Typography>
              </Box>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Production Ready"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                  <Typography fontWeight={600}>{breakdown?.production_ready || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Chip
                    icon={<WarningIcon />}
                    label="Staging"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                  <Typography fontWeight={600}>{breakdown?.staging || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Chip
                    icon={<ErrorIcon />}
                    label="Needs Review"
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                  <Typography fontWeight={600}>{breakdown?.needs_review || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Chip
                    label="Not Found"
                    size="small"
                    variant="outlined"
                  />
                  <Typography fontWeight={600} color="text.secondary">
                    {breakdown?.not_found || 0}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Alerts & Actions */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NotificationsIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Alerts Generated
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h2" fontWeight={700} color={riskSummary?.alerts_generated ? 'warning.main' : 'text.secondary'}>
                  {riskSummary?.alerts_generated || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {riskSummary?.high_risk_components || 0} high-risk components
                </Typography>
              </Box>

              {riskSummary?.alerts_generated ? (
                <Button
                  component={RouterLink}
                  to="/alerts"
                  variant="outlined"
                  color="warning"
                  fullWidth
                  startIcon={<NotificationsIcon />}
                >
                  View Alerts
                </Button>
              ) : (
                <Alert severity="success" sx={{ py: 0.5 }}>
                  <Typography variant="caption">No critical alerts</Typography>
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Quick Actions */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Quick Actions
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            component={RouterLink}
            to={`/boms/${bomId}/show`}
            variant="contained"
            startIcon={<InventoryIcon />}
            endIcon={<OpenInNewIcon />}
          >
            View Full BOM Details
          </Button>
          <Button
            component={RouterLink}
            to="/risk-dashboard"
            variant="outlined"
            startIcon={<AssessmentIcon />}
          >
            Risk Dashboard
          </Button>
          <Button
            component={RouterLink}
            to="/alerts"
            variant="outlined"
            startIcon={<NotificationsIcon />}
          >
            Alert Center
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RefreshIcon />}
            onClick={onStartNew}
          >
            Upload Another BOM
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default BOMResultsSummary;
