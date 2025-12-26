/**
 * Loading Spinner Components
 * Accessible loading indicators with scroll lock and ARIA support
 *
 * Accessibility:
 * - aria-busy on container elements during loading
 * - role="status" with aria-live for screen reader announcements
 * - Scroll lock on full-page overlays to prevent background interaction
 * - Respects prefers-reduced-motion
 */

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Optional label text */
  label?: string;
  /** Whether to center in container */
  centered?: boolean;
  /** Whether to show full-page overlay */
  fullPage?: boolean;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * Hook to lock body scroll when loading overlay is shown
 */
function useScrollLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [enabled]);
}

/**
 * Loading spinner component with various sizes and display options
 */
export function LoadingSpinner({
  size = 'md',
  className,
  label,
  centered = false,
  fullPage = false,
  ariaLabel = 'Loading',
}: LoadingSpinnerProps) {
  // Lock scroll for full-page overlays
  useScrollLock(fullPage);

  const spinner = (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col items-center gap-2',
        centered && 'justify-center',
        className
      )}
    >
      <Loader2
        className={cn(
          'animate-spin text-primary motion-reduce:animate-none',
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
      {label && (
        <span className="text-sm text-muted-foreground animate-pulse motion-reduce:animate-none">
          {label}
        </span>
      )}
      {/* Screen reader only text */}
      <span className="sr-only">{label || ariaLabel}</span>
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        aria-busy="true"
        aria-describedby="loading-message"
      >
        <div id="loading-message">
          {spinner}
        </div>
      </div>
    );
  }

  if (centered) {
    return (
      <div
        className="flex min-h-[200px] items-center justify-center"
        aria-busy="true"
      >
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Page-level loading state component
 */
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" ariaLabel={message} />
      <p className="text-muted-foreground" aria-hidden="true">{message}</p>
    </div>
  );
}

/**
 * Inline loading indicator for buttons, etc.
 */
export function InlineLoading({
  className,
  ariaLabel = 'Loading',
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <span role="status" aria-label={ariaLabel}>
      <Loader2
        className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', className)}
        aria-hidden="true"
      />
      <span className="sr-only">{ariaLabel}</span>
    </span>
  );
}

/**
 * Loading overlay for specific containers
 * Applies aria-busy to the container and prevents interaction during load
 */
export function LoadingOverlay({
  isLoading,
  children,
  message,
  lockScroll = false,
}: {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
  /** Lock scroll on the page while loading (for full-height overlays) */
  lockScroll?: boolean;
}) {
  // Optionally lock scroll for full-height overlays
  useScrollLock(isLoading && lockScroll);

  return (
    <div className="relative" aria-busy={isLoading}>
      {/* Apply pointer-events-none to children when loading */}
      <div className={isLoading ? 'pointer-events-none' : undefined}>
        {children}
      </div>
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="lg" label={message} ariaLabel={message || 'Loading'} />
        </div>
      )}
    </div>
  );
}

export default LoadingSpinner;
