/**
 * AnalysisQueueCard Component
 *
 * Separate card for Risk Analysis queue showing:
 * - Risk analysis status (Pending → Analyzing → Complete)
 * - High-risk component alerts
 * - Overall risk score when complete
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Divider,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Skeleton,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AssessmentIcon from '@mui/icons-material/Assessment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { AnalysisQueueMetrics } from '../../hooks/useEnrichmentQueue';
import { supabase } from '../../providers/dataProvider';

interface HighRiskComponent {
  id: string;
  mpn: string;
  manufacturer?: string;
  riskScore: number;
  riskFactors: string[];
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  componentMpn?: string;
}

interface AnalysisQueueCardProps {
  bomId: string;
  analysisMetrics: AnalysisQueueMetrics;
  /** Only show when enrichment is complete */
  enrichmentComplete: boolean;
}

export function AnalysisQueueCard({
  bomId,
  analysisMetrics,
  enrichmentComplete,
}: AnalysisQueueCardProps) {
  const [highRiskComponents, setHighRiskComponents] = useState<HighRiskComponent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch high-risk components and alerts when analysis completes
  useEffect(() => {
    if (analysisMetrics.status === 'completed' && bomId) {
      fetchRiskData();
    }
  }, [analysisMetrics.status, bomId]);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      // Fetch high-risk components (risk_score >= 60 or quality_score < 50)
      const { data: lineItems, error: lineError } = await supabase
        .from('bom_line_items')
        .select('id, manufacturer_part_number, manufacturer, specifications, metadata')
        .eq('bom_id', bomId);

      if (!lineError && lineItems) {
        const highRisk = lineItems
          .map(item => {
            const riskScore = item.specifications?.risk_score ?? item.metadata?.risk_score ?? 0;
            const qualityScore = item.specifications?.quality_score ?? item.metadata?.quality_score ?? 100;
            const lifecycleStatus = item.specifications?.lifecycle_status ?? item.metadata?.lifecycle_status;

            const riskFactors: string[] = [];
            if (riskScore >= 60) riskFactors.push('High Risk Score');
            if (qualityScore < 50) riskFactors.push('Low Quality');
            if (lifecycleStatus === 'obsolete' || lifecycleStatus === 'NRND') {
              riskFactors.push('End of Life');
            }
            if (item.specifications?.single_source) riskFactors.push('Single Source');

            return {
              id: item.id,
              mpn: item.manufacturer_part_number || 'Unknown',
              manufacturer: item.manufacturer,
              riskScore: Math.max(riskScore, 100 - qualityScore),
              riskFactors,
            };
          })
          .filter(item => item.riskFactors.length > 0)
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, 5); // Top 5 high-risk components

        setHighRiskComponents(highRisk);
      }

      // Fetch alerts for this BOM
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('id, alert_type, severity, message, component_mpn')
        .eq('bom_id', bomId)
        .order('severity', { ascending: false })
        .limit(5);

      if (!alertError && alertData) {
        setAlerts(alertData.map(a => ({
          id: a.id,
          type: a.alert_type,
          severity: a.severity,
          message: a.message,
          componentMpn: a.component_mpn,
        })));
      }
    } catch (err) {
      console.error('[AnalysisQueueCard] Error fetching risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't show until enrichment is complete or analysis has started
  if (!enrichmentComplete && analysisMetrics.status === 'pending') {
    return null;
  }

  const isAnalyzing = analysisMetrics.status === 'analyzing';
  const isComplete = analysisMetrics.status === 'completed';
  const isFailed = analysisMetrics.status === 'failed';
  const isPending = analysisMetrics.status === 'pending';

  return (
    <Card
      sx={{
        mt: 2,
        border: '2px solid',
        borderColor: isComplete
          ? 'info.main'
          : isFailed
          ? 'error.main'
          : isAnalyzing
          ? 'warning.main'
          : 'divider',
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnalyticsIcon
              color={isComplete ? 'info' : isAnalyzing ? 'warning' : 'disabled'}
              sx={{
                animation: isAnalyzing ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
            <Typography variant="h6">
              Analysis Queue
            </Typography>
          </Box>
          <Chip
            label={
              isPending ? 'Waiting...' :
              isAnalyzing ? 'Analyzing...' :
              isComplete ? 'Complete' : 'Failed'
            }
            size="small"
            color={
              isComplete ? 'info' :
              isAnalyzing ? 'warning' :
              isFailed ? 'error' : 'default'
            }
            variant={isPending ? 'outlined' : 'filled'}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Analysis Progress */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                Risk Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isComplete && analysisMetrics.itemsAnalyzed
                  ? `${analysisMetrics.itemsAnalyzed} items analyzed`
                  : isAnalyzing
                  ? 'Processing...'
                  : isPending
                  ? 'Waiting for enrichment...'
                  : 'Failed'}
              </Typography>
            </Box>
            <LinearProgress
              variant={isAnalyzing ? 'indeterminate' : 'determinate'}
              value={isComplete ? 100 : isFailed ? 100 : 0}
              color={isComplete ? 'info' : isFailed ? 'error' : 'warning'}
              sx={{
                height: 8,
                borderRadius: 1,
                bgcolor: 'action.disabledBackground',
              }}
            />
          </Box>

          {/* Status Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
            }}
          >
            {/* Pending */}
            <Box
              sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: isPending ? 'warning.50' : 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: isPending ? 'warning.main' : 'divider',
              }}
            >
              <HourglassEmptyIcon sx={{ fontSize: 18, color: isPending ? 'warning.main' : 'action.disabled' }} />
              <Typography variant="body2" fontWeight={600} color={isPending ? 'warning.main' : 'text.disabled'}>
                Pending
              </Typography>
            </Box>

            {/* Analyzing */}
            <Box
              sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: isAnalyzing ? 'warning.50' : 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: isAnalyzing ? 'warning.main' : 'divider',
              }}
            >
              <AnalyticsIcon
                sx={{
                  fontSize: 18,
                  color: isAnalyzing ? 'warning.main' : 'action.disabled',
                  animation: isAnalyzing ? 'spin 2s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
              <Typography variant="body2" fontWeight={600} color={isAnalyzing ? 'warning.main' : 'text.disabled'}>
                Analyzing
              </Typography>
            </Box>

            {/* Complete */}
            <Box
              sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: isComplete ? 'info.50' : 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: isComplete ? 'info.main' : 'divider',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 18, color: isComplete ? 'info.main' : 'action.disabled' }} />
              <Typography variant="body2" fontWeight={600} color={isComplete ? 'info.main' : 'text.disabled'}>
                Complete
              </Typography>
            </Box>
          </Box>

          {/* Overall Risk Score */}
          {isComplete && analysisMetrics.riskScore !== undefined && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Overall Risk Score
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={
                    analysisMetrics.riskScore >= 70 ? 'error.main' :
                    analysisMetrics.riskScore >= 40 ? 'warning.main' : 'success.main'
                  }
                >
                  {analysisMetrics.riskScore}
                </Typography>
                <Chip
                  label={
                    analysisMetrics.riskScore >= 70 ? 'High Risk' :
                    analysisMetrics.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'
                  }
                  size="small"
                  color={
                    analysisMetrics.riskScore >= 70 ? 'error' :
                    analysisMetrics.riskScore >= 40 ? 'warning' : 'success'
                  }
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* High Risk Components Section */}
        {isComplete && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningIcon sx={{ fontSize: 18, color: 'error.main' }} />
              <Typography variant="body2" fontWeight={600}>
                High Risk Components
              </Typography>
              {highRiskComponents.length > 0 && (
                <Chip label={highRiskComponents.length} size="small" color="error" />
              )}
            </Box>

            {loading ? (
              <Box sx={{ p: 1 }}>
                <Skeleton variant="rectangular" height={60} />
              </Box>
            ) : highRiskComponents.length > 0 ? (
              <Box
                sx={{
                  maxHeight: 180,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'error.200',
                  borderRadius: 1,
                  bgcolor: 'error.50',
                }}
              >
                <List dense disablePadding>
                  {highRiskComponents.map((comp, idx) => (
                    <ListItem
                      key={comp.id}
                      sx={{
                        borderBottom: idx < highRiskComponents.length - 1 ? '1px solid' : 'none',
                        borderColor: 'error.100',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={500}>
                            {comp.mpn}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {comp.riskFactors.map((factor, i) => (
                              <Chip
                                key={i}
                                label={factor}
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                            ))}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Alert severity="success" sx={{ py: 0.5 }}>
                <Typography variant="body2">No high-risk components detected</Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Alerts Section */}
        {isComplete && alerts.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <NotificationsActiveIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" fontWeight={600}>
                Alerts Generated
              </Typography>
              <Chip label={alerts.length} size="small" color="warning" />
            </Box>

            <Box
              sx={{
                maxHeight: 120,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'warning.200',
                borderRadius: 1,
              }}
            >
              <List dense disablePadding>
                {alerts.map((alert, idx) => (
                  <ListItem
                    key={alert.id}
                    sx={{
                      borderBottom: idx < alerts.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      bgcolor: alert.severity === 'critical' || alert.severity === 'high' ? 'error.50' : 'warning.50',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {alert.severity === 'critical' || alert.severity === 'high' ? (
                        <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                      ) : (
                        <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={500}>
                          {alert.type.replace(/_/g, ' ').toUpperCase()}
                        </Typography>
                      }
                      secondary={alert.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}

        {/* Quick Actions */}
        {isComplete && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/risk-dashboard"
              variant="contained"
              color="info"
              size="small"
              startIcon={<AssessmentIcon />}
            >
              Risk Dashboard
            </Button>
            <Button
              component={RouterLink}
              to="/alerts"
              variant="outlined"
              size="small"
              startIcon={<NotificationsActiveIcon />}
            >
              View All Alerts
            </Button>
          </Box>
        )}

        {/* Failed State */}
        {isFailed && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Risk analysis failed. Please try again or contact support.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default AnalysisQueueCard;
