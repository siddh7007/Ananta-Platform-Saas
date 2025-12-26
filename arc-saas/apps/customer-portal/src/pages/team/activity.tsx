/**
 * Team Activity Log Page
 *
 * Displays a timeline of team member activities with filtering and export capabilities.
 * Shows actions like user creation, role changes, logins, etc.
 */

import { useEffect, useState } from 'react';
import {
  Activity,
  Download,
  RefreshCw,
  AlertCircle,
  Filter,
  Calendar,
  User,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole } from '@/config/auth';
import type { AppRole } from '@/config/auth';
import { getTeamActivity, getTeamMembers } from '@/services/team.service';
import type { ActivityLogEntry, TeamMember } from '@/types/team';
import { cn } from '@/lib/utils';
import { formatLastActive } from '@/types/team';

export default function TeamActivityPage() {
  const { user } = useAuth();

  const userRole = (user?.role || 'analyst') as AppRole;
  const isAdmin = hasMinimumRole(userRole, 'admin');

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const limit = 20;

  // Load team members for filter dropdown
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const result = await getTeamMembers({ limit: 100 });
        setMembers(result.data);
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    };
    loadMembers();
  }, []);

  // Load activities
  const loadActivities = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getTeamActivity({
        page,
        limit,
        userId: selectedUser || undefined,
      });

      // Filter by action and date range (client-side for now)
      let filtered = result.data;

      if (selectedAction) {
        filtered = filtered.filter((a) => a.action === selectedAction);
      }

      if (dateFrom) {
        filtered = filtered.filter((a) => new Date(a.occurredAt) >= new Date(dateFrom));
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((a) => new Date(a.occurredAt) <= endDate);
      }

      setActivities(filtered);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load activities:', err);
      setError('Failed to load activity log');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [page, selectedUser, selectedAction, dateFrom, dateTo]);

  // Export to CSV
  const handleExport = () => {
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
    ];

    const rows = activities.map((activity) => [
      new Date(activity.occurredAt).toLocaleString(),
      activity.user?.email || activity.userId,
      activity.action,
      activity.entityType || '',
      activity.entityId || '',
      activity.ipAddress || '',
      activity.userAgent || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique action types for filter
  const actionTypes = Array.from(new Set(activities.map((a) => a.action))).sort();

  // Get action color
  const getActionColor = (action: string): string => {
    if (action.includes('create')) return 'text-green-600 bg-green-50';
    if (action.includes('delete') || action.includes('remove'))
      return 'text-red-600 bg-red-50';
    if (action.includes('update') || action.includes('change'))
      return 'text-blue-600 bg-blue-50';
    if (action.includes('login')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    if (action.includes('create')) return '✓';
    if (action.includes('delete') || action.includes('remove')) return '✕';
    if (action.includes('update') || action.includes('change')) return '↻';
    if (action.includes('login')) return '→';
    return '•';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Team Activity Log
          </h1>
          <p className="text-muted-foreground">
            {total > 0 ? `${total} activities recorded` : 'Track team member actions'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadActivities}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </button>

          {isAdmin && activities.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              <User className="inline h-3 w-3 mr-1" />
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Users</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">
              <Activity className="inline h-3 w-3 mr-1" />
              Action
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium mb-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium mb-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedUser || selectedAction || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSelectedUser('');
              setSelectedAction('');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Activity Timeline */}
      {!isLoading && activities.length === 0 && (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No activities found</h3>
          <p className="text-muted-foreground">
            {selectedUser || selectedAction || dateFrom || dateTo
              ? 'Try adjusting your filters'
              : 'Team activities will appear here'}
          </p>
        </div>
      )}

      {!isLoading && activities.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {/* Activity items */}
            <div className="space-y-6">
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute left-2.5 top-2 h-3 w-3 rounded-full',
                      getActionColor(activity.action)
                    )}
                  />

                  {/* Activity card */}
                  <div className="rounded-lg border bg-background p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            getActionColor(activity.action)
                          )}
                        >
                          {getActionIcon(activity.action)} {activity.action}
                        </span>
                        {activity.entityType && (
                          <span className="text-xs text-muted-foreground">
                            {activity.entityType}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatLastActive(activity.occurredAt)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          {activity.user?.name || activity.user?.email || 'Unknown User'}
                        </span>
                      </div>

                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            View details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      )}

                      {activity.ipAddress && (
                        <div className="text-xs text-muted-foreground">
                          IP: {activity.ipAddress}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of{' '}
                {total} activities
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
