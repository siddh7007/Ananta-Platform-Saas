# Phase 1 Quick Reference Card

**Status:** ✅ COMPLETE - Ready for Testing
**Last Updated:** 2025-12-14

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [PHASE_1_COMPLETION_SUMMARY.md](PHASE_1_COMPLETION_SUMMARY.md) | Full implementation summary |
| [PHASE_1_TESTING_GUIDE.md](PHASE_1_TESTING_GUIDE.md) | Testing scenarios & commands |
| [PHASE_1_SIMPLIFICATION_SUMMARY.md](PHASE_1_SIMPLIFICATION_SUMMARY.md) | Simplification changes |
| [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md) | Overall integration plan |

---

## New Endpoint

### Primary Endpoint (Use This)
```bash
POST /api/boms/projects/{project_id}/boms/upload

# Example
curl -X POST "http://localhost:27200/api/boms/projects/550e8400-e29b-41d4-a716-446655440000/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@bom.csv" \
  -F "bom_name=My BOM" \
  -F "priority=normal" \
  -F "source=customer" \
  -F "start_enrichment=true"
```

**Key Changes from Legacy:**
- ❌ NO `organization_id` form parameter (server derives it)
- ✅ `project_id` in URL path (REQUIRED)
- ✅ Automatic scope validation
- ✅ Better error messages

### Legacy Endpoint (Backward Compatibility)
```bash
POST /api/boms/upload

# Still works - no breaking changes
```

---

## Quick Test

```bash
# 1. Get a project ID
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT p.id, p.name FROM projects p LIMIT 1;"

# 2. Get JWT token (from browser DevTools or login)
TOKEN="your-jwt-token-here"

# 3. Upload test BOM
curl -X POST "http://localhost:27200/api/boms/projects/{PROJECT_ID}/boms/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.csv"

# 4. Check logs
docker logs app-plane-cns-service --tail 20 | grep -E "\[OK\]|scoped"
```

---

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Feature Flag | `ENABLE_PROJECT_SCOPE_VALIDATION=true` | [app/config.py](app/config.py#L450-L454) |
| Default State | ENABLED | Simplified for early development |
| Service Status | ✅ RUNNING | Restarted 2025-12-14 |

**To Disable (if needed):**
```bash
# In .env or docker-compose.yml
ENABLE_PROJECT_SCOPE_VALIDATION=false

# Restart
docker-compose restart cns-service
```

---

## Verification Commands

### Check Service Status
```bash
docker ps | grep cns-service
# Should show: Up X minutes
```

### Check Feature Flag
```bash
docker exec app-plane-cns-service python -c \
  "from app.config import settings; print(f'ENABLED={settings.enable_project_scope_validation}')"
# Should output: ENABLED=True
```

### Check Endpoints
```bash
curl -s http://localhost:27200/openapi.json | \
  grep -o '"/api/boms/[^"]*upload[^"]*"' | sort -u
# Should show:
# "/api/boms/projects/{project_id}/boms/upload"
# "/api/boms/upload"
```

### Check Database
```bash
# Verify BOMs have project_id
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) as boms_with_project FROM boms WHERE project_id IS NOT NULL;"
# Should match total BOMs count
```

---

## Files Modified

| File | Purpose | Lines |
|------|---------|-------|
| [app/config.py](app/config.py#L450-L454) | Feature flag (enabled) | 5 |
| [app/auth/dependencies.py](app/auth/dependencies.py#L62) | User.tenant_id attribute | 4 |
| [app/api/boms_unified.py](app/api/boms_unified.py#L243-L797) | New scoped endpoint | ~555 |
| [app/core/auth_utils.py](app/core/auth_utils.py) | Shared auth utilities | 165 |

---

## Success Indicators

### Logs
```bash
# Successful upload shows:
[boms_unified] Scoped upload started by user=... to project=...
[boms_unified] Project {id} validated for organization {id}
[boms_unified] [OK] Created Supabase BOM {id} with X line items (scoped)
[boms_unified] Completed scoped upload: bom_id=...
```

### Database
```bash
# BOM has all required fields
SELECT id, organization_id, project_id, status FROM boms ORDER BY created_at DESC LIMIT 1;
# All should be non-NULL
```

### API Response
```json
{
  "bom_id": "uuid",
  "organization_id": "uuid",
  "component_count": 10,
  "status": "pending",
  "enrichment_started": true,
  "workflow_id": "bom-enrichment-uuid"
}
```

---

## Troubleshooting

### "Project not found"
**Cause:** JWT org doesn't match project's org
**Fix:** Verify JWT `org_id` matches project's `workspace.organization_id`

### "Unable to determine tenant_id"
**Cause:** JWT missing `org_id` claim
**Fix:** Check Keycloak token includes organization

### Feature flag not working
**Cause:** Service not restarted
**Fix:** `docker-compose restart cns-service`

---

## Next Steps

1. ⏭️ **Testing:** Execute scenarios from [PHASE_1_TESTING_GUIDE.md](PHASE_1_TESTING_GUIDE.md)
2. ⏭️ **Phase 2:** Apply scope validation to BOM read endpoints
3. ⏭️ **Phase 3:** Apply scope validation to workspace endpoints
4. ⏭️ **Phase 4:** Apply scope validation to project endpoints
5. ⏭️ **Frontend:** Update Customer Portal to use new endpoint

---

## Support

**Documentation:**
- Full summary: [PHASE_1_COMPLETION_SUMMARY.md](PHASE_1_COMPLETION_SUMMARY.md)
- Testing guide: [PHASE_1_TESTING_GUIDE.md](PHASE_1_TESTING_GUIDE.md)
- Integration plan: [BACKEND_INTEGRATION_PLAN.md](BACKEND_INTEGRATION_PLAN.md)

**Logs:**
```bash
# Real-time logs
docker logs -f app-plane-cns-service

# Filter for BOM operations
docker logs app-plane-cns-service 2>&1 | grep -i "bom\|upload"

# Filter for errors
docker logs app-plane-cns-service 2>&1 | grep -iE "error|exception|failed"
```

---

**Status:** ✅ Phase 1 COMPLETE - Ready for Testing
**Date:** 2025-12-14
**Next:** Execute test scenarios
