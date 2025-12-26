-- Migration: Clean Up BOM Line Items Schema
-- Date: 2025-11-12
-- Purpose: Remove columns that duplicate Django catalog data, add user notes
--
-- Architecture:
-- - Supabase stores: Customer's uploaded BOM data + enrichment metadata
-- - Django stores: Component catalog data (pricing, lifecycle, risk, etc.)
-- - Component attributes fetched via component_id FK from Django API

-- ============================================================================
-- 1. Remove columns that duplicate Django catalog data
-- ============================================================================

-- These should come from Django catalog via component_id FK:
-- - unit_price: Fetched from Django vendor_pricing table
-- - extended_price: Calculated (quantity × unit_price from Django)
-- - currency: Comes from Django vendor_pricing

ALTER TABLE bom_line_items
  DROP COLUMN IF EXISTS unit_price,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS extended_price;

-- ============================================================================
-- 2. Ensure BOM-specific risk_level column exists
-- ============================================================================

-- risk_level is BOM-specific (NOT component-level):
-- - Component has inherent risk (lifecycle, compliance) in Django
-- - BOM line item has contextual risk (quantity vs stock, lead time, criticality for this project)
ALTER TABLE bom_line_items
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED'));

COMMENT ON COLUMN bom_line_items.risk_level IS 'BOM-specific risk: calculated from component inherent risk + BOM context (quantity vs availability, lead time, criticality)';

-- ============================================================================
-- 3. Add user notes column
-- ============================================================================

-- User-specific notes for this BOM line item (customer-specific data)
ALTER TABLE bom_line_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN bom_line_items.notes IS 'User-specific notes for this BOM line item';

-- ============================================================================
-- 4. Update trigger function (remove extended_price calculation)
-- ============================================================================

-- The update_bom_statistics trigger was trying to SUM(extended_price)
-- We need to remove that since extended_price no longer exists

CREATE OR REPLACE FUNCTION update_bom_statistics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE boms
  SET
    component_count = (
      SELECT COUNT(*) FROM bom_line_items WHERE bom_id = NEW.bom_id
    ),
    -- Note: total_cost will now be calculated client-side or via Django API
    -- high_risk_count will be calculated via Django component_risk_scores
    updated_at = NOW()
  WHERE id = NEW.bom_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_bom_statistics IS 'Update BOM statistics (component count only - pricing/risk calculated via Django API)';

-- ============================================================================
-- 5. Final Schema Documentation
-- ============================================================================

COMMENT ON TABLE bom_line_items IS 'Customer BOM line items - stores uploaded data + enrichment metadata. Component attributes (pricing, lifecycle, risk) fetched from Django catalog via component_id FK.';

-- Column comments
COMMENT ON COLUMN bom_line_items.reference_designator IS 'Board location from customer upload (e.g., R1, C5, U3)';
COMMENT ON COLUMN bom_line_items.manufacturer_part_number IS 'Part number from customer upload';
COMMENT ON COLUMN bom_line_items.manufacturer IS 'Manufacturer name from customer upload';
COMMENT ON COLUMN bom_line_items.quantity IS 'Quantity needed (customer-specific)';
COMMENT ON COLUMN bom_line_items.description IS 'Description from customer upload';
COMMENT ON COLUMN bom_line_items.component_id IS 'FK to Django components catalog (NULL until enriched)';
COMMENT ON COLUMN bom_line_items.match_status IS 'How part was matched: exact, fuzzy, manual, or unmatched';
COMMENT ON COLUMN bom_line_items.enrichment_status IS 'Enrichment workflow status: pending, matched, partial, failed, completed';
COMMENT ON COLUMN bom_line_items.metadata IS 'JSONB - Raw upload data + custom fields (5 custom columns)';

-- ============================================================================
-- 6. Verify final schema
-- ============================================================================

-- Final columns (customer BOM data):
-- ✅ reference_designator - Board location
-- ✅ manufacturer_part_number - Customer's part number
-- ✅ manufacturer - Manufacturer name
-- ✅ quantity - Quantity needed
-- ✅ description - Customer's description
-- ✅ notes - User notes (NEW)
-- ✅ metadata - JSONB (raw data + 5 custom fields)
--
-- Final columns (enrichment):
-- ✅ component_id - FK to Django catalog
-- ✅ match_status - How it was matched
-- ✅ enrichment_status - Workflow status
-- ✅ enrichment_error - Error message if failed
--
-- Final columns (BOM-specific calculations):
-- ✅ risk_level - BOM-specific risk (GREEN/YELLOW/ORANGE/RED)
--
-- Final columns (system):
-- ✅ id, bom_id, line_number, created_at, updated_at
