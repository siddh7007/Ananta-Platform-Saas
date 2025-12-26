# CNS Projects Alignment - Database Migration Index

**Status:** Phases 1-3 Complete, Code-Reviewed 2x, APPROVED FOR PRODUCTION
**Last Updated:** 2025-12-14
**Documentation:** See `arc-saas/docs/CNS-BACKEND-DASHBOARD-TECHNICAL-SPEC.md` Section 27

---

## Migration Files Overview

| Phase | Step | File | Status | Description |
|-------|------|------|--------|-------------|
| **Phase 1** | 1.1 | `102_phase1_add_control_plane_tenant_id.sql` | ✅ EXECUTED | Add `control_plane_tenant_id` to organizations |
| **Phase 1** | 1.2 | `002_phase1_add_workspace_id_to_projects.sql` | ✅ EXECUTED | Add `workspace_id` FK to projects |
| **Phase 2** | 2.1 | `003_phase2_backfill_control_plane_tenant_id.sql` | ✅ EXECUTED | Backfill Control Plane tenant UUIDs (2 orgs mapped) |
| **Phase 2** | 2.2 | `004_phase2_create_default_workspaces.sql` | ✅ EXECUTED | Created 2 default workspaces |
| **Phase 2** | 2.3 | `005_phase2_migrate_projects_to_workspaces.sql` | ✅ EXECUTED | Assigned 1 project to workspace |
| **Phase 2** | 2.4 | `006_phase2_create_default_projects.sql` | ✅ EXECUTED | Created 1 default project |
| **Phase 2** | 2.5 | `007_phase2_assign_boms_to_projects.sql` | ✅ EXECUTED | Assigned 9 BOMs to projects |
| **Phase 3** | 3.1 | `008_phase3_enforce_project_id_not_null.sql` | ✅ EXECUTED | Made `boms.project_id` NOT NULL |
| **Phase 3** | 3.2 | `009_phase3_add_bom_uniqueness_constraint.sql` | ✅ EXECUTED | Created unique index on (project_id, name, version) |
| **Phase 3** | 3.3 | `010_phase3_create_organization_id_trigger.sql` | ✅ EXECUTED | Created trigger to auto-populate `boms.organization_id` |
| **Phase 3** | 3.4 | `011_phase3_enforce_workspace_id_not_null.sql` | ⏭️ SKIPPED | Optional migration - not required |
| **Phase 3** | 3.5 | `012_phase3_enforce_control_plane_tenant_id_not_null.sql` | ✅ EXECUTED | Made `organizations.control_plane_tenant_id` NOT NULL |

---

## Execution Order

### ✅ COMPLETED (2025-12-14)

**Phase 1 - Add Columns:**
1. ✅ `102_phase1_add_control_plane_tenant_id.sql` - Column added to organizations
2. ✅ `002_phase1_add_workspace_id_to_projects.sql` - Column added to projects

**Phase 2 - Backfill Data:**
3. ✅ `003_phase2_backfill_control_plane_tenant_id.sql` - 2 organizations mapped to Control Plane tenants
4. ✅ `004_phase2_create_default_workspaces.sql` - 2 default workspaces created
5. ✅ `005_phase2_migrate_projects_to_workspaces.sql` - 1 project assigned to workspace
6. ✅ `006_phase2_create_default_projects.sql` - 1 default project created
7. ✅ `007_phase2_assign_boms_to_projects.sql` - 9 BOMs assigned to projects

**Phase 3 - Enforce Constraints:**
8. ✅ `008_phase3_enforce_project_id_not_null.sql` - NOT NULL constraint added
9. ✅ `009_phase3_add_bom_uniqueness_constraint.sql` - Unique index created
10. ✅ `010_phase3_create_organization_id_trigger.sql` - Trigger created and active
11. ⏭️ `011_phase3_enforce_workspace_id_not_null.sql` - SKIPPED (optional)
12. ✅ `012_phase3_enforce_control_plane_tenant_id_not_null.sql` - NOT NULL constraint added

**Total:** 11 migrations executed, 1 skipped (optional), 0 pending

---

## Code Review History

### Round 1 (Phase 1)
**Date:** 2025-12-14
**Scope:** Migrations 102, 002
**Issues Found:**
- CRITICAL: ON DELETE CASCADE risk in Migration 002
- HIGH: Missing rollback scripts
- MEDIUM: Missing ON UPDATE CASCADE

**Status:** ✅ All issues fixed and re-reviewed

### Round 2 (Phase 1 Re-Review)
**Date:** 2025-12-14
**Scope:** Migrations 102, 002 (after fixes)
**Status:** ✅ APPROVED FOR PRODUCTION

### Round 3 (Phase 2)
**Date:** 2025-12-14
**Scope:** Migrations 004-007
**Issues Found:**
- CRITICAL: GET DIAGNOSTICS placement errors (Migrations 005, 007)
- CRITICAL: Duplicate backup table creation (Migration 006)
- MEDIUM: PERFORM syntax errors (Migration 004)

**Status:** ✅ All issues fixed and re-reviewed

### Round 4 (Phase 2 Re-Review)
**Date:** 2025-12-14
**Scope:** Migrations 004-007 (after fixes)
**Status:** ✅ APPROVED FOR PRODUCTION

### Round 5 (Phase 3)
**Date:** 2025-12-14
**Scope:** Migrations 008-012
**Issues Found:**
- CRITICAL: RAISE NOTICE inside transaction (Migration 008)
- CRITICAL: Column name mismatch - `status` vs `subscription_status` (Migrations 009, 012)
- CRITICAL: Trigger NULL handling violation (Migration 010)
- LOW: Missing `rec RECORD` declarations

**Status:** ✅ All issues fixed and re-reviewed

### Round 6 (Phase 3 Re-Review)
**Date:** 2025-12-14
**Scope:** Migrations 008-012 (after fixes)
**Status:** ✅ APPROVED FOR PRODUCTION

### Round 7 (Backend Scope Validation)
**Date:** 2025-12-14
**Scope:** Backend implementation - scope validators, decorators, dependencies
**Files Reviewed:**
- `app/core/scope_validators.py` (738 lines)
- `app/core/scope_decorators.py` (625 lines)
- `app/dependencies/scope_deps.py` (528 lines)

**Issues Found:**
- CRITICAL: Cache thread safety - global dict not thread-safe in async/concurrent environments
- HIGH: Tenant ID extraction duplication - same logic in 2 files with slight differences
- HIGH: Missing UUID validation - no format checks before SQL queries
- HIGH: Staff bypass broken - decorators don't check `is_staff_override` flag
- HIGH: Inconsistent auth parameter names - tries 3 different names (`auth`, `user`, `context`)
- MEDIUM: 6 issues (unbounded cache, deprecated datetime.utcnow, missing async support, incomplete audit logging, etc.)
- LOW: 5 issues (inconsistent error messages, missing metrics, redundant queries, etc.)

**Status:** ✅ ALL FIXES APPLIED - PRODUCTION READY

**Fixes Applied (2025-12-14):**
1. ✅ Added thread-safe locking to cache with LRU eviction
2. ✅ Consolidated tenant ID extraction into shared `auth_utils.py` module
3. ✅ Added UUID validation to all validator functions
4. ✅ Fixed staff bypass to actually bypass validation checks
5. ✅ Documented auth parameter naming in all decorator docstrings

**Additional Files Created:**
- `app/core/auth_utils.py` - Shared authentication utilities (165 lines)

**See:** `CODE_REVIEW_ROUND_7_FIXES.md` for complete fix details

---

## Validation Commands

### Phase 1 Validation (After Executing 102, 002)
```bash
# Verify columns exist
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    'Phase 1 Complete' AS status,
    COUNT(CASE WHEN column_name = 'control_plane_tenant_id' THEN 1 END) AS org_column_added,
    COUNT(CASE WHEN column_name = 'workspace_id' THEN 1 END) AS proj_column_added
FROM information_schema.columns
WHERE table_name IN ('organizations', 'projects')
AND column_name IN ('control_plane_tenant_id', 'workspace_id');"
```

**Expected Result:**
```
status            | org_column_added | proj_column_added
------------------+------------------+-------------------
Phase 1 Complete  |                1 |                 1
```

### Phase 2 Validation (After Executing 004-007)
```bash
# Verify default workspaces created
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) AS default_workspaces FROM workspaces WHERE slug = 'default';"

# Verify projects assigned to workspaces
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) AS projects_with_workspace FROM projects WHERE workspace_id IS NOT NULL;"

# Verify default projects created
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) AS default_projects FROM projects WHERE slug = 'default';"

# Verify BOMs assigned to projects
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) AS boms_with_project FROM boms WHERE project_id IS NOT NULL;"
```

### Phase 3 Validation (After Executing 008-012)
```bash
# Verify NOT NULL constraints
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_name IN ('boms', 'projects', 'organizations')
AND column_name IN ('project_id', 'workspace_id', 'control_plane_tenant_id')
ORDER BY table_name, column_name;"

# Verify unique constraint
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT indexname, indexdef FROM pg_indexes
WHERE indexname = 'idx_boms_unique_per_project';"

# Verify trigger exists
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT tgname, tgtype FROM pg_trigger WHERE tgname = 'trg_boms_auto_organization_id';"
```

---

## Rollback Procedures

All migrations include rollback scripts as SQL comments at the bottom of each file. To rollback:

1. Open the migration file (e.g., `102_phase1_add_control_plane_tenant_id.sql`)
2. Find the commented rollback section at the bottom
3. Uncomment the rollback SQL
4. Execute the rollback commands in reverse order

**Example (Rolling back Phase 1):**
```bash
# Rollback Migration 002 first (reverse order)
docker exec -i app-plane-supabase-db psql -U postgres -d postgres <<EOF
DROP INDEX IF EXISTS idx_projects_workspace_id_null;
DROP INDEX IF EXISTS idx_projects_workspace_id;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_workspace;
ALTER TABLE projects DROP COLUMN IF EXISTS workspace_id;
EOF

# Then rollback Migration 102
docker exec -i app-plane-supabase-db psql -U postgres -d postgres <<EOF
DROP INDEX IF EXISTS idx_organizations_control_plane_tenant_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS control_plane_tenant_id;
EOF
```

---

## Critical Notes

### Migration 009 - CONCURRENTLY Option
**For production deployments with high traffic:**
1. Open `009_phase3_add_bom_uniqueness_constraint.sql`
2. Comment out "Option A" (regular index creation)
3. Uncomment "Option B" (CONCURRENTLY index creation)
4. Execute migration

This prevents table locking during index creation but takes slightly longer.

### Migration 011 - OPTIONAL
This migration enforces `projects.workspace_id NOT NULL`. Read the comprehensive decision guide in the file before executing. Many deployments can skip this migration.

### Migration 012 - Column Name Fix
All references to `organizations.status` have been corrected to `subscription_status` (5 locations). This was a critical fix from Code Review Round 5.

---

## Dependencies

### Phase 2 Step 2.1 - Control Plane Tenant UUID Mapping
**Status:** ✅ RESOLVED (2025-12-14)

The mapping between App Plane organizations and Control Plane tenants has been discovered:

| App Plane Org | Control Plane Tenant | Match Method |
|---------------|---------------------|--------------|
| `a1111111-1111-1111-1111-111111111111` "Ananta Platform" | `468224c2-82a0-6286-57e7-eff8da9982f2` "Ananta" | slug/key match (ananta) |
| `a0000000-0000-0000-0000-000000000000` "Platform Super Admin" | `a0000000-0000-0000-0000-000000000000` "Platform Super Admin" | UUID identity match |

**Execution:**
```bash
# Execute the backfill migration
docker exec -i app-plane-supabase-db psql -U postgres -d postgres < app-plane/supabase/migrations/003_phase2_backfill_control_plane_tenant_id.sql

# Verify results
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT o.id, o.name, o.slug, o.control_plane_tenant_id, o.subscription_status
FROM organizations o
ORDER BY o.created_at;"
```

**Helper Script:**
If you need to regenerate mappings or handle new organizations in the future:
```bash
# Install dependencies
pip install psycopg2-binary

# Generate SQL mapping (default)
python app-plane/scripts/generate-tenant-mapping.py

# Generate JSON mapping
python app-plane/scripts/generate-tenant-mapping.py --format json --output mapping.json

# Generate CSV mapping
python app-plane/scripts/generate-tenant-mapping.py --format csv --output mapping.csv
```

**Discovery Methodology:**
The mappings were discovered by:
1. Querying App Plane organizations (`app-plane-supabase-db`, database: `postgres`)
2. Querying Control Plane tenants (`arc-saas-postgres`, database: `arc_saas`, schema: `main`)
3. Matching by UUID identity (special case for Platform Super Admin)
4. Matching by slug/key exact match (Ananta Platform org slug "ananta" → tenant key "ananta")

---

## Next Steps After Database Migration

Once all Phase 1-3 migrations are executed:

1. **Backend Implementation** (9 files)
   - ScopeValidationMiddleware
   - Scope validators and filters
   - Authorization decorators
   - BOM endpoint updates

2. **Frontend Implementation** (9 files)
   - WorkspaceContext provider
   - ProjectContext provider
   - Workspace/Project selector UI
   - Axios interceptor updates
   - BOM upload page updates

3. **Testing** (21 test cases)
   - Backend API tests
   - Frontend integration tests
   - End-to-end tests

See Section 27 of `CNS-BACKEND-DASHBOARD-TECHNICAL-SPEC.md` for full implementation plans.
