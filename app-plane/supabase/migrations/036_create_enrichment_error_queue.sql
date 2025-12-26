-- =============================================================================
-- Migration: Create enrichment_error_queue table for dead-letter queue (DLQ)
-- =============================================================================
-- Purpose: Track failed enrichment attempts with automatic retry logic
-- Implements exponential backoff retry pattern with max 5 retries
-- Routes to manual review if max retries exceeded

-- =============================================================================
-- ERROR QUEUE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS enrichment_error_queue (
    id SERIAL PRIMARY KEY,
    
    -- Reference IDs
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    component_id UUID NOT NULL,
    mpn VARCHAR(255) NOT NULL,
    
    -- Error details
    error_message TEXT NOT NULL,
    error_type VARCHAR(50) NOT NULL,  -- validation, api, timeout, network, etc.
    
    -- Retry tracking
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 5),
    next_retry_delay INTEGER,  -- seconds until next retry attempt
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, retrying, max_retries, resolved, abandoned
    
    -- Context (for manual review)
    enrichment_context JSONB,  -- Snapshot of enrichment state when error occurred
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT enrichment_error_queue_status_check 
        CHECK (status IN ('pending', 'retrying', 'max_retries', 'resolved', 'abandoned')),
    
    CONSTRAINT enrichment_error_queue_error_type_check
        CHECK (error_type IN ('validation', 'api', 'timeout', 'network', 'database', 'other'))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index: Get pending retries (most common query)
-- SELECT * FROM enrichment_error_queue 
-- WHERE status='pending' AND retry_count < 5 AND created_at + INTERVAL '1 second' * next_retry_delay <= NOW()
CREATE INDEX IF NOT EXISTS idx_enrichment_error_queue_pending 
ON enrichment_error_queue(status, retry_count, created_at)
WHERE status = 'pending' AND retry_count < 5;

-- Index: Get items requiring manual review
-- SELECT * FROM enrichment_error_queue WHERE status='max_retries'
CREATE INDEX IF NOT EXISTS idx_enrichment_error_queue_manual_review
ON enrichment_error_queue(status, created_at DESC)
WHERE status = 'max_retries';

-- Index: BOM error history
-- SELECT * FROM enrichment_error_queue WHERE bom_id=? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_enrichment_error_queue_bom_history
ON enrichment_error_queue(bom_id, created_at DESC);

-- Index: Component error tracking
-- SELECT * FROM enrichment_error_queue WHERE component_id=? ORDER BY retry_count
CREATE INDEX IF NOT EXISTS idx_enrichment_error_queue_component
ON enrichment_error_queue(component_id, retry_count DESC);

-- Index: Error type analysis
-- SELECT COUNT(*), error_type FROM enrichment_error_queue WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY error_type
CREATE INDEX IF NOT EXISTS idx_enrichment_error_queue_type
ON enrichment_error_queue(error_type, created_at DESC);

-- =============================================================================
-- UNIQUE CONSTRAINT: Prevent duplicate errors for same component
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_error_queue_component_retry
ON enrichment_error_queue(component_id, retry_count)
WHERE status != 'resolved' AND status != 'abandoned';

-- =============================================================================
-- UPDATE TRIGGER: Auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_enrichment_error_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrichment_error_queue_timestamp ON enrichment_error_queue;

CREATE TRIGGER enrichment_error_queue_timestamp
BEFORE UPDATE ON enrichment_error_queue
FOR EACH ROW
EXECUTE FUNCTION update_enrichment_error_queue_timestamp();

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE enrichment_error_queue IS 'Dead-letter queue for failed enrichment attempts with automatic exponential backoff retry';

COMMENT ON COLUMN enrichment_error_queue.mpn IS 'MPN for human-readable tracking and manual review';

COMMENT ON COLUMN enrichment_error_queue.error_type IS 'Type of error: validation (bad input), api (vendor error), timeout (slow response), network (connectivity), database (persistence), other (unknown)';

COMMENT ON COLUMN enrichment_error_queue.retry_count IS 'Current retry attempt (0-5, max 5 retries)';

COMMENT ON COLUMN enrichment_error_queue.next_retry_delay IS 'Seconds to wait before next retry (exponential backoff: 2^(retry_count+1))';

COMMENT ON COLUMN enrichment_error_queue.status IS 'pending (ready to retry), retrying (currently processing), max_retries (exceeded limit, needs manual review), resolved (successful after retry), abandoned (manually skipped)';

COMMENT ON COLUMN enrichment_error_queue.enrichment_context IS 'JSON snapshot of enrichment state when error occurred (for debugging and manual review)';

-- =============================================================================
-- RETENTION POLICY
-- =============================================================================
-- Keep error records for 30 days for audit purposes
-- Delete resolved/abandoned records older than 30 days

CREATE OR REPLACE FUNCTION cleanup_old_enrichment_errors()
RETURNS void AS $$
BEGIN
    DELETE FROM enrichment_error_queue
    WHERE (status IN ('resolved', 'abandoned') AND updated_at < NOW() - INTERVAL '30 days')
       OR (status = 'max_retries' AND created_at < NOW() - INTERVAL '90 days');
    
    RAISE NOTICE 'Cleaned up old enrichment error records';
END;
$$ LANGUAGE plpgsql;

-- Note: In production, schedule this via: SELECT cron.schedule('cleanup-enrichment-errors', '0 2 * * *', 'SELECT cleanup_old_enrichment_errors()');
