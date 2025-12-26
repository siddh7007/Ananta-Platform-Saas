-- Migration: 002_phase1_add_workspace_id_to_projects.sql
-- Phase 1, Step 1.2: Add workspace_id to projects table
-- Purpose: Create workspace → project hierarchy for multi-workspace support
-- Database: Supabase PostgreSQL (app-plane-supabase-db)

-- Pre-migration validation: Ensure workspaces table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'workspaces'
    ) THEN
        RAISE EXCEPTION 'Migration 002 aborted: workspaces table does not exist. Run migration 001 first.';
    END IF;

    RAISE NOTICE 'Pre-migration validation passed: workspaces table exists';
END $$;

-- Add workspace_id column to projects table
-- Nullable for now to allow existing projects to remain valid
-- Will be populated in subsequent migration steps
ALTER TABLE projects
ADD COLUMN workspace_id UUID NULL;

-- Add foreign key constraint to workspaces table
-- ON DELETE RESTRICT prevents accidental workspace deletion if projects exist
-- ON UPDATE CASCADE propagates workspace ID changes (if ever needed)
-- Application layer should handle explicit cascade deletes if desired
ALTER TABLE projects
ADD CONSTRAINT fk_projects_workspace
FOREIGN KEY (workspace_id)
REFERENCES workspaces(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Add column comment for documentation
COMMENT ON COLUMN projects.workspace_id IS 'Reference to parent workspace. Creates workspace → project hierarchy. NULL allowed during migration phase.';

-- Add index for performance on workspace_id lookups
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

-- Add index comment
COMMENT ON INDEX idx_projects_workspace_id IS 'Performance index for workspace → projects queries';

-- Add partial index for NULL workspace_id queries (useful during migration phase)
-- This speeds up queries that filter for projects without a workspace
CREATE INDEX idx_projects_workspace_id_null ON projects(organization_id) WHERE workspace_id IS NULL;

-- Add partial index comment
COMMENT ON INDEX idx_projects_workspace_id_null IS 'Partial index for querying projects without workspace_id (migration phase support)';

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to rollback this migration)
-- ============================================================================
-- -- Drop partial index for NULL workspace_id
-- DROP INDEX IF EXISTS idx_projects_workspace_id_null;
--
-- -- Drop regular index for workspace_id
-- DROP INDEX IF EXISTS idx_projects_workspace_id;
--
-- -- Drop foreign key constraint
-- ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_workspace;
--
-- -- Drop workspace_id column
-- ALTER TABLE projects DROP COLUMN IF EXISTS workspace_id;
--
-- -- Verify rollback
-- -- SELECT column_name FROM information_schema.columns
-- -- WHERE table_name = 'projects' AND column_name = 'workspace_id';
-- -- (Should return 0 rows)
-- ============================================================================

-- Validation queries (commented out - uncomment to verify migration)
-- Verify column was added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'projects' AND column_name = 'workspace_id';

-- Verify foreign key constraint
-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name,
--     rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--     AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
--     AND ccu.table_schema = tc.table_schema
-- JOIN information_schema.referential_constraints AS rc
--     ON tc.constraint_name = rc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND tc.table_name = 'projects'
--     AND kcu.column_name = 'workspace_id';

-- Verify index was created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'projects' AND indexname = 'idx_projects_workspace_id';

-- Check current projects table state
-- SELECT id, name, organization_id, workspace_id
-- FROM projects
-- LIMIT 5;
