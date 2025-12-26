-- Add minimal enrichment columns to bom_line_items
-- These columns are actively used by bom_enrichment.py workflow and bom_line_items.py API
-- Date: 2025-11-11

-- Add enrichment tracking columns
ALTER TABLE bom_line_items
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending', 'matched', 'partial', 'failed', 'completed')),
  ADD COLUMN IF NOT EXISTS component_id UUID,
  ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- Create index for enrichment queries
CREATE INDEX IF NOT EXISTS idx_bom_line_items_enrichment_status
  ON bom_line_items(enrichment_status);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id
  ON bom_line_items(component_id);

-- Migrate existing data from match_status to enrichment_status
UPDATE bom_line_items
SET enrichment_status = CASE
    WHEN match_status = 'matched' THEN 'matched'
    WHEN match_status = 'failed' THEN 'failed'
    WHEN match_status IS NULL THEN 'pending'
    ELSE 'pending'
  END
WHERE enrichment_status IS NULL OR enrichment_status = 'pending';

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Added enrichment columns to bom_line_items table';
  RAISE NOTICE 'Columns added: enrichment_status, component_id, enrichment_error';
  RAISE NOTICE 'Indexes created: idx_bom_line_items_enrichment_status, idx_bom_line_items_component_id';
END $$;
