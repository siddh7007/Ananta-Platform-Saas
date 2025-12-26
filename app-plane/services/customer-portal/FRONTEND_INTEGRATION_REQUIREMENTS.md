# Customer Portal Frontend - CNS Integration Requirements

## Executive Summary

The Customer Portal frontend currently uses **organization-scoped** BOM upload endpoints that include `organization_id` in the request body. The CNS service has implemented a new **project-scoped** endpoint (`POST /api/boms/projects/{project_id}/boms/upload`) that derives organization context server-side for enhanced security and data isolation.

**Status**: DOCUMENTATION ONLY - No code changes made yet.

---

## Current Implementation Analysis

### 1. Primary BOM Upload Flow

**Main Component**: `src/bom/BOMUploadWorkflow.tsx`

This is the primary BOM upload component used in production. It implements a unified pipeline:

1. Upload file → Parse columns client-side
2. Store raw file in MinIO (`/api/customer/upload`)
3. Save to Supabase `bom_uploads` table
4. User confirms column mappings
5. Save line items to `bom_line_items`
6. Start enrichment workflow

**Current Upload Endpoint**:
```typescript
// Line 373
const uploadResponse = await fetch(`${getCnsBaseUrl()}/api/customer/upload`, {
  method: 'POST',
  headers,
  body: formData,  // Contains: file, organization_id
});
```

**Current Enrichment Endpoint**:
```typescript
// Line 647
const response = await fetch(`${getCnsBaseUrl()}/api/boms/${item.bomId}/enrichment/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({
    organization_id: tenantId,      // ← Client-supplied
    project_id: currentProjectId,   // ← Client-supplied
    user_id: currentUserId,
    priority: 7,
  }),
});
```

**Key Issues**:
- `organization_id` is read from `currentOrg?.id` (line 81)
- `organization_id` is sent in request body (lines 198, 368, 654)
- No server-side validation of organization context
- Project ID is passed but not used for scoping

---

### 2. Data Provider Implementation

**File**: `src/providers/djangoDataProvider.ts`

Legacy data provider for complex backend operations. Contains an upload endpoint reference:

```typescript
// Line 246
const response = await fetch(`${BACKEND_URL}/api/boms/upload/`, {
  method: 'POST',
  headers: {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  },
  body: formData,
});
```

**Status**: This appears to be for an old Django backend on port 27200. Comments in `BOMUploadSimple.tsx` indicate this backend "doesn't exist in V2 architecture."

**Action**: Likely safe to deprecate or update to point to CNS service.

---

### 3. CNS API Client

**File**: `src/services/cnsApi.ts`

Provides typed methods for CNS API calls. Currently does NOT have a project-scoped upload method.

**Current Upload Method** (line 275-311):
```typescript
async uploadBOM(
  files: File[],
  tenantId: string,
  organizationId?: string,  // ← Client-supplied
  projectId?: string
): Promise<UploadBOMResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('file', file));

  formData.append('organization_id', tenantId);  // ← Added to body
  if (organizationId) {
    formData.append('organization_id', organizationId);
  }
  if (projectId) {
    formData.append('project_id', projectId);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${this.baseURL}/api/bom/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });
  // ...
}
```

**Auth Headers** (line 87-141):
The `getAuthHeaders()` function already sets:
- `X-Organization-Id` header (from localStorage)
- `X-Workspace-Id` header (from localStorage)
- `X-User-Email` header (from localStorage)
- `Authorization: Bearer <token>` (Auth0 or Supabase)

**Security Concern**: Organization ID is sent in BOTH headers AND body, with body taking precedence. This allows clients to potentially upload to wrong organizations.

---

### 4. Project Context Management

**Storage**: Project ID is stored in `localStorage` as `current_project_id` (line 80 in BOMUploadWorkflow)

**Retrieval**:
```typescript
const currentProjectId = localStorage.getItem('current_project_id');
```

**Validation**: Component redirects to dashboard if no project is selected (lines 300-320).

**Good Practice**: Project context is required before upload, ensuring project_id is always available.

---

### 5. Additional Upload Locations

The following files also call BOM upload or enrichment endpoints:

| File | Endpoint | Line | Usage |
|------|----------|------|-------|
| `src/bom/intake/EnrichmentQueueSection.tsx` | `/api/boms/{bomId}/enrichment/start` | 210 | Restart enrichment |
| `src/resources/bom_uploads.tsx` | `/api/customer/upload/{id}` | 946 | Delete upload |
| `src/resources/bom_uploads.tsx` | `/api/boms/{bomId}/enrichment/start` | 1322 | Re-enrich |
| `src/resources/bom_jobs.tsx` | `/api/boms/{bomId}/enrichment/start` | 90 | Start enrichment |
| `src/pages/BOMEnrichment.tsx` | `/api/boms/{bomId}/enrichment/start` | 257, 352 | Start/restart enrichment |
| `src/bom/Old/BOMUploadSimple.tsx` | `/boms/upload/` | 175, 200 | **DEPRECATED** |

**Note**: Old components in `src/bom/Old/` are marked as disabled and reference non-existent backend (port 27200).

---

## Required Changes

### Phase 1: Update CNS API Client

**File**: `src/services/cnsApi.ts`

Add new project-scoped upload method:

```typescript
/**
 * Upload BOM file to a specific project (project-scoped endpoint)
 * Organization context is derived server-side from auth token
 *
 * @param projectId - Project UUID (required, used in URL path)
 * @param files - BOM file(s) to upload
 * @returns Upload response with job_id and column mappings
 */
async uploadBOMToProject(
  projectId: string,
  files: File[]
): Promise<UploadBOMResponse> {
  const formData = new FormData();

  // Add all files to form data
  files.forEach((file) => {
    formData.append('file', file);
  });

  // DO NOT add organization_id to body - server derives it

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${this.baseURL}/api/boms/projects/${projectId}/boms/upload`,
    {
      method: 'POST',
      headers: authHeaders,  // Includes X-Organization-Id header
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: response.statusText
    }));
    throw new Error(
      errorData.message || `Upload failed: ${response.statusText}`
    );
  }

  return response.json();
}
```

**Key Changes**:
- Endpoint URL: `/api/boms/projects/{projectId}/boms/upload`
- NO `organization_id` in request body
- Server derives organization from `X-Organization-Id` header (already set by `getAuthHeaders()`)
- Project ID in URL path (scoped access)

---

### Phase 2: Update Main Upload Component

**File**: `src/bom/BOMUploadWorkflow.tsx`

**Current Code** (lines 346-438):
```typescript
const uploadSingleFile = async (queueIndex: number) => {
  // ...
  const formData = new FormData();
  formData.append('file', item.file);
  formData.append('organization_id', tenantId);  // ← REMOVE THIS

  const uploadResponse = await fetch(`${getCnsBaseUrl()}/api/customer/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  // ...
}
```

**Required Changes**:

1. **Import the new method**:
```typescript
import { cnsApi } from '../services/cnsApi';
```

2. **Replace fetch call with API client**:
```typescript
const uploadSingleFile = async (queueIndex: number) => {
  const item = queue[queueIndex];

  try {
    if (!tenantId) {
      throw new Error('No organization selected.');
    }
    if (!currentProjectId) {
      throw new Error('No project selected.');
    }

    // Step 1: Parse file (unchanged)
    setQueue((prev) => prev.map((it, idx) =>
      (idx === queueIndex ? { ...it, status: 'parsing' } : it)
    ));
    const parsed = await parseBOMFile(item.file);

    // Step 2: Verify session (unchanged)
    const auth0Token = localStorage.getItem('auth0_access_token');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!auth0Token && !sessionData?.session) {
      throw new Error('Please log in to upload BOMs');
    }

    // Step 3: Upload to project-scoped endpoint
    setQueue((prev) => prev.map((it, idx) =>
      (idx === queueIndex ? { ...it, status: 'uploading' } : it)
    ));

    const uploadResult = await cnsApi.uploadBOMToProject(
      currentProjectId,
      [item.file]
    );

    // Step 4: Save to Supabase (unchanged, but remove organization_id from insert)
    const { data: uploadRecord, error: insertError } = await supabase
      .from('bom_uploads')
      .insert({
        filename: item.file.name,
        file_size: item.file.size,
        file_type: item.file.name.split('.').pop()?.toLowerCase() || 'csv',
        // organization_id is set by RLS policy server-side, don't send it
        project_id: currentProjectId,
        uploaded_by: dbUserId || null,
        upload_source: 'customer_portal',
        s3_bucket: uploadResult.s3_bucket,
        s3_key: uploadResult.s3_key,
        storage_backend: uploadResult.storage_backend,
        status: 'mapping_pending',
        detected_columns: parsed.detected_mappings.reduce(
          (acc, m) => ({ ...acc, [m.source]: m.target }),
          {}
        ),
        unmapped_columns: parsed.unmapped_columns,
        total_rows: parsed.total_rows,
        preview_data: parsed.rows.slice(0, 10),
      })
      .select()
      .single();

    // ... rest unchanged
  } catch (error: unknown) {
    // ... error handling
  }
};
```

**Key Changes**:
- Use `cnsApi.uploadBOMToProject(projectId, [file])` instead of direct fetch
- Remove `organization_id` from FormData
- Rely on `X-Organization-Id` header set by `getAuthHeaders()`
- Keep project_id in Supabase insert (still needed for FK)

---

### Phase 3: Update Enrichment Endpoint Calls

**Files to Update**:
- `src/bom/BOMUploadWorkflow.tsx` (lines 191, 647)
- `src/bom/intake/EnrichmentQueueSection.tsx` (line 210)
- `src/resources/bom_uploads.tsx` (line 1322)
- `src/resources/bom_jobs.tsx` (line 90)
- `src/pages/BOMEnrichment.tsx` (lines 257, 352)

**Current Pattern**:
```typescript
const response = await fetch(`${getCnsBaseUrl()}/api/boms/${bomId}/enrichment/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders },
  body: JSON.stringify({
    organization_id: tenantId,      // ← REMOVE
    project_id: currentProjectId,   // ← Keep if needed
    user_id: currentUserId,
    priority: 7,
  }),
});
```

**If Backend Accepts Project-Scoped Enrichment**:
```typescript
// Option A: Project-scoped enrichment endpoint
const response = await fetch(
  `${getCnsBaseUrl()}/api/boms/projects/${projectId}/boms/${bomId}/enrichment/start`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      // organization_id removed - server derives it
      user_id: currentUserId,
      priority: 7,
    }),
  }
);
```

**If Backend Still Uses BOM-Scoped Enrichment** (current endpoint):
```typescript
// Option B: Remove organization_id from body, keep endpoint as-is
const response = await fetch(`${getCnsBaseUrl()}/api/boms/${bomId}/enrichment/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders },
  body: JSON.stringify({
    // organization_id removed - server derives from headers or BOM record
    project_id: currentProjectId,  // Keep if server needs it
    user_id: currentUserId,
    priority: 7,
  }),
});
```

**Decision Required**: Check with backend team if enrichment endpoint should also be project-scoped or if removing `organization_id` from body is sufficient.

---

### Phase 4: Remove Deprecated Upload Code

**Files to Remove/Deprecate**:
- `src/bom/Old/BOMUploadSimple.tsx` - References non-existent Django backend
- `src/bom/Old/BOMUploadWizard.tsx` - Check if still in use
- `src/bom/Old/BOMUploadWorkflow_DirectCNS.tsx` - Old workflow
- `src/bom/Old/BOMUploadWorkflow_original.tsx` - Original workflow

**File to Update**:
- `src/providers/djangoDataProvider.ts` - Update or remove BOM upload logic (line 246)

**Action**:
1. Verify these old files are not imported anywhere
2. Remove or archive to separate `_archive/` folder
3. Update any remaining references to use new CNS client

---

## Error Handling Updates

### New HTTP Error Codes to Handle

The new project-scoped endpoint will return:

| Status | Scenario | Current Handling |
|--------|----------|------------------|
| 403 Forbidden | User lacks permission to upload to project | Generic error message |
| 404 Not Found | Project does not exist | Generic error message |
| 422 Unprocessable | Validation errors (file format, size) | Partial handling exists |
| 500 Server Error | Backend processing failure | Generic error handling |

**Required Changes**:

Update error handling in `uploadSingleFile` method:

```typescript
try {
  const uploadResult = await cnsApi.uploadBOMToProject(
    currentProjectId,
    [item.file]
  );
} catch (error: unknown) {
  let message = 'Unknown upload error';

  if (error instanceof Error) {
    message = error.message;

    // Enhanced error messages based on status codes
    if (message.includes('403') || message.includes('Forbidden')) {
      message = 'You do not have permission to upload BOMs to this project. Please contact your administrator.';
    } else if (message.includes('404') || message.includes('Not Found')) {
      message = 'Project not found. It may have been deleted. Please select a different project.';
    } else if (message.includes('422')) {
      message = `Invalid file: ${message}. Please check the file format and try again.`;
    }
  }

  setQueue((prev) =>
    prev.map((it, idx) =>
      (idx === queueIndex ? { ...it, status: 'error', error: message } : it)
    )
  );
  notify(`Upload failed: ${message}`, { type: 'error' });
}
```

---

## Testing Requirements

### 1. Unit Tests (New)

Create test file: `src/services/cnsApi.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cnsApi } from './cnsApi';

describe('CNS API Client - Project-Scoped Upload', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.setItem('current_organization_id', 'org-123');
  });

  it('should upload BOM to project-scoped endpoint', async () => {
    const mockResponse = {
      job_id: 'job-456',
      filename: 'test.csv',
      total_items: 100,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const result = await cnsApi.uploadBOMToProject('proj-789', [file]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/boms/projects/proj-789/boms/upload'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Organization-Id': 'org-123',
        }),
      })
    );
    expect(result.job_id).toBe('job-456');
  });

  it('should NOT include organization_id in request body', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    await cnsApi.uploadBOMToProject('proj-789', [file]);

    const formData = (global.fetch as any).mock.calls[0][1].body;
    // FormData should only contain 'file', not 'organization_id'
    expect(formData.has('organization_id')).toBe(false);
  });

  it('should handle 403 Forbidden error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Access denied' }),
    });

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });

    await expect(
      cnsApi.uploadBOMToProject('proj-789', [file])
    ).rejects.toThrow('Access denied');
  });
});
```

### 2. Integration Tests

**Test Scenarios**:

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Happy Path** | 1. Select project<br>2. Upload BOM file<br>3. Confirm mappings<br>4. Start enrichment | BOM uploaded successfully, enrichment starts |
| **No Project Selected** | 1. Navigate to upload page<br>2. Try to upload | Redirect to dashboard with warning |
| **Invalid Project** | 1. Set invalid project_id in localStorage<br>2. Upload BOM | 404 error with user-friendly message |
| **No Permission** | 1. Login as viewer role<br>2. Try to upload BOM | 403 error with permission message |
| **Large File** | 1. Upload 15MB file | 422 error with size limit message |
| **Unsupported Format** | 1. Upload .txt file | Validation error before upload |
| **Network Error** | 1. Disconnect network<br>2. Upload BOM | Retry option shown, clear error message |

### 3. Manual Testing Checklist

- [ ] Upload single CSV file to project
- [ ] Upload multiple files (batch upload)
- [ ] Upload Excel (.xlsx) file
- [ ] Upload without project selected (should redirect)
- [ ] Upload to project in different organization (should fail with 403)
- [ ] Upload to deleted project (should fail with 404)
- [ ] Resume upload workflow from URL parameters
- [ ] Start enrichment after upload
- [ ] View enrichment progress
- [ ] Re-enrich failed items
- [ ] Delete upload from bom_uploads list
- [ ] Archive upload

---

## Migration Checklist

### Pre-Migration

- [ ] **Backend Readiness**: Confirm CNS service has deployed project-scoped endpoint
- [ ] **API Documentation**: Get OpenAPI spec for new endpoint
- [ ] **Auth Testing**: Verify `X-Organization-Id` header is validated server-side
- [ ] **Database Migration**: Ensure Supabase RLS policies handle organization context
- [ ] **Feature Flag**: Create feature flag `VITE_USE_PROJECT_SCOPED_UPLOAD` for gradual rollout

### Development Phase

- [ ] **Create branch**: `feature/cns-project-scoped-upload`
- [ ] **Phase 1**: Update `cnsApi.ts` with new method
- [ ] **Phase 2**: Update `BOMUploadWorkflow.tsx`
- [ ] **Phase 3**: Update enrichment endpoint calls (6 files)
- [ ] **Phase 4**: Remove deprecated code
- [ ] **Write tests**: Unit tests for API client
- [ ] **Update error handling**: Enhanced user messages
- [ ] **Update types**: TypeScript interfaces for new responses

### Testing Phase

- [ ] **Unit tests pass**: All new tests green
- [ ] **Integration tests**: Test upload flow end-to-end
- [ ] **Manual testing**: Complete checklist above
- [ ] **Cross-browser**: Test in Chrome, Firefox, Safari, Edge
- [ ] **Mobile testing**: Test on iOS and Android
- [ ] **Error scenarios**: Test all failure cases
- [ ] **Performance**: Upload large files (10MB+)

### Deployment Phase

- [ ] **Staging deployment**: Deploy to staging environment
- [ ] **Smoke tests**: Quick validation on staging
- [ ] **Feature flag ON**: Enable for internal users only
- [ ] **Monitor errors**: Check Sentry/logs for issues
- [ ] **Gradual rollout**: 10% → 50% → 100% users
- [ ] **Performance monitoring**: Check upload latency metrics
- [ ] **Rollback plan**: Document rollback steps if needed

### Post-Deployment

- [ ] **Remove feature flag**: After 1 week of stable operation
- [ ] **Remove old code**: Delete deprecated files
- [ ] **Update documentation**: Update README and API docs
- [ ] **Team communication**: Notify team of changes
- [ ] **Knowledge base**: Update support docs

---

## Configuration Changes

### Environment Variables

**No new environment variables needed**. The existing `VITE_CNS_API_URL` is sufficient.

**Current**:
```bash
VITE_CNS_API_URL=http://localhost:27800
```

**If using feature flag for gradual rollout**:
```bash
# Feature flag for project-scoped upload (temporary)
VITE_USE_PROJECT_SCOPED_UPLOAD=true
```

---

## API Endpoint Comparison

### Old (Organization-Scoped)

**Endpoint**: `POST /api/customer/upload`

**Request**:
```http
POST /api/customer/upload HTTP/1.1
Authorization: Bearer <token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="bom.csv"
Content-Type: text/csv

<file data>
--boundary
Content-Disposition: form-data; name="organization_id"

a1111111-1111-1111-1111-111111111111
--boundary--
```

**Issues**:
- Client can send arbitrary `organization_id`
- No project scoping
- Harder to enforce project-level permissions

---

### New (Project-Scoped)

**Endpoint**: `POST /api/boms/projects/{project_id}/boms/upload`

**Request**:
```http
POST /api/boms/projects/b2222222-2222-2222-2222-222222222222/boms/upload HTTP/1.1
Authorization: Bearer <token>
X-Organization-Id: a1111111-1111-1111-1111-111111111111
X-User-Email: user@example.com
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="bom.csv"
Content-Type: text/csv

<file data>
--boundary--
```

**Benefits**:
- Organization ID in header (read-only from auth token)
- Project ID in URL path (enforces project scoping)
- Server validates user has access to project
- Better audit trail (project context in URL)

---

## Security Improvements

### Current Security Issues

1. **Client-Supplied Organization ID**:
   - Client sends `organization_id` in request body
   - Malicious user could upload to different organization
   - Requires careful server-side validation

2. **No Project-Level Enforcement**:
   - Project ID is metadata, not access control
   - Upload endpoint doesn't verify project membership

### New Security Model

1. **Server-Derived Organization**:
   - Organization ID extracted from auth token
   - Validated against `X-Organization-Id` header
   - Client cannot override

2. **Project-Scoped Access**:
   - URL contains project ID
   - Server verifies user has project access before accepting upload
   - Returns 403 if access denied

3. **Defense in Depth**:
   - Header validation (X-Organization-Id)
   - URL path validation (project_id)
   - Token validation (JWT)
   - RLS policies (Supabase)

---

## Performance Considerations

### Unchanged

- File parsing is client-side (no change)
- MinIO upload speed (depends on network)
- Supabase insert latency (no change)

### Potential Improvements

- **Reduced Payload**: Removing `organization_id` from body slightly reduces request size
- **Server-Side Caching**: Server can cache project→organization mapping
- **Connection Pooling**: Reuse database connections for project validation

### Monitoring Metrics

Track these metrics pre/post migration:

| Metric | Current Baseline | Target | Alert Threshold |
|--------|------------------|--------|-----------------|
| Upload API P50 latency | TBD ms | < +50ms | > +100ms |
| Upload API P99 latency | TBD ms | < +100ms | > +200ms |
| Upload error rate | TBD % | < +0.5% | > +2% |
| 403 error count | 0 | Monitor trend | > 10/hour |
| 404 error count | 0 | Monitor trend | > 5/hour |

---

## Rollback Plan

### If Issues Occur Post-Deployment

**Symptoms**:
- Upload error rate spikes
- 403/404 errors increase
- User complaints about upload failures

**Rollback Steps**:

1. **Immediate (< 5 minutes)**:
   - Toggle feature flag OFF: `VITE_USE_PROJECT_SCOPED_UPLOAD=false`
   - Deploy flag change to production
   - Verify uploads work with old endpoint

2. **Short-term (< 1 hour)**:
   - Revert frontend deployment to previous version
   - Monitor error rates return to baseline
   - Communicate rollback to team

3. **Investigation**:
   - Review backend logs for auth failures
   - Check Sentry for client-side errors
   - Analyze failed upload requests
   - Identify root cause

4. **Fix & Re-deploy**:
   - Fix identified issues in development
   - Test thoroughly in staging
   - Gradual rollout again (10% → 50% → 100%)

**Rollback Code** (if feature flag used):

```typescript
// In uploadSingleFile method
const useProjectScopedUpload = import.meta.env.VITE_USE_PROJECT_SCOPED_UPLOAD === 'true';

if (useProjectScopedUpload) {
  // New project-scoped upload
  const uploadResult = await cnsApi.uploadBOMToProject(currentProjectId, [item.file]);
} else {
  // Old organization-scoped upload (fallback)
  const formData = new FormData();
  formData.append('file', item.file);
  formData.append('organization_id', tenantId);
  const uploadResponse = await fetch(`${getCnsBaseUrl()}/api/customer/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const uploadResult = await uploadResponse.json();
}
```

---

## Questions for Backend Team

1. **Enrichment Endpoint**: Should enrichment also use project-scoped endpoint (`/api/boms/projects/{project_id}/boms/{bom_id}/enrichment/start`)?

2. **Organization Validation**: Does the new endpoint validate `X-Organization-Id` header against JWT claims?

3. **Project Ownership**: If a user has access to project but not organization, what happens? (Expected: 403)

4. **Backward Compatibility**: Will the old `/api/customer/upload` endpoint remain active during migration?

5. **Rate Limiting**: Are rate limits applied per-organization or per-project?

6. **Error Responses**: Can we get consistent error response format for 403/404?
   ```json
   {
     "error": {
       "code": "FORBIDDEN",
       "message": "You do not have permission to upload to this project",
       "details": {}
     }
   }
   ```

7. **File Size Limits**: Are limits enforced per-project or globally?

8. **Audit Logging**: Does backend log project_id for all upload events?

---

## Related Documentation

- **CNS Service API**: `app-plane/services/cns-service/README.md`
- **Customer Portal Setup**: `QUICK_START.md`
- **BOM Upload Flow**: `IMPLEMENTATION_SUMMARY.md`
- **Multi-Org UI Spec**: `src/specs/MULTI_ORG_UI_SPEC.md`
- **Project Context**: Check if there's a projects context/provider

---

## File Modification Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/services/cnsApi.test.ts` | Unit tests for new upload method |

### Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/services/cnsApi.ts` | Add `uploadBOMToProject()` method | ~40 new lines |
| `src/bom/BOMUploadWorkflow.tsx` | Use new API method, remove org_id from body | Lines 346-438, 191, 647 |
| `src/bom/intake/EnrichmentQueueSection.tsx` | Remove org_id from enrichment start | Line 210 |
| `src/resources/bom_uploads.tsx` | Remove org_id from enrichment start | Line 1322 |
| `src/resources/bom_jobs.tsx` | Remove org_id from enrichment start | Line 90 |
| `src/pages/BOMEnrichment.tsx` | Remove org_id from enrichment start (2x) | Lines 257, 352 |

### Files to Remove/Deprecate

| File | Action | Reason |
|------|--------|--------|
| `src/bom/Old/BOMUploadSimple.tsx` | Archive | References non-existent backend |
| `src/bom/Old/BOMUploadWizard.tsx` | Review | Check if still used |
| `src/bom/Old/BOMUploadWorkflow_DirectCNS.tsx` | Archive | Old implementation |
| `src/bom/Old/BOMUploadWorkflow_original.tsx` | Archive | Original implementation |
| `src/providers/djangoDataProvider.ts` | Update or remove | BOM upload logic for old backend |

---

## Timeline Estimate

| Phase | Duration | Depends On |
|-------|----------|------------|
| **Backend Deployment** | 1-2 days | Backend team completes endpoint |
| **Frontend Development** | 3-5 days | Backend deployment complete |
| **Testing & QA** | 2-3 days | Development complete |
| **Staging Deployment** | 1 day | Testing complete |
| **Gradual Rollout** | 1 week | Staging validation |
| **Full Deployment** | 1 day | No critical issues in rollout |
| **Cleanup & Documentation** | 2 days | Full deployment stable |

**Total**: ~2-3 weeks from backend deployment to full production rollout.

---

## Contact

**Questions or Issues**: Contact the frontend development team or create a ticket in the project management system.

**Document Owner**: Frontend Developer Agent

**Last Updated**: 2025-12-14
