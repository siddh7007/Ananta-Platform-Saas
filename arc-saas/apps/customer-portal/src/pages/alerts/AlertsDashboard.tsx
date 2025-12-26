/**
 * Alerts Dashboard
 *
 * Centralized alert management showing component lifecycle alerts,
 * risk notifications, and supply chain disruptions.
 *
 * Features:
 * - Real-time alerts list with filtering
 * - Alert statistics dashboard
 * - Bulk actions (mark read, dismiss)
 * - Alert preferences configuration
 * - Detailed alert view with actions
 */

import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Settings, CheckCircle, Trash2, RefreshCw } from 'lucide-react';
import { AlertStatsCards } from '@/components/alerts/AlertStatsCards';
import { AlertFilters } from '@/components/alerts/AlertFilters';
import { AlertsTable } from '@/components/alerts/AlertsTable';
import { AlertDetailSheet } from '@/components/alerts/AlertDetailSheet';
import { AlertPreferencesDialog } from '@/components/alerts/AlertPreferencesDialog';
import {
  useAlerts,
  useAlertStats,
  useMarkAlertAsRead,
  useMarkAlertsAsRead,
  useDismissAlert,
  useDismissAlerts,
} from '@/hooks/useAlerts';
import type { Alert, AlertFilters as AlertFiltersType } from '@/types/alert';

export function AlertsDashboardPage() {
  const { currentTenant } = useTenant();

  // State
  const [filters, setFilters] = useState<AlertFiltersType>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Data fetching
  const { data: alertsData, isLoading: alertsLoading, refetch } = useAlerts(filters);
  const { data: stats, isLoading: statsLoading } = useAlertStats();

  // Mutations
  const markAsRead = useMarkAlertAsRead();
  const markMultipleAsRead = useMarkAlertsAsRead();
  const dismissAlert = useDismissAlert();
  const dismissMultiple = useDismissAlerts();

  const alerts = alertsData?.data || [];
  const total = alertsData?.total || 0;

  // Selection handlers
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(alerts.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Alert actions
  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert);
    setDetailSheetOpen(true);
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead.mutateAsync(id);
  };

  const handleDismiss = async (id: string) => {
    await dismissAlert.mutateAsync(id);
  };

  // Bulk actions
  const handleBulkMarkAsRead = async () => {
    if (selectedIds.size === 0) return;
    await markMultipleAsRead.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkDismiss = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to dismiss ${selectedIds.size} alert(s)?`)) return;
    await dismissMultiple.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // Pagination
  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));
  const currentPage = filters.page || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Component and supply chain notifications for {currentTenant?.name || 'your workspace'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={alertsLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${alertsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setPreferencesOpen(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            Configure Alerts
          </Button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <AlertStatsCards stats={stats} isLoading={statsLoading} />

      {/* Filters */}
      <Card className="p-4">
        <AlertFilters filters={filters} onChange={setFilters} />
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} alert{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMarkAsRead}
                disabled={markMultipleAsRead.isPending}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Mark as Read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDismiss}
                disabled={dismissMultiple.isPending}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Alerts Table */}
      <AlertsTable
        alerts={alerts}
        isLoading={alertsLoading}
        selectedIds={selectedIds}
        onSelectOne={handleSelectOne}
        onSelectAll={handleSelectAll}
        onViewDetails={handleViewDetails}
        onMarkAsRead={handleMarkAsRead}
        onDismiss={handleDismiss}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * (filters.limit || 20) + 1} to{' '}
              {Math.min(currentPage * (filters.limit || 20), total)} of {total} alerts
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="px-2">...</span>
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Alert Detail Sheet */}
      <AlertDetailSheet
        alert={selectedAlert}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />

      {/* Alert Preferences Dialog */}
      <AlertPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </div>
  );
}

export default AlertsDashboardPage;
