-- =============================================================================
-- Migration: Optimize enrichment_queue indexes for better query performance
-- =============================================================================
-- Purpose: Add composite indexes for efficient queue processing queries
-- This addresses BUG-013: Missing status in queue query filters

-- Query patterns:
-- 1. SELECT * FROM enrichment_queue WHERE status='queued' ORDER BY priority DESC, queued_at ASC LIMIT 1
-- 2. SELECT * FROM enrichment_queue WHERE status='processing' ORDER BY queued_at DESC
-- 3. SELECT COUNT(*) FROM enrichment_queue WHERE status IN ('queued', 'processing')

-- =============================================================================
-- COMPOSITE INDEX: status + priority + queued_at
-- =============================================================================
-- This index supports the most common queue query:
-- WHERE status = 'queued' ORDER BY priority DESC, queued_at ASC
-- Must be DESC on priority to get highest priority first
-- Must be ASC on queued_at to get oldest first within same priority

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status_priority_queued ON enrichment_queue(
    status,
    priority DESC,
    queued_at ASC
);

-- =============================================================================
-- INDEX: status + created_at (for audit queries)
-- =============================================================================
-- Supports: WHERE status='completed' AND created_at > NOW() - INTERVAL '7 days'

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status_created ON enrichment_queue(
    status,
    created_at DESC
);

-- =============================================================================
-- INDEX: organization_id + status (for tenant-scoped queue queries)
-- =============================================================================
-- Supports: WHERE organization_id = ? AND status = 'queued'

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_org_status ON enrichment_queue(
    organization_id,
    status,
    queued_at ASC
);

-- =============================================================================
-- PARTIAL INDEX: Active queue items only
-- =============================================================================
-- Smaller, faster index for common case: get next item to process
-- WHERE status IN ('queued', 'processing')

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_active ON enrichment_queue(priority DESC, queued_at ASC)
WHERE status IN ('queued', 'processing');

-- =============================================================================
-- VACUUM: Analyze to update statistics
-- =============================================================================
-- Note: In Supabase, VACUUM ANALYZE happens automatically
-- This just ensures planner has fresh statistics

ANALYZE enrichment_queue;

-- =============================================================================
-- QUERY PERFORMANCE VERIFICATION
-- =============================================================================
-- After applying this migration, these queries should use the new indexes:

-- Query 1: Get next item to process (most critical)
-- EXPLAIN SELECT * FROM enrichment_queue 
-- WHERE status='queued' 
-- ORDER BY priority DESC, queued_at ASC 
-- LIMIT 1;
-- Expected: Use idx_enrichment_queue_status_priority_queued, Index-Only Scan or Index Scan

-- Query 2: Get completed items in time window
-- EXPLAIN SELECT * FROM enrichment_queue 
-- WHERE status='completed' 
-- AND created_at > NOW() - INTERVAL '7 days'
-- ORDER BY created_at DESC;
-- Expected: Use idx_enrichment_queue_status_created

-- Query 3: Get organization's queued items
-- EXPLAIN SELECT * FROM enrichment_queue 
-- WHERE organization_id = 'org-123' 
-- AND status='queued'
-- ORDER BY queued_at ASC;
-- Expected: Use idx_enrichment_queue_org_status
