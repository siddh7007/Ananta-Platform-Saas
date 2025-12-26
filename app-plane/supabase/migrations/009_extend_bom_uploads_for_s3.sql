-- Migration: Extend bom_uploads for S3/MinIO Storage and CNS Bulk Uploads
-- Created: 2025-11-10
-- Purpose: Add S3 storage fields to existing bom_uploads table for CNS bulk upload support

-- ============================================================================
-- Add S3/MinIO Storage Fields to bom_uploads
-- ============================================================================

-- Add source field to distinguish upload types
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS upload_source TEXT NOT NULL DEFAULT 'customer'; -- 'customer', 'cns_bulk', 'staff', 'api'

-- Add S3/MinIO storage fields
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS s3_bucket TEXT DEFAULT 'bulk-uploads',
ADD COLUMN IF NOT EXISTS s3_key TEXT, -- Path in S3: uploads/{tenant_id}/{upload_id}/{filename}
ADD COLUMN IF NOT EXISTS storage_backend TEXT DEFAULT 'minio', -- 'minio', 's3', 'gcs', 'local'
ADD COLUMN IF NOT EXISTS original_filename TEXT; -- User's original filename before sanitization

-- Add CNS-specific fields
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS cns_job_id TEXT, -- Reference to CNS enrichment job
ADD COLUMN IF NOT EXISTS cns_job_status TEXT; -- 'pending', 'running', 'paused', 'completed', 'failed'

-- Add enrichment summary
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS enrichment_summary JSONB; -- { "total": 100, "enriched": 95, "failed": 5, "auto_approved": 80, "needs_review": 15 }

-- Add archive tracking
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archive_s3_key TEXT; -- Path in bulk-uploads-archive bucket

-- Add results storage paths
ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS results_s3_key TEXT, -- Path to enriched results in S3
ADD COLUMN IF NOT EXISTS failed_items_s3_key TEXT; -- Path to failed items in S3

-- ============================================================================
-- Update raw_file_url to be nullable and add comment
-- ============================================================================
COMMENT ON COLUMN public.bom_uploads.raw_file_url IS 'MinIO/S3 URL for raw file. For local uploads: base64 data or null. For S3: full URL or path.';
COMMENT ON COLUMN public.bom_uploads.upload_source IS 'Upload source: customer (portal upload), cns_bulk (admin bulk), staff (internal), api (programmatic)';
COMMENT ON COLUMN public.bom_uploads.s3_bucket IS 'S3/MinIO bucket: bulk-uploads, enriched-results, or bulk-uploads-archive';
COMMENT ON COLUMN public.bom_uploads.s3_key IS 'Full S3 key/path: uploads/{tenant_id}/{upload_id}/{filename}';
COMMENT ON COLUMN public.bom_uploads.storage_backend IS 'Storage backend: minio (local), s3 (AWS), gcs (Google Cloud), local (filesystem)';

-- ============================================================================
-- Add Indexes for S3 Fields
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bom_uploads_upload_source ON public.bom_uploads(upload_source);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_s3_key ON public.bom_uploads(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_cns_job_id ON public.bom_uploads(cns_job_id) WHERE cns_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_uploads_archived ON public.bom_uploads(archived) WHERE archived = false;

-- ============================================================================
-- Helper Function: Generate S3 Key
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_s3_key(
  p_tenant_id UUID,
  p_upload_id UUID,
  p_filename TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN format('uploads/%s/%s/%s', p_tenant_id, p_upload_id, p_filename);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Helper Function: Update CNS Job Status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cns_job_status(
  p_upload_id UUID,
  p_cns_job_id TEXT,
  p_job_status TEXT,
  p_enrichment_summary JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    cns_job_id = p_cns_job_id,
    cns_job_status = p_job_status,
    enrichment_summary = COALESCE(p_enrichment_summary, enrichment_summary),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Archive Upload
-- ============================================================================
CREATE OR REPLACE FUNCTION public.archive_bom_upload(
  p_upload_id UUID,
  p_archive_s3_key TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    archived = true,
    archived_at = NOW(),
    archive_s3_key = p_archive_s3_key,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update Comments
-- ============================================================================
COMMENT ON TABLE public.bom_uploads IS 'Unified upload tracking table for customer BOM uploads AND CNS bulk uploads. Supports local storage and S3/MinIO backends.';
