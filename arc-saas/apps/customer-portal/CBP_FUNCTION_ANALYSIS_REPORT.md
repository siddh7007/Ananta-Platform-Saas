# CBP Function Analysis Report (Aligned to Implementation)

**Location:** `arc-saas/apps/customer-portal`
**Scope:** Customer Portal (Refine) billing, team, organization, and admin functions

---

## 1) Billing & Subscription Functions

**Service:** `src/services/billing.service.ts`

| Function | Purpose | Access | Returns |
| --- | --- | --- | --- |
| `getCurrentSubscription()` | Current subscription details | All | `Subscription \| null` |
| `getPlans()` | List available plans | All | `Plan[]` |
| `getInvoices()` | Paginated invoice history | All | `{ data: Invoice[], total }` |
| `openBillingPortal()` | Create Stripe portal session | Owner | `{ success, url?, error? }` |
| `openPlanCheckout(planId)` | Create Stripe checkout session | Owner | `{ success, url?, error? }` |
| `cancelSubscription()` | Cancel current subscription | Owner | `Subscription` |
| `getUsageStatus()` | Current usage vs quotas | All | `UsageStatus[]` |
| `getUsageTrend(metricType)` | Historical usage trends | All | `UsageTrend[]` |
| `getUsageAnalytics(billingPeriod?)` | Usage analytics summary | All | `UsageAnalytics` |

**Key Patterns**
- Circuit breaker protection via `isServiceCircuitOpen(CIRCUIT_KEYS.PLATFORM)` before Stripe calls.
- Custom error class `StripePortalError` with codes: `STRIPE_ERROR`, `CONFIG_ERROR`, `UNAUTHORIZED`, `NETWORK_ERROR`, `CIRCUIT_OPEN`.
- `retryable` flag used for UI retry decisions.

**UI Pages**
| Page | Path | Features | Min Role |
| --- | --- | --- | --- |
| Billing Dashboard | `/billing` | Subscription status, usage, invoices | All (view), Owner (actions) |
| Usage Dashboard | `/billing/usage` | Quota progress + trends | All (view) |
| Plan Selection | `/billing/plans` | Monthly/yearly toggle, plan cards | Owner (action) |
| Invoice History | `/billing/invoices` | Filters + pagination | All (view) |

---

## 2) Team Management Functions

**Service:** `src/services/team.service.ts`

| Function | Purpose | Access | Returns |
| --- | --- | --- | --- |
| `getTeamMembers(params)` | List team members with filters | All | `{ data: TeamMember[], total }` |
| `updateMemberRole(request)` | Change member role | Admin+ | `TeamMember` |
| `removeMember(userId)` | Remove member | Admin+ | `void` |
| `inviteMember(request)` | Invite new member | Admin+ | `Invitation` |
| `getInvitations(params)` | List invitations | Admin+ | `{ data: Invitation[], total }` |
| `cancelInvitation(id)` | Cancel invitation | Admin+ | `void` |
| `resendInvitation(id)` | Resend invitation | Admin+ | `Invitation` |
| `transferOwnership(newOwnerId)` | Transfer ownership | Owner | `void` |
| `getTeamActivity(params)` | Activity log | All | `{ data: ActivityLogEntry[], total }` |

**UI Pages**
| Page | Path | Features | Min Role |
| --- | --- | --- | --- |
| Team Members | `/team` | Member list, bulk actions, ownership transfer | All (view), Admin+ (edit) |
| Invitations | `/team/invitations` | Status filters, resend/cancel | Admin+ |
| Activity Log | `/team/activity` | Timeline, CSV export | All (view), Admin+ (export) |

**Key Patterns**
- Bulk operations use `Promise.allSettled()` for partial failures.
- Role gating uses `canManageRole()` and `getAssignableRoles()` from `src/types/team.ts`.
- Ownership transfer limited to active admins (UI) and owner-only action (service).

---

## 3) Organization Management Functions

**Service:** `src/services/organization.service.ts`

| Function | Purpose | Access | Returns |
| --- | --- | --- | --- |
| `getOrganization()` | Current organization details | All | `Organization` |
| `updateOrganization(payload)` | Update org details | Admin+ | `Organization` |
| `deleteOrganization(confirmation)` | Delete organization | Owner | `{ success, message }` |
| `exportOrganizationData()` | Export org data (GDPR) | Owner | `{ jobId, status }` |
| `uploadLogo(file)` | Upload org logo | Admin+ | `{ logoUrl }` |

**UI Page**
| Page | Path | Features | Min Role |
| --- | --- | --- | --- |
| Organization Settings | `/settings/organization` | Details, Team, Invitations, Usage | All (view), Admin+ (edit) |

**Usage Tab**
- Uses live usage data via `getUsageStatus()` to render quotas and warnings.

---

## 4) Admin Management Functions

**Service:** `src/services/audit-logs.service.ts`

| Function | Purpose | Access | Returns |
| --- | --- | --- | --- |
| `getAuditLogs(params)` | Paginated audit logs with filters | Admin+ | `{ data: AuditLog[], total }` |
| `getAuditLogsByAction(action)` | Filter by action type | Admin+ | `AuditLog[]` |
| `getAuditLogsByTarget(type, id)` | Filter by target entity | Admin+ | `AuditLog[]` |
| `getAuditLogsCount(params)` | Count logs for filters | Admin+ | `number` |

**UI Page**
| Page | Path | Features | Min Role |
| --- | --- | --- | --- |
| Audit Logs | `/admin/audit-logs` | Filterable table, detail modal | Admin+ |

---

## 5) Role Hierarchy & Access Control

`super_admin (5) → owner (4) → admin (3) → engineer (2) → analyst (1)`

```ts
export function canManageRole(userRole: AppRole, targetRole: AppRole): boolean {
  return ROLE_LEVELS[userRole] > ROLE_LEVELS[targetRole];
}

export function getAssignableRoles(userRole: AppRole): Role[] {
  return Object.entries(ROLE_LEVELS)
    .filter(([_, level]) => level < ROLE_LEVELS[userRole])
    .map(([key]) => ROLE_CONFIG[key as AppRole]);
}
```

---

## 6) Integration Patterns

| Pattern | Used In | Purpose |
| --- | --- | --- |
| Circuit Breaker | `billing.service.ts` | Protect Stripe calls |
| `Promise.allSettled` | `pages/team/index.tsx` | Partial failure handling |
| `X-Tenant-Id` Header | `platformApi` | Multi-tenant scoping |
| Stripe Checkout | `billing.service.ts` | Payment processing |
| CSV Export | `pages/team/activity.tsx` | Activity log export |

---

## 7) Type Definitions

**Subscription Types:** `src/types/subscription.ts`  
**Team Types:** `src/types/team.ts`  
**Usage Types:** `src/types/usage.ts`

---

## 8) Summary

**Strengths**
- Consistent role-based access control and guardrails in UI
- Circuit breaker + typed Stripe errors for robust billing flows
- Clear separation between services and UI
- Shared type definitions across pages

**Gaps to Watch**
- Ensure backend endpoints enforce the same access rules as UI
- Expand usage metrics coverage if new quota types are added
