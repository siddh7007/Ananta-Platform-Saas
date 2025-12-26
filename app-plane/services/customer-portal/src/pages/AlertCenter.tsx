/**
 * Alert Center Page
 *
 * Displays and manages alerts for component risk, lifecycle, pricing, and compliance changes.
 * Features dual-pane layout with multi-select batch actions.
 * Uses modular components from ./alerts/ for maintainability.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert as MuiAlert,
  CircularProgress,
  Divider,
  Paper,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  List,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

import {
  AlertStatsCards,
  AlertFilters,
  AlertTypeSummary,
  AlertListItem,
  AlertDetailPanel,
  AlertBatchActions,
} from './alerts';
import { PageLoading } from '../components/shared';
import { alertApi, Alert, AlertType, AlertSeverity, AlertStats } from '../services/alertService';

export const AlertCenter: React.FC = () => {
  // Data state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [tabValue, setTabValue] = useState(0);
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | ''>('');
  const [filterType, setFilterType] = useState<AlertType | ''>('');

  // Selection and detail panel state
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  /**
   * Load alerts and stats from API
   */
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const params: Record<string, unknown> = { limit: 50 };

      if (filterSeverity) params.severity = filterSeverity;
      if (filterType) params.alert_type = filterType;
      if (tabValue === 1) params.is_read = false; // Unread tab
      if (tabValue === 2) params.is_read = true; // Read tab

      const [alertList, stats] = await Promise.all([
        alertApi.getAlerts(params),
        alertApi.getAlertStats(),
      ]);

      setAlerts(alertList.items);
      setTotal(alertList.total);
      setUnreadCount(alertList.unread_count);
      setAlertStats(stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load alerts';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tabValue, filterSeverity, filterType]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Refresh data
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * Mark single alert as read
   */
  const handleMarkAsRead = async (alertId: string) => {
    try {
      await alertApi.markAsRead(alertId);
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
      setUnreadCount(Math.max(0, unreadCount - 1));
      // Update selected alert if it's the one being marked
      if (selectedAlert?.id === alertId) {
        setSelectedAlert({ ...selectedAlert, is_read: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark alert as read';
      setError(message);
    }
  };

  /**
   * Mark all alerts as read
   */
  const handleMarkAllAsRead = async () => {
    try {
      await alertApi.markAllAsRead();
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      setUnreadCount(0);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      setError(message);
    }
  };

  /**
   * Dismiss/delete an alert
   */
  const handleDismiss = async (alertId: string) => {
    try {
      await alertApi.dismissAlert(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }
      setSelectedAlerts(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss alert';
      setError(message);
    }
  };

  /**
   * Handle alert selection for multi-select
   */
  const handleSelectAlert = (alertId: string, isSelected: boolean) => {
    setSelectedAlerts(prev => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(alertId);
      } else {
        next.delete(alertId);
      }
      return next;
    });
  };

  /**
   * Handle select all
   */
  const handleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map(a => a.id)));
    }
  };

  /**
   * Clear selection
   */
  const handleClearSelection = () => {
    setSelectedAlerts(new Set());
  };

  /**
   * Batch mark selected as read
   */
  const handleBatchMarkAsRead = async () => {
    const ids = Array.from(selectedAlerts);
    for (const id of ids) {
      await handleMarkAsRead(id);
    }
    handleClearSelection();
  };

  /**
   * Batch assign (mock implementation)
   */
  const handleBatchAssign = async (assignee: string) => {
    console.log('Assigning alerts to:', assignee, Array.from(selectedAlerts));
    // In production, call API to assign alerts
    handleClearSelection();
  };

  /**
   * Batch mute (mock implementation)
   */
  const handleBatchMute = async (duration: 'day' | 'week' | 'forever') => {
    console.log('Muting alerts for:', duration, Array.from(selectedAlerts));
    // In production, call API to mute alerts
    handleClearSelection();
  };

  /**
   * Batch escalate (mock implementation)
   */
  const handleBatchEscalate = async () => {
    console.log('Escalating alerts:', Array.from(selectedAlerts));
    // In production, call API to escalate alerts
    handleClearSelection();
  };

  /**
   * Batch dismiss all selected
   */
  const handleBatchDismissAll = async () => {
    const ids = Array.from(selectedAlerts);
    for (const id of ids) {
      await handleDismiss(id);
    }
    handleClearSelection();
  };

  /**
   * Handle clicking on an alert to view details
   */
  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
    setShowDetailPanel(true);
  };

  // Loading state
  if (loading) {
    return <PageLoading message="Loading alerts..." />;
  }

  const isAllSelected = alerts.length > 0 && selectedAlerts.size === alerts.length;
  const isSomeSelected = selectedAlerts.size > 0 && selectedAlerts.size < alerts.length;

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Alert Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor component changes and risk notifications
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={showCheckboxes ? 'Hide checkboxes' : 'Show checkboxes for batch actions'}>
            <IconButton
              onClick={() => setShowCheckboxes(!showCheckboxes)}
              color={showCheckboxes ? 'primary' : 'default'}
            >
              {showCheckboxes ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={showDetailPanel ? 'Hide detail panel' : 'Show detail panel'}>
            <IconButton
              onClick={() => setShowDetailPanel(!showDetailPanel)}
              color={showDetailPanel ? 'primary' : 'default'}
            >
              {showDetailPanel ? <ViewSidebarIcon /> : <ViewListIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllAsRead}
            >
              Mark All Read
            </Button>
          )}
          <Button
            component={RouterLink}
            to="/alerts/preferences"
            variant="contained"
            startIcon={<SettingsIcon />}
          >
            Preferences
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <MuiAlert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </MuiAlert>
      )}

      {/* Stats Cards */}
      <AlertStatsCards stats={alertStats} />

      {/* Dual-Pane Layout */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* Left Pane - Alert List */}
        <Card sx={{ flex: showDetailPanel ? 1 : 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
            {/* Filter Toolbar */}
            <AlertFilters
              tabValue={tabValue}
              onTabChange={setTabValue}
              filterSeverity={filterSeverity}
              onSeverityChange={setFilterSeverity}
              filterType={filterType}
              onTypeChange={setFilterType}
              totalCount={total}
              unreadCount={unreadCount}
            />

            <Divider sx={{ my: 2 }} />

            {/* Batch Actions Toolbar */}
            {showCheckboxes && selectedAlerts.size > 0 && (
              <AlertBatchActions
                selectedCount={selectedAlerts.size}
                onClearSelection={handleClearSelection}
                onMarkAsRead={handleBatchMarkAsRead}
                onAssign={handleBatchAssign}
                onMute={handleBatchMute}
                onEscalate={handleBatchEscalate}
                onDismissAll={handleBatchDismissAll}
              />
            )}

            {/* Select All Header */}
            {showCheckboxes && alerts.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={handleSelectAll}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      {isAllSelected ? 'Deselect all' : 'Select all'}
                    </Typography>
                  }
                />
              </Box>
            )}

            {/* Alert List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {alerts.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 200,
                    color: 'text.secondary',
                  }}
                >
                  <Typography>No alerts found</Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {alerts.map((alert) => (
                    <AlertListItem
                      key={alert.id}
                      alert={alert}
                      onMarkAsRead={handleMarkAsRead}
                      onDismiss={handleDismiss}
                      selected={selectedAlerts.has(alert.id)}
                      onSelect={handleSelectAlert}
                      onClick={handleAlertClick}
                      showCheckbox={showCheckboxes}
                    />
                  ))}
                </List>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Right Pane - Detail Panel */}
        {showDetailPanel && (
          <Paper
            sx={{
              width: 400,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <AlertDetailPanel
              alert={selectedAlert}
              onClose={() => setSelectedAlert(null)}
              onMarkAsRead={handleMarkAsRead}
              onDismiss={handleDismiss}
            />
          </Paper>
        )}
      </Box>

      {/* Alert Type Summary */}
      <AlertTypeSummary stats={alertStats} />
    </Box>
  );
};

export default AlertCenter;
