-- ============================================================================
-- Industry-Standard RBAC with Row-Level Security (RLS)
-- Components Platform - Electronics/Manufacturing BOM Management
-- ============================================================================
--
-- Role Hierarchy (Descending Authority):
-- 1. super_admin  - Platform administrator (Ananta staff)
-- 2. admin        - Organization administrator (Customer org owner)
-- 3. engineer     - Product engineer/designer (Creates projects, uploads BOMs)
-- 4. analyst      - Read-only reporter (Views data, exports reports)
--
-- ============================================================================
-- PERMISSIONS MATRIX
-- ============================================================================
--
-- ┌──────────────┬─────────────┬─────────┬──────────┬──────────┐
-- │ Resource     │ super_admin │ admin   │ engineer │ analyst  │
-- ├──────────────┼─────────────┼─────────┼──────────┼──────────┤
-- │ Tenants      │    CRUD*    │   R**   │   R**    │   R**    │
-- │ Users        │    CRUD*    │  CRUD** │   R**    │   R**    │
-- │ Projects     │    CRUD*    │  CRUD** │  CRUD*** │   R***   │
-- │ BOMs         │    CRUD*    │  CRUD** │  CRUD*** │   R***   │
-- │ Components   │    CRUD*    │  CRUD** │   R**    │   R**    │
-- │ Alerts       │    CRUD*    │  CRUD** │  CRUD*** │   R**    │
-- │ Jobs         │    CRUD*    │   CRU** │   CRU*** │   R***   │
-- └──────────────┴─────────────┴─────────┴──────────┴──────────┘
--
-- Legend:
-- * = All tenants (cross-tenant access)
-- ** = Within own tenant only
-- *** = Own projects only (project-scoped)
--
-- C = Create, R = Read, U = Update, D = Delete
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Clean up existing policies and functions
-- ============================================================================

-- Drop all existing RLS policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%_v2') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', r.tablename, r.tablename);
    END LOOP;
END $$;

-- Drop existing helper functions
DROP FUNCTION IF EXISTS public.current_user_info() CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.auth_user_id() CASCADE;

-- ============================================================================
-- STEP 2: Create helper functions for RLS policies
-- ============================================================================

-- Get authenticated user's UUID from Supabase auth
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.uid(),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- Get current authenticated user's profile info
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
  INNER JOIN auth.users au ON u.email = au.email
  WHERE au.id = public.auth_user_id();
$$;

-- Check if user has super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role = 'super_admin'
  );
$$;

-- Check if user has admin role (or super_admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role IN ('super_admin', 'admin')
  );
$$;

-- Check if user has engineer role (or higher)
CREATE OR REPLACE FUNCTION public.is_engineer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.current_user_info()
    WHERE role IN ('super_admin', 'admin', 'engineer')
  );
$$;

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.current_user_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.current_user_info() LIMIT 1;
$$;

-- Get current user's UUID
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id FROM public.current_user_info() LIMIT 1;
$$;

-- ============================================================================
-- STEP 3: Update role constraints
-- ============================================================================

-- Update users_v2 role constraint to use new roles
ALTER TABLE public.users_v2 DROP CONSTRAINT IF EXISTS users_v2_role_check;
ALTER TABLE public.users_v2 ADD CONSTRAINT users_v2_role_check
  CHECK (role IN ('super_admin', 'admin', 'engineer', 'analyst'));

-- Migrate existing roles to new schema
UPDATE public.users_v2 SET role = 'admin' WHERE role IN ('owner', 'org_admin');
UPDATE public.users_v2 SET role = 'engineer' WHERE role IN ('member', 'user');
UPDATE public.users_v2 SET role = 'analyst' WHERE role = 'viewer';

-- ============================================================================
-- STEP 4: TENANTS_V2 (Organizations) RLS POLICIES
-- ============================================================================

ALTER TABLE public.tenants_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin sees all, others see only their tenant
CREATE POLICY tenants_v2_select_policy ON public.tenants_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR id = public.current_user_tenant()
);

-- INSERT: Only super_admin can create new tenants
CREATE POLICY tenants_v2_insert_policy ON public.tenants_v2
FOR INSERT
WITH CHECK (public.is_super_admin());

-- UPDATE: super_admin or admin of the tenant
CREATE POLICY tenants_v2_update_policy ON public.tenants_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND id = public.current_user_tenant())
);

-- DELETE: Only super_admin
CREATE POLICY tenants_v2_delete_policy ON public.tenants_v2
FOR DELETE
USING (public.is_super_admin());

-- ============================================================================
-- STEP 5: USERS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.users_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin sees all, admin sees their tenant, users see themselves
CREATE POLICY users_v2_select_policy ON public.users_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
  OR (id = public.current_app_user_id())
);

-- INSERT: super_admin and admin can create users
CREATE POLICY users_v2_insert_policy ON public.users_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: super_admin, admin for their tenant, users update themselves
CREATE POLICY users_v2_update_policy ON public.users_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
  OR (id = public.current_app_user_id())
);

-- DELETE: super_admin and admin only
CREATE POLICY users_v2_delete_policy ON public.users_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- STEP 6: PROJECTS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin sees all, admin sees tenant, engineer sees own, analyst sees tenant
CREATE POLICY projects_v2_select_policy ON public.projects_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
);

-- INSERT: super_admin, admin, engineer can create
CREATE POLICY projects_v2_insert_policy ON public.projects_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_engineer() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: super_admin, admin for tenant, engineer for own projects
CREATE POLICY projects_v2_update_policy ON public.projects_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
  OR (public.is_engineer() AND project_owner_id = public.current_app_user_id())
);

-- DELETE: super_admin, admin, engineer (own projects only)
CREATE POLICY projects_v2_delete_policy ON public.projects_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
  OR (public.is_engineer() AND project_owner_id = public.current_app_user_id())
);

-- ============================================================================
-- STEP 7: BOMS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.boms_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: Can see BOMs in projects they have access to
CREATE POLICY boms_v2_select_policy ON public.boms_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
);

-- INSERT: Can create BOMs in projects they own/manage
CREATE POLICY boms_v2_insert_policy ON public.boms_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_engineer() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: Can update BOMs in their scope
CREATE POLICY boms_v2_update_policy ON public.boms_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
  OR (public.is_engineer() AND project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id = public.current_app_user_id()
  ))
);

-- DELETE: super_admin, admin, engineer (own project BOMs only)
CREATE POLICY boms_v2_delete_policy ON public.boms_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
  OR (public.is_engineer() AND project_id IN (
    SELECT id FROM public.projects_v2
    WHERE owner_id = public.current_app_user_id()
  ))
);

-- ============================================================================
-- STEP 8: COMPONENTS_V2 RLS POLICIES (Shared Component Catalog)
-- ============================================================================

ALTER TABLE public.components_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: Everyone in tenant can view components
CREATE POLICY components_v2_select_policy ON public.components_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
);

-- INSERT: super_admin and admin only (components are shared resources)
CREATE POLICY components_v2_insert_policy ON public.components_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: super_admin and admin only
CREATE POLICY components_v2_update_policy ON public.components_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- DELETE: super_admin and admin only
CREATE POLICY components_v2_delete_policy ON public.components_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- STEP 9: ALERTS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.alerts_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: See alerts in their tenant
CREATE POLICY alerts_v2_select_policy ON public.alerts_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
);

-- INSERT: System/admin can create alerts
CREATE POLICY alerts_v2_insert_policy ON public.alerts_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- UPDATE: Can acknowledge/update alerts
CREATE POLICY alerts_v2_update_policy ON public.alerts_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (tenant_id = public.current_user_tenant())
);

-- DELETE: super_admin and admin only
CREATE POLICY alerts_v2_delete_policy ON public.alerts_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_admin() AND tenant_id = public.current_user_tenant())
);

-- ============================================================================
-- STEP 10: BOM_LINE_ITEMS_V2 RLS POLICIES
-- ============================================================================

ALTER TABLE public.bom_line_items_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT: Can see line items of BOMs they can access
CREATE POLICY bom_line_items_v2_select_policy ON public.bom_line_items_v2
FOR SELECT
USING (
  public.is_super_admin()
  OR bom_id IN (
    SELECT id FROM public.boms_v2
    WHERE tenant_id = public.current_user_tenant()
  )
);

-- INSERT: Can add line items to BOMs they can edit
CREATE POLICY bom_line_items_v2_insert_policy ON public.bom_line_items_v2
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (public.is_engineer() AND bom_id IN (
    SELECT id FROM public.boms_v2
    WHERE tenant_id = public.current_user_tenant()
  ))
);

-- UPDATE: Can update line items in BOMs they manage
CREATE POLICY bom_line_items_v2_update_policy ON public.bom_line_items_v2
FOR UPDATE
USING (
  public.is_super_admin()
  OR (public.is_engineer() AND bom_id IN (
    SELECT id FROM public.boms_v2
    WHERE tenant_id = public.current_user_tenant()
  ))
);

-- DELETE: Can delete line items from BOMs they manage
CREATE POLICY bom_line_items_v2_delete_policy ON public.bom_line_items_v2
FOR DELETE
USING (
  public.is_super_admin()
  OR (public.is_engineer() AND bom_id IN (
    SELECT id FROM public.boms_v2
    WHERE tenant_id = public.current_user_tenant()
  ))
);

-- ============================================================================
-- STEP 11: Grant permissions to authenticated users
-- ============================================================================

-- Grant table-level permissions (RLS further restricts access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boms_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts_v2 TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items_v2 TO authenticated, anon;

-- Grant sequence usage for auto-increment IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.auth_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_info() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_engineer() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tenant() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%_v2'
ORDER BY tablename;

-- Verify all policies are created
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.auth_user_id() IS 'Get authenticated user UUID from Supabase auth';
COMMENT ON FUNCTION public.current_user_info() IS 'Get current user profile (id, tenant_id, email, role)';
COMMENT ON FUNCTION public.is_super_admin() IS 'Check if user is platform super_admin';
COMMENT ON FUNCTION public.is_admin() IS 'Check if user is admin or super_admin';
COMMENT ON FUNCTION public.is_engineer() IS 'Check if user is engineer, admin, or super_admin';
COMMENT ON FUNCTION public.current_user_tenant() IS 'Get current user tenant_id';
COMMENT ON FUNCTION public.current_app_user_id() IS 'Get current user UUID from users_v2 table';
