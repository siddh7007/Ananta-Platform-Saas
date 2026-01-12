# Comprehensive Schema Analysis: December 27 Dump vs. MASTER_MIGRATION_V3

**Date**: 2026-01-11
**Purpose**: Identify ALL missing columns/tables introduced in migrations 066-089

## 4 Databases in Ananta Platform

| Database | Purpose | Container/Service |
|----------|---------|-------------------|
| **Supabase** | Tenant business data (BOMs, projects, organizations) | app-plane-supabase-db |
| **Components-V2** | Component catalog SSOT | app-plane-components-v2-postgres |
| **Control Plane** | Tenant management, billing, subscriptions | arc-saas-postgres |
| **Keycloak** | Authentication/Authorization | keycloak-postgresql |

**Focus**: Supabase and Components-V2 (App Plane databases)

## Migration Timeline

- **Dec 27, 2024**: Database dump taken
- **Migration 066**: Risk analysis restructure
- **Migrations 067-089**: 23 additional migrations
- **Total gap**: 24 migrations missing from December 27 dump

## Critical Missing Schema: `component_base_risk_scores`

### December 27 Schema (OLD)
```sql
CREATE TABLE public.component_base_risk_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid,
    mpn text NOT NULL,
    manufacturer text,
    -- OLD COLUMN NAMES (score suffix):
    lifecycle_score integer DEFAULT 0,
    supply_chain_score integer DEFAULT 0,
    compliance_score integer DEFAULT 0,
    obsolescence_score integer DEFAULT 0,
    single_source_score integer DEFAULT 0,
    composite_score integer DEFAULT 0,    -- OLD NAME
    risk_level text DEFAULT 'low'::text,
    factors jsonb DEFAULT '[]'::jsonb,    -- OLD NAME
    data_sources jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone DEFAULT (now() + '7 days'::interval),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
    -- MISSING: calculation_method
);
```

### Migration 066+ Schema (NEW)
```sql
CREATE TABLE IF NOT EXISTS public.component_base_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpn TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  -- NEW COLUMN NAMES (risk suffix):
  lifecycle_risk INTEGER DEFAULT 0 CHECK (lifecycle_risk BETWEEN 0 AND 100),
  supply_chain_risk INTEGER DEFAULT 0 CHECK (supply_chain_risk BETWEEN 0 AND 100),
  compliance_risk INTEGER DEFAULT 0 CHECK (compliance_risk BETWEEN 0 AND 100),
  obsolescence_risk INTEGER DEFAULT 0 CHECK (obsolescence_risk BETWEEN 0 AND 100),
  single_source_risk INTEGER DEFAULT 0 CHECK (single_source_risk BETWEEN 0 AND 100),
  default_total_score INTEGER DEFAULT 0 CHECK (default_total_score BETWEEN 0 AND 100),  -- NEW NAME
  default_risk_level TEXT CHECK (default_risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  risk_factors JSONB DEFAULT '{}'::jsonb,  -- NEW NAME
  calculation_date TIMESTAMPTZ DEFAULT NOW(),
  calculation_method TEXT DEFAULT 'weighted_average_v1',  -- NEW COLUMN
  data_sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  lead_time_days INTEGER,
  stock_quantity INTEGER,
  supplier_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mpn, manufacturer)
);
```

### Column Mapping

| December 27 | Migration 066+ | Type | Status |
|-------------|----------------|------|--------|
| `lifecycle_score` | `lifecycle_risk` | RENAMED | Fixed in migration 005 |
| `supply_chain_score` | `supply_chain_risk` | RENAMED | Fixed in migration 005 |
| `compliance_score` | `compliance_risk` | RENAMED | Fixed in migration 005 |
| `obsolescence_score` | `obsolescence_risk` | RENAMED | Fixed in migration 005 |
| `single_source_score` | `single_source_risk` | RENAMED | Fixed in migration 005 |
| `composite_score` | `default_total_score` | RENAMED | Fixed in migration 005 |
| `risk_level` | `default_risk_level` | RENAMED | Fixed in migration 005 |
| `factors` | `risk_factors` | RENAMED | Fixed in migration 005 |
| `calculated_at` | `calculation_date` | RENAMED | Fixed in migration 005 |
| N/A | `calculation_method` | ADDED | Fixed in migration 005 |
| `component_id` (UUID) | REMOVED (dedupe by MPN+mfr) | REMOVED | Fixed in migration 005 |
| `valid_until` | REMOVED | REMOVED | Fixed in migration 005 |

## Other Tables/Columns Requiring Analysis

Based on migrations 067-089, we need to check for:

### Migration 067-089 Table Changes (Supabase)

1. **068_supply_chain_alerts_and_price_history.sql**
   - New tables for price tracking
   - Alert system enhancements

2. **069_new_user_workflow_schema.sql**
   - User workflow improvements

3. **070_organization_settings_schema.sql**
   - Organization settings table

4. **071_onboarding_tracking.sql**
   - Onboarding state tracking

5. **074_auth0_org_mapping_and_enterprise_support.sql**
   - Multi-org auth support

6. **083_workspaces_schema.sql**
   - **CRITICAL**: New workspace hierarchy
   - May have new tables: `workspaces`, workspace-related columns

7. **084_migrate_to_workspaces.sql**
   - Data migration to workspace model

8. **085_workspace_rls_policies.sql**
   - RLS policies for workspaces

9. **087_fix_boms_status_constraint.sql**
   - BOM status constraint fixes

10. **088_add_bom_risk_columns.sql**
    - Additional risk columns in `boms` table

## Verification Strategy

### Step 1: Compare Table Lists

```bash
# December 27 tables
grep "CREATE TABLE" app-plane/database/dumps/supabase_schema_dump.sql | wc -l

# Master V3 tables
grep "CREATE TABLE" components-platform-v2-ref/supabase/migrations/MASTER_MIGRATION_V3_COMPLETE.sql | wc -l
```

### Step 2: Compare Column Counts Per Table

For each critical table:
1. Extract column list from December 27 dump
2. Extract column list from MASTER_V3
3. Find differences

### Step 3: Apply Missing Migrations

For any new tables/columns found:
1. Create migration file in `app-plane/database/migrations/supabase/`
2. Apply to running database
3. Update master migration

## Next Steps

1. ✅ Fixed `component_base_risk_scores` (migration 005)
2. ✅ Fixed `boms` table (`enrichment_progress`, `analyzed_at`) (migration 004)
3. ⏳ Check `workspaces` tables (migration 083-085)
4. ⏳ Check `boms` for additional risk columns (migration 088)
5. ⏳ Check all other tables from migrations 067-089

## Status

**Completed**:
- Migration 004: `boms` enrichment columns
- Migration 005: `component_base_risk_scores` schema upgrade

**Pending**:
- Full comparison of MASTER_V3 vs December 27 dump
- Identification of ALL missing tables/columns
- Creation of comprehensive migration to bring database to MASTER_V3 state

## Tools for Comparison

```bash
# Extract table names
cd components-platform-v2-ref/supabase/migrations
grep "^CREATE TABLE" MASTER_MIGRATION_V3_COMPLETE.sql | awk '{print $3}' | sort > /tmp/master_tables.txt

cd e:/Work/Ananta-Platform-Saas/app-plane/database/dumps
grep "^CREATE TABLE" supabase_schema_dump.sql | awk '{print $3}' | sort > /tmp/dec27_tables.txt

# Find tables in MASTER but not in Dec 27 dump
comm -13 /tmp/dec27_tables.txt /tmp/master_tables.txt
```
