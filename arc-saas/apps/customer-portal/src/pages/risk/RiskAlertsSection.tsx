/**
 * Risk Alerts Section Component
 * Container combining risk category summary cards + alerts table with filters
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, CheckCheck, RefreshCw, Filter, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert as AlertBanner, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { RiskCategorySummary } from '@/components/risk/RiskCategorySummary';
import { AlertsTable } from '@/components/risk/AlertsTable';
import {
  useAlerts,
  useAlertStats,
  useAcknowledgeAlert,
  useSnoozeAlert,
  useDismissAlert,
  useMarkAllAlertsAsRead,
  useProjects,
  useBomList,
} from '@/hooks';
import type { Alert, AlertSeverity, AlertFilters } from '@/types/alert';

const ITEMS_PER_PAGE = 10;

export interface RiskAlertsSectionProps {
  onViewAlertDetail?: (alert: Alert) => void;
}

export function RiskAlertsSection({ onViewAlertDetail }: RiskAlertsSectionProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filter state
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string | 'all'>('all');
  const [bomFilter, setBomFilter] = useState<string | 'all'>('all');
  const [page, setPage] = useState(1);

  // Fetch projects and BOMs for filter dropdowns
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: bomsData, isLoading: bomsLoading, error: bomsError } = useBomList(
    projectFilter !== 'all' ? { projectId: projectFilter } : undefined,
    { enabled: projectFilter !== 'all' } // Only fetch BOMs when a project is selected
  );

  // Memoize projects and BOMs lists
  const projects = useMemo(() => projectsData?.data || [], [projectsData]);
  const boms = useMemo(() => bomsData?.data || [], [bomsData]);

  // Build filters
  const filters: AlertFilters = {
    severities: severityFilter === 'all' ? undefined : [severityFilter],
    projectId: projectFilter !== 'all' ? projectFilter : undefined,
    bomId: bomFilter !== 'all' ? bomFilter : undefined,
    page,
    limit: ITEMS_PER_PAGE,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  // Count active filters
  const activeFilterCount = [
    severityFilter !== 'all',
    projectFilter !== 'all',
    bomFilter !== 'all',
  ].filter(Boolean).length;

  // Queries
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts, error: alertsError } = useAlerts(filters);
  const { data: alertStats, isLoading: statsLoading, error: statsError } = useAlertStats();

  // Aggregate errors for display
  const queryErrors = [projectsError, bomsError, alertsError, statsError].filter(Boolean);
  const hasQueryError = queryErrors.length > 0;

  // Mutations
  const acknowledgeAlert = useAcknowledgeAlert();
  const snoozeAlert = useSnoozeAlert();
  const dismissAlert = useDismissAlert();
  const markAllAsRead = useMarkAllAlertsAsRead();

  // Derived data
  const alerts = alertsData?.data || [];
  const totalAlerts = alertsData?.total || 0;
  const totalPages = Math.ceil(totalAlerts / ITEMS_PER_PAGE);

  // Risk category summary data - derive from alert stats
  const lifecycleCounts = {
    high: alertStats?.byType?.LIFECYCLE || 0,
    medium: 0,
    low: 0,
  };
  const supplyChainCounts = {
    high: alertStats?.byType?.SUPPLY_CHAIN || 0,
    medium: alertStats?.byType?.AVAILABILITY || 0,
    low: alertStats?.byType?.PRICE || 0,
  };
  const complianceCounts = {
    high: alertStats?.byType?.COMPLIANCE || 0,
    medium: alertStats?.byType?.PCN || 0,
    low: 0,
  };

  // Handlers
  const handleView = useCallback((alert: Alert) => {
    if (onViewAlertDetail) {
      onViewAlertDetail(alert);
    }
  }, [onViewAlertDetail]);

  const handleAcknowledge = useCallback((alertId: string) => {
    acknowledgeAlert.mutate(alertId, {
      onSuccess: () => {
        toast({
          title: 'Alert acknowledged',
          description: 'The alert has been marked as acknowledged.',
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to acknowledge alert.',
          variant: 'destructive',
        });
      },
    });
  }, [acknowledgeAlert, toast]);

  const handleSnooze = useCallback((alertId: string, days: number) => {
    snoozeAlert.mutate({ id: alertId, days }, {
      onSuccess: () => {
        toast({
          title: 'Alert snoozed',
          description: `The alert has been snoozed for ${days} day${days > 1 ? 's' : ''}.`,
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to snooze alert.',
          variant: 'destructive',
        });
      },
    });
  }, [snoozeAlert, toast]);

  const handleDismiss = useCallback((alertId: string) => {
    dismissAlert.mutate(alertId, {
      onSuccess: () => {
        toast({
          title: 'Alert dismissed',
          description: 'The alert has been dismissed.',
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to dismiss alert.',
          variant: 'destructive',
        });
      },
    });
  }, [dismissAlert, toast]);

  const handleViewComponent = useCallback((componentId: string) => {
    navigate(`/components/${componentId}`);
  }, [navigate]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: 'All alerts marked as read',
          description: 'All alerts have been marked as read.',
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to mark all alerts as read.',
          variant: 'destructive',
        });
      },
    });
  }, [markAllAsRead, toast]);

  const handleExport = useCallback(() => {
    // TODO: Implement CSV export
    toast({
      title: 'Export started',
      description: 'Your alerts export will be ready shortly.',
    });
  }, [toast]);

  const handleRefresh = useCallback(() => {
    refetchAlerts();
    toast({
      title: 'Refreshed',
      description: 'Alert list has been refreshed.',
    });
  }, [refetchAlerts, toast]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSeverityChange = useCallback((value: string) => {
    setSeverityFilter(value as AlertSeverity | 'all');
    setPage(1); // Reset to first page when filter changes
  }, []);

  const handleProjectChange = useCallback((value: string) => {
    setProjectFilter(value);
    setBomFilter('all'); // Reset BOM filter when project changes
    setPage(1);
  }, []);

  const handleBomChange = useCallback((value: string) => {
    setBomFilter(value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSeverityFilter('all');
    setProjectFilter('all');
    setBomFilter('all');
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {hasQueryError && (
        <AlertBanner variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {queryErrors.length === 1
              ? 'Failed to load some data. Please try refreshing.'
              : `Failed to load data from ${queryErrors.length} sources. Please try refreshing.`}
          </AlertDescription>
        </AlertBanner>
      )}

      {/* Risk Category Summary Cards */}
      <RiskCategorySummary
        lifecycle={lifecycleCounts}
        supplyChain={supplyChainCounts}
        compliance={complianceCounts}
        isLoading={statsLoading}
      />

      {/* Active Alerts Section */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold">Active Alerts</h3>
            <p className="text-sm text-muted-foreground">
              {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''} total
              {alertStats?.unread ? ` (${alertStats.unread} unread)` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={alertsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${alertsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsRead.isPending || !alertStats?.unread}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Project and BOM Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* BOM Filter */}
          <Select
            value={bomFilter}
            onValueChange={handleBomChange}
            disabled={projectFilter === 'all' || bomsLoading}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue
                placeholder={
                  projectFilter === 'all'
                    ? 'Select project first'
                    : bomsLoading
                      ? 'Loading BOMs...'
                      : 'All BOMs'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All BOMs</SelectItem>
              {boms.map((bom) => (
                <SelectItem key={bom.id} value={bom.id}>
                  {bom.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Active Filters Badge + Clear */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Severity Filter Tabs */}
        <Tabs
          value={severityFilter}
          onValueChange={handleSeverityChange}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="all">
              All
              {alertStats && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({alertStats.total})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="critical">
              Critical
              {alertStats && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({alertStats.bySeverity.critical})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="high">
              High
              {alertStats && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({alertStats.bySeverity.high})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="medium">
              Medium
              {alertStats && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({alertStats.bySeverity.medium})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="low">
              Low
              {alertStats && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({alertStats.bySeverity.low})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Alerts Table */}
        <AlertsTable
          alerts={alerts}
          isLoading={alertsLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onView={handleView}
          onAcknowledge={handleAcknowledge}
          onSnooze={handleSnooze}
          onDismiss={handleDismiss}
          onViewComponent={handleViewComponent}
        />
      </Card>
    </div>
  );
}

export default RiskAlertsSection;
