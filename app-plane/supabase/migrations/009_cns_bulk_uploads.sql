-- Migration: CNS Bulk Uploads with S3/MinIO Storage
-- Created: 2025-11-10
-- Purpose: Track CNS bulk upload files stored in MinIO/S3

-- ============================================================================
-- CNS Bulk Uploads Table (File Storage Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cns_bulk_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File metadata
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL, -- 'csv', 'xlsx', 'xls', 'json'
    original_name TEXT NOT NULL, -- User's original filename

    -- S3/MinIO storage
    s3_bucket TEXT NOT NULL DEFAULT 'bulk-uploads',
    s3_key TEXT NOT NULL, -- Path in S3: uploads/{tenant_id}/{upload_id}/{filename}
    s3_url TEXT, -- Pre-signed URL or permanent URL
    storage_backend TEXT NOT NULL DEFAULT 'minio', -- 'minio', 's3', 'gcs'

    -- Multi-tenancy (UUIDs for Supabase compatibility)
    tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects_v2(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES public.users_v2(id) ON DELETE SET NULL,

    -- Upload status
    status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'validating', 'valid', 'processing', 'completed', 'failed'

    -- File validation
    validation_status TEXT, -- 'pending', 'valid', 'invalid'
    validation_errors JSONB, -- Array of validation error messages

    -- Parse results (from CNS parser)
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    preview_data JSONB, -- First 10 rows for preview

    -- Column mapping (similar to bom_uploads)
    detected_columns JSONB, -- Auto-detected column mappings
    column_mappings JSONB, -- User-confirmed column mappings
    unmapped_columns TEXT[], -- Columns that couldn't be auto-mapped
    mapping_confirmed BOOLEAN DEFAULT false,
    mapping_confirmed_at TIMESTAMPTZ,

    -- Processing metadata
    parse_stats JSONB, -- { "encoding": "utf-8", "delimiter": ",", "has_header": true }
    processing_settings JSONB, -- User preferences: merge strategy, validation rules, etc.

    -- CNS job tracking
    cns_job_id TEXT, -- Reference to CNS enrichment job
    cns_job_status TEXT, -- 'pending', 'running', 'completed', 'failed'

    -- Event tracking (RabbitMQ + Temporal)
    rabbitmq_event_published BOOLEAN DEFAULT false,
    rabbitmq_event_published_at TIMESTAMPTZ,
    temporal_workflow_id TEXT, -- Temporal workflow execution ID
    temporal_workflow_status TEXT, -- 'pending', 'running', 'completed', 'failed'

    -- Results (after enrichment)
    enrichment_summary JSONB, -- { "total": 100, "enriched": 95, "failed": 5 }
    results_s3_key TEXT, -- Path to enriched results in S3
    failed_items_s3_key TEXT, -- Path to failed items in S3

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Archive tracking
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    archive_s3_key TEXT -- Path in bulk-uploads-archive bucket
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_tenant_id ON public.cns_bulk_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_organization_id ON public.cns_bulk_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_project_id ON public.cns_bulk_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_uploaded_by ON public.cns_bulk_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_status ON public.cns_bulk_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_created_at ON public.cns_bulk_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_s3_key ON public.cns_bulk_uploads(s3_key);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_cns_job_id ON public.cns_bulk_uploads(cns_job_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_workflow_id ON public.cns_bulk_uploads(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_archived ON public.cns_bulk_uploads(archived) WHERE archived = false;

-- ============================================================================
-- Auto-update updated_at Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cns_bulk_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_cns_bulk_uploads_updated_at ON public.cns_bulk_uploads;
CREATE TRIGGER trigger_update_cns_bulk_uploads_updated_at
  BEFORE UPDATE ON public.cns_bulk_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cns_bulk_uploads_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.cns_bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see uploads from their tenant
CREATE POLICY "cns_bulk_uploads_select_policy"
  ON public.cns_bulk_uploads
  FOR SELECT
  USING (
    is_super_admin() OR (tenant_id = current_user_tenant())
  );

-- Policy: Users can insert uploads for their tenant
CREATE POLICY "cns_bulk_uploads_insert_policy"
  ON public.cns_bulk_uploads
  FOR INSERT
  WITH CHECK (
    is_super_admin() OR (is_admin() AND tenant_id = current_user_tenant())
  );

-- Policy: Users can update uploads from their tenant
CREATE POLICY "cns_bulk_uploads_update_policy"
  ON public.cns_bulk_uploads
  FOR UPDATE
  USING (
    is_super_admin() OR (is_admin() AND tenant_id = current_user_tenant()) OR (is_engineer() AND uploaded_by = current_app_user_id())
  );

-- Policy: Admins can delete uploads
CREATE POLICY "cns_bulk_uploads_delete_policy"
  ON public.cns_bulk_uploads
  FOR DELETE
  USING (
    is_super_admin() OR (is_admin() AND tenant_id = current_user_tenant())
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Mark upload as ready for processing
CREATE OR REPLACE FUNCTION public.mark_cns_bulk_upload_ready(
  p_upload_id UUID,
  p_column_mappings JSONB
)
RETURNS public.cns_bulk_uploads AS $$
DECLARE
  v_upload public.cns_bulk_uploads;
BEGIN
  UPDATE public.cns_bulk_uploads
  SET
    status = 'processing',
    column_mappings = p_column_mappings,
    mapping_confirmed = true,
    mapping_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id
  RETURNING * INTO v_upload;

  RETURN v_upload;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update CNS job status
CREATE OR REPLACE FUNCTION public.update_cns_bulk_upload_job_status(
  p_upload_id UUID,
  p_cns_job_id TEXT,
  p_job_status TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.cns_bulk_uploads
  SET
    cns_job_id = p_cns_job_id,
    cns_job_status = p_job_status,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark RabbitMQ event as published
CREATE OR REPLACE FUNCTION public.mark_cns_bulk_upload_event_published(
  p_upload_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE public.cns_bulk_uploads
  SET
    rabbitmq_event_published = true,
    rabbitmq_event_published_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Archive old uploads
CREATE OR REPLACE FUNCTION public.archive_cns_bulk_upload(
  p_upload_id UUID,
  p_archive_s3_key TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.cns_bulk_uploads
  SET
    archived = true,
    archived_at = NOW(),
    archive_s3_key = p_archive_s3_key,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get upload with pre-signed S3 URL
CREATE OR REPLACE FUNCTION public.get_cns_bulk_upload_with_url(p_upload_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_upload public.cns_bulk_uploads;
  v_result JSONB;
BEGIN
  SELECT * INTO v_upload
  FROM public.cns_bulk_uploads
  WHERE id = p_upload_id;

  IF v_upload IS NULL THEN
    RETURN NULL;
  END IF;

  -- Convert record to JSON
  v_result = to_jsonb(v_upload);

  -- Note: Pre-signed URL generation would be done by application layer
  -- This function just returns the upload record

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cns_bulk_uploads
TO anon, authenticated, service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.cns_bulk_uploads IS 'Tracks CNS bulk upload files stored in MinIO/S3. Similar to bom_uploads but for CNS admin bulk operations.';
COMMENT ON COLUMN public.cns_bulk_uploads.s3_bucket IS 'S3/MinIO bucket name (bulk-uploads, enriched-results, bulk-uploads-archive)';
COMMENT ON COLUMN public.cns_bulk_uploads.s3_key IS 'Full path in S3: uploads/{tenant_id}/{upload_id}/{filename}';
COMMENT ON COLUMN public.cns_bulk_uploads.storage_backend IS 'Storage backend: minio (local), s3 (AWS), gcs (Google Cloud)';
COMMENT ON COLUMN public.cns_bulk_uploads.status IS 'Upload lifecycle: uploaded → validating → valid → processing → completed/failed';
COMMENT ON COLUMN public.cns_bulk_uploads.cns_job_id IS 'Reference to CNS enrichment job (bom_jobs table or external system)';
COMMENT ON COLUMN public.cns_bulk_uploads.enrichment_summary IS 'Summary of enrichment results: total, enriched, failed counts';
COMMENT ON COLUMN public.cns_bulk_uploads.results_s3_key IS 'Path to enriched results file in enriched-results bucket';
COMMENT ON COLUMN public.cns_bulk_uploads.archived IS 'Whether upload has been archived to long-term storage';
