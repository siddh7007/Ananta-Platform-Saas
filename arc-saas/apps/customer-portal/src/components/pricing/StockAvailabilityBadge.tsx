/**
 * StockAvailabilityBadge Component
 *
 * Displays stock status with visual indicators:
 * - Color-coded badges (green, yellow, red)
 * - Stock quantity
 * - Lead time information
 */

import { CheckCircle, AlertTriangle, XCircle, Clock, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { StockStatus } from '@/types/supplier';
import {
  getStockStatusConfig,
  getStockStatusFromQuantity,
  formatStock,
  formatLeadTime,
} from '@/types/supplier';

interface StockAvailabilityBadgeProps {
  /** Stock quantity available */
  quantity?: number | null;
  /** Required quantity (for comparison) */
  requiredQuantity?: number;
  /** Explicit stock status (overrides quantity-based calculation) */
  status?: StockStatus | string;
  /** Lead time in days */
  leadTimeDays?: number | null;
  /** Show lead time inline */
  showLeadTime?: boolean;
  /** Compact mode (smaller badge) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

const ICON_MAP = {
  check: CheckCircle,
  alert: AlertTriangle,
  x: XCircle,
  clock: Clock,
  help: HelpCircle,
};

export function StockAvailabilityBadge({
  quantity,
  requiredQuantity,
  status,
  leadTimeDays,
  showLeadTime = false,
  compact = false,
  className = '',
}: StockAvailabilityBadgeProps) {
  // Determine stock status
  const effectiveStatus = status
    ? (status as StockStatus)
    : getStockStatusFromQuantity(quantity ?? undefined, requiredQuantity);

  const config = getStockStatusConfig(effectiveStatus);
  const IconComponent = ICON_MAP[config.icon];

  // Format quantity display
  const quantityDisplay =
    quantity !== undefined && quantity !== null
      ? formatStock(quantity)
      : config.label;

  // Determine if we meet the required quantity
  const meetsRequirement =
    requiredQuantity && quantity !== undefined && quantity !== null
      ? quantity >= requiredQuantity
      : null;

  const badgeContent = (
    <Badge
      variant="outline"
      className={`
        ${config.bgColor} ${config.color} ${config.borderColor}
        ${compact ? 'text-xs px-1.5 py-0' : 'text-sm'}
        ${className}
      `}
    >
      <IconComponent className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
      {quantityDisplay}
      {showLeadTime && leadTimeDays !== undefined && leadTimeDays !== null && (
        <span className="ml-1.5 text-muted-foreground">
          ({formatLeadTime(leadTimeDays)})
        </span>
      )}
    </Badge>
  );

  // Wrap in tooltip for additional context
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            {quantity !== undefined && quantity !== null && (
              <p className="text-sm">
                {quantity.toLocaleString()} units available
              </p>
            )}
            {requiredQuantity && (
              <p
                className={`text-sm ${
                  meetsRequirement ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {meetsRequirement
                  ? `Meets required quantity (${requiredQuantity.toLocaleString()})`
                  : `Short ${(requiredQuantity - (quantity ?? 0)).toLocaleString()} units`}
              </p>
            )}
            {leadTimeDays !== undefined && leadTimeDays !== null && (
              <p className="text-sm text-muted-foreground">
                Lead time: {formatLeadTime(leadTimeDays)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline stock display for table cells
 */
export function StockInline({
  quantity,
  leadTimeDays,
  showLeadTime = true,
}: {
  quantity?: number | null;
  leadTimeDays?: number | null;
  showLeadTime?: boolean;
}) {
  if (quantity === undefined || quantity === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  const status = getStockStatusFromQuantity(quantity);
  const config = getStockStatusConfig(status);

  return (
    <span className={`text-sm ${config.color}`}>
      {formatStock(quantity)}
      {showLeadTime && leadTimeDays !== undefined && leadTimeDays !== null && (
        <span className="text-muted-foreground ml-1">
          ({formatLeadTime(leadTimeDays)})
        </span>
      )}
    </span>
  );
}

/**
 * Lead time badge component
 */
export function LeadTimeBadge({
  days,
  compact = false,
  className = '',
}: {
  days?: number | null;
  compact?: boolean;
  className?: string;
}) {
  if (days === undefined || days === null) {
    return (
      <Badge variant="outline" className={`text-muted-foreground ${className}`}>
        <HelpCircle className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
        Unknown
      </Badge>
    );
  }

  // Determine color based on lead time
  let colorClasses: string;
  if (days === 0) {
    colorClasses = 'bg-green-50 text-green-700 border-green-200';
  } else if (days <= 7) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (days <= 14) {
    colorClasses = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  } else {
    colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
  }

  return (
    <Badge variant="outline" className={`${colorClasses} ${className}`}>
      <Clock className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
      {formatLeadTime(days)}
    </Badge>
  );
}

export default StockAvailabilityBadge;
