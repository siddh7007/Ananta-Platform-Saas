# COMPLETE DATABASE DUMPS COMPARISON REPORT
**Date**: January 10, 2026
**Analyzed Dumps**:
- Dec 27, 2025 backups (backups/)
- Jan 10, 2026 dumps (app-plane/database/dumps/)
- Live Kubernetes databases
- Master migration files

---

## CRITICAL FINDINGS

###  Supabase Database Schema Changed Dramatically
Between Dec 27, 2025 and Jan 10, 2026, the Supabase schema underwent MASSIVE changes:
- **20+ tables ADDED** (billing, risk profiles, subscriptions)
- **21 tables REMOVED** (catalog tables moved to Components V2)

### Components V2 Database Grew Significantly
- **Dec 27**: Only 12 tables (minimal catalog)
- **Jan 10**: 55 tables (full enrichment infrastructure)
- **43 tables ADDED** in 2 weeks!

---

## SUPABASE DATABASE COMPARISON

### Counts
| Source | Tables/Views |
|--------|--------------|
| Dec 27, 2025 Backup | 58 |
| Jan 10, 2026 Dump | 59 |
| Live Kubernetes DB | 57 |
| Master Migration File | 56 |

### Tables ADDED After Dec 27 (20+ tables)
New functionality added between Dec 27 and Jan 10:

**Billing & Subscriptions (10 tables)**:
- account_deletion_audit
- billing_customers
- billing_webhook_events
- invoice_line_items
- invoices
- payment_methods
- payments
- subscription_plans
- subscriptions
- usage_records

**Risk Management (7 tables)**:
- bom_line_item_risk_scores
- bom_risk_summaries
- component_base_risk_scores
- organization_risk_profiles
- project_risk_summaries
- risk_profile_presets
- risk_score_history

**Other (3 tables)**:
- onboarding_events
- organization_settings_audit
- project_members

### Tables REMOVED After Dec 27 (21 tables)
These were likely moved to Components V2 or deprecated:

**Catalog Tables (moved to Components V2)**:
- catalog_categories
- catalog_components
- catalog_manufacturers
- central_component_catalog
- vendor_category_mappings

**Component Management (deprecated/refactored)**:
- component_alternatives
- component_price_history
- component_risk_scores
- component_svhc
- component_tags
- components_needing_review
- predefined_tags
- skus
- svhc_substances

**CNS/Storage (moved elsewhere)**:
- cns_cost_tracking
- cns_events_retention_summary
- enrichment_stats
- storage.buckets
- storage.migrations
- storage.objects

**Auth/Roles (refactored)**:
- role_mappings
- organization_invitations (likely merged into organization_memberships)

---

## COMPONENTS V2 DATABASE COMPARISON

### Counts
| Source | Tables/Views |
|--------|--------------|
| Dec 27, 2025 Backup | 12 |
| Jan 10, 2026 Dump | 55 |
| Live Kubernetes DB | 55 |
| Master Migration File | 53 |

### MASSIVE EXPANSION: 43 Tables Added After Dec 27

**Dec 27, 2025 - Only 12 Tables (Minimal Catalog)**:
1. component_catalog
2. catalog_components (VIEW)
3. categories
4. cns_enrichment_config
5. component_pricing
6. components
7. enrichment_config
8. manufacturers
9. supplier_enrichment_responses
10. supplier_tokens
11. suppliers
12. vendor_category_mappings

**Jan 10, 2026 - 55 Tables (Full Enrichment Infrastructure)**:

**New AI/Prompts (1 table)**:
- ai_prompts

**New Auditing (4 tables)**:
- audit_enrichment_runs
- audit_field_comparisons
- audit_supplier_quality
- category_snapshot_audit
- category_source_snapshot

**New Catalog Expansion (4 tables)**:
- catalog_categories (moved from Supabase)
- catalog_category_mappings
- catalog_component_manufacturers
- catalog_components_table
- catalog_manufacturers (moved from Supabase)

**New CNS Configuration (2 tables)**:
- cns_cache_config
- cns_enrichment_config_history
- cns_supplier_settings

**New Component Management (2 tables)**:
- component_lifecycle
- component_storage_tracking
- column_mapping_templates

**New Directus Integration (1 VIEW)**:
- directus_redis_components (VIEW for dashboard)

**New Enrichment Infrastructure (3 tables)**:
- bom_queue_config
- enrichment_batch_jobs
- enrichment_history
- enrichment_queue

**New Redis/Cache Infrastructure (17 tables!)**:
- rate_limit_config
- redis_cache_config
- redis_circuit_breakers
- redis_cns_config
- redis_component_cache_config
- redis_component_snapshot
- redis_connection_config
- redis_directus_config
- redis_health_check
- redis_health_checks
- redis_key_expiration_policy
- redis_rate_limits
- redis_s3_metadata_config
- redis_sync_lock
- redis_sync_log
- redis_temporal_config
- s3_cache_config

**New Service Infrastructure (4 tables)**:
- service_connectivity_matrix
- supplier_performance_metrics
- supplier_rate_limits
- supplier_settings

---

## MIGRATION FILES vs LIVE DATABASE

### Supabase Missing from Migration
**1 object missing** (VIEW created in incremental migration, not in master):
- user_profiles (VIEW mapping to user_preferences)

### Components V2 Missing from Migration
**2 objects missing** (VIEWs created in incremental migrations, not in master):
- catalog_components (VIEW mapping to component_catalog - CRITICAL for CNS)
- directus_redis_components (VIEW for Directus dashboard)

---

## ARCHITECTURE EVOLUTION SUMMARY

### Phase 1: Dec 27, 2025
**Simple Architecture**:
- Supabase: 58 tables (monolithic - included catalog + business data)
- Components V2: 12 tables (minimal catalog storage)

### Phase 2: Jan 10, 2026
**Separated Architecture**:
- Supabase: 59 tables (business data + billing/subscriptions + risk management)
- Components V2: 55 tables (full enrichment engine + Redis infrastructure)

**Key Migrations Between Dec 27 and Jan 10**:
1. Moved catalog tables from Supabase → Components V2
2. Added complete billing/subscription system to Supabase
3. Added comprehensive risk management to Supabase
4. Built Redis-based caching infrastructure in Components V2
5. Added enrichment audit trails in Components V2
6. Removed legacy tables (storage.*, component_alternatives, etc.)

---

## RECOMMENDATIONS

###  Update Master Migration Files
1. **001_SUPABASE_MASTER.sql** - Add user_profiles VIEW
2. **002_COMPONENTS_V2_MASTER.sql** - Add both VIEWs:
   - catalog_components (CRITICAL)
   - directus_redis_components

### Document Schema Evolution
Create migration guide explaining:
- Why catalog tables moved from Supabase to Components V2
- Billing/subscription system addition
- Risk management system addition
- Redis infrastructure rationale

### Testing Strategy
When applying migrations from scratch:
1. Verify all 59 Supabase objects exist (57 tables + 2 views)
2. Verify all 55 Components V2 objects exist (53 tables + 2 views)
3. Test CNS service with catalog_components VIEW
4. Test billing workflows
5. Test risk calculation workflows

### Incremental Migration Consolidation
The master migration files are missing VIEWs created in:
- app-plane/supabase/migrations/041_create_v2_table_views.sql (likely)
- app-plane/services/cns-service/migrations/007_component_catalog_table.sql (confirmed)

These should be consolidated into master files for future fresh deployments.

---

## FILES ANALYZED

### Backup Dumps (Dec 27, 2025)
- `e:/Work/Ananta-Platform-Saas/backups/supabase_db_20251227.sql` (58 objects)
- `e:/Work/Ananta-Platform-Saas/backups/components_v2_db_20251227.sql` (12 objects)
- `e:/Work/Ananta-Platform-Saas/backups/arc_saas_db_20251227.sql` (Control Plane)
- `e:/Work/Ananta-Platform-Saas/backups/temporal_db_20251227.sql` (Temporal)

### Recent Dumps (Jan 10, 2026)
- `e:/Work/Ananta-Platform-Saas/app-plane/database/dumps/supabase_schema_dump.sql` (59 objects)
- `e:/Work/Ananta-Platform-Saas/app-plane/database/dumps/components_v2_schema_dump.sql` (55 objects)
- `e:/Work/Ananta-Platform-Saas/app-plane/database/dumps/supabase_seed_data.sql` (seed data)

### Master Migrations
- `e:/Work/Ananta-Platform-Saas/app-plane/database/final-migrations/001_SUPABASE_MASTER.sql` (56 tables)
- `e:/Work/Ananta-Platform-Saas/app-plane/database/final-migrations/002_COMPONENTS_V2_MASTER.sql` (53 tables)
- `e:/Work/Ananta-Platform-Saas/app-plane/database/final-migrations/000_SEED_DATA.sql` (seed data)

### Live Databases (Kubernetes - Jan 10, 2026)
- Supabase (app-plane/supabase-db-0): 57 tables
- Components V2 (app-plane/components-db-0): 55 tables
- Control Plane (database-system/ananta-local-pg-1): 5 tables

---

## CONCLUSION

The database schema underwent **massive evolution** in 2 weeks (Dec 27 → Jan 10):
- **20 tables added** to Supabase (billing, risk management)
- **21 tables removed** from Supabase (catalog moved to Components V2)
- **43 tables added** to Components V2 (Redis infrastructure, enrichment)

Migration files are **mostly complete** but missing **3 VIEWs** that need to be added.

All missing objects are VIEWs (not tables), which explains why they were overlooked during migration consolidation.

**Next Steps**:
1. Update master migration files with 3 missing VIEWs
2. Test fresh database creation from master migrations
3. Document architecture changes in ARCHITECTURE.md
4. Consider creating migration guide for Dec 27 → Jan 10 changes
