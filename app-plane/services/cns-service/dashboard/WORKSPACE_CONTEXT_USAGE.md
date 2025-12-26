# Workspace and Project Context Management

This document describes the workspace and project context management features added to the CNS Dashboard.

## Overview

The dashboard now supports the full organizational hierarchy:
- **Organizations** → **Workspaces** → **Projects** → **BOMs**

The `TenantContext` has been extended to include workspace and project context, with automatic cleanup when parent contexts change.

## Updated TenantContext

### New Context Values

```typescript
interface TenantContextType {
  // Existing
  tenantId: string;
  setTenantId: (id: string) => void;
  organizationId?: string;
  setOrganizationId: (id: string | undefined) => void;
  adminModeAllTenants: boolean;
  setAdminModeAllTenants: (mode: boolean) => void;

  // NEW: Workspace context
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;

  // NEW: Project context
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // NEW: Clear workspace/project when org changes
  clearWorkspaceContext: () => void;
}
```

### Convenience Hooks

```typescript
import {
  useTenantId,
  useOrganizationId,
  useWorkspaceId,
  useProjectId
} from '@/contexts/TenantContext';

// Use in components
const tenantId = useTenantId();
const organizationId = useOrganizationId();
const workspaceId = useWorkspaceId();        // Returns string | null
const projectId = useProjectId();            // Returns string | null
```

## Data Fetching Hooks

### useWorkspaces

Fetches workspaces for the current organization:

```typescript
import { useWorkspaces } from '@/hooks';

function MyComponent() {
  const organizationId = useOrganizationId();
  const { workspaces, loading, error } = useWorkspaces(organizationId);

  return (
    <div>
      {loading && <div>Loading workspaces...</div>}
      {error && <div>Error: {error}</div>}
      {workspaces.map(ws => (
        <div key={ws.id}>{ws.name}</div>
      ))}
    </div>
  );
}
```

**API Endpoint:** `GET /api/workspaces?organization_id={organizationId}`

**Response Type:**
```typescript
interface Workspace {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  created_at: string;
}
```

### useProjects

Fetches projects for the current workspace:

```typescript
import { useProjects } from '@/hooks';

function MyComponent() {
  const workspaceId = useWorkspaceId();
  const { projects, loading, error } = useProjects(workspaceId);

  return (
    <div>
      {loading && <div>Loading projects...</div>}
      {error && <div>Error: {error}</div>}
      {projects.map(proj => (
        <div key={proj.id}>{proj.name}</div>
      ))}
    </div>
  );
}
```

**API Endpoint:** `GET /api/projects?workspace_id={workspaceId}`

**Response Type:**
```typescript
interface Project {
  id: string;
  name: string;
  workspace_id: string;
  organization_id: string;
  created_at: string;
}
```

## UI Components

### WorkspaceSelector

A dropdown selector for switching between workspaces:

```typescript
import WorkspaceSelector from '@/components/WorkspaceSelector';

function AppBar() {
  return (
    <Box>
      <TenantSelector />
      <WorkspaceSelector />  {/* Only shows when org is selected */}
    </Box>
  );
}
```

Features:
- Shows "All Workspaces" option when no workspace selected
- Automatically hidden when no organization is selected
- Persists selection to localStorage
- Clears project context when workspace changes

### ProjectSelector

A dropdown selector for switching between projects:

```typescript
import ProjectSelector from '@/components/ProjectSelector';

function AppBar() {
  return (
    <Box>
      <TenantSelector />
      <WorkspaceSelector />
      <ProjectSelector />  {/* Only shows when workspace is selected */}
    </Box>
  );
}
```

Features:
- Shows "All Projects" option when no project selected
- Automatically hidden when no workspace is selected
- Persists selection to localStorage

## Context Lifecycle

### Automatic Cleanup

The context automatically cleans up child contexts when parent contexts change:

```typescript
// When organization changes:
setOrganizationId(newOrgId);
// → workspaceId becomes null
// → projectId becomes null
// → Both removed from localStorage

// When workspace changes:
setWorkspaceId(newWorkspaceId);
// → projectId becomes null
// → Removed from localStorage
```

### Manual Cleanup

You can manually clear workspace and project context:

```typescript
import { useTenant } from '@/contexts/TenantContext';

function MyComponent() {
  const { clearWorkspaceContext } = useTenant();

  const handleReset = () => {
    clearWorkspaceContext();  // Clears both workspace and project
  };
}
```

## LocalStorage Keys

The context uses these localStorage keys:

| Key | Type | Purpose |
|-----|------|---------|
| `cns_dashboard_tenant_id` | string | Current tenant (organization) ID |
| `cns_dashboard_organization_id` | string | Current organization ID (same as tenant) |
| `cns_workspace_id` | string \| null | Current workspace ID |
| `cns_project_id` | string \| null | Current project ID |

## API Integration Examples

### Filter BOMs by Context

```typescript
import { useTenantId, useWorkspaceId, useProjectId } from '@/contexts/TenantContext';

function BOMList() {
  const organizationId = useTenantId();  // Required
  const workspaceId = useWorkspaceId();  // Optional
  const projectId = useProjectId();      // Optional

  const fetchBOMs = async () => {
    const params = new URLSearchParams();
    params.set('organization_id', organizationId);

    if (workspaceId) {
      params.set('workspace_id', workspaceId);
    }

    if (projectId) {
      params.set('project_id', projectId);
    }

    const response = await fetch(`/api/boms?${params}`);
    return response.json();
  };
}
```

### Create BOM with Context

```typescript
import { useTenantId, useWorkspaceId, useProjectId } from '@/contexts/TenantContext';

function CreateBOM() {
  const organizationId = useTenantId();
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();

  const createBOM = async (bomData: any) => {
    const payload = {
      ...bomData,
      organization_id: organizationId,
      workspace_id: workspaceId || undefined,  // Optional
      project_id: projectId || undefined,      // Optional
    };

    const response = await fetch('/api/boms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.json();
  };
}
```

## Migration Guide

### Before

```typescript
// Old code - only organization context
import { useTenant } from '@/contexts/TenantContext';

const { tenantId, organizationId } = useTenant();

// API call with only org context
const response = await fetch(`/api/boms?organization_id=${organizationId}`);
```

### After

```typescript
// New code - full hierarchy support
import { useTenantId, useWorkspaceId, useProjectId } from '@/contexts/TenantContext';

const organizationId = useTenantId();
const workspaceId = useWorkspaceId();
const projectId = useProjectId();

// API call with full context
const params = new URLSearchParams({ organization_id: organizationId });
if (workspaceId) params.set('workspace_id', workspaceId);
if (projectId) params.set('project_id', projectId);

const response = await fetch(`/api/boms?${params}`);
```

## Testing

The new features are fully backwards compatible. Existing code will continue to work without changes.

### Test Cases

1. **Organization-only context** (existing behavior)
   - Select organization → see all workspaces/projects
   - Create BOM → assigned to organization only

2. **Workspace context**
   - Select workspace → see only that workspace's projects
   - Create BOM → assigned to organization + workspace

3. **Project context**
   - Select project → see only that project's BOMs
   - Create BOM → assigned to organization + workspace + project

4. **Context cleanup**
   - Change organization → workspace/project cleared
   - Change workspace → project cleared
   - Refresh browser → context restored from localStorage
