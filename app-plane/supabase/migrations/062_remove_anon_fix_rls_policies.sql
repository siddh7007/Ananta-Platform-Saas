-- Migration 062: Remove anon access, fix RLS policies
-- Date: 2025-11-28
--
-- Changes:
-- 1. Remove ALL anon role policies (security fix)
-- 2. Authenticated users can only access their own organization
-- 3. Super admins can access ALL organizations
-- 4. Service role retains full access
--
-- This migration ensures:
-- - No anonymous access to any table
-- - Proper multi-tenant isolation
-- - Super admin cross-org access

-- ============================================
-- BOM_UPLOADS
-- ============================================
DROP POLICY IF EXISTS "Allow all access" ON public.bom_uploads;
DROP POLICY IF EXISTS "Anon super_admin view bom_uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can view own tenant uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can manage own tenant uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Authenticated users access own org uploads" ON public.bom_uploads;

CREATE POLICY "Authenticated users access own org uploads"
ON public.bom_uploads FOR ALL
TO authenticated
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ============================================
-- BOMS
-- ============================================
DROP POLICY IF EXISTS "Anon super_admin manage boms" ON public.boms;
DROP POLICY IF EXISTS "Anon super_admin view boms" ON public.boms;
DROP POLICY IF EXISTS "Users can view own tenant boms" ON public.boms;
DROP POLICY IF EXISTS "Users can manage own tenant boms" ON public.boms;
DROP POLICY IF EXISTS "Authenticated users access own org boms" ON public.boms;

CREATE POLICY "Authenticated users access own org boms"
ON public.boms FOR ALL
TO authenticated
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ============================================
-- PROJECTS
-- ============================================
DROP POLICY IF EXISTS "Anon super_admin manage projects" ON public.projects;
DROP POLICY IF EXISTS "Anon super_admin view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own tenant projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage own tenant projects" ON public.projects;
DROP POLICY IF EXISTS "Allow authenticated users to create projects" ON public.projects;
DROP POLICY IF EXISTS "Super admins can manage all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users access own org projects" ON public.projects;

CREATE POLICY "Authenticated users access own org projects"
ON public.projects FOR ALL
TO authenticated
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ============================================
-- ALERTS
-- ============================================
DROP POLICY IF EXISTS "Anon super_admin view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view own tenant alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can manage own tenant alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users see own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Authenticated users access own org alerts" ON public.alerts;

CREATE POLICY "Authenticated users access own org alerts"
ON public.alerts FOR ALL
TO authenticated
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
    anon_count integer;
BEGIN
    SELECT COUNT(*) INTO anon_count
    FROM pg_policies
    WHERE 'anon' = ANY(roles);

    IF anon_count > 0 THEN
        RAISE WARNING 'Found % policies still using anon role!', anon_count;
    ELSE
        RAISE NOTICE 'SUCCESS: No anon policies found. All tables secured.';
    END IF;
END $$;
