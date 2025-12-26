# CBP Modern UI Build Plan

> **Purpose:** Guide development of a modern CBP UI (Refine + Shadcn + Vite) that integrates with ARC-SaaS CNS, existing Supabase/component DB data, and platform services—without merging/renaming databases or moving storage.
>
> **Last Updated:** December 14, 2024
>
> **Related Documents:**
> - [CBP-REFINE-UX-RESEARCH-REPORT.md](CBP-REFINE-UX-RESEARCH-REPORT.md) - Comprehensive UX research
> - [CBP-INTEGRATION-PROMPT.md](CBP-INTEGRATION-PROMPT.md) - Platform integration guide
> - [CNS-BACKEND-DASHBOARD-TECHNICAL-SPEC.md](CNS-BACKEND-DASHBOARD-TECHNICAL-SPEC.md) - Backend technical spec

---

## Table of Contents

1. [Constraints & AI Guardrails](#constraints--ai-guardrails)
2. [UX Research Summary](#ux-research-summary)
3. [Implementation Progress Overview](#implementation-progress-overview)
4. [10-Step Build Plan (Detailed)](#10-step-build-plan)
5. [User Flow Integration](#user-flow-integration)
6. [Architecture & Integration](#architecture--integration)
7. [Testing & Quality](#testing--quality)
8. [Remaining Work & Backlog](#remaining-work--backlog)
9. [Centralized Theme Control (TODO)](#centralized-theme-control-todo)
10. [Implementation Logs](#implementation-logs)
11. [Reference & Mini-Prompts](#reference--mini-prompts)

---

## Constraints & AI Guardrails

### Project Constraints (Read First)

| Constraint | Description |
|------------|-------------|
| **Database** | Keep existing CNS databases and Supabase/component DB as-is (names, count). Only add schema elements (e.g., tenant_id alignment) when required; no renames/merges. Storage stays where it is. |
| **Auth** | Keycloak-only (`cbp-frontend`), scopes include `cns-api`, PKCE, validate `iss`/`aud`. |
| **Tenant** | Always send `X-Tenant-Id`; no cross-tenant bypass in the UI. Super admin flows are deferred until a later design is agreed. |
| **Billing** | Through subscription-service only; no direct Stripe calls. |
| **Location** | New app at `apps/customer-portal/` in the same container stack as legacy CBP; legacy stays until cutover. |
| **Reuse** | Do **not** copy legacy React Admin code/auth/Stripe/Supabase plumbing. Reuse only business rules, data model/API contracts, and normalization logic; reimplement UI/providers in Refine/Shadcn with new auth/tenant/billing patterns. |

### AI Guardrails (All Agents Must Follow)

- Do not copy legacy React Admin/Supabase/Stripe/client auth code; only reuse business rules and API/data contracts.
- Do not rename tables, merge databases, or migrate storage unless explicitly approved; keep existing DB/storage locations.
- Enforce Keycloak-only auth, `X-Tenant-Id` headers, and platform role hierarchy in all new work.
- Route billing only through subscription-service; no direct Stripe calls.
- When unsure, default to the 10-step build plan and ask for approval before changing data models or infra.

---

## UX Research Summary

> **Full Report:** [CBP-REFINE-UX-RESEARCH-REPORT.md](CBP-REFINE-UX-RESEARCH-REPORT.md)

### User Personas

| Persona | Role | Primary Use Case | Key Pain Points |
|---------|------|------------------|-----------------|
| **Emily Chen** | Engineer | BOM upload & enrichment | Column mapping (15 min avg), no bulk actions |
| **David Rodriguez** | Analyst | Component search & comparison | 5-item comparison limit, no saved searches |
| **Sarah Johnson** | Owner | Portfolio risk oversight | No executive view, poor iPad experience |
| **Alex Patel** | Super Admin | Platform troubleshooting | Cross-app switching, no impersonation |

### Key UX Metrics (Current vs. Target)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Time-to-Value (new users) | 35 min | <10 min | P0 |
| BOM Upload Completion | 60% | 90% | P0 |
| Avg BOM Upload Duration | 28 min | <12 min | P0 |
| Risk Mitigation Time (10 items) | 8.3 min | <3 min | P1 |
| Mobile Usage (tablet) | 8% | 25% | P1 |
| Component Search Success | 42% | 75% | P1 |
| WCAG Compliance | 68% | 100% | P0 |
| Page Load (3G) | 8.2s | <3s | P0 |

### Design Principles (from UX Research)

1. **Clarity Over Complexity** - Progressive disclosure, avoid jargon
2. **Role-Adaptive Interfaces** - Analyst (learning), Engineer (action), Owner (outcome)
3. **Proactive Guidance** - Suggest next steps, reduce decision paralysis
4. **Frictionless Workflows** - Minimize clicks, inline actions
5. **Transparent Automation** - Show AI confidence scores, allow overrides
6. **Accessibility as Foundation** - WCAG 2.1 AA non-negotiable
7. **Performance as Feature** - <3s load time, perceived performance

### P0 UX Priorities (Must-Have)

| Priority | Item | Implementation Status |
|----------|------|----------------------|
| P0 | Smart column mapping with templates | PARTIAL (manual mapping done, AI pending) |
| P0 | Portfolio dashboard for owner role | PENDING |
| P0 | Tablet-optimized layouts | PARTIAL (responsive done, iPad-specific pending) |
| P0 | Inline risk mitigation actions | DONE (RiskAnalysis.tsx) |
| P0 | Org switcher in header | DONE (TenantSelector.tsx) |
| P0 | WCAG 2.1 AA compliance | PARTIAL (68% → need 100%) |
| P0 | Command palette (Cmd+K) | DONE (GlobalSearch.tsx) |
| P0 | Real-time enrichment progress | DONE (progress polling) |

### P1 UX Priorities (Should-Have)

| Priority | Item | Implementation Status |
|----------|------|----------------------|
| P1 | Parametric component search | PARTIAL (filters done, facets pending) |
| P1 | Unlimited comparison tray | PENDING (currently 5-item limit) |
| P1 | Saved searches & filters | PENDING |
| P1 | Bulk component approval | PENDING |
| P1 | Executive summary export | DONE (CSV/JSON export) |
| P1 | Mobile BOM upload | PENDING |
| P1 | Onboarding checklist | PENDING |

### Navigation Architecture (from UX Research)

**Proposed 5-Group Structure:**

```
HEADER: [Logo] [Org Switcher] [Search/Cmd+K] [Alerts] [Profile]

SIDEBAR:
├── Overview
│   ├── My Dashboard
│   └── Portfolio (owner+)
├── BOMs
│   ├── All BOMs
│   ├── By Project
│   ├── By Risk Level
│   └── Upload New
├── Risk Management
│   ├── Risk Dashboard
│   ├── Alerts & Actions
│   └── Mitigation History
├── Component Library
│   ├── Search Components
│   ├── Vault (Approved)
│   ├── Comparisons
│   └── Saved Searches
└── Organization
    ├── Team & Roles
    ├── Billing (owner+)
    ├── Settings
    └── Integrations
```

**Current vs. Proposed:**
| Aspect | Current | Proposed | Benefit |
|--------|---------|----------|---------|
| Top-level groups | 10 flat items | 5 logical groups | -50% cognitive load |
| Max depth | 3 levels | 2 levels | Fewer clicks |
| Org switcher | In profile menu | Prominent in header | 95% discoverability |
| Quick actions | None | `+` button + `Cmd+K` | Power user efficiency |

---

## Implementation Progress Overview

### Build Status Summary

| Step | Area | Status | Key Deliverables |
|------|------|--------|------------------|
| 1 | Foundation & Tooling | **DONE** | Vite + Refine + Shadcn scaffold, Tailwind, ESLint/Prettier, Vitest |
| 2 | Auth & Session | **DONE** | oidc-client-ts + Keycloak PKCE, role parsing, guarded routes |
| 3 | Tenant Context | **DONE** | TenantContext, TenantSelector, X-Tenant-Id axios interceptor |
| 4 | Data Providers | **DONE** | platformApi, cnsApi, supabaseApi + Refine dataProviders |
| 5 | Navigation & RBAC | **DONE** | Navigation manifest with minRole, accessControlProvider |
| 6 | BOM Management UX | **DONE** | BOM types, list page, 7-step upload wizard, detail view, bomParser utility |
| 7 | Component Catalog | **DONE** | Component types, search page with filters, detail drawer with specs/pricing/alternates |
| 8 | Billing & Subscription | **DONE** | Subscription/org types, billing service with Stripe portal, role-based UI, org settings |
| 9 | Team & Invites | **DONE** | Team types, components (MemberCard, InviteModal, InvitationTable), pages, RBAC tests |
| 10 | Observability, Testing | **DONE** | Logging toggle, error tracking hook, cutover plan, 498 unit tests + 4 E2E spec files |

### Feature Completion Matrix

| Category | Status | Completion |
|----------|--------|------------|
| Authentication (OIDC/Keycloak) | DONE | 95% |
| Role Mapping & RBAC | DONE | 100% |
| Tenant Context | DONE | 90% |
| Data Providers (Platform/CNS/Supabase) | DONE | 95% |
| BOM Management | DONE | 95% |
| Component Catalog | DONE | 95% |
| Team/Org Management | DONE | 95% |
| Billing Integration | DONE | 90% |
| Risk Analysis | DONE | 95% |
| Observability | DONE | 95% |
| Infrastructure/Deployment | DONE | 90% |
| Security Hardening | DONE | 95% |
| **User Flow Integration** | **DONE** | **95%** |

**Overall: ~95% implementation completeness**

---

## 10-Step Build Plan

### 1) Foundation & Tooling - DONE

**Completed:**
- Scaffolded `apps/customer-portal/` with Refine + Shadcn + Vite + Tailwind
- Configured absolute imports (`@/` prefix) via tsconfig paths
- Added ESLint/Prettier configuration
- Added Vitest test setup
- Created base layout, error boundary, dashboard page

**Files Created:**
| File | Purpose |
|------|---------|
| `package.json` | Dependencies (Refine, Shadcn, oidc-client-ts, axios, TanStack) |
| `vite.config.ts` | Proxy to CNS (27200) and Platform (14000) |
| `tailwind.config.js`, `postcss.config.js` | Styling configuration |
| `src/config/env.ts` | Environment configuration |
| `src/lib/utils.ts` | cn() utility |
| `src/styles/globals.css` | Shadcn CSS variables |
| `src/components/layout/Layout.tsx` | Main layout component |
| `src/components/shared/ErrorBoundary.tsx` | Error handling |
| `src/pages/Dashboard.tsx` | Dashboard page |
| `.storybook/main.ts`, `.storybook/preview.ts` | Storybook setup |

**Remaining Gaps:**
- No shared design tokens/storybook; visual consistency relies on manual discipline
- No PWA/offline/cache strategy
- Bundle analyzer is manual; add a CI budget/check to prevent bundle regressions

---

### 2) Auth & Session - DONE

**Completed:**
- Wired `oidc-client-ts` with Keycloak `cbp-frontend`
- PKCE enabled by default
- Scopes: `openid profile email roles cns-api`
- Implemented silent renew with `automaticSilentRenew: true`
- Created guarded route wrapper via `<Authenticated>`
- Role parsing with 5-level hierarchy: `analyst < engineer < admin < owner < super_admin`
- Multiple Keycloak role mapping (platform:admin, tenant-admin, etc.)
- Cross-tab session sync via BroadcastChannel API + localStorage fallback
- Audience validation (`validateAudience()` + `EXPECTED_AUDIENCES` config)

**Files Created:**
| File | Purpose |
|------|---------|
| `src/config/auth.ts` | OIDC config, role hierarchy, role mappings |
| `src/contexts/AuthContext.tsx` | AuthProvider, useAuth hook, cross-tab sync |
| `src/providers/authProvider.ts` | Refine auth provider integration |
| `src/components/auth/ProtectedRoute.tsx` | Route protection |
| `src/pages/auth/Login.tsx` | Login page |
| `src/pages/auth/Callback.tsx` | OIDC callback handler |
| `src/components/auth/SessionExpiredDialog.tsx` | 30s countdown + continue offline |
| `src/components/ui/alert-dialog.tsx` | Alert dialog primitive |

**Dev-Only Logging:**
- `src/config/auth.ts` includes dev-only console logging for role mapping troubleshooting
- Raw Keycloak roles extracted from `realm_access`, `resource_access`, `roles`, `groups`
- Logging only active when `import.meta.env.DEV` is true

---

### 3) Tenant Context - DONE

**Completed:**
- Created tenant types (Tenant, TenantMember, TenantInvitation)
- Built TenantProvider with tenant fetching from `/platform/tenants/my-tenants`
- Implemented tenant selector dropdown with search
- Axios interceptors inject `Authorization: Bearer {token}` and `X-Tenant-Id`
- Three API clients: platformApi (14000), cnsApi (27200), supabaseApi (27810)
- 401 handling redirects to login
- Tenant cache with TTL + invalidation (`tenant-cache.ts`)

**Files Created:**
| File | Purpose |
|------|---------|
| `src/types/tenant.ts` | Tenant type definitions |
| `src/contexts/TenantContext.tsx` | TenantProvider, useTenant, useTenantId hooks |
| `src/lib/axios.ts` | Axios instances with auth/tenant interceptors |
| `src/components/tenant/TenantSelector.tsx` | Dropdown UI |
| `src/lib/tenant-cache.ts` | Cache with 24h TTL + validation |

---

### 4) Data Providers - DONE

**Completed:**
- Created Refine-compatible data providers for all three backends
- LoopBack-style filter support (eq, ne, lt, gt, contains, in, etc.)
- Pagination and sorting
- Handles both direct arrays and wrapped `{ data: [], total: N }` responses
- Resource-to-provider mapping
- API retry with circuit breaker (`api-retry.ts`)

**Provider Routing:**
| Resource | Provider | Backend |
|----------|----------|---------|
| boms, bom-line-items | cns | CNS Service (27200) |
| components, manufacturers | supabase | Component DB (27810) |
| tenants, users, invitations | platform | Platform API (14000) |

**Files Created:**
| File | Purpose |
|------|---------|
| `src/providers/dataProvider.ts` | platformDataProvider, cnsDataProvider, supabaseDataProvider |
| `src/services/bom.service.ts` | Upload, enrich, export operations |
| `src/services/component.service.ts` | Search, lookup, alternates |
| `src/services/billing.service.ts` | Subscriptions, plans, invoices |
| `src/services/team.service.ts` | Members, invitations, roles |
| `src/lib/api-retry.ts` | Exponential backoff + circuit breaker |

---

### 5) Navigation & RBAC - DONE

**Completed:**
- Config-driven navigation manifest with `minRole` per item
- accessControlProvider for Refine with resource/action matrix
- Layout uses filtered navigation based on user role
- Settings link only shown to admin+
- Super admin sees additional admin panel items

**Navigation Access Matrix:**
| Nav Item | Minimum Role |
|----------|--------------|
| Dashboard | analyst |
| BOMs | analyst (view), engineer (create) |
| Components | analyst |
| Team | admin |
| Billing | owner |
| Settings | admin |
| Admin Panel | super_admin |

**Files Created:**
| File | Purpose |
|------|---------|
| `src/config/navigation.ts` | NavItem interface, navigation manifest |
| `src/providers/accessControlProvider.ts` | Refine access control |

---

### 6) BOM Management UX - DONE

**Completed:**
- BOM types defined (Bom, BomLineItem, BomStatus, 7-step upload flow types)
- BOM list page with search, status filter, enrichment progress, bulk actions
- BOM upload wizard (7-step flow): File selection → Preview → Column mapping → Enrichment options → Review → Upload → Completion
- BOM detail page with summary stats, paginated line items, export (CSV/XLSX/JSON)
- BOM file parser utility with CSV/Excel support, auto-detection

**Routes Wired:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/boms` | BomListPage | BOM grid with search/filter |
| `/boms/:id` | BomDetailPage | BOM detail with line items |
| `/boms/:id/risk` | RiskAnalysisPage | Per-BOM risk analysis |
| `/boms/upload` | BomUploadPage | 7-step upload wizard |
| `/boms/create` | BomUploadPage | Alias for upload |

**Files Created:**
| File | Purpose |
|------|---------|
| `src/types/bom.ts` | BOM type definitions |
| `src/pages/boms/BomList.tsx` | BOM grid page |
| `src/pages/boms/BomUpload.tsx` | 7-step upload wizard |
| `src/pages/boms/BomDetail.tsx` | BOM detail view |
| `src/pages/boms/RiskAnalysis.tsx` | Risk analysis with export |
| `src/utils/bomParser.ts` | File parser with column detection |
| `src/lib/upload-draft.ts` | Draft save with 24h localStorage persistence |
| `src/components/bom/ActivityLog.tsx` | Timeline with 18 event types |
| `src/components/bom/DeleteBomDialog.tsx` | Type-to-confirm deletion |

---

### 7) Component Catalog Integration - DONE

**Completed:**
- Component types aligned with CNS `catalog.py` CatalogComponent model
- Field mapping to actual component_catalog table
- Lifecycle status aligned: `active`, `nrnd`, `obsolete`, `preview`, `unknown`
- Component list page with full-text search, filters, debounced input
- Component detail drawer with specs, pricing, compliance, alternates
- Component compare view

**Routes Wired:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/components` | ComponentListPage | Searchable catalog |
| `/components/:id` | ComponentListPage | Detail via drawer |
| `/components/compare` | ComponentCompareView | Side-by-side comparison |

**Schema Field Mapping (CNS → TypeScript):**
| CNS Field | TS Interface | Notes |
|-----------|--------------|-------|
| `mpn` | `mpn` | Primary identifier |
| `manufacturer` | `manufacturer` | Manufacturer name |
| `rohs_compliant` | `rohs_compliant` | Boolean |
| `reach_compliant` | `reach_compliant` | Boolean |
| `lifecycle_status` | `lifecycle_status` | Enum |
| `price_breaks` | `price_breaks` | JSONB → PriceBreak[] |

---

### 8) Billing & Subscription Surfaces - DONE

**Completed:**
- Subscription and organization types with helper functions
- Billing service with Stripe portal integration (redirect pattern, no direct Stripe calls)
- Role-based billing UI with proper access control
- Organization settings page with delete confirmation

**RBAC Action Matrix:**
| Action | Minimum Role | Implementation |
|--------|--------------|----------------|
| View subscription/usage | `analyst` | Navigation minRole |
| View invoices | `engineer` | Navigation minRole |
| Manage Billing button | `owner` | SubscriptionCard conditional |
| Change Plan button | `owner` | SubscriptionCard conditional |
| Edit org settings | `admin` | isAdmin check in form |
| Delete organization | `owner` | isOwner check + confirmation |

**Routes Wired:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/billing` | BillingPage | Subscription + usage overview |
| `/billing/invoices` | InvoicesPage | Invoice history |
| `/settings/organization` | OrganizationSettingsPage | Org settings |

---

### 9) Team & Invites - DONE

**Completed:**
- Team types with comprehensive helper functions
- 5-level role hierarchy: `analyst < engineer < admin < owner < super_admin`
- Team components: MemberCard, RoleDropdown, InviteModal, InvitationTable
- Role-based actions with proper hierarchy checks

**RBAC Action Matrix:**
| Action | Minimum Role | Implementation |
|--------|--------------|----------------|
| View team page | `admin` | Navigation minRole |
| Invite member | `admin` | isAdmin check |
| Change role | `admin` | canManageRole() + RoleDropdown |
| Remove member | `owner` | isOwner check |
| View invitations | `admin` | Navigation minRole |
| Resend/Cancel invitation | `admin` | isAdmin check |

**Role Assignment Rules:**
```
canManageRole(managerRole, targetRole) → manager level > target level
getAssignableRoles(userRole) → all invitable roles below user's level

Example:
- Owner (level 4) can assign: analyst, engineer, admin
- Admin (level 3) can assign: analyst, engineer
- Engineer (level 2) can assign: analyst
- Analyst (level 1) cannot assign any roles
```

---

### 10) Observability, Testing, Cutover - DONE

**Test Coverage:**
| Category | Test Count |
|----------|------------|
| Auth flow tests | 23 |
| Axios interceptor tests | 14 |
| Data provider tests | 15 |
| Component/catalog tests | 17 |
| BOM parser tests | 24 |
| Billing RBAC tests | 21 |
| Team RBAC tests | 62 |
| Billing integration tests | 38 |
| Navigation RBAC tests | 44 |
| Health checks/tests | 29 |
| Activity log tests | 17 |
| Risk analysis tests | 60+ |
| **Total Unit Tests** | **498+** |
| **E2E Spec Files** | 4 |
| **Storybook Stories** | 9 |

**E2E Test Files:**
- `e2e/auth.spec.ts` - Authentication flows
- `e2e/tenant.spec.ts` - Tenant context
- `e2e/bom-upload.spec.ts` - BOM upload wizard
- `e2e/bom-enrichment.spec.ts` - Enrichment flows

---

## User Flow Integration

### Overview

User flows span both **Control Plane (Admin Portal)** and **App Plane (CBP Customer Portal)**. This section documents the integration patterns and implementation status.

### Journey 1: New Organization Registration

```
CBP Landing Page (/landing)
       │
       ▼
"Get Started" → Redirect to Admin Portal with return_url
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN PORTAL (Control Plane)                                    │
│                                                                  │
│  Step 1: Lead Registration (/register)                          │
│  Step 2: Email Verification (/register/verify)                  │
│  Step 3: Tenant Onboarding (/register/onboard)                  │
│  Step 4: Tenant Provisioning (Temporal workflow)                │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
Welcome Email → User clicks link
       │
       ▼
CBP Login → Dashboard
```

### Journey 2: User Invitation Flow

```
Admin/Owner in CBP Team Page
       │
       ▼
"Invite Member" → POST /user-invitations
       │
       ▼
Temporal Workflow (user-invitation)
  ├─ Create user in Keycloak
  ├─ Assign role
  └─ Send invitation email
       │
       ▼
Invited user receives email
       │
       ▼
Clicks link → CBP /invitations/{token}
       │
       ▼
AcceptInvitationPage validates token
       │
       ▼
User authenticated → Dashboard
```

### Implementation Status

| Feature | Status | Files |
|---------|--------|-------|
| Return URL in signup flow | DONE | `Landing.tsx`, `register/index.tsx`, `onboard.tsx` |
| AcceptInvitation page | DONE | `src/pages/auth/AcceptInvitation.tsx` |
| Storage resilience pattern | DONE | Dual storage (sessionStorage + localStorage) |
| Cross-tab token survival | DONE | localStorage backup for all critical tokens |
| Auto-trigger provisioning | PENDING | Backend change required |
| Organization sync to App Plane | PENDING | Temporal activity required |

### Storage Resilience Pattern

Both flows use **dual storage** for cross-tab/cross-session resilience:

```typescript
// Store in both for resilience
sessionStorage.setItem("key", value);  // Fast, same-tab
localStorage.setItem("key", value);    // Survives new tab

// Read with fallback
const value = sessionStorage.getItem("key")
  || localStorage.getItem("key");

// Clean up both on success
sessionStorage.removeItem("key");
localStorage.removeItem("key");
```

**Storage Keys:**
| Key | Storage | Purpose |
|-----|---------|---------|
| `returnUrl` | sessionStorage | Return URL for same-tab flow |
| `arc_saas_return_url` | localStorage | Return URL backup for new-tab |
| `cbp_signup_return_url` | localStorage | CBP-specific return URL |
| `pendingInvitationToken` | sessionStorage | Invitation token for same-tab |
| `cbp_pending_invitation` | localStorage | Invitation token backup |

### AcceptInvitation Page Details

**Location:** `src/pages/auth/AcceptInvitation.tsx`
**Route:** `/invitations/:token`

**Features:**
- Token validation with expired/revoked state handling
- Stores pending invitation in dual storage
- Supports both authenticated and unauthenticated flows
- Redirect to signup with invitation context if needed
- Success redirect to dashboard

**Flow for Unauthenticated User:**
1. User clicks invitation link
2. AcceptInvitationPage validates token
3. If valid, stores token in both sessionStorage and localStorage
4. Redirects to signup with `return_url` and `invitation` params
5. After signup, returns to invitation page
6. Token retrieved from storage, accepts invitation
7. Redirects to dashboard

---

## Architecture & Integration

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Customer Portal (CBP)                          │
│                   apps/customer-portal (Vite+React)                 │
└─────────────────┬──────────────────┬──────────────────┬─────────────┘
                  │                  │                  │
                  ▼                  ▼                  ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │  CNS Service    │ │ Platform API    │ │ Supabase        │
        │  (Port 27200)   │ │ (Port 14000)    │ │ (Port 27810)    │
        │                 │ │                 │ │                 │
        │ - BOMs          │ │ - Auth/Tenants  │ │ - Components DB │
        │ - Enrichment    │ │ - Users/Roles   │ │ - Catalog       │
        │ - Line Items    │ │ - Billing       │ │ - Pricing       │
        │ - Normalization │ │ - Invitations   │ │ - Alternates    │
        └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                 │                   │                   │
                 ▼                   ▼                   ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                    PostgreSQL Databases                      │
        │  app-plane-supabase-db (27432) │ components-v2-postgres (27010) │
        └─────────────────────────────────────────────────────────────┘
```

### Shared Temporal Infrastructure

| Setting | Value |
|---------|-------|
| Shared Temporal | `shared-temporal:7233` (port 27020 externally) |
| Control Plane Namespace | `arc-saas` |
| App Plane Namespace | `enrichment` |
| Control Plane Task Queue | `tenant-provisioning` |
| App Plane Task Queue | `cns-enrichment` |
| Network | `shared-temporal-network` |

### Security Implementation

| Feature | Implementation |
|---------|---------------|
| CSP Headers | `index.html` meta tag + `vite.config.ts` + `nginx/cbp.conf` |
| Token Storage | localStorage with strict CSP (documented trade-off) |
| Audience Validation | `validateAudience()` in `AuthContext.tsx` |
| Component Catalog Auth | Routes through CNS service (Keycloak JWT only) |
| OpenTelemetry | `src/lib/telemetry.ts` with shared Jaeger container |

### Helm Charts

**Location:** `infrastructure/helm/charts/customer-app/`

| File | Purpose |
|------|---------|
| `Chart.yaml` | Chart metadata |
| `values.yaml` | Full configuration with CSP, nginx, env vars |
| `templates/deployment.yaml` | Kubernetes Deployment |
| `templates/service.yaml` | ClusterIP Service |
| `templates/configmap.yaml` | Nginx configuration |
| `templates/ingress.yaml` | Ingress with TLS |

---

## Testing & Quality

### Test Summary

| Category | Files | Assertions |
|----------|-------|------------|
| Unit Tests | 19 files in `src/test/` | 498+ |
| E2E Tests | 4 spec files | ~50 |
| Storybook | 9 `.stories.tsx` files | - |
| Total | 32 | 760+ |

### Bundle Size Thresholds

| Metric | Current | Threshold |
|--------|---------|-----------|
| JS (gzip) | 392 KB | 450 KB |
| CSS (gzip) | 8.5 KB | 50 KB |
| Total (gzip) | 400.6 KB | 550 KB |
| Per Chunk | < 150 KB | 150 KB |

**CI Check:** `scripts/check-bundle-size.mjs` + `.github/workflows/bundle-size.yml`

---

## Remaining Work & Backlog

### UX-Driven Priorities (from Research Report)

#### P0 - Critical for Launch

| ID | Item | UX Impact | Effort | Status |
|----|------|-----------|--------|--------|
| P0-1 | Smart column mapping with templates | 15 min → 3 min per BOM | High | PARTIAL |
| P0-2 | Portfolio dashboard for owner role | Sarah's #1 use case | Medium | PENDING |
| P0-3 | Tablet-optimized layouts (iPad) | 8% → 25% tablet usage | Medium | PARTIAL |
| P0-4 | WCAG 2.1 AA compliance audit | Legal requirement | High | PARTIAL (68%) |
| P0-5 | Onboarding checklist for new users | 35 min → 8 min onboarding | Low | PENDING |
| P0-6 | Navigation restructure (5 groups) | -50% cognitive load | Medium | PENDING |

#### P1 - Important, Phase 2

| ID | Item | UX Impact | Effort | Status |
|----|------|-----------|--------|--------|
| P1-1 | Parametric component search with facets | 847 → 37 results | High | PARTIAL |
| P1-2 | Unlimited comparison tray | Remove 5-item limit | Low | PENDING |
| P1-3 | Saved searches & filters | Prevents re-work | Medium | PENDING |
| P1-4 | Bulk component approval | 20+ parts at once | Medium | PENDING |
| P1-5 | Mobile BOM upload | Field use case | High | PENDING |
| P1-6 | Risk trend charts | Owner needs trends | Medium | PENDING |

#### P2 - Nice to Have, Future

| ID | Item | UX Impact | Effort | Status |
|----|------|-----------|--------|--------|
| P2-1 | AI-powered alternative suggestions | Auto drop-in replacements | Very High | DEFERRED |
| P2-2 | Collaborative BOM editing | Real-time collaboration | Very High | DEFERRED |
| P2-3 | CAD tool integrations | One-click import | High | DEFERRED |
| P2-4 | ERP export connectors | Direct push to SAP | High | DEFERRED |
| P2-5 | Custom dashboard widgets | Drag-drop builder | Medium | DEFERRED |

### Technical Debt (Post-MVP Polish)

| ID | Item | Priority | Status |
|----|------|----------|--------|
| T1 | Design system debt (no shared tokens) | Medium | Open |
| T2 | Large table virtualization (1000+ rows) | Low | Open |
| T3 | Dark mode contrast verification | Medium | Open |
| T4 | Notifications UI (Novu inbox) | Low | Deferred |
| T5 | Super admin cross-tenant switching | Medium | Open |
| T6 | X-Api-Audience header for CNS | Low | Open |
| T7 | Rate limiting header handling | Low | Open |

### Backend Dependencies (Pending)

| Feature | API | Status |
|---------|-----|--------|
| Auto-trigger provisioning | POST /tenants/{id}/provision | Backend change needed |
| Sync organizations to App Plane | Temporal activity | Not implemented |
| Unified Keycloak realm | Infrastructure | Medium-term |
| AI column mapping service | POST /bom/ai-map-columns | Not implemented |
| Parametric search API | GET /components/search?facets=true | Not implemented |

---

## Centralized Theme Control (TODO)

### Overview

Implement a centralized theme system supporting multiple theme variants with consistent color tokens, typography, and component styling across the entire application.

### Theme Variants

| Theme | Description | Use Case |
|-------|-------------|----------|
| **Light** | Standard light theme | Default, high ambient light |
| **Dark** | Standard dark theme | Low light, user preference |
| **Mid-Light** | Softer light with reduced contrast | Accessibility, eye strain |
| **Mid-Dark** | Softer dark with reduced contrast | Accessibility, OLED screens |

### Implementation Plan

#### Phase 1: Theme Foundation

**1.1 Create Theme Types** (`src/config/theme.ts`)
```typescript
export type ThemeMode = 'light' | 'dark' | 'mid-light' | 'mid-dark';

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;

  // Foreground colors
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;

  // Accent colors
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;

  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Component-specific
  border: string;
  input: string;
  ring: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  typography: {
    fontFamily: string;
    fontSizeBase: string;
    lineHeightBase: string;
  };
}
```

**1.2 Define Theme Tokens** (`src/config/themes/`)

```
src/config/themes/
├── index.ts          # Theme exports and utilities
├── light.ts          # Light theme tokens
├── dark.ts           # Dark theme tokens
├── mid-light.ts      # Mid-light theme tokens
├── mid-dark.ts       # Mid-dark theme tokens
└── tokens.ts         # Shared design tokens
```

**Light Theme Example:**
```typescript
// src/config/themes/light.ts
export const lightTheme: ThemeConfig = {
  colors: {
    background: 'hsl(0, 0%, 100%)',
    backgroundSecondary: 'hsl(210, 40%, 98%)',
    backgroundTertiary: 'hsl(210, 40%, 96%)',
    foreground: 'hsl(222.2, 84%, 4.9%)',
    foregroundMuted: 'hsl(215.4, 16.3%, 46.9%)',
    foregroundSubtle: 'hsl(215.4, 16.3%, 66.9%)',
    primary: 'hsl(221.2, 83.2%, 53.3%)',
    primaryForeground: 'hsl(210, 40%, 98%)',
    // ... more colors
  },
  borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' },
  shadows: { sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)', /* ... */ },
  typography: { fontFamily: 'Inter, system-ui, sans-serif', /* ... */ },
};
```

**Dark Theme Example:**
```typescript
// src/config/themes/dark.ts
export const darkTheme: ThemeConfig = {
  colors: {
    background: 'hsl(222.2, 84%, 4.9%)',
    backgroundSecondary: 'hsl(217.2, 32.6%, 11%)',
    backgroundTertiary: 'hsl(217.2, 32.6%, 15%)',
    foreground: 'hsl(210, 40%, 98%)',
    foregroundMuted: 'hsl(215, 20.2%, 65.1%)',
    foregroundSubtle: 'hsl(215, 20.2%, 45.1%)',
    primary: 'hsl(217.2, 91.2%, 59.8%)',
    primaryForeground: 'hsl(222.2, 47.4%, 11.2%)',
    // ... more colors
  },
  // ... same structure
};
```

**Mid-Light Theme Example:**
```typescript
// src/config/themes/mid-light.ts
export const midLightTheme: ThemeConfig = {
  colors: {
    background: 'hsl(210, 20%, 95%)',
    backgroundSecondary: 'hsl(210, 20%, 92%)',
    backgroundTertiary: 'hsl(210, 20%, 88%)',
    foreground: 'hsl(222.2, 47%, 20%)',
    foregroundMuted: 'hsl(215, 16%, 50%)',
    // Reduced contrast compared to light theme
    // ... more colors
  },
  // ... same structure
};
```

**Mid-Dark Theme Example:**
```typescript
// src/config/themes/mid-dark.ts
export const midDarkTheme: ThemeConfig = {
  colors: {
    background: 'hsl(222.2, 40%, 12%)',
    backgroundSecondary: 'hsl(217.2, 32%, 16%)',
    backgroundTertiary: 'hsl(217.2, 32%, 20%)',
    foreground: 'hsl(210, 30%, 88%)',
    foregroundMuted: 'hsl(215, 20%, 60%)',
    // Softer than full dark theme
    // ... more colors
  },
  // ... same structure
};
```

#### Phase 2: Theme Context & Provider

**2.1 Create Theme Context** (`src/contexts/ThemeContext.tsx`)
```typescript
interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  config: ThemeConfig;
  systemPreference: 'light' | 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Priority: localStorage > system preference > default
    const stored = localStorage.getItem('cbp_theme') as ThemeMode | null;
    if (stored && isValidTheme(stored)) return stored;

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('cbp_theme', newTheme);
    applyThemeToDOM(newTheme);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set explicit preference
      if (!localStorage.getItem('cbp_theme')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, config: themes[theme], systemPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

**2.2 Create Theme Hook** (`src/hooks/useTheme.ts`)
```typescript
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function useThemeColors() {
  const { config } = useTheme();
  return config.colors;
}

export function useIsDarkMode() {
  const { theme } = useTheme();
  return theme === 'dark' || theme === 'mid-dark';
}
```

#### Phase 3: CSS Variable Integration

**3.1 Update globals.css**
```css
/* src/styles/globals.css */
:root {
  /* Light theme (default) */
  --background: 0 0% 100%;
  --background-secondary: 210 40% 98%;
  --foreground: 222.2 84% 4.9%;
  /* ... all tokens */
}

[data-theme="dark"] {
  --background: 222.2 84% 4.9%;
  --background-secondary: 217.2 32.6% 11%;
  --foreground: 210 40% 98%;
  /* ... all tokens */
}

[data-theme="mid-light"] {
  --background: 210 20% 95%;
  --background-secondary: 210 20% 92%;
  --foreground: 222.2 47% 20%;
  /* ... all tokens */
}

[data-theme="mid-dark"] {
  --background: 222.2 40% 12%;
  --background-secondary: 217.2 32% 16%;
  --foreground: 210 30% 88%;
  /* ... all tokens */
}
```

**3.2 Apply Theme to DOM**
```typescript
function applyThemeToDOM(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update meta theme-color for mobile browsers
  const themeColors: Record<ThemeMode, string> = {
    light: '#ffffff',
    dark: '#0a0a1a',
    'mid-light': '#f0f2f5',
    'mid-dark': '#1a1d24',
  };
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColors[theme]);
}
```

#### Phase 4: Theme Selector Component

**4.1 Create ThemeSelector** (`src/components/theme/ThemeSelector.tsx`)
```typescript
const THEME_OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'mid-light', label: 'Soft Light', icon: SunMedium },
  { value: 'mid-dark', label: 'Soft Dark', icon: CloudMoon },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {theme === 'light' && <Sun className="h-5 w-5" />}
          {theme === 'dark' && <Moon className="h-5 w-5" />}
          {theme === 'mid-light' && <SunMedium className="h-5 w-5" />}
          {theme === 'mid-dark' && <CloudMoon className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(theme === value && 'bg-accent')}
          >
            <Icon className="mr-2 h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Phase 5: Component Updates

**5.1 Update All Components to Use Theme Tokens**

Components should use CSS variables instead of hardcoded colors:

```tsx
// Before (hardcoded)
<div className="bg-white dark:bg-slate-900">

// After (using tokens)
<div className="bg-background">
```

**5.2 Update Tailwind Config**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        'background-secondary': 'hsl(var(--background-secondary))',
        'background-tertiary': 'hsl(var(--background-tertiary))',
        foreground: 'hsl(var(--foreground))',
        'foreground-muted': 'hsl(var(--foreground-muted))',
        'foreground-subtle': 'hsl(var(--foreground-subtle))',
        // ... all tokens
      },
    },
  },
};
```

#### Phase 6: Testing & Accessibility

**6.1 Contrast Verification**
- All themes must meet WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Test with browser contrast checker tools

**6.2 Theme Persistence Tests**
```typescript
describe('Theme persistence', () => {
  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setTheme('mid-dark'));
    expect(localStorage.getItem('cbp_theme')).toBe('mid-dark');
  });

  it('should restore theme from localStorage', () => {
    localStorage.setItem('cbp_theme', 'mid-light');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.theme).toBe('mid-light');
  });
});
```

**6.3 Visual Regression Tests**
- Add Chromatic or Percy for visual regression testing
- Capture all themes for each component

### Files to Create

| File | Purpose |
|------|---------|
| `src/config/theme.ts` | Theme types and interfaces |
| `src/config/themes/index.ts` | Theme exports |
| `src/config/themes/light.ts` | Light theme tokens |
| `src/config/themes/dark.ts` | Dark theme tokens |
| `src/config/themes/mid-light.ts` | Mid-light theme tokens |
| `src/config/themes/mid-dark.ts` | Mid-dark theme tokens |
| `src/config/themes/tokens.ts` | Shared design tokens |
| `src/contexts/ThemeContext.tsx` | Theme context and provider |
| `src/hooks/useTheme.ts` | Theme hooks |
| `src/components/theme/ThemeSelector.tsx` | Theme selector dropdown |
| `src/components/theme/index.ts` | Barrel export |
| `src/test/theme.test.ts` | Theme tests |

### Implementation Checklist

- [x] ~~Create theme types and interfaces~~ (Using next-themes instead)
- [x] Define all 4 theme token sets (light, dark, mid-light, mid-dark)
- [x] ~~Create ThemeContext and ThemeProvider~~ (Using next-themes ThemeProvider)
- [x] Update globals.css with CSS variables for all themes
- [x] Update tailwind.config.js with `:is()` selector for dark themes
- [x] Create ThemeSelector component
- [x] Add theme selector to Layout header
- [x] ~~Update all existing components to use theme tokens~~ (Already use CSS vars)
- [x] Add theme persistence to localStorage (next-themes handles this)
- [x] Add system preference detection (next-themes handles this)
- [x] Add no-flash guard with resilient fallback (index.html)
- [x] Add useThemeColor hook for runtime meta sync
- [x] Add ThemeColorSync component to main.tsx
- [x] Apply to Admin Portal (admin-app) for parity
- [ ] Test contrast ratios for accessibility
- [ ] Add Storybook stories for theme variants
- [ ] Add unit tests for theme context
- [x] Document theme usage guidelines

### Implementation Status: DONE (Core)

**Approach Changed:** Used `next-themes` library for plug-and-play solution instead of custom ThemeContext.

**Completed in ~15 minutes:**
- Installed `next-themes` package
- Added 4 theme variants to `globals.css`
- Wrapped app with ThemeProvider in `main.tsx`
- Created `ThemeSelector` component with icon dropdown
- Added to Layout header

### Estimated Effort (Actual)

| Phase | Estimated | Actual |
|-------|-----------|--------|
| Phase 1-4: Core Implementation | 2.5 days | 15 min |
| Phase 5: Component Updates | 2-3 days | 0 (already use CSS vars) |
| Phase 6: Testing | 1 day | TODO |
| **Total** | **5-6 days** | **15 min + testing** |

---

## Implementation Logs

### Session: 2024-12-14 (UX Research Integration)

**Objective:** Integrate comprehensive UX research findings into CBP build plan.

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| UX Research Report | DONE | `CBP-REFINE-UX-RESEARCH-REPORT.md` created |
| User Personas | DONE | 4 personas defined (Emily, David, Sarah, Alex) |
| Pain Points Analysis | DONE | Navigation, BOM upload, mobile, accessibility gaps identified |
| Design Principles | DONE | 7 principles established |
| Priority Matrix | DONE | P0/P1/P2 items categorized with UX impact |
| Navigation Architecture | DONE | 5-group structure proposed |
| Success Metrics | DONE | 10 KPIs defined with targets |

**Key UX Findings:**

1. **BOM Upload Workflow** - 63% drop-off at column mapping, needs AI + templates
2. **Owner Dashboard** - No portfolio view, Sarah must use laptop instead of iPad
3. **Component Search** - 42% success rate, needs parametric facets + saved searches
4. **Accessibility** - 68% WCAG compliance, must reach 100%
5. **Performance** - 8.2s load time on 3G, target <3s

**Files Created:**
- `arc-saas/docs/CBP-REFINE-UX-RESEARCH-REPORT.md` - Full UX research report

**Files Modified:**
- `arc-saas/docs/CBP-UI-BUILD-PLAN.md` - Added UX Research Summary section, updated backlog with UX priorities

**Next Steps:**
1. Implement P0-2: Portfolio dashboard for owner role
2. Implement P0-5: Onboarding checklist
3. Implement P0-6: Navigation restructure to 5 groups
4. Complete WCAG 2.1 AA audit (P0-4)
5. Backend: AI column mapping service for P0-1

---

### Session: 2024-12-13 (Centralized Theme Control)

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| Install next-themes | DONE | `npm install next-themes` |
| 4 theme variants CSS | DONE | `globals.css` with light, dark, mid-light, mid-dark |
| ThemeProvider wrapper | DONE | `main.tsx` wraps app with ThemeProvider |
| ThemeSelector component | DONE | `src/components/theme/ThemeSelector.tsx` |
| Layout integration | DONE | Added to header next to TenantSelector |

**Files Created:**
- `src/components/theme/ThemeSelector.tsx` - Icon dropdown with 5 options
- `src/components/theme/index.ts` - Barrel export

**Files Modified:**
- `src/styles/globals.css` - 4 theme variants with extended tokens
- `src/main.tsx` - ThemeProvider wrapper with configuration
- `src/components/layout/Layout.tsx` - ThemeSelector in header

**Theme Options:**
| Theme | Icon | Description |
|-------|------|-------------|
| Light | Sun | High contrast, bright |
| Dark | Moon | High contrast, dark |
| Soft Light | SunMedium | Reduced contrast light |
| Soft Dark | CloudMoon | Reduced contrast dark |
| System | Monitor | Follow OS preference |

---

### Session: 2024-12-13 (Theme System Hardening)

**Objective:** Harden the next-themes setup to fix dark-mode gaps, prevent flash-of-light on load, and improve accessibility.

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| Align data-theme vs .dark | DONE | `tailwind.config.js` - selector mode for `[data-theme]` |
| No-flash initialization | DONE | `index.html` - inline script applies theme before render |
| resolvedTheme for icon | DONE | `ThemeSelector.tsx` - uses resolvedTheme for display |
| Keyboard navigation | DONE | Full a11y: Escape, Arrow, Enter, Space, Tab, Home, End |
| Root theme verification | DONE | `App.tsx` - Toaster added for themed notifications |

**Technical Changes:**

1. **Tailwind Config** (`tailwind.config.js`):
   ```javascript
   darkMode: ['selector', '[data-theme="dark"], [data-theme="mid-dark"]'],
   ```
   - Tailwind's `dark:` variants now trigger on both dark themes

2. **No-Flash Script** (`index.html`):
   - Reads `cbp-theme` from localStorage before React renders
   - Applies `data-theme` attribute to `<html>` element synchronously
   - Updates `theme-color` meta tag for mobile browsers
   - Handles system preference when theme is "system" or unset

3. **ThemeSelector Improvements**:
   - `resolvedTheme` shows actual applied theme (e.g., "dark" when System selects dark)
   - `theme` tracks user selection (to highlight "System" when selected)
   - Full ARIA-compliant listbox pattern (`role="listbox"`, `role="option"`)
   - Keyboard navigation: ArrowUp/Down, Escape, Enter, Space, Tab, Home, End
   - Focus management with refs for each option
   - Two variants: `icon` (header) and `dropdown` (full width)

4. **Toaster Component** (`App.tsx`):
   - Added `<Toaster />` to render themed notifications
   - Toast variants use `dark:` classes which now work with `data-theme`

**Files Modified:**
- `tailwind.config.js` - darkMode selector configuration
- `index.html` - No-flash theme script, CSP update for inline scripts
- `src/components/theme/ThemeSelector.tsx` - Complete rewrite with accessibility
- `src/App.tsx` - Added Toaster component import and rendering

**Accessibility Features:**
| Feature | Implementation |
|---------|----------------|
| Keyboard navigation | Full arrow key, escape, enter/space support |
| ARIA roles | listbox/option pattern |
| Focus management | Auto-focus on open, return focus on close |
| Screen reader | Dynamic aria-label shows current vs resolved theme |
| Reduced motion | CSS `transition-transform` respects prefers-reduced-motion |

---

### Session: 2024-12-13 (Theme System Review - Further Hardening)

**Objective:** Further tighten the theme system with improved Tailwind selector, runtime theme-color sync, and resilient no-flash guard.

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| Tailwind `:is()` selector | DONE | Cleaner CSS output with single selector for dark themes |
| Runtime theme-color sync | DONE | `useThemeColor` hook syncs meta tag with resolvedTheme |
| ThemeColorSync component | DONE | Invisible component that runs the hook |
| Resilient no-flash fallback | DONE | CSS animation fallback (100ms) + noscript support |
| Admin Portal theme parity | DONE | Same theme system applied to admin-app |

**Technical Changes:**

1. **Tailwind Config - `:is()` Selector** (`tailwind.config.js`):
   ```javascript
   // Before (comma-separated)
   darkMode: ['selector', '[data-theme="dark"], [data-theme="mid-dark"]'],

   // After (using :is())
   darkMode: ['selector', ':is([data-theme="dark"], [data-theme="mid-dark"])'],
   ```
   - Generates cleaner CSS: `.dark\:text-white:is([data-theme="dark"], [data-theme="mid-dark"]) *`
   - Single `:is()` selector instead of duplicated rules

2. **useThemeColor Hook** (`src/hooks/useThemeColor.ts`):
   ```typescript
   const THEME_COLORS: Record<string, string> = {
     light: '#ffffff',
     dark: '#0a0a1a',
     'mid-light': '#f0f2f5',
     'mid-dark': '#1a1d24',
   };

   export function useThemeColor() {
     const { resolvedTheme } = useTheme();

     useEffect(() => {
       if (!resolvedTheme) return;
       const color = THEME_COLORS[resolvedTheme] || THEME_COLORS.light;
       const meta = document.querySelector('meta[name="theme-color"]');
       if (meta) {
         meta.setAttribute('content', color);
       } else {
         const newMeta = document.createElement('meta');
         newMeta.name = 'theme-color';
         newMeta.content = color;
         document.head.appendChild(newMeta);
       }
     }, [resolvedTheme]);
   }
   ```
   - Keeps browser chrome (address bar) matching the active theme
   - Creates meta tag if it doesn't exist

3. **ThemeColorSync Component** (`src/components/ThemeColorSync.tsx`):
   ```typescript
   export function ThemeColorSync() {
     useThemeColor();
     return null;
   }
   ```
   - Invisible component placed inside ThemeProvider
   - Runs the hook without rendering anything

4. **Resilient No-Flash Guard** (`index.html`):
   ```html
   <style>
     html:not([data-theme]) body {
       visibility: hidden;
       animation: theme-fallback 0s 100ms forwards;
     }

     @keyframes theme-fallback {
       to { visibility: visible; }
     }

     html[data-theme] body {
       visibility: visible;
       animation: none;
     }
   </style>
   <noscript>
     <style>
       html body { visibility: visible !important; animation: none !important; }
     </style>
   </noscript>
   ```
   - Primary: Hide body until `data-theme` is set
   - Fallback: After 100ms, show content even if script blocked (ad-blocker, CSP)
   - Noscript: Show immediately if JavaScript completely disabled

5. **No-Flash Script Improvements**:
   - Uses `indexOf()` instead of `includes()` for broader browser compatibility
   - Sets `data-theme-loaded="true"` attribute to track successful execution
   - Updates `theme-color` meta synchronously with theme application

**Files Created:**
| File | Purpose |
|------|---------|
| `customer-portal/src/hooks/useThemeColor.ts` | Runtime theme-color meta sync |
| `customer-portal/src/components/ThemeColorSync.tsx` | Invisible sync component |
| `admin-app/src/hooks/useThemeColor.ts` | Runtime theme-color meta sync |
| `admin-app/src/components/ThemeColorSync.tsx` | Invisible sync component |

**Files Modified:**
| File | Changes |
|------|---------|
| `customer-portal/tailwind.config.js` | `:is()` selector for darkMode |
| `customer-portal/index.html` | Resilient no-flash with animation fallback |
| `customer-portal/src/main.tsx` | Added ThemeColorSync component |
| `admin-app/tailwind.config.js` | `:is()` selector for darkMode |
| `admin-app/index.html` | Resilient no-flash with animation fallback |
| `admin-app/src/main.tsx` | Added ThemeColorSync component |

**Storage Keys:**
| App | Key | Purpose |
|-----|-----|---------|
| Customer Portal | `cbp-theme` | Theme preference |
| Admin App | `admin-theme` | Theme preference |

---

### Session: 2024-12-13 (User Flow Integration)

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| Return URL handling | DONE | Dual storage pattern in Landing.tsx, register/index.tsx, onboard.tsx |
| AcceptInvitation page | DONE | `src/pages/auth/AcceptInvitation.tsx` with full flow support |
| Storage resilience | DONE | sessionStorage + localStorage fallback for all critical state |
| Cross-tab token survival | DONE | localStorage backup for invitation tokens |

**Files Modified:**
- `apps/customer-portal/src/pages/Landing.tsx` - Full URL + localStorage backup
- `apps/admin-app/src/pages/register/index.tsx` - Dual storage for return URL
- `apps/admin-app/src/pages/register/onboard.tsx` - Triple-source fallback + smart redirect
- `apps/customer-portal/src/pages/auth/AcceptInvitation.tsx` - Dual storage for tokens

**Commit:** `ffc5eb3 - fix: add storage resilience for cross-tab/cross-domain user flows`

---

### Session: 2024-12-13 (Infrastructure & Feature Gaps)

**Completed Items:**

| Item | Status | Implementation |
|------|--------|----------------|
| Helm Charts for Customer Portal | DONE | `infrastructure/helm/charts/customer-app/` |
| Enrichment Workflow Verification | VERIFIED | Shared Temporal confirmed |
| Risk Report Export | DONE | CSV/JSON export in RiskAnalysis.tsx |

---

### Session: 2024-12-12 (Critical Priority Items)

**Completed Items:**

| ID | Item | Implementation |
|----|------|----------------|
| C1 | BOM Re-Enrichment CTA | `BomDetail.tsx` - Re-Enrich button, stale detection, progress polling |
| C2 | API Retry/Circuit Breaker | `api-retry.ts` - exponential backoff, jitter, circuit breaker |
| C3 | Stripe Portal Error Handling | `billing.service.ts` - StripePortalError class, circuit breaker |
| C4 | Cross-Tab Session Sync | `AuthContext.tsx` - BroadcastChannel + localStorage fallback |

---

### Session: 2024-12-12 (High Priority Items)

**Completed Items:**

| ID | Item | Implementation |
|----|------|----------------|
| H1 | Risk Analysis Page | `RiskAnalysis.tsx` + `risk.ts` + `risk.service.ts` |
| H2 | Delete Safeguards | `DeleteBomDialog.tsx` with type-to-confirm |
| H3 | BOM Version History | `ActivityLog.tsx` with 18 event types |
| H4 | E2E Tests | 4 Playwright spec files |
| H5 | Storybook Coverage | 9 story files |

---

### Session: 2024-12-12 (QA Pass)

**Fixes Applied:**

| Category | Fix |
|----------|-----|
| Web Worker | Abort message handling, graceful termination |
| Hook Safety | `isMountedRef` for safe setState, debounced progress |
| Storage | Tenant-scoped keys, schema versioning, quota handling |
| Caching | LRU eviction, stale entry pruning, tenant in keys |
| Accessibility | Toast ARIA, spinner scroll lock, reduced motion support |
| Global Search | AbortController, focus trap, tenant headers |

---

## Reference & Mini-Prompts

### Key User Flows

| Flow | Status | Notes |
|------|--------|-------|
| Auth & Tenant Select | DONE | Cross-tab sync, session expiry dialog |
| BOM Lifecycle | DONE | Create, upload, enrich, export |
| Component Lookup | DONE | Search, filter, compare, link |
| Billing/Plan | DONE | Stripe portal, usage metrics |
| Team/Invites | DONE | Role hierarchy, invite modal |
| Risk Analysis | DONE | EOL/obsolete/single-source views |
| User Registration | DONE | Return URL, storage resilience |
| User Invitation | DONE | AcceptInvitation page |

## P0 Implementation Prompts (Coder Agent Ready)

> **Purpose:** Detailed, ready-to-execute prompts for the Coder Agent to implement P0 priority features.
> **Usage:** Copy the prompt for the specific P0 task and pass it to the Coder Agent.

---

### P0-1: Smart Column Mapping with Templates

**Task ID:** P0-1
**Priority:** CRITICAL
**UX Impact:** 15 min → 3 min per BOM (80% reduction)
**Current Status:** PARTIAL (manual mapping exists, AI + templates pending)
**Target Completion:** 90% accuracy on auto-mapping

#### Implementation Prompt

```markdown
## Task: Implement Smart Column Mapping with Templates for BOM Upload

### Context
The current BOMColumnMapper component (app-plane/services/customer-portal/src/bom/intake/BOMColumnMapper.tsx) requires manual column mapping for every BOM upload. Users spend 15+ minutes mapping 45+ columns per BOM, causing a 63% drop-off rate at this step.

### Objective
Create an intelligent column mapping system that:
1. Auto-detects column mappings using pattern matching and ML confidence scores
2. Allows users to save and reuse mapping templates
3. Provides visual confidence indicators for AI suggestions
4. Supports one-click accept for high-confidence mappings

### Technical Requirements

#### 1. AI Column Detection Service
Create `src/services/column-mapping.service.ts`:

```typescript
interface ColumnSuggestion {
  sourceColumn: string;
  suggestedTarget: string;
  confidence: number;  // 0-100
  matchReason: 'exact_match' | 'fuzzy_match' | 'pattern_match' | 'sample_analysis';
  alternatives: Array<{ target: string; confidence: number }>;
}

interface MappingTemplate {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  mappings: Array<{ pattern: string; target: string }>;
  usageCount: number;
  lastUsed: Date;
  createdBy: string;
  createdAt: Date;
}
```

Pattern matching rules (in priority order):
- Exact header match: "MPN", "Part Number", "Manufacturer Part Number" → manufacturer_part_number
- Fuzzy match: "Mfr", "Mfg", "Manuf" → manufacturer
- Pattern match: Column containing mostly integers → quantity
- Sample analysis: Values like "R1, R2, R3" → reference_designator

#### 2. Template Management
Create `src/components/bom/MappingTemplateManager.tsx`:
- List saved templates with search/filter
- Create new template from current mapping
- Edit/delete existing templates (admin+ only)
- Template sharing toggle (org-wide vs personal)
- "Apply Template" button with preview

#### 3. Enhanced BOMColumnMapper Component
Migrate from MUI to Radix UI/Shadcn:
- Replace MUI Select with Radix Select
- Add confidence badge (green >90%, yellow 70-90%, red <70%)
- Add "Accept All High-Confidence" button
- Add template selector dropdown in header
- Show AI reasoning on hover (tooltip)
- Add keyboard shortcuts (Tab to next, Enter to accept)

#### 4. UI Components Needed
```
src/components/bom/
├── SmartColumnMapper.tsx      # New main component
├── ConfidenceBadge.tsx        # Visual confidence indicator
├── MappingRow.tsx             # Individual row with suggestions
├── MappingTemplateManager.tsx # Template CRUD
├── MappingTemplateCard.tsx    # Template list item
├── AcceptAllButton.tsx        # Bulk accept high-confidence
└── AIReasoningTooltip.tsx     # Explanation tooltip
```

#### 5. API Endpoints (Backend)
If CNS service doesn't have these, stub them:
- `POST /api/cns/bom/analyze-columns` - Analyze columns, return suggestions
- `GET /api/cns/mapping-templates` - List templates for tenant
- `POST /api/cns/mapping-templates` - Create template
- `PUT /api/cns/mapping-templates/:id` - Update template
- `DELETE /api/cns/mapping-templates/:id` - Delete template

#### 6. Data Flow
```
User uploads file
    → Parser extracts headers + sample rows
    → Send to column-mapping.service.ts
    → Apply saved templates first (if match found)
    → If no template, run AI detection
    → Display suggestions with confidence
    → User reviews/adjusts
    → User can save as new template
    → Proceed to enrichment
```

#### 7. Success Metrics
- Auto-mapping accuracy: >90% for common column names
- User intervention rate: <10% of columns need manual adjustment
- Template reuse rate: >60% of uploads use saved template
- Time-to-complete: <3 minutes average

#### 8. Accessibility Requirements
- All dropdowns keyboard navigable
- Confidence badges have aria-label with percentage
- Focus management on template apply
- Screen reader announces suggestion changes

#### 9. Files to Create/Modify
**Create:**
- `src/services/column-mapping.service.ts`
- `src/components/bom/SmartColumnMapper.tsx`
- `src/components/bom/ConfidenceBadge.tsx`
- `src/components/bom/MappingTemplateManager.tsx`
- `src/components/bom/MappingTemplateCard.tsx`
- `src/types/column-mapping.ts`
- `src/hooks/useColumnSuggestions.ts`
- `src/hooks/useMappingTemplates.ts`
- `src/test/column-mapping.test.ts`
- `src/test/smart-column-mapper.test.tsx`

**Modify:**
- `src/pages/boms/BomUpload.tsx` - Replace BOMColumnMapper with SmartColumnMapper
- `src/bom/BOMUploadWorkflow.tsx` - Wire new component
- `src/config/navigation.ts` - Add template management link (admin+)

#### 10. Test Cases
- Auto-detect "Part Number" → manufacturer_part_number (confidence >95%)
- Auto-detect "Qty" → quantity (confidence >90%)
- Fuzzy match "Mfr Part No" → manufacturer_part_number
- Handle unknown columns gracefully (suggest 'ignore')
- Template save/load cycle
- Template apply with partial match
- Bulk accept with mixed confidence
- Keyboard navigation through all mappings
```

---

### P0-2: Portfolio Dashboard for Owner Role

**Task ID:** P0-2
**Priority:** CRITICAL
**UX Impact:** Sarah's #1 use case - executive portfolio oversight
**Current Status:** PENDING
**Target Completion:** Full owner dashboard with aggregated metrics

#### Implementation Prompt

```markdown
## Task: Implement Portfolio Dashboard for Owner Role

### Context
Sarah Johnson (Owner persona) currently has no executive summary view. The existing dashboard is BOM-centric, requiring her to drill into individual BOMs to understand portfolio health. She needs a 5-minute daily check-in view on her iPad.

### Objective
Create a portfolio-level dashboard that:
1. Shows aggregated risk metrics across all BOMs
2. Displays cost/billing trends
3. Highlights critical alerts requiring attention
4. Provides team activity summary
5. Works flawlessly on iPad (tablet-first design)

### Technical Requirements

#### 1. Dashboard Layout
Create `src/pages/dashboard/PortfolioDashboard.tsx`:

```
┌─────────────────────────────────────────────────────────────────┐
│  Portfolio Overview                              [Export PDF]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Total BOMs │ │ At-Risk    │ │ Enrichment │ │ Cost MTD   │   │
│  │    47      │ │    12      │ │   92%      │ │  $2,340    │   │
│  │  ↑3 this   │ │  ↓2 this   │ │ avg score  │ │  vs $2.1k  │   │
│  │   week     │ │   week     │ │            │ │  budget    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Risk Distribution          │  Enrichment Activity (7d)        │
│  ┌─────────────────────┐   │  ┌─────────────────────────────┐  │
│  │  [Pie/Donut Chart]  │   │  │  [Area/Bar Chart - daily]   │  │
│  │  Low: 60%           │   │  │                             │  │
│  │  Medium: 25%        │   │  │                             │  │
│  │  High: 10%          │   │  │                             │  │
│  │  Critical: 5%       │   │  │                             │  │
│  └─────────────────────┘   │  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Critical Alerts (Action Required)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚠️ 3 BOMs have >10% obsolete components                  │   │
│  │ ⚠️ Enrichment quota at 85% (15% remaining)               │   │
│  │ ⚠️ 2 team members haven't logged in 14+ days             │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Recent Team Activity                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Emily uploaded "PCB-Rev-3.xlsx" - 2h ago                 │   │
│  │ David compared 5 components - 4h ago                     │   │
│  │ System enriched BOM-2024-047 - 6h ago                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Data Aggregation Service
Create `src/services/portfolio.service.ts`:

```typescript
interface PortfolioMetrics {
  totalBoms: number;
  bomsTrend: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
  atRiskBoms: number;
  atRiskTrend: { value: number; direction: 'up' | 'down' | 'flat' };
  avgEnrichmentScore: number;
  costMtd: number;
  costBudget: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  enrichmentActivity: Array<{
    date: string;
    count: number;
    cost: number;
  }>;
  criticalAlerts: Array<{
    id: string;
    type: 'obsolete' | 'quota' | 'inactive_user' | 'enrichment_failed';
    severity: 'warning' | 'error';
    message: string;
    actionUrl?: string;
  }>;
  recentActivity: Array<{
    id: string;
    userId: string;
    userName: string;
    action: string;
    target: string;
    timestamp: Date;
  }>;
}
```

#### 3. Widget Components
Create widget components in `src/components/dashboard/`:
- `MetricCard.tsx` - Single metric with trend indicator
- `RiskDistributionChart.tsx` - Pie/donut with legend
- `ActivityChart.tsx` - Time series with Recharts
- `AlertsList.tsx` - Critical alerts with actions
- `ActivityFeed.tsx` - Team activity timeline
- `ExportButton.tsx` - PDF export trigger

#### 4. Chart Library
Use Recharts (already in most Refine setups):
```typescript
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
```

Risk colors:
- Low: `#4caf50` (green)
- Medium: `#ff9800` (orange)
- High: `#f44336` (red)
- Critical: `#9c27b0` (purple)

#### 5. Role-Based Access
- Only show to `owner` and `super_admin` roles
- Add to navigation under "Overview > Portfolio"
- Default landing page for owner role users

#### 6. API Endpoints (Backend)
If CNS service doesn't have these, create aggregation endpoint:
- `GET /api/cns/portfolio/metrics` - Aggregated portfolio metrics
- `GET /api/cns/portfolio/alerts` - Critical alerts list
- `GET /api/cns/portfolio/activity` - Recent team activity

Or aggregate client-side from existing endpoints:
- `GET /api/cns/boms` - Get all BOMs with risk scores
- `GET /platform/users` - Get team activity
- `GET /platform/subscriptions` - Get usage/cost data

#### 7. Refresh Strategy
- Auto-refresh every 5 minutes
- Manual refresh button
- SWR/React Query for caching
- Optimistic UI updates

#### 8. Success Metrics
- Dashboard load time: <2s
- Daily active owners: track adoption
- Time on page: target 5 min (quick check-in)
- Click-through to alerts: >80%

#### 9. Accessibility Requirements
- Chart descriptions for screen readers
- Color-blind safe palette (patterns + colors)
- Keyboard navigation for all interactive elements
- High contrast mode support

#### 10. Files to Create
```
src/pages/dashboard/
├── PortfolioDashboard.tsx     # Main dashboard page
└── index.ts                   # Export

src/components/dashboard/
├── MetricCard.tsx             # KPI card with trend
├── RiskDistributionChart.tsx  # Pie chart
├── ActivityChart.tsx          # Line/area chart
├── AlertsList.tsx             # Alert cards
├── ActivityFeed.tsx           # Team activity
├── ExportButton.tsx           # PDF export
└── index.ts                   # Barrel export

src/services/
├── portfolio.service.ts       # Data aggregation

src/hooks/
├── usePortfolioMetrics.ts     # SWR hook for metrics
├── usePortfolioAlerts.ts      # SWR hook for alerts

src/types/
├── portfolio.ts               # Type definitions

src/test/
├── portfolio-dashboard.test.tsx
├── metric-card.test.tsx
├── risk-distribution-chart.test.tsx
```

#### 11. Modify Existing Files
- `src/config/navigation.ts` - Add Portfolio under Overview (owner+ only)
- `src/App.tsx` - Add route for /dashboard/portfolio
- `src/providers/accessControlProvider.ts` - Gate access to owner+
```

---

### P0-3: Tablet-Optimized Layouts (iPad)

**Task ID:** P0-3
**Priority:** CRITICAL
**UX Impact:** 8% → 25% tablet usage (Sarah's iPad workflow)
**Current Status:** PARTIAL (responsive exists, iPad-specific pending)
**Target Completion:** Full iPad Pro experience without horizontal scroll

#### Implementation Prompt

```markdown
## Task: Implement Tablet-Optimized Layouts for iPad

### Context
Sarah Johnson (Owner) uses an iPad Pro as her primary device. Current responsive design "shrinks" the desktop layout instead of redesigning for tablet. Tables don't reflow, touch targets are too small, and the dashboard requires horizontal scrolling.

### Objective
Create iPad-native layouts that:
1. Reflow tables into card-based views on tablet
2. Provide 48px minimum touch targets
3. Support landscape and portrait orientations
4. Enable swipe gestures for common actions
5. Optimize for iPad Pro 11" and 12.9"

### Technical Requirements

#### 1. Breakpoint Strategy
Update `tailwind.config.js`:
```javascript
screens: {
  'sm': '640px',      // Mobile landscape
  'md': '768px',      // Tablet portrait (iPad Mini)
  'lg': '1024px',     // Tablet landscape (iPad Pro 11")
  'xl': '1280px',     // Desktop / iPad Pro 12.9" landscape
  '2xl': '1536px',    // Large desktop
  // Custom tablet breakpoints
  'tablet': '768px',
  'tablet-lg': '1024px',
}
```

#### 2. Responsive Layout Components
Create `src/components/layout/ResponsiveContainer.tsx`:
```typescript
interface ResponsiveContainerProps {
  children: React.ReactNode;
  desktopLayout: React.ReactNode;
  tabletLayout: React.ReactNode;
  mobileLayout?: React.ReactNode;
}
```

#### 3. Table-to-Card Pattern
Create `src/components/shared/ResponsiveTable.tsx`:
- Desktop: Traditional table with columns
- Tablet: Card grid (2 columns on landscape, 1 on portrait)
- Mobile: Full-width cards

Example card layout for BOM list:
```
┌────────────────────────────────┐
│ PCB-Rev-3.xlsx         [⚠️ High] │
│ 156 components • 92% enriched   │
│ Updated 2h ago by Emily        │
│ [View] [Enrich] [Export] [...] │
└────────────────────────────────┘
```

#### 4. Touch-Friendly Components
Ensure all interactive elements meet 48x48px minimum:

```typescript
// Button sizes
const touchTargets = {
  sm: 'min-h-[44px] min-w-[44px]',  // Minimum iOS guideline
  md: 'min-h-[48px] min-w-[48px]',  // Recommended
  lg: 'min-h-[56px] min-w-[56px]',  // Comfortable
};
```

Update components:
- Buttons: Add `touch-target` class
- Links: Increase padding
- Dropdowns: Larger hit areas
- Checkboxes: Bigger touch area wrapper

#### 5. Navigation Adaptation
Tablet navigation pattern:
- Portrait: Collapsible sidebar (hamburger)
- Landscape: Slim sidebar (icons only, expand on hover)
- Gesture: Swipe from left edge to open nav

Create `src/hooks/useTabletNavigation.ts`:
```typescript
interface TabletNavigationState {
  isExpanded: boolean;
  orientation: 'portrait' | 'landscape';
  canSwipe: boolean;
  toggle: () => void;
}
```

#### 6. Gesture Support
Add swipe gestures using `@use-gesture/react`:
- Swipe left on BOM card: Quick actions menu
- Swipe right: Mark as reviewed
- Pull down: Refresh
- Pinch: Zoom charts

Create `src/hooks/useSwipeActions.ts`:
```typescript
interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}
```

#### 7. Orientation Handling
Create `src/hooks/useOrientation.ts`:
```typescript
function useOrientation(): 'portrait' | 'landscape' {
  // Use window.matchMedia for orientation detection
  // Return current orientation
  // Listen for changes
}
```

Layout adaptations:
- Portrait: Stack charts vertically
- Landscape: Side-by-side charts
- Dynamic column counts in grids

#### 8. iPad-Specific CSS
Create `src/styles/tablet.css`:
```css
/* iPad-specific overrides */
@media (min-width: 768px) and (max-width: 1024px) {
  /* Touch-friendly spacing */
  .touch-target {
    min-height: 48px;
    min-width: 48px;
    padding: 12px;
  }

  /* Prevent text selection on interactive elements */
  .no-select {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Smooth scrolling */
  .scroll-container {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* Safe area insets for notch */
  .safe-area-padding {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

#### 9. Components to Update/Create

**Create:**
```
src/components/layout/
├── ResponsiveContainer.tsx    # Layout switcher
├── TabletNavigation.tsx       # Collapsible sidebar
├── SwipeableCard.tsx          # Card with swipe actions
└── TouchTarget.tsx            # Touch-friendly wrapper

src/components/shared/
├── ResponsiveTable.tsx        # Table/card hybrid
├── ResponsiveDataGrid.tsx     # TanStack table + cards
├── CardView.tsx               # Generic card layout
└── PullToRefresh.tsx          # Pull gesture handler

src/hooks/
├── useTabletNavigation.ts
├── useOrientation.ts
├── useSwipeActions.ts
├── useTouchDevice.ts
└── useSafeAreaInsets.ts

src/styles/
├── tablet.css                 # Tablet-specific styles
```

**Modify:**
```
src/pages/boms/BomList.tsx         # Add card view toggle
src/pages/dashboard/Dashboard.tsx  # Responsive widget grid
src/pages/components/ComponentList.tsx  # Card view option
src/components/layout/Layout.tsx   # Tablet nav integration
src/components/layout/Sidebar.tsx  # Collapsible behavior
```

#### 10. Testing Matrix

| Device | Orientation | Test Focus |
|--------|-------------|------------|
| iPad Mini | Portrait | Minimum supported size |
| iPad Mini | Landscape | 2-column layout |
| iPad Pro 11" | Portrait | Primary target |
| iPad Pro 11" | Landscape | Full experience |
| iPad Pro 12.9" | Portrait | Large tablet |
| iPad Pro 12.9" | Landscape | Near-desktop |

#### 11. Success Metrics
- No horizontal scroll on any tablet view
- All touch targets ≥48px
- Orientation change: <100ms reflow
- Touch gesture success rate: >95%
- User satisfaction: iPad workflow without laptop

#### 12. Accessibility Requirements
- VoiceOver support for swipe actions
- Reduce motion: Disable swipe animations
- Large text support: Layout doesn't break
- Pointer hover states work on iPad with trackpad
```

---

### Mini-Prompts for Future Development

**Theme/UI:**
> "Design a BOM-first dashboard in Refine/Shadcn with clear hierarchy: left nav, tenant switcher, BOM cards/table, and status badges; keep neutral palette with accent for actions; responsive layout; support light/dark/mid themes."

**User Profile:**
> "Build a profile/settings page that reads Keycloak claims (name/email) and exposes password reset link via Keycloak, plus local preferences (theme, table density). No local password storage; all identity edits go through Keycloak."

**Org Management:**
> "Create tenant-scoped team management: list members, roles, pending invites; send invites via tenant-management-service; role dropdown limited to analyst/engineer/admin/owner; no cross-tenant edits; show plan info read-only from subscription-service."

### Parity Checklist (Legacy CBP → New CBP)

| Area | Status | Notes |
|------|--------|-------|
| Navigation/Search | DONE | GlobalSearch with Cmd/K |
| BOM Re-enrichment | DONE | Progress polling, stale detection |
| BOM Version History | DONE | ActivityLog with 18 event types |
| BOM Delete Safeguards | DONE | Type-to-confirm + audit |
| Component Search | DONE | URL state, LRU cache |
| Component Compare | DONE | ComponentCompareView |
| Risk Analysis | DONE | Export to CSV/JSON |
| Billing Portal | DONE | Error handling, circuit breaker |
| Team/Invites | DONE | Role dropdown, confirmations |
| Cross-tab Session | DONE | BroadcastChannel + localStorage |
| User Registration Flow | DONE | Return URL resilience |
| User Invitation Flow | DONE | AcceptInvitation page |
| Notifications | DEFERRED | Novu inbox post-MVP |
| Profile/Preferences | CLOSED | Keycloak account page |
| i18n | CLOSED | English only |

### UX Enhancement Checklist (from Research Report)

| Area | Status | Target | UX Impact |
|------|--------|--------|-----------|
| Portfolio Dashboard | PENDING | P0 | Owner executive view |
| Smart Column Mapping | PARTIAL | P0 | 15 min → 3 min mapping |
| Tablet Optimization | PARTIAL | P0 | 8% → 25% tablet usage |
| WCAG 2.1 AA | PARTIAL | P0 | 68% → 100% compliance |
| Onboarding Checklist | PENDING | P0 | 35 min → 8 min onboarding |
| Navigation Restructure | PENDING | P0 | 5 groups, -50% cognitive load |
| Parametric Search | PARTIAL | P1 | 847 → 37 results |
| Unlimited Comparison | PENDING | P1 | Remove 5-item limit |
| Saved Searches | PENDING | P1 | Prevent re-work |
| Bulk Actions | PENDING | P1 | 20+ items at once |
| Risk Trend Charts | PENDING | P1 | Owner trend visibility |

---

## Appendix: File Index

### Pages
| File | Purpose |
|------|---------|
| `src/pages/Dashboard.tsx` | Main dashboard |
| `src/pages/boms/BomList.tsx` | BOM grid |
| `src/pages/boms/BomDetail.tsx` | BOM detail view |
| `src/pages/boms/BomUpload.tsx` | Upload wizard |
| `src/pages/boms/RiskAnalysis.tsx` | Risk analysis |
| `src/pages/components/ComponentList.tsx` | Component catalog |
| `src/pages/components/ComponentCompareView.tsx` | Comparison |
| `src/pages/team/index.tsx` | Team members |
| `src/pages/team/invitations.tsx` | Invitations |
| `src/pages/billing/index.tsx` | Billing |
| `src/pages/billing/invoices.tsx` | Invoice history |
| `src/pages/settings/organization.tsx` | Org settings |
| `src/pages/workspaces/WorkspaceList.tsx` | Workspaces |
| `src/pages/auth/Login.tsx` | Login |
| `src/pages/auth/Callback.tsx` | OIDC callback |
| `src/pages/auth/AcceptInvitation.tsx` | Invitation acceptance |
| `src/pages/Landing.tsx` | Public landing |

### Services
| File | Purpose |
|------|---------|
| `src/services/bom.service.ts` | BOM operations |
| `src/services/billing.service.ts` | Billing/Stripe |
| `src/services/component.service.ts` | Component catalog |
| `src/services/organization.service.ts` | Org management |
| `src/services/risk.service.ts` | Risk analysis |
| `src/services/supplier.service.ts` | Supplier data |
| `src/services/team.service.ts` | Team/invitations |
| `src/services/workspace.service.ts` | Workspaces |

### Types
| File | Purpose |
|------|---------|
| `src/types/activity.ts` | Activity events |
| `src/types/bom.ts` | BOM types |
| `src/types/component.ts` | Component types |
| `src/types/organization.ts` | Organization types |
| `src/types/risk.ts` | Risk types |
| `src/types/subscription.ts` | Subscription types |
| `src/types/supplier.ts` | Supplier types |
| `src/types/team.ts` | Team types |
| `src/types/tenant.ts` | Tenant types |
| `src/types/workspace.ts` | Workspace types |

### Components
| File | Purpose |
|------|---------|
| `src/components/bom/ActivityLog.tsx` | Activity timeline |
| `src/components/bom/ComponentLinkDrawer.tsx` | Link drawer |
| `src/components/bom/DeleteBomDialog.tsx` | Delete confirmation |
| `src/components/shared/GlobalSearch.tsx` | Site search |
| `src/components/shared/ListSkeletons.tsx` | Loading states |
| `src/components/shared/RouteErrorBoundary.tsx` | Error handling |
| `src/components/team/MemberCard.tsx` | Team member card |
| `src/components/team/InviteModal.tsx` | Invite form |
| `src/components/team/RoleDropdown.tsx` | Role selector |
| `src/components/billing/SubscriptionCard.tsx` | Subscription display |
| `src/components/billing/UsageMetricsCard.tsx` | Usage progress |

---

*Document maintained as source of truth for CBP UI development.*
