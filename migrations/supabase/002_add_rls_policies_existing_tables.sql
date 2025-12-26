-- Migration: Add RLS policies to tables with RLS enabled but no policies
-- Priority: CRITICAL
-- Estimated time: 5-10 minutes
--
-- These tables have RLS enabled but no policies, resulting in denied access

-- ============================================================================
-- Tables with RLS enabled but missing policies (17 tables)
-- ============================================================================

-- 1. ALERT_PREFERENCES
CREATE POLICY "org_isolation_select_alert_preferences"
ON alert_preferences FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_alert_preferences"
ON alert_preferences FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_alert_preferences"
ON alert_preferences FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_alert_preferences"
ON alert_preferences FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 2. ALERTS
CREATE POLICY "org_isolation_select_alerts"
ON alerts FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_alerts"
ON alerts FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_alerts"
ON alerts FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_alerts"
ON alerts FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 3. BOM_UPLOADS
CREATE POLICY "org_isolation_select_bom_uploads"
ON bom_uploads FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_bom_uploads"
ON bom_uploads FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_bom_uploads"
ON bom_uploads FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_bom_uploads"
ON bom_uploads FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 4. CNS_BULK_UPLOADS
CREATE POLICY "org_isolation_select_cns_bulk_uploads"
ON cns_bulk_uploads FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR tenant_id = current_user_organization_id()
  OR is_platform_admin()
);

CREATE POLICY "org_isolation_insert_cns_bulk_uploads"
ON cns_bulk_uploads FOR INSERT
WITH CHECK (
  organization_id = current_user_organization_id()
  AND tenant_id = current_user_organization_id()
);

CREATE POLICY "org_isolation_update_cns_bulk_uploads"
ON cns_bulk_uploads FOR UPDATE
USING (organization_id = current_user_organization_id() OR tenant_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_cns_bulk_uploads"
ON cns_bulk_uploads FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 5. COMPONENT_WATCHES
CREATE POLICY "org_isolation_select_component_watches"
ON component_watches FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_component_watches"
ON component_watches FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_component_watches"
ON component_watches FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_component_watches"
ON component_watches FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 6. NOTIFICATIONS
CREATE POLICY "org_isolation_select_notifications"
ON notifications FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_notifications"
ON notifications FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_notifications"
ON notifications FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_notifications"
ON notifications FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 7. ORGANIZATION_INVITATIONS
CREATE POLICY "org_isolation_select_organization_invitations"
ON organization_invitations FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_organization_invitations"
ON organization_invitations FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_organization_invitations"
ON organization_invitations FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_organization_invitations"
ON organization_invitations FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 8. ORGANIZATION_MEMBERSHIPS
CREATE POLICY "org_isolation_select_organization_memberships"
ON organization_memberships FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_organization_memberships"
ON organization_memberships FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_organization_memberships"
ON organization_memberships FOR UPDATE
USING (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_delete_organization_memberships"
ON organization_memberships FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 9. USER_PREFERENCES
CREATE POLICY "org_isolation_select_user_preferences"
ON user_preferences FOR SELECT
USING (user_id = current_user_id() OR is_platform_admin());

CREATE POLICY "org_isolation_insert_user_preferences"
ON user_preferences FOR INSERT
WITH CHECK (user_id = current_user_id());

CREATE POLICY "org_isolation_update_user_preferences"
ON user_preferences FOR UPDATE
USING (user_id = current_user_id());

CREATE POLICY "org_isolation_delete_user_preferences"
ON user_preferences FOR DELETE
USING (user_id = current_user_id() OR is_platform_admin());

-- 10. USERS
CREATE POLICY "org_isolation_select_users"
ON users FOR SELECT
USING (
  id = current_user_id()
  OR organization_id = current_user_organization_id()
  OR is_platform_admin()
);

-- Users can only insert users in their own org (admin role check in app layer)
CREATE POLICY "org_isolation_insert_users"
ON users FOR INSERT
WITH CHECK (organization_id = current_user_organization_id());

CREATE POLICY "org_isolation_update_users"
ON users FOR UPDATE
USING (organization_id = current_user_organization_id() OR id = current_user_id());

CREATE POLICY "org_isolation_delete_users"
ON users FOR DELETE
USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- 11. WORKSPACE_MEMBERS (if not already added in previous migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'workspace_members'
    ) THEN
        EXECUTE '
            CREATE POLICY "org_isolation_select_workspace_members"
            ON workspace_members FOR SELECT
            USING (
              workspace_id IN (SELECT id FROM workspaces WHERE organization_id = current_user_organization_id())
              OR is_platform_admin()
            );

            CREATE POLICY "org_isolation_insert_workspace_members"
            ON workspace_members FOR INSERT
            WITH CHECK (
              workspace_id IN (SELECT id FROM workspaces WHERE organization_id = current_user_organization_id())
            );

            CREATE POLICY "org_isolation_update_workspace_members"
            ON workspace_members FOR UPDATE
            USING (
              workspace_id IN (SELECT id FROM workspaces WHERE organization_id = current_user_organization_id())
            );

            CREATE POLICY "org_isolation_delete_workspace_members"
            ON workspace_members FOR DELETE
            USING (
              workspace_id IN (SELECT id FROM workspaces WHERE organization_id = current_user_organization_id())
              OR is_platform_admin()
            );
        ';
    END IF;
END $$;

-- 12. WORKSPACES (should already have policies but verify)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'workspaces'
        AND policyname LIKE '%insert%'
    ) THEN
        EXECUTE '
            CREATE POLICY "org_isolation_insert_workspaces"
            ON workspaces FOR INSERT
            WITH CHECK (organization_id = current_user_organization_id());

            CREATE POLICY "org_isolation_update_workspaces"
            ON workspaces FOR UPDATE
            USING (organization_id = current_user_organization_id());

            CREATE POLICY "org_isolation_delete_workspaces"
            ON workspaces FOR DELETE
            USING (organization_id = current_user_organization_id() OR is_platform_admin());
        ';
    END IF;
END $$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check all tables now have policies
SELECT
    tablename,
    COUNT(*) as policy_count,
    string_agg(DISTINCT cmd::text, ', ') as commands
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'alert_preferences', 'alerts', 'bom_uploads', 'cns_bulk_uploads',
        'component_watches', 'notifications', 'organization_invitations',
        'organization_memberships', 'user_preferences', 'users',
        'workspace_members', 'workspaces'
    )
GROUP BY tablename
ORDER BY tablename;

-- Check RLS is enabled on all these tables
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'alert_preferences', 'alerts', 'bom_uploads', 'cns_bulk_uploads',
        'component_watches', 'notifications', 'organization_invitations',
        'organization_memberships', 'user_preferences', 'users',
        'workspace_members', 'workspaces'
    )
ORDER BY tablename;
