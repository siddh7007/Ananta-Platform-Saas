-- Migration: Phase 1, Step 1.1 - Add control_plane_tenant_id to organizations table
-- Purpose: Link App Plane organizations to Control Plane tenants for unified billing/subscription
-- Date: 2025-12-14
-- Related: Platform Integration Plan - Phase 1 (Backlink Organizations)

-- ============================================================================
-- PHASE 1, STEP 1.1: Add control_plane_tenant_id column
-- ============================================================================

-- Add nullable UUID column to link to Control Plane tenant
-- This will be populated in Step 1.2 via API backfill
-- Will be enforced as NOT NULL in Phase 3 after migration is complete

ALTER TABLE organizations
ADD COLUMN control_plane_tenant_id UUID NULL;

-- Add comment explaining the foreign key relationship (logical, not enforced)
COMMENT ON COLUMN organizations.control_plane_tenant_id IS
  'Links to Control Plane tenant UUID (arc_saas.tenants.id).
   Populated via backfill in Phase 1. Will be NOT NULL in Phase 3.
   This enables unified billing, subscription, and user management.';

-- Add index for lookups from Control Plane tenant ID to App Plane organization
CREATE INDEX idx_organizations_control_plane_tenant_id
  ON organizations(control_plane_tenant_id);

COMMENT ON INDEX idx_organizations_control_plane_tenant_id IS
  'Enables efficient lookups when Control Plane queries App Plane org by tenant ID';

-- ============================================================================
-- ROLLBACK SCRIPT (Execute if migration needs to be reversed)
-- ============================================================================

-- CAUTION: This will drop the column and all data in it. Ensure backfill can be re-run.
-- Execute in reverse order of creation:

-- DROP INDEX IF EXISTS idx_organizations_control_plane_tenant_id;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS control_plane_tenant_id;

-- Verification after rollback:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'organizations' AND column_name = 'control_plane_tenant_id';
-- Expected: 0 rows (column removed)

-- ============================================================================
-- VALIDATION QUERIES (Run after applying migration)
-- ============================================================================

-- Verify column was added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'organizations'
--   AND column_name = 'control_plane_tenant_id';

-- Expected output:
-- column_name                 | data_type | is_nullable | column_default
-- ----------------------------+-----------+-------------+---------------
-- control_plane_tenant_id     | uuid      | YES         | NULL

-- Verify index was created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'organizations'
--   AND indexname = 'idx_organizations_control_plane_tenant_id';

-- Check current organizations (should have NULL values initially)
-- SELECT id, name, slug, control_plane_tenant_id
-- FROM organizations
-- ORDER BY created_at;

-- Expected: 2 rows with NULL control_plane_tenant_id (Acme Corp, Platform Staff Org)
