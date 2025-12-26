-- Migration: Enrichment Events Table for Real-Time Progress Updates
-- Description: Store all enrichment lifecycle and component events with embedded state
-- Date: 2025-11-10

-- ============================================================================
-- 1. Create enrichment_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_events (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event identification
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(255),

    -- Context (multi-tenancy)
    bom_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    project_id UUID,
    user_id UUID,
    source VARCHAR(20) NOT NULL CHECK (source IN ('customer', 'staff')),

    -- Workflow context
    workflow_id VARCHAR(255),
    workflow_run_id VARCHAR(255),

    -- State snapshot (EMBEDDED IN EVENT - this is the key feature!)
    state JSONB NOT NULL,
    -- State contains: {
    --   status, total_items, enriched_items, failed_items,
    --   not_found_items, pending_items, percent_complete,
    --   current_batch, total_batches, etc.
    -- }

    -- Full event payload
    payload JSONB NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for query performance
    CONSTRAINT enrichment_events_event_id_key UNIQUE (event_id)
);

-- ============================================================================
-- 2. Create indexes
-- ============================================================================

-- Query by BOM (most common - get all events for a BOM)
CREATE INDEX idx_enrichment_events_bom_created
    ON enrichment_events (bom_id, created_at DESC);

-- Query by tenant (multi-tenancy)
CREATE INDEX idx_enrichment_events_tenant_created
    ON enrichment_events (tenant_id, created_at DESC);

-- Query by event type (analytics)
CREATE INDEX idx_enrichment_events_type_created
    ON enrichment_events (event_type, created_at DESC);

-- Query by source (customer vs staff)
CREATE INDEX idx_enrichment_events_source_created
    ON enrichment_events (source, created_at DESC);

-- Query by workflow (debugging)
CREATE INDEX idx_enrichment_events_workflow
    ON enrichment_events (workflow_id);

-- GIN index on state for JSONB queries
CREATE INDEX idx_enrichment_events_state
    ON enrichment_events USING GIN (state);

-- GIN index on payload for JSONB queries
CREATE INDEX idx_enrichment_events_payload
    ON enrichment_events USING GIN (payload);

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;

-- Policy: Customer Portal users can view their own organization's events
CREATE POLICY "Users can view own org enrichment events"
    ON enrichment_events
    FOR SELECT
    USING (
        -- Check if user's tenant_id matches event's tenant_id
        tenant_id = (
            COALESCE(
                (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID,
                (auth.jwt() ->> 'tenant_id')::UUID
            )
        )
    );

-- Policy: Staff can view all enrichment events
CREATE POLICY "Staff can view all enrichment events"
    ON enrichment_events
    FOR SELECT
    USING (
        -- Check if user has staff role
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'staff'
        OR
        (auth.jwt() ->> 'role') = 'staff'
    );

-- Policy: Service role can insert events (workers)
CREATE POLICY "Service role can insert enrichment events"
    ON enrichment_events
    FOR INSERT
    WITH CHECK (true);  -- Service role bypasses RLS

-- ============================================================================
-- 4. Enable Realtime for this table
-- ============================================================================

-- Enable Realtime replication for enrichment_events table
ALTER PUBLICATION supabase_realtime ADD TABLE enrichment_events;

-- ============================================================================
-- 5. Create helper function to get latest state for a BOM
-- ============================================================================

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

-- ============================================================================
-- 6. Create helper function to get enrichment summary
-- ============================================================================

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
-- 7. Create view for recent enrichment activity
-- ============================================================================

CREATE OR REPLACE VIEW recent_enrichment_activity AS
SELECT
    ee.id,
    ee.event_type,
    ee.bom_id,
    ee.tenant_id,
    ee.source,
    ee.state->>'status' as status,
    (ee.state->>'percent_complete')::NUMERIC as percent_complete,
    (ee.state->>'enriched_items')::INTEGER as enriched_items,
    (ee.state->>'total_items')::INTEGER as total_items,
    ee.created_at,
    b.name as bom_name,
    o.name as organization_name
FROM enrichment_events ee
LEFT JOIN boms_v2 b ON ee.bom_id = b.id
LEFT JOIN organizations_v2 o ON ee.tenant_id = o.id
WHERE ee.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ee.created_at DESC;

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

-- Grant SELECT to authenticated users (RLS will filter)
GRANT SELECT ON enrichment_events TO authenticated;
GRANT SELECT ON recent_enrichment_activity TO authenticated;

-- Grant EXECUTE on helper functions
GRANT EXECUTE ON FUNCTION get_latest_enrichment_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrichment_summary(UUID) TO authenticated;

-- ============================================================================
-- 9. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE enrichment_events IS 'Real-time enrichment progress events with embedded state snapshots';
COMMENT ON COLUMN enrichment_events.state IS 'Full enrichment state snapshot at time of event (enables UI updates without DB polling)';
COMMENT ON COLUMN enrichment_events.payload IS 'Complete event payload including component data, errors, etc.';
COMMENT ON COLUMN enrichment_events.source IS 'Event source: customer (Customer Portal) or staff (CNS Bulk Upload)';
COMMENT ON COLUMN enrichment_events.event_type IS 'Event type: enrichment.started, enrichment.component.completed, enrichment.progress, enrichment.completed, etc.';

-- ============================================================================
-- 10. Sample query patterns (for documentation)
-- ============================================================================

-- Query latest state for a BOM
-- SELECT get_latest_enrichment_state('bom_uuid');

-- Query enrichment summary
-- SELECT * FROM get_enrichment_summary('bom_uuid');

-- Query all events for a BOM (chronological)
-- SELECT event_type, state, created_at
-- FROM enrichment_events
-- WHERE bom_id = 'bom_uuid'
-- ORDER BY created_at ASC;

-- Query component completion events only
-- SELECT payload->>'mpn' as mpn,
--        payload->'enrichment'->>'quality_score' as quality_score,
--        created_at
-- FROM enrichment_events
-- WHERE bom_id = 'bom_uuid'
--   AND event_type = 'enrichment.component.completed'
-- ORDER BY created_at ASC;

-- Query enrichment progress over time
-- SELECT created_at,
--        (state->>'percent_complete')::NUMERIC as percent,
--        (state->>'enriched_items')::INTEGER as enriched
-- FROM enrichment_events
-- WHERE bom_id = 'bom_uuid'
--   AND event_type = 'enrichment.progress'
-- ORDER BY created_at ASC;
