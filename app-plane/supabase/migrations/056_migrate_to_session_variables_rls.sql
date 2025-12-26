-- Migration 056: Migrate RLS Policies to Use Session Variables Instead of auth.uid()
-- This allows Auth0-only authentication while keeping database-level RLS security
-- Session variables are set by middleware API after Auth0 token validation
-- Date: 2025-11-27

-- ========================================
-- 1. UPDATE RLS HELPER FUNCTIONS
-- ========================================

-- Replace current_user_tenant_id to use session variable instead of auth.uid()
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    -- Try to get organization_id from session variable
    BEGIN
        RETURN current_setting('app.organization_id', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to NULL if not set
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Replace current_user_organization_id to use session variable
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
BEGIN
    -- Try to get organization_id from session variable
    BEGIN
        RETURN current_setting('app.organization_id', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to NULL if not set
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Replace is_super_admin to use session variable
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user role in session variable is super_admin
    BEGIN
        RETURN current_setting('app.user_role', true) = 'super_admin';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to false if not set
        RETURN false;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- New helper function to get current user ID from session
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
    -- Try to get user_id from session variable
    BEGIN
        RETURN current_setting('app.user_id', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to NULL if not set
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 2. VERIFY FUNCTIONS
-- ========================================

-- Test the functions (should return NULL/false when no session vars set)
DO $$
DECLARE
    test_org_id UUID;
    test_user_id UUID;
    test_is_admin BOOLEAN;
BEGIN
    -- Test without session variables
    test_org_id := public.current_user_organization_id();
    test_user_id := public.current_user_id();
    test_is_admin := public.is_super_admin();

    RAISE NOTICE 'Functions created successfully';
    RAISE NOTICE 'Without session vars - org_id: %, user_id: %, is_admin: %',
        test_org_id, test_user_id, test_is_admin;

    -- Test with session variables
    PERFORM set_config('app.organization_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    PERFORM set_config('app.user_id', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false);
    PERFORM set_config('app.user_role', 'super_admin', false);

    test_org_id := public.current_user_organization_id();
    test_user_id := public.current_user_id();
    test_is_admin := public.is_super_admin();

    RAISE NOTICE 'With session vars - org_id: %, user_id: %, is_admin: %',
        test_org_id, test_user_id, test_is_admin;

    -- Reset session variables
    PERFORM set_config('app.organization_id', '', false);
    PERFORM set_config('app.user_id', '', false);
    PERFORM set_config('app.user_role', '', false);
END $$;

-- ========================================
-- 3. DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION public.current_user_tenant_id() IS
'Returns current user organization_id from PostgreSQL session variable app.organization_id.
Set by middleware API after Auth0 token validation.';

COMMENT ON FUNCTION public.current_user_organization_id() IS
'Returns current user organization_id from PostgreSQL session variable app.organization_id.
Set by middleware API after Auth0 token validation.';

COMMENT ON FUNCTION public.is_super_admin() IS
'Returns true if current user role is super_admin based on session variable app.user_role.
Set by middleware API after Auth0 token validation.';

COMMENT ON FUNCTION public.current_user_id() IS
'Returns current user ID from PostgreSQL session variable app.user_id.
Set by middleware API after Auth0 token validation.';
