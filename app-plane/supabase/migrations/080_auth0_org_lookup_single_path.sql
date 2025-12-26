-- Migration: 080_auth0_org_lookup_single_path.sql
-- Description: Simplify auth helper functions from 4-fallback chain to 1 explicit path
--
-- BEFORE: 4 fallback paths (Auth0 claims → user_metadata → DB by auth0_user_id → DB by Supabase ID)
-- AFTER:  1 explicit path (Auth0 org_id → organizations.auth0_org_id lookup)
--
-- Why this works:
-- 1. Auth0 Action sends `org_id` (Auth0 org ID), not `organization_id` (Supabase UUID)
-- 2. The old fallback chain existed because Path 1 never matched
-- 3. Now we explicitly look up: JWT.org_id → organizations.auth0_org_id → organizations.id
--
-- Auth0 JWT Claims (from Post-Login Action):
--   - https://ananta.component.platform/org_id: "org_abc123" (Auth0 org ID)
--   - https://ananta.component.platform/roles: ["platform:admin", "platform:engineer"]
--   - https://ananta.component.platform/email: "user@example.com"
--   - https://ananta.component.platform/pg_role: "authenticated"

BEGIN;

-- ============================================================================
-- NAMESPACE CONSTANT (for readability)
-- ============================================================================
-- Auth0 custom claims namespace: https://ananta.component.platform

-- ============================================================================
-- FUNCTION: current_user_organization_id()
-- Single lookup: Auth0 org_id → organizations.auth0_org_id → organizations.id
-- ============================================================================

CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.id
  FROM organizations o
  WHERE o.auth0_org_id = auth.jwt() ->> 'https://ananta.component.platform/org_id'
  LIMIT 1
$$;

COMMENT ON FUNCTION current_user_organization_id() IS
'Returns Supabase organization UUID by looking up Auth0 org_id from JWT. Single path, no fallbacks.';

-- ============================================================================
-- FUNCTION: current_user_role()
-- Extracts first role from Auth0 roles array, strips "platform:" prefix
-- ============================================================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT REPLACE(
    auth.jwt() -> 'https://ananta.component.platform/roles' ->> 0,
    'platform:',
    ''
  )
$$;

COMMENT ON FUNCTION current_user_role() IS
'Returns user role from Auth0 JWT roles array. Strips "platform:" prefix (e.g., "platform:admin" → "admin").';

-- ============================================================================
-- FUNCTION: is_super_admin()
-- Checks if "platform:super_admin" is in the roles array
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(auth.jwt() -> 'https://ananta.component.platform/roles', '[]'::jsonb)
    ) AS role
    WHERE role = 'platform:super_admin'
  )
$$;

COMMENT ON FUNCTION is_super_admin() IS
'Returns true if user has platform:super_admin in their Auth0 roles array.';

-- ============================================================================
-- FUNCTION: is_org_admin()
-- Checks if user has admin/owner role in current org
-- ============================================================================

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
$$;

COMMENT ON FUNCTION is_org_admin() IS
'Returns true if user role is admin, owner, or super_admin.';

-- ============================================================================
-- FUNCTION: is_org_admin_or_owner()
-- For membership writes - same as is_org_admin() but explicit name
-- ============================================================================

CREATE OR REPLACE FUNCTION is_org_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
$$;

COMMENT ON FUNCTION is_org_admin_or_owner() IS
'Returns true if user role allows admin operations. Used for membership writes.';

-- ============================================================================
-- INDEX: Ensure auth0_org_id lookup is fast
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_auth0_org_id
  ON organizations(auth0_org_id)
  WHERE auth0_org_id IS NOT NULL;

-- ============================================================================
-- DROP: debug_auth_resolution() - No longer needed
-- ============================================================================

DROP FUNCTION IF EXISTS debug_auth_resolution();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin_or_owner() TO authenticated, service_role;

-- Remove grants from anon - these functions require authentication
REVOKE EXECUTE ON FUNCTION current_user_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION is_org_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION is_org_admin_or_owner() FROM anon;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
--
-- Test 1: Verify org lookup works
-- SELECT current_user_organization_id();
-- Expected: Your Supabase organization UUID (not Auth0 org ID)
--
-- Test 2: Verify role extraction
-- SELECT current_user_role();
-- Expected: "admin" (not "platform:admin")
--
-- Test 3: Verify super_admin check
-- SELECT is_super_admin();
-- Expected: true if platform:super_admin in your roles
--
-- Test 4: Verify anon cannot call functions
-- SET ROLE anon;
-- SELECT current_user_organization_id();
-- Expected: permission denied
