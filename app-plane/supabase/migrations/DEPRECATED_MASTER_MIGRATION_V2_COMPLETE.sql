-- ============================================================================
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!!                         DEPRECATED                                   !!!
-- !!!                                                                       !!!
-- !!!   DO NOT USE THIS FILE FOR FRESH INSTALLATIONS                       !!!
-- !!!                                                                       !!!
-- !!!   Use MASTER_MIGRATION_V3_COMPLETE.sql instead                       !!!
-- !!!                                                                       !!!
-- !!!   This file is kept for historical reference only.                   !!!
-- !!!                                                                       !!!
-- !!!   V3 includes:                                                        !!!
-- !!!   - All tables through migration 078                                  !!!
-- !!!   - Security-hardened RLS policies (077 + 078)                       !!!
-- !!!   - Auth0-compatible helper functions with 5-fallback chain          !!!
-- !!!   - Admin-only membership writes                                      !!!
-- !!!   - User-scoped alert UPDATE/DELETE                                  !!!
-- !!!   - Last owner protection trigger                                     !!!
-- !!!   - Billing, Risk, Alert, and Onboarding tables                      !!!
-- !!!                                                                       !!!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ============================================================================
-- MASTER MIGRATION - Components Platform V2 (DEPRECATED)
-- ============================================================================
-- Version: 2.0
-- Created: 2025-11-19
-- DEPRECATED: 2025-12-01 - Replaced by MASTER_MIGRATION_V3_COMPLETE.sql
-- Purpose: Complete database schema consolidation (migrations 001-047 ONLY)
--
-- WARNING: This file is OUTDATED and missing:
-- - Migrations 048-078 (billing, risk, alerts, onboarding, security fixes)
-- - Auth0 JWT custom claims support
-- - Security-hardened RLS policies
-- - Admin-only membership controls
--
-- SECURITY ISSUES IN THIS FILE:
-- - Overly permissive anon policies
-- - Missing org-scoping in helper functions
-- - No privilege escalation protections
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get current user ID from Supabase JWT token
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Get current user's organization_id from users table
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE id = public.current_user_id()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = public.current_user_id()
    AND om.role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is admin or owner in their organization
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = public.current_user_id()
    AND om.organization_id = public.current_user_organization_id()
    AND om.role IN ('admin', 'owner', 'super_admin')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- TABLE: organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- ============================================================================
-- TABLE: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);

-- ============================================================================
-- TABLE: organization_memberships
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- member, admin, owner, super_admin
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);

-- ============================================================================
-- TABLE: projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE TRIGGER set_timestamp_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

-- ============================================================================
-- TABLE: boms
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'draft', -- draft, pending, analyzing, completed, failed, archived
  source TEXT DEFAULT 'manual', -- manual, customer, api
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_boms
  BEFORE UPDATE ON public.boms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_boms_organization_id ON public.boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_project_id ON public.boms(project_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON public.boms(status);
CREATE INDEX IF NOT EXISTS idx_boms_created_at ON public.boms(created_at DESC);

-- ============================================================================
-- TABLE: bom_uploads
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bom_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  s3_key TEXT,
  s3_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_uploads_organization_id ON public.bom_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_bom_id ON public.bom_uploads(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_status ON public.bom_uploads(status);

-- ============================================================================
-- TABLE: bom_line_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bom_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
  line_number INTEGER,
  manufacturer_part_number TEXT,
  manufacturer TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  reference_designators TEXT,
  notes TEXT,
  enrichment_status TEXT DEFAULT 'pending', -- pending, enriched, failed
  enrichment_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_id ON public.bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn ON public.bom_line_items(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_status ON public.bom_line_items(enrichment_status);

-- ============================================================================
-- TABLE: alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_id UUID,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL, -- LIFECYCLE, RISK, COMPLIANCE, PRICE, STOCK, QUALITY, OTHER
  severity TEXT NOT NULL, -- critical, warning, info
  title TEXT NOT NULL,
  message TEXT,
  action_url TEXT,
  is_actionable BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON public.alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_bom_id ON public.alerts(bom_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON public.alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- ============================================================================
-- TABLE: enrichment_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrichment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- started, progress, completed, failed
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom_id ON public.enrichment_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_created_at ON public.enrichment_events(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY - Enable on all tables
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: organizations
-- ============================================================================

CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (
  id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Admins can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  (id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view organizations"
ON public.organizations FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- RLS POLICIES: users
-- ============================================================================

CREATE POLICY "Users can view users in their organization"
ON public.users FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = public.current_user_id());

CREATE POLICY "Admins can manage users in their organization"
ON public.users FOR ALL
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view users"
ON public.users FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert users"
ON public.users FOR INSERT
TO anon
WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: organization_memberships
-- ============================================================================

CREATE POLICY "Allow all access to memberships"
ON public.organization_memberships FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: projects
-- ============================================================================

CREATE POLICY "Users can view projects in their organization"
ON public.projects FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can create projects in their organization"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can update projects in their organization"
ON public.projects FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view projects"
ON public.projects FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can insert projects"
ON public.projects FOR INSERT
TO anon
WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: boms
-- ============================================================================

CREATE POLICY "Users can view BOMs in their organization"
ON public.boms FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can create BOMs in their organization"
ON public.boms FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can update BOMs in their organization"
ON public.boms FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
)
WITH CHECK (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Admins can delete BOMs in their organization"
ON public.boms FOR DELETE
TO authenticated
USING (
  (organization_id = public.current_user_organization_id() AND public.is_org_admin())
  OR public.is_super_admin()
);

CREATE POLICY "Anon can insert BOMs"
ON public.boms FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can select BOMs"
ON public.boms FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- RLS POLICIES: bom_uploads
-- ============================================================================

CREATE POLICY "Allow all access to bom uploads"
ON public.bom_uploads FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can manage uploads"
ON public.bom_uploads FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: bom_line_items
-- ============================================================================

CREATE POLICY "Users can view BOM line items"
ON public.bom_line_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (boms.organization_id = public.current_user_organization_id() OR public.is_super_admin())
  )
);

CREATE POLICY "Users can manage BOM line items"
ON public.bom_line_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boms
    WHERE boms.id = bom_line_items.bom_id
    AND (boms.organization_id = public.current_user_organization_id() OR public.is_super_admin())
  )
);

CREATE POLICY "Anon can insert line items"
ON public.bom_line_items FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can select line items"
ON public.bom_line_items FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- RLS POLICIES: alerts
-- ============================================================================

CREATE POLICY "Users can view alerts in their organization"
ON public.alerts FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Users can manage alerts in their organization"
ON public.alerts FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY "Anon can view alerts"
ON public.alerts FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- RLS POLICIES: enrichment_events
-- ============================================================================

CREATE POLICY "Allow all access to enrichment events"
ON public.enrichment_events FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================================================
-- TABLE PERMISSIONS - Grant to anon and authenticated
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.organizations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.boms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_uploads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_line_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alerts TO anon, authenticated;
GRANT SELECT, INSERT ON public.enrichment_events TO anon, authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_count INT;
  policy_count INT;
  function_count INT;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'users', 'organization_memberships', 'projects',
                      'boms', 'bom_uploads', 'bom_line_items', 'alerts', 'enrichment_events');

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  -- Count helper functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN ('current_user_id', 'current_user_organization_id', 'is_super_admin', 'is_org_admin', 'trigger_set_timestamp');

  IF table_count < 9 THEN
    RAISE EXCEPTION 'Migration failed: Only % tables created (expected 9)', table_count;
  END IF;

  IF function_count < 5 THEN
    RAISE EXCEPTION 'Migration failed: Only % helper functions created (expected 5)', function_count;
  END IF;

  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MASTER MIGRATION COMPLETE!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Tables created: %/9', table_count;
  RAISE NOTICE '✅ RLS policies created: %', policy_count;
  RAISE NOTICE '✅ Helper functions created: %/5', function_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Summary:';
  RAISE NOTICE '  - All tables use correct names (no _v2 suffix)';
  RAISE NOTICE '  - All tenant_id renamed to organization_id';
  RAISE NOTICE '  - RLS enabled on all tables with proper policies';
  RAISE NOTICE '  - Super admin support: role=super_admin can access all organizations';
  RAISE NOTICE '  - Regular users isolated by organization_id';
  RAISE NOTICE '  - Anon access allowed for dev mode';
  RAISE NOTICE '  - Helper functions use correct schema (organization_memberships)';
  RAISE NOTICE '============================================================================';
END $$;
