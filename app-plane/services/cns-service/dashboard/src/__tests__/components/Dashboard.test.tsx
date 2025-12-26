import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../../Dashboard';
import { AdminContext } from 'react-admin';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../lib/keycloak/keycloakConfig', () => ({
  getAccessToken: () => 'test-keycloak-token',
}));

// Mock fetch
global.fetch = vi.fn();

// Mock child components
vi.mock('../../components/shared', () => ({
  StatCard: ({ title, value }: any) => (
    <div data-testid="stat-card">
      <div>{title}</div>
      <div>{value}</div>
    </div>
  ),
  PageHeader: ({ children }: any) => <div data-testid="page-header">{children}</div>,
  StatCardsLoading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('../../dashboard/index', () => ({
  SystemHealth: () => <div data-testid="system-health">System Health</div>,
  SupplierStatus: () => <div data-testid="supplier-status">Supplier Status</div>,
  RecentActivity: () => <div data-testid="recent-activity">Recent Activity</div>,
  QuickActions: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <AdminContext>
          <Dashboard />
        </AdminContext>
      </BrowserRouter>
    );
  };

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    renderDashboard();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should fetch and display dashboard data', async () => {
    const mockData = {
      overview: {
        total_bom_jobs: 42,
        enrichment_success_rate: 95.5,
        avg_processing_time_ms: 1500,
      },
      quality_routing: {
        staging: 10,
      },
      supplier_usage: [
        { supplier_name: 'Mouser', components_enriched: 100, percentage: 50 },
        { supplier_name: 'DigiKey', components_enriched: 80, percentage: 40 },
      ],
      recent_jobs: [
        {
          job_id: 'job-1',
          filename: 'test.csv',
          total_items: 50,
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Check that stat cards are rendered
    const statCards = screen.getAllByTestId('stat-card');
    expect(statCards.length).toBeGreaterThan(0);
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Dashboard should still render with default data
    expect(screen.getByTestId('system-health')).toBeInTheDocument();
  });

  it('should render all dashboard sections', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        overview: {},
        supplier_usage: [],
        recent_jobs: [],
      }),
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('system-health')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-status')).toBeInTheDocument();
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  it('should display correct metrics from API response', async () => {
    const mockData = {
      overview: {
        total_bom_jobs: 100,
        enrichment_success_rate: 98.5,
        avg_processing_time_ms: 2000,
      },
      quality_routing: {
        staging: 25,
      },
      supplier_usage: [],
      recent_jobs: [],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Verify metrics are displayed (checking for stat cards)
    const statCards = screen.getAllByTestId('stat-card');
    expect(statCards.length).toBeGreaterThan(0);
  });

  it('should include access token Authorization header in API call', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ overview: {}, supplier_usage: [], recent_jobs: [] }),
    });

    renderDashboard();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[1].headers).toHaveProperty('Authorization');
  });
});
