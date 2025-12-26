-- Migration: 084_migrate_to_workspaces.sql
-- Description: Migrate existing data to workspace architecture
--
-- This migration:
-- 1. Creates a default workspace for each existing organization
-- 2. Migrates org members to their default workspace (with role mapping)
-- 3. Updates existing projects to belong to the default workspace
-- 4. Updates existing BOMs to track workspace via project
--
-- This is Phase 2: Data Migration

BEGIN;

-- ============================================================================
-- SECTION 1: Create Default Workspace for Each Organization
-- ============================================================================

-- Insert default workspace for orgs that don't have one
INSERT INTO workspaces (organization_id, name, slug, is_default, created_at)
SELECT
    o.id,
    COALESCE(o.name, 'Default Workspace') || ' - Projects',
    LOWER(REGEXP_REPLACE(COALESCE(o.slug, o.name, 'default'), '[^a-zA-Z0-9]', '-', 'g')) || '-projects',
    true,
    COALESCE(o.created_at, NOW())
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.organization_id = o.id
    AND w.is_default = true
)
AND o.deleted_at IS NULL;

-- Log how many workspaces were created
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM workspaces WHERE is_default = true;
    RAISE NOTICE 'Created/verified % default workspaces', v_count;
END $$;


-- ============================================================================
-- SECTION 2: Migrate Organization Members to Default Workspace
-- ============================================================================

-- Role mapping from org roles to workspace roles:
-- owner -> admin (workspace admin, billing stays at org level)
-- admin -> admin
-- engineer -> engineer
-- analyst -> analyst
-- member -> viewer (lowest access)
-- viewer -> viewer

INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
SELECT
    w.id AS workspace_id,
    om.user_id,
    CASE om.role
        WHEN 'owner' THEN 'admin'
        WHEN 'admin' THEN 'admin'
        WHEN 'org_admin' THEN 'admin'
        WHEN 'super_admin' THEN 'admin'
        WHEN 'engineer' THEN 'engineer'
        WHEN 'analyst' THEN 'analyst'
        WHEN 'member' THEN 'viewer'
        WHEN 'viewer' THEN 'viewer'
        ELSE 'viewer'
    END AS role,
    COALESCE(om.created_at, NOW())
FROM organization_memberships om
JOIN workspaces w ON w.organization_id = om.organization_id AND w.is_default = true
WHERE NOT EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.workspace_id = w.id
    AND wm.user_id = om.user_id
);

-- Log how many memberships were migrated
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM workspace_memberships;
    RAISE NOTICE 'Total workspace memberships: %', v_count;
END $$;


-- ============================================================================
-- SECTION 3: Update Projects to Belong to Default Workspace
-- ============================================================================

-- Set workspace_id for projects that don't have one
UPDATE projects p
SET workspace_id = w.id
FROM workspaces w
WHERE w.organization_id = p.organization_id
AND w.is_default = true
AND p.workspace_id IS NULL;

-- Log how many projects were updated
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM projects WHERE workspace_id IS NOT NULL;
    RAISE NOTICE 'Projects with workspace_id: %', v_count;
END $$;


-- ============================================================================
-- SECTION 4: Update User Preferences with Default Workspace
-- ============================================================================

-- Set last_workspace_id for users who don't have one
INSERT INTO user_preferences (user_id, last_workspace_id)
SELECT
    wm.user_id,
    wm.workspace_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = true
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences up
    WHERE up.user_id = wm.user_id
)
ON CONFLICT (user_id) DO UPDATE
SET last_workspace_id = EXCLUDED.last_workspace_id
WHERE user_preferences.last_workspace_id IS NULL;


-- ============================================================================
-- SECTION 5: Update Organization Memberships Role Constraint
-- ============================================================================

-- Add 'member' role for org-level access without workspace privileges
-- This is for users who belong to org but have specific workspace roles

-- First, drop the existing constraint if it exists
ALTER TABLE organization_memberships
    DROP CONSTRAINT IF EXISTS valid_role;

-- Add new constraint with billing-focused roles + member + super_admin
ALTER TABLE organization_memberships
    ADD CONSTRAINT valid_org_membership_role
    CHECK (role IN ('owner', 'billing_admin', 'admin', 'engineer', 'analyst', 'member', 'viewer', 'super_admin'));

-- Note: We keep existing roles for backward compatibility during transition
-- In future cleanup migration, we'll convert engineer/analyst/viewer to 'member'
-- and only keep owner/billing_admin at org level


-- ============================================================================
-- SECTION 6: Verification Queries
-- ============================================================================

DO $$
DECLARE
    v_orgs_without_ws INTEGER;
    v_projects_without_ws INTEGER;
    v_members_without_ws INTEGER;
BEGIN
    -- Check for orgs without default workspace
    SELECT COUNT(*) INTO v_orgs_without_ws
    FROM organizations o
    WHERE NOT EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.organization_id = o.id AND w.is_default = true
    )
    AND o.deleted_at IS NULL;

    IF v_orgs_without_ws > 0 THEN
        RAISE WARNING '% organizations without default workspace', v_orgs_without_ws;
    END IF;

    -- Check for projects without workspace
    SELECT COUNT(*) INTO v_projects_without_ws
    FROM projects WHERE workspace_id IS NULL;

    IF v_projects_without_ws > 0 THEN
        RAISE NOTICE '% projects still without workspace_id (may be in deleted orgs)', v_projects_without_ws;
    END IF;

    -- Check for org members not in any workspace
    SELECT COUNT(*) INTO v_members_without_ws
    FROM organization_memberships om
    WHERE NOT EXISTS (
        SELECT 1 FROM workspace_memberships wm
        WHERE wm.user_id = om.user_id
    );

    IF v_members_without_ws > 0 THEN
        RAISE WARNING '% org members not in any workspace', v_members_without_ws;
    END IF;

    RAISE NOTICE 'Migration verification complete';
END $$;


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- What was done:
-- 1. Every organization now has a default workspace
-- 2. All org members are now workspace members with mapped roles
-- 3. All projects belong to their org's default workspace
-- 4. User preferences track last workspace
--
-- Role mapping applied:
--   owner -> admin (workspace level; owner remains at org for billing)
--   admin/org_admin -> admin
--   engineer -> engineer
--   analyst -> analyst
--   member/viewer -> viewer
--
-- Next steps (Migration 085):
-- 1. Add RLS policies for workspace tables
-- 2. Update project RLS to use workspace_memberships
-- 3. Keep org-level RLS as fallback
--
-- Future cleanup (later migration):
-- 1. Make projects.workspace_id NOT NULL
-- 2. Convert org roles to just owner/billing_admin/member
-- 3. Remove organization_id from projects (or keep for denormalization)
