-- ============================================================================
-- MASTER MIGRATION: Complete Supabase Schema (ALL-IN-ONE)
-- ============================================================================
-- Created: 2025-11-19 (Updated)
-- Purpose: THE DEFINITIVE schema migration - includes EVERYTHING
-- Database: supabase (port 27541)
--
-- This master migration includes:
-- - Core tables (tenants, users, projects) WITHOUT _v2 suffix
-- - BOM management (boms, bom_line_items, bom_uploads with S3)
-- - Enrichment system (queue, audit, events, notifications)
-- - Slug auto-generation (from names)
-- - All helper functions and triggers
--
-- IMPORTANT: This is the ONLY migration needed for a fresh database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: Core Tables (Clean Names - NO _v2 suffix)
-- ============================================================================

-- Tenants (Organizations)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,  -- Auto-generated if not provided
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Platform users with RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    auth_subject UUID,  -- Links to auth.users
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'platform_admin', 'platform_user', 'org_admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,  -- Auto-generated if not provided
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- Indexes for core tables
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_subject ON users(auth_subject);

-- ============================================================================
-- SECTION 2: BOM Uploads Table (S3 Storage Ready)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File info
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    original_filename TEXT,
    raw_file_url TEXT,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Upload source
    upload_source TEXT NOT NULL DEFAULT 'customer' CHECK (upload_source IN ('customer', 'cns_bulk', 'staff', 'api')),

    -- S3/MinIO storage
    s3_bucket TEXT DEFAULT 'bulk-uploads',
    s3_key TEXT,
    storage_backend TEXT DEFAULT 'minio' CHECK (storage_backend IN ('minio', 's3', 'gcs', 'local')),

    -- Processing status
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
        'uploaded', 'parsing', 'parsed', 'mapping_pending', 'ready_for_enrichment',
        'processing', 'completed', 'failed'
    )),

    -- Column mapping
    detected_columns JSONB,
    unmapped_columns TEXT[],
    column_mappings JSONB,
    mapping_confirmed BOOLEAN DEFAULT false,
    mapping_confirmed_at TIMESTAMPTZ,

    -- Data preview and stats
    total_rows INTEGER DEFAULT 0,
    preview_data JSONB,
    parse_stats JSONB,
    processing_settings JSONB,

    -- Event-driven processing
    rabbitmq_event_published BOOLEAN DEFAULT false,
    rabbitmq_event_published_at TIMESTAMPTZ,

    -- Temporal workflow tracking
    temporal_workflow_id TEXT,
    temporal_workflow_status TEXT,

    -- CNS job tracking
    cns_job_id TEXT,
    cns_job_status TEXT,
    enrichment_job_id TEXT,
    enrichment_summary JSONB,

    -- BOM linking
    bom_id UUID,  -- Will add FK after boms table created

    -- Archive tracking
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    archive_s3_key TEXT,
    results_s3_key TEXT,
    failed_items_s3_key TEXT,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for bom_uploads
CREATE INDEX IF NOT EXISTS idx_bom_uploads_created_at ON bom_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_organization_id ON bom_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_project_id ON bom_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_rabbitmq_published ON bom_uploads(rabbitmq_event_published) WHERE rabbitmq_event_published = false;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_status ON bom_uploads(status);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_tenant_id ON bom_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_uploaded_by ON bom_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_workflow_id ON bom_uploads(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_upload_source ON bom_uploads(upload_source);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_s3_key ON bom_uploads(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_cns_job_id ON bom_uploads(cns_job_id) WHERE cns_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_archived ON bom_uploads(archived) WHERE archived = false;

-- ============================================================================
-- SECTION 3: BOMs (Bill of Materials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-tenancy
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- BOM identification
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Grading
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),

    -- Status
    status TEXT CHECK (status IN ('pending', 'analyzing', 'completed', 'failed', 'processing')) DEFAULT 'pending',

    -- Statistics
    component_count INTEGER DEFAULT 0,
    total_cost DECIMAL(12, 2),
    high_risk_count INTEGER DEFAULT 0,
    medium_risk_count INTEGER DEFAULT 0,
    low_risk_count INTEGER DEFAULT 0,

    -- Enrichment tracking
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

-- Add BOM foreign key to bom_uploads now that boms table exists
ALTER TABLE bom_uploads ADD CONSTRAINT bom_uploads_bom_id_fkey
    FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_bom_id ON bom_uploads(bom_id);

-- ============================================================================
-- SECTION 4: BOM Line Items
-- ============================================================================

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
    matched_component_id UUID,
    component_id INTEGER,  -- Links to central catalog (Components V2 DB)
    match_confidence DECIMAL(5, 2),
    match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),
    match_status TEXT,

    -- Enrichment tracking
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

    -- Storage tracking
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
-- SECTION 5: Enrichment System
-- ============================================================================

-- Enrichment Queue
CREATE TABLE IF NOT EXISTS enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

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

-- Enrichment Audit Log
CREATE TABLE IF NOT EXISTS enrichment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

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

-- Enrichment Events (Real-time Progress)
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

CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom_created ON enrichment_events(bom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_tenant_created ON enrichment_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_type_created ON enrichment_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_source_created ON enrichment_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_workflow ON enrichment_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_state ON enrichment_events USING GIN(state);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_payload ON enrichment_events USING GIN(payload);

-- ============================================================================
-- SECTION 6: Notifications & Alerts
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

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

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
-- SECTION 7: Helper Functions
-- ============================================================================

-- Function: Slugify text (URL-safe slug generation)
CREATE OR REPLACE FUNCTION slugify(text_to_slug text)
RETURNS text AS $$
DECLARE
    slugged text;
BEGIN
    slugged := lower(text_to_slug);
    slugged := regexp_replace(slugged, '[\s_]+', '-', 'g');
    slugged := regexp_replace(slugged, '[^a-z0-9\-]', '', 'g');
    slugged := regexp_replace(slugged, '-+', '-', 'g');
    slugged := regexp_replace(slugged, '^-|-$', '', 'g');

    IF slugged IS NULL OR slugged = '' THEN
        slugged := 'entity-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;

    RETURN slugged;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Auto-generate tenant slug
CREATE OR REPLACE FUNCTION auto_generate_tenant_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := slugify(NEW.name);

        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM tenants
                WHERE slug = NEW.slug
                  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-generate project slug
CREATE OR REPLACE FUNCTION auto_generate_project_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := slugify(NEW.name);

        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM projects
                WHERE slug = NEW.slug
                  AND organization_id = NEW.organization_id
                  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Function: Update bom_uploads.updated_at
CREATE OR REPLACE FUNCTION update_bom_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Function: Get latest enrichment state
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
-- SECTION 8: Triggers
-- ============================================================================

-- Trigger: Auto-generate tenant slug
DROP TRIGGER IF EXISTS trigger_auto_generate_tenant_slug ON tenants;
CREATE TRIGGER trigger_auto_generate_tenant_slug
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_tenant_slug();

-- Trigger: Auto-generate project slug
DROP TRIGGER IF EXISTS trigger_auto_generate_project_slug ON projects;
CREATE TRIGGER trigger_auto_generate_project_slug
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_project_slug();

-- Trigger: Update BOM from queue changes
DROP TRIGGER IF EXISTS trigger_update_bom_from_queue ON enrichment_queue;
CREATE TRIGGER trigger_update_bom_from_queue
    AFTER UPDATE ON enrichment_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_enrichment_from_queue();

-- Trigger: Update bom_uploads.updated_at
DROP TRIGGER IF EXISTS trigger_update_bom_uploads_updated_at ON bom_uploads;
CREATE TRIGGER trigger_update_bom_uploads_updated_at
    BEFORE UPDATE ON bom_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_uploads_updated_at();

-- ============================================================================
-- SECTION 9: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view own org enrichment events
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

-- RLS Policy: Service role can insert enrichment events
CREATE POLICY "Service role can insert enrichment events"
    ON enrichment_events
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- SECTION 10: Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE tenants IS 'Organizations/Tenants - multi-tenant top-level entity';
COMMENT ON TABLE users IS 'Platform users with RBAC roles';
COMMENT ON TABLE projects IS 'Projects within organizations';
COMMENT ON TABLE bom_uploads IS 'Unified upload tracking for customer and CNS bulk uploads with S3 storage';
COMMENT ON TABLE boms IS 'Bill of Materials with enrichment tracking';
COMMENT ON TABLE bom_line_items IS 'Individual component line items with enrichment status';
COMMENT ON TABLE enrichment_queue IS 'Priority queue for BOM enrichment workflows';
COMMENT ON TABLE enrichment_audit_log IS 'Audit trail for enrichment events';
COMMENT ON TABLE enrichment_events IS 'Real-time enrichment progress events with embedded state';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE alerts IS 'Component alerts';

COMMENT ON FUNCTION slugify(text) IS 'Convert text to URL-safe slug';
COMMENT ON FUNCTION auto_generate_tenant_slug() IS 'Auto-generate unique slug from tenant name';
COMMENT ON FUNCTION auto_generate_project_slug() IS 'Auto-generate unique slug from project name within organization';

-- ============================================================================
-- SECTION 11: Default Seed Data (Minimal)
-- ============================================================================

-- Default tenant and project
INSERT INTO tenants (id, name, slug)
VALUES ('a1111111-1111-1111-1111-111111111111'::uuid, 'Default Organization', 'default-org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, slug, organization_id)
VALUES ('b1111111-1111-1111-1111-111111111111'::uuid, 'Default Project', 'default-project', 'a1111111-1111-1111-1111-111111111111'::uuid)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ ✅ ✅ MASTER SUPABASE SCHEMA MIGRATION COMPLETE ✅ ✅ ✅';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created (Clean Names - NO _v2 suffix):';
    RAISE NOTICE '   - Core: tenants, users, projects';
    RAISE NOTICE '   - BOM: boms, bom_line_items, bom_uploads (with S3)';
    RAISE NOTICE '   - Enrichment: enrichment_queue, enrichment_audit_log, enrichment_events';
    RAISE NOTICE '   - Notifications: notifications, alerts';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Enabled:';
    RAISE NOTICE '   - Slug auto-generation from names (slugify function)';
    RAISE NOTICE '   - S3/MinIO storage ready (s3_bucket, s3_key columns)';
    RAISE NOTICE '   - Real-time enrichment progress (enrichment_events)';
    RAISE NOTICE '   - Quality-based storage routing (database vs Redis)';
    RAISE NOTICE '   - Row Level Security (RLS) enabled';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next Steps:';
    RAISE NOTICE '   1. Apply 029_comprehensive_seed_data.sql for test data (15 tenants, 36 users)';
    RAISE NOTICE '   2. Verify: bash scripts/verify_database_schema.sh';
    RAISE NOTICE '   3. Update application code references (if migrating from _v2 names)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 This is THE definitive schema - no other migrations needed!';
END $$;
