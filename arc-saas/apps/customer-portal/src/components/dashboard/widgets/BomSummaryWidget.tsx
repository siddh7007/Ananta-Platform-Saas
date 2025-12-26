/**
 * BOM Summary Widget
 * CBP-P2-008: Dashboard Analytics - BOM status overview
 */

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface BomSummary {
  total: number;
  byStatus: {
    draft: number;
    active: number;
    enriched: number;
    archived: number;
  };
  recentUploads: number;
}

// Mock data for development
const MOCK_SUMMARY: BomSummary = {
  total: 127,
  byStatus: {
    draft: 12,
    active: 45,
    enriched: 65,
    archived: 5,
  },
  recentUploads: 8,
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-blue-500',
  enriched: 'bg-green-500',
  archived: 'bg-amber-500',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  enriched: 'Enriched',
  archived: 'Archived',
};

export function BomSummaryWidget() {
  // Mock data - replace with API call when ready
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-bom-summary'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return MOCK_SUMMARY;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  const summary = data || MOCK_SUMMARY;
  const total = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Total Count */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-3xl font-bold">{summary.total}</p>
          <p className="text-sm text-muted-foreground">Total BOMs</p>
        </div>
        <div className="flex items-center gap-1 text-sm text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span>+{summary.recentUploads} this week</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4">
        {Object.entries(summary.byStatus).map(([status, count]) => {
          const percent = (count / total) * 100;
          return (
            <div
              key={status}
              className={cn(STATUS_COLORS[status], 'transition-all')}
              style={{ width: `${percent}%` }}
              title={`${STATUS_LABELS[status]}: ${count}`}
            />
          );
        })}
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {Object.entries(summary.byStatus).map(([status, count]) => (
          <div
            key={status}
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
          >
            <div className={cn('w-3 h-3 rounded-full', STATUS_COLORS[status])} />
            <div className="flex-1">
              <p className="text-sm font-medium">{count}</p>
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BomSummaryWidget;
