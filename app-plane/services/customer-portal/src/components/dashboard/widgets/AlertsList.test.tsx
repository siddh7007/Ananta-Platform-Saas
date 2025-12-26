/**
 * Unit tests for AlertsList component
 * @module components/dashboard/widgets/AlertsList.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsList, AlertsListProps } from './AlertsList';
import type { Alert } from '../../../types/dashboard';

describe('AlertsList', () => {
  const mockAlerts: Alert[] = [
    {
      id: '1',
      type: 'obsolete',
      severity: 'warning',
      message: '3 BOMs have more than 10% obsolete components',
      actionUrl: '/boms?filter=obsolete',
      createdAt: new Date('2025-12-14T08:30:00'),
    },
    {
      id: '2',
      type: 'quota',
      severity: 'warning',
      message: 'Enrichment quota at 85% for this month',
      actionUrl: '/settings/subscription',
      createdAt: new Date('2025-12-14T09:15:00'),
    },
    {
      id: '3',
      type: 'inactive_user',
      severity: 'error',
      message: '2 team members have not logged in for 30 days',
      actionUrl: '/team',
      createdAt: new Date('2025-12-14T10:00:00'),
    },
  ];

  const defaultProps: AlertsListProps = {
    alerts: mockAlerts,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render widget container', () => {
      render(<AlertsList {...defaultProps} />);

      expect(document.querySelector('.dashboard-widget')).toBeInTheDocument();
    });

    it('should display title', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    });

    it('should display custom title', () => {
      render(<AlertsList {...defaultProps} title="System Alerts" />);

      expect(screen.getByText('System Alerts')).toBeInTheDocument();
    });

    it('should show alert count badge', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should apply fade-in animation class', () => {
      render(<AlertsList {...defaultProps} />);

      expect(document.querySelector('.dashboard-widget')).toHaveClass('fade-in');
    });

    it('should apply custom className', () => {
      render(<AlertsList {...defaultProps} className="custom-alerts" />);

      expect(document.querySelector('.dashboard-widget')).toHaveClass('custom-alerts');
    });
  });

  describe('Alert Items', () => {
    it('should render all alerts', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText(/3 BOMs have more than 10% obsolete/)).toBeInTheDocument();
      expect(screen.getByText(/Enrichment quota at 85%/)).toBeInTheDocument();
      expect(screen.getByText(/2 team members have not logged in/)).toBeInTheDocument();
    });

    it('should respect maxAlerts prop', () => {
      render(<AlertsList {...defaultProps} maxAlerts={2} />);

      // Should only show 2 alerts
      const alertCards = document.querySelectorAll('.alert-card');
      expect(alertCards).toHaveLength(2);

      // Should show "more" indicator
      expect(screen.getByText('+1 more alert')).toBeInTheDocument();
    });

    it('should show correct icon for warning severity', () => {
      render(<AlertsList {...defaultProps} />);

      // Warning alerts should have AlertTriangle icon
      const warningIcons = document.querySelectorAll('.alert-card-icon.warning');
      expect(warningIcons.length).toBeGreaterThan(0);
    });

    it('should show correct icon for error severity', () => {
      render(<AlertsList {...defaultProps} />);

      // Error alerts should have XCircle icon
      const errorIcon = document.querySelector('.alert-card-icon.error');
      expect(errorIcon).toBeInTheDocument();
    });

    it('should display timestamp', () => {
      render(<AlertsList {...defaultProps} />);

      // Should show formatted timestamps (Dec 14, 8:30 AM format)
      const timestamps = screen.getAllByText(/Dec 14/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no alerts', () => {
      render(<AlertsList alerts={[]} />);

      expect(screen.getByText('All clear!')).toBeInTheDocument();
      expect(screen.getByText('No critical alerts at this time')).toBeInTheDocument();
    });

    it('should not show count badge when no alerts', () => {
      render(<AlertsList alerts={[]} />);

      // Count badge should not be present
      const badge = document.querySelector('.bg-red-100');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render action button with correct text for obsolete type', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText('View BOMs')).toBeInTheDocument();
    });

    it('should render action button with correct text for quota type', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });

    it('should render action button with correct text for inactive_user type', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByText('Manage Team')).toBeInTheDocument();
    });

    it('should call onActionClick when action button clicked', async () => {
      const onActionClick = vi.fn();
      const user = userEvent.setup();

      render(<AlertsList {...defaultProps} onActionClick={onActionClick} />);

      const viewBomsButton = screen.getByText('View BOMs');
      await user.click(viewBomsButton);

      expect(onActionClick).toHaveBeenCalledWith(mockAlerts[0]);
    });

    it('should not render action button if no actionUrl', () => {
      const alertsWithoutAction: Alert[] = [
        {
          id: '1',
          type: 'obsolete',
          severity: 'warning',
          message: 'Test alert without action',
          createdAt: new Date(),
        },
      ];

      render(<AlertsList alerts={alertsWithoutAction} />);

      expect(screen.queryByText('View BOMs')).not.toBeInTheDocument();
    });
  });

  describe('Dismiss Functionality', () => {
    it('should render dismiss button when onDismiss provided', () => {
      const onDismiss = vi.fn();

      render(<AlertsList {...defaultProps} onDismiss={onDismiss} />);

      const dismissButtons = screen.getAllByLabelText('Dismiss alert');
      expect(dismissButtons.length).toBeGreaterThan(0);
    });

    it('should call onDismiss with alert id', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();

      render(<AlertsList {...defaultProps} onDismiss={onDismiss} />);

      const dismissButtons = screen.getAllByLabelText('Dismiss alert');
      await user.click(dismissButtons[0]);

      expect(onDismiss).toHaveBeenCalledWith('1');
    });

    it('should not render dismiss button when onDismiss not provided', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.queryByLabelText('Dismiss alert')).not.toBeInTheDocument();
    });
  });

  describe('Message Truncation', () => {
    it('should truncate long messages', () => {
      const longAlert: Alert[] = [
        {
          id: '1',
          type: 'obsolete',
          severity: 'warning',
          message:
            'This is a very long alert message that exceeds 100 characters and should be truncated with an ellipsis and a show more button available for the user to click',
          actionUrl: '/test',
          createdAt: new Date(),
        },
      ];

      render(<AlertsList alerts={longAlert} />);

      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('should expand message when More clicked', async () => {
      const longMessage =
        'This is a very long alert message that exceeds 100 characters and should be truncated with an ellipsis and a show more button available for the user to click';
      const longAlert: Alert[] = [
        {
          id: '1',
          type: 'obsolete',
          severity: 'warning',
          message: longMessage,
          actionUrl: '/test',
          createdAt: new Date(),
        },
      ];

      const user = userEvent.setup();
      render(<AlertsList alerts={longAlert} />);

      const moreButton = screen.getByText('More');
      await user.click(moreButton);

      expect(screen.getByText('Less')).toBeInTheDocument();
      expect(screen.getByText(new RegExp(longMessage.slice(-20)))).toBeInTheDocument();
    });

    it('should collapse message when Less clicked', async () => {
      const longMessage =
        'This is a very long alert message that exceeds 100 characters and should be truncated with an ellipsis and a show more button available for the user to click';
      const longAlert: Alert[] = [
        {
          id: '1',
          type: 'obsolete',
          severity: 'warning',
          message: longMessage,
          actionUrl: '/test',
          createdAt: new Date(),
        },
      ];

      const user = userEvent.setup();
      render(<AlertsList alerts={longAlert} />);

      // Expand
      await user.click(screen.getByText('More'));
      // Collapse
      await user.click(screen.getByText('Less'));

      expect(screen.getByText('More')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have list role', () => {
      render(<AlertsList {...defaultProps} />);

      expect(screen.getByRole('list', { name: 'Critical alerts' })).toBeInTheDocument();
    });

    it('should have listitem role for each alert', () => {
      render(<AlertsList {...defaultProps} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('should have aria-label on alert items', () => {
      render(<AlertsList {...defaultProps} />);

      const items = screen.getAllByRole('listitem');
      expect(items[0]).toHaveAttribute(
        'aria-label',
        'warning alert: 3 BOMs have more than 10% obsolete components'
      );
    });

    it('should have aria-expanded on truncation toggle', async () => {
      const longAlert: Alert[] = [
        {
          id: '1',
          type: 'obsolete',
          severity: 'warning',
          message:
            'This is a very long alert message that exceeds 100 characters and should be truncated with an ellipsis',
          actionUrl: '/test',
          createdAt: new Date(),
        },
      ];

      render(<AlertsList alerts={longAlert} />);

      const moreButton = screen.getByText('More');
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-label on action buttons', () => {
      render(<AlertsList {...defaultProps} />);

      const actionButton = screen.getByText('View BOMs');
      expect(actionButton).toHaveAttribute('aria-label', 'View BOMs for this alert');
    });

    it('should have status role on empty state', () => {
      render(<AlertsList alerts={[]} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Display Name', () => {
    it('should have displayName set', () => {
      expect(AlertsList.displayName).toBe('AlertsList');
    });
  });
});
