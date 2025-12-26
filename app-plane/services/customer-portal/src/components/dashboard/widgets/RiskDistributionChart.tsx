/**
 * RiskDistributionChart Component
 * Interactive donut chart showing BOM risk distribution
 * @module components/dashboard/widgets
 */

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from 'recharts';
import type { RiskDistribution } from '../../../types/dashboard';

export interface RiskDistributionChartProps {
  /** Risk distribution data */
  data: RiskDistribution;
  /** Chart title */
  title?: string;
  /** Show center statistic */
  showCenterStat?: boolean;
  /** CSS class name for customization */
  className?: string;
}

// Risk color palette (aligned with design system)
const RISK_COLORS = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
  critical: '#9c27b0',
};

const RISK_LABELS = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

/**
 * RiskDistributionChart displays portfolio risk levels as an interactive donut chart
 * Touch-friendly with 48px legend targets
 */
export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({
  data,
  title = 'Risk Distribution',
  showCenterStat = true,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Transform data for Recharts
  const chartData = [
    { name: 'Low Risk', value: data.low, key: 'low' },
    { name: 'Medium Risk', value: data.medium, key: 'medium' },
    { name: 'High Risk', value: data.high, key: 'high' },
    { name: 'Critical Risk', value: data.critical, key: 'critical' },
  ];

  const total = data.low + data.medium + data.high + data.critical;

  // Calculate percentage for tooltip
  const calculatePercentage = (value: number): string => {
    if (total === 0) return '0';
    return ((value / total) * 100).toFixed(1);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0];
    return (
      <div
        className="bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200"
        role="tooltip"
      >
        <p className="text-sm font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {data.value} BOMs ({calculatePercentage(data.value)}%)
        </p>
      </div>
    );
  };

  // Custom legend with click handlers
  const CustomLegend = () => {
    return (
      <div className="chart-legend" role="list">
        {chartData.map((entry, index) => {
          const isActive = activeIndex === null || activeIndex === index;
          return (
            <button
              key={entry.key}
              className={`chart-legend-item ${isActive ? '' : 'inactive'}`}
              onClick={() => setActiveIndex(activeIndex === index ? null : index)}
              aria-pressed={isActive}
              aria-label={`${entry.name}: ${entry.value} BOMs. Click to ${isActive ? 'hide' : 'show'}`}
              role="listitem"
            >
              <span
                className="chart-legend-color"
                style={{ backgroundColor: RISK_COLORS[entry.key as keyof typeof RISK_COLORS] }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-gray-700">
                {entry.name}: {entry.value}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // Center statistic label
  const CenterLabel = ({ viewBox }: any) => {
    const { cx, cy } = viewBox;
    const selectedData =
      activeIndex !== null ? chartData[activeIndex].value : total;
    const selectedLabel =
      activeIndex !== null ? chartData[activeIndex].name : 'Total';

    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-3xl font-bold fill-gray-900"
        >
          {selectedData}
        </text>
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-sm fill-gray-600"
        >
          {selectedLabel}
        </text>
      </g>
    );
  };

  return (
    <div className={`dashboard-widget fade-in ${className}`}>
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">{title}</h3>
      </div>

      <div className="dashboard-widget-body">
        <div
          className="chart-container"
          role="img"
          aria-label={`Risk distribution: ${data.low} low risk, ${data.medium} medium risk, ${data.high} high risk, ${data.critical} critical risk BOMs`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                label={false}
                animationDuration={600}
                animationBegin={0}
              >
                {chartData.map((entry, index) => {
                  const isActive = activeIndex === null || activeIndex === index;
                  return (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={RISK_COLORS[entry.key as keyof typeof RISK_COLORS]}
                      opacity={isActive ? 1 : 0.3}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                })}
                {showCenterStat && <Label content={<CenterLabel />} position="center" />}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <CustomLegend />
      </div>
    </div>
  );
};

RiskDistributionChart.displayName = 'RiskDistributionChart';

export default RiskDistributionChart;
