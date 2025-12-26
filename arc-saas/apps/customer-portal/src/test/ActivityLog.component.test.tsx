/**
 * ActivityLog Component Tests
 *
 * Tests for ActivityLog UI component including:
 * - Render states (loading, error, empty, with data)
 * - Unknown event type handling (fallback)
 * - Pagination (client-side and server-side)
 * - Restore flow (dialog, confirmation, error handling)
 * - User interactions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivityLog } from '@/components/bom/ActivityLog';
import type { BomActivityEvent, BomVersion } from '@/types/activity';

// =============================================================================
// Test Data Factories
// =============================================================================

function createActivity(overrides: Partial<BomActivityEvent> = {}): BomActivityEvent {
  return {
    id: `activity-${Math.random().toString(36).slice(2)}`,
    bomId: 'bom-123',
    eventType: 'bom_updated',
    description: 'Test activity',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createVersion(overrides: Partial<BomVersion> = {}): BomVersion {
  return {
    id: `version-${Math.random().toString(36).slice(2)}`,
    bomId: 'bom-123',
    versionNumber: 1,
    name: 'Test BOM',
    lineCount: 10,
    enrichedCount: 5,
    status: 'completed',
    createdAt: new Date().toISOString(),
    canRestore: true,
    ...overrides,
  };
}

// =============================================================================
// Loading State Tests
// =============================================================================

describe('ActivityLog Loading State', () => {
  it('should render loading skeleton when isLoading is true', () => {
    render(
      <ActivityLog
        bomId="bom-123"
        activities={[]}
        isLoading={true}
      />
    );

    // Should show "Activity Log" title
    expect(screen.getByText('Activity Log')).toBeInTheDocument();

    // Should render skeleton placeholders (3 of them based on component)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should not show activities while loading', () => {
    const activities = [createActivity({ description: 'Should not appear' })];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        isLoading={true}
      />
    );

    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Error State Tests
// =============================================================================

describe('ActivityLog Error State', () => {
  it('should render error message when error prop is provided', () => {
    render(
      <ActivityLog
        bomId="bom-123"
        activities={[]}
        error="Failed to load history"
      />
    );

    expect(screen.getByText('Failed to load history')).toBeInTheDocument();
  });

  it('should show error icon with error message', () => {
    render(
      <ActivityLog
        bomId="bom-123"
        activities={[]}
        error="Network error"
      />
    );

    // Error is displayed in a styled container
    const errorContainer = screen.getByText('Network error').closest('div');
    expect(errorContainer).toHaveClass('text-destructive');
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe('ActivityLog Empty State', () => {
  it('should render empty state when no activities', () => {
    render(
      <ActivityLog
        bomId="bom-123"
        activities={[]}
      />
    );

    expect(screen.getByText('No activity recorded yet')).toBeInTheDocument();
    expect(screen.getByText('Changes to this BOM will appear here')).toBeInTheDocument();
  });
});

// =============================================================================
// Activity Rendering Tests
// =============================================================================

describe('ActivityLog Activity Rendering', () => {
  it('should render activity items', () => {
    const activities = [
      createActivity({ description: 'First activity', eventType: 'bom_created' }),
      createActivity({ description: 'Second activity', eventType: 'bom_updated' }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByText('First activity')).toBeInTheDocument();
    expect(screen.getByText('Second activity')).toBeInTheDocument();
  });

  it('should display event count in header', () => {
    const activities = [
      createActivity(),
      createActivity(),
      createActivity(),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByText(/3 events/)).toBeInTheDocument();
  });

  it('should display user name when available', () => {
    const activities = [
      createActivity({ userName: 'John Doe', userEmail: 'john@example.com' }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display email username when userName is missing', () => {
    const activities = [
      createActivity({ userEmail: 'jane@example.com' }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByText('jane')).toBeInTheDocument();
  });

  it('should display "System" when no user info', () => {
    const activities = [
      createActivity(),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByText('System')).toBeInTheDocument();
  });
});

// =============================================================================
// Unknown Event Type Tests (Fallback)
// =============================================================================

describe('ActivityLog Unknown Event Type Handling', () => {
  it('should render unknown event types without crashing', () => {
    const activities = [
      createActivity({
        // @ts-expect-error - Testing unknown event type
        eventType: 'some_future_event_type',
        description: 'Unknown event happened',
      }),
    ];

    // Should not throw
    expect(() => {
      render(
        <ActivityLog
          bomId="bom-123"
          activities={activities}
        />
      );
    }).not.toThrow();

    // Should still render the activity
    expect(screen.getByText('Unknown event happened')).toBeInTheDocument();
  });

  it('should show fallback "Activity" label for unknown types', () => {
    const activities = [
      createActivity({
        // @ts-expect-error - Testing unknown event type
        eventType: 'completely_unknown_type',
        description: 'Mysterious event',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    // Should show fallback label
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });
});

// =============================================================================
// Client-Side Pagination Tests
// =============================================================================

describe('ActivityLog Client-Side Pagination', () => {
  it('should limit displayed activities to maxItems by default', () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
      />
    );

    // Should show first 10
    expect(screen.getByText('Activity 1')).toBeInTheDocument();
    expect(screen.getByText('Activity 10')).toBeInTheDocument();

    // Should not show 11+
    expect(screen.queryByText('Activity 11')).not.toBeInTheDocument();
  });

  it('should show "Show more" button when activities exceed maxItems', () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
      />
    );

    expect(screen.getByText(/Show 5 more events/)).toBeInTheDocument();
  });

  it('should expand to show all activities when "Show more" is clicked', async () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
      />
    );

    const showMoreButton = screen.getByText(/Show 5 more events/);
    fireEvent.click(showMoreButton);

    // Now all 15 should be visible
    await waitFor(() => {
      expect(screen.getByText('Activity 15')).toBeInTheDocument();
    });
  });

  it('should not show "Show more" when activities fit within maxItems', () => {
    const activities = Array.from({ length: 5 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
      />
    );

    expect(screen.queryByText(/Show \d+ more events/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Server-Side Pagination Tests
// =============================================================================

describe('ActivityLog Server-Side Pagination', () => {
  it('should show "Load more" when hasMoreActivities is true and all client items shown', () => {
    const activities = Array.from({ length: 5 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    const onLoadMore = vi.fn();

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
        hasMoreActivities={true}
        onLoadMoreActivities={onLoadMore}
        totalActivities={50}
      />
    );

    // Since activities.length (5) <= maxItems (10), Load more should appear
    expect(screen.getByText(/Load more events/)).toBeInTheDocument();
    expect(screen.getByText(/45 remaining/)).toBeInTheDocument();
  });

  it('should call onLoadMoreActivities when "Load more" is clicked', async () => {
    const activities = Array.from({ length: 5 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    const onLoadMore = vi.fn().mockResolvedValue(undefined);

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
        hasMoreActivities={true}
        onLoadMoreActivities={onLoadMore}
      />
    );

    const loadMoreButton = screen.getByText(/Load more events/);
    fireEvent.click(loadMoreButton);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should show loading state when isLoadingMore is true', () => {
    const activities = [createActivity()];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
        hasMoreActivities={true}
        onLoadMoreActivities={vi.fn()}
        isLoadingMore={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should disable "Load more" button when loading', () => {
    const activities = [createActivity()];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
        hasMoreActivities={true}
        onLoadMoreActivities={vi.fn()}
        isLoadingMore={true}
      />
    );

    const button = screen.getByRole('button', { name: /Loading/i });
    expect(button).toBeDisabled();
  });

  it('should show server "Load more" after client "Show more" when both needed', async () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      createActivity({ description: `Activity ${i + 1}` })
    );

    const onLoadMore = vi.fn();

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        maxItems={10}
        hasMoreActivities={true}
        onLoadMoreActivities={onLoadMore}
        totalActivities={100}
      />
    );

    // Initially should show client "Show more"
    expect(screen.getByText(/Show 5 more events/)).toBeInTheDocument();
    expect(screen.queryByText(/Load more events/)).not.toBeInTheDocument();

    // Click client "Show more"
    fireEvent.click(screen.getByText(/Show 5 more events/));

    // Now server "Load more" should appear
    await waitFor(() => {
      expect(screen.getByText(/Load more events/)).toBeInTheDocument();
    });
  });
});

// =============================================================================
// Version Restore Tests
// =============================================================================

describe('ActivityLog Version Restore', () => {
  it('should show restore button for version_created events with restorable versions', () => {
    const version = createVersion({ id: 'v1', versionNumber: 1, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
        description: 'Version 1 created',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={vi.fn()}
      />
    );

    expect(screen.getByText('Restore this version')).toBeInTheDocument();
  });

  it('should not show restore button when canRestore is false', () => {
    const version = createVersion({ id: 'v1', canRestore: false });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={vi.fn()}
      />
    );

    expect(screen.queryByText('Restore this version')).not.toBeInTheDocument();
  });

  it('should open confirmation dialog when restore is clicked', async () => {
    const version = createVersion({ id: 'v1', versionNumber: 2, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Restore this version'));

    await waitFor(() => {
      // Dialog title uses role="heading" or is in DialogTitle
      expect(screen.getByRole('heading', { name: 'Restore Version' })).toBeInTheDocument();
      expect(screen.getByText(/restore this BOM to version 2/)).toBeInTheDocument();
    });
  });

  it('should call onRestoreVersion when confirmed', async () => {
    const version = createVersion({ id: 'v1', versionNumber: 2, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];
    const onRestore = vi.fn().mockResolvedValue(undefined);

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={onRestore}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByText('Restore this version'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Restore Version' })).toBeInTheDocument();
    });

    // Click confirm button - use getAllByRole and get the last one (the confirm button in dialog)
    const buttons = screen.getAllByRole('button', { name: /Restore/i });
    const confirmButton = buttons[buttons.length - 1]; // Last button is the confirm in dialog
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith(version);
    });
  });

  it('should show error in dialog when restore fails', async () => {
    const version = createVersion({ id: 'v1', versionNumber: 2, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];
    const onRestore = vi.fn().mockRejectedValue(new Error('Restore failed'));

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={onRestore}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByText('Restore this version'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Restore Version' })).toBeInTheDocument();
    });

    // Click confirm button - use getAllByRole and get the last one (the confirm button in dialog)
    const buttons = screen.getAllByRole('button', { name: /Restore/i });
    const confirmButton = buttons[buttons.length - 1];
    fireEvent.click(confirmButton);

    // Error should appear in dialog
    await waitFor(() => {
      expect(screen.getByText('Restore failed')).toBeInTheDocument();
    });
  });

  it('should close dialog and clear error when cancelled', async () => {
    const version = createVersion({ id: 'v1', versionNumber: 2, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={vi.fn()}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByText('Restore this version'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Restore Version' })).toBeInTheDocument();
    });

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Restore Version' })).not.toBeInTheDocument();
    });
  });

  it('should show loading state during restore', async () => {
    const version = createVersion({ id: 'v1', versionNumber: 2, canRestore: true });
    const activities = [
      createActivity({
        eventType: 'version_created',
        versionId: 'v1',
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
        versions={[version]}
        onRestoreVersion={vi.fn()}
        isRestoring={true}
      />
    );

    // Restore button should be disabled
    const restoreButton = screen.getByText('Restore this version');
    expect(restoreButton.closest('button')).toBeDisabled();
  });
});

// =============================================================================
// Activity Details Expansion Tests
// =============================================================================

describe('ActivityLog Activity Details Expansion', () => {
  it('should show expand button when activity has changes', () => {
    const activities = [
      createActivity({
        changes: [
          { field: 'quantity', previousValue: 10, newValue: 20 },
        ],
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    // Should have a chevron button for expansion
    const expandButton = document.querySelector('[class*="h-6"][class*="w-6"]');
    expect(expandButton).toBeInTheDocument();
  });

  it('should show changes when expanded', async () => {
    const activities = [
      createActivity({
        changes: [
          { field: 'quantity', previousValue: '10', newValue: '20' },
        ],
      }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    // Click expand button
    const expandButton = document.querySelector('button[class*="h-6"]');
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    // Changes should now be visible
    await waitFor(() => {
      expect(screen.getByText('Changes:')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('ActivityLog Accessibility', () => {
  it('should have accessible feed role', () => {
    const activities = [createActivity()];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    expect(screen.getByRole('feed', { name: 'Activity timeline' })).toBeInTheDocument();
  });

  it('should have accessible article roles for each activity', () => {
    const activities = [
      createActivity({ eventType: 'bom_created', description: 'Created BOM' }),
      createActivity({ eventType: 'bom_updated', description: 'Updated BOM' }),
    ];

    render(
      <ActivityLog
        bomId="bom-123"
        activities={activities}
      />
    );

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
  });
});
