-- Add enrichment audit trail toggle to enrichment_config table
-- Date: 2025-11-12

-- Add enable_enrichment_audit column
ALTER TABLE enrichment_config
  ADD COLUMN IF NOT EXISTS enable_enrichment_audit BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN enrichment_config.enable_enrichment_audit IS
  'Enable CSV/S3 audit trail for enrichment debugging (vendor responses, normalized data, quality scores)';

-- Update existing configs to have audit enabled by default
UPDATE enrichment_config
SET enable_enrichment_audit = TRUE
WHERE enable_enrichment_audit IS NULL;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Added enable_enrichment_audit column to enrichment_config table';
  RAISE NOTICE 'Default value: TRUE (audit trail enabled)';
  RAISE NOTICE 'Audit files stored in MinIO: enrichment-audit/{job_id}/{filename}.csv';
END $$;
