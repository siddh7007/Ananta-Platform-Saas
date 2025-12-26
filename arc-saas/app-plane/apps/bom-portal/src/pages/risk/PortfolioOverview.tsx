/**
 * PortfolioOverview Component
 *
 * Displays portfolio-level risk summary with charts and metrics.
 * Shows risk distribution, factor analysis, and trend information.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
} from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import GavelIcon from '@mui/icons-material/Gavel';
import HistoryIcon from '@mui/icons-material/History';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  riskColors as RISK_COLORS,
  riskFactorColors as RISK_FACTOR_COLORS,
} from '../../theme';
import { MetricCard } from '../../components/shared';
import type { PortfolioRiskSummary, RiskStatistics } from '../../services/riskService';

interface PortfolioOverviewProps {
  portfolioRisk: PortfolioRiskSummary | null;
  riskStats: RiskStatistics | null;
}

/**
 * Get trend icon based on trend direction
 */
function getTrendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingDownIcon sx={{ color: 'success.main' }} />;
    case 'worsening':
      return <TrendingUpIcon sx={{ color: 'error.main' }} />;
    default:
      return <TrendingFlatIcon sx={{ color: 'text.secondary' }} />;
  }
}

/**
 * Get trend label text
 */
function getTrendLabel(trend: string) {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'worsening':
      return 'Worsening';
    default:
      return 'Stable';
  }
}

/**
 * Get trend direction for MetricCard
 */
function getTrendDirection(trend: string): 'up' | 'down' | 'neutral' {
  switch (trend) {
    case 'improving':
      return 'down';
    case 'worsening':
      return 'up';
    default:
      return 'neutral';
  }
}

export function PortfolioOverview({ portfolioRisk, riskStats }: PortfolioOverviewProps) {
  // Prepare pie chart data
  const pieChartData = portfolioRisk
    ? [
        { name: 'Low Risk', value: portfolioRisk.risk_distribution.low, color: RISK_COLORS.low },
        { name: 'Medium Risk', value: portfolioRisk.risk_distribution.medium, color: RISK_COLORS.medium },
        { name: 'High Risk', value: portfolioRisk.risk_distribution.high, color: RISK_COLORS.high },
        { name: 'Critical', value: portfolioRisk.risk_distribution.critical, color: RISK_COLORS.critical },
      ].filter(d => d.value > 0)
    : [];

  // Prepare bar chart data for risk factors
  const barChartData = riskStats
    ? [
        { name: 'Lifecycle', score: riskStats.factor_averages.lifecycle, color: RISK_FACTOR_COLORS.lifecycle },
        { name: 'Supply Chain', score: riskStats.factor_averages.supply_chain, color: RISK_FACTOR_COLORS.supply_chain },
        { name: 'Compliance', score: riskStats.factor_averages.compliance, color: RISK_FACTOR_COLORS.compliance },
        { name: 'Obsolescence', score: riskStats.factor_averages.obsolescence, color: RISK_FACTOR_COLORS.obsolescence },
        { name: 'Single Source', score: riskStats.factor_averages.single_source, color: RISK_FACTOR_COLORS.single_source },
      ]
    : [];

  const highRiskCount = (portfolioRisk?.risk_distribution.high || 0) + (portfolioRisk?.risk_distribution.critical || 0);
  const trend = portfolioRisk?.trend || 'stable';

  return (
    <>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="TOTAL COMPONENTS"
            value={portfolioRisk?.total_components || 0}
            subtitle="In portfolio"
            color="primary"
            icon={<InventoryIcon sx={{ fontSize: 48 }} />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="AVG RISK SCORE"
            value={portfolioRisk?.average_risk_score?.toFixed(1) || '0'}
            color="warning"
            icon={<SecurityIcon sx={{ fontSize: 48 }} />}
            trend={getTrendDirection(trend)}
            trendValue={getTrendLabel(trend)}
            trendPositive={trend === 'improving'}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="HIGH RISK"
            value={highRiskCount}
            subtitle="Components requiring attention"
            color="error"
            icon={<WarningIcon sx={{ fontSize: 48 }} />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="LOW RISK"
            value={portfolioRisk?.risk_distribution.low || 0}
            subtitle="Healthy components"
            color="success"
            icon={<GavelIcon sx={{ fontSize: 48 }} />}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Risk Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Distribution
              </Typography>
              {pieChartData.length > 0 ? (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography color="text.secondary">No risk data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Risk Factors Bar Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Risk by Factor
              </Typography>
              {barChartData.length > 0 ? (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <RechartsTooltip />
                      <Bar dataKey="score" fill="#8884d8">
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography color="text.secondary">No factor data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Risk Factor Legend */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Risk Factors Explained
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ color: RISK_FACTOR_COLORS.lifecycle }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Lifecycle Risk (30%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Component end-of-life status
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InventoryIcon sx={{ color: RISK_FACTOR_COLORS.supply_chain }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Supply Chain Risk (25%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stock availability and lead times
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GavelIcon sx={{ color: RISK_FACTOR_COLORS.compliance }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Compliance Risk (20%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    RoHS, REACH regulatory compliance
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon sx={{ color: RISK_FACTOR_COLORS.obsolescence }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Obsolescence Risk (15%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Predicted obsolescence timing
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinkOffIcon sx={{ color: RISK_FACTOR_COLORS.single_source }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Single Source Risk (10%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Supplier diversity evaluation
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Top Risk Factors */}
      {portfolioRisk?.top_risk_factors && portfolioRisk.top_risk_factors.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Risk Factors in Portfolio
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {portfolioRisk.top_risk_factors.map((factor, index) => (
                <Chip
                  key={index}
                  label={factor}
                  color="warning"
                  variant="outlined"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default PortfolioOverview;
