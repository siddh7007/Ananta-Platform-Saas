-- ============================================================================
-- Migration: Staff Bulk Uploads Persistent Storage
-- ============================================================================
-- Created: 2024-12-11
-- Purpose: Add persistent Supabase storage for staff bulk uploads to prevent
--          data loss when Redis TTL expires (24-48 hours)
--
-- PROBLEM SOLVED:
-- - Staff bulk upload status was ONLY stored in Redis with TTL
-- - When Redis keys expired, all upload history was lost
-- - No audit trail for compliance/regulatory requirements
-- - Admin dashboards showed incomplete/missing workflows
--
-- SOLUTION:
-- - Create staff_bulk_uploads table in Supabase
-- - update_bom_progress activity now writes to BOTH Redis AND Supabase
-- - Redis = real-time cache (fast reads during processing)
-- - Supabase = persistent storage (audit trail, history)
-- ============================================================================

-- Staff Bulk Uploads table (persistent storage for staff/admin uploads)
CREATE TABLE IF NOT EXISTS staff_bulk_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to original Redis key
    upload_id UUID NOT NULL UNIQUE,

    -- Organization context (staff organization doing the upload)
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Project context (optional)
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- User who initiated the upload
    uploaded_by_user_id UUID,
    uploaded_by_email TEXT,

    -- Upload metadata
    filename TEXT,
    original_filename TEXT,
    file_size_bytes BIGINT,
    s3_key TEXT,
    mime_type TEXT,

    -- Status tracking (mirrors Redis status)
    status TEXT CHECK (status IN ('uploaded', 'processing', 'enriching', 'completed', 'failed', 'expired')) DEFAULT 'uploaded',

    -- Enrichment progress (mirrors Redis progress)
    enrichment_progress JSONB DEFAULT '{
        "total_items": 0,
        "enriched_items": 0,
        "failed_items": 0,
        "pending_items": 0,
        "percent_complete": 0.0,
        "last_updated": null
    }'::jsonb,

    -- Enrichment configuration used
    enrichment_config JSONB DEFAULT '{}'::jsonb,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Redis TTL tracking
    redis_expires_at TIMESTAMPTZ,
    redis_synced_at TIMESTAMPTZ,

    -- Temporal workflow tracking
    temporal_workflow_id TEXT,
    temporal_run_id TEXT,

    -- Processing timestamps
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,

    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete for compliance (never hard delete staff uploads)
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_upload_id ON staff_bulk_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_organization_id ON staff_bulk_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_status ON staff_bulk_uploads(status);
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_created_at ON staff_bulk_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_redis_expires ON staff_bulk_uploads(redis_expires_at) WHERE redis_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_bulk_uploads_temporal ON staff_bulk_uploads(temporal_workflow_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_staff_bulk_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_bulk_uploads_updated_at ON staff_bulk_uploads;
CREATE TRIGGER trigger_staff_bulk_uploads_updated_at
    BEFORE UPDATE ON staff_bulk_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_staff_bulk_uploads_updated_at();

-- ============================================================================
-- Helper function to upsert staff upload status
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_staff_upload_progress(
    p_upload_id UUID,
    p_status TEXT DEFAULT NULL,
    p_progress JSONB DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_filename TEXT DEFAULT NULL,
    p_temporal_workflow_id TEXT DEFAULT NULL,
    p_temporal_run_id TEXT DEFAULT NULL,
    p_redis_ttl_hours INTEGER DEFAULT 48
)
RETURNS UUID AS $$
DECLARE
    v_result_id UUID;
BEGIN
    INSERT INTO staff_bulk_uploads (
        upload_id,
        organization_id,
        filename,
        status,
        enrichment_progress,
        temporal_workflow_id,
        temporal_run_id,
        redis_expires_at,
        redis_synced_at
    )
    VALUES (
        p_upload_id,
        p_organization_id,
        p_filename,
        COALESCE(p_status, 'uploaded'),
        COALESCE(p_progress, '{}'::jsonb),
        p_temporal_workflow_id,
        p_temporal_run_id,
        NOW() + (p_redis_ttl_hours || ' hours')::INTERVAL,
        NOW()
    )
    ON CONFLICT (upload_id) DO UPDATE SET
        status = COALESCE(EXCLUDED.status, staff_bulk_uploads.status),
        enrichment_progress = COALESCE(EXCLUDED.enrichment_progress, staff_bulk_uploads.enrichment_progress),
        temporal_workflow_id = COALESCE(EXCLUDED.temporal_workflow_id, staff_bulk_uploads.temporal_workflow_id),
        temporal_run_id = COALESCE(EXCLUDED.temporal_run_id, staff_bulk_uploads.temporal_run_id),
        redis_expires_at = EXCLUDED.redis_expires_at,
        redis_synced_at = NOW(),
        processing_started_at = CASE
            WHEN EXCLUDED.status = 'processing' AND staff_bulk_uploads.processing_started_at IS NULL
            THEN NOW()
            ELSE staff_bulk_uploads.processing_started_at
        END,
        processing_completed_at = CASE
            WHEN EXCLUDED.status IN ('completed', 'failed') AND staff_bulk_uploads.processing_completed_at IS NULL
            THEN NOW()
            ELSE staff_bulk_uploads.processing_completed_at
        END
    RETURNING id INTO v_result_id;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- View to show active (non-expired) staff uploads
-- ============================================================================
CREATE OR REPLACE VIEW v_active_staff_uploads AS
SELECT
    su.*,
    EXTRACT(EPOCH FROM (su.redis_expires_at - NOW())) / 3600 AS hours_until_redis_expire,
    CASE
        WHEN su.status IN ('completed', 'failed') THEN 'finished'
        WHEN su.redis_expires_at < NOW() THEN 'redis_expired'
        WHEN su.status = 'processing' THEN 'in_progress'
        ELSE 'pending'
    END AS workflow_state
FROM staff_bulk_uploads su
WHERE su.archived = FALSE
ORDER BY su.created_at DESC;

-- ============================================================================
-- Audit log for staff upload state changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_upload_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES staff_bulk_uploads(upload_id) ON DELETE CASCADE,

    -- State change
    previous_status TEXT,
    new_status TEXT,
    previous_progress JSONB,
    new_progress JSONB,

    -- Context
    changed_by TEXT,  -- 'system', 'workflow', 'admin', etc.
    change_reason TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_upload_audit_log_upload_id ON staff_upload_audit_log(upload_id);
CREATE INDEX IF NOT EXISTS idx_staff_upload_audit_log_created_at ON staff_upload_audit_log(created_at DESC);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION log_staff_upload_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status OR
       OLD.enrichment_progress IS DISTINCT FROM NEW.enrichment_progress THEN
        INSERT INTO staff_upload_audit_log (
            upload_id,
            previous_status,
            new_status,
            previous_progress,
            new_progress,
            changed_by,
            change_reason
        )
        VALUES (
            NEW.upload_id,
            OLD.status,
            NEW.status,
            OLD.enrichment_progress,
            NEW.enrichment_progress,
            'workflow',
            CASE
                WHEN OLD.status IS DISTINCT FROM NEW.status
                THEN 'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status
                ELSE 'Progress updated'
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_upload_status_audit ON staff_bulk_uploads;
CREATE TRIGGER trigger_staff_upload_status_audit
    AFTER UPDATE ON staff_bulk_uploads
    FOR EACH ROW
    EXECUTE FUNCTION log_staff_upload_status_change();

-- ============================================================================
-- RLS Policies (staff uploads visible only to authenticated staff)
-- ============================================================================
ALTER TABLE staff_bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Staff can see their organization's uploads
CREATE POLICY staff_uploads_org_policy ON staff_bulk_uploads
    FOR ALL
    USING (
        organization_id = current_setting('app.organization_id', TRUE)::UUID
        OR current_setting('app.is_super_admin', TRUE)::BOOLEAN = TRUE
    );

-- Grant permissions to service role (for workflow updates)
GRANT ALL ON staff_bulk_uploads TO service_role;
GRANT ALL ON staff_upload_audit_log TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant select to authenticated users (for dashboard views)
GRANT SELECT ON staff_bulk_uploads TO authenticated;
GRANT SELECT ON staff_upload_audit_log TO authenticated;
GRANT SELECT ON v_active_staff_uploads TO authenticated;

COMMENT ON TABLE staff_bulk_uploads IS 'Persistent storage for staff bulk upload status. Syncs with Redis during processing, persists after Redis TTL expires.';
COMMENT ON COLUMN staff_bulk_uploads.redis_expires_at IS 'When the corresponding Redis keys will expire. After this, Redis data is lost but Supabase retains the record.';
COMMENT ON COLUMN staff_bulk_uploads.redis_synced_at IS 'Last time this record was synced with Redis status.';
