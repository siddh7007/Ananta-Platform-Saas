-- Migration: 004_phase2_create_default_workspaces.sql
-- Description: Create default workspaces for all organizations that don't have any workspaces
-- Phase: 2 - Data Population
-- Step: 2.2 - Create default workspaces
-- Date: 2025-12-14

-- ============================================================================
-- PRE-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_org_count INTEGER;
  v_orgs_with_tenant_id INTEGER;
BEGIN
  -- Check that organizations table exists and has records
  SELECT COUNT(*) INTO v_org_count FROM organizations;

  IF v_org_count = 0 THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: No organizations found. Run 003_phase2_populate_organizations.sql first.';
  END IF;

  -- Check that organizations have control_plane_tenant_id populated
  SELECT COUNT(*) INTO v_orgs_with_tenant_id
  FROM organizations
  WHERE control_plane_tenant_id IS NOT NULL;

  IF v_orgs_with_tenant_id != v_org_count THEN
    RAISE WARNING 'WARNING: % out of % organizations missing control_plane_tenant_id',
      (v_org_count - v_orgs_with_tenant_id), v_org_count;
  END IF;

  RAISE NOTICE 'PRE-CHECK PASSED: Found % organizations ready for workspace creation', v_org_count;
END $$;

-- ============================================================================
-- MAIN MIGRATION: Create Default Workspaces
-- ============================================================================

DO $$
DECLARE
  v_inserted_count INTEGER;
  v_org_count INTEGER;
  v_existing_workspace_count INTEGER;
BEGIN
  -- Count organizations
  SELECT COUNT(*) INTO v_org_count FROM organizations;

  -- Count organizations that already have workspaces
  SELECT COUNT(DISTINCT organization_id) INTO v_existing_workspace_count FROM workspaces;

  RAISE NOTICE 'Starting workspace creation for % organizations', v_org_count;
  RAISE NOTICE 'Organizations with existing workspaces: %', v_existing_workspace_count;

  -- Insert default workspaces for organizations without any workspaces
  INSERT INTO workspaces (
    id,
    organization_id,
    name,
    slug,
    description,
    visibility
  )
  SELECT
    gen_random_uuid() as id,
    o.id as organization_id,
    'Default Workspace' as name,
    'default' as slug,
    'Auto-created default workspace for organization' as description,
    'private' as visibility
  FROM organizations o
  LEFT JOIN workspaces w ON w.organization_id = o.id
  WHERE w.id IS NULL;  -- Only create for orgs without any workspaces

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RAISE NOTICE 'MIGRATION COMPLETE: Created % default workspaces', v_inserted_count;

  -- Validation: Ensure all organizations now have at least one workspace
  SELECT COUNT(*) INTO v_org_count
  FROM organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.organization_id = o.id
  );

  IF v_org_count > 0 THEN
    RAISE WARNING 'WARNING: % organizations still have no workspaces', v_org_count;
  ELSE
    RAISE NOTICE 'VALIDATION PASSED: All organizations now have workspaces';
  END IF;
END $$;

-- ============================================================================
-- POST-MIGRATION VALIDATION QUERIES
-- ============================================================================

-- Query 1: Count workspaces per organization
SELECT
  o.name as organization_name,
  o.control_plane_tenant_id,
  COUNT(w.id) as workspace_count
FROM organizations o
LEFT JOIN workspaces w ON w.organization_id = o.id
GROUP BY o.id, o.name, o.control_plane_tenant_id
ORDER BY o.name;

-- Query 2: List all default workspaces created
SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  w.slug,
  w.visibility,
  o.name as organization_name,
  o.control_plane_tenant_id,
  w.created_at
FROM workspaces w
JOIN organizations o ON w.organization_id = o.id
WHERE w.slug = 'default'
ORDER BY w.created_at DESC;

-- Query 3: Identify organizations without workspaces (should be empty)
SELECT
  o.id,
  o.name,
  o.control_plane_tenant_id
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.organization_id = o.id
);

-- Query 4: Summary statistics
SELECT
  (SELECT COUNT(*) FROM organizations) as total_organizations,
  (SELECT COUNT(*) FROM workspaces) as total_workspaces,
  (SELECT COUNT(DISTINCT organization_id) FROM workspaces) as orgs_with_workspaces,
  (SELECT COUNT(*) FROM workspaces WHERE slug = 'default') as default_workspaces;

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================

-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following script:
-- WARNING: This will delete all default workspaces created by this migration

/*
DO $$
DECLARE
  v_deleted_count INTEGER;
  v_migration_timestamp TIMESTAMPTZ;
  v_orgs_without_workspaces INTEGER;
BEGIN
  RAISE NOTICE 'Starting rollback: Deleting default workspaces...';

  -- Set the approximate timestamp when this migration ran
  -- Adjust this timestamp to match when the migration actually executed
  v_migration_timestamp := '2025-12-14 00:00:00'::TIMESTAMPTZ;

  -- Delete workspaces with slug 'default' that were created by this migration
  -- Use timestamp-based filtering for more precise rollback
  DELETE FROM workspaces
  WHERE slug = 'default'
    AND name = 'Default Workspace'
    AND created_at >= v_migration_timestamp;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'ROLLBACK COMPLETE: Deleted % default workspaces created after %', v_deleted_count, v_migration_timestamp;

  -- Validation: Show organizations without workspaces after rollback
  SELECT COUNT(*) INTO v_orgs_without_workspaces
  FROM organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.organization_id = o.id
  );

  RAISE NOTICE 'Organizations without workspaces after rollback: %', v_orgs_without_workspaces;
END $$;

-- Verify rollback
SELECT
  (SELECT COUNT(*) FROM organizations) as total_organizations,
  (SELECT COUNT(*) FROM workspaces) as total_workspaces,
  (SELECT COUNT(DISTINCT organization_id) FROM workspaces) as orgs_with_workspaces;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Expected Results:
-- - Each organization should have at least one workspace
-- - Default workspaces should be named "Default Workspace" with slug "default"
-- - All default workspaces should have status 'active'
-- - created_at and updated_at should be set to current timestamp
