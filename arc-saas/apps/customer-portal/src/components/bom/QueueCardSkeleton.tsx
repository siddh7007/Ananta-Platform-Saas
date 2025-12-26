/**
 * QueueCardSkeleton Component
 *
 * Loading skeleton for QueueCard.
 * Provides visual feedback while queue cards are loading.
 *
 * Matches the structure of QueueCard for seamless loading states.
 */

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface QueueCardSkeletonProps {
  className?: string;
  showFooter?: boolean;
}

export function QueueCardSkeleton({ className, showFooter = true }: QueueCardSkeletonProps) {
  return (
    <Card className={cn('animate-pulse', className)} elevation="flat">
      <CardContent className="p-4 space-y-3">
        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="space-y-1 flex-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>

        {/* Progress skeleton */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-10" />
          </div>
          <div className="h-2 bg-muted rounded-full w-full" />
        </div>

        {/* Time info skeleton */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 bg-muted rounded" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 bg-muted rounded" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        </div>
      </CardContent>

      {/* Footer skeleton */}
      {showFooter && (
        <CardFooter className="p-4 pt-0 gap-2">
          <div className="h-8 bg-muted rounded w-28" />
          <div className="h-8 bg-muted rounded w-20" />
        </CardFooter>
      )}
    </Card>
  );
}
