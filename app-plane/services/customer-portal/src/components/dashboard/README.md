# Portfolio Dashboard Visual System

Complete UI component library for the Customer Business Portal (CBP) Portfolio Dashboard (P0-2).

## Overview

The Portfolio Dashboard provides a 5-minute daily check-in view for Owner-role users, optimized for tablet (iPad) with touch-friendly interactions. Built with Refine.dev, Radix UI, Shadcn, and Tailwind CSS.

## Directory Structure

```
src/
├── components/dashboard/
│   ├── DashboardGrid.tsx           # Responsive grid layout
│   ├── widgets/                    # Dashboard widget components
│   │   ├── MetricCard.tsx          # KPI metric display
│   │   ├── RiskDistributionChart.tsx # Donut chart for risk levels
│   │   ├── ActivityChart.tsx       # 7-day enrichment area chart
│   │   ├── AlertsList.tsx          # Critical alerts list
│   │   ├── ActivityFeed.tsx        # Team activity timeline
│   │   ├── ExportButton.tsx        # PDF/CSV export dropdown
│   │   └── index.ts
│   ├── skeletons/                  # Loading skeleton states
│   │   ├── MetricCardSkeleton.tsx
│   │   ├── ChartSkeleton.tsx
│   │   ├── AlertsListSkeleton.tsx
│   │   ├── ActivityFeedSkeleton.tsx
│   │   └── index.ts
│   └── index.ts
├── pages/dashboard/
│   └── PortfolioDashboard.tsx      # Main dashboard page
├── types/
│   └── dashboard.ts                # TypeScript type definitions
└── styles/
    └── dashboard.css               # Dashboard-specific styles
```

## Components

### Layout Components

#### DashboardGrid
Responsive CSS Grid container with automatic column adaptation:
- Mobile (< 768px): 1 column
- Tablet portrait (768px+): 2 columns
- Tablet landscape / Desktop (1024px+): 4 columns

```tsx
import { DashboardGrid, GridArea } from '@/components/dashboard';

<DashboardGrid>
  <MetricCard {...} />

  <GridArea colSpanTablet={1} colSpanDesktop={2}>
    <RiskDistributionChart {...} />
  </GridArea>
</DashboardGrid>
```

### Widget Components

#### MetricCard
Large number display with trend indicator and comparison text.

**Props:**
- `value: number | string` - Main metric value
- `label: string` - Metric label
- `trend?: TrendData` - Trend indicator (up/down/flat)
- `comparison?: string` - Comparison text
- `formatValue?: (value) => string` - Custom formatter

**Features:**
- Responsive font sizing (4xl → 5xl → 6xl)
- Color-coded trend arrows (green up, red down, gray flat)
- Accessible ARIA labels
- Touch-friendly (48px minimum targets)

```tsx
<MetricCard
  value={47}
  label="Total BOMs"
  trend={{ value: 3, direction: 'up', period: 'this week' }}
  comparison="across all projects"
/>
```

#### RiskDistributionChart
Interactive donut chart showing BOM risk distribution with clickable legend.

**Props:**
- `data: RiskDistribution` - Risk counts (low, medium, high, critical)
- `title?: string` - Chart title
- `showCenterStat?: boolean` - Display center statistic

**Features:**
- Risk color palette: Low=#4caf50, Medium=#ff9800, High=#f44336, Critical=#9c27b0
- Click legend to filter chart
- Center stat shows total or selected category
- Touch-optimized tooltips
- WCAG AA compliant

```tsx
<RiskDistributionChart
  data={{ low: 22, medium: 13, high: 9, critical: 3 }}
  showCenterStat={true}
/>
```

#### ActivityChart
7-day enrichment activity area chart with dual Y-axis (count + cost).

**Props:**
- `data: DailyActivity[]` - 7 days of activity data
- `title?: string` - Chart title

**Features:**
- Dual Y-axis: Count (left, blue) and Cost (right, green)
- Gradient fill under curves
- Touch-friendly data points (6px active radius)
- Responsive container (300px → 400px height)

```tsx
<ActivityChart
  data={[
    { date: '2025-12-08', count: 12, cost: 245 },
    // ... 7 days
  ]}
/>
```

#### AlertsList
Card-based critical alerts with inline action buttons.

**Props:**
- `alerts: Alert[]` - Array of alert objects
- `maxAlerts?: number` - Maximum to display (default: 5)
- `onActionClick?: (alert) => void` - Action button handler
- `onDismiss?: (id) => void` - Dismiss handler

**Features:**
- Severity-based styling (warning/error)
- Expandable long messages
- Swipeable on tablet (future)
- Empty state illustration
- Touch-friendly action buttons (48px)

```tsx
<AlertsList
  alerts={criticalAlerts}
  maxAlerts={5}
  onActionClick={(alert) => navigate(alert.actionUrl)}
/>
```

#### ActivityFeed
Timeline of recent team activity with user avatars and action badges.

**Props:**
- `activities: ActivityItem[]` - Activity timeline
- `maxActivities?: number` - Initial display count
- `enableLoadMore?: boolean` - Enable load more button
- `onLoadMore?: () => void` - Load more handler

**Features:**
- User avatars (image or initials)
- Action badges (upload, compare, enrich, approve, export)
- Relative timestamps (e.g., "2h ago")
- Infinite scroll support
- Compact design for sidebar

```tsx
<ActivityFeed
  activities={recentActivity}
  maxActivities={10}
  enableLoadMore={true}
/>
```

#### ExportButton
Dropdown button for exporting dashboard data in PDF or CSV.

**Props:**
- `onExport: (options) => Promise<void>` - Export handler
- `isLoading?: boolean` - Loading state
- `formats?: ExportFormat[]` - Available formats (default: ['pdf', 'csv'])
- `includeCharts?: boolean` - Include charts in export

**Features:**
- Dropdown menu with format options
- Loading state during export
- Success toast notification
- Keyboard navigation (Escape to close)
- Click outside to close

```tsx
<ExportButton
  onExport={async (options) => {
    await exportDashboard(metrics, options);
  }}
  isLoading={isExporting}
/>
```

### Skeleton Components

All widgets have corresponding skeleton loaders:
- `MetricCardSkeleton`
- `ChartSkeleton` (variants: donut, area, bar)
- `AlertsListSkeleton`
- `ActivityFeedSkeleton`

**Features:**
- Shimmer animation
- Matching layout structure
- ARIA busy state
- Screen reader announcements

```tsx
{isLoading ? (
  <MetricCardSkeleton />
) : (
  <MetricCard {...} />
)}
```

## Main Dashboard Page

### PortfolioDashboard
Complete dashboard page with auto-refresh, role-gating, and error handling.

**Props:**
- `tenantId?: string` - Tenant context
- `refreshInterval?: number` - Auto-refresh interval (default: 5 min)
- `fetchMetrics?: () => Promise<PortfolioMetrics>` - Custom data provider

**Features:**
- Auto-refresh every 5 minutes
- Manual refresh button
- Export to PDF/CSV
- Loading skeletons
- Error state with retry
- Role-gated (owner, super_admin)
- Responsive layout

```tsx
import { PortfolioDashboard } from '@/pages/dashboard';

<PortfolioDashboard
  tenantId={currentTenant.id}
  refreshInterval={300000}
/>
```

## Design System Integration

### Color Palette

```css
/* Risk Colors */
--risk-low: #4caf50
--risk-medium: #ff9800
--risk-high: #f44336
--risk-critical: #9c27b0

/* Grade Colors */
--grade-a: #4caf50
--grade-b: #8bc34a
--grade-c: #ffc107
--grade-d: #ff9800
--grade-f: #f44336

/* Chart Colors */
--chart-primary: #3b82f6 (blue-500)
--chart-secondary: #10b981 (green-500)
```

### Responsive Breakpoints

```css
/* Mobile first */
sm: 640px   /* Small devices */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape / Desktop */
xl: 1280px  /* Large desktop */
```

### Touch Targets

All interactive elements meet WCAG 2.1 AA standards:
- Minimum touch target: 48px × 48px
- Chart legend items: 48px height with padding
- Action buttons: 48px minimum height
- Alert cards: 72px minimum height

### Typography

```css
.metric-value: text-4xl md:text-5xl lg:text-6xl font-bold
.metric-label: text-sm font-medium uppercase tracking-wide
.dashboard-widget-title: text-lg font-semibold
.activity-text: text-sm
.activity-timestamp: text-xs
```

## Accessibility

### WCAG 2.1 AA Compliance

- Minimum contrast ratio: 4.5:1 for text, 3:1 for UI components
- All interactive elements keyboard navigable
- Focus indicators visible (2px blue ring)
- ARIA labels for screen readers
- Live regions for dynamic updates
- Reduced motion support (`prefers-reduced-motion`)
- High contrast mode support (`prefers-contrast: high`)

### Screen Reader Support

```tsx
// Live regions for dynamic content
<div aria-live="polite" aria-label="Total BOMs: 47">
  {value}
</div>

// Chart descriptions
<div role="img" aria-label="Risk distribution: 22 low risk, 13 medium risk...">
  <PieChart />
</div>

// Status announcements
<div role="status">Loading dashboard data...</div>
```

### Keyboard Navigation

- Tab: Navigate between interactive elements
- Enter/Space: Activate buttons
- Escape: Close dropdowns/modals
- Arrow keys: Navigate within dropdowns (future)

## Print Styles

Dashboard optimized for PDF export:

```css
@media print {
  /* Remove shadows, adjust colors */
  .dashboard-widget { shadow: none; border: 1px solid gray; }

  /* Hide interactive elements */
  button, .export-button { display: none; }

  /* Prevent page breaks inside widgets */
  .dashboard-widget { break-inside: avoid; }

  /* Chart visibility */
  .recharts-surface { border: 1px solid gray; }
}
```

## Integration with P0-3 Tablet Foundation

The dashboard leverages existing tablet hooks:

```tsx
import { useOrientation, useTouchDevice, useSafeAreaInsets } from '@/hooks/tablet';

// Orientation detection
const { isPortrait, isLandscape } = useOrientation();

// Touch device detection
const isTouch = useTouchDevice();

// Safe area insets (for notch devices)
const { top, bottom, left, right } = useSafeAreaInsets();
```

## Performance Optimization

### Code Splitting

```tsx
// Lazy load dashboard page
const PortfolioDashboard = lazy(() => import('@/pages/dashboard/PortfolioDashboard'));

// Usage with Suspense
<Suspense fallback={<DashboardSkeleton />}>
  <PortfolioDashboard />
</Suspense>
```

### Chart Optimization

- Recharts lazy loaded
- Animation duration: 600ms (balance between UX and performance)
- Responsive containers prevent unnecessary re-renders
- Data point limit: 7 days (manageable dataset)

### Memoization

```tsx
// Expensive computations memoized
const chartData = useMemo(() =>
  transformActivityData(rawData),
  [rawData]
);
```

## Testing Recommendations

### Unit Tests

```tsx
describe('MetricCard', () => {
  test('displays value and label', () => {
    render(<MetricCard value={47} label="Total BOMs" />);
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Total BOMs')).toBeInTheDocument();
  });

  test('shows trend indicator when provided', () => {
    const trend = { value: 3, direction: 'up', period: 'this week' };
    render(<MetricCard value={47} label="Total BOMs" trend={trend} />);
    expect(screen.getByLabelText(/up trend/i)).toBeInTheDocument();
  });
});
```

### Integration Tests

```tsx
describe('PortfolioDashboard', () => {
  test('loads and displays metrics', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockMetrics);
    render(<PortfolioDashboard fetchMetrics={mockFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Total BOMs')).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument();
    });
  });

  test('handles refresh button click', async () => {
    render(<PortfolioDashboard />);
    const refreshButton = screen.getByLabelText('Refresh dashboard');

    await userEvent.click(refreshButton);
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });
});
```

### Accessibility Tests

```tsx
import { axe } from 'jest-axe';

test('dashboard has no accessibility violations', async () => {
  const { container } = render(<PortfolioDashboard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Future Enhancements

### Phase 2 Features
- Drag-to-reorder widgets (react-beautiful-dnd)
- Customizable dashboard layouts per user
- Date range filters
- Real-time updates via WebSocket
- Dark mode support
- Widget customization (show/hide)
- Drill-down to detailed views

### Mobile Optimizations
- Pull-to-refresh gesture
- Swipe-to-dismiss alerts
- Bottom sheet for export options
- Haptic feedback on interactions

### Advanced Charts
- Sparklines in metric cards
- Comparison mode (vs last period)
- Custom date ranges
- Chart export as images

## Migration Guide

### From React Admin to Refine

```tsx
// Old (React Admin)
import { Card, CardContent } from '@mui/material';

// New (Refine + Shadcn)
import { Card, CardContent } from '@/components/ui/card';

// Dashboard layout
// Old: <Grid container spacing={2}>
// New: <DashboardGrid>
```

## Support

For issues or questions:
1. Check component JSDoc comments
2. Review type definitions in `src/types/dashboard.ts`
3. Inspect CSS classes in `src/styles/dashboard.css`
4. Test with accessibility tools (axe DevTools)

## License

Internal use only - Ananta Platform SaaS
