/**
 * ActivityChart Component
 * 7-day enrichment activity area chart with dual Y-axis
 * @module components/dashboard/widgets
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyActivity } from '../../../types/dashboard';

export interface ActivityChartProps {
  /** 7-day activity data */
  data: DailyActivity[];
  /** Chart title */
  title?: string;
  /** CSS class name for customization */
  className?: string;
}

/**
 * ActivityChart displays enrichment count and cost over 7 days
 * Dual Y-axis for count (left) and cost (right)
 */
export const ActivityChart: React.FC<ActivityChartProps> = ({
  data,
  title = 'Enrichment Activity (7 Days)',
  className = '',
}) => {
  // Format date for display (e.g., "Mon 12/11")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.getMonth() + 1;
    const dayNum = date.getDate();
    return `${day} ${month}/${dayNum}`;
  };

  // Format currency for display
  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Custom tooltip with enrichment details
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const countData = payload.find((p: any) => p.dataKey === 'count');
    const costData = payload.find((p: any) => p.dataKey === 'cost');

    return (
      <div
        className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200"
        role="tooltip"
      >
        <p className="text-sm font-semibold text-gray-900 mb-2">
          {formatDate(label)}
        </p>
        {countData && (
          <p className="text-sm text-gray-700">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" />
            Enrichments: <strong>{countData.value}</strong>
          </p>
        )}
        {costData && (
          <p className="text-sm text-gray-700 mt-1">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2" />
            Cost: <strong>{formatCurrency(costData.value)}</strong>
          </p>
        )}
      </div>
    );
  };

  // Format data with readable dates
  const chartData = data.map((item) => ({
    ...item,
    displayDate: formatDate(item.date),
  }));

  // Calculate Y-axis domains for better visualization
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const maxCost = Math.max(...data.map((d) => d.cost), 1);

  return (
    <div className={`dashboard-widget fade-in ${className}`}>
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">{title}</h3>
      </div>

      <div className="dashboard-widget-body">
        <div
          className="chart-container"
          role="img"
          aria-label={`7-day enrichment activity chart showing daily counts and costs`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 60, left: 20, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis
                dataKey="displayDate"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />

              {/* Left Y-axis for count */}
              <YAxis
                yAxisId="left"
                stroke="#3b82f6"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
                label={{
                  value: 'Enrichments',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#6b7280', fontSize: 12 },
                }}
                domain={[0, Math.ceil(maxCount * 1.2)]}
              />

              {/* Right Y-axis for cost */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
                tickFormatter={(value) => `$${value}`}
                label={{
                  value: 'Cost',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: '#6b7280', fontSize: 12 },
                }}
                domain={[0, Math.ceil(maxCost * 1.2)]}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-sm text-gray-700 capitalize">{value}</span>
                )}
              />

              <Area
                yAxisId="left"
                type="monotone"
                dataKey="count"
                name="Enrichments"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorCount)"
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                animationDuration={600}
              />

              <Area
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                name="Cost"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorCost)"
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

ActivityChart.displayName = 'ActivityChart';

export default ActivityChart;
