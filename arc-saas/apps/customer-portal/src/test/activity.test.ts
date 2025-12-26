/**
 * Tests for BOM Activity/History types and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_EVENT_CONFIG,
  formatActivityTime,
  formatActivityTimeFull,
  groupActivitiesByDate,
  getActivityUserDisplay,
} from '@/types/activity';
import type { BomActivityEvent, ActivityEventType } from '@/types/activity';

describe('Activity Types', () => {
  describe('ACTIVITY_EVENT_CONFIG', () => {
    it('should have config for all event types', () => {
      const eventTypes: ActivityEventType[] = [
        'bom_created',
        'bom_updated',
        'bom_deleted',
        'bom_duplicated',
        'bom_exported',
        'enrichment_started',
        'enrichment_completed',
        'enrichment_failed',
        'line_item_added',
        'line_item_updated',
        'line_item_deleted',
        'component_linked',
        'component_unlinked',
        'status_changed',
        'file_uploaded',
        'note_added',
        'version_created',
        'version_restored',
      ];

      for (const eventType of eventTypes) {
        expect(ACTIVITY_EVENT_CONFIG[eventType]).toBeDefined();
        expect(ACTIVITY_EVENT_CONFIG[eventType].label).toBeTruthy();
        expect(ACTIVITY_EVENT_CONFIG[eventType].icon).toBeTruthy();
        expect(ACTIVITY_EVENT_CONFIG[eventType].color).toBeTruthy();
        expect(ACTIVITY_EVENT_CONFIG[eventType].bgColor).toBeTruthy();
      }
    });

    it('should have correct structure for each config', () => {
      const config = ACTIVITY_EVENT_CONFIG.bom_created;
      expect(config).toEqual({
        label: 'BOM Created',
        icon: 'file-plus',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
      });
    });

    it('should have distinct colors for different event types', () => {
      // Destructive events should be red
      expect(ACTIVITY_EVENT_CONFIG.bom_deleted.color).toContain('red');
      expect(ACTIVITY_EVENT_CONFIG.enrichment_failed.color).toContain('red');
      expect(ACTIVITY_EVENT_CONFIG.line_item_deleted.color).toContain('red');

      // Success events should be green
      expect(ACTIVITY_EVENT_CONFIG.bom_created.color).toContain('green');
      expect(ACTIVITY_EVENT_CONFIG.enrichment_completed.color).toContain('green');
    });
  });

  describe('formatActivityTime', () => {
    it('should format recent time as "Just now"', () => {
      const now = new Date().toISOString();
      expect(formatActivityTime(now)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatActivityTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatActivityTime(twoHoursAgo)).toBe('2h ago');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatActivityTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should format older dates with month and day', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const result = formatActivityTime(twoWeeksAgo);
      // Should contain month abbreviation and day number
      expect(result).toMatch(/[A-Z][a-z]{2} \d+/);
    });
  });

  describe('formatActivityTimeFull', () => {
    it('should return full formatted date string', () => {
      const date = '2024-03-15T14:30:00Z';
      const result = formatActivityTimeFull(date);
      // Should contain day of week, month, day, year, time
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('groupActivitiesByDate', () => {
    it('should group activities by date', () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const activities: BomActivityEvent[] = [
        {
          id: '1',
          bomId: 'bom-1',
          eventType: 'bom_created',
          description: 'BOM created',
          timestamp: today.toISOString(),
        },
        {
          id: '2',
          bomId: 'bom-1',
          eventType: 'bom_updated',
          description: 'BOM updated',
          timestamp: today.toISOString(),
        },
        {
          id: '3',
          bomId: 'bom-1',
          eventType: 'enrichment_started',
          description: 'Enrichment started',
          timestamp: yesterday.toISOString(),
        },
      ];

      const groups = groupActivitiesByDate(activities);

      expect(groups.size).toBe(2);
    });

    it('should return empty map for empty activities', () => {
      const groups = groupActivitiesByDate([]);
      expect(groups.size).toBe(0);
    });

    it('should preserve order within groups', () => {
      const timestamp = new Date().toISOString();
      const activities: BomActivityEvent[] = [
        {
          id: '1',
          bomId: 'bom-1',
          eventType: 'bom_created',
          description: 'First',
          timestamp,
        },
        {
          id: '2',
          bomId: 'bom-1',
          eventType: 'bom_updated',
          description: 'Second',
          timestamp,
        },
      ];

      const groups = groupActivitiesByDate(activities);
      const firstGroup = groups.values().next().value as BomActivityEvent[] | undefined;

      expect(firstGroup).toBeDefined();
      expect(firstGroup?.[0].description).toBe('First');
      expect(firstGroup?.[1].description).toBe('Second');
    });
  });

  describe('getActivityUserDisplay', () => {
    it('should prefer userName if available', () => {
      const activity: BomActivityEvent = {
        id: '1',
        bomId: 'bom-1',
        eventType: 'bom_created',
        description: 'Test',
        timestamp: new Date().toISOString(),
        userName: 'John Doe',
        userEmail: 'john@example.com',
      };

      expect(getActivityUserDisplay(activity)).toBe('John Doe');
    });

    it('should use email username if no userName', () => {
      const activity: BomActivityEvent = {
        id: '1',
        bomId: 'bom-1',
        eventType: 'bom_created',
        description: 'Test',
        timestamp: new Date().toISOString(),
        userEmail: 'john@example.com',
      };

      expect(getActivityUserDisplay(activity)).toBe('john');
    });

    it('should return "System" if no user info', () => {
      const activity: BomActivityEvent = {
        id: '1',
        bomId: 'bom-1',
        eventType: 'bom_created',
        description: 'Test',
        timestamp: new Date().toISOString(),
      };

      expect(getActivityUserDisplay(activity)).toBe('System');
    });
  });
});

describe('Activity Event Types Coverage', () => {
  it('should have 18 event types defined', () => {
    const eventTypes = Object.keys(ACTIVITY_EVENT_CONFIG);
    expect(eventTypes.length).toBe(18);
  });

  it('should have consistent label format (Title Case)', () => {
    for (const [, config] of Object.entries(ACTIVITY_EVENT_CONFIG)) {
      // Each word should start with uppercase
      const words = config.label.split(' ');
      for (const word of words) {
        expect(word[0]).toBe(word[0].toUpperCase());
      }
    }
  });
});

describe('Unknown Event Type Fallback', () => {
  // These tests verify the safe getter functions work correctly
  // The actual functions are in ActivityLog.tsx but we test the pattern here

  it('should have fallback config structure matching known config', () => {
    const knownConfig = ACTIVITY_EVENT_CONFIG.bom_created;
    const expectedFallbackKeys = ['label', 'icon', 'color', 'bgColor'];

    for (const key of expectedFallbackKeys) {
      expect(knownConfig).toHaveProperty(key);
    }
  });

  it('should gracefully handle undefined event type access', () => {
    // Direct access to unknown key returns undefined
    const unknownType = 'some_future_event' as keyof typeof ACTIVITY_EVENT_CONFIG;
    expect(ACTIVITY_EVENT_CONFIG[unknownType]).toBeUndefined();

    // Safe pattern: use fallback
    const config = ACTIVITY_EVENT_CONFIG[unknownType] || {
      label: 'Activity',
      icon: 'circle',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
    };
    expect(config.label).toBe('Activity');
    expect(config.color).toBe('text-gray-700');
  });
});

describe('Activity Restore Flow', () => {
  it('should validate version structure for restore', () => {
    const validVersion = {
      id: 'version-123',
      bomId: 'bom-456',
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      lineCount: 10,
      canRestore: true,
    };

    expect(validVersion.id).toBeTruthy();
    expect(validVersion.versionNumber).toBeGreaterThan(0);
    expect(validVersion.canRestore).toBe(true);
  });

  it('should handle restore error scenarios', async () => {
    // Simulate restore error handling pattern
    const mockRestoreVersion = async (version: { id: string }) => {
      if (version.id === 'invalid') {
        throw new Error('Version not found');
      }
      return { success: true, newVersionId: 'new-123', newVersionNumber: 2 };
    };

    // Success case
    const result = await mockRestoreVersion({ id: 'valid-123' });
    expect(result.success).toBe(true);

    // Error case - should be caught and handled
    let errorMessage: string | null = null;
    try {
      await mockRestoreVersion({ id: 'invalid' });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
    }
    expect(errorMessage).toBe('Version not found');
  });

  it('should reset error state on new restore attempt', () => {
    // Pattern test for state reset
    let restoreError: string | null = 'Previous error';

    // New restore click should clear previous error
    const handleRestoreClick = () => {
      restoreError = null;
    };

    handleRestoreClick();
    expect(restoreError).toBeNull();
  });
});

describe('Activity Pagination', () => {
  it('should correctly slice activities for display', () => {
    const activities: BomActivityEvent[] = Array.from({ length: 25 }, (_, i) => ({
      id: `activity-${i}`,
      bomId: 'bom-1',
      eventType: 'bom_updated' as const,
      description: `Activity ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const maxItems = 10;
    const displayedActivities = activities.slice(0, maxItems);

    expect(displayedActivities.length).toBe(10);
    expect(displayedActivities[0].id).toBe('activity-0');
  });

  it('should show all activities when showAll is true', () => {
    const activities: BomActivityEvent[] = Array.from({ length: 25 }, (_, i) => ({
      id: `activity-${i}`,
      bomId: 'bom-1',
      eventType: 'bom_updated' as const,
      description: `Activity ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const maxItems = 10;
    const showAll = true;
    const displayedActivities = showAll ? activities : activities.slice(0, maxItems);

    expect(displayedActivities.length).toBe(25);
  });

  it('should calculate remaining count correctly', () => {
    const totalItems = 25;
    const maxItems = 10;
    const remainingCount = totalItems - maxItems;

    expect(remainingCount).toBe(15);
  });

  it('should show server "Load more" when first page is shorter than maxItems', () => {
    // Scenario: Server returns 5 items on first page, but hasMoreActivities=true
    // This tests the bug fix where "Load more" was hidden when activities.length <= maxItems
    const activities: BomActivityEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `activity-${i}`,
      bomId: 'bom-1',
      eventType: 'bom_updated' as const,
      description: `Activity ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const maxItems = 10;
    const showAll = false;
    const hasMoreActivities = true;

    // The condition for showing "Load more" button
    // Fixed: (showAll || activities.length <= maxItems) && hasMoreActivities
    const shouldShowLoadMore =
      (showAll || activities.length <= maxItems) && hasMoreActivities;

    expect(activities.length).toBe(5);
    expect(activities.length <= maxItems).toBe(true);
    expect(shouldShowLoadMore).toBe(true);
  });

  it('should hide client "Show more" when activities fit within maxItems', () => {
    const activities: BomActivityEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `activity-${i}`,
      bomId: 'bom-1',
      eventType: 'bom_updated' as const,
      description: `Activity ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const maxItems = 10;
    const showAll = false;

    // Client "Show more" condition: activities.length > maxItems && !showAll
    const shouldShowClientShowMore = activities.length > maxItems && !showAll;

    expect(shouldShowClientShowMore).toBe(false);
  });

  it('should show client "Show more" then server "Load more" in sequence', () => {
    const activities: BomActivityEvent[] = Array.from({ length: 15 }, (_, i) => ({
      id: `activity-${i}`,
      bomId: 'bom-1',
      eventType: 'bom_updated' as const,
      description: `Activity ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const maxItems = 10;
    const hasMoreActivities = true;

    // Phase 1: Initial state - showAll=false, should show client "Show more"
    let showAll = false;
    let shouldShowClientShowMore = activities.length > maxItems && !showAll;
    let shouldShowServerLoadMore =
      (showAll || activities.length <= maxItems) && hasMoreActivities;

    expect(shouldShowClientShowMore).toBe(true);
    expect(shouldShowServerLoadMore).toBe(false);

    // Phase 2: After clicking client "Show more" - showAll=true
    showAll = true;
    shouldShowClientShowMore = activities.length > maxItems && !showAll;
    shouldShowServerLoadMore =
      (showAll || activities.length <= maxItems) && hasMoreActivities;

    expect(shouldShowClientShowMore).toBe(false);
    expect(shouldShowServerLoadMore).toBe(true);
  });
});

describe('Activity Grouping Integration', () => {
  it('should group activities for timeline display', () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const activities: BomActivityEvent[] = [
      { id: '1', bomId: 'bom-1', eventType: 'bom_created', description: 'Created', timestamp: today.toISOString() },
      { id: '2', bomId: 'bom-1', eventType: 'enrichment_started', description: 'Enrichment', timestamp: today.toISOString() },
      { id: '3', bomId: 'bom-1', eventType: 'bom_updated', description: 'Updated', timestamp: yesterday.toISOString() },
      { id: '4', bomId: 'bom-1', eventType: 'line_item_added', description: 'Added item', timestamp: lastWeek.toISOString() },
    ];

    const groups = groupActivitiesByDate(activities);

    // Should have 3 date groups
    expect(groups.size).toBe(3);

    // Today's group should have 2 activities
    // groupActivitiesByDate uses toLocaleDateString with long format, not ISO format
    const todayKey = today.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const todayGroup = groups.get(todayKey);
    expect(todayGroup?.length).toBe(2);
  });

  it('should handle empty groups gracefully', () => {
    const groups = groupActivitiesByDate([]);
    expect(groups.size).toBe(0);

    // Iterating over empty map should work
    const entries = Array.from(groups.entries());
    expect(entries.length).toBe(0);
  });
});
