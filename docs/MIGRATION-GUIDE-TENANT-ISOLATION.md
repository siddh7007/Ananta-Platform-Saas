# Migration Guide: Tenant Isolation & Data Integrity Fixes

**Version**: 1.0
**Date**: 2025-12-16
**Status**: READY FOR STAGING

---

## Overview

This guide provides step-by-step instructions for applying critical database migrations to improve tenant isolation and data integrity across the Ananta Platform SaaS databases.

**Affected Databases**:
- Supabase (app-plane-supabase-db:27432)
- Control Plane (arc-saas-postgres:5432)

**Estimated Total Time**: 30-45 minutes
**Downtime Required**: NO (migrations can run with active connections)
**Rollback Available**: YES (SQL scripts provided)

---

## Pre-Migration Checklist

### 1. Backup All Databases

```bash
# Backup Supabase database
docker exec app-plane-supabase-db pg_dump -U postgres -d postgres \
  -F c -f /tmp/supabase_backup_$(date +%Y%m%d_%H%M%S).dump

# Copy backup to host
docker cp app-plane-supabase-db:/tmp/supabase_backup_$(date +%Y%m%d_%H%M%S).dump \
  ./backups/

# Backup Control Plane database
docker exec arc-saas-postgres pg_dump -U postgres -d arc_saas \
  -F c -f /tmp/control_plane_backup_$(date +%Y%m%d_%H%M%S).dump

# Copy backup to host
docker cp arc-saas-postgres:/tmp/control_plane_backup_$(date +%Y%m%d_%H%M%S).dump \
  ./backups/
```

### 2. Verify Database Connectivity

```bash
# Test Supabase connection
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "SELECT version();"

# Test Control Plane connection
docker exec -e PGPASSWORD=postgres arc-saas-postgres \
  psql -U postgres -d arc_saas -c "SELECT version();"
```

### 3. Document Current State

```bash
# Count rows per table (Supabase)
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -f /path/to/count_rows_script.sql > pre_migration_counts_supabase.txt

# Count rows per table (Control Plane)
docker exec -e PGPASSWORD=postgres arc-saas-postgres \
  psql -U postgres -d arc_saas -f /path/to/count_rows_script.sql > pre_migration_counts_control_plane.txt
```

### 4. Identify Default Organization ID

**CRITICAL**: Update the default organization ID in migration scripts before running.

```bash
# Find a valid organization ID to use for backfilling
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "SELECT id, name FROM organizations LIMIT 5;"

# Copy one of these IDs and update it in:
# migrations/supabase/001_add_tenant_isolation_critical.sql
# Line 11: default_org_id UUID := 'PASTE_ID_HERE';
```

### 5. Schedule Maintenance Window

While migrations don't require downtime, schedule during low-traffic hours for:
- Reduced lock contention
- Easier monitoring
- Faster completion

**Recommended Time**: Off-peak hours (e.g., 2-4 AM)

---

## Migration Execution Order

### Phase 1: Critical Tenant Isolation (Supabase)
**File**: `migrations/supabase/001_add_tenant_isolation_critical.sql`
**Duration**: 15-30 minutes
**Risk**: MEDIUM (adds columns and backfills data)

### Phase 2: Add RLS Policies (Supabase)
**File**: `migrations/supabase/002_add_rls_policies_existing_tables.sql`
**Duration**: 5 minutes
**Risk**: LOW (only adds policies)

### Phase 3: Fix CASCADE DELETE (Supabase)
**File**: `migrations/supabase/003_fix_cascade_delete_constraints.sql`
**Duration**: 5 minutes
**Risk**: LOW (updates FK constraints)

### Phase 4: Fix CASCADE DELETE (Control Plane)
**File**: `migrations/control-plane/001_fix_cascade_delete_constraints.sql`
**Duration**: 2 minutes
**Risk**: LOW (updates FK constraints)

---

## Step-by-Step Execution

### Phase 1: Critical Tenant Isolation (Supabase)

#### 1.1 Update Default Organization ID

Edit `migrations/supabase/001_add_tenant_isolation_critical.sql`:

```sql
-- Line 11 - UPDATE THIS!
default_org_id UUID := 'YOUR_ACTUAL_ORG_ID_HERE';
```

#### 1.2 Review Migration Script

Read through the migration to understand what will be changed:
- 9 tables will get `organization_id` column
- Data will be backfilled from parent relationships
- Indexes will be created
- RLS will be enabled with policies

#### 1.3 Apply Migration

```bash
# Apply to Supabase database
docker exec -i -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres < migrations/supabase/001_add_tenant_isolation_critical.sql
```

#### 1.4 Verify Success

```bash
# Check for errors in output (should be all "ALTER TABLE", "CREATE INDEX", etc.)
# No "ERROR:" lines should appear

# Run verification queries
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
SELECT table_name, COUNT(*) as total_rows, COUNT(organization_id) as rows_with_org_id
FROM (
    SELECT 'bom_line_items' as table_name, organization_id FROM bom_line_items
    UNION ALL
    SELECT 'attributes', organization_id FROM attributes
    UNION ALL
    SELECT 'bom_items', organization_id FROM bom_items
) AS all_tables
GROUP BY table_name;
"
```

**Expected Output**: All tables should have `total_rows = rows_with_org_id` (no NULLs).

#### 1.5 Monitor Performance

```bash
# Check for long-running queries
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
SELECT pid, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%';
"
```

### Phase 2: Add RLS Policies (Supabase)

#### 2.1 Apply Migration

```bash
docker exec -i -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres < migrations/supabase/002_add_rls_policies_existing_tables.sql
```

#### 2.2 Verify Success

```bash
# Check policies were created
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'alert_preferences', 'alerts', 'bom_uploads', 'notifications',
        'users', 'workspaces'
    )
GROUP BY tablename
ORDER BY tablename;
"
```

**Expected Output**: Each table should have 3-4 policies (SELECT, INSERT, UPDATE, DELETE).

### Phase 3: Fix CASCADE DELETE (Supabase)

#### 3.1 Apply Migration

```bash
docker exec -i -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres < migrations/supabase/003_fix_cascade_delete_constraints.sql
```

#### 3.2 Verify Success

```bash
# Check FK constraints have correct delete rules
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND kcu.column_name IN ('organization_id', 'created_by_id', 'verified_by')
LIMIT 20;
"
```

**Expected Output**: `organization_id` should be `CASCADE`, user references should be `SET NULL` or `CASCADE`.

### Phase 4: Fix CASCADE DELETE (Control Plane)

#### 4.1 Apply Migration

```bash
docker exec -i -e PGPASSWORD=postgres arc-saas-postgres \
  psql -U postgres -d arc_saas < migrations/control-plane/001_fix_cascade_delete_constraints.sql
```

#### 4.2 Verify Success

```bash
# Check FK constraints
docker exec -e PGPASSWORD=postgres arc-saas-postgres \
  psql -U postgres -d arc_saas -c "
SELECT
    tc.table_name,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'main'
    AND kcu.column_name = 'tenant_id';
"
```

**Expected Output**: `tenant_id` FKs should mostly be `CASCADE`.

---

## Post-Migration Validation

### 1. Test Tenant Isolation

#### Test 1: RLS Policy Enforcement

```sql
-- In Supabase, test as non-admin user
SET request.jwt.claims TO '{"organization_id": "test-org-uuid", "role": "user"}';

-- Should only see own org's BOMs
SELECT COUNT(*) FROM boms WHERE organization_id = 'test-org-uuid';

-- Should NOT see other org's BOMs (0 rows)
SELECT COUNT(*) FROM boms WHERE organization_id != 'test-org-uuid';
```

#### Test 2: Cross-Tenant Data Leakage

```sql
-- Query should fail or return 0 rows for other orgs
SELECT * FROM bom_line_items
WHERE bom_id IN (
  SELECT id FROM boms WHERE organization_id = 'other-org-uuid'
);
```

### 2. Test Cascade Delete

#### Test 3: Tenant Deletion Cleanup (DRY RUN)

```bash
# Create a test organization first
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
BEGIN;
-- Create test org
INSERT INTO organizations (id, name) VALUES ('test-delete-org', 'Test Delete Org');
-- Create related data
INSERT INTO boms (id, organization_id, name) VALUES ('test-bom', 'test-delete-org', 'Test BOM');
-- Check cascade
DELETE FROM organizations WHERE id = 'test-delete-org';
-- Verify bom was deleted
SELECT COUNT(*) FROM boms WHERE id = 'test-bom'; -- Should be 0
ROLLBACK; -- Don't actually delete
"
```

### 3. Performance Validation

#### Test 4: Index Usage

```sql
-- Explain query to verify index usage
EXPLAIN ANALYZE
SELECT * FROM boms WHERE organization_id = 'some-org-uuid';

-- Look for "Index Scan using idx_boms_org" in output
```

### 4. Application Testing

- [ ] Test user login/logout
- [ ] Test BOM list page (should only show own org's BOMs)
- [ ] Test component search (should only show own org's components)
- [ ] Test creating new BOM (should auto-set organization_id)
- [ ] Test deleting BOM (should cascade to line items)
- [ ] Test workspace management
- [ ] Test user invitations
- [ ] Test notifications

---

## Rollback Procedures

### Rollback Phase 4 (Control Plane CASCADE)

```sql
-- Revert FK constraints to NO ACTION
ALTER TABLE main.user_activities
DROP CONSTRAINT IF EXISTS user_activities_tenant_id_fkey,
ADD CONSTRAINT user_activities_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE NO ACTION;

-- Repeat for other tables as needed
```

### Rollback Phase 3 (Supabase CASCADE)

```sql
-- Revert FK constraints
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_organization_id_fkey,
ADD CONSTRAINT users_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE NO ACTION;

-- Repeat for other tables
```

### Rollback Phase 2 (RLS Policies)

```sql
-- Drop policies
DROP POLICY IF EXISTS org_isolation_select_alert_preferences ON alert_preferences;
DROP POLICY IF EXISTS org_isolation_insert_alert_preferences ON alert_preferences;
-- Repeat for all policies
```

### Rollback Phase 1 (Tenant Isolation Columns) - COMPLEX

**WARNING**: Rolling back Phase 1 requires restoring from backup. Dropping columns loses data.

```bash
# Restore from backup
docker cp ./backups/supabase_backup_YYYYMMDD_HHMMSS.dump \
  app-plane-supabase-db:/tmp/backup.dump

docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  pg_restore -U postgres -d postgres -c /tmp/backup.dump
```

**Alternative (if acceptable to keep columns but remove constraints)**:

```sql
-- Disable RLS
ALTER TABLE bom_line_items DISABLE ROW LEVEL SECURITY;
-- Drop policies
DROP POLICY IF EXISTS org_isolation_select_bom_line_items ON bom_line_items;
-- Drop FK constraint
ALTER TABLE bom_line_items DROP CONSTRAINT IF EXISTS bom_line_items_organization_id_fkey;
-- Drop index
DROP INDEX IF EXISTS idx_bom_line_items_org;
-- Optionally drop column (loses data!)
ALTER TABLE bom_line_items DROP COLUMN IF EXISTS organization_id;
```

---

## Monitoring Post-Migration

### 1. Database Performance

```bash
# Monitor query performance
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "
SELECT
    query,
    calls,
    total_exec_time / 1000 as total_time_seconds,
    mean_exec_time / 1000 as mean_time_seconds,
    max_exec_time / 1000 as max_time_seconds
FROM pg_stat_statements
WHERE query LIKE '%organization_id%'
ORDER BY total_exec_time DESC
LIMIT 10;
"
```

### 2. RLS Policy Violations

Check Postgres logs for RLS denials:

```bash
docker logs app-plane-supabase-db --tail 100 | grep -i "permission denied\|policy"
```

### 3. Application Errors

Monitor application logs for:
- "relation does not exist" (missing column references)
- "permission denied for table" (RLS issues)
- "null value in column" (missing organization_id)
- Foreign key violations

---

## Troubleshooting

### Issue 1: Migration Fails with "relation does not exist"

**Cause**: Table name or schema mismatch
**Solution**: Verify table exists in correct schema

```bash
docker exec -e PGPASSWORD=postgres app-plane-supabase-db \
  psql -U postgres -d postgres -c "\dt public.*"
```

### Issue 2: Backfill Fails with NULL organization_id

**Cause**: Parent relationship broken or default org ID not set
**Solution**: Manually update records with NULL organization_id

```sql
-- Find records with NULL
SELECT * FROM bom_line_items WHERE organization_id IS NULL LIMIT 10;

-- Update to default org (or correct org based on parent)
UPDATE bom_line_items
SET organization_id = 'correct-org-uuid'
WHERE organization_id IS NULL;
```

### Issue 3: RLS Denies Access to Valid Users

**Cause**: RLS policy too restrictive or `current_user_organization_id()` function missing
**Solution**: Verify helper function exists

```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'current_user_organization_id';

-- Test function
SELECT current_user_organization_id();
```

### Issue 4: Slow Migration Due to Large Tables

**Cause**: Backfilling millions of rows
**Solution**: Run migration in batches

```sql
-- Update in batches of 10,000
DO $$
DECLARE
    batch_size INT := 10000;
    updated INT;
BEGIN
    LOOP
        UPDATE bom_line_items bli
        SET organization_id = b.organization_id
        FROM boms b
        WHERE bli.bom_id = b.id
            AND bli.organization_id IS NULL
        LIMIT batch_size;

        GET DIAGNOSTICS updated = ROW_COUNT;
        EXIT WHEN updated = 0;
        RAISE NOTICE 'Updated % rows', updated;
        COMMIT;
    END LOOP;
END $$;
```

---

## Success Criteria

Migration is successful when:

- [ ] All 9 tables in Supabase have `organization_id` column
- [ ] All `organization_id` values are non-NULL
- [ ] All indexes on `organization_id` are created
- [ ] RLS is enabled on 26+ tables in Supabase
- [ ] RLS policies exist for all tenant-isolated tables
- [ ] FK constraints use CASCADE or SET NULL appropriately
- [ ] Control Plane FK constraints updated
- [ ] No orphaned records detected
- [ ] Application tests pass
- [ ] Performance meets SLAs (< 200ms for BOM list queries)
- [ ] No cross-tenant data leakage detected

---

## Timeline Estimate

| Phase | Duration | Can Run Concurrently? |
|-------|----------|----------------------|
| Pre-Migration Prep | 30 min | N/A |
| Phase 1 (Tenant Isolation) | 15-30 min | NO |
| Phase 2 (RLS Policies) | 5 min | After Phase 1 |
| Phase 3 (CASCADE Supabase) | 5 min | After Phase 2 |
| Phase 4 (CASCADE Control Plane) | 2 min | After Phase 3 |
| Post-Migration Validation | 30 min | After Phase 4 |
| **Total** | **1.5 - 2 hours** | |

**Note**: Phases 3 and 4 could theoretically run concurrently since they affect different databases, but sequential execution is safer.

---

## Communication Plan

### Before Migration
- [ ] Notify team 48 hours in advance
- [ ] Schedule migration during off-peak hours
- [ ] Prepare rollback plan
- [ ] Ensure backups are current

### During Migration
- [ ] Post status updates every 15 minutes
- [ ] Monitor error logs continuously
- [ ] Keep team on standby for issues

### After Migration
- [ ] Confirm success with validation tests
- [ ] Monitor for 24 hours
- [ ] Document any issues encountered
- [ ] Update runbooks with lessons learned

---

## Appendix: Helper Scripts

### Count Rows Script

Save as `count_rows.sql`:

```sql
DO $$
DECLARE
    tbl_name TEXT;
    row_count BIGINT;
BEGIN
    FOR tbl_name IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || tbl_name INTO row_count;
        RAISE NOTICE 'Table: %, Rows: %', tbl_name, row_count;
    END LOOP;
END $$;
```

### Find Orphaned Records

Save as `find_orphans.sql`:

```sql
-- Find orphaned bom_line_items
SELECT COUNT(*) as orphaned_count
FROM bom_line_items bli
LEFT JOIN boms b ON bli.bom_id = b.id
WHERE b.id IS NULL;

-- Find orphaned component associations
SELECT COUNT(*) as orphaned_count
FROM component_tags ct
LEFT JOIN components c ON ct.component_id = c.id
WHERE c.id IS NULL;

-- Find users without valid organization
SELECT COUNT(*) as orphaned_count
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.organization_id IS NOT NULL AND o.id IS NULL;
```

---

**Migration Guide End**
