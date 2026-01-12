# 001_SUPABASE_MASTER.sql Changelog

## 2026-01-11 - REPLACED with MASTER_MIGRATION_V3_COMPLETE.sql

### Root Cause Analysis

The `001_SUPABASE_MASTER.sql` file was generated from the **December 27, 2024 database dump**, which represents an **intermediate schema state** (pre-migration-066). This caused massive schema drift between the database and the CNS service code.

### Timeline of Schema Evolution

1. **December 27, 2024**: Database dump taken (old schema)
   - `component_base_risk_scores` has `lifecycle_score`, `supply_chain_score`, etc.
   - Missing `calculation_method` column
   - Column named `factors` instead of `risk_factors`
   - Column named `composite_score` instead of `default_total_score`

2. **Migration 066 (2025)**: Risk analysis restructure
   - Renamed `*_score` columns to `*_risk`
   - Renamed `factors` to `risk_factors`
   - Renamed `composite_score` to `default_total_score`
   - Added `calculation_method` column
   - Removed `component_id` UUID (deduplicate by MPN+manufacturer instead)

3. **Migrations 067-089**: 23 additional migrations applied to production
   - Authentication improvements
   - RLS policy updates
   - Workspace schema additions
   - BOM risk columns
   - Many other enhancements

### The Problem

**December 27 dump was missing 24 migrations (066-089)**, but:
- CNS service Python code was updated to expect the NEW schema from migration 066+
- Database had OLD schema from December 27 dump
- Result: 500 errors on all risk-related endpoints

### Missing Columns (Just in `component_base_risk_scores`)

| Column | December 27 Dump | Migration 066+ | Impact |
|--------|------------------|----------------|--------|
| `lifecycle_*` | `lifecycle_score` | `lifecycle_risk` | Column not found errors |
| `supply_chain_*` | `supply_chain_score` | `supply_chain_risk` | Column not found errors |
| `compliance_*` | `compliance_score` | `compliance_risk` | Column not found errors |
| `obsolescence_*` | `obsolescence_score` | `obsolescence_risk` | Column not found errors |
| `single_source_*` | `single_source_score` | `single_source_risk` | Column not found errors |
| Risk factors | `factors` | `risk_factors` | Column not found errors |
| Total score | `composite_score` | `default_total_score` | Column not found errors |
| Calculation | MISSING | `calculation_method` | Column not found errors |

### The Solution

**REPLACED** `001_SUPABASE_MASTER.sql` with complete schema from:
```
components-platform-v2-ref/supabase/migrations/MASTER_MIGRATION_V3_COMPLETE.sql
```

**File Size Change**: 169 KB (old incomplete schema) → 60 KB (new complete schema)

### Migrations Applied

1. **004_add_missing_boms_columns.sql** (2026-01-11)
   - Added `enrichment_progress` JSONB to `boms` table
   - Added `analyzed_at` TIMESTAMPTZ to `boms` table

2. **005_upgrade_to_migration_066_risk_schema.sql** (2026-01-11)
   - Dropped old `component_base_risk_scores` table
   - Recreated with Migration 066 schema (correct column names)
   - Added all required indexes
   - Fixed risk analysis endpoints

### Verification

After fix, verify columns exist:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'component_base_risk_scores'
  AND column_name IN ('lifecycle_risk', 'supply_chain_risk', 'risk_factors', 'calculation_method', 'default_total_score')
ORDER BY column_name;
```

Expected result:
```
     column_name     | data_type
---------------------+-----------
 calculation_method  | text
 default_total_score | integer
 lifecycle_risk      | integer
 risk_factors        | jsonb
 supply_chain_risk   | integer
```

### Impact

**Before fix**:
- `/api/risk/stats` → 500 Internal Server Error
- `/api/bom/workflow/{id}/processing-status` → 500 Internal Server Error
- Risk dashboard completely broken
- Component risk scores unavailable

**After fix**:
- All endpoints return 200 OK
- Risk analysis functional
- Dashboard operational

### Lessons Learned

1. **Never trust a dump file date** - December 27 dump was actually from an intermediate migration state
2. **Always use MASTER migrations** - `MASTER_MIGRATION_V3_COMPLETE.sql` is the source of truth
3. **Check migration history** - 24 migrations (066-089) were applied AFTER the December 27 dump
4. **Verify schema before using dumps** - Compare table definitions against master schema first
5. **CNS service code must match database schema** - Python code was updated to migration 066+ but database was stuck on pre-066

### Related Files

- Migration 004: [004_add_missing_boms_columns.sql](../migrations/supabase/004_add_missing_boms_columns.sql)
- Migration 005: [005_upgrade_to_migration_066_risk_schema.sql](../migrations/supabase/005_upgrade_to_migration_066_risk_schema.sql)
- Documentation: [README_SCHEMA_ISSUE.md](../dumps/README_SCHEMA_ISSUE.md)
- Backup (old schema): `001_SUPABASE_MASTER.sql.backup-old-schema`
- Source of truth: `components-platform-v2-ref/supabase/migrations/MASTER_MIGRATION_V3_COMPLETE.sql`
