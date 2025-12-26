# Customer Business Portal (CBP) - UX Analysis Report

**Analysis Date:** 2025-12-14
**Location:** `e:\Work\Ananta-Platform-Saas\app-plane\services\customer-portal`
**Version:** 1.0.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Page Inventory](#page-inventory)
3. [Navigation Structure](#navigation-structure)
4. [User Workflows](#user-workflows)
5. [Information Architecture](#information-architecture)
6. [User Interaction Patterns](#user-interaction-patterns)
7. [Pain Points & UX Issues](#pain-points--ux-issues)
8. [Accessibility Analysis](#accessibility-analysis)
9. [Recommendations](#recommendations)

---

## Executive Summary

The Customer Business Portal (CBP) is a React Admin-based application for electronic component management, BOM (Bill of Materials) analysis, and supply chain risk monitoring. The portal serves engineering teams managing hardware product development.

### Key Statistics
| Metric | Count |
|--------|-------|
| Total Pages/Views | 61 |
| Main Routes | 27 |
| React Admin Resources | 8 |
| Custom Components | 50+ |
| User Workflows | 8 major |

### Technology Stack
- **Framework:** React Admin 4.x with Material-UI 5.x
- **Auth:** Auth0 / Keycloak / Supabase (configurable)
- **State:** React Context + React Admin hooks
- **Data:** Supabase PostgreSQL with RLS
- **Real-time:** Server-Sent Events (SSE)
- **Notifications:** Novu integration

---

## Page Inventory

### Core Dashboard Pages

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Dashboard | `/` | `pages/Dashboard.tsx` | Main landing, quick stats | All users |
| Portfolio Dashboard | `/portfolio` | `pages/PortfolioDashboardPage.tsx` | Org-wide BOM/risk overview | Admin |
| Admin Console | `/admin/console` | `pages/AdminConsole.tsx` | Admin operations hub | Admin |

### BOM Management Pages (10 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| BOM List | `/boms` | `resources/boms/BOMList.tsx` | View all BOMs | Admin |
| BOM Upload | `/bom/upload` | `bom/BOMUploadWorkflow.tsx` | Unified upload pipeline | Engineer+ |
| BOM Enrichment | `/bom/enrichment` | `pages/BOMEnrichment.tsx` | Enrichment progress | Engineer+ |
| BOM Audit Stream | `/bom/audit` | `pages/BOMAuditStream.tsx` | Real-time audit log | Engineer+ |
| Column Mapper | `/bom/column-mapping` | `pages/SmartColumnMapperPage.tsx` | Smart column mapping | Engineer+ |
| CNS Job Status | `/cns-jobs/:jobId` | `pages/CNSJobStatusPage.tsx` | Job progress tracking | All users |
| BOM Show | `/boms/:id/show` | `resources/boms/BOMShow.tsx` | BOM details view | All users |
| BOM Edit | `/boms/:id/edit` | `resources/boms/BOMEdit.tsx` | Edit BOM metadata | Engineer+ |
| BOM Create | `/boms/create` | `resources/boms/BOMCreate.tsx` | Create BOM manually | Engineer+ |
| BOM Jobs | `/bom_jobs` | `resources/bom_jobs/` | Job queue management | Admin |

### Component Discovery Pages (8 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Component Search | `/components/search` | `pages/ComponentSearch.tsx` | Global component search | All users |
| Component Vault | `/components/vault` | `pages/OrganizationComponentVault.tsx` | Organization component library | All users |
| Project Catalog | `/project/components` | `pages/ProjectComponentCatalog.tsx` | Project-specific components | All users |
| Comparison Tray | (embedded) | `pages/discovery/ComparisonTray.tsx` | Side-by-side comparison | All users |
| Component Filters | (embedded) | `pages/discovery/ComponentFilters.tsx` | Advanced filtering | All users |
| Parametric Search | (embedded) | `pages/discovery/ParametricSearchPanel.tsx` | Parameter-based search | All users |
| Saved Searches | (embedded) | `pages/discovery/SavedSearches.tsx` | Saved search queries | All users |
| Send to Vault | (drawer) | `pages/discovery/SendToVaultDrawer.tsx` | Add to component library | Engineer+ |

### Risk & Alert Pages (12 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Risk Dashboard | `/risk` | `pages/RiskDashboard.tsx` | Risk overview | All users |
| Risk Settings | `/risk/settings` | `pages/RiskProfileSettings.tsx` | Risk factor configuration | Admin |
| Alert Center | `/alerts` | `pages/AlertCenter.tsx` | Alert inbox/management | All users |
| Alert Preferences | `/alerts/preferences` | `pages/AlertPreferences.tsx` | Alert notification settings | All users |
| Notification Inbox | `/inbox` | `pages/NotificationInbox.tsx` | Novu notification center | All users |
| Portfolio Overview | (tab) | `pages/risk/PortfolioOverview.tsx` | Portfolio-level risk | Admin |
| Project Risk | (tab) | `pages/risk/ProjectRiskOverview.tsx` | Project-level risk | All users |
| BOM Risk | (tab) | `pages/risk/BomRiskOverview.tsx` | BOM-level risk | All users |
| High Risk Table | (component) | `pages/risk/HighRiskTable.tsx` | Critical components list | All users |
| Mitigation Drawer | (drawer) | `pages/risk/MitigationDrawer.tsx` | Risk mitigation actions | Engineer+ |
| Risk Trend Chart | (component) | `pages/risk/PortfolioRiskTrendChart.tsx` | Historical risk trends | All users |
| Timeline Comparison | (component) | `pages/risk/TimelineComparison.tsx` | Risk timeline analysis | All users |

### Alert Sub-Components (7 components)

| Component | File | Purpose |
|-----------|------|---------|
| Alert List | `pages/alerts/AlertList.tsx` | Paginated alert list |
| Alert List Item | `pages/alerts/AlertListItem.tsx` | Single alert row |
| Alert Detail Panel | `pages/alerts/AlertDetailPanel.tsx` | Alert details drawer |
| Alert Filters | `pages/alerts/AlertFilters.tsx` | Alert filtering UI |
| Alert Stats Cards | `pages/alerts/AlertStatsCards.tsx` | Summary statistics |
| Alert Type Summary | `pages/alerts/AlertTypeSummary.tsx` | By-type breakdown |
| Alert Batch Actions | `pages/alerts/AlertBatchActions.tsx` | Bulk operations |

### Account & Settings Pages (8 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Account Settings | `/account/settings` | `pages/AccountSettings.tsx` | User profile/security | All users |
| Organization Settings | `/admin/organization-settings` | `pages/OrganizationSettings.tsx` | Org configuration | Admin |
| Billing | `/billing` | `pages/Billing.tsx` | Subscription management | Admin |
| Profile (redirect) | `/profile` | (redirects to account/settings) | Legacy route | All users |
| Account Setup Wizard | (embedded) | `pages/account/AccountSetupWizard.tsx` | New user onboarding | New users |
| Onboarding Progress | (embedded) | `pages/account/OnboardingProgress.tsx` | Setup checklist | New users |
| Security Completeness | (embedded) | `pages/account/SecurityCompleteness.tsx` | Security score | All users |
| Theme Settings | `/theme` | (redirects to account/settings) | Theme preferences | All users |

### Admin Sub-Pages (5 pages)

| Page | File | Purpose | Access |
|------|------|---------|--------|
| Admin Audit Log | `pages/admin/AdminAuditLog.tsx` | Activity audit trail | Admin |
| Admin Compliance Panel | `pages/admin/AdminCompliancePanel.tsx` | Compliance status | Admin |
| Admin Pending Invites | `pages/admin/AdminPendingInvites.tsx` | Invitation management | Admin |
| Admin Risk Summary | `pages/admin/AdminRiskSummary.tsx` | Risk metrics | Admin |
| Admin Usage Metrics | `pages/admin/AdminUsageMetrics.tsx` | Usage analytics | Admin |

### Team & Collaboration (2 pages)

| Page | Route | File | Purpose | Access |
|------|-------|------|---------|--------|
| Team Management | (embedded in admin) | `pages/team/TeamManagement.tsx` | User management | Admin |
| User Invite Flow | (modal) | `components/InviteUserDialog.tsx` | Invite team members | Admin |

### Vault Management (4 components)

| Component | File | Purpose | Access |
|-----------|------|---------|--------|
| Vault Kanban | `pages/vault/VaultKanban.tsx` | Kanban board view | All users |
| Vault Stage Column | `pages/vault/VaultStageColumn.tsx` | Kanban column | All users |
| Vault Component Card | `pages/vault/VaultComponentCard.tsx` | Component card | All users |
| Bulk Approval Toolbar | `pages/vault/BulkApprovalToolbar.tsx` | Bulk actions | Engineer+ |

### Specialized Views (2 pages)

| Page | File | Purpose | Access |
|------|------|---------|--------|
| Tablet Optimized BOM List | `pages/examples/TabletOptimizedBOMList.tsx` | Touch-optimized | All users |

---

## Navigation Structure

### Main Sidebar Menu (from App.tsx:646-845)

```
[Organization Switcher]
  └── Current Org: {name}
  └── Current Workspace: {name}

[Dashboard]

[Projects ({count})]  ← Collapsible
  ├── Project A
  │   ├── Upload BOM
  │   ├── Enrichment
  │   ├── Components
  │   └── Pending/Processing counts
  ├── Project B
  └── ...

[Components]
  ├── Search Components → /components/search
  └── My Components → /components/vault

[Monitoring]
  ├── Risk Dashboard → /risk
  └── Alerts (badge: {count}) → /alerts

[Settings]
  ├── Organization → /organizations
  └── Billing → /billing

[Admin Section] (admin only)
  ├── Portfolio Dashboard → /portfolio
  ├── Admin Console → /admin/console
  ├── All BOMs → /boms
  ├── System Users → /users
  └── Organization Settings → /admin/organization-settings
```

### AppBar Components

| Component | Position | Purpose |
|-----------|----------|---------|
| Command Palette Hint | Right | Shows Cmd+K shortcut |
| Help Hint | Right | Shows ? shortcut |
| Novu Bell | Right | Notification center |
| Admin Mode Toggle | Right | Dev/Admin toggle |
| User Menu | Far Right | Profile, logout |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open Command Palette |
| `?` | Show keyboard shortcuts |
| `g h` | Go to Dashboard |
| `g b` | Go to BOMs |
| `g c` | Go to Components |
| `g r` | Go to Risk |
| `g a` | Go to Alerts |

---

## User Workflows

### Workflow 1: BOM Upload (11 Steps)

**Entry:** Sidebar → Project → Upload BOM
**File:** `bom/BOMUploadWorkflow.tsx` (1054 lines)

```
1. Select Project (if not pre-selected)
   └── Projects dropdown from context

2. Choose Upload Method
   ├── Drag & Drop zone
   ├── File browser button
   └── Supported: CSV, XLS, XLSX

3. File Validation
   └── Parse headers, detect encoding

4. Column Mapping
   ├── Auto-detect common patterns
   ├── Manual override available
   └── Smart Column Mapper page

5. Preview Data
   ├── Show first 10 rows
   ├── Validate required fields
   └── Show warnings/errors

6. Configure Options
   ├── Auto-enrich toggle
   ├── Duplicate handling
   └── Notification preferences

7. Submit Upload
   └── POST to CNS service

8. Processing (SSE Progress)
   ├── Upload stage
   ├── Parse stage
   ├── Validation stage
   └── Storage stage

9. Enrichment (if enabled)
   ├── Component matching
   ├── Data augmentation
   └── Risk scoring

10. Review Results
    ├── Success count
    ├── Error/warning list
    └── Enrichment status

11. Navigate to BOM
    └── View uploaded BOM
```

### Workflow 2: Component Search (6 Steps)

**Entry:** Sidebar → Components → Search Components
**File:** `pages/ComponentSearch.tsx`

```
1. Enter Search Query
   ├── Part number
   ├── Manufacturer
   ├── Description keywords
   └── Category

2. Apply Filters
   ├── Category filter
   ├── Manufacturer filter
   ├── Package type
   ├── Lifecycle status
   └── Availability

3. View Results
   ├── Grid/List toggle
   ├── Sort options
   └── Pagination

4. Compare Components (optional)
   ├── Add to comparison tray (max 4)
   └── Side-by-side view

5. Select Component
   └── View detail panel

6. Take Action
   ├── Add to Project
   ├── Add to Vault
   ├── Export data
   └── View alternatives
```

### Workflow 3: Risk Analysis (6 Steps)

**Entry:** Sidebar → Monitoring → Risk Dashboard
**File:** `pages/RiskDashboard.tsx`

```
1. View Portfolio Overview
   ├── Total risk score
   ├── Risk distribution chart
   └── Trend over time

2. Drill Down by Project
   └── Select project from list

3. View Project Risk
   ├── Project risk score
   ├── BOM breakdown
   └── High-risk components

4. Analyze Component
   ├── Risk factor breakdown
   ├── Lifecycle status
   ├── Supply chain issues
   └── Compliance status

5. Review Mitigation
   ├── Suggested alternatives
   ├── Risk reduction estimate
   └── Implementation notes

6. Take Action
   ├── Substitute component
   ├── Accept risk
   ├── Create alert rule
   └── Export report
```

### Workflow 4: Alert Management (6 Steps)

**Entry:** Sidebar → Monitoring → Alerts
**File:** `pages/AlertCenter.tsx`

```
1. View Alert Inbox
   ├── Unread count
   ├── By severity
   └── By type

2. Filter Alerts
   ├── Type (Lifecycle, Risk, etc.)
   ├── Severity (Critical, High, etc.)
   ├── Date range
   └── Status (New, Acknowledged, etc.)

3. Select Alert
   └── Open detail panel

4. Review Details
   ├── Affected components
   ├── Impact assessment
   └── Historical context

5. Take Action
   ├── Acknowledge
   ├── Dismiss
   ├── Snooze
   ├── Create task
   └── Navigate to component

6. Bulk Operations
   ├── Multi-select
   ├── Bulk acknowledge
   └── Bulk dismiss
```

### Workflow 5: Account Setup (7 Steps)

**Entry:** First login → Account Setup Wizard
**File:** `pages/account/AccountSetupWizard.tsx`

```
1. Welcome Screen
   └── Overview of portal features

2. Profile Setup
   ├── Name
   ├── Avatar (via Auth0)
   └── Nickname (optional)

3. Organization Setup
   ├── Join existing org (via invite)
   └── Create new org

4. Security Setup
   ├── MFA enrollment (recommended)
   └── API key generation (optional)

5. Notification Preferences
   ├── Email digest
   ├── Alert notifications
   └── BOM completion

6. Theme Selection
   ├── Light mode
   ├── Dark mode
   └── System default

7. Completion
   └── Navigate to Dashboard
```

### Workflow 6: Team Invitation (7 Steps)

**Entry:** Admin Console → Team → Invite
**File:** `pages/team/TeamManagement.tsx`

```
1. Open Invite Dialog
   └── Click "Invite User" button

2. Enter Email
   └── Single or multiple emails

3. Select Role
   ├── Analyst (read-only)
   ├── Engineer (edit)
   ├── Admin (manage)
   └── Owner (full access)

4. Select Workspace(s)
   └── Multi-select workspaces

5. Add Personal Message
   └── Optional welcome note

6. Send Invitation
   └── API call to invitation service

7. Track Status
   ├── Pending invites list
   ├── Resend option
   └── Revoke option
```

### Workflow 7: Billing Management (5 Steps)

**Entry:** Sidebar → Settings → Billing
**File:** `pages/Billing.tsx` (677 lines)

```
1. View Current Plan
   ├── Plan name/tier
   ├── Feature limits
   └── Usage metrics

2. Upgrade/Downgrade
   ├── Plan comparison
   ├── Price calculation
   └── Proration preview

3. Payment Method
   ├── Add card (Stripe)
   ├── Update card
   └── View history

4. View Invoices
   ├── Invoice list
   ├── Download PDF
   └── Payment status

5. Manage Subscription
   ├── Cancel subscription
   ├── Pause subscription
   └── Contact support
```

### Workflow 8: Organization Settings (6 Steps)

**Entry:** Admin Console → Organization Settings
**File:** `pages/OrganizationSettings.tsx`

```
1. Organization Profile
   ├── Name
   ├── Logo
   ├── Description
   └── Industry

2. Security Policies
   ├── MFA requirement
   ├── Session timeout
   ├── IP whitelist
   └── Password policy

3. SSO Configuration
   ├── SAML setup
   ├── OIDC setup
   └── Domain verification

4. API & Webhooks
   ├── API keys
   ├── Webhook endpoints
   └── Rate limits

5. Data Retention
   ├── BOM retention period
   ├── Audit log retention
   └── Export data

6. Danger Zone
   ├── Transfer ownership
   └── Delete organization
```

---

## Information Architecture

### Data Hierarchy

```
Organization
├── Workspaces (logical groupings)
│   └── Projects
│       ├── BOMs
│       │   └── Line Items
│       │       └── Enrichment Data
│       └── Settings
├── Users
│   ├── Roles
│   └── Permissions
├── Component Vault
│   ├── Approved Components
│   ├── Under Review
│   └── Rejected
├── Alerts
│   └── Alert Rules
└── Settings
    ├── Risk Profile
    ├── Notification Preferences
    └── Integrations
```

### Content Organization Principles

1. **Project-Centric:** Most data is scoped to projects
2. **Role-Based Access:** Admin vs Engineer vs Analyst views
3. **Risk-Focused:** Risk scores prominent throughout
4. **Real-Time Updates:** SSE for progress, WebSocket-ready

---

## User Interaction Patterns

### Form Submission Pattern

```typescript
// Standard form flow
1. User fills form
2. Client-side validation (immediate feedback)
3. Submit button enabled
4. Optimistic UI update (optional)
5. API call with loading state
6. Success → Toast + Navigate
7. Error → Error message + Keep form data
```

### Table Interactions

| Action | Implementation |
|--------|----------------|
| Sort | Click column header, toggle asc/desc |
| Filter | Filter panel or inline search |
| Paginate | Page size selector + nav buttons |
| Select | Checkbox column, Shift+click range |
| Bulk Actions | Toolbar appears on selection |
| Row Click | Navigate to detail or expand |

### Modal/Dialog Pattern

```
- Confirmation dialogs for destructive actions
- Drawer panels for detail views (right side)
- Full-screen dialogs for complex forms
- Toast notifications for feedback
```

### File Upload Pattern

```
1. Drag & drop zone (primary)
2. File browser button (fallback)
3. Progress indicator during upload
4. Preview before submit
5. Error handling with retry option
```

### Real-Time Updates (SSE)

```typescript
// BOM enrichment progress
EventSource('/api/bom/enrichment/progress/{bomId}')
  → onmessage: Update progress bar
  → onerror: Show reconnection status
  → onopen: Clear error state
```

---

## Pain Points & UX Issues

### High Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 1 | **BOM upload workflow complexity** | `bom/BOMUploadWorkflow.tsx` | New users struggle with 11-step process | Add wizard mode with guided steps |
| 2 | **Project context dependency** | Sidebar, localStorage | Users confused when no project selected | Add persistent project selector to AppBar |
| 3 | **Alert overload** | `AlertCenter.tsx` | No prioritization in large alert lists | Add smart grouping and severity badges |
| 4 | **Enrichment progress opacity** | `BOMEnrichment.tsx` | Users unsure what's happening during enrichment | Add detailed activity log |
| 5 | **Vault workflow confusion** | `VaultKanban.tsx` | Kanban stages not clearly explained | Add stage descriptions and tooltips |

### Medium Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 6 | **Search result relevance** | `ComponentSearch.tsx` | No clear ranking of results | Implement relevance scoring display |
| 7 | **Mobile navigation depth** | `App.tsx` menu | Deep menus hard to navigate on mobile | Implement bottom navigation for mobile |
| 8 | **Risk score explanation** | Risk pages | Users don't understand score calculation | Add "Why this score?" explainer |
| 9 | **Notification fatigue** | `NotificationInbox.tsx` | Too many notifications without filtering | Add smart notification batching |
| 10 | **Comparison tray limit** | `ComparisonTray.tsx` | Max 4 components too restrictive | Allow configurable limit |

### Low Priority Issues

| # | Issue | Location | Impact | Recommendation |
|---|-------|----------|--------|----------------|
| 11 | **Empty states** | Various pages | Inconsistent empty state messaging | Standardize empty states |
| 12 | **Loading states** | Various pages | Some pages lack skeleton loaders | Add consistent loading skeletons |

---

## Accessibility Analysis

### Strengths

- Material-UI provides good baseline accessibility
- Keyboard shortcuts implemented (Cmd+K, ?)
- Color contrast follows WCAG guidelines
- Form labels properly associated

### Areas for Improvement

| Area | Issue | WCAG Criterion | Fix |
|------|-------|----------------|-----|
| **Focus Management** | Dialog focus not always trapped | 2.4.3 | Implement focus trap in modals |
| **Screen Reader** | Some dynamic content not announced | 4.1.3 | Add ARIA live regions |
| **Keyboard Navigation** | Kanban board not fully keyboard accessible | 2.1.1 | Add arrow key navigation |
| **Skip Links** | No skip-to-content link | 2.4.1 | Add skip link to main content |
| **Error Identification** | Form errors not always linked | 3.3.1 | Add aria-describedby to inputs |
| **Contrast in Badges** | Some badge colors low contrast | 1.4.3 | Increase contrast ratio |

### Recommended Testing

1. Screen reader testing (NVDA, VoiceOver)
2. Keyboard-only navigation audit
3. Automated axe-core scanning
4. Color blindness simulation
5. Mobile screen reader testing

---

## Recommendations

### Immediate (Sprint 1-2)

| Priority | Recommendation | Effort | Impact |
|----------|----------------|--------|--------|
| P0 | Add project selector to top nav | 2 days | High |
| P0 | Standardize empty states across pages | 3 days | Medium |
| P0 | Add contextual help to BOM upload | 2 days | High |
| P0 | Implement alert prioritization | 3 days | High |
| P1 | Fix focus management in dialogs | 2 days | Medium |

### Short-Term (Sprint 3-6)

| Priority | Recommendation | Effort | Impact |
|----------|----------------|--------|--------|
| P1 | Component substitution suggestions | 1 week | High |
| P1 | BOM version control/history | 1 week | Medium |
| P1 | Enhanced enrichment activity log | 3 days | Medium |
| P2 | Smart notification batching | 1 week | Medium |
| P2 | Keyboard navigation for Kanban | 3 days | Low |

### Long-Term (Sprint 7+)

| Priority | Recommendation | Effort | Impact |
|----------|----------------|--------|--------|
| P2 | Command palette enhancement | 1 week | Medium |
| P2 | Progressive Web App support | 2 weeks | Medium |
| P3 | Real-time collaboration features | 3 weeks | High |
| P3 | AI-powered search suggestions | 2 weeks | Medium |
| P3 | Mobile-first responsive redesign | 4 weeks | High |

---

## Appendix A: File Line References

### Key Files by Line Count

| File | Lines | Purpose |
|------|-------|---------|
| `bom/BOMUploadWorkflow.tsx` | 1054 | Unified upload pipeline |
| `pages/AdminConsole.tsx` | 805 | Admin dashboard |
| `pages/Billing.tsx` | 677 | Stripe integration |
| `pages/AccountSettings.tsx` | 600+ | User settings |
| `pages/ProjectComponentCatalog.tsx` | 564 | Project components |
| `pages/NotificationInbox.tsx` | 424 | Novu inbox |
| `App.tsx` | 1000+ | Main app shell |

### Custom Route Definitions (App.tsx:933-958)

```typescript
<Route path="/admin-login" element={<AdminLogin />} />
<Route path="/bom/upload" element={<BOMUploadWorkflow />} />
<Route path="/bom/enrichment" element={<BOMEnrichmentPage />} />
<Route path="/bom/audit" element={<BOMAuditStream />} />
<Route path="/cns-jobs/:jobId" element={<CNSJobStatusPage />} />
<Route path="/profile" element={<AccountSettings />} />
<Route path="/account/settings" element={<AccountSettings />} />
<Route path="/admin/organization-settings" element={<OrganizationSettings />} />
<Route path="/admin/console" element={<AdminConsole />} />
<Route path="/project/components" element={<ProjectComponentCatalog />} />
<Route path="/components/search" element={<ComponentSearch />} />
<Route path="/components/vault" element={<OrganizationComponentVault />} />
<Route path="/billing" element={<Billing />} />
<Route path="/risk" element={<RiskDashboard />} />
<Route path="/risk/settings" element={<RiskProfileSettings />} />
<Route path="/alerts" element={<AlertCenter />} />
<Route path="/alerts/preferences" element={<AlertPreferencesPage />} />
<Route path="/notifications" element={<AlertCenter />} />
<Route path="/inbox" element={<NotificationInbox />} />
<Route path="/theme" element={<AccountSettings />} />
<Route path="/portfolio" element={<PortfolioDashboardPage />} />
<Route path="/bom/column-mapping" element={<SmartColumnMapperPage />} />
```

---

## Appendix B: React Admin Resources (App.tsx:960-1050)

| Resource | List | Show | Edit | Create | Icon |
|----------|------|------|------|--------|------|
| organizations | Yes | Yes | Yes | Yes | BusinessIcon |
| users | Yes | Yes | Yes | Yes | PeopleIcon |
| projects | Yes | Yes | Yes | Yes | FolderIcon |
| boms | Yes | Yes | Yes | Yes | ListAltIcon |
| alerts | Yes | Yes | - | - | NotificationsIcon |
| bom_jobs | Yes | Yes | - | - | HistoryIcon |
| bom_uploads | Yes | Yes | Yes | - | UploadFileIcon |
| bom_line_items | Yes | Yes | Yes | - | MemoryIcon |

---

**Prepared by:** Claude Code
**Date:** 2025-12-14
**Status:** Complete UX Analysis
**Next Steps:** Implement recommendations by priority
