/**
 * QueueCard Component
 *
 * Displays upload job status and progress for a single BOM.
 * Shows:
 * - Job status with visual badge
 * - Progress information
 * - Time information (started, ETA, duration)
 * - Quick actions (View details, Cancel, Retry)
 *
 * Accessibility:
 * - ARIA labels for actions
 * - Keyboard navigation support
 * - Screen reader friendly text
 */

import { formatDistanceToNow } from 'date-fns';
import { Eye, X, RotateCcw, Clock, Timer, FileText } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { getBomStatusConfig, getBomStatusLabel } from '@/lib/bom-status';
import { cn } from '@/lib/utils';
import type { BomStatus } from '@/types/bom';

export interface QueueCardProps {
  bomId: string;
  fileName: string;
  status: BomStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
  onViewDetails?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function QueueCard({
  bomId,
  fileName,
  status,
  progress,
  totalItems,
  processedItems,
  startedAt,
  estimatedCompletion,
  onViewDetails,
  onCancel,
  onRetry,
  className,
}: QueueCardProps) {
  const statusConfig = getBomStatusConfig(status);
  const statusLabel = getBomStatusLabel(status);
  const StatusIcon = statusConfig.icon;

  // Determine status variant for badge
  const getStatusVariant = (
    bomStatus: BomStatus
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' => {
    switch (bomStatus) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      case 'enriching':
      case 'processing':
        return 'info';
      case 'pending':
      case 'analyzing':
      case 'mapping_pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!estimatedCompletion) return null;
    const now = new Date();
    const eta = new Date(estimatedCompletion);
    if (eta <= now) return null;
    return formatDistanceToNow(eta, { addSuffix: true });
  };

  const timeRemaining = getTimeRemaining();

  // Calculate duration if started
  const getDuration = () => {
    if (!startedAt) return null;
    return formatDistanceToNow(new Date(startedAt), { addSuffix: false });
  };

  const duration = getDuration();

  // Determine if actions should be shown
  const showCancel = status === 'enriching' || status === 'processing' || status === 'analyzing';
  const showRetry = status === 'failed';
  const showViewDetails = status === 'completed' || status === 'failed';

  return (
    <Card
      className={cn('transition-all hover:shadow-md', className)}
      elevation="flat"
      hover="lift"
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: File name and status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium truncate" title={fileName}>
                {fileName}
              </h4>
              <p className="text-xs text-muted-foreground">ID: {bomId.slice(0, 8)}...</p>
            </div>
          </div>
          <Badge variant={getStatusVariant(status)} className="shrink-0">
            <StatusIcon
              className={cn('h-3 w-3 mr-1', 'animate' in statusConfig && statusConfig.animate && 'animate-spin')}
            />
            {statusLabel}
          </Badge>
        </div>

        {/* Progress bar and counts */}
        {status !== 'pending' && status !== 'cancelled' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {processedItems} of {totalItems} items
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" aria-label={`${Math.round(progress)}% complete`} />
          </div>
        )}

        {/* Time information */}
        {(startedAt || timeRemaining) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {startedAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Started {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}</span>
              </div>
            )}
            {timeRemaining && status !== 'completed' && status !== 'failed' && (
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                <span>ETA: {timeRemaining}</span>
              </div>
            )}
            {duration && (status === 'completed' || status === 'failed') && (
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                <span>Duration: {duration}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Actions footer */}
      {(showViewDetails || showCancel || showRetry) && (
        <CardFooter className="p-4 pt-0 gap-2">
          {showViewDetails && onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
              leftIcon={<Eye className="h-3 w-3" />}
              aria-label={`View details for ${fileName}`}
            >
              View Details
            </Button>
          )}
          {showCancel && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              leftIcon={<X className="h-3 w-3" />}
              aria-label={`Cancel upload for ${fileName}`}
            >
              Cancel
            </Button>
          )}
          {showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RotateCcw className="h-3 w-3" />}
              aria-label={`Retry upload for ${fileName}`}
            >
              Retry
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
