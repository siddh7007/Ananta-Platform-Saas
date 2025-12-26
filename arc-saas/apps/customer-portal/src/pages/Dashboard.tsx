/**
 * Dashboard page - main entry point for authenticated users
 *
 * Shows BOM stats from CNS service, organization activity, and recent assets.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Cpu, Users, TrendingUp, RefreshCw, AlertCircle, Search, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { getWorkspaceSummary } from '@/services/workspace.service';
import { getLifecycleStats } from '@/services/component.service';
import { getTeamMembers } from '@/services/team.service';
import { listBoms } from '@/services/bom.service';
import { GlobalSearch } from '@/components/shared/GlobalSearch';

interface ActivityItem {
  id: string;
  type: 'workspace' | 'project' | 'bom';
  title: string;
  description: string;
  timestamp: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, isLoading: isTenantLoading } = useTenant();
  const organizationId = currentTenant?.id;
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    data: workspaceSummary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ['dashboard', 'summary', organizationId],
    queryFn: getWorkspaceSummary,
    enabled: !!organizationId && !isTenantLoading,
  });

  const { data: lifecycleStats, isLoading: componentsLoading } = useQuery({
    queryKey: ['dashboard', 'components', organizationId],
    queryFn: getLifecycleStats,
    enabled: !!organizationId && !isTenantLoading,
  });

  // Fetch team count - limit: 1 is just to get total count without fetching all data
  // The service normalizes the response so response.total always gives the real count
  const { data: teamCount, isLoading: teamLoading } = useQuery({
    queryKey: ['dashboard', 'team-members', organizationId],
    queryFn: async () => {
      const response = await getTeamMembers({ page: 1, limit: 1 });
      // response.total is set by team.service.ts from API total or array length fallback
      return response.total ?? 0;
    },
    enabled: !!organizationId && !isTenantLoading,
  });

  const { data: processingCount, isLoading: processingLoading } = useQuery({
    queryKey: ['dashboard', 'processing-boms', organizationId],
    queryFn: async () => {
      const response = await listBoms({ status: 'processing', limit: 1 });
      return response.total;
    },
    enabled: !!organizationId && !isTenantLoading,
  });

  const { data: recentBoms, isLoading: recentBomsLoading } = useQuery({
    queryKey: ['dashboard', 'recent-boms', organizationId],
    queryFn: () => listBoms({ limit: 5 }),
    enabled: !!organizationId && !isTenantLoading,
  });

  const totalComponents = useMemo(() => {
    if (!lifecycleStats) return 0;
    return (
      (lifecycleStats.active ?? 0) +
      (lifecycleStats.nrnd ?? 0) +
      (lifecycleStats.obsolete ?? 0) +
      (lifecycleStats.unknown ?? 0)
    );
  }, [lifecycleStats]);

  // Build activity items from available data sources
  // Handle both {data: [...]} and {items: [...], total: N} response formats
  const activityItems: ActivityItem[] = useMemo(() => {
    const bomList = recentBoms?.data ?? [];

    // If no workspace summary, just show recent BOMs
    if (!workspaceSummary) {
      return bomList.map((bom) => ({
        id: `bom-${bom.id}`,
        type: 'bom' as const,
        title: bom.name || 'Untitled BOM',
        description: `Status: ${bom.status || 'unknown'}`,
        timestamp: bom.updatedAt || bom.createdAt || new Date().toISOString(),
      }));
    }

    const workspaceActivity =
      (workspaceSummary.recentWorkspaces ?? []).map((workspace) => ({
        id: `workspace-${workspace.id}`,
        type: 'workspace' as const,
        title: workspace.name || 'Untitled Workspace',
        description: workspace.description || `Created by ${workspace.createdByName || 'Unknown'}`,
        timestamp: workspace.updatedAt || workspace.createdAt || new Date().toISOString(),
      }));

    const projectActivity =
      (workspaceSummary.recentProjects ?? []).map((project) => ({
        id: `project-${project.id}`,
        type: 'project' as const,
        title: project.name || 'Untitled Project',
        description: `${project.bomCount ?? 0} BOMs • Status: ${project.status || 'active'}`,
        timestamp: project.updatedAt || project.createdAt || new Date().toISOString(),
      }));

    const bomActivity = bomList.map((bom) => ({
      id: `bom-${bom.id}`,
      type: 'bom' as const,
      title: bom.name || 'Untitled BOM',
      description: `Status: ${bom.status || 'unknown'}`,
      timestamp: bom.updatedAt || bom.createdAt || new Date().toISOString(),
    }));

    // Combine and sort by timestamp, filter out items with invalid timestamps
    return [...workspaceActivity, ...projectActivity, ...bomActivity]
      .filter((item) => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [workspaceSummary, recentBoms]);

  const stats = {
    totalBoms: workspaceSummary?.totalBoms ?? 0,
    totalComponents,
    teamMembers: teamCount ?? 0,
    processingBoms: processingCount ?? 0,
    totalWorkspaces: workspaceSummary?.totalWorkspaces ?? 0,
    totalProjects: workspaceSummary?.totalProjects ?? 0,
  };

  const isLoading =
    summaryLoading ||
    componentsLoading ||
    teamLoading ||
    processingLoading ||
    recentBomsLoading ||
    isTenantLoading;

  // Refresh dashboard data - invalidate each query individually for better control
  const handleRefresh = useCallback(() => {
    if (!organizationId) {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'components', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'team-members', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'processing-boms', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-boms', organizationId] });
  }, [queryClient, organizationId]);

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview for {currentTenant?.name ?? 'your workspace'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Component Search Box - Opens Global Search */}
      <div
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-3 rounded-lg border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <Search className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <span className="text-muted-foreground">Search components, BOMs, manufacturers...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {(summaryError || (!organizationId && !isTenantLoading)) && (
        <div
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {summaryError
                ? 'Failed to load dashboard data'
                : 'Select a workspace to view dashboard data'}
            </p>
            <p className="text-sm">
              {summaryError
                ? 'Unable to connect to the backend services. Please try again.'
                : 'Choose a workspace from the selector to load metrics.'}
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total BOMs"
          value={isLoading ? '-' : stats.totalBoms.toLocaleString()}
          description={
            stats.processingBoms ? `${stats.processingBoms} processing` : 'No BOMs processing'
          }
          icon={FileText}
          isLoading={isLoading}
          onClick={() => navigate('/boms')}
        />
        <StatCard
          title="Components"
          value={isLoading ? '-' : stats.totalComponents.toLocaleString()}
          description="Across your catalog"
          icon={Cpu}
          isLoading={isLoading}
          onClick={() => navigate('/components')}
        />
        <StatCard
          title="Team Members"
          value={isLoading ? '-' : stats.teamMembers.toString()}
          description={stats.teamMembers === 0 ? 'No team members yet' : 'Active members'}
          icon={Users}
          isLoading={isLoading}
          onClick={() => navigate('/team')}
        />
        <StatCard
          title="Workspaces"
          value={isLoading ? '-' : stats.totalWorkspaces.toString()}
          description={`${stats.totalProjects ?? 0} projects`}
          icon={TrendingUp}
          isLoading={isLoading}
          onClick={() => navigate('/workspaces')}
        />
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <button
            onClick={handleRefresh}
            className="text-sm text-primary hover:underline"
            disabled={isLoading}
          >
            Refresh activity
          </button>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 p-2 animate-pulse">
                <div className="h-2 w-2 mt-2 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : activityItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity</p>
            <p className="text-sm">Recent workspaces, projects, and BOMs will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activityItems.map((item) => (
              <ActivityItemCard
                key={item.id}
                title={item.title}
                description={item.description}
                time={formatRelativeTime(item.timestamp)}
                type={item.type}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  onClick?: () => void;
}

function StatCard({ title, value, description, icon: Icon, isLoading, onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2">
        {isLoading ? (
          <div className="h-8 bg-muted rounded w-16 animate-pulse" />
        ) : (
          <span className="text-2xl font-bold">{value}</span>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface ActivityItemCardProps {
  title: string;
  description: string;
  time: string;
  type: ActivityItem['type'];
}

function ActivityItemCard({ title, description, time, type }: ActivityItemCardProps) {
  const typeColors: Record<ActivityItem['type'], string> = {
    workspace: 'bg-amber-100 text-amber-700',
    project: 'bg-slate-100 text-slate-700',
    bom: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-1',
          typeColors[type]
        )}
      >
        {type === 'bom' ? 'BOM' : type}
      </span>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <time className="text-xs text-muted-foreground">{time}</time>
    </div>
  );
}
