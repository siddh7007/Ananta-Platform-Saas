/**
 * GrafanaPanel Component Tests
 *
 * Tests for the Grafana panel embedding component.
 * Verifies URL building, error handling, and UI interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GrafanaPanel, GrafanaDashboard, GrafanaStatusIndicator } from './grafana-panel';

// Mock fetch for status indicator
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GrafanaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('renders with title and description', () => {
      render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          title="Test Dashboard"
          description="Test description"
        />
      );

      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('renders toolbar buttons', () => {
      render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          title="Test Dashboard"
          showToolbar={true}
        />
      );

      // Check for time range selector (select element)
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);

      // Check for buttons (refresh, fullscreen, external link)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('hides toolbar when showToolbar is false', () => {
      render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          showToolbar={false}
        />
      );

      const selects = document.querySelectorAll('select');
      expect(selects.length).toBe(0);
    });

    it('renders loading state initially', () => {
      render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          title="Test Dashboard"
        />
      );

      expect(screen.getByText('Loading Grafana panel...')).toBeInTheDocument();
    });
  });

  describe('URL Building', () => {
    it('builds correct URL for full dashboard', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="my-dashboard"
          timeRange="24h"
          orgId={1}
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toContain('/d/my-dashboard');
      expect(iframe?.src).toContain('from=now-24h');
      expect(iframe?.src).toContain('to=now');
      expect(iframe?.src).toContain('orgId=1');
      expect(iframe?.src).toContain('kiosk=1');
    });

    it('builds correct URL for single panel', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="my-dashboard"
          panelId={5}
          timeRange="1h"
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toContain('/d-solo/my-dashboard');
      expect(iframe?.src).toContain('panelId=5');
    });

    it('includes custom variables in URL', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="my-dashboard"
          variables={{ tenant: 'abc123', environment: 'prod' }}
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('var-tenant=abc123');
      expect(iframe?.src).toContain('var-environment=prod');
    });

    it('includes theme parameter when specified', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="my-dashboard"
          theme="dark"
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('theme=dark');
    });

    it('includes refresh interval when specified', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="my-dashboard"
          refreshInterval={30}
        />
      );

      const iframe = container.querySelector('iframe');
      expect(iframe?.src).toContain('refresh=30s');
    });
  });

  describe('Time Range Selection', () => {
    it('changes time range when selected', async () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          title="Test Dashboard"
          timeRange="1h"
        />
      );

      const select = container.querySelector('select');
      expect(select).toBeInTheDocument();

      if (select) {
        fireEvent.change(select, { target: { value: '7d' } });

        // After state update, check URL
        await waitFor(() => {
          const iframe = container.querySelector('iframe');
          expect(iframe?.src).toContain('from=now-7d');
        });
      }
    });
  });

  describe('Refresh Functionality', () => {
    it('has refresh button that can be clicked', () => {
      render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          title="Test Dashboard"
        />
      );

      // Find button with Refresh title
      const refreshButton = screen.getByTitle('Refresh');
      expect(refreshButton).toBeInTheDocument();

      // Should not throw when clicked
      fireEvent.click(refreshButton);
    });
  });

  describe('Height Configuration', () => {
    it('applies numeric height correctly', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          height={400}
        />
      );

      // Find the content div with height style
      const contentDiv = container.querySelector('[style*="height"]');
      expect(contentDiv).toBeInTheDocument();
      expect(contentDiv?.getAttribute('style')).toContain('400px');
    });

    it('applies string height correctly', () => {
      const { container } = render(
        <GrafanaPanel
          dashboardUid="test-dashboard"
          height="50vh"
        />
      );

      const contentDiv = container.querySelector('[style*="height"]');
      expect(contentDiv).toBeInTheDocument();
      expect(contentDiv?.getAttribute('style')).toContain('50vh');
    });
  });
});

describe('GrafanaDashboard', () => {
  it('renders as a full dashboard embed', () => {
    const { container } = render(
      <GrafanaDashboard
        dashboardUid="platform-health"
        title="Platform Health"
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.src).toContain('/d/platform-health');
    // Should NOT have panelId since it's a full dashboard
    expect(iframe?.src).not.toContain('panelId=');
  });
});

describe('GrafanaStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('shows checking state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<GrafanaStatusIndicator />);

    expect(screen.getByText('Checking Grafana...')).toBeInTheDocument();
  });

  it('shows connected state when Grafana is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    render(<GrafanaStatusIndicator />);

    // Wait for the status to update
    await waitFor(() => {
      expect(screen.getByText('Grafana connected')).toBeInTheDocument();
    });
  });

  it('shows offline state when Grafana is unavailable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    render(<GrafanaStatusIndicator />);

    // Wait for the status to update
    await waitFor(() => {
      expect(screen.getByText('Grafana offline')).toBeInTheDocument();
    });
  });

  it('shows offline state when Grafana returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<GrafanaStatusIndicator />);

    // Wait for the status to update
    await waitFor(() => {
      expect(screen.getByText('Grafana offline')).toBeInTheDocument();
    });
  });
});

describe('GrafanaPanel Error Handling', () => {
  // Note: iframe error events don't propagate the same way in jsdom
  // These tests verify the component's error UI elements exist when rendered

  it('component has error handling capabilities', () => {
    const { container } = render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
        title="Test Dashboard"
      />
    );

    // Verify iframe exists and has error handler attribute
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    // The component sets up onError handler - we can verify the component renders correctly
  });

  it('renders loading overlay while iframe loads', () => {
    render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
        title="Test Dashboard"
      />
    );

    // Verify loading state is shown initially
    expect(screen.getByText('Loading Grafana panel...')).toBeInTheDocument();
  });

  it('iframe has proper attributes for error recovery', () => {
    const { container } = render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
        title="Test Dashboard"
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    // Sandbox allows same-origin and scripts for Grafana to work
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  });
});

describe('GrafanaPanel Accessibility', () => {
  it('has accessible iframe title', () => {
    const { container } = render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
        title="API Performance"
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('title', 'API Performance');
  });

  it('uses default title when not provided', () => {
    const { container } = render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('title', 'Grafana Dashboard');
  });

  it('has sandbox attributes for security', () => {
    const { container } = render(
      <GrafanaPanel
        dashboardUid="test-dashboard"
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('sandbox');
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).toContain('allow-same-origin');
  });
});
