-- Migration 001: Keycloak JWT Auth Functions for Arc-SaaS App Plane
-- Description: Creates auth helper functions that extract claims from Keycloak JWTs
--
-- KEY DESIGN DECISIONS:
-- 1. tenant_id (Control Plane) === organization_id (App Plane)
--    - When Control Plane provisions a tenant, it creates an organization in Supabase
--    - The organization.id = tenant.id from Control Plane
-- 2. Keycloak JWT contains: sub (user ID), tenant_id (from custom mapper)
-- 3. RLS policies filter by: organization_id = keycloak_tenant_id()
--
-- Keycloak Mapper Configuration (add to client):
--   - Mapper type: User Attribute
--   - Name: tenant_id
--   - User Attribute: tenant_id (set during user provisioning)
--   - Token Claim Name: tenant_id
--   - Add to ID token: ON
--   - Add to access token: ON
--   - Claim JSON Type: String
--
-- Date: 2025-12-08

BEGIN;

-- ============================================================================
-- SECTION 1: Create auth schema if not exists
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================================
-- SECTION 2: Core JWT Access Functions
-- ============================================================================

-- Function to get full JWT claims as JSONB
-- PostgREST sets request.jwt.claims from the Authorization header
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        '{}'::jsonb
    );
$$;

COMMENT ON FUNCTION auth.jwt() IS 'Returns full JWT claims from PostgREST request.jwt.claims setting';

-- Function to get user ID from JWT sub claim
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'sub',
        NULL
    )::uuid;
$$;

COMMENT ON FUNCTION auth.uid() IS 'Returns user ID (sub claim) from Keycloak JWT';

-- ============================================================================
-- SECTION 3: Keycloak-Specific JWT Claim Extractors
-- ============================================================================

-- Function to get tenant_id from Keycloak JWT
-- This maps to organization_id in App Plane
-- Keycloak tokens have tenant_id as a custom claim
CREATE OR REPLACE FUNCTION keycloak_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        -- Try direct tenant_id claim (custom Keycloak mapper)
        auth.jwt() ->> 'tenant_id',
        -- Fallback: try userTenantId (used by some configurations)
        auth.jwt() ->> 'userTenantId',
        -- Fallback: organization claim from Keycloak organizations
        auth.jwt() -> 'organization' ->> 'id',
        NULL
    )::uuid;
$$;

COMMENT ON FUNCTION keycloak_tenant_id() IS
'Extracts tenant_id from Keycloak JWT. This equals organization_id in App Plane.';

-- Alias for clarity in RLS policies
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT keycloak_tenant_id();
$$;

COMMENT ON FUNCTION current_organization_id() IS
'Alias for keycloak_tenant_id(). Returns the current users organization_id for RLS policies.';

-- Function to get Keycloak user_id (sub claim)
CREATE OR REPLACE FUNCTION keycloak_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() ->> 'sub';
$$;

COMMENT ON FUNCTION keycloak_user_id() IS 'Returns the Keycloak user ID (sub claim) as text';

-- Function to get user email from Keycloak JWT
CREATE OR REPLACE FUNCTION keycloak_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'email',
        auth.jwt() ->> 'preferred_username'
    );
$$;

COMMENT ON FUNCTION keycloak_user_email() IS 'Returns user email from Keycloak JWT';

-- Function to check if user is super admin (platform admin)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        -- Check for platform_admin role in Keycloak realm_access.roles
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin', 'admin')
    )
    OR EXISTS (
        -- Check for platform_admin in resource_access (client roles)
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'resource_access' -> 'arc-saas' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin')
    )
    OR COALESCE(auth.jwt() ->> 'is_platform_admin', 'false')::boolean;
$$;

COMMENT ON FUNCTION is_super_admin() IS
'Returns true if user has platform_admin or super_admin role in Keycloak JWT';

-- Function to get user role within their tenant
CREATE OR REPLACE FUNCTION keycloak_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        -- Direct role claim
        auth.jwt() ->> 'role',
        -- Check realm roles for common patterns
        CASE
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'owner'
            ) THEN 'owner'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'admin'
            ) THEN 'admin'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'engineer'
            ) THEN 'engineer'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'analyst'
            ) THEN 'analyst'
            ELSE 'viewer'
        END
    );
$$;

COMMENT ON FUNCTION keycloak_user_role() IS
'Returns user role from Keycloak JWT (owner, admin, engineer, analyst, viewer)';

-- Function to check if user is admin of their organization
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT keycloak_user_role() IN ('owner', 'admin')
        OR is_super_admin();
$$;

COMMENT ON FUNCTION is_org_admin() IS
'Returns true if user is owner or admin of their organization';

-- ============================================================================
-- SECTION 4: Backwards Compatibility Aliases
-- ============================================================================

-- Alias for get_current_user_id (used by existing migrations)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- In Keycloak model, we lookup user by keycloak_user_id (sub claim)
    SELECT id FROM users
    WHERE keycloak_user_id = keycloak_user_id()
    LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_user_id() IS
'Returns internal user UUID by looking up keycloak_user_id. For RLS policies.';

-- ============================================================================
-- SECTION 5: Grant Permissions
-- ============================================================================

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, service_role;

-- Revoke from anon where not needed
REVOKE EXECUTE ON FUNCTION keycloak_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION current_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_email() FROM anon;
REVOKE EXECUTE ON FUNCTION is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION is_org_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION get_current_user_id() FROM anon;

COMMIT;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- In RLS policies, use these patterns:
--
-- 1. Basic tenant isolation:
--    CREATE POLICY "tenant_isolation" ON my_table
--    FOR ALL USING (organization_id = current_organization_id());
--
-- 2. With super admin bypass:
--    CREATE POLICY "tenant_isolation_with_admin" ON my_table
--    FOR SELECT USING (
--      is_super_admin() OR organization_id = current_organization_id()
--    );
--
-- 3. Admin-only operations:
--    CREATE POLICY "admin_only_delete" ON my_table
--    FOR DELETE USING (
--      is_super_admin() OR (
--        organization_id = current_organization_id()
--        AND is_org_admin()
--      )
--    );
--
