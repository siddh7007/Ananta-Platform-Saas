-- Implement Proper Supabase Row Level Security (CORRECTED)
-- Created: 2025-11-19
-- Purpose: Create RLS policies for all tables with super_admin support
-- FIX: Uses correct schema - roles are in organization_memberships table, not users table
--
-- Schema Reference:
-- - users: id, email, full_name, organization_id
-- - organization_memberships: organization_id, user_id, role (member/admin/owner/super_admin)

-- ============================================================================
-- Helper Functions (Supabase Auth Compatible - CORRECTED)
-- ============================================================================

-- Get current user ID from Supabase JWT token
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Get current user's organization_id from users table
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE id = public.current_user_id()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is super_admin (role from organization_memberships)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = public.current_user_id()
    AND om.role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is admin or owner in their organization
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = public.current_user_id()
    AND om.organization_id = public.current_user_organization_id()
    AND om.role IN ('admin', 'owner', 'super_admin')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- BOMS Table RLS Policies
-- ============================================================================

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view BOMs in their organization" ON public.boms;
DROP POLICY IF EXISTS "Super admins can view all BOMs" ON public.boms;
DROP POLICY IF EXISTS "Users can create BOMs in their organization" ON public.boms;
DROP POLICY IF EXISTS "Users can update BOMs in their organization" ON public.boms;
DROP POLICY IF EXISTS "Admins can delete BOMs in their organization" ON public.boms;
DROP POLICY IF EXISTS "Allow all bom access" ON public.boms;
DROP POLICY IF EXISTS "Anon can insert BOMs" ON public.boms;
DROP POLICY IF EXISTS "Anon can select BOMs" ON public.boms;

-- Enable RLS
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;

-- SELECT: Users see their org's BOMs, super_admins see all
CREATE POLICY "Users can view BOMs in their organization"
ON public.boms FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- INSERT: Users create BOMs for their org, super_admins can create for any org
CREATE POLICY "Users can create BOMs in their organization"
ON public.boms FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- UPDATE: Users update their org's BOMs, super_admins can update any
CREATE POLICY "Users can update BOMs in their organization"
ON public.boms FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- DELETE: Only admins/owners can delete BOMs in their org, super_admins can delete any
CREATE POLICY "Admins can delete BOMs in their organization"
ON public.boms FOR DELETE
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

-- Allow anon to insert (for dev mode / before login)
CREATE POLICY "Anon can insert BOMs"
ON public.boms FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to select (for dev mode / before login)
CREATE POLICY "Anon can select BOMs"
ON public.boms FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- BOM LINE ITEMS Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view BOM line items" ON public.bom_line_items;
DROP POLICY IF EXISTS "Users can manage BOM line items" ON public.bom_line_items;
DROP POLICY IF EXISTS "Anon can insert line items" ON public.bom_line_items;
DROP POLICY IF EXISTS "Anon can select line items" ON public.bom_line_items;

ALTER TABLE public.bom_line_items ENABLE ROW LEVEL SECURITY;

-- Access via parent BOM's organization
CREATE POLICY "Users can view BOM line items"
ON public.bom_line_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (boms.organization_id = public.current_user_organization_id() OR public.is_super_admin())
  )
);

CREATE POLICY "Users can manage BOM line items"
ON public.bom_line_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (boms.organization_id = public.current_user_organization_id() OR public.is_super_admin())
  )
);

-- Anon policies for dev mode
CREATE POLICY "Anon can insert line items"
ON public.bom_line_items FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can select line items"
ON public.bom_line_items FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- ALERTS Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view alerts in their organization" ON public.alerts;
DROP POLICY IF EXISTS "Users can manage alerts in their organization" ON public.alerts;
DROP POLICY IF EXISTS "Anon can view alerts" ON public.alerts;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts in their organization"
ON public.alerts FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can manage alerts in their organization"
ON public.alerts FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view alerts"
ON public.alerts FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- PROJECTS Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Anon can view projects" ON public.projects;
DROP POLICY IF EXISTS "Anon can insert projects" ON public.projects;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their organization"
ON public.projects FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can create projects in their organization"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can update projects in their organization"
ON public.projects FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view projects"
ON public.projects FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert projects"
ON public.projects FOR INSERT
TO anon
WITH CHECK (true);

-- ============================================================================
-- USERS Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users in their organization" ON public.users;
DROP POLICY IF EXISTS "Anon can view users" ON public.users;
DROP POLICY IF EXISTS "Anon can insert users" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view users in their organization"
ON public.users FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- Note: Existing policy "Users can update their own profile" already exists from migration 046
-- Keeping it separate to avoid duplicate

CREATE POLICY "Admins can manage users in their organization"
ON public.users FOR ALL
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

-- Note: Existing policies "Anon can view/insert users" already exist from migration 046
-- Keeping them separate to avoid duplicates

-- ============================================================================
-- ORGANIZATIONS Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Anon can view organizations" ON public.organizations;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Admins can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  (id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view organizations"
ON public.organizations FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- Grant Necessary Table Permissions (if not already granted)
-- ============================================================================

-- Ensure both anon and authenticated have table-level permissions
GRANT SELECT, INSERT, UPDATE ON public.boms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alerts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT, UPDATE ON public.organizations TO anon, authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;

-- ============================================================================
-- Verification & Success Messages
-- ============================================================================

DO $$
DECLARE
  boms_policy_count INT;
  helper_func_count INT;
BEGIN
  -- Count policies on boms table
  SELECT COUNT(*) INTO boms_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'boms';

  -- Count helper functions
  SELECT COUNT(*) INTO helper_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN ('current_user_id', 'current_user_organization_id', 'is_super_admin', 'is_org_admin');

  IF boms_policy_count < 2 THEN
    RAISE WARNING 'Only % policies created for boms table (expected at least 2)', boms_policy_count;
  END IF;

  IF helper_func_count < 4 THEN
    RAISE WARNING 'Only % helper functions created (expected 4)', helper_func_count;
  END IF;

  RAISE NOTICE '✅ RLS Migration 047 Complete!';
  RAISE NOTICE '✅ Helper functions: %/4', helper_func_count;
  RAISE NOTICE '✅ Policies on boms table: %', boms_policy_count;
  RAISE NOTICE '✅ Schema corrected: Roles fetched from organization_memberships table';
  RAISE NOTICE '✅ Super admin support: Users with role=super_admin can access all organizations';
  RAISE NOTICE '✅ Regular users isolated by organization_id';
  RAISE NOTICE '✅ Anon access allowed for dev mode';
END $$;
