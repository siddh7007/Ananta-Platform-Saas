# Supabase Schema Dump - Known Issues

## Problem Discovered: 2026-01-11

The `supabase_schema_dump.sql` file (dated December 27) is **INCOMPLETE**. It's missing critical columns that exist in the master schema and are required by the CNS service.

## Missing Columns in `boms` Table

### Currently Missing (but required):
1. **`enrichment_progress`** - JSONB
   - **Should be**: `JSONB DEFAULT '{"total_items": 0, "enriched_items": 0, "failed_items": 0, "pending_items": 0, "last_updated": null}'::jsonb`
   - **Actually was**: Missing entirely (was manually added as INTEGER by mistake, then fixed)

2. **`analyzed_at`** - TIMESTAMPTZ
   - **Should be**: `TIMESTAMPTZ` (nullable)
   - **Actually was**: Missing entirely (manually added)

## Root Cause

The December 27 pg_dump either:
1. Was taken before these columns were added to the production database
2. Had incomplete dump settings that excluded these columns
3. The production database itself was missing these columns

## Fix Applied

1. ✅ **Migration Created**: [004_add_missing_boms_columns.sql](../migrations/supabase/004_add_missing_boms_columns.sql)
2. ✅ **Database Updated**: Ran ALTER TABLE commands directly on Supabase StatefulSet pod
3. ⚠️ **Dump File NOT Updated**: The dump file should be regenerated from current production schema

## Why This Matters

The CNS service Python code expects these columns:
- `bom_workflow.py:528` - Queries `enrichment_progress` and `analyzed_at`
- `bom_enrichment.py:2611,2628,2643` - Updates `enrichment_progress` JSONB
- `admin_lookup.py:250,282` - Returns `enrichment_progress` in API responses

Without these columns, CNS service returns HTTP 500 errors with:
```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) column "enrichment_progress" does not exist
```

## Correct Schema Reference

The correct, complete schema is in:
```
components-platform-v2-ref/supabase/migrations/033_master_supabase_schema_complete.sql
```

This file shows the full `boms` table definition with ALL required columns.

## Recommended Actions

1. **For fresh deployments**: Apply migration `004_add_missing_boms_columns.sql` after importing the Dec 27 dump
2. **For production**: Regenerate the dump file from current production schema
3. **Future**: Always compare dump against master schema before using for init

## Lessons Learned

1. ❌ **Never trust a dump file without verification**
2. ✅ **Always check master schema reference before using dumps**
3. ✅ **Create migrations for any manual schema changes**
4. ✅ **Verify dump file completeness by comparing table definitions**
