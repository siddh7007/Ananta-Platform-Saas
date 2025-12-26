/**
 * Customer Data Stats Component
 *
 * Summary stats for customer BOM and catalog views.
 */

import React from 'react';
import {
  Description as BOMIcon,
  CheckCircle as SuccessIcon,
  HourglassEmpty as PendingIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { StatCard } from '../components/shared';
import { enrichmentStatusColors } from '../theme';
import { GridLayout } from '../layout';

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
    <GridLayout columns={{ xs: 1, sm: 2, md: 4 }} gap={2}>
      <StatCard
        title={`Total ${entityName}`}
        value={stats.total}
        icon={<BOMIcon />}
        color={enrichmentStatusColors.processing}
        loading={loading}
        compact
      />
      <StatCard
        title="Completed"
        value={stats.completed}
        icon={<SuccessIcon />}
        color={enrichmentStatusColors.completed}
        loading={loading}
        compact
      />
      <StatCard
        title="In Progress"
        value={stats.enriching}
        icon={<PendingIcon />}
        color={enrichmentStatusColors.processing}
        loading={loading}
        compact
      />
      <StatCard
        title="Failed"
        value={stats.failed}
        icon={<ErrorIcon />}
        color={enrichmentStatusColors.failed}
        loading={loading}
        compact
      />
    </GridLayout>
  );
};

export default CustomerDataStats;
