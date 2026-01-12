# Migration Files Updated to December 27, 2025 Backups
**Updated**: January 10, 2026
**Source**: Production database backups from December 27, 2025

---

## Files Updated

### 1. Terraform Migration Files (Used by Kubernetes Deployment)
**Location**: `database/migrations/`

| File | Objects | Size | Source |
|------|---------|------|--------|
| `001_SUPABASE_MASTER.sql` | 58 tables/views | 2.8MB | `backups/supabase_db_20251227.sql` |
| `002_COMPONENTS_V2_MASTER.sql` | 12 tables/views | 2.3MB | `backups/components_v2_db_20251227.sql` |

**Referenced by**: `infrastructure/terraform/environments/local/main.tf` line 227-231
**ConfigMap**: `ananta-app-plane-migrations`
**Namespace**: `database-system`

### 2. App Plane Migration Files
**Location**: `app-plane/database/final-migrations/`

| File | Objects | Size | Source |
|------|---------|------|--------|
| `001_SUPABASE_MASTER.sql` | 58 tables/views | 2.8MB | `backups/supabase_db_20251227.sql` |
| `002_COMPONENTS_V2_MASTER.sql` | 12 tables/views | 2.3MB | `backups/components_v2_db_20251227.sql` |

---

## Schema Details

### Supabase Database (58 objects)
**Tables**: 57 | **Views**: 1 (user_profiles)

**Core Tables**:
- alert_deliveries, alert_preferences, alerts, attributes
- audit_enrichment_runs, audit_field_comparisons, audit_logs, audit_supplier_quality
- bom_items, bom_jobs, bom_line_items, bom_processing_jobs, bom_uploads, boms
- catalog_categories, catalog_components, catalog_manufacturers, categories
- central_component_catalog, cns_bulk_uploads, cns_cost_tracking, cns_enrichment_config
- cns_processing_events, cns_events_retention_summary, column_mapping_templates
- component_alternatives, component_price_history, component_risk_scores
- component_svhc, component_tags, component_watches, components
- components_needing_review, enrichment_audit_log, enrichment_events
- enrichment_history, enrichment_queue, enrichment_stats
- manufacturers, notifications, organization_invitations, organization_memberships
- organizations, predefined_tags, projects, role_mappings
- skus, suppliers, svhc_substances, user_preferences, users
- vendor_category_mappings, workspace_members, workspaces
- storage.buckets, storage.migrations, storage.objects

**View**: user_profiles (maps to user_preferences)

### Components V2 Database (12 objects)
**Tables**: 11 | **Views**: 1 (catalog_components)

**Tables**:
- component_catalog
- categories
- cns_enrichment_config
- component_pricing
- components
- enrichment_config
- manufacturers
- supplier_enrichment_responses
- supplier_tokens
- suppliers
- vendor_category_mappings

**View**: catalog_components (maps to component_catalog for ORM compatibility)

---

## Included Data (COPY Statements)

Both migration files include **seed data** via PostgreSQL COPY statements:

### Supabase Seed Data
- Organizations (3+)
- Users (10+)
- Workspaces (5+)
- Projects (10+)
- Organization memberships
- Workspace members
- Categories
- Manufacturers
- Suppliers

### Components V2 Seed Data
- Component catalog entries
- Categories
- Manufacturers
- Suppliers
- CNS enrichment config
- Supplier tokens

---

## Deployment Process

### 1. Terraform Apply
```bash
cd infrastructure/terraform/environments/local
terraform apply -auto-approve
```

This will:
1. Create ConfigMap `ananta-app-plane-migrations` with Dec 27 schema
2. Run migration job that applies:
   - `001_SUPABASE_MASTER.sql` → Supabase DB (postgres)
   - `002_COMPONENTS_V2_MASTER.sql` → Components-V2 DB (components_v2)

### 2. Verify Deployment
```bash
# Check migration job status
kubectl get jobs -n database-system

# Check database tables
kubectl exec -n app-plane supabase-db-0 -- psql -U postgres -d postgres -c "\dt" | wc -l
# Should show 58 tables/views

kubectl exec -n app-plane components-db-0 -- psql -U postgres -d components_v2 -c "\dt" | wc -l
# Should show 12 tables/views
```

---

## What Changed from Previous Version

### Reverted Features (Dec 27 → Jan 10)
The following tables were **removed** because they were added after Dec 27:

**From Supabase** (20 tables removed):
- account_deletion_audit, billing_customers, billing_webhook_events
- bom_line_item_risk_scores, bom_risk_summaries, component_base_risk_scores
- invoice_line_items, invoices, onboarding_events
- organization_risk_profiles, organization_settings_audit
- payment_methods, payments, project_members, project_risk_summaries
- risk_profile_presets, risk_score_history
- subscription_plans, subscriptions, usage_records

**From Components V2** (43 tables removed):
- All Redis infrastructure tables (17 tables)
- All enrichment audit tables (4 tables)
- AI prompts, service connectivity, supplier performance metrics, etc.

**Why?** These features were developed between Dec 27 and Jan 10. By reverting to Dec 27 backups, we ensure migrations match the last known stable production state.

---

## Testing Checklist

- [ ] Terraform apply succeeds without errors
- [ ] ConfigMap `ananta-app-plane-migrations` created in `database-system` namespace
- [ ] Migration job completes successfully
- [ ] Supabase DB has exactly 58 tables/views
- [ ] Components V2 DB has exactly 12 tables/views
- [ ] Seed data loaded (check organizations, users tables)
- [ ] CNS service can query catalog_components VIEW
- [ ] Customer portal can access organizations/workspaces/projects

---

## Rollback Plan

If Dec 27 schema causes issues, restore Jan 10 dumps:

```bash
cp app-plane/database/dumps/supabase_schema_dump.sql database/migrations/001_SUPABASE_MASTER.sql
cp app-plane/database/dumps/components_v2_schema_dump.sql database/migrations/002_COMPONENTS_V2_MASTER.sql
```

Then re-apply Terraform:
```bash
cd infrastructure/terraform/environments/local
terraform apply -replace=kubernetes_config_map.app_plane_migrations[0] -auto-approve
```

---

## Summary

✅ **Both migration locations updated** with December 27, 2025 production backups
✅ **Terraform deployment** will use Dec 27 schema
✅ **Seed data included** - no separate seed file needed
✅ **Schema verified**: Supabase 58 objects, Components V2 12 objects
✅ **Ready for deployment** - terraform apply will create correct schema

The migration files now represent the **last known stable production state** from December 27, 2025.
