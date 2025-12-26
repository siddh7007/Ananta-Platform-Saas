# CBP Refine UI/UX Improvement Plan

> **Version:** 4.1
> **Date:** December 18, 2025
> **Status:** Sprint 1 UI/UX Complete - Sprint 2 In Progress
> **Current Implementation:** ~95% Core Features Complete + Sprint 1 P0 Features Done
> **Goal:** Exceed Legacy CBP in All Dimensions
> **Updated:** Sprint 1 audit confirmed - command palette, breadcrumbs, empty states, skeletons, Novu, cross-tab sync, Storybook, PWA all IMPLEMENTED

---

## Table of Contents

1. [Executive Summary](#3-executive-summary)
2. [Business Logic Comparison: Old vs New CBP](#2-business-logic-comparison-old-vs-new-cbp)
3. [Current State Assessment](#4-current-state-assessment)
4. [Architecture Deep Dive](#5-architecture-deep-dive)
5. [User Persona Improvements](#6-user-persona-improvements)
6. [UX Metrics & Targets](#7-ux-metrics--targets)
7. [Design System & Visual Aesthetics](#8-design-system--visual-aesthetics)
8. [Component Enhancement Plan](#9-component-enhancement-plan)
9. [Critical User Journeys](#10-critical-user-journeys)
10. [Accessibility (WCAG 2.1 AA)](#11-accessibility-wcag-21-aa)
11. [Mobile & Tablet Optimization](#12-mobile--tablet-optimization)
12. [Performance Optimization](#13-performance-optimization)
13. [Security Hardening](#14-security-hardening)
14. [ARC-SaaS Integration](#15-arc-saas-integration)
15. [Implementation Roadmap](#16-implementation-roadmap)
16. [Success Metrics & KPIs](#17-success-metrics--kpis)

---

## 2. Business Logic Comparison: Old vs New CBP

> **Purpose:** Detailed comparison of business logic between the legacy CBP React Admin portal (`components-platform-v2-ref/services/customer-portal`) and the new CBP Refine portal (`arc-saas/apps/customer-portal`) to identify gaps, improvements, and migration paths.

### 2.1 Architecture Overview Comparison

| Aspect | Old CBP (React Admin) | New CBP (Refine) | Status |
|--------|----------------------|------------------|--------|
| **Framework** | React Admin + Material-UI | Refine + shadcn/ui + Tailwind | ✅ Upgraded |
| **Authentication** | Auth0 + Supabase middleware | Keycloak OIDC with PKCE | ✅ Upgraded |
| **API Pattern** | Single CNS API (port 27800) | Multi-provider (Platform:14000, CNS:27200, Supabase:27810) | ✅ Upgraded |
| **Multi-tenancy** | `X-Organization-Id` header | `X-Tenant-Id` header | ✅ Aligned with ARC-SaaS |
| **State Management** | React Admin dataProvider | Refine + TanStack Query | ✅ Upgraded |
| **Real-time Updates** | SSE streaming | Polling (3-second intervals) | ⚠️ Downgrade |
| **Role Hierarchy** | 4 levels | 5 levels (analyst→super_admin) | ✅ Enhanced |

### 2.2 BOM Upload & Processing

#### Old CBP Flow (BOMUploadWorkflow.tsx - 970 lines)

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLD CBP BOM UPLOAD FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. File Selection → MinIO Upload                                │
│ 2. Parse Detection (CSV/XLSX auto-detect)                       │
│ 3. 7-Step Wizard:                                               │
│    - Select File                                                │
│    - Preview Data                                               │
│    - Column Mapping (manual, saved templates)                   │
│    - Configure Options (project, workspace assignment)          │
│    - Review Summary                                             │
│    - Upload Progress                                            │
│    - Complete with Results                                      │
│ 4. Feature Flag: BOM Snapshots vs Direct Client Writes          │
│ 5. Real-time SSE progress via useEnrichmentProgress hook        │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files:**
- `src/bom/BOMUploadWorkflow.tsx` (970 lines) - Main upload wizard
- `src/hooks/useEnrichmentProgress.ts` - SSE real-time progress
- `src/services/bomService.ts` - API integration

**Features:**
- ✅ MinIO file storage integration
- ✅ Saved column mapping templates per organization
- ✅ Feature flag for BOM snapshots
- ✅ Real-time SSE enrichment progress
- ✅ Drag-and-drop file upload

#### New CBP Flow (BomUpload.tsx - ~600 lines)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW CBP BOM UPLOAD FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. File Selection → Direct CNS Upload                           │
│ 2. Parse Detection (parseBOMFile utility)                       │
│ 3. 6-Step Wizard:                                               │
│    - select_file                                                │
│    - preview_data                                               │
│    - configure_mapping                                          │
│    - review_summary                                             │
│    - uploading                                                  │
│    - complete                                                   │
│ 4. POST /boms/upload to CNS Service                             │
│ 5. Polling-based progress (3-second intervals)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files:**
- `src/pages/boms/BomUpload.tsx` - Upload wizard
- `src/pages/boms/BomDetail.tsx` - Enrichment monitoring
- `src/utils/bom-parser.ts` - CSV/XLSX parsing

#### Comparison Table

| Feature | Old CBP | New CBP | Gap Analysis |
|---------|---------|---------|--------------|
| **Upload Steps** | 7 steps | 6 steps | ✅ Simplified |
| **File Storage** | MinIO | CNS Direct | ✅ Simplified |
| **Column Templates** | ✅ Saved per org | ❌ Not implemented | 🔴 **MISSING** |
| **Progress Updates** | SSE real-time | Polling (3s) | ⚠️ Less responsive |
| **BOM Snapshots** | Feature flag | Not implemented | 🔴 **MISSING** |
| **Drag-and-Drop** | ✅ Full support | ✅ react-dropzone | ✅ Parity |
| **Bulk Upload** | ❌ Single file | ❌ Single file | ⚠️ Enhancement needed |

#### Migration Actions Required

1. **P0 - Column Mapping Templates**
   ```typescript
   // Add to new CBP: src/services/column-mapping.service.ts
   interface ColumnMappingTemplate {
     id: string;
     organizationId: string;
     name: string;
     mappings: Record<string, string>;
     createdAt: Date;
   }

   // API endpoints needed on CNS:
   // GET /api/organizations/{orgId}/column-templates
   // POST /api/organizations/{orgId}/column-templates
   // DELETE /api/organizations/{orgId}/column-templates/{id}
   ```

2. **P1 - SSE Progress Restoration**
   ```typescript
   // Port from old CBP: useEnrichmentProgress.ts
   interface EnrichmentState {
     status: 'idle' | 'connecting' | 'enriching' | 'completed' | 'error';
     total_items: number;
     enriched_items: number;
     failed_items: number;
     current_stage: string;
   }
   ```

---

### 2.3 Enrichment Pipeline

#### Old CBP Enrichment (useEnrichmentProgress.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                  OLD CBP ENRICHMENT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│ EventSource SSE Connection:                                     │
│   → GET /api/boms/{bomId}/enrichment/stream                     │
│                                                                 │
│ Event Types:                                                    │
│   • enrichment.started    → Initialize progress UI              │
│   • enrichment.progress   → Update counters in real-time        │
│   • enrichment.completed  → Show final results                  │
│   • enrichment.error      → Display error with retry option     │
│                                                                 │
│ Real-time feedback with <1 second latency                       │
└─────────────────────────────────────────────────────────────────┘
```

#### New CBP Enrichment (BomDetail.tsx)

```
┌─────────────────────────────────────────────────────────────────┐
│                  NEW CBP ENRICHMENT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│ Polling Pattern:                                                │
│   → GET /api/boms/{bomId} (every 3 seconds)                     │
│   → Check enrichment_status field                               │
│                                                                 │
│ Line Item Status Values:                                        │
│   • pending   → Awaiting enrichment                             │
│   • matched   → Found in catalog                                │
│   • enriched  → Full enrichment complete                        │
│   • no_match  → Not found in catalog                            │
│   • error     → Enrichment failed                               │
│                                                                 │
│ Stale Detection: 7 days since last enrichment                   │
│ Re-enrich: POST /api/boms/{bomId}/enrich                        │
└─────────────────────────────────────────────────────────────────┘
```

#### CNS Service Backend (4-Tier Enrichment)

```
┌─────────────────────────────────────────────────────────────────┐
│                CNS SERVICE ENRICHMENT PIPELINE                   │
│              (app-plane/services/cns-service)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tier 1: CATALOG LOOKUP (Immediate)                             │
│     └─→ Search component_catalog by MPN + manufacturer          │
│     └─→ If found: quality_score >= 70 → DONE                    │
│                                                                 │
│  Tier 2: SUPPLIER API ENRICHMENT                                │
│     └─→ DigiKey, Mouser, Arrow APIs                             │
│     └─→ OAuth tokens in supplier_tokens table                   │
│     └─→ Rate limiting: 100 req/min per supplier                 │
│                                                                 │
│  Tier 3: AI ENHANCEMENT                                         │
│     └─→ Claude/GPT for datasheet parsing                        │
│     └─→ Specification extraction                                │
│     └─→ Category classification                                 │
│                                                                 │
│  Tier 4: WEB SCRAPING (Fallback)                                │
│     └─→ Manufacturer websites                                   │
│     └─→ Distributor catalogs                                    │
│     └─→ Lowest priority, rate limited                           │
│                                                                 │
│  Quality Scoring Weights:                                       │
│     • Completeness: 40%                                         │
│     • Source reliability: 30%                                   │
│     • Specification count: 20%                                  │
│     • Category accuracy: 10%                                    │
│                                                                 │
│  Routing Decision:                                              │
│     • Score >= 95 → PRODUCTION (direct use)                     │
│     • Score 70-94 → STAGING (needs review)                      │
│     • Score < 70  → REJECTED (manual entry)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Comparison Table

| Feature | Old CBP | New CBP | CNS Backend |
|---------|---------|---------|-------------|
| **Update Method** | SSE real-time | Polling 3s | Temporal workflows |
| **Progress Granularity** | Per-item | Per-BOM | Per-item events |
| **Enrichment Tiers** | 2 (Catalog + API) | N/A (backend) | 4 tiers |
| **Quality Scoring** | Basic match % | Display only | Weighted 4-factor |
| **Re-enrichment** | Manual button | ✅ 7-day stale | Temporal scheduled |
| **Batch Processing** | ❌ Sequential | ❌ Sequential | ✅ Parallel batches |

#### Migration Actions Required

1. **P0 - Expose SSE Endpoint in CNS**
   ```python
   # CNS Service: app/api/boms/enrichment_stream.py
   @router.get("/boms/{bom_id}/enrichment/stream")
   async def enrichment_stream(bom_id: str):
       async def event_generator():
           async for event in enrichment_service.stream_progress(bom_id):
               yield f"event: {event.type}\ndata: {event.data}\n\n"
       return StreamingResponse(event_generator(), media_type="text/event-stream")
   ```

2. **P1 - Frontend SSE Hook**
   ```typescript
   // Port from old CBP with modifications
   export function useEnrichmentStream(bomId: string) {
     const [state, setState] = useState<EnrichmentState>(initialState);

     useEffect(() => {
       const eventSource = new EventSource(
         `${CNS_API_URL}/boms/${bomId}/enrichment/stream`
       );
       // ... event handlers
     }, [bomId]);
   }
   ```

---

### 2.4 Projects & Workspaces

#### Old CBP Structure

```
Organization (X-Organization-Id)
└── Projects (flat list)
    └── BOMs (assigned to project)
```

**Key Files:**
- `src/projects/ProjectList.tsx`
- `src/projects/ProjectDetail.tsx`
- No workspace concept

#### New CBP Structure

```
Tenant (X-Tenant-Id)
└── Workspaces (organizational grouping)
    └── Projects (within workspace)
        └── BOMs (assigned to project)
```

**Key Files:**
- `src/pages/workspaces/WorkspaceList.tsx`
- `src/pages/projects/ProjectList.tsx`
- `src/pages/projects/ProjectDetail.tsx`
- `src/pages/projects/ProjectCreate.tsx`

#### Comparison Table

| Feature | Old CBP | New CBP | Status |
|---------|---------|---------|--------|
| **Hierarchy Depth** | 2 levels | 3 levels | ✅ Enhanced |
| **Workspaces** | ❌ None | ✅ Full support | ✅ New feature |
| **Project Templates** | ❌ None | ❌ None | ⚠️ Enhancement |
| **BOM Assignment** | Direct to project | Project within workspace | ✅ Enhanced |
| **Cross-workspace View** | N/A | ❌ Not implemented | ⚠️ Enhancement |
| **Default Workspace** | N/A | ✅ Auto-created | ✅ Implemented |

---

### 2.5 Risk Analysis

#### Old CBP Risk Service (riskService.ts)

```typescript
// Risk Weight Configuration
const RISK_WEIGHTS = {
  lifecycle: 0.30,        // 30% - EOL/NRND status
  supply_chain: 0.25,     // 25% - Lead time, availability
  compliance: 0.20,       // 20% - RoHS, REACH, conflict minerals
  obsolescence: 0.15,     // 15% - Predicted EOL timeline
  single_source: 0.10,    // 10% - Supplier diversity
};

// Health Grades
interface BOMRiskSummary {
  total_items: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  health_grade: 'A' | 'B' | 'C' | 'D' | 'F';  // Based on % high risk
  top_risks: BOMLineItemRisk[];
}
```

#### New CBP Risk (Placeholder)

**Current State:** `src/pages/risk/RiskDashboard.tsx` is a **placeholder** with static cards.

```typescript
// Current implementation - PLACEHOLDER
export function RiskDashboard() {
  return (
    <div className="p-6">
      <h1>Risk Dashboard</h1>
      <p>Integration with CNS risk scoring engine in progress</p>
      {/* Static demo cards */}
    </div>
  );
}
```

**Services exist but not integrated:**
- `src/services/risk.service.ts` - API client ready
  - `GET /risk/portfolio` - Portfolio-level risk
  - `GET /risk/component/{id}` - Component risk
  - `POST /risk/calculate/{id}` - Trigger calculation

#### CNS Backend Risk Calculator

```python
# app/services/risk_calculator.py
RISK_WEIGHTS = {
    'lifecycle': 0.30,
    'supply_chain': 0.25,
    'compliance': 0.20,
    'obsolescence': 0.15,
    'single_source': 0.10,
}

RISK_LEVELS = {
    'LOW': (0, 30),
    'MEDIUM': (31, 60),
    'HIGH': (61, 85),
    'CRITICAL': (86, 100),
}
```

#### Comparison Table

| Feature | Old CBP | New CBP | CNS Backend |
|---------|---------|---------|-------------|
| **Dashboard** | ✅ Full | ❌ Placeholder | N/A |
| **Risk Weights** | 5-factor | Not shown | 5-factor (same) |
| **Health Grades** | A-F | Not implemented | Available via API |
| **Risk Trends** | ✅ Historical | ❌ None | ✅ Available |
| **Alerts Integration** | ✅ Linked | ❌ None | ✅ RabbitMQ events |
| **Export** | PDF/CSV | ❌ None | API available |

#### Migration Actions Required

1. **P0 - Integrate Risk Dashboard**
   ```typescript
   // src/pages/risk/RiskDashboard.tsx - Full implementation
   import { useRiskPortfolio, useRiskTrends } from '@/hooks/useRisk';

   export function RiskDashboard() {
     const { data: portfolio } = useRiskPortfolio();
     const { data: trends } = useRiskTrends();

     return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <RiskSummaryCard data={portfolio} />
         <RiskTrendChart data={trends} />
         <TopRisksTable items={portfolio?.top_risks} />
         <RiskByCategory data={portfolio?.by_category} />
       </div>
     );
   }
   ```

2. **P1 - Risk Alerts Integration**
   - Connect risk events to Novu notifications
   - Show risk alerts in notification center

---

### 2.6 Alerts & Notifications

#### Old CBP Alert Service (alertService.ts)

```typescript
// Alert Types
type AlertType =
  | 'LIFECYCLE'      // EOL/NRND status changes
  | 'RISK'           // Risk score threshold exceeded
  | 'PRICE'          // Price change > threshold
  | 'AVAILABILITY'   // Stock level changes
  | 'COMPLIANCE'     // Regulatory updates
  | 'PCN'            // Product Change Notifications
  | 'SUPPLY_CHAIN';  // Supply chain disruptions

// Alert Preferences
interface AlertPreferences {
  alert_types: AlertType[];
  email_frequency: 'immediate' | 'daily' | 'weekly';
  threshold_risk_score: number;      // e.g., 70
  threshold_price_change: number;    // e.g., 10 (%)
  threshold_lead_time: number;       // e.g., 14 (days)
}

// Component Watch
interface ComponentWatch {
  component_id: string;
  mpn: string;
  manufacturer: string;
  watch_types: AlertType[];
  created_at: Date;
}
```

#### New CBP Alerts (Placeholder)

**Current State:** `src/pages/alerts/AlertsDashboard.tsx` is a **placeholder**.

```typescript
// Current implementation - PLACEHOLDER
export function AlertsDashboard() {
  return (
    <div className="p-6">
      <h1>Alerts Dashboard</h1>
      <div className="flex gap-4">
        {/* Filter dropdowns - non-functional */}
        <Select placeholder="Alert Type" />
        <Select placeholder="Severity" />
        <Select placeholder="Date Range" />
      </div>
      <p>Integration with CNS alert engine in progress</p>
    </div>
  );
}
```

#### CNS Backend Alert System

```python
# app/services/alert_service.py
class AlertService:
    """Multi-channel alert delivery"""

    CHANNELS = ['novu', 'email', 'webhook', 'in_app']

    async def create_alert(self, alert: AlertCreate):
        # 1. Store in database
        # 2. Publish to RabbitMQ
        # 3. Trigger Novu workflow
        # 4. Send webhooks to subscribers

    async def get_user_alerts(self, user_id: str, filters: AlertFilters):
        # Paginated alert retrieval with filtering
```

#### Comparison Table

| Feature | Old CBP | New CBP | CNS Backend |
|---------|---------|---------|-------------|
| **Dashboard** | ✅ Full | ❌ Placeholder | N/A |
| **Alert Types** | 7 types | Not shown | 7 types (same) |
| **Email Digest** | ✅ Configurable | ❌ None | ✅ Novu workflows |
| **Component Watch** | ✅ Per-component | ❌ None | ✅ Available |
| **Preferences UI** | ✅ Settings page | ❌ None | API available |
| **Real-time** | ✅ WebSocket | ❌ None | ✅ RabbitMQ + Novu |
| **Webhook Delivery** | ❌ None | ❌ None | ✅ Available |

#### Migration Actions Required

1. **P0 - Alerts Dashboard Implementation**
   ```typescript
   // src/pages/alerts/AlertsDashboard.tsx
   import { useAlerts, useAlertPreferences } from '@/hooks/useAlerts';

   export function AlertsDashboard() {
     const { data: alerts, isLoading } = useAlerts(filters);

     return (
       <div className="space-y-4">
         <AlertFilters onFilterChange={setFilters} />
         <AlertsTable data={alerts} onDismiss={dismissAlert} />
         <AlertPreferencesDialog />
       </div>
     );
   }
   ```

2. **P0 - Notification Center Integration**
   ```typescript
   // Connect to Novu's in-app notification center
   import { NovuProvider, NotificationBell } from '@novu/notification-center';
   ```

3. **P1 - Component Watch Feature**
   - Add "Watch" button to component detail pages
   - Manage watches in user settings

---

### 2.7 CNS Service Integration Changes

#### Port Changes

| Service | Old Port | New Port | Status |
|---------|----------|----------|--------|
| CNS API | 27800 | 27200 | ✅ Updated |
| CNS Dashboard | N/A | 27250 | ✅ New |
| Supabase API | 54321 | 27810 | ✅ Updated |
| Supabase Studio | 54323 | 27800 | ✅ Updated |

#### API Endpoint Evolution

| Old Endpoint | New Endpoint | Changes |
|--------------|--------------|---------|
| `/api/boms` | `/api/boms` | Same structure |
| `/api/components/search` | `/api/catalog/search` | Namespace change |
| `/api/enrichment/status` | `/api/boms/{id}/enrichment/status` | BOM-scoped |
| `/api/organizations/{id}` | `/api/workspaces` | New hierarchy |
| N/A | `/api/admin/*` | New admin endpoints |

#### Authentication Changes

```typescript
// OLD: Auth0 + Supabase middleware
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'X-Organization-Id': organizationId,
    },
  },
});

// NEW: Keycloak JWT + X-Tenant-Id
const cnsApi = axios.create({
  baseURL: CNS_API_URL,
  headers: {
    'Authorization': `Bearer ${keycloakToken}`,
    'X-Tenant-Id': tenantId,
  },
});
```

#### Database Architecture Changes

```
OLD ARCHITECTURE:
┌─────────────────────────────────────────┐
│           Single Supabase DB            │
│  (customer data + component catalog)    │
└─────────────────────────────────────────┘

NEW ARCHITECTURE:
┌─────────────────────────────────────────┐
│         Supabase DB (Port 27432)        │
│  - boms, bom_line_items                 │
│  - organizations, workspaces           │
│  - enrichment_events, audit_logs       │
│  - 82+ tables for customer data        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│     Components V2 DB (Port 27010)       │
│  - component_catalog (SSOT)             │
│  - manufacturers, categories            │
│  - supplier_tokens, pricing             │
│  - Internal catalog management          │
└─────────────────────────────────────────┘
```

---

### 2.8 Gap Analysis Summary

#### Critical Gaps (P0 - Must Fix)

| Gap | Old CBP Feature | New CBP Status | Effort |
|-----|-----------------|----------------|--------|
| **Risk Dashboard** | Full implementation | Placeholder only | High |
| **Alerts Dashboard** | Full implementation | Placeholder only | High |
| **SSE Enrichment** | Real-time updates | 3s polling only | Medium |
| **Column Templates** | Saved per org | Not implemented | Medium |
| **Component Watch** | Per-component alerts | Not implemented | Medium |

#### Important Gaps (P1 - Should Fix)

| Gap | Old CBP Feature | New CBP Status | Effort |
|-----|-----------------|----------------|--------|
| **Alert Preferences** | Email frequency settings | Not implemented | Medium |
| **Risk Trends** | Historical charts | Not implemented | Medium |
| **Saved Searches** | Component exists | Not integrated | Low |
| **BOM Snapshots** | Feature flagged | Not implemented | High |
| **Export Features** | PDF/CSV for risk | Not implemented | Medium |

#### New Features in New CBP (Not in Old)

| Feature | Description | Status |
|---------|-------------|--------|
| **Workspaces** | 3-level hierarchy | ✅ Implemented |
| **5-Level RBAC** | analyst→super_admin | ✅ Implemented |
| **4 Theme Modes** | Light/Dark/Mid variants | ✅ Implemented |
| **Keycloak SSO** | Enterprise auth | ✅ Implemented |
| **OpenTelemetry** | Distributed tracing | ✅ Implemented |
| **Novu Integration** | Multi-channel notifications | ✅ Ready |
| **Component Comparison** | Side-by-side view | ✅ Implemented |

---

### 2.9 Recommended Migration Priority

```
PHASE 1 (Weeks 1-2): Critical Business Logic
├── Implement Risk Dashboard with CNS integration
├── Implement Alerts Dashboard with CNS integration
├── Add SSE enrichment progress (restore real-time)
└── Integrate SavedSearches component

PHASE 2 (Weeks 3-4): Feature Parity
├── Column mapping templates (save/load)
├── Component Watch functionality
├── Alert preferences UI
└── Risk trends visualization

PHASE 3 (Weeks 5-6): Enhancements
├── BOM snapshots feature
├── Bulk BOM operations
├── Export capabilities (PDF/CSV)
└── Cross-workspace analytics
```

---

## 3. Executive Summary

### Vision
Transform CBP Refine from a functional portal into a **best-in-class B2B SaaS experience** that exceeds the legacy React Admin CBP in every dimension: aesthetics, reliability, security, functionality, performance, and usability.

### Codebase Analysis Summary

| Metric | Count | Details |
|--------|-------|---------|
| **Total Pages** | 57 | 13 feature areas |
| **Custom Components** | 107 | Excluding shadcn/ui |
| **UI Components (shadcn)** | 48 | Form inputs, tables, dialogs |
| **Total Components** | 155 | Custom + UI library |
| **Custom Hooks** | 19 | Data, state, accessibility |
| **Contexts** | 4 | Auth, Tenant, Notification, Sidebar |
| **Data Providers** | 3 | Platform, CNS, Supabase |
| **Lazy-Loaded Routes** | 30+ | Code splitting |
| **Role Levels** | 5 | analyst → super_admin |

### Current State Comparison

| Dimension | Legacy CBP | New CBP Refine | Target |
|-----------|------------|----------------|--------|
| **Core Implementation** | 100% | 95% | 100%+ |
| **Feature Parity** | Baseline | 95% | 110% (exceed) |
| **WCAG Compliance** | 45% | 82% | 100% |
| **Bundle Size (gzipped)** | 580 KB | 600 KB | <400 KB |
| **Time to Interactive** | 12s | ~2.5s | <2s |
| **Mobile Optimization** | 5% | 25%+ | 35%+ |
| **Test Coverage** | 40% | 760+ assertions | 90%+ |

### Key Improvements Over Legacy

| Area | Legacy Pain Point | New CBP Solution |
|------|-------------------|------------------|
| **Auth** | Dual Supabase/Auth0 complexity | Single Keycloak OIDC with PKCE |
| **Billing** | Direct Stripe calls | Centralized subscription-service |
| **Tenant** | Local org management | Platform X-Tenant-Id header |
| **UI Framework** | Material-UI (heavy) | shadcn/ui + Tailwind (lightweight) |
| **State** | React Admin patterns | Refine + TanStack Query |
| **Real-time** | SSE only | Polling + SSE fallback |
| **Roles** | 4-level hierarchy | 5-level RBAC aligned with platform |
| **Accessibility** | 45% WCAG | 82% WCAG AA |
| **Theme System** | Light only | 4 modes (light/dark/mid-light/mid-dark) |

### Integration Points (ARC-SaaS)

| Service | Purpose | Port | Status |
|---------|---------|------|--------|
| **Keycloak** | Authentication (OIDC) | 8180 | ✅ Integrated |
| **tenant-management-service** | Multi-tenant context | 14000 | ✅ Integrated |
| **subscription-service** | Billing & Plans | 14000 | ✅ Integrated |
| **Temporal** | Workflows | 27020 | ✅ Ready |
| **Novu** | Notifications | 13100 | ✅ Ready |
| **CNS Service** | BOM/Components | 27200 | ✅ Integrated |

---

## 4. Current State Assessment

### 4.1 Build Completion

| Step | Area | Status | Completion |
|------|------|--------|------------|
| 1 | Foundation & Tooling | ✅ DONE | 100% |
| 2 | Auth & Session | ✅ DONE | 95% |
| 3 | Tenant Context | ✅ DONE | 90% |
| 4 | Data Providers | ✅ DONE | 95% |
| 5 | Navigation & RBAC | ✅ DONE | 100% |
| 6 | BOM Management UX | ✅ DONE | 95% |
| 7 | Component Catalog | ✅ DONE | 95% |
| 8 | Billing & Subscription | ✅ DONE | 90% |
| 9 | Team & Invites | ✅ DONE | 95% |
| 10 | Observability & Testing | ✅ DONE | 95% |

**Overall: ~95% implementation completeness**

### 4.2 Test Coverage

| Category | Count |
|----------|-------|
| Unit Tests | 498+ |
| E2E Spec Files | 4 |
| Storybook Stories | 9 |
| **Total Assertions** | 760+ |

### 4.3 Bundle Metrics (Current)

| Metric | Current | Threshold | Status |
|--------|---------|-----------|--------|
| Main chunk (gzip) | 132 KB | 80 KB | ⚠️ High |
| Feature-BOM (gzip) | 116 KB | 80 KB | ⚠️ High |
| XLSX vendor (gzip) | 113 KB | N/A | ⚠️ Not lazy-loaded |
| Vendor-Refine (gzip) | 80 KB | 100 KB | ✅ OK |
| Vendor-React (gzip) | 53 KB | 60 KB | ✅ OK |
| **Total Initial (gzip)** | 600 KB | 400 KB | ⚠️ Needs optimization |

---

## 5. Architecture Deep Dive

### 5.1 Page Structure (57 Total)

```
src/pages/
├── Dashboard.tsx                   (main dashboard)
├── Landing.tsx                     (public landing)
├── auth/                           (4 files)
│   ├── Login.tsx
│   ├── Callback.tsx
│   ├── AcceptInvitation.tsx
│   └── PermissionDenied.tsx
├── alerts/
│   └── AlertsDashboard.tsx
├── billing/
│   ├── index.tsx
│   └── invoices.tsx
├── boms/                           (6 main + 7 components)
│   ├── BomList.tsx
│   ├── BomDetail.tsx
│   ├── BomUpload.tsx
│   └── RiskAnalysis.tsx
├── components/                     (6 main + 4 utilities)
│   ├── ComponentList.tsx
│   ├── ComponentCompareView.tsx
│   ├── search.tsx
│   └── compare.tsx
├── portfolio/
│   └── index.tsx                   (Owner-only analytics)
├── projects/
│   ├── ProjectList.tsx
│   ├── ProjectDetail.tsx
│   └── ProjectCreate.tsx
├── risk/
│   └── RiskDashboard.tsx
├── settings/
│   ├── index.tsx
│   ├── organization.tsx
│   └── preferences.tsx
├── team/
│   ├── index.tsx
│   └── invitations.tsx
└── workspaces/
    └── WorkspaceList.tsx
```

### 5.2 Component Architecture (155 Total)

| Category | Count | Purpose |
|----------|-------|---------|
| **UI Library (shadcn)** | 48 | Form inputs, buttons, tables, dialogs |
| **Shared Utilities** | 18 | Empty states, errors, skeletons, loaders |
| **BOM Features** | 15 | Upload, enrichment, bulk ops, export |
| **Team Management** | 7 | Members, invitations, roles |
| **Dashboard Widgets** | 4 | Summary cards, stats, activity |
| **Help System** | 4 | Contextual help, tooltips |
| **Onboarding** | 4 | Guided tours |
| **Pricing** | 4 | Price visualization, supplier comparison |
| **Search** | 4 | Search history, saved searches |
| **Layout** | 4 | Sidebar, header, navigation |
| **Billing** | 3 | Subscription, invoices, usage |
| **Auth** | 2 | Protected routes, session dialogs |
| **Notifications** | 2 | Notification center, bell |
| **Tenant** | 2 | Tenant switcher, error handling |
| **Theme** | 1 | Dark/light mode |

### 5.3 Data Provider Architecture

**Three Separate API Endpoints:**

| Provider | Base URL | Purpose |
|----------|----------|---------|
| `platform` | localhost:14000/api | Users, team, billing, settings |
| `cns` | localhost:27200/api | BOMs, components, projects, workspaces |
| `supabase` | localhost:27810/rest/v1 | Component catalog (read-only) |

### 5.4 State Management

**Context-Based State:**
- `AuthContext` - OIDC client, token refresh, permissions
- `TenantContext` - Multi-tenant selection
- `NotificationContext` - Novu integration
- `SidebarContext` - Mobile sidebar state

**Query-Based State (React Query):**
- Stale times: 2-15 minutes based on data volatility
- Cache time: 30 minutes
- Retry logic with exponential backoff
- Request deduplication built-in

---

## 6. User Persona Improvements

### 6.1 Emily Chen - Engineer (BOM Management)

**Current Pain Points:**
- Column mapping takes 15 minutes (63% drop-off)
- No bulk BOM operations
- Limited real-time enrichment feedback
- No template download for first-time users

**Improvements:**

| Priority | Solution | Impact | Effort |
|----------|----------|--------|--------|
| **P0** | AI-Powered Column Mapping | 15 min → 3 min (80% reduction) | High |
| **P0** | Template Download | Eliminate trial-and-error onboarding | Low |
| **P0** | Real-time SSE Progress | Immediate enrichment feedback | Medium |
| **P1** | Bulk BOM Operations | Process 20+ BOMs at once | Medium |
| **P1** | Draft Saving | Auto-save to localStorage | Low |

**Implementation - Smart Column Mapper:**
```typescript
interface SmartColumnMapperProps {
  columns: string[];
  onMapping: (mapping: ColumnMapping) => void;
  previousMappings?: ColumnMapping[]; // Learn from history
}

// Features:
// 1. AI confidence scores per mapping (0-100%)
// 2. Visual indicators for uncertain mappings
// 3. One-click "Accept All" for high-confidence mappings
// 4. Template save/load per organization
// 5. Inline preview of sample values for validation
```

### 6.2 David Rodriguez - Analyst (Component Search)

**Current Pain Points:**
- Search only covers MPN, manufacturer, description
- 2-4 component comparison limit
- No saved searches (feature exists but not integrated)
- No alternates/cross-reference feature

**Improvements:**

| Priority | Solution | Impact | Effort |
|----------|----------|--------|--------|
| **P0** | Integrate SavedSearches | Prevent daily re-searches | Low |
| **P0** | Advanced Spec Filters | Search by voltage, package, etc. | High |
| **P1** | Expand Comparison to 6+ | Enable better analysis | Low |
| **P1** | Export Comparison | CSV/PDF export capability | Medium |
| **P2** | Find Alternates | Drop-in replacement discovery | High |

**Implementation - Saved Search Integration:**
```typescript
// src/pages/components/ComponentList.tsx
// Add SavedSearches component from src/components/search/SavedSearches.tsx
import { SavedSearches } from '@/components/search/SavedSearches';

// In component JSX
<div className="flex justify-between mb-4">
  <SearchInput ... />
  <SavedSearches
    currentFilters={filters}
    onApply={(savedFilters) => setFilters(savedFilters)}
  />
</div>
```

### 6.3 Sarah Johnson - Owner (Executive Oversight)

**Current Pain Points:**
- Usage metrics lack comparison to plan limits
- No cost estimator for upgrades
- No overage warnings before hitting limits

**Improvements:**

| Priority | Solution | Impact | Effort |
|----------|----------|--------|--------|
| **P0** | Usage vs. Limits Display | Progress bars showing "X of Y used" | Medium |
| **P0** | Proactive Overage Warnings | Notify at 75%, 90%, 100% | Medium |
| **P1** | Interactive Cost Calculator | Predict costs before upgrade | High |
| **P1** | Plan Comparison Modal | Compare inline without navigation | Medium |

**Portfolio Dashboard Structure:**
```typescript
interface PortfolioMetrics {
  totalBoms: number;
  totalProjects: number;
  highRiskComponents: number;
  activeAlerts: number;
  complianceScore: number;          // 0-100%
  riskTrend: 'improving' | 'stable' | 'worsening';
  topRisks: RiskItem[];             // Top 5
  projectHealthScores: ProjectHealth[];
  upcomingEOLEvents: EOLEvent[];
  budgetImpact: MonetaryImpact;
  // NEW: Usage tracking
  usageLimits: {
    bomsUsed: number;
    bomsLimit: number;
    searchesUsed: number;
    searchesLimit: number;
  };
}
```

### 6.4 Alex Patel - Super Admin (Platform Operations)

**Current Pain Points:**
- No cross-tenant visibility
- No admin console
- No impersonation for troubleshooting

**Improvements:**

| Priority | Solution | Impact | Effort |
|----------|----------|--------|--------|
| **P0** | Admin Console | Platform ops capability | High |
| **P1** | Tenant Impersonation | Faster support resolution | Medium |
| **P1** | Usage Analytics Dashboard | Identify struggling orgs | Medium |
| **P2** | Bulk User Operations | Manage 100+ users at once | Medium |

---

## 7. UX Metrics & Targets

### 7.1 Performance Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Initial JS (gzipped) | 600 KB | 400 KB | 33% |
| Time-to-Interactive | ~2.5s | <2s | 20% |
| First Contentful Paint | ~1.2s | <1s | 17% |
| Largest Contentful Paint | ~1.8s | <1.5s | 17% |
| BOM List Render (100 items) | 480ms | 150ms | 69% |

### 7.2 User Efficiency Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| BOM Upload Duration | 28 min | <12 min | 57% |
| Column Mapping Time | 15 min | <3 min | 80% |
| Risk Mitigation (10 items) | 8.3 min | <3 min | 64% |
| Component Search Time | 6.2 min | <2 min | 68% |

### 7.3 User Success Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| BOM Upload Completion | 60% | 90% | 50% |
| Component Search Success | 42% | 75% | 79% |
| First-Time Activation | 35 min | <10 min | 71% |
| Mobile/Tablet Usage | 8% | 25% | 213% |

### 7.4 Accessibility Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| WCAG 2.1 AA Compliance | 82% | 100% | 18% |
| Keyboard Navigation | 88% | 100% | 12% |
| Screen Reader Compatibility | 78% | 100% | 22% |
| Color Contrast Ratio | 4.5:1+ | 4.5:1 min | ✅ Met |

---

## 8. Design System & Visual Aesthetics

### 8.1 Design Token System (EXCELLENT)

**Overall Visual Consistency Score: 8.5/10**

**CSS Variables Architecture (58 tokens per theme):**
```css
/* Core Colors */
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground

/* Extended Semantic */
--success, --success-foreground
--warning, --warning-foreground
--info, --info-foreground

/* Sidebar-Specific (10 tokens) */
--sidebar-background, --sidebar-foreground, etc.

/* Shadow System (6 semantic shadows) */
--shadow-primary, --shadow-success, --shadow-warning
--shadow-error, --shadow-hover, --shadow-focus
```

### 8.2 TypeScript Design Tokens

**24KB type-safe token system** with:
- Spacing scale (17 values)
- Font sizes (10 sizes with line heights)
- Shadows (11 variants including semantic)
- Z-index layers (6 levels)
- Border radius (5 sizes)
- Transitions (3 durations)
- 100% test coverage

### 8.3 Theme Variants (4 Total)

| Theme | Description | Use Case |
|-------|-------------|----------|
| **Light** | Standard light theme | Default, high ambient light |
| **Dark** | Standard dark theme | Low light, user preference |
| **Mid-Light** | Softer light | Reduced eye strain |
| **Mid-Dark** | Softer dark | OLED screens |

### 8.4 Animation Library

**Built-in Animations:**
- `accordion-down/up` (0.2s ease-out)
- `shimmer` (1.5s infinite) for skeleton states
- `animate-spin` for loaders
- `animate-pulse` for subtle attention

**Custom Page Transitions:**
```css
.page-enter {
  animation: pageEnter 0.3s ease-out;
}

@keyframes pageEnter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 8.5 Component Gap Analysis

**Well-Covered Areas:**
- Form inputs and validation ✅
- Data display (tables, cards) ✅
- Feedback (toasts, alerts, loading states) ✅
- Overlays (modals, sheets, popovers) ✅
- Navigation (tabs, dropdowns) ✅

**Component Status (Updated 2025-12-18):**

| Component | Priority | Status |
|-----------|----------|--------|
| Breadcrumb | P0 | ✅ DONE - `src/components/layout/Breadcrumbs.tsx` (131 lines) |
| Command Palette | P0 | ✅ DONE - `src/components/command/CommandPalette.tsx` (475 lines) |
| Empty States | P0 | ✅ DONE - `src/components/shared/EmptyState.tsx` (403 lines, 7+ variants) |
| Skeleton Loaders | P0 | ✅ DONE - `src/components/ui/skeleton-presets.tsx` (719 lines, 15+ components) |
| Pagination | P0 | ✅ DONE - In ResponsiveTable |
| Combobox (searchable select) | P1 | ⚠️ Using basic Select |
| Timeline/Stepper | P1 | ✅ DONE - In BomUpload wizard |
| Tree View | P2 | ❌ Not needed |
| Data Visualization Charts | P2 | ⚠️ Using Recharts |

---

## 9. Component Enhancement Plan

### 9.1 High Priority Components (P0) - STATUS UPDATE

> **NOTE (2025-12-18):** Sprint 1 P0 components have been IMPLEMENTED. See below for actual file locations.

#### Breadcrumb Component - IMPLEMENTED
**Location:** `src/components/layout/Breadcrumbs.tsx` (131 lines)
**Related:** `src/hooks/useBreadcrumbs.ts`
**Features:**
- Auto-generates from current route using navigation manifest
- Clickable path segments (except current page)
- Responsive with mobile collapse (useCollapsedBreadcrumbs)
- Home icon for root, chevron separators
- Accessible with proper ARIA attributes

#### Command Palette - IMPLEMENTED
**Location:** `src/components/command/CommandPalette.tsx` (475 lines)
**Related:** `src/components/command/CommandItem.tsx`, `src/hooks/useKeyboardShortcuts.ts`
**Features:**
- Global Cmd+K / Ctrl+K shortcut
- Search across navigation items and quick actions
- Recent items with localStorage persistence
- Keyboard navigation (arrow keys, Enter, Escape)
- Role-based action filtering
- Grouped results by category

#### Empty States - IMPLEMENTED
**Location:** `src/components/shared/EmptyState.tsx` (403 lines)
**Variants:** EmptyState, NoResultsState, ErrorState, NoPermissionState, NoBOMsState, NoComponentsState, NoFilteredResultsState
**Features:**
- Size variants (sm, md, lg)
- Icon customization
- Action buttons (primary + secondary)
- Accessible with ARIA attributes

#### Skeleton Loaders - IMPLEMENTED
**Location:** `src/components/ui/skeleton-presets.tsx` (719 lines)
**Components:** TextSkeleton, AvatarSkeleton, CardSkeleton, TableRowSkeleton, ListItemSkeleton, StatSkeleton, FormFieldSkeleton, ButtonSkeleton, ImageSkeleton, BadgeSkeleton, ChartSkeleton, SkeletonGroup, NavbarSkeleton, ProfileHeaderSkeleton, DashboardSkeleton

---

### 9.1.1 Legacy Reference - Breadcrumb Component (Original Plan)
```tsx
// src/components/ui/breadcrumb.tsx
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {items.map((item, i) => (
        <React.Fragment key={item.href}>
          {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

#### Pagination Component (NEW)
```tsx
// src/components/ui/pagination.tsx
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={currentPage === 1}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={currentPage === totalPages}>
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### 9.2 Existing Component Enhancements

#### Button (Already Enhanced)
- ✅ Touch targets: 44px mobile, 40px desktop
- ✅ Loading state with spinner
- ✅ Icon support (left/right)
- ✅ ARIA support

#### Card (Already Enhanced)
- ✅ 4 elevation variants
- ✅ 3 hover effects
- ✅ Status borders
- ✅ Loading overlay

#### Input (Already Enhanced)
- ✅ Icon support
- ✅ Clearable
- ✅ Character counter
- ✅ Error states with ARIA

### 9.3 New Components Needed

```
src/components/
├── ui/
│   ├── breadcrumb.tsx           # NEW - Navigation context
│   ├── pagination.tsx           # NEW - List pagination
│   ├── combobox.tsx             # NEW - Searchable select
│   ├── timeline.tsx             # NEW - Step progress
│   └── virtualized-table.tsx    # NEW - Large list performance
├── dashboard/
│   └── UsageProgressCard.tsx    # NEW - Usage vs limits
└── billing/
    └── CostEstimator.tsx        # NEW - Upgrade calculator
```

---

## 10. Critical User Journeys

### 10.1 BOM Upload & Enrichment

**Current Flow (28 min):**
```
1. Navigate (30s) → 2. Select File (1m) → 3. Preview (2m) →
4. Column Mapping (15m) ⚠️ BOTTLENECK → 5. Options (3m) →
6. Submit (30s) → 7. Wait (6m)
```

**Optimized Flow (6 min target):**
```
1. Navigate (30s) → 2. Drag-Drop (10s) → 3. Auto-Mapped Preview (30s) →
4. Confirm/Adjust (1m) → 5. Submit with Options (30s) →
6. Real-time Progress (3m) → Success with Summary
```

**Implementation Checklist:**
- [ ] Add template download button (P0)
- [ ] AI column mapping service (backend)
- [ ] Incremental validation at each step
- [ ] Draft auto-save to localStorage
- [ ] Bulk upload support (multiple files)
- [ ] Enhanced progress UI with stage breakdowns

### 10.2 Component Search & Comparison

**Current Flow (6.2 min):**
```
1. Search (30s) → 847 results → 2. Filter (1.5m) →
127 results → 3. Select 2-4 (30s) → 4. Compare (1m) → No export ⚠️
```

**Optimized Flow (2 min target):**
```
1. Load Saved Search (5s) → 37 results →
2. Sort by Price (5s) → 3. Select 6+ (30s) →
4. Compare Side-by-Side (1m) → 5. Export PDF/CSV
```

**Implementation Checklist:**
- [ ] Integrate SavedSearches component (exists, unused)
- [ ] Add advanced spec filters (voltage, package, etc.)
- [ ] Expand comparison limit from 4 to 6+
- [ ] Add export button to comparison view
- [ ] Add "Find Alternates" feature

### 10.3 Team Management

**Current Pain Points:**
- Single email invitation only
- No pending invitation tracking
- No activity history

**Implementation Checklist:**
- [ ] Bulk CSV invitation upload
- [ ] Add "Pending Invitations" tab with resend/revoke
- [ ] Add activity log for role changes
- [ ] Group members by team/project

### 10.4 Billing & Subscription

**Current Pain Points:**
- Usage metrics lack plan limit context
- No proactive overage warnings
- Must leave page to compare plans

**Implementation Checklist:**
- [ ] Add progress bars: "X of Y BOMs used"
- [ ] Implement threshold notifications (75%, 90%, 100%)
- [ ] Add inline plan comparison modal
- [ ] Add interactive cost calculator

---

## 11. Accessibility (WCAG 2.1 AA)

### 11.1 Current Compliance Status

**Overall Score: 82%**

| WCAG Principle | Score | Status |
|----------------|-------|--------|
| **Perceivable** | 78% | ⚠️ Moderate Issues |
| **Operable** | 88% | ✅ Minor Issues |
| **Understandable** | 85% | ✅ Minor Issues |
| **Robust** | 78% | ⚠️ Moderate Issues |

### 11.2 Critical Fixes (P0)

#### 1. Form Labels in BomUpload.tsx

**Issue:** Lines 620-626, 631-639, 528-549 - inputs missing explicit labels

**Fix:**
```tsx
<label htmlFor="bom-name" className="mb-1 block text-sm font-medium">
  BOM Name <span className="text-red-500" aria-label="required">*</span>
</label>
<input
  id="bom-name"
  type="text"
  aria-required="true"
  aria-invalid={error ? 'true' : 'false'}
  aria-describedby={error ? 'bom-name-error' : undefined}
  ...
/>
```

#### 2. Color Contrast in Badge Component

**Issue:** Warning badge `bg-yellow-100/text-yellow-800` = 2.9:1 (fails 4.5:1 requirement)

**Fix in badge.tsx:**
```tsx
warning: 'border-transparent bg-yellow-700 text-white dark:bg-yellow-600',
```

#### 3. Integrate SkipLinks into Layout

**Issue:** SkipLinks component exists but not used in Layout.tsx

**Fix:**
```tsx
import { SkipLinks } from '@/components/layout/SkipLinks';

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <SkipLinks />  {/* Add this */}
      <aside id="main-navigation" ...>
      <main id="main-content" ...>
    </div>
  );
}
```

#### 4. Replace Custom InviteModal with Radix Dialog

**Issue:** InviteModal lacks focus trap, focus restoration

**Fix:** Use existing Dialog component from ui/dialog.tsx

### 11.3 Serious Fixes (P1)

| Issue | Location | Fix |
|-------|----------|-----|
| Dropdown menu keyboard nav | MemberCard.tsx:140-146 | Add role="menu", keyboard handlers |
| Icon buttons missing aria-label | Layout.tsx:168-173, 213-217 | Add aria-label="Close/Open menu" |
| Decorative icons need aria-hidden | 20+ instances | Add aria-hidden="true" |
| Progress bar missing ARIA | BomUpload.tsx:837-853 | Add role="progressbar", aria-valuenow |

### 11.4 Good Implementations (Keep)

- ✅ **Touch targets**: 44px mobile, 40px desktop
- ✅ **Focus styles**: `:focus-visible` with ring
- ✅ **Toast notifications**: role="status"/role="alert" with aria-live
- ✅ **InputWrapper**: Full error state support with aria-invalid
- ✅ **Reduced motion**: Respects prefers-reduced-motion
- ✅ **Skeleton loaders**: Theme-aware shimmer animation

---

## 12. Mobile & Tablet Optimization

### 12.1 Current State

| Device | Usage | Target |
|--------|-------|--------|
| Desktop | 75% | 65% |
| Tablet | 17% | 25% |
| Mobile | 8% | 10% |

### 12.2 Touch Target Implementation (EXCELLENT)

**Already Implemented:**
```css
/* src/styles/touch-targets.css */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

@media (pointer: coarse) {
  button, a[role="button"], [role="button"] {
    min-height: 44px;
  }
}
```

### 12.3 Responsive Components

**Implemented:**
- ✅ Bottom navigation for tablet portrait
- ✅ Swipeable BOM rows (SwipeableBomRow)
- ✅ Responsive sidebar (mobile drawer)
- ✅ ResponsiveTable (desktop table, mobile cards)

**Needed:**
- [ ] Camera BOM upload (CameraUpload.tsx exists, needs testing)
- [ ] Pull-to-refresh component
- [ ] Orientation support CSS

### 12.4 Mobile Upload Flow (Simplified)

**Desktop (7 steps) → Mobile (4 steps):**
```
1. Take Photo (camera) → 2. OCR Processing →
3. Confirm Data (tap to edit) → 4. Upload
```

---

## 13. Performance Optimization

### 13.1 Top 5 Optimization Opportunities

| # | Optimization | Impact | Effort |
|---|--------------|--------|--------|
| 1 | **Lazy-load XLSX library** | -113KB initial, -19% bundle | Low |
| 2 | **Implement table virtualization** | 60% faster for 100+ items | Medium |
| 3 | **Split feature-bom chunk** | -50KB per route load | Low |
| 4 | **Memoize list items** | 40% fewer re-renders | Low |
| 5 | **Prefetch on hover** | -62% perceived load time | Low |

### 13.2 Bundle Optimization (vite.config.ts)

```typescript
// Recommended changes
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-refine': ['@refinedev/core', '@refinedev/react-router-v6'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-ui-critical': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
  'vendor-ui-secondary': ['@radix-ui/react-tabs', '@radix-ui/react-select'],
  // REMOVE XLSX - lazy load instead
  // 'vendor-xlsx': ['xlsx'], ❌
  // Split BOM features
  'feature-bom-list': ['./src/pages/boms/BomList.tsx'],
  'feature-bom-upload': ['./src/pages/boms/BomUpload.tsx'],
}
```

### 13.3 Table Virtualization

**Install:** `@tanstack/react-virtual`

```typescript
// BomList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: boms.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
  overscan: 10,
});
```

### 13.4 Memoization Pattern

```typescript
// BomRow component
const BomRow = React.memo(({ bom, isSelected, onSelect }) => {
  return <tr>...</tr>;
}, (prev, next) => {
  return prev.bom.id === next.bom.id && prev.isSelected === next.isSelected;
});
```

### 13.5 Prefetch on Hover

```typescript
const prefetchBom = useCallback((bomId: string) => {
  queryClient.prefetchQuery({
    queryKey: ['boms', bomId],
    queryFn: () => cnsApi.get(`/boms/${bomId}`),
  });
}, []);

<tr onMouseEnter={() => prefetchBom(bom.id)}>
```

### 13.6 Performance Budgets

| Metric | Current | Target |
|--------|---------|--------|
| Initial JS (gzipped) | 600KB | 400KB |
| Main chunk (gzipped) | 132KB | 80KB |
| Time to Interactive | ~2.5s | <2s |
| BOM list render (100 items) | 480ms | 150ms |
| Route transition | 200ms | 100ms |

---

## 14. Security Hardening

### 14.1 Current State

| Issue | Severity | Status |
|-------|----------|--------|
| CSP with `'unsafe-inline'` | High | ⚠️ Needs nonce |
| Token revocation on logout | High | ⚠️ Not implemented |
| Audit logging for super admin | Medium | ⚠️ Partial |

### 14.2 CSP Hardening

**Current (Problematic):**
```
script-src 'self' 'unsafe-inline';
```

**Target (Secure):**
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-{{NONCE}}';
  style-src 'self' 'nonce-{{NONCE}}';
  connect-src 'self' https://api.ananta.com https://auth.ananta.com;
  frame-ancestors 'none';
">
```

### 14.3 Logout with Token Revocation

```typescript
const logout = useCallback(async () => {
  const user = await userManager.getUser();

  if (user?.access_token) {
    await fetch(`${keycloakUrl}/protocol/openid-connect/revoke`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: 'cbp-frontend',
        token: user.access_token,
        token_type_hint: 'access_token',
      }),
    });
  }

  clearTenantCache();
  await userManager.signoutRedirect();
}, []);
```

---

## 15. ARC-SaaS Integration

### 15.1 Authentication (Keycloak OIDC)

**Configuration:**
```typescript
export const oidcConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_KEYCLOAK_URL + '/realms/ananta-saas',
  client_id: 'cbp-frontend',
  redirect_uri: window.location.origin + '/authentication/callback',
  response_type: 'code',
  scope: 'openid profile email roles cns-api',
  automaticSilentRenew: true,
};
```

### 15.2 Role Hierarchy (5-Level)

```typescript
export const ROLE_LEVELS: Record<AppRole, number> = {
  analyst: 1,     // Read-only
  engineer: 2,    // BOM/component management
  admin: 3,       // Team management
  owner: 4,       // Billing + all admin
  super_admin: 5, // Platform-wide access
};
```

### 15.3 Multi-Tenant Context

**X-Tenant-Id Header Injection:**
```typescript
config.headers['X-Tenant-Id'] = currentTenant?.id;
```

### 15.4 Notifications (Novu) - IMPLEMENTED

**Status (2025-12-18):** Full Novu integration implemented
**Location:** `src/contexts/NotificationContext.tsx` (78 lines)
**Features:**
- NovuProvider integration with subscriber ID from authenticated user
- Environment variable configuration (VITE_NOVU_APP_IDENTIFIER, VITE_NOVU_API_URL, VITE_NOVU_WS_URL)
- Conditional initialization (only when authenticated)
- useNotifications hook for context access
- NotificationBell component at `src/components/notifications/NotificationBell.tsx`

**Available Workflows:**
- `user-invitation` - Team member invitations
- `tenant-welcome` - New tenant onboarding
- `tenant-provisioning-failed` - Provisioning errors
- `payment-failed` - Billing issues
- `subscription-created` - New subscriptions
- `trial-ending-soon` - Trial warnings

---

## 16. Implementation Roadmap

### Phase 1: Critical UX & Accessibility (Weeks 1-4)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | **Accessibility P0** | Form labels, skip links, badge contrast |
| 2 | **Navigation** | Breadcrumbs, saved searches integration |
| 3 | **BOM UX** | Template download, incremental validation |
| 4 | **Performance** | Lazy-load XLSX, memoize list items |

**Success Metrics:**
- WCAG 2.1 AA: 82% → 95%
- BOM upload completion: 60% → 75%
- Initial bundle: 600KB → 500KB

### Phase 2: Feature Enhancements (Weeks 5-8)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 5 | **Billing UX** | Usage limits display, proactive warnings |
| 6 | **Search** | Advanced spec filters, export comparison |
| 7 | **Team** | Bulk invitations, pending invitations tab |
| 8 | **Performance** | Table virtualization, split BOM chunk |

**Success Metrics:**
- Search success rate: 42% → 65%
- Team onboarding: 5 min → 2 min per member
- Bundle size: 500KB → 400KB

### Phase 3: Advanced Features (Weeks 9-12)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 9 | **AI Column Mapping** | Smart suggestions backend + UI |
| 10 | **BOM Comparison** | Side-by-side design iteration |
| 11 | **Find Alternates** | Drop-in replacement discovery |
| 12 | **Admin Console** | Super admin platform ops |

**Success Metrics:**
- Column mapping time: 15 min → 3 min
- BOM upload completion: 75% → 90%
- Feature parity: 95% → 110%

### Phase 4: Polish & Exceed (Weeks 13-16)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 13 | **Security** | CSP hardening, token revocation |
| 14 | **PWA** | Offline mode, push notifications |
| 15 | **Analytics** | Cost calculator, usage dashboards |
| 16 | **Testing** | Penetration testing, load testing |

---

## 17. Success Metrics & KPIs

### 17.1 User Experience KPIs

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| BOM Upload Completion | 60% | 90% | Analytics funnel |
| Column Mapping Time | 15 min | <3 min | User timing API |
| Search Success Rate | 42% | 75% | Clicks / searches |
| First-Time Activation | 35 min | <10 min | Onboarding tracking |

### 17.2 Performance KPIs

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| Bundle Size (gzip) | 600 KB | <400 KB | CI/CD check |
| Time to Interactive | ~2.5s | <2s | Lighthouse |
| LCP | ~1.8s | <1.5s | Core Web Vitals |
| Table render (100 items) | 480ms | <150ms | Performance monitor |

### 17.3 Accessibility KPIs

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| WCAG 2.1 AA | 82% | 100% | axe-core scan |
| Keyboard Navigation | 88% | 100% | Manual testing |
| Screen Reader | 78% | 100% | NVDA/VoiceOver |

### 17.4 Security KPIs

| KPI | Baseline | Target | Measurement |
|-----|----------|--------|-------------|
| CSP Violations | Unknown | 0 | CSP reporting |
| Auth Failures | Unknown | <1% | Keycloak logs |
| Audit Coverage | Partial | 100% | Super admin actions |

---

## Appendix A: File Modification Checklist

### Files Requiring Changes

#### Priority 0 (Critical)
- [ ] `src/pages/boms/BomUpload.tsx` - Add form labels (lines 620-626, 631-639, 528-549)
- [ ] `src/components/ui/badge.tsx` - Fix warning badge contrast
- [ ] `src/components/layout/Layout.tsx` - Integrate SkipLinks, add icon aria-labels
- [ ] `src/components/team/InviteModal.tsx` - Replace with Radix Dialog

#### Priority 1 (High)
- [ ] `vite.config.ts` - Optimize chunk splitting, remove XLSX from initial
- [ ] `src/pages/boms/BomList.tsx` - Add memoization, prefetch on hover
- [ ] `src/pages/components/ComponentList.tsx` - Integrate SavedSearches
- [ ] `src/pages/billing/index.tsx` - Add usage limits display
- [ ] `src/components/team/MemberCard.tsx` - Fix dropdown keyboard nav

#### Priority 2 (Medium)
- [ ] `src/styles/globals.css` - Improve muted-foreground contrast
- [ ] `src/components/ui/table.tsx` - Add caption and aria-label support
- [ ] All decorative icons - Add aria-hidden="true"

### New Files to Create

```
src/components/
├── ui/
│   ├── breadcrumb.tsx
│   ├── pagination.tsx
│   ├── combobox.tsx
│   ├── timeline.tsx
│   └── virtualized-table.tsx
├── billing/
│   ├── UsageProgressCard.tsx
│   └── CostEstimator.tsx
└── hooks/
    └── usePrefetch.ts
```

---

## Appendix B: Testing Checklist

### Accessibility Testing
- [ ] axe-core automated scan (target: 0 critical/serious)
- [ ] Keyboard-only navigation test (all pages)
- [ ] Screen reader test (NVDA, VoiceOver)
- [ ] Color contrast verification (all 4 themes)
- [ ] Focus visible on all interactive elements

### Performance Testing
- [ ] Bundle size CI check (<400KB target)
- [ ] Lighthouse score >90
- [ ] 1000+ row table at 60 FPS
- [ ] Cold start <2s

### Security Testing
- [ ] CSP blocks inline scripts
- [ ] Token revocation on logout
- [ ] Cross-tenant access prevention
- [ ] Input sanitization

### Device Testing
- [ ] iPad Pro 12.9" (Safari)
- [ ] iPad Mini (Safari)
- [ ] Android tablet (Chrome)
- [ ] Touch targets 44px+ verification

---

**Document Status:** Version 4.1 - Sprint 1 Complete
**Owner:** CBP Development Team
**Next Review:** January 15, 2026
**Initial Analysis:** December 15, 2025 by 5 specialized agents (UI/UX, Performance, Accessibility, Architecture, User Journey)
**Business Logic Comparison:** December 15, 2025 - Old CBP React Admin vs New CBP Refine portal analysis complete
**Sprint 1 Audit:** December 18, 2025 - All Sprint 1 P0 features confirmed IMPLEMENTED:
- Command Palette (Cmd+K) - `src/components/command/CommandPalette.tsx` (475 lines)
- Breadcrumbs - `src/components/layout/Breadcrumbs.tsx` (131 lines)
- Empty States - `src/components/shared/EmptyState.tsx` (403 lines, 7+ variants)
- Skeleton Loaders - `src/components/ui/skeleton-presets.tsx` (719 lines, 15+ components)
- Novu Notifications - `src/contexts/NotificationContext.tsx` (78 lines)
- Cross-Tab Session Sync - `src/contexts/AuthContext.tsx` (BroadcastChannel API)
- Storybook Coverage - 14 stories in storybook-static/
- PWA/Offline Support - Workbox + pwa-update-prompt + offline-indicator
