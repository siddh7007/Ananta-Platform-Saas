# Organization/Tenant ID Handling Fixes

## Summary

Fixed missing `organization_id` parameter handling in Customer Portal hooks that communicate with CNS API. In our multi-tenant architecture, `tenant_id` (Control Plane) = `organization_id` (App Plane/CNS).

## Architecture Context

| Layer | Terminology | API Parameter | Example Use |
|-------|-------------|---------------|-------------|
| **Control Plane** | `tenant` | `tenant_id`, `tenantId` | tenant-management-service, admin-app |
| **App Plane/CNS** | `organization` | `organization_id` | CNS service, customer-portal, Supabase |

**These are THE SAME entity** - just named differently based on the architectural layer.

## Files Modified

### 1. useProcessingStatus.ts
**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\hooks\useProcessingStatus.ts`

**Changes**:
- Imported `useOrganizationId()` hook from TenantContext
- Added `organizationId` extraction in hook body
- Updated all CNS API calls to include `organization_id` as query parameter:
  - `GET /bom/workflow/${bomId}/processing-status` - Added `params: { organization_id: organizationId }`
  - SSE endpoint `/bom/workflow/${bomId}/processing-stream` - Added `?organization_id=${organizationId}`
  - `POST /bom/workflow/${bomId}/pause` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/resume` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/cancel` - Added `params: { organization_id: organizationId }`
- Added validation to ensure `organizationId` exists before making API calls
- Updated dependency arrays in useCallback hooks to include `organizationId`

**Example**:
```typescript
// Before
const response = await cnsApi.get<ProcessingStatusAPI>(
  `/bom/workflow/${bomId}/processing-status`
);

// After
const organizationId = useOrganizationId();
const response = await cnsApi.get<ProcessingStatusAPI>(
  `/bom/workflow/${bomId}/processing-status`,
  {
    params: { organization_id: organizationId },
  }
);
```

### 2. useProcessingJobs.ts
**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\hooks\useProcessingJobs.ts`

**Changes**:
- Imported `useOrganizationId()` hook from TenantContext
- Added `organizationId` extraction in hook body
- Updated all CNS API calls to include `organization_id` as query parameter:
  - `GET /bom/workflow/jobs` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/pause` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/resume` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/cancel` - Added `params: { organization_id: organizationId }`
  - `POST /bom/workflow/${bomId}/restart` - Added `params: { organization_id: organizationId }`
- Added validation to ensure `organizationId` exists before making API calls
- Updated dependency arrays in useCallback hooks to include `organizationId`

**Example**:
```typescript
// Before
await cnsApi.post(`/bom/workflow/${bomId}/pause`);

// After
const organizationId = useOrganizationId();
await cnsApi.post(`/bom/workflow/${bomId}/pause`, null, {
  params: { organization_id: organizationId },
});
```

### 3. bom.service.ts (Already Correct)
**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\services\bom.service.ts`

**Status**: Already correctly uses `getTenantIdOrNull()` helper and passes `organization_id` in FormData for BOM uploads. No changes needed.

### 4. axios.ts (Helpers Available)
**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\lib\axios.ts`

**Status**: Already provides helper functions:
- `getTenantIdOrNull()`: Get tenant ID with fallback
- `assertTenantContext()`: Throw error if no tenant selected
- Axios interceptor automatically adds `X-Tenant-Id` header

## CNS API Requirements

According to `CLAUDE.md`:
> CNS service requires `organization_id` for workspace queries
> Always pass these as direct query parameters (not in LoopBack filter object)

All CNS API calls now properly include `organization_id` as a **query parameter**, not in request body or headers.

## Testing Checklist

- [ ] BOM upload works with organization_id passed
- [ ] Processing status fetches correctly with organization_id
- [ ] SSE stream connects with organization_id parameter
- [ ] Pause/resume/cancel controls work with organization_id
- [ ] Processing jobs list fetches with organization_id
- [ ] Job control endpoints (pause/resume/cancel/restart) work
- [ ] Error handling works when no organization is selected
- [ ] Multi-tenant isolation is enforced (users only see their org's data)

## Related Files (TenantContext)

**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\contexts\TenantContext.tsx`

**Key Hooks**:
```typescript
// For Control Plane API calls:
const tenantId = useTenantId();

// For App Plane/CNS API calls:
const organizationId = useOrganizationId();  // Returns same value as useTenantId()
```

Both hooks return the same value (`currentTenant?.id`), but are named differently for clarity based on the API being called.

## Impact

All CNS API calls from Customer Portal now properly include multi-tenant context via `organization_id` parameter. This ensures:
1. Proper data isolation between organizations
2. CNS service can filter data by organization
3. Workflow operations are scoped to the correct organization
4. No cross-tenant data leakage

## References

- `CLAUDE.md` - Section "CRITICAL: Tenant ID = Organization ID Mapping"
- TenantContext implementation with `useOrganizationId()` hook
- CNS API expects `organization_id` as query parameter
