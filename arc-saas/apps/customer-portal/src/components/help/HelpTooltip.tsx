/**
 * Help Tooltip Component
 * CBP-P2-010: Help Center & Documentation Integration
 *
 * Inline help tooltip for explaining complex fields and concepts.
 */

import { HelpCircle, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  /**
   * The help text to display
   */
  content: string;
  /**
   * Optional URL for "Learn more" link
   */
  learnMoreUrl?: string;
  /**
   * Tooltip position
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Tooltip alignment
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Icon size variant
   */
  size?: 'sm' | 'md';
}

export function HelpTooltip({
  content,
  learnMoreUrl,
  side = 'top',
  align = 'center',
  className,
  size = 'sm',
}: HelpTooltipProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'hover:bg-muted transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            buttonSize,
            className
          )}
          aria-label="More information"
        >
          <HelpCircle
            className={cn(iconSize, 'text-muted-foreground')}
            aria-hidden="true"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className="max-w-xs"
      >
        <p className="text-sm">{content}</p>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
          >
            Learn more
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Label with integrated help tooltip
 */
interface LabelWithHelpProps {
  /**
   * The label text
   */
  label: string;
  /**
   * Help text for the tooltip
   */
  help: string;
  /**
   * Optional "Learn more" URL
   */
  learnMoreUrl?: string;
  /**
   * The `for` attribute for the label
   */
  htmlFor?: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

export function LabelWithHelp({
  label,
  help,
  learnMoreUrl,
  htmlFor,
  required,
  className,
}: LabelWithHelpProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <HelpTooltip content={help} learnMoreUrl={learnMoreUrl} />
    </div>
  );
}

/**
 * Info box with help content
 */
interface HelpInfoBoxProps {
  /**
   * Title of the info box
   */
  title?: string;
  /**
   * Main content
   */
  children: React.ReactNode;
  /**
   * Variant style
   */
  variant?: 'info' | 'tip' | 'warning';
  /**
   * Additional CSS classes
   */
  className?: string;
}

export function HelpInfoBox({
  title,
  children,
  variant = 'info',
  className,
}: HelpInfoBoxProps) {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    tip: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
  };

  const iconColors = {
    info: 'text-blue-500',
    tip: 'text-green-500',
    warning: 'text-amber-500',
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border',
        variantStyles[variant],
        className
      )}
      role="note"
    >
      <HelpCircle
        className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColors[variant])}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-medium text-sm mb-1">{title}</p>
        )}
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default HelpTooltip;
