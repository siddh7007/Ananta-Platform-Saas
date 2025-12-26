/**
 * Recent Activity Widget
 * CBP-P2-008: Dashboard Analytics - Activity timeline
 */

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Edit,
  Trash2,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Activity {
  id: string;
  type: 'upload' | 'enrich' | 'edit' | 'delete' | 'invite';
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  metadata?: {
    bomName?: string;
    itemCount?: number;
  };
}

// Mock data for development
const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: 'upload',
    description: 'Uploaded new BOM',
    user: { name: 'John Owner' },
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    metadata: { bomName: 'Product-A-Rev3.xlsx', itemCount: 245 },
  },
  {
    id: '2',
    type: 'enrich',
    description: 'Enrichment completed',
    user: { name: 'System' },
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    metadata: { bomName: 'Sensor-Board-v2', itemCount: 128 },
  },
  {
    id: '3',
    type: 'edit',
    description: 'Modified line items',
    user: { name: 'Jane Admin' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metadata: { bomName: 'Power-Supply-Unit' },
  },
  {
    id: '4',
    type: 'invite',
    description: 'Invited new team member',
    user: { name: 'John Owner' },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'upload',
    description: 'Uploaded new BOM',
    user: { name: 'Bob Engineer' },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    metadata: { bomName: 'Control-Board-v1.csv', itemCount: 89 },
  },
];

const ACTIVITY_ICONS: Record<string, typeof Upload> = {
  upload: Upload,
  enrich: Sparkles,
  edit: Edit,
  delete: Trash2,
  invite: User,
};

const ACTIVITY_COLORS: Record<string, string> = {
  upload: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  enrich: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  edit: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
  delete: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  invite: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function RecentActivityWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return MOCK_ACTIVITIES;
    },
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activities = data || MOCK_ACTIVITIES;

  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICONS[activity.type] || FileSpreadsheet;
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div
                className={`p-2 rounded-full ${ACTIVITY_COLORS[activity.type]}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user.name}</span>{' '}
                  <span className="text-muted-foreground">
                    {activity.description}
                  </span>
                </p>
                {activity.metadata?.bomName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.metadata.bomName}
                    {activity.metadata.itemCount && (
                      <span> ({activity.metadata.itemCount} items)</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default RecentActivityWidget;
