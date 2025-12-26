# Portfolio Dashboard API Integration

This directory contains backend API endpoint stubs for the Portfolio Dashboard feature.

## Overview

The Portfolio Dashboard API provides aggregated metrics, alerts, and activity data for organization owners and administrators. It combines data from multiple sources:

- **CNS Service**: BOM data, enrichment events, component information
- **Platform Service**: User data, subscription/billing, organization settings
- **Supabase**: Real-time activity tracking, audit logs

## Endpoints

### 1. Get Portfolio Metrics
**GET** `/api/dashboard/portfolio`

Aggregated metrics for the main dashboard view.

**Headers:**
- `X-Organization-Id` (required): Organization/tenant ID

**Query Parameters:**
- `start_date` (optional): Start date for metrics calculation
- `end_date` (optional): End date for metrics calculation

**Response:** `PortfolioMetrics`
```json
{
  "total_boms": 150,
  "boms_trend": {
    "value": 12,
    "direction": "up",
    "period": "week"
  },
  "at_risk_boms": 23,
  "at_risk_trend": {
    "value": 5,
    "direction": "down",
    "period": "week"
  },
  "avg_enrichment_score": 87.5,
  "cost_mtd": 1245.50,
  "cost_budget": 5000.00,
  "risk_distribution": {
    "low": 80,
    "medium": 47,
    "high": 18,
    "critical": 5
  },
  "enrichment_activity": [...],
  "critical_alerts": [...],
  "recent_activity": [...]
}
```

### 2. Get Alerts
**GET** `/api/dashboard/portfolio/alerts`

Critical alerts requiring immediate attention.

**Headers:**
- `X-Organization-Id` (required)

**Response:** `Alert[]`
```json
[
  {
    "id": "alert-123",
    "type": "obsolete",
    "severity": "warning",
    "message": "5 BOMs have >10% obsolete components",
    "action_url": "/boms?filter=obsolete",
    "created_at": "2024-12-14T10:30:00Z"
  }
]
```

### 3. Get Recent Activity
**GET** `/api/dashboard/portfolio/activity`

Recent user activity feed.

**Headers:**
- `X-Organization-Id` (required)

**Query Parameters:**
- `limit` (optional, default: 10, max: 100): Number of items to return

**Response:** `ActivityItem[]`

### 4. Get Enrichment Activity
**GET** `/api/dashboard/portfolio/enrichment-activity`

Daily aggregated enrichment activity.

**Headers:**
- `X-Organization-Id` (required)

**Query Parameters:**
- `days` (optional, default: 7, max: 90): Number of days to return

**Response:** `DailyActivity[]`

### 5. Export Portfolio
**POST** `/api/dashboard/portfolio/export`

Export portfolio data as PDF or CSV.

**Headers:**
- `X-Organization-Id` (required)

**Body:**
```json
{
  "format": "pdf",
  "include_charts": true,
  "start_date": "2024-11-01T00:00:00Z",
  "end_date": "2024-12-14T23:59:59Z"
}
```

**Response:** Binary file (PDF or CSV)

## Implementation Guide

### Backend Implementation (FastAPI)

1. **Add router to main app:**

```python
from fastapi import FastAPI
from api_stubs.portfolio import router as portfolio_router

app = FastAPI()
app.include_router(portfolio_router)
```

2. **Implement database queries:**

```python
@router.get("/portfolio", response_model=PortfolioMetrics)
async def get_portfolio_metrics(
    tenant_id: str = Depends(get_tenant_id),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    # Query BOMs
    boms = db.query(BOM).filter(
        BOM.organization_id == tenant_id
    ).all()

    # Query users
    users = db.query(User).filter(
        User.tenant_id == tenant_id
    ).all()

    # Query subscription
    subscription = db.query(Subscription).filter(
        Subscription.tenant_id == tenant_id
    ).first()

    # Query enrichment events
    enrichment_events = db.query(EnrichmentEvent).filter(
        EnrichmentEvent.organization_id == tenant_id,
        EnrichmentEvent.created_at.between(start_date, end_date)
    ).all()

    # Aggregate and return metrics
    return aggregate_portfolio_metrics(boms, users, subscription, enrichment_events)
```

3. **Implement alert generation:**

```python
def generate_alerts(boms, users, subscription):
    alerts = []

    # Obsolete components alert
    obsolete_boms = [b for b in boms if b.obsolete_percentage > 10]
    if obsolete_boms:
        alerts.append(Alert(
            id=str(uuid.uuid4()),
            type=AlertType.OBSOLETE,
            severity=AlertSeverity.WARNING if len(obsolete_boms) <= 5 else AlertSeverity.ERROR,
            message=f"{len(obsolete_boms)} BOMs have >10% obsolete components",
            action_url="/boms?filter=obsolete",
            created_at=datetime.utcnow()
        ))

    # Quota alert
    if subscription.quota_limit > 0:
        quota_used = subscription.quota_used / subscription.quota_limit
        if quota_used > 0.85:
            alerts.append(Alert(
                id=str(uuid.uuid4()),
                type=AlertType.QUOTA,
                severity=AlertSeverity.ERROR if quota_used > 0.95 else AlertSeverity.WARNING,
                message=f"Enrichment quota at {int(quota_used * 100)}%",
                action_url="/settings/billing",
                created_at=datetime.utcnow()
            ))

    return alerts
```

### Database Schema Requirements

**Tables needed:**
- `boms` - BOM headers with risk_level, enrichment_score, obsolete_percentage
- `users` - User accounts with last_login timestamp
- `subscriptions` - Subscription/billing with quota fields
- `enrichment_events` - Enrichment audit trail with cost tracking

**Example queries:**

```sql
-- Get risk distribution
SELECT
  risk_level,
  COUNT(*) as count
FROM boms
WHERE organization_id = :tenant_id
GROUP BY risk_level;

-- Get daily enrichment activity
SELECT
  DATE(created_at) as date,
  COUNT(*) as count,
  SUM(cost) as cost
FROM enrichment_events
WHERE organization_id = :tenant_id
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date ASC;

-- Get recent activity with user details
SELECT
  ee.id,
  ee.user_id,
  u.name as user_name,
  u.avatar as user_avatar,
  ee.action,
  ee.bom_id as target,
  ee.created_at as timestamp
FROM enrichment_events ee
JOIN users u ON ee.user_id = u.id
WHERE ee.organization_id = :tenant_id
ORDER BY ee.created_at DESC
LIMIT 10;
```

## Frontend Integration

### Using the Hooks

```tsx
import {
  usePortfolioMetrics,
  usePortfolioAlerts,
  useRecentActivity,
  usePortfolioExport,
} from '@/hooks';

function PortfolioDashboard() {
  const { organizationId } = useOrganization();

  // Main metrics (refresh every 5 minutes)
  const { data: metrics, isLoading, error, refetch } = usePortfolioMetrics({
    tenantId: organizationId,
    refreshInterval: 300000,
  });

  // Alerts (refresh every 2 minutes)
  const { alerts, criticalCount } = usePortfolioAlerts({
    tenantId: organizationId,
    refreshInterval: 120000,
  });

  // Recent activity (refresh every 1 minute)
  const { activity, loadMore, hasMore } = useRecentActivity({
    tenantId: organizationId,
    initialLimit: 10,
  });

  // Export functionality
  const { exportPDF, exportCSV, isExporting } = usePortfolioExport();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!metrics) return null;

  return (
    <div>
      <MetricsCards metrics={metrics} />
      <AlertBanner alerts={alerts} criticalCount={criticalCount} />
      <EnrichmentChart data={metrics.enrichmentActivity} />
      <ActivityFeed
        items={activity}
        onLoadMore={loadMore}
        hasMore={hasMore}
      />
      <ExportButtons
        onExportPDF={() => exportPDF(organizationId)}
        onExportCSV={() => exportCSV(organizationId)}
        disabled={isExporting}
      />
    </div>
  );
}
```

### Mock Data Mode

By default, the service uses mock data for development. To switch to real API:

```bash
# .env or .env.local
VITE_USE_MOCK_PORTFOLIO=false
VITE_CNS_API_URL=http://localhost:27800
VITE_PLATFORM_API_URL=http://localhost:14000
```

## Testing

Run tests:
```bash
npm run test -- portfolio.test.ts
```

Test coverage includes:
- Service layer data aggregation
- API error handling and fallbacks
- Hook state management and loading states
- Mock data generation
- Export functionality

## Performance Considerations

1. **Caching**: Implement server-side caching for expensive aggregations
2. **Pagination**: Limit query results and use offset/limit
3. **Indexing**: Add database indexes on frequently queried fields:
   - `boms.organization_id`
   - `enrichment_events.organization_id, created_at`
   - `users.tenant_id, last_login`

4. **Refresh Intervals**:
   - Full metrics: 5 minutes
   - Alerts: 2 minutes
   - Recent activity: 1 minute

## Next Steps

1. Implement backend endpoints in CNS/Platform services
2. Add database migrations for missing fields
3. Set up API authentication middleware
4. Configure CORS for local development
5. Add Prometheus metrics for monitoring
6. Implement PDF/CSV export logic
7. Add rate limiting for export endpoints
