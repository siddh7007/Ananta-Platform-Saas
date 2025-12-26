/**
 * EnrichmentStats Component
 *
 * Detailed statistics cards for enrichment progress.
 * Shows success/failed counts, timing info, and quality metrics.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Stack,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  Schedule,
  Speed,
  TrendingUp,
  Search as SearchOffIcon,
} from '@mui/icons-material';
import type { EnrichmentState } from '../../../hooks/useEnrichmentStream';

interface EnrichmentStatsProps {
  state: EnrichmentState | null;
  showTiming?: boolean;
  showQuality?: boolean;
  variant?: 'detailed' | 'compact';
}

export const EnrichmentStats: React.FC<EnrichmentStatsProps> = ({
  state,
  showTiming = true,
  showQuality = true,
  variant = 'detailed',
}) => {
  if (!state) {
    return null;
  }

  const {
    total_items = 0,
    enriched_items = 0,
    failed_items = 0,
    not_found_items = 0,
    pending_items = 0,
    started_at,
    completed_at,
    status,
  } = state;

  // Calculate metrics
  const processedItems = enriched_items + failed_items + (not_found_items || 0);
  const successRate = processedItems > 0 ? (enriched_items / processedItems) * 100 : 0;
  const failureRate = processedItems > 0 ? ((failed_items + (not_found_items || 0)) / processedItems) * 100 : 0;

  // Calculate timing
  const startTime = started_at ? new Date(started_at).getTime() : null;
  const endTime = completed_at ? new Date(completed_at).getTime() : Date.now();
  const elapsed = startTime ? (endTime - startTime) / 1000 : 0; // seconds
  const speed = elapsed > 0 ? processedItems / elapsed : 0; // items/second
  const estimatedRemaining = speed > 0 ? pending_items / speed : 0; // seconds

  if (variant === 'compact') {
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <StatChip
          icon={<CheckCircle />}
          label="Enriched"
          value={enriched_items}
          color="success"
        />
        <StatChip
          icon={<Error />}
          label="Failed"
          value={failed_items}
          color="error"
        />
        {(not_found_items || 0) > 0 && (
          <StatChip
            icon={<SearchOffIcon />}
            label="Not Found"
            value={not_found_items!}
            color="warning"
          />
        )}
        <StatChip
          icon={<HourglassEmpty />}
          label="Pending"
          value={pending_items}
          color="default"
        />
      </Stack>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {/* Progress Stats */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<CheckCircle color="success" />}
            title="Enriched"
            value={enriched_items}
            subtitle={`${((enriched_items / total_items) * 100).toFixed(1)}% of total`}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Error color="error" />}
            title="Failed"
            value={failed_items}
            subtitle={`${((failed_items / total_items) * 100).toFixed(1)}% of total`}
            color="error"
          />
        </Grid>

        {(not_found_items || 0) > 0 && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<SearchOffIcon color="warning" />}
              title="Not Found"
              value={not_found_items!}
              subtitle={`${((not_found_items! / total_items) * 100).toFixed(1)}% of total`}
              color="warning"
            />
          </Grid>
        )}

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<HourglassEmpty />}
            title="Pending"
            value={pending_items}
            subtitle={`${((pending_items / total_items) * 100).toFixed(1)}% remaining`}
            color="default"
          />
        </Grid>

        {/* Quality Metrics */}
        {showQuality && processedItems > 0 && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Quality Metrics" size="small" />
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                icon={<TrendingUp color={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'} />}
                title="Success Rate"
                value={`${successRate.toFixed(1)}%`}
                subtitle={`${enriched_items} successful matches`}
                color={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                icon={<Error color={failureRate > 30 ? 'error' : failureRate > 10 ? 'warning' : 'success'} />}
                title="Failure Rate"
                value={`${failureRate.toFixed(1)}%`}
                subtitle={`${failed_items + (not_found_items || 0)} failed`}
                color={failureRate > 30 ? 'error' : failureRate > 10 ? 'warning' : 'success'}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                icon={<CheckCircle color="primary" />}
                title="Coverage"
                value={`${((processedItems / total_items) * 100).toFixed(1)}%`}
                subtitle={`${processedItems}/${total_items} processed`}
                color="primary"
              />
            </Grid>
          </>
        )}

        {/* Timing Info */}
        {showTiming && started_at && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Timing" size="small" />
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                icon={<Schedule />}
                title="Elapsed Time"
                value={formatDuration(elapsed)}
                subtitle={started_at ? new Date(started_at).toLocaleTimeString() : ''}
                color="default"
              />
            </Grid>

            {status === 'enriching' && speed > 0 && (
              <>
                <Grid item xs={12} sm={6} md={4}>
                  <StatCard
                    icon={<Speed />}
                    title="Processing Speed"
                    value={`${speed.toFixed(1)}/s`}
                    subtitle={`${(speed * 60).toFixed(0)} items/min`}
                    color="primary"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <StatCard
                    icon={<HourglassEmpty />}
                    title="Est. Remaining"
                    value={formatDuration(estimatedRemaining)}
                    subtitle={`${pending_items} items left`}
                    color="default"
                  />
                </Grid>
              </>
            )}

            {status === 'completed' && completed_at && (
              <Grid item xs={12} sm={6} md={4}>
                <StatCard
                  icon={<CheckCircle color="success" />}
                  title="Completed At"
                  value={new Date(completed_at).toLocaleTimeString()}
                  subtitle={`Total: ${formatDuration(elapsed)}`}
                  color="success"
                />
              </Grid>
            )}
          </>
        )}
      </Grid>
    </Box>
  );
};

interface StatCardProps {
  icon: React.ReactElement;
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

function StatCard({ icon, title, value, subtitle, color }: StatCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        borderColor: color !== 'default' ? `${color}.main` : 'divider',
        borderWidth: color !== 'default' ? 2 : 1,
      }}
    >
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={700} color={color !== 'default' ? `${color}.main` : 'text.primary'}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

interface StatChipProps {
  icon: React.ReactElement;
  label: string;
  value: number;
  color: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

function StatChip({ icon, label, value, color }: StatChipProps) {
  return (
    <Tooltip title={label}>
      <Chip
        icon={icon}
        label={`${value}`}
        color={color}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600 }}
      />
    </Tooltip>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
