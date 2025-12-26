# Phase 2 Quick Reference Card

**Status:** ✅ COMPLETE - Ready for Testing
**Last Updated:** 2025-12-14

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md) | Full implementation summary |
| [PHASE_2_IMPLEMENTATION_PLAN.md](PHASE_2_IMPLEMENTATION_PLAN.md) | Implementation plan & analysis |
| [PHASE_1_COMPLETION_SUMMARY.md](PHASE_1_COMPLETION_SUMMARY.md) | Phase 1 summary (BOM upload) |
| [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md) | Overall integration plan |

---

## Updated Endpoints

### Phase 2: BOM Read Endpoints (All Require Auth)

```bash
# Line Items List
GET /api/boms/{bom_id}/line_items?page=1&page_size=100

# Single Line Item
GET /api/boms/{bom_id}/line_items/{item_id}

# Enrichment Status
GET /api/boms/{bom_id}/enrichment/status

# Components with Enrichment Data
GET /api/boms/{bom_id}/components?page=1&page_size=50
```

**Key Changes:**
- ✅ ALL endpoints now require `Authorization: Bearer {JWT}` header
- ✅ Server derives `organization_id` from BOM FK chain (not client-supplied)
- ✅ Cross-tenant access automatically denied (HTTP 404)
- ✅ Missing/invalid JWT returns HTTP 401

---

## Quick Test

```bash
# 1. Get JWT token (from browser DevTools or login)
TOKEN="your-jwt-token-here"

# 2. Get BOM ID from your organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT b.id, b.name, o.name as org_name
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
JOIN organizations o ON w.organization_id = o.id
LIMIT 1;"

# 3. Test endpoints
BOM_ID="your-bom-id-here"

# Test line items
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/line_items"

# Test enrichment status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/enrichment/status"

# Test components
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/components"

# 4. Check logs
docker logs app-plane-cns-service --tail 20 | grep -E "\\[OK\\]|BOM Line Items|BOM Enrichment|BOM Components"
```

---

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Service Status | ✅ RUNNING | Restarted 2025-12-14 |
| Auth Required | ✅ YES | All Phase 2 endpoints |
| Scope Validation | ✅ ENABLED | @require_bom decorator |

---

## Verification Commands

### Check Service Status
```bash
docker ps | grep cns-service
# Should show: Up X minutes
```

### Check Endpoints Require Auth
```bash
# Should return HTTP 401 (not authenticated)
curl "http://localhost:27200/api/boms/any-id/line_items"
```

### Check Logs for Access
```bash
docker logs app-plane-cns-service --tail 50 | grep -E "BOM Line Items|BOM Enrichment|BOM Components"
# Should show: [BOM ...] ... (org=..., user=...)
```

---

## Files Modified

| File | Purpose | Lines Changed |
|------|---------|---------------|
| [app/api/bom_line_items.py](app/api/bom_line_items.py) | Line items endpoints | ~90 modified, ~90 removed |
| [app/api/bom_enrichment.py](app/api/bom_enrichment.py) | Enrichment & components | ~70 modified, ~135 removed |

**Total:** ~160 lines modified, ~225 lines removed (net: -65 lines)

---

## Success Indicators

### Logs
```bash
# Successful access shows:
[BOM Line Items] Listing line items for BOM {id} (org={org_id}, user={user_id}, page=1)
[BOM Line Items] Getting line item {item_id} from BOM {bom_id} (org={org_id}, user={user_id})
[BOM Enrichment] Getting enrichment status for BOM {id} (org={org_id}, user={user_id})
[BOM Components] Getting components for BOM {id} (org={org_id}, user={user_id}, page=1)
```

### Database
```bash
# BOM has proper FK chain
SELECT b.id, b.organization_id, b.project_id, p.workspace_id, w.organization_id
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
WHERE b.id = '{bom_id}';
# All should be non-NULL
```

### API Response (Success)
```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 100
}
```

### API Response (Cross-Tenant Denied)
```json
{
  "detail": "BOM {bom_id} not found or does not belong to your organization"
}
```
**Status Code:** HTTP 404

### API Response (No Auth)
```json
{
  "detail": "Not authenticated"
}
```
**Status Code:** HTTP 401

---

## Troubleshooting

### Issue: "Not authenticated" for valid JWT

**Cause:** JWT token expired or invalid

**Fix:**
```bash
# Get fresh JWT token from Keycloak
# Check token expiration
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.exp'
```

### Issue: "BOM not found" for valid BOM ID

**Cause:** JWT org doesn't match BOM's organization

**Fix:**
```bash
# Verify JWT org_id claim
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.org_id'

# Verify BOM's organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT b.id, w.organization_id
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
WHERE b.id = '{bom_id}';"

# They must match!
```

### Issue: Service not responding

**Cause:** Service not running or crashed

**Fix:**
```bash
docker logs app-plane-cns-service --tail 50
docker-compose restart cns-service
```

---

## Security Features

| Feature | Status | Description |
|---------|--------|-------------|
| JWT Verification | ✅ ACTIVE | All tokens validated against Keycloak |
| FK Chain Validation | ✅ ACTIVE | BOM → Project → Workspace → Org verified |
| Server-Derived Tenant ID | ✅ ACTIVE | No client-supplied organization_id accepted |
| Cross-Tenant Isolation | ✅ ACTIVE | Users cannot access other orgs' BOMs |
| Audit Logging | ✅ ACTIVE | All access attempts logged |
| Staff Bypass | ✅ ACTIVE | Platform admins can access all BOMs |

---

## Comparison: Before vs After

### Endpoint: GET /boms/{bom_id}/line_items/{item_id}

**Before Phase 2:**
```python
# NO AUTHENTICATION ⚠️
async def get_bom_line_item(bom_id: str, item_id: str):
    # Anyone could access
    line_item = db.query(...)
    return line_item
```

**After Phase 2:**
```python
@require_bom(enforce=True, log_access=True)
async def get_bom_line_item(
    bom_id: str,
    item_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    # Authenticated + Validated
    scope = request.state.validated_scope
    organization_id = scope["tenant_id"]
    # ... secure access ...
```

### Endpoint: GET /boms/{bom_id}/components

**Before Phase 2:**
```python
async def get_bom_components(
    bom_id: str,
    organization_id: Optional[str] = None,  # Client-supplied
):
    # Optional auth
    # Manual validation if organization_id provided
```

**After Phase 2:**
```python
@require_bom(enforce=True, log_access=True)
async def get_bom_components(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    # Server-derived organization_id
    scope = request.state.validated_scope
    organization_id = scope["tenant_id"]
```

---

## Next Steps

1. ⏭️ **Testing:** Execute test scenarios
2. ⏭️ **Phase 3:** Apply scope validation to workspace endpoints
   - `GET /api/workspaces/{workspace_id}`
   - `POST /api/workspaces/{workspace_id}/projects`
3. ⏭️ **Phase 4:** Apply scope validation to project endpoints
   - `GET /api/projects/{project_id}`
   - `PATCH /api/projects/{project_id}`
4. ⏭️ **Frontend:** Update Customer Portal error handling

---

## Support

**Documentation:**
- Full summary: [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md)
- Implementation plan: [PHASE_2_IMPLEMENTATION_PLAN.md](PHASE_2_IMPLEMENTATION_PLAN.md)
- Integration plan: [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md)

**Logs:**
```bash
# Real-time logs
docker logs -f app-plane-cns-service

# Filter for BOM operations
docker logs app-plane-cns-service 2>&1 | grep -iE "bom|line items|enrichment|components"

# Filter for auth events
docker logs app-plane-cns-service 2>&1 | grep -iE "auth|401|403|not found"
```

**Database Queries:**
```bash
# Check BOM FK chain
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT b.id, b.name, b.organization_id, b.project_id,
       p.name as project, w.name as workspace, o.name as org
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
JOIN organizations o ON w.organization_id = o.id
ORDER BY b.created_at DESC LIMIT 5;"
```

---

**Status:** ✅ Phase 2 COMPLETE - Ready for Testing
**Date:** 2025-12-14
**Next:** Execute test scenarios

---

## Test Checklist

- [ ] Test authenticated access to all 4 endpoints
- [ ] Test cross-tenant access denial (HTTP 404)
- [ ] Test missing JWT (HTTP 401)
- [ ] Test invalid JWT (HTTP 401)
- [ ] Test staff bypass (platform admin)
- [ ] Verify logs show `[BOM ...]` markers
- [ ] Verify database FK chain is intact
- [ ] Check service is running (`docker ps`)

---

**Phase 2:** ✅ COMPLETE
