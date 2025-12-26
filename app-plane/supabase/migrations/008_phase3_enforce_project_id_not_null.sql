-- =====================================================================================
-- Migration 008: Phase 3.1 - Enforce project_id NOT NULL on BOMs
-- =====================================================================================
-- Purpose: Make boms.project_id mandatory after Phase 2.5 assigns all BOMs to projects
-- Dependencies: Requires 007_phase2_5_assign_all_boms_to_default_projects.sql to be completed
-- Created: 2025-12-14
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_null_count INTEGER;
    v_total_count INTEGER;
BEGIN
    -- Check for any BOMs without project_id
    SELECT COUNT(*) INTO v_null_count FROM boms WHERE project_id IS NULL;
    SELECT COUNT(*) INTO v_total_count FROM boms;

    RAISE NOTICE '[VALIDATION] BOMs without project_id: % out of % total', v_null_count, v_total_count;

    IF v_null_count > 0 THEN
        RAISE EXCEPTION '[ERROR] Cannot enforce NOT NULL constraint: % BOMs still have NULL project_id. Run Phase 2.5 migration (007) first.', v_null_count;
    END IF;

    RAISE NOTICE '[OK] All BOMs have project_id populated. Safe to enforce constraint.';
END $$;

-- =====================================================================================
-- MIGRATION: Add NOT NULL constraint to boms.project_id
-- =====================================================================================

BEGIN;

-- Add NOT NULL constraint
ALTER TABLE boms
ALTER COLUMN project_id SET NOT NULL;

COMMIT;

-- Separate DO block for notice (cannot use RAISE NOTICE inside transaction)
DO $$ BEGIN
    RAISE NOTICE '[MIGRATION] Added NOT NULL constraint to boms.project_id';
END $$;

-- =====================================================================================
-- POST-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_constraint_exists BOOLEAN;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Verify NOT NULL constraint is active
    SELECT
        attnotnull INTO v_constraint_exists
    FROM pg_attribute
    WHERE attrelid = 'boms'::regclass
    AND attname = 'project_id';

    IF v_constraint_exists THEN
        RAISE NOTICE '[VALIDATION] NOT NULL constraint on boms.project_id is active';
    ELSE
        RAISE EXCEPTION '[ERROR] NOT NULL constraint was not applied successfully';
    END IF;

    -- Show current state
    RAISE NOTICE '[VALIDATION] Current BOM distribution:';
    FOR rec IN (
        SELECT
            p.workspace_id,
            p.id as project_id,
            p.name as project_name,
            COUNT(b.id) as bom_count
        FROM projects p
        LEFT JOIN boms b ON b.project_id = p.id
        GROUP BY p.workspace_id, p.id, p.name
        ORDER BY p.workspace_id, bom_count DESC
    ) LOOP
        RAISE NOTICE '  Workspace: %, Project: % (%), BOMs: %',
            rec.workspace_id, rec.project_name, rec.project_id, rec.bom_count;
    END LOOP;
END $$;

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Remove NOT NULL constraint
ALTER TABLE boms
ALTER COLUMN project_id DROP NOT NULL;

RAISE NOTICE '[ROLLBACK] Removed NOT NULL constraint from boms.project_id';

COMMIT;
*/

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Check constraint is active
SELECT
    attname as column_name,
    attnotnull as is_not_null
FROM pg_attribute
WHERE attrelid = 'boms'::regclass
AND attname = 'project_id';

-- Verify all BOMs have project_id
SELECT
    COUNT(*) FILTER (WHERE project_id IS NOT NULL) as with_project,
    COUNT(*) FILTER (WHERE project_id IS NULL) as without_project,
    COUNT(*) as total
FROM boms;

-- Show BOM distribution by project
SELECT
    p.workspace_id,
    p.name as project_name,
    COUNT(b.id) as bom_count
FROM projects p
LEFT JOIN boms b ON b.project_id = p.id
GROUP BY p.workspace_id, p.name
ORDER BY workspace_id, bom_count DESC;
