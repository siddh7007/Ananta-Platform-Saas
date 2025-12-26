-- Migration: Central Component Catalog Architecture
-- Date: 2025-11-06
-- Purpose: Convert from duplicated component data to central catalog with BOM links
--
-- Changes:
-- 1. Add component_id foreign key to bom_line_items_v2 (links to central Components V2 DB)
-- 2. Keep components_v2 table for backward compatibility (will be deprecated)
-- 3. Add indexes for performance

-- ============================================================================
-- SUPABASE DATABASE CHANGES
-- ============================================================================

-- Step 1: Add component_id column to bom_line_items_v2
-- This will link BOM line items to central component catalog (in Components V2 DB)
ALTER TABLE bom_line_items_v2
ADD COLUMN IF NOT EXISTS component_id uuid;

-- Step 2: Add index for component_id lookup (performance)
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id
ON bom_line_items_v2(component_id);

-- Step 3: Add index for MPN lookup (used for matching during BOM upload)
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn
ON bom_line_items_v2(manufacturer_part_number);

-- Step 4: Add composite index for BOM + component lookups
CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_component
ON bom_line_items_v2(bom_id, component_id);

-- Step 5: Add enrichment status tracking
ALTER TABLE bom_line_items_v2
ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';

ALTER TABLE bom_line_items_v2
ADD COLUMN IF NOT EXISTS enrichment_error text;

-- Step 6: Add comment explaining the new architecture
COMMENT ON COLUMN bom_line_items_v2.component_id IS
'Links to central component catalog in Components V2 database. NULL means enrichment pending or failed.';

COMMENT ON COLUMN bom_line_items_v2.enrichment_status IS
'Status of component enrichment: pending, in_progress, completed, failed';

-- Step 7: Update existing BOMs table to track enrichment progress
ALTER TABLE boms_v2
ADD COLUMN IF NOT EXISTS enrichment_progress jsonb DEFAULT '{
  "total_items": 0,
  "enriched_items": 0,
  "failed_items": 0,
  "pending_items": 0,
  "last_updated": null
}'::jsonb;

-- Step 8: Add index for enrichment status filtering
CREATE INDEX IF NOT EXISTS idx_bom_line_items_enrichment_status
ON bom_line_items_v2(enrichment_status);

-- ============================================================================
-- BACKWARD COMPATIBILITY
-- ============================================================================

-- Keep components_v2 table for now (will be deprecated in future migration)
-- Legacy code can still read from this table
-- New code should use component_id to fetch from central catalog

COMMENT ON TABLE components_v2 IS
'DEPRECATED: This table stores duplicated component data per tenant.
New architecture uses central component catalog in Components V2 database.
BOM line items link via component_id foreign key.
This table will be removed in future migration after all data is migrated.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- IMPORTANT: This migration only modifies the Supabase schema.
-- The Components V2 database migration is in separate file:
--   components-v2/migrations/001_component_catalog.sql
--
-- Migration order:
-- 1. Run Components V2 migration FIRST (create central catalog)
-- 2. Run this Supabase migration SECOND (add links to central catalog)
-- 3. Update CNS API to use new architecture
-- 4. Migrate existing data (separate script)
-- 5. Update Customer Portal to use new data flow
--
-- Rollback:
-- - component_id column can be NULL (backward compatible)
-- - Legacy components_v2 table still exists
-- - No data loss if rollback needed
