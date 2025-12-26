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
    -- Primary key is bom_id since one processing job per BOM
    bom_id UUID PRIMARY KEY REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Temporal workflow tracking
    workflow_id VARCHAR(255) NOT NULL,

    -- Overall workflow status
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),

    -- Current processing stage
    current_stage VARCHAR(50) NOT NULL DEFAULT 'raw_upload'
        CHECK (current_stage IN ('raw_upload', 'parsing', 'enrichment', 'risk_analysis', 'complete')),

    -- Stage details (JSONB for flexibility)
    -- Structure: {
    --   "raw_upload": {"status": "completed", "progress": 100, "started_at": "...", "completed_at": "..."},
    --   "parsing": {"status": "completed", "progress": 100, "total_items": 50, ...},
    --   "enrichment": {"status": "in_progress", "progress": 45, "items_processed": 23, "total_items": 50, ...},
    --   "risk_analysis": {"status": "pending", ...},
    --   "complete": {"status": "pending", ...}
    -- }
    stages JSONB NOT NULL DEFAULT '{}',

    -- Progress counters
    total_items INTEGER NOT NULL DEFAULT 0,
    enriched_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    risk_scored_items INTEGER NOT NULL DEFAULT 0,

    -- Risk analysis results (cached for quick display)
    health_grade VARCHAR(10),
    average_risk_score DECIMAL(5, 2),

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_org_id ON bom_processing_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_status ON bom_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_workflow_id ON bom_processing_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_org_status ON bom_processing_jobs(organization_id, status);

-- Enable RLS
ALTER TABLE bom_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - organization isolation
-- Staff/Admins can see all jobs in their organization
CREATE POLICY bom_processing_jobs_select_policy ON bom_processing_jobs
    FOR SELECT
    USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- Service role can do everything (for Temporal workers)
CREATE POLICY bom_processing_jobs_service_role_policy ON bom_processing_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_bom_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bom_processing_jobs_updated_at ON bom_processing_jobs;
CREATE TRIGGER trigger_bom_processing_jobs_updated_at
    BEFORE UPDATE ON bom_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_processing_jobs_updated_at();

-- Grant permissions
GRANT SELECT ON bom_processing_jobs TO authenticated;
GRANT ALL ON bom_processing_jobs TO service_role;

-- Comments
COMMENT ON TABLE bom_processing_jobs IS 'Tracks BOM processing workflow state for Queue Cards UI and pause/resume functionality';
COMMENT ON COLUMN bom_processing_jobs.stages IS 'JSONB containing status, progress, and timestamps for each processing stage';
COMMENT ON COLUMN bom_processing_jobs.workflow_id IS 'Temporal workflow ID for correlation and control signals';
