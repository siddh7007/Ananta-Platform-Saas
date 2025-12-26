# CBP Refine Customer Portal - UX Analysis Report

**Analysis Date:** 2025-12-14
**Location:** `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal`
**Version:** 1.0.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Page Inventory](#page-inventory)
4. [Navigation Structure](#navigation-structure)
5. [User Workflows](#user-workflows)
6. [Information Architecture](#information-architecture)
7. [User Interaction Patterns](#user-interaction-patterns)
8. [Pain Points & UX Issues](#pain-points--ux-issues)
9. [Accessibility Analysis](#accessibility-analysis)
10. [Recommendations](#recommendations)

---

## Executive Summary

The CBP Refine Customer Portal is a modern React application built on **Refine.dev** framework for electronic component management, BOM analysis, and supply chain risk monitoring. It replaces the older React Admin-based customer portal with a cleaner architecture and improved developer experience.

### Key Metrics

| Metric | Count |
|--------|-------|
| Total Pages | 25+ |
| Main Routes | 18 |
| Refine Resources | 10 |
| Navigation Items | 11 |
| Data Providers | 3 |
| Contexts | 3 |
| UI Components | 35+ |

### Architecture Highlights
- **3-Provider Architecture:** Platform API, CNS Service, Supabase
- **Role-Based Access Control:** 5-level hierarchy (analyst < engineer < admin < owner < super_admin)
- **Multi-Tenant:** TenantContext with tenant switching
- **Modern UI:** shadcn/ui + Radix UI + Tailwind CSS

---

## Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Refine.dev | 4.47+ | Data/CRUD Framework |
| React Router | v6 | Client Routing |
| TypeScript | 5.x | Type Safety |

### UI Libraries
| Library | Purpose |
|---------|---------|
| shadcn/ui | Component Primitives |
| Radix UI | Accessible Primitives |
| Tailwind CSS | Utility-First Styling |
| Lucide React | Icon Library |
| class-variance-authority | Component Variants |

### Data & Auth
| Service | Purpose | Provider Name |
|---------|---------|---------------|
| Platform API | Tenants, Users, Billing | `platform` |
| CNS Service | BOMs, Components, Enrichment | `cns` |
| Supabase | Component Catalog | `supabase` |
| Keycloak | OIDC Authentication | - |
| Novu | Real-time Notifications | - |

---

## Page Inventory

### Authentication Pages (4 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Landing | `/landing` | `pages/Landing.tsx` | Marketing landing page | Public |
| Login | `/login` | `pages/auth/Login.tsx` | Keycloak SSO login | Public |
| Callback | `/authentication/callback` | `pages/auth/Callback.tsx` | OIDC redirect handler | Public |
| Accept Invitation | `/invitations/:token` | `pages/auth/AcceptInvitation.tsx` | Team invitation acceptance | Public |

### Dashboard Pages (1 page)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Dashboard | `/` | `pages/Dashboard.tsx` | Main dashboard with stats | All users |

### BOM Management Pages (5 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| BOM List | `/boms` | `pages/boms/BomList.tsx` | List all BOMs | Analyst+ |
| BOM Upload | `/boms/upload` `/boms/create` | `pages/boms/BomUpload.tsx` | Upload wizard | Engineer+ |
| BOM Detail | `/boms/:id` | `pages/boms/BomDetail.tsx` | BOM details view | Analyst+ |
| Risk Analysis | `/boms/:id/risk` | `pages/boms/RiskAnalysis.tsx` | BOM risk breakdown | Analyst+ |

### Component Pages (3 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Component List | `/components` | `pages/components/ComponentList.tsx` | Search components | Analyst+ |
| Component Compare | `/components/compare` | `pages/components/ComponentCompareView.tsx` | Side-by-side comparison | Analyst+ |
| Component Detail | `/components/:id` | `pages/components/ComponentDetailDrawer.tsx` | Component drawer | Analyst+ |

### Project Management (3 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Project List | `/projects` | `pages/projects/ProjectList.tsx` | All projects | Analyst+ |
| Project Detail | `/projects/:id` | `pages/projects/ProjectDetail.tsx` | Project view | Analyst+ |
| Create Project | `/projects/create` | `pages/projects/ProjectCreate.tsx` | New project form | Engineer+ |

### Workspace Management (1 page)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Workspace List | `/workspaces` | `pages/workspaces/WorkspaceList.tsx` | All workspaces | Analyst+ |

### Risk & Alerts (2 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Risk Dashboard | `/risk` | `pages/risk/RiskDashboard.tsx` | Portfolio risk overview | Analyst+ |
| Alerts Dashboard | `/alerts` | `pages/alerts/AlertsDashboard.tsx` | Alert inbox | Analyst+ |

### Team Management (2 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Team Members | `/team` | `pages/team/index.tsx` | Member directory (view) | All users (view), Admin+ (manage) |
| Invitations | `/team/invitations` | `pages/team/invitations.tsx` | Pending invites | Admin+ |

### Billing Pages (3 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Billing Overview | `/billing` | `pages/billing/index.tsx` | Subscription status | All users (view) |
| Usage | `/billing/usage` | `pages/billing/usage.tsx` | Usage metrics | All users (view) |
| Invoices | `/billing/invoices` | `pages/billing/invoices.tsx` | Invoice history | All users (view) |

### Settings Pages (3 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Settings | `/settings` | `pages/settings/index.tsx` | Settings hub | Analyst+ |
| Organization | `/settings/organization` | `pages/settings/organization.tsx` | Org settings | Analyst+ (view) / Admin+ (edit) |
| Preferences | `/settings/preferences` | `pages/settings/preferences.tsx` | User preferences | Analyst+ |

---

## Navigation Structure

### Sidebar Navigation (from navigation.ts)

```
[Dashboard] (/)                    analyst+
[Workspaces] (/workspaces)        analyst+
[Projects] (/projects)             analyst+
  ├── All Projects
  └── New Project                  engineer+
[BOMs] (/boms)                     analyst+
  ├── All BOMs
  └── Upload BOM                   engineer+
[Components] (/components)         analyst+
[Risk Analysis] (/risk)            analyst+
[Alerts] (/alerts)                 analyst+
[Team] (/team)                     analyst+ (view)
  ├── Members
  ├── Invitations                   admin+
  └── Activity                       analyst+ (view)
[Billing] (/billing)               analyst+ (view)
  ├── Overview
  ├── Usage
  └── Invoices                      analyst+ (view)
[Settings] (/settings)             analyst+
  ├── Organization
  └── Preferences

[Admin Panel] (/admin)             super_admin only
  ├── All Tenants
  └── All Users
```

### Header Components (from Layout.tsx)

| Component | Position | Purpose |
|-----------|----------|---------|
| Global Search Trigger | Center-right | Opens search dialog |
| Notification Center | Right | Novu notification bell |
| Theme Selector | Right | Light/Dark/System toggle |
| Tenant Selector | Right | Switch tenants |
| User Avatar | Far Right | Profile, role display |
| Mobile Menu Button | Left (mobile) | Toggle sidebar |

### Role-Based Navigation Filtering

Navigation items are filtered by `hasMinimumRole()` function:

| Role | Visible Nav Items |
|------|-------------------|
| analyst | Dashboard, Workspaces, Projects, BOMs, Components, Risk, Alerts, Team (view), Billing (view), Settings |
| engineer | All above + Upload BOM, Create Project |
| admin | All above + Team Management (invite/manage) |
| owner | All above + Billing (full access) |
| super_admin | All above + Admin Panel |

---

## User Workflows

### Workflow 1: BOM Upload (7 Steps)

**Entry:** Sidebar → BOMs → Upload BOM
**File:** `pages/boms/BomUpload.tsx`

```
1. Start Upload
   └── Click "Upload BOM" button

2. Select File
   ├── Drag & drop zone
   ├── File browser
   └── Supports: CSV, XLS, XLSX

3. Configure Options
   ├── Select Project (dropdown)
   ├── BOM Name (auto-generated)
   └── Description (optional)

4. Column Mapping
   ├── Auto-detect columns
   ├── Manual mapping UI
   └── Required: MPN, Manufacturer, Qty

5. Preview Data
   ├── First 10 rows preview
   ├── Validation errors shown
   └── Edit before submit

6. Submit & Process
   ├── Upload to CNS service
   ├── Progress indicator
   └── SSE for real-time updates

7. Complete
   ├── Success notification
   └── Navigate to BOM detail
```

### Workflow 2: Component Search (5 Steps)

**Entry:** Sidebar → Components
**File:** `pages/components/ComponentList.tsx`

```
1. Enter Search
   └── Search box with filters

2. Apply Filters
   ├── Category
   ├── Manufacturer
   ├── Lifecycle status
   └── Stock availability

3. View Results
   ├── Grid/List view
   ├── Sort options
   └── Pagination

4. Select Component
   └── Opens ComponentDetailDrawer

5. Actions
   ├── Add to Compare (max 4)
   ├── Add to BOM
   └── View alternatives
```

### Workflow 3: Compare Components (4 Steps)

**Entry:** Component List → Add to Compare
**File:** `pages/components/ComponentCompareView.tsx`

```
1. Select Components
   └── Add 2-4 components from search

2. Navigate to Compare
   └── "/components/compare" route

3. Review Comparison
   ├── Side-by-side specs
   ├── Pricing comparison
   ├── Availability
   └── Risk scores

4. Take Action
   ├── Select winner
   ├── Add to BOM
   └── Export comparison
```

### Workflow 4: Team Invitation (5 Steps)

**Entry:** Sidebar → Team → Invite
**File:** `pages/team/index.tsx`, `components/team/InviteModal.tsx`

```
1. Open Invite Modal
   └── Click "Invite" button

2. Enter Details
   ├── Email address(es)
   ├── Select role
   └── Optional message

3. Send Invitation
   └── API call to platform

4. Track Status
   ├── View pending invites
   ├── Resend option
   └── Revoke option

5. User Accepts
   └── Via /invitations/:token route
```

### Workflow 5: Billing Management (4 Steps)

**Entry:** Sidebar → Billing
**File:** `pages/billing/index.tsx`

```
1. View Overview
   ├── Current plan
   ├── Usage summary
   └── Next billing date

2. Check Usage
   ├── BOM count
   ├── Component lookups
   └── API calls

3. View Invoices
   ├── Invoice history
   ├── Download PDF
   └── Payment status

4. Manage Subscription
   ├── Upgrade/Downgrade
   └── Contact support
```

---

## Information Architecture

### Refine Resources (from App.tsx)

| Resource | List Route | Show Route | Create Route | Data Provider |
|----------|------------|------------|--------------|---------------|
| dashboard | `/` | - | - | platform |
| boms | `/boms` | `/boms/:id` | `/boms/create` | cns |
| components | `/components` | `/components/:id` | - | supabase |
| team | `/team` | - | - | platform |
| billing | `/billing` | - | - | platform |
| workspaces | `/workspaces` | `/workspaces/:id` | `/workspaces/new` | platform |
| projects | `/projects` | `/projects/:id` | `/projects/create` | platform |
| risk | `/risk` | - | - | cns |
| alerts | `/alerts` | - | - | cns |
| settings | `/settings` | - | - | platform |

### Context Providers

| Context | File | Purpose |
|---------|------|---------|
| AuthContext | `contexts/AuthContext.tsx` | User auth state, login/logout |
| TenantContext | `contexts/TenantContext.tsx` | Multi-tenant switching |
| NotificationContext | `contexts/NotificationContext.tsx` | Novu notifications |

### Data Flow

```
User Action
    ↓
Refine Hook (useList, useCreate, etc.)
    ↓
dataProvider selection (by resource meta)
    ↓
API Call (platform / cns / supabase)
    ↓
Response
    ↓
UI Update
```

---

## User Interaction Patterns

### Form Submission Pattern

```typescript
// Standard pattern using Refine hooks
const { mutate } = useCreate();

const handleSubmit = (data) => {
  mutate({
    resource: 'boms',
    values: data,
    meta: { dataProviderName: 'cns' }
  });
};
```

### Table Interactions

| Action | Implementation |
|--------|----------------|
| Sort | Column header click |
| Filter | Filter panel (sidebar) |
| Paginate | Bottom pagination controls |
| Select | Row checkbox |
| View | Row click → drawer/navigate |

### Loading States

| Type | Component |
|------|-----------|
| Page loading | `PageLoading` skeleton |
| List loading | `ListSkeletons` |
| Button loading | Button with spinner |
| Data fetching | Skeleton placeholders |

### Error Handling

| Type | Component |
|------|-----------|
| Route errors | `RouteErrorBoundary` |
| Global errors | `ErrorBoundary` |
| Tenant errors | `TenantErrorScreen` |
| Form errors | Inline validation |

---

## Pain Points & UX Issues

### High Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 1 | **No breadcrumb navigation** | All pages | Users lose context in deep pages | Add breadcrumb component using `getBreadcrumbs()` from navigation.ts |
| 2 | **Project selection required** | BOM Upload | Upload fails without project | Add project creation inline or preselect default |
| 3 | **Limited search** | Component search | Basic text only | Add parametric/spec-based search |
| 4 | **No bulk actions** | BOM List | Can't operate on multiple BOMs | Add multi-select with batch operations |

### Medium Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 5 | **Missing empty states** | Various lists | Confusing for new users | Add helpful empty states with CTAs |
| 6 | **No keyboard shortcuts** | Global | Power users slowed | Add Cmd+K command palette |
| 7 | **Mobile nav depth** | Sidebar | Nested items hard to tap | Consider bottom nav for mobile |
| 8 | **Notification overload** | NotificationCenter | Too many notifications | Add smart grouping/batching |

### Low Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 9 | **No dark mode persistence** | Theme | Resets on refresh | Use localStorage for theme |
| 10 | **Missing loading indicators** | Forms | User unsure if action taken | Add consistent loading states |

---

## Accessibility Analysis

### Strengths

- Radix UI provides excellent baseline accessibility
- Proper focus management in dialogs
- Semantic HTML structure
- Color contrast follows WCAG guidelines
- Keyboard navigation for dropdowns

### Areas for Improvement

| Area | Issue | WCAG | Fix |
|------|-------|------|-----|
| **Focus Visible** | Some buttons lack visible focus | 2.4.7 | Add focus-visible ring |
| **Skip Links** | No skip-to-content | 2.4.1 | Add skip link to main |
| **Live Regions** | Toasts may not announce | 4.1.3 | Add aria-live to Toaster |
| **Form Labels** | Some inputs missing labels | 1.3.1 | Associate all labels |
| **Color Only** | Status relies on color | 1.4.1 | Add icons to status badges |

### Recommended Testing

1. Screen reader testing (NVDA, VoiceOver, JAWS)
2. Keyboard-only navigation audit
3. axe-core automated scanning
4. Color contrast verification
5. Reduced motion preferences

---

## Recommendations

### Immediate (Sprint 1-2)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Add breadcrumb navigation | 2 days | High |
| P0 | Implement empty states | 2 days | Medium |
| P0 | Fix loading indicators | 1 day | Medium |
| P1 | Add keyboard shortcuts (Cmd+K) | 3 days | Medium |
| P1 | Improve mobile navigation | 2 days | Medium |

### Short-Term (Sprint 3-6)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P1 | Add parametric component search | 1 week | High |
| P1 | Implement bulk BOM operations | 1 week | Medium |
| P2 | Add saved searches | 3 days | Medium |
| P2 | Notification batching | 3 days | Low |
| P2 | Persist theme preference | 1 day | Low |

### Long-Term (Future Sprints)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P2 | Real-time collaboration | 3 weeks | High |
| P2 | AI-powered component recommendations | 2 weeks | Medium |
| P3 | Offline support (PWA) | 2 weeks | Medium |
| P3 | Advanced analytics dashboard | 2 weeks | Medium |

---

## Appendix A: File References

### Key Configuration Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main routes, Refine setup |
| `src/config/env.ts` | Environment variables |
| `src/config/auth.ts` | OIDC, roles, permissions |
| `src/config/navigation.ts` | Navigation manifest |

### Key Components

| Component | File |
|-----------|------|
| Layout | `src/components/layout/Layout.tsx` |
| Theme Selector | `src/components/theme/ThemeSelector.tsx` |
| Tenant Selector | `src/components/tenant/TenantSelector.tsx` |
| Notification Center | `src/components/notifications/NotificationCenter.tsx` |
| Global Search | `src/components/shared/GlobalSearch.tsx` |

### Page Entry Points

| Page | File |
|------|------|
| Dashboard | `src/pages/Dashboard.tsx` |
| BOM List | `src/pages/boms/BomList.tsx` |
| BOM Upload | `src/pages/boms/BomUpload.tsx` |
| Component List | `src/pages/components/ComponentList.tsx` |
| Risk Dashboard | `src/pages/risk/RiskDashboard.tsx` |

---

## Appendix B: Comparison with Old CBP

| Feature | Old CBP (React Admin) | New CBP (Refine) |
|---------|----------------------|------------------|
| Framework | React Admin 4.x | Refine.dev 4.x |
| UI Library | Material-UI 5.x | shadcn/ui + Radix |
| Styling | MUI sx prop | Tailwind CSS |
| Icons | MUI Icons | Lucide React |
| Data Fetching | React Admin hooks | Refine hooks |
| Auth | Auth0/Supabase | Keycloak OIDC |
| Pages | 61 pages | 25 pages (streamlined) |
| Bundle Size | Larger (MUI) | Smaller (tree-shaking) |
| Dev Experience | Good | Better (TypeScript) |

### Migration Notes

- Navigation moved from hardcoded to config-driven
- Role system aligned with 5-level hierarchy
- Data providers consolidated into 3 clear sources
- UI components are now accessible by default (Radix)

---

**Prepared by:** Claude Code
**Date:** 2025-12-14
**Status:** Complete UX Analysis
**Next Steps:** Implement recommendations by priority
