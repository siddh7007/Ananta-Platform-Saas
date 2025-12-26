/**
 * Analytics Service
 *
 * Lightweight event tracking for user interactions and feature usage.
 * Supports multiple analytics backends (console, localStorage, external).
 *
 * Events tracked:
 * - User actions: MFA enabled, profile updated, settings changed
 * - BOM workflow: upload started, enrichment complete, export generated
 * - Alert actions: created, resolved, dismissed
 * - Onboarding: step completed, checklist finished
 * - Navigation: page views, feature discovery
 */

// =====================================================
// Types
// =====================================================

export type EventCategory =
  | 'user'
  | 'bom'
  | 'enrichment'
  | 'alert'
  | 'onboarding'
  | 'navigation'
  | 'search'
  | 'vault'
  | 'project'
  | 'organization';

export interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  sessionId: string;
}

export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  persistToStorage: boolean;
  maxStoredEvents: number;
  flushInterval: number; // ms
  endpoint?: string; // External analytics endpoint
}

// =====================================================
// Default Configuration
// =====================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  debug: import.meta.env.DEV,
  persistToStorage: true,
  maxStoredEvents: 100,
  flushInterval: 30000, // 30 seconds
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
};

// =====================================================
// Storage Keys
// =====================================================

const STORAGE_KEYS = {
  events: 'analytics_events',
  sessionId: 'analytics_session_id',
  config: 'analytics_config',
  dismissedBanners: 'analytics_dismissed_banners',
};

// =====================================================
// Analytics Service Class
// =====================================================

class AnalyticsService {
  private config: AnalyticsConfig;
  private sessionId: string;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.getOrCreateSessionId();

    if (this.config.persistToStorage) {
      this.loadStoredEvents();
    }

    if (this.config.flushInterval > 0 && this.config.endpoint) {
      this.startFlushTimer();
    }
  }

  // =====================================================
  // Session Management
  // =====================================================

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.sessionId);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
    }
    return sessionId;
  }

  // =====================================================
  // Event Tracking
  // =====================================================

  /**
   * Track a generic event.
   */
  track(
    category: EventCategory,
    action: string,
    options?: {
      label?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    }
  ): void {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      category,
      action,
      label: options?.label,
      value: options?.value,
      metadata: options?.metadata,
      timestamp: new Date().toISOString(),
      userId: this.getUserId(),
      organizationId: this.getOrganizationId(),
      sessionId: this.sessionId,
    };

    this.eventQueue.push(event);

    if (this.config.debug) {
      console.log('[Analytics] Event tracked:', event);
    }

    if (this.config.persistToStorage) {
      this.persistEvents();
    }
  }

  // =====================================================
  // Pre-defined Event Helpers
  // =====================================================

  // User Events
  trackMfaEnabled(): void {
    this.track('user', 'mfa_enabled', { label: 'Security' });
  }

  trackProfileUpdated(fields: string[]): void {
    this.track('user', 'profile_updated', {
      label: fields.join(','),
      value: fields.length,
    });
  }

  trackPasswordChanged(): void {
    this.track('user', 'password_changed', { label: 'Security' });
  }

  // BOM Events
  trackBomUploadStarted(filename: string, rowCount?: number): void {
    this.track('bom', 'upload_started', {
      label: filename,
      value: rowCount,
      metadata: { filename, rowCount },
    });
  }

  trackBomUploadComplete(bomId: string, componentCount: number): void {
    this.track('bom', 'upload_complete', {
      label: bomId,
      value: componentCount,
      metadata: { bomId, componentCount },
    });
  }

  trackBomExported(bomId: string, format: string): void {
    this.track('bom', 'exported', {
      label: `${bomId}:${format}`,
      metadata: { bomId, format },
    });
  }

  // Enrichment Events
  trackEnrichmentStarted(bomId: string, totalComponents: number): void {
    this.track('enrichment', 'started', {
      label: bomId,
      value: totalComponents,
      metadata: { bomId, totalComponents },
    });
  }

  trackEnrichmentComplete(bomId: string, successCount: number, failedCount: number): void {
    this.track('enrichment', 'complete', {
      label: bomId,
      value: successCount,
      metadata: { bomId, successCount, failedCount, successRate: successCount / (successCount + failedCount) },
    });
  }

  // Alert Events
  trackAlertCreated(alertType: string, severity: string): void {
    this.track('alert', 'created', {
      label: `${alertType}:${severity}`,
      metadata: { alertType, severity },
    });
  }

  trackAlertResolved(alertId: string, alertType: string): void {
    this.track('alert', 'resolved', {
      label: alertId,
      metadata: { alertId, alertType },
    });
  }

  trackAlertDismissed(alertId: string): void {
    this.track('alert', 'dismissed', { label: alertId });
  }

  // Onboarding Events
  trackOnboardingStepComplete(step: string): void {
    this.track('onboarding', 'step_complete', { label: step });
  }

  trackOnboardingComplete(): void {
    this.track('onboarding', 'checklist_complete');
  }

  trackOnboardingSkipped(): void {
    this.track('onboarding', 'skipped');
  }

  // Navigation Events
  trackPageView(pageName: string, path: string): void {
    this.track('navigation', 'page_view', {
      label: pageName,
      metadata: { path },
    });
  }

  trackFeatureDiscovery(featureName: string): void {
    this.track('navigation', 'feature_discovery', { label: featureName });
  }

  // Search Events
  trackSearch(query: string, resultCount: number): void {
    this.track('search', 'executed', {
      value: resultCount,
      metadata: { query, resultCount },
    });
  }

  trackSearchFilterApplied(filterType: string, filterValue: string): void {
    this.track('search', 'filter_applied', {
      label: `${filterType}:${filterValue}`,
    });
  }

  // Vault Events
  trackComponentAddedToVault(componentId: string, stage: string): void {
    this.track('vault', 'component_added', {
      label: componentId,
      metadata: { componentId, stage },
    });
  }

  trackVaultStageChanged(componentId: string, fromStage: string, toStage: string): void {
    this.track('vault', 'stage_changed', {
      label: componentId,
      metadata: { componentId, fromStage, toStage },
    });
  }

  // Project Events
  trackProjectCreated(projectId: string, projectName: string): void {
    this.track('project', 'created', {
      label: projectName,
      metadata: { projectId, projectName },
    });
  }

  trackProjectSwitched(projectId: string): void {
    this.track('project', 'switched', { label: projectId });
  }

  // Organization Events
  trackMemberInvited(role: string): void {
    this.track('organization', 'member_invited', { label: role });
  }

  trackMemberRemoved(userId: string): void {
    this.track('organization', 'member_removed', { label: userId });
  }

  // =====================================================
  // Banner Dismissal Tracking
  // =====================================================

  /**
   * Check if a banner has been dismissed.
   */
  isBannerDismissed(bannerId: string): boolean {
    const dismissed = this.getDismissedBanners();
    return dismissed.includes(bannerId);
  }

  /**
   * Mark a banner as dismissed.
   */
  dismissBanner(bannerId: string): void {
    const dismissed = this.getDismissedBanners();
    if (!dismissed.includes(bannerId)) {
      dismissed.push(bannerId);
      localStorage.setItem(STORAGE_KEYS.dismissedBanners, JSON.stringify(dismissed));
      this.track('navigation', 'banner_dismissed', { label: bannerId });
    }
  }

  /**
   * Clear dismissed banners (for testing).
   */
  clearDismissedBanners(): void {
    localStorage.removeItem(STORAGE_KEYS.dismissedBanners);
  }

  private getDismissedBanners(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.dismissedBanners);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // =====================================================
  // Storage & Flushing
  // =====================================================

  private persistEvents(): void {
    try {
      // Trim to max stored events
      const eventsToStore = this.eventQueue.slice(-this.config.maxStoredEvents);
      localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(eventsToStore));
    } catch (error) {
      if (this.config.debug) {
        console.warn('[Analytics] Failed to persist events:', error);
      }
    }
  }

  private loadStoredEvents(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.events);
      if (stored) {
        this.eventQueue = JSON.parse(stored);
      }
    } catch {
      this.eventQueue = [];
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Flush events to external endpoint.
   */
  async flush(): Promise<void> {
    if (!this.config.endpoint || this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (this.config.debug) {
        console.log('[Analytics] Flushed', eventsToSend.length, 'events');
      }
    } catch (error) {
      // Re-add events to queue on failure
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      if (this.config.debug) {
        console.warn('[Analytics] Flush failed:', error);
      }
    }
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  private getUserId(): string | undefined {
    return localStorage.getItem('user_id') || undefined;
  }

  private getOrganizationId(): string | undefined {
    return localStorage.getItem('organization_id') || undefined;
  }

  /**
   * Get all tracked events (for debugging).
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear all events.
   */
  clearEvents(): void {
    this.eventQueue = [];
    localStorage.removeItem(STORAGE_KEYS.events);
  }

  /**
   * Update configuration.
   */
  configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy the service (cleanup timers).
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// =====================================================
// Export Singleton
// =====================================================

export const analytics = new AnalyticsService();
export default analytics;
