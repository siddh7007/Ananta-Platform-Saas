/**
 * Spend Overview Component
 * CBP-P2-001: Organization spend trends and analysis
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { type DateRange } from './DateRangePicker';

interface SpendDataPoint {
  date: string;
  value: number;
}

interface SpendOverviewData {
  series: SpendDataPoint[];
  total: number;
  average: number;
}

interface SpendOverviewProps {
  dateRange: DateRange;
}

type GroupBy = 'day' | 'week' | 'month';

async function fetchSpendData(dateRange: DateRange, groupBy: GroupBy): Promise<SpendOverviewData> {
  const params = new URLSearchParams({
    dateFrom: dateRange.from.toISOString(),
    dateTo: dateRange.to.toISOString(),
    groupBy,
  });

  const response = await fetch(`/api/portfolio/spend?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch spend data');
  }
  return response.json();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Simple bar chart component (replace with recharts or similar if needed)
function SpendChart({ data, maxValue }: { data: SpendDataPoint[]; maxValue: number }) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No spend data for this period
      </div>
    );
  }

  return (
    <div className="h-48 flex items-end gap-1" role="img" aria-label="Spend trend chart">
      {data.map((point, i) => {
        const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
        return (
          <div
            key={point.date}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${new Date(point.date).toLocaleDateString()}: ${formatCurrency(point.value)}`}
          >
            <div
              className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
              style={{ height: `${Math.max(height, 2)}%` }}
              role="presentation"
            />
            {data.length <= 12 && (
              <span className="text-[10px] text-muted-foreground truncate max-w-full">
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Mock data for development
function generateMockData(dateRange: DateRange, groupBy: GroupBy): SpendOverviewData {
  const series: SpendDataPoint[] = [];
  const start = new Date(dateRange.from);
  const end = new Date(dateRange.to);

  const dayMs = 24 * 60 * 60 * 1000;
  const interval = groupBy === 'day' ? dayMs : groupBy === 'week' ? 7 * dayMs : 30 * dayMs;

  let current = new Date(start);
  let total = 0;

  while (current <= end) {
    const value = Math.floor(Math.random() * 15000) + 5000;
    series.push({
      date: current.toISOString(),
      value,
    });
    total += value;
    current = new Date(current.getTime() + interval);
  }

  return {
    series,
    total,
    average: series.length > 0 ? total / series.length : 0,
  };
}

export function SpendOverview({ dateRange }: SpendOverviewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('week');

  // API integration - uncomment when ready
  // const { data, isLoading, error } = useQuery({
  //   queryKey: ['portfolio-spend', dateRange.from.toISOString(), dateRange.to.toISOString(), groupBy],
  //   queryFn: () => fetchSpendData(dateRange, groupBy),
  //   staleTime: 30 * 1000,
  // });

  // Mock data for development
  const isLoading = false;
  const data = useMemo(() => generateMockData(dateRange, groupBy), [dateRange, groupBy]);

  const maxValue = useMemo(() => {
    if (!data?.series.length) return 0;
    return Math.max(...data.series.map((p) => p.value));
  }, [data?.series]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Spend Overview</CardTitle>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-[120px]" aria-label="Group spend data by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">By Day</SelectItem>
            <SelectItem value="week">By Week</SelectItem>
            <SelectItem value="month">By Month</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <SpendChart data={data?.series ?? []} maxValue={maxValue} />

            {/* Summary Stats */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-xl font-bold">{formatCurrency(data?.total ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average per {groupBy}</p>
                <p className="text-xl font-bold">{formatCurrency(data?.average ?? 0)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SpendOverview;
