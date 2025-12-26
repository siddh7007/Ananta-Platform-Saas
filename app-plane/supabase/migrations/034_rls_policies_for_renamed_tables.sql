-- ============================================================================
-- Migration: Complete RLS Policies for Renamed Tables (tenants, users, projects)
-- ============================================================================
-- Created: 2025-11-19
-- Purpose: Add proper RLS policies after table rename (032)
-- Database: supabase
--
-- This sets up complete RLS policies using Supabase auth.uid()
-- ============================================================================

-- ============================================================================
-- SECTION 1: GRANT Permissions to Supabase Roles
-- ============================================================================

-- Grant basic permissions to anon (unauthenticated) and authenticated roles
GRANT SELECT ON public.tenants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_uploads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.enrichment_queue TO anon, authenticated;
GRANT SELECT ON public.enrichment_audit_log TO anon, authenticated;
GRANT SELECT, INSERT ON public.enrichment_events TO anon, authenticated;

-- Grant full permissions to service_role (bypass RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================================
-- SECTION 2: Helper Functions
-- ============================================================================

-- Get current user's ID from auth.users
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE;

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- SECTION 3: TENANTS Policies
-- ============================================================================

-- DROP existing policies if any
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Service role full access to tenants" ON public.tenants;

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Users can view their own tenant
CREATE POLICY "Users can view own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (
  id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

-- Super admins can do everything
CREATE POLICY "Super admins can manage all tenants"
ON public.tenants FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Service role bypasses RLS
CREATE POLICY "Service role full access to tenants"
ON public.tenants FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 4: USERS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Service role full access to users" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view users in their tenant
CREATE POLICY "Users can view own tenant users"
ON public.users FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super admins can manage all users
CREATE POLICY "Super admins can manage all users"
ON public.users FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Service role bypasses RLS
CREATE POLICY "Service role full access to users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 5: PROJECTS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage own tenant projects" ON public.projects;
DROP POLICY IF EXISTS "Super admins can manage all projects" ON public.projects;
DROP POLICY IF EXISTS "Service role full access to projects" ON public.projects;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can view projects in their tenant
CREATE POLICY "Users can view own tenant projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

-- Users can manage projects in their tenant
CREATE POLICY "Users can manage own tenant projects"
ON public.projects FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

-- Super admins can see all
CREATE POLICY "Super admins can manage all projects"
ON public.projects FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Service role bypass
CREATE POLICY "Service role full access to projects"
ON public.projects FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 6: BOM_UPLOADS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can manage own tenant uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Service role full access to uploads" ON public.bom_uploads;

ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant uploads"
ON public.bom_uploads FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can manage own tenant uploads"
ON public.bom_uploads FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Service role full access to uploads"
ON public.bom_uploads FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 7: BOMS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant boms" ON public.boms;
DROP POLICY IF EXISTS "Users can manage own tenant boms" ON public.boms;
DROP POLICY IF EXISTS "Service role full access to boms" ON public.boms;

ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant boms"
ON public.boms FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can manage own tenant boms"
ON public.boms FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Service role full access to boms"
ON public.boms FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 8: BOM_LINE_ITEMS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant line items" ON public.bom_line_items;
DROP POLICY IF EXISTS "Users can manage own tenant line items" ON public.bom_line_items;
DROP POLICY IF EXISTS "Service role full access to line items" ON public.bom_line_items;

ALTER TABLE public.bom_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant line items"
ON public.bom_line_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (
      boms.organization_id = public.current_user_tenant_id()
      OR public.is_super_admin()
    )
  )
);

CREATE POLICY "Users can manage own tenant line items"
ON public.bom_line_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (
      boms.organization_id = public.current_user_tenant_id()
      OR public.is_super_admin()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (
      boms.organization_id = public.current_user_tenant_id()
      OR public.is_super_admin()
    )
  )
);

CREATE POLICY "Service role full access to line items"
ON public.bom_line_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 9: ALERTS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can manage own tenant alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role full access to alerts" ON public.alerts;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant alerts"
ON public.alerts FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can manage own tenant alerts"
ON public.alerts FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

CREATE POLICY "Service role full access to alerts"
ON public.alerts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION 10: Verification
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('tenants', 'users', 'projects', 'bom_uploads', 'boms', 'bom_line_items', 'alerts');

    RAISE NOTICE '✅ Migration 034 completed successfully';
    RAISE NOTICE '   - RLS enabled on all core tables';
    RAISE NOTICE '   - Total policies created: %', policy_count;
    RAISE NOTICE '   - Helper functions created: 4';
    RAISE NOTICE '   - Permissions granted to: anon, authenticated, service_role';
END $$;

-- Show policy summary
SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) >= 3 THEN '✅ Complete'
        ELSE '⚠️ Incomplete'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users', 'projects', 'bom_uploads', 'boms', 'bom_line_items', 'alerts')
GROUP BY tablename
ORDER BY tablename;
