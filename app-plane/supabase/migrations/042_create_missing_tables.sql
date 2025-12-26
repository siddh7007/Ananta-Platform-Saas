-- Create missing tables referenced by code
-- Created: 2025-11-19
-- Purpose: Add organization_memberships and enrichment_events tables

-- ============================================================================
-- organization_memberships - User roles within organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_v2(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(organization_id);

-- RLS
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to memberships"
ON public.organization_memberships FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO anon, authenticated;

-- ============================================================================
-- enrichment_events - Real-time enrichment progress events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrichment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID,
  upload_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_events_org ON public.enrichment_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom ON public.enrichment_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_upload ON public.enrichment_events(upload_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_created ON public.enrichment_events(created_at DESC);

-- RLS
ALTER TABLE public.enrichment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to enrichment events"
ON public.enrichment_events FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Permissions
GRANT SELECT, INSERT ON public.enrichment_events TO anon, authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Created missing tables: organization_memberships, enrichment_events';
END $$;
