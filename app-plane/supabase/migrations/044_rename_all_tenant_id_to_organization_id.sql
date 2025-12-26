-- Migration: Rename ALL tenant_id columns to organization_id
-- Created: 2025-11-19
-- Purpose: Complete the tenant_id → organization_id migration across entire database
--          This ensures 100% consistency with organization_id naming convention

-- ============================================================================
-- STEP 1: Rename tenant_id columns in all tables
-- ============================================================================

-- alerts table
ALTER TABLE public.alerts RENAME COLUMN tenant_id TO organization_id;

-- boms table
ALTER TABLE public.boms RENAME COLUMN tenant_id TO organization_id;

-- components table
ALTER TABLE public.components RENAME COLUMN tenant_id TO organization_id;

-- bom_uploads table - Special case: has BOTH tenant_id and organization_id
-- Keep organization_id, drop the duplicate tenant_id
ALTER TABLE public.bom_uploads DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- STEP 2: Verify migration success
-- ============================================================================

DO $$
DECLARE
  tenant_id_count INT;
  org_id_count INT;
BEGIN
  -- Check that NO tenant_id columns remain
  SELECT COUNT(*) INTO tenant_id_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'tenant_id';

  IF tenant_id_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % tenant_id columns still exist', tenant_id_count;
  END IF;

  -- Verify organization_id exists in expected tables
  SELECT COUNT(*) INTO org_id_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'organization_id'
    AND table_name IN ('alerts', 'boms', 'components', 'bom_uploads', 'users', 'projects', 'bom_jobs', 'enrichment_events', 'organization_memberships');

  -- Should have 9 tables with organization_id
  IF org_id_count < 9 THEN
    RAISE WARNING 'Expected 9+ tables with organization_id, found %', org_id_count;
  END IF;

  RAISE NOTICE '✓ All tenant_id columns renamed to organization_id';
  RAISE NOTICE '✓ Found organization_id in % tables', org_id_count;
END $$;

-- ============================================================================
-- STEP 3: Success summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Migration 044 Complete: tenant_id → organization_id';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Tables updated:';
  RAISE NOTICE '  - alerts.tenant_id → alerts.organization_id';
  RAISE NOTICE '  - boms.tenant_id → boms.organization_id';
  RAISE NOTICE '  - components.tenant_id → components.organization_id';
  RAISE NOTICE '  - bom_uploads: Dropped duplicate tenant_id column';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables now use organization_id consistently!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
