/**
 * EnrichmentQueueMetrics Component
 *
 * Displays enrichment queue statistics - pending, enriching, enriched, failed counts.
 * Also shows analysis status (started, analyzing, completed).
 * Visual summary of component enrichment progress.
 */

import React from 'react';
import { Box, Typography, Chip, LinearProgress, Tooltip, Divider } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { workflowStatusColors } from '../../theme';
import type { EnrichmentQueueMetrics as Metrics, AnalysisQueueMetrics } from '../../hooks/useEnrichmentQueue';

/**
 * Safely format a timestamp to local time string
 */
function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('[EnrichmentQueueMetrics] Invalid timestamp:', timestamp);
      return 'Invalid time';
    }
    return date.toLocaleTimeString();
  } catch (err) {
    console.warn('[EnrichmentQueueMetrics] Error formatting timestamp:', timestamp, err);
    return 'Invalid time';
  }
}

interface EnrichmentQueueMetricsProps {
  /** Enrichment metrics */
  metrics: Metrics;
  /** Analysis metrics */
  analysisMetrics?: AnalysisQueueMetrics;
  /** Compact display mode */
  compact?: boolean;
  /** Show analysis section */
  showAnalysis?: boolean;
}

export function EnrichmentQueueMetrics({
  metrics,
  analysisMetrics,
  compact = false,
  showAnalysis = true,
}: EnrichmentQueueMetricsProps) {
  const { total, pending, enriching, enriched, failed, notFound, percentComplete } = metrics;

  const completed = enriched + failed + notFound;
  const successRate = completed > 0 ? (enriched / completed) * 100 : 100;

  if (total === 0) return null;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title={`${pending} pending`}>
          <Chip
            icon={<HourglassEmptyIcon sx={{ fontSize: 14 }} />}
            label={pending}
            size="small"
            variant={pending > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        <Tooltip title={`${enriching} enriching`}>
          <Chip
            icon={<AutorenewIcon sx={{ fontSize: 14 }} />}
            label={enriching}
            size="small"
            color="primary"
            variant={enriching > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        <Tooltip title={`${enriched} enriched`}>
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={enriched}
            size="small"
            color="success"
            variant={enriched > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        {failed > 0 && (
          <Tooltip title={`${failed} failed`}>
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 14 }} />}
              label={failed}
              size="small"
              color="error"
              variant="filled"
              sx={{ minWidth: 50 }}
            />
          </Tooltip>
        )}
        {notFound > 0 && (
          <Tooltip title={`${notFound} not found`}>
            <Chip
              icon={<SearchOffIcon sx={{ fontSize: 14 }} />}
              label={notFound}
              size="small"
              color="warning"
              variant="filled"
              sx={{ minWidth: 50 }}
            />
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Enrichment Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            Enrichment Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {completed} / {total} components
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentComplete}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': {
              bgcolor:
                failed > 0 && enriched === 0
                  ? workflowStatusColors.failed
                  : workflowStatusColors.completed,
            },
          }}
        />
      </Box>

      {/* Metrics Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1,
        }}
      >
        {/* Pending */}
        <MetricBox
          icon={<HourglassEmptyIcon />}
          value={pending}
          label="Pending"
          active={pending > 0}
          color="default"
        />

        {/* Enriching */}
        <MetricBox
          icon={<AutorenewIcon />}
          value={enriching}
          label="Enriching"
          active={enriching > 0}
          color="primary"
          spinning={enriching > 0}
        />

        {/* Enriched */}
        <MetricBox
          icon={<CheckCircleIcon />}
          value={enriched}
          label="Enriched"
          active={enriched > 0}
          color="success"
        />

        {/* Failed */}
        <MetricBox
          icon={<ErrorIcon />}
          value={failed}
          label="Failed"
          active={failed > 0}
          color="error"
        />

        {/* Not Found */}
        <MetricBox
          icon={<SearchOffIcon />}
          value={notFound}
          label="Not Found"
          active={notFound > 0}
          color="warning"
        />
      </Box>

      {/* Success Rate */}
      {completed > 0 && (
        <Box sx={{ mt: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Enrichment Rate:{' '}
            <Typography
              component="span"
              variant="caption"
              fontWeight={600}
              color={
                successRate >= 80 ? 'success.main' : successRate >= 50 ? 'warning.main' : 'error.main'
              }
            >
              {successRate.toFixed(0)}%
            </Typography>
          </Typography>
        </Box>
      )}

      {/* Analysis Section */}
      {showAnalysis && analysisMetrics && (
        <>
          <Divider sx={{ my: 2 }} />
          <AnalysisSection metrics={analysisMetrics} />
        </>
      )}
    </Box>
  );
}

/**
 * Individual metric box component
 */
interface MetricBoxProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  active: boolean;
  color: 'default' | 'primary' | 'success' | 'error' | 'warning';
  spinning?: boolean;
}

function MetricBox({ icon, value, label, active, color, spinning = false }: MetricBoxProps) {
  const colorMap = {
    default: { bg: 'background.paper', border: active ? 'action.disabled' : 'divider', text: 'text.secondary', icon: 'action.disabled' },
    primary: { bg: active ? 'primary.50' : 'background.paper', border: active ? 'primary.main' : 'divider', text: 'primary.main', icon: 'action.disabled' },
    success: { bg: active ? 'success.50' : 'background.paper', border: active ? 'success.main' : 'divider', text: 'success.main', icon: 'action.disabled' },
    error: { bg: active ? 'error.50' : 'background.paper', border: active ? 'error.main' : 'divider', text: 'error.main', icon: 'action.disabled' },
    warning: { bg: active ? 'warning.50' : 'background.paper', border: active ? 'warning.main' : 'divider', text: 'warning.main', icon: 'action.disabled' },
  };

  const colors = colorMap[color];

  return (
    <Box
      sx={{
        textAlign: 'center',
        p: 1,
        bgcolor: colors.bg,
        borderRadius: 1,
        border: '1px solid',
        borderColor: colors.border,
      }}
    >
      <Box
        sx={{
          fontSize: 20,
          color: active ? colors.text : colors.icon,
          mb: 0.5,
          display: 'flex',
          justifyContent: 'center',
          '& svg': {
            fontSize: 20,
            animation: spinning ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          },
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="h6"
        fontWeight={700}
        color={active ? colors.text : 'text.disabled'}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Analysis section showing risk analysis status
 */
function AnalysisSection({ metrics }: { metrics: AnalysisQueueMetrics }) {
  const { status, startedAt, completedAt, riskScore, itemsAnalyzed } = metrics;

  const getStatusChip = () => {
    switch (status) {
      case 'analyzing':
        return (
          <Chip
            icon={<AutorenewIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
            label="Analyzing..."
            color="info"
            size="small"
          />
        );
      case 'completed':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Analysis Complete"
            color="success"
            size="small"
          />
        );
      case 'failed':
        return (
          <Chip
            icon={<ErrorIcon />}
            label="Analysis Failed"
            color="error"
            size="small"
          />
        );
      default:
        return (
          <Chip
            icon={<HourglassEmptyIcon />}
            label="Analysis Pending"
            variant="outlined"
            size="small"
          />
        );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon sx={{ fontSize: 20, color: 'info.main' }} />
          <Typography variant="body2" fontWeight={600}>
            Risk Analysis
          </Typography>
        </Box>
        {getStatusChip()}
      </Box>

      {status === 'completed' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
            mt: 1,
          }}
        >
          {riskScore !== undefined && (
            <Box
              sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight={700} color="info.main">
                {riskScore}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Risk Score
              </Typography>
            </Box>
          )}
          {itemsAnalyzed !== undefined && (
            <Box
              sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {itemsAnalyzed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Items Analyzed
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {startedAt && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Started: {formatTime(startedAt)}
          {completedAt && ` • Completed: ${formatTime(completedAt)}`}
        </Typography>
      )}
    </Box>
  );
}

export default EnrichmentQueueMetrics;
