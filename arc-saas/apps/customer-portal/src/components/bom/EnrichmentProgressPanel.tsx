/**
 * Enrichment Progress Panel
 * CBP-P2-007: Real-time enrichment progress display with connection status
 */

import { useEffect } from 'react';
import { useEnrichmentProgress } from '@/hooks/useEnrichmentProgress';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnrichmentProgressPanelProps {
  bomId: string;
  onComplete?: () => void;
  className?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function ConnectionIndicator({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => void;
}) {
  const isConnected = status === 'connected';
  const isReconnecting = status === 'reconnecting';

  return (
    <div className="flex items-center gap-2 text-xs">
      {isConnected ? (
        <Wifi className="h-3 w-3 text-green-500" aria-label="Connected" />
      ) : (
        <WifiOff className="h-3 w-3 text-muted-foreground" aria-label="Disconnected" />
      )}
      <span className="text-muted-foreground">
        {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : 'Offline'}
      </span>
      {!isConnected && !isReconnecting && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function EnrichmentProgressPanel({
  bomId,
  onComplete,
  className,
}: EnrichmentProgressPanelProps) {
  const {
    progress,
    progressPercent,
    isComplete,
    error,
    isProcessing,
    connectionStatus,
    retry,
  } = useEnrichmentProgress(bomId, {
    onComplete: () => onComplete?.(),
  });

  // Don't show panel if no progress and not complete/error
  if (!progress && !isComplete && !error) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isProcessing && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            )}
            {isComplete && (
              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            )}
            {error && (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            )}
            Enrichment Progress
          </CardTitle>
          <ConnectionIndicator status={connectionStatus} onRetry={retry} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{progressPercent}% complete</span>
            {progress?.pendingItems && progress.pendingItems > 0 && !isComplete && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {progress.pendingItems} remaining
              </span>
            )}
          </div>
          <Progress
            value={progressPercent}
            className={cn(
              'h-2',
              error && 'bg-red-100 dark:bg-red-900/30',
              isComplete && 'bg-green-100 dark:bg-green-900/30'
            )}
            aria-label={`Enrichment progress: ${progressPercent}%`}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {progress?.enrichedItems ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Enriched</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {(progress?.totalItems ?? 0) - (progress?.processedItems ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {progress?.failedItems ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>

        {/* Current Stage */}
        {progress?.currentStage && isProcessing && (
          <div className="border rounded-lg p-3 bg-muted/50">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span className="text-sm">
                Stage:{' '}
                <span className="font-medium capitalize">{progress.currentStage}</span>
              </span>
            </div>
            {progress.message && (
              <p className="text-xs text-muted-foreground mt-1 ml-5">
                {progress.message}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Enrichment Error
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Completion Message */}
        {isComplete && !error && (
          <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Enrichment Complete
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Successfully enriched {progress?.enrichedItems ?? 0} items
                  {(progress?.failedItems ?? 0) > 0 && (
                    <span> ({progress?.failedItems} errors)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EnrichmentProgressPanel;
