# ARC-SaaS Platform Improvement Guide

> **Purpose:** Comprehensive reference for AI coding agents (Claude) working on the ARC-SaaS platform. This document provides architectural context, implementation status, coding standards, and prioritized task lists.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technical Architecture](#technical-architecture)
3. [Implementation Progress](#implementation-progress)
4. [Coding Standards & Conventions](#coding-standards--conventions)
5. [10-Step Improvement Checklist](#10-step-improvement-checklist)
6. [Detailed Task Breakdown](#detailed-task-breakdown)
7. [Known Issues & Gap Analysis](#known-issues--gap-analysis)
8. [Testing Guidelines](#testing-guidelines)
9. [Appendices](#appendices)

---

## Executive Summary

### Platform Overview

ARC-SaaS is a multi-tenant SaaS control plane built on SourceFuse's ARC-SaaS framework. It provides tenant management, billing, workflow orchestration, and notifications for SaaS applications.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | TypeScript + LoopBack 4 | REST API services |
| **Frontend** | React + Refine.dev | Admin portal |
| **Database** | PostgreSQL + Sequelize | Data persistence |
| **Workflows** | Temporal.io | Workflow orchestration |
| **Auth** | Keycloak + JWT | Identity & access management |
| **Notifications** | Novu | Multi-channel notifications |
| **Billing** | Stripe | Payment processing |
| **Cache** | Redis | Session & token caching |
| **Runtime** | Bun/Node.js | JavaScript runtime |

### Current Status (December 2024)

| Metric | Value |
|--------|-------|
| **Steps Completed** | 9/10 (90%) |
| **Test Coverage** | 687+ tests (Admin App: 400+, CBP: 287) |
| **Core Features** | Billing, RBAC, Workflows, Notifications, Monitoring |
| **Recent Additions** | Circuit breaker, Cross-tab sync, Global search, BOM re-enrichment, Centralized theme system |

---

## Technical Architecture

### Service Map

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        CONTROL PLANE                             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚ tenant-mgmt-svc â”‚  â”‚ orchestrator-svcâ”‚  â”‚subscription-svc â”‚ â”‚
â”‚  â”‚   Port: 14000   â”‚  â”‚   Port: 14001   â”‚  â”‚   Port: 14002   â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚           â”‚                    â”‚                    â”‚           â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                    PostgreSQL (5432)                       â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚   Keycloak      â”‚  â”‚    Temporal     â”‚  â”‚      Redis      â”‚ â”‚
â”‚  â”‚   Port: 8180    â”‚  â”‚   Port: 27020   â”‚  â”‚   Port: 6379    â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚
â”‚  â”‚                    admin-app (React)                        â”‚â”‚
â”‚  â”‚                      Port: 27555                            â”‚â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Novu Notification Service Configuration

**Version**: v3.11.0 (latest)

#### Docker Services

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| novu-api | ghcr.io/novuhq/novu/api:latest | 13100 | REST API |
| novu-ws | ghcr.io/novuhq/novu/ws:latest | 13101 | WebSocket server |
| novu-worker | ghcr.io/novuhq/novu/worker:latest | - | Background jobs |
| novu-web | ghcr.io/novuhq/novu/web:latest | 14200 | Dashboard UI |
| novu-mongodb | mongo:7.0 | 27017 | Data store |
| novu-redis | redis:7-alpine | 6380 | Cache |

#### Environment Variables (docker-compose.yml)

```yaml
# Novu API
novu-api:
  image: ghcr.io/novuhq/novu/api:latest
  environment:
    NODE_ENV: production
    API_ROOT_URL: http://localhost:13100
    DISABLE_USER_REGISTRATION: "false"
    PORT: 3000
    FRONT_BASE_URL: http://localhost:14200
    WIDGET_BASE_URL: http://localhost:14200
    MONGO_URL: mongodb://novu-mongodb:27017/novu-db
    REDIS_HOST: novu-redis
    JWT_SECRET: your-jwt-secret-change-in-production
    STORE_ENCRYPTION_KEY: novuencryptionkey32charslong1234
    NOVU_SECRET_KEY: novu_secret_key_for_arc_saas
  ports:
    - "13100:3000"

# Novu WebSocket
novu-ws:
  image: ghcr.io/novuhq/novu/ws:latest
  environment:
    NODE_ENV: production
    PORT: 3002
    MONGO_URL: mongodb://novu-mongodb:27017/novu-db
    REDIS_HOST: novu-redis
    JWT_SECRET: your-jwt-secret-change-in-production
  ports:
    - "13101:3002"

# Novu Worker
novu-worker:
  image: ghcr.io/novuhq/novu/worker:latest
  environment:
    NODE_ENV: production
    MONGO_URL: mongodb://novu-mongodb:27017/novu-db
    REDIS_HOST: novu-redis
    JWT_SECRET: your-jwt-secret-change-in-production
    STORE_ENCRYPTION_KEY: novuencryptionkey32charslong1234
    NOVU_SECRET_KEY: novu_secret_key_for_arc_saas
    API_ROOT_URL: http://novu-api:3000

# Novu Dashboard (CRITICAL: Use REACT_APP_* prefix for env vars)
novu-web:
  image: ghcr.io/novuhq/novu/web:latest
  environment:
    REACT_APP_API_URL: http://localhost:13100
    REACT_APP_WS_URL: http://localhost:13101
    REACT_APP_WIDGET_EMBED_PATH: http://localhost:13100/embed.umd.min.js
    REACT_APP_NOVU_APP_ID: arc-saas
    # Disable external services for self-hosted (prevents CORS errors)
    REACT_APP_LAUNCH_DARKLY_CLIENT_SIDE_ID: ""
    REACT_APP_SEGMENT_KEY: ""
    REACT_APP_HUBSPOT_EMBED: ""
    REACT_APP_INTERCOM_APP_ID: ""
    API_ROOT_URL: http://novu-api:3000
  ports:
    - "14200:4200"
```

#### Login Credentials

| Field | Value |
|-------|-------|
| Email | admin@example.com |
| Password | admin123 |
| API Key | <your-novu-api-key> |
| App Identifier | <your-novu-app-id> |

#### Notification Workflows (6 Active)

| Trigger ID | Name | Channel | Description |
|------------|------|---------|-------------|
| `user-invitation` | User Invitation | Email | Invite user to tenant |
| `tenant-welcome` | Tenant Welcome | Email | Welcome after provisioning |
| `tenant-provisioning-failed` | Provisioning Failed | Email | Error notification |
| `payment-failed` | Payment Failed | Email | Payment error alert |
| `subscription-created` | Subscription Created | Email | Subscription confirmation |
| `trial-ending-soon` | Trial Ending Soon | Email | Trial expiry reminder |

#### Workflow Creation Script

Create workflows via API for proper dashboard compatibility:

```bash
# Navigate to arc-saas root
cd arc-saas

# Create workflows (ensure Novu API is running on port 13100)
node create-novu-workflows-api.js
```

**Key Script Files:**
- `arc-saas/create-novu-workflows-api.js` - Creates workflows via API (preferred)
- `arc-saas/bootstrap-novu.js` - Initial setup (org, env, user, API key)
- `arc-saas/fix-novu-workflows.js` - Direct MongoDB insertion (fallback)

#### Workflow Schema Requirements (v3.11.0)

Workflows must include these fields for dashboard compatibility:

```javascript
{
  type: 'REGULAR',           // NOT 'BRIDGE' - required for dashboard editing
  origin: 'novu-cloud',      // NOT 'novu-cloud-v1' - required for v3 compatibility
  isBlueprint: false,
  payloadSchema: { type: 'object', additionalProperties: true, properties: {} },
  validatePayload: true,
  steps: [{
    type: 'REGULAR',         // Step type must also be REGULAR
    template: {
      contentType: 'customHtml',  // For HTML email content
      // ... template content
    }
  }]
}
```

#### Backend Integration

```typescript
// temporal-worker-service/.env
NOVU_API_KEY=<your-novu-api-key>
NOVU_API_URL=http://localhost:13100

// admin-app/.env
VITE_NOVU_APP_IDENTIFIER=<your-novu-app-id>
```

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Workflow not supported" | Ensure `type: 'REGULAR'` and `origin: 'novu-cloud'` |
| Network error on login | Add `REACT_APP_API_URL` to novu-web env |
| Database connection | Use `novu-db` database name (not `novu`) |
| LaunchDarkly CORS errors | Set empty strings for external service vars |
| Workflows not visible | Create via API script, not direct MongoDB insert |

### Directory Structure

```
arc-saas/
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ tenant-management-service/    # Main backend API (LoopBack 4)
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”‚   â”œâ”€â”€ controllers/          # REST endpoints
â”‚   â”‚   â”‚   â”œâ”€â”€ services/             # Business logic
â”‚   â”‚   â”‚   â”œâ”€â”€ models/               # Data models
â”‚   â”‚   â”‚   â”œâ”€â”€ repositories/         # Data access
â”‚   â”‚   â”‚   â””â”€â”€ middleware/           # HTTP middleware
â”‚   â”‚   â””â”€â”€ migrations/               # Database migrations
â”‚   â”œâ”€â”€ orchestrator-service/         # Workflow coordination
â”‚   â”œâ”€â”€ subscription-service/         # Subscription management
â”‚   â””â”€â”€ temporal-worker-service/      # Temporal workflow workers
â”œâ”€â”€ apps/
â”‚   â””â”€â”€ admin-app/                    # React admin portal
â”‚       â”œâ”€â”€ src/
â”‚       â”‚   â”œâ”€â”€ pages/                # Route components
â”‚       â”‚   â”œâ”€â”€ components/           # Reusable UI
â”‚       â”‚   â”œâ”€â”€ providers/            # React context providers
â”‚       â”‚   â”œâ”€â”€ hooks/                # Custom hooks
â”‚       â”‚   â”œâ”€â”€ lib/                  # Utilities
â”‚       â”‚   â””â”€â”€ config/               # Configuration
â”‚       â””â”€â”€ .env.example              # Environment template
â”œâ”€â”€ packages/                         # Shared packages
â”œâ”€â”€ docker/                           # Docker configurations
â””â”€â”€ docs/                             # Documentation
```

### Port Configuration

| Service | Port | Notes |
|---------|------|-------|
| tenant-management-service | 14000 | Main API |
| admin-app | 27555 | React frontend |
| Keycloak (local) | 8180 | Dev default |
| Keycloak (Docker) | 14003 | Exposed port |
| Temporal gRPC | 27020 | Workflow engine |
| Temporal UI | 27021 | Dashboard |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| **Novu API** | 13100 | Notification API |
| **Novu WebSocket** | 13101 | Real-time notifications |
| **Novu Dashboard** | 14200 | Web UI for workflows |
| **Novu MongoDB** | 27017 | Novu data store |
| **Novu Redis** | 6380 | Novu cache (separate from app Redis) |

---

## Implementation Progress

### Completed Features (9/10 Steps)

#### Step 1: Baseline Config Audit âœ…
- Centralized environment configuration with Zod validation
- Runtime warnings for missing/default values
- Port configuration documentation
- CI linting for .env files

**Test Coverage:** 33 tests (env.schema.test.ts)

#### Step 2: API Base URL & Data Provider âœ…
- Centralized API_URL configuration
- Token refresh with 401 handling
- Proper URL prefixing in dataProvider

**Test Coverage:** 54 tests (data-provider, token-manager, api)

#### Step 3: RBAC Enablement âœ…
- 5-level role hierarchy: analyst â†’ engineer â†’ admin â†’ owner â†’ super_admin
- Keycloak JWT role extraction
- Navigation manifest with minRole requirements
- Action-based access control

**Test Coverage:** 72 tests (role-parser.test.ts)

#### Step 4: Tenant/Plan Manifest âœ…
- Platform configuration with Zod schemas
- Plan-based feature flags (13 features)
- useTenantPlan hook for subscription data
- Navigation filtering by plan

**Test Coverage:** 77 tests (platform.config, navigation)

#### Step 5: Billing & Payments âœ…
- Full Stripe integration (customers, payments, invoices)
- Stripe Elements UI (payment methods, invoices)
- Webhook handling with signature verification
- Currency conversion (cents/dollars)

**Test Coverage:** 41 tests (stripe.service, payment.service)

#### Step 6: Workflow Automation âœ…
- Temporal workflow restart/cancel/terminate endpoints (FULLY IMPLEMENTED in `workflow.controller.ts:419-807`)
- SAGA compensation patterns
- Workflow failure documentation

**Test Coverage:** 10 tests (provision-tenant.workflow.spec.ts)

#### Step 7: Notification Framework âœ…
- Multi-channel notifications (email, SMS, push, in-app)
- Per-tenant preferences
- Novu template management UI
- Notification history with local persistence

**Test Coverage:** 45+ tests (repository, controller, integration)

#### Step 8: Observability & Ops âœ…
- Health endpoints (/health, /health/live, /health/ready, /ping)
- Prometheus metrics endpoint (/metrics)
- Request logging middleware with correlation IDs
- Grafana panel embedding in admin UI

**Test Coverage:** 21 tests (observability.integration.test.ts)

#### Step 9: User & Identity Management âœ…
- Keycloak admin API integration
- Session management (view, terminate)
- MFA status and credential management
- Login events auditing
- Password reset flows
- Keycloak roles controller with tests

**Test Coverage:** Tests in keycloak-roles.controller.test.ts

### Remaining (Step 10)

#### Step 10: Deployment & IaC â³
- Terraform modules for AWS resources
- Helm charts for Kubernetes deployment
- CI/CD pipeline with smoke tests
- Blue/green deployment documentation

**Next Actions for Step 10:**
1. Create Terraform modules in `infrastructure/terraform/` for:
   - VPC + Subnets
   - EKS Cluster
   - RDS PostgreSQL
   - ElastiCache Redis
   - ALB + Route53
2. Create Helm charts in `infrastructure/helm/` for:
   - tenant-management-service
   - temporal-worker-service
   - admin-app (static hosting or container)
3. Add CI/CD workflow in `.github/workflows/deploy.yml`:
   - Build + push Docker images
   - Run smoke tests against staging
   - Blue/green deployment via ArgoCD or CodeDeploy
4. Document rollback procedures and runbook

---

## Coding Standards & Conventions

### TypeScript/LoopBack 4 Backend

```typescript
// Controller Pattern
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
import {authenticate, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {OPERATION_SECURITY_SPEC, STATUS_CODE, CONTENT_TYPE} from '@sourceloop/core';

export class MyController {
  constructor(
    @repository(MyRepository) public myRepository: MyRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewResource]})
  @get('/resources', {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        content: {[CONTENT_TYPE.JSON]: {schema: {type: 'array'}}},
      },
    },
  })
  async find(): Promise<Resource[]> {
    const tenantId = this.getTenantId();
    return this.myRepository.find({where: {tenantId}});
  }
}
```

### React/Refine Frontend

```typescript
// Page Component Pattern
import { useCustom, useList } from "@refinedev/core";
import { useState, useMemo } from "react";

export function ResourceList() {
  const [filters, setFilters] = useState({});

  const { data, isLoading, refetch } = useList({
    resource: "resources",
    filters: Object.entries(filters).map(([field, value]) => ({
      field, operator: "eq", value
    })),
  });

  const items = useMemo(() => data?.data ?? [], [data]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Resources" onRefresh={refetch} />
      <FilterBar filters={filters} onChange={setFilters} />
      <DataTable data={items} />
    </div>
  );
}
```

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Multi-tenant isolation** | Always filter by tenantId |
| **UUID validation** | Validate before database operations |
| **Schema references** | Use `getModelSchemaRefSF()` for API schemas |
| **Error handling** | Throw HttpErrors with meaningful messages |
| **Pagination** | Default 20, max 100 items per page |
| **Status values** | Use string enums, not numeric codes |

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Controller | `{name}.controller.ts` | `tenant.controller.ts` |
| Service | `{name}.service.ts` | `stripe.service.ts` |
| Model | `{name}.model.ts` | `tenant.model.ts` |
| Repository | `{name}.repository.ts` | `tenant.repository.ts` |
| Test | `{name}.test.ts` | `stripe.service.test.ts` |
| React Page | `{name}.tsx` | `invoices.tsx` |
| React Component | `{name}.tsx` (PascalCase) | `DataTable.tsx` |

---

## 10-Step Improvement Checklist

Use this checklist when implementing new features:

### 1. Establish Context
- [ ] Understand existing code patterns in the area
- [ ] Check for existing similar implementations
- [ ] Review related documentation
- [ ] Identify dependencies and integration points

### 2. Styling & Conventions
- [ ] Follow Tailwind/shadcn UI patterns
- [ ] Maintain TypeScript strict typing
- [ ] Run linters (Bun lint, Prettier)
- [ ] Add unit/integration tests

### 3. Configuration
- [ ] Use environment variables for configurable values
- [ ] Update `.env.example` with new variables
- [ ] Add runtime validation/warnings
- [ ] Support per-tenant overrides where applicable

### 4. RBAC & Auth
- [ ] Add permission keys for new endpoints
- [ ] Gate UI routes via accessControlProvider
- [ ] Enforce backend RBAC via decorators
- [ ] Log access decisions for auditing

### 5. API/Data Provider
- [ ] Route requests through dataProvider
- [ ] Add consistent error handling
- [ ] Maintain pagination/sorting behavior
- [ ] Update API documentation

### 6. Workflow Integration
- [ ] Keep workflows idempotent
- [ ] Add proper retry/backoff policies
- [ ] Include audit logging
- [ ] Document failure scenarios

### 7. Billing & Notifications
- [ ] Use existing Stripe abstractions
- [ ] Leverage Novu for notifications
- [ ] Respect per-tenant preferences
- [ ] Handle webhooks securely

### 8. Observability
- [ ] Expose health endpoints
- [ ] Add Prometheus metrics
- [ ] Include correlation IDs in logs
- [ ] Update monitoring dashboards

### 9. Documentation
- [ ] Update relevant docs
- [ ] Add code comments for complex logic
- [ ] Provide API examples
- [ ] Document migrations

### 10. Reusability
- [ ] Use configuration over hard-coding
- [ ] Support feature flags
- [ ] Enable per-tenant customization
- [ ] Consider future extensibility

---

## Detailed Task Breakdown

### Recently Completed Tasks (December 2024)

#### Billing Frontend Integration âœ…

| Task | Status | Backend Endpoint |
|------|--------|------------------|
| Invoice list with status badges | âœ… Done | `GET /invoices` |
| Pay invoice flow | âœ… Done | `POST /invoices/{id}/pay` |
| Retry failed payments | âœ… Done | `POST /invoices/{id}/retry-payment` |
| Download invoice PDF | âœ… Done | `GET /invoices/{id}/pdf` |
| Payment methods list | âœ… Done | `GET /payment-methods` |
| Add card via Stripe Elements | âœ… Done | SetupIntent flow |
| Set default payment method | âœ… Done | `PATCH /payment-methods/{id}/set-default` |
| Delete payment method | âœ… Done | `DELETE /payment-methods/{id}` |

#### Notification Framework âœ…

| Task | Status | Description |
|------|--------|-------------|
| NotificationHistory model | âœ… Done | Local persistence for audit |
| Analytics dashboard | âœ… Done | Stats, charts, recent failures |
| Data source toggle | âœ… Done | Switch between Novu/Local |
| Template viewer | âœ… Done | View template details |
| Preferences UI | âœ… Done | Per-category channel toggles |

#### Monitoring & Grafana âœ…

| Task | Status | Description |
|------|--------|-------------|
| GrafanaPanel component | âœ… Done | Iframe embedding with controls |
| Status indicator | âœ… Done | Shows Grafana availability |
| Health page integration | âœ… Done | Service health + Grafana panels |
| Metrics page integration | âœ… Done | Performance metrics + Grafana |
| Environment variables | âœ… Done | VITE_GRAFANA_* configuration |

#### User Identity Management âœ…

| Task | Status | Description |
|------|--------|-------------|
| KeycloakAdminService | âœ… Done | Full admin API integration |
| Session management | âœ… Done | View/terminate sessions |
| MFA management | âœ… Done | Status, remove credentials |
| Login events | âœ… Done | Audit trail |
| Password reset | âœ… Done | Email trigger + force reset |
| Account unlock | âœ… Done | Brute force protection |

#### Centralized Theme System âœ…

| Task | Status | Description |
|------|--------|-------------|
| Admin App Theme | âœ… Done | next-themes integration with 4 variants |
| Customer Portal Theme | âœ… Done | Matching theme system |
| Theme Selector Component | âœ… Done | Dropdown with icons (Sun/Moon/SunMedium/CloudMoon/Monitor) |
| No-Flash Guard | âœ… Done | Inline script + CSS animation fallback |
| Theme-Color Meta Sync | âœ… Done | `useThemeColor` hook + `ThemeColorSync` component |
| Tailwind darkMode | âœ… Done | `:is([data-theme="dark"], [data-theme="mid-dark"])` selector |
| Accessibility | âœ… Done | Full keyboard nav, ARIA roles, focus management |

**Theme Variants:**
| Theme | Storage Key | Description |
|-------|-------------|-------------|
| `light` | Default | High contrast, bright (#ffffff) |
| `dark` | `admin-theme` / `cbp-theme` | High contrast, dark (#0a0a1a) |
| `mid-light` | | Reduced contrast light (#f0f2f5) |
| `mid-dark` | | Reduced contrast dark (#1a1d24) |
| `system` | | Follow OS preference |

**Files Created:**
- `admin-app/src/components/theme/ThemeSelector.tsx` - Theme dropdown component
- `admin-app/src/components/ThemeColorSync.tsx` - Meta tag sync component
- `admin-app/src/hooks/useThemeColor.ts` - Theme-color hook
- `customer-portal/src/components/ThemeColorSync.tsx` - Meta tag sync
- `customer-portal/src/hooks/useThemeColor.ts` - Theme-color hook

### Pending Tasks

#### Step 10: Deployment & IaC

| Task | Priority | Complexity |
|------|----------|------------|
| AWS Terraform modules | HIGH | High |
| Helm charts for K8s | HIGH | High |
| CI/CD with smoke tests | MEDIUM | Medium |
| Blue/green deployment docs | MEDIUM | Low |
| ArgoCD integration | LOW | Medium |

#### Future Enhancements

| Feature | Priority | Complexity |
|---------|----------|------------|
| Subscription upgrade/downgrade UI | MEDIUM | High |
| Metered usage tracking | MEDIUM | Medium |
| Dynamic platform config API | LOW | Medium |
| Advanced analytics dashboard | LOW | High |
| Multi-region support | LOW | Very High |

---

## Known Issues & Gap Analysis

### Resolved Issues âœ…

| Issue | Resolution |
|-------|------------|
| Hard-coded API_URL | Centralized in config/api.ts |
| Missing RBAC | 5-level role hierarchy implemented |
| Workflow restart failing | Fixed to pass full TenantProvisioningInput |
| Billing notifications missing | Stripe webhooks now fire Novu events |
| Notification history pagination | Fixed to return actual total count |
| Missing analytics route | Added /notifications/analytics |
| No retry/backoff/circuit breaker | Implemented in `api-retry.ts` with exponential backoff (max 3 retries, 30% jitter), circuit breaker (5 failures â†’ open, 30s timeout) |
| Portal redirect error handling minimal | Enhanced `billing.service.ts` with `StripePortalError` typed errors, circuit breaker integration, and `PortalResult` pattern |
| Global search/quick find absent | CBP has global search with keyboard shortcuts (Cmd/Ctrl+K), tenant-aware results, and caching |
| Cross-tab session sync missing | Added BroadcastChannel-based sync in `AuthContext.tsx` with localStorage fallback |
| BOM re-enrichment CTA missing | Added to `BomDetail.tsx` with stale detection (>7 days), polling, confirmation dialog |

### Open Issues â³

| Issue | Impact | Priority |
|-------|--------|----------|
| Redis/Supabase status sync | Medium | LOW |
| Logout token revocation | Low | LOW |
| Schema-driven tenant forms | Medium | LOW |
| IaC templates missing | High | HIGH |

### Admin App UI/FE/BE Gaps (updated December 2024)

| Issue | Impact | Priority | Status |
|-------|--------|----------|--------|
| Inconsistent error UX/logging across admin pages (billing/roles/monitoring) | Medium | MEDIUM | âœ… RESOLVED - Toast system with request IDs, standardized error boundaries |
| No accessibility pass (focus states, ARIA, reduced motion/high contrast) | Medium | MEDIUM | âš ï¸ PARTIAL - Focus states/ARIA added, reduced motion/high contrast pending |
| Limited observability: frontend lacks request logging toggle/perf metrics | Medium | MEDIUM | âš ï¸ PARTIAL - Request IDs in toasts, remote sink pending |
| Missing E2E coverage for critical flows (auth, billing portal, role assignment) | High | HIGH | â³ OPEN - Playwright setup pending |
| Navigation/RBAC drift vs. implemented minRole (billing/invoices) | Low | LOW | âœ… RESOLVED - Navigation manifest with minRole |
| Global search/site-wide quick find absent | Low | LOW | âœ… RESOLVED (CBP) - Cmd/Ctrl+K search with tenant filtering |

### Admin App Bug/Gap Deep-Dive (by Area) - Updated December 2024
- **Auth & Session:** âœ… Cross-tab session sync via BroadcastChannel (CBP); âš ï¸ token storage still localStorage (hardening pending); audience/scope mismatches can silently 401 if Keycloak/client config drifts.
- **Tenant/RBAC:** Tenant selector can expose all tenants for super_admin even when cross-tenant UI is deferred; stale cached tenant selection (no expiry); denied actions lack clear UI messaging/tooltips.
- **Data/Network:** âœ… Retry/backoff/circuit breaker implemented in `api-retry.ts`; âœ… Request correlation IDs in toast notifications; Supabase/component provider auth model unclear (assumes public).
- **Navigation/UX:** âœ… Nav minRole aligned via navigation manifest; âœ… Global search in CBP (Cmd/Ctrl+K); â³ PWA/offline/perf budget pending; no design tokens/storybook.
- **Billing/Org:** âœ… Portal redirect error handling enhanced with `StripePortalError` class and circuit breaker; org delete is destructive without feature flag/audit/cooldown; âœ… Robust retry UI for billing actions.
- **Notifications/Alerts:** Inbox/preferences not standardized across pages; no alert hooks for billing/role changes; risk alerts not contextually surfaced in some views.
- **Monitoring/Observability:** âš ï¸ Frontend logging is console-only (remote sink pending); no perf/RUM instrumentation; backend dashboards/alerts for admin flows not documented.
- **Testing:** â³ Lacks E2E for authâ†’tenantâ†’billingâ†’role flows; RBAC/denied-action UI states are untested; no load/latency budgets enforced.
- **Accessibility:** âš ï¸ Partial A11y pass completed (focus states, ARIA labels, keyboard nav); high-contrast/reduced-motion toggles pending.

### Admin â†” CBP Integration Checklist
- Align Keycloak clients/scopes (`cns-api`) and gateway/backend `aud` enforcement so tokens work across services.
- Align `X-Tenant-Id` handling and tenant selection UX; avoid stale cached tenants; inject headers consistently in both apps.
- Reconcile nav/resource minRole definitions (e.g., billing/invoices) to keep RBAC consistent between admin and CBP.
- Add cross-app links (e.g., admin BOM â†’ CBP BOM) with shared routing/breadcrumb patterns.
- Standardize logging/error tracking toggles and adopt a shared remote sink (Sentry/OTel) to trace flows across frontends.
- Confirm BOM/component/billing/tenant API contracts are consistent; avoid divergent service wrappers; document Supabase/component auth if required.
- Add cross-app E2E smoke tests (auth â†’ tenant select â†’ billing portal â†’ role assignment) and coordinate cutover/rollback with legacy CBP links.

### Additional Feedback (append request) - Updated December 2024
- â³ Supabase auth is removed; any component/catalog source must be proxied server-side with service credentials and no browser-exposed keys. Document the chosen data path and required headers.
- âœ… Cross-tab/session sync: BroadcastChannel-based sync implemented in `AuthContext.tsx` with localStorage fallback; session expired dialog with dismiss option; broadcasts SESSION_STARTED/ENDED/REFRESHED/REQUEST_SYNC events.
- âœ… Global search: Cmd/Ctrl+K shortcut implemented; tenant-aware quick find for BOMs/components/projects; typedown results cached with 5-minute TTL.
- âš ï¸ Performance: virtualize large tables (partially done for BOM lists); server-side pagination with real totals; perf budgets pending CI integration.
- âœ… Loading/error UX: standardized skeleton/empty/error patterns (`ListSkeletons.tsx`, `RouteErrorBoundary.tsx`); inline retry; request IDs in toasts via `toast.tsx`.
- â³ Risk/alerts: inline risk digests pending; per-tenant alert preferences via Novu pending full integration.
- âš ï¸ Observability/security: request IDs propagated to toasts; remote sink (Sentry/OTel) pending; CSP/Trusted Types baseline pending.
- â³ i18n: not yet wired; locale selectors hidden; billing/usage numbers use basic locale formatting.
- âš ï¸ Data validation: file size caps enforced (10MB default); row caps for BOM uploads (10,000 rows); concurrency guards partial (debounce on submit).

### VERIFIED Implementations (December 2024 Code Review)

> **NOTE**: The following features were code-verified as FULLY IMPLEMENTED. Do NOT re-report these as gaps.

| Feature | Status | Location | Verification |
|---------|--------|----------|--------------|
| docker-compose.yml | âœ… EXISTS | `arc-saas/docker-compose.yml` | 492 lines, all services defined |
| Dashboard API calls | âœ… ENABLED | `app-plane/.../Dashboard.tsx` | `useGetList` hooks for projects, BOMs, uploads, alerts all active |
| Workflow restart/cancel/terminate | âœ… IMPLEMENTED | `workflow.controller.ts:419-807` | All 3 endpoints with full error handling |
| Invitation rate limiting | âœ… ENFORCED | `invitation.service.ts` | 5-min cooldown, max 5 resends, DB tracking |
| Organization sync to App Plane | âœ… IMPLEMENTED | `supabase-app-plane.activities.ts`, `provision-tenant.workflow.ts` | Direct Supabase + webhook bridge |
| Notification Preferences UI | âœ… COMPLETE | `AlertPreferences.tsx` | 774 lines, 7 alert types, threshold controls |
| NotificationInbox | âœ… IMPLEMENTED | `NotificationInbox.tsx` | 424 lines with mock data (backend pending) |
| Novu integration | âœ… 75-80% | `NovuNotificationBell.tsx` | Frontend complete, backend triggers partial |
| CommandPalette | âœ… EXISTS | `CommandPalette.tsx` | Cmd/Ctrl+K with search |
| SkipLinks/FocusTrap | âœ… EXISTS | `accessibility/` folder | All accessibility components implemented |
---

## Testing Guidelines

### Test Structure

```
src/
â”œâ”€â”€ __tests__/
â”‚   â”œâ”€â”€ unit/
â”‚   â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”‚   â””â”€â”€ {controller}.test.ts
â”‚   â”‚   â””â”€â”€ services/
â”‚   â”‚       â””â”€â”€ {service}.test.ts
â”‚   â”œâ”€â”€ integration/
â”‚   â”‚   â””â”€â”€ {feature}.integration.test.ts
â”‚   â””â”€â”€ helper/
â”‚       â””â”€â”€ test-helper.ts
```

### Running Tests

```bash
# Frontend (admin-app)
cd arc-saas/apps/admin-app
npm run test:run           # Run all tests
npm run test:coverage      # With coverage

# Backend (tenant-management-service)
cd arc-saas/services/tenant-management-service
npm test                   # Run all tests
```

### Test Coverage Summary

#### Admin App (Control Plane) - 400+ Tests

| Component | Tests | File |
|-----------|-------|------|
| Environment Schema | 33 | env.schema.test.ts |
| Data Provider | 23 | data-provider.test.ts |
| Token Manager | 22 | token-manager.test.ts |
| API Config | 9 | api.test.ts |
| Role Parser | 72 | role-parser.test.ts |
| Platform Config | 49 | platform.config.test.ts |
| Navigation | 28 | navigation.test.ts |
| Stripe Service | 41 | stripe.service.test.ts |
| Workflows | 10 | provision-tenant.workflow.spec.ts |
| Notifications | 45+ | Multiple files |
| Observability | 21 | observability.integration.test.ts |
| Keycloak Roles | 15+ | keycloak-roles.controller.test.ts |
| Grafana Panel | 20+ | grafana-panel.test.tsx |
| **Admin App Total** | **400+** | |

#### Customer Business Portal (CBP) - 287 Tests

| Component | Tests | File |
|-----------|-------|------|
| Auth Context | 45 | auth-context.test.tsx |
| BOM Services | 38 | bom.service.test.ts |
| Billing Service | 32 | billing.service.test.ts |
| API Retry/Circuit Breaker | 28 | api-retry.test.ts |
| Component Services | 25 | Multiple files |
| Global Search | 18 | global-search.test.tsx |
| Toast Notifications | 15 | toast.test.tsx |
| Route Error Boundary | 12 | route-error-boundary.test.tsx |
| List Skeletons | 10 | list-skeletons.test.tsx |
| Other Components | 64 | Multiple files |
| **CBP Total** | **287** | |

**Combined Platform Total: 687+ tests**

---

## Appendices

### A. Permission Keys Reference

```typescript
// Core permissions (from src/permissions.ts)
enum PermissionKey {
  // Lead (10200-10203)
  ViewLead = '10200',
  CreateLead = '10201',
  UpdateLead = '10202',
  DeleteLead = '10203',

  // Tenant (10204-10207, 10216)
  ViewTenant = '10204',
  CreateTenant = '10205',
  UpdateTenant = '10206',
  DeleteTenant = '10207',
  ProvisionTenant = '10216',

  // Subscription (7001-7008)
  ViewSubscription = '7001',
  CreateSubscription = '7002',
  UpdateSubscription = '7004',
  ViewPlan = '7008',

  // User (10300-10306)
  ViewUser = '10300',
  CreateUser = '10301',
  UpdateUser = '10302',
  DeleteUser = '10303',

  // Roles (10310-10313)
  ViewRole = '10310',
  CreateRole = '10311',
  AssignRole = '10312',
  RevokeRole = '10313',

  // Billing (5321-5333)
  ViewBillingAnalytics = '5321',
  ManagePaymentMethods = '5331',
  ViewPaymentIntents = '5332',
  CreatePaymentIntent = '5333',

  // Notifications (10400-10404)
  ViewNotifications = '10400',
  ViewNotificationHistory = '10401',
  ManageNotificationTemplates = '10402',
  SendTestNotification = '10403',

  // User Identity (10350-10356)
  ViewUserSessions = '10350',
  TerminateUserSession = '10351',
  ViewUserMfa = '10352',
  ManageUserMfa = '10353',
  ViewLoginEvents = '10354',
  ResetUserPassword = '10355',
  UnlockUser = '10356',

  // Super Admin
  SuperAdmin = '99999',
}
```

### B. Role Hierarchy

| Level | Role | Description | Keycloak Mappings |
|-------|------|-------------|-------------------|
| 5 | super_admin | Platform staff | platform:super_admin, realm-admin |
| 4 | owner | Org owner | owner, org-owner, billing_admin |
| 3 | admin | Org admin | admin, tenant-admin, org_admin |
| 2 | engineer | Technical user | engineer, staff, developer |
| 1 | analyst | Read-only | analyst, user, viewer, member |

### C. Plan Features

| Feature | Free | Basic | Standard | Premium | Enterprise |
|---------|------|-------|----------|---------|------------|
| billing | âŒ | âœ… | âœ… | âœ… | âœ… |
| workflows | âŒ | âŒ | âœ… | âœ… | âœ… |
| monitoring | âŒ | âŒ | âœ… | âœ… | âœ… |
| auditLogs | âŒ | âŒ | âŒ | âœ… | âœ… |
| analytics | âŒ | âŒ | âŒ | âœ… | âœ… |
| sso | âŒ | âŒ | âœ… | âœ… | âœ… |
| customBranding | âŒ | âŒ | âŒ | âœ… | âœ… |
| apiAccess | âŒ | âŒ | âœ… | âœ… | âœ… |
| multiUser | âŒ | âœ… | âœ… | âœ… | âœ… |
| prioritySupport | âŒ | âŒ | âŒ | âœ… | âœ… |
| dedicatedManager | âŒ | âŒ | âŒ | âŒ | âœ… |
| onPremise | âŒ | âŒ | âŒ | âŒ | âœ… |

### D. Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:14000
VITE_CUSTOMER_APP_URL=http://localhost:27555

# Keycloak
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=ananta-saas
VITE_KEYCLOAK_CLIENT_ID=admin-app

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Grafana
VITE_GRAFANA_URL=http://localhost:3001
VITE_GRAFANA_DASHBOARD_PLATFORM_HEALTH=platform-health
VITE_GRAFANA_DASHBOARD_TENANT_METRICS=tenant-metrics
VITE_GRAFANA_DASHBOARD_API_PERFORMANCE=api-performance

# Feature Flags
VITE_FEATURE_BILLING=true
VITE_FEATURE_WORKFLOWS=true
VITE_FEATURE_MONITORING=true
VITE_FEATURE_AUDIT_LOGS=true

# Novu Notifications
VITE_NOVU_APP_IDENTIFIER=<your-novu-app-id>
NOVU_API_KEY=<your-novu-api-key>
NOVU_API_URL=http://localhost:13100
```

### E. Novu Service Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      NOVU NOTIFICATION STACK                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚   novu-web      â”‚  â”‚    novu-api     â”‚  â”‚    novu-ws      â”‚ â”‚
â”‚  â”‚  (Dashboard)    â”‚  â”‚   (REST API)    â”‚  â”‚  (WebSocket)    â”‚ â”‚
â”‚  â”‚   Port: 14200   â”‚  â”‚   Port: 13100   â”‚  â”‚   Port: 13101   â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚           â”‚                    â”‚                    â”‚           â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚                       novu-worker                          â”‚ â”‚
â”‚  â”‚              (Background Job Processor)                    â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚           â”‚                    â”‚                                â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”                      â”‚
â”‚  â”‚  novu-mongodb   â”‚  â”‚   novu-redis    â”‚                      â”‚
â”‚  â”‚   Port: 27017   â”‚  â”‚   Port: 6380    â”‚                      â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Novu Dashboard URL:** http://localhost:14200
**Novu API Base URL:** http://localhost:13100

---

## Quick Reference Commands

```bash
# Start services
cd arc-saas/services/tenant-management-service && bun run start:dev
cd arc-saas/apps/admin-app && bun run dev

# Run tests
cd arc-saas/apps/admin-app && npm run test:run
cd arc-saas/services/tenant-management-service && npm test

# Build
cd arc-saas/apps/admin-app && bun run build

# Database migrations
cd arc-saas/services/tenant-management-service && bun run migrate

# TypeScript check
npx tsc --noEmit
```

---

*Last Updated: December 14, 2024*
*Document Version: 2.2*
*Change Log: Added comprehensive Novu v3.11.0 configuration (ports, env vars, workflows, troubleshooting); updated port table with Novu services; added Appendix E for Novu architecture*
