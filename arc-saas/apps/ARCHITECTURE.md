# ARC SaaS UI Architecture

## Overview

ARC SaaS has two frontend applications that integrate with the backend services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARC SaaS Platform                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐         ┌──────────────────────┐                  │
│  │    Admin App         │         │   Customer App        │                  │
│  │    (Refine + shadcn) │         │   (React + shadcn)    │                  │
│  │    :5000              │         │   :4000               │                  │
│  │                       │         │                       │                  │
│  │  • Tenant Management  │         │  • Dashboard          │                  │
│  │  • Plans & Pricing    │         │  • Products           │                  │
│  │  • Subscriptions      │         │  • Orders             │                  │
│  │  • Workflow Monitor   │         │  • Settings           │                  │
│  └──────────┬───────────┘         └──────────┬───────────┘                  │
│             │                                 │                              │
│             │ /api/*                          │ /api/* (tenant-aware)        │
│             ▼                                 ▼                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                   Control Plane Services                        │         │
│  │  ┌─────────────────────┐  ┌─────────────────────┐              │         │
│  │  │ Tenant Management   │  │  Subscription       │              │         │
│  │  │ Service :3001       │  │  Service :3002      │              │         │
│  │  └──────────┬──────────┘  └──────────┬──────────┘              │         │
│  │             │                         │                         │         │
│  │             ▼                         ▼                         │         │
│  │  ┌─────────────────────────────────────────────────────────┐   │         │
│  │  │               Temporal Worker Service                    │   │         │
│  │  │  • provisionTenantWorkflow                               │   │         │
│  │  │  • deprovisionTenantWorkflow                             │   │         │
│  │  │  • deployTenantWorkflow                                  │   │         │
│  │  └──────────┬──────────────────────────────────────────────┘   │         │
│  └─────────────┼──────────────────────────────────────────────────┘         │
│                │                                                             │
│                ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                     Infrastructure                               │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │        │
│  │  │PostgreSQL│ │  Redis   │ │ Temporal │ │ Keycloak │ │  Novu  │ │        │
│  │  │  :5432   │ │  :6379   │ │  :7233   │ │  :8180   │ │ :3000  │ │        │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Apps

### 1. Admin App (`apps/admin-app`)

**Purpose**: Platform administration for SaaS operators

**Technology Stack**:
- React 18
- Refine (data fetching & CRUD framework)
- shadcn/ui (components)
- React Router v6
- TailwindCSS

**Features**:
- Tenant CRUD (create, view, edit, suspend)
- Plan management (pricing tiers, features)
- Subscription tracking
- Temporal workflow monitoring
- Authentication via Keycloak/Auth0

**API Endpoints Used**:
- `POST /api/auth/login` - Admin authentication
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create tenant (triggers provisioning workflow)
- `GET /api/plans` - List subscription plans
- `GET /api/subscriptions` - List all subscriptions
- `GET /api/workflows` - List Temporal workflows

### 2. Customer App (`apps/customer-app`)

**Purpose**: Tenant-specific application for end customers

**Technology Stack**:
- React 18
- React Query (TanStack Query)
- shadcn/ui (components)
- React Router v6
- TailwindCSS

**Features**:
- Tenant-aware context (resolves tenant from subdomain)
- Dashboard with stats
- Product management
- Order tracking
- Settings management
- Authentication scoped to tenant

**Tenant Resolution**:
```
URL: https://acme.app.example.com
     └── Tenant Key: "acme"
         └── PostgreSQL Schema: "tenant_acme"
```

## Authentication Flow

### Admin App Auth
```
Admin App → Keycloak/Auth0 → JWT Token → API Requests
                                    │
                                    ▼
                           Control Plane Services
                           (verify JWT, check role)
```

### Customer App Auth
```
Customer App → Tenant Context → Auth API → JWT Token → API Requests
     │              │                          │
     │              │                          ▼
     │              │              Tenant-scoped data access
     │              │              (PostgreSQL schema isolation)
     │              ▼
     └────► Subdomain Resolution (acme.app.example.com → acme)
```

## Database Schema Isolation

Each tenant has isolated data via PostgreSQL schemas:

```sql
-- Control plane schemas (shared)
main                 -- Platform configuration
tenant_management    -- Tenant metadata
subscription        -- Billing & subscriptions

-- Tenant schemas (isolated per tenant)
tenant_acme         -- Tenant "acme" data
tenant_demo         -- Tenant "demo" data
tenant_{key}        -- Dynamic tenant schemas
```

## API Integration

### Admin App → Control Plane
```typescript
// Data provider sends requests to control plane
const dataProvider = {
  getList: async ({ resource }) => {
    const response = await fetch(`/api/${resource}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  }
};
```

### Customer App → Tenant API
```typescript
// API client includes tenant context
const api = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Key': tenantKey  // Tenant context
      }
    });
    return response.json();
  }
};
```

## Error Handling & Logging

Both apps implement:
- **Error Boundaries**: Catch React errors, display fallback UI
- **Logger**: Environment-aware logging with tenant context
- **API Error Handling**: Standardized error responses

```typescript
// Logging with tenant context
logger.info("User action", {
  tenantId: "acme",
  userId: "user-123",
  action: "product.create"
});

// Error logging
logger.error("API request failed", {
  status: 500,
  message: "Internal error",
  traceId: "abc-123"  // OpenTelemetry correlation
});
```

## Development URLs

| Service            | URL                          |
|--------------------|------------------------------|
| Admin App          | http://localhost:5000        |
| Customer App       | http://localhost:4000        |
| Tenant Mgmt API    | http://localhost:3001        |
| Subscription API   | http://localhost:3002        |
| Temporal UI        | http://localhost:8088        |
| Keycloak           | http://localhost:8180        |
| Novu Dashboard     | http://localhost:4200        |
| Jaeger (Tracing)   | http://localhost:16686       |

## Running the Apps

```bash
# Start infrastructure
make up

# Admin App
cd apps/admin-app
npm install
npm run dev  # http://localhost:5000

# Customer App
cd apps/customer-app
npm install
npm run dev  # http://localhost:4000
```

## Environment Variables

### Admin App (`.env`)
```env
VITE_API_URL=/api
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=arc-saas
```

### Customer App (`.env`)
```env
VITE_API_URL=/api
VITE_TENANT_DOMAIN=localhost
```
