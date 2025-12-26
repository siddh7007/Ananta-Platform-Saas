/**
 * Alert Action Menu Component
 * Dropdown menu for per-alert actions: View, Acknowledge, Snooze, Dismiss
 */

import { useState } from 'react';
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import type { Alert } from '@/types/alert';

export interface AlertActionMenuProps {
  alert: Alert;
  onView?: (alert: Alert) => void;
  onAcknowledge?: (alertId: string) => void;
  onSnooze?: (alertId: string, days: number) => void;
  onDismiss?: (alertId: string) => void;
  onViewComponent?: (componentId: string) => void;
  disabled?: boolean;
}

const SNOOZE_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];

export function AlertActionMenu({
  alert,
  onView,
  onAcknowledge,
  onSnooze,
  onDismiss,
  onViewComponent,
  disabled = false,
}: AlertActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleView = () => {
    onView?.(alert);
    setIsOpen(false);
  };

  const handleAcknowledge = () => {
    onAcknowledge?.(alert.id);
    setIsOpen(false);
  };

  const handleSnooze = (days: number) => {
    onSnooze?.(alert.id, days);
    setIsOpen(false);
  };

  const handleDismiss = () => {
    onDismiss?.(alert.id);
    setIsOpen(false);
  };

  const handleViewComponent = () => {
    if (alert.componentId) {
      onViewComponent?.(alert.componentId);
    }
    setIsOpen(false);
  };

  const isAcknowledged = alert.status === 'acknowledged';
  const isSnoozed = alert.status === 'snoozed';
  const isDismissed = alert.status === 'dismissed';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Alert actions</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {/* View Details */}
        <DropdownMenuItem onClick={handleView}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>

        {/* View Component (if applicable) */}
        {alert.componentId && onViewComponent && (
          <DropdownMenuItem onClick={handleViewComponent}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Component
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Acknowledge (only if not already acknowledged) */}
        {!isAcknowledged && !isDismissed && (
          <DropdownMenuItem onClick={handleAcknowledge}>
            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            Acknowledge
          </DropdownMenuItem>
        )}

        {/* Snooze submenu */}
        {!isDismissed && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="mr-2 h-4 w-4 text-blue-600" />
              {isSnoozed ? 'Snooze Again' : 'Snooze'}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              {SNOOZE_OPTIONS.map(({ days, label }) => (
                <DropdownMenuItem
                  key={days}
                  onClick={() => handleSnooze(days)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        {/* Dismiss */}
        {!isDismissed && (
          <DropdownMenuItem
            onClick={handleDismiss}
            className="text-red-600 focus:text-red-600"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Dismiss
          </DropdownMenuItem>
        )}

        {/* Show status for dismissed alerts */}
        {isDismissed && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            <XCircle className="mr-2 h-4 w-4" />
            Already Dismissed
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AlertActionMenu;
