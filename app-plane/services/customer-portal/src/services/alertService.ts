/**
 * Alert System API Service
 *
 * Provides methods to interact with the CNS Alert endpoints.
 */

import { CNS_BASE_URL, getAuthHeaders } from './cnsApi';

// Types
export type AlertType = 'LIFECYCLE' | 'RISK' | 'PRICE' | 'AVAILABILITY' | 'COMPLIANCE' | 'PCN' | 'SUPPLY_CHAIN';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type ThresholdFieldType = 'number' | 'percent' | 'boolean' | 'select';

export interface Alert {
  id: string;
  organization_id: string;
  component_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  // Joined component info
  mpn?: string;
  manufacturer?: string;
}

export interface AlertList {
  items: Alert[];  // Backend returns 'items' not 'alerts'
  total: number;
  unread_count: number;
}

export interface AlertPreferences {
  id: string;
  user_id: string;
  organization_id: string;
  lifecycle_alerts: boolean;
  risk_alerts: boolean;
  price_alerts: boolean;
  availability_alerts: boolean;
  compliance_alerts: boolean;
  pcn_alerts: boolean;
  email_enabled: boolean;
  email_frequency: 'immediate' | 'daily' | 'weekly';
  min_severity: AlertSeverity;
  risk_threshold: number;
  price_change_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface AlertPreferencesUpdate {
  lifecycle_alerts?: boolean;
  risk_alerts?: boolean;
  price_alerts?: boolean;
  availability_alerts?: boolean;
  compliance_alerts?: boolean;
  pcn_alerts?: boolean;
  email_enabled?: boolean;
  email_frequency?: 'immediate' | 'daily' | 'weekly';
  min_severity?: AlertSeverity;
  risk_threshold?: number;
  price_change_threshold?: number;
}

// New per-type preference update model
export interface AlertPreferenceTypeUpdate {
  alert_type: AlertType;
  is_active?: boolean;
  email_enabled?: boolean;
  in_app_enabled?: boolean;
  webhook_enabled?: boolean;
  email_address?: string;
  webhook_url?: string;
  threshold_config?: Record<string, number | boolean | string>;
}

export interface ComponentWatch {
  id: string;
  user_id: string;
  organization_id: string;
  component_id: string;
  watch_lifecycle: boolean;
  watch_risk: boolean;
  watch_price: boolean;
  watch_availability: boolean;
  watch_compliance: boolean;
  watch_supply_chain: boolean;
  notes: string | null;
  created_at: string;
  // Joined component info
  mpn?: string;
  manufacturer?: string;
}

export interface ComponentWatchCreate {
  component_id: string;
  watch_lifecycle?: boolean;
  watch_risk?: boolean;
  watch_price?: boolean;
  watch_availability?: boolean;
  watch_compliance?: boolean;
  watch_supply_chain?: boolean;
  notes?: string;
}

export interface AlertStats {
  total_alerts: number;
  unread_count: number;
  by_type: Record<AlertType, number>;
  by_severity: Record<AlertSeverity, number>;
  recent_24h: number;
}

// Threshold configuration types
export interface ThresholdOption {
  key: string;
  label: string;
  description: string;
  type: ThresholdFieldType;
  default_value: number | boolean | string;
  min_value?: number;
  max_value?: number;
  unit?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface AlertTypeConfig {
  alert_type: AlertType;
  label: string;
  description: string;
  thresholds: ThresholdOption[];
}

export interface AlertPreferenceWithThresholds {
  id: string;
  user_id: string;
  organization_id: string;
  alert_type: AlertType;
  description?: string;  // Optional description of the alert type
  is_active: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  webhook_enabled: boolean;
  threshold_config: Record<string, number | boolean | string>;
  created_at: string;
  updated_at: string;
  // Include threshold options for UI rendering
  threshold_options?: ThresholdOption[];
}

export interface ThresholdUpdate {
  alert_type: AlertType;
  threshold_config: Record<string, number | boolean | string>;
}

class AlertApiService {
  private baseURL: string;

  constructor(baseURL: string = CNS_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Get list of alerts with optional filtering
   */
  async getAlerts(params?: {
    severity?: AlertSeverity;
    alert_type?: AlertType;
    is_read?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AlertList> {
    const authHeaders = await getAuthHeaders();
    const queryParams = new URLSearchParams();

    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.alert_type) queryParams.append('alert_type', params.alert_type);
    if (params?.is_read !== undefined) queryParams.append('is_read', String(params.is_read));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));

    const queryString = queryParams.toString();
    const url = `${this.baseURL}/api/alerts${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch alerts: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get unread alert count
   */
  async getUnreadCount(): Promise<{ unread_count: number }> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/unread-count`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch unread count: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<AlertStats> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/stats`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch alert stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Mark an alert as read
   */
  async markAsRead(alertId: string): Promise<Alert> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/by-id/${alertId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to mark alert as read: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Mark all alerts as read
   */
  async markAllAsRead(): Promise<{ marked_count: number }> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/mark-all-read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to mark all as read: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string): Promise<Alert> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/by-id/${alertId}/dismiss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to dismiss alert: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user's alert preferences
   */
  async getPreferences(): Promise<AlertPreferences> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/preferences`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch preferences: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update user's alert preferences (legacy API)
   */
  async updatePreferences(updates: AlertPreferencesUpdate | AlertPreferenceTypeUpdate): Promise<AlertPreferences> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to update preferences: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update a single alert type preference
   */
  async updateAlertTypePreference(update: AlertPreferenceTypeUpdate): Promise<AlertPreferenceWithThresholds> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to update preference: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user's component watches
   */
  async getWatches(): Promise<ComponentWatch[]> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/watches`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch watches: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Add a component to watch list
   */
  async addWatch(watch: ComponentWatchCreate): Promise<ComponentWatch> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/watches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(watch),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to add watch: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Remove a component watch
   */
  async removeWatch(watchId: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/watches/${watchId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to remove watch: ${response.statusText}`);
    }
  }

  /**
   * Get available threshold options for all alert types
   */
  async getThresholdOptions(): Promise<AlertTypeConfig[]> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/threshold-options`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch threshold options: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user's alert preferences with threshold configuration
   */
  async getPreferencesWithThresholds(): Promise<AlertPreferenceWithThresholds[]> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/preferences/with-thresholds`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to fetch preferences with thresholds: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update threshold configuration for a specific alert type
   */
  async updateThresholds(alertType: AlertType, thresholdConfig: Record<string, number | boolean | string>): Promise<AlertPreferenceWithThresholds> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/alerts/preferences/${alertType}/thresholds`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ threshold_config: thresholdConfig }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to update thresholds: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const alertApi = new AlertApiService();

// Export class for testing
export { AlertApiService };
