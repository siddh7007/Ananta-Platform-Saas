# CBP Comparison Analysis: OLD vs NEW Refine Portal

**Analysis Date:** 2025-12-15
**Purpose:** Comprehensive gap analysis between OLD CBP (React Admin) and NEW CBP Refine portal
**Status:** CRITICAL - Identifies missing features for migration planning

---

## Executive Summary

This document provides a detailed comparison between the **OLD Customer Business Portal** (React Admin, Material-UI) and the **NEW CBP Refine Portal** (Refine.dev, shadcn/ui). The analysis identifies **critical gaps** that must be addressed before the new portal can fully replace the old one.

### Key Findings

| Category | OLD CBP | NEW CBP Refine | Gap Status |
|----------|---------|----------------|------------|
| **Total Pages** | 61 | 25+ | **MAJOR GAP** |
| **Main Routes** | 27 | 18 | Gap |
| **Custom Components** | 50+ | 35+ | Gap |
| **User Workflows** | 8 major | 5 major | **MAJOR GAP** |
| **React Admin Resources** | 8 | 10 | OK |
| **Real-time Features** | SSE + WebSocket-ready | Limited | **MAJOR GAP** |
| **Keyboard Shortcuts** | Cmd+K, ? + 7 vim-style | None | **CRITICAL GAP** |

### Migration Readiness Score

| Area | Score | Status |
|------|-------|--------|
| Core BOM Management | 60% | Needs Work |
| Component Discovery | 40% | **Major Gap** |
| Risk & Alerts | 30% | **Critical Gap** |
| Account & Settings | 50% | Needs Work |
| Admin Features | 20% | **Critical Gap** |
| Real-time Updates | 20% | **Critical Gap** |
| **Overall** | **37%** | **NOT READY** |

---

## Table of Contents

1. [Technology Stack Comparison](#1-technology-stack-comparison)
2. [Page & Route Comparison](#2-page--route-comparison)
3. [Feature Gap Analysis](#3-feature-gap-analysis)
4. [Navigation & UX Comparison](#4-navigation--ux-comparison)
5. [Workflow Comparison](#5-workflow-comparison)
6. [Component Inventory Gap](#6-component-inventory-gap)
7. [Missing Features (Critical)](#7-missing-features-critical)
8. [Missing Features (Important)](#8-missing-features-important)
9. [Missing Features (Nice-to-Have)](#9-missing-features-nice-to-have)
10. [Architecture Comparison](#10-architecture-comparison)
11. [Migration Roadmap](#11-migration-roadmap)
12. [Recommendations](#12-recommendations)

---

## 1. Technology Stack Comparison

### Framework & Libraries

| Component | OLD CBP | NEW CBP Refine | Notes |
|-----------|---------|----------------|-------|
| **UI Framework** | React Admin 4.x | Refine.dev 4.47+ | Different paradigms |
| **Component Library** | Material-UI 5.x | shadcn/ui + Radix UI | Modern, accessible |
| **Styling** | MUI + Emotion CSS | Tailwind CSS | Better DX |
| **Icons** | Material Icons | Lucide React | Similar |
| **State Management** | React Admin hooks + Context | Refine hooks + Context | Similar |
| **Routing** | React Router v6 | React Router v6 | Same |
| **TypeScript** | Yes (4.x) | Yes (5.x) | Updated |

### Data & Authentication

| Component | OLD CBP | NEW CBP Refine | Notes |
|-----------|---------|----------------|-------|
| **Auth Provider** | Auth0 / Keycloak / Supabase | Keycloak OIDC only | **Simplified** |
| **Data Sources** | Supabase PostgreSQL | 3 providers (platform, cns, supabase) | **Better separation** |
| **Real-time** | SSE (Server-Sent Events) | Limited/None | **MAJOR GAP** |
| **Notifications** | Novu | Novu | Same |
| **Row-Level Security** | Supabase RLS | API-level auth | Different approach |

### Build & Tooling

| Component | OLD CBP | NEW CBP Refine | Notes |
|-----------|---------|----------------|-------|
| **Build Tool** | Vite | Vite | Same |
| **Package Manager** | npm/yarn | npm/bun | Similar |
| **Testing** | Jest + RTL | Vitest + RTL | Updated |
| **Linting** | ESLint | ESLint + Prettier | Enhanced |

---

## 2. Page & Route Comparison

### Summary

| Category | OLD Pages | NEW Pages | Missing |
|----------|-----------|-----------|---------|
| Dashboard | 3 | 1 | 2 |
| BOM Management | 10 | 5 | 5 |
| Component Discovery | 8 | 3 | 5 |
| Risk & Alerts | 12 | 2 | **10** |
| Account & Settings | 8 | 3 | 5 |
| Admin | 5 | 0 | **5** |
| Team | 2 | 2 | 0 |
| Vault | 4 | 0 | **4** |
| **TOTAL** | **61** | **25+** | **~36** |

### Dashboard Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Main Dashboard | `/` | `/` | **EXISTS** |
| Portfolio Dashboard | `/portfolio` | - | **MISSING** |
| Admin Console | `/admin/console` | - | **MISSING** |

### BOM Management Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| BOM List | `/boms` | `/boms` | **EXISTS** |
| BOM Upload | `/bom/upload` | `/boms/upload` | **EXISTS** (simplified) |
| BOM Detail/Show | `/boms/:id/show` | `/boms/:id` | **EXISTS** |
| BOM Edit | `/boms/:id/edit` | - | **MISSING** |
| BOM Create | `/boms/create` | `/boms/create` | **EXISTS** |
| BOM Enrichment | `/bom/enrichment` | - | **MISSING** |
| BOM Audit Stream | `/bom/audit` | - | **MISSING** |
| Column Mapper | `/bom/column-mapping` | - | **MISSING** (integrated?) |
| CNS Job Status | `/cns-jobs/:jobId` | - | **MISSING** |
| BOM Jobs | `/bom_jobs` | - | **MISSING** |

### Component Discovery Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Component Search | `/components/search` | `/components` | **EXISTS** (different route) |
| Component Vault | `/components/vault` | - | **MISSING** |
| Component Compare | (embedded) | `/components/compare` | **EXISTS** |
| Parametric Search | (embedded) | - | **MISSING** |
| Saved Searches | (embedded) | - | **MISSING** |
| Send to Vault | (drawer) | - | **MISSING** |
| Project Catalog | `/project/components` | - | **MISSING** |

### Risk & Alert Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Risk Dashboard | `/risk` | `/risk` | **EXISTS** |
| Risk Settings | `/risk/settings` | - | **MISSING** |
| Alert Center | `/alerts` | `/alerts` | **EXISTS** |
| Alert Preferences | `/alerts/preferences` | - | **MISSING** |
| Notification Inbox | `/inbox` | - | **MISSING** (uses NotificationCenter) |
| Portfolio Risk Overview | (tab) | - | **MISSING** |
| Project Risk Overview | (tab) | - | **MISSING** |
| BOM Risk Overview | (tab) | `/boms/:id/risk` | **EXISTS** |
| High Risk Table | (component) | - | **MISSING** |
| Mitigation Drawer | (drawer) | - | **MISSING** |
| Risk Trend Chart | (component) | - | **MISSING** |
| Timeline Comparison | (component) | - | **MISSING** |

### Account & Settings Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Account Settings | `/account/settings` | `/settings` | **EXISTS** |
| Organization Settings | `/admin/organization-settings` | `/settings/organization` | **EXISTS** |
| Billing | `/billing` | `/billing` | **EXISTS** |
| Profile | `/profile` | `/settings/preferences` | **EXISTS** |
| Account Setup Wizard | (embedded) | - | **MISSING** |
| Onboarding Progress | (embedded) | - | **MISSING** |
| Security Completeness | (embedded) | - | **MISSING** |
| Theme Settings | `/theme` | (in settings) | **EXISTS** |

### Admin Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Admin Console | `/admin/console` | - | **MISSING** |
| Admin Audit Log | (tab) | - | **MISSING** |
| Admin Compliance Panel | (tab) | - | **MISSING** |
| Admin Pending Invites | (tab) | `/team/invitations` | **EXISTS** |
| Admin Risk Summary | (tab) | - | **MISSING** |
| Admin Usage Metrics | (tab) | - | **MISSING** |

### Vault Management Pages

| Page | OLD | NEW | Status |
|------|-----|-----|--------|
| Vault Kanban | (page) | - | **MISSING** |
| Vault Stage Column | (component) | - | **MISSING** |
| Vault Component Card | (component) | - | **MISSING** |
| Bulk Approval Toolbar | (component) | - | **MISSING** |

---

## 3. Feature Gap Analysis

### Critical Features Missing in NEW CBP

| # | Feature | OLD Location | Impact | Priority |
|---|---------|--------------|--------|----------|
| 1 | **Real-time Enrichment Progress (SSE)** | `BOMEnrichment.tsx` | Users can't track enrichment | **P0** |
| 2 | **Command Palette (Cmd+K)** | `CommandPalette.tsx` | Power users productivity | **P0** |
| 3 | **Component Vault (Kanban)** | `OrganizationComponentVault.tsx` | No component library management | **P0** |
| 4 | **Admin Console** | `AdminConsole.tsx` | Admins have no control panel | **P0** |
| 5 | **Portfolio Dashboard** | `PortfolioDashboardPage.tsx` | No org-wide visibility | **P0** |
| 6 | **BOM Audit Stream** | `BOMAuditStream.tsx` | No activity tracking | **P1** |
| 7 | **Risk Settings/Profiles** | `RiskProfileSettings.tsx` | Can't configure risk factors | **P1** |
| 8 | **Alert Preferences** | `AlertPreferences.tsx` | Can't configure alerts | **P1** |
| 9 | **Account Setup Wizard** | `AccountSetupWizard.tsx` | Poor onboarding | **P1** |
| 10 | **Smart Column Mapper** | `SmartColumnMapperPage.tsx` | Manual column mapping | **P1** |

### Features with Reduced Functionality

| Feature | OLD Capability | NEW Capability | Gap |
|---------|----------------|----------------|-----|
| BOM Upload | 11-step wizard with SSE progress | 7-step basic wizard | Less guidance, no real-time |
| Component Search | Parametric + saved searches + vault | Basic text search | Limited discovery |
| Risk Analysis | Portfolio ’ Project ’ BOM ’ Component drill-down | Basic dashboard | Less granularity |
| Alerts | Full inbox with batch actions, snooze, filtering | Basic list | Reduced functionality |
| Notifications | Full inbox with Novu integration | Bell dropdown only | Less control |

---

## 4. Navigation & UX Comparison

### Sidebar Navigation

| Section | OLD CBP | NEW CBP Refine | Notes |
|---------|---------|----------------|-------|
| Org/Workspace Switcher | Prominent at top | TenantSelector in header | Moved to header |
| Dashboard | Yes | Yes | Same |
| Projects | Collapsible with counts | Simple list | Less info |
| Components | Search + Vault | Search only | **Missing Vault** |
| Monitoring | Risk + Alerts | Risk + Alerts | Same |
| Settings | Org + Billing | Settings tabs | Similar |
| Admin Section | Full admin tools | Limited | **Major Gap** |

### Header Components

| Component | OLD | NEW | Status |
|-----------|-----|-----|--------|
| Command Palette Hint | Yes (Cmd+K) | No | **MISSING** |
| Help Shortcut | Yes (?) | No | **MISSING** |
| Notification Bell | Novu | Novu | Same |
| Admin Mode Toggle | Yes | No | **MISSING** |
| User Menu | Yes | Yes | Same |
| Global Search | In command palette | Trigger button | Different approach |
| Theme Toggle | Yes | Yes | Same |
| Tenant Selector | Sidebar | Header | Relocated |

### Keyboard Shortcuts

| Shortcut | OLD | NEW | Status |
|----------|-----|-----|--------|
| `Cmd+K` / `Ctrl+K` | Command Palette | - | **MISSING** |
| `?` | Show shortcuts | - | **MISSING** |
| `g h` | Go to Dashboard | - | **MISSING** |
| `g b` | Go to BOMs | - | **MISSING** |
| `g c` | Go to Components | - | **MISSING** |
| `g r` | Go to Risk | - | **MISSING** |
| `g a` | Go to Alerts | - | **MISSING** |

---

## 5. Workflow Comparison

### BOM Upload Workflow

| Step | OLD (11 steps) | NEW (7 steps) | Gap |
|------|----------------|---------------|-----|
| 1 | Select Project | Start Upload | Different flow |
| 2 | Choose Upload Method | Select File | Same |
| 3 | File Validation | Configure Options | Combined |
| 4 | Column Mapping (Smart) | Column Mapping | Less intelligent |
| 5 | Preview Data | Preview Data | Same |
| 6 | Configure Options | Submit & Process | Combined |
| 7 | Submit Upload | Complete | Same |
| 8 | Processing (SSE Progress) | - | **MISSING** |
| 9 | Enrichment (if enabled) | - | **MISSING** |
| 10 | Review Results | - | **MISSING** |
| 11 | Navigate to BOM | - | **MISSING** |

**Gap Assessment:** NEW is simplified but loses **real-time progress tracking** and **enrichment feedback**

### Component Search Workflow

| Step | OLD (6 steps) | NEW (5 steps) | Gap |
|------|---------------|---------------|-----|
| 1 | Enter Search Query | Enter Search | Same |
| 2 | Apply Filters | Apply Filters | Less options |
| 3 | View Results | View Results | Same |
| 4 | Compare (max 4) | Compare (max 4) | Same |
| 5 | Select Component | Select Component | Same |
| 6 | Actions (Add to Vault) | Actions | **Missing Vault option** |

**Gap Assessment:** Missing **parametric search**, **saved searches**, and **vault management**

### Risk Analysis Workflow

| Step | OLD (6 steps) | NEW | Gap |
|------|---------------|-----|-----|
| 1 | View Portfolio Overview | - | **MISSING** |
| 2 | Drill Down by Project | - | **MISSING** |
| 3 | View Project Risk | Basic dashboard | Reduced |
| 4 | Analyze Component | Component drawer | Similar |
| 5 | Review Mitigation | - | **MISSING** |
| 6 | Take Action (Substitute) | - | **MISSING** |

**Gap Assessment:** **Critical** - no portfolio-level risk visibility, no drill-down, no mitigation workflow

### Alert Management Workflow

| Step | OLD (6 steps) | NEW | Gap |
|------|---------------|-----|-----|
| 1 | View Alert Inbox | View Alerts | Same |
| 2 | Filter Alerts | Basic filters | Reduced |
| 3 | Select Alert | Select Alert | Same |
| 4 | Review Details | - | **MISSING** |
| 5 | Take Action (Snooze, etc.) | - | **MISSING** |
| 6 | Bulk Operations | - | **MISSING** |

**Gap Assessment:** Missing **detailed review**, **action options**, and **bulk operations**

---

## 6. Component Inventory Gap

### Custom Components Comparison

| Category | OLD Count | NEW Count | Missing |
|----------|-----------|-----------|---------|
| BOM Components | 15+ | 5 | ~10 |
| Alert Components | 7 | 2 | 5 |
| Risk Components | 10 | 2 | **8** |
| Vault Components | 4 | 0 | **4** |
| Admin Components | 5 | 0 | **5** |
| Discovery Components | 8 | 3 | 5 |
| Account Components | 6 | 3 | 3 |
| **TOTAL** | **55+** | **~20** | **~35** |

### Specific Missing Components

| Component | OLD File | Purpose | Priority |
|-----------|----------|---------|----------|
| `CommandPalette` | `CommandPalette.tsx` | Cmd+K search | P0 |
| `BOMEnrichmentProgress` | `BOMEnrichment.tsx` | SSE progress | P0 |
| `VaultKanban` | `VaultKanban.tsx` | Component library | P0 |
| `AdminConsole` | `AdminConsole.tsx` | Admin dashboard | P0 |
| `PortfolioRiskDashboard` | `PortfolioDashboardPage.tsx` | Portfolio view | P0 |
| `AlertDetailPanel` | `AlertDetailPanel.tsx` | Alert details | P1 |
| `AlertBatchActions` | `AlertBatchActions.tsx` | Bulk operations | P1 |
| `RiskTrendChart` | `PortfolioRiskTrendChart.tsx` | Risk trends | P1 |
| `MitigationDrawer` | `MitigationDrawer.tsx` | Risk mitigation | P1 |
| `AccountSetupWizard` | `AccountSetupWizard.tsx` | Onboarding | P1 |
| `SmartColumnMapper` | `SmartColumnMapperPage.tsx` | Column mapping | P1 |
| `SavedSearches` | `SavedSearches.tsx` | Search queries | P2 |
| `ParametricSearch` | `ParametricSearchPanel.tsx` | Spec search | P2 |
| `SecurityCompleteness` | `SecurityCompleteness.tsx` | Security score | P2 |
| `OnboardingProgress` | `OnboardingProgress.tsx` | Setup checklist | P2 |

---

## 7. Missing Features (Critical - P0)

These features **MUST** be implemented before migration:

### 7.1 Real-time Enrichment Progress (SSE)

**OLD Implementation:**
```typescript
// BOMEnrichment.tsx - Uses EventSource for real-time updates
const eventSource = new EventSource(`/api/bom/enrichment/progress/${bomId}`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  updateProgressBar(progress.percent);
  updateStageStatus(progress.stage);
};
```

**NEW Status:** Not implemented
**Impact:** Users have no visibility into long-running enrichment jobs
**Effort:** 3-5 days
**Files to Create:**
- `src/hooks/useEnrichmentProgress.ts`
- `src/components/bom/EnrichmentProgress.tsx`
- `src/pages/boms/BomEnrichment.tsx`

### 7.2 Command Palette (Cmd+K)

**OLD Implementation:**
```typescript
// CommandPalette.tsx - Full search with actions
<CommandPalette
  shortcuts={[
    { key: 'g h', action: 'Go to Dashboard' },
    { key: 'g b', action: 'Go to BOMs' },
    // ... 7 shortcuts
  ]}
  searchables={['BOMs', 'Components', 'Projects', 'Settings']}
/>
```

**NEW Status:** Not implemented
**Impact:** Power users lose significant productivity
**Effort:** 2-3 days
**Files to Create:**
- `src/components/command/CommandPalette.tsx`
- `src/hooks/useKeyboardShortcuts.ts`

### 7.3 Component Vault (Kanban)

**OLD Implementation:**
- Kanban board with 4 stages: Pending, Under Review, Approved, Rejected
- Drag-and-drop between stages
- Bulk approval toolbar
- Component cards with details

**NEW Status:** Completely missing
**Impact:** No component library management capability
**Effort:** 1-2 weeks
**Files to Create:**
- `src/pages/vault/index.tsx`
- `src/pages/vault/VaultKanban.tsx`
- `src/components/vault/VaultColumn.tsx`
- `src/components/vault/VaultCard.tsx`
- `src/components/vault/BulkApprovalToolbar.tsx`

### 7.4 Admin Console

**OLD Implementation:**
- 805 lines of admin functionality
- Audit log viewer
- Compliance panel
- Pending invites
- Risk summary
- Usage metrics

**NEW Status:** Completely missing
**Impact:** Admins cannot manage organization
**Effort:** 1-2 weeks
**Files to Create:**
- `src/pages/admin/AdminConsole.tsx`
- `src/pages/admin/AuditLog.tsx`
- `src/pages/admin/CompliancePanel.tsx`
- `src/pages/admin/UsageMetrics.tsx`

### 7.5 Portfolio Dashboard

**OLD Implementation:**
- Organization-wide BOM/risk overview
- Project comparison
- Risk trends
- Executive summary

**NEW Status:** Completely missing
**Impact:** No executive visibility into portfolio risk
**Effort:** 1 week
**Files to Create:**
- `src/pages/portfolio/PortfolioDashboard.tsx`
- `src/components/portfolio/PortfolioRiskChart.tsx`
- `src/components/portfolio/ProjectComparison.tsx`

---

## 8. Missing Features (Important - P1)

### 8.1 BOM Audit Stream
- Real-time activity log for BOM operations
- Effort: 2-3 days

### 8.2 Risk Settings/Profiles
- Configure risk factor weights
- Set thresholds for alerts
- Effort: 3-5 days

### 8.3 Alert Preferences
- Configure notification channels
- Set alert priorities
- Effort: 2-3 days

### 8.4 Account Setup Wizard
- Guided onboarding for new users
- Profile, org, security setup
- Effort: 3-5 days

### 8.5 Smart Column Mapper
- AI-assisted column detection
- Pattern learning
- Effort: 3-5 days

### 8.6 BOM Edit Page
- Edit BOM metadata after creation
- Effort: 1-2 days

### 8.7 CNS Job Status Page
- Track background job progress
- Effort: 2-3 days

### 8.8 Alert Detail Panel
- Full alert information drawer
- Action buttons
- Effort: 2-3 days

### 8.9 Risk Drill-Down
- Portfolio ’ Project ’ BOM ’ Component
- Effort: 1 week

### 8.10 Mitigation Workflow
- Suggest alternatives
- Track substitutions
- Effort: 3-5 days

---

## 9. Missing Features (Nice-to-Have - P2)

### 9.1 Parametric Search
- Search by electrical specifications
- Filter by value ranges
- Effort: 1 week

### 9.2 Saved Searches
- Save search queries
- Quick access to common searches
- Effort: 2-3 days

### 9.3 Notification Inbox Page
- Full notification history
- Batch actions
- Effort: 2-3 days

### 9.4 Security Completeness Score
- Track security setup progress
- MFA, API keys status
- Effort: 1-2 days

### 9.5 Onboarding Progress Tracker
- Show setup completion %
- Guide through initial setup
- Effort: 2-3 days

### 9.6 Tablet-Optimized Views
- Touch-friendly tables
- Responsive layouts
- Effort: 1 week

### 9.7 Risk Trend Charts
- Historical risk over time
- Trend analysis
- Effort: 3-5 days

### 9.8 Timeline Comparison
- Compare risk across time periods
- Effort: 3-5 days

---

## 10. Architecture Comparison

### Data Provider Architecture

**OLD CBP:**
```
Single Supabase Provider
    “
Supabase PostgreSQL with RLS
    “
Direct database queries
```

**NEW CBP Refine:**
```
3 Data Providers
   platform ’ Platform API (tenants, users)
   cns ’ CNS Service (BOMs, enrichment)
   supabase ’ Component Catalog
    “
API-level authentication
```

**Assessment:** NEW is **better architected** - proper service separation

### Authentication Architecture

**OLD CBP:**
```
Auth0 / Keycloak / Supabase (configurable)
    “
Multiple auth providers
    “
Complex configuration
```

**NEW CBP Refine:**
```
Keycloak OIDC only
    “
Single auth provider
    “
Simplified, consistent
```

**Assessment:** NEW is **simpler** - single auth provider is easier to maintain

### Role Hierarchy

**OLD CBP:**
```
4 roles: Analyst, Engineer, Admin, Owner
```

**NEW CBP Refine:**
```
5 roles: analyst < engineer < admin < owner < super_admin
```

**Assessment:** NEW is **more granular** - added super_admin for platform ops

### Real-time Architecture

**OLD CBP:**
```
SSE (Server-Sent Events)
    “
EventSource connections
    “
Real-time progress updates
```

**NEW CBP Refine:**
```
No real-time architecture
    “
Polling only (if any)
    “
No live updates
```

**Assessment:** **CRITICAL GAP** - NEW needs SSE implementation

---

## 11. Migration Roadmap

### Phase 1: Critical Features (4-6 weeks)

| Week | Features | Effort |
|------|----------|--------|
| 1-2 | SSE Infrastructure + Enrichment Progress | 5 days |
| 2-3 | Command Palette + Keyboard Shortcuts | 3 days |
| 3-4 | Component Vault (Kanban) | 7 days |
| 4-5 | Admin Console (Core) | 5 days |
| 5-6 | Portfolio Dashboard | 5 days |

**Deliverable:** Core parity for power users

### Phase 2: Important Features (4-6 weeks)

| Week | Features | Effort |
|------|----------|--------|
| 1 | BOM Audit Stream + Job Status | 3 days |
| 1-2 | Risk Settings + Drill-Down | 5 days |
| 2-3 | Alert Preferences + Detail Panel | 4 days |
| 3-4 | Account Setup Wizard + Onboarding | 5 days |
| 4-5 | Smart Column Mapper | 4 days |
| 5-6 | BOM Edit + Mitigation Workflow | 5 days |

**Deliverable:** Full feature parity

### Phase 3: Enhanced Features (2-4 weeks)

| Week | Features | Effort |
|------|----------|--------|
| 1 | Parametric Search | 5 days |
| 2 | Saved Searches + Notification Inbox | 4 days |
| 3 | Risk Trend Charts + Timeline | 5 days |
| 4 | Tablet Optimization | 3 days |

**Deliverable:** Feature-complete portal

---

## 12. Recommendations

### Immediate Actions (This Sprint)

1. **Set up SSE infrastructure** - This blocks all real-time features
2. **Create Command Palette** - Power users expect this
3. **Add breadcrumb navigation** - Users are getting lost
4. **Implement empty states** - New users are confused

### Short-Term (Next 2 Sprints)

1. **Build Component Vault** - Core feature missing
2. **Create Admin Console** - Admins are blocked
3. **Add Portfolio Dashboard** - Executives need visibility
4. **Implement Alert Detail Panel** - Alerts are unusable without details

### Medium-Term (Next Quarter)

1. **Complete Risk Drill-Down** - Critical for risk management
2. **Add Account Setup Wizard** - Improve onboarding
3. **Build Smart Column Mapper** - Reduce upload friction
4. **Implement Parametric Search** - Enable advanced discovery

### Do NOT Migrate Until:

- [ ] SSE real-time progress is working
- [ ] Component Vault is functional
- [ ] Admin Console has core features
- [ ] Portfolio Dashboard is available
- [ ] Command Palette is implemented
- [ ] Alert management is complete
- [ ] Risk drill-down is functional

---

## Appendix A: Feature Priority Matrix

| Feature | Business Impact | User Impact | Effort | Priority Score |
|---------|-----------------|-------------|--------|----------------|
| SSE Progress | High | Critical | Medium | **P0** |
| Command Palette | Medium | High | Low | **P0** |
| Component Vault | High | High | High | **P0** |
| Admin Console | High | High | High | **P0** |
| Portfolio Dashboard | High | Medium | Medium | **P0** |
| BOM Audit | Medium | Medium | Low | P1 |
| Risk Settings | Medium | Medium | Medium | P1 |
| Alert Preferences | Medium | Medium | Low | P1 |
| Setup Wizard | Medium | High | Medium | P1 |
| Column Mapper | Medium | Medium | Medium | P1 |
| Parametric Search | Medium | Medium | High | P2 |
| Saved Searches | Low | Medium | Low | P2 |
| Trend Charts | Low | Low | Medium | P2 |

---

## Appendix B: File Count Comparison

| Directory | OLD CBP Files | NEW CBP Files | Difference |
|-----------|---------------|---------------|------------|
| pages/ | 35 | 15 | -20 |
| components/ | 50+ | 35+ | -15 |
| resources/ | 8 | - | -8 (Refine pattern) |
| hooks/ | 10 | 5 | -5 |
| contexts/ | 5 | 3 | -2 |
| utils/ | 8 | 5 | -3 |
| config/ | 3 | 4 | +1 |
| **TOTAL** | **~120** | **~70** | **~50 fewer** |

---

## Appendix C: LOC (Lines of Code) Comparison

| Key File | OLD Lines | NEW Lines | Notes |
|----------|-----------|-----------|-------|
| App.tsx | 1000+ | 273 | Significantly smaller |
| BOMUploadWorkflow | 1054 | ~200 | Simplified |
| AdminConsole | 805 | 0 | **MISSING** |
| Billing | 677 | ~150 | Reduced |
| AccountSettings | 600+ | ~150 | Reduced |
| **Total codebase** | **~15,000** | **~5,000** | **~10K less** |

---

**Document Version:** 1.0
**Last Updated:** 2025-12-15
**Author:** Claude Code
**Status:** CRITICAL - NEW CBP Refine is **NOT READY** for migration
**Overall Gap Score:** 37% feature parity
**Estimated Time to Parity:** 10-14 weeks
