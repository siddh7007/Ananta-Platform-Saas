# Migration 003 - Control Plane Tenant UUID Mapping - Execution Guide

**Migration File:** `003_phase2_backfill_control_plane_tenant_id.sql`
**Phase:** 2.1
**Status:** ✅ READY TO EXECUTE
**Created:** 2025-12-14

---

## Overview

This migration resolves the **CRITICAL BLOCKER** for Phase 2 by mapping App Plane organizations to Control Plane tenant UUIDs. Once executed, all subsequent Phase 2 and Phase 3 migrations can proceed.

**What This Migration Does:**
1. Creates a temporary mapping table linking App Plane orgs to Control Plane tenants
2. Validates the mapping (no duplicates, all active orgs mapped, UUIDs valid)
3. Backfills `organizations.control_plane_tenant_id` with the correct tenant UUIDs
4. Provides comprehensive validation output

---

## Discovered Mappings

The following mappings were discovered by querying both databases on 2025-12-14:

| App Plane Organization | Control Plane Tenant | Match Method |
|------------------------|---------------------|--------------|
| `a1111111-1111-1111-1111-111111111111`<br>"Ananta Platform"<br>slug: `ananta` | `468224c2-82a0-6286-57e7-eff8da9982f2`<br>"Ananta"<br>key: `ananta` | **slug/key exact match** |
| `a0000000-0000-0000-0000-000000000000`<br>"Platform Super Admin"<br>slug: `platform-super-admin` | `a0000000-0000-0000-0000-000000000000`<br>"Platform Super Admin"<br>key: `platform` | **UUID identity match**<br>(same UUID in both systems) |

---

## Prerequisites

### 1. Phase 1 Must Be Complete

Verify Phase 1 migrations have been executed:
```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name = 'control_plane_tenant_id';"
```

**Expected Output:**
```
       column_name        | data_type | is_nullable
--------------------------+-----------+-------------
 control_plane_tenant_id  | uuid      | YES
```

If the column doesn't exist, execute Phase 1 Migration 102 first.

### 2. Both Databases Are Running

Verify Docker containers are up:
```bash
docker ps --filter "name=app-plane-supabase-db" --filter "name=arc-saas-postgres" --format "table {{.Names}}\t{{.Status}}"
```

**Expected Output:**
```
NAMES                      STATUS
app-plane-supabase-db      Up X minutes
arc-saas-postgres          Up X minutes
```

### 3. Current State Check

Verify organizations currently have NULL `control_plane_tenant_id`:
```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    id,
    name,
    slug,
    control_plane_tenant_id,
    subscription_status
FROM organizations
ORDER BY created_at;"
```

**Expected Output (before migration):**
```
                  id                  |         name         |         slug         | control_plane_tenant_id | subscription_status
--------------------------------------+----------------------+----------------------+-------------------------+---------------------
 a1111111-1111-1111-1111-111111111111 | Ananta Platform      | ananta               |                         | active
 a0000000-0000-0000-0000-000000000000 | Platform Super Admin | platform-super-admin |                         | active
```

---

## Execution Steps

### Step 1: Backup Current State (Optional but Recommended)

```bash
# Export organizations table before migration
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
COPY (SELECT * FROM organizations) TO STDOUT WITH CSV HEADER;" > organizations_backup_$(date +%Y%m%d_%H%M%S).csv
```

### Step 2: Execute the Migration

```bash
# Navigate to the migrations directory
cd e:\Work\Ananta-Platform-Saas\app-plane\supabase\migrations

# Execute the migration
docker exec -i app-plane-supabase-db psql -U postgres -d postgres < 003_phase2_backfill_control_plane_tenant_id.sql
```

### Step 3: Review Migration Output

The migration will output detailed logs. Look for these key indicators:

**Validation Phase:**
```
NOTICE:  [VALIDATION] Total organizations in App Plane: 2
NOTICE:  [VALIDATION] Total mappings in temp table: 2
NOTICE:  [VALIDATION] ✓ All active organizations have mappings
NOTICE:  [VALIDATION] ✓ No duplicate mappings
NOTICE:  [VALIDATION] ✓ All mappings verified
NOTICE:  [VALIDATION] All validation checks passed. Proceeding with backfill.
```

**Migration Phase:**
```
NOTICE:  [MIGRATION] Starting backfill of control_plane_tenant_id...
NOTICE:  [MIGRATION] Updated 2 organizations with Control Plane tenant IDs
NOTICE:  [MAPPING] ✓ Org "Ananta Platform" (..., slug: ananta) → Tenant "Ananta" (..., key: ananta) via slug_key_match
NOTICE:  [MAPPING] ✓ Org "Platform Super Admin" (..., slug: platform-super-admin) → Tenant "Platform Super Admin" (..., key: platform) via uuid_match
NOTICE:  [MIGRATION] Backfill completed successfully.
```

**Post-Validation Phase:**
```
NOTICE:  [POST-VALIDATION] ✓ All active organizations have control_plane_tenant_id
NOTICE:  [POST-VALIDATION] ✓ Total organizations mapped: 2 / 2
NOTICE:  [POST-VALIDATION] === FINAL MAPPING SUMMARY ===
NOTICE:  [MAPPED] Ananta Platform (slug: ananta) → 468224c2-82a0-6286-57e7-eff8da9982f2 [status: active]
NOTICE:  [MAPPED] Platform Super Admin (slug: platform-super-admin) → a0000000-0000-0000-0000-000000000000 [status: active]
NOTICE:  [POST-VALIDATION] ✓ Migration 003 completed successfully
```

### Step 4: Verify Results

```bash
# Verify all organizations have control_plane_tenant_id populated
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    o.id,
    o.name,
    o.slug,
    o.control_plane_tenant_id,
    o.subscription_status
FROM organizations o
ORDER BY o.created_at;"
```

**Expected Output (after migration):**
```
                  id                  |         name         |         slug         |        control_plane_tenant_id       | subscription_status
--------------------------------------+----------------------+----------------------+--------------------------------------+---------------------
 a1111111-1111-1111-1111-111111111111 | Ananta Platform      | ananta               | 468224c2-82a0-6286-57e7-eff8da9982f2 | active
 a0000000-0000-0000-0000-000000000000 | Platform Super Admin | platform-super-admin | a0000000-0000-0000-0000-000000000000 | active
```

### Step 5: Verify No NULL Values for Active Organizations

```bash
# Ensure no active organizations have NULL control_plane_tenant_id
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT id, name, subscription_status, control_plane_tenant_id
FROM organizations
WHERE control_plane_tenant_id IS NULL
AND subscription_status IN ('active', 'trialing');"
```

**Expected Output:**
```
 id | name | subscription_status | control_plane_tenant_id
----+------+---------------------+-------------------------
(0 rows)
```

If any rows are returned, the migration failed for those organizations. See the Troubleshooting section.

---

## Validation Queries

### Count Mapped Organizations
```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    COUNT(*) AS total_orgs,
    COUNT(control_plane_tenant_id) AS mapped_orgs,
    COUNT(*) - COUNT(control_plane_tenant_id) AS unmapped_orgs
FROM organizations;"
```

**Expected Output:**
```
 total_orgs | mapped_orgs | unmapped_orgs
------------+-------------+---------------
          2 |           2 |             0
```

### Verify UUID Format
```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT
    id,
    name,
    control_plane_tenant_id,
    CASE
        WHEN control_plane_tenant_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN 'valid'
        ELSE 'invalid'
    END AS uuid_format
FROM organizations
WHERE control_plane_tenant_id IS NOT NULL;"
```

**Expected Output:**
```
                  id                  |         name         |        control_plane_tenant_id       | uuid_format
--------------------------------------+----------------------+--------------------------------------+-------------
 a1111111-1111-1111-1111-111111111111 | Ananta Platform      | 468224c2-82a0-6286-57e7-eff8da9982f2 | valid
 a0000000-0000-0000-0000-000000000000 | Platform Super Admin | a0000000-0000-0000-0000-000000000000 | valid
```

### Cross-Reference with Control Plane

Verify the UUIDs exist in Control Plane tenants table:
```bash
docker exec -e PGPASSWORD=postgres arc-saas-postgres psql -U postgres -d arc_saas -c "
SELECT id, key, name, status
FROM main.tenants
WHERE id IN (
    '468224c2-82a0-6286-57e7-eff8da9982f2',
    'a0000000-0000-0000-0000-000000000000'
)
ORDER BY created_on;"
```

**Expected Output:**
```
                  id                  |   key    |         name         | status
--------------------------------------+----------+----------------------+--------
 468224c2-82a0-6286-57e7-eff8da9982f2 | ananta   | Ananta               |      1
 a0000000-0000-0000-0000-000000000000 | platform | Platform Super Admin |      0
```

Both tenant IDs should exist in the Control Plane database.

---

## Troubleshooting

### Issue: "column control_plane_tenant_id does not exist"

**Cause:** Phase 1 Migration 102 was not executed.

**Solution:**
```bash
# Execute Migration 102 first
docker exec -i app-plane-supabase-db psql -U postgres -d postgres < 102_phase1_add_control_plane_tenant_id.sql

# Then retry Migration 003
docker exec -i app-plane-supabase-db psql -U postgres -d postgres < 003_phase2_backfill_control_plane_tenant_id.sql
```

### Issue: "Duplicate mappings detected"

**Cause:** The temp_tenant_mapping table has multiple rows with the same app_org_id.

**Solution:** This should not happen with the provided migration file. If it does, check the INSERT statement in Step 2 of the migration file for duplicate entries.

### Issue: "All mappings must be verified"

**Cause:** One or more mappings have `verified = FALSE` in the temp_tenant_mapping table.

**Solution:** Edit the migration file Step 2 INSERT statement and set `verified = TRUE` for all mappings after manual review.

### Issue: "X active organizations have no mapping"

**Cause:** New organizations exist that were not present when the migration was created.

**Solution:**
1. Use the helper script to regenerate mappings:
   ```bash
   python app-plane/scripts/generate-tenant-mapping.py --format json --output new_mappings.json
   ```
2. Review the new mappings
3. Edit Migration 003 Step 2 to add the new mappings
4. Re-execute the migration

### Issue: Some Organizations Still Have NULL control_plane_tenant_id

**Cause:** The organizations were not included in the temp_tenant_mapping table.

**Solution:**
1. Identify unmapped organizations:
   ```bash
   docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
   SELECT id, name, slug, subscription_status
   FROM organizations
   WHERE control_plane_tenant_id IS NULL
   AND subscription_status = 'active';"
   ```
2. Query Control Plane for matching tenants
3. Add the mappings to Migration 003 and re-execute

---

## Rollback Procedure

If you need to undo this migration (e.g., to re-run with different mappings):

### Rollback Command
```bash
docker exec -i app-plane-supabase-db psql -U postgres -d postgres <<EOF
-- Reset control_plane_tenant_id to NULL for the two mapped organizations
UPDATE organizations
SET control_plane_tenant_id = NULL
WHERE control_plane_tenant_id IN (
    '468224c2-82a0-6286-57e7-eff8da9982f2',
    'a0000000-0000-0000-0000-000000000000'
);
EOF
```

### Verify Rollback
```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
SELECT COUNT(*) AS orgs_with_tenant_id
FROM organizations
WHERE control_plane_tenant_id IS NOT NULL;"
```

**Expected Output (after rollback):**
```
 orgs_with_tenant_id
---------------------
                   0
```

After rollback, you can edit the migration file and re-execute.

---

## Next Steps

Once this migration completes successfully:

1. **Mark Phase 2 Step 2.1 as COMPLETE** in the migration index
2. **Proceed to Migration 004** - Create default workspaces
3. **Continue with Phase 2 Steps 2.2-2.5**
4. **Proceed to Phase 3** after all Phase 2 migrations complete

See `PHASE_1_2_3_MIGRATION_INDEX.md` for the full execution order.

---

## Helper Script Reference

### Generate SQL Mapping (Future Organizations)

If new organizations are added to App Plane in the future, use the helper script to discover mappings:

```bash
# Install dependencies (one-time)
pip install psycopg2-binary

# Generate SQL mapping
cd e:\Work\Ananta-Platform-Saas\app-plane\scripts
python generate-tenant-mapping.py > new_mapping.sql

# Review the output
cat new_mapping.sql

# Edit Migration 003 to add new mappings
# Then re-execute
```

### Generate JSON or CSV

```bash
# JSON format (for programmatic processing)
python generate-tenant-mapping.py --format json --output mapping.json

# CSV format (for spreadsheet review)
python generate-tenant-mapping.py --format csv --output mapping.csv
```

### Adjust Minimum Similarity Score

By default, the script requires a similarity score of 50 to auto-map. Adjust this if needed:

```bash
# Require higher confidence (90 = exact slug/key match)
python generate-tenant-mapping.py --min-score 90

# Allow lower confidence matches (30 = date proximity)
python generate-tenant-mapping.py --min-score 30
```

---

## Summary

**Current State:** Phase 2 blocked due to missing Control Plane tenant UUID mapping
**After This Migration:** Phase 2 unblocked, all 2 organizations have `control_plane_tenant_id` populated
**Next Migration:** `004_phase2_create_default_workspaces.sql`

**Estimated Execution Time:** < 1 second
**Risk Level:** LOW (only populates NULL column, no data deletion)
**Rollback Available:** YES (see Rollback Procedure above)

---

**Questions or Issues?**
Refer to `PHASE_1_2_3_MIGRATION_INDEX.md` or the inline comments in `003_phase2_backfill_control_plane_tenant_id.sql`.
