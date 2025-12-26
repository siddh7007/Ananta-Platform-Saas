# Database Schema Audit Report - Tenant Isolation & Data Integrity

**Generated**: 2025-12-16
**Auditor**: Database Administrator Agent
**Databases Audited**:
- Supabase (app-plane-supabase-db:27432)
- Control Plane (arc-saas-postgres:5432)
- Components-V2 (app-plane-components-v2-postgres:27010)

---

## Executive Summary

### Overall Assessment: NEEDS IMPROVEMENT

**Critical Findings**:
1. **24 tables in Supabase lack tenant isolation** - HIGH RISK for data leakage
2. **RLS policies missing for 33 tables** in Supabase - Access control gaps
3. **7 control plane tables lack tenant_id** - Some are expected (plans, tenants), others need review
4. **Components-V2 has minimal tenant isolation** - Shared catalog model (acceptable)
5. **Inconsistent CASCADE DELETE policies** - Risk of orphaned data

**Risk Level**: MEDIUM-HIGH
**Recommendation**: Implement missing tenant isolation within 2 weeks

---

## 1. Supabase Database Analysis (App Plane - Port 27432)

### 1.1 Tenant Isolation Status

#### Tables WITH Tenant Isolation (25 tables)

| Table Name | Isolation Column | Nullable | Indexed | RLS Enabled |
|------------|------------------|----------|---------|-------------|
| alert_preferences | organization_id | NO | YES | YES |
| alerts | organization_id | NO | YES | YES |
| audit_logs | organization_id | NO | YES | NO |
| bom_jobs | organization_id | YES | YES | YES |
| bom_uploads | organization_id | NO | YES | YES |
| boms | organization_id | NO | YES | YES |
| cns_bulk_uploads | organization_id + tenant_id | NO | YES (both) | YES |
| cns_cost_tracking | tenant_id | YES | YES | NO |
| cns_enrichment_config | tenant_id | YES | YES | NO |
| component_alternatives | organization_id | NO | NO | NO |
| component_risk_scores | organization_id | NO | NO | NO |
| component_watches | organization_id | NO | YES | YES |
| components | organization_id | YES | YES | YES |
| enrichment_audit_log | organization_id | NO | NO | NO |
| enrichment_events | organization_id + tenant_id | YES/NO | YES | YES |
| notifications | organization_id | NO | YES | YES |
| organization_invitations | organization_id | NO | YES | YES |
| organization_memberships | organization_id | NO | YES | YES |
| projects | organization_id | NO | YES | YES |
| skus | organization_id | NO | YES | NO |
| user_profiles | organization_id | YES | YES | YES |
| users | organization_id | YES | YES | YES |
| workspaces | organization_id | NO | YES | YES |

#### Tables WITHOUT Tenant Isolation (24 tables) - CRITICAL

| Table Name | Risk Level | Recommended Action |
|------------|------------|-------------------|
| **attributes** | HIGH | Add organization_id FK to components |
| **audit_enrichment_runs** | HIGH | Add tenant_id for isolation |
| **audit_field_comparisons** | HIGH | Add tenant_id via enrichment_run_id |
| **audit_supplier_quality** | HIGH | Add tenant_id for isolation |
| **bom_items** | HIGH | Add organization_id via job_id |
| **bom_line_items** | HIGH | Add organization_id via bom_id |
| catalog_categories | LOW | Shared catalog (OK) |
| catalog_components | LOW | Shared catalog (OK) |
| catalog_manufacturers | LOW | Shared catalog (OK) |
| categories | LOW | Shared catalog (OK) |
| central_component_catalog | LOW | Shared catalog (OK) |
| **component_price_history** | MEDIUM | Add organization_id via component_id |
| **component_svhc** | MEDIUM | Add organization_id via component_id |
| **component_tags** | MEDIUM | Add organization_id via component_id |
| **enrichment_history** | HIGH | Add tenant_id for isolation |
| **enrichment_queue** | HIGH | Add organization_id for isolation |
| manufacturers | LOW | Shared catalog (OK) |
| organizations | N/A | Root tenant table |
| predefined_tags | LOW | Shared resource (OK) |
| suppliers | LOW | Shared catalog (OK) |
| svhc_substances | LOW | Reference data (OK) |
| **user_preferences** | MEDIUM | Has last_organization_id but needs primary org_id |
| vendor_category_mappings | LOW | Shared mapping (OK) |
| **workspace_members** | MEDIUM | Add organization_id via workspace_id |

**CRITICAL**: 12 tables marked HIGH/MEDIUM risk need tenant isolation added immediately.

### 1.2 Row-Level Security (RLS) Status

#### RLS Enabled Tables (14 with policies)

| Table | Policy Name | Access Rule |
|-------|-------------|-------------|
| bom_items | bom_items_select | Platform admin OR user matches job email |
| bom_jobs | bom_jobs_select | Platform admin OR user matches source email |
| boms | Users can view own org boms | org_id matches OR platform admin |
| categories | Anyone can view categories | Public access |
| components | Users can view own org components | org_id matches OR platform admin |
| enrichment_events | Users can view own org enrichment events | tenant_id matches OR platform admin |
| enrichment_events | Service role can insert enrichment events | Service role only |
| manufacturers | Anyone can view manufacturers | Public access |
| organizations | Users can view own org | org_id matches OR platform admin |
| predefined_tags | Anyone can view predefined tags | Public access |
| projects | Users can view own org projects | org_id matches OR platform admin |
| suppliers | Anyone can view suppliers | Public access |
| svhc_substances | Anyone can view SVHC substances | Public access |
| user_profiles | Users can view own org users | org_id matches OR platform admin |

#### RLS Enabled But No Policies (17 tables) - SECURITY GAP

These tables have RLS enabled but no policies defined, meaning **NO ACCESS**:
- alert_preferences
- alerts
- bom_uploads
- cns_bulk_uploads
- component_watches
- enrichment_queue
- notifications
- organization_invitations
- organization_memberships
- user_preferences
- users
- workspace_members
- workspaces
- bom_line_items (Has RLS but needs policy)

**ACTION REQUIRED**: Add RLS policies for all tables with organization_id.

#### RLS Disabled (33 tables) - SECURITY GAP

These tables should have RLS enabled:
- **High Priority**: attributes, audit_enrichment_runs, audit_field_comparisons, audit_supplier_quality, bom_items (has policy but enforced differently), component_alternatives, component_risk_scores, component_svhc, component_tags, enrichment_audit_log, enrichment_history, skus, workspace_members
- **Medium Priority**: audit_logs, cns_cost_tracking, cns_enrichment_config, component_price_history, vendor_category_mappings
- **Low Priority** (shared catalogs): catalog_categories, catalog_components, catalog_manufacturers, central_component_catalog

### 1.3 Foreign Key Constraints & CASCADE DELETE

#### Proper CASCADE DELETE on organization_id (Good)

These tables properly cascade delete when organization is removed:
- alert_preferences, alerts, bom_uploads, boms, cns_bulk_uploads, component_alternatives, component_risk_scores, component_watches, components, enrichment_audit_log, notifications, organization_invitations, organization_memberships, projects, skus, user_profiles, workspaces

#### Missing CASCADE DELETE (Risk of Orphaned Data)

| Table | Column | Current Rule | Should Be |
|-------|--------|--------------|-----------|
| users | organization_id | NO ACTION | CASCADE or SET NULL |
| boms.created_by_id | user_profiles.id | NO ACTION | SET NULL |
| alerts.user_id | user_profiles.id | NO ACTION | SET NULL |
| component_alternatives.verified_by | user_profiles.id | NO ACTION | SET NULL |
| component_tags.created_by | user_profiles.id | NO ACTION | SET NULL |
| vendor_category_mappings.verified_by | user_profiles.id | NO ACTION | SET NULL |

**RECOMMENDATION**: Update FK constraints to use CASCADE or SET NULL to prevent orphaned records.

### 1.4 Index Coverage for Multi-Tenant Queries

#### Well-Indexed Tables (32 indexes found)

Good coverage for organization_id/tenant_id queries:
- All primary tenant tables have `idx_{table}_org` indexes
- Composite indexes for common queries (e.g., `idx_user_profiles_org`, `idx_enrichment_events_tenant`)
- Unique constraints properly include organization_id (e.g., `projects_organization_id_slug_key`)

#### Missing Indexes (Performance Risk)

| Table | Missing Index | Query Impact |
|-------|--------------|--------------|
| component_alternatives | organization_id | Slow alternative lookups per org |
| component_risk_scores | organization_id | Slow risk queries per org |
| component_svhc | (none - uses component FK) | OK if component_id indexed |
| component_tags | (none - uses component FK) | OK if component_id indexed |
| enrichment_audit_log | organization_id | Slow audit queries per org |

**RECOMMENDATION**: Add indexes on organization_id for tables with direct tenant isolation.

---

## 2. Control Plane Database Analysis (Port 5432)

### 2.1 Tenant Isolation Status

#### Tables WITH tenant_id (15 tables)

| Table Name | Nullable | Indexed | Foreign Key |
|------------|----------|---------|-------------|
| audit_logs | YES | YES (3 indexes) | NO |
| contacts | NO | NO | YES (tenants.id) |
| invoices | NO | YES | YES (CASCADE) |
| notification_history | NO | YES (2 indexes) | YES (CASCADE) |
| payment_intents | NO | YES | YES (CASCADE) |
| payment_methods | NO | YES | YES (CASCADE) |
| resources | NO | YES (unique with ext_id) | NO |
| subscriptions | YES | YES | YES (CASCADE) |
| tenant_quotas | NO | YES (unique with metric) | YES (CASCADE) |
| usage_events | NO | YES (2 indexes) | YES (CASCADE) |
| usage_summaries | NO | YES (3 indexes) | YES (CASCADE) |
| user_activities | NO | YES | NO ACTION FK |
| user_invitations | NO | YES | NO ACTION FK |
| user_roles | NO | YES | NO ACTION FK |
| users | NO | YES (unique with email) | NO ACTION FK |

#### Tables WITHOUT tenant_id (7 tables)

| Table Name | Expected? | Notes |
|------------|-----------|-------|
| tenants | YES | Root tenant table - no isolation needed |
| plans | YES | Shared platform plans - OK |
| addresses | YES | Shared via FK from leads/tenants - OK |
| platform_config | YES | Global platform settings - OK |
| settings | REVIEW | May need tenant_id if per-tenant settings |
| feature_flags | REVIEW | May need tenant_id for per-tenant flags |
| leads | YES | Pre-tenant entities - no tenant_id needed |

**ASSESSMENT**: Most tables correctly lack tenant_id (global resources). Review `settings` and `feature_flags` for potential tenant-specific requirements.

### 2.2 Foreign Key Constraints

#### Good CASCADE DELETE Coverage

Most tenant-related tables properly cascade delete:
- invoices, notification_history, payment_intents, payment_methods, subscriptions, tenant_quotas, usage_events, usage_summaries

#### Weak CASCADE DELETE (Risk)

| Table | Column | Current Rule | Issue |
|-------|--------|--------------|-------|
| user_activities | tenant_id | NO ACTION | Should CASCADE |
| user_invitations | tenant_id | NO ACTION | Should CASCADE |
| user_roles | tenant_id | NO ACTION | Should CASCADE |
| users | tenant_id | NO ACTION | Should CASCADE or SET NULL |
| contacts | tenant_id | NO ACTION | Should CASCADE |
| user_activities | user_id | CASCADE | OK |
| user_roles | user_id | CASCADE | OK |

**RECOMMENDATION**: Update NO ACTION constraints to CASCADE for proper tenant deletion cleanup.

### 2.3 Index Coverage

Excellent index coverage:
- 22 indexes on tenant_id columns
- Composite indexes for common queries (tenant + timestamp, tenant + status)
- Unique constraints properly scoped to tenant (e.g., `uk_users_email_tenant`)

**ASSESSMENT**: Index coverage is optimal for multi-tenant queries.

---

## 3. Components-V2 Database Analysis (Port 27010)

### 3.1 Tenant Isolation Status

#### Tables WITH Tenant Isolation (2 tables)

| Table Name | Column | Nullable | Purpose |
|------------|--------|----------|---------|
| enrichment_config | organization_id | YES | Per-org enrichment settings |
| cns_enrichment_config | (unknown) | - | CNS-specific config |

#### Tables WITHOUT Tenant Isolation (9 tables) - EXPECTED

| Table Name | Isolation | Notes |
|------------|-----------|-------|
| categories | NONE | Shared component categories - OK |
| component_catalog | NONE | Centralized enriched component catalog - OK |
| component_pricing | NONE | Shared pricing data - OK |
| components | NONE | Original shared catalog - OK |
| manufacturers | NONE | Shared manufacturer registry - OK |
| supplier_enrichment_responses | NONE | Shared API responses - OK |
| supplier_tokens | NONE | Shared OAuth tokens - OK |
| suppliers | NONE | Shared supplier data - OK |
| vendor_category_mappings | NONE | Shared category mappings - OK |

**ASSESSMENT**: Components-V2 is a **shared catalog database** - tenant isolation NOT required. This is the correct architecture (SSOT for component data).

### 3.2 Foreign Key Constraints

Good referential integrity:
- All component relationships use CASCADE DELETE
- Category hierarchy uses CASCADE DELETE
- Pricing linked to components and suppliers

**ASSESSMENT**: FK constraints are appropriate for shared catalog model.

### 3.3 Security Model

Components-V2 uses **application-level access control** via CNS service API:
- No RLS policies needed (database is backend-only)
- Access controlled via CNS service endpoints
- API requires organization_id for queries

**ASSESSMENT**: Security model is appropriate for microservice architecture.

---

## 4. Critical Issues & Recommendations

### 4.1 CRITICAL - Supabase Tenant Isolation Gaps

**Issue**: 12 high/medium risk tables lack tenant isolation columns.

**Impact**:
- Risk of cross-tenant data leakage
- Cannot enforce RLS policies
- Difficult to audit per-tenant data
- No cascade delete on tenant removal

**Affected Tables**:
1. attributes - Component metadata without isolation
2. audit_enrichment_runs - Audit trail not isolated
3. audit_field_comparisons - Audit details not isolated
4. audit_supplier_quality - Quality metrics not isolated
5. bom_items - BOM processing items not isolated
6. bom_line_items - BOM line items not isolated (critical!)
7. component_price_history - Pricing history not isolated
8. component_svhc - SVHC associations not isolated
9. component_tags - Tag associations not isolated
10. enrichment_history - Enrichment history not isolated
11. enrichment_queue - Queue entries not isolated
12. workspace_members - Membership not isolated

**Recommended Fix**:
```sql
-- Example migration for bom_line_items
ALTER TABLE bom_line_items
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_bom_line_items_org ON bom_line_items(organization_id);

-- Populate from parent bom
UPDATE bom_line_items bli
SET organization_id = b.organization_id
FROM boms b
WHERE bli.bom_id = b.id;

-- Add RLS policy
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org bom line items"
ON bom_line_items FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());
```

**Priority**: CRITICAL - Implement within 1 week

### 4.2 CRITICAL - Missing RLS Policies

**Issue**: 17 tables have RLS enabled but no policies (denying all access) + 13 high-priority tables without RLS.

**Impact**:
- Access denied to legitimate users for 17 tables
- 13 tables have no row-level security enforcement
- Inconsistent security posture

**Recommended Fix**:
1. Add SELECT policies for all organization_id tables
2. Add INSERT/UPDATE/DELETE policies as needed per table
3. Enable RLS on remaining high-priority tables

**Standard Policy Template**:
```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "org_isolation_select_{table_name}"
ON {table_name} FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- INSERT policy (if needed)
CREATE POLICY "org_isolation_insert_{table_name}"
ON {table_name} FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

-- UPDATE policy (if needed)
CREATE POLICY "org_isolation_update_{table_name}"
ON {table_name} FOR UPDATE
USING (organization_id = current_user_organization_id());

-- DELETE policy (if needed)
CREATE POLICY "org_isolation_delete_{table_name}"
ON {table_name} FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());
```

**Priority**: CRITICAL - Implement within 1 week

### 4.3 HIGH - Inconsistent CASCADE DELETE

**Issue**: Some FK constraints use NO ACTION instead of CASCADE/SET NULL.

**Impact**:
- Orphaned records when tenants/users deleted
- Failed deletions due to FK constraints
- Data integrity issues

**Affected Constraints**:
- Supabase: users.organization_id, various user_id references
- Control Plane: user_activities.tenant_id, user_invitations.tenant_id, user_roles.tenant_id

**Recommended Fix**:
```sql
-- Example: Fix users.organization_id
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_organization_id_fkey,
ADD CONSTRAINT users_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Example: Fix user references to SET NULL
ALTER TABLE boms
DROP CONSTRAINT IF EXISTS boms_created_by_id_fkey,
ADD CONSTRAINT boms_created_by_id_fkey
  FOREIGN KEY (created_by_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;
```

**Priority**: HIGH - Implement within 2 weeks

### 4.4 MEDIUM - Missing Indexes

**Issue**: Some tenant isolation columns lack indexes.

**Impact**:
- Slow queries when filtering by organization_id
- Performance degradation as data grows

**Recommended Fix**:
```sql
CREATE INDEX idx_component_alternatives_org ON component_alternatives(organization_id);
CREATE INDEX idx_component_risk_scores_org ON component_risk_scores(organization_id);
CREATE INDEX idx_enrichment_audit_log_org ON enrichment_audit_log(organization_id);
```

**Priority**: MEDIUM - Implement within 1 month

### 4.5 LOW - Control Plane Settings Review

**Issue**: `settings` and `feature_flags` tables lack tenant_id.

**Impact**:
- Cannot have per-tenant settings/flags
- All settings are global

**Recommended Action**:
1. Review business requirements for per-tenant settings
2. If needed, add tenant_id columns with nullable constraint
3. NULL tenant_id = global, non-NULL = tenant-specific

**Priority**: LOW - Review requirements first

---

## 5. Security Best Practices Compliance

### 5.1 Multi-Tenant Isolation - PARTIAL COMPLIANCE

- Control Plane: GOOD (15/22 tables, 68%)
- Supabase: NEEDS IMPROVEMENT (25/49 tables, 51%)
- Components-V2: N/A (shared catalog by design)

**Target**: 100% of tenant-specific tables should have isolation

### 5.2 Row-Level Security - PARTIAL COMPLIANCE

- RLS Enabled: 47 tables (14 with policies, 33 without)
- RLS Disabled: 33 high-priority tables

**Target**: 100% of tenant-isolated tables should have RLS + policies

### 5.3 Referential Integrity - GOOD

- 96 foreign key constraints defined
- Most use appropriate CASCADE rules
- Some NO ACTION constraints need review

**Target**: All tenant/user FKs should CASCADE or SET NULL

### 5.4 Index Coverage - GOOD

- 54 indexes on tenant isolation columns
- Most high-traffic tables well-indexed
- Few missing indexes identified

**Target**: All tenant isolation columns indexed

---

## 6. Disaster Recovery & Data Integrity

### 6.1 Tenant Deletion Impact

**Current State**:
- Control Plane: Proper CASCADE on most tables
- Supabase: Proper CASCADE on 25 tables, missing on 12 tables

**Risk**: Deleting a tenant may leave orphaned data in 12 Supabase tables.

**Test Scenario**:
```sql
-- Test cascade delete
BEGIN;
DELETE FROM organizations WHERE id = 'test-org-uuid';
-- Check for orphans
SELECT 'bom_line_items' as table, count(*) FROM bom_line_items WHERE bom_id IN (SELECT id FROM boms WHERE organization_id = 'test-org-uuid');
ROLLBACK;
```

**Recommendation**: Test cascade delete thoroughly before production tenant deletion.

### 6.2 Data Consistency Checks

**Recommended Periodic Checks**:
```sql
-- Find orphaned bom_line_items (no parent bom)
SELECT COUNT(*) FROM bom_line_items bli
LEFT JOIN boms b ON bli.bom_id = b.id
WHERE b.id IS NULL;

-- Find orphaned component associations
SELECT COUNT(*) FROM component_tags ct
LEFT JOIN components c ON ct.component_id = c.id
WHERE c.id IS NULL;

-- Find users without valid organization
SELECT COUNT(*) FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.organization_id IS NOT NULL AND o.id IS NULL;
```

**Recommendation**: Add to monitoring/alerting system.

---

## 7. Implementation Roadmap

### Week 1 (CRITICAL)
1. Add organization_id to bom_line_items with backfill
2. Add RLS policies for 17 tables with RLS enabled
3. Test tenant deletion cascade

### Week 2 (CRITICAL)
4. Add organization_id to remaining 11 high-risk tables
5. Enable RLS on 13 high-priority tables
6. Add missing RLS policies
7. Update FK constraints to use CASCADE/SET NULL

### Week 3-4 (HIGH)
8. Add missing indexes for performance
9. Test RLS policies with real user scenarios
10. Document security model for developers

### Month 2 (MEDIUM)
11. Review settings/feature_flags for tenant isolation
12. Implement data consistency monitoring
13. Conduct penetration testing for tenant isolation

### Month 3 (LOW)
14. Performance testing with large datasets
15. Optimize indexes based on query patterns
16. Document disaster recovery procedures

---

## 8. Monitoring & Alerting Recommendations

### 8.1 Security Monitoring

Add alerts for:
- RLS policy violations (logged in Postgres logs)
- Cross-tenant data access attempts
- Failed authorization checks
- Orphaned records detected

### 8.2 Performance Monitoring

Add metrics for:
- Query performance by organization_id
- Index usage statistics
- Slow queries on tenant tables
- Database connection pool per tenant

### 8.3 Data Integrity Monitoring

Add scheduled checks for:
- Orphaned records (daily)
- Missing tenant isolation (weekly)
- FK constraint violations (daily)
- RLS policy coverage (weekly)

---

## 9. Conclusion

The current database schema has a solid foundation but requires immediate attention to complete tenant isolation and security policies in the Supabase database.

**Summary Scorecard**:
- Tenant Isolation: 6/10 (needs improvement)
- RLS Coverage: 4/10 (critical gaps)
- FK Integrity: 8/10 (good, minor fixes needed)
- Index Coverage: 9/10 (excellent)
- Overall: 6.75/10 - NEEDS IMPROVEMENT

**Next Steps**:
1. Review and approve recommended fixes
2. Create migration scripts for Week 1 changes
3. Test in staging environment
4. Deploy to production with rollback plan
5. Monitor for 48 hours post-deployment

**Estimated Effort**: 40-60 hours over 4 weeks

---

## Appendix A: SQL Migration Templates

### Template 1: Add Tenant Isolation Column
```sql
-- Add column with default and FK
ALTER TABLE {table_name}
ADD COLUMN organization_id UUID NOT NULL DEFAULT '{default_org_id}'
REFERENCES organizations(id) ON DELETE CASCADE;

-- Remove default after backfill
ALTER TABLE {table_name}
ALTER COLUMN organization_id DROP DEFAULT;

-- Add index
CREATE INDEX idx_{table_name}_org ON {table_name}(organization_id);
```

### Template 2: Enable RLS with Policies
```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Add SELECT policy
CREATE POLICY "org_isolation_select_{table_name}"
ON {table_name} FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());
```

### Template 3: Update FK Constraint
```sql
-- Update to CASCADE
ALTER TABLE {table_name}
DROP CONSTRAINT IF EXISTS {constraint_name},
ADD CONSTRAINT {constraint_name}
  FOREIGN KEY ({column_name})
  REFERENCES {ref_table}(id)
  ON DELETE CASCADE;
```

---

## Appendix B: Testing Checklist

### Pre-Migration Tests
- [ ] Backup all databases
- [ ] Test restore procedure
- [ ] Document current row counts per table
- [ ] Identify test tenant for validation

### Post-Migration Tests
- [ ] Verify all tables have expected isolation columns
- [ ] Test RLS policies with different user roles
- [ ] Verify cascade delete works correctly
- [ ] Check for orphaned records
- [ ] Performance test common queries
- [ ] Verify indexes are used (EXPLAIN ANALYZE)
- [ ] Test tenant creation/deletion end-to-end

### Rollback Plan
- [ ] SQL scripts to drop new columns/constraints
- [ ] SQL scripts to disable RLS
- [ ] Backup restore procedure
- [ ] Communication plan for downtime

---

**Report End**
