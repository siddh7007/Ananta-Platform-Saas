/**
 * Risk Distribution Chart
 * Donut chart showing risk level distribution
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export interface RiskDistributionChartProps {
  lowCount: number;
  mediumCount: number;
  highCount: number;
  criticalCount: number;
  isLoading?: boolean;
}

const COLORS = {
  critical: '#dc2626', // red-600
  high: '#ea580c',     // orange-600
  medium: '#ca8a04',   // yellow-600
  low: '#16a34a',      // green-600
};

export function RiskDistributionChart({
  lowCount,
  mediumCount,
  highCount,
  criticalCount,
  isLoading = false,
}: RiskDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  const data = [
    { name: 'Low Risk', value: lowCount, color: COLORS.low },
    { name: 'Medium Risk', value: mediumCount, color: COLORS.medium },
    { name: 'High Risk', value: highCount, color: COLORS.high },
    { name: 'Critical Risk', value: criticalCount, color: COLORS.critical },
  ].filter(item => item.value > 0); // Only show non-zero values

  const total = lowCount + mediumCount + highCount + criticalCount;

  if (total === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Distribution</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} components ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Risk Distribution</h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name || 'Unknown'}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => `${value} (${entry.payload.value})`}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total Components</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">
            {((criticalCount + highCount) / total * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">High Risk</p>
        </div>
      </div>
    </Card>
  );
}

export default RiskDistributionChart;
