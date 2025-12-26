# App-Plane Database Migrations - Final Master Migrations

## Overview

This folder contains **consolidated master migrations** for all App-Plane databases.
These migrations are dumps from live databases with complete schema and seed data.

## Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        App-Plane Database Architecture                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────┐         ┌─────────────────────────┐       │
│  │   Supabase Database     │         │  Components-V2 Database │       │
│  │   (port 27432)          │         │  (port 27010)           │       │
│  ├─────────────────────────┤         ├─────────────────────────┤       │
│  │ - organizations         │         │ - components (SSOT)     │       │
│  │ - users                 │  ───>   │ - categories (1,200)    │       │
│  │ - projects              │  sync   │ - manufacturers (30)    │       │
│  │ - boms                  │         │ - suppliers (8)         │       │
│  │ - bom_line_items        │         │ - component_pricing     │       │
│  │ - alerts                │         │ - vendor_category_map   │       │
│  │ - notifications         │         │ - cns_enrichment_config │       │
│  │ - enrichment_events     │         │                         │       │
│  │                         │         │ (Central Catalog SSOT)  │       │
│  │ (Customer-facing Data)  │         │ (CNS Service Data)      │       │
│  └─────────────────────────┘         └─────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Migration Files

| File | Database | Port | Size | Description |
|------|----------|------|------|-------------|
| `001_SUPABASE_MASTER.sql` | Supabase | 27432 | 65KB | Complete Supabase schema with all tables, RLS policies, functions |
| `002_COMPONENTS_V2_MASTER.sql` | Components-V2 | 27010 | 283KB | CNS Service with **1,200 DigiKey categories** and all seed data |

## When to Use These Migrations

### Fresh Database Setup
Use these master migrations to set up **new, empty databases**:

```bash
# Supabase Database (Fresh Setup)
PGPASSWORD=your-password psql -h localhost -p 27432 -U postgres -d app_plane_db \
  -f 001_SUPABASE_MASTER.sql

# Components-V2 Database (Fresh Setup)
PGPASSWORD=your-password psql -h localhost -p 27010 -U postgres -d components_v2 \
  -f 002_COMPONENTS_V2_MASTER.sql
```

### Using Docker
```bash
# Components-V2 via Docker (production container)
docker exec -i app-plane-components-v2-postgres psql -U postgres -d components_v2 \
  < 002_COMPONENTS_V2_MASTER.sql

# Supabase via Docker (production container)
docker exec -i app-plane-supabase-db psql -U postgres -d postgres \
  < 001_SUPABASE_MASTER.sql
```

### Existing Databases
For **existing databases**, continue using incremental migrations in:
- `app-plane/supabase/migrations/` (for Supabase)
- `app-plane/services/cns-service/migrations/` (for Components-V2)

## Components-V2 Data Summary

### 002_COMPONENTS_V2_MASTER.sql Contains:

| Data | Count | Description |
|------|-------|-------------|
| **Categories** | 1,200 | Full DigiKey hierarchical taxonomy |
| └─ Level 1 | 50 | Top-level categories (e.g., "Capacitors", "Resistors") |
| └─ Level 2 | 644 | Sub-categories |
| └─ Level 3 | 483 | Sub-sub-categories |
| └─ Level 4+ | 23 | Deep hierarchy |
| **Manufacturers** | 30 | Major component manufacturers |
| **Suppliers** | 8 | Distributors (DigiKey, Mouser, etc.) |
| **Config Keys** | 10 | CNS enrichment configuration |

### Tables Included:

| Table | Purpose |
|-------|---------|
| `categories` | DigiKey hierarchical taxonomy (1,200 categories) |
| `manufacturers` | Component manufacturers master list |
| `suppliers` | Distributors with API configs |
| `components` | Central component catalog (SSOT) |
| `component_pricing` | Supplier pricing with quantity breaks |
| `vendor_category_mappings` | Vendor-to-canonical category mapping |
| `cns_enrichment_config` | Runtime configuration (10 keys) |

### Configuration Keys:

| Category | Keys |
|----------|------|
| `ai` | ai_model_name, ai_temperature, enable_ai_normalization |
| `performance` | enrichment_batch_size, enrichment_delay_per_batch_ms, enrichment_delay_per_component_ms, max_concurrent_enrichments |
| `quality` | quality_threshold |
| `storage` | cache_ttl_seconds |
| `audit` | audit_retention_days |

## Supabase Table Summary

### 001_SUPABASE_MASTER.sql Contains:

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant organizations/companies |
| `users` | User accounts (Auth0/Keycloak compatible) |
| `user_profiles` | Legacy user profiles (backwards compatible) |
| `organization_memberships` | User-org relationships (multi-org support) |
| `organization_invitations` | Pending invitations |
| `user_preferences` | User settings & last active org |
| `projects` | Organization projects |
| `workspaces` | Workspace organization within orgs |
| `workspace_members` | Workspace membership |
| `manufacturers` | Component manufacturers |
| `categories` | Component categories (hierarchical) |
| `suppliers` | Component suppliers/distributors |
| `components` | Organization-scoped components |
| `central_component_catalog` | Cross-org component data |
| `skus` | Vendor-specific SKU listings |
| `bom_uploads` | BOM file uploads |
| `boms` | Bill of Materials |
| `bom_line_items` | BOM line items |
| `enrichment_queue` | Enrichment workflow queue |
| `enrichment_audit_log` | Enrichment audit trail |
| `enrichment_events` | Real-time enrichment progress |
| `notifications` | User notifications |
| `alerts` | Component alerts |
| `alert_preferences` | User alert preferences |
| `component_watches` | Component watch subscriptions |
| `component_price_history` | Price change tracking |

## Verification Commands

After running migrations, verify with:

```sql
-- Components-V2: Count tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 7 tables

-- Components-V2: Verify categories
SELECT COUNT(*) FROM categories;
-- Expected: 1,200 rows

-- Components-V2: Category breakdown
SELECT level, COUNT(*) as count FROM categories GROUP BY level ORDER BY level;
-- Expected: L1=50, L2=644, L3=483, L4=23

-- Components-V2: Verify manufacturers
SELECT COUNT(*) FROM manufacturers;
-- Expected: 30 rows

-- Components-V2: Verify suppliers
SELECT COUNT(*) FROM suppliers;
-- Expected: 8 rows

-- Components-V2: Verify config
SELECT COUNT(*) FROM cns_enrichment_config;
-- Expected: 10 rows
```

## Applying Additional Migrations

If you need circuit breaker or DigiKey OAuth token config (from migrations 004-005):

```bash
# Apply circuit breaker config (optional)
psql -h localhost -p 27010 -U postgres -d components_v2 \
  -f ../services/cns-service/migrations/004_add_circuit_breaker_config.sql

# Apply DigiKey OAuth token config (optional)
psql -h localhost -p 27010 -U postgres -d components_v2 \
  -f ../services/cns-service/migrations/005_add_digikey_token_config.sql
```

## Rollback

These migrations create tables and insert data.
For a complete rollback:

```sql
-- WARNING: Destructive - drops all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.1.0 | 2025-12-09 | Updated 002 with full pg_dump from live DB (1,200 categories) |
| 5.0.0 | 2025-12-09 | Initial consolidated master migrations |

## Source

### 002_COMPONENTS_V2_MASTER.sql
- **Generated via**: `pg_dump` from live Components-V2 database (port 27010)
- **Contains**:
  - Complete schema (7 tables with all constraints, indexes, triggers)
  - All seed data (1,200 categories, 30 manufacturers, 8 suppliers, 10 config keys)
- **Migrations consolidated**:
  - `app-plane/database/components-v2-init/01_schema.sql`
  - `app-plane/database/components-v2-init/02_seed_data.sql`
  - `app-plane/database/components-v2-init/03_digikey_categories.sql`
  - `app-plane/services/cns-service/migrations/001_initial_schema.sql`
  - `app-plane/services/cns-service/migrations/002_enrichment_config.sql`
  - `app-plane/services/cns-service/migrations/003_rename_tenant_id_to_organization_id.sql`

### 001_SUPABASE_MASTER.sql
- Migrations 001-100+ from `app-plane/supabase/migrations/`
- Key migrations included:
  - 025_add_priority_and_audit_fields.sql
  - 048_add_source_column_to_boms.sql
  - 050_add_component_id_to_bom_line_items.sql
  - 068_supply_chain_alerts_and_price_history.sql
  - 082_simplified_auth_multi_org.sql
  - And 80+ more...
