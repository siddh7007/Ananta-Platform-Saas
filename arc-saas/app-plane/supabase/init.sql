-- Supabase PostgreSQL Initialization Script
-- Creates required schemas and basic structures
--
-- ============================================================================
-- IMPORTANT: For new deployments, use MASTER_MIGRATION_V4_KEYCLOAK.sql instead
-- ============================================================================
-- This init.sql file is preserved for backwards compatibility and contains:
-- - Storage schema setup
-- - BOM pipeline tables (integer IDs)
-- - V2 multi-tenant tables (UUID IDs)
-- - Keycloak auth functions
--
-- For new deployments, apply the V4 migration which includes:
-- - Complete bom-portal schema from components-platform-v2
-- - Keycloak JWT integration (auth.tenant_id() function)
-- - All RLS policies for multi-tenant isolation
--
-- To apply V4 migration to an existing Supabase instance:
--   docker exec -i arc-saas-supabase-db psql -U postgres -d supabase < migrations/MASTER_MIGRATION_V4_KEYCLOAK.sql
--
-- ============================================================================

-- Create required schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS realtime;

-- Create database roles with passwords
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin LOGIN NOINHERIT CREATEROLE CREATEDB PASSWORD 'supabase-postgres-secure-2024';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'supabase-postgres-secure-2024';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE PASSWORD 'supabase-postgres-secure-2024';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'supabase-postgres-secure-2024';
    END IF;
END
$$;

-- Grant permissions
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA realtime TO postgres, anon, authenticated, service_role;

-- =====================================================================
-- Supabase Storage: ensure extension, tables, and ownership
-- Idempotent: safe to re-run
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core storage tables (minimal base - migrations will add additional columns)
-- NOTE: Do NOT add columns here that migrations expect to add (e.g., path_tokens, public, etc.)
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb
);

CREATE TABLE IF NOT EXISTS storage.migrations (
    id integer PRIMARY KEY,
    name varchar(100) NOT NULL UNIQUE,
    hash varchar(40) NOT NULL,
    executed_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Ensure correct ownership for storage-api connection user
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER TABLE IF EXISTS storage.objects OWNER TO supabase_storage_admin;
ALTER TABLE IF EXISTS storage.buckets OWNER TO supabase_storage_admin;
ALTER TABLE IF EXISTS storage.migrations OWNER TO supabase_storage_admin;

-- Ensure privileges
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;

-- =====================================================================
-- BOM Pipeline Tables for Customer Uploads (used by CNS with Supabase DB)
-- Idempotent and aligned with CNS model types
-- =====================================================================

-- BOM Upload Jobs
CREATE TABLE IF NOT EXISTS public.bom_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,

    -- Customer info
    customer_id INTEGER,
    customer_name VARCHAR(255),

    -- File info
    filename VARCHAR(255),
    file_size INTEGER,
    total_items INTEGER,

    -- Processing status
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,

    -- Results counters
    items_processed INTEGER DEFAULT 0,
    items_auto_approved INTEGER DEFAULT 0,
    items_in_staging INTEGER DEFAULT 0,
    items_rejected INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,

    -- Error and results
    error_message TEXT,
    results_data JSONB,

    -- Multi-tenancy (match CNS model: integers)
    organization_id INTEGER,
    project_id INTEGER,
    source VARCHAR(50) DEFAULT 'customer',
    source_metadata JSONB,
    priority INTEGER DEFAULT 5,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_jobs_job_id ON public.bom_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_status ON public.bom_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_created_at ON public.bom_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_organization_id ON public.bom_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_project_id ON public.bom_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_source ON public.bom_jobs(source);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_bom_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bom_jobs_updated_at'
  ) THEN
    CREATE TRIGGER bom_jobs_updated_at
      BEFORE UPDATE ON public.bom_jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.update_bom_jobs_updated_at();
  END IF;
END $$;

-- BOM Line Items for each job
CREATE TABLE IF NOT EXISTS public.bom_items (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) NOT NULL,
    line_number INTEGER NOT NULL,

    -- Input data
    mpn VARCHAR(255),
    manufacturer VARCHAR(255),
    quantity INTEGER,
    reference_designator TEXT,
    description TEXT,

    -- Enrichment results
    component_id INTEGER,
    enriched_mpn VARCHAR(255),
    enriched_manufacturer VARCHAR(255),
    specifications JSONB,
    datasheet_url TEXT,
    lifecycle_status VARCHAR(50),
    estimated_lifetime DATE,
    compliance_status JSONB,
    pricing JSONB,

    -- Quality & routing
    match_confidence DECIMAL(5,2),
    quality_score INTEGER,
    routing_destination VARCHAR(50) DEFAULT 'staging',
    enrichment_status VARCHAR(50) DEFAULT 'pending',

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT fk_bom_job FOREIGN KEY (job_id)
        REFERENCES public.bom_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bom_items_job_id ON public.bom_items(job_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_enrichment_status ON public.bom_items(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_bom_items_routing_destination ON public.bom_items(routing_destination);
CREATE INDEX IF NOT EXISTS idx_bom_items_mpn ON public.bom_items(mpn);
CREATE INDEX IF NOT EXISTS idx_bom_items_manufacturer ON public.bom_items(manufacturer);
CREATE INDEX IF NOT EXISTS idx_bom_items_component_id ON public.bom_items(component_id);

CREATE OR REPLACE FUNCTION public.update_bom_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bom_items_updated_at'
  ) THEN
    CREATE TRIGGER bom_items_updated_at
      BEFORE UPDATE ON public.bom_items
      FOR EACH ROW
      EXECUTE FUNCTION public.update_bom_items_updated_at();
  END IF;
END $$;

-- Grants for API roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_items TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE bom_jobs_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE bom_items_id_seq TO authenticated, service_role;

-- Enable RLS and minimal policies (email-based)
ALTER TABLE public.bom_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bom_jobs_select ON public.bom_jobs;
CREATE POLICY bom_jobs_select ON public.bom_jobs
  FOR SELECT USING (
    public.is_platform_admin() OR
    (COALESCE(source_metadata->>'user_email', '') <> '' AND (source_metadata->>'user_email') = public.current_user_email())
  );

DROP POLICY IF EXISTS bom_items_select ON public.bom_items;
CREATE POLICY bom_items_select ON public.bom_items
  FOR SELECT USING (
    public.is_platform_admin() OR
    job_id IN (
      SELECT job_id FROM public.bom_jobs
      WHERE COALESCE(source_metadata->>'user_email', '') <> ''
        AND (source_metadata->>'user_email') = public.current_user_email()
    )
  );

-- =====================================================================
-- Helper functions
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate slug from name if not provided
CREATE OR REPLACE FUNCTION public.generate_slug_from_name()
RETURNS trigger AS $$
BEGIN
    -- Only generate slug if it's NULL or empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(
            regexp_replace(
                regexp_replace(
                    regexp_replace(trim(NEW.name), '[^\w\s-]', '', 'g'),  -- Remove special chars
                    '\s+', '-', 'g'                                        -- Replace spaces with hyphens
                ),
                '-+', '-', 'g'                                             -- Replace multiple hyphens with single
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Core multi-tenant schema (tenants, users, projects, components, BOMs, alerts)
-- =====================================================================

-- Tenants (Organizations)
CREATE TABLE IF NOT EXISTS public.tenants_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    subscription_status text NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
    plan_tier text NOT NULL DEFAULT 'standard',
    billing_email text,
    billing_contact_name text,
    billing_phone text,
    timezone text NOT NULL DEFAULT 'UTC',
    region text DEFAULT 'us-east-1',
    notes text,
    logo_url text,
    max_users integer NOT NULL DEFAULT 10,
    max_components integer NOT NULL DEFAULT 50000,
    max_storage_gb integer NOT NULL DEFAULT 100,
    current_users_count integer NOT NULL DEFAULT 0,
    current_components_count integer NOT NULL DEFAULT 0,
    current_storage_gb numeric(12,2) NOT NULL DEFAULT 0,
    trial_ends_at timestamptz,
    last_payment_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_v2_slug_idx ON public.tenants_v2(slug);
CREATE INDEX IF NOT EXISTS tenants_v2_subscription_status_idx ON public.tenants_v2(subscription_status);
CREATE INDEX IF NOT EXISTS tenants_v2_created_at_idx ON public.tenants_v2(created_at);

-- Auto-generate slug before insert or update
CREATE TRIGGER generate_slug_tenants_v2
BEFORE INSERT OR UPDATE ON public.tenants_v2
FOR EACH ROW
EXECUTE PROCEDURE public.generate_slug_from_name();

-- Update timestamp on update
CREATE TRIGGER set_timestamp_tenants_v2
BEFORE UPDATE ON public.tenants_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- Users
CREATE TABLE IF NOT EXISTS public.users_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    first_name text,
    last_name text,
    full_name text GENERATED ALWAYS AS (trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) STORED,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    job_title text,
    phone text,
    is_active boolean NOT NULL DEFAULT true,
    is_staff boolean NOT NULL DEFAULT false,
    platform_admin boolean NOT NULL DEFAULT false,
    email_verified boolean NOT NULL DEFAULT false,
    mfa_enabled boolean NOT NULL DEFAULT false,
    auth_provider text DEFAULT 'supabase',
    auth_subject text,
    last_login_at timestamptz,
    invited_by uuid REFERENCES public.users_v2(id),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_v2_tenant_idx ON public.users_v2(tenant_id);
CREATE INDEX IF NOT EXISTS users_v2_role_idx ON public.users_v2(role);

CREATE TRIGGER set_timestamp_users_v2
BEFORE UPDATE ON public.users_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- Projects
CREATE TABLE IF NOT EXISTS public.projects_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    project_code text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public')),
    project_owner_id uuid REFERENCES public.users_v2(id),
    created_by_id uuid REFERENCES public.users_v2(id),
    total_boms integer NOT NULL DEFAULT 0,
    completed_boms integer NOT NULL DEFAULT 0,
    in_progress_boms integer NOT NULL DEFAULT 0,
    total_components integer NOT NULL DEFAULT 0,
    start_date date,
    end_date date,
    last_activity_at timestamptz,
    tags text[],
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_v2_tenant_idx ON public.projects_v2(tenant_id);
CREATE INDEX IF NOT EXISTS projects_v2_status_idx ON public.projects_v2(status);
CREATE INDEX IF NOT EXISTS projects_v2_owner_idx ON public.projects_v2(project_owner_id);

CREATE TRIGGER set_timestamp_projects_v2
BEFORE UPDATE ON public.projects_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- Components
CREATE TABLE IF NOT EXISTS public.components_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    manufacturer_part_number text NOT NULL,
    manufacturer text,
    category text,
    description text,
    datasheet_url text,
    lifecycle_status text,
    lifecycle_change_date date,
    risk_level text CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED', 'CRITICAL') OR risk_level IS NULL),
    rohs_compliant text CHECK (rohs_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN') OR rohs_compliant IS NULL),
    reach_compliant text CHECK (reach_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN') OR reach_compliant IS NULL),
    has_alternatives boolean NOT NULL DEFAULT false,
    alternative_part_numbers text[],
    unit_price numeric(14,4),
    currency text DEFAULT 'USD',
    stock_quantity integer,
    moq integer,
    lead_time_days integer,
    quality_score numeric(5,2),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS components_v2_tenant_idx ON public.components_v2(tenant_id);
CREATE INDEX IF NOT EXISTS components_v2_mpn_idx ON public.components_v2(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS components_v2_manufacturer_idx ON public.components_v2(manufacturer);
CREATE INDEX IF NOT EXISTS components_v2_category_idx ON public.components_v2(category);

CREATE TRIGGER set_timestamp_components_v2
BEFORE UPDATE ON public.components_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- BOMs
CREATE TABLE IF NOT EXISTS public.boms_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects_v2(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    version text,
    grade text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'analyzing', 'completed', 'failed', 'archived')),
    workflow_status text CHECK (workflow_status IN ('queued', 'processing', 'completed', 'failed') OR workflow_status IS NULL),
    component_count integer NOT NULL DEFAULT 0,
    total_cost numeric(18,2) NOT NULL DEFAULT 0,
    high_risk_count integer NOT NULL DEFAULT 0,
    medium_risk_count integer NOT NULL DEFAULT 0,
    low_risk_count integer NOT NULL DEFAULT 0,
    last_analyzed_at timestamptz,
    last_synced_at timestamptz,
    created_by_id uuid REFERENCES public.users_v2(id),
    source text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boms_v2_tenant_idx ON public.boms_v2(tenant_id);
CREATE INDEX IF NOT EXISTS boms_v2_project_idx ON public.boms_v2(project_id);
CREATE INDEX IF NOT EXISTS boms_v2_status_idx ON public.boms_v2(status);

CREATE TRIGGER set_timestamp_boms_v2
BEFORE UPDATE ON public.boms_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- BOM Line Items
CREATE TABLE IF NOT EXISTS public.bom_line_items_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id uuid NOT NULL REFERENCES public.boms_v2(id) ON DELETE CASCADE,
    line_number integer,
    reference_designator text,
    manufacturer_part_number text,
    manufacturer text,
    description text,
    quantity numeric(18,4) NOT NULL DEFAULT 1,
    unit_price numeric(18,4),
    currency text DEFAULT 'USD',
    match_status text,
    risk_level text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bom_line_items_v2_bom_idx ON public.bom_line_items_v2(bom_id);

CREATE TRIGGER set_timestamp_bom_line_items_v2
BEFORE UPDATE ON public.bom_line_items_v2
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();

-- Alerts
CREATE TABLE IF NOT EXISTS public.alerts_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    component_id uuid REFERENCES public.components_v2(id) ON DELETE SET NULL,
    bom_id uuid REFERENCES public.boms_v2(id) ON DELETE SET NULL,
    alert_type text NOT NULL,
    severity text NOT NULL DEFAULT 'INFO',
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    dismissed boolean NOT NULL DEFAULT false,
    dismissed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_v2_tenant_idx ON public.alerts_v2(tenant_id);
CREATE INDEX IF NOT EXISTS alerts_v2_component_idx ON public.alerts_v2(component_id);
CREATE INDEX IF NOT EXISTS alerts_v2_severity_idx ON public.alerts_v2(severity);

-- =====================================================================
-- Seed data for development (default tenant & admin user)
-- =====================================================================

INSERT INTO public.tenants_v2 (id, slug, name, subscription_status, plan_tier, billing_email, created_at, updated_at)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'ananta',
    'Ananta Platform',
    'active',
    'enterprise',
    'ops@ananta.com',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.users_v2 (id, tenant_id, email, first_name, last_name, role, is_staff, email_verified, metadata)
VALUES (
    'a0000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111111',
    'dev@ananta.com',
    'Dev',
    'Admin',
    'owner',
    true,
    true,
    jsonb_build_object('dev_mode', true)
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.projects_v2 (id, tenant_id, name, description, status, visibility, project_owner_id, created_by_id, created_at, updated_at)
VALUES (
    'a2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    'Demo Project',
    'Sample project for development and testing',
    'active',
    'internal',
    'a0000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000000',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- GRANT PERMISSIONS TO service_role
-- ============================================================
-- service_role needs full access to all tables to bypass RLS in dev mode

GRANT ALL ON public.tenants_v2 TO service_role;
GRANT ALL ON public.users_v2 TO service_role;
GRANT ALL ON public.projects_v2 TO service_role;
GRANT ALL ON public.components_v2 TO service_role;
GRANT ALL ON public.boms_v2 TO service_role;
GRANT ALL ON public.bom_line_items_v2 TO service_role;
GRANT ALL ON public.alerts_v2 TO service_role;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Helper: current user email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'email', '')
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, anon;

-- Helper: whether current user is platform admin
-- SECURITY DEFINER allows this function to bypass RLS when checking users_v2
-- This prevents infinite recursion: RLS policy -> is_platform_admin() -> users_v2 -> RLS policy
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_v2 u
    WHERE u.email = public.current_user_email()
      AND u.platform_admin = true
  )
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- Resolve current tenant id without invoking RLS
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.tenant_id FROM public.users_v2 u
  WHERE u.email = public.current_user_email()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated, anon;

-- Enable RLS
ALTER TABLE public.tenants_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_line_items_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_v2 ENABLE ROW LEVEL SECURITY;

-- Tenants: platform_admin can read all; others only their tenant by id
DROP POLICY IF EXISTS tenants_v2_select ON public.tenants_v2;
CREATE POLICY tenants_v2_select ON public.tenants_v2
  FOR SELECT USING (
    public.is_platform_admin() OR id = public.get_current_tenant_id()
  );

-- Users: platform_admin sees all; others see same-tenant users
DROP POLICY IF EXISTS users_v2_select ON public.users_v2;
CREATE POLICY users_v2_select ON public.users_v2
  FOR SELECT USING (
    public.is_platform_admin() OR tenant_id = public.get_current_tenant_id() OR email = public.current_user_email()
  );

-- Projects
DROP POLICY IF EXISTS projects_v2_select ON public.projects_v2;
CREATE POLICY projects_v2_select ON public.projects_v2
  FOR SELECT USING (
    public.is_platform_admin() OR tenant_id = public.get_current_tenant_id()
  );

-- Components
DROP POLICY IF EXISTS components_v2_select ON public.components_v2;
CREATE POLICY components_v2_select ON public.components_v2
  FOR SELECT USING (
    public.is_platform_admin() OR tenant_id = public.get_current_tenant_id()
  );

-- BOMs
DROP POLICY IF EXISTS boms_v2_select ON public.boms_v2;
CREATE POLICY boms_v2_select ON public.boms_v2
  FOR SELECT USING (
    public.is_platform_admin() OR tenant_id = public.get_current_tenant_id()
  );

-- BOM Line Items: visible if parent bom visible
DROP POLICY IF EXISTS bom_line_items_v2_select ON public.bom_line_items_v2;
CREATE POLICY bom_line_items_v2_select ON public.bom_line_items_v2
  FOR SELECT USING (
    public.is_platform_admin() OR bom_id IN (
      SELECT id FROM public.boms_v2 WHERE tenant_id = public.get_current_tenant_id()
    )
  );

-- Alerts
DROP POLICY IF EXISTS alerts_v2_select ON public.alerts_v2;
CREATE POLICY alerts_v2_select ON public.alerts_v2
  FOR SELECT USING (
    public.is_platform_admin() OR tenant_id = public.get_current_tenant_id()
  );

-- ==============================================================================
-- ARC-SAAS KEYCLOAK JWT INTEGRATION
-- ==============================================================================
-- Migration 001: Keycloak JWT Auth Functions for Arc-SaaS App Plane
-- Description: Creates auth helper functions that extract claims from Keycloak JWTs
--
-- KEY DESIGN DECISIONS:
-- 1. tenant_id (Control Plane) === organization_id (App Plane)
--    - When Control Plane provisions a tenant, it creates an organization in Supabase
--    - The organization.id = tenant.id from Control Plane
-- 2. Keycloak JWT contains: sub (user ID), tenant_id (from custom mapper)
-- 3. RLS policies filter by: organization_id = keycloak_tenant_id()
--
-- Keycloak Mapper Configuration (add to client):
--   - Mapper type: User Attribute
--   - Name: tenant_id
--   - User Attribute: tenant_id (set during user provisioning)
--   - Token Claim Name: tenant_id
--   - Add to ID token: ON
--   - Add to access token: ON
--   - Claim JSON Type: String
--
-- Date: 2025-12-08

BEGIN;

-- ============================================================================
-- SECTION 1: Create auth schema if not exists
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================================
-- SECTION 2: Core JWT Access Functions
-- ============================================================================

-- Function to get full JWT claims as JSONB
-- PostgREST sets request.jwt.claims from the Authorization header
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

-- ============================================================================
-- SECTION 3: Keycloak-Specific JWT Claim Extractors
-- ============================================================================

-- Function to get tenant_id from Keycloak JWT
-- This maps to organization_id in App Plane
-- Keycloak tokens have tenant_id as a custom claim
CREATE OR REPLACE FUNCTION keycloak_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        -- Try direct tenant_id claim (custom Keycloak mapper)
        auth.jwt() ->> 'tenant_id',
        -- Fallback: try userTenantId (used by some configurations)
        auth.jwt() ->> 'userTenantId',
        -- Fallback: organization claim from Keycloak organizations
        auth.jwt() -> 'organization' ->> 'id',
        NULL
    )::uuid;
$$;

COMMENT ON FUNCTION keycloak_tenant_id() IS
'Extracts tenant_id from Keycloak JWT. This equals organization_id in App Plane.';

-- Alias for clarity in RLS policies
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT keycloak_tenant_id();
$$;

COMMENT ON FUNCTION current_organization_id() IS
'Alias for keycloak_tenant_id(). Returns the current users organization_id for RLS policies.';

-- Function to get Keycloak user_id (sub claim)
CREATE OR REPLACE FUNCTION keycloak_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() ->> 'sub';
$$;

COMMENT ON FUNCTION keycloak_user_id() IS 'Returns the Keycloak user ID (sub claim) as text';

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

COMMENT ON FUNCTION keycloak_user_email() IS 'Returns user email from Keycloak JWT';

-- Function to check if user is super admin (platform admin)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        -- Check for platform_admin role in Keycloak realm_access.roles
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'realm_access' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin', 'admin')
    )
    OR EXISTS (
        -- Check for platform_admin in resource_access (client roles)
        SELECT 1
        FROM jsonb_array_elements_text(
            COALESCE(auth.jwt() -> 'resource_access' -> 'arc-saas' -> 'roles', '[]'::jsonb)
        ) AS role
        WHERE role IN ('platform_admin', 'super_admin')
    )
    OR COALESCE(auth.jwt() ->> 'is_platform_admin', 'false')::boolean;
$$;

COMMENT ON FUNCTION is_super_admin() IS
'Returns true if user has platform_admin or super_admin role in Keycloak JWT';

-- Function to get user role within their tenant
CREATE OR REPLACE FUNCTION keycloak_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        -- Direct role claim
        auth.jwt() ->> 'role',
        -- Check realm roles for common patterns
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
            ELSE 'viewer'
        END
    );
$$;

COMMENT ON FUNCTION keycloak_user_role() IS
'Returns user role from Keycloak JWT (owner, admin, engineer, analyst, viewer)';

-- Function to check if user is admin of their organization
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT keycloak_user_role() IN ('owner', 'admin')
        OR is_super_admin();
$$;

COMMENT ON FUNCTION is_org_admin() IS
'Returns true if user is owner or admin of their organization';

-- ============================================================================
-- SECTION 4: Backwards Compatibility Aliases
-- ============================================================================

-- Alias for get_current_user_id (used by existing migrations)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- In Keycloak model, we lookup user by keycloak_user_id (sub claim)
    SELECT id FROM users
    WHERE keycloak_user_id = keycloak_user_id()
    LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_user_id() IS
'Returns internal user UUID by looking up keycloak_user_id. For RLS policies.';

-- ============================================================================
-- SECTION 5: Grant Permissions
-- ============================================================================

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, service_role;

-- Revoke from anon where not needed
REVOKE EXECUTE ON FUNCTION keycloak_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION current_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_email() FROM anon;
REVOKE EXECUTE ON FUNCTION is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION keycloak_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION is_org_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION get_current_user_id() FROM anon;

COMMIT;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- In RLS policies, use these patterns:
--
-- 1. Basic tenant isolation:
--    CREATE POLICY "tenant_isolation" ON my_table
--    FOR ALL USING (organization_id = current_organization_id());
--
-- 2. With super admin bypass:
--    CREATE POLICY "tenant_isolation_with_admin" ON my_table
--    FOR SELECT USING (
--      is_super_admin() OR organization_id = current_organization_id()
--    );
--
-- 3. Admin-only operations:
--    CREATE POLICY "admin_only_delete" ON my_table
--    FOR DELETE USING (
--      is_super_admin() OR (
--        organization_id = current_organization_id()
--        AND is_org_admin()
--      )
--    );
--

-- ==============================================================================
-- ARC-SAAS CORE SCHEMA AND RLS
-- ==============================================================================
-- Migration 002: Core Schema and RLS Policies for Arc-SaaS App Plane
-- Description: Creates core tables (organizations, users, memberships) and RLS policies
--
-- Date: 2025-12-08
--
-- IMPORTANT: organization.id = tenant.id from Control Plane
-- Organizations are created during tenant provisioning, NOT by users

BEGIN;

-- ============================================================================
-- SECTION 1: Organizations Table (Tenants from Control Plane)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,  -- This IS the tenant_id from Control Plane
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    domains TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    tier TEXT DEFAULT 'basic',  -- Synced from subscription plan tier
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deprovisioned')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL  -- Soft delete
);

COMMENT ON TABLE organizations IS 'Tenant organizations provisioned from Control Plane. id = tenant_id';
COMMENT ON COLUMN organizations.id IS 'Same as tenant_id from Control Plane';
COMMENT ON COLUMN organizations.tier IS 'Subscription tier synced from Control Plane (free, starter, basic, standard, professional, premium, enterprise)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- SECTION 2: Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id TEXT UNIQUE,  -- Keycloak sub claim
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_platform_admin BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'App Plane users, linked to Keycloak via keycloak_user_id';

-- Index for JWT lookups
CREATE INDEX IF NOT EXISTS idx_users_keycloak_user_id ON users(keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- SECTION 3: Organization Memberships Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'engineer', 'analyst', 'viewer')),
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

COMMENT ON TABLE organization_memberships IS 'User memberships in organizations with roles';

-- Indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON organization_memberships(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_role ON organization_memberships(user_id, role);

-- ============================================================================
-- SECTION 4: Organization Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, email)
);

COMMENT ON TABLE organization_invitations IS 'Pending user invitations to organizations';

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);

-- ============================================================================
-- SECTION 5: Updated Timestamps Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['organizations', 'users', 'organization_memberships'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_%I_timestamp ON %I;
            CREATE TRIGGER set_%I_timestamp
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ============================================================================
-- SECTION 6: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 7: RLS Policies - Organizations
-- ============================================================================

-- Users can only see their own organization (via JWT tenant_id claim)
CREATE POLICY "organizations_select" ON organizations FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        is_super_admin()
        OR id = current_organization_id()
    )
);

-- Only super admins can create organizations (Control Plane provisions them)
CREATE POLICY "organizations_insert" ON organizations FOR INSERT
WITH CHECK (is_super_admin());

-- Org admins can update their org, super admins can update any
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
USING (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
);

-- Only super admins can delete organizations
CREATE POLICY "organizations_delete" ON organizations FOR DELETE
USING (is_super_admin());

-- ============================================================================
-- SECTION 8: RLS Policies - Users
-- ============================================================================

-- Users can see themselves and users in their organization
CREATE POLICY "users_select" ON users FOR SELECT
USING (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()  -- Own profile
    OR id IN (
        SELECT user_id FROM organization_memberships
        WHERE organization_id = current_organization_id()
    )
);

-- Service role can insert users (during provisioning)
CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (is_super_admin());

-- Users can update their own profile
CREATE POLICY "users_update" ON users FOR UPDATE
USING (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()
)
WITH CHECK (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()
);

-- ============================================================================
-- SECTION 9: RLS Policies - Organization Memberships
-- ============================================================================

-- Users can see memberships in their org
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (
    is_super_admin()
    OR organization_id = current_organization_id()
);

-- Org admins can add members
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')  -- Can't add new owners
    )
);

-- Org admins can update member roles (not their own, not owners)
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND user_id != get_current_user_id()  -- Can't modify own membership
    )
)
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')  -- Can't promote to owner
    )
);

-- Org admins can remove members (not owners, not themselves)
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
USING (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND user_id != get_current_user_id()
        AND role != 'owner'
    )
);

-- ============================================================================
-- SECTION 10: RLS Policies - Organization Invitations
-- ============================================================================

CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
    OR email = keycloak_user_email()  -- Users can see their own invitations
);

CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

-- ============================================================================
-- SECTION 11: Helper Functions for Provisioning
-- ============================================================================

-- Function to create organization (called by webhook-bridge via service_role)
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
    INSERT INTO organizations (id, name, slug, tier, domains, status)
    VALUES (p_organization_id, p_name, p_slug, p_tier, p_domains, 'active')
    ON CONFLICT (id) DO UPDATE
    SET
        name = EXCLUDED.name,
        slug = COALESCE(EXCLUDED.slug, organizations.slug),
        tier = EXCLUDED.tier,
        domains = EXCLUDED.domains,
        updated_at = NOW();

    RETURN p_organization_id;
END;
$$;

COMMENT ON FUNCTION create_tenant_organization IS
'Creates or updates an organization from Control Plane provisioning. Called by webhook-bridge.';

-- Function to provision user in organization
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
    -- Create or update user
    INSERT INTO users (keycloak_user_id, email, full_name)
    VALUES (p_keycloak_user_id, p_email, COALESCE(p_full_name, split_part(p_email, '@', 1)))
    ON CONFLICT (keycloak_user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    -- Create membership
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (p_organization_id, v_user_id, p_role)
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

    RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION provision_user_in_organization IS
'Provisions a user in an organization. Called during tenant provisioning or invitation acceptance.';

-- Grant functions to service_role
GRANT EXECUTE ON FUNCTION create_tenant_organization(UUID, TEXT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION provision_user_in_organization(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

COMMIT;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- TENANT PROVISIONING FLOW:
-- 1. Control Plane creates tenant with tenant_id (UUID)
-- 2. Temporal workflow sends webhook to App Plane webhook-bridge
-- 3. Webhook-bridge calls create_tenant_organization(tenant_id, name, key, tier)
-- 4. Organization is created with id = tenant_id
-- 5. Admin user is provisioned via provision_user_in_organization
-- 6. Webhook-bridge signals Temporal workflow completion
--
-- USER AUTHENTICATION FLOW:
-- 1. User logs in via Keycloak
-- 2. Keycloak JWT includes: sub (user ID), tenant_id (from mapper)
-- 3. Frontend passes JWT to Supabase client
-- 4. PostgREST validates JWT and sets request.jwt.claims
-- 5. RLS policies use current_organization_id() = JWT tenant_id
-- 6. All queries automatically filtered to user's organization
--
