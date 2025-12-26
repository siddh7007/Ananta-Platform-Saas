/**
 * StepIndicator Component
 *
 * Individual step indicator for the vertical stepper showing:
 * - Step icon/number
 * - Step title
 * - Status (pending, active, complete, error)
 * - Connection line to next step
 */

import { LucideIcon, CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'active' | 'complete' | 'error' | 'skipped';

export interface StepIndicatorProps {
  /** Step number (1-based index) */
  stepNumber: number;
  /** Step title/label */
  title: string;
  /** Icon to display for this step */
  icon?: LucideIcon;
  /** Current status of the step */
  status: StepStatus;
  /** Optional description text */
  description?: string;
  /** Whether this is the last step (no connecting line) */
  isLast?: boolean;
  /** Click handler for navigation */
  onClick?: () => void;
  /** Whether the step is clickable */
  clickable?: boolean;
  /** Auto-scroll ref for active steps */
  scrollRef?: React.RefObject<HTMLDivElement>;
  className?: string;
}

export function StepIndicator({
  stepNumber,
  title,
  icon: Icon,
  status,
  description,
  isLast = false,
  onClick,
  clickable = false,
  scrollRef,
  className,
}: StepIndicatorProps) {
  // Determine colors and icons based on status
  const getStatusColors = () => {
    switch (status) {
      case 'complete':
        return {
          iconBg: 'bg-green-500',
          iconText: 'text-white',
          line: 'bg-green-500',
          text: 'text-foreground',
          border: 'border-green-500',
        };
      case 'active':
        return {
          iconBg: 'bg-primary',
          iconText: 'text-primary-foreground',
          line: 'bg-muted',
          text: 'text-foreground font-medium',
          border: 'border-primary',
        };
      case 'error':
        return {
          iconBg: 'bg-red-500',
          iconText: 'text-white',
          line: 'bg-muted',
          text: 'text-red-600',
          border: 'border-red-500',
        };
      case 'pending':
      default:
        return {
          iconBg: 'bg-muted',
          iconText: 'text-muted-foreground',
          line: 'bg-muted',
          text: 'text-muted-foreground',
          border: 'border-muted',
        };
    }
  };

  const colors = getStatusColors();

  const renderIcon = () => {
    if (status === 'complete') {
      return <CheckCircle className="h-5 w-5" />;
    }
    if (status === 'active') {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    if (status === 'error') {
      return <XCircle className="h-5 w-5" />;
    }
    if (Icon) {
      return <Icon className="h-5 w-5" />;
    }
    return <Circle className="h-5 w-5" />;
  };

  return (
    <div
      ref={status === 'active' ? scrollRef : undefined}
      className={cn(
        'relative flex gap-3 transition-all duration-200',
        clickable && 'cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2',
        className
      )}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Vertical line connecting steps */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-6 top-12 w-0.5 h-full',
            colors.line
          )}
          aria-hidden="true"
        />
      )}

      {/* Step icon/number circle */}
      <div
        className={cn(
          'relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2',
          colors.iconBg,
          colors.iconText,
          colors.border,
          'transition-all duration-200'
        )}
        aria-label={`Step ${stepNumber}: ${title}`}
      >
        {renderIcon()}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-8">
        <div className={cn('text-sm font-medium', colors.text)}>
          {title}
        </div>
        {description && (
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
        )}
        {status === 'active' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            In progress...
          </div>
        )}
      </div>
    </div>
  );
}

export default StepIndicator;
