-- =====================================================================================
-- Migration 010: Phase 3.3 - Create organization_id Trigger on BOMs
-- =====================================================================================
-- Purpose: Auto-populate boms.organization_id from project's workspace's organization
--          Maintains backward compatibility with legacy code expecting organization_id
-- Dependencies: Requires 008_phase3_enforce_project_id_not_null.sql
-- Created: 2025-12-14
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_orphaned_projects INTEGER;
    v_total_projects INTEGER;
BEGIN
    -- Check for projects without workspaces (shouldn't exist after Phase 2)
    SELECT COUNT(*) INTO v_orphaned_projects
    FROM projects p
    LEFT JOIN workspaces w ON w.id = p.workspace_id
    WHERE p.workspace_id IS NOT NULL AND w.id IS NULL;

    SELECT COUNT(*) INTO v_total_projects FROM projects;

    RAISE NOTICE '[VALIDATION] Total projects: %', v_total_projects;
    RAISE NOTICE '[VALIDATION] Projects with invalid workspace references: %', v_orphaned_projects;

    IF v_orphaned_projects > 0 THEN
        RAISE EXCEPTION '[ERROR] Found % projects with invalid workspace_id references. Fix data integrity first.', v_orphaned_projects;
    END IF;

    -- Check workspace → organization linkage
    SELECT COUNT(*) INTO v_orphaned_projects
    FROM workspaces w
    LEFT JOIN organizations o ON o.id = w.organization_id
    WHERE w.organization_id IS NOT NULL AND o.id IS NULL;

    RAISE NOTICE '[VALIDATION] Workspaces with invalid organization references: %', v_orphaned_projects;

    IF v_orphaned_projects > 0 THEN
        RAISE EXCEPTION '[ERROR] Found % workspaces with invalid organization_id references. Fix data integrity first.', v_orphaned_projects;
    END IF;

    RAISE NOTICE '[OK] All project → workspace → organization linkages are valid.';
END $$;

-- =====================================================================================
-- MIGRATION: Create trigger function and trigger
-- =====================================================================================

BEGIN;

-- Create trigger function that looks up organization_id via project → workspace → organization
CREATE OR REPLACE FUNCTION set_bom_organization_id()
RETURNS TRIGGER AS $$
DECLARE
    v_organization_id UUID;
BEGIN
    -- Look up organization_id from project's workspace
    SELECT w.organization_id INTO v_organization_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE p.id = NEW.project_id;

    -- Set organization_id if found, otherwise raise exception
    IF v_organization_id IS NOT NULL THEN
        NEW.organization_id := v_organization_id;
    ELSE
        -- Raise exception to prevent NULL organization_id (violates NOT NULL constraint)
        RAISE EXCEPTION '[ERROR] Cannot determine organization_id for BOM "%" with project_id %. Check workspace linkage.',
            NEW.name, NEW.project_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before INSERT or UPDATE
CREATE TRIGGER set_bom_organization_id_trigger
BEFORE INSERT OR UPDATE OF project_id ON boms
FOR EACH ROW
EXECUTE FUNCTION set_bom_organization_id();

COMMIT;

-- Separate DO block for notices (cannot use RAISE NOTICE inside transaction)
DO $$ BEGIN
    RAISE NOTICE '[MIGRATION] Created trigger function set_bom_organization_id()';
    RAISE NOTICE '[MIGRATION] Created trigger set_bom_organization_id_trigger on boms table';
END $$;

-- =====================================================================================
-- POST-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_function_exists BOOLEAN;
    v_test_project_id UUID;
    v_test_workspace_id UUID;
    v_test_org_id UUID;
    v_new_bom_id UUID;
    v_new_bom_org_id UUID;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Verify function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'set_bom_organization_id'
    ) INTO v_function_exists;

    IF v_function_exists THEN
        RAISE NOTICE '[VALIDATION] Trigger function set_bom_organization_id() exists';
    ELSE
        RAISE EXCEPTION '[ERROR] Trigger function was not created successfully';
    END IF;

    -- Verify trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_bom_organization_id_trigger'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE '[VALIDATION] Trigger set_bom_organization_id_trigger exists';
    ELSE
        RAISE EXCEPTION '[ERROR] Trigger was not created successfully';
    END IF;

    -- Test trigger by inserting a BOM and verifying organization_id is set
    -- Get a test project with workspace and organization
    SELECT p.id, p.workspace_id, w.organization_id
    INTO v_test_project_id, v_test_workspace_id, v_test_org_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE w.organization_id IS NOT NULL
    LIMIT 1;

    IF v_test_project_id IS NOT NULL THEN
        -- Insert test BOM
        INSERT INTO boms (project_id, name, version, created_at, updated_at)
        VALUES (
            v_test_project_id,
            '__test_trigger_bom__',
            'trigger-test',
            NOW(),
            NOW()
        )
        RETURNING id, organization_id INTO v_new_bom_id, v_new_bom_org_id;

        IF v_new_bom_org_id = v_test_org_id THEN
            RAISE NOTICE '[VALIDATION] Trigger successfully set organization_id (% = %)',
                v_new_bom_org_id, v_test_org_id;

            -- Clean up test BOM
            DELETE FROM boms WHERE id = v_new_bom_id;
            RAISE NOTICE '[VALIDATION] Cleaned up test BOM';
        ELSE
            RAISE EXCEPTION '[ERROR] Trigger did not set correct organization_id (expected %, got %)',
                v_test_org_id, v_new_bom_org_id;
        END IF;
    ELSE
        RAISE NOTICE '[VALIDATION] No test project available, skipping trigger test';
    END IF;

    -- Show statistics
    RAISE NOTICE '[VALIDATION] Organization ID coverage:';
    FOR rec IN (
        SELECT
            COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as with_org_id,
            COUNT(*) FILTER (WHERE organization_id IS NULL) as without_org_id,
            COUNT(*) as total
        FROM boms
    ) LOOP
        RAISE NOTICE '  BOMs with organization_id: % (%.1f%%)',
            rec.with_org_id,
            (rec.with_org_id::DECIMAL / NULLIF(rec.total, 0) * 100);
        RAISE NOTICE '  BOMs without organization_id: % (%.1f%%)',
            rec.without_org_id,
            (rec.without_org_id::DECIMAL / NULLIF(rec.total, 0) * 100);
    END LOOP;
END $$;

-- =====================================================================================
-- BACKFILL: Update existing BOMs to have correct organization_id
-- =====================================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Update existing BOMs that have project_id but missing organization_id
    -- Note: NOT updating updated_at to preserve audit trail
    WITH updates AS (
        UPDATE boms b
        SET organization_id = w.organization_id
            -- updated_at intentionally NOT updated to preserve original timestamp
        FROM projects p
        JOIN workspaces w ON w.id = p.workspace_id
        WHERE b.project_id = p.id
        AND b.organization_id IS NULL
        RETURNING b.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updates;

    RAISE NOTICE '[BACKFILL] Updated organization_id for % existing BOMs (preserved updated_at timestamps)', v_updated_count;
END $$;

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS set_bom_organization_id_trigger ON boms;

RAISE NOTICE '[ROLLBACK] Dropped trigger set_bom_organization_id_trigger';

-- Drop function
DROP FUNCTION IF EXISTS set_bom_organization_id();

RAISE NOTICE '[ROLLBACK] Dropped function set_bom_organization_id()';

COMMIT;
*/

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Check trigger and function exist
SELECT
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as is_enabled
FROM pg_trigger
WHERE tgname = 'set_bom_organization_id_trigger';

SELECT
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'set_bom_organization_id';

-- Verify organization_id coverage
SELECT
    COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as with_org_id,
    COUNT(*) FILTER (WHERE organization_id IS NULL) as without_org_id,
    COUNT(*) as total
FROM boms;

-- Show BOMs without organization_id (should be rare/none)
SELECT
    b.id,
    b.name,
    b.version,
    b.project_id,
    p.name as project_name,
    p.workspace_id,
    w.organization_id
FROM boms b
LEFT JOIN projects p ON p.id = b.project_id
LEFT JOIN workspaces w ON w.id = p.workspace_id
WHERE b.organization_id IS NULL
LIMIT 10;
