-- Migration 061: Add Auth0 JWT custom claims support to RLS functions
-- Purpose: Enable direct Auth0 JWT usage while maintaining backward compatibility
-- Date: 2025-11-27
--
-- This migration updates RLS helper functions to support Auth0 custom claims:
-- 1. current_user_organization_id() - Reads organization_id from Auth0 claims
-- 2. current_user_role() - Reads role from Auth0 claims
-- 3. is_super_admin() - Updated to use Auth0 claims
--
-- Auth0 Custom Claims Namespace: https://ananta.component.platform/
-- Claims Structure:
--   - organization_id: UUID of user's organization
--   - role: User's role (admin, engineer, analyst, etc.)
--
-- Fallback Strategy (zero-downtime migration):
--   1. Try Auth0 custom claims (future state)
--   2. Try Supabase user_metadata from middleware (current state)
--   3. Try database lookup by auth0_user_id or email (backwards compatibility)

-- ============================================================================
-- Function 1: current_user_organization_id()
-- ============================================================================

CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    org_id uuid;
    jwt_claims jsonb;
BEGIN
    jwt_claims := auth.jwt();

    -- Priority 1: Auth0 custom claims (namespace: https://ananta.component.platform/)
    BEGIN
        org_id := (jwt_claims -> 'https://ananta.component.platform/organization_id')::uuid;
        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 2: Supabase user_metadata (set by middleware - current state)
    BEGIN
        org_id := (jwt_claims -> 'user_metadata' ->> 'organization_id')::uuid;
        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 3: Database lookup by auth0_user_id (Auth0 sub claim)
    BEGIN
        SELECT u.organization_id INTO org_id
        FROM users u
        WHERE u.auth0_user_id = jwt_claims ->> 'sub'
        LIMIT 1;

        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 4: Database lookup by Supabase user ID
    BEGIN
        SELECT u.organization_id INTO org_id
        FROM users u
        WHERE u.id = (auth.uid())::uuid
        LIMIT 1;

        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 5: Database lookup by email (final fallback)
    BEGIN
        SELECT u.organization_id INTO org_id
        FROM users u
        WHERE u.email = jwt_claims ->> 'email'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- Return NULL if all methods fail
        NULL;
    END;

    RETURN org_id;
END;
$$;

COMMENT ON FUNCTION current_user_organization_id() IS
'Returns current user organization_id from Auth0 custom claims, Supabase user_metadata, or database lookup';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO anon;
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO service_role;

-- ============================================================================
-- Function 2: current_user_role()
-- ============================================================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role text;
    jwt_claims jsonb;
BEGIN
    jwt_claims := auth.jwt();

    -- Priority 1: Auth0 custom claims (namespace: https://ananta.component.platform/)
    BEGIN
        user_role := jwt_claims -> 'https://ananta.component.platform/role';
        IF user_role IS NOT NULL THEN
            RETURN user_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 2: Supabase user_metadata (set by middleware - current state)
    BEGIN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        IF user_role IS NOT NULL THEN
            RETURN user_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 3: Database lookup by auth0_user_id (Auth0 sub claim)
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        JOIN users u ON u.id = om.user_id
        WHERE u.auth0_user_id = jwt_claims ->> 'sub'
        LIMIT 1;

        IF user_role IS NOT NULL THEN
            RETURN user_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 4: Database lookup by Supabase user ID
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        WHERE om.user_id = (auth.uid())::uuid
        LIMIT 1;

        IF user_role IS NOT NULL THEN
            RETURN user_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 5: Database lookup by email (final fallback)
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        JOIN users u ON u.id = om.user_id
        WHERE u.email = jwt_claims ->> 'email'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- Return NULL if all methods fail
        NULL;
    END;

    RETURN user_role;
END;
$$;

COMMENT ON FUNCTION current_user_role() IS
'Returns current user role from Auth0 custom claims, Supabase user_metadata, or database lookup';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION current_user_role() TO anon;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO service_role;

-- ============================================================================
-- Function 3: is_super_admin()
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role text;
    jwt_claims jsonb;
BEGIN
    jwt_claims := auth.jwt();

    -- Priority 1: Auth0 custom claims (namespace: https://ananta.component.platform/)
    BEGIN
        user_role := jwt_claims -> 'https://ananta.component.platform/role';
        IF user_role IS NOT NULL AND user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 2: Supabase user_metadata (set by middleware - current state)
    BEGIN
        user_role := jwt_claims -> 'user_metadata' ->> 'role';
        IF user_role IS NOT NULL AND user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 3: Database lookup by auth0_user_id
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        JOIN users u ON u.id = om.user_id
        WHERE u.auth0_user_id = jwt_claims ->> 'sub'
        LIMIT 1;

        IF user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 4: Database lookup by Supabase user ID
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        WHERE om.user_id = (auth.uid())::uuid
        LIMIT 1;

        IF user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next fallback
        NULL;
    END;

    -- Priority 5: Database lookup by email (final fallback)
    BEGIN
        SELECT om.role INTO user_role
        FROM organization_memberships om
        JOIN users u ON u.id = om.user_id
        WHERE u.email = jwt_claims ->> 'email'
        LIMIT 1;

        IF user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN false;
END;
$$;

COMMENT ON FUNCTION is_super_admin() IS
'Returns true if current user is super_admin based on Auth0 custom claims, Supabase user_metadata, or database lookup';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO service_role;

-- ============================================================================
-- Migration Notes
-- ============================================================================

-- This migration enables a zero-downtime transition to Auth0 direct JWT:
--
-- Current State (pre-migration):
--   - Frontend calls middleware /auth/create-supabase-session
--   - Middleware creates Supabase JWT with user_metadata
--   - Functions read from user_metadata (Priority 2)
--
-- Transition State (post-migration, before frontend update):
--   - Same as current state - no functional change
--   - Migration adds Auth0 custom claims support (Priority 1)
--   - Middleware flow continues to work (Priority 2)
--
-- Future State (after frontend update):
--   - Frontend uses Auth0 JWT directly
--   - Auth0 Action adds custom claims to JWT
--   - Functions read from custom claims (Priority 1)
--   - Database fallbacks provide safety net
--
-- Rollback Strategy:
--   - Functions maintain all fallback methods
--   - Can revert frontend without DB changes
--   - Can revert DB by re-running migration 058/060
