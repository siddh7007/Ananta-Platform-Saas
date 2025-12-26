/**
 * Risk Summary Card
 * Displays high-level risk metrics in a card format
 */

import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface RiskSummaryCardProps {
  totalComponents: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthGrade: string;
  averageRiskScore: number;
  trend?: 'improving' | 'stable' | 'worsening';
  isLoading?: boolean;
}

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  B: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  C: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  D: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  F: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

export function RiskSummaryCard({
  totalComponents,
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
  healthGrade,
  averageRiskScore,
  trend = 'stable',
  isLoading = false,
}: RiskSummaryCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  const gradeConfig = GRADE_CONFIG[healthGrade] || GRADE_CONFIG.F;

  const TrendIcon = trend === 'improving' ? TrendingDown : trend === 'worsening' ? TrendingUp : Minus;
  const trendColor = trend === 'improving' ? 'text-green-600' : trend === 'worsening' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Portfolio Risk Summary</h3>
        <div className="flex items-center gap-2">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('text-sm', trendColor)}>
            {trend === 'improving' ? 'Improving' : trend === 'worsening' ? 'Worsening' : 'Stable'}
          </span>
        </div>
      </div>

      {/* Health Grade */}
      <div className={cn('flex items-center gap-4 p-4 rounded-lg border mb-4', gradeConfig.bg, gradeConfig.border)}>
        <div className="flex-shrink-0">
          <div className={cn('text-5xl font-bold', gradeConfig.color)}>
            {healthGrade}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Health Grade</p>
          <p className="text-xs text-muted-foreground">
            Average Risk Score: {averageRiskScore.toFixed(1)}/100
          </p>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Components</span>
          <span className="font-semibold">{totalComponents.toLocaleString()}</span>
        </div>

        {criticalCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm">Critical Risk</span>
            </div>
            <Badge variant="destructive">{criticalCount}</Badge>
          </div>
        )}

        {highCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-sm">High Risk</span>
            </div>
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">
              {highCount}
            </Badge>
          </div>
        )}

        {mediumCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-sm">Medium Risk</span>
            </div>
            <Badge variant="warning">{mediumCount}</Badge>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Low Risk</span>
          </div>
          <Badge variant="success">{lowCount}</Badge>
        </div>
      </div>

      {/* Action Required Alert */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-red-900 dark:text-red-100">
                {criticalCount + highCount} components require attention
              </p>
              <p className="text-red-700 dark:text-red-300 mt-0.5">
                Review high-risk items to mitigate supply chain issues
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default RiskSummaryCard;
