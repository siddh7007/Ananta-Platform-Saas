/**
 * AdminUsageMetrics
 *
 * Grid of usage metric cards showing plan limits and current usage.
 */

import React from 'react';
import { Grid, Card, CardContent, Box, Typography, LinearProgress, Skeleton } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export interface UsageMetrics {
  bom_count: number;
  bom_limit: number;
  project_count: number;
  project_limit: number;
  member_count: number;
  member_limit: number;
  api_calls_this_month: number;
  api_calls_limit: number;
  storage_used_mb: number;
  storage_limit_mb: number;
}

interface AdminUsageMetricsProps {
  metrics: UsageMetrics | null;
  loading?: boolean;
}

const getUsageColor = (used: number, limit: number): 'success' | 'warning' | 'error' => {
  if (limit <= 0) return 'success'; // Avoid division by zero
  const percentage = (used / limit) * 100;
  if (percentage >= 90) return 'error';
  if (percentage >= 70) return 'warning';
  return 'success';
};

interface MetricCardProps {
  title: string;
  value: number;
  limit: number;
  unit?: string;
  icon: React.ReactNode;
}

function MetricCard({ title, value, limit, unit = '', icon }: MetricCardProps) {
  const percentage = Math.min(100, (value / limit) * 100);
  const color = getUsageColor(value, limit);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color: `${color}.main`, mr: 1 }}>{icon}</Box>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={700}>
          {value.toLocaleString()}
          {unit && (
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}{unit}
            </Typography>
          )}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {percentage.toFixed(0)}% of {limit.toLocaleString()} {unit}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={color}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export function AdminUsageMetrics({ metrics, loading = false }: AdminUsageMetricsProps) {
  if (loading) {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={i}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width={80} />
                <Skeleton variant="text" width={60} height={40} />
                <Skeleton variant="rectangular" height={6} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!metrics) return null;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={4} lg={2.4}>
        <MetricCard
          title="BOMs"
          value={metrics.bom_count}
          limit={metrics.bom_limit}
          icon={<StorageIcon />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2.4}>
        <MetricCard
          title="Projects"
          value={metrics.project_count}
          limit={metrics.project_limit}
          icon={<BusinessIcon />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2.4}>
        <MetricCard
          title="Members"
          value={metrics.member_count}
          limit={metrics.member_limit}
          icon={<PeopleIcon />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2.4}>
        <MetricCard
          title="API Calls"
          value={metrics.api_calls_this_month}
          limit={metrics.api_calls_limit}
          icon={<TrendingUpIcon />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={2.4}>
        <MetricCard
          title="Storage"
          value={metrics.storage_used_mb}
          limit={metrics.storage_limit_mb}
          unit="MB"
          icon={<StorageIcon />}
        />
      </Grid>
    </Grid>
  );
}

export default AdminUsageMetrics;
