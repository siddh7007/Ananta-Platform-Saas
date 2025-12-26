-- Migration 010: Create Enrichment Queue and History Tables for Directus-native Supplier API Integration
-- Created: 2025-11-01
-- Purpose: Support component enrichment workflow with quality-based routing

-- ============================================================================
-- ENRICHMENT QUEUE TABLE
-- Stores components that need admin review (quality score 70-94%)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id INTEGER NOT NULL REFERENCES catalog_components(id) ON DELETE CASCADE,
  mpn TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  enrichment_data JSONB NOT NULL DEFAULT '{}',
  original_data JSONB,
  issues TEXT[],
  workflow_execution_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES directus_users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,

  -- Indexes for fast lookups
  CONSTRAINT enrichment_queue_component_id_key UNIQUE (component_id),
  CONSTRAINT enrichment_queue_status_check CHECK (status IN ('needs_review', 'approved', 'rejected', 'pending'))
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);

-- Index for quality score range queries
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_quality_score ON enrichment_queue(quality_score);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_created_at ON enrichment_queue(created_at DESC);

-- Index for MPN searches
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_mpn ON enrichment_queue(mpn);

-- Index for JSONB enrichment_data searches
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_enrichment_data ON enrichment_queue USING GIN (enrichment_data);


-- ============================================================================
-- ENRICHMENT HISTORY TABLE
-- Audit log of all enrichment attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_history (
  id SERIAL PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES catalog_components(id) ON DELETE CASCADE,
  mpn TEXT NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  sources_successful TEXT[] DEFAULT '{}',
  enrichment_data JSONB NOT NULL DEFAULT '{}',
  issues TEXT[],
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  triggered_by UUID REFERENCES directus_users(id),
  execution_time_ms INTEGER,

  CONSTRAINT enrichment_history_status_check CHECK (status IN ('completed', 'needs_review', 'rejected', 'error'))
);

-- Index for component_id lookups (history for specific component)
CREATE INDEX IF NOT EXISTS idx_enrichment_history_component_id ON enrichment_history(component_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_enrichment_history_timestamp ON enrichment_history(timestamp DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_enrichment_history_status ON enrichment_history(status);

-- Index for triggered_by (audit trail)
CREATE INDEX IF NOT EXISTS idx_enrichment_history_triggered_by ON enrichment_history(triggered_by);

-- Index for JSONB enrichment_data searches
CREATE INDEX IF NOT EXISTS idx_enrichment_history_enrichment_data ON enrichment_history USING GIN (enrichment_data);


-- ============================================================================
-- UPDATE CATALOG_COMPONENTS TABLE
-- Add enrichment-related fields
-- ============================================================================

-- Add enrichment status field
ALTER TABLE catalog_components
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enrichment_quality_score INTEGER CHECK (enrichment_quality_score >= 0 AND enrichment_quality_score <= 100),
ADD COLUMN IF NOT EXISTS enrichment_sources TEXT[];

-- Index for enrichment status filtering
CREATE INDEX IF NOT EXISTS idx_catalog_components_enrichment_status ON catalog_components(enrichment_status);

-- Index for last enriched date
CREATE INDEX IF NOT EXISTS idx_catalog_components_last_enriched_at ON catalog_components(last_enriched_at DESC);

-- Add constraint check for enrichment_status
ALTER TABLE catalog_components
DROP CONSTRAINT IF EXISTS catalog_components_enrichment_status_check;

ALTER TABLE catalog_components
ADD CONSTRAINT catalog_components_enrichment_status_check
CHECK (enrichment_status IN ('pending', 'enriched', 'needs_review', 'failed'));


-- ============================================================================
-- TRIGGERS
-- Auto-update timestamps and maintain data consistency
-- ============================================================================

-- Update reviewed_at timestamp when reviewed_by is set
CREATE OR REPLACE FUNCTION update_enrichment_queue_reviewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reviewed_by IS NOT NULL AND OLD.reviewed_by IS NULL THEN
    NEW.reviewed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_enrichment_queue_reviewed_at ON enrichment_queue;
CREATE TRIGGER trigger_update_enrichment_queue_reviewed_at
  BEFORE UPDATE ON enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_queue_reviewed_at();


-- Update catalog_components when enrichment is approved
CREATE OR REPLACE FUNCTION apply_approved_enrichment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'needs_review' THEN
    -- Update catalog_components with enriched data
    UPDATE catalog_components
    SET
      datasheet_url = COALESCE((NEW.enrichment_data->>'datasheet_url')::TEXT, datasheet_url),
      image_url = COALESCE((NEW.enrichment_data->>'image_url')::TEXT, image_url),
      description = COALESCE((NEW.enrichment_data->>'description')::TEXT, description),
      lifecycle_status = COALESCE((NEW.enrichment_data->>'lifecycle_status')::TEXT, lifecycle_status),
      package_type = COALESCE((NEW.enrichment_data->>'package_type')::TEXT, package_type),
      rohs_compliant = COALESCE((NEW.enrichment_data->>'rohs_compliant')::BOOLEAN, rohs_compliant),
      reach_compliant = COALESCE((NEW.enrichment_data->>'reach_compliant')::BOOLEAN, reach_compliant),
      lead_time_days = COALESCE((NEW.enrichment_data->>'lead_time_days')::INTEGER, lead_time_days),
      pricing = COALESCE((NEW.enrichment_data->'pricing')::JSONB, pricing),
      stock = COALESCE((NEW.enrichment_data->'stock')::JSONB, stock),
      enrichment_status = 'enriched',
      last_enriched_at = NOW(),
      enrichment_quality_score = NEW.quality_score,
      enrichment_sources = (
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.enrichment_data->'sources_successful'))
      )
    WHERE id = NEW.component_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_approved_enrichment ON enrichment_queue;
CREATE TRIGGER trigger_apply_approved_enrichment
  AFTER UPDATE ON enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION apply_approved_enrichment();


-- ============================================================================
-- VIEWS
-- Convenient views for common queries
-- ============================================================================

-- View: Components needing enrichment
CREATE OR REPLACE VIEW components_needing_enrichment AS
SELECT
  c.id,
  c.mpn,
  c.manufacturer,
  c.enrichment_status,
  c.last_enriched_at,
  c.enrichment_quality_score,
  CASE
    WHEN c.enrichment_status = 'pending' THEN 'Never enriched'
    WHEN c.last_enriched_at < NOW() - INTERVAL '90 days' THEN 'Stale data (>90 days)'
    WHEN c.enrichment_quality_score < 70 THEN 'Low quality score'
    ELSE 'OK'
  END AS reason
FROM catalog_components c
WHERE
  c.enrichment_status IN ('pending', 'failed')
  OR c.last_enriched_at IS NULL
  OR c.last_enriched_at < NOW() - INTERVAL '90 days'
  OR c.enrichment_quality_score < 70
ORDER BY c.last_enriched_at ASC NULLS FIRST;


-- View: Enrichment queue summary
CREATE OR REPLACE VIEW enrichment_queue_summary AS
SELECT
  eq.status,
  COUNT(*) AS count,
  AVG(eq.quality_score) AS avg_quality_score,
  MIN(eq.created_at) AS oldest_entry,
  MAX(eq.created_at) AS newest_entry
FROM enrichment_queue eq
GROUP BY eq.status;


-- View: Enrichment success rate
CREATE OR REPLACE VIEW enrichment_success_rate AS
SELECT
  DATE(eh.timestamp) AS date,
  COUNT(*) FILTER (WHERE eh.status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE eh.status = 'needs_review') AS needs_review,
  COUNT(*) FILTER (WHERE eh.status = 'rejected') AS rejected,
  COUNT(*) FILTER (WHERE eh.status = 'error') AS errors,
  COUNT(*) AS total,
  ROUND(
    (COUNT(*) FILTER (WHERE eh.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS success_rate_percent
FROM enrichment_history eh
WHERE eh.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(eh.timestamp)
ORDER BY date DESC;


-- ============================================================================
-- COMMENTS
-- Documentation for tables and columns
-- ============================================================================

COMMENT ON TABLE enrichment_queue IS 'Staging queue for enriched components requiring admin review (quality score 70-94%)';
COMMENT ON COLUMN enrichment_queue.component_id IS 'Reference to catalog_components.id';
COMMENT ON COLUMN enrichment_queue.quality_score IS 'Data completeness score (0-100%)';
COMMENT ON COLUMN enrichment_queue.enrichment_data IS 'JSON object containing enriched field values';
COMMENT ON COLUMN enrichment_queue.original_data IS 'Snapshot of original component data before enrichment';
COMMENT ON COLUMN enrichment_queue.issues IS 'Array of validation issues or missing fields';
COMMENT ON COLUMN enrichment_queue.status IS 'Review status: needs_review, approved, rejected, pending';

COMMENT ON TABLE enrichment_history IS 'Audit log of all component enrichment attempts';
COMMENT ON COLUMN enrichment_history.sources_successful IS 'Array of successful vendor APIs (mouser, digikey, element14)';
COMMENT ON COLUMN enrichment_history.execution_time_ms IS 'Total execution time in milliseconds';

COMMENT ON VIEW components_needing_enrichment IS 'Lists components that need enrichment or re-enrichment';
COMMENT ON VIEW enrichment_queue_summary IS 'Summary statistics for enrichment queue';
COMMENT ON VIEW enrichment_success_rate IS 'Daily enrichment success rate over last 30 days';


-- ============================================================================
-- GRANT PERMISSIONS
-- Allow Directus to access these tables
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON enrichment_queue TO directus;
GRANT SELECT, INSERT ON enrichment_history TO directus;
GRANT SELECT ON components_needing_enrichment TO directus;
GRANT SELECT ON enrichment_queue_summary TO directus;
GRANT SELECT ON enrichment_success_rate TO directus;

GRANT USAGE, SELECT ON SEQUENCE enrichment_history_id_seq TO directus;


-- ============================================================================
-- INITIAL DATA
-- Sample data for testing (optional)
-- ============================================================================

-- No initial data needed
-- Tables will be populated by the enrich-component operation


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrichment_queue') THEN
    RAISE EXCEPTION 'Migration failed: enrichment_queue table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrichment_history') THEN
    RAISE EXCEPTION 'Migration failed: enrichment_history table not created';
  END IF;

  RAISE NOTICE 'Migration 010 completed successfully';
END $$;
