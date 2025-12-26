-- =====================================================================================
-- Migration 009: Phase 3.2 - Add BOM Uniqueness Constraint
-- =====================================================================================
-- Purpose: Prevent duplicate BOMs in same project with same name+version
-- Dependencies: Requires 008_phase3_enforce_project_id_not_null.sql
-- Created: 2025-12-14
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_duplicate_count INTEGER;
    v_total_bom_count INTEGER;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Check for existing duplicates that would violate constraint
    WITH duplicates AS (
        SELECT
            project_id,
            name,
            COALESCE(version, '') as version_normalized,
            COUNT(*) as duplicate_count
        FROM boms
        GROUP BY project_id, name, COALESCE(version, '')
        HAVING COUNT(*) > 1
    )
    SELECT COUNT(*) INTO v_duplicate_count FROM duplicates;

    SELECT COUNT(*) INTO v_total_bom_count FROM boms;

    RAISE NOTICE '[VALIDATION] Total BOMs: %', v_total_bom_count;
    RAISE NOTICE '[VALIDATION] Projects with duplicate BOMs (same name+version): %', v_duplicate_count;

    IF v_duplicate_count > 0 THEN
        RAISE NOTICE '[WARNING] Found % projects with duplicate BOMs. Details:', v_duplicate_count;

        FOR rec IN (
            SELECT
                p.workspace_id,
                p.name as project_name,
                b.name as bom_name,
                COALESCE(b.version, '(no version)') as bom_version,
                COUNT(*) as duplicate_count,
                STRING_AGG(b.id::TEXT, ', ') as bom_ids
            FROM boms b
            JOIN projects p ON p.id = b.project_id
            GROUP BY p.workspace_id, p.name, b.project_id, b.name, COALESCE(b.version, '')
            HAVING COUNT(*) > 1
            ORDER BY duplicate_count DESC
            LIMIT 10
        ) LOOP
            RAISE NOTICE '  Workspace: %, Project: %, BOM: "%" v%, Count: %, IDs: %',
                rec.workspace_id, rec.project_name, rec.bom_name, rec.bom_version,
                rec.duplicate_count, rec.bom_ids;
        END LOOP;

        RAISE EXCEPTION '[ERROR] Cannot add uniqueness constraint: duplicate BOMs exist. Clean up duplicates first.';
    END IF;

    RAISE NOTICE '[OK] No duplicate BOMs found. Safe to add uniqueness constraint.';
END $$;

-- =====================================================================================
-- MIGRATION: Add uniqueness constraint
-- =====================================================================================

-- OPTION A: Regular index creation (with lock, faster but blocks writes briefly)
-- Use for development or low-traffic periods
BEGIN;

CREATE UNIQUE INDEX idx_boms_unique_per_project
ON boms(project_id, name, COALESCE(version, ''));

COMMIT;

DO $$ BEGIN
    RAISE NOTICE '[MIGRATION] Created unique index idx_boms_unique_per_project on (project_id, name, version)';
END $$;

-- OPTION B: Concurrent index creation (no lock, slower but no downtime)
-- Recommended for production with active traffic
-- Uncomment below and comment out Option A when running in production:
/*
CREATE UNIQUE INDEX CONCURRENTLY idx_boms_unique_per_project
ON boms(project_id, name, COALESCE(version, ''));

DO $$ BEGIN
    RAISE NOTICE '[MIGRATION] Created unique index idx_boms_unique_per_project on (project_id, name, version) CONCURRENTLY';
END $$;
*/

-- =====================================================================================
-- POST-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_index_exists BOOLEAN;
    v_test_project_id UUID;
    v_test_bom_id UUID;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Verify index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'boms'
        AND indexname = 'idx_boms_unique_per_project'
    ) INTO v_index_exists;

    IF v_index_exists THEN
        RAISE NOTICE '[VALIDATION] Unique index idx_boms_unique_per_project exists';
    ELSE
        RAISE EXCEPTION '[ERROR] Unique index was not created successfully';
    END IF;

    -- Test constraint by attempting to insert a duplicate (should fail)
    -- First, get an existing project and BOM
    SELECT project_id, id INTO v_test_project_id, v_test_bom_id
    FROM boms
    LIMIT 1;

    IF v_test_project_id IS NOT NULL THEN
        BEGIN
            -- Try to insert duplicate
            INSERT INTO boms (project_id, name, version, organization_id, created_at, updated_at)
            SELECT project_id, name, version, organization_id, NOW(), NOW()
            FROM boms
            WHERE id = v_test_bom_id;

            RAISE EXCEPTION '[ERROR] Uniqueness constraint did not prevent duplicate insert';
        EXCEPTION
            WHEN unique_violation THEN
                RAISE NOTICE '[VALIDATION] Uniqueness constraint is working (duplicate insert rejected)';
            WHEN OTHERS THEN
                RAISE NOTICE '[VALIDATION] Test insert failed (expected): %', SQLERRM;
        END;
    END IF;

    -- Show statistics
    RAISE NOTICE '[VALIDATION] BOM uniqueness statistics:';
    FOR rec IN (
        SELECT
            COUNT(DISTINCT project_id) as total_projects,
            COUNT(*) as total_boms,
            COUNT(DISTINCT (project_id, name, COALESCE(version, ''))) as unique_bom_definitions,
            COUNT(*) FILTER (WHERE version IS NULL) as boms_without_version,
            COUNT(*) FILTER (WHERE version IS NOT NULL) as boms_with_version
        FROM boms
    ) LOOP
        RAISE NOTICE '  Projects: %, Total BOMs: %, Unique definitions: %',
            rec.total_projects, rec.total_boms, rec.unique_bom_definitions;
        RAISE NOTICE '  BOMs with version: %, without version: %',
            rec.boms_with_version, rec.boms_without_version;
    END LOOP;
END $$;

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Drop unique index
DROP INDEX IF EXISTS idx_boms_unique_per_project;

RAISE NOTICE '[ROLLBACK] Dropped unique index idx_boms_unique_per_project';

COMMIT;
*/

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Check index exists
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'boms'
AND indexname = 'idx_boms_unique_per_project';

-- Verify no duplicates exist
SELECT
    project_id,
    name,
    COALESCE(version, '(no version)') as version,
    COUNT(*) as count
FROM boms
GROUP BY project_id, name, COALESCE(version, '')
HAVING COUNT(*) > 1;

-- Show BOM distribution by project
SELECT
    p.workspace_id,
    p.name as project_name,
    COUNT(b.id) as bom_count,
    COUNT(DISTINCT (b.name, COALESCE(b.version, ''))) as unique_boms
FROM projects p
LEFT JOIN boms b ON b.project_id = p.id
GROUP BY p.workspace_id, p.name
ORDER BY bom_count DESC
LIMIT 20;
