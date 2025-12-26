-- Migration: 077_rls_cleanup_best_practices.sql
-- Description: Clean up RLS policies following best practices
--
-- Best Practices Applied:
-- 1. No service_role policies (Supabase service key bypasses RLS automatically)
-- 2. Consolidated super_admin into main policies (OR is_super_admin())
-- 3. Single ALL policy instead of split CRUD when conditions are same
-- 4. Consistent naming: {table}_{access_pattern}
--
-- Target: Reduce from 74 policies to ~38 policies

BEGIN;

-- ============================================================================
-- PHASE 1: Remove Redundant service_role Policies (26 policies)
-- These are unnecessary - Supabase service key bypasses RLS automatically
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access to alert_deliveries" ON alert_deliveries;
DROP POLICY IF EXISTS "Service role full access to alert_preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Service role full access to alerts" ON alerts;
DROP POLICY IF EXISTS "audit_logs_service_role_all" ON audit_logs;
DROP POLICY IF EXISTS "Service role has full access to billing_customers" ON billing_customers;
DROP POLICY IF EXISTS "Service role full access to bom_items" ON bom_items;
DROP POLICY IF EXISTS "Service role full access to line items" ON bom_line_items;
DROP POLICY IF EXISTS "Service role full access to uploads" ON bom_uploads;
DROP POLICY IF EXISTS "Service role full access to boms" ON boms;
DROP POLICY IF EXISTS "component_base_risk_modify_policy" ON component_base_risk_scores;
DROP POLICY IF EXISTS "component_base_risk_select_policy" ON component_base_risk_scores;
DROP POLICY IF EXISTS "Service role full access to component_watches" ON component_watches;
DROP POLICY IF EXISTS "Service role full access to audit_log" ON enrichment_audit_log;
DROP POLICY IF EXISTS "Service role full access to events" ON enrichment_events;
DROP POLICY IF EXISTS "Service role full access to queue" ON enrichment_queue;
DROP POLICY IF EXISTS "Service role has full access to invoice_line_items" ON invoice_line_items;
DROP POLICY IF EXISTS "Service role has full access to invoices" ON invoices;
DROP POLICY IF EXISTS "Service role full access to notifications" ON notifications;
DROP POLICY IF EXISTS "Service role full access to memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Service role full access to tenants" ON organizations;
DROP POLICY IF EXISTS "Service role has full access to payment_methods" ON payment_methods;
DROP POLICY IF EXISTS "Service role has full access to payments" ON payments;
DROP POLICY IF EXISTS "Service role full access to projects" ON projects;
DROP POLICY IF EXISTS "Service role has full access to subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role has full access to usage_records" ON usage_records;
DROP POLICY IF EXISTS "Service role full access to users" ON users;

-- ============================================================================
-- PHASE 2: Remove Redundant super_admin-Only Policies (6 policies)
-- These will be consolidated into main policies with OR is_super_admin()
-- ============================================================================

DROP POLICY IF EXISTS "Anon super admin access to alert_deliveries" ON alert_deliveries;
DROP POLICY IF EXISTS "Anon super admin access to alert_preferences" ON alert_preferences;
DROP POLICY IF EXISTS "Anon super admin access to audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Anon super admin access to component_watches" ON component_watches;
DROP POLICY IF EXISTS "Super admins can manage all tenants" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

-- ============================================================================
-- PHASE 3: Remove Split CRUD Policies (will recreate as consolidated ALL)
-- ============================================================================

-- bom_line_item_risk_scores: 4 policies -> 1
DROP POLICY IF EXISTS "bli_risk_delete_policy" ON bom_line_item_risk_scores;
DROP POLICY IF EXISTS "bli_risk_insert_policy" ON bom_line_item_risk_scores;
DROP POLICY IF EXISTS "bli_risk_select_policy" ON bom_line_item_risk_scores;
DROP POLICY IF EXISTS "bli_risk_update_policy" ON bom_line_item_risk_scores;

-- bom_risk_summaries: 4 policies -> 1
DROP POLICY IF EXISTS "bom_risk_summary_delete_policy" ON bom_risk_summaries;
DROP POLICY IF EXISTS "bom_risk_summary_insert_policy" ON bom_risk_summaries;
DROP POLICY IF EXISTS "bom_risk_summary_select_policy" ON bom_risk_summaries;
DROP POLICY IF EXISTS "bom_risk_summary_update_policy" ON bom_risk_summaries;

-- organization_risk_profiles: 4 policies -> 1
DROP POLICY IF EXISTS "org_risk_profiles_delete_policy" ON organization_risk_profiles;
DROP POLICY IF EXISTS "org_risk_profiles_insert_policy" ON organization_risk_profiles;
DROP POLICY IF EXISTS "org_risk_profiles_select_policy" ON organization_risk_profiles;
DROP POLICY IF EXISTS "org_risk_profiles_update_policy" ON organization_risk_profiles;

-- project_risk_summaries: 4 policies -> 1
DROP POLICY IF EXISTS "project_risk_summary_delete_policy" ON project_risk_summaries;
DROP POLICY IF EXISTS "project_risk_summary_insert_policy" ON project_risk_summaries;
DROP POLICY IF EXISTS "project_risk_summary_select_policy" ON project_risk_summaries;
DROP POLICY IF EXISTS "project_risk_summary_update_policy" ON project_risk_summaries;

-- risk_score_history: 3 policies -> 1
DROP POLICY IF EXISTS "risk_history_delete_policy" ON risk_score_history;
DROP POLICY IF EXISTS "risk_history_insert_policy" ON risk_score_history;
DROP POLICY IF EXISTS "risk_history_select_policy" ON risk_score_history;

-- ============================================================================
-- PHASE 4: Remove Old Policies Before Renaming
-- ============================================================================

-- alerts
DROP POLICY IF EXISTS "Authenticated users access own org alerts" ON alerts;

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_organization_access" ON audit_logs;

-- bom_items
DROP POLICY IF EXISTS "Authenticated users access own org bom_items" ON bom_items;

-- bom_line_items
DROP POLICY IF EXISTS "Users can manage own org line items" ON bom_line_items;

-- bom_uploads
DROP POLICY IF EXISTS "Authenticated users access own org uploads" ON bom_uploads;

-- boms
DROP POLICY IF EXISTS "Authenticated users access own org boms" ON boms;

-- enrichment_audit_log
DROP POLICY IF EXISTS "Authenticated users access own org audit_log" ON enrichment_audit_log;

-- enrichment_events
DROP POLICY IF EXISTS "Authenticated users access own org events" ON enrichment_events;

-- enrichment_queue
DROP POLICY IF EXISTS "Authenticated users access own org queue" ON enrichment_queue;

-- notifications
DROP POLICY IF EXISTS "Authenticated users access own notifications" ON notifications;

-- organization_memberships
DROP POLICY IF EXISTS "Authenticated users access own org memberships" ON organization_memberships;

-- organizations
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;

-- projects
DROP POLICY IF EXISTS "Authenticated users access own org projects" ON projects;

-- users
DROP POLICY IF EXISTS "Users can view own org users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- alert_deliveries
DROP POLICY IF EXISTS "Users see own alert deliveries" ON alert_deliveries;

-- alert_preferences
DROP POLICY IF EXISTS "Users manage own alert preferences" ON alert_preferences;

-- component_watches
DROP POLICY IF EXISTS "Users manage own component watches" ON component_watches;

-- subscription_plans
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON subscription_plans;

-- onboarding_events
DROP POLICY IF EXISTS "System can insert onboarding events" ON onboarding_events;

-- organization_settings_audit
DROP POLICY IF EXISTS "System can insert audit records" ON organization_settings_audit;

-- account_deletion_audit (keep special logic but rename)
DROP POLICY IF EXISTS "deletion_audit_org_owner" ON account_deletion_audit;
DROP POLICY IF EXISTS "deletion_audit_super_admin" ON account_deletion_audit;

-- ============================================================================
-- PHASE 5: Create New Consolidated Policies with Consistent Naming
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ORG-SCOPED TABLES: {table}_org_access
-- Pattern: organization_id = current_user_organization_id() OR is_super_admin()
-- ---------------------------------------------------------------------------

-- alerts
CREATE POLICY "alerts_org_access" ON alerts FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- bom_items (via JOIN to bom_jobs)
CREATE POLICY "bom_items_org_access" ON bom_items FOR ALL
USING (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM bom_jobs j
        WHERE j.id = bom_items.job_id::integer
        AND j.organization_id::text = current_user_organization_id()::text
    )
)
WITH CHECK (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM bom_jobs j
        WHERE j.id = bom_items.job_id::integer
        AND j.organization_id::text = current_user_organization_id()::text
    )
);

-- bom_line_items (via JOIN to boms)
CREATE POLICY "bom_line_items_org_access" ON bom_line_items FOR ALL
USING (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM boms
        WHERE boms.id = bom_line_items.bom_id
        AND boms.organization_id = current_user_organization_id()
    )
)
WITH CHECK (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM boms
        WHERE boms.id = bom_line_items.bom_id
        AND boms.organization_id = current_user_organization_id()
    )
);

-- bom_line_item_risk_scores
CREATE POLICY "bom_line_item_risk_scores_org_access" ON bom_line_item_risk_scores FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- bom_risk_summaries
CREATE POLICY "bom_risk_summaries_org_access" ON bom_risk_summaries FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- bom_uploads
CREATE POLICY "bom_uploads_org_access" ON bom_uploads FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- boms
CREATE POLICY "boms_org_access" ON boms FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- enrichment_audit_log
CREATE POLICY "enrichment_audit_log_org_access" ON enrichment_audit_log FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- enrichment_events
CREATE POLICY "enrichment_events_org_access" ON enrichment_events FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- enrichment_queue
CREATE POLICY "enrichment_queue_org_access" ON enrichment_queue FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- notifications
CREATE POLICY "notifications_org_access" ON notifications FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- organization_memberships
CREATE POLICY "organization_memberships_org_access" ON organization_memberships FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- organization_risk_profiles
CREATE POLICY "organization_risk_profiles_org_access" ON organization_risk_profiles FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- project_risk_summaries
CREATE POLICY "project_risk_summaries_org_access" ON project_risk_summaries FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- projects
CREATE POLICY "projects_org_access" ON projects FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- risk_score_history
CREATE POLICY "risk_score_history_org_access" ON risk_score_history FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- USER-SCOPED TABLES: {table}_user_access
-- Pattern: user_id = auth.uid() OR is_super_admin()
-- ---------------------------------------------------------------------------

-- alert_deliveries (via alert_id -> alerts.user_id)
CREATE POLICY "alert_deliveries_user_access" ON alert_deliveries FOR ALL
USING (
    is_super_admin() OR
    alert_id IN (SELECT id FROM alerts WHERE user_id = auth.uid())
)
WITH CHECK (
    is_super_admin() OR
    alert_id IN (SELECT id FROM alerts WHERE user_id = auth.uid())
);

-- alert_preferences
CREATE POLICY "alert_preferences_user_access" ON alert_preferences FOR ALL
USING (user_id = auth.uid() OR is_super_admin())
WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- component_watches
CREATE POLICY "component_watches_user_access" ON component_watches FOR ALL
USING (user_id = auth.uid() OR is_super_admin())
WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- SPECIAL TABLES
-- ---------------------------------------------------------------------------

-- organizations: Users view own org, super_admin manages all
CREATE POLICY "organizations_access" ON organizations FOR ALL
USING (id = current_user_organization_id() OR is_super_admin())
WITH CHECK (is_super_admin());

-- users: Two policies for different access patterns
-- 1. SELECT: View users in same org
CREATE POLICY "users_org_select" ON users FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

-- 2. UPDATE: Update own profile only
CREATE POLICY "users_own_update" ON users FOR UPDATE
USING (id = auth.uid() OR is_super_admin())
WITH CHECK (id = auth.uid() OR is_super_admin());

-- 3. ALL for super_admin (INSERT/DELETE)
CREATE POLICY "users_super_admin_manage" ON users FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- audit_logs: SELECT for org members, no INSERT/UPDATE/DELETE for users
CREATE POLICY "audit_logs_org_select" ON audit_logs FOR SELECT
USING (
    is_super_admin() OR
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- account_deletion_audit: Special owner and super_admin logic
CREATE POLICY "account_deletion_audit_owner_select" ON account_deletion_audit FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users u
        JOIN organization_memberships om ON u.id = om.user_id
        WHERE u.auth0_user_id = auth.uid()::text
        AND om.organization_id = account_deletion_audit.organization_id
        AND om.role = 'owner'
    )
);

CREATE POLICY "account_deletion_audit_super_admin" ON account_deletion_audit FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- subscription_plans: Public read for active plans
CREATE POLICY "subscription_plans_public_read" ON subscription_plans FOR SELECT
USING (is_active = true);

-- onboarding_events: System insert only
CREATE POLICY "onboarding_events_system_insert" ON onboarding_events FOR INSERT
WITH CHECK (true);

-- organization_settings_audit: System insert only (trigger-based)
CREATE POLICY "organization_settings_audit_system_insert" ON organization_settings_audit FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- VERIFICATION: Ensure RLS is enabled on all tables
-- ============================================================================

-- These should already be enabled, but ensure they are
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_item_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings_audit ENABLE ROW LEVEL SECURITY;

-- Backend-only tables: RLS enabled but no policies (service_role bypasses)
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_base_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually)
-- ============================================================================
-- SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: ~38 policies
--
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;
