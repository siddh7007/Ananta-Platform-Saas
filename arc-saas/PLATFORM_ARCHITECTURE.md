# ARC SaaS Platform Architecture

## Overview

The ARC SaaS Platform is organized into two distinct planes:

```
arc-saas/
├── apps/                    # CONTROL PLANE APPS (for SaaS operators)
│   ├── admin-app/           # Admin dashboard (React + Refine)
│   └── customer-app/        # Customer onboarding (React + TanStack)
│
├── services/                # CONTROL PLANE SERVICES (LoopBack 4)
│   ├── tenant-management-service/  # Core tenant, lead, user management
│   ├── subscription-service/       # Billing & subscriptions
│   ├── orchestrator-service/       # Workflow orchestration
│   └── temporal-worker-service/    # Temporal workflow workers
│
├── app-plane/               # APP PLANE (tenant-facing applications)
│   ├── apps/
│   │   ├── bom-portal/      # BOM/Component Management (React Admin)
│   │   └── cns-dashboard/   # CNS Analytics Dashboard (React Admin)
│   └── services/
│       ├── components-backend/  # FastAPI BOM service
│       └── cns-service/         # Python CNS analytics service
│
├── packages/                # Shared packages
├── docker/                  # Docker configurations
└── docs/                    # Documentation
```

## Control Plane vs App Plane

### Control Plane
The Control Plane manages the SaaS platform itself:
- **Multi-tenant management**: Creating, provisioning, and managing tenant accounts
- **Subscription & billing**: Plans, pricing, invoices
- **User management**: Admin users, tenant users, invitations
- **Workflow orchestration**: Tenant provisioning via Temporal workflows
- **Authentication**: Keycloak-based SSO for admin users

### App Plane
The App Plane contains the actual applications that tenants use:
- **BOM Portal**: Component lifecycle management, BOM intake, enrichment
- **CNS Dashboard**: Component network security analytics
- **Components Backend**: FastAPI service for component/BOM operations
- **CNS Service**: Python service for security analytics

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ARC SaaS Platform                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────── CONTROL PLANE ───────────────────────┐                │
│  │                                                              │                │
│  │  APPS (arc-saas/apps/)                                       │                │
│  │  ┌──────────────────┐     ┌──────────────────┐              │                │
│  │  │   Admin App      │     │  Customer App    │              │                │
│  │  │   :5000          │     │  :4000           │              │                │
│  │  │   (Refine)       │     │  (TanStack)      │              │                │
│  │  └────────┬─────────┘     └────────┬─────────┘              │                │
│  │           │                         │                        │                │
│  │           └────────────┬────────────┘                        │                │
│  │                        ▼                                     │                │
│  │  SERVICES (arc-saas/services/)                               │                │
│  │  ┌─────────────────────────────────────────────────────┐    │                │
│  │  │  tenant-management-service :14000                    │    │                │
│  │  │  - Tenant CRUD, Lead management                      │    │                │
│  │  │  - User management, Invitations                      │    │                │
│  │  │  - Settings, Workflows                               │    │                │
│  │  └─────────────────────┬───────────────────────────────┘    │                │
│  │                        │                                     │                │
│  │  ┌─────────────────────┴───────────────────────────────┐    │                │
│  │  │  temporal-worker-service                             │    │                │
│  │  │  - Tenant provisioning workflows                     │    │                │
│  │  │  - User invitation workflows                         │    │                │
│  │  └─────────────────────────────────────────────────────┘    │                │
│  └──────────────────────────────────────────────────────────────┘                │
│                                                                                  │
│  ┌─────────────────────── APP PLANE ─────────────────────────┐                  │
│  │                                                            │                  │
│  │  APPS (arc-saas/app-plane/apps/)                           │                  │
│  │  ┌──────────────────┐     ┌──────────────────┐            │                  │
│  │  │   BOM Portal     │     │  CNS Dashboard   │            │                  │
│  │  │   :5173          │     │  :5174           │            │                  │
│  │  │   (React Admin)  │     │  (React Admin)   │            │                  │
│  │  │                  │     │                  │            │                  │
│  │  │  • Component Vault│    │  • CNS Analytics │            │                  │
│  │  │  • BOM Intake    │     │  • Job Status    │            │                  │
│  │  │  • Enrichment    │     │  • Reports       │            │                  │
│  │  │  • Risk Analysis │     │                  │            │                  │
│  │  └────────┬─────────┘     └────────┬─────────┘            │                  │
│  │           │                         │                      │                  │
│  │           └────────────┬────────────┘                      │                  │
│  │                        ▼                                   │                  │
│  │  SERVICES (arc-saas/app-plane/services/)                   │                  │
│  │  ┌──────────────────────┐  ┌──────────────────────┐       │                  │
│  │  │ components-backend   │  │  cns-service         │       │                  │
│  │  │ :8000 (FastAPI)      │  │  :8001 (FastAPI)     │       │                  │
│  │  │                      │  │                      │       │                  │
│  │  │ • BOM processing     │  │ • CNS analytics      │       │                  │
│  │  │ • Component CRUD     │  │ • Security scans     │       │                  │
│  │  │ • Enrichment queue   │  │ • Vulnerability data │       │                  │
│  │  └──────────────────────┘  └──────────────────────┘       │                  │
│  └────────────────────────────────────────────────────────────┘                  │
│                                                                                  │
│  ┌─────────────────────── INFRASTRUCTURE ────────────────────┐                  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐│                  │
│  │  │PostgreSQL│ │  Redis   │ │ Temporal │ │   Keycloak     ││                  │
│  │  │  :5432   │ │  :6379   │ │  :7233   │ │   :8180        ││                  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘│                  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │                  │
│  │  │   Novu   │ │ Directus │ │  Jaeger  │                   │                  │
│  │  │  :3000   │ │  :8055   │ │ :16686   │                   │                  │
│  │  └──────────┘ └──────────┘ └──────────┘                   │                  │
│  └────────────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Control Plane
| Component | Technology |
|-----------|------------|
| Admin App | React + Refine + shadcn/ui |
| Customer App | React + TanStack Query + shadcn/ui |
| Backend Services | LoopBack 4 + TypeScript |
| Database | PostgreSQL + Sequelize |
| Workflows | Temporal.io |
| Auth | Keycloak (OAuth2/OIDC) |
| Notifications | Novu |

### App Plane
| Component | Technology |
|-----------|------------|
| BOM Portal | React + React-Admin + MUI |
| CNS Dashboard | React + React-Admin + MUI |
| Components Backend | Python + FastAPI |
| CNS Service | Python + FastAPI |
| Data Storage | PostgreSQL + Supabase |
| CMS | Directus |

## Authentication Flow

### Control Plane Authentication
```
Admin/Customer App → Keycloak → JWT Token → Control Plane APIs
                                    │
                                    ▼
                          tenant-management-service
                          (validates JWT, checks permissions)
```

### App Plane Authentication
```
BOM Portal → Keycloak → JWT Token → App Plane APIs
     │                        │
     │                        ▼
     │              components-backend / cns-service
     │              (validates JWT, applies tenant context)
     │
     └── Tenant Context from JWT claims (tenantId)
```

## Multi-Tenancy

### Control Plane
- Manages tenant metadata in `tenants` table
- Each tenant has isolated PostgreSQL schema
- Provisioning workflow creates tenant resources

### App Plane
- Receives tenant context from JWT token
- Applies tenant isolation at query level
- Each tenant's data stored in separate Supabase schema

## Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Control Plane** | | |
| Admin App | http://localhost:5000 | SaaS admin dashboard |
| Customer App | http://localhost:4000 | Customer onboarding |
| Tenant Mgmt API | http://localhost:14000 | Control plane API |
| Temporal UI | http://localhost:14088 | Workflow monitoring |
| Keycloak | http://localhost:8180 | Identity provider |
| **App Plane** | | |
| BOM Portal | http://localhost:5173 | Component management |
| CNS Dashboard | http://localhost:5174 | CNS analytics |
| Components Backend | http://localhost:8000 | BOM API |
| CNS Service | http://localhost:8001 | CNS API |
| **Infrastructure** | | |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |
| Temporal | localhost:7233 | Workflow engine |
| Novu | http://localhost:3000 | Notifications |
| Jaeger | http://localhost:16686 | Tracing |
| Directus | http://localhost:8055 | Headless CMS |

## Running the Platform

### Start Infrastructure
```bash
cd arc-saas
docker-compose up -d
docker-compose -f docker-compose.temporal.yml up -d
```

### Start Control Plane
```bash
# Backend
cd services/tenant-management-service
npm install && npm run build && npm start

cd services/temporal-worker-service
npm install && npm run build && npm start

# Frontend
cd apps/admin-app
bun install && bun run dev

cd apps/customer-app
bun install && bun run dev
```

### Start App Plane
```bash
# Backend
cd app-plane/services/components-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd app-plane/services/cns-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Frontend
cd app-plane/apps/bom-portal
bun install && bun run dev

cd app-plane/apps/cns-dashboard
bun install && bun run dev
```

## Key Features by Plane

### Control Plane Features
1. **Tenant Management**
   - Create/edit/suspend tenants
   - Provision tenant infrastructure
   - Monitor tenant status

2. **Lead Management**
   - Capture leads via signup form
   - Email verification
   - Convert leads to tenants

3. **Subscription Management**
   - Define pricing plans
   - Track subscriptions
   - Generate invoices

4. **User Management**
   - Admin user CRUD
   - Tenant user invitations
   - Role-based permissions

5. **Workflow Orchestration**
   - Tenant provisioning
   - User onboarding
   - Background jobs

### App Plane Features
1. **BOM Portal**
   - Component Vault (Kanban board)
   - BOM Intake & parsing
   - Enrichment queue
   - Risk profiling
   - Organization settings

2. **CNS Dashboard**
   - Security analytics
   - Vulnerability scanning
   - Job status monitoring
   - Report generation
