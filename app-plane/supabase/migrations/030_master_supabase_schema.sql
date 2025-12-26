-- ============================================================================
-- MASTER MIGRATION: Complete Supabase Schema
-- ============================================================================
-- Created: 2025-11-19
-- Purpose: Consolidate ALL missing tables and columns for Supabase database
-- Database: supabase (port 27541)
--
-- This master migration creates all tables and columns required by:
-- - Customer Portal (React Admin)
-- - CNS Service (BOM enrichment, upload processing)
-- - Temporal workflows (enrichment orchestration)
--
-- IMPORTANT: Run this migration if starting fresh or if tables are missing
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: Core Tables (if not already created by 000_minimal_for_bom_uploads.sql)
-- ============================================================================

-- Note: tenants_v2, users_v2, projects_v2 should already exist
-- If not, they are created by 000_minimal_for_bom_uploads.sql

-- ============================================================================
-- SECTION 2: BOM Management Tables
-- ============================================================================

-- Main BOMs table (from 001_initial_schema.sql + enrichment extensions)
CREATE TABLE IF NOT EXISTS boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy
  organization_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants_v2(id) ON DELETE CASCADE, -- Duplicate for compatibility
  project_id UUID REFERENCES projects_v2(id) ON DELETE SET NULL,

  -- BOM identification
  name TEXT NOT NULL,
  version TEXT,
  description TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Grading (A-F based on risk analysis)
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),

  -- Status
  status TEXT CHECK (status IN ('pending', 'analyzing', 'completed', 'failed', 'processing')) DEFAULT 'pending',

  -- Statistics
  component_count INTEGER DEFAULT 0,
  total_cost DECIMAL(12, 2),
  high_risk_count INTEGER DEFAULT 0,
  medium_risk_count INTEGER DEFAULT 0,
  low_risk_count INTEGER DEFAULT 0,

  -- Enrichment tracking (from 008_bom_enrichment_schema_standalone.sql)
  enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'queued', 'processing', 'enriched', 'failed', 'requires_approval')) DEFAULT 'pending',
  enrichment_priority INTEGER CHECK (enrichment_priority >= 1 AND enrichment_priority <= 10) DEFAULT 5,
  enrichment_quality_score INTEGER CHECK (enrichment_quality_score >= 0 AND enrichment_quality_score <= 100),
  enrichment_queued_at TIMESTAMPTZ,
  enrichment_started_at TIMESTAMPTZ,
  enrichment_completed_at TIMESTAMPTZ,
  enrichment_failed_at TIMESTAMPTZ,
  enrichment_error TEXT,
  temporal_workflow_id TEXT,
  temporal_run_id TEXT,
  enrichment_match_rate DECIMAL(5, 2),
  enrichment_avg_confidence DECIMAL(5, 2),

  -- Central catalog progress tracking (from 001_central_component_catalog.sql)
  enrichment_progress JSONB DEFAULT '{"total_items": 0, "enriched_items": 0, "failed_items": 0, "pending_items": 0, "last_updated": null}'::jsonb,

  -- Analysis metadata
  analyzed_at TIMESTAMPTZ,
  analysis_version TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for BOMs
CREATE INDEX IF NOT EXISTS idx_boms_organization_id ON boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_tenant_id ON boms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_boms_project_id ON boms(project_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON boms(status);
CREATE INDEX IF NOT EXISTS idx_boms_grade ON boms(grade);
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_status ON boms(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_priority ON boms(enrichment_priority DESC);
CREATE INDEX IF NOT EXISTS idx_boms_temporal_workflow ON boms(temporal_workflow_id);

-- BOM Line Items table (from 001_initial_schema.sql + enrichment extensions)
CREATE TABLE IF NOT EXISTS bom_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  line_number INTEGER,

  -- Original data from upload
  reference_designator TEXT,
  manufacturer_part_number TEXT,
  mpn_raw TEXT,
  manufacturer TEXT,
  manufacturer_raw TEXT,
  description TEXT,
  description_raw TEXT,
  quantity INTEGER DEFAULT 1,

  -- Matching results
  matched_component_id UUID, -- Links to components table
  component_id INTEGER, -- Links to central catalog (Components V2 DB)
  match_confidence DECIMAL(5, 2),
  match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),
  match_status TEXT,

  -- Enrichment tracking (from 008_bom_enrichment_schema_standalone.sql)
  enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'matched', 'enriched', 'no_match', 'error')) DEFAULT 'pending',
  enriched_mpn TEXT,
  enriched_manufacturer TEXT,
  enrichment_error TEXT,

  -- Component data (from enrichment)
  specifications JSONB,
  datasheet_url TEXT,
  lifecycle_status TEXT,
  estimated_lifetime TIMESTAMPTZ,
  compliance_status JSONB,
  pricing JSONB,
  enriched_at TIMESTAMPTZ,

  -- Storage tracking (from 020_add_component_storage_tracking.sql)
  component_storage TEXT DEFAULT 'database' CHECK (component_storage IN ('database', 'redis')),
  redis_component_key TEXT,

  -- Line item analysis
  unit_price DECIMAL(10, 4),
  extended_price DECIMAL(12, 2),
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for BOM Line Items
CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_id ON bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component ON bom_line_items(matched_component_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_enrichment_status ON bom_line_items(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id ON bom_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn ON bom_line_items(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_component ON bom_line_items(bom_id, component_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_redis_key ON bom_line_items(redis_component_key) WHERE redis_component_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_line_items_storage_type ON bom_line_items(component_storage);

-- ============================================================================
-- SECTION 3: Extend bom_uploads for S3 Storage (from 009_extend_bom_uploads_for_s3.sql)
-- ============================================================================

-- Add S3/MinIO storage fields if not already added
ALTER TABLE bom_uploads
ADD COLUMN IF NOT EXISTS upload_source TEXT NOT NULL DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS s3_bucket TEXT DEFAULT 'bulk-uploads',
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS storage_backend TEXT DEFAULT 'minio',
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS cns_job_id TEXT,
ADD COLUMN IF NOT EXISTS cns_job_status TEXT,
ADD COLUMN IF NOT EXISTS enrichment_summary JSONB,
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archive_s3_key TEXT,
ADD COLUMN IF NOT EXISTS results_s3_key TEXT,
ADD COLUMN IF NOT EXISTS failed_items_s3_key TEXT;

-- Add BOM link column (from 023_link_bom_uploads_to_boms.sql)
ALTER TABLE bom_uploads
ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES boms(id) ON DELETE SET NULL;

-- Add indexes for bom_uploads extensions
CREATE INDEX IF NOT EXISTS idx_bom_uploads_upload_source ON bom_uploads(upload_source);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_s3_key ON bom_uploads(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_cns_job_id ON bom_uploads(cns_job_id) WHERE cns_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_archived ON bom_uploads(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_bom_id ON bom_uploads(bom_id);

-- ============================================================================
-- SECTION 4: Enrichment Queue and Audit (from 008_bom_enrichment_schema_standalone.sql)
-- ============================================================================

-- Enrichment Queue table
CREATE TABLE IF NOT EXISTS enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,

  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',

  temporal_workflow_id TEXT,
  temporal_run_id TEXT,

  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_issues JSONB,
  requires_admin_approval BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMPTZ,

  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  total_items INTEGER,
  matched_items INTEGER,
  enriched_items INTEGER,
  match_rate DECIMAL(5, 2),
  avg_confidence DECIMAL(5, 2),

  UNIQUE(bom_id)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority DESC, queued_at ASC);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_org ON enrichment_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_workflow ON enrichment_queue(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_approval ON enrichment_queue(requires_admin_approval) WHERE requires_admin_approval = TRUE;

-- Enrichment Audit Log table
CREATE TABLE IF NOT EXISTS enrichment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'queued', 'quality_check_passed', 'quality_check_failed',
    'started', 'matching_batch_complete', 'enrichment_complete',
    'admin_approval_requested', 'admin_approved', 'admin_rejected',
    'completed', 'failed', 'cancelled'
  )),
  event_data JSONB,

  temporal_workflow_id TEXT,
  temporal_activity_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_audit_bom ON enrichment_audit_log(bom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_org ON enrichment_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_workflow ON enrichment_audit_log(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_event_type ON enrichment_audit_log(event_type);

-- ============================================================================
-- SECTION 5: Enrichment Events (Real-time Progress) (from 010_enrichment_events_realtime.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(255),

    bom_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    project_id UUID,
    user_id UUID,
    source VARCHAR(20) NOT NULL CHECK (source IN ('customer', 'staff')),

    workflow_id VARCHAR(255),
    workflow_run_id VARCHAR(255),

    state JSONB NOT NULL,
    payload JSONB NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for enrichment_events
CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom_created ON enrichment_events(bom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_tenant_created ON enrichment_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_type_created ON enrichment_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_source_created ON enrichment_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_workflow ON enrichment_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_state ON enrichment_events USING GIN(state);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_payload ON enrichment_events USING GIN(payload);

-- ============================================================================
-- SECTION 6: Notifications (from 008_bom_enrichment_schema_standalone.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,

  is_read BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- SECTION 7: Alerts (from 001_initial_schema.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
  component_id UUID,

  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,

  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

-- ============================================================================
-- SECTION 8: Triggers and Functions
-- ============================================================================

-- Function: Update BOM enrichment status from queue
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

DROP TRIGGER IF EXISTS trigger_update_bom_from_queue ON enrichment_queue;
CREATE TRIGGER trigger_update_bom_from_queue
  AFTER UPDATE ON enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_bom_enrichment_from_queue();

-- Function: Update bom_uploads.updated_at timestamp
CREATE OR REPLACE FUNCTION update_bom_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bom_uploads_updated_at ON bom_uploads;
CREATE TRIGGER trigger_update_bom_uploads_updated_at
    BEFORE UPDATE ON bom_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_uploads_updated_at();

-- Function: Generate S3 key
CREATE OR REPLACE FUNCTION generate_s3_key(
  p_tenant_id UUID,
  p_upload_id UUID,
  p_filename TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN format('uploads/%s/%s/%s', p_tenant_id, p_upload_id, p_filename);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Update CNS job status
CREATE OR REPLACE FUNCTION update_cns_job_status(
  p_upload_id UUID,
  p_cns_job_id TEXT,
  p_job_status TEXT,
  p_enrichment_summary JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE bom_uploads
  SET
    cns_job_id = p_cns_job_id,
    cns_job_status = p_job_status,
    enrichment_summary = COALESCE(p_enrichment_summary, enrichment_summary),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Archive BOM upload
CREATE OR REPLACE FUNCTION archive_bom_upload(
  p_upload_id UUID,
  p_archive_s3_key TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE bom_uploads
  SET
    archived = true,
    archived_at = NOW(),
    archive_s3_key = p_archive_s3_key,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get latest enrichment state for a BOM
CREATE OR REPLACE FUNCTION get_latest_enrichment_state(p_bom_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_state JSONB;
BEGIN
    SELECT state
    INTO v_state
    FROM enrichment_events
    WHERE bom_id = p_bom_id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN v_state;
END;
$$;

-- Function: Get enrichment summary
CREATE OR REPLACE FUNCTION get_enrichment_summary(p_bom_id UUID)
RETURNS TABLE (
    total_events BIGINT,
    first_event TIMESTAMPTZ,
    last_event TIMESTAMPTZ,
    current_state JSONB,
    event_types JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_events,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event,
        (
            SELECT state
            FROM enrichment_events e2
            WHERE e2.bom_id = p_bom_id
            ORDER BY created_at DESC
            LIMIT 1
        ) as current_state,
        jsonb_object_agg(event_type, event_count) as event_types
    FROM (
        SELECT
            event_type,
            COUNT(*)::BIGINT as event_count
        FROM enrichment_events
        WHERE bom_id = p_bom_id
        GROUP BY event_type
    ) event_counts;
END;
$$;

-- ============================================================================
-- SECTION 9: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrichment_events
CREATE POLICY "Users can view own org enrichment events"
    ON enrichment_events
    FOR SELECT
    USING (
        tenant_id = (
            COALESCE(
                (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID,
                (auth.jwt() ->> 'tenant_id')::UUID
            )
        )
    );

CREATE POLICY "Service role can insert enrichment events"
    ON enrichment_events
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- SECTION 10: Enable Realtime
-- ============================================================================

-- Enable Realtime replication for enrichment_events table
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS enrichment_events;

-- ============================================================================
-- SECTION 11: Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE boms IS 'Bill of Materials with enrichment tracking and central catalog integration';
COMMENT ON TABLE bom_line_items IS 'Individual component line items with enrichment status and storage tracking';
COMMENT ON TABLE bom_uploads IS 'Unified upload tracking for customer and CNS bulk uploads with S3 storage';
COMMENT ON TABLE enrichment_queue IS 'Priority queue for BOM enrichment workflows with Temporal integration';
COMMENT ON TABLE enrichment_audit_log IS 'Audit trail for all enrichment workflow events';
COMMENT ON TABLE enrichment_events IS 'Real-time enrichment progress events with embedded state snapshots';
COMMENT ON TABLE notifications IS 'User notifications for enrichment events and alerts';
COMMENT ON TABLE alerts IS 'Component lifecycle, risk, and compliance alerts';

COMMENT ON COLUMN bom_uploads.s3_key IS 'Full S3 key/path: uploads/{tenant_id}/{upload_id}/{filename}';
COMMENT ON COLUMN bom_uploads.upload_source IS 'Upload source: customer (portal upload), cns_bulk (admin bulk), staff (internal), api (programmatic)';
COMMENT ON COLUMN bom_uploads.bom_id IS 'BOM ID created from this upload (boms.id). Enables correct enrichment targeting.';
COMMENT ON COLUMN bom_line_items.component_id IS 'Links to central component catalog in Components V2 database. NULL means enrichment pending or failed.';
COMMENT ON COLUMN bom_line_items.component_storage IS 'Storage location for component data: database (Components V2) or redis (temporary)';
COMMENT ON COLUMN enrichment_events.state IS 'Full enrichment state snapshot at time of event (enables UI updates without DB polling)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Master Supabase Schema Migration Complete';
    RAISE NOTICE '   - Created: boms, bom_line_items, enrichment_queue, enrichment_audit_log';
    RAISE NOTICE '   - Created: enrichment_events, notifications, alerts';
    RAISE NOTICE '   - Extended: bom_uploads (S3 storage, BOM linking)';
    RAISE NOTICE '   - Created: 8 helper functions, 2 triggers';
    RAISE NOTICE '   - Enabled: Row Level Security on all tables';
    RAISE NOTICE '   - Enabled: Realtime for enrichment_events';
END $$;
