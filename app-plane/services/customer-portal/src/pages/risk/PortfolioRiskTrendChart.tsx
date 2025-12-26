/**
 * PortfolioRiskTrendChart Component
 *
 * P1-6: Portfolio risk trends over time.
 * Shows risk score trends, distribution changes, and factor breakdown.
 *
 * Features:
 * - Multiple view modes (score, distribution, factors)
 * - Interactive brush selector for date range
 * - Period toggle (7/30/90 days)
 * - Risk factor stacked area chart
 * - Risk distribution stacked bar chart
 * - Custom tooltips with detailed breakdown
 * - Trend change indicators
 * - Accessibility support
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Tabs,
  Tab,
  Skeleton,
  Alert,
  IconButton,
  Tooltip as MuiTooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { riskColors, riskFactorColors } from '../../theme';

// =====================
// Types
// =====================

export interface PortfolioTrendDataPoint {
  /** Date string (ISO or display format) */
  date: string;
  /** Display label for X-axis */
  label: string;
  /** Average risk score (0-100) */
  avgRiskScore: number;
  /** Weighted risk score (0-100) */
  weightedRiskScore?: number;
  /** Risk distribution counts */
  distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Risk factor averages (0-100) */
  factors: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  /** Total components analyzed */
  totalComponents: number;
  /** Components requiring attention */
  attentionRequired: number;
}

export interface PortfolioRiskTrendChartProps {
  /** Trend data points - if not provided, shows mock data */
  data?: PortfolioTrendDataPoint[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Title override */
  title?: string;
  /** Whether to show the brush selector */
  showBrush?: boolean;
  /** Default period selection */
  defaultPeriod?: '7' | '30' | '90';
  /** Default view mode */
  defaultView?: 'score' | 'distribution' | 'factors';
  /** Chart height */
  height?: number;
}

type ViewMode = 'score' | 'distribution' | 'factors';
type Period = '7' | '30' | '90';

// =====================
// Mock Data Generator
// =====================

function generateMockData(period: Period): PortfolioTrendDataPoint[] {
  const days = parseInt(period, 10);
  const points: PortfolioTrendDataPoint[] = [];
  const now = new Date();

  // Generate realistic trend with some variation
  let baseScore = 55;
  const trend = -0.3; // Improving trend (lower is better)

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Add some random variation
    const variation = (Math.random() - 0.5) * 8;
    const score = Math.max(20, Math.min(80, baseScore + variation));
    baseScore += trend;

    // Calculate distribution based on score
    const total = 150 + Math.floor(Math.random() * 50);
    const criticalPct = Math.max(0, (score - 60) / 100);
    const highPct = Math.max(0, (score - 40) / 80);
    const mediumPct = Math.max(0, (score - 20) / 60);

    const critical = Math.floor(total * criticalPct * 0.15);
    const high = Math.floor(total * highPct * 0.25);
    const medium = Math.floor(total * mediumPct * 0.35);
    const low = total - critical - high - medium;

    // Generate factor scores with correlation to total
    const factorVariance = () => (Math.random() - 0.5) * 15;

    points.push({
      date: date.toISOString(),
      label: formatDateLabel(date, period),
      avgRiskScore: Math.round(score),
      weightedRiskScore: Math.round(score * (1 + (Math.random() - 0.5) * 0.1)),
      distribution: { low, medium, high, critical },
      factors: {
        lifecycle: Math.round(Math.max(0, Math.min(100, score + factorVariance() + 5))),
        supply_chain: Math.round(Math.max(0, Math.min(100, score + factorVariance()))),
        compliance: Math.round(Math.max(0, Math.min(100, score + factorVariance() - 10))),
        obsolescence: Math.round(Math.max(0, Math.min(100, score + factorVariance() - 5))),
        single_source: Math.round(Math.max(0, Math.min(100, score + factorVariance() + 10))),
      },
      totalComponents: total,
      attentionRequired: critical + high,
    });
  }

  return points;
}

function formatDateLabel(date: Date, period: Period): string {
  switch (period) {
    case '7':
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    case '30':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '90':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
}

// =====================
// Utility Functions
// =====================

function calculateTrendChange(
  data: PortfolioTrendDataPoint[]
): { value: number; direction: 'up' | 'down' | 'flat'; isImproving: boolean } {
  if (data.length < 2) {
    return { value: 0, direction: 'flat', isImproving: false };
  }

  const first = data[0].avgRiskScore;
  const last = data[data.length - 1].avgRiskScore;

  if (first === 0) {
    return { value: 0, direction: 'flat', isImproving: false };
  }

  const change = ((last - first) / first) * 100;
  const direction = change > 2 ? 'up' : change < -2 ? 'down' : 'flat';

  // For risk scores, lower is better, so "down" is improving
  const isImproving = direction === 'down';

  return {
    value: Math.abs(change),
    direction,
    isImproving,
  };
}

function aggregateDataForPeriod(
  data: PortfolioTrendDataPoint[],
  period: Period
): PortfolioTrendDataPoint[] {
  if (period === '7') {
    return data.slice(-7);
  } else if (period === '30') {
    return data.slice(-30);
  }
  return data.slice(-90);
}

// =====================
// Custom Tooltip Components
// =====================

interface ScoreTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}

function ScoreTooltip({ active, payload, label }: ScoreTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as PortfolioTrendDataPoint | undefined;
  if (!data) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        p: 1.5,
        borderRadius: 1,
        boxShadow: 2,
        minWidth: 180,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Avg Score:
          </Typography>
          <Typography variant="caption" fontWeight={600}>
            {data.avgRiskScore}%
          </Typography>
        </Box>
        {data.weightedRiskScore && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Weighted:
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {data.weightedRiskScore}%
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Components:
          </Typography>
          <Typography variant="caption" fontWeight={600}>
            {data.totalComponents}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Need Attention:
          </Typography>
          <Typography variant="caption" fontWeight={600} color="error.main">
            {data.attentionRequired}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

interface DistributionTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>;
  label?: string;
}

function DistributionTooltip({ active, payload, label }: DistributionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as PortfolioTrendDataPoint | undefined;
  if (!data) return null;

  const total = data.totalComponents;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        p: 1.5,
        borderRadius: 1,
        boxShadow: 2,
        minWidth: 160,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {label} ({total} components)
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {payload.map((entry) => (
          <Box
            key={entry.dataKey}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: entry.color,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {entry.name}:
              </Typography>
            </Box>
            <Typography variant="caption" fontWeight={600}>
              {entry.value} ({total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0'}%)
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface FactorsTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>;
  label?: string;
}

function FactorsTooltip({ active, payload, label }: FactorsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        p: 1.5,
        borderRadius: 1,
        boxShadow: 2,
        minWidth: 180,
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {label} - Risk Factors
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {payload.map((entry) => (
          <Box
            key={entry.dataKey}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: entry.color,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {entry.name}:
              </Typography>
            </Box>
            <Typography variant="caption" fontWeight={600}>
              {entry.value}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// =====================
// Main Component
// =====================

export function PortfolioRiskTrendChart({
  data,
  loading = false,
  error = null,
  onRefresh,
  title = 'Portfolio Risk Trend',
  showBrush = true,
  defaultPeriod = '30',
  defaultView = 'score',
  height = 350,
}: PortfolioRiskTrendChartProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

  // Generate or use provided data
  const chartData = useMemo(() => {
    if (data && data.length > 0) {
      return aggregateDataForPeriod(data, period);
    }
    return generateMockData(period);
  }, [data, period]);

  // Calculate trend change
  const trendChange = useMemo(() => calculateTrendChange(chartData), [chartData]);

  // Transform data for stacked charts
  const distributionData = useMemo(
    () =>
      chartData.map((point) => ({
        ...point,
        low: point.distribution.low,
        medium: point.distribution.medium,
        high: point.distribution.high,
        critical: point.distribution.critical,
      })),
    [chartData]
  );

  const factorsData = useMemo(
    () =>
      chartData.map((point) => ({
        ...point,
        lifecycle: point.factors.lifecycle,
        supply_chain: point.factors.supply_chain,
        compliance: point.factors.compliance,
        obsolescence: point.factors.obsolescence,
        single_source: point.factors.single_source,
      })),
    [chartData]
  );

  const handlePeriodChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newPeriod: Period | null) => {
      if (newPeriod) {
        setPeriod(newPeriod);
      }
    },
    []
  );

  const handleViewChange = useCallback((_: React.SyntheticEvent, newView: ViewMode) => {
    setViewMode(newView);
  }, []);

  // Trend icon and color (memoized for performance)
  const trendIcon = useMemo(() => {
    if (trendChange.direction === 'up') {
      return (
        <TrendingUpIcon
          sx={{ color: trendChange.isImproving ? 'success.main' : 'error.main' }}
        />
      );
    }
    if (trendChange.direction === 'down') {
      return (
        <TrendingDownIcon
          sx={{ color: trendChange.isImproving ? 'success.main' : 'error.main' }}
        />
      );
    }
    return <TrendingFlatIcon sx={{ color: 'text.secondary' }} />;
  }, [trendChange.direction, trendChange.isImproving]);

  const trendColor = useMemo((): 'success' | 'error' | 'default' => {
    if (trendChange.direction === 'flat') return 'default';
    return trendChange.isImproving ? 'success' : 'error';
  }, [trendChange.direction, trendChange.isImproving]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="rectangular" height={height} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert
            severity="error"
            action={
              onRefresh && (
                <IconButton size="small" onClick={onRefresh}>
                  <RefreshIcon />
                </IconButton>
              )
            }
          >
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{title}</Typography>
              <MuiTooltip title="Risk trend shows how your portfolio risk has changed over time. Lower scores indicate improved risk posture.">
                <InfoOutlinedIcon fontSize="small" color="action" />
              </MuiTooltip>
              {onRefresh && (
                <IconButton size="small" onClick={onRefresh} aria-label="Refresh data">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {trendIcon}
              <Chip
                label={`${trendChange.direction === 'down' ? '-' : trendChange.direction === 'up' ? '+' : ''}${trendChange.value.toFixed(1)}%`}
                color={trendColor}
                size="small"
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                vs {period} days ago
                {trendChange.isImproving && trendChange.direction !== 'flat' && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="success.main"
                    sx={{ ml: 0.5 }}
                  >
                    (Improving)
                  </Typography>
                )}
              </Typography>
            </Box>
          </Box>

          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={handlePeriodChange}
            size="small"
            aria-label="Select time period"
          >
            <ToggleButton value="7" aria-label="7 days">
              7D
            </ToggleButton>
            <ToggleButton value="30" aria-label="30 days">
              30D
            </ToggleButton>
            <ToggleButton value="90" aria-label="90 days">
              90D
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* View Mode Tabs */}
        <Tabs
          value={viewMode}
          onChange={handleViewChange}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          aria-label="Chart view mode"
        >
          <Tab value="score" label="Risk Score" />
          <Tab value="distribution" label="Distribution" />
          <Tab value="factors" label="Risk Factors" />
        </Tabs>

        {/* Chart */}
        <Box sx={{ height }} role="img" aria-label={`${title} chart showing ${viewMode} view`}>
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'score' ? (
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskColors.medium} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={riskColors.medium} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip content={<ScoreTooltip />} />
                <Legend />
                <ReferenceLine y={60} stroke={riskColors.high} strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke={riskColors.low} strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="avgRiskScore"
                  stroke={riskColors.medium}
                  fill="url(#scoreGradient)"
                  strokeWidth={2}
                  name="Avg Risk Score"
                  dot={{ fill: riskColors.medium, r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="attentionRequired"
                  stroke={riskColors.critical}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Need Attention"
                  dot={false}
                  yAxisId={0}
                />
                {showBrush && chartData.length > 14 && (
                  <Brush dataKey="label" height={30} stroke={riskColors.medium} />
                )}
              </ComposedChart>
            ) : viewMode === 'distribution' ? (
              <ComposedChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<DistributionTooltip />} />
                <Legend />
                <Bar dataKey="low" stackId="dist" fill={riskColors.low} name="Low" />
                <Bar dataKey="medium" stackId="dist" fill={riskColors.medium} name="Medium" />
                <Bar dataKey="high" stackId="dist" fill={riskColors.high} name="High" />
                <Bar dataKey="critical" stackId="dist" fill={riskColors.critical} name="Critical" />
                {showBrush && chartData.length > 14 && (
                  <Brush dataKey="label" height={30} stroke={riskColors.medium} />
                )}
              </ComposedChart>
            ) : (
              <ComposedChart data={factorsData}>
                <defs>
                  <linearGradient id="lifecycleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskFactorColors.lifecycle} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={riskFactorColors.lifecycle} stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskFactorColors.supply_chain} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={riskFactorColors.supply_chain} stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskFactorColors.compliance} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={riskFactorColors.compliance} stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="obsolescenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskFactorColors.obsolescence} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={riskFactorColors.obsolescence} stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="singleSourceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskFactorColors.single_source} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={riskFactorColors.single_source} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip content={<FactorsTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="lifecycle"
                  stackId="factors"
                  stroke={riskFactorColors.lifecycle}
                  fill="url(#lifecycleGradient)"
                  name="Lifecycle"
                />
                <Area
                  type="monotone"
                  dataKey="supply_chain"
                  stackId="factors"
                  stroke={riskFactorColors.supply_chain}
                  fill="url(#supplyGradient)"
                  name="Supply Chain"
                />
                <Area
                  type="monotone"
                  dataKey="compliance"
                  stackId="factors"
                  stroke={riskFactorColors.compliance}
                  fill="url(#complianceGradient)"
                  name="Compliance"
                />
                <Area
                  type="monotone"
                  dataKey="obsolescence"
                  stackId="factors"
                  stroke={riskFactorColors.obsolescence}
                  fill="url(#obsolescenceGradient)"
                  name="Obsolescence"
                />
                <Area
                  type="monotone"
                  dataKey="single_source"
                  stackId="factors"
                  stroke={riskFactorColors.single_source}
                  fill="url(#singleSourceGradient)"
                  name="Single Source"
                />
                {showBrush && chartData.length > 14 && (
                  <Brush dataKey="label" height={30} stroke={riskFactorColors.lifecycle} />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </Box>

        {/* Summary Stats */}
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
            flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Current Score
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              {chartData[chartData.length - 1]?.avgRiskScore ?? 0}%
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Components
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              {chartData[chartData.length - 1]?.totalComponents ?? 0}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Need Attention
            </Typography>
            <Typography variant="h6" fontWeight={600} color="error.main">
              {chartData[chartData.length - 1]?.attentionRequired ?? 0}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Period Change
            </Typography>
            <Typography
              variant="h6"
              fontWeight={600}
              color={trendColor === 'default' ? 'text.primary' : `${trendColor}.main`}
            >
              {trendChange.direction === 'down' ? '-' : trendChange.direction === 'up' ? '+' : ''}
              {trendChange.value.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default PortfolioRiskTrendChart;
