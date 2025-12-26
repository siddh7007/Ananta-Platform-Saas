# Phase 3 Quick Reference Card

**Status:** ✅ COMPLETE - Ready for Testing
**Last Updated:** 2025-12-14

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [PHASE_3_COMPLETION_SUMMARY.md](PHASE_3_COMPLETION_SUMMARY.md) | Full implementation summary |
| [PHASE_3_IMPLEMENTATION_PLAN.md](PHASE_3_IMPLEMENTATION_PLAN.md) | Implementation plan & analysis |
| [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md) | Overall integration plan |

---

## Updated Endpoints

### Phase 3: Workspace CRUD Endpoints (All Require Auth)

```bash
# Get Workspace
GET /api/workspaces/{workspace_id}

# Update Workspace (requires admin role)
PUT /api/workspaces/{workspace_id}

# Delete Workspace (requires admin role, cannot delete default)
DELETE /api/workspaces/{workspace_id}
```

**Key Changes:**
- ✅ ALL endpoints now use `@require_workspace` decorator
- ✅ Server derives `organization_id` from workspace FK (not client-supplied)
- ✅ Cross-tenant access automatically denied (HTTP 404)
- ✅ Missing/invalid JWT returns HTTP 401
- ✅ Business logic checks maintained (admin role, is_default protection)

---

## Quick Test

```bash
# 1. Get JWT token (from browser DevTools or login)
TOKEN="your-jwt-token-here"

# 2. Get Workspace ID from your organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT w.id, w.name, o.name as org_name
FROM workspaces w
JOIN organizations o ON w.organization_id = o.id
LIMIT 1;"

# 3. Test endpoints
WORKSPACE_ID="your-workspace-id-here"

# Test GET
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"

# Test PUT (requires admin role)
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Workspace", "description": "New description"}' \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"

# Test DELETE (requires admin role, fails if is_default=true)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"

# 4. Check logs
docker logs app-plane-cns-service --tail 20 | grep -E "\[Workspaces\]"
```

---

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Service Status | ✅ RUNNING | Restarted 2025-12-14 |
| Auth Required | ✅ YES | All Phase 3 endpoints |
| Scope Validation | ✅ ENABLED | @require_workspace decorator |

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
curl "http://localhost:27200/api/workspaces/any-id"
```

### Check Logs for Access
```bash
docker logs app-plane-cns-service --tail 50 | grep -E "\[Workspaces\]"
# Should show: [Workspaces] ... (org=..., user=...)
```

---

## Files Modified

| File | Purpose | Lines Changed |
|------|---------|---------------|
| [app/api/workspaces.py](app/api/workspaces.py) | Workspace CRUD endpoints | ~60 modified, ~90 removed |

**Total:** ~60 lines modified, ~90 lines removed (net: -30 lines)

---

## Success Indicators

### Logs
```bash
# Successful access shows:
[Workspaces] Getting workspace {id} (org={org_id}, user={user_id})
[Workspaces] Updating workspace {id} (org={org_id}, user={user_id})
[Workspaces] Deleting workspace {id} (org={org_id}, user={user_id})
```

### Database
```bash
# Workspace has proper FK chain
SELECT w.id, w.organization_id, w.name, w.is_default, o.name as org_name
FROM workspaces w
JOIN organizations o ON w.organization_id = o.id
WHERE w.id = '{workspace_id}';
# organization_id should be non-NULL
```

### API Response (Success - GET)
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "name": "My Workspace",
  "slug": "my-workspace",
  "description": "Workspace description",
  "is_default": false,
  "settings": {},
  "user_role": "admin",
  "created_at": "2025-12-14T...",
  "updated_at": "2025-12-14T..."
}
```

### API Response (Success - PUT)
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "name": "Updated Workspace",
  "description": "New description",
  ...
}
```

### API Response (Success - DELETE)
**Status Code:** HTTP 204 (No Content)

### API Response (Cross-Tenant Denied)
```json
{
  "detail": "Workspace {workspace_id} not found or does not belong to your organization"
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

### API Response (Not Admin Role)
```json
{
  "detail": "Admin role required to update workspace"
}
```
**Status Code:** HTTP 403

### API Response (Cannot Delete Default)
```json
{
  "detail": "Cannot delete the default workspace"
}
```
**Status Code:** HTTP 400

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

### Issue: "Workspace not found" for valid workspace ID

**Cause:** JWT org doesn't match workspace's organization

**Fix:**
```bash
# Verify JWT org_id claim
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.org_id'

# Verify workspace's organization
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT w.id, w.organization_id
FROM workspaces w
WHERE w.id = '{workspace_id}';"

# They must match!
```

### Issue: "Admin role required" for update/delete

**Cause:** User is not an admin in the workspace

**Fix:**
```bash
# Check user's role in workspace
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT wm.user_id, wm.role, w.name as workspace_name
FROM workspace_memberships wm
JOIN workspaces w ON wm.workspace_id = w.id
WHERE wm.workspace_id = '{workspace_id}'
  AND wm.user_id = '{user_id}';"

# Role must be 'admin' for updates/deletes
```

### Issue: "Cannot delete default workspace"

**Cause:** Attempting to delete workspace with is_default=true

**Fix:**
```bash
# Check if workspace is default
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT id, name, is_default FROM workspaces WHERE id = '{workspace_id}';"

# If is_default=true, you cannot delete it
# Set another workspace as default first, or use a different workspace
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
| FK Chain Validation | ✅ ACTIVE | Workspace → Organization verified |
| Server-Derived Tenant ID | ✅ ACTIVE | No client-supplied organization_id accepted |
| Cross-Tenant Isolation | ✅ ACTIVE | Users cannot access other orgs' workspaces |
| Audit Logging | ✅ ACTIVE | All access attempts logged |
| Staff Bypass | ✅ ACTIVE | Platform admins can access all workspaces |
| Business Logic Checks | ✅ ACTIVE | Admin role required for updates/deletes |
| Default Protection | ✅ ACTIVE | Default workspace cannot be deleted |

---

## Comparison: Before vs After

### Endpoint: GET /workspaces/{workspace_id}

**Before Phase 3:**
```python
async def get_workspace(workspace_id: str, user: User):
    with get_supabase_session() as session:
        org_context = get_org_context(user)
        workspace = get_workspace_or_404(workspace_id, session, org_context)
        # Manual validation
        # Context manager session handling
    return workspace
```

**After Phase 3:**
```python
@require_workspace(enforce=True, log_access=True)
async def get_workspace(
    workspace_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    # Authenticated + Validated
    scope = request.state.validated_scope
    organization_id = scope["tenant_id"]
    # ... secure access with dependency injection ...
```

### Endpoint: PUT /workspaces/{workspace_id}

**Before Phase 3:**
```python
async def update_workspace(workspace_id: str, data: dict, user: User):
    with get_supabase_session() as session:
        org_context = get_org_context(user)
        workspace = get_workspace_or_404(workspace_id, session, org_context)
        require_workspace_admin(workspace, user)
        # Manual validation
        # Update logic
        # Implicit transaction (no commit)
```

**After Phase 3:**
```python
@require_workspace(enforce=True, log_access=True)
async def update_workspace(
    workspace_id: str,
    data: UpdateWorkspaceRequest,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    # Server-derived organization_id
    scope = request.state.validated_scope
    organization_id = scope["tenant_id"]

    # Business logic check (not scope validation)
    if workspace.user_role != 'admin':
        raise HTTPException(403, ...)

    # Update logic
    db.commit()  # Explicit transaction
```

---

## Next Steps

1. ⏭️ **Testing:** Execute test scenarios
2. ⏭️ **Phase 3b:** Apply scope validation to workspace member endpoints
3. ⏭️ **Phase 3c:** Apply scope validation to workspace invitation endpoints
4. ⏭️ **Phase 4:** Create project CRUD endpoints with scope validation
5. ⏭️ **Frontend:** Update Customer Portal error handling

---

## Support

**Documentation:**
- Full summary: [PHASE_3_COMPLETION_SUMMARY.md](PHASE_3_COMPLETION_SUMMARY.md)
- Implementation plan: [PHASE_3_IMPLEMENTATION_PLAN.md](PHASE_3_IMPLEMENTATION_PLAN.md)
- Integration plan: [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md)

**Logs:**
```bash
# Real-time logs
docker logs -f app-plane-cns-service

# Filter for workspace operations
docker logs app-plane-cns-service 2>&1 | grep -iE "workspace"

# Filter for auth events
docker logs app-plane-cns-service 2>&1 | grep -iE "auth|401|403|not found"
```

**Database Queries:**
```bash
# Check workspace FK chain
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT w.id, w.name, w.organization_id, w.is_default,
       o.name as org_name,
       COUNT(p.id) as project_count
FROM workspaces w
JOIN organizations o ON w.organization_id = o.id
LEFT JOIN projects p ON p.workspace_id = w.id
GROUP BY w.id, o.name
ORDER BY w.created_at DESC LIMIT 5;"
```

---

**Status:** ✅ Phase 3 COMPLETE - Ready for Testing
**Date:** 2025-12-14
**Next:** Execute test scenarios

---

## Test Checklist

- [ ] Test authenticated access to all 3 endpoints
- [ ] Test cross-tenant access denial (HTTP 404)
- [ ] Test missing JWT (HTTP 401)
- [ ] Test invalid JWT (HTTP 401)
- [ ] Test update without admin role (HTTP 403)
- [ ] Test delete without admin role (HTTP 403)
- [ ] Test delete default workspace (HTTP 400)
- [ ] Test staff bypass (platform admin)
- [ ] Verify logs show `[Workspaces]` markers
- [ ] Verify database FK chain is intact
- [ ] Check service is running (`docker ps`)

---

**Phase 3:** ✅ COMPLETE
