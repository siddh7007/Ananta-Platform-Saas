# Customer Business Portal (CBP) - Missing Features Analysis

## Executive Summary

The customer-portal (CBP) at port 27100 has basic Control Plane integration but is missing several key features available in the Control Plane API (port 14000). This document identifies gaps in:

1. **Billing Management**
2. **User Management**
3. **Admin Menu**

---

## Current Implementation Status

### Existing Services (Already Implemented)

| Service File | Purpose | Status |
|--------------|---------|--------|
| `billing.service.ts` | Subscription, plans, invoices, usage metrics, Stripe integration | **Implemented** |
| `team.service.ts` | Team members, invitations, roles, activity logs | **Implemented** |
| `organization.service.ts` | Organization settings, domains, logo, GDPR export | **Implemented** |

### Data Provider Configuration

**File**: `src/providers/dataProvider.ts`

The data provider is already configured to route platform resources to port 14000:

```typescript
const resourceRouting = {
  tenants: 'platform',         // port 14000
  subscriptions: 'platform',   // port 14000
  plans: 'platform',          // port 14000
  users: 'platform',          // port 14000
  'user-invitations': 'platform', // port 14000
  roles: 'platform',          // port 14000
  settings: 'platform',       // port 14000
  invoices: 'platform',       // port 14000
};
```

---

## MISSING FEATURES - Detailed Gap Analysis

### 1. BILLING MANAGEMENT - Missing Features

#### 1.1 Payment Methods Management (CRITICAL)

**Control Plane API Available**:
- `POST /payment-methods/setup-intent` - Create SetupIntent for Stripe Elements
- `POST /payment-methods` - Add payment method
- `GET /payment-methods` - List payment methods
- `GET /payment-methods/{id}` - Get payment method details
- `PATCH /payment-methods/{id}/set-default` - Set default payment method
- `DELETE /payment-methods/{id}` - Remove payment method

**CBP Status**: **NOT IMPLEMENTED**

**Impact**: Users cannot:
- Add credit cards/bank accounts
- View saved payment methods
- Update default payment method
- Remove old payment methods

**Implementation Required**:
```typescript
// services/payment-methods.service.ts (NEW FILE)
export async function createSetupIntent(): Promise<{clientSecret: string; setupIntentId: string}>
export async function addPaymentMethod(dto: {stripePaymentMethodId: string; setAsDefault?: boolean}): Promise<PaymentMethod>
export async function getPaymentMethods(): Promise<PaymentMethod[]>
export async function setAsDefault(id: string): Promise<PaymentMethod>
export async function removePaymentMethod(id: string): Promise<void>
```

**Pages Required**:
- `pages/billing/payment-methods.tsx` - List/manage payment methods
- `pages/billing/add-payment-method.tsx` - Add new payment method with Stripe Elements

---

#### 1.2 Usage Tracking & Metered Billing (IMPORTANT)

**Control Plane API Available**:
- `GET /usage/status` - Current usage status for all metrics
- `GET /usage/quotas` - Tenant quotas
- `GET /usage/quotas/{metricType}/check` - Check if quota exceeded
- `GET /usage/trends/{metricType}` - Usage trend over time
- `GET /usage/analytics` - Usage analytics summary
- `GET /usage/summaries` - Usage summaries by billing period
- `POST /usage/quotas/initialize` - Initialize quotas for plan
- `POST /usage/quotas/reset` - Reset quotas for new billing period

**CBP Status**: **PARTIALLY IMPLEMENTED**

**Current Implementation**:
- `billing.service.ts` has `getUsageSummary()` and `getUsageMetrics()` which call `/billing/usage`
- No usage trends, analytics, or quota management

**Missing**:
- Detailed usage breakdown by metric type
- Usage trends visualization (charts)
- Quota warnings and limits
- Overage alerts
- Usage analytics dashboard
- Quota reset controls

**Implementation Required**:
```typescript
// Extend billing.service.ts
export async function getUsageStatus(): Promise<UsageStatus[]>
export async function getUsageQuotas(): Promise<Quota[]>
export async function checkQuota(metricType: string): Promise<{exceeded: boolean; currentUsage: number; limit: number}>
export async function getUsageTrend(metricType: string, months?: number): Promise<TrendData[]>
export async function getUsageAnalytics(billingPeriod?: string): Promise<Analytics>
export async function initializeQuotas(planId?: string): Promise<{quotasCreated: number; planTier: string}>
```

**Pages Required**:
- `pages/billing/usage-dashboard.tsx` - Usage metrics dashboard with charts
- `pages/billing/usage-trends.tsx` - Historical usage trends
- `pages/billing/quota-management.tsx` - Quota settings and limits

---

#### 1.3 Audit Logs (IMPORTANT)

**Control Plane API Available**:
- `GET /audit-logs` - Get audit logs for tenant
- `GET /audit-logs/{id}` - Get audit log by ID
- `GET /audit-logs/by-action/{action}` - Filter by action type
- `GET /audit-logs/by-target/{targetType}/{targetId}` - Filter by target
- `GET /audit-logs/by-actor/{actorId}` - Filter by user (actor)
- `GET /audit-logs/count` - Count audit logs

**CBP Status**: **NOT IMPLEMENTED**

**Impact**: No audit trail visibility for:
- Billing changes (plan upgrades, payment method changes)
- User management actions (invitations, role changes)
- Organization settings changes
- Security events

**Implementation Required**:
```typescript
// services/audit-logs.service.ts (NEW FILE)
export async function getAuditLogs(params?: {page?: number; limit?: number; action?: string}): Promise<{data: AuditLog[]; total: number}>
export async function getAuditLogById(id: string): Promise<AuditLog>
export async function getAuditLogsByAction(action: string): Promise<AuditLog[]>
export async function getAuditLogsByTarget(targetType: string, targetId: string): Promise<AuditLog[]>
export async function getAuditLogsByActor(actorId: string): Promise<AuditLog[]>
```

**Pages Required**:
- `pages/admin/audit-logs.tsx` - Audit logs viewer with filtering

---

### 2. USER MANAGEMENT - Missing Features

#### 2.1 Current Implementation (Good Coverage)

**Already Implemented in `team.service.ts`**:
- Get team members (with pagination, search, status filter)
- Get team member details
- Update member role
- Remove member
- Get invitations (with status filter)
- Invite member
- Resend invitation
- Cancel invitation
- Get available roles
- Get team activity log
- Transfer ownership

**Status**: User management features are **WELL IMPLEMENTED**

**Minor Gaps**:
- No bulk user operations (invite multiple, bulk role update)
- No user activity timeline visualization
- No team hierarchy view (if multi-level teams exist)

---

### 3. ADMIN MENU - Missing Features

#### 3.1 Organization Settings (GOOD)

**Already Implemented in `organization.service.ts`**:
- Get/update organization details
- Get/update organization settings
- Domain management (add, remove, verify)
- Logo upload/remove
- Delete organization
- GDPR data export

**Status**: Organization management features are **WELL IMPLEMENTED**

#### 3.2 Missing Admin Features

##### 3.2.1 Keycloak Role Management (MISSING)

**Control Plane API**:
- `GET /keycloak/roles` - Get Keycloak roles
- `POST /keycloak/roles/{realm}/users/{userId}/roles` - Assign role to user
- Other Keycloak integration endpoints

**CBP Status**: **NOT IMPLEMENTED**

**Implementation Required**:
```typescript
// services/keycloak-roles.service.ts (NEW FILE)
export async function getKeycloakRoles(): Promise<Role[]>
export async function assignRoleToUser(realm: string, userId: string, roleId: string): Promise<void>
```

##### 3.2.2 Notifications Management (MISSING)

**Control Plane API**:
- `GET /notifications` - Get notifications
- Notification preferences/settings

**CBP Status**: **NOT IMPLEMENTED**

**Implementation Required**:
```typescript
// services/notifications.service.ts (NEW FILE)
export async function getNotifications(params?: {page?: number; limit?: number; read?: boolean}): Promise<{data: Notification[]; total: number}>
export async function markAsRead(id: string): Promise<void>
export async function getNotificationSettings(): Promise<NotificationSettings>
export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void>
```

##### 3.2.3 Workflow Management (MISSING)

**Control Plane API**:
- `GET /workflows` - Get Temporal workflows
- `GET /workflows/{id}/status` - Get workflow status
- Workflow monitoring and management

**CBP Status**: **NOT IMPLEMENTED**

**Implementation Required**:
```typescript
// services/workflows.service.ts (NEW FILE)
export async function getWorkflows(params?: {page?: number; limit?: number; status?: string}): Promise<{data: Workflow[]; total: number}>
export async function getWorkflowStatus(id: string): Promise<WorkflowStatus>
```

---

## PRIORITY RANKING

### P0 - Critical (Immediate Implementation)

1. **Payment Methods Management**
   - Required for self-service billing
   - Blocks users from adding/managing cards
   - Stripe integration ready but UI missing

### P1 - High Priority (Next Sprint)

2. **Usage Tracking Dashboard**
   - Users need visibility into usage vs quotas
   - Prevents surprise overage charges
   - API partially implemented, needs UI

3. **Audit Logs Viewer**
   - Compliance and security requirement
   - Needed for audit trail visibility
   - No UI or service layer

### P2 - Medium Priority (Future)

4. **Keycloak Role Management**
   - Advanced admin feature
   - Can be managed in Keycloak directly for now

5. **Notifications Management**
   - Nice-to-have, not blocking
   - Can use email notifications for now

6. **Workflow Monitoring**
   - Advanced debugging feature
   - Can use Temporal UI directly for now

---

## RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Payment Methods (Week 1-2)

**New Files**:
```
src/services/payment-methods.service.ts       (200 lines)
src/types/payment-method.ts                   (50 lines)
src/pages/billing/payment-methods.tsx         (300 lines - List)
src/pages/billing/add-payment-method.tsx      (250 lines - Stripe Elements)
src/components/billing/PaymentMethodCard.tsx  (100 lines)
src/components/billing/StripeCardForm.tsx     (150 lines)
```

**Dependencies**:
- `@stripe/stripe-js` - Stripe client library
- `@stripe/react-stripe-js` - React components for Stripe Elements

### Phase 2: Usage Tracking Dashboard (Week 3-4)

**New Files**:
```
src/services/usage.service.ts                 (400 lines - extend billing.service.ts or separate)
src/types/usage.ts                            (100 lines)
src/pages/billing/usage-dashboard.tsx         (400 lines - Dashboard with charts)
src/pages/billing/usage-trends.tsx            (300 lines - Historical trends)
src/components/billing/UsageMetricCard.tsx    (100 lines)
src/components/billing/UsageTrendChart.tsx    (150 lines - Recharts/Victory)
src/components/billing/QuotaWarning.tsx       (80 lines)
```

**Dependencies**:
- `recharts` or `victory` - Charting library
- `date-fns` - Date manipulation

### Phase 3: Audit Logs (Week 5)

**New Files**:
```
src/services/audit-logs.service.ts            (250 lines)
src/types/audit-log.ts                        (80 lines)
src/pages/admin/audit-logs.tsx                (350 lines - Filterable table)
src/components/admin/AuditLogRow.tsx          (100 lines)
src/components/admin/AuditLogFilters.tsx      (120 lines)
```

---

## ESTIMATED EFFORT

| Feature | Lines of Code | Dev Days | Priority |
|---------|--------------|----------|----------|
| Payment Methods Management | ~1,050 | 8 days | P0 |
| Usage Tracking Dashboard | ~1,530 | 10 days | P1 |
| Audit Logs Viewer | ~900 | 6 days | P1 |
| Keycloak Role Management | ~400 | 3 days | P2 |
| Notifications Management | ~600 | 4 days | P2 |
| Workflow Monitoring | ~500 | 4 days | P2 |
| **TOTAL** | **~4,980** | **35 days** | |

---

## NEXT STEPS

1. **User Approval**: Review this document and confirm priority ranking
2. **Start Phase 1**: Implement Payment Methods Management
   - Create service layer (`payment-methods.service.ts`)
   - Create type definitions (`types/payment-method.ts`)
   - Build payment methods list page
   - Build add payment method page with Stripe Elements
   - Test with Stripe test mode
3. **Testing**: Each phase requires:
   - Unit tests for service layer
   - Integration tests for API calls
   - UI tests for Refine pages
   - Manual testing with real Stripe test cards

---

## IMPORTANT NOTES

### No Breaking Changes Required

- All existing features will continue to work
- New services are additive, not replacing existing ones
- Data provider configuration already supports these endpoints
- Refine resources can be added incrementally

### RBAC Considerations

Based on CLAUDE.md role hierarchy:

| Feature | Minimum Role |
|---------|--------------|
| Payment Methods | `owner` (billing-only) |
| Usage Dashboard | `analyst` (all authenticated) |
| Audit Logs | `admin` (org admin+) |
| Keycloak Roles | `super_admin` (platform staff) |
| Notifications | `analyst` (all authenticated) |
| Workflows | `engineer` (technical users) |

### Integration Points

All features integrate cleanly with existing infrastructure:

1. **platformApi** (`src/lib/axios.ts`) - Already configured for port 14000
2. **Data Provider** (`src/providers/dataProvider.ts`) - Already routes platform resources
3. **Auth Provider** (`src/providers/auth-provider.ts`) - JWT tokens already working
4. **Role Parser** (`src/lib/role-parser.ts`) - RBAC utilities already implemented

---

## CONCLUSION

The customer-portal has a solid foundation with good coverage of core features. The main gaps are:

1. **Payment Methods** - Critical for self-service billing
2. **Usage Tracking** - Important for transparency and quota management
3. **Audit Logs** - Important for compliance and security

All missing features are available in the Control Plane API and just need frontend implementation in the customer-portal.

**Recommendation**: Start with Payment Methods (P0), then Usage Tracking (P1), then Audit Logs (P1). Other features can be deferred to future sprints based on user feedback.
