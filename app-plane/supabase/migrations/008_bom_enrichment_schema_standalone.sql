-- BOM Enrichment Schema (Standalone Postgres version without Supabase Auth)
-- Adds columns and tables for automated BOM enrichment via Temporal workflows
-- Created: 2025-11-01

-- =====================================================
-- UPDATE BOMS TABLE FOR ENRICHMENT
-- =====================================================

-- Add enrichment-specific columns to boms table
ALTER TABLE boms
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'queued', 'processing', 'enriched', 'failed', 'requires_approval')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_priority INTEGER CHECK (enrichment_priority >= 1 AND enrichment_priority <= 10) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS enrichment_quality_score INTEGER CHECK (enrichment_quality_score >= 0 AND enrichment_quality_score <= 100),
  ADD COLUMN IF NOT EXISTS enrichment_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_error TEXT,
  ADD COLUMN IF NOT EXISTS temporal_workflow_id TEXT,
  ADD COLUMN IF NOT EXISTS temporal_run_id TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_match_rate DECIMAL(5, 2), -- Percentage of matched components (0-100)
  ADD COLUMN IF NOT EXISTS enrichment_avg_confidence DECIMAL(5, 2); -- Average confidence score (0-100)

-- Add index for enrichment queries
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_status ON boms(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_priority ON boms(enrichment_priority DESC);
CREATE INDEX IF NOT EXISTS idx_boms_temporal_workflow ON boms(temporal_workflow_id);

-- =====================================================
-- UPDATE BOM LINE ITEMS TABLE FOR ENRICHMENT
-- =====================================================

-- Rename and add columns to bom_line_items for enrichment tracking
ALTER TABLE bom_line_items
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'matched', 'enriched', 'no_match', 'error')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enriched_mpn TEXT, -- Normalized MPN from central catalog
  ADD COLUMN IF NOT EXISTS enriched_manufacturer TEXT, -- Normalized manufacturer from central catalog
  ADD COLUMN IF NOT EXISTS component_id INTEGER, -- Central catalog component ID
  ADD COLUMN IF NOT EXISTS specifications JSONB, -- Component specifications
  ADD COLUMN IF NOT EXISTS datasheet_url TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS estimated_lifetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_status JSONB, -- {reach: boolean, rohs: boolean}
  ADD COLUMN IF NOT EXISTS pricing JSONB, -- Array of pricing objects
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Add index for enrichment queries
CREATE INDEX IF NOT EXISTS idx_bom_line_items_enrichment_status ON bom_line_items(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id ON bom_line_items(component_id);

-- =====================================================
-- ENRICHMENT QUEUE TABLE
-- =====================================================

-- Track BOMs waiting for enrichment
CREATE TABLE IF NOT EXISTS enrichment_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Priority-based scheduling (1 = highest, 10 = lowest)
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Queue status
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',

  -- Temporal workflow tracking
  temporal_workflow_id TEXT,
  temporal_run_id TEXT,

  -- Quality check
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_issues JSONB, -- Array of issue descriptions
  requires_admin_approval BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMPTZ,

  -- Processing metadata
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Statistics
  total_items INTEGER,
  matched_items INTEGER,
  enriched_items INTEGER,
  match_rate DECIMAL(5, 2),
  avg_confidence DECIMAL(5, 2),

  UNIQUE(bom_id)
);

-- Indexes for queue operations
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority DESC, queued_at ASC);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_org ON enrichment_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_workflow ON enrichment_queue(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_approval ON enrichment_queue(requires_admin_approval) WHERE requires_admin_approval = TRUE;

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification details
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB, -- Additional metadata

  -- Status
  is_read BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- ENRICHMENT AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS enrichment_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'queued', 'quality_check_passed', 'quality_check_failed',
    'started', 'matching_batch_complete', 'enrichment_complete',
    'admin_approval_requested', 'admin_approved', 'admin_rejected',
    'completed', 'failed', 'cancelled'
  )),
  event_data JSONB, -- Event-specific metadata

  -- Temporal tracking
  temporal_workflow_id TEXT,
  temporal_activity_id TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_bom ON enrichment_audit_log(bom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_org ON enrichment_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_workflow ON enrichment_audit_log(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_event_type ON enrichment_audit_log(event_type);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Trigger: Update BOM enrichment status when queue changes
CREATE OR REPLACE FUNCTION update_bom_enrichment_from_queue()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE boms
  SET
    enrichment_status = CASE NEW.status
      WHEN 'queued' THEN 'queued'
      WHEN 'processing' THEN 'processing'
      WHEN 'completed' THEN 'enriched'
      WHEN 'failed' THEN 'failed'
      WHEN 'cancelled' THEN 'pending'
      ELSE enrichment_status
    END,
    enrichment_quality_score = NEW.quality_score,
    enrichment_started_at = NEW.started_at,
    enrichment_completed_at = NEW.completed_at,
    enrichment_failed_at = NEW.failed_at,
    enrichment_error = NEW.error_message,
    temporal_workflow_id = NEW.temporal_workflow_id,
    temporal_run_id = NEW.temporal_run_id,
    enrichment_match_rate = NEW.match_rate,
    enrichment_avg_confidence = NEW.avg_confidence
  WHERE id = NEW.bom_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_update_bom_from_queue ON enrichment_queue;
CREATE TRIGGER trigger_update_bom_from_queue
  AFTER UPDATE ON enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_bom_enrichment_from_queue();

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE enrichment_queue IS 'Priority queue for BOM enrichment workflows with Temporal integration';
COMMENT ON TABLE notifications IS 'User notifications for enrichment events and alerts';
COMMENT ON TABLE enrichment_audit_log IS 'Audit trail for all enrichment workflow events';

COMMENT ON COLUMN boms.enrichment_status IS 'Current enrichment status: pending, queued, processing, enriched, failed, requires_approval';
COMMENT ON COLUMN boms.enrichment_priority IS 'Priority level (1-10) for enrichment processing, where 1 is highest priority';
COMMENT ON COLUMN boms.temporal_workflow_id IS 'Temporal workflow ID for tracking enrichment process';
COMMENT ON COLUMN boms.enrichment_match_rate IS 'Percentage of components successfully matched to central catalog';

COMMENT ON COLUMN enrichment_queue.priority IS 'Processing priority: 1=highest (customer-facing), 10=lowest (background)';
COMMENT ON COLUMN enrichment_queue.requires_admin_approval IS 'TRUE if quality score < 70% and manual approval needed';

COMMENT ON FUNCTION update_bom_enrichment_from_queue() IS 'Sync BOM enrichment status from queue table updates';
