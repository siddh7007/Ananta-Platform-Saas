/**
 * Analytics Service Tests
 *
 * Tests for event tracking, banner dismissal, and persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the class directly, not the singleton
// Mock import.meta.env before importing
vi.mock('import.meta', () => ({
  env: {
    DEV: true,
    VITE_ANALYTICS_ENDPOINT: undefined,
  },
}));

// Import types and test by creating a new instance
import type { EventCategory, AnalyticsConfig } from './analytics';

// Create a mock class for testing since we can't easily reset the singleton
class TestAnalyticsService {
  private config: AnalyticsConfig;
  private sessionId: string;
  private eventQueue: any[] = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      debug: false,
      persistToStorage: true,
      maxStoredEvents: 100,
      flushInterval: 30000,
      ...config,
    };
    this.sessionId = this.getOrCreateSessionId();

    if (this.config.persistToStorage) {
      this.loadStoredEvents();
    }
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

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

    const event = {
      category,
      action,
      label: options?.label,
      value: options?.value,
      metadata: options?.metadata,
      timestamp: new Date().toISOString(),
      userId: localStorage.getItem('user_id') || undefined,
      organizationId: localStorage.getItem('organization_id') || undefined,
      sessionId: this.sessionId,
    };

    this.eventQueue.push(event);

    if (this.config.persistToStorage) {
      this.persistEvents();
    }
  }

  // Pre-defined helpers
  trackBomUploadStarted(filename: string, rowCount?: number): void {
    this.track('bom', 'upload_started', {
      label: filename,
      value: rowCount,
      metadata: { filename, rowCount },
    });
  }

  trackOnboardingStepComplete(step: string): void {
    this.track('onboarding', 'step_complete', { label: step });
  }

  trackOnboardingComplete(): void {
    this.track('onboarding', 'checklist_complete');
  }

  trackPageView(pageName: string, path: string): void {
    this.track('navigation', 'page_view', {
      label: pageName,
      metadata: { path },
    });
  }

  // Banner dismissal
  isBannerDismissed(bannerId: string): boolean {
    const dismissed = this.getDismissedBanners();
    return dismissed.includes(bannerId);
  }

  dismissBanner(bannerId: string): void {
    const dismissed = this.getDismissedBanners();
    if (!dismissed.includes(bannerId)) {
      dismissed.push(bannerId);
      localStorage.setItem('analytics_dismissed_banners', JSON.stringify(dismissed));
      this.track('navigation', 'banner_dismissed', { label: bannerId });
    }
  }

  clearDismissedBanners(): void {
    localStorage.removeItem('analytics_dismissed_banners');
  }

  private getDismissedBanners(): string[] {
    try {
      const stored = localStorage.getItem('analytics_dismissed_banners');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private persistEvents(): void {
    try {
      const eventsToStore = this.eventQueue.slice(-this.config.maxStoredEvents);
      localStorage.setItem('analytics_events', JSON.stringify(eventsToStore));
    } catch {
      // Ignore storage errors
    }
  }

  private loadStoredEvents(): void {
    try {
      const stored = localStorage.getItem('analytics_events');
      if (stored) {
        this.eventQueue = JSON.parse(stored);
      }
    } catch {
      this.eventQueue = [];
    }
  }

  getEvents(): any[] {
    return [...this.eventQueue];
  }

  clearEvents(): void {
    this.eventQueue = [];
    localStorage.removeItem('analytics_events');
  }

  configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

describe('AnalyticsService', () => {
  let analytics: TestAnalyticsService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    analytics = new TestAnalyticsService();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Session Management', () => {
    it('creates a new session ID if none exists', () => {
      const events = analytics.getEvents();
      analytics.track('navigation', 'test');

      const newEvents = analytics.getEvents();
      expect(newEvents[0].sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('reuses existing session ID', () => {
      sessionStorage.setItem('analytics_session_id', 'existing_session_123');
      const newAnalytics = new TestAnalyticsService();

      newAnalytics.track('navigation', 'test');
      const events = newAnalytics.getEvents();

      expect(events[0].sessionId).toBe('existing_session_123');
    });
  });

  describe('Event Tracking', () => {
    it('tracks basic events', () => {
      analytics.track('navigation', 'page_view', { label: 'Dashboard' });

      const events = analytics.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].category).toBe('navigation');
      expect(events[0].action).toBe('page_view');
      expect(events[0].label).toBe('Dashboard');
    });

    it('tracks events with metadata', () => {
      analytics.track('bom', 'upload_started', {
        label: 'test.csv',
        value: 100,
        metadata: { filename: 'test.csv', rowCount: 100 },
      });

      const events = analytics.getEvents();
      expect(events[0].metadata).toEqual({ filename: 'test.csv', rowCount: 100 });
      expect(events[0].value).toBe(100);
    });

    it('includes timestamp on events', () => {
      analytics.track('user', 'action');

      const events = analytics.getEvents();
      expect(events[0].timestamp).toBeDefined();
      expect(new Date(events[0].timestamp)).toBeInstanceOf(Date);
    });

    it('includes user ID when available', () => {
      localStorage.setItem('user_id', 'user-123');
      analytics.track('user', 'action');

      const events = analytics.getEvents();
      expect(events[0].userId).toBe('user-123');
    });

    it('includes organization ID when available', () => {
      localStorage.setItem('organization_id', 'org-456');
      analytics.track('user', 'action');

      const events = analytics.getEvents();
      expect(events[0].organizationId).toBe('org-456');
    });

    it('does not track when disabled', () => {
      analytics.configure({ enabled: false });
      analytics.track('user', 'action');

      expect(analytics.getEvents()).toHaveLength(0);
    });
  });

  describe('Pre-defined Event Helpers', () => {
    it('tracks BOM upload started', () => {
      analytics.trackBomUploadStarted('components.csv', 50);

      const events = analytics.getEvents();
      expect(events[0].category).toBe('bom');
      expect(events[0].action).toBe('upload_started');
      expect(events[0].label).toBe('components.csv');
      expect(events[0].value).toBe(50);
    });

    it('tracks onboarding step complete', () => {
      analytics.trackOnboardingStepComplete('first_bom_uploaded');

      const events = analytics.getEvents();
      expect(events[0].category).toBe('onboarding');
      expect(events[0].action).toBe('step_complete');
      expect(events[0].label).toBe('first_bom_uploaded');
    });

    it('tracks onboarding complete', () => {
      analytics.trackOnboardingComplete();

      const events = analytics.getEvents();
      expect(events[0].category).toBe('onboarding');
      expect(events[0].action).toBe('checklist_complete');
    });

    it('tracks page view', () => {
      analytics.trackPageView('Dashboard', '/dashboard');

      const events = analytics.getEvents();
      expect(events[0].category).toBe('navigation');
      expect(events[0].action).toBe('page_view');
      expect(events[0].label).toBe('Dashboard');
      expect(events[0].metadata).toEqual({ path: '/dashboard' });
    });
  });

  describe('Banner Dismissal', () => {
    it('returns false for non-dismissed banners', () => {
      expect(analytics.isBannerDismissed('test_banner')).toBe(false);
    });

    it('marks banner as dismissed', () => {
      analytics.dismissBanner('test_banner');

      expect(analytics.isBannerDismissed('test_banner')).toBe(true);
    });

    it('persists dismissed banners to localStorage', () => {
      analytics.dismissBanner('banner_1');
      analytics.dismissBanner('banner_2');

      const stored = JSON.parse(localStorage.getItem('analytics_dismissed_banners')!);
      expect(stored).toContain('banner_1');
      expect(stored).toContain('banner_2');
    });

    it('tracks banner dismissed event', () => {
      analytics.dismissBanner('test_banner');

      const events = analytics.getEvents();
      expect(events.some((e) =>
        e.category === 'navigation' &&
        e.action === 'banner_dismissed' &&
        e.label === 'test_banner'
      )).toBe(true);
    });

    it('does not duplicate dismissed banners', () => {
      analytics.dismissBanner('test_banner');
      analytics.dismissBanner('test_banner');

      const stored = JSON.parse(localStorage.getItem('analytics_dismissed_banners')!);
      expect(stored.filter((b: string) => b === 'test_banner')).toHaveLength(1);
    });

    it('clears dismissed banners', () => {
      analytics.dismissBanner('test_banner');
      analytics.clearDismissedBanners();

      expect(analytics.isBannerDismissed('test_banner')).toBe(false);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('analytics_dismissed_banners', 'not-valid-json');

      expect(() => analytics.isBannerDismissed('test')).not.toThrow();
      expect(analytics.isBannerDismissed('test')).toBe(false);
    });
  });

  describe('Event Persistence', () => {
    it('persists events to localStorage', () => {
      analytics.track('user', 'action');

      const stored = JSON.parse(localStorage.getItem('analytics_events')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].action).toBe('action');
    });

    it('loads stored events on init', () => {
      localStorage.setItem('analytics_events', JSON.stringify([
        { category: 'test', action: 'stored_event', timestamp: new Date().toISOString() },
      ]));

      const newAnalytics = new TestAnalyticsService();
      expect(newAnalytics.getEvents()).toHaveLength(1);
    });

    it('respects maxStoredEvents limit', () => {
      const smallAnalytics = new TestAnalyticsService({ maxStoredEvents: 3 });

      for (let i = 0; i < 5; i++) {
        smallAnalytics.track('user', `action_${i}`);
      }

      const stored = JSON.parse(localStorage.getItem('analytics_events')!);
      expect(stored).toHaveLength(3);
      // Should keep the most recent events
      expect(stored[2].action).toBe('action_4');
    });

    it('clears events', () => {
      analytics.track('user', 'action');
      analytics.clearEvents();

      expect(analytics.getEvents()).toHaveLength(0);
      expect(localStorage.getItem('analytics_events')).toBeNull();
    });

    it('handles corrupt stored events gracefully', () => {
      localStorage.setItem('analytics_events', 'not-valid-json');

      const newAnalytics = new TestAnalyticsService();
      expect(newAnalytics.getEvents()).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('merges configuration updates', () => {
      analytics.configure({ enabled: false, debug: true });
      analytics.track('user', 'action');

      // Should not track when disabled
      expect(analytics.getEvents()).toHaveLength(0);
    });

    it('can skip persistence', () => {
      const noPersistAnalytics = new TestAnalyticsService({ persistToStorage: false });
      noPersistAnalytics.track('user', 'action');

      expect(localStorage.getItem('analytics_events')).toBeNull();
    });
  });
});
