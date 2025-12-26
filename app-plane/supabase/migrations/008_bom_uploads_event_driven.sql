-- Migration: Event-Driven BOM Upload Architecture
-- Created: 2025-11-10
-- Purpose: Add bom_uploads table for event-driven processing via RabbitMQ + Temporal

-- ============================================================================
-- BOM Uploads Table (Raw File Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bom_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File metadata
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL, -- 'csv', 'xlsx', 'xls'
    raw_file_url TEXT, -- MinIO/S3 URL for raw file

    -- Multi-tenancy (UUIDs for Supabase compatibility)
    tenant_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects_v2(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES public.users_v2(id) ON DELETE SET NULL,

    -- Parse status
    status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'parsing', 'parsed', 'mapping_pending', 'ready_for_enrichment', 'processing', 'completed', 'failed'

    -- Detected columns (from parser)
    detected_columns JSONB, -- { "Part Number": "mpn", "Quantity": "quantity", ... }
    unmapped_columns TEXT[], -- Columns that couldn't be auto-mapped

    -- User-confirmed column mappings
    column_mappings JSONB, -- User's final column mapping choices
    mapping_confirmed BOOLEAN DEFAULT false,
    mapping_confirmed_at TIMESTAMPTZ,

    -- Parsed data preview
    total_rows INTEGER DEFAULT 0,
    preview_data JSONB, -- First 10 rows for user preview

    -- Processing metadata
    parse_stats JSONB, -- { "total_rows": 100, "valid_rows": 95, "errors": 5 }
    processing_settings JSONB, -- User preferences: merge strategy, validation rules, etc.

    -- Event tracking
    rabbitmq_event_published BOOLEAN DEFAULT false,
    rabbitmq_event_published_at TIMESTAMPTZ,
    temporal_workflow_id TEXT, -- Temporal workflow execution ID
    temporal_workflow_status TEXT, -- 'pending', 'running', 'completed', 'failed'

    -- Results (after enrichment)
    enrichment_job_id TEXT, -- Reference to downstream enrichment job
    error_message TEXT,
    error_details JSONB,

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ -- Soft delete
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bom_uploads_tenant_id ON public.bom_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_organization_id ON public.bom_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_project_id ON public.bom_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_uploaded_by ON public.bom_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_status ON public.bom_uploads(status);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_created_at ON public.bom_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_workflow_id ON public.bom_uploads(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_rabbitmq_published ON public.bom_uploads(rabbitmq_event_published) WHERE rabbitmq_event_published = false;

-- ============================================================================
-- Auto-update updated_at Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_bom_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_bom_uploads_updated_at ON public.bom_uploads;
CREATE TRIGGER trigger_update_bom_uploads_updated_at
  BEFORE UPDATE ON public.bom_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bom_uploads_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see BOMs from their tenant
CREATE POLICY "bom_uploads_select_policy"
  ON public.bom_uploads
  FOR SELECT
  USING (
    is_super_admin() OR (tenant_id = current_user_tenant())
  );

-- Policy: Users can insert BOMs for their tenant
CREATE POLICY "bom_uploads_insert_policy"
  ON public.bom_uploads
  FOR INSERT
  WITH CHECK (
    is_super_admin() OR (is_engineer() AND tenant_id = current_user_tenant())
  );

-- Policy: Users can update BOMs from their tenant (for column mapping confirmation)
CREATE POLICY "bom_uploads_update_policy"
  ON public.bom_uploads
  FOR UPDATE
  USING (
    is_super_admin() OR (is_admin() AND tenant_id = current_user_tenant()) OR (is_engineer() AND uploaded_by = current_app_user_id())
  );

-- Policy: Admins can delete BOMs
CREATE POLICY "bom_uploads_delete_policy"
  ON public.bom_uploads
  FOR DELETE
  USING (
    is_super_admin() OR (is_admin() AND tenant_id = current_user_tenant())
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Mark upload as ready for enrichment (after column mapping confirmed)
CREATE OR REPLACE FUNCTION public.mark_bom_upload_ready_for_enrichment(
  p_upload_id UUID,
  p_column_mappings JSONB
)
RETURNS public.bom_uploads AS $$
DECLARE
  v_upload public.bom_uploads;
BEGIN
  UPDATE public.bom_uploads
  SET
    status = 'ready_for_enrichment',
    column_mappings = p_column_mappings,
    mapping_confirmed = true,
    mapping_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id
  RETURNING * INTO v_upload;

  RETURN v_upload;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update Temporal workflow status
CREATE OR REPLACE FUNCTION public.update_bom_upload_workflow_status(
  p_upload_id UUID,
  p_workflow_id TEXT,
  p_status TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    temporal_workflow_id = p_workflow_id,
    temporal_workflow_status = p_status,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark RabbitMQ event as published
CREATE OR REPLACE FUNCTION public.mark_bom_upload_event_published(
  p_upload_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    rabbitmq_event_published = true,
    rabbitmq_event_published_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.bom_uploads IS 'Stores raw BOM file uploads before enrichment processing. Event-driven architecture via RabbitMQ + Temporal.';
COMMENT ON COLUMN public.bom_uploads.status IS 'Upload lifecycle: uploaded → parsing → parsed → mapping_pending → ready_for_enrichment → processing → completed/failed';
COMMENT ON COLUMN public.bom_uploads.detected_columns IS 'Auto-detected column mappings from parser';
COMMENT ON COLUMN public.bom_uploads.column_mappings IS 'User-confirmed final column mappings';
COMMENT ON COLUMN public.bom_uploads.rabbitmq_event_published IS 'True when customer.bom.uploaded event has been published to RabbitMQ';
COMMENT ON COLUMN public.bom_uploads.temporal_workflow_id IS 'Temporal workflow execution ID for tracking async processing';
