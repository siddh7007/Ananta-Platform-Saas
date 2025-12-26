# Platform Integration Plan: ARC-SaaS + Components Platform V2

> **Document Created**: December 2024
> **Status**: In Progress
> **Decision Date**: December 2024

## Executive Summary

This document captures the architectural decisions and integration plan for merging the **ARC-SaaS Control Plane** with the **Components Platform V2 (App Plane)** into a unified multi-tenant SaaS platform.

### Key Decision

**Use Components Platform V2's infrastructure as the shared base**, with ARC-SaaS providing tenant management, billing, and provisioning workflows.

---

## 1. Platform Overview

### 1.1 What is ARC-SaaS (Control Plane)?

ARC-SaaS is a multi-tenant SaaS control plane built on SourceFuse's ARC framework that handles:

- **Tenant Management**: CRUD operations for tenants, plans, subscriptions
- **Lead Onboarding**: Self-service signup with email verification
- **Provisioning Workflows**: Temporal-based tenant provisioning (IdP, database, storage)
- **Billing Integration**: Stripe subscriptions and invoicing
- **User Management**: Invitations, roles, permissions

**Tech Stack**:
- Backend: LoopBack 4 + TypeScript
- Database: PostgreSQL
- Workflows: Temporal.io
- Auth: Keycloak (OAuth2/OIDC)
- Notifications: Novu

### 1.2 What is Components Platform V2 (App Plane)?

Components Platform V2 is a BOM (Bill of Materials) management platform for electronics components:

- **BOM Upload & Analysis**: Upload component lists, analyze risks
- **Component Enrichment**: AI-powered component data enrichment
- **Risk Dashboard**: Obsolescence, availability, compliance tracking
- **Supplier Management**: Multi-source pricing and availability
- **Organization Vault**: Component library per organization

**Tech Stack**:
- Frontend: React 18 + MUI + React-Admin + Recharts
- Backend: Node.js + Supabase
- Database: PostgreSQL (Supabase)
- Auth: Auth0 (or Keycloak alternative)
- Workflows: Temporal.io

---

## 2. Infrastructure Analysis

### 2.1 Original Separate Infrastructure

Before integration, each platform ran independently:

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│       ARC-SAAS (Original)       │  │   COMPONENTS V2 (Original)      │
│                                 │  │                                 │
│  Temporal: 7233                 │  │  Temporal: 27020                │
│  Temporal UI: 14088             │  │  Temporal UI: 27021             │
│  PostgreSQL: 5432               │  │  PostgreSQL: 27540 (Supabase)   │
│  Keycloak: 8180                 │  │  Keycloak: 27210                │
│  Redis: 6379                    │  │  Redis: 27010                   │
│  API: 14000                     │  │  API: 27200                     │
│  Admin UI: 5000                 │  │  Customer Portal: 27510         │
│  Customer UI: 4000              │  │                                 │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### 2.2 Shared Infrastructure Decision

**Decision**: Use Components V2's Temporal instance as the shared workflow engine.

**Rationale**:
1. **Resource Efficiency**: Temporal server requires 2GB+ RAM each; sharing saves resources
2. **Operational Simplicity**: Single place to monitor all workflows
3. **Namespace Isolation**: Temporal namespaces provide logical separation
4. **Already Production-Ready**: Components V2's Temporal has PostgreSQL persistence configured

### 2.3 Unified Infrastructure (Target State)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED PLATFORM INFRASTRUCTURE                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED TEMPORAL (from Components V2)              │   │
│  │                                                                      │   │
│  │  Server: localhost:27020                                            │   │
│  │  UI: localhost:27021                                                │   │
│  │  Database: temporal-postgres:27030                                  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐        │   │
│  │  │  Namespace: arc-saas     │  │  Namespace: default      │        │   │
│  │  │  (Control Plane)         │  │  (App Plane)             │        │   │
│  │  │                          │  │                          │        │   │
│  │  │  • provision-tenant      │  │  • component-enrichment  │        │   │
│  │  │  • deprovision-tenant    │  │  • bom-analysis          │        │   │
│  │  │  • user-invitation       │  │  • supplier-sync         │        │   │
│  │  │  • billing-sync          │  │                          │        │   │
│  │  │                          │  │                          │        │   │
│  │  │  Queue: tenant-          │  │  Queue: enrichment       │        │   │
│  │  │         provisioning     │  │                          │        │   │
│  │  └──────────────────────────┘  └──────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SHARED SERVICES                               │   │
│  │                                                                      │   │
│  │  Keycloak (Identity): localhost:27210                               │   │
│  │  PostgreSQL (Main DB): localhost:27540                              │   │
│  │  Redis (Cache): localhost:6379                                      │   │
│  │  Novu (Notifications): localhost:4500                               │   │
│  │  MinIO (Storage): localhost:27040                                   │   │
│  │  Traefik (Gateway): localhost:27500                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Port Mapping

### 3.1 Infrastructure Services (Components V2 Ports)

| Service | Port | Description |
|---------|------|-------------|
| **Traefik Gateway** | 27500 | API Gateway / Reverse Proxy |
| **Temporal gRPC** | 27020 | Workflow Engine |
| **Temporal UI** | 27021 | Workflow Dashboard |
| **Temporal DB** | 27030 | Temporal PostgreSQL |
| **Keycloak** | 27210 | Identity Provider |
| **PostgreSQL (Supabase)** | 27540 | Main Application Database |
| **MinIO** | 27040 | Object Storage |
| **MinIO Console** | 27041 | Storage Admin UI |
| **Redis** | 6379 | Cache & Sessions |

### 3.2 Application Services

| Service | Port | Description |
|---------|------|-------------|
| **Tenant Management API** | 14000 | ARC-SaaS LoopBack API |
| **Components Backend** | 27200 | BOM/Components API |
| **Admin App** | 5000 | SaaS Admin Portal |
| **Customer App** | 4000 | Tenant Self-Service |
| **BOM Portal** | 6000 | Components V2 Customer Portal (NEW) |

---

## 4. Application Architecture

### 4.1 Frontend Applications in arc-saas/apps/

```
arc-saas/apps/
├── admin-app/          # SaaS Admin Portal (TailwindCSS + Radix UI)
│   └── Port: 5000
│   └── Purpose: Platform admin - manage tenants, plans, billing
│
├── customer-app/       # Tenant Self-Service (TailwindCSS + Radix UI)
│   └── Port: 4000
│   └── Purpose: Tenant users - view subscription, invite users
│
└── bom-portal/         # BOM Management (MUI + React-Admin) - TO BE MIGRATED
    └── Port: 6000
    └── Purpose: BOM upload, enrichment, risk analysis
    └── Source: components-platform-v2-ref/services/customer-portal/
```

### 4.2 BOM Portal Technology Comparison

| Aspect | admin-app / customer-app | bom-portal (from Components V2) |
|--------|--------------------------|----------------------------------|
| **UI Framework** | TailwindCSS + Radix UI | MUI (Material-UI) |
| **State/Data** | React Query + custom hooks | React-Admin + dataProvider |
| **Auth** | react-oidc-context (Keycloak) | Auth0 (needs Keycloak migration) |
| **Charts** | (minimal) | Recharts |
| **Data Grid** | Custom tables | MUI X Data Grid |
| **Form Handling** | React Hook Form | React-Admin forms |

### 4.3 Decision: Keep Both UI Frameworks

**Decision**: Keep MUI + React-Admin for BOM Portal, TailwindCSS for admin/customer apps.

**Rationale**:
1. **Faster Migration**: Copy as-is first, modernize later
2. **Feature-Rich**: React-Admin provides CRUD, filtering, pagination out of the box
3. **Domain-Specific**: BOM portal has complex data grids, charts that work well with MUI
4. **Separate Concerns**: Control plane apps (admin/customer) vs App plane (BOM portal)

---

## 5. Authentication Migration

### 5.1 Current State

| App | Current Auth | Target Auth |
|-----|--------------|-------------|
| admin-app | Keycloak (OIDC) | Keycloak (OIDC) - No change |
| customer-app | Keycloak (OIDC) | Keycloak (OIDC) - No change |
| bom-portal | Auth0 | Keycloak (OIDC) - **MIGRATION NEEDED** |

### 5.2 Auth Provider Pattern (React-Admin)

BOM Portal uses React-Admin's `authProvider` abstraction:

```typescript
// Current: src/providers/authProvider.ts
import { auth0AuthProvider } from './auth0AuthProvider';
import { supabaseAuthProvider } from './supabaseAuthProvider';
import { mockAuthProvider } from './mockAuthProvider';

// Routes to appropriate provider based on config
export const authProvider = getAuthProvider();
```

### 5.3 Migration Task: Create keycloakAuthProvider

```typescript
// TO BE CREATED: src/providers/keycloakAuthProvider.ts
import Keycloak from 'keycloak-js';
import { AuthProvider } from 'react-admin';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,      // http://localhost:27210
  realm: import.meta.env.VITE_KEYCLOAK_REALM,  // arc-saas
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID, // bom-portal
});

export const keycloakAuthProvider: AuthProvider = {
  login: () => keycloak.login(),
  logout: () => keycloak.logout(),
  checkAuth: () => keycloak.authenticated ? Promise.resolve() : Promise.reject(),
  checkError: (error) => { /* handle 401/403 */ },
  getPermissions: () => Promise.resolve(keycloak.tokenParsed?.realm_access?.roles),
  getIdentity: () => Promise.resolve({
    id: keycloak.tokenParsed?.sub,
    fullName: keycloak.tokenParsed?.name,
    avatar: keycloak.tokenParsed?.picture,
  }),
};
```

---

## 6. Data Provider Migration

### 6.1 Current Data Flow

```
BOM Portal (React-Admin)
    │
    ├── supabaseDataProvider ──────► Supabase (27540)
    │   └── BOM tables, components, enrichment
    │
    └── auth0AuthProvider ──────► Auth0
        └── User authentication
```

### 6.2 Target Data Flow

```
BOM Portal (React-Admin)
    │
    ├── loopbackDataProvider ──────► Tenant Mgmt API (14000)
    │   └── Tenants, subscriptions, users, plans
    │
    ├── supabaseDataProvider ──────► Supabase (27540)
    │   └── BOM tables, components, enrichment (KEEP)
    │
    └── keycloakAuthProvider ──────► Keycloak (27210)
        └── User authentication
```

### 6.3 Migration Task: Create loopbackDataProvider

```typescript
// TO BE CREATED: src/providers/loopbackDataProvider.ts
import { DataProvider, fetchUtils } from 'react-admin';

const apiUrl = import.meta.env.VITE_API_URL; // http://localhost:14000

export const loopbackDataProvider: DataProvider = {
  getList: async (resource, params) => {
    // LoopBack uses ?filter[where][field]=value format
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;

    const query = {
      'filter[limit]': perPage,
      'filter[skip]': (page - 1) * perPage,
      'filter[order]': `${field} ${order}`,
    };

    const url = `${apiUrl}/${resource}?${new URLSearchParams(query)}`;
    const { json, headers } = await fetchUtils.fetchJson(url);

    return {
      data: json,
      total: parseInt(headers.get('x-total-count') || json.length),
    };
  },

  getOne: async (resource, params) => {
    const url = `${apiUrl}/${resource}/${params.id}`;
    const { json } = await fetchUtils.fetchJson(url);
    return { data: json };
  },

  // ... create, update, delete, etc.
};
```

---

## 7. Migration Steps

### Phase 1: Copy & Configure (Current)

- [x] **Step 1**: Share Temporal infrastructure (use Components V2's port 27020)
- [ ] **Step 2**: Copy `customer-portal` → `arc-saas/apps/bom-portal`
- [ ] **Step 3**: Update `bom-portal/.env` for arc-saas infrastructure
- [ ] **Step 4**: Create `keycloakAuthProvider.ts`
- [ ] **Step 5**: Create `loopbackDataProvider.ts` (for tenant-mgmt resources)
- [ ] **Step 6**: Test BOM portal with shared infrastructure

### Phase 2: Integration (Future)

- [ ] **Step 7**: Add BOM portal to Keycloak as a client
- [ ] **Step 8**: Configure SSO between all three apps
- [ ] **Step 9**: Add webhook from Control Plane → App Plane on tenant provisioning
- [ ] **Step 10**: Test end-to-end flow: Signup → Provision → BOM Portal access

### Phase 3: Enhancement (Future)

- [ ] **Step 11**: Unify navigation across apps
- [ ] **Step 12**: Add tenant context to BOM portal
- [ ] **Step 13**: Integrate billing with BOM features
- [ ] **Step 14**: Add usage metrics from BOM portal to billing

---

## 8. Environment Configuration

### 8.1 BOM Portal Environment Variables

```bash
# arc-saas/apps/bom-portal/.env

# Application
VITE_APP_NAME=BOM Portal
VITE_APP_PORT=6000

# Auth - Keycloak (migrated from Auth0)
VITE_AUTH_PROVIDER=keycloak
VITE_KEYCLOAK_URL=http://localhost:27210
VITE_KEYCLOAK_REALM=arc-saas
VITE_KEYCLOAK_CLIENT_ID=bom-portal

# API - LoopBack (for tenant management)
VITE_API_URL=http://localhost:14000

# Supabase (keep for BOM-specific data)
VITE_SUPABASE_URL=http://localhost:27540
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Feature Flags
VITE_ENABLE_BILLING=true
VITE_ENABLE_ENRICHMENT=true
```

### 8.2 Docker Compose Integration

The BOM portal will be added to `arc-saas/docker-compose.yml`:

```yaml
services:
  bom-portal:
    build:
      context: ./apps/bom-portal
      dockerfile: Dockerfile
    ports:
      - "6000:80"
    environment:
      - VITE_AUTH_PROVIDER=keycloak
      - VITE_KEYCLOAK_URL=http://keycloak:8180
      - VITE_API_URL=http://tenant-mgmt:14000
    depends_on:
      - keycloak
      - tenant-management-service
    networks:
      - arc-saas-network
```

---

## 9. Workflow Integration

### 9.1 Tenant Provisioning Flow (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT PROVISIONING WORKFLOW                              │
│                    Namespace: arc-saas                                       │
│                    Queue: tenant-provisioning                                │
│                                                                              │
│  Step 1:  Update status → PROVISIONING                                      │
│  Step 2:  Create IdP Organization (Keycloak) ──────────────────────────┐   │
│  Step 3:  Create Admin User in Keycloak                                │   │
│  Step 4:  Provision Database Schema                                    │   │
│  Step 5:  Provision Storage (MinIO bucket)                             │   │
│  Step 6:  Provision Infrastructure (if silo tier)                      │   │
│  Step 7:  Deploy Application (if silo tier)                            │   │
│  Step 8:  Create Resources in tenant-mgmt DB                           │   │
│  Step 9:  Create Billing (Stripe subscription)                         │   │
│  Step 10: Send Welcome Email (Novu)                                    │   │
│  Step 11: Notify App Plane via Webhook ─────────────────────────────┐  │   │
│           └── POST /webhook/tenant-provisioned                       │  │   │
│               {tenantId, tenantKey, adminEmail, plan}               │  │   │
│                                                                      │  │   │
│  Complete: Status → ACTIVE                                           │  │   │
└──────────────────────────────────────────────────────────────────────┘  │   │
                                                                          │   │
                                                                          ▼   │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APP PLANE (Webhook Handler)                               │
│                                                                              │
│  Receives: tenant-provisioned webhook                                       │
│                                                                              │
│  Actions:                                                                   │
│  1. Create organization in Supabase (bom_organizations table)              │
│  2. Create admin user mapping                                               │
│  3. Create default project                                                  │
│  4. Initialize tenant storage bucket in MinIO                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. File Structure Reference

### 10.1 Components V2 Customer Portal (Source)

```
components-platform-v2-ref/services/customer-portal/
├── src/
│   ├── main.tsx                    # Entry point with Auth0Provider
│   ├── App.tsx                     # React-Admin setup
│   ├── providers/
│   │   ├── authProvider.ts         # Auth router
│   │   ├── auth0AuthProvider.ts    # Auth0 implementation
│   │   ├── supabaseAuthProvider.ts # Supabase auth
│   │   ├── mockAuthProvider.ts     # Mock for dev
│   │   └── dataProvider.ts         # Supabase data provider
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── BOMUploadWorkflow.tsx   # BOM upload
│   │   ├── BOMEnrichment.tsx       # AI enrichment
│   │   ├── ComponentSearch.tsx     # Component lookup
│   │   ├── RiskDashboard.tsx       # Risk analysis
│   │   ├── AlertCenter.tsx         # Notifications
│   │   └── Billing.tsx             # Subscription management
│   ├── components/
│   │   └── Auth0StateSync.tsx      # Auth0 state sync
│   └── utils/
│       └── devLogger.ts            # Development logging
├── .env                            # Environment config
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 10.2 Target BOM Portal Structure (in arc-saas)

```
arc-saas/apps/bom-portal/
├── src/
│   ├── main.tsx                    # Entry point with KeycloakProvider
│   ├── App.tsx                     # React-Admin setup
│   ├── providers/
│   │   ├── authProvider.ts         # Auth router (updated)
│   │   ├── keycloakAuthProvider.ts # NEW: Keycloak implementation
│   │   ├── supabaseDataProvider.ts # Keep for BOM data
│   │   └── loopbackDataProvider.ts # NEW: For tenant-mgmt resources
│   ├── pages/                      # Same as source
│   └── components/
│       └── KeycloakStateSync.tsx   # NEW: Keycloak state sync
├── .env                            # Updated for arc-saas
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 11. Related Documents

- [ARCHITECTURE.md](../apps/ARCHITECTURE.md) - Overall platform architecture
- [TEMPORAL_INTEGRATION_PLAN.md](../TEMPORAL_INTEGRATION_PLAN.md) - Temporal setup details
- [CLAUDE.md](../CLAUDE.md) - Development guidelines

---

## 12. Revision History

| Date | Author | Changes |
|------|--------|---------|
| Dec 2024 | Claude AI | Initial document creation |
| Dec 2024 | - | Added infrastructure analysis |
| Dec 2024 | - | Added migration steps |
