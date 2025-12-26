# Alerts Dashboard - Integration Guide

## Quick Start

The Alerts Dashboard is **fully implemented** and ready to use. Follow these steps to integrate it into your application.

## 1. Add Route to Application

### Option A: Using React Router (Direct)

```typescript
// In your main router configuration file (e.g., App.tsx or routes.tsx)
import { AlertsDashboardPage } from '@/pages/alerts/AlertsDashboard';

// Add to your routes array:
{
  path: '/alerts',
  element: <AlertsDashboardPage />,
}
```

### Option B: Using Refine Resources

```typescript
// In your Refine App.tsx configuration
import { Refine } from '@refinedev/core';
import { AlertsDashboardPage } from '@/pages/alerts/AlertsDashboard';

<Refine
  // ... other config
  resources={[
    // ... other resources
    {
      name: 'alerts',
      list: AlertsDashboardPage,
      meta: {
        icon: <Bell />,
        label: 'Alerts',
      },
    },
  ]}
/>
```

## 2. Add Navigation Link

### In Main Navigation/Sidebar

```typescript
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAlertStats } from '@/hooks/useAlerts';

function Navigation() {
  const { data: stats } = useAlertStats();
  const unreadCount = stats?.unread || 0;

  return (
    <nav>
      {/* ... other nav items */}

      <Link
        to="/alerts"
        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
      >
        <Bell className="h-5 w-5" />
        <span>Alerts</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {unreadCount}
          </Badge>
        )}
      </Link>
    </nav>
  );
}
```

### In Header/Top Bar

```typescript
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAlertStats } from '@/hooks/useAlerts';

function Header() {
  const navigate = useNavigate();
  const { data: stats } = useAlertStats();
  const unreadCount = stats?.unread || 0;

  return (
    <header>
      {/* ... other header items */}

      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => navigate('/alerts')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </header>
  );
}
```

## 3. Backend API Implementation

The frontend is complete, but you need to implement the backend endpoints. Here's a reference implementation guide:

### Required Database Tables

```sql
-- Alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  type VARCHAR(50) NOT NULL, -- LIFECYCLE, RISK, PRICE, etc.
  severity VARCHAR(20) NOT NULL, -- critical, high, medium, low, info
  status VARCHAR(20) NOT NULL DEFAULT 'unread', -- unread, read, dismissed
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  component_id UUID REFERENCES components(id),
  component_mpn VARCHAR(255),
  manufacturer VARCHAR(255),
  bom_id UUID REFERENCES boms(id),
  bom_name VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_type (tenant_id, type),
  INDEX idx_tenant_severity (tenant_id, severity),
  INDEX idx_created_at (created_at DESC)
);

-- Alert preferences table
CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  alert_types JSONB NOT NULL DEFAULT '[]', -- Array of alert types
  email_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
  threshold_risk_score INTEGER DEFAULT 70,
  threshold_price_change DECIMAL(5,2) DEFAULT 10.00,
  threshold_lead_time INTEGER DEFAULT 14,
  notification_channels JSONB NOT NULL DEFAULT '{"email": true, "in_app": true}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Component watches table
CREATE TABLE component_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  component_id UUID NOT NULL REFERENCES components(id),
  watch_types JSONB NOT NULL DEFAULT '[]', -- Array of alert types to watch
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, component_id)
);
```

### FastAPI Endpoint Examples (Python)

```python
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/alerts", tags=["alerts"])

class Alert(BaseModel):
    id: str
    type: str
    severity: str
    status: str
    title: str
    message: str
    componentId: Optional[str] = None
    componentMpn: Optional[str] = None
    manufacturer: Optional[str] = None
    bomId: Optional[str] = None
    bomName: Optional[str] = None
    metadata: Optional[dict] = None
    createdAt: datetime
    readAt: Optional[datetime] = None
    dismissedAt: Optional[datetime] = None

class AlertListResponse(BaseModel):
    data: List[Alert]
    total: int

class AlertStats(BaseModel):
    total: int
    unread: int
    bySeverity: dict
    byType: dict

@router.get("/", response_model=AlertListResponse)
async def list_alerts(
    types: Optional[str] = Query(None),
    severities: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    fromDate: Optional[datetime] = Query(None),
    toDate: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    sortBy: str = Query("createdAt"),
    sortOrder: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    List alerts with filtering, sorting, and pagination
    """
    tenant_id = auth_context.tenant_id

    # Build query
    query = db.query(AlertModel).filter(AlertModel.tenant_id == tenant_id)

    # Apply filters
    if types:
        type_list = types.split(',')
        query = query.filter(AlertModel.type.in_(type_list))

    if severities:
        severity_list = severities.split(',')
        query = query.filter(AlertModel.severity.in_(severity_list))

    if status:
        query = query.filter(AlertModel.status == status)

    if fromDate:
        query = query.filter(AlertModel.created_at >= fromDate)

    if toDate:
        query = query.filter(AlertModel.created_at <= toDate)

    if search:
        query = query.filter(
            or_(
                AlertModel.title.ilike(f"%{search}%"),
                AlertModel.message.ilike(f"%{search}%"),
                AlertModel.component_mpn.ilike(f"%{search}%")
            )
        )

    # Count total
    total = query.count()

    # Apply sorting
    if sortBy == "createdAt":
        order_col = AlertModel.created_at
    elif sortBy == "severity":
        order_col = AlertModel.severity
    elif sortBy == "type":
        order_col = AlertModel.type

    if sortOrder == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())

    # Apply pagination
    offset = (page - 1) * limit
    alerts = query.offset(offset).limit(limit).all()

    return AlertListResponse(
        data=[Alert.from_orm(a) for a in alerts],
        total=total
    )

@router.get("/stats", response_model=AlertStats)
async def get_alert_stats(
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    Get alert statistics summary
    """
    tenant_id = auth_context.tenant_id

    # Total count
    total = db.query(AlertModel).filter(
        AlertModel.tenant_id == tenant_id,
        AlertModel.status != 'dismissed'
    ).count()

    # Unread count
    unread = db.query(AlertModel).filter(
        AlertModel.tenant_id == tenant_id,
        AlertModel.status == 'unread'
    ).count()

    # By severity
    severity_counts = db.query(
        AlertModel.severity,
        func.count(AlertModel.id)
    ).filter(
        AlertModel.tenant_id == tenant_id,
        AlertModel.status != 'dismissed'
    ).group_by(AlertModel.severity).all()

    by_severity = {
        'critical': 0,
        'high': 0,
        'medium': 0,
        'low': 0,
        'info': 0
    }
    for severity, count in severity_counts:
        by_severity[severity] = count

    # By type
    type_counts = db.query(
        AlertModel.type,
        func.count(AlertModel.id)
    ).filter(
        AlertModel.tenant_id == tenant_id,
        AlertModel.status != 'dismissed'
    ).group_by(AlertModel.type).all()

    by_type = {
        'LIFECYCLE': 0,
        'RISK': 0,
        'PRICE': 0,
        'AVAILABILITY': 0,
        'COMPLIANCE': 0,
        'PCN': 0,
        'SUPPLY_CHAIN': 0
    }
    for alert_type, count in type_counts:
        by_type[alert_type] = count

    return AlertStats(
        total=total,
        unread=unread,
        bySeverity=by_severity,
        byType=by_type
    )

@router.patch("/{alert_id}/read")
async def mark_alert_as_read(
    alert_id: str,
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    Mark a single alert as read
    """
    tenant_id = auth_context.tenant_id

    alert = db.query(AlertModel).filter(
        AlertModel.id == alert_id,
        AlertModel.tenant_id == tenant_id
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = 'read'
    alert.read_at = datetime.utcnow()
    db.commit()

    return {"success": True, "alertId": alert_id}

@router.post("/mark-read")
async def mark_alerts_as_read(
    request: MarkAlertsRequest,
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    Mark multiple alerts as read
    """
    tenant_id = auth_context.tenant_id

    db.query(AlertModel).filter(
        AlertModel.id.in_(request.alertIds),
        AlertModel.tenant_id == tenant_id
    ).update({
        'status': 'read',
        'read_at': datetime.utcnow()
    }, synchronize_session=False)

    db.commit()

    return {"success": True, "message": f"{len(request.alertIds)} alerts marked as read"}

@router.delete("/{alert_id}")
async def dismiss_alert(
    alert_id: str,
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    Dismiss (soft delete) a single alert
    """
    tenant_id = auth_context.tenant_id

    alert = db.query(AlertModel).filter(
        AlertModel.id == alert_id,
        AlertModel.tenant_id == tenant_id
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = 'dismissed'
    alert.dismissed_at = datetime.utcnow()
    db.commit()

    return {"success": True, "alertId": alert_id}

# ... Additional endpoints for preferences and watches
```

### LoopBack 4 Endpoint Examples (TypeScript)

```typescript
import { inject } from '@loopback/core';
import { repository } from '@loopback/repository';
import { get, param, patch, del, post, requestBody } from '@loopback/rest';
import { authenticate } from 'loopback4-authentication';
import { authorize } from 'loopback4-authorization';
import { Alert, AlertStats } from '../models';
import { AlertRepository } from '../repositories';

@authenticate('jwt')
@authorize({ permissions: ['ViewAlerts'] })
export class AlertController {
  constructor(
    @repository(AlertRepository)
    public alertRepository: AlertRepository,
    @inject('currentUser')
    private currentUser: AuthUser,
  ) {}

  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  @get('/alerts', {
    responses: {
      '200': {
        description: 'Array of Alert model instances',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: getModelSchemaRef(Alert)
                },
                total: { type: 'number' }
              }
            }
          }
        }
      }
    }
  })
  async find(
    @param.query.string('types') types?: string,
    @param.query.string('severities') severities?: string,
    @param.query.string('status') status?: string,
    @param.query.string('search') search?: string,
    @param.query.number('page') page = 1,
    @param.query.number('limit') limit = 20,
  ): Promise<{ data: Alert[]; total: number }> {
    const tenantId = this.getTenantId();

    const where: any = { tenantId };

    // Apply filters
    if (types) {
      where.type = { inq: types.split(',') };
    }
    if (severities) {
      where.severity = { inq: severities.split(',') };
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.or = [
        { title: { like: `%${search}%`, options: 'i' } },
        { message: { like: `%${search}%`, options: 'i' } },
        { componentMpn: { like: `%${search}%`, options: 'i' } }
      ];
    }

    const total = await this.alertRepository.count(where);

    const data = await this.alertRepository.find({
      where,
      order: ['createdAt DESC'],
      skip: (page - 1) * limit,
      limit
    });

    return { data, total: total.count };
  }

  @get('/alerts/stats', {
    responses: {
      '200': {
        description: 'Alert statistics',
        content: {
          'application/json': {
            schema: getModelSchemaRef(AlertStats)
          }
        }
      }
    }
  })
  async getStats(): Promise<AlertStats> {
    const tenantId = this.getTenantId();

    // Implement aggregation logic
    // Return stats object
  }

  @patch('/alerts/{id}/read')
  async markAsRead(
    @param.path.string('id') id: string
  ): Promise<{ success: boolean }> {
    const tenantId = this.getTenantId();

    await this.alertRepository.updateById(id, {
      status: 'read',
      readAt: new Date()
    });

    return { success: true };
  }

  @del('/alerts/{id}')
  async dismiss(
    @param.path.string('id') id: string
  ): Promise<{ success: boolean }> {
    const tenantId = this.getTenantId();

    await this.alertRepository.updateById(id, {
      status: 'dismissed',
      dismissedAt: new Date()
    });

    return { success: true };
  }
}
```

## 4. Alert Generation Logic

### Example: Lifecycle Alert Generation

```python
async def check_lifecycle_changes():
    """
    Background job to detect lifecycle status changes
    Run every hour or on component catalog update
    """
    # Get components with recent status changes
    changed_components = db.query(Component).filter(
        Component.lifecycle_status_updated_at >= datetime.utcnow() - timedelta(hours=1),
        Component.lifecycle_status.in_(['EOL', 'NRND', 'Obsolete'])
    ).all()

    for component in changed_components:
        # Find all BOMs using this component
        boms_using = db.query(BomLineItem).filter(
            BomLineItem.component_id == component.id
        ).all()

        for bom_line in boms_using:
            # Get tenant for BOM
            bom = db.query(Bom).get(bom_line.bom_id)

            # Determine severity
            if component.lifecycle_status == 'EOL':
                severity = 'critical'
            elif component.lifecycle_status == 'NRND':
                severity = 'high'
            else:
                severity = 'medium'

            # Create alert
            alert = Alert(
                tenant_id=bom.tenant_id,
                type='LIFECYCLE',
                severity=severity,
                title=f'Component Lifecycle Change: {component.mpn}',
                message=f'{component.manufacturer} {component.mpn} has been marked as {component.lifecycle_status}',
                component_id=component.id,
                component_mpn=component.mpn,
                manufacturer=component.manufacturer,
                bom_id=bom.id,
                bom_name=bom.name,
                metadata={
                    'oldStatus': component.previous_lifecycle_status,
                    'newStatus': component.lifecycle_status,
                    'effectiveDate': component.lifecycle_status_updated_at.isoformat()
                }
            )

            db.add(alert)

    db.commit()
```

## 5. Testing the Implementation

### Manual Testing Steps

1. **View Alerts Dashboard**
   ```
   Navigate to: http://localhost:27100/alerts
   Expected: Dashboard loads with stats cards, filters, and empty table
   ```

2. **Create Test Alert** (via backend or database)
   ```sql
   INSERT INTO alerts (
     tenant_id, type, severity, status, title, message
   ) VALUES (
     '<your-tenant-id>',
     'LIFECYCLE',
     'critical',
     'unread',
     'Test Alert: Component EOL',
     'Test component has reached end of life'
   );
   ```

3. **Verify Display**
   ```
   - Alert appears in table
   - Unread indicator shows (blue dot + background)
   - Stats card shows 1 critical alert
   - Filters work correctly
   ```

4. **Test Mark as Read**
   ```
   - Click "Mark as Read" icon in table
   - Unread indicator disappears
   - Stats card updates (unread count decreases)
   ```

5. **Test Detail View**
   ```
   - Click on alert row
   - Detail sheet opens on right side
   - Alert details display correctly
   - Action buttons work
   ```

6. **Test Preferences**
   ```
   - Click "Configure Alerts" button
   - Preferences dialog opens
   - Modify settings and save
   - Preferences persist after refresh
   ```

### Automated Testing Examples

```typescript
// Example E2E test (Playwright)
test('should display alerts and allow marking as read', async ({ page }) => {
  // Navigate to alerts
  await page.goto('http://localhost:27100/alerts');

  // Verify page loads
  await expect(page.locator('h1')).toContainText('Alerts');

  // Verify stats cards
  await expect(page.locator('[data-testid="stats-critical"]')).toBeVisible();

  // Click first alert
  await page.locator('tbody tr').first().click();

  // Verify detail sheet opens
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Mark as read
  await page.locator('button:has-text("Mark as Read")').click();

  // Verify alert marked
  await expect(page.locator('.bg-blue-50')).toHaveCount(0);
});
```

## 6. Environment Configuration

No additional environment variables needed! The alerts dashboard uses the existing CNS API configuration:

```env
# Already configured in your .env
VITE_API_CNS=http://localhost:27200
```

## 7. Deployment Checklist

- [ ] Backend endpoints implemented and tested
- [ ] Database tables created and indexed
- [ ] Alert generation logic deployed
- [ ] Background jobs scheduled
- [ ] Route added to application
- [ ] Navigation link added
- [ ] Permissions configured
- [ ] Email notifications configured (if using)
- [ ] Monitoring/logging enabled
- [ ] E2E tests passing
- [ ] Performance testing completed

## 8. Troubleshooting

### Issue: "Tenant context required" error
**Solution**: Ensure user is logged in and has selected a tenant in TenantContext

### Issue: No alerts showing
**Solution**:
1. Check backend is returning alerts for current tenant
2. Verify tenant ID is being sent in X-Tenant-Id header
3. Check browser console for API errors

### Issue: Filters not working
**Solution**: Backend must support query parameters (types, severities, status, etc.)

### Issue: Mark as read not persisting
**Solution**: Check backend PATCH /alerts/:id/read endpoint is updating database

### Issue: Preferences not saving
**Solution**: Check PUT /alerts/preferences endpoint and database permissions

## 9. Support & Documentation

- **Frontend Implementation**: See `ALERTS_DASHBOARD_IMPLEMENTATION.md`
- **Architecture**: See `ALERTS_DASHBOARD_ARCHITECTURE.md`
- **Component Docs**: See inline JSDoc comments in each component
- **API Reference**: See backend API documentation (when implemented)

## 10. Production Considerations

### Performance
- Enable database indexes on tenant_id, status, created_at
- Implement database partitioning for large alert volumes
- Use Redis for alert stats caching
- Consider WebSocket for real-time updates

### Scalability
- Batch alert generation for efficiency
- Implement alert aggregation (combine similar alerts)
- Auto-dismiss old alerts after N days
- Archive dismissed alerts to separate table

### Monitoring
- Track alert generation rate
- Monitor query performance
- Alert on API failures
- Track user engagement metrics

### Security
- Ensure multi-tenant isolation
- Validate all user inputs
- Rate limit API endpoints
- Audit log critical actions
