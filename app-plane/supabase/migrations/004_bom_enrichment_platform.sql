-- ============================================================================
-- BOM Enrichment Platform Schema Migration
-- ============================================================================
-- Version: 004
-- Date: 2025-11-09
-- Description: Complete schema for BOM enrichment with Temporal workflows
--
-- Features:
--   - Unified job tracking (customer + CNS)
--   - Bulk upload support (CNS admin)
--   - File storage metadata (MinIO + Supabase Storage)
--   - Job progress tracking (WebSocket real-time updates)
--   - Priority-based scheduling
--   - Admin workflow controls
-- ============================================================================

-- ============================================================================
-- 1. BULK UPLOADS (CNS Admin)
-- ============================================================================

-- Bulk upload metadata
CREATE TABLE IF NOT EXISTS public.bulk_uploads_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  file_url TEXT,  -- MinIO URL: s3://bulk-uploads/uploads/{id}/original.csv
  file_size BIGINT,
  total_items INT DEFAULT 0,
  status TEXT DEFAULT 'uploaded',  -- uploaded, processing, completed, failed
  created_by UUID REFERENCES public.users_v2(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP  -- Soft delete
);

CREATE INDEX idx_bulk_uploads_status ON public.bulk_uploads_v2(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bulk_uploads_created_by ON public.bulk_uploads_v2(created_by);
CREATE INDEX idx_bulk_uploads_created_at ON public.bulk_uploads_v2(created_at DESC);

COMMENT ON TABLE public.bulk_uploads_v2 IS 'CNS admin bulk component uploads (1000+ parts)';
COMMENT ON COLUMN public.bulk_uploads_v2.file_url IS 'MinIO S3 URL: s3://bulk-uploads/uploads/{id}/original.csv';

-- Bulk upload line items
CREATE TABLE IF NOT EXISTS public.bulk_upload_items_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_upload_id UUID NOT NULL REFERENCES public.bulk_uploads_v2(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  mpn TEXT NOT NULL,
  manufacturer TEXT,
  quantity INT DEFAULT 1,
  reference_designator TEXT,
  description TEXT,
  component_id UUID REFERENCES public.component_catalog(id),  -- Link after enrichment
  enrichment_status TEXT DEFAULT 'pending',  -- pending, enriched, failed
  quality_score DECIMAL(5,2),
  enrichment_source TEXT,  -- catalog, digikey, mouser, element14, ai
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  enriched_at TIMESTAMP
);

CREATE INDEX idx_bulk_upload_items_bulk_upload_id ON public.bulk_upload_items_v2(bulk_upload_id);
CREATE INDEX idx_bulk_upload_items_status ON public.bulk_upload_items_v2(enrichment_status);
CREATE INDEX idx_bulk_upload_items_mpn ON public.bulk_upload_items_v2(mpn);
CREATE INDEX idx_bulk_upload_items_component_id ON public.bulk_upload_items_v2(component_id);

COMMENT ON TABLE public.bulk_upload_items_v2 IS 'Line items for bulk uploads with enrichment status';
COMMENT ON COLUMN public.bulk_upload_items_v2.component_id IS 'Foreign key to central catalog after enrichment';

-- ============================================================================
-- 2. UNIFIED JOB TRACKING (Customer + CNS)
-- ============================================================================

-- Drop existing table if from previous schema
DROP TABLE IF EXISTS public.bom_jobs_v2 CASCADE;

-- Unified job tracking
CREATE TABLE public.bom_jobs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,  -- 'customer_bom' or 'bulk_upload'

  -- References (nullable based on job type)
  bom_id UUID REFERENCES public.boms_v2(id) ON DELETE SET NULL,  -- For customer BOMs
  bulk_upload_id UUID REFERENCES public.bulk_uploads_v2(id) ON DELETE SET NULL,  -- For CNS bulk uploads
  tenant_id UUID REFERENCES public.tenants_v2(id),  -- NULL for CNS jobs

  -- Workflow tracking
  status TEXT DEFAULT 'queued',  -- queued, processing, paused, completed, failed, cancelled
  priority INT DEFAULT 5,  -- 1=highest (customer), 3=CNS, 5=normal, 7=low, 10=background
  workflow_id TEXT,  -- Temporal workflow ID

  -- Progress tracking
  total_items INT DEFAULT 0,
  processed_items INT DEFAULT 0,
  succeeded_items INT DEFAULT 0,
  failed_items INT DEFAULT 0,
  current_item TEXT,  -- Current MPN being processed
  progress_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_items > 0 THEN (processed_items::decimal / total_items::decimal * 100)
      ELSE 0
    END
  ) STORED,

  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Timestamps
  created_by UUID REFERENCES public.users_v2(id),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Admin controls
  paused_by UUID REFERENCES public.users_v2(id),
  cancelled_by UUID REFERENCES public.users_v2(id),
  cancel_reason TEXT,

  -- Metadata
  enrichment_options JSONB,  -- { use_ai: true, suppliers: ['digikey', 'mouser'], ... }

  CONSTRAINT bom_jobs_job_reference_check CHECK (
    (job_type = 'customer_bom' AND bom_id IS NOT NULL) OR
    (job_type = 'bulk_upload' AND bulk_upload_id IS NOT NULL)
  )
);

CREATE INDEX idx_bom_jobs_status ON public.bom_jobs_v2(status);
CREATE INDEX idx_bom_jobs_job_type ON public.bom_jobs_v2(job_type);
CREATE INDEX idx_bom_jobs_priority ON public.bom_jobs_v2(priority, created_at);
CREATE INDEX idx_bom_jobs_workflow_id ON public.bom_jobs_v2(workflow_id);
CREATE INDEX idx_bom_jobs_bom_id ON public.bom_jobs_v2(bom_id);
CREATE INDEX idx_bom_jobs_bulk_upload_id ON public.bom_jobs_v2(bulk_upload_id);
CREATE INDEX idx_bom_jobs_tenant_id ON public.bom_jobs_v2(tenant_id);
CREATE INDEX idx_bom_jobs_created_by ON public.bom_jobs_v2(created_by);

COMMENT ON TABLE public.bom_jobs_v2 IS 'Unified job tracking for customer BOMs and CNS bulk uploads';
COMMENT ON COLUMN public.bom_jobs_v2.priority IS '1=Customer (highest), 3=CNS bulk, 5=Normal, 7=Low, 10=Background';
COMMENT ON COLUMN public.bom_jobs_v2.workflow_id IS 'Temporal workflow ID for pause/resume/cancel';

-- ============================================================================
-- 3. JOB PROGRESS TRACKING (WebSocket Real-time Updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_progress_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.bom_jobs_v2(id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW(),
  items_processed INT NOT NULL,
  current_item TEXT,  -- Current MPN being processed
  quality_distribution JSONB,  -- { "high": 10, "medium": 5, "low": 2 }
  supplier_stats JSONB,  -- { "catalog": 12, "digikey": 8, "mouser": 5, "ai": 2 }
  enrichment_time_ms INT,  -- Time taken for current item
  message TEXT  -- Progress message
);

CREATE INDEX idx_job_progress_job_id ON public.job_progress_v2(job_id, timestamp DESC);
CREATE INDEX idx_job_progress_timestamp ON public.job_progress_v2(timestamp DESC);

COMMENT ON TABLE public.job_progress_v2 IS 'Real-time progress tracking for WebSocket broadcasts';

-- ============================================================================
-- 4. FILE STORAGE METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.file_storage_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.bom_jobs_v2(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,  -- 'original', 'enriched', 'failed', 'summary'
  storage_backend TEXT NOT NULL,  -- 'minio', 'supabase'
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,  -- S3 object key or Supabase Storage path
  file_size BIGINT,
  content_type TEXT,
  version INT DEFAULT 1,  -- File version (for edits)
  uploaded_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_file_storage_job_id ON public.file_storage_v2(job_id);
CREATE INDEX idx_file_storage_type ON public.file_storage_v2(file_type);
CREATE INDEX idx_file_storage_backend ON public.file_storage_v2(storage_backend);

COMMENT ON TABLE public.file_storage_v2 IS 'Metadata for files stored in MinIO or Supabase Storage';
COMMENT ON COLUMN public.file_storage_v2.storage_backend IS 'minio (CNS bulk uploads) or supabase (customer BOMs)';

-- ============================================================================
-- 5. UPDATE EXISTING TABLES
-- ============================================================================

-- Add version tracking to BOMs (for file edits)
ALTER TABLE public.boms_v2
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

COMMENT ON COLUMN public.boms_v2.version IS 'File version number (incremented on edit)';
COMMENT ON COLUMN public.boms_v2.file_url IS 'Supabase Storage URL for original BOM file';

-- Add component_id to existing bom_line_items_v2 if not exists
ALTER TABLE public.bom_line_items_v2
  ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES public.component_catalog(id);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id ON public.bom_line_items_v2(component_id);

COMMENT ON COLUMN public.bom_line_items_v2.component_id IS 'Link to central catalog after enrichment';

-- ============================================================================
-- 6. VIEWS FOR ADMIN DASHBOARD
-- ============================================================================

-- View: All active workflows (customer + CNS)
CREATE OR REPLACE VIEW public.active_workflows_v2 AS
SELECT
  j.id AS job_id,
  j.job_type,
  j.workflow_id,
  j.status,
  j.priority,
  j.progress_percent,
  j.total_items,
  j.processed_items,
  j.succeeded_items,
  j.failed_items,
  j.current_item,
  j.created_at,
  j.started_at,

  -- Customer BOM details
  b.name AS bom_name,
  b.tenant_id,
  t.name AS tenant_name,
  u.email AS user_email,

  -- CNS bulk upload details
  bu.name AS bulk_upload_name,
  bu.filename AS bulk_upload_filename,

  -- User info
  creator.email AS created_by_email,
  creator.full_name AS created_by_name

FROM public.bom_jobs_v2 j
LEFT JOIN public.boms_v2 b ON j.bom_id = b.id
LEFT JOIN public.tenants_v2 t ON j.tenant_id = t.id
LEFT JOIN public.users_v2 u ON b.created_by = u.id
LEFT JOIN public.bulk_uploads_v2 bu ON j.bulk_upload_id = bu.id
LEFT JOIN public.users_v2 creator ON j.created_by = creator.id
WHERE j.status IN ('queued', 'processing', 'paused')
ORDER BY j.priority ASC, j.created_at ASC;

COMMENT ON VIEW public.active_workflows_v2 IS 'CNS admin view of all active workflows (customer + CNS)';

-- View: Job statistics
CREATE OR REPLACE VIEW public.job_statistics_v2 AS
SELECT
  job_type,
  status,
  COUNT(*) AS job_count,
  AVG(progress_percent) AS avg_progress,
  SUM(total_items) AS total_items,
  SUM(succeeded_items) AS total_succeeded,
  SUM(failed_items) AS total_failed
FROM public.bom_jobs_v2
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type, status;

COMMENT ON VIEW public.job_statistics_v2 IS 'Job statistics for last 24 hours';

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Function: Update job progress
CREATE OR REPLACE FUNCTION public.update_job_progress(
  p_job_id UUID,
  p_items_processed INT,
  p_current_item TEXT DEFAULT NULL,
  p_quality_dist JSONB DEFAULT NULL,
  p_supplier_stats JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update job
  UPDATE public.bom_jobs_v2
  SET
    processed_items = p_items_processed,
    current_item = p_current_item,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Insert progress record
  INSERT INTO public.job_progress_v2 (
    job_id,
    items_processed,
    current_item,
    quality_distribution,
    supplier_stats
  ) VALUES (
    p_job_id,
    p_items_processed,
    p_current_item,
    p_quality_dist,
    p_supplier_stats
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_job_progress IS 'Update job progress and create progress record for WebSocket';

-- Function: Calculate job priority
CREATE OR REPLACE FUNCTION public.calculate_job_priority(
  p_job_type TEXT,
  p_source TEXT DEFAULT 'customer'
)
RETURNS INT AS $$
BEGIN
  -- Customer jobs always get highest priority
  IF p_source = 'customer' THEN
    RETURN 1;
  END IF;

  -- CNS bulk uploads
  IF p_job_type = 'bulk_upload' THEN
    RETURN 3;
  END IF;

  -- Default
  RETURN 5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.calculate_job_priority IS 'Auto-calculate job priority based on type and source';

-- ============================================================================
-- 8. ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.bulk_uploads_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_upload_items_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_jobs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_storage_v2 ENABLE ROW LEVEL SECURITY;

-- Bulk uploads: CNS admins only
CREATE POLICY bulk_uploads_admin_policy ON public.bulk_uploads_v2
  FOR ALL
  USING (public.is_super_admin() OR public.is_admin());

-- Bulk upload items: CNS admins only
CREATE POLICY bulk_upload_items_admin_policy ON public.bulk_upload_items_v2
  FOR ALL
  USING (
    public.is_super_admin() OR public.is_admin()
  );

-- BOM jobs: Users see their own, admins see all
CREATE POLICY bom_jobs_select_policy ON public.bom_jobs_v2
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_admin()
    OR (tenant_id = public.current_user_tenant() AND job_type = 'customer_bom')
    OR created_by = public.current_app_user_id()
  );

-- BOM jobs: Users can pause/resume their own, admins can do anything
CREATE POLICY bom_jobs_update_policy ON public.bom_jobs_v2
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.is_admin()
    OR (tenant_id = public.current_user_tenant() AND created_by = public.current_app_user_id())
  );

-- Job progress: Users see their own, admins see all
CREATE POLICY job_progress_select_policy ON public.job_progress_v2
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bom_jobs_v2 j
      WHERE j.id = job_progress_v2.job_id
      AND (
        public.is_super_admin()
        OR public.is_admin()
        OR j.tenant_id = public.current_user_tenant()
        OR j.created_by = public.current_app_user_id()
      )
    )
  );

-- File storage: Users see their own, admins see all
CREATE POLICY file_storage_select_policy ON public.file_storage_v2
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bom_jobs_v2 j
      WHERE j.id = file_storage_v2.job_id
      AND (
        public.is_super_admin()
        OR public.is_admin()
        OR j.tenant_id = public.current_user_tenant()
        OR j.created_by = public.current_app_user_id()
      )
    )
  );

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulk_uploads_updated_at
  BEFORE UPDATE ON public.bulk_uploads_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 10. SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample bulk upload (if none exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bulk_uploads_v2 LIMIT 1) THEN
    INSERT INTO public.bulk_uploads_v2 (
      name,
      description,
      filename,
      file_url,
      file_size,
      total_items,
      created_by
    ) VALUES (
      'Sample Bulk Upload',
      'Test bulk upload for development',
      'sample_bulk_1000.csv',
      's3://bulk-uploads/uploads/sample/original.csv',
      524288,
      1000,
      (SELECT id FROM public.users_v2 WHERE email = 'sfield@example.com' LIMIT 1)
    );
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'BOM Enrichment Platform v004 - Complete workflow support';

-- Verify migration
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'bulk_uploads_v2',
    'bulk_upload_items_v2',
    'bom_jobs_v2',
    'job_progress_v2',
    'file_storage_v2'
  );

  IF table_count = 5 THEN
    RAISE NOTICE '✅ Migration 004 complete: All % tables created', table_count;
  ELSE
    RAISE WARNING '⚠️  Migration 004 incomplete: Only % of 5 tables found', table_count;
  END IF;
END $$;
