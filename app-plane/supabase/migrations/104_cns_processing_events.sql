-- 104_cns_processing_events.sql
-- CNS Processing Events - Event logging for BOM processing workflows
--
-- Stores events generated during BOM processing for:
-- - Real-time event streaming via SSE
-- - Audit trail of processing activities
-- - Debugging and troubleshooting
-- - Integration with alert system
--
-- Events are published via RabbitMQ and stored here for persistence

-- Drop existing table if exists (for fresh migration)
DROP TABLE IF EXISTS cns_processing_events CASCADE;

-- Create cns_processing_events table
CREATE TABLE IF NOT EXISTS cns_processing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Reference to BOM (optional - some events are organization-level)
    bom_id UUID REFERENCES boms(id) ON DELETE CASCADE,

    -- Reference to processing job if applicable
    processing_job_id UUID REFERENCES bom_processing_jobs(bom_id) ON DELETE SET NULL,

    -- Event categorization
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL DEFAULT 'processing'
        CHECK (event_category IN ('processing', 'enrichment', 'risk_analysis', 'workflow', 'system', 'alert', 'user_action')),

    -- Event severity for filtering
    severity VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),

    -- Event details
    title VARCHAR(500) NOT NULL,
    message TEXT,

    -- Rich metadata (JSONB for flexibility)
    -- Structure depends on event_type, examples:
    -- enrichment_progress: {"mpn": "LM358", "status": "matched", "confidence": 0.95, "source": "DigiKey"}
    -- workflow_control: {"action": "pause", "user_id": "...", "reason": "Manual pause"}
    -- risk_alert: {"risk_score": 7.5, "factors": ["EOL", "SingleSource"], "component_id": "..."}
    metadata JSONB DEFAULT '{}',

    -- Source tracking
    source_service VARCHAR(100) DEFAULT 'cns-service',
    workflow_id VARCHAR(255),

    -- Actor tracking (who/what triggered the event)
    actor_type VARCHAR(50) DEFAULT 'system'
        CHECK (actor_type IN ('system', 'user', 'workflow', 'scheduler', 'api')),
    actor_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- For event ordering and deduplication
    sequence_number BIGSERIAL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cns_events_org_id ON cns_processing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_cns_events_bom_id ON cns_processing_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_cns_events_type ON cns_processing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cns_events_category ON cns_processing_events(event_category);
CREATE INDEX IF NOT EXISTS idx_cns_events_severity ON cns_processing_events(severity);
CREATE INDEX IF NOT EXISTS idx_cns_events_created_at ON cns_processing_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cns_events_workflow ON cns_processing_events(workflow_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_cns_events_org_category_created
    ON cns_processing_events(organization_id, event_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cns_events_bom_created
    ON cns_processing_events(bom_id, created_at DESC);

-- Enable RLS
ALTER TABLE cns_processing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies - organization isolation
CREATE POLICY cns_processing_events_select_policy ON cns_processing_events
    FOR SELECT
    USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- Service role can do everything (for event publishers)
CREATE POLICY cns_processing_events_service_role_policy ON cns_processing_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON cns_processing_events TO authenticated;
GRANT ALL ON cns_processing_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cns_processing_events_sequence_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE cns_processing_events_sequence_number_seq TO service_role;

-- Function to log a CNS event (callable from triggers or API)
CREATE OR REPLACE FUNCTION log_cns_event(
    p_organization_id UUID,
    p_event_type VARCHAR(100),
    p_title VARCHAR(500),
    p_message TEXT DEFAULT NULL,
    p_bom_id UUID DEFAULT NULL,
    p_event_category VARCHAR(50) DEFAULT 'processing',
    p_severity VARCHAR(20) DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}',
    p_workflow_id VARCHAR(255) DEFAULT NULL,
    p_actor_type VARCHAR(50) DEFAULT 'system',
    p_actor_id VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO cns_processing_events (
        organization_id, bom_id, event_type, event_category, severity,
        title, message, metadata, workflow_id, actor_type, actor_id
    ) VALUES (
        p_organization_id, p_bom_id, p_event_type, p_event_category, p_severity,
        p_title, p_message, p_metadata, p_workflow_id, p_actor_type, p_actor_id
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION log_cns_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_cns_event TO service_role;

-- Comments
COMMENT ON TABLE cns_processing_events IS 'Event log for CNS BOM processing, enrichment, and risk analysis activities';
COMMENT ON COLUMN cns_processing_events.event_type IS 'Specific event type (e.g., enrichment.started, enrichment.item.matched, risk.alert.triggered)';
COMMENT ON COLUMN cns_processing_events.event_category IS 'High-level category for filtering events';
COMMENT ON COLUMN cns_processing_events.metadata IS 'JSONB containing event-specific details';
COMMENT ON FUNCTION log_cns_event IS 'Helper function to log CNS events with proper security context';

-- Create retention policy view (for cleanup job)
CREATE OR REPLACE VIEW cns_events_retention_summary AS
SELECT
    organization_id,
    event_category,
    severity,
    DATE_TRUNC('day', created_at) as event_date,
    COUNT(*) as event_count
FROM cns_processing_events
GROUP BY organization_id, event_category, severity, DATE_TRUNC('day', created_at)
ORDER BY event_date DESC;

GRANT SELECT ON cns_events_retention_summary TO authenticated;
