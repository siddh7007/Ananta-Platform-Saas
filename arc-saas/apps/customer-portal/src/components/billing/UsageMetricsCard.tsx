/**
 * Usage Metrics Card Component
 *
 * Displays usage vs limits with progress bars.
 * Shows warnings when approaching limits.
 */

import { Activity, FileText, Search, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UsageMetrics } from '@/types/subscription';
import { getUsageBarColor } from '@/types/subscription';

export interface UsageMetricsCardProps {
  metrics: UsageMetrics | null;
  isLoading?: boolean;
  compact?: boolean;
}

interface UsageItemProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  percent: number;
  formatValue?: (val: number) => string;
}

function UsageItem({
  icon,
  label,
  used,
  limit,
  percent,
  formatValue = (v) => v.toLocaleString(),
}: UsageItemProps) {
  const barColor = getUsageBarColor(percent);
  const isNearLimit = percent >= 75;
  const isAtLimit = percent >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{label}</span>
        </div>
        <div className={cn('text-sm', isAtLimit && 'text-red-600 font-medium')}>
          {formatValue(used)} / {formatValue(limit)}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-yellow-600">
          Approaching limit ({percent}% used)
        </p>
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600">Limit reached - upgrade for more</p>
      )}
    </div>
  );
}

export function UsageMetricsCard({
  metrics,
  isLoading = false,
  compact = false,
}: UsageMetricsCardProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 bg-muted rounded" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-2 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No metrics state
  if (!metrics) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="text-muted-foreground text-sm">
          Usage data unavailable
        </div>
      </div>
    );
  }

  const formatK = (val: number) => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Usage This Period</h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{metrics.daysRemaining} days remaining</span>
          </div>
        </div>
      </div>

      {/* Usage Items */}
      <div className={cn('p-6', compact ? 'space-y-4' : 'space-y-6')}>
        <UsageItem
          icon={<FileText className="h-4 w-4" />}
          label="BOMs"
          used={metrics.bomCount}
          limit={metrics.bomLimit}
          percent={metrics.bomUsagePercent}
        />

        <UsageItem
          icon={<Search className="h-4 w-4" />}
          label="Component Lookups"
          used={metrics.componentLookups}
          limit={metrics.componentLookupLimit}
          percent={metrics.componentLookupUsagePercent}
          formatValue={formatK}
        />

        <UsageItem
          icon={<Activity className="h-4 w-4" />}
          label="API Calls"
          used={metrics.apiCalls}
          limit={metrics.apiCallLimit}
          percent={metrics.apiCallUsagePercent}
          formatValue={formatK}
        />

        <UsageItem
          icon={<Users className="h-4 w-4" />}
          label="Team Members"
          used={metrics.usersCount}
          limit={metrics.usersLimit}
          percent={metrics.usersUsagePercent}
        />
      </div>

      {/* Period info */}
      {!compact && (
        <div className="px-6 pb-6 pt-2 text-xs text-muted-foreground border-t mt-2 pt-4">
          Period: {new Date(metrics.periodStart).toLocaleDateString()} -{' '}
          {new Date(metrics.periodEnd).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

export default UsageMetricsCard;
