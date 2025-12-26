/**
 * NotificationAnalytics Component Tests
 *
 * Tests for the notification analytics dashboard component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationAnalytics } from './analytics';

// The component calls useCustom twice:
// 1. For analytics data (returns an object)
// 2. For failures data (returns an array)
// We need to track which URL is being called to return appropriate data
const mockUseCustom = vi.fn();

vi.mock('@refinedev/core', () => ({
  useCustom: (config: { url: string }) => mockUseCustom(config),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Default mock data
const defaultAnalyticsData = {
  total: 1000,
  sent: 800,
  delivered: 750,
  failed: 50,
  pending: 150,
  bounced: 20,
  opened: 400,
  clicked: 200,
  deliveryRate: 93.75,
  byChannel: {
    email: 600,
    sms: 200,
    push: 100,
    in_app: 100,
  },
  byWorkflow: {
    'welcome': 300,
    'invoice': 200,
    'alert': 100,
  },
};

// Setup mock implementation that returns data based on the URL
function setupDefaultMock(analyticsData: any = defaultAnalyticsData, isLoading = false, refetchFn?: () => void) {
  mockUseCustom.mockImplementation((config: { url: string }) => {
    if (config?.url?.includes('/failures')) {
      return {
        data: { data: [] }, // Failures are an empty array by default
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    // Analytics endpoint
    return {
      data: { data: analyticsData },
      isLoading,
      refetch: refetchFn || vi.fn(),
    };
  });
}

describe('NotificationAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMock();
  });

  describe('Loading State', () => {
    it('shows loading when data is loading', () => {
      setupDefaultMock(null, true);

      render(<NotificationAnalytics />);

      // The component shows a loading state when isLoading is true
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('With Default/Empty Data', () => {
    it('renders with empty analytics data', () => {
      // When data is null, component uses defaults (which includes deliveryRate: 0)
      setupDefaultMock(null, false);

      render(<NotificationAnalytics />);

      // Should still render the page title
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });
  });

  describe('With Data', () => {
    beforeEach(() => {
      setupDefaultMock();
    });

    it('renders page title', () => {
      render(<NotificationAnalytics />);

      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    it('displays stats cards', () => {
      render(<NotificationAnalytics />);

      // Should show the Total Sent stat card label
      expect(screen.getByText('Total Sent')).toBeInTheDocument();
    });

    it('displays delivery rate section', () => {
      render(<NotificationAnalytics />);

      // Look for delivery rate header
      expect(screen.getByText('Delivery Rate')).toBeInTheDocument();
    });

    it('displays channel distribution section', () => {
      render(<NotificationAnalytics />);

      // Channel distribution section header
      expect(screen.getByText('By Channel')).toBeInTheDocument();
    });

    it('displays workflow section', () => {
      render(<NotificationAnalytics />);

      // Workflow section header
      expect(screen.getByText('Top Workflows')).toBeInTheDocument();
    });
  });

  describe('Date Range Selection', () => {
    beforeEach(() => {
      setupDefaultMock();
    });

    it('renders date range selector', () => {
      render(<NotificationAnalytics />);

      // Find the select element
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('can change date range', () => {
      render(<NotificationAnalytics />);

      const select = document.querySelector('select');
      expect(select).toBeInTheDocument();

      if (select) {
        fireEvent.change(select, { target: { value: '7d' } });
        expect(select).toHaveValue('7d');
      }
    });
  });

  describe('Refresh Functionality', () => {
    it('calls refetch when refresh button is clicked', async () => {
      const mockRefetch = vi.fn();
      setupDefaultMock(defaultAnalyticsData, false, mockRefetch);

      render(<NotificationAnalytics />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });
});

describe('NotificationAnalytics Stats Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly displays numbers', () => {
    setupDefaultMock({
      total: 12500,
      sent: 12000,
      delivered: 11800,
      failed: 200,
      pending: 100,
      bounced: 50,
      opened: 8000,
      clicked: 4000,
      deliveryRate: 98.3,
      byChannel: { email: 5000 },
      byWorkflow: { main: 3000 },
    });

    render(<NotificationAnalytics />);

    // Numbers are displayed directly without formatting
    // Use getAllByText since the same number may appear multiple times
    const totalElements = screen.getAllByText('12500');
    expect(totalElements.length).toBeGreaterThan(0);
  });

  it('handles zero values gracefully', () => {
    setupDefaultMock({
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      deliveryRate: 0,
      byChannel: {},
      byWorkflow: {},
    });

    render(<NotificationAnalytics />);

    // Should render without errors - check page title is still present
    expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
  });
});
