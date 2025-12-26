/**
 * AdminRiskSummary
 *
 * Risk health summary card showing component risk metrics.
 */

import React from 'react';
import { Card, CardContent, Box, Typography, Grid, Chip, Button } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export interface RiskSummary {
  high_risk_components: number;
  medium_risk_components: number;
  low_risk_components?: number;
  unresolved_alerts: number;
  risk_score_trend: 'up' | 'down' | 'stable';
}

interface AdminRiskSummaryProps {
  summary: RiskSummary | null;
  onViewDashboard?: () => void;
}

export function AdminRiskSummary({ summary, onViewDashboard }: AdminRiskSummaryProps) {
  if (!summary) return null;

  const getTrendIcon = () => {
    switch (summary.risk_score_trend) {
      case 'down':
        return <TrendingDownIcon />;
      case 'up':
        return <TrendingUpIcon />;
      default:
        return <TrendingFlatIcon />;
    }
  };

  const getTrendLabel = () => {
    switch (summary.risk_score_trend) {
      case 'down':
        return 'Improving';
      case 'up':
        return 'Increasing';
      default:
        return 'Stable';
    }
  };

  const getTrendColor = (): 'success' | 'error' | 'default' => {
    switch (summary.risk_score_trend) {
      case 'down':
        return 'success';
      case 'up':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Risk Health
          </Typography>
          <Chip
            icon={getTrendIcon()}
            label={getTrendLabel()}
            color={getTrendColor()}
            size="small"
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'error.50',
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" color="error.main" fontWeight={700}>
                {summary.high_risk_components}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                High Risk
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'warning.50',
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" color="warning.main" fontWeight={700}>
                {summary.medium_risk_components}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Medium Risk
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                bgcolor: 'info.50',
                borderRadius: 2,
              }}
            >
              <Typography variant="h4" color="info.main" fontWeight={700}>
                {summary.unresolved_alerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unresolved Alerts
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {onViewDashboard && (
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button
              variant="text"
              onClick={onViewDashboard}
              endIcon={<SecurityIcon />}
            >
              View Risk Dashboard
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminRiskSummary;
