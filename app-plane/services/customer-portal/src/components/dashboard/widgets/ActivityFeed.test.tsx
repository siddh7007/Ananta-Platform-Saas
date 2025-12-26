/**
 * Unit tests for ActivityFeed component
 * @module components/dashboard/widgets/ActivityFeed.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFeed, ActivityFeedProps } from './ActivityFeed';
import type { ActivityItem } from '../../../types/dashboard';

describe('ActivityFeed', () => {
  // Mock current time for consistent timestamp testing
  const NOW = new Date('2025-12-14T12:00:00');

  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      userId: 'u1',
      userName: 'Emily Rodriguez',
      action: 'upload',
      target: 'PCB-Rev-3.xlsx',
      timestamp: new Date(NOW.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: '2',
      userId: 'u2',
      userName: 'David Chen',
      action: 'compare',
      target: '5 components',
      timestamp: new Date(NOW.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
    {
      id: '3',
      userId: 'system',
      userName: 'System',
      action: 'enrich',
      target: 'BOM-2024-047',
      timestamp: new Date(NOW.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
    },
    {
      id: '4',
      userId: 'u3',
      userName: 'Sarah Johnson',
      action: 'approve',
      target: 'BOM-2024-046',
      timestamp: new Date(NOW.getTime() - 8 * 60 * 60 * 1000), // 8 hours ago
    },
    {
      id: '5',
      userId: 'u1',
      userName: 'Emily Rodriguez',
      action: 'export',
      target: 'Q4 Component Report',
      timestamp: new Date(NOW.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  ];

  const defaultProps: ActivityFeedProps = {
    activities: mockActivities,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render widget container', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(document.querySelector('.dashboard-widget')).toBeInTheDocument();
    });

    it('should display title', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText('Recent Team Activity')).toBeInTheDocument();
    });

    it('should display custom title', () => {
      render(<ActivityFeed {...defaultProps} title="Team Updates" />);

      expect(screen.getByText('Team Updates')).toBeInTheDocument();
    });

    it('should apply fade-in animation class', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(document.querySelector('.dashboard-widget')).toHaveClass('fade-in');
    });

    it('should apply custom className', () => {
      render(<ActivityFeed {...defaultProps} className="custom-feed" />);

      expect(document.querySelector('.dashboard-widget')).toHaveClass('custom-feed');
    });
  });

  describe('Activity Items', () => {
    it('should render all activities up to maxActivities', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={3} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('should display user name', () => {
      render(<ActivityFeed {...defaultProps} />);

      // Emily Rodriguez appears twice (upload + export activities)
      const emilyNames = screen.getAllByText('Emily Rodriguez');
      expect(emilyNames.length).toBeGreaterThan(0);
      expect(screen.getByText('David Chen')).toBeInTheDocument();
    });

    it('should display activity target', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/"PCB-Rev-3.xlsx"/)).toBeInTheDocument();
      expect(screen.getByText(/"5 components"/)).toBeInTheDocument();
    });

    it('should display correct action verb for upload', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/uploaded/)).toBeInTheDocument();
    });

    it('should display correct action verb for compare', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/compared/)).toBeInTheDocument();
    });

    it('should display correct action verb for enrich', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/enriched/)).toBeInTheDocument();
    });

    it('should display correct action verb for approve', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/approved/)).toBeInTheDocument();
    });

    it('should display correct action verb for export', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText(/exported/)).toBeInTheDocument();
    });
  });

  describe('User Avatars', () => {
    it('should display user initials when no avatar', () => {
      render(<ActivityFeed {...defaultProps} />);

      // Emily Rodriguez appears twice, so use getAllByLabelText
      const emilyInitials = screen.getAllByLabelText('Emily Rodriguez initials');
      expect(emilyInitials[0]).toHaveTextContent('ER');
      // David Chen -> DC
      expect(screen.getByLabelText('David Chen initials')).toHaveTextContent('DC');
    });

    it('should display avatar image when provided', () => {
      const activitiesWithAvatar: ActivityItem[] = [
        {
          id: '1',
          userId: 'u1',
          userName: 'Emily Rodriguez',
          userAvatar: 'https://example.com/emily.jpg',
          action: 'upload',
          target: 'Test.xlsx',
          timestamp: new Date(),
        },
      ];

      render(<ActivityFeed activities={activitiesWithAvatar} />);

      const avatar = screen.getByAltText('Emily Rodriguez avatar');
      expect(avatar).toHaveAttribute('src', 'https://example.com/emily.jpg');
    });

    it('should handle single-word names', () => {
      const singleNameActivity: ActivityItem[] = [
        {
          id: '1',
          userId: 'system',
          userName: 'System',
          action: 'enrich',
          target: 'Test',
          timestamp: new Date(),
        },
      ];

      render(<ActivityFeed activities={singleNameActivity} />);

      expect(screen.getByLabelText('System initials')).toHaveTextContent('SY');
    });
  });

  describe('Timestamps', () => {
    it('should show "Just now" for very recent activity', () => {
      const recentActivity: ActivityItem[] = [
        {
          id: '1',
          userId: 'u1',
          userName: 'Test User',
          action: 'upload',
          target: 'Test.xlsx',
          timestamp: new Date(NOW.getTime() - 30000), // 30 seconds ago
        },
      ];

      render(<ActivityFeed activities={recentActivity} />);

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should show minutes for recent activity', () => {
      const minutesAgo: ActivityItem[] = [
        {
          id: '1',
          userId: 'u1',
          userName: 'Test User',
          action: 'upload',
          target: 'Test.xlsx',
          timestamp: new Date(NOW.getTime() - 15 * 60 * 1000), // 15 minutes ago
        },
      ];

      render(<ActivityFeed activities={minutesAgo} />);

      expect(screen.getByText('15m ago')).toBeInTheDocument();
    });

    it('should show hours for activity within 24 hours', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('should show days for activity older than 24 hours', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByText('1d ago')).toBeInTheDocument();
    });

    it('should show date for activity older than 7 days', () => {
      const oldActivity: ActivityItem[] = [
        {
          id: '1',
          userId: 'u1',
          userName: 'Test User',
          action: 'upload',
          target: 'Test.xlsx',
          timestamp: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
      ];

      render(<ActivityFeed activities={oldActivity} />);

      // Should show formatted date like "Dec 4"
      expect(screen.getByText(/Dec/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no activities', () => {
      render(<ActivityFeed activities={[]} />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('should have status role on empty state', () => {
      render(<ActivityFeed activities={[]} />);

      expect(screen.getByRole('status', { name: 'No recent activity' })).toBeInTheDocument();
    });
  });

  describe('Load More', () => {
    it('should show Load More button when more activities exist', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={3} />);

      expect(screen.getByText('Load More')).toBeInTheDocument();
    });

    it('should not show Load More when all activities displayed', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={10} />);

      expect(screen.queryByText('Load More')).not.toBeInTheDocument();
    });

    it('should increase display count when Load More clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<ActivityFeed {...defaultProps} maxActivities={2} />);

      // Initially should show 2 items
      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      await user.click(screen.getByText('Load More'));

      // Should now show 4 items (2 + 2)
      expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });

    it('should call onLoadMore callback when provided', async () => {
      const onLoadMore = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <ActivityFeed {...defaultProps} maxActivities={3} enableLoadMore onLoadMore={onLoadMore} />
      );

      await user.click(screen.getByText('Load More'));

      expect(onLoadMore).toHaveBeenCalled();
    });

    it('should hide Load More when loading', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={3} isLoading={true} />);

      expect(screen.queryByText('Load More')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading', () => {
      render(<ActivityFeed {...defaultProps} isLoading={true} />);

      // Get all status elements and check for loading indicator
      const statusElements = screen.getAllByRole('status');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should have screen reader text for loading', () => {
      render(<ActivityFeed {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading more activities...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have list role', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(screen.getByRole('list', { name: 'Team activity timeline' })).toBeInTheDocument();
    });

    it('should have listitem role for each activity', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={3} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('should have aria-label on activity items', () => {
      render(<ActivityFeed {...defaultProps} />);

      const items = screen.getAllByRole('listitem');
      expect(items[0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Emily Rodriguez')
      );
      expect(items[0]).toHaveAttribute('aria-label', expect.stringContaining('uploaded'));
    });

    it('should have aria-label on Load More button', () => {
      render(<ActivityFeed {...defaultProps} maxActivities={3} />);

      expect(screen.getByLabelText('Load more activities')).toBeInTheDocument();
    });

    it('should have aria-live on loading indicator', () => {
      render(<ActivityFeed {...defaultProps} isLoading={true} />);

      // There may be multiple status elements, get all and find the loading one
      const statusElements = screen.getAllByRole('status');
      const loadingStatus = statusElements.find(el => el.getAttribute('aria-live') === 'polite');
      expect(loadingStatus).toBeInTheDocument();
    });
  });

  describe('Action Badges', () => {
    it('should render action badge for each activity', () => {
      render(<ActivityFeed {...defaultProps} />);

      const badges = document.querySelectorAll('.activity-badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should apply action-specific class to badge', () => {
      render(<ActivityFeed {...defaultProps} />);

      expect(document.querySelector('.activity-badge.upload')).toBeInTheDocument();
      expect(document.querySelector('.activity-badge.compare')).toBeInTheDocument();
    });
  });

  describe('Display Name', () => {
    it('should have displayName set', () => {
      expect(ActivityFeed.displayName).toBe('ActivityFeed');
    });
  });
});
