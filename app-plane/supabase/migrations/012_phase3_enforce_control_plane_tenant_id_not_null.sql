-- =====================================================================================
-- Migration 012: Phase 3.5 - Enforce control_plane_tenant_id NOT NULL on Organizations
-- =====================================================================================
-- Purpose: Make organizations.control_plane_tenant_id mandatory after Phase 2.1 backfills it
-- Dependencies: Requires 005_phase2_1_backfill_control_plane_tenant_id.sql to be completed
-- Created: 2025-12-14
-- =====================================================================================

-- =====================================================================================
-- PRE-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_null_count INTEGER;
    v_total_count INTEGER;
    v_active_null_count INTEGER;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Check for any organizations without control_plane_tenant_id
    SELECT COUNT(*) INTO v_null_count
    FROM organizations
    WHERE control_plane_tenant_id IS NULL;

    SELECT COUNT(*) INTO v_total_count FROM organizations;

    RAISE NOTICE '[VALIDATION] Organizations without control_plane_tenant_id: % out of % total',
        v_null_count, v_total_count;

    -- Check for active organizations without control_plane_tenant_id
    SELECT COUNT(*) INTO v_active_null_count
    FROM organizations
    WHERE control_plane_tenant_id IS NULL
    AND subscription_status = 'active';

    RAISE NOTICE '[VALIDATION] Active organizations without control_plane_tenant_id: %',
        v_active_null_count;

    IF v_null_count > 0 THEN
        -- Show details of organizations missing control_plane_tenant_id
        RAISE NOTICE '[WARNING] Organizations missing control_plane_tenant_id:';

        FOR rec IN (
            SELECT
                id,
                name,
                subscription_status,
                created_at
            FROM organizations
            WHERE control_plane_tenant_id IS NULL
            ORDER BY created_at DESC
            LIMIT 10
        ) LOOP
            RAISE NOTICE '  ID: %, Name: "%" (%), Created: %',
                rec.id, rec.name, rec.subscription_status, rec.created_at;
        END LOOP;

        RAISE EXCEPTION '[ERROR] Cannot enforce NOT NULL constraint: % organizations still have NULL control_plane_tenant_id. Run Phase 2.1 migration (005) first.', v_null_count;
    END IF;

    RAISE NOTICE '[OK] All organizations have control_plane_tenant_id populated. Safe to enforce constraint.';
END $$;

-- =====================================================================================
-- MIGRATION: Add NOT NULL constraint to organizations.control_plane_tenant_id
-- =====================================================================================

BEGIN;

-- Add NOT NULL constraint
ALTER TABLE organizations
ALTER COLUMN control_plane_tenant_id SET NOT NULL;

COMMIT;

-- Separate DO block for notice (cannot use RAISE NOTICE inside transaction)
DO $$ BEGIN
    RAISE NOTICE '[MIGRATION] Added NOT NULL constraint to organizations.control_plane_tenant_id';
END $$;

-- =====================================================================================
-- POST-MIGRATION VALIDATION
-- =====================================================================================

DO $$
DECLARE
    v_constraint_exists BOOLEAN;
    v_unique_tenant_count INTEGER;
    v_org_count INTEGER;
    rec RECORD;  -- Explicitly declare record variable
BEGIN
    -- Verify NOT NULL constraint is active
    SELECT
        attnotnull INTO v_constraint_exists
    FROM pg_attribute
    WHERE attrelid = 'organizations'::regclass
    AND attname = 'control_plane_tenant_id';

    IF v_constraint_exists THEN
        RAISE NOTICE '[VALIDATION] NOT NULL constraint on organizations.control_plane_tenant_id is active';
    ELSE
        RAISE EXCEPTION '[ERROR] NOT NULL constraint was not applied successfully';
    END IF;

    -- Verify control_plane_tenant_id distribution
    SELECT
        COUNT(DISTINCT control_plane_tenant_id),
        COUNT(*)
    INTO v_unique_tenant_count, v_org_count
    FROM organizations;

    RAISE NOTICE '[VALIDATION] Organizations: %, Unique control plane tenants: %',
        v_org_count, v_unique_tenant_count;

    -- Validate UUID format for control_plane_tenant_id
    RAISE NOTICE '[VALIDATION] Checking UUID format for control_plane_tenant_id...';
    FOR rec IN (
        SELECT id, name, control_plane_tenant_id
        FROM organizations
        WHERE control_plane_tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) LOOP
        RAISE WARNING '[VALIDATION] Invalid UUID format for organization "%" (%): %',
            rec.name, rec.id, rec.control_plane_tenant_id;
    END LOOP;

    -- Show distribution by subscription_status
    RAISE NOTICE '[VALIDATION] Organization distribution by subscription status:';
    FOR rec IN (
        SELECT
            subscription_status,
            COUNT(*) as org_count,
            COUNT(DISTINCT control_plane_tenant_id) as unique_tenants
        FROM organizations
        GROUP BY subscription_status
        ORDER BY org_count DESC
    ) LOOP
        RAISE NOTICE '  Subscription Status: %, Organizations: %, Unique tenants: %',
            rec.subscription_status, rec.org_count, rec.unique_tenants;
    END LOOP;

    -- Check for duplicate control_plane_tenant_id values (should be rare but possible)
    RAISE NOTICE '[VALIDATION] Organizations sharing control_plane_tenant_id:';
    FOR rec IN (
        SELECT
            control_plane_tenant_id,
            COUNT(*) as org_count,
            STRING_AGG(name, ', ') as org_names
        FROM organizations
        GROUP BY control_plane_tenant_id
        HAVING COUNT(*) > 1
        ORDER BY org_count DESC
        LIMIT 5
    ) LOOP
        RAISE NOTICE '  Tenant ID: %, Organizations: % (%)',
            rec.control_plane_tenant_id, rec.org_count, rec.org_names;
    END LOOP;

    -- Show workspace and project hierarchy
    RAISE NOTICE '[VALIDATION] Organizational hierarchy:';
    FOR rec IN (
        SELECT
            o.id as org_id,
            o.name as org_name,
            o.control_plane_tenant_id,
            COUNT(DISTINCT w.id) as workspace_count,
            COUNT(DISTINCT p.id) as project_count,
            COUNT(DISTINCT b.id) as bom_count
        FROM organizations o
        LEFT JOIN workspaces w ON w.organization_id = o.id
        LEFT JOIN projects p ON p.workspace_id = w.id
        LEFT JOIN boms b ON b.project_id = p.id
        GROUP BY o.id, o.name, o.control_plane_tenant_id
        ORDER BY workspace_count DESC, project_count DESC
        LIMIT 10
    ) LOOP
        RAISE NOTICE '  Org: "%" (%), Tenant: %, Workspaces: %, Projects: %, BOMs: %',
            rec.org_name, rec.org_id, rec.control_plane_tenant_id,
            rec.workspace_count, rec.project_count, rec.bom_count;
    END LOOP;
END $$;

-- =====================================================================================
-- ROLLBACK SCRIPT
-- =====================================================================================
-- To rollback this migration, run:
/*
BEGIN;

-- Remove NOT NULL constraint
ALTER TABLE organizations
ALTER COLUMN control_plane_tenant_id DROP NOT NULL;

RAISE NOTICE '[ROLLBACK] Removed NOT NULL constraint from organizations.control_plane_tenant_id';

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
WHERE attrelid = 'organizations'::regclass
AND attname = 'control_plane_tenant_id';

-- Verify all organizations have control_plane_tenant_id
SELECT
    COUNT(*) FILTER (WHERE control_plane_tenant_id IS NOT NULL) as with_tenant_id,
    COUNT(*) FILTER (WHERE control_plane_tenant_id IS NULL) as without_tenant_id,
    COUNT(*) as total
FROM organizations;

-- Show organizations with their control plane linkage
SELECT
    o.id,
    o.name,
    o.subscription_status,
    o.control_plane_tenant_id,
    COUNT(DISTINCT w.id) as workspace_count,
    COUNT(DISTINCT p.id) as project_count
FROM organizations o
LEFT JOIN workspaces w ON w.organization_id = o.id
LEFT JOIN projects p ON p.workspace_id = w.id
GROUP BY o.id, o.name, o.subscription_status, o.control_plane_tenant_id
ORDER BY workspace_count DESC, project_count DESC
LIMIT 20;

-- Check for organizations sharing the same control_plane_tenant_id
SELECT
    control_plane_tenant_id,
    COUNT(*) as org_count,
    ARRAY_AGG(name ORDER BY name) as org_names,
    ARRAY_AGG(id::TEXT ORDER BY name) as org_ids
FROM organizations
GROUP BY control_plane_tenant_id
HAVING COUNT(*) > 1
ORDER BY org_count DESC;

-- Full hierarchy view: organization → workspace → project → BOM
SELECT
    o.name as organization,
    o.control_plane_tenant_id,
    w.name as workspace,
    p.name as project,
    COUNT(b.id) as bom_count
FROM organizations o
LEFT JOIN workspaces w ON w.organization_id = o.id
LEFT JOIN projects p ON p.workspace_id = w.id
LEFT JOIN boms b ON b.project_id = p.id
GROUP BY o.name, o.control_plane_tenant_id, w.name, p.name
ORDER BY o.name, w.name, p.name
LIMIT 50;
