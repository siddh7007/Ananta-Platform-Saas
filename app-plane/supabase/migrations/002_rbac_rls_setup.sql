-- ============================================================================
-- Role-Based Access Control (RBAC) with Row-Level Security (RLS)
-- ============================================================================
--
-- Role Hierarchy:
-- 1. platform_admin - Full CRUD across all tenancies
-- 2. platform_user  - Read-only across all tenancies + job re-run permissions
-- 3. org_admin      - Full CRUD within their tenancy
-- 4. user           - CRUD on their own projects only
--
-- ============================================================================

-- First, let's create a helper function to get current user's info
CREATE OR REPLACE FUNCTION public.current_user_info()
RETURNS TABLE (
  user_id uuid,
  tenant_id uuid,
  email text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id,
    u.tenant_id,
    u.email,
    u.role
  FROM public.users_v2 u
  WHERE u.auth_subject = current_setting('request.jwt.claims', true)::json->>'sub';
$$;

-- Helper function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role = 'platform_admin'
  );
$$;

-- Helper function to check if user is platform user
CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role IN ('platform_user', 'platform_admin')
  );
$$;

-- Helper function to check if user is org admin for their tenant
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role IN ('org_admin', 'platform_admin')
  );
$$;

-- Helper function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.current_user_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.current_user_info() LIMIT 1;
$$;

-- ============================================================================
-- PROJECTS_V2 RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS projects_v2_select_policy ON public.projects_v2;
DROP POLICY IF EXISTS projects_v2_insert_policy ON public.projects_v2;
DROP POLICY IF EXISTS projects_v2_update_policy ON public.projects_v2;
DROP POLICY IF EXISTS projects_v2_delete_policy ON public.projects_v2;

-- SELECT Policy:
-- - Platform admins: see all
-- - Platform users: see all (read-only)
-- - Org admins: see their tenant's projects
-- - Users: see only their own projects
CREATE POLICY projects_v2_select_policy ON public.projects_v2
FOR SELECT
USING (
  -- Platform admin/user can see all
  public.is_platform_user()
  OR
  -- Org admin can see all projects in their tenant
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  -- Regular users can see projects they own
  (owner_id IN (SELECT user_id FROM public.current_user_info()))
);

-- INSERT Policy:
-- - Platform admins: can create in any tenant
-- - Org admins: can create in their tenant
-- - Users: can create in their tenant (will be owned by them)
CREATE POLICY projects_v2_insert_policy ON public.projects_v2
FOR INSERT
WITH CHECK (
  -- Platform admin can insert anywhere
  public.is_platform_admin()
  OR
  -- Org admin can insert in their tenant
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  -- Regular user can insert in their tenant (with themselves as owner)
  (tenant_id = public.current_user_tenant() AND owner_id IN (SELECT user_id FROM public.current_user_info()))
);

-- UPDATE Policy:
-- - Platform admins: can update all
-- - Org admins: can update in their tenant
-- - Users: can update their own projects
CREATE POLICY projects_v2_update_policy ON public.projects_v2
FOR UPDATE
USING (
  -- Platform admin can update all
  public.is_platform_admin()
  OR
  -- Org admin can update in their tenant
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  -- Regular user can update their own projects
  (owner_id IN (SELECT user_id FROM public.current_user_info()))
);

-- DELETE Policy:
-- - Platform admins: can delete all
-- - Org admins: can delete in their tenant
-- - Users: can delete their own projects
-- - Platform users: CANNOT delete
CREATE POLICY projects_v2_delete_policy ON public.projects_v2
FOR DELETE
USING (
  -- Platform admin can delete all (but not platform_user)
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
  OR
  -- Org admin can delete in their tenant
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  -- Regular user can delete their own projects
  (owner_id IN (SELECT user_id FROM public.current_user_info()))
);

-- ============================================================================
-- BOMS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.boms_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boms_v2_select_policy ON public.boms_v2;
DROP POLICY IF EXISTS boms_v2_insert_policy ON public.boms_v2;
DROP POLICY IF EXISTS boms_v2_update_policy ON public.boms_v2;
DROP POLICY IF EXISTS boms_v2_delete_policy ON public.boms_v2;

-- SELECT: Can see BOMs in projects they have access to
CREATE POLICY boms_v2_select_policy ON public.boms_v2
FOR SELECT
USING (
  public.is_platform_user()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  -- Regular users see BOMs in their projects
  (project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id IN (SELECT user_id FROM public.current_user_info())
  ))
);

-- INSERT: Can create BOMs in projects they own/manage
CREATE POLICY boms_v2_insert_policy ON public.boms_v2
FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  (project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id IN (SELECT user_id FROM public.current_user_info())
  ))
);

-- UPDATE: Can update BOMs in projects they manage
CREATE POLICY boms_v2_update_policy ON public.boms_v2
FOR UPDATE
USING (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  (project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id IN (SELECT user_id FROM public.current_user_info())
  ))
);

-- DELETE: Same as update
CREATE POLICY boms_v2_delete_policy ON public.boms_v2
FOR DELETE
USING (
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  (project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id IN (SELECT user_id FROM public.current_user_info())
  ))
);

-- ============================================================================
-- COMPONENTS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.components_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS components_v2_select_policy ON public.components_v2;
DROP POLICY IF EXISTS components_v2_insert_policy ON public.components_v2;
DROP POLICY IF EXISTS components_v2_update_policy ON public.components_v2;
DROP POLICY IF EXISTS components_v2_delete_policy ON public.components_v2;

-- SELECT: Platform users and org admins see their tenant's components
CREATE POLICY components_v2_select_policy ON public.components_v2
FOR SELECT
USING (
  public.is_platform_user()
  OR
  (tenant_id = public.current_user_tenant())
);

-- INSERT: Platform admin and org admin can create
CREATE POLICY components_v2_insert_policy ON public.components_v2
FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: Platform admin and org admin can update
CREATE POLICY components_v2_update_policy ON public.components_v2
FOR UPDATE
USING (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- DELETE: Only platform admin and org admin
CREATE POLICY components_v2_delete_policy ON public.components_v2
FOR DELETE
USING (
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- TENANTS_V2 RLS POLICIES (Organizations)
-- ============================================================================

ALTER TABLE public.tenants_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_v2_select_policy ON public.tenants_v2;
DROP POLICY IF EXISTS tenants_v2_insert_policy ON public.tenants_v2;
DROP POLICY IF EXISTS tenants_v2_update_policy ON public.tenants_v2;
DROP POLICY IF EXISTS tenants_v2_delete_policy ON public.tenants_v2;

-- SELECT: Platform users see all, others see only their tenant
CREATE POLICY tenants_v2_select_policy ON public.tenants_v2
FOR SELECT
USING (
  public.is_platform_user()
  OR
  (id = public.current_user_tenant())
);

-- INSERT: Only platform admins can create tenants
CREATE POLICY tenants_v2_insert_policy ON public.tenants_v2
FOR INSERT
WITH CHECK (
  public.is_platform_admin()
);

-- UPDATE: Platform admin or org admin for their own tenant
CREATE POLICY tenants_v2_update_policy ON public.tenants_v2
FOR UPDATE
USING (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND id = public.current_user_tenant())
);

-- DELETE: Only platform admins
CREATE POLICY tenants_v2_delete_policy ON public.tenants_v2
FOR DELETE
USING (
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
);

-- ============================================================================
-- USERS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.users_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_v2_select_policy ON public.users_v2;
DROP POLICY IF EXISTS users_v2_insert_policy ON public.users_v2;
DROP POLICY IF EXISTS users_v2_update_policy ON public.users_v2;
DROP POLICY IF EXISTS users_v2_delete_policy ON public.users_v2;

-- SELECT: Platform users see all, org admins see their tenant, users see themselves
CREATE POLICY users_v2_select_policy ON public.users_v2
FOR SELECT
USING (
  public.is_platform_user()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  (id IN (SELECT user_id FROM public.current_user_info()))
);

-- INSERT: Platform admin and org admin can create users
CREATE POLICY users_v2_insert_policy ON public.users_v2
FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: Platform admin, org admin for their tenant, users for themselves
CREATE POLICY users_v2_update_policy ON public.users_v2
FOR UPDATE
USING (
  public.is_platform_admin()
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
  OR
  (id IN (SELECT user_id FROM public.current_user_info()))
);

-- DELETE: Only platform admin and org admin
CREATE POLICY users_v2_delete_policy ON public.users_v2
FOR DELETE
USING (
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- ALERTS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.alerts_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_v2_select_policy ON public.alerts_v2;
DROP POLICY IF EXISTS alerts_v2_insert_policy ON public.alerts_v2;
DROP POLICY IF EXISTS alerts_v2_update_policy ON public.alerts_v2;
DROP POLICY IF EXISTS alerts_v2_delete_policy ON public.alerts_v2;

-- SELECT: See alerts in their scope
CREATE POLICY alerts_v2_select_policy ON public.alerts_v2
FOR SELECT
USING (
  public.is_platform_user()
  OR
  (tenant_id = public.current_user_tenant())
);

-- INSERT: System can create alerts (typically automated)
CREATE POLICY alerts_v2_insert_policy ON public.alerts_v2
FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR
  (tenant_id = public.current_user_tenant())
);

-- UPDATE: Can acknowledge/update alerts in their scope
CREATE POLICY alerts_v2_update_policy ON public.alerts_v2
FOR UPDATE
USING (
  public.is_platform_admin()
  OR
  (tenant_id = public.current_user_tenant())
);

-- DELETE: Platform admin and org admin only
CREATE POLICY alerts_v2_delete_policy ON public.alerts_v2
FOR DELETE
USING (
  (SELECT role FROM public.current_user_info() LIMIT 1) = 'platform_admin'
  OR
  (public.is_org_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- Update users_v2 role constraint to include new roles
-- ============================================================================

ALTER TABLE public.users_v2 DROP CONSTRAINT IF EXISTS users_v2_role_check;
ALTER TABLE public.users_v2 ADD CONSTRAINT users_v2_role_check
  CHECK (role IN ('platform_admin', 'platform_user', 'org_admin', 'user', 'viewer'));

-- ============================================================================
-- Grant necessary permissions to authenticated users
-- ============================================================================

-- Grant basic permissions (RLS will further restrict)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boms_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items_v2 TO authenticated;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.current_user_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_tenant() TO authenticated;

-- ============================================================================
-- Summary
-- ============================================================================
--
-- Role Permissions Summary:
--
-- platform_admin:
--   - Full CRUD across ALL tenancies
--   - Can create/delete tenants
--   - Can create/delete users in any tenant
--   - Can manage all projects, BOMs, components
--
-- platform_user:
--   - READ-ONLY across ALL tenancies
--   - Can view all tenants, projects, BOMs, components
--   - Can UPDATE jobs (for re-running)
--   - CANNOT create or delete anything
--
-- org_admin:
--   - Full CRUD within THEIR tenancy
--   - Can create/delete users in their tenant
--   - Can manage all projects and BOMs in their tenant
--   - Can manage components in their tenant
--   - Cannot create/delete tenants
--
-- user:
--   - CRUD on THEIR OWN projects only
--   - Can create/update/delete BOMs in their projects
--   - Can view components in their tenant
--   - Can view other users in their tenant
--   - Can update their own user profile
--
-- ============================================================================

COMMENT ON FUNCTION public.current_user_info() IS 'Returns current authenticated user info from JWT claims';
COMMENT ON FUNCTION public.is_platform_admin() IS 'Check if current user is a platform admin';
COMMENT ON FUNCTION public.is_platform_user() IS 'Check if current user is a platform user or admin';
COMMENT ON FUNCTION public.is_org_admin() IS 'Check if current user is an org admin or platform admin';
COMMENT ON FUNCTION public.current_user_tenant() IS 'Get current user tenant_id';
