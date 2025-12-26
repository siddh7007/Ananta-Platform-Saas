/**
 * Quality Queue Stats Component
 *
 * Summary statistics for the quality queue.
 */

import React from 'react';
import { Grid } from '@mui/material';
import {
  PendingActions as PendingIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { StatCard } from '../components/shared';
import { qualityColors } from '../theme';

export interface QueueStats {
  total: number;
  staging_count: number;
  rejected_count: number;
  average_quality: number;
  by_source: Record<string, number>;
}

export interface QualityQueueStatsProps {
  stats: QueueStats | null;
  loading?: boolean;
}

export const QualityQueueStats: React.FC<QualityQueueStatsProps> = ({ stats, loading }) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Pending"
          value={stats?.total ?? 0}
          icon={<PendingIcon />}
          color="#3b82f6"
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Staging (70-94%)"
          value={stats?.staging_count ?? 0}
          subtitle="Needs manual review"
          icon={<CheckIcon />}
          color={qualityColors.staging}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Rejected (<70%)"
          value={stats?.rejected_count ?? 0}
          subtitle="Below threshold"
          icon={<CancelIcon />}
          color={qualityColors.rejected}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Avg Quality"
          value={`${Math.round(stats?.average_quality ?? 0)}%`}
          subtitle="Queue average"
          icon={<SpeedIcon />}
          color={qualityColors.staging}
          loading={loading}
          compact
        />
      </Grid>
    </Grid>
  );
};

export default QualityQueueStats;
