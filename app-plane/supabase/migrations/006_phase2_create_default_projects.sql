-- ============================================================================
-- Phase 2, Step 2.4: Create Default Projects for Workspaces
-- ============================================================================
-- Purpose: For each workspace that doesn't have any projects, create a
--          default project to maintain 1:1 relationship during migration
-- Dependencies:
--   - 004_phase2_create_workspaces.sql (workspaces table exists)
--   - 005_phase2_populate_project_workspace_id.sql (existing projects linked)
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_workspaces_count INTEGER;
  v_projects_count INTEGER;
  v_workspaces_with_projects INTEGER;
  v_workspaces_without_projects INTEGER;
BEGIN
  -- Check workspaces table exists and has data
  SELECT COUNT(*) INTO v_workspaces_count FROM workspaces;
  RAISE NOTICE '[VALIDATION] Found % workspaces', v_workspaces_count;

  IF v_workspaces_count = 0 THEN
    RAISE WARNING '[VALIDATION] No workspaces found - this migration may not have any effect';
  END IF;

  -- Check projects table exists
  SELECT COUNT(*) INTO v_projects_count FROM projects;
  RAISE NOTICE '[VALIDATION] Found % existing projects', v_projects_count;

  -- Count workspaces that already have projects
  SELECT COUNT(DISTINCT w.id) INTO v_workspaces_with_projects
  FROM workspaces w
  INNER JOIN projects p ON p.workspace_id = w.id;
  RAISE NOTICE '[VALIDATION] % workspaces already have projects', v_workspaces_with_projects;

  -- Count workspaces that need default projects
  SELECT COUNT(*) INTO v_workspaces_without_projects
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.workspace_id = w.id
  );
  RAISE NOTICE '[VALIDATION] % workspaces need default projects', v_workspaces_without_projects;

  -- Check for potential slug conflicts (default projects with slug 'default')
  IF EXISTS (
    SELECT 1 FROM projects
    WHERE slug = 'default'
    AND workspace_id IS NOT NULL
  ) THEN
    RAISE WARNING '[VALIDATION] Some workspaces already have projects with slug "default"';
  END IF;

  RAISE NOTICE '[VALIDATION] Pre-migration checks completed';
END $$;

-- ============================================================================
-- MIGRATION: Create Default Projects for Workspaces Without Projects
-- ============================================================================

DO $$
DECLARE
  v_inserted_count INTEGER;
  v_projects_before_migration INTEGER;
  v_migration_started_at TIMESTAMPTZ;
BEGIN
  -- Capture pre-migration count BEFORE any changes
  SELECT COUNT(*) INTO v_projects_before_migration FROM projects;
  v_migration_started_at := NOW();

  RAISE NOTICE '[MIGRATION] Starting default project creation...';
  RAISE NOTICE '[MIGRATION] Projects before migration: %', v_projects_before_migration;

  -- Create backup table (empty structure first, then populate)
  CREATE TEMP TABLE IF NOT EXISTS migration_006_backup (
    projects_before_migration INTEGER,
    migration_started_at TIMESTAMPTZ
  );

  -- Store pre-migration metadata in backup table
  INSERT INTO migration_006_backup (projects_before_migration, migration_started_at)
  VALUES (v_projects_before_migration, v_migration_started_at);

  -- Create default project for each workspace that doesn't have any projects
  WITH new_projects AS (
    INSERT INTO projects (
      id,
      workspace_id,
      organization_id,
      name,
      slug,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid() as id,
      w.id as workspace_id,
      w.organization_id as organization_id,
      'Default Project' as name,
      'default' as slug,
      'active' as status,
      v_migration_started_at as created_at,
      v_migration_started_at as updated_at
    FROM workspaces w
    WHERE NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.workspace_id = w.id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted_count FROM new_projects;

  RAISE NOTICE '[MIGRATION] Created % default projects', v_inserted_count;

  IF v_inserted_count > 0 THEN
    RAISE NOTICE '[MIGRATION] Default projects created successfully';
  ELSE
    RAISE NOTICE '[MIGRATION] No default projects needed - all workspaces already have projects';
  END IF;

END $$;

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_total_workspaces INTEGER;
  v_workspaces_with_projects INTEGER;
  v_workspaces_without_projects INTEGER;
  v_default_projects_count INTEGER;
BEGIN
  RAISE NOTICE '[POST-VALIDATION] Running post-migration checks...';

  -- Count total workspaces
  SELECT COUNT(*) INTO v_total_workspaces FROM workspaces;
  RAISE NOTICE '[POST-VALIDATION] Total workspaces: %', v_total_workspaces;

  -- Count workspaces with projects (should equal total after migration)
  SELECT COUNT(DISTINCT w.id) INTO v_workspaces_with_projects
  FROM workspaces w
  INNER JOIN projects p ON p.workspace_id = w.id;
  RAISE NOTICE '[POST-VALIDATION] Workspaces with projects: %', v_workspaces_with_projects;

  -- Count workspaces without projects (should be 0 after migration)
  SELECT COUNT(*) INTO v_workspaces_without_projects
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.workspace_id = w.id
  );
  RAISE NOTICE '[POST-VALIDATION] Workspaces without projects: %', v_workspaces_without_projects;

  -- Count default projects created by this migration
  SELECT COUNT(*) INTO v_default_projects_count
  FROM projects
  WHERE name = 'Default Project' AND slug = 'default';
  RAISE NOTICE '[POST-VALIDATION] Default projects created: %', v_default_projects_count;

  -- Validate that all workspaces now have at least one project
  IF v_workspaces_without_projects > 0 THEN
    RAISE WARNING '[POST-VALIDATION] WARNING: % workspaces still have no projects', v_workspaces_without_projects;
  ELSE
    RAISE NOTICE '[POST-VALIDATION] SUCCESS: All workspaces have at least one project';
  END IF;

  -- Validate data integrity
  IF EXISTS (
    SELECT 1 FROM projects
    WHERE workspace_id IS NOT NULL
    AND organization_id IS NULL
  ) THEN
    RAISE WARNING '[POST-VALIDATION] WARNING: Some projects have workspace_id but missing organization_id';
  END IF;

  RAISE NOTICE '[POST-VALIDATION] Post-migration validation completed';
END $$;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================
-- Run these queries to verify the migration results:

-- Query 1: Workspace project summary
-- SELECT
--   COUNT(DISTINCT w.id) as total_workspaces,
--   COUNT(DISTINCT p.workspace_id) as workspaces_with_projects,
--   COUNT(p.id) as total_projects,
--   COUNT(CASE WHEN p.name = 'Default Project' THEN 1 END) as default_projects
-- FROM workspaces w
-- LEFT JOIN projects p ON p.workspace_id = w.id;

-- Query 2: Workspaces without projects (should be empty)
-- SELECT w.id, w.name, w.organization_id
-- FROM workspaces w
-- WHERE NOT EXISTS (
--   SELECT 1 FROM projects p WHERE p.workspace_id = w.id
-- );

-- Query 3: Default projects created
-- SELECT
--   p.id,
--   p.name,
--   p.slug,
--   p.workspace_id,
--   w.name as workspace_name,
--   p.organization_id,
--   o.name as organization_name,
--   p.status,
--   p.created_at
-- FROM projects p
-- INNER JOIN workspaces w ON w.id = p.workspace_id
-- LEFT JOIN organizations o ON o.id = p.organization_id
-- WHERE p.name = 'Default Project' AND p.slug = 'default'
-- ORDER BY p.created_at DESC;

-- Query 4: Projects per workspace distribution
-- SELECT
--   project_count,
--   COUNT(*) as workspaces_with_this_count
-- FROM (
--   SELECT w.id, COUNT(p.id) as project_count
--   FROM workspaces w
--   LEFT JOIN projects p ON p.workspace_id = w.id
--   GROUP BY w.id
-- ) workspace_projects
-- GROUP BY project_count
-- ORDER BY project_count;

-- Query 5: Data integrity check
-- SELECT
--   COUNT(*) as total_projects,
--   COUNT(workspace_id) as with_workspace_id,
--   COUNT(organization_id) as with_organization_id,
--   COUNT(CASE WHEN workspace_id IS NOT NULL AND organization_id IS NULL THEN 1 END) as orphaned_projects
-- FROM projects;

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================
-- To rollback this migration, run:

/*
BEGIN;

-- Verify backup table exists
DO $$
DECLARE
  v_migration_timestamp TIMESTAMPTZ;
  v_projects_before INTEGER;
  v_deleted_count INTEGER;
BEGIN
  -- Get migration timestamp from backup table
  SELECT migration_started_at, projects_before_migration
  INTO v_migration_timestamp, v_projects_before
  FROM migration_006_backup
  LIMIT 1;

  IF v_migration_timestamp IS NULL THEN
    RAISE EXCEPTION 'Backup table not found or empty. Cannot safely rollback.';
  END IF;

  RAISE NOTICE 'Rolling back projects created after %', v_migration_timestamp;
  RAISE NOTICE 'Expected to restore to % projects', v_projects_before;

  -- Delete all default projects created by this migration
  -- Use precise timestamp for safety
  DELETE FROM projects
  WHERE name = 'Default Project'
    AND slug = 'default'
    AND created_at >= v_migration_timestamp;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % default projects', v_deleted_count;

  -- Verify rollback
  RAISE NOTICE 'Remaining default projects: %', (
    SELECT COUNT(*) FROM projects
    WHERE name = 'Default Project' AND slug = 'default'
  );

  RAISE NOTICE 'Current total projects: %', (SELECT COUNT(*) FROM projects);
END $$;

-- If satisfied with rollback:
COMMIT;

-- Drop backup table
DROP TABLE IF EXISTS migration_006_backup;

-- Otherwise rollback the rollback:
-- ROLLBACK;
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This migration creates default projects ONLY for workspaces that don't
--    have any projects yet
-- 2. Existing projects are not modified
-- 3. Default projects maintain both workspace_id and organization_id for
--    backward compatibility
-- 4. The slug 'default' may conflict if a workspace already has a project
--    with that slug (handled by unique constraint if exists)
-- 5. This migration is idempotent - running it multiple times is safe
-- 6. After Phase 3 (removing organization_id), these default projects will
--    only reference workspace_id

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
