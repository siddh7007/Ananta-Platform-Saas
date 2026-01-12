# Database Schema Comparison Report
**Generated**: 2026-01-10
**Compared**: Live Kubernetes databases vs Master migration files

## Executive Summary
✅ **Supabase**: 56/57 objects (1 VIEW missing)
✅ **Components V2**: 53/55 objects (2 VIEWs missing)
✅ **Control Plane**: 5/5 tables (OK)

**Total Missing**: 3 VIEWs (all created by incremental migrations, not in master files)

---

## Supabase Database (postgres)
**Migration File**: `app-plane/database/final-migrations/001_SUPABASE_MASTER.sql`
**Tables in Migration**: 56
**Tables in Live DB**: 57

### Missing from Migration (EXISTS in DB but NOT in migration)
1. **user_profiles** (VIEW)
   - **Type**: VIEW (maps to user_preferences table)
   - **Purpose**: Provides user profile data for application use
   - **Definition**:
   ```sql
   CREATE VIEW public.user_profiles AS
   SELECT
       user_preferences.user_id AS id,
       user_preferences.user_id,
       user_preferences.last_organization_id,
       user_preferences.theme,
       user_preferences.notifications_enabled,
       user_preferences.email_notifications,
       user_preferences.language,
       user_preferences.timezone,
       user_preferences.updated_at
   FROM public.user_preferences;
   ```

---

## Components V2 Database (components_v2)
**Migration File**: `app-plane/database/final-migrations/002_COMPONENTS_V2_MASTER.sql`
**Tables in Migration**: 53
**Tables in Live DB**: 55

### Missing from Migration (EXISTS in DB but NOT in migration)

1. **catalog_components** (VIEW)
   - **Type**: VIEW (maps to component_catalog table)
   - **Purpose**: ORM compatibility layer for SQLAlchemy CatalogComponent model
   - **Critical**: Used by CNS service for component enrichment
   - **Definition**:
   ```sql
   CREATE VIEW public.catalog_components AS
   SELECT
       component_catalog.id,
       component_catalog.manufacturer_part_number AS mpn,
       component_catalog.manufacturer,
       NULL::character varying(255) AS normalized_mpn,
       NULL::character varying(255) AS normalized_manufacturer,
       component_catalog.category,
       component_catalog.subcategory,
       component_catalog.category_path,
       component_catalog.product_family,
       component_catalog.product_series,
       component_catalog.description,
       component_catalog.datasheet_url,
       component_catalog.image_url,
       component_catalog.lifecycle_status,
       component_catalog.package,
       component_catalog.unit_price,
       component_catalog.currency,
       component_catalog.price_breaks,
       component_catalog.moq,
       component_catalog.lead_time_days,
       component_catalog.stock_status,
       component_catalog.supplier_data,
       component_catalog.specifications,
       NULL::jsonb AS extracted_specs,
       component_catalog.rohs_compliant,
       component_catalog.reach_compliant,
       component_catalog.halogen_free,
       component_catalog.aec_qualified,
       component_catalog.eccn_code,
       component_catalog.quality_score,
       component_catalog.quality_metadata,
       component_catalog.ai_metadata,
       component_catalog.enrichment_source,
       component_catalog.enrichment_source AS api_source,
       component_catalog.created_at,
       component_catalog.updated_at
   FROM public.component_catalog;

   COMMENT ON VIEW public.catalog_components IS
   'ORM compatibility view mapping to component_catalog table. Used by SQLAlchemy CatalogComponent model.';
   ```

2. **directus_redis_components** (VIEW)
   - **Type**: VIEW (maps to redis_component_snapshot table)
   - **Purpose**: Redis components dashboard for Directus admin panel
   - **Definition**:
   ```sql
   CREATE VIEW public.directus_redis_components AS
   SELECT
       redis_component_snapshot.id,
       redis_component_snapshot.mpn,
       redis_component_snapshot.manufacturer,
       redis_component_snapshot.quality_score,
       'redis'::text AS storage_location,
       CASE
           WHEN (redis_component_snapshot.sync_status = 'expired'::text) THEN 'Expired'::text
           WHEN (redis_component_snapshot.expires_at < now()) THEN 'Expired'::text
           WHEN (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval)) THEN 'Expiring Soon'::text
           ELSE 'Temporary'::text
       END AS storage_status,
       redis_component_snapshot.expires_at,
       (EXTRACT(epoch FROM (redis_component_snapshot.expires_at - now())) / (3600)::numeric) AS ttl_hours,
       false AS is_permanent,
       redis_component_snapshot.reason_for_redis,
       redis_component_snapshot.can_promote,
       redis_component_snapshot.promotion_notes,
       redis_component_snapshot.sync_status,
       redis_component_snapshot.created_at,
       redis_component_snapshot.last_synced_at AS updated_at,
       redis_component_snapshot.component_data
   FROM public.redis_component_snapshot
   WHERE (redis_component_snapshot.sync_status = ANY (ARRAY['active'::text, 'expired'::text]));

   COMMENT ON VIEW public.directus_redis_components IS
   'Redis components view for Directus dashboard (Directus-only)';
   ```

---

## Control Plane Database (ananta.tenant_management)
**Migration File**: `arc-saas/docker/init-db/01-init-schemas.sql` (LoopBack migrations)
**Tables in DB**: 5

### Tables
1. contacts
2. provisioning_logs
3. resources
4. tenants
5. users

**Status**: ✅ OK (uses LoopBack migration system, no master file comparison needed)

---

## Complete Table Lists

### Supabase (57 tables + views)
```
account_deletion_audit, alert_deliveries, alert_preferences, alerts, attributes,
audit_enrichment_runs, audit_field_comparisons, audit_logs, audit_supplier_quality,
billing_customers, billing_webhook_events, bom_items, bom_jobs, bom_line_item_risk_scores,
bom_line_items, bom_processing_jobs, bom_risk_summaries, bom_uploads, boms,
categories, cns_bulk_uploads, cns_enrichment_config, cns_processing_events,
column_mapping_templates, component_base_risk_scores, component_watches, components,
enrichment_audit_log, enrichment_events, enrichment_history, enrichment_queue,
invoice_line_items, invoices, manufacturers, notifications, onboarding_events,
organization_memberships, organization_risk_profiles, organization_settings_audit,
organizations, payment_methods, payments, project_members, project_risk_summaries,
projects, risk_profile_presets, risk_score_history, subscription_plans, subscriptions,
suppliers, usage_records, user_preferences, user_profiles (VIEW), users,
workspace_members, workspace_memberships, workspaces
```

### Components V2 (55 tables + views)
```
ai_prompts, audit_enrichment_runs, audit_field_comparisons, audit_supplier_quality,
bom_queue_config, catalog_categories, catalog_category_mappings,
catalog_component_manufacturers, catalog_components (VIEW), catalog_components_table,
catalog_manufacturers, categories, category_snapshot_audit, category_source_snapshot,
cns_cache_config, cns_enrichment_config, cns_enrichment_config_history,
cns_supplier_settings, column_mapping_templates, component_catalog, component_lifecycle,
component_pricing, component_storage_tracking, components, directus_redis_components (VIEW),
enrichment_batch_jobs, enrichment_config, enrichment_history, enrichment_queue,
manufacturers, rate_limit_config, redis_cache_config, redis_circuit_breakers,
redis_cns_config, redis_component_cache_config, redis_component_snapshot,
redis_connection_config, redis_directus_config, redis_health_check, redis_health_checks,
redis_key_expiration_policy, redis_rate_limits, redis_s3_metadata_config, redis_sync_lock,
redis_sync_log, redis_temporal_config, s3_cache_config, service_connectivity_matrix,
supplier_enrichment_responses, supplier_performance_metrics, supplier_rate_limits,
supplier_settings, supplier_tokens, suppliers, vendor_category_mappings
```

---

## Action Items

### High Priority
1. ✅ Update `001_SUPABASE_MASTER.sql` with `user_profiles` VIEW definition
2. ✅ Update `002_COMPONENTS_V2_MASTER.sql` with:
   - `catalog_components` VIEW (CRITICAL - used by CNS service)
   - `directus_redis_components` VIEW

### Testing
After updating migration files:
1. Drop and recreate test databases
2. Apply master migrations
3. Verify all 57 Supabase objects exist
4. Verify all 55 Components V2 objects exist
5. Test CNS service with catalog_components VIEW

---

## Root Cause
The 3 missing VIEWs were created in incremental migrations:
- Likely in migrations 041_create_v2_table_views.sql or similar
- Were never consolidated into master migration files during cleanup
- This is why they weren't caught until full database dump comparison

## Prevention
- Always update master migration files when adding VIEWs/tables
- Run periodic dump comparisons against master migrations
- Include VIEWs in migration consolidation process
