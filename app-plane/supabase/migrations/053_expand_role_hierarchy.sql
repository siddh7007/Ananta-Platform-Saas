-- Migration: 053_expand_role_hierarchy.sql
-- Description: Expand role hierarchy to include VIEWER, ANALYST, ENGINEER, DEVELOPER
-- Date: November 25, 2025
--
-- New Role Hierarchy (privilege levels 1-7):
--   viewer (1)     - Read-only access to dashboards and reports
--   analyst (2)    - View + export data, generate reports
--   member (3)     - Standard user, can create/edit own BOMs and components
--   engineer (4)   - Member + can approve/reject components, manage specifications
--   developer (5)  - Full API access, can use developer tools and integrations
--   admin (6)      - Organization management, user administration
--   org_admin (6)  - Organization admin (same level as admin, kept for backwards compatibility)
--   owner (6)      - Organization owner (billing, delete org) - same level as admin
--   super_admin (7)- Platform-wide access across all organizations
--
-- MIGRATION MAPPINGS (existing → new):
--   platform_admin → super_admin
--   user           → member
--   platform_user  → member
--   org_admin      → KEPT AS-IS (same level as admin)

-- =============================================================================
-- STEP 1: Migrate existing role values BEFORE changing constraints
-- =============================================================================

-- Migrate organization_memberships table
-- NOTE: org_admin is KEPT - it's a valid role at admin level
UPDATE organization_memberships SET role = 'super_admin' WHERE role = 'platform_admin';
UPDATE organization_memberships SET role = 'member' WHERE role IN ('user', 'platform_user');

-- Migrate users table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- NOTE: org_admin is KEPT - it's a valid role at admin level
        UPDATE users SET role = 'super_admin' WHERE role = 'platform_admin';
        UPDATE users SET role = 'member' WHERE role IN ('user', 'platform_user');
    END IF;
END $$;

-- Migrate users_v2 table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_v2') THEN
        -- NOTE: org_admin is KEPT - it's a valid role at admin level
        UPDATE users_v2 SET role = 'super_admin' WHERE role = 'platform_admin';
        UPDATE users_v2 SET role = 'member' WHERE role IN ('user', 'platform_user');
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Update organization_memberships table role constraint
-- =============================================================================

-- Drop existing constraint if it exists
ALTER TABLE organization_memberships
DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

-- Add new constraint with expanded roles (includes org_admin for backwards compatibility)
ALTER TABLE organization_memberships
ADD CONSTRAINT organization_memberships_role_check
CHECK (role IN ('viewer', 'analyst', 'member', 'engineer', 'developer', 'admin', 'org_admin', 'owner', 'super_admin'));

-- =============================================================================
-- Update users table role constraint (if exists)
-- =============================================================================

-- For users_v2 table (if it exists and has role column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users_v2' AND column_name = 'role'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE users_v2 DROP CONSTRAINT IF EXISTS users_v2_role_check;

        -- Add new constraint (includes org_admin for backwards compatibility)
        ALTER TABLE users_v2
        ADD CONSTRAINT users_v2_role_check
        CHECK (role IN ('viewer', 'analyst', 'member', 'engineer', 'developer', 'admin', 'org_admin', 'owner', 'super_admin'));
    END IF;
END $$;

-- For users table (if it exists and has role column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        -- Drop existing constraint
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

        -- Add new constraint (includes org_admin for backwards compatibility)
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('viewer', 'analyst', 'member', 'engineer', 'developer', 'admin', 'org_admin', 'owner', 'super_admin'));
    END IF;
END $$;

-- =============================================================================
-- Update role helper functions for database-level RLS (if used)
-- =============================================================================

-- Create or replace is_viewer function
CREATE OR REPLACE FUNCTION is_viewer()
RETURNS BOOLEAN AS $$
BEGIN
    -- Any authenticated user with a valid role is at least a viewer
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_viewer IS 'Check if current user has at least viewer role';

-- Create or replace is_analyst function
CREATE OR REPLACE FUNCTION is_analyst()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    RETURN user_role IN ('analyst', 'member', 'engineer', 'developer', 'admin', 'owner', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_analyst IS 'Check if current user has analyst-level access or higher';

-- Update is_engineer function to include new hierarchy
CREATE OR REPLACE FUNCTION is_engineer()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    RETURN user_role IN ('engineer', 'developer', 'admin', 'owner', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_engineer IS 'Check if current user has engineer-level access or higher';

-- Create or replace is_developer function
CREATE OR REPLACE FUNCTION is_developer()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    RETURN user_role IN ('developer', 'admin', 'owner', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_developer IS 'Check if current user has developer-level access or higher';

-- Update is_admin function to ensure it uses the new hierarchy
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    RETURN user_role IN ('admin', 'org_admin', 'owner', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin IS 'Check if current user has admin-level access or higher (includes org_admin)';

-- is_super_admin remains unchanged (only super_admin role)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    RETURN user_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_super_admin IS 'Check if current user is super_admin';

-- =============================================================================
-- Create role_level helper function for comparisons
-- =============================================================================

CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE role_name
        WHEN 'viewer' THEN 1
        WHEN 'analyst' THEN 2
        WHEN 'member' THEN 3
        WHEN 'engineer' THEN 4
        WHEN 'developer' THEN 5
        WHEN 'admin' THEN 6
        WHEN 'org_admin' THEN 6  -- Same level as admin
        WHEN 'owner' THEN 6
        WHEN 'super_admin' THEN 7
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_role_level IS 'Get numeric privilege level for a role name (1-7). org_admin = admin = owner = level 6';

-- Create function to check if user has minimum role level
CREATE OR REPLACE FUNCTION has_minimum_role(required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    required_level INTEGER;
    user_level INTEGER;
BEGIN
    required_level := get_role_level(required_role);

    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    user_level := get_role_level(user_role);

    RETURN user_level >= required_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_minimum_role IS 'Check if current user has at least the specified role level';

-- =============================================================================
-- STEP 4: Update legacy helper functions for backwards compatibility
-- =============================================================================
-- These functions were defined in earlier migrations (002_rbac_rls_setup.sql)
-- and may still be used in RLS policies. We update them to work with new roles.

-- is_platform_admin() - Now maps to super_admin check
-- This function is used in old RLS policies for admin-only operations
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check organization_memberships first (preferred)
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    IF user_role IS NOT NULL THEN
        RETURN user_role = 'super_admin';
    END IF;

    -- Fallback to users_v2 table if no membership found
    SELECT role INTO user_role FROM users_v2
    WHERE id = auth.uid() OR auth_id = auth.uid() LIMIT 1;

    RETURN user_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_platform_admin IS 'LEGACY: Check if current user is platform admin (now maps to super_admin role)';

-- is_platform_user() - Now maps to member-level or higher
-- This function is used in old RLS policies for read access
CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_level INTEGER;
BEGIN
    -- Check organization_memberships first (preferred)
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    IF user_role IS NOT NULL THEN
        user_level := get_role_level(user_role);
        -- Platform user had read access, equivalent to member (level 3) or higher
        RETURN user_level >= 3;
    END IF;

    -- Fallback to users_v2 table if no membership found
    SELECT role INTO user_role FROM users_v2
    WHERE id = auth.uid() OR auth_id = auth.uid() LIMIT 1;

    IF user_role IS NOT NULL THEN
        user_level := get_role_level(user_role);
        RETURN user_level >= 3;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_platform_user IS 'LEGACY: Check if current user is platform user (now maps to member-level or higher)';

-- is_org_admin() - Update to use new role hierarchy
-- This function checks for org-level admin access
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_level INTEGER;
BEGIN
    SELECT role INTO user_role FROM organization_memberships
    WHERE user_id = auth.uid() LIMIT 1;

    IF user_role IS NOT NULL THEN
        user_level := get_role_level(user_role);
        -- Admin level is 6 (admin, org_admin, owner) or 7 (super_admin)
        RETURN user_level >= 6;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_org_admin IS 'Check if current user has org admin access (role level 6+)';

-- =============================================================================
-- STEP 5: Update get_role_level to handle legacy role names
-- =============================================================================
-- This ensures old role names in database still work correctly

CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE LOWER(COALESCE(role_name, ''))
        -- Current roles
        WHEN 'viewer' THEN 1
        WHEN 'analyst' THEN 2
        WHEN 'member' THEN 3
        WHEN 'engineer' THEN 4
        WHEN 'developer' THEN 5
        WHEN 'admin' THEN 6
        WHEN 'org_admin' THEN 6  -- Same level as admin
        WHEN 'owner' THEN 6
        WHEN 'super_admin' THEN 7
        -- Legacy role mappings (in case DB not fully migrated)
        WHEN 'user' THEN 3       -- user → member
        WHEN 'platform_user' THEN 3  -- platform_user → member
        WHEN 'platform_admin' THEN 7 -- platform_admin → super_admin
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_role_level IS 'Get numeric privilege level for a role name (1-7). Handles both new and legacy role names.';

-- =============================================================================
-- Migration complete
-- =============================================================================
