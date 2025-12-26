-- =====================================================
-- Migration: Phase 2, Step 2.3 - Migrate Projects to Workspaces
-- =====================================================
-- Purpose: Assign all projects with NULL workspace_id to their organization's default workspace
-- Dependencies: 004_phase2_create_default_workspaces.sql (must run first)
-- Author: Claude Code
-- Date: 2025-12-14
-- =====================================================

-- =====================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================

DO $$
DECLARE
    v_projects_without_workspace INT;
    v_orgs_without_default_workspace INT;
    v_workspaces_count INT;
BEGIN
    -- Check if workspaces table exists and has data
    SELECT COUNT(*) INTO v_workspaces_count FROM workspaces;

    IF v_workspaces_count = 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: workspaces table is empty. Run 004_phase2_create_default_workspaces.sql first.';
    END IF;

    -- Count projects without workspace_id
    SELECT COUNT(*) INTO v_projects_without_workspace
    FROM projects
    WHERE workspace_id IS NULL;

    RAISE NOTICE 'Found % projects without workspace_id', v_projects_without_workspace;

    -- Check if all organizations have a default workspace
    SELECT COUNT(DISTINCT p.organization_id) INTO v_orgs_without_default_workspace
    FROM projects p
    LEFT JOIN workspaces w ON w.organization_id = p.organization_id AND w.slug = 'default'
    WHERE p.workspace_id IS NULL
      AND w.id IS NULL;

    IF v_orgs_without_default_workspace > 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: % organizations have projects but no default workspace. Run 004_phase2_create_default_workspaces.sql first.',
            v_orgs_without_default_workspace;
    END IF;

    RAISE NOTICE 'PRE-MIGRATION VALIDATION PASSED';
    RAISE NOTICE '- Projects to migrate: %', v_projects_without_workspace;
    RAISE NOTICE '- Total workspaces available: %', v_workspaces_count;
END $$;

-- =====================================================
-- PRE-MIGRATION VALIDATION - Check for Multiple Default Workspaces
-- =====================================================

DO $$
DECLARE
    v_orgs_with_multiple_defaults INTEGER;
BEGIN
    -- Check if any organization has multiple workspaces with slug='default'
    SELECT COUNT(*) INTO v_orgs_with_multiple_defaults
    FROM (
        SELECT organization_id, COUNT(*) as default_count
        FROM workspaces
        WHERE slug = 'default'
        GROUP BY organization_id
        HAVING COUNT(*) > 1
    ) multi_defaults;

    IF v_orgs_with_multiple_defaults > 0 THEN
        RAISE WARNING 'WARNING: % organizations have multiple default workspaces. Will use oldest one.', v_orgs_with_multiple_defaults;
    END IF;
END $$;

-- =====================================================
-- MIGRATION: Assign Projects to Default Workspaces
-- =====================================================

DO $$
DECLARE
    v_migrated_count INT;
BEGIN
    -- Create backup of current state for rollback
    CREATE TEMP TABLE IF NOT EXISTS projects_workspace_backup AS
    SELECT id, workspace_id, organization_id, updated_at
    FROM projects
    WHERE workspace_id IS NULL;

    RAISE NOTICE 'Created backup of % projects with NULL workspace_id', (SELECT COUNT(*) FROM projects_workspace_backup);

    -- Update projects to assign them to their organization's default workspace
    -- Use DISTINCT ON to handle multiple default workspaces (take oldest one)
    UPDATE projects p
    SET
        workspace_id = w.id,
        updated_at = NOW()
    FROM (
        SELECT DISTINCT ON (organization_id) id, organization_id
        FROM workspaces
        WHERE slug = 'default'
        ORDER BY organization_id, created_at ASC
    ) w
    WHERE w.organization_id = p.organization_id
      AND p.workspace_id IS NULL;

    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;

    RAISE NOTICE '===============================================';
    RAISE NOTICE 'MIGRATION COMPLETED';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Projects migrated to default workspaces: %', v_migrated_count;
END $$;

-- =====================================================
-- POST-MIGRATION VALIDATION
-- =====================================================

DO $$
DECLARE
    v_remaining_null_workspace INT;
    v_projects_with_workspace INT;
    v_mismatched_orgs INT;
BEGIN
    -- Count projects still without workspace_id
    SELECT COUNT(*) INTO v_remaining_null_workspace
    FROM projects
    WHERE workspace_id IS NULL;

    -- Count projects now with workspace_id
    SELECT COUNT(*) INTO v_projects_with_workspace
    FROM projects
    WHERE workspace_id IS NOT NULL;

    -- Check for projects where workspace organization doesn't match project organization
    SELECT COUNT(*) INTO v_mismatched_orgs
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE p.organization_id != w.organization_id;

    RAISE NOTICE '===============================================';
    RAISE NOTICE 'POST-MIGRATION VALIDATION';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Projects with workspace_id: %', v_projects_with_workspace;
    RAISE NOTICE 'Projects without workspace_id: %', v_remaining_null_workspace;
    RAISE NOTICE 'Projects with mismatched organization: %', v_mismatched_orgs;

    IF v_remaining_null_workspace > 0 THEN
        RAISE WARNING 'WARNING: % projects still have NULL workspace_id. This may indicate orphaned projects without organizations.',
            v_remaining_null_workspace;
    END IF;

    IF v_mismatched_orgs > 0 THEN
        RAISE EXCEPTION 'VALIDATION FAILED: % projects have workspace_id pointing to a different organization!',
            v_mismatched_orgs;
    END IF;

    RAISE NOTICE 'POST-MIGRATION VALIDATION PASSED';
END $$;

-- =====================================================
-- VALIDATION QUERIES (for manual verification)
-- =====================================================

-- View projects and their assigned workspaces
SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.slug AS project_slug,
    p.organization_id AS project_org_id,
    w.id AS workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    w.organization_id AS workspace_org_id,
    CASE
        WHEN p.organization_id = w.organization_id THEN 'MATCH'
        ELSE 'MISMATCH'
    END AS org_match_status
FROM projects p
LEFT JOIN workspaces w ON w.id = p.workspace_id
ORDER BY p.organization_id, p.created_at;

-- Count projects per workspace
SELECT
    w.organization_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    COUNT(p.id) AS project_count
FROM workspaces w
LEFT JOIN projects p ON p.workspace_id = w.id
GROUP BY w.organization_id, w.name, w.slug
ORDER BY w.organization_id, w.slug;

-- Find any orphaned projects (no workspace assigned)
SELECT
    id,
    name,
    slug,
    organization_id,
    workspace_id,
    created_at
FROM projects
WHERE workspace_id IS NULL;

-- =====================================================
-- ROLLBACK SCRIPT (Run manually if needed)
-- =====================================================

/*
-- To rollback this migration, run the following:

BEGIN;

-- Restore projects to their pre-migration state
UPDATE projects p
SET
    workspace_id = b.workspace_id,
    updated_at = b.updated_at
FROM projects_workspace_backup b
WHERE p.id = b.id;

-- Verify rollback
SELECT
    COUNT(*) FILTER (WHERE workspace_id IS NULL) AS null_workspace_count,
    COUNT(*) FILTER (WHERE workspace_id IS NOT NULL) AS assigned_workspace_count
FROM projects;

-- If verification looks correct, commit:
COMMIT;

-- Otherwise rollback:
-- ROLLBACK;

-- Drop backup table after successful rollback verification
DROP TABLE IF EXISTS projects_workspace_backup;
*/

-- =====================================================
-- CLEANUP
-- =====================================================

-- Keep backup table in temp schema for this session
-- It will auto-drop when session ends, or can be dropped manually:
-- DROP TABLE IF EXISTS projects_workspace_backup;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
