/**
 * Alert Types for CBP Customer Portal
 * Based on old CBP React Admin alert service logic
 */

export type AlertType =
  | 'LIFECYCLE'       // EOL/NRND status changes
  | 'RISK'            // Risk score threshold exceeded
  | 'PRICE'           // Price change > threshold
  | 'AVAILABILITY'    // Stock level changes
  | 'COMPLIANCE'      // Regulatory updates
  | 'PCN'             // Product Change Notifications
  | 'SUPPLY_CHAIN';   // Supply chain disruptions

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'unread' | 'read' | 'acknowledged' | 'snoozed' | 'dismissed';

/**
 * Alert data structure
 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  componentId?: string;
  componentMpn?: string;
  manufacturer?: string;
  bomId?: string;
  bomName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
  acknowledgedAt?: string;
  snoozedUntil?: string;
  dismissedAt?: string;
}

/**
 * Alert statistics summary
 */
export interface AlertStats {
  total: number;
  unread: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  byType: {
    LIFECYCLE: number;
    RISK: number;
    PRICE: number;
    AVAILABILITY: number;
    COMPLIANCE: number;
    PCN: number;
    SUPPLY_CHAIN: number;
  };
}

/**
 * Alert preferences
 */
export interface AlertPreferences {
  alert_types: AlertType[];
  email_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  threshold_risk_score: number;       // e.g., 70
  threshold_price_change: number;     // e.g., 10 (%)
  threshold_lead_time: number;        // e.g., 14 (days)
  notification_channels: {
    email: boolean;
    in_app: boolean;
    slack?: boolean;
  };
}

/**
 * Component watch (subscribe to alerts for specific components)
 */
export interface ComponentWatch {
  id: string;
  componentId: string;
  mpn: string;
  manufacturer: string;
  watchTypes: AlertType[];
  createdAt: string;
  userId: string;
}

/**
 * Alert filters for querying
 */
export interface AlertFilters {
  types?: AlertType[];
  severities?: AlertSeverity[];
  status?: AlertStatus;
  projectId?: string;
  bomId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'severity' | 'type';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Alert list response
 */
export interface AlertListResponse {
  data: Alert[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Alert action response
 */
export interface AlertActionResponse {
  success: boolean;
  alertId: string;
  message?: string;
}
