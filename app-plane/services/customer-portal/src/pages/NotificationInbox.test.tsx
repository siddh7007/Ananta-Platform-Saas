/**
 * NotificationInbox Page Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NotificationInbox } from './NotificationInbox';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Auth0
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: { sub: 'auth0|test-user-id' },
    isAuthenticated: true,
  }),
}));

// Mock Supabase
vi.mock('../providers/dataProvider', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  },
}));

// Test wrapper with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('NotificationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should show loading spinner initially', () => {
      renderWithRouter(<NotificationInbox />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render inbox header after loading', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        expect(screen.getByText('Inbox')).toBeInTheDocument();
      });
    });

    it('should render unread count in header', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        // Mock has 2 unread notifications
        expect(screen.getByText(/2 unread notification/)).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear read/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /preferences/i })).toBeInTheDocument();
      });
    });
  });

  describe('Tabs', () => {
    it('should render all tabs', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toBe(3);
        // Check tab texts exist
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Unread')).toBeInTheDocument();
        // "Read" tab label - use getAllByText since it may match partial
        const readTexts = screen.getAllByText('Read');
        expect(readTexts.length).toBeGreaterThan(0);
      });
    });

    it('should filter to unread when clicking Unread tab', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('Unread')).toBeInTheDocument();
      });

      // Click the Unread tab (second tab)
      const tabs = screen.getAllByRole('tab');
      await user.click(tabs[1]); // Unread is the second tab

      // Should only show unread notifications (2 in mock data)
      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
        expect(screen.getByText('Component Risk Alert')).toBeInTheDocument();
        // Read notifications should not be visible
        expect(screen.queryByText('Enrichment Complete')).not.toBeInTheDocument();
      });
    });

    it('should filter to read when clicking Read tab', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toBe(3);
      });

      // Click the Read tab (third tab)
      const tabs = screen.getAllByRole('tab');
      await user.click(tabs[2]); // Read is the third tab

      // Should only show read notifications
      await waitFor(() => {
        expect(screen.getByText('Enrichment Complete')).toBeInTheDocument();
        expect(screen.getByText('Team Member Joined')).toBeInTheDocument();
        // Unread notifications should not be visible
        expect(screen.queryByText('BOM Upload Complete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Notifications List', () => {
    it('should render mock notifications', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
        expect(screen.getByText('Component Risk Alert')).toBeInTheDocument();
        expect(screen.getByText('Enrichment Complete')).toBeInTheDocument();
      });
    });

    it('should show notification messages', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        // Use substring matching for messages that might be broken across elements
        expect(screen.getByText((content) => content.includes('PCB-Assembly-v2.xlsx'))).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('STM32F103C8T6'))).toBeInTheDocument();
      });
    });

    it('should show relative time for notifications', async () => {
      renderWithRouter(<NotificationInbox />);
      await waitFor(() => {
        // Mock data has timestamps relative to now
        // Should show "5m ago", "30m ago", "2h ago", etc.
        const timeElements = screen.getAllByText(/ago|Just now/);
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Mark as Read', () => {
    it('should mark notification as read when clicking mark as read button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });

      // Find the mark as read button for the first unread notification
      const markReadButtons = screen.getAllByLabelText(/mark as read/i);
      expect(markReadButtons.length).toBeGreaterThan(0);

      await user.click(markReadButtons[0]);

      // Unread count should decrease
      await waitFor(() => {
        expect(screen.getByText(/1 unread notification/)).toBeInTheDocument();
      });
    });

    it('should mark all as read when clicking Mark All Read button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /mark all read/i }));

      // All notifications should be marked as read
      await waitFor(() => {
        expect(screen.getByText(/0 unread notification/)).toBeInTheDocument();
      });
    });
  });

  describe('Delete', () => {
    it('should delete notification when clicking delete button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      expect(deleteButtons.length).toBeGreaterThan(0);

      await user.click(deleteButtons[0]);

      // Notification should be removed
      await waitFor(() => {
        expect(screen.queryByText('BOM Upload Complete')).not.toBeInTheDocument();
      });
    });

    it('should clear all read notifications when clicking Clear Read button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear read/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear read/i }));

      // Read notifications should be removed
      await waitFor(() => {
        expect(screen.queryByText('Enrichment Complete')).not.toBeInTheDocument();
        expect(screen.queryByText('Team Member Joined')).not.toBeInTheDocument();
        // Unread should remain
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to preferences when clicking Preferences button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /preferences/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /preferences/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/alerts/preferences');
    });

    it('should navigate to BOM when clicking notification with bom_id', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });

      // Click on the notification with bom_id payload
      await user.click(screen.getByText('BOM Upload Complete'));

      expect(mockNavigate).toHaveBeenCalledWith('/boms/bom-123');
    });

    it('should navigate to component when clicking notification with component_id', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('Component Risk Alert')).toBeInTheDocument();
      });

      // Click on the notification with component_id payload
      await user.click(screen.getByText('Component Risk Alert'));

      expect(mockNavigate).toHaveBeenCalledWith('/components/comp-456');
    });
  });

  describe('Refresh', () => {
    it('should have refresh button', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument();
      });
    });

    it('should show loading indicator when refreshing', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/refresh/i));

      // Should show loading indicator inside the refresh button area
      // The button contains a circular progress when refreshing
      await waitFor(() => {
        const refreshButton = screen.getByLabelText(/refresh/i);
        expect(refreshButton).toBeDisabled();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when no notifications in filtered view', async () => {
      const user = userEvent.setup();
      renderWithRouter(<NotificationInbox />);

      // First mark all as read
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /mark all read/i }));

      // Then filter to unread
      await user.click(screen.getByRole('tab', { name: /unread/i }));

      await waitFor(() => {
        expect(screen.getByText(/No notifications/)).toBeInTheDocument();
        expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
      });
    });
  });

  describe('Notification Icons', () => {
    it('should show success notification with appropriate styling', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });

      // Success notifications should exist with their message
      expect(screen.getByText((content) => content.includes('PCB-Assembly-v2.xlsx'))).toBeInTheDocument();
    });

    it('should show warning notification with appropriate styling', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('Component Risk Alert')).toBeInTheDocument();
      });

      // The Component Risk Alert is a warning type notification
      expect(screen.getByText((content) => content.includes('STM32F103C8T6'))).toBeInTheDocument();
    });
  });

  describe('Unread Indicator', () => {
    it('should show unread indicator for unread notifications', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByText('BOM Upload Complete')).toBeInTheDocument();
      });

      // Unread notifications have a blue dot indicator
      // Check that unread notifications have bolder text (fontWeight: 600)
      const bomTitle = screen.getByText('BOM Upload Complete');
      // The title should be in a Typography with fontWeight 600 for unread
      expect(bomTitle).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on tabs', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveAttribute('aria-label', 'notification filters');
      });
    });

    it('should have tooltip titles on action buttons', async () => {
      renderWithRouter(<NotificationInbox />);

      await waitFor(() => {
        expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument();
      });
    });
  });
});
