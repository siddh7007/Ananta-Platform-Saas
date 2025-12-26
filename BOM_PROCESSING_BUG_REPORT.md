# BOM Processing Flow - Bug Hunt Report

**Date:** 2025-12-17
**Scope:** BOM upload page blank UI issue - Type mismatches, status values, API response handling

---

## CRITICAL BUG #1: component_storage Value Mismatch

**Severity:** HIGH - Causes frontend to misinterpret enriched components as "not found"

### Location
- **Backend:** `app-plane/services/cns-service/app/workflows/bom_enrichment.py:2174, 2200`
- **Frontend:** `arc-saas/apps/customer-portal/src/hooks/useProcessingStatus.ts:122, 333`

### Issue
Backend writes `component_storage = 'database'` but frontend expects `component_storage = 'catalog'`.

**Backend code (line 2174):**
```python
component_storage = 'database',  # ❌ WRONG - should be 'catalog'
```

**Backend code (line 2200):**
```python
component_storage = 'redis',  # ✅ CORRECT - matches frontend expectation
```

**Frontend code (line 122):**
```typescript
component_storage?: 'catalog' | 'redis' | null;  // Expects 'catalog', not 'database'
```

**Frontend code (line 333):**
```typescript
const hasMatch = item.component_id || item.component_storage === 'redis' || item.redis_component_key;
// ❌ This will MISS components with component_storage='database'
// Because it checks for 'redis' but NOT 'database'
```

### Impact
1. Components successfully enriched to database catalog are marked as "not found" in UI
2. `buildComponentQueueFromLineItems()` marks them as `status: 'failed'` instead of `status: 'done'`
3. Component status breakdown shows incorrect counts:
   - `notFound` count is inflated
   - `productionReady` count is deflated
4. Queue progress card shows false failures

### Root Cause
Backend and frontend use different naming conventions:
- **Backend:** `'database'` = Components V2 catalog database
- **Frontend:** `'catalog'` = Component catalog

### Fix Required
**Option 1 (Backend change - RECOMMENDED):**
```python
# In app-plane/services/cns-service/app/workflows/bom_enrichment.py:2174
component_storage = 'catalog',  # Change 'database' → 'catalog'
```

**Option 2 (Frontend change):**
```typescript
// In arc-saas/apps/customer-portal/src/hooks/useProcessingStatus.ts:333
const hasMatch = item.component_id ||
                 item.component_storage === 'redis' ||
                 item.component_storage === 'database' ||  // Add this check
                 item.redis_component_key;
```

**Recommendation:** Option 1 (backend fix) is cleaner because:
- 'catalog' is more user-friendly and accurate (it's the component catalog DB)
- Aligns with frontend type definitions
- Avoids dual naming ('database' vs 'catalog' for same thing)

---

## CRITICAL BUG #2: enrichment_status Value Inconsistency

**Severity:** MEDIUM - May cause confusion but doesn't break core functionality

### Location
Multiple files across backend

### Issue
Backend uses FIVE different status values, but frontend only expects FOUR:

**Backend values found:**
1. `'pending'` ✅ Used everywhere
2. `'enriched'` ✅ Used in workflows
3. `'error'` ✅ Used in workflows
4. `'failed'` ✅ Used in API endpoints
5. `'completed'` ❌ EXTRA - only used in `bom.py:854`
6. `'processing'` ❌ EXTRA - only used in `bom_enrichment.py:394, 629`, `restart_bom_workflow.py:108`

**Frontend LineItemAPI type (line 119):**
```typescript
enrichment_status: 'pending' | 'enriched' | 'error' | 'failed' | 'completed';
```

**Frontend actually checks for (line 352-356):**
```typescript
if (item.enrichment_status === 'pending') { ... }
else if (item.enrichment_status === 'error' || item.enrichment_status === 'failed') { ... }
else if (item.enrichment_status === 'enriched' || item.enrichment_status === 'completed') { ... }
```

### Impact
- `'processing'` status falls through to default `'pending'` case (not critical)
- `'completed'` is handled same as `'enriched'` (works by accident)
- Confusion about which status to use when

### Files Using Non-Standard Values

**Using 'completed':**
- `app-plane/services/cns-service/app/api/bom.py:854`

**Using 'processing':**
- `app-plane/services/cns-service/app/api/bom_enrichment.py:394, 629`
- `app-plane/services/cns-service/scripts/restart_bom_workflow.py:108`
- `app-plane/services/cns-service/app/workers/enrichment_consumer.py:241`

**Using 'no_match' (another undocumented value):**
- `app-plane/services/cns-service/app/api/boms_unified.py:1785`

### Fix Required
**Standardize on 4 values:**
1. `'pending'` - Not yet processed
2. `'enriched'` - Successfully enriched (catalog or Redis)
3. `'error'` - Enrichment failed with error
4. `'failed'` - Enrichment completed but no match found

**Remove:**
- `'processing'` → Use `'pending'` during processing
- `'completed'` → Use `'enriched'`
- `'no_match'` → Use `'failed'`

---

## BUG #3: Missing Field Transformation in axios.ts

**Severity:** LOW - Field transformation exists but incomplete

### Location
- **File:** `arc-saas/apps/customer-portal/src/lib/axios.ts:28-76`

### Issue
The `transformSnakeToCamel()` function transforms BOM-specific fields BUT does not include ALL new fields from the line items response.

**Currently transformed:**
- `component_count` → `lineCount` ✅
- `enriched_count` → `enrichedCount` ✅
- `organization_id` → `organizationId` ✅
- etc.

**NOT transformed (but should be for consistency):**
- `lifecycle_status` (stays snake_case)
- `match_confidence` (stays snake_case)
- `component_storage` (stays snake_case)
- `redis_component_key` (stays snake_case)
- `enrichment_error` (stays snake_case)
- `manufacturer_part_number` (stays snake_case)
- `reference_designator` (stays snake_case)

### Impact
Frontend code mixes naming conventions:
```typescript
// From LineItemAPI interface
lifecycle_status?: string;      // snake_case ❌
match_confidence?: number;      // snake_case ❌
component_storage?: string;     // snake_case ❌
redis_component_key?: string;   // snake_case ❌
```

This works because TypeScript interfaces explicitly use snake_case, but it's inconsistent with the camelCase transformation philosophy.

### Fix Required (Optional - Low Priority)
Either:
1. **Full transformation:** Transform ALL fields to camelCase
2. **Document decision:** Keep line item fields as snake_case for consistency with API

Current approach (keeping them snake_case) is actually acceptable since:
- TypeScript interfaces explicitly define snake_case
- No transformation = no bugs from mapping errors
- Consistent with API response

**Recommendation:** Document this as intentional and update interface comments.

---

## BUG #4: Pydantic Model Field Name Inconsistency

**Severity:** LOW - Informational

### Location
- **Backend Model:** `app-plane/services/cns-service/app/api/bom_line_items.py:66-70`
- **Frontend Type:** `arc-saas/apps/customer-portal/src/hooks/useProcessingStatus.ts:110-129`

### Issue
Backend Pydantic model uses exact snake_case field names (correct) but comment says "needed for UI status display" without documenting the exact field contract.

**Backend model:**
```python
class BOMLineItemResponse(BaseModel):
    # ...
    # Enrichment result fields - needed for UI status display
    lifecycle_status: Optional[str] = None
    match_confidence: Optional[float] = None
    component_storage: Optional[str] = None  # 'catalog' or 'redis' or None  ❌ WRONG - says 'catalog' but backend uses 'database'
    redis_component_key: Optional[str] = None
```

**Comment mismatch:** Says `'catalog' or 'redis'` but code actually writes `'database'` (see Bug #1).

### Impact
Developer confusion when reading code - comment doesn't match implementation.

### Fix Required
Update comment to match actual values:
```python
component_storage: Optional[str] = None  # 'database' or 'redis' or None (database = Components V2 catalog)
```

OR fix Bug #1 and keep comment as-is.

---

## BUG #5: Stage Status Mapping Gap

**Severity:** LOW - Logged but not critical

### Location
- **File:** `arc-saas/apps/customer-portal/src/hooks/useProcessingStatus.ts:222-242`

### Issue
Frontend logs warning for unknown stage statuses but doesn't validate against actual backend values.

**Known statuses (line 222):**
```typescript
const KNOWN_STATUSES = new Set(['pending', 'in_progress', 'completed', 'failed', 'skipped', 'paused']);
```

**Backend actually uses (from bom_workflow.py):**
- Processing status: `'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'`
- Stage status: Various values in `ProcessingStageInfo`

**Missing status:** `'running'` is not in KNOWN_STATUSES but is used for workflow-level status.

### Impact
Console warnings for valid `'running'` status.

### Fix Required
Either:
1. Add `'running'` to KNOWN_STATUSES
2. Clarify that KNOWN_STATUSES is for **stage** status, not **workflow** status

**Recommendation:** Update comment to clarify scope:
```typescript
// Known valid STAGE statuses (not workflow statuses)
const KNOWN_STATUSES = new Set(['pending', 'in_progress', 'completed', 'failed', 'skipped', 'paused']);
```

---

## BUG #6: Processing Status Fallback Logic Incomplete

**Severity:** LOW - Edge case handling

### Location
- **File:** `app-plane/services/cns-service/app/api/bom_workflow.py:524-627`

### Issue
When no `bom_processing_jobs` record exists, the fallback logic maps old BOM status to new workflow status. But it doesn't handle all possible old status values.

**Handled statuses:**
- `'completed'` → workflow_status=`'completed'`
- `'analyzing'`, `'processing'`, `'enriching'` → workflow_status=`'running'`
- `'failed'` → workflow_status=`'failed'`
- `'cancelled'` → workflow_status=`'cancelled'`
- `'pending'` → workflow_status=`'pending'`

**Potentially missing:**
- What if `boms.status` is NULL?
- What if status is something else (typo, old value)?

**Current code (line 548):**
```python
bom_status = (bom_data.get("status") or "pending").lower()
```

This defaults to `"pending"` which is safe, but could mask issues.

### Impact
Minimal - gracefully degrades to pending.

### Fix Required (Optional)
Add logging for unknown statuses:
```python
bom_status = (bom_data.get("status") or "pending").lower()
known_statuses = {'completed', 'analyzing', 'processing', 'enriching', 'failed', 'cancelled', 'pending'}
if bom_status not in known_statuses:
    logger.warning(f"Unknown BOM status '{bom_status}' for {bom_id}, defaulting to 'pending'")
```

---

## Summary of Findings

| Bug # | Severity | Component | Issue | Fix Priority |
|-------|----------|-----------|-------|--------------|
| 1 | **HIGH** | Backend/Frontend | component_storage: 'database' vs 'catalog' mismatch | **P0 - IMMEDIATE** |
| 2 | MEDIUM | Backend | enrichment_status: 5+ values instead of 4 | P1 - High |
| 3 | LOW | Frontend | Incomplete field transformation (acceptable) | P3 - Optional |
| 4 | LOW | Backend | Comment doesn't match implementation | P2 - Documentation |
| 5 | LOW | Frontend | Missing 'running' in KNOWN_STATUSES | P3 - Optional |
| 6 | LOW | Backend | Incomplete fallback status handling | P3 - Optional |

---

## Recommended Fix Order

### Phase 1 (CRITICAL - Do Immediately)
1. **Fix Bug #1:** Change `component_storage = 'database'` to `component_storage = 'catalog'` in `bom_enrichment.py:2174`
2. **Update comment:** Fix `bom_line_items.py:68` comment to match actual values

### Phase 2 (Important - Next Sprint)
3. **Standardize enrichment_status:** Remove 'processing', 'completed', 'no_match' values
4. **Add logging:** Log unknown status values for early detection

### Phase 3 (Optional - Technical Debt)
5. **Document transformation:** Clarify snake_case vs camelCase policy in axios.ts
6. **Clarify KNOWN_STATUSES:** Add comment explaining scope

---

## Testing Recommendations

After fixing Bug #1, verify:
1. Upload BOM with components that match catalog
2. Wait for enrichment to complete
3. Check BOM upload page Queue Progress Grid:
   - Components should show as "Production Ready" (not "Not Found")
   - Component queue should show `status: 'done'` (not `status: 'failed'`)
   - Component status breakdown counts should be correct
4. Check database:
   ```sql
   SELECT id, mpn, component_storage, enrichment_status
   FROM bom_line_items
   WHERE bom_id = 'your-test-bom-id'
   LIMIT 10;
   ```
   - Verify `component_storage = 'catalog'` for enriched items

---

## Additional Notes

### Field Naming Philosophy
The codebase has two approaches:
1. **CNS API:** Keep snake_case throughout (current line items approach)
2. **Platform API:** Transform to camelCase at transport layer

Both are valid. The key is **consistency within each API**.

### Component Storage Types
- `'catalog'` (or `'database'`): Permanent storage in Components V2 DB - high quality components
- `'redis'`: Temporary storage - low quality components, needs review before promotion
- `null`: No enrichment data available

### Enrichment Status Lifecycle
```
pending → enriched (success with match)
        ↘ failed (no match found)
        ↘ error (enrichment failed with exception)
```

The `'processing'` intermediate state is unnecessary - items can stay `'pending'` while being processed.
