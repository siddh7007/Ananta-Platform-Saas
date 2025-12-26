import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the skeleton */
  variant?: 'text' | 'circular' | 'rectangular';
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton - Loading placeholder component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Skeleton className="h-4 w-32" />
 *
 * // Circular avatar
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * // Wave animation
 * <Skeleton animation="wave" className="h-20 w-full" />
 *
 * // No animation
 * <Skeleton animation="none" className="h-8 w-24" />
 * ```
 */
function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <div
      className={cn(
        'bg-muted',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      {...props}
    />
  );
}

export { Skeleton };
