import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface NotificationBellProps {
  unseenCount?: number;
  onClick?: () => void;
}

/**
 * Notification bell icon with badge for unread count
 * Used as trigger for notification popover
 */
export function NotificationBell({ unseenCount = 0, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center rounded-md p-2 transition-colors',
        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
      )}
      aria-label={`Notifications${unseenCount > 0 ? ` (${unseenCount} unread)` : ''}`}
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {unseenCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs"
        >
          {unseenCount > 99 ? '99+' : unseenCount}
        </Badge>
      )}
    </button>
  );
}

/**
 * Notification bell wrapped in a popover
 * This is a standalone version for use outside the Novu provider
 */
export function NotificationBellPopover({ children }: { children?: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div>
          <NotificationBell unseenCount={0} />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {children || (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
