# Database Migrations - Structure and Purpose
**Updated**: January 10, 2026

---

## Migration File Structure

### Core Database Schemas (December 27, 2025 Production Backups)

#### 001_SUPABASE_MASTER.sql
**Database**: Supabase PostgreSQL (`postgres`)
**Tables**: 58 tables/views
**Size**: 2.8MB
**Source**: Production backup from December 27, 2025

**Contains**:
- Core business data tables (organizations, users, workspaces, projects)
- BOM management (boms, bom_line_items, bom_jobs, bom_uploads)
- Alert system (alerts, alert_preferences, alert_deliveries)
- Catalog tables (catalog_components, catalog_categories, catalog_manufacturers)
- Component management (components, component_watches, component_alternatives)
- Audit logging (audit_logs, audit_enrichment_runs, audit_field_comparisons)
- Storage tables (storage.buckets, storage.objects, storage.migrations)
- Seed data (COPY statements with production data)

**Does NOT contain**:
- Redis tables (managed separately)
- Directus-specific tables (in 005/006)
- Billing/subscription tables (added after Dec 27)
- Risk management tables (added after Dec 27)

#### 002_COMPONENTS_V2_MASTER.sql
**Database**: Components-V2 PostgreSQL (`components_v2`)
**Tables**: 12 tables/views
**Size**: 2.3MB
**Source**: Production backup from December 27, 2025

**Contains**:
- component_catalog (main catalog table)
- catalog_components (VIEW for ORM compatibility)
- categories
- manufacturers
- suppliers
- cns_enrichment_config
- enrichment_config
- component_pricing
- components
- supplier_enrichment_responses
- supplier_tokens
- vendor_category_mappings
- Seed data (COPY statements)

**Does NOT contain**:
- Redis infrastructure tables (added after Dec 27)
- AI prompts table (added after Dec 27)
- Enrichment batch jobs (added after Dec 27)
- Supplier performance metrics (added after Dec 27)

---

### Supplemental Migrations (Applied Separately)

#### 005_DIRECTUS_ENRICHMENT_TABLES.sql
**Database**: Components-V2 PostgreSQL (`components_v2`)
**Tables**: 2
**Purpose**: Directus-native enrichment workflow tables

**Creates**:
1. **enrichment_queue** - Components needing admin review (quality 70-94%)
2. **enrichment_history** - Audit log of enrichment attempts

**Features**:
- Quality-based routing
- Admin review workflow
- Enrichment data storage
- Issue tracking

#### 006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql
**Database**: Components-V2 PostgreSQL (`components_v2`)
**Tables**: 2
**Purpose**: CNS enrichment configuration

**Creates**:
1. **cns_enrichment_config** - UI-configurable enrichment settings
2. **cns_enrichment_audit** - Configuration change audit log

**Features**:
- AI provider settings (Ollama, OpenAI, Claude, Langflow)
- Web scraping configuration
- Quality thresholds
- Cost tracking

---

## Terraform Integration

### ConfigMap: `ananta-app-plane-migrations`
**Namespace**: `database-system`
**Defined in**: `infrastructure/terraform/environments/local/main.tf` (line 215-235)

```hcl
resource "kubernetes_config_map" "app_plane_migrations" {
  data = {
    "001_SUPABASE_MASTER.sql"                = file("${local.project_root}/database/migrations/001_SUPABASE_MASTER.sql")
    "002_COMPONENTS_V2_MASTER.sql"           = file("${local.project_root}/database/migrations/002_COMPONENTS_V2_MASTER.sql")
    "005_DIRECTUS_ENRICHMENT_TABLES.sql"     = file("${local.project_root}/database/migrations/005_DIRECTUS_ENRICHMENT_TABLES.sql")
  }
}
```

**Note**: File 006 is referenced in the Control Plane ConfigMap (line 205), not App Plane.

### Migration Job
**Job**: `kubernetes_job.db_migration`
**Module**: `infrastructure/terraform/modules/app-plane/kubernetes/main.tf` (line 1448)

**Applies migrations in order**:
1. 001_SUPABASE_MASTER.sql → supabase-db:5432/postgres
2. 002_COMPONENTS_V2_MASTER.sql → components-db:5432/components_v2
3. 005_DIRECTUS_ENRICHMENT_TABLES.sql → components-db:5432/components_v2

---

## Why This Structure?

### Separation of Concerns

1. **Core Schema (001/002)** - December 27 production state
   - Represents last known stable production schema
   - Includes all business-critical tables
   - Contains seed data for immediate functionality

2. **Directus Extensions (005/006)** - Optional enrichment features
   - Can be applied independently
   - Specific to Directus admin workflow
   - Not required for basic CNS functionality

3. **Future Extensions** - Post-Dec 27 features
   - Billing/subscriptions (added after Dec 27)
   - Risk management (added after Dec 27)
   - Redis infrastructure (added after Dec 27)
   - Should be in separate migration files (007+)

### Benefits

✅ **Modularity** - Features can be enabled/disabled independently
✅ **Rollback Safety** - Can revert to Dec 27 baseline easily
✅ **Clear History** - Core vs extensions clearly separated
✅ **Terraform Flexibility** - Optional features controlled by variables
✅ **Testing** - Can test core schema without all extensions

---

## Migration Application Order

### 1. Core Schema (Required)
```sql
-- Applied first - creates base tables
001_SUPABASE_MASTER.sql      -- Supabase DB
002_COMPONENTS_V2_MASTER.sql -- Components V2 DB
```

### 2. Directus Extensions (Optional)
```sql
-- Applied second - adds enrichment workflow
005_DIRECTUS_ENRICHMENT_TABLES.sql     -- Components V2 DB
006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql -- Components V2 DB
```

### 3. Arc-SaaS Control Plane (Separate)
```sql
-- Applied separately to Control Plane DB
003_ARC_SAAS_MASTER.sql -- Control Plane tenant management
```

---

## Deployment Commands

### Full Deployment (Terraform)
```bash
cd infrastructure/terraform/environments/local
terraform apply -auto-approve
```

### Manual Migration (Direct psql)
```bash
# Supabase
kubectl exec -n app-plane supabase-db-0 -- \
  psql -U postgres -d postgres -f /path/to/001_SUPABASE_MASTER.sql

# Components V2
kubectl exec -n app-plane components-db-0 -- \
  psql -U postgres -d components_v2 -f /path/to/002_COMPONENTS_V2_MASTER.sql

# Directus extensions
kubectl exec -n app-plane components-db-0 -- \
  psql -U postgres -d components_v2 -f /path/to/005_DIRECTUS_ENRICHMENT_TABLES.sql
```

---

## File Locations

### Primary (Used by Terraform)
```
database/migrations/
├── 001_SUPABASE_MASTER.sql              # Supabase core schema + data
├── 002_COMPONENTS_V2_MASTER.sql         # Components V2 core schema + data
├── 003_ARC_SAAS_MASTER.sql              # Control Plane schema + data
├── 005_DIRECTUS_ENRICHMENT_TABLES.sql   # Directus enrichment workflow
└── 006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql # CNS config tables
```

### Secondary (App Plane copy)
```
app-plane/database/final-migrations/
├── 001_SUPABASE_MASTER.sql              # Mirror of primary
├── 002_COMPONENTS_V2_MASTER.sql         # Mirror of primary
└── 003_ARC_SAAS_MASTER.sql              # Mirror of primary
```

### Backups (Source of Truth)
```
backups/
├── supabase_db_20251227.sql             # Dec 27 production backup
├── components_v2_db_20251227.sql        # Dec 27 production backup
└── arc_saas_db_20251227.sql             # Dec 27 production backup
```

---

## Maintenance

### Updating Core Schema
1. Take new production backup: `pg_dump > backups/supabase_db_YYYYMMDD.sql`
2. Copy to migration files: `cp backups/... database/migrations/001_SUPABASE_MASTER.sql`
3. Update Terraform: `terraform apply`

### Adding New Features
1. Create new migration file: `007_NEW_FEATURE.sql`
2. Add to Terraform ConfigMap
3. Update migration job to apply new file
4. Test on clean database

### Rollback
1. Restore from backup: `cp backups/supabase_db_20251227.sql database/migrations/001_SUPABASE_MASTER.sql`
2. Reapply: `terraform apply -replace=kubernetes_config_map.app_plane_migrations[0]`

---

## Summary

✅ **Core migrations (001/002)** = December 27, 2025 production state
✅ **Directus migrations (005/006)** = Enrichment workflow extensions
✅ **Terraform** handles automatic application via ConfigMap + Job
✅ **Separation** allows modular deployment and easy rollback
✅ **Seed data included** in core migrations (COPY statements)

This structure ensures clean separation between core functionality and optional features while maintaining a clear upgrade path.
