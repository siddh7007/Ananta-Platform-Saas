/**
 * QueueProgressGrid Component
 *
 * CBP-style 4-column status display with progress bar
 * Shows: Pending | Processing | Completed | Failed
 */

import { Box, Grid, LinearProgress, Paper, Typography } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { keyframes } from '@mui/system';

export interface QueueProgressStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  successRate?: number;
}

export interface QueueProgressGridProps {
  stats: QueueProgressStats;
  label?: string;
  showSuccessRate?: boolean;
  unit?: string;
}

// Spin animation for processing icon
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Status colors matching CBP design
const STATUS_STYLES = {
  pending: {
    bg: '#f3f4f6',
    text: '#6b7280',
    border: '#e5e7eb',
    icon: HourglassEmptyIcon,
  },
  processing: {
    bg: '#dbeafe',
    text: '#1d4ed8',
    border: '#93c5fd',
    icon: AutorenewIcon,
  },
  completed: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    icon: CheckCircleIcon,
  },
  failed: {
    bg: '#fee2e2',
    text: '#dc2626',
    border: '#fca5a5',
    icon: ErrorIcon,
  },
};

interface StatusColumnProps {
  label: string;
  count: number;
  type: keyof typeof STATUS_STYLES;
  isActive?: boolean;
  unit?: string;
}

function StatusColumn({ label, count, type, isActive, unit = '' }: StatusColumnProps) {
  const style = STATUS_STYLES[type];
  const Icon = style.icon;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: style.bg,
        borderColor: style.border,
        textAlign: 'center',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: 1,
        },
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={0.5}>
        <Icon
          sx={{
            fontSize: 16,
            color: style.text,
            ...(isActive && type === 'processing' ? { animation: `${spin} 1.5s linear infinite` } : {}),
          }}
        />
        <Typography variant="caption" sx={{ color: style.text, fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ color: style.text, fontWeight: 700, lineHeight: 1 }}>
        {count}
        {unit && <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>{unit}</Typography>}
      </Typography>
    </Paper>
  );
}

export default function QueueProgressGrid({
  stats,
  label,
  showSuccessRate = false,
  unit = '',
}: QueueProgressGridProps) {
  // Calculate progress percentage
  const progressPercent = stats.total > 0
    ? Math.round(((stats.completed + stats.failed) / stats.total) * 100)
    : 0;

  // Determine if processing is active
  const isActive = stats.processing > 0;

  return (
    <Box>
      {/* Optional Label */}
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {label}
        </Typography>
      )}

      {/* Progress Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            bgcolor: '#e5e7eb',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              bgcolor: progressPercent === 100
                ? stats.failed > 0 ? '#f59e0b' : '#22c55e'
                : '#3b82f6',
              transition: 'transform 0.3s ease',
            },
          }}
          aria-label={`Progress: ${progressPercent}%`}
        />
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 45, textAlign: 'right' }}>
          {progressPercent}%
        </Typography>
      </Box>

      {/* 4-Column Grid */}
      <Grid container spacing={1}>
        <Grid item xs={6} sm={3}>
          <StatusColumn label="Pending" count={stats.pending} type="pending" unit={unit} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatusColumn label="Processing" count={stats.processing} type="processing" isActive={isActive} unit={unit} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatusColumn label="Completed" count={stats.completed} type="completed" unit={unit} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatusColumn label="Failed" count={stats.failed} type="failed" unit={unit} />
        </Grid>
      </Grid>

      {/* Success Rate */}
      {showSuccessRate && stats.successRate !== undefined && (
        <Box sx={{ mt: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Success Rate:{' '}
            <Typography
              component="span"
              variant="caption"
              sx={{
                fontWeight: 600,
                color: stats.successRate >= 90 ? '#22c55e' : stats.successRate >= 70 ? '#f59e0b' : '#ef4444',
              }}
            >
              {stats.successRate}%
            </Typography>
          </Typography>
        </Box>
      )}
    </Box>
  );
}
