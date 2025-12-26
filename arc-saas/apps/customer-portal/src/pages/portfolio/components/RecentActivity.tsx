/**
 * Recent Activity Component
 * CBP-P2-001: Organization-wide activity feed
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  UserPlus,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type ActivityType =
  | 'bom_created'
  | 'bom_uploaded'
  | 'bom_enriched'
  | 'bom_exported'
  | 'bom_deleted'
  | 'bom_updated'
  | 'risk_detected'
  | 'team_member_added';

interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: {
    bomId?: string;
    bomName?: string;
    riskType?: string;
    count?: number;
  };
}

interface RecentActivityProps {
  limit?: number;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  bom_created: FileSpreadsheet,
  bom_uploaded: Upload,
  bom_enriched: CheckCircle,
  bom_exported: Download,
  bom_deleted: Trash2,
  bom_updated: Edit,
  risk_detected: AlertTriangle,
  team_member_added: UserPlus,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  bom_created: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
  bom_uploaded: 'text-green-500 bg-green-100 dark:bg-green-900/30',
  bom_enriched: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
  bom_exported: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  bom_deleted: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  bom_updated: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
  risk_detected: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
  team_member_added: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30',
};

async function fetchRecentActivity(limit: number): Promise<ActivityItem[]> {
  const response = await fetch(`/api/portfolio/activity?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity');
  }
  return response.json();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Mock data for development
const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'bom_uploaded',
    message: 'uploaded a new BOM',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    user: { id: '1', name: 'Alice Johnson' },
    metadata: { bomName: 'Power Supply v2.3' },
  },
  {
    id: '2',
    type: 'bom_enriched',
    message: 'completed enrichment for',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    user: { id: '2', name: 'Bob Smith' },
    metadata: { bomName: 'Sensor Board Rev A', count: 45 },
  },
  {
    id: '3',
    type: 'risk_detected',
    message: 'Risk detected in BOM',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    user: { id: '0', name: 'System' },
    metadata: { bomName: 'Motor Controller', riskType: 'obsolete' },
  },
  {
    id: '4',
    type: 'team_member_added',
    message: 'added new team member',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { id: '3', name: 'Carol Davis' },
    metadata: {},
  },
  {
    id: '5',
    type: 'bom_exported',
    message: 'exported BOM to CSV',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    user: { id: '4', name: 'David Lee' },
    metadata: { bomName: 'Main Board v1.0' },
  },
  {
    id: '6',
    type: 'bom_created',
    message: 'created new BOM',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user: { id: '5', name: 'Emma Wilson' },
    metadata: { bomName: 'Display Module' },
  },
  {
    id: '7',
    type: 'bom_updated',
    message: 'updated BOM quantities',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    user: { id: '1', name: 'Alice Johnson' },
    metadata: { bomName: 'Power Supply v2.3', count: 12 },
  },
  {
    id: '8',
    type: 'bom_deleted',
    message: 'deleted BOM',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: { id: '2', name: 'Bob Smith' },
    metadata: { bomName: 'Legacy Board (deprecated)' },
  },
];

export function RecentActivity({ limit = 10 }: RecentActivityProps) {
  // API integration - uncomment when ready
  // const { data: activities, isLoading, error } = useQuery({
  //   queryKey: ['portfolio-activity', limit],
  //   queryFn: () => fetchRecentActivity(limit),
  //   staleTime: 30 * 1000,
  //   refetchInterval: 60 * 1000, // Refresh every minute
  // });

  // Mock data for development
  const isLoading = false;
  const activities = MOCK_ACTIVITIES.slice(0, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="space-y-1 p-4 pt-0" role="feed" aria-label="Recent activity">
            {activities?.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const colorClass = ACTIVITY_COLORS[activity.type];
              const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
                addSuffix: true,
              });

              return (
                <article
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-3 p-2 rounded-lg transition-colors',
                    'hover:bg-muted/50'
                  )}
                  aria-posinset={index + 1}
                  aria-setsize={activities.length}
                >
                  <div
                    className={cn('p-1.5 rounded-full shrink-0', colorClass)}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">
                      <span className="font-medium">{activity.user.name}</span>{' '}
                      <span className="text-muted-foreground">{activity.message}</span>
                      {activity.metadata?.bomName && (
                        <>
                          {' '}
                          <span className="font-medium">{activity.metadata.bomName}</span>
                        </>
                      )}
                      {activity.metadata?.count && (
                        <>
                          {' '}
                          <Badge variant="secondary" className="text-xs">
                            {activity.metadata.count} items
                          </Badge>
                        </>
                      )}
                      {activity.metadata?.riskType && (
                        <>
                          {' '}
                          <Badge variant="destructive" className="text-xs">
                            {activity.metadata.riskType}
                          </Badge>
                        </>
                      )}
                    </p>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={activity.timestamp}
                    >
                      {timeAgo}
                    </time>
                  </div>
                </article>
              );
            })}

            {(!activities || activities.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                No recent activity
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default RecentActivity;
