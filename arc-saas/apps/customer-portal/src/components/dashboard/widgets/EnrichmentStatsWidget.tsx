/**
 * Enrichment Stats Widget
 * CBP-P2-008: Dashboard Analytics - Enrichment success rates
 */

import { useQuery } from '@tanstack/react-query';
import { Sparkles, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EnrichmentStats {
  totalProcessed: number;
  successRate: number;
  avgEnrichmentTime: number;
  pendingItems: number;
  breakdown: {
    matched: number;
    partial: number;
    notFound: number;
  };
}

// Mock data for development
const MOCK_STATS: EnrichmentStats = {
  totalProcessed: 5420,
  successRate: 87.5,
  avgEnrichmentTime: 2.3,
  pendingItems: 45,
  breakdown: {
    matched: 4743,
    partial: 452,
    notFound: 225,
  },
};

export function EnrichmentStatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-enrichment-stats'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return MOCK_STATS;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data || MOCK_STATS;
  const total = stats.breakdown.matched + stats.breakdown.partial + stats.breakdown.notFound;

  return (
    <div className="h-full flex flex-col">
      {/* Success Rate */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-3xl font-bold">{stats.successRate}%</p>
          <p className="text-sm text-muted-foreground">Match Rate</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{stats.totalProcessed.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Items processed</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1 mb-4">
        <div className="flex h-2 rounded-full overflow-hidden">
          <div
            className="bg-green-500"
            style={{ width: `${(stats.breakdown.matched / total) * 100}%` }}
            title={`Matched: ${stats.breakdown.matched}`}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${(stats.breakdown.partial / total) * 100}%` }}
            title={`Partial: ${stats.breakdown.partial}`}
          />
          <div
            className="bg-red-500"
            style={{ width: `${(stats.breakdown.notFound / total) * 100}%` }}
            title={`Not Found: ${stats.breakdown.notFound}`}
          />
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
          <p className="text-sm font-medium">{stats.breakdown.matched.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Matched</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <Sparkles className="h-4 w-4 text-amber-500 mx-auto mb-1" />
          <p className="text-sm font-medium">{stats.breakdown.partial.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Partial</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <p className="text-sm font-medium">{stats.breakdown.notFound.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Not Found</p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="flex items-center justify-between text-sm pt-2 border-t mt-auto">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Avg: {stats.avgEnrichmentTime}s/item</span>
        </div>
        {stats.pendingItems > 0 && (
          <span className="text-amber-600">
            {stats.pendingItems} pending
          </span>
        )}
      </div>
    </div>
  );
}

export default EnrichmentStatsWidget;
