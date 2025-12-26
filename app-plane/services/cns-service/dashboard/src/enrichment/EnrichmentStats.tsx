/**
 * Enrichment Stats Component
 *
 * Summary stat cards for enrichment monitoring.
 * Uses StatCard from shared components.
 */

import React from 'react';
import { Grid } from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { StatCard } from '../components/shared';
import { enrichmentStatusColors, jobStatusColors } from '../theme';

export interface EnrichmentStatsData {
  total: number;
  enriching: number;
  completed: number;
  failed: number;
  customer: number;
  staff: number;
}

export interface EnrichmentStatsProps {
  stats: EnrichmentStatsData;
  loading?: boolean;
}

export const EnrichmentStats: React.FC<EnrichmentStatsProps> = ({ stats, loading }) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="Total"
          value={stats.total}
          icon={<AssessmentIcon />}
          color={enrichmentStatusColors.processing}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="In Progress"
          value={stats.enriching}
          icon={<SyncIcon />}
          color={enrichmentStatusColors.processing}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircleIcon />}
          color={enrichmentStatusColors.completed}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={<ErrorIcon />}
          color={enrichmentStatusColors.failed}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="Customer BOMs"
          value={stats.customer}
          icon={<PersonIcon />}
          color={jobStatusColors.validating}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <StatCard
          title="Bulk Uploads"
          value={stats.staff}
          icon={<AdminIcon />}
          color={jobStatusColors.uploading}
          loading={loading}
          compact
        />
      </Grid>
    </Grid>
  );
};

export default EnrichmentStats;
