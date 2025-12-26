# Portfolio Dashboard Hooks - Quick Reference

## Import

```tsx
import {
  usePortfolioMetrics,
  usePortfolioAlerts,
  useRecentActivity,
  usePortfolioExport,
} from '@/hooks';
```

## usePortfolioMetrics

Fetch aggregated portfolio metrics with auto-refresh.

```tsx
const {
  data,              // PortfolioMetrics | null
  isLoading,         // boolean
  error,             // Error | null
  refetch,           // () => Promise<void>
  lastUpdated,       // Date | null
} = usePortfolioMetrics({
  tenantId: string,                    // Required
  startDate?: Date,                     // Optional
  endDate?: Date,                       // Optional
  refreshInterval?: number,             // Default: 300000 (5 min)
  enabled?: boolean,                    // Default: true
  onSuccess?: (data) => void,           // Optional callback
  onError?: (error) => void,            // Optional callback
});
```

## usePortfolioAlerts

Fetch critical alerts with faster refresh rate.

```tsx
const {
  alerts,            // Alert[]
  isLoading,         // boolean
  error,             // Error | null
  refetch,           // () => Promise<void>
  criticalCount,     // number
  warningCount,      // number
} = usePortfolioAlerts({
  tenantId: string,                    // Required
  refreshInterval?: number,             // Default: 120000 (2 min)
  enabled?: boolean,                    // Default: true
  onAlertsUpdate?: (alerts) => void,    // Optional callback
});
```

## useRecentActivity

Fetch recent activity feed with infinite scroll.

```tsx
const {
  activity,          // ActivityItem[]
  isLoading,         // boolean
  isLoadingMore,     // boolean
  error,             // Error | null
  refetch,           // () => Promise<void>
  loadMore,          // () => Promise<void>
  hasMore,           // boolean
} = useRecentActivity({
  tenantId: string,                    // Required
  initialLimit?: number,                // Default: 10
  refreshInterval?: number,             // Default: 60000 (1 min)
  enabled?: boolean,                    // Default: true
  onActivityUpdate?: (activity) => void, // Optional callback
});
```

## usePortfolioExport

Export portfolio data as PDF or CSV.

```tsx
const {
  exportPDF,         // (tenantId, filename?) => Promise<void>
  exportCSV,         // (tenantId, filename?) => Promise<void>
  exportData,        // (tenantId, format, filename?) => Promise<void>
  isExporting,       // boolean
  error,             // Error | null
  exportingFormat,   // 'pdf' | 'csv' | null
} = usePortfolioExport();

// Usage
await exportPDF('org-123', 'my-report');
await exportCSV('org-123', 'data-export');
```

## Complete Example

```tsx
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  usePortfolioMetrics,
  usePortfolioAlerts,
  useRecentActivity,
  usePortfolioExport,
} from '@/hooks';

export function PortfolioDashboard() {
  const { organizationId } = useOrganization();

  // Metrics (5 min refresh)
  const { data: metrics, isLoading, refetch } = usePortfolioMetrics({
    tenantId: organizationId,
  });

  // Alerts (2 min refresh)
  const { alerts, criticalCount } = usePortfolioAlerts({
    tenantId: organizationId,
  });

  // Activity (1 min refresh)
  const { activity, loadMore, hasMore } = useRecentActivity({
    tenantId: organizationId,
    initialLimit: 10,
  });

  // Export
  const { exportPDF, isExporting } = usePortfolioExport();

  if (isLoading) return <Spinner />;
  if (!metrics) return null;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <button
        onClick={() => exportPDF(organizationId)}
        disabled={isExporting}
      >
        Export PDF
      </button>

      {criticalCount > 0 && <AlertBanner alerts={alerts} />}

      <MetricsGrid metrics={metrics} />
      <ActivityFeed
        items={activity}
        onLoadMore={loadMore}
        hasMore={hasMore}
      />
    </div>
  );
}
```

## Mock Data Mode

By default, hooks use mock data for development:

```bash
# .env
VITE_USE_MOCK_PORTFOLIO=true   # Uses mock data (default)
VITE_USE_MOCK_PORTFOLIO=false  # Uses real API
```

## Error Handling

All hooks gracefully handle errors and fall back to mock data:

```tsx
const { data, error } = usePortfolioMetrics({ tenantId });

if (error) {
  console.error('Portfolio error:', error);
  // Component still receives mock data in 'data'
}
```

## Performance Tips

1. **Disable when not visible**: Set `enabled: false` when component is hidden
2. **Adjust refresh rates**: Longer intervals for less critical data
3. **Use selective hooks**: Only import hooks you need
4. **Cleanup on unmount**: Hooks automatically clean up intervals

```tsx
// Conditional enable
const { data } = usePortfolioMetrics({
  tenantId,
  enabled: isTabActive && isVisible,
});

// Custom refresh rate
const { alerts } = usePortfolioAlerts({
  tenantId,
  refreshInterval: 600000, // 10 minutes
});
```
