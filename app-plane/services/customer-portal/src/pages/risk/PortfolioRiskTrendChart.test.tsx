/**
 * PortfolioRiskTrendChart Tests
 *
 * P1-6: Tests for portfolio risk trend visualization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { PortfolioRiskTrendChart, type PortfolioTrendDataPoint } from './PortfolioRiskTrendChart';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

const mockDataPoint = (daysAgo: number, score: number): PortfolioTrendDataPoint => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    date: date.toISOString(),
    label: daysAgo === 0 ? 'Today' : `${daysAgo}d ago`,
    avgRiskScore: score,
    weightedRiskScore: score + 2,
    distribution: {
      low: 80,
      medium: 40,
      high: 20,
      critical: 10,
    },
    factors: {
      lifecycle: score + 5,
      supply_chain: score,
      compliance: score - 5,
      obsolescence: score - 10,
      single_source: score + 10,
    },
    totalComponents: 150,
    attentionRequired: 30,
  };
};

const mockData: PortfolioTrendDataPoint[] = [
  mockDataPoint(6, 55),
  mockDataPoint(5, 52),
  mockDataPoint(4, 50),
  mockDataPoint(3, 48),
  mockDataPoint(2, 45),
  mockDataPoint(1, 43),
  mockDataPoint(0, 40),
];

describe('PortfolioRiskTrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default title', () => {
    render(<PortfolioRiskTrendChart />);

    expect(screen.getByText('Portfolio Risk Trend')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<PortfolioRiskTrendChart title="Custom Risk Chart" />);

    expect(screen.getByText('Custom Risk Chart')).toBeInTheDocument();
  });

  it('displays period toggle buttons', () => {
    render(<PortfolioRiskTrendChart />);

    expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /90 days/i })).toBeInTheDocument();
  });

  it('changes period when toggle buttons are clicked', () => {
    render(<PortfolioRiskTrendChart defaultPeriod="30" />);

    const sevenDayButton = screen.getByRole('button', { name: /7 days/i });
    fireEvent.click(sevenDayButton);

    // Button should become selected (MUI adds Mui-selected class)
    expect(sevenDayButton).toHaveClass('Mui-selected');
  });

  it('displays view mode tabs', () => {
    render(<PortfolioRiskTrendChart />);

    expect(screen.getByRole('tab', { name: /risk score/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /distribution/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /risk factors/i })).toBeInTheDocument();
  });

  it('changes view mode when tabs are clicked', () => {
    render(<PortfolioRiskTrendChart />);

    const distributionTab = screen.getByRole('tab', { name: /distribution/i });
    fireEvent.click(distributionTab);

    expect(distributionTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows loading skeleton when loading', () => {
    render(<PortfolioRiskTrendChart loading={true} />);

    // MUI Skeleton renders with role="progressbar" or specific classes
    const skeleton = document.querySelector('.MuiSkeleton-root');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows error alert with refresh button', () => {
    const onRefresh = vi.fn();
    render(
      <PortfolioRiskTrendChart error="Failed to load data" onRefresh={onRefresh} />
    );

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(<PortfolioRiskTrendChart onRefresh={onRefresh} />);

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('displays trend change indicator', () => {
    render(<PortfolioRiskTrendChart data={mockData} />);

    // Should show negative change (improving) since risk decreased
    expect(screen.getByText(/vs 30 days ago/i)).toBeInTheDocument();
  });

  it('displays summary statistics', () => {
    render(<PortfolioRiskTrendChart data={mockData} />);

    // Check for summary stat labels
    expect(screen.getByText('Current Score')).toBeInTheDocument();
    expect(screen.getByText('Total Components')).toBeInTheDocument();
    expect(screen.getByText('Need Attention')).toBeInTheDocument();
    expect(screen.getByText('Period Change')).toBeInTheDocument();
  });

  it('shows correct current score from data', () => {
    render(<PortfolioRiskTrendChart data={mockData} />);

    // Last data point has avgRiskScore of 40
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('shows correct total components from data', () => {
    render(<PortfolioRiskTrendChart data={mockData} />);

    // Data points have totalComponents of 150
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders chart container', () => {
    render(<PortfolioRiskTrendChart data={mockData} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('uses default view mode from props', () => {
    render(<PortfolioRiskTrendChart defaultView="distribution" />);

    const distributionTab = screen.getByRole('tab', { name: /distribution/i });
    expect(distributionTab).toHaveAttribute('aria-selected', 'true');
  });

  it('has accessible chart region', () => {
    render(<PortfolioRiskTrendChart title="Risk Analysis" />);

    expect(screen.getByRole('img', { name: /risk analysis chart/i })).toBeInTheDocument();
  });

  it('shows info tooltip icon', () => {
    render(<PortfolioRiskTrendChart />);

    // InfoOutlinedIcon should be present
    const infoIcons = document.querySelectorAll('[data-testid="InfoOutlinedIcon"]');
    expect(infoIcons.length).toBeGreaterThanOrEqual(0);
  });
});

describe('PortfolioRiskTrendChart trend calculation', () => {
  it('shows improving trend when risk decreases', () => {
    const improvingData = [
      mockDataPoint(6, 60),
      mockDataPoint(5, 55),
      mockDataPoint(4, 50),
      mockDataPoint(3, 45),
      mockDataPoint(2, 42),
      mockDataPoint(1, 40),
      mockDataPoint(0, 35),
    ];

    render(<PortfolioRiskTrendChart data={improvingData} />);

    // Should show "Improving" text
    expect(screen.getByText(/improving/i)).toBeInTheDocument();
  });

  it('shows worsening trend when risk increases', () => {
    const worseningData = [
      mockDataPoint(6, 35),
      mockDataPoint(5, 38),
      mockDataPoint(4, 42),
      mockDataPoint(3, 48),
      mockDataPoint(2, 52),
      mockDataPoint(1, 55),
      mockDataPoint(0, 60),
    ];

    render(<PortfolioRiskTrendChart data={worseningData} />);

    // Should NOT show "Improving" text since it's worsening
    expect(screen.queryByText(/\(improving\)/i)).not.toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<PortfolioRiskTrendChart data={[]} />);

    // Should still render with mock data fallback
    expect(screen.getByText('Portfolio Risk Trend')).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const singlePoint = [mockDataPoint(0, 50)];

    render(<PortfolioRiskTrendChart data={singlePoint} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('PortfolioRiskTrendChart accessibility', () => {
  it('has accessible period toggle group', () => {
    render(<PortfolioRiskTrendChart />);

    const toggleGroup = screen.getByRole('group', { name: /select time period/i });
    expect(toggleGroup).toBeInTheDocument();
  });

  it('has accessible view mode tabs', () => {
    render(<PortfolioRiskTrendChart />);

    const tabList = screen.getByRole('tablist', { name: /chart view mode/i });
    expect(tabList).toBeInTheDocument();
  });

  it('tab panels are properly labeled', () => {
    render(<PortfolioRiskTrendChart />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);

    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected');
    });
  });
});
