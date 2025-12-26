import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertBadge } from './AlertBadge';
import { useMarkAlertAsRead, useDismissAlert } from '@/hooks/useAlerts';
import { format } from 'date-fns';
import { CheckCircle, Trash2, ExternalLink } from 'lucide-react';
import type { Alert } from '@/types/alert';
import { useNavigate } from 'react-router-dom';

interface AlertDetailSheetProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertDetailSheet({ alert, open, onOpenChange }: AlertDetailSheetProps) {
  const navigate = useNavigate();
  const markAsRead = useMarkAlertAsRead();
  const dismissAlert = useDismissAlert();

  if (!alert) return null;

  const handleMarkAsRead = async () => {
    await markAsRead.mutateAsync(alert.id);
  };

  const handleDismiss = async () => {
    await dismissAlert.mutateAsync(alert.id);
    onOpenChange(false);
  };

  const handleViewComponent = () => {
    if (alert.componentId) {
      navigate(`/components/${alert.componentId}`);
      onOpenChange(false);
    }
  };

  const handleViewBom = () => {
    if (alert.bomId) {
      navigate(`/boms/${alert.bomId}`);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <SheetTitle className="text-xl">{alert.title}</SheetTitle>
                <SheetDescription className="mt-2">{alert.message}</SheetDescription>
              </div>
              {alert.status === 'unread' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  New
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <AlertBadge variant="severity" value={alert.severity} />
              <AlertBadge variant="type" value={alert.type} />
            </div>
          </div>
        </SheetHeader>

        <div className="my-6 border-t" />

        <div className="space-y-6">
          {/* Alert Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Details</h3>

            <div className="grid gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(alert.createdAt), 'PPp')}
                </p>
              </div>

              {alert.readAt && (
                <div>
                  <p className="text-muted-foreground">Read</p>
                  <p className="font-medium">
                    {format(new Date(alert.readAt), 'PPp')}
                  </p>
                </div>
              )}

              {alert.componentMpn && (
                <div>
                  <p className="text-muted-foreground">Component</p>
                  <p className="font-medium">
                    {alert.componentMpn}
                    {alert.manufacturer && ` - ${alert.manufacturer}`}
                  </p>
                </div>
              )}

              {alert.bomName && (
                <div>
                  <p className="text-muted-foreground">BOM</p>
                  <p className="font-medium">{alert.bomName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <>
              <div className="border-t" />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Additional Information</h3>
                <div className="grid gap-2 text-sm">
                  {Object.entries(alert.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t" />

          {/* Actions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Actions</h3>

            <div className="flex flex-col gap-2">
              {alert.status === 'unread' && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={handleMarkAsRead}
                  disabled={markAsRead.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Read
                </Button>
              )}

              {alert.componentId && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={handleViewComponent}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Component
                </Button>
              )}

              {alert.bomId && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={handleViewBom}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View BOM
                </Button>
              )}

              <Button
                variant="outline"
                className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                onClick={handleDismiss}
                disabled={dismissAlert.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Dismiss Alert
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
