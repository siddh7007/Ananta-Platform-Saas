import { cnsApi, assertTenantContext } from '@/lib/axios';
import type {
  Alert,
  AlertStats,
  AlertPreferences,
  ComponentWatch,
  AlertFilters,
  AlertListResponse,
  AlertActionResponse,
} from '@/types/alert';

/**
 * Alert Service
 * Handles alert-related API operations
 */

/**
 * Get paginated list of alerts with filters
 */
export async function getAlerts(filters?: AlertFilters): Promise<AlertListResponse> {
  assertTenantContext();

  const params = new URLSearchParams();

  if (filters?.types?.length) {
    params.set('types', filters.types.join(','));
  }
  if (filters?.severities?.length) {
    params.set('severities', filters.severities.join(','));
  }
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.projectId) {
    params.set('projectId', filters.projectId);
  }
  if (filters?.bomId) {
    params.set('bomId', filters.bomId);
  }
  if (filters?.dateRange) {
    params.set('fromDate', filters.dateRange.from.toISOString());
    params.set('toDate', filters.dateRange.to.toISOString());
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }
  if (filters?.sortBy) {
    params.set('sortBy', filters.sortBy);
    params.set('sortOrder', filters.sortOrder || 'desc');
  }

  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  params.set('page', String(page));
  params.set('limit', String(limit));

  const response = await cnsApi.get(`/alerts?${params}`);

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
    page,
    limit,
  };
}

/**
 * Get alert statistics summary
 */
export async function getAlertStats(): Promise<AlertStats> {
  assertTenantContext();

  const response = await cnsApi.get('/alerts/stats');
  return response.data;
}

/**
 * Get a single alert by ID
 */
export async function getAlert(id: string): Promise<Alert> {
  assertTenantContext();

  const response = await cnsApi.get(`/alerts/${id}`);
  return response.data;
}

/**
 * Mark an alert as read
 */
export async function markAlertAsRead(id: string): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.patch(`/alerts/${id}/read`);
  return response.data;
}

/**
 * Mark multiple alerts as read
 */
export async function markAlertsAsRead(ids: string[]): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.post('/alerts/mark-read', { alertIds: ids });
  return response.data;
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsAsRead(): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.post('/alerts/mark-all-read');
  return response.data;
}

/**
 * Acknowledge an alert (mark as seen but keep visible)
 */
export async function acknowledgeAlert(id: string): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.patch(`/alerts/${id}/acknowledge`);
  return response.data;
}

/**
 * Snooze an alert for specified number of days
 */
export async function snoozeAlert(id: string, days: number = 7): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.post(`/alerts/${id}/snooze`, { days });
  return response.data;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(id: string): Promise<AlertActionResponse> {
  assertTenantContext();

  await cnsApi.delete(`/alerts/${id}`);
  return {
    success: true,
    alertId: id,
  };
}

/**
 * Dismiss multiple alerts
 */
export async function dismissAlerts(ids: string[]): Promise<AlertActionResponse> {
  assertTenantContext();

  const response = await cnsApi.post('/alerts/dismiss', { alertIds: ids });
  return response.data;
}

/**
 * Get user's alert preferences
 */
export async function getAlertPreferences(): Promise<AlertPreferences> {
  assertTenantContext();

  const response = await cnsApi.get('/alerts/preferences');
  return response.data;
}

/**
 * Update user's alert preferences
 */
export async function updateAlertPreferences(
  preferences: Partial<AlertPreferences>
): Promise<AlertPreferences> {
  assertTenantContext();

  const response = await cnsApi.put('/alerts/preferences', preferences);
  return response.data;
}

/**
 * Get list of watched components
 */
export async function getWatchedComponents(): Promise<ComponentWatch[]> {
  assertTenantContext();

  const response = await cnsApi.get('/alerts/watches');
  return response.data.data ?? response.data;
}

/**
 * Add a component to watch list
 */
export async function watchComponent(
  componentId: string,
  watchTypes: string[]
): Promise<ComponentWatch> {
  assertTenantContext();

  const response = await cnsApi.post('/alerts/watches', {
    componentId,
    watchTypes,
  });
  return response.data;
}

/**
 * Remove a component from watch list
 */
export async function unwatchComponent(watchId: string): Promise<{ success: boolean }> {
  assertTenantContext();

  await cnsApi.delete(`/alerts/watches/${watchId}`);
  return { success: true };
}

export default {
  getAlerts,
  getAlertStats,
  getAlert,
  markAlertAsRead,
  markAlertsAsRead,
  markAllAlertsAsRead,
  dismissAlert,
  dismissAlerts,
  getAlertPreferences,
  updateAlertPreferences,
  getWatchedComponents,
  watchComponent,
  unwatchComponent,
};
