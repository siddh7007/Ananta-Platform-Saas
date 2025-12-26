-- ============================================================================
-- Migration 014: Unify Role Constraints Across All Tables
-- ============================================================================
-- This migration aligns all role CHECK constraints to the unified 5-level hierarchy:
--   super_admin (5) - Platform staff
--   owner (4) - Organization owner
--   admin (3) - Organization admin
--   engineer (2) - Technical user
--   analyst (1) - Read-only user
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: DROP all existing role CHECK constraints FIRST
-- ============================================================================

-- user_profiles.role constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- users.role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- organization_memberships.role constraint
ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

-- workspace_members.role constraint
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

-- projects.created_by_role constraint (may not exist in all deployments)
-- ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_role_check;

-- ============================================================================
-- Step 1b: Update column DEFAULTS to use valid roles
-- ============================================================================

-- Change defaults from 'user'/'member' to 'analyst' (lowest valid role)
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'analyst';
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'analyst';
ALTER TABLE organization_memberships ALTER COLUMN role SET DEFAULT 'analyst';
ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'analyst';
ALTER TABLE organization_invitations ALTER COLUMN role SET DEFAULT 'analyst';

-- ============================================================================
-- Step 2: Migrate legacy role values (now safe without constraints)
-- ============================================================================

-- Map legacy roles to canonical 5-level hierarchy
-- member, viewer, user → analyst
-- developer, staff → engineer

-- Update user_profiles
UPDATE user_profiles SET role = 'analyst' WHERE role IN ('member', 'viewer', 'user');
UPDATE user_profiles SET role = 'engineer' WHERE role IN ('developer', 'staff');

-- Update users table
UPDATE users SET role = 'analyst' WHERE role IN ('member', 'viewer', 'user');
UPDATE users SET role = 'engineer' WHERE role IN ('developer', 'staff');

-- Update organization_memberships
UPDATE organization_memberships SET role = 'analyst' WHERE role IN ('member', 'viewer', 'user');
UPDATE organization_memberships SET role = 'engineer' WHERE role IN ('developer', 'staff');

-- Update workspace_members
UPDATE workspace_members SET role = 'analyst' WHERE role IN ('member', 'viewer', 'user');
UPDATE workspace_members SET role = 'engineer' WHERE role IN ('developer', 'staff');

-- ============================================================================
-- Step 3: Add unified role CHECK constraints (5-level hierarchy)
-- ============================================================================

-- All tables now use the same 5 canonical roles
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'));

ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'));

ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check
    CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'));

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'));

-- projects.created_by_role (may not exist in all deployments)
-- ALTER TABLE projects ADD CONSTRAINT projects_created_by_role_check
--     CHECK (created_by_role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'));

-- ============================================================================
-- Step 4: Create role_mappings view for backwards compatibility
-- ============================================================================

DROP VIEW IF EXISTS role_mappings;
CREATE VIEW role_mappings AS
SELECT
    'super_admin' as canonical_role,
    5 as level,
    'Platform super admin - full access across all tenants' as description,
    ARRAY['super_admin', 'platform:super_admin', 'platform-super-admin', 'realm-admin', 'platform_admin'] as aliases
UNION ALL
SELECT
    'owner', 4, 'Organization owner - billing, delete org',
    ARRAY['owner', 'org-owner', 'organization-owner', 'billing_admin']
UNION ALL
SELECT
    'admin', 3, 'Organization admin - user management, settings',
    ARRAY['admin', 'administrator', 'org_admin', 'tenant-admin', 'org-admin']
UNION ALL
SELECT
    'engineer', 2, 'Engineer - manage BOMs, components, specs',
    ARRAY['engineer', 'staff', 'developer', 'support', 'operator', 'platform:engineer', 'platform:staff']
UNION ALL
SELECT
    'analyst', 1, 'Analyst - read-only access, reports',
    ARRAY['analyst', 'user', 'customer', 'viewer', 'member', 'read-only'];

COMMENT ON VIEW role_mappings IS 'Maps legacy role names to unified 5-level hierarchy';

-- ============================================================================
-- Step 5: Create helper function for role normalization
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_role(input_role TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
    lower_role TEXT;
BEGIN
    -- Convert to lowercase and handle nulls
    lower_role := LOWER(COALESCE(input_role, ''));

    -- Map legacy roles to canonical
    IF lower_role IN ('platform:super_admin', 'platform-super-admin', 'realm-admin', 'platform_admin') THEN
        normalized := 'super_admin';
    ELSIF lower_role IN ('org-owner', 'organization-owner', 'billing_admin') THEN
        normalized := 'owner';
    ELSIF lower_role IN ('administrator', 'org_admin', 'tenant-admin', 'org-admin') THEN
        normalized := 'admin';
    ELSIF lower_role IN ('staff', 'developer', 'support', 'operator', 'platform:engineer', 'platform:staff') THEN
        normalized := 'engineer';
    ELSIF lower_role IN ('user', 'customer', 'viewer', 'member', 'read-only', '') THEN
        normalized := 'analyst';
    ELSIF lower_role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst') THEN
        normalized := lower_role;
    ELSE
        normalized := 'analyst';
    END IF;

    RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_role(TEXT) IS 'Normalizes legacy role names to unified 5-level hierarchy';

COMMIT;

-- ============================================================================
-- Verification queries (run manually after migration)
-- ============================================================================
-- SELECT table_name, constraint_name FROM information_schema.table_constraints
-- WHERE constraint_type = 'CHECK' AND constraint_name LIKE '%role%';

-- SELECT 'user_profiles' as tbl, role, COUNT(*) FROM user_profiles GROUP BY role
-- UNION ALL SELECT 'users', role, COUNT(*) FROM users GROUP BY role
-- UNION ALL SELECT 'organization_memberships', role, COUNT(*) FROM organization_memberships GROUP BY role
-- UNION ALL SELECT 'workspace_members', role, COUNT(*) FROM workspace_members GROUP BY role;
