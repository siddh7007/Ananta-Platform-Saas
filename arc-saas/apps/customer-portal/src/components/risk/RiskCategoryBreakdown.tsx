/**
 * Risk Category Breakdown
 * Bar chart showing risk by category (lifecycle, supply chain, compliance, etc.)
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export interface RiskCategoryBreakdownProps {
  factorAverages: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  isLoading?: boolean;
}

export function RiskCategoryBreakdown({
  factorAverages,
  isLoading = false,
}: RiskCategoryBreakdownProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  const data = [
    {
      category: 'Lifecycle',
      score: factorAverages.lifecycle,
      description: 'EOL, NRND, Obsolescence',
    },
    {
      category: 'Supply Chain',
      score: factorAverages.supply_chain,
      description: 'Lead time, Availability',
    },
    {
      category: 'Compliance',
      score: factorAverages.compliance,
      description: 'RoHS, REACH, Conflict Minerals',
    },
    {
      category: 'Obsolescence',
      score: factorAverages.obsolescence,
      description: 'Predicted EOL Timeline',
    },
    {
      category: 'Single Source',
      score: factorAverages.single_source,
      description: 'Supplier Diversity',
    },
  ];

  const getBarColor = (score: number) => {
    if (score >= 75) return '#dc2626'; // critical - red
    if (score >= 50) return '#ea580c'; // high - orange
    if (score >= 25) return '#ca8a04'; // medium - yellow
    return '#16a34a'; // low - green
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.category}</p>
          <p className="text-sm text-muted-foreground">{data.description}</p>
          <p className="text-lg font-bold mt-1">Score: {data.score.toFixed(1)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Risk by Category</h3>
        <div className="text-xs text-muted-foreground">
          Average risk score per category
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="category"
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
          <Bar
            dataKey="score"
            radius={[4, 4, 0, 0]}
            fill="#3b82f6"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Risk Level Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-600" />
          <span className="text-xs">Low (0-25)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-600" />
          <span className="text-xs">Medium (25-50)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-600" />
          <span className="text-xs">High (50-75)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-600" />
          <span className="text-xs">Critical (75+)</span>
        </div>
      </div>
    </Card>
  );
}

export default RiskCategoryBreakdown;
