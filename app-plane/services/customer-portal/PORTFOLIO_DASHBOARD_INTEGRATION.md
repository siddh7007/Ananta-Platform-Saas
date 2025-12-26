# Portfolio Dashboard Integration Guide

Complete guide for integrating the Portfolio Dashboard (P0-2) into the Customer Business Portal.

## Quick Start

### 1. Import CSS Styles

Add to your main app entry point (e.g., `src/App.tsx` or `src/main.tsx`):

```tsx
import './styles/dashboard.css';
```

### 2. Add Route

In your Refine.dev router configuration:

```tsx
import { PortfolioDashboard } from './pages/dashboard';

const routes = [
  {
    path: '/dashboard',
    element: <PortfolioDashboard />,
    meta: {
      label: 'Dashboard',
      icon: <LayoutDashboard />,
    },
  },
  // ... other routes
];
```

### 3. Add Navigation Item

Update your navigation manifest (if using config-driven nav):

```tsx
// src/config/navigation.ts
{
  key: 'dashboard',
  label: 'Dashboard',
  icon: 'LayoutDashboard',
  path: '/dashboard',
  minRole: 'owner', // Owner and super_admin only
},
```

### 4. Role-Based Access Control

Protect the route in your auth provider:

```tsx
// src/providers/access-control-provider.ts
import { hasMinimumRole } from '@/lib/role-parser';

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const userRole = getUserRole(); // From auth context

    if (resource === 'dashboard') {
      // Only owner and super_admin can access
      return {
        can: hasMinimumRole(userRole, 'owner'),
      };
    }

    // ... other resources
  },
};
```

## Complete Integration Example

### App.tsx

```tsx
import React from 'react';
import { Refine } from '@refinedev/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PortfolioDashboard } from './pages/dashboard';
import { authProvider } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { accessControlProvider } from './providers/access-control-provider';
import './styles/dashboard.css';

function App() {
  return (
    <BrowserRouter>
      <Refine
        authProvider={authProvider}
        dataProvider={dataProvider}
        accessControlProvider={accessControlProvider}
        resources={[
          {
            name: 'dashboard',
            list: '/dashboard',
            meta: {
              label: 'Dashboard',
              canDelete: false,
            },
          },
          // ... other resources
        ]}
      >
        <Routes>
          <Route path="/dashboard" element={<PortfolioDashboard />} />
          {/* ... other routes */}
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}

export default App;
```

## API Integration

### 1. Create Dashboard API Service

```tsx
// src/services/dashboard.service.ts
import type { PortfolioMetrics } from '@/types/dashboard';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class DashboardService {
  /**
   * Fetch portfolio metrics for dashboard
   */
  static async getPortfolioMetrics(
    tenantId: string
  ): Promise<PortfolioMetrics> {
    const response = await fetch(
      `${API_BASE}/dashboard/portfolio?tenantId=${tenantId}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Export dashboard data
   */
  static async exportDashboard(
    tenantId: string,
    format: 'pdf' | 'csv',
    includeCharts: boolean = true
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE}/dashboard/export`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          format,
          includeCharts,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }
}
```

### 2. Use Dashboard with API Service

```tsx
// src/pages/dashboard/PortfolioDashboardContainer.tsx
import React from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { DashboardService } from '@/services/dashboard.service';
import { useTenant } from '@/hooks/useTenant';
import type { ExportOptions } from '@/types/dashboard';

export const PortfolioDashboardContainer: React.FC = () => {
  const { currentTenant } = useTenant();

  const handleFetchMetrics = async () => {
    return DashboardService.getPortfolioMetrics(currentTenant.id);
  };

  const handleExport = async (options: ExportOptions) => {
    const blob = await DashboardService.exportDashboard(
      currentTenant.id,
      options.format,
      options.includeCharts
    );

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-dashboard-${new Date().toISOString().split('T')[0]}.${options.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PortfolioDashboard
      tenantId={currentTenant.id}
      fetchMetrics={handleFetchMetrics}
      onExport={handleExport}
    />
  );
};
```

## Backend API Specification

### GET /api/dashboard/portfolio

**Query Parameters:**
- `tenantId: string` - Tenant context

**Response:**
```json
{
  "totalBoms": 47,
  "bomsTrend": {
    "value": 3,
    "direction": "up",
    "period": "this week"
  },
  "atRiskBoms": 12,
  "atRiskTrend": {
    "value": 2,
    "direction": "down",
    "period": "this week"
  },
  "avgEnrichmentScore": 92,
  "costMtd": 2340,
  "costBudget": 2100,
  "riskDistribution": {
    "low": 22,
    "medium": 13,
    "high": 9,
    "critical": 3
  },
  "enrichmentActivity": [
    {
      "date": "2025-12-08",
      "count": 12,
      "cost": 245
    }
    // ... 7 days total
  ],
  "criticalAlerts": [
    {
      "id": "alert-1",
      "type": "obsolete",
      "severity": "warning",
      "message": "3 BOMs have more than 10% obsolete components",
      "actionUrl": "/boms?filter=obsolete",
      "createdAt": "2025-12-14T08:30:00Z"
    }
  ],
  "recentActivity": [
    {
      "id": "activity-1",
      "userId": "user-1",
      "userName": "Emily Rodriguez",
      "userAvatar": "https://...",
      "action": "upload",
      "target": "PCB-Rev-3.xlsx",
      "timestamp": "2025-12-14T10:30:00Z"
    }
  ]
}
```

### POST /api/dashboard/export

**Request Body:**
```json
{
  "tenantId": "tenant-123",
  "format": "pdf",
  "includeCharts": true,
  "dateRange": {
    "start": "2025-12-01",
    "end": "2025-12-14"
  }
}
```

**Response:**
- Content-Type: `application/pdf` or `text/csv`
- Binary file data

## Customization Examples

### Custom Metric Formatters

```tsx
import { MetricCard } from '@/components/dashboard/widgets';

// Currency with custom locale
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

<MetricCard
  value={2340}
  label="Cost MTD"
  formatValue={formatCurrency}
/>

// Percentage with decimals
const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

<MetricCard
  value={92.5}
  label="Enrichment Score"
  formatValue={formatPercentage}
/>
```

### Custom Chart Colors

```tsx
// Override risk colors in your CSS
:root {
  --risk-low: #10b981;      /* Custom green */
  --risk-medium: #f59e0b;   /* Custom amber */
  --risk-high: #ef4444;     /* Custom red */
  --risk-critical: #8b5cf6; /* Custom purple */
}
```

### Custom Grid Layout

```tsx
import { DashboardGrid, GridArea } from '@/components/dashboard';

// Custom 3-column layout
<DashboardGrid tabletColumns={3} desktopColumns={6} gap="4">
  {/* Spans 2 columns on tablet, 3 on desktop */}
  <GridArea colSpanTablet={2} colSpanDesktop={3}>
    <MetricCard {...} />
  </GridArea>

  {/* Full width on all breakpoints */}
  <GridArea colSpanTablet={3} colSpanDesktop={6}>
    <AlertsList {...} />
  </GridArea>
</DashboardGrid>
```

## State Management Integration

### With Zustand

```tsx
// src/stores/dashboard.store.ts
import { create } from 'zustand';
import type { PortfolioMetrics } from '@/types/dashboard';

interface DashboardState {
  metrics: PortfolioMetrics | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: (tenantId: string) => Promise<void>;
  setMetrics: (metrics: PortfolioMetrics) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null,
  isLoading: false,
  error: null,

  fetchMetrics: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await DashboardService.getPortfolioMetrics(tenantId);
      set({ metrics: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load',
        isLoading: false,
      });
    }
  },

  setMetrics: (metrics) => set({ metrics }),
}));

// Usage in component
import { useDashboardStore } from '@/stores/dashboard.store';

const Dashboard = () => {
  const { metrics, isLoading, fetchMetrics } = useDashboardStore();

  useEffect(() => {
    fetchMetrics(tenantId);
  }, [tenantId]);

  // ... render
};
```

### With React Query

```tsx
// src/hooks/useDashboardMetrics.ts
import { useQuery } from '@tanstack/react-query';
import { DashboardService } from '@/services/dashboard.service';

export const useDashboardMetrics = (tenantId: string) => {
  return useQuery({
    queryKey: ['dashboard', 'portfolio', tenantId],
    queryFn: () => DashboardService.getPortfolioMetrics(tenantId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 min
  });
};

// Usage
const { data, isLoading, error, refetch } = useDashboardMetrics(tenantId);
```

## Tablet Optimizations

### Orientation Detection

```tsx
import { useOrientation } from '@/hooks/tablet';

const Dashboard = () => {
  const { isPortrait, isLandscape } = useOrientation();

  return (
    <DashboardGrid
      tabletColumns={isPortrait ? 2 : 4}
      desktopColumns={4}
    >
      {/* Widgets adapt to orientation */}
    </DashboardGrid>
  );
};
```

### Safe Area Insets

```tsx
import { useSafeAreaInsets } from '@/hooks/tablet';

const Dashboard = () => {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <div style={{
      paddingTop: `${top}px`,
      paddingBottom: `${bottom}px`,
    }}>
      <PortfolioDashboard />
    </div>
  );
};
```

## Testing

### Integration Test Example

```tsx
// src/pages/dashboard/__tests__/PortfolioDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioDashboard } from '../PortfolioDashboard';
import { mockMetrics } from '@/mocks/dashboard';

describe('PortfolioDashboard', () => {
  test('renders all metric cards', async () => {
    const fetchMetrics = jest.fn().mockResolvedValue(mockMetrics);

    render(<PortfolioDashboard fetchMetrics={fetchMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('Total BOMs')).toBeInTheDocument();
      expect(screen.getByText('At-Risk BOMs')).toBeInTheDocument();
      expect(screen.getByText('Enrichment Score')).toBeInTheDocument();
      expect(screen.getByText('Cost MTD')).toBeInTheDocument();
    });
  });

  test('handles refresh button', async () => {
    const fetchMetrics = jest.fn().mockResolvedValue(mockMetrics);
    const user = userEvent.setup();

    render(<PortfolioDashboard fetchMetrics={fetchMetrics} />);

    await waitFor(() => {
      expect(fetchMetrics).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByLabelText('Refresh dashboard');
    await user.click(refreshButton);

    expect(fetchMetrics).toHaveBeenCalledTimes(2);
  });

  test('handles export', async () => {
    const fetchMetrics = jest.fn().mockResolvedValue(mockMetrics);
    const user = userEvent.setup();

    render(<PortfolioDashboard fetchMetrics={fetchMetrics} />);

    await waitFor(() => {
      expect(screen.getByText('Total BOMs')).toBeInTheDocument();
    });

    const exportButton = screen.getByLabelText('Export dashboard');
    await user.click(exportButton);

    const pdfOption = screen.getByText('Export as PDF');
    await user.click(pdfOption);

    // Verify export was triggered
    await waitFor(() => {
      expect(screen.getByText('Export completed successfully!')).toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues

**Issue: Charts not rendering**
- Ensure Recharts is installed: `npm install recharts`
- Check console for errors
- Verify data format matches `DailyActivity` type

**Issue: Styles not applied**
- Import `dashboard.css` in main app file
- Check Tailwind config includes dashboard components
- Verify CSS class purging isn't removing needed classes

**Issue: Skeletons showing indefinitely**
- Check `fetchMetrics` is returning valid data
- Verify API endpoint is accessible
- Check for errors in browser console

**Issue: Export not working**
- Verify backend `/api/dashboard/export` endpoint exists
- Check authentication token is valid
- Ensure blob download logic is correct

### Browser Support

Tested and supported:
- Chrome 90+ (desktop, tablet)
- Safari 14+ (iPad, iOS)
- Firefox 88+
- Edge 90+

### Performance Tips

1. Enable code splitting for dashboard route
2. Use React Query for caching
3. Limit activity feed to 20-50 items
4. Debounce auto-refresh during active user interaction
5. Lazy load Recharts library

## Migration Checklist

- [ ] Import dashboard CSS in main app
- [ ] Add dashboard route to router
- [ ] Implement API service for metrics
- [ ] Add role-based access control
- [ ] Test on tablet devices (iPad)
- [ ] Verify touch interactions
- [ ] Test export functionality
- [ ] Run accessibility audit
- [ ] Test auto-refresh behavior
- [ ] Verify print styles
- [ ] Add error boundaries
- [ ] Configure refresh interval
- [ ] Test loading states
- [ ] Verify responsive breakpoints

## Next Steps

1. Implement backend API endpoints
2. Connect to real data sources
3. Add user preferences (widget visibility, layout)
4. Implement real-time updates via WebSocket
5. Add drill-down navigation to detailed views
6. Create mobile-optimized variant

## Support

For issues or questions, contact the platform team or create a ticket in the project tracker.
