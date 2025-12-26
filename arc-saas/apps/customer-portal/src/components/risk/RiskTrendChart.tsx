/**
 * Risk Trend Chart
 * Line chart showing risk score changes over time
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';

export interface RiskTrendDataPoint {
  recorded_date: string;
  total_risk_score: number;
  risk_level: string;
  lifecycle_risk?: number;
  supply_chain_risk?: number;
  compliance_risk?: number;
}

export interface RiskTrendChartProps {
  data: RiskTrendDataPoint[];
  isLoading?: boolean;
  showFactors?: boolean;
}

export function RiskTrendChart({
  data,
  isLoading = false,
  showFactors = false,
}: RiskTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Trend</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No historical data available
        </div>
      </Card>
    );
  }

  // Sort by date and format for chart
  const chartData = [...data]
    .sort((a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime())
    .map(point => ({
      ...point,
      date: format(parseISO(point.recorded_date), 'MMM d'),
      fullDate: format(parseISO(point.recorded_date), 'MMM d, yyyy'),
    }));

  // Calculate trend
  const firstScore = chartData[0].total_risk_score;
  const lastScore = chartData[chartData.length - 1].total_risk_score;
  const change = lastScore - firstScore;
  const percentChange = firstScore > 0 ? ((change / firstScore) * 100) : 0;

  const trend = change < -5 ? 'improving' : change > 5 ? 'worsening' : 'stable';
  const TrendIcon = trend === 'improving' ? TrendingDown : trend === 'worsening' ? TrendingUp : Minus;
  const trendColor = trend === 'improving' ? 'text-green-600' : trend === 'worsening' ? 'text-red-600' : 'text-gray-500';
  const trendBg = trend === 'improving' ? 'bg-green-50' : trend === 'worsening' ? 'bg-red-50' : 'bg-gray-50';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.fullDate}</p>
          <p className="text-lg font-bold mt-1">
            Overall: {data.total_risk_score.toFixed(1)}
          </p>
          {showFactors && (
            <div className="mt-2 space-y-1 text-xs">
              {data.lifecycle_risk !== undefined && (
                <p>Lifecycle: {data.lifecycle_risk.toFixed(1)}</p>
              )}
              {data.supply_chain_risk !== undefined && (
                <p>Supply Chain: {data.supply_chain_risk.toFixed(1)}</p>
              )}
              {data.compliance_risk !== undefined && (
                <p>Compliance: {data.compliance_risk.toFixed(1)}</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Risk Trend</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={trendBg}>
            <TrendIcon className={`h-3 w-3 mr-1 ${trendColor}`} />
            <span className={trendColor}>
              {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
            </span>
          </Badge>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        {showFactors ? (
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="lifecycle_risk"
              fill="#fca5a5"
              stroke="#dc2626"
              strokeWidth={0}
              fillOpacity={0.3}
              name="Lifecycle"
            />
            <Area
              type="monotone"
              dataKey="supply_chain_risk"
              fill="#fdba74"
              stroke="#ea580c"
              strokeWidth={0}
              fillOpacity={0.3}
              name="Supply Chain"
            />
            <Line
              type="monotone"
              dataKey="total_risk_score"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Overall Risk"
            />
          </ComposedChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="total_risk_score"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Overall Risk Score"
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Trend Description */}
      <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
        <p>
          Risk score has {trend === 'improving' ? 'improved' : trend === 'worsening' ? 'worsened' : 'remained stable'} by{' '}
          <span className={`font-semibold ${trendColor}`}>
            {Math.abs(percentChange).toFixed(1)}%
          </span>{' '}
          over the last {chartData.length} days
        </p>
      </div>
    </Card>
  );
}

export default RiskTrendChart;
