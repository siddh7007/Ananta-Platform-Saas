-- =====================================================================================
-- Migration 011: Phase 3.4 - Enforce workspace_id NOT NULL on Projects (OPTIONAL)
-- =====================================================================================
-- Purpose: Make projects.workspace_id mandatory (OPTIONAL - only if organization_id is being deprecated)
-- Dependencies: Requires Phase 2 migrations to populate workspace_id
-- Created: 2025-12-14
-- =====================================================================================
-- IMPORTANT: This migration is OPTIONAL. Only run if:
--   1. You are fully deprecating projects.organization_id in favor of workspace hierarchy
--   2. All code has been updated to use workspace_id instead of organization_id
--   3. All projects have been migrated to workspaces
--
-- Alternative approach: Keep both workspace_id and organization_id as nullable,
-- allowing flexibility for different organizational structures.
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_null_count INTEGER;
    v_total_count INTEGER;
    v_org_only_count INTEGER;
BEGIN
    -- Check for any projects without workspace_id
    SELECT COUNT(*) INTO v_null_count FROM projects WHERE workspace_id IS NULL;
    SELECT COUNT(*) INTO v_total_count FROM projects;

    RAISE NOTICE '[VALIDATION] Projects without workspace_id: % out of % total', v_null_count, v_total_count;

    -- Check for projects with organization_id but no workspace_id (legacy pattern)
    SELECT COUNT(*) INTO v_org_only_count
    FROM projects
    WHERE organization_id IS NOT NULL
    AND workspace_id IS NULL;

    RAISE NOTICE '[VALIDATION] Projects with organization_id only (no workspace): %', v_org_only_count;

    IF v_null_count > 0 THEN
        RAISE EXCEPTION '[ERROR] Cannot enforce NOT NULL constraint: % projects still have NULL workspace_id. Run Phase 2 migrations first.', v_null_count;
    END IF;

    IF v_org_only_count > 0 THEN
        RAISE WARNING '[WARNING] Found % projects using old organization_id pattern. Ensure migration is intentional.', v_org_only_count;
    END IF;

    RAISE NOTICE '[OK] All projects have workspace_id populated. Safe to enforce constraint.';
    RAISE NOTICE '[REMINDER] This is an OPTIONAL migration. Confirm you want to enforce workspace_id.';
END $$;

-- =====================================================================================
-- MIGRATION: Add NOT NULL constraint to projects.workspace_id
-- =====================================================================================
-- UNCOMMENT THE FOLLOWING BLOCK TO APPLY THIS OPTIONAL MIGRATION:

/*
BEGIN;

-- Add NOT NULL constraint
ALTER TABLE projects
ALTER COLUMN workspace_id SET NOT NULL;

RAISE NOTICE '[MIGRATION] Added NOT NULL constraint to projects.workspace_id';

COMMIT;
*/

-- =====================================================================================
-- POST-MIGRATION VALIDATION (uncomment if migration is applied)
-- =====================================================================================

/*
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    -- Verify NOT NULL constraint is active
    SELECT
        attnotnull INTO v_constraint_exists
    FROM pg_attribute
    WHERE attrelid = 'projects'::regclass
    AND attname = 'workspace_id';

    IF v_constraint_exists THEN
        RAISE NOTICE '[VALIDATION] NOT NULL constraint on projects.workspace_id is active';
    ELSE
        RAISE EXCEPTION '[ERROR] NOT NULL constraint was not applied successfully';
    END IF;

    -- Show current state
    RAISE NOTICE '[VALIDATION] Current project distribution:';
    FOR rec IN (
        SELECT
            w.organization_id,
            w.id as workspace_id,
            w.name as workspace_name,
            COUNT(p.id) as project_count
        FROM workspaces w
        LEFT JOIN projects p ON p.workspace_id = w.id
        GROUP BY w.organization_id, w.id, w.name
        ORDER BY w.organization_id, project_count DESC
    ) LOOP
        RAISE NOTICE '  Org: %, Workspace: % (%), Projects: %',
            rec.organization_id, rec.workspace_name, rec.workspace_id, rec.project_count;
    END LOOP;
END $$;
*/

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Remove NOT NULL constraint
ALTER TABLE projects
ALTER COLUMN workspace_id DROP NOT NULL;

RAISE NOTICE '[ROLLBACK] Removed NOT NULL constraint from projects.workspace_id';

COMMIT;
*/

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Check if constraint is active
SELECT
    attname as column_name,
    attnotnull as is_not_null
FROM pg_attribute
WHERE attrelid = 'projects'::regclass
AND attname = 'workspace_id';

-- Verify all projects have workspace_id
SELECT
    COUNT(*) FILTER (WHERE workspace_id IS NOT NULL) as with_workspace,
    COUNT(*) FILTER (WHERE workspace_id IS NULL) as without_workspace,
    COUNT(*) as total
FROM projects;

-- Show project distribution by workspace
SELECT
    w.organization_id,
    w.name as workspace_name,
    COUNT(p.id) as project_count,
    STRING_AGG(p.name, ', ') as project_names
FROM workspaces w
LEFT JOIN projects p ON p.workspace_id = w.id
GROUP BY w.organization_id, w.name
ORDER BY project_count DESC, workspace_name
LIMIT 20;

-- Check for any legacy projects using organization_id without workspace_id
SELECT
    p.id,
    p.name,
    p.organization_id,
    p.workspace_id,
    o.name as org_name
FROM projects p
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE p.organization_id IS NOT NULL
AND p.workspace_id IS NULL
LIMIT 10;

-- =====================================================================================
-- MIGRATION DECISION GUIDE
-- =====================================================================================
/*
Should you run this migration?

YES - Run this migration if:
  ✓ You are fully adopting workspace-based organization (workspace → organization hierarchy)
  ✓ All application code uses workspace_id to determine organization context
  ✓ You have no use cases for projects without workspaces
  ✓ You want to enforce data integrity at the database level

NO - Skip this migration if:
  ✗ You want to support both direct organization membership and workspace membership
  ✗ Some projects may not belong to workspaces
  ✗ You're keeping organization_id as the primary organizational link
  ✗ You want flexibility in organizational structure

Alternative: Keep both workspace_id and organization_id as nullable columns,
and enforce business rules at the application level instead.
*/
