/**
 * MetricCard Tests
 *
 * Tests for the MetricCard component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Total BOMs" value={42} />);

    expect(screen.getByText('Total BOMs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value correctly', () => {
    render(<MetricCard title="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<MetricCard title="Count" value={100} subtitle="Last 30 days" />);

    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading', () => {
    render(<MetricCard title="Count" value={0} loading />);

    // Should not show the value when loading
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;
    render(<MetricCard title="Test" value={1} icon={<TestIcon />} />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<MetricCard title="Clickable" value={5} onClick={handleClick} />);

    fireEvent.click(screen.getByText('5'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders trend indicator when trend is provided', () => {
    render(
      <MetricCard
        title="Growth"
        value={25}
        trend="up"
        trendValue="+5%"
        trendPositive
      />
    );

    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('applies compact styling when compact is true', () => {
    const { container } = render(
      <MetricCard title="Compact" value={10} compact />
    );

    // Should render without errors in compact mode
    expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
  });

  it('applies color variants correctly', () => {
    const { rerender } = render(
      <MetricCard title="Test" value={1} color="success" />
    );
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(<MetricCard title="Test" value={1} color="error" />);
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(<MetricCard title="Test" value={1} color="warning" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
