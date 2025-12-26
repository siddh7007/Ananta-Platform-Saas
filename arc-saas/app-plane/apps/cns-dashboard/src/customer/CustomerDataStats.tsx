/**
 * Customer Data Stats Component
 *
 * Summary stats for customer BOM and catalog views.
 */

import React from 'react';
import { Grid } from '@mui/material';
import {
  Description as BOMIcon,
  CheckCircle as SuccessIcon,
  HourglassEmpty as PendingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { StatCard } from '../components/shared';
import { enrichmentStatusColors } from '../theme';

export interface CustomerDataStatsData {
  total: number;
  completed: number;
  enriching: number;
  failed: number;
  pending?: number;
}

export interface CustomerDataStatsProps {
  stats: CustomerDataStatsData;
  loading?: boolean;
  entityName?: string; // "BOMs" or "Components"
}

export const CustomerDataStats: React.FC<CustomerDataStatsProps> = ({
  stats,
  loading,
  entityName = 'BOMs',
}) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title={`Total ${entityName}`}
          value={stats.total}
          icon={<BOMIcon />}
          color="#3b82f6"
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<SuccessIcon />}
          color={enrichmentStatusColors.completed}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="In Progress"
          value={stats.enriching}
          icon={<PendingIcon />}
          color={enrichmentStatusColors.processing}
          loading={loading}
          compact
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={<ErrorIcon />}
          color={enrichmentStatusColors.failed}
          loading={loading}
          compact
        />
      </Grid>
    </Grid>
  );
};

export default CustomerDataStats;
