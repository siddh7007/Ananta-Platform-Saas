/**
 * Portfolio Stats Component
 * CBP-P2-001: Key Metrics Display for Portfolio Overview
 */

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Users, DollarSign, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type DateRange } from './DateRangePicker';

interface PortfolioStatsData {
  totalBoms: number;
  activeEngineers: number;
  totalSpend: number;
  atRiskItems: number;
  bomGrowth: number;
  spendChange: number;
  riskChange: number;
}

interface PortfolioStatsProps {
  dateRange: DateRange;
}

async function fetchPortfolioStats(dateRange: DateRange): Promise<PortfolioStatsData> {
  const params = new URLSearchParams({
    dateFrom: dateRange.from.toISOString(),
    dateTo: dateRange.to.toISOString(),
  });

  const response = await fetch(`/api/portfolio/stats?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch portfolio stats');
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

interface ChangeIndicatorProps {
  value: number;
  invert?: boolean;
}

function ChangeIndicator({ value, invert = false }: ChangeIndicatorProps) {
  if (value === 0) return null;

  const isPositive = value > 0;
  const isGood = invert ? !isPositive : isPositive;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      )}
      aria-label={`${isPositive ? 'Increase' : 'Decrease'} of ${Math.abs(value)}%`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{Math.abs(value)}%</span>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  change: number | null;
  icon: React.ElementType;
  color: string;
  invertChange?: boolean;
  isLoading?: boolean;
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  color,
  invertChange = false,
  isLoading = false,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
            {change !== null && !isLoading && (
              <ChangeIndicator value={change} invert={invertChange} />
            )}
          </div>
          <div
            className={cn(
              'p-3 rounded-full bg-muted flex items-center justify-center',
              color
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PortfolioStats({ dateRange }: PortfolioStatsProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['portfolio-stats', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => fetchPortfolioStats(dateRange),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });

  // Mock data for development - remove when API is ready
  const mockStats: PortfolioStatsData = {
    totalBoms: 127,
    activeEngineers: 8,
    totalSpend: 245000,
    atRiskItems: 23,
    bomGrowth: 12,
    spendChange: -5,
    riskChange: -8,
  };

  // Use mock data if API fails or no data
  const displayStats = stats || (error ? mockStats : undefined);

  const metrics = [
    {
      label: 'Total BOMs',
      value: displayStats?.totalBoms ?? 0,
      change: displayStats?.bomGrowth ?? null,
      icon: FileSpreadsheet,
      color: 'text-blue-500',
    },
    {
      label: 'Active Engineers',
      value: displayStats?.activeEngineers ?? 0,
      change: null, // No change indicator for engineers
      icon: Users,
      color: 'text-green-500',
    },
    {
      label: 'Total Spend (Est.)',
      value: formatCurrency(displayStats?.totalSpend ?? 0),
      change: displayStats?.spendChange ?? null,
      icon: DollarSign,
      color: 'text-amber-500',
    },
    {
      label: 'At-Risk Items',
      value: displayStats?.atRiskItems ?? 0,
      change: displayStats?.riskChange ?? null,
      icon: AlertTriangle,
      color: 'text-red-500',
      invertChange: true, // Lower risk is better
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      role="region"
      aria-label="Portfolio key metrics"
    >
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          icon={metric.icon}
          color={metric.color}
          invertChange={metric.invertChange}
          isLoading={isLoading && !error}
        />
      ))}
    </div>
  );
}

export default PortfolioStats;
