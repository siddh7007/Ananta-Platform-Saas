-- Migration: Add component_id to bom_line_items for Component Vault linking
-- Created: 2025-11-24
-- Purpose: Link BOM line items to enriched components in the Component Vault (component_catalog table)
--
-- This enables:
-- 1. Syncing component IDs between Supabase BOMs and PostgreSQL Component Vault
-- 2. Tracking which catalog components are used in customer BOMs
-- 3. Enabling component reuse across multiple BOMs
-- 4. Supporting component-level analytics and lifecycle tracking

-- ============================================================================
-- Add component_id column to bom_line_items
-- ============================================================================

-- Add the column (nullable to allow existing rows)
ALTER TABLE public.bom_line_items
ADD COLUMN IF NOT EXISTS component_id UUID;

-- Add index for performance (will be used in joins and lookups)
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id
ON public.bom_line_items(component_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.bom_line_items.component_id IS
'Foreign key to component_catalog.id in PostgreSQL Component Vault.
Links this BOM line item to a high-quality enriched component (quality >= 80%).
NULL if component not yet enriched or quality < 80% (stored in Redis cache).';

-- ============================================================================
-- Note: No foreign key constraint added
-- ============================================================================
-- We do NOT add a foreign key constraint because:
-- 1. component_catalog table is in a different database (PostgreSQL components_v2)
-- 2. Supabase cannot enforce foreign keys across databases
-- 3. Application logic handles referential integrity via enrichment workflow
-- 4. component_id is used for display/linking purposes only in customer portal
