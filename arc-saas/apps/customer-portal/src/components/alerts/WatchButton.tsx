/**
 * WatchButton Component
 * Toggle button to add/remove a component from watch list
 */

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWatchedComponents, useWatchComponent, useUnwatchComponent } from '@/hooks/useAlerts';
import { useToast } from '@/hooks/useToast';
import type { AlertType } from '@/types/alert';

interface WatchButtonProps {
  componentId: string;
  mpn?: string;
  manufacturer?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  showLabel?: boolean;
  defaultWatchTypes?: AlertType[];
  onWatchChange?: (isWatched: boolean) => void;
}

const DEFAULT_WATCH_TYPES: AlertType[] = [
  'LIFECYCLE',
  'RISK',
  'PRICE',
  'AVAILABILITY',
];

export function WatchButton({
  componentId,
  mpn,
  manufacturer,
  size = 'icon',
  variant = 'ghost',
  showLabel = false,
  defaultWatchTypes = DEFAULT_WATCH_TYPES,
  onWatchChange,
}: WatchButtonProps) {
  const { toast } = useToast();
  const { data: watches = [], isLoading: isLoadingWatches } = useWatchedComponents();
  const watchMutation = useWatchComponent();
  const unwatchMutation = useUnwatchComponent();

  // Find existing watch for this component
  const existingWatch = watches.find((w) => w.componentId === componentId);
  const isWatched = !!existingWatch;

  const isLoading =
    isLoadingWatches || watchMutation.isPending || unwatchMutation.isPending;

  const handleToggleWatch = async () => {
    try {
      if (isWatched && existingWatch) {
        await unwatchMutation.mutateAsync(existingWatch.id);
        toast({
          title: 'Component Removed from Watch List',
          description: mpn
            ? `${mpn} will no longer trigger alerts`
            : 'Component removed from watch list',
        });
        onWatchChange?.(false);
      } else {
        await watchMutation.mutateAsync({
          componentId,
          watchTypes: defaultWatchTypes,
        });
        toast({
          title: 'Component Added to Watch List',
          description: mpn
            ? `You'll receive alerts for ${mpn}`
            : 'You will receive alerts for this component',
        });
        onWatchChange?.(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: isWatched
          ? 'Failed to remove component from watch list'
          : 'Failed to add component to watch list',
        variant: 'destructive',
      });
    }
  };

  const buttonContent = (
    <>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isWatched ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-2">{isWatched ? 'Unwatch' : 'Watch'}</span>
      )}
    </>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={handleToggleWatch}
            disabled={isLoading}
            className={isWatched ? 'text-primary' : undefined}
            aria-label={isWatched ? 'Remove from watch list' : 'Add to watch list'}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isWatched
              ? 'Stop watching this component'
              : 'Watch for alerts on this component'}
          </p>
          {mpn && manufacturer && (
            <p className="text-xs text-muted-foreground">
              {mpn} - {manufacturer}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default WatchButton;
