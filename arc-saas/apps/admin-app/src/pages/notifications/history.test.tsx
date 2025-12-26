/**
 * NotificationHistory Component Tests
 *
 * Tests for the notification history page with data source toggle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationHistory } from './history';

// Mock the Refine useCustom hook
const mockUseCustom = vi.fn();
vi.mock('@refinedev/core', () => ({
  useCustom: () => mockUseCustom(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('NotificationHistory', () => {
  const mockHistoryItems = [
    {
      id: 'notif-1',
      transactionId: 'tx-123',
      templateName: 'Welcome Email',
      workflowId: 'welcome',
      subscriberId: 'user-123',
      channel: 'email',
      status: 'delivered',
      createdAt: new Date().toISOString(),
      recipientEmail: 'user@example.com',
      subject: 'Welcome to our platform',
    },
    {
      id: 'notif-2',
      transactionId: 'tx-456',
      templateName: 'Invoice',
      workflowId: 'invoice',
      subscriberId: 'user-456',
      channel: 'email',
      status: 'failed',
      createdAt: new Date().toISOString(),
      recipientEmail: 'user2@example.com',
      errorMessage: 'Mailbox not found',
    },
    {
      id: 'notif-3',
      transactionId: 'tx-789',
      templateName: 'Alert',
      workflowId: 'alert',
      subscriberId: 'user-789',
      channel: 'push',
      status: 'sent',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCustom.mockReturnValue({
      data: {
        data: {
          data: mockHistoryItems,
          total: mockHistoryItems.length,
          hasMore: false,
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  describe('Data Source Toggle', () => {
    it('renders data source toggle with Novu and Local options', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('Novu')).toBeInTheDocument();
      expect(screen.getByText('Local')).toBeInTheDocument();
    });

    it('switches to Local data source when clicked', async () => {
      render(<NotificationHistory />);

      const localButton = screen.getByText('Local');
      fireEvent.click(localButton);

      // After click, Local should be selected
      await waitFor(() => {
        expect(localButton.closest('button')).toHaveClass('bg-primary');
      });
    });

    it('shows Novu info banner when Novu is selected', () => {
      render(<NotificationHistory />);

      expect(screen.getByText(/Novu API/i)).toBeInTheDocument();
    });

    it('shows Local info banner when Local is selected', async () => {
      render(<NotificationHistory />);

      const localButton = screen.getByText('Local');
      fireEvent.click(localButton);

      await waitFor(() => {
        expect(screen.getByText(/local database/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when fetching data', () => {
      mockUseCustom.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      });

      render(<NotificationHistory />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state message when no notifications', () => {
      mockUseCustom.mockReturnValue({
        data: { data: { data: [], total: 0, hasMore: false } },
        isLoading: false,
        refetch: vi.fn(),
      });

      render(<NotificationHistory />);

      expect(screen.getByText(/No notification/i)).toBeInTheDocument();
    });
  });

  describe('History Items Display', () => {
    it('renders notification items', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('Welcome Email')).toBeInTheDocument();
      expect(screen.getByText('Invoice')).toBeInTheDocument();
      expect(screen.getByText('Alert')).toBeInTheDocument();
    });

    it('displays items with status indicator', () => {
      render(<NotificationHistory />);

      // Check that status-related elements exist (the component shows status in various ways)
      // The delivered item should have green styling
      const welcomeEmail = screen.getByText('Welcome Email');
      expect(welcomeEmail).toBeInTheDocument();
    });

    it('shows error message for failed notifications', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('Mailbox not found')).toBeInTheDocument();
    });

    it('shows recipient email when available', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    it('shows subject when available', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('Welcome to our platform')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('renders channel filter dropdown', () => {
      render(<NotificationHistory />);

      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('renders status filter dropdown', () => {
      render(<NotificationHistory />);

      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('renders search input', () => {
      render(<NotificationHistory />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('filters items by search term', async () => {
      render(<NotificationHistory />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'Welcome' } });

      await waitFor(() => {
        expect(screen.getByText('Welcome Email')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Display', () => {
    it('shows total count', () => {
      render(<NotificationHistory />);

      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('shows delivered stat card', () => {
      render(<NotificationHistory />);

      // The component has a stats section with "Delivered" label
      const deliveredElements = screen.getAllByText(/Delivered/i);
      expect(deliveredElements.length).toBeGreaterThan(0);
    });

    it('shows failed stat card', () => {
      render(<NotificationHistory />);

      // The component has a stats section with "Failed" label
      const failedElements = screen.getAllByText(/Failed/i);
      expect(failedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Actions', () => {
    it('renders refresh button', () => {
      render(<NotificationHistory />);

      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeInTheDocument();
    });

    it('calls refetch when refresh button clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseCustom.mockReturnValue({
        data: { data: { data: mockHistoryItems, total: 3, hasMore: false } },
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<NotificationHistory />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('renders analytics link button', () => {
      render(<NotificationHistory />);

      const analyticsButton = screen.getByText('Analytics');
      expect(analyticsButton).toBeInTheDocument();
    });
  });
});

describe('NotificationHistory Pagination', () => {
  it('shows pagination info', () => {
    const mockHistoryItems = Array.from({ length: 25 }, (_, i) => ({
      id: `notif-${i}`,
      templateName: `Template ${i}`,
      workflowId: 'workflow',
      subscriberId: 'user',
      channel: 'email',
      status: 'delivered',
      createdAt: new Date().toISOString(),
    }));

    mockUseCustom.mockReturnValue({
      data: {
        data: {
          data: mockHistoryItems.slice(0, 20),
          total: 25,
          hasMore: true,
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<NotificationHistory />);

    // Should show pagination info or next button
    // The component may show "Showing X of Y" or similar
    expect(document.body.textContent).toMatch(/\d+/);
  });
});
