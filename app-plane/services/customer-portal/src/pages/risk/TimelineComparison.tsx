/**
 * TimelineComparison Component
 *
 * Shows risk trend comparison over different time periods (7/30/90 days).
 * Displays change indicators and trend charts.
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { riskColors as RISK_COLORS } from '../../theme';

interface TimelineDataPoint {
  date: string;
  avgRiskScore: number;
  highRiskCount: number;
  criticalCount: number;
}

interface TimelineComparisonProps {
  /** Historical data points - if not provided, will show placeholder */
  data?: TimelineDataPoint[];
  /** Current average risk score */
  currentScore?: number;
}

// Mock data for demonstration
const MOCK_DATA: Record<string, TimelineDataPoint[]> = {
  '7': [
    { date: 'Mon', avgRiskScore: 42, highRiskCount: 15, criticalCount: 3 },
    { date: 'Tue', avgRiskScore: 44, highRiskCount: 16, criticalCount: 4 },
    { date: 'Wed', avgRiskScore: 43, highRiskCount: 15, criticalCount: 3 },
    { date: 'Thu', avgRiskScore: 45, highRiskCount: 17, criticalCount: 4 },
    { date: 'Fri', avgRiskScore: 42, highRiskCount: 14, criticalCount: 3 },
    { date: 'Sat', avgRiskScore: 41, highRiskCount: 14, criticalCount: 2 },
    { date: 'Today', avgRiskScore: 40, highRiskCount: 13, criticalCount: 2 },
  ],
  '30': [
    { date: 'Week 1', avgRiskScore: 48, highRiskCount: 20, criticalCount: 5 },
    { date: 'Week 2', avgRiskScore: 46, highRiskCount: 18, criticalCount: 4 },
    { date: 'Week 3', avgRiskScore: 44, highRiskCount: 16, criticalCount: 4 },
    { date: 'Week 4', avgRiskScore: 40, highRiskCount: 13, criticalCount: 2 },
  ],
  '90': [
    { date: 'Month 1', avgRiskScore: 55, highRiskCount: 28, criticalCount: 8 },
    { date: 'Month 2', avgRiskScore: 48, highRiskCount: 22, criticalCount: 5 },
    { date: 'Month 3', avgRiskScore: 40, highRiskCount: 13, criticalCount: 2 },
  ],
};

/**
 * Calculate percentage change between two values
 */
function calculateChange(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { value: 0, direction: 'flat' };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
  };
}

export function TimelineComparison({
  data,
  currentScore = 40,
}: TimelineComparisonProps) {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');

  const chartData = data || MOCK_DATA[period];
  const previousScore = chartData[0]?.avgRiskScore || currentScore;
  const change = calculateChange(currentScore, previousScore);

  const getTrendIcon = () => {
    switch (change.direction) {
      case 'up':
        return <TrendingUpIcon sx={{ color: 'error.main' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: 'success.main' }} />;
      default:
        return <TrendingFlatIcon sx={{ color: 'text.secondary' }} />;
    }
  };

  const getTrendColor = () => {
    switch (change.direction) {
      case 'up':
        return 'error';
      case 'down':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Risk Trend
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getTrendIcon()}
              <Chip
                label={`${change.direction === 'down' ? '-' : change.direction === 'up' ? '+' : ''}${change.value.toFixed(1)}%`}
                color={getTrendColor() as 'default' | 'error' | 'success'}
                size="small"
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                vs {period} days ago
              </Typography>
            </Box>
          </Box>

          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, newPeriod) => newPeriod && setPeriod(newPeriod)}
            size="small"
          >
            <ToggleButton value="7">7D</ToggleButton>
            <ToggleButton value="30">30D</ToggleButton>
            <ToggleButton value="90">90D</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgRiskScore"
                stroke={RISK_COLORS.medium}
                strokeWidth={2}
                name="Avg Risk Score"
                dot={{ fill: RISK_COLORS.medium }}
              />
              <Line
                type="monotone"
                dataKey="highRiskCount"
                stroke={RISK_COLORS.high}
                strokeWidth={2}
                name="High Risk"
                dot={{ fill: RISK_COLORS.high }}
              />
              <Line
                type="monotone"
                dataKey="criticalCount"
                stroke={RISK_COLORS.critical}
                strokeWidth={2}
                name="Critical"
                dot={{ fill: RISK_COLORS.critical }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}

export default TimelineComparison;
