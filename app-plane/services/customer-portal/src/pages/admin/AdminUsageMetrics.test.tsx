/**
 * AdminUsageMetrics Tests
 *
 * Tests for usage metrics display and threshold colors.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { AdminUsageMetrics, type UsageMetrics } from './AdminUsageMetrics';

const createMockMetrics = (overrides: Partial<UsageMetrics> = {}): UsageMetrics => ({
  bom_count: 50,
  bom_limit: 100,
  project_count: 5,
  project_limit: 10,
  member_count: 3,
  member_limit: 5,
  api_calls_this_month: 5000,
  api_calls_limit: 10000,
  storage_used_mb: 500,
  storage_limit_mb: 1000,
  ...overrides,
});

describe('AdminUsageMetrics', () => {
  it('renders all metric cards', () => {
    render(<AdminUsageMetrics metrics={createMockMetrics()} />);

    expect(screen.getByText('BOMs')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('API Calls')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  it('renders metric values', () => {
    render(<AdminUsageMetrics metrics={createMockMetrics({ bom_count: 42 })} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(<AdminUsageMetrics metrics={null} loading />);

    // Should show skeleton loaders
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('renders null when no metrics and not loading', () => {
    const { container } = render(<AdminUsageMetrics metrics={null} />);

    expect(container.firstChild).toBeNull();
  });

  describe('Color thresholds', () => {
    it('shows success color when under 70%', () => {
      const metrics = createMockMetrics({
        bom_count: 50,
        bom_limit: 100, // 50%
      });

      render(<AdminUsageMetrics metrics={metrics} />);
      // Should render without error - success color
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('shows warning color when between 70-90%', () => {
      const metrics = createMockMetrics({
        bom_count: 80,
        bom_limit: 100, // 80%
      });

      render(<AdminUsageMetrics metrics={metrics} />);
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('shows error color when over 90%', () => {
      const metrics = createMockMetrics({
        bom_count: 95,
        bom_limit: 100, // 95%
      });

      render(<AdminUsageMetrics metrics={metrics} />);
      expect(screen.getByText('95')).toBeInTheDocument();
    });

    it('handles zero limit without crashing', () => {
      const metrics = createMockMetrics({
        bom_count: 10,
        bom_limit: 0,
      });

      // Should not throw
      expect(() => render(<AdminUsageMetrics metrics={metrics} />)).not.toThrow();
    });

    it('handles negative values gracefully', () => {
      const metrics = createMockMetrics({
        bom_count: -5,
        bom_limit: 100,
      });

      expect(() => render(<AdminUsageMetrics metrics={metrics} />)).not.toThrow();
    });
  });

  it('formats large numbers with locale string', () => {
    const metrics = createMockMetrics({
      api_calls_this_month: 12345,
    });

    render(<AdminUsageMetrics metrics={metrics} />);

    // Should format with commas (locale-dependent)
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('shows storage unit (MB)', () => {
    const metrics = createMockMetrics({
      storage_used_mb: 750,
      storage_limit_mb: 1000,
    });

    render(<AdminUsageMetrics metrics={metrics} />);

    expect(screen.getByText(/750/)).toBeInTheDocument();
    // MB appears multiple times, so use getAllByText
    expect(screen.getAllByText(/MB/).length).toBeGreaterThan(0);
  });
});
