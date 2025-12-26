-- ============================================================================
-- MASTER MIGRATION V4 - Arc-SaaS App Plane with Keycloak Integration
-- ============================================================================
-- Version: 4.0
-- Created: 2025-12-08
-- Based on: Components Platform V2 MASTER_MIGRATION_V3 + Keycloak JWT Auth
--
-- Purpose: Complete database schema for Arc-SaaS App Plane with Keycloak authentication
--
-- KEY CHANGES FROM V3:
-- - Replaced Auth0 JWT functions with Keycloak JWT functions
-- - tenant_id (Control Plane) === organization_id (App Plane)
-- - Uses keycloak_user_id instead of auth0_user_id
-- - Compatible with Arc-SaaS Control Plane tenant provisioning
--
-- Keycloak JWT Claims Used:
--   - sub: User ID (UUID)
--   - tenant_id: Organization/Tenant ID (custom claim)
--   - email: User email
--   - realm_access.roles: User roles array
--   - resource_access.arc-saas.roles: Client-specific roles
--
-- SECURITY FEATURES:
-- - Admin-only membership writes (prevents privilege escalation)
-- - User-scoped alert UPDATE/DELETE
-- - Last owner protection trigger
-- - System insert tables use SECURITY DEFINER functions
-- ============================================================================

-- NOTE: No BEGIN/COMMIT transaction - individual statements succeed independently
-- This allows partial application even if some statements fail (e.g., "already exists")

-- ============================================================================
-- SECTION 0: AUTH SCHEMA AND JWT FUNCTIONS (Keycloak)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Function to get full JWT claims as JSONB
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        '{}'::jsonb
    );
$$;

COMMENT ON FUNCTION auth.jwt() IS 'Returns full JWT claims from PostgREST request.jwt.claims setting';

-- Function to get user ID from JWT sub claim
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'sub',
        NULL
    )::uuid;
$$;

COMMENT ON FUNCTION auth.uid() IS 'Returns user ID (sub claim) from Keycloak JWT';

-- Function to get tenant_id in auth schema (used by RLS policies)CREATE OR REPLACE FUNCTION auth.tenant_id()RETURNS UUID AS $$BEGIN  -- Try tenant_id first (Keycloak custom claim)  IF current_setting('request.jwt.claims', true)::json->>'tenant_id' IS NOT NULL THEN    RETURN (current_setting('request.jwt.claims', true)::json->>'tenant_id')::UUID;  END IF;  -- Fall back to userTenantId (Arc-SaaS claim name)  IF current_setting('request.jwt.claims', true)::json->>'userTenantId' IS NOT NULL THEN    RETURN (current_setting('request.jwt.claims', true)::json->>'userTenantId')::UUID;  END IF;  -- Fall back to organization_id (alternative claim name)  IF current_setting('request.jwt.claims', true)::json->>'organization_id' IS NOT NULL THEN    RETURN (current_setting('request.jwt.claims', true)::json->>'organization_id')::UUID;  END IF;  -- Fall back to organizations array (Keycloak group-based multi-tenancy)  IF current_setting('request.jwt.claims', true)::json->>'organizations' IS NOT NULL THEN    RETURN (current_setting('request.jwt.claims', true)::json->'organizations'->>0)::UUID;  END IF;  RETURN NULL;END;$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;COMMENT ON FUNCTION auth.tenant_id() IS 'Returns tenant_id from Keycloak JWT for RLS policies';GRANT EXECUTE ON FUNCTION auth.tenant_id() TO authenticated;GRANT EXECUTE ON FUNCTION auth.tenant_id() TO anon;
-- Function to get tenant_id from Keycloak JWT (maps to organization_id)
CREATE OR REPLACE FUNCTION keycloak_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'tenant_id',
        auth.jwt() ->> 'userTenantId',
        auth.jwt() -> 'organization' ->> 'id',
        NULL
    )::uuid;
$$;

COMMENT ON FUNCTION keycloak_tenant_id() IS
'Extracts tenant_id from Keycloak JWT. This equals organization_id in App Plane.';

-- Primary function for RLS policies (alias to keycloak_tenant_id)
CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT keycloak_tenant_id();
$$;

COMMENT ON FUNCTION current_user_organization_id() IS
'Returns the current users organization_id for RLS policies. Uses Keycloak tenant_id claim.';

-- Alias for backwards compatibility
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT keycloak_tenant_id();
$$;

-- Function to get Keycloak user_id (sub claim)
CREATE OR REPLACE FUNCTION keycloak_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() ->> 'sub';
$$;

-- Function to get user email from Keycloak JWT
CREATE OR REPLACE FUNCTION keycloak_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'email',
        auth.jwt() ->> 'preferred_username'
    );
$$;

-- Function to check if user is super admin (platform admin)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin', 'admin')
    )
    OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'resource_access' -> 'arc-saas' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin')
    )
    OR COALESCE(auth.jwt() ->> 'is_platform_admin', 'false')::boolean;
$$;

-- Function to get user role within their tenant
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        auth.jwt() ->> 'role',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'owner'
            ) THEN 'owner'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'admin'
            ) THEN 'admin'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'engineer'
            ) THEN 'engineer'
            WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(
                    COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
                ) AS r WHERE r = 'analyst'
            ) THEN 'analyst'
            ELSE 'member'
        END
    );
$$;

-- Alias for keycloak_user_role
CREATE OR REPLACE FUNCTION keycloak_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT current_user_role();
$$;

-- Function to check if user is admin of their organization
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
        OR is_super_admin();
$$;

-- Function for membership writes
CREATE OR REPLACE FUNCTION is_org_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
        OR is_super_admin();
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin_or_owner() TO authenticated, service_role;

-- ============================================================================
-- SECTION 1: EXTENSIONS AND ENUMS
-- ============================================================================

-- NOTE: Extensions are pre-installed in Supabase's postgres image
-- Commenting out to avoid permission errors with Supabase's internal extension scripts
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Subscription tiers
DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscription status
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice status
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TABLE: organizations
-- NOTE: id = tenant_id from Control Plane (set during provisioning)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  -- Profile fields
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  billing_email TEXT,
  -- Security policy fields
  require_mfa BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 30 CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 480),
  password_policy TEXT DEFAULT 'strong' CHECK (password_policy IN ('basic', 'strong', 'enterprise')),
  -- API & Integration fields
  api_access_enabled BOOLEAN DEFAULT true,
  webhooks_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  -- Data retention
  data_retention_days INTEGER DEFAULT 365 CHECK (data_retention_days >= 30 AND data_retention_days <= 3650),
  audit_log_retention_days INTEGER DEFAULT 90 CHECK (audit_log_retention_days >= 30 AND audit_log_retention_days <= 365),
  -- SSO
  sso_enabled BOOLEAN DEFAULT false,
  sso_provider TEXT DEFAULT 'keycloak' CHECK (sso_provider IN ('keycloak', 'saml', 'okta', 'azure', 'google')),
  -- Subscription tier (synced from Control Plane)
  tier TEXT DEFAULT 'basic',
  -- Onboarding
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_checklist JSONB DEFAULT '{"first_bom_uploaded": false, "first_enrichment_complete": false, "team_member_invited": false, "alert_preferences_configured": false, "risk_thresholds_set": false}'::jsonb,
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  domains TEXT[] DEFAULT '{}',
  -- Timestamps
  status TEXT DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_timestamp_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

-- TABLE: users
-- NOTE: keycloak_user_id = sub claim from Keycloak JWT
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  keycloak_user_id TEXT UNIQUE,
  is_platform_admin BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_keycloak_user_id ON public.users(keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;

-- TABLE: organization_memberships
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  welcome_sent_at TIMESTAMPTZ,
  first_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_role ON public.organization_memberships(user_id, role);

-- TABLE: organization_invitations
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);

-- TABLE: projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  start_date DATE,
  target_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE TRIGGER set_timestamp_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

-- TABLE: boms
CREATE TABLE IF NOT EXISTS public.boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'draft',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_boms
  BEFORE UPDATE ON public.boms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_boms_organization_id ON public.boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_project_id ON public.boms(project_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON public.boms(status);
CREATE INDEX IF NOT EXISTS idx_boms_created_at ON public.boms(created_at DESC);

-- TABLE: bom_uploads
CREATE TABLE IF NOT EXISTS public.bom_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  s3_key TEXT,
  s3_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_uploads_organization_id ON public.bom_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_bom_id ON public.bom_uploads(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_status ON public.bom_uploads(status);

-- TABLE: bom_line_items
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
  component_id INTEGER,
  enrichment_status TEXT DEFAULT 'pending',
  enrichment_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_id ON public.bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn ON public.bom_line_items(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_status ON public.bom_line_items(enrichment_status);

-- TABLE: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  notification_type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- TABLE: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================================
-- SECTION 3: ENRICHMENT TABLES
-- ============================================================================

-- TABLE: enrichment_queue
CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES public.boms(id) ON DELETE CASCADE,
  bom_line_item_id UUID REFERENCES public.bom_line_items(id) ON DELETE CASCADE,
  mpn TEXT NOT NULL,
  manufacturer TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON public.enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON public.enrichment_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_org ON public.enrichment_queue(organization_id);

-- TABLE: enrichment_events
CREATE TABLE IF NOT EXISTS public.enrichment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom_id ON public.enrichment_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_created_at ON public.enrichment_events(created_at DESC);

-- TABLE: enrichment_audit_log
CREATE TABLE IF NOT EXISTS public.enrichment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  line_item_id UUID REFERENCES public.bom_line_items(id) ON DELETE SET NULL,
  mpn TEXT,
  manufacturer TEXT,
  supplier TEXT,
  action TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_audit_org ON public.enrichment_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_audit_bom ON public.enrichment_audit_log(bom_id);

-- ============================================================================
-- SECTION 4: ALERT SYSTEM TABLES
-- ============================================================================

-- TABLE: alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  component_id UUID,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
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
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_bom_id ON public.alerts(bom_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON public.alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- TABLE: alert_preferences
CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN')),
  is_active BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  webhook_enabled BOOLEAN DEFAULT false,
  min_severity TEXT DEFAULT 'info' CHECK (min_severity IN ('critical', 'warning', 'info')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user ON public.alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_org ON public.alert_preferences(organization_id);

-- TABLE: alert_deliveries
CREATE TABLE IF NOT EXISTS public.alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON public.alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON public.alert_deliveries(status);

-- TABLE: component_watches
CREATE TABLE IF NOT EXISTS public.component_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  component_id UUID,
  mpn TEXT,
  manufacturer TEXT,
  watch_lifecycle BOOLEAN DEFAULT true,
  watch_price BOOLEAN DEFAULT true,
  watch_availability BOOLEAN DEFAULT true,
  watch_compliance BOOLEAN DEFAULT true,
  watch_supply_chain BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_watches_user ON public.component_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_component_watches_mpn ON public.component_watches(mpn);

-- ============================================================================
-- SECTION 5: RISK ANALYSIS TABLES
-- ============================================================================

-- TABLE: organization_risk_profiles
CREATE TABLE IF NOT EXISTS public.organization_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  lifecycle_weight INTEGER DEFAULT 30 CHECK (lifecycle_weight BETWEEN 0 AND 100),
  supply_chain_weight INTEGER DEFAULT 25 CHECK (supply_chain_weight BETWEEN 0 AND 100),
  compliance_weight INTEGER DEFAULT 20 CHECK (compliance_weight BETWEEN 0 AND 100),
  obsolescence_weight INTEGER DEFAULT 15 CHECK (obsolescence_weight BETWEEN 0 AND 100),
  single_source_weight INTEGER DEFAULT 10 CHECK (single_source_weight BETWEEN 0 AND 100),
  low_threshold INTEGER DEFAULT 30 CHECK (low_threshold BETWEEN 1 AND 99),
  medium_threshold INTEGER DEFAULT 60 CHECK (medium_threshold BETWEEN 1 AND 99),
  high_threshold INTEGER DEFAULT 85 CHECK (high_threshold BETWEEN 1 AND 99),
  quantity_weight DECIMAL(4,3) DEFAULT 0.150,
  lead_time_weight DECIMAL(4,3) DEFAULT 0.100,
  criticality_weight DECIMAL(4,3) DEFAULT 0.200,
  preset_name TEXT CHECK (preset_name IN ('default', 'automotive', 'medical', 'aerospace', 'consumer', 'industrial', 'custom')),
  custom_factors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CHECK (low_threshold < medium_threshold AND medium_threshold < high_threshold),
  CHECK (lifecycle_weight + supply_chain_weight + compliance_weight + obsolescence_weight + single_source_weight = 100)
);

CREATE INDEX IF NOT EXISTS idx_org_risk_profiles_org_id ON public.organization_risk_profiles(organization_id);

-- TABLE: component_base_risk_scores
CREATE TABLE IF NOT EXISTS public.component_base_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpn TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  lifecycle_risk INTEGER DEFAULT 0 CHECK (lifecycle_risk BETWEEN 0 AND 100),
  supply_chain_risk INTEGER DEFAULT 0 CHECK (supply_chain_risk BETWEEN 0 AND 100),
  compliance_risk INTEGER DEFAULT 0 CHECK (compliance_risk BETWEEN 0 AND 100),
  obsolescence_risk INTEGER DEFAULT 0 CHECK (obsolescence_risk BETWEEN 0 AND 100),
  single_source_risk INTEGER DEFAULT 0 CHECK (single_source_risk BETWEEN 0 AND 100),
  default_total_score INTEGER DEFAULT 0 CHECK (default_total_score BETWEEN 0 AND 100),
  default_risk_level TEXT CHECK (default_risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  risk_factors JSONB DEFAULT '{}'::jsonb,
  calculation_date TIMESTAMPTZ DEFAULT NOW(),
  calculation_method TEXT DEFAULT 'weighted_average_v1',
  data_sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  lead_time_days INTEGER,
  stock_quantity INTEGER,
  supplier_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mpn, manufacturer)
);

CREATE INDEX IF NOT EXISTS idx_component_base_risk_mpn ON public.component_base_risk_scores(mpn);
CREATE INDEX IF NOT EXISTS idx_component_base_risk_level ON public.component_base_risk_scores(default_risk_level);

-- TABLE: bom_line_item_risk_scores
CREATE TABLE IF NOT EXISTS public.bom_line_item_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_line_item_id UUID NOT NULL REFERENCES public.bom_line_items(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_risk_id UUID REFERENCES public.component_base_risk_scores(id) ON DELETE SET NULL,
  base_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (base_risk_score BETWEEN 0 AND 100),
  quantity_modifier INTEGER DEFAULT 0,
  lead_time_modifier INTEGER DEFAULT 0,
  criticality_modifier INTEGER DEFAULT 0,
  user_criticality_level INTEGER DEFAULT 5 CHECK (user_criticality_level BETWEEN 1 AND 10),
  contextual_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (contextual_risk_score BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  alternates_available INTEGER DEFAULT 0,
  alternate_risk_reduction INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_version_used UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bli_risk_bom_line_item ON public.bom_line_item_risk_scores(bom_line_item_id);
CREATE INDEX IF NOT EXISTS idx_bli_risk_org ON public.bom_line_item_risk_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_bli_risk_level ON public.bom_line_item_risk_scores(risk_level);

-- TABLE: bom_risk_summaries
CREATE TABLE IF NOT EXISTS public.bom_risk_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  low_risk_count INTEGER DEFAULT 0,
  medium_risk_count INTEGER DEFAULT 0,
  high_risk_count INTEGER DEFAULT 0,
  critical_risk_count INTEGER DEFAULT 0,
  total_line_items INTEGER DEFAULT 0,
  average_risk_score DECIMAL(5,2) DEFAULT 0,
  weighted_risk_score DECIMAL(5,2) DEFAULT 0,
  max_risk_score INTEGER DEFAULT 0,
  min_risk_score INTEGER DEFAULT 0,
  health_grade TEXT CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')) DEFAULT 'A',
  top_risk_factors JSONB DEFAULT '[]'::jsonb,
  top_risk_components JSONB DEFAULT '[]'::jsonb,
  previous_average_score DECIMAL(5,2),
  score_trend TEXT CHECK (score_trend IN ('improving', 'stable', 'worsening')) DEFAULT 'stable',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_version_used UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_bom ON public.bom_risk_summaries(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_org ON public.bom_risk_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_risk_summary_grade ON public.bom_risk_summaries(health_grade);

-- TABLE: project_risk_summaries
CREATE TABLE IF NOT EXISTS public.project_risk_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_boms INTEGER DEFAULT 0,
  healthy_boms INTEGER DEFAULT 0,
  at_risk_boms INTEGER DEFAULT 0,
  critical_boms INTEGER DEFAULT 0,
  total_components INTEGER DEFAULT 0,
  unique_components INTEGER DEFAULT 0,
  average_bom_health_score DECIMAL(5,2) DEFAULT 0,
  weighted_project_score DECIMAL(5,2) DEFAULT 0,
  low_risk_total INTEGER DEFAULT 0,
  medium_risk_total INTEGER DEFAULT 0,
  high_risk_total INTEGER DEFAULT 0,
  critical_risk_total INTEGER DEFAULT 0,
  top_risk_factors JSONB DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_risk_summary_project ON public.project_risk_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risk_summary_org ON public.project_risk_summaries(organization_id);

-- TABLE: risk_score_history
CREATE TABLE IF NOT EXISTS public.risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bom', 'component', 'project')),
  entity_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_risk_score INTEGER NOT NULL CHECK (total_risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  score_change INTEGER DEFAULT 0,
  lifecycle_risk INTEGER,
  supply_chain_risk INTEGER,
  compliance_risk INTEGER,
  obsolescence_risk INTEGER,
  single_source_risk INTEGER,
  health_grade TEXT CHECK (health_grade IN ('A', 'B', 'C', 'D', 'F')),
  recorded_date TIMESTAMPTZ DEFAULT NOW(),
  calculation_method TEXT
);

-- Use unique index for expression-based uniqueness (cast to DATE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_history_unique_daily ON public.risk_score_history(entity_type, entity_id, (recorded_date::DATE));
CREATE INDEX IF NOT EXISTS idx_risk_history_entity ON public.risk_score_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_org ON public.risk_score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_date ON public.risk_score_history(recorded_date DESC);

-- ============================================================================
-- SECTION 6: BILLING TABLES
-- ============================================================================

-- TABLE: subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier subscription_tier NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'month',
  trial_days INTEGER DEFAULT 0,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  features TEXT[],
  is_popular BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  provider_plan_ids JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON public.subscription_plans(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active) WHERE is_active = TRUE;

-- TABLE: billing_customers
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  billing_email TEXT NOT NULL,
  billing_name TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  tax_id TEXT,
  tax_exempt BOOLEAN DEFAULT FALSE,
  provider_customer_ids JSONB DEFAULT '{}'::jsonb,
  default_payment_method_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_org ON public.billing_customers(organization_id);

-- TABLE: payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  display_name TEXT,
  brand TEXT,
  last_four TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  provider TEXT NOT NULL,
  provider_payment_method_id TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_valid BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_customer ON public.payment_methods(billing_customer_id);

-- TABLE: subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  provider TEXT,
  provider_subscription_id TEXT,
  provider_data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- TABLE: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  billing_customer_id UUID NOT NULL REFERENCES public.billing_customers(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  amount_due INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  provider TEXT,
  provider_invoice_id TEXT,
  provider_data JSONB DEFAULT '{}'::jsonb,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- TABLE: invoice_line_items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  type TEXT DEFAULT 'subscription',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

-- TABLE: payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id UUID NOT NULL REFERENCES public.billing_customers(id),
  invoice_id UUID REFERENCES public.invoices(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  provider_data JSONB DEFAULT '{}'::jsonb,
  failure_code TEXT,
  failure_message TEXT,
  refunded_amount INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- TABLE: usage_records
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  usage_type TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reported_to_provider BOOLEAN DEFAULT FALSE,
  provider_usage_record_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, usage_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_records_org ON public.usage_records(organization_id);

-- ============================================================================
-- SECTION 7: ONBOARDING & AUDIT TABLES
-- ============================================================================

-- TABLE: onboarding_events
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_org ON public.onboarding_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user ON public.onboarding_events(user_id, created_at DESC);

-- TABLE: organization_settings_audit
CREATE TABLE IF NOT EXISTS public.organization_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  setting_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_org_settings_audit_org ON public.organization_settings_audit(organization_id, changed_at DESC);

-- TABLE: account_deletion_audit
CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  deletion_type TEXT NOT NULL,
  data_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_org ON public.account_deletion_audit(organization_id);

-- ============================================================================
-- SECTION 8: SECURITY TRIGGERS
-- ============================================================================

-- Trigger: Prevent removing last owner
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    owner_count INTEGER;
BEGIN
    IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
        SELECT COUNT(*) INTO owner_count
        FROM organization_memberships
        WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND user_id != OLD.user_id;

        IF owner_count = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last owner of an organization';
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner' THEN
        SELECT COUNT(*) INTO owner_count
        FROM organization_memberships
        WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND user_id != OLD.user_id;

        IF owner_count = 0 THEN
            RAISE EXCEPTION 'Cannot demote the last owner of an organization';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_owner_removal_trigger ON organization_memberships;
CREATE TRIGGER prevent_last_owner_removal_trigger
    BEFORE DELETE OR UPDATE ON organization_memberships
    FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();

-- SECURITY DEFINER function for system inserts (onboarding_events)
CREATE OR REPLACE FUNCTION insert_onboarding_event(
    p_user_id UUID,
    p_organization_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_id UUID;
    caller_role TEXT;
BEGIN
    SELECT current_setting('role', true) INTO caller_role;
    IF caller_role != 'service_role' THEN
        RAISE EXCEPTION 'insert_onboarding_event can only be called by service_role';
    END IF;

    INSERT INTO onboarding_events (user_id, organization_id, event_type, event_data, created_at)
    VALUES (p_user_id, p_organization_id, p_event_type, p_event_data, NOW())
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION insert_onboarding_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_onboarding_event TO service_role;

-- ============================================================================
-- SECTION 9: PROVISIONING HELPER FUNCTIONS (For Control Plane Integration)
-- ============================================================================

-- Function to create a tenant organization (called by webhook-bridge)
CREATE OR REPLACE FUNCTION create_tenant_organization(
    p_organization_id UUID,
    p_name TEXT,
    p_slug TEXT,
    p_tier TEXT DEFAULT 'basic',
    p_domains TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO organizations (id, name, slug, tier, domains, settings, status, created_at, updated_at)
    VALUES (
        p_organization_id,
        p_name,
        p_slug,
        p_tier,
        p_domains,
        jsonb_build_object(
            'max_users', CASE p_tier WHEN 'premium' THEN 100 WHEN 'standard' THEN 25 ELSE 10 END,
            'max_components', CASE p_tier WHEN 'premium' THEN 10000 WHEN 'standard' THEN 1000 ELSE 100 END,
            'max_storage_gb', CASE p_tier WHEN 'premium' THEN 100 WHEN 'standard' THEN 25 ELSE 10 END
        ),
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        tier = EXCLUDED.tier,
        domains = EXCLUDED.domains,
        updated_at = NOW();

    RETURN p_organization_id;
END;
$$;

-- Function to provision a user in an organization (called by webhook-bridge)
CREATE OR REPLACE FUNCTION provision_user_in_organization(
    p_keycloak_user_id TEXT,
    p_email TEXT,
    p_full_name TEXT,
    p_organization_id UUID,
    p_role TEXT DEFAULT 'viewer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users (keycloak_user_id, email, full_name, created_at, updated_at)
    VALUES (p_keycloak_user_id, p_email, p_full_name, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
        keycloak_user_id = COALESCE(EXCLUDED.keycloak_user_id, users.keycloak_user_id),
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    INSERT INTO organization_memberships (organization_id, user_id, role, created_at, updated_at)
    VALUES (p_organization_id, v_user_id, p_role, NOW(), NOW())
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
        role = CASE WHEN organization_memberships.role = 'owner' THEN 'owner' ELSE EXCLUDED.role END,
        updated_at = NOW();

    RETURN v_user_id;
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION create_tenant_organization TO service_role;
GRANT EXECUTE ON FUNCTION provision_user_in_organization TO service_role;

-- ============================================================================
-- SECTION 10: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_base_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_item_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_risk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 11: RLS POLICIES (Using Keycloak JWT Functions)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE POLICY "organizations_access" ON organizations FOR ALL
USING (id = current_user_organization_id() OR is_super_admin())
WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE POLICY "users_org_select" ON users FOR SELECT
USING (
    is_super_admin() OR
    id IN (SELECT user_id FROM organization_memberships WHERE organization_id = current_user_organization_id())
);

CREATE POLICY "users_own_update" ON users FOR UPDATE
USING (keycloak_user_id = keycloak_user_id() OR is_super_admin())
WITH CHECK (keycloak_user_id = keycloak_user_id() OR is_super_admin());

CREATE POLICY "users_super_admin_manage" ON users FOR ALL
USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- organization_memberships
-- ---------------------------------------------------------------------------
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
        AND (role NOT IN ('owner', 'super_admin') OR is_super_admin())
    )
);

CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
        AND (role NOT IN ('owner', 'super_admin') OR is_super_admin())
    )
);

CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
    )
);

-- ---------------------------------------------------------------------------
-- organization_invitations
-- ---------------------------------------------------------------------------
CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
    )
);

CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
    )
);

-- ---------------------------------------------------------------------------
-- ORG-SCOPED TABLES
-- ---------------------------------------------------------------------------

CREATE POLICY "projects_org_access" ON projects FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "boms_org_access" ON boms FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "bom_uploads_org_access" ON bom_uploads FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "bom_line_items_org_access" ON bom_line_items FOR ALL
USING (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM boms WHERE boms.id = bom_line_items.bom_id AND boms.organization_id = current_user_organization_id())
)
WITH CHECK (
    is_super_admin() OR
    EXISTS (SELECT 1 FROM boms WHERE boms.id = bom_line_items.bom_id AND boms.organization_id = current_user_organization_id())
);

CREATE POLICY "notifications_org_access" ON notifications FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "enrichment_queue_org_access" ON enrichment_queue FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "enrichment_events_org_access" ON enrichment_events FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "enrichment_audit_log_org_access" ON enrichment_audit_log FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
CREATE POLICY "alerts_org_select" ON alerts FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "alerts_org_insert" ON alerts FOR INSERT
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "alerts_user_update" ON alerts FOR UPDATE
USING (
    is_super_admin() OR
    (organization_id = current_user_organization_id() AND (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())))
);

CREATE POLICY "alerts_user_delete" ON alerts FOR DELETE
USING (
    is_super_admin() OR
    (organization_id = current_user_organization_id() AND is_org_admin_or_owner())
);

-- ---------------------------------------------------------------------------
-- USER-SCOPED TABLES
-- ---------------------------------------------------------------------------

CREATE POLICY "alert_preferences_user_access" ON alert_preferences FOR ALL
USING (
    is_super_admin() OR
    user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())
)
WITH CHECK (
    is_super_admin() OR
    user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())
);

CREATE POLICY "alert_deliveries_user_access" ON alert_deliveries FOR ALL
USING (is_super_admin() OR alert_id IN (SELECT id FROM alerts WHERE organization_id = current_user_organization_id()))
WITH CHECK (is_super_admin());

CREATE POLICY "component_watches_user_access" ON component_watches FOR ALL
USING (
    is_super_admin() OR
    user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())
)
WITH CHECK (
    is_super_admin() OR
    user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())
);

-- ---------------------------------------------------------------------------
-- RISK TABLES
-- ---------------------------------------------------------------------------

CREATE POLICY "organization_risk_profiles_org_access" ON organization_risk_profiles FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "bom_line_item_risk_scores_org_access" ON bom_line_item_risk_scores FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "bom_risk_summaries_org_access" ON bom_risk_summaries FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "project_risk_summaries_org_access" ON project_risk_summaries FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "risk_score_history_org_access" ON risk_score_history FOR ALL
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

CREATE POLICY "component_base_risk_scores_read" ON component_base_risk_scores FOR SELECT
TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- SPECIAL TABLES
-- ---------------------------------------------------------------------------

CREATE POLICY "audit_logs_org_select" ON audit_logs FOR SELECT
USING (is_super_admin() OR organization_id = current_user_organization_id());

CREATE POLICY "subscription_plans_public_read" ON subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "onboarding_events_no_direct_insert" ON onboarding_events FOR INSERT
WITH CHECK (false);

CREATE POLICY "onboarding_events_user_select" ON onboarding_events FOR SELECT
USING (
    is_super_admin() OR
    user_id IN (SELECT id FROM users WHERE keycloak_user_id = keycloak_user_id())
);

CREATE POLICY "organization_settings_audit_no_direct_insert" ON organization_settings_audit FOR INSERT
WITH CHECK (false);

CREATE POLICY "organization_settings_audit_admin_select" ON organization_settings_audit FOR SELECT
USING (is_super_admin() OR (organization_id = current_user_organization_id() AND is_org_admin_or_owner()));

CREATE POLICY "account_deletion_audit_owner_select" ON account_deletion_audit FOR SELECT
USING (
    is_super_admin() OR
    (organization_id = current_user_organization_id() AND current_user_role() = 'owner')
);

CREATE POLICY "account_deletion_audit_super_admin" ON account_deletion_audit FOR ALL
USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============================================================================
-- SECTION 12: GRANTS
-- ============================================================================

-- Core tables
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON boms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bom_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bom_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;

-- Enrichment tables
GRANT SELECT, INSERT, UPDATE, DELETE ON enrichment_queue TO authenticated;
GRANT SELECT, INSERT ON enrichment_events TO authenticated;
GRANT SELECT, INSERT ON enrichment_audit_log TO authenticated;

-- Alert tables
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_preferences TO authenticated;
GRANT SELECT ON alert_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON component_watches TO authenticated;

-- Risk tables
GRANT SELECT, INSERT, UPDATE ON organization_risk_profiles TO authenticated;
GRANT SELECT ON component_base_risk_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bom_line_item_risk_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bom_risk_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_risk_summaries TO authenticated;
GRANT SELECT, INSERT ON risk_score_history TO authenticated;

-- Billing tables
GRANT SELECT ON subscription_plans TO authenticated;

-- Onboarding
GRANT SELECT ON onboarding_events TO authenticated;
GRANT SELECT ON organization_settings_audit TO authenticated;

-- Full access for service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- SECTION 13: SEED DEFAULT SUBSCRIPTION PLANS
-- ============================================================================

INSERT INTO subscription_plans (name, tier, slug, price_monthly, price_yearly, limits, features, description, display_order) VALUES
('Free', 'free', 'free', 0, 0,
 '{"max_members": 1, "max_projects": 2, "max_bom_uploads_per_month": 5, "max_components_per_bom": 100, "max_api_calls_per_month": 100, "features": ["basic_enrichment"]}'::jsonb,
 ARRAY['5 BOM uploads/month', '100 components/BOM', 'Basic enrichment', 'Community support'],
 'Perfect for trying out the platform', 1),
('Starter', 'starter', 'starter', 2900, 29000,
 '{"max_members": 5, "max_projects": 10, "max_bom_uploads_per_month": 50, "max_components_per_bom": 500, "max_api_calls_per_month": 5000, "features": ["basic_enrichment", "export_csv", "export_excel", "email_support"]}'::jsonb,
 ARRAY['5 team members', '50 BOM uploads/month', '500 components/BOM', 'CSV & Excel export', 'Email support'],
 'For small teams getting started', 2),
('Professional', 'professional', 'professional', 9900, 99000,
 '{"max_members": 25, "max_projects": 50, "max_bom_uploads_per_month": 200, "max_components_per_bom": 2000, "max_api_calls_per_month": 50000, "features": ["basic_enrichment", "advanced_enrichment", "export_csv", "export_excel", "api_access", "priority_support", "custom_fields"]}'::jsonb,
 ARRAY['25 team members', '200 BOM uploads/month', '2000 components/BOM', 'Full API access', 'Advanced enrichment', 'Priority support'],
 'For growing engineering teams', 3),
('Enterprise', 'enterprise', 'enterprise', 0, 0,
 '{"max_members": -1, "max_projects": -1, "max_bom_uploads_per_month": -1, "max_components_per_bom": -1, "max_api_calls_per_month": -1, "features": ["basic_enrichment", "advanced_enrichment", "export_csv", "export_excel", "api_access", "priority_support", "custom_fields", "sso", "dedicated_support", "sla", "custom_integrations"]}'::jsonb,
 ARRAY['Unlimited team members', 'Unlimited BOMs', 'SSO/SAML', 'Dedicated support', 'SLA guarantee', 'Custom integrations'],
 'For large organizations with custom needs', 4)
ON CONFLICT (slug) DO NOTHING;

-- NOTE: Removed COMMIT since we're not using a transaction

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_count INT;
  policy_count INT;
  function_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO function_count FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MASTER MIGRATION V4 (KEYCLOAK) COMPLETE!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'RLS policies created: %', policy_count;
  RAISE NOTICE 'Functions created: %', function_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Key Features:';
  RAISE NOTICE '  - Keycloak JWT authentication (tenant_id, realm_access.roles)';
  RAISE NOTICE '  - Control Plane tenant_id === App Plane organization_id';
  RAISE NOTICE '  - Full CBP schema (32+ tables)';
  RAISE NOTICE '  - Admin-only membership writes';
  RAISE NOTICE '  - Last owner protection trigger';
  RAISE NOTICE '  - Provisioning helper functions for webhook-bridge';
  RAISE NOTICE '============================================================================';
END $$;
