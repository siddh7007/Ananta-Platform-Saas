-- ============================================================================
-- Migration: 003_phase2_backfill_control_plane_tenant_id.sql
-- Phase: 2.1
-- Description: Backfill organizations.control_plane_tenant_id from Control Plane
-- Dependencies: 102_phase1_add_control_plane_tenant_id.sql (column must exist)
-- Status: READY - Mapping data discovered via database queries
-- ============================================================================

-- This migration maps App Plane organizations to Control Plane tenants
-- Mapping was discovered by querying both databases on 2025-12-14

-- ============================================================================
-- DISCOVERED MAPPINGS:
-- ============================================================================
-- App Plane Org: a1111111-1111-1111-1111-111111111111 "Ananta Platform" (slug: ananta)
--   → Control Plane: 468224c2-82a0-6286-57e7-eff8da9982f2 "Ananta" (key: ananta)
--   Match Method: slug/key exact match
--
-- App Plane Org: a0000000-0000-0000-0000-000000000000 "Platform Super Admin" (slug: platform-super-admin)
--   → Control Plane: a0000000-0000-0000-0000-000000000000 "Platform Super Admin" (key: platform)
--   Match Method: UUID match + name match (special case - same UUID used in both systems)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create temporary mapping table
-- ============================================================================

CREATE TEMP TABLE temp_tenant_mapping (
    app_org_id UUID NOT NULL,
    app_org_name TEXT NOT NULL,
    app_org_slug TEXT NOT NULL,
    control_plane_tenant_id UUID NOT NULL,
    control_plane_tenant_name TEXT NOT NULL,
    control_plane_tenant_key TEXT NOT NULL,
    mapping_method TEXT NOT NULL,  -- 'uuid_match', 'slug_key_match', 'manual'
    verified BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- STEP 2: Insert discovered mapping data
-- ============================================================================

INSERT INTO temp_tenant_mapping VALUES
    -- Ananta Platform organization → Ananta tenant
    (
        'a1111111-1111-1111-1111-111111111111',  -- app_org_id
        'Ananta Platform',                        -- app_org_name
        'ananta',                                 -- app_org_slug
        '468224c2-82a0-6286-57e7-eff8da9982f2',  -- control_plane_tenant_id
        'Ananta',                                 -- control_plane_tenant_name
        'ananta',                                 -- control_plane_tenant_key
        'slug_key_match',                         -- mapping_method
        TRUE                                      -- verified
    ),
    -- Platform Super Admin organization → Platform Super Admin tenant
    (
        'a0000000-0000-0000-0000-000000000000',  -- app_org_id
        'Platform Super Admin',                   -- app_org_name
        'platform-super-admin',                   -- app_org_slug
        'a0000000-0000-0000-0000-000000000000',  -- control_plane_tenant_id
        'Platform Super Admin',                   -- control_plane_tenant_name
        'platform',                               -- control_plane_tenant_key
        'uuid_match',                             -- mapping_method (special case - same UUID)
        TRUE                                      -- verified
    );

-- ============================================================================
-- STEP 3: Validation checks
-- ============================================================================

DO $$
DECLARE
    v_unmapped_orgs INTEGER;
    v_duplicate_mappings INTEGER;
    v_unverified_mappings INTEGER;
    v_total_orgs INTEGER;
    v_total_mappings INTEGER;
    v_org RECORD;
BEGIN
    -- Get total organization count
    SELECT COUNT(*) INTO v_total_orgs FROM organizations;
    SELECT COUNT(*) INTO v_total_mappings FROM temp_tenant_mapping;

    RAISE NOTICE '[VALIDATION] Total organizations in App Plane: %', v_total_orgs;
    RAISE NOTICE '[VALIDATION] Total mappings in temp table: %', v_total_mappings;

    -- Check for unmapped active organizations
    SELECT COUNT(*) INTO v_unmapped_orgs
    FROM organizations o
    LEFT JOIN temp_tenant_mapping tm ON o.id = tm.app_org_id
    WHERE tm.app_org_id IS NULL
    AND o.subscription_status IN ('active', 'trialing');

    IF v_unmapped_orgs > 0 THEN
        RAISE WARNING '[VALIDATION] % active organizations have no mapping in temp_tenant_mapping', v_unmapped_orgs;

        -- List unmapped organizations
        FOR v_org IN (
            SELECT id, name, slug, subscription_status
            FROM organizations o
            LEFT JOIN temp_tenant_mapping tm ON o.id = tm.app_org_id
            WHERE tm.app_org_id IS NULL
            AND o.subscription_status IN ('active', 'trialing')
        ) LOOP
            RAISE WARNING '[UNMAPPED] Org: % (%) - slug: % - status: %',
                v_org.name, v_org.id, v_org.slug, v_org.subscription_status;
        END LOOP;
    ELSE
        RAISE NOTICE '[VALIDATION] ✓ All active organizations have mappings';
    END IF;

    -- Check for duplicate mappings (same org mapped to multiple tenants)
    SELECT COUNT(DISTINCT app_org_id) INTO v_duplicate_mappings
    FROM temp_tenant_mapping
    GROUP BY app_org_id
    HAVING COUNT(*) > 1;

    IF v_duplicate_mappings > 0 THEN
        RAISE EXCEPTION '[ERROR] Duplicate mappings detected. Each organization must map to exactly one tenant.';
    ELSE
        RAISE NOTICE '[VALIDATION] ✓ No duplicate mappings';
    END IF;

    -- Check for unverified mappings
    SELECT COUNT(*) INTO v_unverified_mappings
    FROM temp_tenant_mapping
    WHERE verified = FALSE;

    IF v_unverified_mappings > 0 THEN
        RAISE WARNING '[VALIDATION] % unverified mappings. Set verified=TRUE after manual review.', v_unverified_mappings;
        RAISE EXCEPTION '[ERROR] All mappings must be verified before backfill. Review and update temp_tenant_mapping.';
    ELSE
        RAISE NOTICE '[VALIDATION] ✓ All mappings verified';
    END IF;

    RAISE NOTICE '[VALIDATION] All validation checks passed. Proceeding with backfill.';
END $$;

-- ============================================================================
-- STEP 4: Backfill organizations.control_plane_tenant_id
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
    v_org_record RECORD;
BEGIN
    RAISE NOTICE '[MIGRATION] Starting backfill of control_plane_tenant_id...';

    -- Update organizations with mapped tenant IDs
    UPDATE organizations o
    SET control_plane_tenant_id = tm.control_plane_tenant_id
        -- updated_at intentionally NOT updated to preserve audit trail
    FROM temp_tenant_mapping tm
    WHERE o.id = tm.app_org_id
    AND o.control_plane_tenant_id IS NULL;  -- Only update if currently NULL

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '[MIGRATION] Updated % organizations with Control Plane tenant IDs', v_updated_count;

    -- Log mapping details for audit trail
    FOR v_org_record IN (
        SELECT
            o.id AS org_id,
            o.name AS org_name,
            o.slug AS org_slug,
            o.control_plane_tenant_id,
            tm.control_plane_tenant_name,
            tm.control_plane_tenant_key,
            tm.mapping_method
        FROM organizations o
        JOIN temp_tenant_mapping tm ON o.id = tm.app_org_id
        ORDER BY o.created_at
    ) LOOP
        RAISE NOTICE '[MAPPING] ✓ Org "%" (%, slug: %) → Tenant "%" (%, key: %) via %',
            v_org_record.org_name,
            v_org_record.org_id,
            v_org_record.org_slug,
            v_org_record.control_plane_tenant_name,
            v_org_record.control_plane_tenant_id,
            v_org_record.control_plane_tenant_key,
            v_org_record.mapping_method;
    END LOOP;

    RAISE NOTICE '[MIGRATION] Backfill completed successfully.';
END $$;

-- ============================================================================
-- STEP 5: Post-migration validation
-- ============================================================================

DO $$
DECLARE
    v_null_active_orgs INTEGER;
    v_total_mapped INTEGER;
    v_total_orgs INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '[POST-VALIDATION] Running post-migration checks...';

    -- Check for active organizations still missing tenant IDs
    SELECT COUNT(*) INTO v_null_active_orgs
    FROM organizations
    WHERE control_plane_tenant_id IS NULL
    AND subscription_status IN ('active', 'trialing');

    IF v_null_active_orgs > 0 THEN
        RAISE WARNING '[POST-VALIDATION] % active organizations still have NULL control_plane_tenant_id', v_null_active_orgs;

        -- List them
        FOR rec IN (
            SELECT id, name, slug, subscription_status
            FROM organizations
            WHERE control_plane_tenant_id IS NULL
            AND subscription_status IN ('active', 'trialing')
        ) LOOP
            RAISE WARNING '[UNMAPPED] "%" (%, slug: %) - status: %',
                rec.name, rec.id, rec.slug, rec.subscription_status;
        END LOOP;
    ELSE
        RAISE NOTICE '[POST-VALIDATION] ✓ All active organizations have control_plane_tenant_id';
    END IF;

    -- Count successfully mapped organizations
    SELECT COUNT(*) INTO v_total_mapped
    FROM organizations
    WHERE control_plane_tenant_id IS NOT NULL;

    SELECT COUNT(*) INTO v_total_orgs
    FROM organizations;

    RAISE NOTICE '[POST-VALIDATION] ✓ Total organizations mapped: % / %', v_total_mapped, v_total_orgs;

    -- Verify UUID format for all mapped tenant IDs
    FOR rec IN (
        SELECT id, name, control_plane_tenant_id
        FROM organizations
        WHERE control_plane_tenant_id IS NOT NULL
        AND control_plane_tenant_id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) LOOP
        RAISE WARNING '[POST-VALIDATION] Invalid UUID format for "%" (%): %',
            rec.name, rec.id, rec.control_plane_tenant_id;
    END LOOP;

    -- Display final mapping summary
    RAISE NOTICE '[POST-VALIDATION] === FINAL MAPPING SUMMARY ===';
    FOR rec IN (
        SELECT
            name,
            slug,
            control_plane_tenant_id,
            subscription_status
        FROM organizations
        WHERE control_plane_tenant_id IS NOT NULL
        ORDER BY created_at
    ) LOOP
        RAISE NOTICE '[MAPPED] % (slug: %) → % [status: %]',
            rec.name, rec.slug, rec.control_plane_tenant_id, rec.subscription_status;
    END LOOP;

    RAISE NOTICE '[POST-VALIDATION] ✓ Migration 003 completed successfully';
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (Execute if migration needs to be reversed)
-- ============================================================================

-- CAUTION: This will reset control_plane_tenant_id to NULL. Mapping data will be lost.
-- Only execute if you need to re-run the migration with different mappings.

-- Rollback command (commented for safety):
-- UPDATE organizations SET control_plane_tenant_id = NULL
-- WHERE control_plane_tenant_id IN (
--     '468224c2-82a0-6286-57e7-eff8da9982f2',
--     'a0000000-0000-0000-0000-000000000000'
-- );

-- Verification after rollback:
-- SELECT COUNT(*) FROM organizations WHERE control_plane_tenant_id IS NOT NULL;
-- Expected: 0 rows

-- ============================================================================
-- MANUAL EXECUTION GUIDE
-- ============================================================================

/*
AUTOMATED EXECUTION (Recommended):

This migration is ready to run automatically with discovered mappings.

1. Execute migration:
   docker exec -i app-plane-supabase-db psql -U postgres -d postgres < app-plane/supabase/migrations/003_phase2_backfill_control_plane_tenant_id.sql

2. Verify results:
   docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
   SELECT
       o.id,
       o.name,
       o.slug,
       o.control_plane_tenant_id,
       o.subscription_status
   FROM organizations o
   ORDER BY o.created_at;"

3. Expected output:
   - "Ananta Platform" org should have control_plane_tenant_id: 468224c2-82a0-6286-57e7-eff8da9982f2
   - "Platform Super Admin" org should have control_plane_tenant_id: a0000000-0000-0000-0000-000000000000

---

MANUAL MAPPING UPDATE (If mappings change in the future):

1. Query App Plane organizations:
   docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "
   SELECT id, name, slug, subscription_status, created_at
   FROM organizations
   ORDER BY created_at;"

2. Query Control Plane tenants:
   docker exec -e PGPASSWORD=postgres arc-saas-postgres psql -U postgres -d arc_saas -c "
   SELECT id, key, name, status, created_on
   FROM main.tenants
   ORDER BY created_on;"

3. Edit STEP 2 of this file to update the INSERT statement with new mappings

4. Re-run the migration (after rollback if needed)

---

TROUBLESHOOTING:

Q: "Duplicate mappings detected"
A: Check temp_tenant_mapping for duplicate app_org_id entries. Each org can only map to one tenant.

Q: "All mappings must be verified"
A: Set verified=TRUE for each mapping in STEP 2 after manual review.

Q: "X active organizations have no mapping"
A: Add missing organizations to the INSERT statement in STEP 2, or update their subscription_status.

Q: "Invalid UUID format"
A: Verify all UUIDs are valid v4 format (lowercase, with hyphens).

Q: Migration fails with "column control_plane_tenant_id does not exist"
A: Run migration 102_phase1_add_control_plane_tenant_id.sql first.

---

MAPPING DISCOVERY METHODOLOGY:

The mappings in this file were discovered on 2025-12-14 by:
1. Querying App Plane organizations table (app-plane-supabase-db)
2. Querying Control Plane tenants table (arc-saas-postgres, main schema)
3. Matching by:
   - UUID identity (special case for Platform Super Admin)
   - Slug/key exact match (Ananta Platform org slug "ananta" → tenant key "ananta")

Future mappings should follow similar matching strategies:
- Prioritize UUID matches (if orgs were created with matching UUIDs)
- Use slug/key matches for semantic equivalence
- Verify name similarity as sanity check
- Always set verified=TRUE only after manual review
*/
