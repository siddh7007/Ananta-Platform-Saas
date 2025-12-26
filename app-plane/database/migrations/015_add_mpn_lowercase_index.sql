-- Migration: Add expression index for case-insensitive MPN lookups
-- Date: 2025-12-22
-- Purpose: Optimize LOWER(manufacturer_part_number) queries in component_catalog
--
-- PROBLEM:
-- The current query `WHERE LOWER(manufacturer_part_number) = LOWER(:mpn)` causes
-- full table scans because PostgreSQL cannot use the existing btree index on
-- manufacturer_part_number when a function is applied.
--
-- SOLUTION:
-- Create an expression index on LOWER(manufacturer_part_number) so PostgreSQL
-- can use index scans for case-insensitive MPN lookups.
--
-- PERFORMANCE IMPACT:
-- - Before: Full table scan O(n) for each MPN lookup
-- - After: Index scan O(log n) for each MPN lookup
--
-- Apply to: components_v2 database (port 27010)

-- Create expression index for case-insensitive MPN lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_component_catalog_mpn_lower
ON public.component_catalog (LOWER(manufacturer_part_number));

-- Also create a combined expression index for MPN + manufacturer lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_component_catalog_mpn_mfr_lower
ON public.component_catalog (LOWER(manufacturer_part_number), LOWER(manufacturer));

-- Add comment explaining the index purpose
COMMENT ON INDEX public.idx_component_catalog_mpn_lower IS
'Expression index for case-insensitive MPN lookups. Enables index scans for queries like: WHERE LOWER(manufacturer_part_number) = LOWER(:mpn)';

COMMENT ON INDEX public.idx_component_catalog_mpn_mfr_lower IS
'Expression index for case-insensitive MPN + manufacturer lookups. Enables index scans for queries like: WHERE LOWER(manufacturer_part_number) = LOWER(:mpn) AND LOWER(manufacturer) = LOWER(:mfr)';
