# Risk Dashboard Implementation

## Overview

Complete implementation of the Risk Dashboard for the CBP Customer Portal, replacing the placeholder with a fully functional portfolio-level risk analysis interface.

## Files Created

### Hooks (`src/hooks/`)

- **`useRisk.ts`** - TanStack Query hooks for all risk operations
  - `useRiskPortfolio()` - Portfolio-level risk summary
  - `useRiskStatistics()` - Aggregated risk statistics
  - `useHighRiskComponents()` - Top high-risk components
  - `useComponentRisk()` - Single component risk details
  - `useRiskHistory()` - Historical risk trends
  - `useBomsWithRisk()` - BOMs with risk summaries
  - `useBomRiskDetail()` - Detailed BOM risk analysis
  - `useRecalculateBomRisk()` - Trigger risk recalculation
  - `useRiskProfile()` - Organization risk profile/weights
  - `useUpdateRiskProfile()` - Update risk calculation weights
  - `useRiskPresets()` - Industry-specific risk presets
  - `useApplyRiskPreset()` - Apply industry preset
  - `useRiskDashboard()` - Combined dashboard data hook
  - `useRiskTrend()` - Risk trend analysis

### Components (`src/components/risk/`)

1. **`RiskSummaryCard.tsx`**
   - Portfolio risk summary with health grade (A-F)
   - Risk distribution breakdown
   - Trend indicator (improving/worsening/stable)
   - Action required alerts

2. **`RiskGauge.tsx`**
   - Circular gauge visualization
   - Health grade display
   - Configurable sizes (sm/md/lg)
   - Animated progress

3. **`TopRisksTable.tsx`**
   - Top 10 high-risk components table
   - Risk score and level badges
   - Primary risk factor identification
   - Component detail navigation

4. **`RiskDistributionChart.tsx`**
   - Donut chart with risk level distribution
   - Interactive tooltips
   - Summary statistics
   - Recharts integration

5. **`RiskCategoryBreakdown.tsx`**
   - Bar chart showing risk by category
   - Lifecycle, Supply Chain, Compliance, Obsolescence, Single Source
   - Color-coded bars based on severity
   - Detailed tooltips

6. **`RiskTrendChart.tsx`**
   - Line chart showing risk changes over time
   - Optional stacked area chart for risk factors
   - Trend calculation and display
   - Historical comparison

7. **`index.ts`**
   - Barrel export for all risk components

### Pages (`src/pages/risk/`)

- **`RiskDashboard.tsx`** - Main dashboard page (UPDATED)
  - Full portfolio risk overview
  - Health grade visualization
  - Risk distribution charts
  - Top high-risk components
  - Category breakdown
  - Export and configuration options

## Features Implemented

### Risk Calculation Logic

Aligned with the old CBP React Admin risk weights:
- **Lifecycle**: 30% - EOL/NRND/Obsolescence status
- **Supply Chain**: 25% - Lead time, availability
- **Compliance**: 20% - RoHS, REACH, conflict minerals
- **Obsolescence**: 15% - Predicted EOL timeline
- **Single Source**: 10% - Supplier diversity

### Health Grades

- **A**: < 20% average risk (Excellent)
- **B**: 20-40% average risk (Good)
- **C**: 40-60% average risk (Fair)
- **D**: 60-80% average risk (Poor)
- **F**: 80%+ average risk (Critical)

### Risk Levels

- **Low**: 0-30 score (Green)
- **Medium**: 31-60 score (Yellow)
- **High**: 61-85 score (Orange)
- **Critical**: 86-100 score (Red)

## API Integration

All components integrate with the CNS Service risk API:

- `GET /risk/portfolio` - Portfolio summary
- `GET /risk/stats` - Risk statistics
- `GET /risk/high-risk` - High-risk components
- `GET /risk/component/{id}` - Component risk details
- `GET /risk/history/{id}` - Historical trends
- `GET /risk/boms` - BOMs with risk
- `GET /risk/boms/{id}` - BOM risk detail
- `POST /risk/recalculate/bom/{id}` - Recalculate BOM risk
- `GET /risk/profile` - Risk profile/weights
- `PUT /risk/profile` - Update risk profile
- `GET /risk/profile/presets` - Industry presets
- `POST /risk/profile/apply-preset` - Apply preset

## Technology Stack

- **React 18+** - Component framework
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching and caching
- **Recharts** - Chart visualization
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Lucide Icons** - Icon library
- **date-fns** - Date formatting

## Usage

```tsx
import { RiskDashboardPage } from '@/pages/risk/RiskDashboard';

// In your router
<Route path="/risk" element={<RiskDashboardPage />} />
```

## Component Usage Examples

### Risk Summary Card

```tsx
import { RiskSummaryCard } from '@/components/risk';

<RiskSummaryCard
  totalComponents={1250}
  criticalCount={12}
  highCount={45}
  mediumCount={180}
  lowCount={1013}
  healthGrade="B"
  averageRiskScore={32.5}
  trend="improving"
/>
```

### Risk Gauge

```tsx
import { RiskGauge } from '@/components/risk';

<RiskGauge
  score={32.5}
  healthGrade="B"
  label="Portfolio Health"
  size="lg"
/>
```

### Top Risks Table

```tsx
import { TopRisksTable } from '@/components/risk';

<TopRisksTable
  risks={highRiskComponents}
  onViewComponent={(id) => navigate(`/components/${id}`)}
  limit={10}
/>
```

## Hooks Usage Examples

### Dashboard Data

```tsx
import { useRiskDashboard } from '@/hooks/useRisk';

function MyDashboard() {
  const { portfolio, statistics, highRisk, isLoading, isError } = useRiskDashboard();

  // All data loaded with proper caching and error handling
}
```

### Component Risk

```tsx
import { useComponentRisk } from '@/hooks/useRisk';

function ComponentDetail({ componentId }) {
  const { data: risk, isLoading } = useComponentRisk(componentId);

  return <div>Risk Score: {risk?.total_risk_score}</div>;
}
```

## Performance Optimizations

- **Query Caching**: 5-minute stale time for portfolio/statistics
- **Lazy Loading**: Charts only render when data is available
- **Skeleton Loading**: Smooth loading states
- **Debounced Refresh**: Prevents excessive API calls
- **Memoized Calculations**: Health grade and trend calculations

## Accessibility

- Proper ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly tooltips
- Color-blind safe color palette
- High contrast mode support

## Future Enhancements

1. **Export Functionality**: PDF/CSV export of risk reports
2. **Risk Profile Configuration**: UI for customizing risk weights
3. **Component Navigation**: Deep links to component detail pages
4. **Real-time Updates**: WebSocket integration for live risk changes
5. **Risk Alerts**: Push notifications for critical risk events
6. **Comparison View**: Compare risk across multiple BOMs
7. **Historical Dashboard**: Time-series analysis of portfolio risk
8. **Risk Heatmap**: Visual grid of components by risk category

## Testing

### Unit Tests (TODO)

```bash
npm run test -- src/components/risk
npm run test -- src/hooks/useRisk
```

### E2E Tests (TODO)

```bash
npm run test:e2e -- risk-dashboard.spec.ts
```

## Documentation

- See `risk.service.ts` for complete API interface documentation
- See component JSDoc comments for prop types and usage
- See hook documentation for query key structure

## Support

For issues or questions:
1. Check CNS service logs for API errors
2. Verify risk calculation configuration in database
3. Check browser console for client-side errors
4. Review TanStack Query DevTools for cache state
