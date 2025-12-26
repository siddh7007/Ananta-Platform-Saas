-- Add component storage tracking to bom_line_items
-- Tracks whether component data is stored in database or Redis
-- Date: 2025-11-12

-- Add storage tracking columns
ALTER TABLE bom_line_items
  ADD COLUMN IF NOT EXISTS component_storage TEXT
    DEFAULT 'database'
    CHECK (component_storage IN ('database', 'redis')),
  ADD COLUMN IF NOT EXISTS redis_component_key TEXT;

-- Add index for Redis key lookups
CREATE INDEX IF NOT EXISTS idx_bom_line_items_redis_key
  ON bom_line_items(redis_component_key) WHERE redis_component_key IS NOT NULL;

-- Add index for storage type filtering
CREATE INDEX IF NOT EXISTS idx_bom_line_items_storage_type
  ON bom_line_items(component_storage);

-- Add comment
COMMENT ON COLUMN bom_line_items.component_storage IS
  'Storage location for component data: database (Components V2) or redis (temporary)';

COMMENT ON COLUMN bom_line_items.redis_component_key IS
  'Redis key for low-quality components stored temporarily for re-enrichment';

-- Migrate existing data (all existing components are in database)
UPDATE bom_line_items
SET component_storage = 'database'
WHERE component_id IS NOT NULL
  AND component_storage IS NULL;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Added component storage tracking to bom_line_items table';
  RAISE NOTICE 'Columns added: component_storage (database|redis), redis_component_key';
  RAISE NOTICE 'Indexes created: idx_bom_line_items_redis_key, idx_bom_line_items_storage_type';
  RAISE NOTICE 'Existing components marked as stored in database';
END $$;
