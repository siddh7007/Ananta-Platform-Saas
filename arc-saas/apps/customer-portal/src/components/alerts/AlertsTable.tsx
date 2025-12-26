import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertBadge } from './AlertBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Eye, CheckCircle, Trash2, Bell } from 'lucide-react';
import type { Alert } from '@/types/alert';
import { EmptyState } from '@/components/shared';

interface AlertsTableProps {
  alerts: Alert[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectOne: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetails: (alert: Alert) => void;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function AlertsTable({
  alerts,
  isLoading,
  selectedIds,
  onSelectOne,
  onSelectAll,
  onViewDetails,
  onMarkAsRead,
  onDismiss,
}: AlertsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No alerts"
        description="You're all caught up! Alerts will appear here when there are component lifecycle changes, supply chain updates, or risk notifications."
        size="md"
      />
    );
  }

  const allSelected = alerts.length > 0 && alerts.every((alert) => selectedIds.has(alert.id));
  const someSelected = alerts.some((alert) => selectedIds.has(alert.id)) && !allSelected;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Select all"
                className={someSelected ? 'data-[state=checked]:bg-muted' : ''}
              />
            </TableHead>
            <TableHead>Alert</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead className="w-[140px]">Date</TableHead>
            <TableHead className="w-[160px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow
              key={alert.id}
              className={`cursor-pointer ${alert.status === 'unread' ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
              onClick={() => onViewDetails(alert)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(alert.id)}
                  onCheckedChange={(checked) => onSelectOne(alert.id, checked as boolean)}
                  aria-label={`Select alert ${alert.id}`}
                />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{alert.title}</p>
                    {alert.status === 'unread' && (
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{alert.message}</p>
                  {(alert.componentMpn || alert.bomName) && (
                    <p className="text-xs text-muted-foreground">
                      {alert.componentMpn && `${alert.componentMpn}`}
                      {alert.componentMpn && alert.bomName && ' • '}
                      {alert.bomName && `BOM: ${alert.bomName}`}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <AlertBadge variant="type" value={alert.type} />
              </TableCell>
              <TableCell>
                <AlertBadge variant="severity" value={alert.severity} />
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p title={format(new Date(alert.createdAt), 'PPp')}>
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(alert)}
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {alert.status === 'unread' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkAsRead(alert.id)}
                      title="Mark as read"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(alert.id)}
                    title="Dismiss"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
