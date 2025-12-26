/**
 * EnrichmentProgress Component
 *
 * Displays enrichment progress for a BOM with:
 * - Status badge with icon
 * - Progress bar
 * - Item counts
 * - Live status updates (optionally from SSE)
 *
 * Can be used in two modes:
 * 1. Static mode: Display BOM status with calculated progress
 * 2. SSE mode: Display real-time enrichment progress from SSE stream
 *
 * Accessibility:
 * - ARIA live regions for status updates
 * - Progress bar with aria-label
 * - Screen reader friendly text
 */

import { Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getBomStatusType, getBomStatusLabel } from '@/lib/bom-status';
import { cn } from '@/lib/utils';
import type { BomStatus } from '@/types/bom';
import type { EnrichmentProgressState, SSEConnectionStatus } from '@/hooks/useEnrichmentSSE';

export interface EnrichmentProgressProps {
  status: BomStatus;
  progress: number;
  totalItems: number;
  enrichedItems: number;
  className?: string;
  // Optional SSE-based real-time progress
  sseProgress?: EnrichmentProgressState | null;
  connectionStatus?: SSEConnectionStatus;
}

export function EnrichmentProgress({
  status,
  progress,
  totalItems,
  enrichedItems,
  className,
  sseProgress,
  connectionStatus,
}: EnrichmentProgressProps) {
  // Use SSE progress if available, otherwise fall back to static progress
  const isSSEActive = !!sseProgress;
  const displayProgress = isSSEActive ? sseProgress.percent_complete : progress;
  const displayEnriched = isSSEActive ? sseProgress.enriched_items : enrichedItems;
  const displayTotal = isSSEActive ? sseProgress.total_items : totalItems;
  const displayFailed = isSSEActive ? sseProgress.failed_items : 0;

  const statusType = getBomStatusType(status);
  const statusLabel = getBomStatusLabel(status);

  // Generate status-specific message
  const getStatusMessage = () => {
    // SSE mode: use current item info if available
    if (isSSEActive && sseProgress.current_item) {
      return `Processing ${sseProgress.current_item.mpn}...`;
    }

    // Static mode: use BOM status
    switch (status) {
      case 'enriching':
        return `Processing component ${displayEnriched + 1} of ${displayTotal}...`;
      case 'completed':
        return 'All components enriched successfully';
      case 'failed':
        return 'Enrichment failed - please try again';
      case 'mapping_pending':
        return `${displayTotal - displayEnriched} items require manual mapping`;
      case 'processing':
        return 'Analyzing component data...';
      case 'analyzing':
        return 'Preparing components for enrichment...';
      default:
        return 'Waiting to start...';
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div
      className={cn('space-y-2', className)}
      role="region"
      aria-label="Enrichment progress"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={statusType} size="sm" customLabel={statusLabel} />
          {isSSEActive && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
          )}
          {connectionStatus && connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && (
            <Badge variant="outline" className="text-xs">
              {connectionStatus}
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {displayEnriched} / {displayTotal}
          {isSSEActive && displayFailed > 0 && (
            <span className="text-orange-600 ml-1">({displayFailed} errors)</span>
          )}
        </span>
      </div>

      <Progress
        value={displayProgress}
        className="h-2"
        aria-label={`${Math.round(displayProgress)}% complete`}
      />

      <div className="flex items-center justify-between">
        <p
          className="text-xs text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusMessage}
        </p>
        {isSSEActive && sseProgress.estimated_time_remaining && sseProgress.estimated_time_remaining > 0 && (
          <p className="text-xs text-blue-600">
            {Math.ceil(sseProgress.estimated_time_remaining / 60)}m remaining
          </p>
        )}
      </div>
    </div>
  );
}
