-- Migration 076: Remove Redundant "Anon super admin" Policies
-- Purpose: Clean up duplicate policies that are already covered by main policies
-- Date: 2025-12-01
--
-- These policies are redundant because the main "Authenticated users access own org X"
-- policies already include "OR is_super_admin()" check.
--
-- Example:
--   "Anon super admin access to boms" → is_super_admin()
--   "Authenticated users access own org boms" → org_id = ... OR is_super_admin()
--                                                              ^^^^^^^^^^^^^^^^
--                                                              Already covers super_admin!
--
-- Impact: None - super_admins will continue to have access via the main policies
-- Code changes: None required

-- ============================================================================
-- Remove redundant policies (10 total)
-- ============================================================================

-- alerts: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to alerts" ON alerts;

-- bom_items: main policy has "is_super_admin() OR ..."
DROP POLICY IF EXISTS "Anon super admin access to bom_items" ON bom_items;

-- bom_uploads: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to bom_uploads" ON bom_uploads;

-- boms: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to boms" ON boms;

-- enrichment_audit_log: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to enrichment_audit_log" ON enrichment_audit_log;

-- enrichment_events: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to enrichment_events" ON enrichment_events;

-- enrichment_queue: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to enrichment_queue" ON enrichment_queue;

-- notifications: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to notifications" ON notifications;

-- organization_memberships: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to organization_memberships" ON organization_memberships;

-- projects: main policy has "OR is_super_admin()"
DROP POLICY IF EXISTS "Anon super admin access to projects" ON projects;

-- ============================================================================
-- Verification query (run after migration)
-- ============================================================================
-- SELECT tablename, policyname FROM pg_policies
-- WHERE policyname LIKE 'Anon super admin%'
-- ORDER BY tablename;
--
-- Expected: Only 4 remaining (tables without redundant main policies):
--   - alert_deliveries
--   - alert_preferences
--   - audit_logs
--   - component_watches

-- ============================================================================
-- Summary
-- ============================================================================
-- Removed: 10 redundant policies
-- Remaining "Anon super admin" policies: 4 (these ARE needed - no redundant main policy)
-- Code changes required: None
-- Impact: None - access unchanged
