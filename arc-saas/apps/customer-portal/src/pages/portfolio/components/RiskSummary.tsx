/**
 * Risk Summary Component
 * CBP-P2-001: Risk categorization and summary display
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  TrendingUp,
  Shield,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskData {
  obsolete: number;
  singleSource: number;
  longLead: number;
  priceVolatile: number;
  counterfeit: number;
}

interface RiskCategory {
  key: keyof RiskData;
  label: string;
  description: string;
  icon: React.ElementType;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const RISK_CATEGORIES: RiskCategory[] = [
  {
    key: 'obsolete',
    label: 'Obsolete',
    description: 'End-of-life or discontinued parts',
    icon: AlertOctagon,
    severity: 'critical',
  },
  {
    key: 'counterfeit',
    label: 'Counterfeit Risk',
    description: 'Parts at risk of counterfeiting',
    icon: Shield,
    severity: 'critical',
  },
  {
    key: 'singleSource',
    label: 'Single Source',
    description: 'Parts with only one supplier',
    icon: Package,
    severity: 'high',
  },
  {
    key: 'longLead',
    label: 'Long Lead Time',
    description: 'Parts with extended lead times',
    icon: Clock,
    severity: 'medium',
  },
  {
    key: 'priceVolatile',
    label: 'Price Volatile',
    description: 'Parts with unstable pricing',
    icon: TrendingUp,
    severity: 'low',
  },
];

const SEVERITY_COLORS = {
  critical: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  high: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  low: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
};

async function fetchRiskData(): Promise<RiskData> {
  const response = await fetch('/api/portfolio/risks');
  if (!response.ok) {
    throw new Error('Failed to fetch risk data');
  }
  return response.json();
}

// Mock data for development
const MOCK_RISK_DATA: RiskData = {
  obsolete: 5,
  singleSource: 12,
  longLead: 8,
  priceVolatile: 15,
  counterfeit: 2,
};

export function RiskSummary() {
  // API integration - uncomment when ready
  // const { data: riskData, isLoading, error } = useQuery({
  //   queryKey: ['portfolio-risks'],
  //   queryFn: fetchRiskData,
  //   staleTime: 60 * 1000, // 1 minute
  // });

  // Mock data for development
  const isLoading = false;
  const riskData = MOCK_RISK_DATA;

  const totalRisks = riskData
    ? Object.values(riskData).reduce((sum, count) => sum + count, 0)
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Risk Summary
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalRisks} total items at risk
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="list" aria-label="Risk categories">
          {RISK_CATEGORIES.map((category) => {
            const count = riskData?.[category.key] ?? 0;
            const percentage = totalRisks > 0 ? (count / totalRisks) * 100 : 0;

            return (
              <div
                key={category.key}
                className="space-y-2"
                role="listitem"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'p-1.5 rounded',
                        SEVERITY_COLORS[category.severity]
                      )}
                      aria-hidden="true"
                    >
                      <category.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{category.label}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={count > 0 ? 'destructive' : 'outline'}
                    className="tabular-nums"
                  >
                    {count}
                  </Badge>
                </div>
                <Progress
                  value={percentage}
                  className={cn(
                    'h-1.5',
                    count > 0 && category.severity === 'critical' && '[&>div]:bg-red-500',
                    count > 0 && category.severity === 'high' && '[&>div]:bg-orange-500',
                    count > 0 && category.severity === 'medium' && '[&>div]:bg-amber-500',
                    count > 0 && category.severity === 'low' && '[&>div]:bg-yellow-500'
                  )}
                  aria-label={`${category.label}: ${count} items (${percentage.toFixed(0)}%)`}
                />
              </div>
            );
          })}
        </div>

        {/* Risk Actions */}
        <div className="mt-6 pt-4 border-t">
          <a
            href="/risk/analysis"
            className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            View detailed risk analysis &rarr;
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default RiskSummary;
