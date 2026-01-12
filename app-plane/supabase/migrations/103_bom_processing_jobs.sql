-- 103_bom_processing_jobs.sql
-- BOM Processing Jobs - Workflow state persistence for Queue Cards UI
--
-- Stores the state of BOM processing workflows (Temporal) for:
-- - Queue Cards display with stage progress
-- - Pause/Resume functionality
-- - Historical processing records
--
-- This table is updated by the BOMProcessingWorkflow Temporal workflow
-- and queried by the frontend via SSE/API

-- Drop existing table if exists (for fresh migration)
DROP TABLE IF EXISTS bom_processing_jobs CASCADE;

-- Create bom_processing_jobs table
CREATE TABLE IF NOT EXISTS bom_processing_jobs (
    -- Primary key is separate UUID (allows ON CONFLICT upsert by bom_id)
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    bom_id UUID NOT NULL,
    organization_id UUID NOT NULL,

    -- Overall workflow status
    -- Allowed: pending, queued, processing, running, paused, completed, failed, cancelled
    status TEXT DEFAULT 'queued'::text,

    -- Priority for queue ordering (1=highest, 10=lowest)
    priority INTEGER DEFAULT 5,

    -- Temporal workflow tracking
    temporal_workflow_id TEXT,
    workflow_id TEXT,

    -- Progress counters
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    enriched_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    risk_scored_items INTEGER DEFAULT 0,

    -- Current processing stage
    current_stage TEXT,

    -- Stage details (JSONB for flexibility)
    -- Structure: {
    --   "raw_upload": {"status": "completed", "progress": 100, "started_at": "...", "completed_at": "..."},
    --   "parsing": {"status": "completed", "progress": 100, "total_items": 50, ...},
    --   "enrichment": {"status": "in_progress", "progress": 45, "items_processed": 23, "total_items": 50, ...},
    --   "risk_analysis": {"status": "pending", ...},
    --   "complete": {"status": "pending", ...}
    -- }
    stages JSONB DEFAULT '[]'::jsonb,

    -- Enrichment progress tracking (detailed per-item progress)
    enrichment_progress JSONB DEFAULT '{}'::jsonb,

    -- Risk analysis results (cached for quick display)
    health_grade TEXT,
    average_risk_score DECIMAL(5, 2),

    -- Error tracking
    error_message TEXT,

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT bom_processing_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT bom_processing_jobs_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
    CONSTRAINT bom_processing_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT bom_processing_jobs_status_check CHECK (status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))
);

-- CRITICAL: UNIQUE constraint on bom_id for ON CONFLICT upsert operations
ALTER TABLE bom_processing_jobs ADD CONSTRAINT bom_processing_jobs_bom_id_unique UNIQUE (bom_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_bom ON bom_processing_jobs(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_status ON bom_processing_jobs(status);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_bom_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bom_processing_jobs_updated_at ON bom_processing_jobs;
CREATE TRIGGER update_bom_processing_jobs_updated_at
    BEFORE UPDATE ON bom_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_processing_jobs_updated_at();

-- Comments
COMMENT ON TABLE bom_processing_jobs IS 'Tracks BOM processing workflow state for Queue Cards UI and pause/resume functionality';
COMMENT ON COLUMN bom_processing_jobs.stages IS 'JSONB containing status, progress, and timestamps for each processing stage';
COMMENT ON COLUMN bom_processing_jobs.workflow_id IS 'Temporal workflow ID for correlation and control signals';
COMMENT ON COLUMN bom_processing_jobs.bom_id IS 'Foreign key to boms table - UNIQUE constraint enables ON CONFLICT upsert';
