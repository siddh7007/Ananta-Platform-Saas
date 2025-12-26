/**
 * Alerts Table Component
 * Paginated table displaying active alerts with severity chips and actions
 */

import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, AlertCircle, Info, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertActionMenu } from './AlertActionMenu';
import type { Alert, AlertSeverity, AlertType, AlertStatus } from '@/types/alert';

export interface AlertsTableProps {
  alerts: Alert[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView?: (alert: Alert) => void;
  onAcknowledge?: (alertId: string) => void;
  onSnooze?: (alertId: string, days: number) => void;
  onDismiss?: (alertId: string) => void;
  onViewComponent?: (componentId: string) => void;
}

// Severity configuration
const SEVERITY_CONFIG: Record<AlertSeverity, {
  color: string;
  bg: string;
  icon: typeof AlertTriangle;
  label: string;
}> = {
  critical: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    icon: AlertTriangle,
    label: 'Critical',
  },
  high: {
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    icon: AlertTriangle,
    label: 'High',
  },
  medium: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    icon: AlertCircle,
    label: 'Medium',
  },
  low: {
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: Info,
    label: 'Low',
  },
  info: {
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: Info,
    label: 'Info',
  },
};

// Alert type labels
const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  LIFECYCLE: 'Lifecycle',
  RISK: 'Risk Score',
  PRICE: 'Price Change',
  AVAILABILITY: 'Availability',
  COMPLIANCE: 'Compliance',
  PCN: 'PCN',
  SUPPLY_CHAIN: 'Supply Chain',
};

// Status badge configuration
const STATUS_CONFIG: Record<AlertStatus, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  unread: { variant: 'default', label: 'New' },
  read: { variant: 'secondary', label: 'Read' },
  acknowledged: { variant: 'outline', label: 'Acknowledged' },
  snoozed: { variant: 'outline', label: 'Snoozed' },
  dismissed: { variant: 'secondary', label: 'Dismissed' },
};

interface SeverityBadgeProps {
  severity: AlertSeverity;
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
      config.bg,
      config.color
    )}>
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-8 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-1">No alerts</h3>
      <p className="text-sm text-muted-foreground">
        You don't have any alerts matching the current filters.
      </p>
    </div>
  );
}

export function AlertsTable({
  alerts,
  isLoading = false,
  page,
  totalPages,
  onPageChange,
  onView,
  onAcknowledge,
  onSnooze,
  onDismiss,
  onViewComponent,
}: AlertsTableProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (alerts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead>Component</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead>BOM</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Time</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow
                key={alert.id}
                className={cn(
                  alert.status === 'unread' && 'bg-muted/30',
                  alert.status === 'dismissed' && 'opacity-60'
                )}
              >
                {/* Severity */}
                <TableCell>
                  <SeverityBadge severity={alert.severity} />
                </TableCell>

                {/* Component */}
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">
                      {alert.componentMpn || 'Unknown MPN'}
                    </p>
                    {alert.manufacturer && (
                      <p className="text-xs text-muted-foreground">
                        {alert.manufacturer}
                      </p>
                    )}
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell>
                  <span className="text-sm">
                    {ALERT_TYPE_LABELS[alert.type] || alert.type}
                  </span>
                </TableCell>

                {/* BOM */}
                <TableCell>
                  {alert.bomName ? (
                    <span className="text-sm">{alert.bomName}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant={STATUS_CONFIG[alert.status]?.variant || 'secondary'}>
                    {STATUS_CONFIG[alert.status]?.label || alert.status}
                  </Badge>
                </TableCell>

                {/* Time */}
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <AlertActionMenu
                    alert={alert}
                    onView={onView}
                    onAcknowledge={onAcknowledge}
                    onSnooze={onSnooze}
                    onDismiss={onDismiss}
                    onViewComponent={onViewComponent}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsTable;
