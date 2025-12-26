-- Migration: Add priority and audit trail fields to boms table
-- Purpose: Support priority-based enrichment and audit file tracking
-- Created: Nov 15, 2025

-- Add priority field for enrichment prioritization
ALTER TABLE IF EXISTS public.boms
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('high', 'normal'));

-- Add audit trail fields for raw and parsed file tracking
ALTER TABLE IF EXISTS public.boms
ADD COLUMN IF NOT EXISTS raw_file_s3_key TEXT,
ADD COLUMN IF NOT EXISTS parsed_file_s3_key TEXT;

-- Add index for priority-based enrichment queue ordering
CREATE INDEX IF NOT EXISTS idx_boms_priority_status
  ON public.boms(priority DESC, enrichment_status, created_at);

-- Comments for documentation
COMMENT ON COLUMN public.boms.priority IS 'Enrichment priority: high (customer BOMs) or normal (staff BOMs). Affects processing order and batch size.';
COMMENT ON COLUMN public.boms.raw_file_s3_key IS 'S3/MinIO key for original uploaded file (audit/recovery)';
COMMENT ON COLUMN public.boms.parsed_file_s3_key IS 'S3/MinIO key for parsed snapshot JSON (audit/verification)';
COMMENT ON INDEX public.idx_boms_priority_status IS 'Optimizes enrichment queue queries: high priority first, then by status and creation time';
