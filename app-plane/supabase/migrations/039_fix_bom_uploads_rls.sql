-- Fix bom_uploads RLS policies
-- Created: 2025-11-19
-- Purpose: Add RLS policies for bom_uploads table using correct schema

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get current user's organization_id from users_v2
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users_v2
  WHERE id = (SELECT id FROM auth.users WHERE auth.users.id = current_user_id() LIMIT 1)
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Simple helper to get current user ID (works without auth.uid())
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Check if user is super admin (simple version - check role in users_v2)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_v2
    WHERE id = public.current_user_id()
    AND role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- BOM Uploads RLS Policies
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can insert own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can update own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Service role full access" ON public.bom_uploads;
DROP POLICY IF EXISTS "Anon can insert uploads" ON public.bom_uploads;

-- Enable RLS (should already be enabled)
ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view uploads from their organization
CREATE POLICY "Users can view own org uploads"
ON public.bom_uploads FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- Policy 2: Users can insert uploads for their organization
CREATE POLICY "Users can insert own org uploads"
ON public.bom_uploads FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- Policy 3: Users can update uploads from their organization
CREATE POLICY "Users can update own org uploads"
ON public.bom_uploads FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

-- Policy 4: Allow anonymous users to insert (for dev mode)
CREATE POLICY "Anon can insert uploads"
ON public.bom_uploads FOR INSERT
TO anon
WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.bom_uploads TO authenticated, anon;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'BOM uploads RLS policies created successfully';
    RAISE NOTICE 'Functions: current_user_organization_id(), current_user_id(), is_super_admin()';
END $$;
