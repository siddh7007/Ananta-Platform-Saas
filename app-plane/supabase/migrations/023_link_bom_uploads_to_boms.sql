-- Migration: Link bom_uploads to boms via bom_id
-- Purpose: Add a direct relationship between raw upload records and
--          the BOMs created from them so enrichment can reliably use
--          the BOM ID instead of overloading bom_uploads.id.

ALTER TABLE IF EXISTS public.bom_uploads
ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL;

-- Optional index to speed up lookups from uploads to BOMs
CREATE INDEX IF NOT EXISTS idx_bom_uploads_bom_id ON public.bom_uploads(bom_id);

COMMENT ON COLUMN public.bom_uploads.bom_id IS 'BOM ID created from this upload (public.boms.id). Enables correct enrichment targeting.';

-- Backfill existing rows where we can infer the relationship
UPDATE public.bom_uploads u
SET bom_id = b.id
FROM public.boms b
WHERE u.bom_id IS NULL
  AND (
    b.metadata->>'bom_upload_id' = u.id::text
    OR b.metadata->>'upload_id' = u.id::text
  );

