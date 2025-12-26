/**
 * StatusBadge Component
 *
 * Accessible status indicator with icon + color combination.
 * Ensures status is understandable without relying on color alone.
 *
 * Features:
 * - Color-blind safe palette
 * - Icons alongside colors
 * - Animated icons for active states
 * - Dark mode support
 * - ARIA labels for screen readers
 */

import { cn } from '@/lib/utils';
import { STATUS_CONFIG, type StatusType } from '@/lib/status-colors';

export interface StatusBadgeProps {
  status: StatusType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  customLabel?: string;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function StatusBadge({
  status,
  showLabel = true,
  size = 'md',
  className,
  customLabel,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayLabel = customLabel || config.label;
  const shouldAnimate = 'animate' in config && config.animate === true;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <Icon
        className={cn(
          iconSizes[size],
          shouldAnimate && 'animate-spin'
        )}
        aria-hidden="true"
      />
      {showLabel && <span>{displayLabel}</span>}
    </span>
  );
}
