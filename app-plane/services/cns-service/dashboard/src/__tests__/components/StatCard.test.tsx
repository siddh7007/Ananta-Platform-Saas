import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard } from '../../components/shared/StatCard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

describe('StatCard', () => {
  it('should render title and value', () => {
    render(<StatCard title="Total Jobs" value={42} />);

    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(<StatCard title="Success Rate" value="95%" subtitle="Last 30 days" />);

    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <StatCard
        title="Jobs Today"
        value={10}
        icon={<TrendingUpIcon data-testid="trend-icon" />}
      />
    );

    expect(screen.getByTestId('trend-icon')).toBeInTheDocument();
  });

  it('should display loading skeleton when loading', () => {
    render(<StatCard title="Loading" value={0} loading={true} />);

    // Should show skeletons, not actual content
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    // MUI Skeleton renders as a span with animation class
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render trend indicator when trend is provided', () => {
    render(
      <StatCard
        title="Metrics"
        value={100}
        trend="up"
        trendValue="+12%"
        trendPositive={true}
      />
    );

    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('should apply correct trend color for positive trend', () => {
    render(
      <StatCard
        title="Metrics"
        value={100}
        trend="up"
        trendValue="+12%"
        trendPositive={true}
      />
    );

    const trendBox = screen.getByText('+12%').closest('div');
    expect(trendBox).toHaveStyle({ color: 'rgb(34, 197, 94)' }); // Green color
  });

  it('should apply correct trend color for negative trend', () => {
    render(
      <StatCard
        title="Metrics"
        value={100}
        trend="down"
        trendValue="-5%"
        trendPositive={false}
      />
    );

    const trendBox = screen.getByText('-5%').closest('div');
    expect(trendBox).toHaveStyle({ color: 'rgb(239, 68, 68)' }); // Red color
  });

  it('should handle click events when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<StatCard title="Clickable" value={42} onClick={handleClick} />);

    const card = screen.getByText('Clickable').closest('.MuiCard-root');
    if (card) {
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('should not be clickable when onClick is not provided', () => {
    render(<StatCard title="Not Clickable" value={42} />);

    const card = screen.getByText('Not Clickable').closest('.MuiCard-root');
    expect(card).not.toHaveStyle({ cursor: 'pointer' });
  });

  it('should render in compact mode', () => {
    render(<StatCard title="Compact" value={42} compact={true} />);

    expect(screen.getByText('42')).toBeInTheDocument();
    // Compact mode uses smaller typography variant
    const valueElement = screen.getByText('42');
    expect(valueElement.className).toContain('MuiTypography-h5');
  });

  it('should render in normal mode by default', () => {
    render(<StatCard title="Normal" value={42} />);

    const valueElement = screen.getByText('42');
    expect(valueElement.className).toContain('MuiTypography-h4');
  });

  it('should accept custom color', () => {
    render(
      <StatCard
        title="Custom Color"
        value={42}
        color="#ff0000"
        icon={<TrendingUpIcon />}
      />
    );

    // Icon container should have custom color
    const iconContainer = screen.getByText('42').parentElement?.querySelector('[style*="color"]');
    expect(iconContainer).toBeTruthy();
  });

  it('should handle flat trend', () => {
    render(
      <StatCard
        title="Metrics"
        value={100}
        trend="flat"
        trendValue="No change"
      />
    );

    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('should handle string values', () => {
    render(<StatCard title="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should handle numeric values', () => {
    render(<StatCard title="Count" value={12345} />);

    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('should handle zero value', () => {
    render(<StatCard title="Empty" value={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
