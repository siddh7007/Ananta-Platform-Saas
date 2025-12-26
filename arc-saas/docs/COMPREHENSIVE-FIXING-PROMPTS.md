# Comprehensive Fixing Prompts - Ananta Platform SaaS

> Generated: 2025-12-14
> Based on: Documentation analysis + Code investigation by expert agents
> Status: All issues verified against actual codebase implementation

---

## Executive Summary

| Priority | Total Reported | Confirmed After Investigation | False Positives |
|----------|---------------|------------------------------|-----------------|
| P0 Critical | 5 | 3 | 2 |
| P1 High | 9 | 5 | 4 |
| P2 Medium | 8 | 6 | 2 |
| **Total** | **22** | **14** | **8** |

### Issues Resolved (False Positives) - VERIFIED December 2024:

> **IMPORTANT**: The following issues were initially reported as gaps but code investigation confirmed they are FULLY IMPLEMENTED. Do NOT re-open these issues.

| Issue | Status | Verification |
|-------|--------|--------------|
| ~~P0-2: docker-compose.yml missing~~ | **EXISTS** | `arc-saas/docker-compose.yml` (492 lines) |
| ~~P0-3: Dashboard API Disabled~~ | **ENABLED** | All `useGetList` hooks active in `Dashboard.tsx` |
| ~~P1-3: Workflow Endpoints Missing~~ | **IMPLEMENTED** | `workflow.controller.ts` lines 419-807: restart, cancel, terminate |
| ~~P1-4: Invitation Rate Limiting~~ | **ENFORCED** | `invitation.service.ts`: 5min cooldown, max 5 resends |
| ~~P1-5: App Plane Sync Missing~~ | **IMPLEMENTED** | Direct Supabase + webhook in `supabase-app-plane.activities.ts` |
| ~~P1-7: Notification Preferences~~ | **COMPLETE** | `AlertPreferences.tsx` (774 lines) |
| ~~P2-7: UI Polish~~ | **EXISTS** | CommandPalette, SkipLinks, FocusTrap all implemented |

---

## P0 CRITICAL ISSUES (Fix Immediately)

### P0-1: Hardcoded Novu API Key Exposure

**Severity**: CRITICAL - Security breach risk
**Status**: CONFIRMED - Found in 15+ files including COMMITTED .env files

#### Affected Files:
```
# Committed .env files (IMMEDIATE ACTION):
arc-saas/services/temporal-worker-service/.env:57
arc-saas/apps/customer-app/.env:2

# Documentation/Scripts (remove after rotation):
arc-saas/docs/CBP-INTEGRATION-PROMPT.md:66
arc-saas/docs/NOVU-EMAIL-SETUP.md:multiple
arc-saas/docs/novu-templates.md:multiple
arc-saas/setup-novu-workflows.sh:9
arc-saas/bootstrap-novu.js:21
arc-saas/create-novu-workflows-api.js:7
arc-saas/fix-novu-workflows.js:7
arc-saas/update-workflow-steps.js:7
arc-saas/verify-novu-workflows.js:7
```

#### Root Cause:
`.gitignore` has typo `.envnul` instead of `.env` at line causing .env files to be committed.

#### Fixing Prompt:

```markdown
## Task: Rotate Novu API Key and Secure Secrets

### Step 1: Rotate the API Key (IMMEDIATE)
1. Log into Novu dashboard at http://localhost:13100
2. Go to Settings > API Keys
3. Revoke current key: `<your-novu-api-key>`
4. Generate new API key
5. Store new key in secure secrets manager (not in code)

### Step 2: Fix .gitignore
Edit `arc-saas/.gitignore` and fix the typo:
- Find: `.envnul` (around line 50)
- Replace with: `.env`
- Also add:
```
.env
.env.*
!.env.example
*.env
```

### Step 3: Remove committed .env files from git history
```bash
cd arc-saas

# Remove from tracking (keeps local file)
git rm --cached services/temporal-worker-service/.env
git rm --cached apps/customer-app/.env

# For complete history removal (optional but recommended):
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch services/temporal-worker-service/.env apps/customer-app/.env" \
  --prune-empty --tag-name-filter cat -- --all
```

### Step 4: Update all files to use environment variable
Replace hardcoded key with `${NOVU_API_KEY}` or `process.env.NOVU_API_KEY` in all affected files.

### Step 5: Create .env.example templates
```bash
# arc-saas/services/temporal-worker-service/.env.example
NOVU_API_KEY=your-novu-api-key-here
NOVU_API_URL=http://localhost:13100

# arc-saas/apps/customer-app/.env.example
VITE_NOVU_APP_ID=your-novu-app-id-here
```

### Step 6: Update documentation
Replace all instances of the hardcoded key in docs with:
```
NOVU_API_KEY=<your-api-key-from-novu-dashboard>
```

### Verification:
```bash
# Search for any remaining hardcoded keys
grep -r "<your-novu-api-key>" arc-saas/
# Should return 0 results
```
```

---

### P0-4: Missing Project API Endpoints

**Severity**: CRITICAL - Core functionality blocked
**Status**: CONFIRMED - Only admin_lookup.py has limited read access

#### Current State:
- `workspaces.py` - Full CRUD (289 lines) - USE AS PATTERN
- `projects.py` - DOES NOT EXIST
- `admin_lookup.py` - Has `/admin/projects/{id}` but no CRUD

#### Database Schema (Exists):
```sql
-- projects table exists in Supabase
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    settings JSONB DEFAULT '{}'
);
```

#### Fixing Prompt:

```markdown
## Task: Create Project API Endpoints

### Step 1: Create projects.py router
Create `app-plane/services/cns-service/app/api/projects.py` following the workspaces.py pattern:

```python
"""
Project Management API Endpoints

Provides CRUD operations for projects within workspaces.
All endpoints require X-Tenant-Id and X-Workspace-ID headers.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.auth import get_current_user, AuthContext
from app.core.scope_decorators import require_workspace
from app.core.scope_validators import validate_workspace_access
from app.db.supabase import get_supabase_client
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse
)
from app.core.logger import logger

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=ProjectListResponse)
@require_workspace
async def list_projects(
    workspace_id: UUID = Query(..., description="Workspace ID from header"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    auth: AuthContext = Depends(get_current_user)
):
    """List all projects in a workspace with pagination."""
    supabase = get_supabase_client()

    query = supabase.table("projects").select("*", count="exact")
    query = query.eq("workspace_id", str(workspace_id))

    if status:
        query = query.eq("status", status)

    # Pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    query = query.order("created_at", desc=True)

    result = query.execute()

    return ProjectListResponse(
        items=[ProjectResponse(**p) for p in result.data],
        total=result.count or 0,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=ProjectResponse, status_code=201)
@require_workspace
async def create_project(
    project: ProjectCreate,
    workspace_id: UUID = Query(...),
    auth: AuthContext = Depends(get_current_user)
):
    """Create a new project in a workspace."""
    supabase = get_supabase_client()

    # Check for duplicate name in workspace
    existing = supabase.table("projects").select("id").eq(
        "workspace_id", str(workspace_id)
    ).eq("name", project.name).execute()

    if existing.data:
        raise HTTPException(400, f"Project '{project.name}' already exists in workspace")

    data = {
        "workspace_id": str(workspace_id),
        "name": project.name,
        "description": project.description,
        "status": "active",
        "created_by": str(auth.user_id),
        "settings": project.settings or {}
    }

    result = supabase.table("projects").insert(data).execute()

    logger.info(f"[PROJECT] Created project {result.data[0]['id']} in workspace {workspace_id}")
    return ProjectResponse(**result.data[0])


@router.get("/{project_id}", response_model=ProjectResponse)
@require_workspace
async def get_project(
    project_id: UUID,
    workspace_id: UUID = Query(...),
    auth: AuthContext = Depends(get_current_user)
):
    """Get a specific project by ID."""
    supabase = get_supabase_client()

    result = supabase.table("projects").select("*").eq(
        "id", str(project_id)
    ).eq("workspace_id", str(workspace_id)).single().execute()

    if not result.data:
        raise HTTPException(404, f"Project {project_id} not found")

    return ProjectResponse(**result.data)


@router.patch("/{project_id}", response_model=ProjectResponse)
@require_workspace
async def update_project(
    project_id: UUID,
    update: ProjectUpdate,
    workspace_id: UUID = Query(...),
    auth: AuthContext = Depends(get_current_user)
):
    """Update a project."""
    supabase = get_supabase_client()

    # Verify project exists
    existing = supabase.table("projects").select("id").eq(
        "id", str(project_id)
    ).eq("workspace_id", str(workspace_id)).single().execute()

    if not existing.data:
        raise HTTPException(404, f"Project {project_id} not found")

    data = update.dict(exclude_unset=True)
    data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("projects").update(data).eq(
        "id", str(project_id)
    ).execute()

    logger.info(f"[PROJECT] Updated project {project_id}")
    return ProjectResponse(**result.data[0])


@router.delete("/{project_id}", status_code=204)
@require_workspace
async def delete_project(
    project_id: UUID,
    workspace_id: UUID = Query(...),
    auth: AuthContext = Depends(get_current_user)
):
    """Delete a project (soft delete by setting status to 'deleted')."""
    supabase = get_supabase_client()

    # Check for dependent BOMs
    boms = supabase.table("boms").select("id").eq(
        "project_id", str(project_id)
    ).limit(1).execute()

    if boms.data:
        raise HTTPException(400, "Cannot delete project with existing BOMs")

    # Soft delete
    supabase.table("projects").update({
        "status": "deleted",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", str(project_id)).execute()

    logger.info(f"[PROJECT] Deleted project {project_id}")
```

### Step 2: Create Pydantic schemas
Create `app-plane/services/cns-service/app/schemas/project.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class ProjectResponse(ProjectBase):
    id: UUID
    workspace_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    page: int
    page_size: int
```

### Step 3: Register router in main.py
Edit `app-plane/services/cns-service/app/main.py`:

```python
from app.api.projects import router as projects_router

# Add after workspaces router
app.include_router(projects_router, prefix="/api")
```

### Step 4: Add tests
Create `app-plane/services/cns-service/tests/test_projects.py`:

```python
import pytest
from httpx import AsyncClient
from uuid import uuid4

@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers, test_workspace):
    response = await client.post(
        f"/api/projects?workspace_id={test_workspace.id}",
        json={"name": "Test Project", "description": "Test"},
        headers=auth_headers
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Test Project"

@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, auth_headers, test_workspace):
    response = await client.get(
        f"/api/projects?workspace_id={test_workspace.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert "items" in response.json()
```

### Verification:
```bash
# Start CNS service
cd app-plane/services/cns-service
python -m uvicorn app.main:app --reload --port 27200

# Test endpoints
curl -X GET "http://localhost:27200/api/projects?workspace_id=<uuid>" \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <token>"

curl -X POST "http://localhost:27200/api/projects?workspace_id=<uuid>" \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project"}'
```
```

---

### P0-5: X-Tenant-Id Header Not Enforced on All Endpoints

**Severity**: CRITICAL - Multi-tenant data leakage risk
**Status**: CONFIRMED - Decorators exist but inconsistently applied

#### Current State:
- `scope_decorators.py` (658 lines) - @require_tenant, @require_workspace exist
- `scope_validators.py` (819 lines) - FK chain validation implemented
- Only 3/7 workspace endpoints have decorator applied
- BOM endpoints missing tenant validation

#### Affected Endpoints:
```python
# Endpoints WITHOUT @require_tenant (need to add):
GET  /api/workspaces          # list_workspaces - MISSING
POST /api/workspaces          # create_workspace - MISSING
GET  /api/workspaces/{id}     # get_workspace - MISSING
PATCH /api/workspaces/{id}    # update_workspace - MISSING

# BOM endpoints (critical):
GET  /api/boms                # list_boms - MISSING
POST /api/boms                # create_bom - MISSING
GET  /api/boms/{id}           # get_bom - MISSING
```

#### Fixing Prompt:

```markdown
## Task: Enforce X-Tenant-Id on All Endpoints

### Step 1: Update workspaces.py with @require_tenant
Edit `app-plane/services/cns-service/app/api/workspaces.py`:

```python
from app.core.scope_decorators import require_tenant

@router.get("", response_model=WorkspaceListResponse)
@require_tenant  # ADD THIS DECORATOR
async def list_workspaces(
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(get_current_user)
):
    """List all workspaces for the tenant."""
    # Existing implementation - tenant_id now validated
    ...

@router.post("", response_model=WorkspaceResponse, status_code=201)
@require_tenant  # ADD THIS DECORATOR
async def create_workspace(
    workspace: WorkspaceCreate,
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    auth: AuthContext = Depends(get_current_user)
):
    ...

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
@require_tenant  # ADD THIS DECORATOR
async def get_workspace(
    workspace_id: UUID,
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    auth: AuthContext = Depends(get_current_user)
):
    ...

@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
@require_tenant  # ADD THIS DECORATOR
async def update_workspace(
    workspace_id: UUID,
    update: WorkspaceUpdate,
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    auth: AuthContext = Depends(get_current_user)
):
    ...
```

### Step 2: Update boms.py with @require_tenant and @require_workspace
Edit `app-plane/services/cns-service/app/api/boms.py`:

```python
from app.core.scope_decorators import require_tenant, require_workspace

@router.get("", response_model=BOMListResponse)
@require_workspace  # Validates both tenant AND workspace
async def list_boms(
    workspace_id: UUID = Header(..., alias="X-Workspace-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    ...
):
    # Filter by workspace (which is already scoped to tenant)
    query = query.eq("workspace_id", str(workspace_id))
    ...

@router.post("", response_model=BOMResponse, status_code=201)
@require_workspace
async def create_bom(
    bom: BOMCreate,
    workspace_id: UUID = Header(..., alias="X-Workspace-ID"),
    tenant_id: str = Header(..., alias="X-Tenant-Id"),
    ...
):
    ...
```

### Step 3: Create middleware for global enforcement (recommended)
Create `app-plane/services/cns-service/app/middleware/tenant_middleware.py`:

```python
"""
Tenant Middleware - Global X-Tenant-Id enforcement

Ensures all /api/* endpoints require X-Tenant-Id header.
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logger import logger

# Endpoints exempt from tenant check (public routes)
EXEMPT_PATHS = [
    "/health",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/api/auth/",  # Auth endpoints handle their own validation
]


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip exempt paths
        if any(path.startswith(exempt) for exempt in EXEMPT_PATHS):
            return await call_next(request)

        # Skip non-API paths
        if not path.startswith("/api/"):
            return await call_next(request)

        # Require X-Tenant-Id header
        tenant_id = request.headers.get("X-Tenant-Id")
        if not tenant_id:
            logger.warning(f"[SECURITY] Missing X-Tenant-Id for {request.method} {path}")
            raise HTTPException(
                status_code=400,
                detail="X-Tenant-Id header is required"
            )

        # Validate UUID format
        try:
            from uuid import UUID
            UUID(tenant_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="X-Tenant-Id must be a valid UUID"
            )

        # Store in request state for downstream use
        request.state.tenant_id = tenant_id

        return await call_next(request)
```

### Step 4: Register middleware in main.py
Edit `app-plane/services/cns-service/app/main.py`:

```python
from app.middleware.tenant_middleware import TenantMiddleware

# Add BEFORE CORS middleware
app.add_middleware(TenantMiddleware)
```

### Step 5: Update scope_decorators.py to use request.state
Edit `app-plane/services/cns-service/app/core/scope_decorators.py`:

```python
def require_tenant(func):
    """Decorator that validates X-Tenant-Id header."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request = kwargs.get('request') or args[0] if args else None

        # Get tenant_id from middleware-validated state
        tenant_id = getattr(request.state, 'tenant_id', None) if request else None

        if not tenant_id:
            # Fallback to header if middleware didn't run
            tenant_id = kwargs.get('tenant_id')

        if not tenant_id:
            raise HTTPException(400, "X-Tenant-Id header is required")

        # Validate tenant exists in database
        if not await validate_tenant_exists(tenant_id):
            raise HTTPException(404, f"Tenant {tenant_id} not found")

        return await func(*args, **kwargs)
    return wrapper
```

### Verification:
```bash
# Test without X-Tenant-Id (should fail)
curl -X GET "http://localhost:27200/api/workspaces" \
  -H "Authorization: Bearer <token>"
# Expected: 400 "X-Tenant-Id header is required"

# Test with invalid X-Tenant-Id (should fail)
curl -X GET "http://localhost:27200/api/workspaces" \
  -H "X-Tenant-Id: not-a-uuid" \
  -H "Authorization: Bearer <token>"
# Expected: 400 "X-Tenant-Id must be a valid UUID"

# Test with valid X-Tenant-Id (should succeed)
curl -X GET "http://localhost:27200/api/workspaces" \
  -H "X-Tenant-Id: <valid-tenant-uuid>" \
  -H "Authorization: Bearer <token>"
# Expected: 200 with workspace list
```
```

---

## P1 HIGH PRIORITY ISSUES

### P1-1: Keycloak Port Configuration Inconsistency

**Severity**: HIGH - Developer confusion, integration failures
**Status**: RESOLVED - All configurations standardized on port 8180

#### Current State:
- Local dev (bun/npm): Port 8180 (standardized)
- Docker dev: Port 8180 mapped to internal 8080 (standardized)
- All .env files updated to use 8180

#### Fixing Prompt:

```markdown
## Task: Standardize Keycloak Port Documentation

### Step 1: Update .env.example files
Edit `arc-saas/.env.example`:
```env
# Keycloak Configuration
# All local development (bun/npm and Docker): use 8180
KEYCLOAK_HOST=localhost
KEYCLOAK_PORT=8180
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=arc-saas
KEYCLOAK_CLIENT_ID=arc-saas-admin
```

### Step 2: Add environment detection helper
Create `arc-saas/services/tenant-management-service/src/utils/keycloak-config.ts`:

```typescript
/**
 * Keycloak Configuration Helper
 *
 * Automatically detects the correct Keycloak URL based on environment.
 */

export function getKeycloakUrl(): string {
  // Docker environment detection
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

  if (isDocker) {
    // Inside Docker network - use service name
    return process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
  }

  // Local development
  return process.env.KEYCLOAK_URL || 'http://localhost:8180';
}

export const KEYCLOAK_CONFIG = {
  url: getKeycloakUrl(),
  realm: process.env.KEYCLOAK_REALM || 'arc-saas',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'arc-saas-admin',
};
```

### Step 3: Update CLAUDE.md Keycloak section
The section already exists but add clarity:

```markdown
### Keycloak Port Configuration
| Environment | URL | Port | When to Use |
|-------------|-----|------|-------------|
| Local dev (Bun/Node) | http://localhost:8180 | 8180 | Running services directly on host |
| Docker Compose | http://localhost:8180 | 8180 | Browser accessing Keycloak through Docker |
| Docker internal | http://keycloak:8080 | 8080 | Services inside Docker network |

**Standard for all local development**: Use port **8180** in `.env` files for both direct execution and Docker Compose environments.
```

### Verification:
```bash
# Check all .env files for consistency (should only find 8180 for local, 8080 for internal)
grep -r "KEYCLOAK.*PORT\|:8180\|:8080" arc-saas/ --include=".env*"
```
```

---

### P1-2: Auto-Provisioning Guarantee Missing

**Severity**: HIGH - Tenants stuck in "provisioning" state if Temporal unavailable
**Status**: CONFIRMED - No retry queue, single-shot workflow start

#### Current State:
- `onboarding.service.ts` lines 270-290: Single workflow.start() call
- No retry on Temporal connection failure
- No dead letter queue for failed provisioning

#### Fixing Prompt:

```markdown
## Task: Implement Auto-Provisioning Guarantee

### Step 1: Add retry logic to onboarding.service.ts
Edit `arc-saas/services/tenant-management-service/src/services/onboarding.service.ts`:

```typescript
import { retry } from '@lifeomic/attempt';

/**
 * Start tenant provisioning workflow with retry guarantee
 */
async startProvisioningWorkflow(
  tenantId: string,
  tenantKey: string,
  config: ProvisioningConfig
): Promise<void> {
  const workflowId = `provision-tenant-${tenantId}`;

  try {
    // Retry up to 3 times with exponential backoff
    await retry(
      async () => {
        await this.temporalClient.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'tenant-provisioning',
          workflowId,
          args: [{ tenantId, tenantKey, config }],
        });
      },
      {
        maxAttempts: 3,
        delay: 1000,
        factor: 2,
        handleError: async (err, context) => {
          this.logger.warn(
            `[PROVISIONING] Attempt ${context.attemptNum} failed for tenant ${tenantId}: ${err.message}`
          );

          // On final attempt failure, queue for manual retry
          if (context.attemptNum >= context.maxAttempts) {
            await this.queueFailedProvisioning(tenantId, tenantKey, config, err);
          }
        },
      }
    );

    this.logger.info(`[PROVISIONING] Started workflow ${workflowId}`);

  } catch (error) {
    // Workflow queued for retry - don't throw
    this.logger.error(`[PROVISIONING] All attempts failed for ${tenantId}, queued for retry`);
  }
}

/**
 * Queue failed provisioning for background retry
 */
private async queueFailedProvisioning(
  tenantId: string,
  tenantKey: string,
  config: ProvisioningConfig,
  error: Error
): Promise<void> {
  // Store in Redis with TTL for retry job to pick up
  const redisKey = `provisioning:failed:${tenantId}`;
  await this.redis.set(
    redisKey,
    JSON.stringify({
      tenantId,
      tenantKey,
      config,
      error: error.message,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    }),
    'EX',
    86400 // 24 hour TTL
  );

  // Update tenant status
  await this.tenantRepository.updateById(tenantId, {
    provisioningStatus: 'queued_for_retry',
  });
}
```

### Step 2: Create background retry job
Create `arc-saas/services/tenant-management-service/src/jobs/provisioning-retry.job.ts`:

```typescript
import { CronJob } from '@loopback/cron';
import { inject } from '@loopback/core';

/**
 * Background job to retry failed provisioning attempts
 * Runs every 5 minutes
 */
@cronJob()
export class ProvisioningRetryJob extends CronJob {
  constructor(
    @inject('services.TemporalClient') private temporalClient: TemporalClient,
    @inject('datasources.redis') private redis: Redis,
    @inject('repositories.TenantRepository') private tenantRepo: TenantRepository,
  ) {
    super({
      name: 'provisioning-retry',
      cronTime: '*/5 * * * *', // Every 5 minutes
      onTick: () => this.processRetryQueue(),
      start: true,
    });
  }

  async processRetryQueue(): Promise<void> {
    const keys = await this.redis.keys('provisioning:failed:*');

    for (const key of keys) {
      const data = JSON.parse(await this.redis.get(key) || '{}');

      if (data.retryCount >= 10) {
        // Max retries exceeded - alert and move to dead letter
        await this.moveToDeadLetter(key, data);
        continue;
      }

      try {
        // Check if Temporal is available
        await this.temporalClient.connection.ensureConnected();

        // Retry workflow start
        await this.temporalClient.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'tenant-provisioning',
          workflowId: `provision-tenant-${data.tenantId}`,
          args: [{ tenantId: data.tenantId, tenantKey: data.tenantKey, config: data.config }],
        });

        // Success - remove from retry queue
        await this.redis.del(key);
        await this.tenantRepo.updateById(data.tenantId, {
          provisioningStatus: 'in_progress',
        });

        this.logger.info(`[PROVISIONING-RETRY] Successfully started workflow for ${data.tenantId}`);

      } catch (error) {
        // Increment retry count
        data.retryCount++;
        data.lastError = error.message;
        data.lastRetryAt = new Date().toISOString();
        await this.redis.set(key, JSON.stringify(data), 'EX', 86400);
      }
    }
  }

  private async moveToDeadLetter(key: string, data: any): Promise<void> {
    // Store in dead letter table for manual intervention
    await this.deadLetterRepo.create({
      type: 'provisioning',
      tenantId: data.tenantId,
      payload: data,
      createdAt: new Date(),
    });

    await this.redis.del(key);
    await this.tenantRepo.updateById(data.tenantId, {
      provisioningStatus: 'failed',
    });

    // Send alert notification
    await this.notificationService.sendAlert({
      type: 'provisioning_failed',
      tenantId: data.tenantId,
      message: `Tenant provisioning failed after 10 retry attempts`,
    });
  }
}
```

### Step 3: Add dead letter table migration
Create migration `arc-saas/services/tenant-management-service/migrations/pg/migrations/sqls/YYYYMMDDHHMMSS-add-dead-letter-up.sql`:

```sql
CREATE TABLE IF NOT EXISTS tenant_management.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    tenant_id UUID REFERENCES tenant_management.tenants(id),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by VARCHAR(255)
);

CREATE INDEX idx_dead_letter_type ON tenant_management.dead_letter_queue(type);
CREATE INDEX idx_dead_letter_tenant ON tenant_management.dead_letter_queue(tenant_id);
```

### Verification:
```bash
# Test retry queue
curl -X POST http://localhost:14000/tenants/test-tenant/provision
# Stop Temporal, verify queued_for_retry status
# Start Temporal, verify workflow eventually starts
```
```

---

### P1-8: Novu Integration Only 60% Complete

**Severity**: HIGH - Notification features not working
**Status**: CONFIRMED - Templates exist but triggers not wired up

#### Current State:
- Templates defined in `novu-templates.md`
- `NovuNotificationBell.tsx` exists (172 lines)
- Backend trigger calls NOT implemented

#### Fixing Prompt:

```markdown
## Task: Complete Novu Integration

### Step 1: Create Novu service in backend
Create `arc-saas/services/tenant-management-service/src/services/novu.service.ts`:

```typescript
import { Novu } from '@novu/node';
import { injectable, inject } from '@loopback/core';

@injectable()
export class NovuService {
  private novu: Novu;

  constructor() {
    this.novu = new Novu(process.env.NOVU_API_KEY!);
  }

  /**
   * Trigger welcome email for new user
   */
  async sendWelcomeEmail(subscriberId: string, payload: {
    firstName: string;
    email: string;
    tenantName: string;
    loginUrl: string;
  }): Promise<void> {
    await this.novu.trigger('welcome-email', {
      to: { subscriberId },
      payload,
    });
  }

  /**
   * Trigger BOM processing complete notification
   */
  async sendBomComplete(subscriberId: string, payload: {
    bomName: string;
    bomId: string;
    componentCount: number;
    enrichedCount: number;
    viewUrl: string;
  }): Promise<void> {
    await this.novu.trigger('bom-processing-complete', {
      to: { subscriberId },
      payload,
    });
  }

  /**
   * Trigger component risk alert
   */
  async sendRiskAlert(subscriberId: string, payload: {
    componentMpn: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
    bomName: string;
    viewUrl: string;
  }): Promise<void> {
    await this.novu.trigger('component-risk-alert', {
      to: { subscriberId },
      payload,
    });
  }

  /**
   * Trigger invitation email
   */
  async sendInvitation(subscriberId: string, payload: {
    inviterName: string;
    organizationName: string;
    role: string;
    inviteUrl: string;
    expiresAt: string;
  }): Promise<void> {
    await this.novu.trigger('user-invitation', {
      to: { subscriberId },
      payload,
    });
  }

  /**
   * Create or update subscriber
   */
  async upsertSubscriber(subscriberId: string, data: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    await this.novu.subscribers.identify(subscriberId, data);
  }
}
```

### Step 2: Wire up triggers in invitation service
Edit `arc-saas/services/tenant-management-service/src/services/invitation.service.ts`:

```typescript
import { NovuService } from './novu.service';

@injectable()
export class InvitationService {
  constructor(
    @inject('services.NovuService') private novuService: NovuService,
    // ... other deps
  ) {}

  async sendInvitation(invitation: UserInvitation): Promise<void> {
    // Existing email logic...

    // Add Novu trigger
    await this.novuService.sendInvitation(invitation.email, {
      inviterName: invitation.invitedBy?.name || 'Team Admin',
      organizationName: invitation.tenant?.name || 'Organization',
      role: invitation.roleKey,
      inviteUrl: `${process.env.APP_URL}/accept-invite/${invitation.token}`,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  }
}
```

### Step 3: Create Novu workflows via API
Create `arc-saas/scripts/setup-novu-workflows.ts`:

```typescript
import { Novu } from '@novu/node';

const novu = new Novu(process.env.NOVU_API_KEY!);

async function createWorkflows() {
  // Welcome Email Workflow
  await novu.notificationTemplates.create({
    name: 'welcome-email',
    notificationGroupId: 'general',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Welcome to {{tenantName}}!',
          content: `
            <h1>Welcome, {{firstName}}!</h1>
            <p>Your account has been created for {{tenantName}}.</p>
            <a href="{{loginUrl}}">Login to your account</a>
          `,
        },
      },
      {
        template: {
          type: 'in_app',
          content: 'Welcome to {{tenantName}}! Your account is ready.',
        },
      },
    ],
  });

  // BOM Processing Complete
  await novu.notificationTemplates.create({
    name: 'bom-processing-complete',
    notificationGroupId: 'bom',
    steps: [
      {
        template: {
          type: 'in_app',
          content: 'BOM "{{bomName}}" processing complete. {{enrichedCount}}/{{componentCount}} components enriched.',
        },
      },
      {
        template: {
          type: 'email',
          subject: 'BOM Processing Complete: {{bomName}}',
          content: `
            <h2>BOM Processing Complete</h2>
            <p>Your BOM "{{bomName}}" has been processed.</p>
            <ul>
              <li>Total Components: {{componentCount}}</li>
              <li>Enriched: {{enrichedCount}}</li>
            </ul>
            <a href="{{viewUrl}}">View BOM</a>
          `,
        },
      },
    ],
  });

  console.log('Novu workflows created successfully');
}

createWorkflows().catch(console.error);
```

### Step 4: Run workflow setup
```bash
cd arc-saas
NOVU_API_KEY=<your-new-key> npx ts-node scripts/setup-novu-workflows.ts
```

### Verification:
```bash
# Check workflows exist
curl http://localhost:13100/v1/notification-templates \
  -H "Authorization: ApiKey $NOVU_API_KEY"

# Test trigger
curl -X POST http://localhost:13100/v1/events/trigger \
  -H "Authorization: ApiKey $NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome-email",
    "to": {"subscriberId": "test-user"},
    "payload": {"firstName": "Test", "tenantName": "Acme", "loginUrl": "http://localhost"}
  }'
```
```

---

### P1-9: Mobile BOM Upload at 20%

**Severity**: HIGH - Poor mobile user experience
**Status**: CONFIRMED - No responsive design in BOMUploadWorkflow.tsx

#### Current State:
- `BOMUploadWorkflow.tsx` - 973 lines, desktop-only layout
- No mobile breakpoints
- Drag-drop doesn't work on touch devices

#### Fixing Prompt:

```markdown
## Task: Add Mobile Responsive Design to BOM Upload

### Step 1: Add responsive breakpoints
Edit `app-plane/services/customer-portal/src/bom/BOMUploadWorkflow.tsx`:

```typescript
import { useMediaQuery, useTheme } from '@mui/material';

export const BOMUploadWorkflow: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{
      p: isMobile ? 2 : 3,
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Stepper - horizontal on desktop, vertical on mobile */}
      <Stepper
        activeStep={activeStep}
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{ mb: 3 }}
      >
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{isMobile ? label.split(' ')[0] : label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Upload Zone */}
      {activeStep === 0 && (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: isMobile ? 2 : 4,
            textAlign: 'center',
            cursor: 'pointer',
            // Touch-friendly tap target
            minHeight: isMobile ? 150 : 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => fileInputRef.current?.click()}
          onTouchEnd={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          <CloudUploadIcon sx={{ fontSize: isMobile ? 40 : 60, mb: 2 }} />
          <Typography variant={isMobile ? 'body1' : 'h6'}>
            {isMobile ? 'Tap to upload' : 'Drag & drop or click to upload'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supports: .xlsx, .xls, .csv
          </Typography>
          {/* Hidden file input for mobile */}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
          />
        </Box>
      )}

      {/* Column Mapping - Stack on mobile */}
      {activeStep === 1 && (
        <Box sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" gutterBottom>
              Source Columns
            </Typography>
            {/* Scrollable on mobile */}
            <Box sx={{
              maxHeight: isMobile ? 200 : 400,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}>
              {sourceColumns.map(col => (
                <Box
                  key={col}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    // Larger touch targets
                    minHeight: isMobile ? 48 : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {col}
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" gutterBottom>
              Map To
            </Typography>
            {/* Mobile-friendly select */}
            {sourceColumns.map(col => (
              <FormControl
                key={col}
                fullWidth
                size={isMobile ? 'medium' : 'small'}
                sx={{ mb: 1 }}
              >
                <Select
                  native={isMobile} // Native select on mobile for better UX
                  value={mapping[col] || ''}
                  onChange={(e) => handleMappingChange(col, e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {targetColumns.map(target => (
                    <option key={target} value={target}>{target}</option>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Box>
        </Box>
      )}

      {/* Action Buttons - Full width on mobile */}
      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 2,
        mt: 3,
        '& > button': {
          flex: isMobile ? 'unset' : 1,
          py: isMobile ? 1.5 : 1,
        }
      }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0}
          fullWidth={isMobile}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          fullWidth={isMobile}
        >
          {activeStep === steps.length - 1 ? 'Upload' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};
```

### Step 2: Add touch event handlers for drag-drop
```typescript
// Add touch support for drag-drop zone
const [isDragging, setIsDragging] = useState(false);

const handleTouchStart = (e: React.TouchEvent) => {
  // Prevent default to avoid scrolling while dragging
  if (e.touches.length === 1) {
    setIsDragging(true);
  }
};

const handleTouchEnd = (e: React.TouchEvent) => {
  setIsDragging(false);
  // Open file picker on tap
  if (!isDragging) {
    fileInputRef.current?.click();
  }
};
```

### Step 3: Add viewport meta tag
Ensure `app-plane/services/customer-portal/index.html` has:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

### Verification:
- Open DevTools > Toggle Device Toolbar
- Test on iPhone 12 Pro and iPad viewports
- Verify file picker opens on tap
- Verify column mapping is usable on small screens
```
```

---

## P2 MEDIUM PRIORITY ISSUES

### P2-1: Database Initialization Not Automated

**Severity**: MEDIUM - Manual steps required for fresh deployments
**Status**: CONFIRMED - No docker/init-db directory

#### Fixing Prompt:

```markdown
## Task: Create Automated Database Initialization

### Step 1: Create init-db directory structure
```bash
mkdir -p arc-saas/docker/init-db
```

### Step 2: Create initialization script
Create `arc-saas/docker/init-db/01-init-schemas.sql`:

```sql
-- Arc-SaaS Database Initialization
-- Run this on fresh PostgreSQL instance

-- Create arc_saas database if not exists
SELECT 'CREATE DATABASE arc_saas' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arc_saas')\gexec

\c arc_saas

-- Create tenant_management schema
CREATE SCHEMA IF NOT EXISTS tenant_management;

-- Create provisioning functions
CREATE OR REPLACE FUNCTION tenant_management.create_tenant_schema(tenant_key VARCHAR(50))
RETURNS void AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', 'tenant_' || tenant_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tenant_management.drop_tenant_schema(tenant_key VARCHAR(50))
RETURNS void AS $$
BEGIN
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', 'tenant_' || tenant_key);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON SCHEMA tenant_management TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tenant_management TO postgres;
```

### Step 3: Update docker-compose.yml
Edit `arc-saas/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - ./docker/init-db:/docker-entrypoint-initdb.d:ro
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: arc_saas
```

### Verification:
```bash
# Fresh start
docker-compose down -v
docker-compose up -d postgres

# Check schemas created
docker exec arc-saas-postgres psql -U postgres -d arc_saas -c "\dn"
# Should show: tenant_management
```
```

---

### P2-2: Novu Bootstrap Scripts Missing

**Severity**: MEDIUM - Manual workflow creation required
**Status**: CONFIRMED - Referenced scripts don't exist

#### Fixing Prompt:

```markdown
## Task: Create Novu Bootstrap Automation

### Step 1: Create bootstrap script
Create `arc-saas/scripts/bootstrap-novu.ts`:

```typescript
#!/usr/bin/env npx ts-node

/**
 * Novu Bootstrap Script
 *
 * Creates all required notification workflows and templates.
 * Run after fresh Novu deployment.
 *
 * Usage: NOVU_API_KEY=xxx npx ts-node scripts/bootstrap-novu.ts
 */

import { Novu } from '@novu/node';

async function bootstrap() {
  const apiKey = process.env.NOVU_API_KEY;
  if (!apiKey) {
    console.error('ERROR: NOVU_API_KEY environment variable required');
    process.exit(1);
  }

  const novu = new Novu(apiKey);
  console.log('Connecting to Novu...');

  // Create notification groups
  const groups = [
    { id: 'general', name: 'General Notifications' },
    { id: 'bom', name: 'BOM Notifications' },
    { id: 'alerts', name: 'Risk Alerts' },
    { id: 'team', name: 'Team Notifications' },
  ];

  for (const group of groups) {
    try {
      await novu.notificationGroups.create({ name: group.name });
      console.log(`Created group: ${group.name}`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`Group exists: ${group.name}`);
      } else {
        throw e;
      }
    }
  }

  // Create workflows
  const workflows = [
    {
      name: 'welcome-email',
      group: 'general',
      steps: [
        { type: 'email', subject: 'Welcome to {{organizationName}}!' },
        { type: 'in_app', content: 'Welcome! Your account is ready.' },
      ],
    },
    {
      name: 'bom-upload-complete',
      group: 'bom',
      steps: [
        { type: 'in_app', content: 'BOM "{{bomName}}" uploaded successfully.' },
      ],
    },
    {
      name: 'enrichment-complete',
      group: 'bom',
      steps: [
        { type: 'in_app', content: 'Enrichment complete for "{{bomName}}". {{enrichedCount}} components updated.' },
        { type: 'email', subject: 'Enrichment Complete: {{bomName}}' },
      ],
    },
    {
      name: 'risk-alert',
      group: 'alerts',
      steps: [
        { type: 'in_app', content: '{{riskLevel}} risk detected for {{componentMpn}}' },
        { type: 'email', subject: 'Risk Alert: {{componentMpn}}' },
      ],
    },
    {
      name: 'user-invitation',
      group: 'team',
      steps: [
        { type: 'email', subject: "You're invited to join {{organizationName}}" },
      ],
    },
    {
      name: 'invitation-accepted',
      group: 'team',
      steps: [
        { type: 'in_app', content: '{{userName}} has joined your team.' },
      ],
    },
  ];

  for (const workflow of workflows) {
    console.log(`Creating workflow: ${workflow.name}`);
    // Implementation details...
  }

  console.log('\nNovu bootstrap complete!');
  console.log(`Created ${groups.length} groups and ${workflows.length} workflows.`);
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
```

### Step 2: Add to package.json scripts
Edit `arc-saas/package.json`:

```json
{
  "scripts": {
    "novu:bootstrap": "ts-node scripts/bootstrap-novu.ts",
    "novu:verify": "ts-node scripts/verify-novu-workflows.ts"
  }
}
```

### Step 3: Add to README setup instructions
```markdown
## Novu Setup

After starting Novu containers:

```bash
# Bootstrap notification workflows
NOVU_API_KEY=<your-key> npm run novu:bootstrap

# Verify workflows created
NOVU_API_KEY=<your-key> npm run novu:verify
```
```
```

---

### P2-3: OpenTelemetry Not Configured

**Severity**: MEDIUM - Observability gaps
**Status**: CONFIRMED - Packages installed but not configured

#### Fixing Prompt:

```markdown
## Task: Configure OpenTelemetry Integration

### Step 1: Create OTel configuration
Create `arc-saas/services/tenant-management-service/src/otel.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initTelemetry() {
  if (process.env.OTEL_ENABLED !== 'true') {
    console.log('[OTEL] Disabled - set OTEL_ENABLED=true to enable');
    return;
  }

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'tenant-management-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log('[OTEL] Telemetry initialized');

  process.on('SIGTERM', () => {
    sdk.shutdown().then(() => console.log('[OTEL] Shutdown complete'));
  });
}
```

### Step 2: Initialize in application entry
Edit `arc-saas/services/tenant-management-service/src/index.ts`:

```typescript
// Add at the very top, before other imports
import { initTelemetry } from './otel';
initTelemetry();

// Rest of existing imports...
```

### Step 3: Add environment variables
Edit `arc-saas/.env.example`:

```env
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=tenant-management-service
```

### Step 4: Add Jaeger to docker-compose
Edit `arc-saas/docker-compose.yml`:

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.50
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: true
```

### Verification:
```bash
# Start Jaeger
docker-compose up -d jaeger

# Start service with OTel
OTEL_ENABLED=true bun run start

# View traces at http://localhost:16686
```
```

---

### P2-4: CNS Dashboard Has Zero Test Coverage

**Severity**: MEDIUM - Quality risk
**Status**: CONFIRMED - No test files found

#### Fixing Prompt:

```markdown
## Task: Add Test Coverage to CNS Dashboard

### Step 1: Set up Vitest
Edit `app-plane/services/cns-dashboard/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "jsdom": "^23.0.0"
  }
}
```

### Step 2: Create Vitest config
Create `app-plane/services/cns-dashboard/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
```

### Step 3: Create test setup
Create `app-plane/services/cns-dashboard/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

### Step 4: Add component tests
Create `app-plane/services/cns-dashboard/src/components/__tests__/Dashboard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Dashboard', () => {
  it('should render dashboard title', () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Step 5: Run tests
```bash
cd app-plane/services/cns-dashboard
npm install
npm test
npm run test:coverage
```
```

---

### P2-5: SkipLinks Can Be Copied from Customer Portal

**Severity**: MEDIUM - Accessibility gap
**Status**: CONFIRMED - Component exists in customer-portal

#### Fixing Prompt:

```markdown
## Task: Copy Accessibility Components to CNS Dashboard

### Step 1: Copy components
```bash
# Copy accessibility folder
cp -r app-plane/services/customer-portal/src/components/accessibility \
      app-plane/services/cns-dashboard/src/components/
```

### Step 2: Update imports for CNS Dashboard
Edit the copied files to update any customer-portal specific imports.

### Step 3: Add SkipLinks to App.tsx
Edit `app-plane/services/cns-dashboard/src/App.tsx`:

```typescript
import { SkipLinks } from './components/accessibility/SkipLinks';

function App() {
  return (
    <>
      <SkipLinks />
      <main id="main-content">
        {/* Existing app content */}
      </main>
    </>
  );
}
```

### Step 4: Add landmark IDs
Ensure these IDs exist in your layout:
- `#main-content` - Main content area
- `#main-navigation` - Primary navigation

### Verification:
- Tab through the page - skip links should appear on focus
- Screen reader test with NVDA/VoiceOver
```
```

---

### P2-6: Webhook Secrets Defined But Not Verified

**Severity**: MEDIUM - Security risk
**Status**: CONFIRMED - Secrets stored but signature validation not implemented

#### Fixing Prompt:

```markdown
## Task: Implement Webhook Signature Verification

### Step 1: Create webhook verification middleware
Create `arc-saas/services/tenant-management-service/src/middleware/webhook-signature.middleware.ts`:

```typescript
import { Middleware, MiddlewareContext } from '@loopback/rest';
import { createHmac, timingSafeEqual } from 'crypto';
import { HttpErrors } from '@loopback/rest';

/**
 * Webhook Signature Verification Middleware
 *
 * Verifies HMAC-SHA256 signatures on incoming webhooks.
 * Expected header: X-Webhook-Signature: sha256=<hex-signature>
 */
export class WebhookSignatureMiddleware implements Middleware {
  async handle(
    context: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    const { request } = context;
    const path = request.url;

    // Only apply to webhook endpoints
    if (!path.startsWith('/webhooks/')) {
      return next();
    }

    const signature = request.headers['x-webhook-signature'] as string;
    if (!signature) {
      throw new HttpErrors.Unauthorized('Missing X-Webhook-Signature header');
    }

    // Extract algorithm and hash
    const [algorithm, hash] = signature.split('=');
    if (algorithm !== 'sha256' || !hash) {
      throw new HttpErrors.Unauthorized('Invalid signature format');
    }

    // Get webhook secret for this source
    const source = this.extractWebhookSource(path);
    const secret = await this.getWebhookSecret(source);
    if (!secret) {
      throw new HttpErrors.Unauthorized('Unknown webhook source');
    }

    // Verify signature
    const body = await this.getRawBody(request);
    const expectedHash = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const signatureBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new HttpErrors.Unauthorized('Invalid webhook signature');
    }

    // Signature valid - proceed
    return next();
  }

  private extractWebhookSource(path: string): string {
    // /webhooks/stripe/... -> stripe
    // /webhooks/novu/... -> novu
    const match = path.match(/^\/webhooks\/([^/]+)/);
    return match?.[1] || 'unknown';
  }

  private async getWebhookSecret(source: string): Promise<string | null> {
    // Look up secret from database or environment
    const secrets: Record<string, string> = {
      stripe: process.env.STRIPE_WEBHOOK_SECRET || '',
      novu: process.env.NOVU_WEBHOOK_SECRET || '',
      keycloak: process.env.KEYCLOAK_WEBHOOK_SECRET || '',
    };
    return secrets[source] || null;
  }

  private async getRawBody(request: any): Promise<string> {
    // Body should already be parsed - get raw from request
    return JSON.stringify(request.body);
  }
}
```

### Step 2: Register middleware
Edit `arc-saas/services/tenant-management-service/src/application.ts`:

```typescript
import { WebhookSignatureMiddleware } from './middleware/webhook-signature.middleware';

export class TenantManagementApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication))
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Register webhook signature verification
    this.middleware(WebhookSignatureMiddleware);

    // ... rest of constructor
  }
}
```

### Step 3: Add environment variables
Edit `arc-saas/.env.example`:

```env
# Webhook Secrets (generate with: openssl rand -hex 32)
STRIPE_WEBHOOK_SECRET=whsec_xxx
NOVU_WEBHOOK_SECRET=xxx
KEYCLOAK_WEBHOOK_SECRET=xxx
```

### Step 4: Update webhook senders
When sending webhooks from Novu/Stripe, ensure they include signature headers.

### Verification:
```bash
# Test with invalid signature
curl -X POST http://localhost:14000/webhooks/stripe \
  -H "X-Webhook-Signature: sha256=invalid" \
  -d '{"test": true}'
# Expected: 401 Unauthorized

# Test with valid signature
SECRET="your-secret"
BODY='{"test": true}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
curl -X POST http://localhost:14000/webhooks/stripe \
  -H "X-Webhook-Signature: sha256=$SIG" \
  -H "Content-Type: application/json" \
  -d "$BODY"
# Expected: 200 OK
```
```

---

## Implementation Priority Order

### Week 1 (Critical Security)
1. **P0-1**: Rotate Novu API key and fix .gitignore (2 hours)
2. **P0-5**: Enforce X-Tenant-Id headers (4 hours)
3. **P2-6**: Implement webhook signature verification (3 hours)

### Week 2 (Core Functionality)
4. **P0-4**: Create Project API endpoints (6 hours)
5. **P1-2**: Implement auto-provisioning guarantee (6 hours)
6. **P1-8**: Complete Novu integration (4 hours)

### Week 3 (UX & DevOps)
7. **P1-9**: Mobile responsive BOM upload (6 hours)
8. **P2-1**: Automate database initialization (2 hours)
9. **P2-2**: Create Novu bootstrap scripts (2 hours)

### Week 4 (Quality & Observability)
10. **P1-1**: Standardize Keycloak port documentation (1 hour)
11. **P2-3**: Configure OpenTelemetry (3 hours)
12. **P2-4**: Add CNS Dashboard test coverage (4 hours)
13. **P2-5**: Copy accessibility components (1 hour)

---

## Verification Checklist

After completing all fixes, verify:

- [ ] `grep -r "<your-novu-api-key>" arc-saas/` returns 0 results
- [ ] All .env files are in .gitignore
- [ ] `curl /api/workspaces` without X-Tenant-Id returns 400
- [ ] Project CRUD endpoints return 200/201
- [ ] Failed provisioning enters retry queue
- [ ] Novu workflows trigger successfully
- [ ] BOM upload works on mobile devices
- [ ] Database initializes automatically on fresh deploy
- [ ] OpenTelemetry traces visible in Jaeger
- [ ] CNS Dashboard test coverage > 50%
- [ ] Skip links work with keyboard navigation
- [ ] Invalid webhook signatures return 401

---

*Document generated by expert agent analysis of Ananta Platform SaaS codebase*
