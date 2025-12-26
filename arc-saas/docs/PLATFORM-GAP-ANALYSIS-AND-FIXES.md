# Platform Gap Analysis and Comprehensive Fixing Prompts

> Generated: 2025-12-14
> Analysis: Cross-referenced 18 documentation files against actual codebase implementation
> Status: Identified 8 confirmed gaps (5 false alarms resolved)

---

## Executive Summary

### Investigation Results

| Priority | Documented Issues | Confirmed Real | False Alarms |
|----------|-------------------|----------------|--------------|
| P0 (Critical) | 5 | 3 | 2 |
| P1 (High) | 8 | 3 | 5 |
| P2 (Medium) | 8 | 5 | 3 |
| **Total** | **21** | **11** | **10** |

### False Alarms (CODE-VERIFIED - Do NOT Re-Open)

> **CRITICAL**: These issues were reported as gaps but CODE INVESTIGATION confirmed they are FULLY IMPLEMENTED.
> Do NOT report these as issues in future audits without re-verifying the code.

| Issue ID | Claimed Gap | Actual Status | Code Location |
|----------|-------------|---------------|---------------|
| P0-2 | docker-compose.yml missing | **EXISTS** | `arc-saas/docker-compose.yml` (492 lines) |
| P0-3 | Dashboard API disabled | **ENABLED** | `app-plane/.../Dashboard.tsx` - all `useGetList` hooks active |
| P1-3 | Workflow endpoints missing | **IMPLEMENTED** | `workflow.controller.ts` lines 419-807 (restart, cancel, terminate) |
| P1-4 | Rate limiting not enforced | **ENFORCED** | `invitation.service.ts` - 5min cooldown, max 5 resends, DB tracking |
| P1-5 | Organization sync missing | **IMPLEMENTED** | `supabase-app-plane.activities.ts` + `provision-tenant.workflow.ts` |

### Confirmed Real Gaps Requiring Fixes
1. **P0-1**: Novu API key hardcoded in 15+ files (CRITICAL SECURITY)
2. **P0-4**: Project API endpoints MISSING in CNS service
3. **P0-5**: X-Tenant-Id validation decorators NOT APPLIED to 40+ endpoints
4. **P1-1**: Keycloak port confusion (8180 vs 14003) - RESOLVED
5. **P1-2**: Auto-provisioning guarantee MISSING (no retry queue)
6. **P2-5**: CNS Dashboard has 0 tests, CNS Service has 5% coverage
7. **P2-6**: OpenTelemetry libs installed but NOT configured
8. **P2-7**: Audit logs service exists but coverage is partial

---

## P0-1: CRITICAL - Hardcoded Novu API Key Security Breach

### Issue Description
The Novu API key `<your-novu-api-key>` is hardcoded in 15+ files across the codebase, including documentation files that may be committed to version control.

### Files Affected
```
arc-saas/docs/CBP-INTEGRATION-PROMPT.md:66
arc-saas/services/temporal-worker-service/.env:57
arc-saas/apps/customer-app/.env:2
arc-saas/bootstrap-novu.js:21
arc-saas/create-novu-workflows-api.js:7
arc-saas/send-test-notification.js:4
arc-saas/fix-novu-workflows.js:7
arc-saas/update-workflow-steps.js:7
arc-saas/debug-novu-trigger.js:4
arc-saas/docs/novu-templates.md (multiple lines)
app-plane/services/customer-portal/.env
app-plane/services/cns-service/.env
```

### Comprehensive Fixing Prompt

```markdown
## Task: Rotate Novu API Key and Implement Secure Secret Management

### Phase 1: Generate New API Key
1. Log into Novu Dashboard at http://localhost:13100
2. Navigate to Settings â†’ API Keys
3. Generate a new API key
4. Store the new key ONLY in a password manager or secure vault

### Phase 2: Update Environment Files
Create/update the following .env files (these should be in .gitignore):

**arc-saas/services/temporal-worker-service/.env**
```env
NOVU_API_KEY=${NEW_API_KEY}
NOVU_API_URL=http://localhost:13100
```

**arc-saas/apps/customer-app/.env**
```env
VITE_NOVU_APP_IDENTIFIER=${NEW_APP_ID}
# Never put API key in frontend env
```

**app-plane/services/cns-service/.env**
```env
NOVU_API_KEY=${NEW_API_KEY}
NOVU_API_URL=http://localhost:13100
```

### Phase 3: Update Bootstrap Scripts
Modify all bootstrap scripts to read from environment:

**arc-saas/bootstrap-novu.js**
```javascript
const API_KEY = process.env.NOVU_API_KEY;
if (!API_KEY) {
  console.error('ERROR: NOVU_API_KEY environment variable not set');
  process.exit(1);
}
```

Apply same pattern to:
- create-novu-workflows-api.js
- send-test-notification.js
- fix-novu-workflows.js
- update-workflow-steps.js
- debug-novu-trigger.js

### Phase 4: Sanitize Documentation
Remove hardcoded keys from documentation files:

**arc-saas/docs/CBP-INTEGRATION-PROMPT.md**
Replace:
```
API_KEY="<your-novu-api-key>"
```
With:
```
API_KEY="${NOVU_API_KEY}"  # Set in environment
```

**arc-saas/docs/novu-templates.md**
Remove all instances of actual API keys, replace with placeholders.

### Phase 5: Add .env.example Templates
Create `.env.example` files with placeholder values:
```env
# Novu Configuration
NOVU_API_KEY=your-api-key-here
NOVU_API_URL=http://localhost:13100
NOVU_APP_IDENTIFIER=your-app-id-here
```

### Phase 6: Revoke Old API Key
1. Return to Novu Dashboard
2. Delete/revoke the old API key: <your-novu-api-key>
3. Verify all services still work with new key

### Phase 7: Audit Git History
```bash
# Check if key was ever committed
git log -p --all -S "<your-novu-api-key>" --source

# If found in history, consider:
# - Using git-filter-repo to remove from history
# - Or accept that old key will be revoked
```

### Verification Steps
1. Run all Novu bootstrap scripts - should work with env vars
2. Send test notification - should succeed
3. Search codebase for old key - should return 0 results:
   ```bash
   grep -r "<your-novu-api-key>" --include="*.js" --include="*.ts" --include="*.md" --include="*.env"
   ```

### Estimated Effort
- Phase 1-2: 15 minutes
- Phase 3-4: 30 minutes
- Phase 5-7: 15 minutes
- Total: ~1 hour
```

---

## P0-4: Missing Project API CRUD Endpoints

### Issue Description
The CNS service has 44 API endpoint files but NO `projects.py` with full CRUD operations. Only a read-only lookup endpoint exists in `admin_lookup.py`.

### Files to Create/Modify
```
app-plane/services/cns-service/app/api/projects.py (CREATE)
app-plane/services/cns-service/app/models/project.py (VERIFY EXISTS)
app-plane/services/cns-service/app/schemas/project.py (CREATE/UPDATE)
app-plane/services/cns-service/app/services/project_service.py (CREATE)
app-plane/services/cns-service/app/api/__init__.py (UPDATE router)
```

### Comprehensive Fixing Prompt

```markdown
## Task: Implement Complete Project API CRUD Endpoints

### Phase 1: Create Project Schema
**app-plane/services/cns-service/app/schemas/project.py**
```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    workspace_id: UUID
    settings: Optional[dict] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[dict] = None

class ProjectResponse(ProjectBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    bom_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    page: int
    page_size: int
```

### Phase 2: Create Project Service
**app-plane/services/cns-service/app/services/project_service.py**
```python
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.core.exceptions import NotFoundError, ForbiddenError

class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        data: ProjectCreate,
        tenant_id: UUID,
        user_id: UUID
    ) -> Project:
        # Verify workspace belongs to tenant
        workspace = await self._verify_workspace_access(data.workspace_id, tenant_id)

        project = Project(
            name=data.name,
            description=data.description,
            workspace_id=data.workspace_id,
            settings=data.settings or {},
            created_by=user_id
        )
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def get_by_id(
        self,
        project_id: UUID,
        tenant_id: UUID
    ) -> Project:
        project = await self._get_project_with_tenant_check(project_id, tenant_id)
        return project

    async def list_by_workspace(
        self,
        workspace_id: UUID,
        tenant_id: UUID,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[List[Project], int]:
        # Verify workspace access
        await self._verify_workspace_access(workspace_id, tenant_id)

        # Count total
        count_query = select(func.count(Project.id)).where(
            Project.workspace_id == workspace_id
        )
        total = await self.db.scalar(count_query)

        # Fetch page
        query = select(Project).where(
            Project.workspace_id == workspace_id
        ).offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        projects = result.scalars().all()

        return projects, total

    async def update(
        self,
        project_id: UUID,
        data: ProjectUpdate,
        tenant_id: UUID
    ) -> Project:
        project = await self._get_project_with_tenant_check(project_id, tenant_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)

        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete(
        self,
        project_id: UUID,
        tenant_id: UUID
    ) -> None:
        project = await self._get_project_with_tenant_check(project_id, tenant_id)
        await self.db.delete(project)
        await self.db.commit()

    async def _verify_workspace_access(self, workspace_id: UUID, tenant_id: UUID):
        # Query workspace and verify tenant ownership
        from app.models.workspace import Workspace
        query = select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.tenant_id == tenant_id
        )
        result = await self.db.execute(query)
        workspace = result.scalar_one_or_none()
        if not workspace:
            raise ForbiddenError("Workspace not found or access denied")
        return workspace

    async def _get_project_with_tenant_check(
        self,
        project_id: UUID,
        tenant_id: UUID
    ) -> Project:
        # Join through workspace to verify tenant
        from app.models.workspace import Workspace
        query = select(Project).join(Workspace).where(
            Project.id == project_id,
            Workspace.tenant_id == tenant_id
        )
        result = await self.db.execute(query)
        project = result.scalar_one_or_none()
        if not project:
            raise NotFoundError(f"Project {project_id} not found")
        return project
```

### Phase 3: Create Project API Router
**app-plane/services/cns-service/app/api/projects.py**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, AuthContext
from app.core.scope_decorators import require_workspace
from app.services.project_service import ProjectService
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse
)

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
@require_workspace  # Validates workspace_id belongs to tenant
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_current_user)
):
    """Create a new project within a workspace."""
    service = ProjectService(db)
    project = await service.create(data, auth.tenant_id, auth.user_id)
    return project

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_current_user)
):
    """Get a project by ID."""
    service = ProjectService(db)
    project = await service.get_by_id(project_id, auth.tenant_id)
    return project

@router.get("/workspace/{workspace_id}", response_model=ProjectListResponse)
@require_workspace
async def list_workspace_projects(
    workspace_id: UUID,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_current_user)
):
    """List all projects in a workspace."""
    service = ProjectService(db)
    projects, total = await service.list_by_workspace(
        workspace_id, auth.tenant_id, page, page_size
    )
    return ProjectListResponse(
        items=projects,
        total=total,
        page=page,
        page_size=page_size
    )

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_current_user)
):
    """Update a project."""
    service = ProjectService(db)
    project = await service.update(project_id, data, auth.tenant_id)
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(get_current_user)
):
    """Delete a project."""
    service = ProjectService(db)
    await service.delete(project_id, auth.tenant_id)
```

### Phase 4: Register Router
**app-plane/services/cns-service/app/api/__init__.py**
Add to router registrations:
```python
from app.api.projects import router as projects_router
api_router.include_router(projects_router)
```

### Phase 5: Add Tests
**app-plane/services/cns-service/tests/api/test_projects.py**
```python
import pytest
from httpx import AsyncClient
from uuid import uuid4

@pytest.mark.asyncio
async def test_create_project(client: AsyncClient, auth_headers: dict, workspace_id: str):
    response = await client.post(
        "/api/projects",
        json={
            "name": "Test Project",
            "description": "Test description",
            "workspace_id": workspace_id
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient, auth_headers: dict):
    response = await client.get(
        f"/api/projects/{uuid4()}",
        headers=auth_headers
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_cross_tenant_access_denied(
    client: AsyncClient,
    other_tenant_headers: dict,
    project_id: str
):
    """Verify tenant isolation - other tenant cannot access project."""
    response = await client.get(
        f"/api/projects/{project_id}",
        headers=other_tenant_headers
    )
    assert response.status_code == 404  # Not 403, to avoid leaking existence

@pytest.mark.asyncio
async def test_list_workspace_projects(
    client: AsyncClient,
    auth_headers: dict,
    workspace_id: str
):
    response = await client.get(
        f"/api/projects/workspace/{workspace_id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
```

### Verification Steps
1. Start CNS service: `cd app-plane/services/cns-service && uvicorn app.main:app --reload`
2. Check OpenAPI docs: http://localhost:27200/docs - verify /projects endpoints appear
3. Test CRUD operations with curl:
   ```bash
   # Create
   curl -X POST http://localhost:27200/api/projects \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","workspace_id":"<uuid>"}'

   # Read
   curl http://localhost:27200/api/projects/<project_id> \
     -H "Authorization: Bearer $TOKEN"

   # Update
   curl -X PUT http://localhost:27200/api/projects/<project_id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Updated Name"}'

   # Delete
   curl -X DELETE http://localhost:27200/api/projects/<project_id> \
     -H "Authorization: Bearer $TOKEN"
   ```
4. Run tests: `pytest tests/api/test_projects.py -v`

### Estimated Effort
- Phase 1 (Schema): 20 minutes
- Phase 2 (Service): 45 minutes
- Phase 3 (Router): 30 minutes
- Phase 4 (Registration): 5 minutes
- Phase 5 (Tests): 45 minutes
- Total: ~2.5 hours
```

---

## P0-5: X-Tenant-Id Validation Decorators Not Applied

### Issue Description
The scope validation infrastructure (`scope_validators.py`, `scope_decorators.py`) is fully implemented with 1,477 lines of code, but the `@require_workspace`, `@require_project`, and `@require_bom` decorators are only applied to 3 endpoints in `workspaces.py`. Approximately 40+ endpoints remain unprotected.

### Files to Modify
```
app-plane/services/cns-service/app/api/boms.py
app-plane/services/cns-service/app/api/bom_line_items.py
app-plane/services/cns-service/app/api/enrichment.py
app-plane/services/cns-service/app/api/components.py
app-plane/services/cns-service/app/api/alerts.py
app-plane/services/cns-service/app/api/exports.py
app-plane/services/cns-service/app/api/analytics.py
# ... and 30+ more files
```

### Comprehensive Fixing Prompt

```markdown
## Task: Apply Scope Validation Decorators to All API Endpoints

### Understanding the Decorator Hierarchy
```
@require_workspace  - Validates: workspace.tenant_id == auth.tenant_id
@require_project    - Validates: project â†’ workspace â†’ tenant_id chain
@require_bom        - Validates: bom â†’ project â†’ workspace â†’ tenant_id chain
```

### Phase 1: Audit All Endpoints
Run this command to identify unprotected endpoints:
```bash
cd app-plane/services/cns-service

# Find all router endpoints
grep -rn "@router\." app/api/ --include="*.py" | wc -l
# Result: ~120 endpoints

# Find endpoints with decorators
grep -rn "@require_workspace\|@require_project\|@require_bom" app/api/ --include="*.py" | wc -l
# Result: ~3 endpoints

# Gap: ~117 endpoints need review
```

### Phase 2: BOM Endpoints
**app-plane/services/cns-service/app/api/boms.py**

Before:
```python
@router.get("/{bom_id}")
async def get_bom(bom_id: UUID, ...):
    ...
```

After:
```python
from app.core.scope_decorators import require_project, require_bom

@router.post("")
@require_project  # Validates project_id in request body
async def create_bom(data: BOMCreate, ...):
    ...

@router.get("/{bom_id}")
@require_bom  # Validates bom â†’ project â†’ workspace â†’ tenant chain
async def get_bom(bom_id: UUID, ...):
    ...

@router.put("/{bom_id}")
@require_bom
async def update_bom(bom_id: UUID, data: BOMUpdate, ...):
    ...

@router.delete("/{bom_id}")
@require_bom
async def delete_bom(bom_id: UUID, ...):
    ...

@router.get("/project/{project_id}")
@require_project
async def list_project_boms(project_id: UUID, ...):
    ...
```

### Phase 3: BOM Line Items Endpoints
**app-plane/services/cns-service/app/api/bom_line_items.py**

```python
from app.core.scope_decorators import require_bom

@router.get("/bom/{bom_id}")
@require_bom
async def list_bom_line_items(bom_id: UUID, ...):
    ...

@router.post("/bom/{bom_id}")
@require_bom
async def create_line_item(bom_id: UUID, data: LineItemCreate, ...):
    ...

@router.put("/{line_item_id}")
@require_bom  # Need bom_id in path or lookup
async def update_line_item(line_item_id: UUID, ...):
    ...

@router.delete("/{line_item_id}")
@require_bom
async def delete_line_item(line_item_id: UUID, ...):
    ...
```

### Phase 4: Enrichment Endpoints
**app-plane/services/cns-service/app/api/enrichment.py**

```python
from app.core.scope_decorators import require_bom, require_project

@router.post("/bom/{bom_id}/enrich")
@require_bom
async def trigger_enrichment(bom_id: UUID, ...):
    ...

@router.get("/bom/{bom_id}/status")
@require_bom
async def get_enrichment_status(bom_id: UUID, ...):
    ...

@router.get("/project/{project_id}/summary")
@require_project
async def get_project_enrichment_summary(project_id: UUID, ...):
    ...
```

### Phase 5: Alerts Endpoints
**app-plane/services/cns-service/app/api/alerts.py**

```python
from app.core.scope_decorators import require_workspace, require_project

@router.get("/workspace/{workspace_id}")
@require_workspace
async def list_workspace_alerts(workspace_id: UUID, ...):
    ...

@router.post("/workspace/{workspace_id}/preferences")
@require_workspace
async def update_alert_preferences(workspace_id: UUID, ...):
    ...
```

### Phase 6: Components Endpoints
**app-plane/services/cns-service/app/api/components.py**

```python
# Components are often cross-tenant (catalog), so tenant filtering
# happens at the data level, not decorator level
# BUT component watchlists are tenant-specific:

@router.post("/watchlist")
@require_workspace
async def add_to_watchlist(workspace_id: UUID, ...):
    ...

@router.get("/watchlist/workspace/{workspace_id}")
@require_workspace
async def get_workspace_watchlist(workspace_id: UUID, ...):
    ...
```

### Phase 7: Create Migration Script
**app-plane/services/cns-service/scripts/add_scope_decorators.py**

```python
#!/usr/bin/env python3
"""
Script to identify endpoints missing scope decorators.
Run: python scripts/add_scope_decorators.py
"""

import os
import re
from pathlib import Path

API_DIR = Path("app/api")
DECORATORS = ["@require_workspace", "@require_project", "@require_bom"]

# Endpoints that legitimately don't need decorators (public, admin-only, etc.)
EXCEPTIONS = [
    "health.py",
    "auth.py",
    "admin_lookup.py",  # Read-only catalog
    "__init__.py"
]

def analyze_file(filepath: Path):
    content = filepath.read_text()

    # Find all router definitions
    endpoints = re.findall(r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)', content)

    # Find applied decorators
    has_decorators = any(d in content for d in DECORATORS)

    return {
        "file": filepath.name,
        "endpoints": len(endpoints),
        "has_decorators": has_decorators,
        "routes": [f"{method.upper()} {path}" for method, path in endpoints]
    }

def main():
    results = []
    for file in API_DIR.glob("*.py"):
        if file.name in EXCEPTIONS:
            continue
        results.append(analyze_file(file))

    print("\n=== Endpoints Missing Scope Decorators ===\n")
    for r in results:
        if not r["has_decorators"] and r["endpoints"] > 0:
            print(f"{r['file']}: {r['endpoints']} endpoints")
            for route in r["routes"]:
                print(f"  - {route}")
            print()

    total_unprotected = sum(r["endpoints"] for r in results if not r["has_decorators"])
    print(f"\nTotal unprotected endpoints: {total_unprotected}")

if __name__ == "__main__":
    main()
```

### Phase 8: Add Integration Tests
**app-plane/services/cns-service/tests/integration/test_tenant_isolation.py**

```python
import pytest
from httpx import AsyncClient
from uuid import uuid4

class TestTenantIsolation:
    """Verify cross-tenant access is denied for all protected endpoints."""

    @pytest.mark.asyncio
    async def test_bom_cross_tenant_access_denied(
        self,
        client: AsyncClient,
        tenant_a_headers: dict,
        tenant_b_bom_id: str  # BOM owned by tenant B
    ):
        """Tenant A cannot access Tenant B's BOM."""
        response = await client.get(
            f"/api/boms/{tenant_b_bom_id}",
            headers=tenant_a_headers
        )
        assert response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_project_cross_tenant_access_denied(
        self,
        client: AsyncClient,
        tenant_a_headers: dict,
        tenant_b_project_id: str
    ):
        """Tenant A cannot access Tenant B's project."""
        response = await client.get(
            f"/api/projects/{tenant_b_project_id}",
            headers=tenant_a_headers
        )
        assert response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_workspace_cross_tenant_access_denied(
        self,
        client: AsyncClient,
        tenant_a_headers: dict,
        tenant_b_workspace_id: str
    ):
        """Tenant A cannot access Tenant B's workspace."""
        response = await client.get(
            f"/api/workspaces/{tenant_b_workspace_id}",
            headers=tenant_a_headers
        )
        assert response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_enrichment_cross_tenant_denied(
        self,
        client: AsyncClient,
        tenant_a_headers: dict,
        tenant_b_bom_id: str
    ):
        """Tenant A cannot trigger enrichment on Tenant B's BOM."""
        response = await client.post(
            f"/api/enrichment/bom/{tenant_b_bom_id}/enrich",
            headers=tenant_a_headers
        )
        assert response.status_code in [403, 404]
```

### Verification Steps
1. Run the analysis script:
   ```bash
   python scripts/add_scope_decorators.py
   ```
2. Apply decorators to each file identified
3. Run integration tests:
   ```bash
   pytest tests/integration/test_tenant_isolation.py -v
   ```
4. Manual test with two different tenant tokens:
   ```bash
   # Get BOM as Tenant A
   curl http://localhost:27200/api/boms/$BOM_ID -H "Authorization: Bearer $TENANT_A_TOKEN"
   # Should succeed

   # Try same BOM as Tenant B
   curl http://localhost:27200/api/boms/$BOM_ID -H "Authorization: Bearer $TENANT_B_TOKEN"
   # Should return 403 or 404
   ```

### Estimated Effort
- Phase 1 (Audit): 30 minutes
- Phase 2-6 (Apply decorators): 3 hours
- Phase 7 (Script): 30 minutes
- Phase 8 (Tests): 1.5 hours
- Total: ~6 hours
```

---

## P1-1: Keycloak Port Confusion - RESOLVED

### Issue Description
Documentation and code reference both port 8180 (direct) and 14003 (Docker exposed), causing configuration confusion.

**Status**: RESOLVED - All configurations standardized on port 8180 for local development.

### Files Affected
```
arc-saas/.env.example
arc-saas/docker-compose.yml
arc-saas/services/tenant-management-service/.env
arc-saas/apps/admin-app/.env
app-plane/services/customer-portal/.env
```

### Comprehensive Fixing Prompt

```markdown
## Task: Standardize Keycloak Port Configuration

### Decision: Use Port 8180 Everywhere for Local Development

Rationale:
- 8180 is the standard Keycloak port in docker-compose
- Simpler mental model (no port translation)
- 14003 was a Docker-specific mapping that adds confusion

### Phase 1: Update Docker Compose
**arc-saas/docker-compose.yml**
```yaml
keycloak:
  image: quay.io/keycloak/keycloak:22.0
  ports:
    - "8180:8080"  # Standardize on 8180
  environment:
    KC_HTTP_PORT: 8080
```

### Phase 2: Update All .env.example Files

**arc-saas/.env.example**
```env
# Keycloak Configuration
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=arc-saas
KEYCLOAK_CLIENT_ID=admin-app
```

**arc-saas/services/tenant-management-service/.env.example**
```env
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_ADMIN_URL=http://localhost:8180
```

**arc-saas/apps/admin-app/.env.example**
```env
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=arc-saas
VITE_KEYCLOAK_CLIENT_ID=admin-app
```

**app-plane/services/customer-portal/.env.example**
```env
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=ananta-saas
VITE_KEYCLOAK_CLIENT_ID=customer-portal
```

### Phase 3: Update Documentation
**arc-saas/CLAUDE.md** - Update the Keycloak port table:
```markdown
### Keycloak Port Configuration
| Environment | URL | Port | When to Use |
|-------------|-----|------|-------------|
| All local dev | http://localhost:8180 | 8180 | Standard port for all local development |
| Docker internal | http://keycloak:8080 | 8080 | Services inside Docker network |

**Deprecated**: Port 14003 is no longer used. All configurations should use 8180.
```

### Phase 4: Search and Replace
```bash
# Find all references to port 14003
grep -rn "14003" --include="*.env*" --include="*.md" --include="*.ts" --include="*.tsx"

# Replace with 8180 in each file found
```

### Verification Steps
1. Stop all services
2. Update all .env files to use 8180
3. Restart docker-compose
4. Verify Keycloak accessible at http://localhost:8180
5. Test admin-app login
6. Test customer-portal login

### Estimated Effort
- Total: 1 hour
```

---

## P1-2: Auto-Provisioning Guarantee Missing

### Issue Description
When auto-provisioning fails in `onboarding.service.ts`, the error is logged but there's no retry mechanism. Tenants can be left in an unprovisioned state.

### Files to Modify
```
arc-saas/services/tenant-management-service/src/services/onboarding.service.ts
arc-saas/services/tenant-management-service/src/services/provisioning-retry.service.ts (CREATE)
arc-saas/services/temporal-worker-service/src/workflows/retry-provisioning.workflow.ts (CREATE)
```

### Comprehensive Fixing Prompt

```markdown
## Task: Implement Provisioning Retry Queue

### Phase 1: Create Provisioning Retry Service
**arc-saas/services/tenant-management-service/src/services/provisioning-retry.service.ts**

```typescript
import {inject, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {TenantRepository} from '../repositories';
import {TemporalClientService} from './temporal-client.service';
import {LoggingService} from './logging.service';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 7200]; // seconds: 1m, 5m, 15m, 1h, 2h

export interface ProvisioningRetryRecord {
  tenantId: string;
  subscriptionId: string;
  retryCount: number;
  lastAttempt: Date;
  nextRetryAt: Date;
  lastError?: string;
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed';
}

@service()
export class ProvisioningRetryService {
  private retryQueue: Map<string, ProvisioningRetryRecord> = new Map();

  constructor(
    @repository(TenantRepository) private tenantRepo: TenantRepository,
    @inject('services.TemporalClientService') private temporal: TemporalClientService,
    @inject('services.LoggingService') private logger: LoggingService,
  ) {
    // Start background retry processor
    this.startRetryProcessor();
  }

  async queueForRetry(
    tenantId: string,
    subscriptionId: string,
    error: Error
  ): Promise<void> {
    const existing = this.retryQueue.get(tenantId);
    const retryCount = existing ? existing.retryCount + 1 : 1;

    if (retryCount > MAX_RETRIES) {
      this.logger.error(`[PROVISION] Max retries exceeded for tenant ${tenantId}`);
      // TODO: Send alert to ops team
      this.retryQueue.set(tenantId, {
        ...existing!,
        status: 'failed',
        lastError: error.message,
      });
      return;
    }

    const delaySeconds = RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    this.retryQueue.set(tenantId, {
      tenantId,
      subscriptionId,
      retryCount,
      lastAttempt: new Date(),
      nextRetryAt,
      lastError: error.message,
      status: 'pending',
    });

    this.logger.info(`[PROVISION] Queued retry ${retryCount}/${MAX_RETRIES} for tenant ${tenantId}, next attempt at ${nextRetryAt.toISOString()}`);
  }

  private startRetryProcessor(): void {
    setInterval(async () => {
      const now = new Date();

      for (const [tenantId, record] of this.retryQueue) {
        if (record.status !== 'pending') continue;
        if (record.nextRetryAt > now) continue;

        this.logger.info(`[PROVISION] Retry attempt ${record.retryCount} for tenant ${tenantId}`);
        record.status = 'in_progress';

        try {
          const tenant = await this.tenantRepo.findById(tenantId);
          await this.temporal.provisionTenant(tenant, {id: record.subscriptionId} as any);

          this.logger.info(`[PROVISION] Retry succeeded for tenant ${tenantId}`);
          this.retryQueue.delete(tenantId);
        } catch (err) {
          this.logger.error(`[PROVISION] Retry failed for tenant ${tenantId}: ${err}`);
          await this.queueForRetry(tenantId, record.subscriptionId, err as Error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  getRetryStatus(tenantId: string): ProvisioningRetryRecord | undefined {
    return this.retryQueue.get(tenantId);
  }

  getAllPendingRetries(): ProvisioningRetryRecord[] {
    return Array.from(this.retryQueue.values()).filter(r => r.status === 'pending');
  }
}
```

### Phase 2: Update Onboarding Service
**arc-saas/services/tenant-management-service/src/services/onboarding.service.ts**

```typescript
// Add import
import {ProvisioningRetryService} from './provisioning-retry.service';

// Add to constructor
constructor(
  // ... existing params
  @inject('services.ProvisioningRetryService')
  private retryService: ProvisioningRetryService,
) {}

// Update the auto-provisioning try-catch (around line 290):
try {
  await this.temporalProvisioningService.provisionTenant(res, subscription);
} catch (provisionError) {
  this.logger.error(`[ONBOARD] Failed to auto-start provisioning for tenant ${res.id}: ${provisionError}`);

  // Queue for retry instead of silently failing
  await this.retryService.queueForRetry(
    res.id,
    subscription.id,
    provisionError as Error
  );

  // Don't fail the overall onboarding - tenant is created, just not provisioned yet
}
```

### Phase 3: Add Retry Status Endpoint
**arc-saas/services/tenant-management-service/src/controllers/tenant.controller.ts**

```typescript
@get('/tenants/{id}/provisioning-status')
@authenticate(STRATEGY.BEARER)
@authorize({permissions: [PermissionKey.ViewTenant]})
async getProvisioningStatus(
  @param.path.string('id') id: string,
): Promise<{
  provisioned: boolean;
  retryStatus?: ProvisioningRetryRecord;
}> {
  const tenant = await this.tenantRepository.findById(id);
  const retryStatus = this.retryService.getRetryStatus(id);

  return {
    provisioned: tenant.status === 'active',
    retryStatus,
  };
}
```

### Phase 4: Add Admin Retry Trigger
```typescript
@post('/tenants/{id}/retry-provisioning')
@authenticate(STRATEGY.BEARER)
@authorize({permissions: [PermissionKey.ProvisionTenant]})
async manualRetryProvisioning(
  @param.path.string('id') id: string,
): Promise<void> {
  const tenant = await this.tenantRepository.findById(id);
  const subscription = await this.subscriptionRepository.findOne({
    where: {tenantId: id}
  });

  if (!subscription) {
    throw new HttpErrors.BadRequest('No subscription found for tenant');
  }

  await this.temporalProvisioningService.provisionTenant(tenant, subscription);
}
```

### Verification Steps
1. Start services with retry service enabled
2. Simulate provisioning failure (e.g., stop Temporal)
3. Create a new tenant via onboarding
4. Verify retry is queued: GET /tenants/{id}/provisioning-status
5. Restart Temporal
6. Wait for retry interval
7. Verify provisioning completes

### Estimated Effort
- Phase 1 (Retry Service): 2 hours
- Phase 2 (Integration): 30 minutes
- Phase 3-4 (Endpoints): 1 hour
- Testing: 1 hour
- Total: ~4.5 hours
```

---

## P2-5: CNS Dashboard Has 0 Tests

### Issue Description
The CNS Dashboard (`app-plane/services/cns-dashboard`) has 128 TypeScript/React source files but 0 test files. Target coverage is 80%.

### Files to Create
```
app-plane/services/cns-dashboard/vitest.config.ts
app-plane/services/cns-dashboard/src/test/setup.ts
app-plane/services/cns-dashboard/src/**/*.test.tsx (multiple)
```

### Comprehensive Fixing Prompt

```markdown
## Task: Add Testing Framework and Initial Tests to CNS Dashboard

### Phase 1: Install Testing Dependencies
```bash
cd app-plane/services/cns-dashboard
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 msw
```

### Phase 2: Configure Vitest
**app-plane/services/cns-dashboard/vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Phase 3: Create Test Setup
**app-plane/services/cns-dashboard/src/test/setup.ts**
```typescript
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

// MSW Server for API mocking
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

### Phase 4: Create Mock Handlers
**app-plane/services/cns-dashboard/src/test/mocks/handlers.ts**
```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Dashboard stats
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      totalComponents: 1250,
      enrichedComponents: 980,
      pendingEnrichment: 270,
      qualityScore: 78.4,
    });
  }),

  // Component catalog
  http.get('/api/components', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    return HttpResponse.json({
      items: [
        { id: '1', mpn: 'STM32F103C8T6', manufacturer: 'STMicroelectronics' },
        { id: '2', mpn: 'LM7805', manufacturer: 'Texas Instruments' },
      ],
      total: 100,
      page,
      pageSize: 20,
    });
  }),

  // Enrichment status
  http.get('/api/enrichment/queue', () => {
    return HttpResponse.json({
      pending: 45,
      processing: 12,
      completed: 943,
      failed: 15,
    });
  }),
];
```

### Phase 5: Create Test Utilities
**app-plane/services/cns-dashboard/src/test/utils.tsx**
```typescript
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

### Phase 6: Write Component Tests

**app-plane/services/cns-dashboard/src/components/Dashboard/DashboardStats.test.tsx**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import { DashboardStats } from './DashboardStats';

describe('DashboardStats', () => {
  it('renders loading state initially', () => {
    render(<DashboardStats />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays stats after loading', async () => {
    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument(); // totalComponents
      expect(screen.getByText('78.4%')).toBeInTheDocument(); // qualityScore
    });
  });
});
```

**app-plane/services/cns-dashboard/src/components/ComponentCatalog/ComponentTable.test.tsx**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { ComponentTable } from './ComponentTable';

describe('ComponentTable', () => {
  it('renders component list', async () => {
    render(<ComponentTable />);

    await waitFor(() => {
      expect(screen.getByText('STM32F103C8T6')).toBeInTheDocument();
      expect(screen.getByText('LM7805')).toBeInTheDocument();
    });
  });

  it('handles search', async () => {
    const user = userEvent.setup();
    render(<ComponentTable />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'STM32');

    // Verify search is triggered (would need MSW handler update)
    expect(searchInput).toHaveValue('STM32');
  });

  it('handles pagination', async () => {
    const user = userEvent.setup();
    render(<ComponentTable />);

    await waitFor(() => {
      expect(screen.getByText('STM32F103C8T6')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Verify page change
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });
});
```

### Phase 7: Add npm Scripts
**app-plane/services/cns-dashboard/package.json**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### Phase 8: Create CI Pipeline Test Job
**app-plane/services/cns-dashboard/.github/workflows/test.yml** (if using GitHub Actions)
```yaml
name: Test CNS Dashboard
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Verification Steps
1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Check coverage: `npm run test:coverage`
4. Verify coverage report shows 80%+ on covered files

### Priority Test Files (Based on 128 source files)
1. Dashboard components (most user-facing)
2. Component catalog table (core feature)
3. Enrichment queue views
4. Alert management
5. Settings pages

### Estimated Effort
- Phase 1-3 (Setup): 1 hour
- Phase 4-5 (Mocks/Utils): 2 hours
- Phase 6 (Initial Tests): 8 hours
- Phase 7-8 (CI): 1 hour
- Total for initial setup: ~12 hours
- Full 80% coverage: ~40 hours additional
```

---

## P2-6: OpenTelemetry Not Configured

### Issue Description
OpenTelemetry libraries are installed (`@opentelemetry/api`, `@opentelemetry/sdk-node`) but not configured for tracing.

### Files to Create/Modify
```
app-plane/services/cns-service/app/core/telemetry.py (CREATE)
app-plane/services/customer-portal/src/lib/telemetry.ts (CREATE)
arc-saas/services/tenant-management-service/src/telemetry.ts (CREATE)
```

### Comprehensive Fixing Prompt

```markdown
## Task: Configure OpenTelemetry for Distributed Tracing

### Phase 1: CNS Service (Python/FastAPI)
**app-plane/services/cns-service/app/core/telemetry.py**

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
import os

def configure_telemetry(app, engine):
    """Configure OpenTelemetry for the CNS service."""

    # Skip if disabled
    if os.getenv("OTEL_ENABLED", "true").lower() != "true":
        return

    # Service resource
    resource = Resource.create({
        "service.name": "cns-service",
        "service.version": os.getenv("APP_VERSION", "1.0.0"),
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })

    # Configure tracer provider
    provider = TracerProvider(resource=resource)

    # OTLP exporter (to Jaeger)
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
    exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
    provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)

    # Auto-instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    # Auto-instrument SQLAlchemy
    SQLAlchemyInstrumentor().instrument(engine=engine)

    # Auto-instrument outgoing HTTP calls
    HTTPXClientInstrumentor().instrument()

    return trace.get_tracer("cns-service")
```

**app-plane/services/cns-service/app/main.py** (Update)
```python
from app.core.telemetry import configure_telemetry

# After app creation
tracer = configure_telemetry(app, engine)
```

### Phase 2: Customer Portal (React/TypeScript)
**app-plane/services/customer-portal/src/lib/telemetry.ts**

```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { Resource } from '@opentelemetry/resources';

export function initTelemetry() {
  if (import.meta.env.VITE_OTEL_ENABLED !== 'true') {
    return;
  }

  const resource = new Resource({
    'service.name': 'customer-portal',
    'service.version': import.meta.env.VITE_APP_VERSION || '1.0.0',
  });

  const provider = new WebTracerProvider({ resource });

  const exporter = new OTLPTraceExporter({
    url: import.meta.env.VITE_OTEL_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          new RegExp(`${import.meta.env.VITE_API_URL}/*`),
        ],
      }),
      new DocumentLoadInstrumentation(),
    ],
  });
}
```

**app-plane/services/customer-portal/src/main.tsx** (Update)
```typescript
import { initTelemetry } from './lib/telemetry';

// Initialize telemetry before React
initTelemetry();

// ... rest of main.tsx
```

### Phase 3: Tenant Management Service (LoopBack/TypeScript)
**arc-saas/services/tenant-management-service/src/telemetry.ts**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { Resource } from '@opentelemetry/resources';

let sdk: NodeSDK;

export function initTelemetry() {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }

  const resource = new Resource({
    'service.name': 'tenant-management-service',
    'service.version': process.env.npm_package_version || '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  });

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  sdk.start();
}

export function shutdownTelemetry() {
  return sdk?.shutdown();
}
```

### Phase 4: Add Jaeger to Docker Compose
**arc-saas/docker-compose.yml** (Add)
```yaml
  jaeger:
    image: jaegertracing/all-in-one:1.50
    container_name: arc-saas-jaeger
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: true
```

### Phase 5: Update Environment Files
**.env additions for all services:**
```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### Verification Steps
1. Start Jaeger: `docker-compose up -d jaeger`
2. Restart all services with OTEL_ENABLED=true
3. Make API requests through the system
4. Open Jaeger UI: http://localhost:16686
5. Search for traces by service name
6. Verify trace propagation across services (distributed tracing)

### Estimated Effort
- Phase 1 (CNS Service): 2 hours
- Phase 2 (Customer Portal): 2 hours
- Phase 3 (Tenant Mgmt): 2 hours
- Phase 4-5 (Infrastructure): 1 hour
- Testing/Verification: 1 hour
- Total: ~8 hours
```

---

## P2-7: Audit Logs Partial Coverage

### Issue Description
Audit log infrastructure exists (`audit_logs` table, `AuditLoggerService`) but coverage is partial - not all critical operations are logged.

### Comprehensive Fixing Prompt

```markdown
## Task: Complete Audit Log Coverage for All Critical Operations

### Phase 1: Identify All Critical Operations
Operations that MUST be audit logged:

| Category | Operations |
|----------|------------|
| Authentication | Login, logout, password reset, MFA changes |
| User Management | Create, update, delete, role changes, invitation |
| Tenant Management | Create, update, delete, provisioning |
| BOM Operations | Create, upload, delete, share |
| Enrichment | Trigger, complete, fail |
| Settings | Any settings change |
| Billing | Subscription changes, payment events |

### Phase 2: Create Audit Decorator (Python)
**app-plane/services/cns-service/app/core/audit.py**

```python
from functools import wraps
from typing import Optional, Dict, Any
import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

def audit_log(
    action: str,
    resource_type: str,
    get_resource_id: Optional[callable] = None,
    get_details: Optional[callable] = None,
):
    """
    Decorator to automatically log audit events.

    Usage:
    @audit_log(action="create", resource_type="bom", get_resource_id=lambda r: r.id)
    async def create_bom(...):
        ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # Extract auth context from kwargs
            auth = kwargs.get('auth')
            db = kwargs.get('db')

            if auth and db:
                resource_id = None
                if get_resource_id and result:
                    resource_id = str(get_resource_id(result))

                details = {}
                if get_details:
                    details = get_details(kwargs, result)

                await _write_audit_log(
                    db=db,
                    user_id=str(auth.user_id),
                    tenant_id=str(auth.tenant_id),
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    details=details,
                    ip_address=kwargs.get('request', {}).client.host if 'request' in kwargs else None,
                )

            return result
        return wrapper
    return decorator

async def _write_audit_log(
    db: AsyncSession,
    user_id: str,
    tenant_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str],
    details: Dict[str, Any],
    ip_address: Optional[str],
):
    """Write audit log entry to database."""
    from app.models.audit_log import AuditLog

    log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details),
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    await db.commit()
```

### Phase 3: Apply to BOM Endpoints
**app-plane/services/cns-service/app/api/boms.py**

```python
from app.core.audit import audit_log

@router.post("")
@require_project
@audit_log(
    action="create",
    resource_type="bom",
    get_resource_id=lambda r: r.id,
    get_details=lambda kwargs, r: {"name": kwargs['data'].name}
)
async def create_bom(...):
    ...

@router.delete("/{bom_id}")
@require_bom
@audit_log(
    action="delete",
    resource_type="bom",
    get_resource_id=lambda r: None,  # Already deleted
    get_details=lambda kwargs, r: {"bom_id": str(kwargs['bom_id'])}
)
async def delete_bom(...):
    ...
```

### Phase 4: Apply to User Management
**arc-saas/services/tenant-management-service/src/controllers/user-invitations.controller.ts**

```typescript
// Add audit logging to invitation creation
async createInvitation(data: CreateInvitationDto) {
  const result = await this.invitationService.create(data);

  await this.auditLogger.log({
    userId: this.currentUser.id,
    tenantId: this.currentUser.tenantId,
    action: 'create',
    resourceType: 'user_invitation',
    resourceId: result.id,
    details: { email: data.email, roleKey: data.roleKey },
  });

  return result;
}
```

### Phase 5: Create Audit Log Viewer
**app-plane/services/cns-dashboard/src/pages/AuditLogs.tsx**

```typescript
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../components/DataTable';

export function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => fetch('/api/audit-logs').then(r => r.json()),
  });

  const columns = [
    { header: 'Time', accessor: 'created_at' },
    { header: 'User', accessor: 'user_email' },
    { header: 'Action', accessor: 'action' },
    { header: 'Resource', accessor: 'resource_type' },
    { header: 'Details', accessor: 'details' },
    { header: 'IP', accessor: 'ip_address' },
  ];

  return (
    <div>
      <h1>Audit Logs</h1>
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### Verification Steps
1. Perform each critical operation
2. Query audit_logs table:
   ```sql
   SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;
   ```
3. Verify all operations are logged with correct details
4. Test audit log viewer in dashboard

### Estimated Effort
- Phase 1 (Analysis): 1 hour
- Phase 2 (Decorator): 2 hours
- Phase 3-4 (Apply to endpoints): 4 hours
- Phase 5 (Viewer): 2 hours
- Total: ~9 hours
```

---

## Summary: Prioritized Fix Order

| Order | Issue | Severity | Effort | Impact |
|-------|-------|----------|--------|--------|
| 1 | P0-1: Novu API Key | CRITICAL | 1h | Security breach prevention |
| 2 | P0-5: Tenant Isolation | CRITICAL | 6h | Multi-tenant security |
| 3 | P0-4: Project API | HIGH | 2.5h | Core functionality |
| 4 | P1-2: Provisioning Retry | HIGH | 4.5h | Reliability |
| 5 | P1-1: Keycloak Ports | MEDIUM | 1h | Developer experience |
| 6 | P2-6: OpenTelemetry | MEDIUM | 8h | Observability |
| 7 | P2-7: Audit Logs | MEDIUM | 9h | Compliance |
| 8 | P2-5: CNS Tests | LOW | 12h+ | Quality assurance |

**Total Effort for All Fixes**: ~44 hours (approximately 1 week of focused work)

---

## Appendix: False Alarm Details

### P0-2: docker-compose.yml (FALSE ALARM)
**Claimed**: Missing docker-compose.yml in arc-saas root
**Reality**: File EXISTS at `arc-saas/docker-compose.yml` (492 lines)

### P0-3: Dashboard API Disabled (FALSE ALARM)
**Claimed**: Dashboard APIs disabled, showing TODO comments
**Reality**: All APIs are ENABLED in `Dashboard.tsx`:
- `useGetList` for projects, BOMs, uploads, alerts all active
- No TODO comments about disabled APIs

### P1-3: Workflow Endpoints Missing (FALSE ALARM)
**Claimed**: Missing restart, cancel, terminate endpoints
**Reality**: FULLY IMPLEMENTED in `workflow.controller.ts`:
- restart: lines 419-618
- cancel: lines 620-721
- terminate: lines 723-807

### P1-4: Rate Limiting Not Enforced (FALSE ALARM)
**Claimed**: Invitation rate limiting not implemented
**Reality**: FULLY ENFORCED in `invitation.service.ts`:
- 5-minute cooldown between resends
- Max 5 resends per invitation
- Database tracking of resend attempts

### P1-5: Organization Sync Missing (FALSE ALARM)
**Claimed**: Organization not synced to App Plane
**Reality**: FULLY IMPLEMENTED with two methods:
- Direct Supabase insertion in `supabase-app-plane.activities.ts`
- Webhook option in `provision-tenant.workflow.ts`
