# Ananta Platform SaaS - Claude Code Context

## Project Overview
Multi-tenant SaaS control plane built on SourceFuse's ARC-SaaS framework using LoopBack 4, Temporal workflows, and PostgreSQL.

## Directory Structure
```
e:\Work\Ananta-Platform-Saas\
├── arc-saas/                           # Main project (modified ARC-SaaS)
│   ├── services/
│   │   ├── tenant-management-service/  # Core backend API
│   │   ├── orchestrator-service/       # Workflow orchestration
│   │   ├── subscription-service/       # Subscription management
│   │   └── temporal-worker-service/    # Temporal workers
│   ├── packages/
│   │   ├── custom-sf-changelog/
│   │   ├── pg-client/
│   │   └── shared-ui/
│   ├── apps/                           # Frontend applications
│   ├── react-boilerplate-ts-ui/        # React admin portal
│   └── docker/                         # Docker configurations
├── original-arc-saas/                  # Clean reference (git-ignored)
└── sourcefuse-references/              # 57 SourceFuse repos (git-ignored)
    ├── loopback4-*/                    # LoopBack extensions
    ├── arc-*/                          # ARC platform repos
    └── terraform-modules/              # AWS Terraform modules
```

## Tech Stack
- **Runtime**: Bun 1.1+ (faster builds/installs) or Node >= 20
- **Backend**: LoopBack 4 + TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Workflows**: Temporal.io
- **Auth**: JWT + Keycloak (OAuth2)
- **Notifications**: Novu
- **Cache**: Redis (lead tokens)
- **Frontend**: React (TypeScript) with Refine.dev
- **Infrastructure**: Docker, Docker Compose, Kubernetes (Rancher Desktop)

## Local Kubernetes Development (Rancher Desktop)

**Current Setup**: Uses Rancher Desktop with k3s and Docker runtime.

### Key Details
| Setting | Value |
|---------|-------|
| Kubernetes Context | `rancher-desktop` |
| Node Name | `sevadas` |
| Container Runtime | `docker` (shares images with Docker Desktop) |
| kubectl Location | `e:/Work/Ananta-Platform-Saas/kubectl.exe` |
| kind Location | `e:/Work/Ananta-Platform-Saas/kind.exe` (not used with rancher-desktop) |
| helm Location | `e:/Work/Ananta-Platform-Saas/helm.exe` |
| terraform Location | `e:/Work/Ananta-Platform-Saas/terraform.exe` |

### Loading Docker Images to Kubernetes
Since Rancher Desktop uses Docker runtime, locally built images are **automatically available** to the cluster:
```bash
# 1. Build image locally
docker build -t myimage:tag .

# 2. Tag for deployment (optional - if deployment uses different tag)
docker tag myimage:tag ananta/myimage:local

# 3. Rollout restart to pick up new image
kubectl rollout restart deployment/my-deployment -n my-namespace
```

**Important**: No need for `kind load` or `nerdctl import` - Docker images are shared.

### Common kubectl Commands
```bash
# Check cluster status
kubectl get nodes
kubectl get pods -n app-plane

# View logs
kubectl logs -f deployment/cns-service -n app-plane

# Port-forward for local access
kubectl port-forward -n app-plane svc/customer-portal 27100:27100
kubectl port-forward -n app-plane svc/cns-service 27200:27200

# Restart deployment
kubectl rollout restart deployment/customer-portal -n app-plane

# Apply Terraform changes
./terraform.exe -chdir=infrastructure/terraform/environments/local apply -auto-approve
```

### App Plane vs Arc-SaaS Customer Portal
**IMPORTANT**: There are TWO customer-portal applications:

| Portal | Location | Purpose | Port |
|--------|----------|---------|------|
| Arc-SaaS Customer Portal | `arc-saas/apps/customer-portal/` | Control Plane CBP (Refine.dev) | 27100 |
| App Plane Customer Portal | `app-plane/services/customer-portal/` | CNS frontend (React Admin) | 27100 |

For Kubernetes deployment, use the **Arc-SaaS** customer-portal. Build and deploy:
```bash
cd arc-saas/apps/customer-portal
bun run build
docker build -t ananta/customer-portal:local .
kubectl rollout restart deployment/customer-portal -n app-plane
```

## CRITICAL: Tenant ID = Organization ID Mapping

In our multi-tenant architecture, the same entity is named differently across planes:

| Layer | Terminology | API Parameter | Example Use |
|-------|-------------|---------------|-------------|
| **Control Plane** | `tenant` | `tenant_id`, `tenantId` | tenant-management-service, admin-app |
| **App Plane/CNS** | `organization` | `organization_id` | CNS service, customer-portal, Supabase |

**These are THE SAME entity** - just named differently based on the architectural layer.

### In Frontend Code (CBP):
```typescript
// TenantContext provides both hooks for clarity:
import { useTenantId, useOrganizationId } from '@/contexts/TenantContext';

// For Control Plane API calls:
const tenantId = useTenantId();

// For App Plane/CNS API calls:
const organizationId = useOrganizationId();  // Returns same value as useTenantId()
```

### In API Calls:
- **Control Plane APIs** (port 14000): Use `tenantId` in headers/body
- **CNS/App Plane APIs** (port 27200): Use `organization_id` as query parameter

### Remember:
- `tenant.id` from Control Plane IS the `organization_id` for App Plane
- CNS service requires `organization_id` for workspace queries
- CNS service requires `workspace_id` for project queries
- Always pass these as direct query parameters (not in LoopBack filter object)

## App Plane Docker Architecture

**IMPORTANT**: App Plane uses a SINGLE `docker-compose.yml` file - no separate dev/prod files.

```bash
# Start all App Plane services
cd app-plane && docker-compose up -d

# Start specific services
docker-compose up -d supabase-db components-v2-postgres redis rabbitmq

# View logs
docker-compose logs -f cns-service

# Stop services
docker-compose down
```

### Container Names (Production - NO -dev suffix):
| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| Supabase DB | app-plane-supabase-db | 27432 | Tenant business data |
| Components-V2 DB | app-plane-components-v2-postgres | 27010 | Component catalog SSOT |
| Redis | app-plane-redis | 27012 | Cache |
| RabbitMQ | app-plane-rabbitmq | 27672/27673 | Message broker |
| MinIO | app-plane-minio | 27040/27041 | Object storage |
| Supabase API | app-plane-supabase-api | 27810 | PostgREST |
| Supabase Studio | app-plane-supabase-studio | 27800 | DB Admin UI |
| CNS Service | app-plane-cns-service | 27200 | Component normalization (Python backend + React Admin dashboard at /dashboard) |
| Customer Portal | app-plane-customer-portal | 27100 | CBP - Customer Business Portal (Refine) |

### Master Migrations (for fresh databases):
```bash
# Apply Supabase master migration
docker exec -i app-plane-supabase-db psql -U postgres -d postgres \
  < app-plane/database/final-migrations/001_SUPABASE_MASTER.sql

# Apply Components-V2 master migration
docker exec -i app-plane-components-v2-postgres psql -U postgres -d components_v2 \
  < app-plane/database/final-migrations/002_COMPONENTS_V2_MASTER.sql
```

## Services

### tenant-management-service (Main API)
**Package**: `@sourceloop/ctrl-plane-tenant-management-service`

#### Controllers (23 total)
- `tenant.controller.ts` - Tenant CRUD
- `lead.controller.ts` - Lead management & verification
- `subscription.controller.ts` - Subscription management
- `plan.controller.ts` - Plan definitions
- `invoice.controller.ts` - Invoice management
- `user.controller.ts`, `users.controller.ts` - User management
- `tenant-users.controller.ts` - Tenant-specific users
- `user-invitations.controller.ts` - User invitations
- `roles.controller.ts` - Role assignments
- `user-activity.controller.ts` - Activity logging
- `settings.controller.ts` - Platform settings
- `billing-analytics.controller.ts` - Billing metrics
- `workflow.controller.ts` - Workflow management
- `health.controller.ts`, `ping.controller.ts` - Health checks
- `contact.controller.ts`, `home-page.controller.ts`
- `webhook/*.controller.ts` - Webhook handlers

#### Models
- Core: `tenant`, `lead`, `subscription`, `invoice`, `user`, `setting`
- Relations: `user-role`, `user-invitation`, `user-activity`
- Support: `address`, `contact`, `resource`, `webhook-secret`, `lead-token`
- DTOs: `create-lead-dto`, `subscription-dto`, `tenant-dto`, `provisioning-dto`

#### Services
- `onboarding.service.ts` - Lead onboarding flow
- `provisioning.service.ts` - Tenant provisioning
- `temporal-client.service.ts` - Temporal integration
- `lead-authenticator.service.ts` - Lead token management
- `invitation.service.ts` - User invitations
- `activity-logger.service.ts` - Activity logging
- `novu-notification.service.ts` - Novu notifications
- `idp-helper.service.ts` - Keycloak integration

## Code Patterns & Conventions

### Controller Pattern
```typescript
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
import {getModelSchemaRefSF, OPERATION_SECURITY_SPEC, STATUS_CODE, CONTENT_TYPE} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';

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
}
```

### Multi-Tenant Isolation
```typescript
// Always filter by tenant
const results = await this.repository.find({
  where: {tenantId: this.getTenantId(), ...otherFilters},
});
```

### UUID Validation
```typescript
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Usage in controller
if (!isValidUUID(id)) {
  throw new HttpErrors.BadRequest('Invalid ID format');
}
```

### Schema References
```typescript
// Use getModelSchemaRefSF - NOT inline schemas
@get('/items', {
  responses: {
    [STATUS_CODE.OK]: {
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {type: 'array', items: getModelSchemaRefSF(MyModel)},
        },
      },
    },
  },
})
```

## Enums & Status Values

### Subscription Status (string)
`'active'`, `'trialing'`, `'past_due'`, `'cancelled'`, `'paused'`, `'expired'`, `'pending'`, `'inactive'`

### Plan Tiers
`'free'`, `'starter'`, `'basic'`, `'standard'`, `'professional'`, `'premium'`, `'enterprise'`

### Plan Enum (src/enums/plan-tier.enum.ts)
```typescript
enum Plan { PREMIUM = 'PREMIUM', BASIC = 'BASIC', STANDARD = 'STANDARD' }
```

### Plan Prices
| Plan ID | Price |
|---------|-------|
| plan-basic | $29/month |
| plan-standard | $79/month |
| plan-premium | $199/month |

## Permission Keys (src/permissions.ts)
```
Lead: 10200-10203
Tenant: 10204-10207, 10216 (Provision)
Contact: 10208-10211
Invoice: 10212-10215
Subscription: 7001-7004, 7008 (ViewPlan)
Tenant Config: 10220-10223
User: 10300-10306
Roles: 10310-10313
Invitations: 10320-10324
Activity: 10330
Billing: 5321-5333
```

## Role Hierarchy (RBAC)

### 5-Level Role Hierarchy (Aligned with CBP/CNS)
| Level | Role | Description | Access |
|-------|------|-------------|--------|
| 5 | `super_admin` | Platform staff (Ananta employees) | Platform-wide access |
| 4 | `owner` | Organization owner | Billing, delete org, all admin |
| 3 | `admin` | Organization admin | User management, org settings |
| 2 | `engineer` | Technical user | Manage BOMs, components, specs |
| 1 | `analyst` | Read-only user | View data, reports (lowest) |

### Keycloak Role Mappings
Multiple Keycloak roles map to each app role:

| App Role | Keycloak Roles |
|----------|----------------|
| `super_admin` | `platform:super_admin`, `platform-super-admin`, `super-admin`, `superadmin`, `super_admin`, `realm-admin`, `platform_admin` |
| `owner` | `owner`, `org-owner`, `organization-owner`, `billing_admin` |
| `admin` | `platform:admin`, `tenant-admin`, `admin`, `administrator`, `org_admin`, `org-admin` |
| `engineer` | `platform:engineer`, `platform:staff`, `engineer`, `staff`, `developer`, `support`, `operator` |
| `analyst` | `analyst`, `user`, `customer`, `viewer`, `member` |

### Legacy Role Mappings (Backwards Compatibility)
| Old Role | New Role | Reason |
|----------|----------|--------|
| `staff` | `engineer` | Technical access level |
| `user` | `analyst` | Lowest customer role |
| `viewer` | `analyst` | Read-only access |
| `member` | `analyst` | Basic member access |
| `developer` | `engineer` | Technical access |
| `org_admin` | `admin` | Org management |

### Action-Based Access Control
| Action | Minimum Role | Notes |
|--------|--------------|-------|
| `list`, `show` | Per-resource `minRole` | Defined in navigation manifest |
| `create` | `engineer` | Can manage BOMs, components |
| `edit` | `engineer` | Can manage BOMs, components |
| `delete` | `admin` | Organization management |

### Resource-Level Access (Admin App)
| Resource | Minimum Role | Feature Flag |
|----------|--------------|--------------|
| Dashboard | (all authenticated) | - |
| Tenants | `admin` | - |
| Plans | `admin` | - |
| Subscriptions | `engineer` | - |
| Workflows | `engineer` | `workflows` |
| Users | `admin` | - |
| Invitations | `admin` | - |
| Billing | `super_admin` | `billing` |
| Roles | `super_admin` | - |
| Audit Logs | `admin` | `auditLogs` |
| Settings | `admin` | - |
| Monitoring | `engineer` | `monitoring` |

### Role Check Functions (role-parser.ts)
```typescript
import { hasMinimumRole, isSuperAdmin, isOwner, isAdmin, isEngineer, isAnalyst } from './lib/role-parser';

// Check minimum role level
hasMinimumRole('engineer', 'analyst');  // true (engineer >= analyst)
hasMinimumRole('analyst', 'admin');     // false (analyst < admin)

// Convenience functions
isSuperAdmin('super_admin');  // true (exact match only)
isOwner('super_admin');       // true (owner or higher)
isAdmin('admin');             // true (admin or higher)
isEngineer('engineer');       // true (engineer or higher)
isAnalyst('analyst');         // true (all roles pass)
```

### JWT Token Role Extraction
Roles are extracted from Keycloak JWTs in this order:
1. `realm_access.roles` - Realm-level roles
2. `resource_access.{client}.roles` - Client-specific roles
3. `roles` - Direct roles claim
4. `groups` - Group memberships (leading `/` stripped)

The highest-priority role is returned when multiple roles are present.

## Migrations
- **Location**: `services/tenant-management-service/migrations/pg/migrations/`
- **Format**: db-migrate with SQL files in `sqls/` subdirectory
- **Naming**: `YYYYMMDDHHMMSS-description.js`

## Key Commands (Bun - Preferred)
```bash
# Install Bun (if not already installed)
# Windows: powershell -c "irm bun.sh/install.ps1 | iex"
# macOS/Linux: curl -fsSL https://bun.sh/install | bash

# Navigate to service
cd arc-saas/services/tenant-management-service

# Install dependencies (generates bun.lockb)
bun install

# Build
bun run build

# TypeScript check (no emit)
bun run tsc --noEmit

# Run migrations
bun run migrate

# Start development
bun run start:dev

# Start services (all three)
cd arc-saas/services/tenant-management-service && bun run start &
cd arc-saas/services/temporal-worker-service && bun run start &
cd arc-saas/apps/admin-app && bun run dev &

# Docker compose (from arc-saas root)
docker-compose up -d
docker-compose -f docker-compose.temporal.yml up -d
```

### npm Commands (Alternative)
```bash
# If Bun has issues, npm still works (slower)
npm install
npm run build
npm run start
```

## Reference Resources
When implementing features, check these cloned repos:
- `original-arc-saas/` - Clean original for comparison
- `sourcefuse-references/loopback4-microservice-catalog` - Microservice patterns
- `sourcefuse-references/loopback4-starter` - Multi-tenant template
- `sourcefuse-references/loopback4-authentication` - Auth patterns
- `sourcefuse-references/arc-docs` - Official documentation
- `sourcefuse-references/arc-react-sass-ui` - React admin UI reference

## Temporal Workflow Patterns

### CRITICAL: Workflow Sandbox Restrictions
Temporal workflows run in a **sandboxed V8 isolate** where many Node.js globals are unavailable:

```typescript
// NEVER use in workflow code (files imported by workflows):
process.env.MY_VAR     // ReferenceError: process is not defined
require('fs')          // Not available in sandbox
setTimeout()           // Use workflow.sleep() instead
Math.random()          // Non-deterministic - use workflow.uuid4()
new Date()             // Non-deterministic - use workflow.now()
```

**Files affected**: Any code in `temporal-worker-service/src/workflows/` or imported by workflow files (like `config/workflow.config.ts`)

**Solution**: Use static constants or pass configuration as workflow inputs:
```typescript
// BAD - in workflow.config.ts
export const TIMEOUT = process.env.TIMEOUT || '30 seconds';

// GOOD - static defaults
export const TIMEOUT = '30 seconds';
```

### Temporal Namespaces
- **Namespace**: `arc-saas`
- **Task Queue**: `tenant-provisioning`
- **Temporal UI**: http://localhost:14088 (select `arc-saas` namespace)

### Workflow IDs
- Provisioning: `provision-tenant-{tenantId}`
- User Invitation: `user-invitation-{invitationId}`

### Debugging Workflows
```bash
# List workflows in arc-saas namespace
docker exec arc-saas-temporal temporal workflow list --namespace arc-saas --address temporal:7233

# Show workflow history
docker exec arc-saas-temporal temporal workflow show --namespace arc-saas --workflow-id "provision-tenant-XXX" --address temporal:7233

# Terminate stuck workflow
docker exec arc-saas-temporal temporal workflow terminate --namespace arc-saas --workflow-id "provision-tenant-XXX" --address temporal:7233
```

## API Specifications

### OpenAPI Specs (Auto-Generated)
- **Tenant Management**: `arc-saas/services/tenant-management-service/src/openapi.json`
- **Orchestrator**: `arc-saas/services/orchestrator-service/src/openapi.json`
- **Subscription**: `arc-saas/services/subscription-service/src/openapi.json`
- **Full API Guide**: `docs/API-SPEC.md`

### Critical Validation Rules
| Field | Constraint |
|-------|------------|
| `tenant.key` | **max 10 chars**, alphanumeric, unique |
| `lead.email` | valid email format, unique |
| `planId` | `plan-basic`, `plan-standard`, `plan-premium` |
| All IDs | valid UUID v4 format |

### Auth Methods
| Endpoint | Auth Type |
|----------|-----------|
| Most endpoints | `Authorization: Bearer {JWT}` |
| `POST /leads/{id}/tenants` | `X-Lead-Token: {token}` (NOT JWT) |

### Common Errors
| Status | Cause |
|--------|-------|
| 401 | Wrong auth method (Lead Token vs JWT) |
| 422 `maxLength` | tenant.key > 10 chars |
| 422 `additionalProperties` | Unknown field in request body |

## Database Functions (PostgreSQL)

Required in `arc_saas` database, schema `tenant_management`:
```sql
tenant_management.create_tenant_schema(tenant_key VARCHAR(50))
tenant_management.drop_tenant_schema(tenant_key VARCHAR(50))
```

If provisioning fails with "function does not exist":
```bash
docker exec -i arc-saas-postgres psql -U postgres -d arc_saas < arc-saas/docker/init-db/01-init-schemas.sql
```

## Shared Temporal Infrastructure

| Setting | Value |
|---------|-------|
| Address (host) | `localhost:27020` |
| Address (docker) | `shared-temporal:7233` |
| Control Plane NS | `arc-saas` |
| App Plane NS | `default`, `enrichment` |
| Task Queue | `tenant-provisioning` |
| UI | http://localhost:27021 |

```bash
# In arc-saas .env
TEMPORAL_ADDRESS=localhost:27020
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning
```

## Service Ports (ALWAYS use these fixed ports)

### Control Plane Services
| Service | Port | URL | Notes |
|---------|------|-----|-------|
| tenant-management-service | 14000 | http://localhost:14000 | Main backend API |
| temporal-worker-service | (no HTTP) | - | Connects to Temporal on 27020 |
| admin-app (Vite) | 27555 | http://localhost:27555 | React admin portal |
| Temporal UI | 27021 | http://localhost:27021 | Workflow dashboard |
| Temporal gRPC | 27020 | localhost:27020 | Workflow engine |
| PostgreSQL | 5432 | localhost:5432 | Control plane DB |
| Redis | 6379 | localhost:6379 | Cache (lead tokens) |

### Keycloak Port Configuration
| Environment | URL | Port | When to Use |
|-------------|-----|------|-------------|
| Local dev (Bun/Node) | http://localhost:8180 | 8180 | Running services directly on host |
| Docker Compose | http://localhost:8180 | 8180 | Browser accessing Keycloak through Docker |
| Docker internal | http://keycloak:8080 | 8080 | Services inside Docker network |

**Standard for all local development**: Use port **8180** in `.env` files for both direct execution and Docker Compose environments.

### App Plane Services (see container table above)
The App Plane uses fixed ports in the 27xxx range. See "App Plane Docker Architecture" section for the complete container/port mapping.

**IMPORTANT**: Always use `--port 27555 --strictPort` for admin-app to prevent Vite from auto-incrementing ports. Before starting services, kill any stale processes:
```bash
# Windows: Kill stale node/bun processes before starting
cmd /c "taskkill /F /IM node.exe 2>nul & taskkill /F /IM bun.exe 2>nul"
```

## Important Rules
1. Always use `getModelSchemaRefSF()` for API schemas
2. Apply multi-tenant isolation on ALL data queries
3. Validate UUIDs before database operations
4. Invalidate one-time tokens after use
5. Add pagination to list endpoints (default: 20, max: 100)
6. Use string status values (NOT numeric codes) for subscriptions
7. Check `original-arc-saas` when unsure about patterns
8. Never expose sensitive data in API responses
9. **NEVER use `process.env` in Temporal workflow code** - workflows run in a sandbox
10. **tenant.key max 10 chars** - used for schema names
11. **Lead→Tenant creation requires Lead Token auth**, not JWT
12. **Apply 01-init-schemas.sql** if provisioning fails with "function does not exist"
13. **No emojis in log messages** - use plain text markers like [INFO], [ERROR], [OK]
14. **Exclude SSE endpoints from ServiceWorker caching** - See "PWA/ServiceWorker Considerations"
15. **Always rebuild frontend BEFORE restarting Docker containers** - Docker serves pre-built code
16. **ALWAYS use production mode for frontend apps** - NEVER use dev mode, ALWAYS build and serve via Docker

---

## CRITICAL: Frontend Development Mode - PRODUCTION ONLY

### NEVER Use Dev Mode
**Always use production builds served via Docker containers. NEVER run `bun run dev` for testing.**

Why:
- Dev mode has different behavior (hot reload, source maps, debug flags)
- Dev mode doesn't match production environment
- Docker containers serve production builds - they must be rebuilt to see changes
- User is testing production code, not dev mode code

### Correct Workflow:
```bash
# 1. Build frontend in production mode
cd arc-saas/apps/customer-portal
bun run build

# 2. Rebuild Docker container (if using Docker)
docker-compose build --no-cache customer-portal

# 3. Start/restart container
docker restart arc-saas-customer-portal
# OR
docker-compose up -d customer-portal
```

### When Code Changes Aren't Showing:
1. Did you run `bun run build`? If not, do it now
2. Did you restart the Docker container? If not, do it now
3. Clear browser cache: DevTools → Application → Storage → Clear site data
4. Hard refresh: Ctrl+Shift+R

---

## CRITICAL: PWA/ServiceWorker Considerations

### SSE (Server-Sent Events) and ServiceWorker DO NOT MIX

**Problem**: Workbox/ServiceWorker intercepts ALL matching network requests, including SSE streams. SSE connections are long-lived streaming connections that CANNOT be cached or handled by ServiceWorker.

**Symptoms**:
- Browser console shows: "ServiceWorker intercepted the request and encountered an unexpected error"
- SSE connections fail immediately with CORS-like errors
- Multiple rapid reconnection attempts in console

**Root Cause**: `vite.config.ts` Workbox `runtimeCaching` patterns intercept API URLs:
```javascript
// BAD - This catches SSE endpoints too!
urlPattern: /^https?:\/\/localhost:(14000|27200|27810)\/.*$/i,
```

**Solution**: Exclude streaming endpoints from ServiceWorker:
```javascript
// In vite.config.ts workbox config:
navigateFallbackDenylist: [
  /\/api\/enrichment\/stream\//,  // SSE enrichment progress
  /\/api\/bom\/workflow\/stream/,  // SSE workflow status
  /\/events$/,
  /\/sse$/,
],
runtimeCaching: [
  {
    // Use function to exclude streaming paths
    urlPattern: ({ url }) => {
      const isApiHost = /^https?:\/\/localhost:(14000|27200|27810)/.test(url.href);
      const isStreaming = /\/(stream|events|sse)(\/|$)/i.test(url.pathname);
      return isApiHost && !isStreaming;  // Only non-streaming API calls
    },
    handler: 'NetworkFirst',
    // ...
  },
]
```

### Docker Build Order

**CRITICAL**: Docker containers serve pre-built code. If you update frontend code:

1. **FIRST**: Build the frontend locally (`bun run build`)
2. **THEN**: Rebuild Docker container (`docker-compose build --no-cache customer-portal`)
3. **FINALLY**: Start container (`docker-compose up -d customer-portal`)

**DO NOT**: Start containers before building - you'll serve old code!

### Clearing ServiceWorker Cache

When testing SSE/PWA changes, clear the ServiceWorker:
1. Browser DevTools → Application → Service Workers → Unregister
2. Application → Storage → Clear site data
3. Hard refresh (Ctrl+Shift+R)

---

## CRITICAL: Database Schema Verification Protocol

### BEFORE Testing Any Feature:
1. **ALWAYS verify database schema exists** before testing any feature that touches the database
2. **Check actual table/column names** - never assume column names, query `information_schema`
3. **Read service logs thoroughly** instead of making assumptions about what's failing

### Reference Sources for Schema:
| Component | Reference Location |
|-----------|-------------------|
| CNS Service (App Plane) | `components-platform-v2-ref/database/` |
| Control Plane | `arc-saas/services/tenant-management-service/migrations/` |
| Supabase Tables | Query `information_schema.tables` and `information_schema.columns` |

### Schema Verification Commands:
```bash
# List all tables in Supabase public schema
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;"

# Check columns in a specific table
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'bom_line_items' ORDER BY ordinal_position;"

# Components-V2 database
docker exec -e PGPASSWORD=postgres app-plane-components-v2-postgres psql -U postgres -d components_v2 -c "
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

### When Encountering "relation does not exist" or "column does not exist":
1. **STOP** - Do not proceed with workarounds
2. **Check reference**: Look at `components-platform-v2-ref/database/migrations/` for the complete schema
3. **Create missing migration**: Build migration from reference, apply it
4. **Verify**: Run schema verification commands above
5. **Only then proceed** with the original task

### App Plane Database Architecture:
| Database | Container | DB Name | Purpose |
|----------|-----------|---------|---------|
| Supabase | app-plane-supabase-db | postgres | Customer data (boms, bom_line_items, organizations, 82+ tables) |
| Components-V2 | app-plane-components-v2-postgres | components_v2 | Component catalog (components, manufacturers, categories, suppliers) |

### CNS Service Required Tables (Supabase):
- `boms` - BOM headers
- `bom_line_items` - BOM line items with enrichment data
- `organizations` - Multi-tenant organizations
- `enrichment_events` - Enrichment audit trail
- `enrichment_config` - Per-org enrichment settings
- `audit_logs` - System audit logs

### CNS Service Required Tables (Components-V2):

**CRITICAL: Two component tables with different purposes:**
| Table | Purpose | Used By |
|-------|---------|---------|
| `components` | Original catalog with manufacturer_id FK | Legacy lookups |
| `component_catalog` | **CNS enrichment table** (MPN + manufacturer as strings) | ComponentCatalogService raw SQL |
| `catalog_components` | **View** mapping to component_catalog for ORM | SQLAlchemy CatalogComponent model |

**Core Tables:**
- `component_catalog` - **REQUIRED for CNS enrichment** - stores enriched components with quality scores
  - Primary key: UUID
  - Unique constraint: (manufacturer_part_number, manufacturer)
  - Key columns: quality_score, enrichment_source, supplier_data, usage_count
- `catalog_components` - **VIEW** for ORM compatibility, maps to component_catalog
- `components` - Original component catalog (43 columns, uses manufacturer_id FK)
- `manufacturers` - Manufacturer registry
- `categories` - Component categories
- `suppliers` - Supplier information
- `supplier_tokens` - OAuth tokens for supplier APIs (DigiKey etc.)
- `cns_enrichment_config` - Enrichment configuration settings
- `component_pricing` - Supplier pricing data
- `vendor_category_mappings` - Category mapping between vendors

**Migration Files:**
```
app-plane/services/cns-service/migrations/
├── 001_initial_schema.sql      # Original catalog_components table (SERIAL pk)
├── 002_enrichment_config.sql   # cns_enrichment_config table
├── 007_component_catalog_table.sql # component_catalog (UUID pk) + view
```

**Schema Verification for CNS Service:**
```bash
# Verify component_catalog table exists (required for enrichment)
docker exec -e PGPASSWORD=postgres app-plane-components-v2-postgres psql -U postgres -d components_v2 -c "
SELECT column_name FROM information_schema.columns WHERE table_name = 'component_catalog' ORDER BY ordinal_position;"

# Verify catalog_components view exists (required for ORM)
docker exec -e PGPASSWORD=postgres app-plane-components-v2-postgres psql -U postgres -d components_v2 -c "\dv catalog_components"
```

### Migration Files Location:
```
components-platform-v2-ref/
├── database/
│   ├── migrations/           # SQL migration files - USE THIS AS SOURCE OF TRUTH
│   │   ├── 001_initial.sql
│   │   ├── 002_components.sql
│   │   └── ...
│   └── seeds/                # Seed data
└── services/cns-service/
    └── database/             # Service-specific migrations
```

---

## Debugging Protocol

### When Something Fails:
1. **Check logs FIRST** - Don't assume the cause
   ```bash
   docker logs <container> --tail 100 2>&1 | grep -i "error\|fail\|exception"
   ```
2. **Verify environment** - Settings may differ between host and container
   ```bash
   docker exec <container> env | grep -i "<setting>"
   ```
3. **Check database state** - Query actual data, don't assume
4. **Trace the code path** - Read the actual code being executed

### Common Pitfalls to Avoid:
- Assuming column names without verifying (e.g., `mpn` vs `part_number`)
- Testing features before schema is complete
- Restarting services without checking if old processes are still running
- Making changes without checking logs for the actual error
- **ServiceWorker intercepting SSE/streaming requests** - See "PWA/ServiceWorker Considerations" section

---

## CRITICAL: Work Quality Standards

### DO NOT DO HALF-ASSED WORK

When assigned a task:

1. **UNDERSTAND FULLY** - If unclear about requirements:
   - ASK for clarification before starting
   - Don't assume what the user wants
   - Review related code/documentation thoroughly

2. **COMPLETE THE JOB** - Every task must be:
   - Fully implemented, not partially
   - Tested and verified working
   - All dependencies/prerequisites addressed

3. **CHECK REFERENCES FIRST** - Before implementing:
   - Check `components-platform-v2-ref/` for existing implementations
   - Verify ALL required tables/columns exist
   - Don't skip steps to "save time"

4. **VERIFY, DON'T ASSUME**:
   - Check actual database schema before writing queries
   - Read logs to understand real errors, not guessed ones
   - Test the actual code path, not just happy paths

5. **WHEN STUCK**:
   - ASK the user for guidance
   - Don't make assumptions that lead to repeated failures
   - Document blockers clearly

### Signs of Half-Assed Work (AVOID THESE):
- "I'll fix this later" without actually fixing it
- Testing with incomplete prerequisites
- Hitting the same error multiple times (e.g., missing tables)
- Making assumptions about column names without verifying
- Starting implementation before understanding the full scope
- Not checking reference implementations before building

### The Right Way:
```
1. User asks for task
2. Read related code/docs thoroughly
3. If unclear → ASK QUESTIONS
4. Verify ALL prerequisites (schema, env vars, services)
5. Implement completely
6. Test end-to-end
7. Verify in logs that it actually worked
8. Report back with evidence of success
```

### When Migrating/Building Schema:
1. ALWAYS check `components-platform-v2-ref/database/migrations/`
2. Create COMPLETE migration with ALL tables
3. Apply migration
4. Verify ALL tables exist with `information_schema` queries
5. ONLY THEN proceed with feature work

### Remember:
- User's time is valuable
- Hitting the same issue 3 times is unacceptable
- Ask questions upfront, not after multiple failures
- A complete solution the first time beats multiple broken attempts

---

## ARC-SaaS Improvement Guidelines

> Reference: `arc-saas/docs/ARC-SAAS-IMPROVEMENT-PROMPT.md` for full 10-step checklist

### 1. Context & Architecture
- Stack: Keycloak, Temporal, RabbitMQ, Postgres, Redis, Novu, Refine, FastAPI
- Preserve multi-tenant flows, provisioning workflows, DNS/email automation
- Reference existing ADRs/design docs (`docs/PLATFORM_INTEGRATION_PLAN.md`) before structural shifts
- Ensure compatibility with both PowerShell and bash tooling
- Document shared resource changes (networks, volumes) explicitly

### 2. Styling & Conventions
- Follow Tailwind/shadcn UI patterns (`apps/admin-app/src/components`) and Refine hooks
- Python: FastAPI/Pydantic idioms with shared `logger`
- Strict TypeScript typing; add interfaces for DTOs
- Run linters: Bun lint/Prettier for TS, Ruff/Black for Python
- Add unit/integration tests for each change
- Synchronize FE/BE data models when adding fields
- Keep API responses backward compatible; add migrations where necessary

### 3. Configuration-Driven Mindset
- Drive all URLs/IDs/feature toggles through env vars or `platform.config`
- Document env changes in `.env.example`, root README, and setup guides
- Add runtime validation/warnings when key vars fallback to defaults
- Support per-tenant overrides via config APIs or metadata tables
- Align defaults with docker-compose (Keycloak 8180, control plane 14000)

### 4. RBAC & Auth Requirements
- Map Keycloak roles/groups to platform roles; remove hard-coded `super_admin`
- Update `auth-provider.ts`/`token-manager.ts` to derive permissions securely
- Gate UI routes via Refine `accessControlProvider`
- Enforce backend RBAC through FastAPI dependencies referencing `AuthContext`
- Log access decisions for auditing; support MFA/session revocation
- Ensure logout revokes tokens (call Keycloak end-session)

### 5. API/Data Provider Discipline
- Route all admin-app requests through `dataProvider`/`useCustom`; honor env-based `VITE_API_URL`
- Add consistent logging, retries, and error handling
- Keep backend endpoints aligned with existing REST patterns and response envelopes
- Maintain pagination/sorting/filtering behavior expected by Refine
- Update TypeScript + Pydantic models in sync

### 6. Workflow & Automation Standards
- Extend Temporal workflows directly; keep them idempotent with proper retries/backoffs
- Maintain `[FLOW_X]` log markers and update diagrams/docs when flows change
- Provide CLI/ops tooling for manual intervention (restart/cancel endpoints)
- Document failure scenarios and remediation steps

### 7. Billing & Notification Standards
- Use existing billing abstractions (Stripe/Paddle) for new pricing/invoice features
- Centralize currency/locale formatting utilities
- Leverage Novu templates/config; add admin UI for editing templates per tenant
- Secure webhooks with signature verification

### 8. Observability Requirements
- Each service must expose `/health` and `/metrics` compatible with Prometheus
- Update `shared-monitoring/prometheus` scrape configs + alerts for new targets
- Emit structured logs with flow metadata
- Provide Grafana dashboards for new components

### 9. Documentation Standards
- Update root README, `arc-saas/docs`, `.env.example` for every change
- Provide step-by-step instructions, CLI commands, and troubleshooting
- Refresh architecture diagrams (Mermaid/Figma) to reflect new modules
- Document migrations (DB, Keycloak) with rollback plan

### 10. Reusable SaaS Framework Goal
- Each enhancement must state how it improves reusability
- Support per-tenant branding (colors, logos, domains) via config/DB tables
- Build feature flag hooks for plan/tenant toggles
- Offer APIs/SDKs for partners to extend the control plane
- Provide IaC templates (Terraform/Pulumi) and deployment tooling

---

## Known Issues & Gaps (From Improvement Prompt)

### Admin-App Issues:
| File | Issue | Fix |
|------|-------|-----|
| `src/providers/data-provider.ts:10` | Hard-coded `API_URL="/api"` | Use `import.meta.env.VITE_API_URL` |
| `src/lib/token-manager.ts:3` | Hard-coded API URL | Derive from env |
| `src/pages/register/onboard.tsx:12,218` | Success link defaults to wrong port | Use `VITE_CUSTOMER_APP_URL` |
| `src/providers/auth-provider.ts:33-80` | Assumes `role: 'super_admin'` for everyone | Parse roles from Keycloak token |
| `App.tsx:132-201` | Hard-coded navigation/resources | Use manifest-driven config |

### Configuration Mismatches:
- All `.env` files standardized on Keycloak port 8180 (RESOLVED)
- Onboarding API base URL should use control-plane port 14000
- Docker-compose env exports must align with service expectations

### Workflow Status:
- BOM status may mismatch between Redis vs Supabase (legacy vs unified flows)
- Ensure `update_bom_progress` works for `source='staff'`

---

## Admin-App Frontend Patterns

### Data Provider Usage
```typescript
// GOOD - Use dataProvider with env-based URL
import { useCustom, useCustomMutation } from "@refinedev/core";

// Custom mutation example
const { mutate: customMutate } = useCustomMutation();
customMutate({
  url: `/user-invitations`,  // Relative URL - dataProvider prepends API_URL
  method: "post",
  values: { email, roleKey, tenantId },
});
```

### Auth Provider Pattern
```typescript
// Token refresh should use API_URL from env
const API_URL = import.meta.env.VITE_API_URL || "/api";
const response = await fetch(`${API_URL}/auth/token-refresh`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken }),
});
```

### Explicit Schema for LoopBack Controllers
When `@belongsTo` properties cause schema issues:
```typescript
// Instead of getModelSchemaRefSF which includes @belongsTo as required:
@requestBody({
  content: {
    [CONTENT_TYPE.JSON]: {
      schema: {
        type: 'object',
        title: 'NewUserInvitation',
        required: ['email', 'roleKey', 'tenantId'],
        properties: {
          email: { type: 'string', format: 'email' },
          roleKey: { type: 'string' },
          tenantId: { type: 'string', format: 'uuid' },
          // Optional properties without @belongsTo issues
        },
      },
    },
  },
})
```

---

## Admin-App Improvement Progress

### Completed Tasks

| Task | Status | Changes Made |
|------|--------|--------------|
| Task 1: Baseline Config Audit | DONE | Updated `.env.example` with correct ports (14000, 27555), added missing vars |
| Task 2: API Base URL Fix | DONE | Created `src/config/api.ts`, updated data-provider.ts, token-manager.ts, onboard.tsx |
| Task 3: RBAC Enablement | DONE | Created `src/lib/role-parser.ts`, updated auth-provider.ts for dynamic role extraction |
| Task 4: Navigation Manifest | DONE | Created `src/config/navigation.ts` with role-gated resources |

### Files Created

| File | Purpose |
|------|---------|
| `src/config/api.ts` | Centralized API URL configuration |
| `src/lib/role-parser.ts` | Keycloak JWT role extraction utilities |
| `src/config/navigation.ts` | Config-driven navigation manifest with RBAC |

### Files Modified

| File | Changes |
|------|---------|
| `.env.example` | Correct ports, Keycloak config, feature flags |
| `src/providers/data-provider.ts` | Import API_URL from config |
| `src/lib/token-manager.ts` | Import API_URL from config |
| `src/pages/register/onboard.tsx` | Use centralized config for URLs |
| `src/providers/auth-provider.ts` | Dynamic role extraction from Keycloak tokens |
| `src/App.tsx` | Use manifest-driven resources array |

### Key Improvements

1. **Centralized Configuration**: All URLs derived from env vars, no hard-coded values
2. **Dynamic RBAC**: Roles parsed from Keycloak tokens (realm_access, resource_access, groups)
3. **Role Hierarchy**: super_admin > admin > staff > user with proper permission checks
4. **Config-Driven Navigation**: Resources array generated from manifest with role-based filtering
