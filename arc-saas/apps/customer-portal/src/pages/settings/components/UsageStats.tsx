/**
 * Usage Stats Component
 * CBP-P2-005: Organization Management - Usage Statistics Display
 */

import type { ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  FileSpreadsheet,
  Users,
  HardDrive,
  Zap,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUsageStatus } from '@/services/billing.service';
import {
  formatMetricName,
  formatUsageValue,
  type UsageStatus,
  UsageMetricType,
} from '@/types/usage';

interface UsageStatsProps {
  planName?: string;
  onUpgrade?: () => void;
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-amber-500';
  return 'bg-primary';
}

function getUsageBadge(percentage: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (percentage >= 90) return { label: 'Critical', variant: 'destructive' };
  if (percentage >= 75) return { label: 'Warning', variant: 'secondary' };
  return { label: 'Normal', variant: 'default' };
}

interface UsageItemProps {
  icon: ElementType;
  status: UsageStatus;
}

function UsageItem({ icon: Icon, status }: UsageItemProps) {
  const percentage = status.hardLimit === null ? 0 : Math.min(status.percentUsed, 100);
  const badge = getUsageBadge(percentage);
  const hasLimit = status.hardLimit !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">{formatMetricName(status.metricType)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums">
            {formatUsageValue(status.currentUsage, status.unit)} /{' '}
            {hasLimit ? formatUsageValue(status.hardLimit!, status.unit) : 'Unlimited'}
          </span>
          {hasLimit && percentage >= 75 && (
            <Badge variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          )}
        </div>
      </div>
      {hasLimit ? (
        <div className="relative">
          <Progress
            value={percentage}
            className="h-2"
            aria-label={`${formatMetricName(status.metricType)} usage: ${percentage.toFixed(0)}%`}
          />
          <div
            className={cn(
              'absolute top-0 left-0 h-2 rounded-full transition-all',
              getUsageColor(percentage)
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : (
        <div className="h-2 bg-muted rounded-full" />
      )}
    </div>
  );
}

export function UsageStats({ planName = 'Professional', onUpgrade }: UsageStatsProps) {
  const { data: usageStatus = [], isLoading } = useQuery({
    queryKey: ['usage-status'],
    queryFn: getUsageStatus,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasWarning = usageStatus.some(
    (status) => status.isOverSoftLimit || status.isOverHardLimit || status.percentUsed >= 75
  );

  const iconMap: Record<string, ElementType> = {
    [UsageMetricType.BOMS]: FileSpreadsheet,
    [UsageMetricType.COMPONENTS]: FileSpreadsheet,
    [UsageMetricType.USERS]: Users,
    [UsageMetricType.API_CALLS]: Zap,
    [UsageMetricType.ENRICHMENTS]: Zap,
    [UsageMetricType.STORAGE_GB]: HardDrive,
    [UsageMetricType.DATA_EXPORTS]: FileSpreadsheet,
  };

  const orderedMetrics = [
    UsageMetricType.BOMS,
    UsageMetricType.COMPONENTS,
    UsageMetricType.USERS,
    UsageMetricType.API_CALLS,
    UsageMetricType.ENRICHMENTS,
    UsageMetricType.STORAGE_GB,
    UsageMetricType.DATA_EXPORTS,
  ];

  const sortedUsage = [...usageStatus].sort((a, b) => {
    const aIndex = orderedMetrics.indexOf(a.metricType as UsageMetricType);
    const bIndex = orderedMetrics.indexOf(b.metricType as UsageMetricType);
    if (aIndex === -1 && bIndex === -1) return a.metricType.localeCompare(b.metricType);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            Usage & Limits
          </CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{planName} Plan</Badge>
            {hasWarning && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Approaching limits
              </span>
            )}
          </CardDescription>
        </div>
        {onUpgrade && (
          <Button variant="outline" size="sm" onClick={onUpgrade}>
            <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
            Upgrade Plan
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedUsage.length > 0 ? (
          sortedUsage.map((status) => (
            <UsageItem
              key={status.metricType}
              icon={iconMap[status.metricType] || FileSpreadsheet}
              status={status}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Usage data is not available yet.
          </div>
        )}

        {hasWarning && onUpgrade && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Running low on resources
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Consider upgrading your plan to increase limits and unlock additional features.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onUpgrade}
                >
                  View Upgrade Options
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UsageStats;
