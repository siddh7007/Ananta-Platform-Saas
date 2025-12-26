/**
 * AlertStatsCards Component
 *
 * Displays alert statistics summary cards at the top of Alert Center.
 * Shows total alerts, unread count, critical count, and last 24h count.
 */

import React from 'react';
import { Grid } from '@mui/material';
import { MetricCard } from '../../components/shared';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { AlertStats } from '../../services/alertService';

interface AlertStatsCardsProps {
  stats: AlertStats | null;
  loading?: boolean;
}

export function AlertStatsCards({ stats, loading = false }: AlertStatsCardsProps) {
  if (!stats && !loading) {
    return null;
  }

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <MetricCard
          title="TOTAL ALERTS"
          value={stats?.total_alerts ?? 0}
          color="primary"
          icon={<NotificationsIcon sx={{ fontSize: 32 }} />}
          loading={loading}
        />
      </Grid>

      <Grid item xs={6} sm={3}>
        <MetricCard
          title="UNREAD"
          value={stats?.unread_count ?? 0}
          color="warning"
          icon={<MarkEmailUnreadIcon sx={{ fontSize: 32 }} />}
          loading={loading}
        />
      </Grid>

      <Grid item xs={6} sm={3}>
        <MetricCard
          title="CRITICAL"
          value={stats?.by_severity?.critical ?? 0}
          color="error"
          icon={<ErrorIcon sx={{ fontSize: 32 }} />}
          loading={loading}
        />
      </Grid>

      <Grid item xs={6} sm={3}>
        <MetricCard
          title="LAST 24H"
          value={stats?.recent_24h ?? 0}
          color="info"
          icon={<ScheduleIcon sx={{ fontSize: 32 }} />}
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}

export default AlertStatsCards;
