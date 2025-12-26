# CNS Service - Workspace & Projects Alignment Specification

**Version:** 1.0.0
**Last Updated:** 2025-12-14
**Status:** Technical Specification
**Related:** [CNS-AUTH-TENANT-SPEC.md](./CNS-AUTH-TENANT-SPEC.md)

## Overview

This document defines the integration between the Component Normalization Service (CNS) and the new Workspace → Project → BOM hierarchy introduced in the Customer Business Portal (CBP). It extends the authentication and tenant isolation spec with multi-level scoping for workspaces and projects.

## Table of Contents

1. [Scope Model & Hierarchy](#scope-model--hierarchy)
2. [Schema Planning & Foreign Keys](#schema-planning--foreign-keys)
3. [API Contract & Scope Headers](#api-contract--scope-headers)
4. [Gateway Path Consistency](#gateway-path-consistency)
5. [Dashboard & Portal Behavior](#dashboard--portal-behavior)
6. [Storage & Observability](#storage--observability)
7. [Cutover Safety & Rollback](#cutover-safety--rollback)
8. [Subscription & Billing Considerations](#subscription--billing-considerations)

---

## Scope Model & Hierarchy

### Organizational Hierarchy

```
Organization/Tenant (Control Plane UUID)
  └── Workspace (User's team/department)
      └── Project (Product/initiative)
          └── BOM (Individual bill of materials)
              └── BOM Line Items (Components)
```

### Scoping Rules

| Entity | Scope | Owned By | Multiplicity |
|--------|-------|----------|--------------|
| **Organization** | Platform-wide | Control Plane | 1 per tenant |
| **Workspace** | Org-scoped | Organization | Many per org |
| **Project** | Workspace-scoped | Workspace | Many per workspace |
| **BOM** | Project-scoped | Project | Many per project |
| **BOM Line Item** | BOM-scoped | BOM | Many per BOM |

### User Assignment

- Each user belongs to **exactly ONE workspace** (via `users.workspace_id`)
- Org owner and Admin can **assign users to workspaces**
- Users can only create/view BOMs in **projects within their workspace**
- Staff/super_admin can access **any workspace/project** for support

### Required Headers/Claims

| Header | JWT Claim | Required | Source | Purpose |
|--------|-----------|----------|--------|---------|
| `X-Tenant-Id` | `tenantId` | **Yes** | Control Plane `tenants.id` | Tenant isolation |
| `X-Workspace-Id` | `workspaceId` | **Yes** (customer) | Supabase `workspaces.id` | Workspace isolation |
| `X-Project-Id` | `projectId` | **Yes** (BOM ops) | Supabase `projects.id` | Project isolation |
| `X-Organization-ID` | `organization_id` | Deprecated | App Plane org ID | Legacy mapping only |

**Note**: `X-Organization-ID` is **deprecated** and kept only for backward compatibility. All new code MUST use `X-Tenant-Id` with Control Plane UUID.

### Scope Validation Rules

1. **Tenant → Workspace**: Workspace MUST belong to the tenant specified in `X-Tenant-Id`
2. **Workspace → Project**: Project MUST belong to the workspace specified in `X-Workspace-Id`
3. **Project → BOM**: BOM MUST belong to the project specified in `X-Project-Id`
4. **User → Workspace**: User's `workspace_id` MUST match `X-Workspace-Id` (unless staff/admin)

### Staff/Admin Cross-Scope Access

Staff and super_admin users can operate across workspaces/projects:

```python
def can_access_workspace(user_role: str, user_workspace_id: str, requested_workspace_id: str) -> bool:
    """Check if user can access the requested workspace."""
    # Super admins can access any workspace
    if user_role in ["super_admin", "platform_admin"]:
        return True

    # Org admins can access any workspace in their org
    if user_role == "admin":
        # Verify workspace belongs to user's org
        return verify_workspace_in_org(user_tenant_id, requested_workspace_id)

    # Regular users can only access their own workspace
    return user_workspace_id == requested_workspace_id
```

---

## Schema Planning & Foreign Keys

### Current Schema (Before Migration)

```sql
-- Current BOMs table (NO workspace/project isolation)
CREATE TABLE boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Target Schema (After Migration)

```sql
-- Organizations (tenant mapping)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_plane_tenant_id UUID NOT NULL UNIQUE,  -- Control Plane tenants.id
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspaces (user teams/departments)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, name)  -- Workspace names unique per org
);

-- Projects (product/initiative)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, name)  -- Project names unique per workspace
);

-- BOMs (project-scoped)
CREATE TABLE boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Legacy fields (deprecated, kept for backward compatibility)
  organization_id UUID REFERENCES organizations(id),  -- Populated via trigger

  name TEXT NOT NULL,
  version TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'draft',
  enrichment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (project_id, name, version)  -- BOM name+version unique per project
);

-- BOM Line Items (component-level)
CREATE TABLE bom_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,

  -- Component identification
  manufacturer_part_number TEXT,
  manufacturer TEXT,
  description TEXT,
  quantity INTEGER,

  -- Enrichment data
  enrichment_status TEXT DEFAULT 'pending',
  catalog_component_id UUID,  -- FK to components_v2.component_catalog
  quality_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (workspace assignment)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  workspace_id UUID REFERENCES workspaces(id),  -- User's default workspace
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Foreign Key Chain

```
organizations.control_plane_tenant_id (Control Plane tenants.id)
  └── workspaces.organization_id
      └── projects.workspace_id
          └── boms.project_id
              └── bom_line_items.bom_id
```

### Migration Strategy

#### Phase 1: Schema Addition (Non-Breaking)

```sql
-- Add new tables without touching existing BOMs
CREATE TABLE workspaces (...);
CREATE TABLE projects (...);

-- Add new column to BOMs (nullable for now)
ALTER TABLE boms ADD COLUMN project_id UUID REFERENCES projects(id);

-- Add index for performance
CREATE INDEX idx_boms_project_id ON boms(project_id);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX idx_workspaces_organization_id ON workspaces(organization_id);
```

#### Phase 2: Data Backfill

```sql
-- Create default workspace for each organization
INSERT INTO workspaces (organization_id, name, description)
SELECT
  id,
  'Default Workspace',
  'Auto-created during migration'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces WHERE workspaces.organization_id = organizations.id
);

-- Create default project in each workspace
INSERT INTO projects (workspace_id, name, description)
SELECT
  w.id,
  'Legacy BOMs',
  'Auto-created for pre-existing BOMs during migration'
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE projects.workspace_id = w.id
);

-- Assign existing BOMs to default projects
UPDATE boms
SET project_id = (
  SELECT p.id
  FROM projects p
  JOIN workspaces w ON p.workspace_id = w.id
  WHERE w.organization_id = boms.organization_id
    AND p.name = 'Legacy BOMs'
  LIMIT 1
)
WHERE project_id IS NULL;
```

#### Phase 3: Schema Enforcement

```sql
-- Make project_id NOT NULL after backfill
ALTER TABLE boms ALTER COLUMN project_id SET NOT NULL;

-- Add uniqueness constraint
ALTER TABLE boms ADD CONSTRAINT boms_project_name_version_unique
  UNIQUE (project_id, name, version);

-- Add trigger to auto-populate organization_id from project hierarchy
CREATE OR REPLACE FUNCTION populate_bom_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id := (
    SELECT w.organization_id
    FROM projects p
    JOIN workspaces w ON p.workspace_id = w.id
    WHERE p.id = NEW.project_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_populate_organization_id
  BEFORE INSERT OR UPDATE ON boms
  FOR EACH ROW
  EXECUTE FUNCTION populate_bom_organization_id();
```

### Rollback Plan

```sql
-- Phase 3 Rollback: Remove constraints
ALTER TABLE boms DROP CONSTRAINT IF EXISTS boms_project_name_version_unique;
ALTER TABLE boms ALTER COLUMN project_id DROP NOT NULL;
DROP TRIGGER IF EXISTS bom_populate_organization_id ON boms;

-- Phase 2 Rollback: Delete auto-created data
DELETE FROM boms WHERE project_id IN (
  SELECT id FROM projects WHERE name = 'Legacy BOMs'
);
DELETE FROM projects WHERE name = 'Legacy BOMs';
DELETE FROM workspaces WHERE name = 'Default Workspace';

-- Phase 1 Rollback: Drop schema additions
ALTER TABLE boms DROP COLUMN IF EXISTS project_id;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
```

---

## API Contract & Scope Headers

### Required Headers for All Endpoints

| Endpoint Category | X-Tenant-Id | X-Workspace-Id | X-Project-Id | Notes |
|-------------------|-------------|----------------|--------------|-------|
| Catalog (GET /catalog/*) | ✅ Required | ❌ Optional | ❌ N/A | Catalog is tenant-scoped |
| BOM List (GET /boms) | ✅ Required | ✅ Required | ❌ Optional | Filter by workspace, optionally by project |
| BOM Upload (POST /boms) | ✅ Required | ✅ Required | ✅ Required | BOM must belong to a project |
| BOM Detail (GET /boms/{id}) | ✅ Required | ✅ Required | ✅ Required | Validate BOM belongs to project |
| Enrichment (POST /enrichment) | ✅ Required | ✅ Required | ✅ Required | Enrichment is project-scoped |
| Admin Endpoints | ✅ Required | ❌ Optional | ❌ Optional | Staff can query across workspaces |

### Endpoint Examples

#### 1. List BOMs (Workspace-Scoped)

**Request**:
```http
GET /api/boms?workspace_id=abc-123 HTTP/1.1
Host: localhost:27200
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Tenant-Id: 1d07c925-48ba-4b4e-b28f-665041a012ca
X-Workspace-Id: abc-123-workspace-uuid
```

**Response**:
```json
{
  "data": [
    {
      "id": "bom-uuid-1",
      "name": "SmartHome Hub v2.0",
      "version": "1.0",
      "project_id": "project-uuid-1",
      "project_name": "Q1 2025 Products",
      "status": "enriched",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "workspace_id": "abc-123-workspace-uuid",
    "project_filter": null
  }
}
```

#### 2. Upload BOM (Project-Scoped)

**Request**:
```http
POST /api/boms HTTP/1.1
Host: localhost:27200
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Tenant-Id: 1d07c925-48ba-4b4e-b28f-665041a012ca
X-Workspace-Id: abc-123-workspace-uuid
X-Project-Id: project-uuid-1
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="bom.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

[binary BOM file data]
--boundary--
```

**Response**:
```json
{
  "id": "bom-uuid-2",
  "name": "bom.xlsx",
  "project_id": "project-uuid-1",
  "status": "uploaded",
  "enrichment_job_id": "job-uuid-123"
}
```

#### 3. Get BOM Detail (Full Scope Validation)

**Request**:
```http
GET /api/boms/bom-uuid-1 HTTP/1.1
Host: localhost:27200
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Tenant-Id: 1d07c925-48ba-4b4e-b28f-665041a012ca
X-Workspace-Id: abc-123-workspace-uuid
X-Project-Id: project-uuid-1
```

**Backend Validation**:
```python
async def get_bom(bom_id: str, request: Request, auth: AuthContext):
    """Get BOM details with full scope validation."""
    # Extract scope headers
    tenant_id = request.headers.get("X-Tenant-Id")
    workspace_id = request.headers.get("X-Workspace-Id")
    project_id = request.headers.get("X-Project-Id")

    # Fetch BOM with joined hierarchy
    bom = await db.query(
        """
        SELECT b.*, p.workspace_id, w.organization_id
        FROM boms b
        JOIN projects p ON b.project_id = p.id
        JOIN workspaces w ON p.workspace_id = w.id
        JOIN organizations o ON w.organization_id = o.id
        WHERE b.id = $1
        """,
        bom_id
    )

    if not bom:
        raise HTTPException(404, "BOM not found")

    # Validate scope chain
    if str(o.control_plane_tenant_id) != tenant_id:
        raise HTTPException(403, "BOM does not belong to your organization")

    if str(bom.workspace_id) != workspace_id:
        raise HTTPException(403, "BOM does not belong to your workspace")

    if str(bom.project_id) != project_id:
        raise HTTPException(403, "BOM does not belong to this project")

    # Validate user access
    if not can_access_workspace(auth.role, auth.workspace_id, workspace_id):
        raise HTTPException(403, "You do not have access to this workspace")

    return bom
```

### Audience Validation

All CNS API requests MUST include `cns-api` in the JWT `aud` claim (after Keycloak mappers configured):

```python
# Middleware validation
if auth0_audience:  # auth0_audience = "cns-api"
    aud = payload.get("aud")
    if aud is not None:
        if isinstance(aud, list):
            if auth0_audience not in aud:
                raise AuthContextError(
                    AuthErrorCode.INVALID_AUDIENCE,
                    f"Token audience {aud} does not include '{auth0_audience}'"
                )
        elif aud != auth0_audience:
            raise AuthContextError(
                AuthErrorCode.INVALID_AUDIENCE,
                f"Token audience '{aud}' != '{auth0_audience}'"
            )
```

### Header vs. Token Claim Matching

CNS middleware SHOULD validate that scope headers match JWT claims (defense in depth):

```python
async def validate_scope_consistency(request: Request, jwt_payload: dict):
    """Validate that headers match JWT claims."""
    header_tenant = request.headers.get("X-Tenant-Id")
    header_workspace = request.headers.get("X-Workspace-Id")
    header_project = request.headers.get("X-Project-Id")

    jwt_tenant = jwt_payload.get("tenantId")
    jwt_workspace = jwt_payload.get("workspaceId")
    jwt_project = jwt_payload.get("projectId")

    # Tenant ID MUST match (critical for security)
    if header_tenant and jwt_tenant and header_tenant != jwt_tenant:
        logger.error(
            f"[ScopeValidation] Tenant ID mismatch: "
            f"header={header_tenant} jwt={jwt_tenant}"
        )
        raise HTTPException(403, "Tenant ID mismatch between header and token")

    # Workspace ID SHOULD match (log warning if mismatch)
    if header_workspace and jwt_workspace and header_workspace != jwt_workspace:
        logger.warning(
            f"[ScopeValidation] Workspace ID mismatch: "
            f"header={header_workspace} jwt={jwt_workspace}"
        )
        # Allow header to override for staff cross-workspace access
        if not is_staff_role(jwt_payload.get("role")):
            raise HTTPException(403, "Workspace ID mismatch between header and token")

    # Project ID optional (only set during BOM operations)
    if header_project and jwt_project and header_project != jwt_project:
        logger.warning(
            f"[ScopeValidation] Project ID mismatch: "
            f"header={header_project} jwt={jwt_project}"
        )
```

### Error Responses

| Status | Error Code | Message | Cause |
|--------|------------|---------|-------|
| 400 | `MISSING_SCOPE_HEADER` | `X-Tenant-Id header required` | Missing tenant ID |
| 400 | `MISSING_WORKSPACE_HEADER` | `X-Workspace-Id header required for this operation` | Missing workspace ID |
| 400 | `MISSING_PROJECT_HEADER` | `X-Project-Id header required for BOM operations` | Missing project ID |
| 403 | `SCOPE_MISMATCH` | `Tenant ID mismatch between header and token` | Header != JWT claim |
| 403 | `CROSS_WORKSPACE_DENIED` | `You do not have access to this workspace` | User not in workspace |
| 403 | `CROSS_PROJECT_DENIED` | `BOM does not belong to this project` | BOM project_id != X-Project-Id |

---

## Gateway Path Consistency

### Path Standard: `/cns/` (Production)

After review of the services table and dashboard usage, we standardize on **`/cns/`** as the canonical path prefix:

| Environment | Base URL | Path Prefix | Example |
|-------------|----------|-------------|---------|
| **Development** | `http://localhost:27200` | (none) | `http://localhost:27200/catalog/categories` |
| **Staging** | `https://staging-api.ananta.com` | `/cns/` | `https://staging-api.ananta.com/cns/catalog/categories` |
| **Production** | `https://api.ananta.com` | `/cns/` | `https://api.ananta.com/cns/catalog/categories` |

**Rationale**: `/cns/` is shorter, clearer, and matches the service name. `/api/cns/` adds redundant `/api/` since the gateway already implies API access.

### Environment Variable Configuration

```bash
# Customer Portal (.env.development)
VITE_CNS_API_URL=http://localhost:27200

# Customer Portal (.env.production)
VITE_CNS_API_URL=https://api.ananta.com/cns

# Backstage Portal (.env.development)
VITE_CNS_API_URL=http://localhost:27200

# Backstage Portal (.env.production)
VITE_CNS_API_URL=https://api.ananta.com/cns

# CNS Dashboard (.env.development)
VITE_CNS_API_URL=http://localhost:27200

# CNS Dashboard (.env.production)
VITE_CNS_API_URL=https://api.ananta.com/cns
```

### Gateway Configuration (nginx)

```nginx
# API Gateway - Production

# CNS Service routing
location /cns/ {
    # Strip /cns prefix before forwarding to CNS service
    rewrite ^/cns(.*)$ $1 break;

    # Upstream CNS service
    proxy_pass http://cns-service:27200;

    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Forward auth headers
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Tenant-Id $http_x_tenant_id;
    proxy_set_header X-Workspace-Id $http_x_workspace_id;
    proxy_set_header X-Project-Id $http_x_project_id;

    # Audience enforcement (optional - can also be done by CNS service)
    # add_header X-Api-Audience "cns-api" always;

    # CORS headers
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, X-Tenant-Id, X-Workspace-Id, X-Project-Id, Content-Type" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Max-Age 1728000;
        add_header Content-Type 'text/plain; charset=utf-8';
        add_header Content-Length 0;
        return 204;
    }

    # Rate limiting
    limit_req zone=api_limit burst=20 nodelay;
    limit_conn addr 10;

    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### Services Table Update

All documentation and services tables should reference `/cns/` consistently:

| Service | Path | Port | Example |
|---------|------|------|---------|
| CNS Service | `/cns/*` | 27200 | `https://api.ananta.com/cns/catalog/categories` |
| CNS Dashboard | `/cns-dashboard/*` | 27250 | `https://api.ananta.com/cns-dashboard` |

---

## Dashboard & Portal Behavior

### Customer Portal (CBP) BOM Flow

#### Workspace/Project Binding

1. **User logs in** → Workspace ID determined from `users.workspace_id`
2. **Dashboard loads** → Shows data scoped to user's workspace
3. **User navigates to Projects** → Lists projects in user's workspace
4. **User selects/creates project** → Sets `currentProjectId` in context
5. **User uploads BOM** → BOM created with `project_id = currentProjectId`

#### Required Context

```typescript
// CBP - TenantContext + WorkspaceContext + ProjectContext
interface AppContext {
  // From Control Plane
  tenant: {
    id: string;              // Control Plane tenants.id (UUID)
    name: string;
    planId: string;
  };

  // From user session
  workspace: {
    id: string;              // User's workspace UUID
    name: string;
    organizationId: string;  // Supabase organizations.id
  };

  // From navigation state
  currentProject?: {
    id: string;              // Selected project UUID
    name: string;
    workspaceId: string;
  };
}

// Axios interceptor to inject scope headers
axios.interceptors.request.use((config) => {
  if (appContext.tenant) {
    config.headers['X-Tenant-Id'] = appContext.tenant.id;
  }
  if (appContext.workspace) {
    config.headers['X-Workspace-Id'] = appContext.workspace.id;
  }
  if (appContext.currentProject) {
    config.headers['X-Project-Id'] = appContext.currentProject.id;
  }
  return config;
});
```

#### BOM Upload UI

```typescript
// BOM Upload Page - requires project selection
function BomUploadPage() {
  const { currentProject } = useProject();
  const { workspace } = useWorkspace();

  if (!currentProject) {
    return (
      <Alert severity="warning">
        Please select a project before uploading a BOM.
        <Button onClick={() => navigate('/projects')}>
          Go to Projects
        </Button>
      </Alert>
    );
  }

  return (
    <BomUploadForm
      projectId={currentProject.id}
      workspaceId={workspace.id}
    />
  );
}
```

### Staff Dashboard (Backstage Portal)

#### Workspace/Project Selectors

Staff users need dropdowns to select workspace/project when viewing customer data:

```typescript
// Backstage Dashboard - Multi-tenant selectors
function StaffDashboard() {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <div className="staff-dashboard">
      {/* Tenant Selector */}
      <TenantSelector
        value={selectedTenant}
        onChange={setSelectedTenant}
      />

      {/* Workspace Selector (filtered by tenant) */}
      {selectedTenant && (
        <WorkspaceSelector
          tenantId={selectedTenant.id}
          value={selectedWorkspace}
          onChange={setSelectedWorkspace}
        />
      )}

      {/* Project Selector (filtered by workspace) */}
      {selectedWorkspace && (
        <ProjectSelector
          workspaceId={selectedWorkspace.id}
          value={selectedProject}
          onChange={setSelectedProject}
        />
      )}

      {/* BOM List (filtered by project or workspace) */}
      {selectedWorkspace && (
        <BomList
          tenantId={selectedTenant.id}
          workspaceId={selectedWorkspace.id}
          projectId={selectedProject?.id}
        />
      )}
    </div>
  );
}
```

### Logging Cross-Scope Writes

All BOM operations MUST log tenant/workspace/project context for audit:

```python
# CNS backend logging
logger.info(
    "[BOM_UPLOAD] BOM uploaded",
    extra={
        "tenant_id": auth.tenant_id,
        "workspace_id": workspace_id,
        "project_id": project_id,
        "bom_id": bom.id,
        "user_id": auth.user_id,
        "user_email": auth.email,
        "user_role": auth.role,
        "request_id": request.state.request_id,
    }
)
```

### Scope Mismatch Alerts

Set up alerts for suspicious cross-scope access attempts:

```python
# Alert on scope mismatch
if header_tenant != jwt_tenant:
    logger.critical(
        "[SECURITY] Tenant ID mismatch detected!",
        extra={
            "header_tenant_id": header_tenant,
            "jwt_tenant_id": jwt_tenant,
            "user_id": auth.user_id,
            "user_email": auth.email,
            "source_ip": request.client.host,
            "user_agent": request.headers.get("User-Agent"),
        }
    )
    # Send to security monitoring (Sentry, DataDog, etc.)
    sentry_sdk.capture_message(
        "Tenant ID mismatch in CNS request",
        level="error",
        tags={"security": "scope_violation"}
    )
```

---

## Storage & Observability

### Object Storage Key Structure

For BOM files stored in MinIO/S3:

```
cns-boms/
  {tenant_id}/                    # Control Plane tenant UUID
    {workspace_id}/               # Workspace UUID
      {project_id}/               # Project UUID
        {bom_id}/                 # BOM UUID
          original/               # Original uploaded file
            bom.xlsx
          parsed/                 # Parsed BOM data
            bom.json
          enriched/               # Enriched BOM data
            bom_enriched.json
          attachments/            # Supporting files
            schematic.pdf
```

**Example**:
```
cns-boms/
  1d07c925-48ba-4b4e-b28f-665041a012ca/  (tenant)
    abc-123-workspace-uuid/               (workspace)
      project-uuid-1/                     (project)
        bom-uuid-1/                       (BOM)
          original/bom.xlsx
          parsed/bom.json
          enriched/bom_enriched.json
```

**Benefits**:
- Easy tenant/workspace/project isolation
- S3 lifecycle policies can be scoped by prefix
- Backup/restore operations simplified
- Compliance with data residency requirements

### Database Audit Fields

All tables MUST include audit fields for tracing:

```sql
-- Add audit fields to all tables
ALTER TABLE boms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE boms ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
ALTER TABLE boms ADD COLUMN IF NOT EXISTS tenant_id UUID;  -- Denormalized for fast queries
ALTER TABLE boms ADD COLUMN IF NOT EXISTS workspace_id UUID;  -- Denormalized for fast queries

-- Create audit trigger
CREATE OR REPLACE FUNCTION audit_bom_changes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = current_setting('app.current_user_id', true)::UUID;

  -- Log change to audit table
  INSERT INTO audit_logs (
    table_name, record_id, action, user_id,
    tenant_id, workspace_id, project_id,
    old_values, new_values, timestamp
  ) VALUES (
    TG_TABLE_NAME, NEW.id, TG_OP, NEW.updated_by,
    NEW.tenant_id, NEW.workspace_id, NEW.project_id,
    row_to_json(OLD), row_to_json(NEW), now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bom_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON boms
  FOR EACH ROW EXECUTE FUNCTION audit_bom_changes();
```

### OpenTelemetry Tracing

Add scope context to all distributed traces:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

@app.post("/api/boms")
async def upload_bom(request: Request, auth: AuthContext):
    with tracer.start_as_current_span("upload_bom") as span:
        # Add scope attributes to span
        span.set_attribute("tenant.id", auth.tenant_id)
        span.set_attribute("workspace.id", request.headers.get("X-Workspace-Id"))
        span.set_attribute("project.id", request.headers.get("X-Project-Id"))
        span.set_attribute("user.id", auth.user_id)
        span.set_attribute("user.role", auth.role)

        # Continue with BOM upload logic
        ...
```

### Prometheus Metrics

Expose metrics with scope labels:

```python
from prometheus_client import Counter, Histogram

bom_uploads = Counter(
    "cns_bom_uploads_total",
    "Total BOM uploads",
    ["tenant_id", "workspace_id", "project_id", "status"]
)

enrichment_duration = Histogram(
    "cns_enrichment_duration_seconds",
    "BOM enrichment duration",
    ["tenant_id", "workspace_id", "project_id"]
)

# Usage
bom_uploads.labels(
    tenant_id=auth.tenant_id,
    workspace_id=workspace_id,
    project_id=project_id,
    status="success"
).inc()
```

### Scope Mismatch Alerts

Configure alerts for suspicious activity:

```yaml
# Prometheus alert rules
groups:
  - name: cns_security
    rules:
      - alert: ScopeMismatchDetected
        expr: rate(cns_scope_mismatch_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
          component: cns-service
        annotations:
          summary: "CNS scope mismatch detected"
          description: "Tenant/workspace/project ID mismatch detected in CNS requests"

      - alert: CrossWorkspaceAccessDenied
        expr: rate(cns_cross_workspace_denied_total[5m]) > 5
        for: 2m
        labels:
          severity: warning
          component: cns-service
        annotations:
          summary: "High rate of cross-workspace access denials"
          description: "Multiple users attempting to access workspaces they don't belong to"
```

---

## Cutover Safety & Rollback

### Cutover Timeline

| Phase | Week | Activities | Rollback Plan |
|-------|------|-----------|---------------|
| **Pre-Cutover** | -4 | Schema migration (Phase 1-2), data backfill | Drop new tables/columns |
| **Testing** | -2 | Integration testing, load testing | Revert to old endpoints |
| **Staging** | -1 | Deploy to staging, validate with real data | Database restore from backup |
| **Cutover** | 0 | Enable header enforcement, update frontends | Feature flag rollback |
| **Post-Cutover** | +1 | Monitor metrics, fix issues | Disable header validation |
| **Hardening** | +2 | Enable strict audience validation | Relax audience validation |

### Feature Flags

Use feature flags to control rollout:

```python
# CNS service feature flags
class FeatureFlags:
    ENFORCE_WORKSPACE_HEADERS = os.getenv("ENFORCE_WORKSPACE_HEADERS", "false").lower() == "true"
    ENFORCE_PROJECT_HEADERS = os.getenv("ENFORCE_PROJECT_HEADERS", "false").lower() == "true"
    ENFORCE_SCOPE_MATCHING = os.getenv("ENFORCE_SCOPE_MATCHING", "false").lower() == "true"
    REQUIRE_AUDIENCE_VALIDATION = os.getenv("REQUIRE_AUDIENCE_VALIDATION", "false").lower() == "true"

# Gradual rollout
if FeatureFlags.ENFORCE_WORKSPACE_HEADERS:
    if not request.headers.get("X-Workspace-Id"):
        raise HTTPException(400, "X-Workspace-Id header required")
else:
    logger.warning("[FeatureFlag] Workspace header not enforced (flag disabled)")
```

### Staff Ingress VPN/IP Allowlist

During cutover, maintain VPN/IP allowlist for staff dashboard:

```nginx
# Backstage Portal ingress (staff only)
location /backstage/ {
    # IP allowlist for staff access
    satisfy any;
    allow 10.0.0.0/8;          # Internal VPN
    allow 192.168.1.0/24;      # Office network
    deny all;

    # JWT auth still required
    auth_request /api/auth/validate;

    proxy_pass http://backstage-portal:27150;
    # ... (rest of proxy config)
}
```

### Rollback Procedures

#### Rollback Level 1: Disable Header Enforcement

```bash
# Disable feature flags (instant rollback, no data loss)
docker exec app-plane-cns-service \
  sh -c 'export ENFORCE_WORKSPACE_HEADERS=false && \
         export ENFORCE_PROJECT_HEADERS=false && \
         supervisorctl restart cns-service'
```

#### Rollback Level 2: Revert Frontend

```bash
# Revert frontend environment variables
# Customer Portal
docker exec app-plane-customer-portal \
  sh -c 'export VITE_CNS_API_URL=http://localhost:27200 && \
         npm run build && supervisorctl restart customer-portal'
```

#### Rollback Level 3: Database Schema Rollback

```sql
-- Run Phase 3, 2, 1 rollback scripts (see Schema Planning section)
-- This is last resort - data loss possible
BEGIN;
-- Execute rollback SQL from "Rollback Plan" section
COMMIT;
```

### Monitoring During Cutover

Key metrics to watch:

```yaml
# Dashboard widgets
- Error rate (grouped by endpoint)
- P95 latency (before/after cutover)
- 403 Forbidden rate (should be low)
- Active users (should not drop significantly)
- BOM upload success rate (should remain high)
- Scope mismatch alerts (should be zero)
```

### Go/No-Go Criteria

**Go Criteria** (proceed with cutover):
- ✅ All integration tests passing
- ✅ Staging environment stable for 48 hours
- ✅ Data backfill completed successfully
- ✅ Rollback procedures tested
- ✅ Feature flags configured
- ✅ VPN/IP allowlist validated
- ✅ Team trained on new scope headers

**No-Go Criteria** (abort cutover):
- ❌ Error rate > 1% in staging
- ❌ Data backfill failures > 0.1%
- ❌ Rollback test failed
- ❌ Critical bugs in scope validation
- ❌ Missing Keycloak audience mappers

---

## Subscription & Billing Considerations

### Subscription Scope

**Decision**: Subscriptions remain **tenant-wide** (not project-level).

**Rationale**:
- Billing complexity increases significantly with project-level subscriptions
- Users expect org-wide plans (like GitHub, Jira, Asana)
- Admin burden: managing multiple subscriptions per tenant is confusing

**Limits Enforcement**:

| Plan | Limit | Scope | Enforcement |
|------|-------|-------|-------------|
| Free | 5 BOMs | **Per tenant** (all workspaces/projects combined) | Block upload if count >= 5 |
| Starter | 50 BOMs | **Per tenant** | Block upload if count >= 50 |
| Professional | 500 BOMs | **Per tenant** | Block upload if count >= 500 |
| Enterprise | Unlimited | **Per tenant** | No limit |

**Query Example**:

```sql
-- Get tenant's total BOM count across all workspaces/projects
SELECT COUNT(DISTINCT b.id)
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
JOIN organizations o ON w.organization_id = o.id
WHERE o.control_plane_tenant_id = $1;  -- Control Plane tenant UUID
```

**Enforcement Logic**:

```python
async def check_bom_upload_limit(tenant_id: str):
    """Check if tenant has reached BOM upload limit."""
    # Get tenant's subscription plan
    plan = await get_tenant_plan(tenant_id)

    if plan.bom_limit is None:  # Unlimited (Enterprise)
        return True

    # Count existing BOMs across all workspaces/projects
    count = await db.fetch_val(
        """
        SELECT COUNT(DISTINCT b.id)
        FROM boms b
        JOIN projects p ON b.project_id = p.id
        JOIN workspaces w ON p.workspace_id = w.id
        JOIN organizations o ON w.organization_id = o.id
        WHERE o.control_plane_tenant_id = $1
        """,
        tenant_id
    )

    if count >= plan.bom_limit:
        raise HTTPException(
            402,  # Payment Required
            f"BOM upload limit reached ({count}/{plan.bom_limit}). "
            f"Please upgrade your plan to upload more BOMs."
        )

    return True
```

### Project-Level Analytics (Future)

While subscriptions are tenant-wide, we can still provide project-level usage analytics:

```sql
-- Project-level BOM count (for analytics only, not billing)
SELECT
  p.id,
  p.name,
  COUNT(b.id) as bom_count,
  SUM(bli.quantity) as total_components
FROM projects p
LEFT JOIN boms b ON b.project_id = p.id
LEFT JOIN bom_line_items bli ON bli.bom_id = b.id
WHERE p.workspace_id = $1
GROUP BY p.id, p.name;
```

This allows:
- Dashboard widgets showing "Top Projects by BOM Count"
- Project managers to see resource utilization
- Finance teams to allocate costs internally (if needed)

### Future Consideration: Workspace-Level Limits

If customer demand requires it, we could add **workspace-level limits** as an add-on feature:

```sql
-- Workspace limits (optional future feature)
CREATE TABLE workspace_limits (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id),
  max_projects INTEGER,
  max_boms INTEGER,
  max_users INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

This would allow enterprises to:
- Allocate resources across departments
- Prevent one workspace from consuming all org-wide quota
- Implement internal chargeback models

**Not in scope for initial release** - defer to Phase 2+.

---

## Implementation Checklist

### Backend (CNS Service)

- [ ] Add `workspaces` and `projects` tables to Supabase schema
- [ ] Add `project_id` FK to `boms` table
- [ ] Add `workspace_id` FK to `users` table
- [ ] Implement data backfill script for existing BOMs
- [ ] Add trigger to auto-populate `organization_id` from project hierarchy
- [ ] Update BOM upload endpoint to require `X-Project-Id` header
- [ ] Update BOM list endpoint to filter by workspace/project
- [ ] Add scope validation middleware (tenant → workspace → project)
- [ ] Add header-vs-claim cross-validation
- [ ] Implement staff multi-workspace access logic
- [ ] Add audit logging with scope context
- [ ] Add OpenTelemetry tracing with scope attributes
- [ ] Add Prometheus metrics with scope labels
- [ ] Configure scope mismatch alerts

### Frontend (Customer Portal)

- [ ] Add `WorkspaceContext` provider
- [ ] Add `ProjectContext` provider
- [ ] Create workspace selector component (if needed)
- [ ] Create project selector component
- [ ] Update BOM upload form to require project selection
- [ ] Update BOM list page to show project grouping
- [ ] Inject `X-Workspace-Id` header in all API requests
- [ ] Inject `X-Project-Id` header in BOM operations
- [ ] Handle 403 scope mismatch errors gracefully
- [ ] Add project breadcrumbs to BOM detail page

### Frontend (Backstage Portal)

- [ ] Add tenant selector for staff users
- [ ] Add workspace selector (filtered by tenant)
- [ ] Add project selector (filtered by workspace)
- [ ] Update BOM list to show workspace/project columns
- [ ] Add cross-workspace navigation support
- [ ] Inject scope headers based on selected tenant/workspace/project

### Infrastructure

- [ ] Update nginx gateway config with `/cns/` path routing
- [ ] Add CORS headers for scope headers (`X-Workspace-Id`, `X-Project-Id`)
- [ ] Configure IP allowlist for staff ingress (VPN)
- [ ] Set up MinIO bucket structure (`cns-boms/{tenant}/{workspace}/{project}`)
- [ ] Configure S3 lifecycle policies by prefix
- [ ] Deploy Prometheus alert rules for scope mismatches

### Testing

- [ ] Test BOM upload with valid project (200 OK)
- [ ] Test BOM upload without project header (400 Bad Request)
- [ ] Test BOM access across projects (403 Forbidden)
- [ ] Test staff cross-workspace access (200 OK)
- [ ] Test regular user cross-workspace access (403 Forbidden)
- [ ] Test header-claim mismatch (403 Forbidden)
- [ ] Load test with 1000 concurrent users across 10 tenants
- [ ] Verify audit logs include workspace/project context
- [ ] Verify OpenTelemetry traces include scope attributes
- [ ] Test rollback procedures (feature flags, schema)

### Documentation

- [ ] Update API docs with new scope headers
- [ ] Add workspace/project setup guide
- [ ] Document migration procedures
- [ ] Create troubleshooting guide for scope errors
- [ ] Update architecture diagrams with workspace/project layers
- [ ] Write runbook for cutover and rollback

---

## References

### Related Documentation

- [CNS-AUTH-TENANT-SPEC.md](./CNS-AUTH-TENANT-SPEC.md) - Authentication and tenant isolation spec
- [App Plane README](../README.md) - Overall architecture
- [CNS Service README](../services/cns-service/README.md) - CNS service documentation
- [Customer Portal README](../../arc-saas/apps/customer-portal/README.md) - CBP frontend

### Schema References

- Supabase `organizations` table - Control Plane tenant mapping
- Supabase `workspaces` table - Team/department grouping
- Supabase `projects` table - Product/initiative grouping
- Supabase `boms` table - Bill of materials (project-scoped)

---

**Document Status**: Complete
**Review Status**: Pending review by Platform Team
**Next Steps**: Schema migration planning, frontend context implementation
**Cutover Target**: Q1 2025
