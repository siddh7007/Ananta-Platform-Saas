-- =====================================================================================
-- Migration: 007_phase2_assign_boms_to_projects.sql
-- Phase 2, Step 2.5: Assign existing BOMs to their organization's default project
-- =====================================================================================
-- Description:
--   Updates all BOMs that have NULL project_id to reference their organization's
--   default project (where slug='default'). This establishes the project hierarchy
--   for existing BOM data.
--
-- Prerequisites:
--   - Migration 005 (boms.project_id column exists)
--   - Migration 006 (default projects created for all organizations)
--
-- Author: Claude Code
-- Date: 2025-12-14
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_bom_count INTEGER;
    v_org_count INTEGER;
    v_project_count INTEGER;
    v_unmatched_count INTEGER;
BEGIN
    -- Check that boms table has project_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'boms'
          AND column_name = 'project_id'
    ) THEN
        RAISE EXCEPTION 'Column boms.project_id does not exist. Run migration 005 first.';
    END IF;

    -- Count BOMs with NULL project_id
    SELECT COUNT(*) INTO v_bom_count
    FROM boms
    WHERE project_id IS NULL;

    RAISE NOTICE 'Found % BOMs with NULL project_id', v_bom_count;

    -- Count organizations
    SELECT COUNT(*) INTO v_org_count
    FROM organizations;

    RAISE NOTICE 'Found % organizations', v_org_count;

    -- Count default projects
    SELECT COUNT(*) INTO v_project_count
    FROM projects
    WHERE slug = 'default';

    RAISE NOTICE 'Found % default projects', v_project_count;

    -- Check if all organizations have default projects
    IF v_project_count < v_org_count THEN
        RAISE WARNING 'Only % out of % organizations have default projects. Run migration 006 first.',
            v_project_count, v_org_count;
    END IF;

    -- Check for BOMs that won't match any project
    SELECT COUNT(*) INTO v_unmatched_count
    FROM boms b
    WHERE b.project_id IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM projects p
          WHERE p.organization_id = b.organization_id
            AND p.slug = 'default'
      );

    IF v_unmatched_count > 0 THEN
        RAISE EXCEPTION '% BOMs belong to organizations without default projects. Run migration 006 first.',
            v_unmatched_count;
    END IF;

    RAISE NOTICE 'Pre-migration validation passed';
END $$;

-- =====================================================================================
-- BEFORE SNAPSHOT
-- =====================================================================================

-- Show current state before migration
SELECT
    'BEFORE MIGRATION' AS status,
    COUNT(*) AS total_boms,
    COUNT(CASE WHEN project_id IS NULL THEN 1 END) AS boms_without_project,
    COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) AS boms_with_project
FROM boms;

-- Show BOM distribution by organization (before)
SELECT
    'BEFORE MIGRATION - BY ORG' AS status,
    o.id AS organization_id,
    o.name AS organization_name,
    COUNT(b.id) AS bom_count,
    COUNT(CASE WHEN b.project_id IS NULL THEN 1 END) AS boms_without_project,
    (SELECT p.id FROM projects p WHERE p.organization_id = o.id AND p.slug = 'default') AS default_project_id
FROM organizations o
LEFT JOIN boms b ON b.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY o.name;

-- =====================================================================================
-- PRE-MIGRATION VALIDATION - Check for Multiple Default Projects
-- =====================================================================================

DO $$
DECLARE
    v_orgs_with_multiple_defaults INTEGER;
BEGIN
    -- Check if any organization has multiple projects with slug='default'
    SELECT COUNT(*) INTO v_orgs_with_multiple_defaults
    FROM (
        SELECT organization_id, COUNT(*) as default_count
        FROM projects
        WHERE slug = 'default'
        GROUP BY organization_id
        HAVING COUNT(*) > 1
    ) multi_defaults;

    IF v_orgs_with_multiple_defaults > 0 THEN
        RAISE WARNING 'WARNING: % organizations have multiple default projects. Will use oldest one.', v_orgs_with_multiple_defaults;
    END IF;
END $$;

-- =====================================================================================
-- MIGRATION: Assign BOMs to Default Projects
-- =====================================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Update BOMs to reference their organization's default project
    -- Use DISTINCT ON to handle multiple default projects (take oldest one)
    UPDATE boms b
    SET
        project_id = p.id,
        updated_at = NOW()
    FROM (
        SELECT DISTINCT ON (organization_id) id, organization_id
        FROM projects
        WHERE slug = 'default'
        ORDER BY organization_id, created_at ASC
    ) p
    WHERE p.organization_id = b.organization_id
      AND b.project_id IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RAISE NOTICE 'Updated % BOMs with project assignments', v_updated_count;
END $$;

-- =====================================================================================
-- POST-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_null_count INTEGER;
    v_assigned_count INTEGER;
    v_total_count INTEGER;
    v_org_record RECORD;
BEGIN
    -- Count BOMs by project_id status
    SELECT
        COUNT(*),
        COUNT(CASE WHEN project_id IS NULL THEN 1 END),
        COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END)
    INTO v_total_count, v_null_count, v_assigned_count
    FROM boms;

    RAISE NOTICE 'Total BOMs: %, Assigned: %, Unassigned: %',
        v_total_count, v_assigned_count, v_null_count;

    -- Warn if any BOMs still have NULL project_id
    IF v_null_count > 0 THEN
        RAISE WARNING '% BOMs still have NULL project_id', v_null_count;

        -- Log which organizations have BOMs without projects
        FOR v_org_record IN
            SELECT DISTINCT b.organization_id, o.name as org_name
            FROM boms b
            LEFT JOIN organizations o ON o.id = b.organization_id
            WHERE b.project_id IS NULL
            ORDER BY o.name
        LOOP
            RAISE NOTICE 'Organization % (%) has BOMs without projects',
                v_org_record.org_name, v_org_record.organization_id;
        END LOOP;
    ELSE
        RAISE NOTICE 'SUCCESS: All BOMs have been assigned to projects';
    END IF;

    -- Verify all assigned projects are valid
    IF EXISTS (
        SELECT 1 FROM boms b
        WHERE b.project_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM projects p
              WHERE p.id = b.project_id
          )
    ) THEN
        RAISE EXCEPTION 'Some BOMs reference non-existent projects!';
    END IF;

    RAISE NOTICE 'Post-migration validation passed';
END $$;

-- =====================================================================================
-- AFTER SNAPSHOT
-- =====================================================================================

-- Show final state after migration
SELECT
    'AFTER MIGRATION' AS status,
    COUNT(*) AS total_boms,
    COUNT(CASE WHEN project_id IS NULL THEN 1 END) AS boms_without_project,
    COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) AS boms_with_project
FROM boms;

-- Show BOM distribution by organization and project (after)
SELECT
    'AFTER MIGRATION - BY ORG/PROJECT' AS status,
    o.id AS organization_id,
    o.name AS organization_name,
    p.id AS project_id,
    p.name AS project_name,
    p.slug AS project_slug,
    COUNT(b.id) AS bom_count
FROM organizations o
LEFT JOIN projects p ON p.organization_id = o.id
LEFT JOIN boms b ON b.project_id = p.id
GROUP BY o.id, o.name, p.id, p.name, p.slug
ORDER BY o.name, p.slug;

-- Show detailed BOM-to-project assignments
SELECT
    'BOM ASSIGNMENTS' AS status,
    b.id AS bom_id,
    b.name AS bom_name,
    b.version AS bom_version,
    o.name AS organization_name,
    p.name AS project_name,
    p.slug AS project_slug
FROM boms b
JOIN organizations o ON o.id = b.organization_id
LEFT JOIN projects p ON p.id = b.project_id
ORDER BY o.name, b.name;

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration (set all project_id back to NULL):
--
-- BEGIN;
--
-- -- Store current state for verification
-- CREATE TEMP TABLE bom_project_backup AS
-- SELECT id, project_id, updated_at
-- FROM boms
-- WHERE project_id IS NOT NULL;
--
-- -- Show what will be rolled back
-- SELECT
--     'ROLLBACK PREVIEW' AS status,
--     COUNT(*) AS boms_to_unassign
-- FROM bom_project_backup;
--
-- -- Reset project_id to NULL for all BOMs assigned to default projects
-- UPDATE boms b
-- SET
--     project_id = NULL,
--     updated_at = NOW()
-- FROM projects p
-- WHERE b.project_id = p.id
--   AND p.slug = 'default';
--
-- -- Verify rollback
-- SELECT
--     'AFTER ROLLBACK' AS status,
--     COUNT(*) AS total_boms,
--     COUNT(CASE WHEN project_id IS NULL THEN 1 END) AS boms_without_project,
--     COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) AS boms_with_project
-- FROM boms;
--
-- -- If verification looks correct, commit:
-- -- COMMIT;
-- -- Otherwise rollback the rollback:
-- -- ROLLBACK;
--
-- =====================================================================================

-- Migration complete
SELECT 'Migration 007_phase2_assign_boms_to_projects.sql completed successfully' AS result;
