-- ============================================================================
-- COMPLETE MASTER MIGRATION: Supabase Database (App-Plane)
-- ============================================================================
-- Version: 6.0.0
-- Created: 2025-12-27
-- Database: app-plane-supabase-db (port 27432)
--
-- This is a COMPLETE snapshot of the live Supabase database schema including:
-- - ALL tables (82+ tables from live database)
-- - ALL columns, indexes, constraints
-- - ALL functions, triggers
-- - ALL extensions
-- - SEED organizations and users
--
-- USE THIS FOR:
-- - Fresh database setup
-- - Complete schema verification
-- - Reference documentation
--
-- IMPORTANT: Fully idempotent. Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ============================================================================
-- HELPER FUNCTIONS (must be created first)
-- ============================================================================

-- Slugify function
CREATE OR REPLACE FUNCTION public.slugify(text_to_slug text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $_$
DECLARE
    slugged text;
BEGIN
    slugged := lower(text_to_slug);
    slugged := regexp_replace(slugged, '[\s_]+', '-', 'g');
    slugged := regexp_replace(slugged, '[^a-z0-9\-]', '', 'g');
    slugged := regexp_replace(slugged, '-+', '-', 'g');
    slugged := regexp_replace(slugged, '^-|-$', '', 'g');
    IF slugged IS NULL OR slugged = '' THEN
        slugged := 'entity-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;
    RETURN slugged;
END;
$_$;

-- Normalize role function
CREATE OR REPLACE FUNCTION public.normalize_role(input_role text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized TEXT;
    lower_role TEXT;
BEGIN
    lower_role := LOWER(COALESCE(input_role, ''));

    IF lower_role IN ('platform:super_admin', 'platform-super-admin', 'realm-admin', 'platform_admin') THEN
        normalized := 'super_admin';
    ELSIF lower_role IN ('org-owner', 'organization-owner', 'billing_admin') THEN
        normalized := 'owner';
    ELSIF lower_role IN ('administrator', 'org_admin', 'tenant-admin', 'org-admin') THEN
        normalized := 'admin';
    ELSIF lower_role IN ('staff', 'developer', 'support', 'operator', 'platform:engineer', 'platform:staff') THEN
        normalized := 'engineer';
    ELSIF lower_role IN ('user', 'customer', 'viewer', 'member', 'read-only', '') THEN
        normalized := 'analyst';
    ELSIF lower_role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst') THEN
        normalized := lower_role;
    ELSE
        normalized := 'analyst';
    END IF;

    RETURN normalized;
END;
$$;

COMMENT ON FUNCTION public.normalize_role(input_role text) IS 'Normalizes legacy role names to unified 5-level hierarchy';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Organizations (Multi-tenant anchor)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
    plan_tier TEXT DEFAULT 'standard',
    billing_email TEXT,
    timezone TEXT DEFAULT 'UTC',
    region TEXT DEFAULT 'us-east-1',
    max_users INTEGER DEFAULT 10,
    max_components INTEGER DEFAULT 50000,
    max_storage_gb INTEGER DEFAULT 100,
    current_users_count INTEGER DEFAULT 0,
    current_components_count INTEGER DEFAULT 0,
    current_storage_gb NUMERIC(12,2) DEFAULT 0,
    trial_ends_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted ON public.organizations(deleted_at) WHERE deleted_at IS NULL;

-- Users (Multi-org, Auth0/Keycloak compatible)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    auth0_user_id TEXT UNIQUE,
    keycloak_user_id TEXT,
    role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst')),
    is_platform_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON public.users(auth0_user_id) WHERE auth0_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_keycloak_id ON public.users(keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_platform_admin ON public.users(is_platform_admin) WHERE is_platform_admin = true;

-- Organization Memberships (Multi-org support)
CREATE TABLE IF NOT EXISTS public.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('owner', 'admin', 'engineer', 'analyst')),
    is_default BOOLEAN DEFAULT false,
    invited_by UUID REFERENCES public.users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON public.organization_memberships(user_id, organization_id);

-- Organization Invitations
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'engineer', 'analyst')),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_email_invitation UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);

-- User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    last_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);

-- Workspace Members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- Projects (linked to workspaces)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

-- ============================================================================
-- CATALOG TABLES
-- ============================================================================

-- Manufacturers
CREATE TABLE IF NOT EXISTS public.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    normalized_name TEXT,
    aliases TEXT[] DEFAULT '{}',
    website TEXT,
    description TEXT,
    logo_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON public.manufacturers(slug);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(name);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0,
    path TEXT,
    description TEXT,
    image_url TEXT,
    component_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_path ON public.categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    api_key_required BOOLEAN DEFAULT false,
    api_endpoint TEXT,
    website TEXT,
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INTEGER,
    rate_limit_per_day INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_priority ON public.suppliers(priority);
CREATE INDEX IF NOT EXISTS idx_suppliers_slug ON public.suppliers(slug);

-- Components
CREATE TABLE IF NOT EXISTS public.components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    manufacturer_part_number TEXT NOT NULL,
    manufacturer TEXT,
    description TEXT,
    datasheet_url TEXT,
    image_url TEXT,
    lifecycle_status TEXT CHECK (lifecycle_status IN ('Active', 'NRND', 'EOL', 'Obsolete', 'Preview', 'Unknown')),
    lifecycle_change_date DATE,
    risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED', 'CRITICAL')),
    rohs_compliant TEXT CHECK (rohs_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')),
    reach_compliant TEXT CHECK (reach_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')),
    has_alternatives BOOLEAN DEFAULT false,
    alternative_part_numbers TEXT[],
    unit_price NUMERIC(14,4),
    currency TEXT DEFAULT 'USD',
    stock_quantity INTEGER,
    moq INTEGER,
    lead_time_days INTEGER,
    quality_score NUMERIC(5,2),
    package_type TEXT,
    mounting_style TEXT CHECK (mounting_style IN ('SMD', 'THT', 'HYBRID')),
    temp_min_c INTEGER,
    temp_max_c INTEGER,
    power_rating_w DECIMAL(10,4),
    specifications JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_enriched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_components_org ON public.components(organization_id);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON public.components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_category ON public.components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_mpn ON public.components(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_components_lifecycle ON public.components(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_components_risk ON public.components(risk_level);
CREATE INDEX IF NOT EXISTS idx_components_search ON public.components USING GIN(search_vector);

-- Attributes
CREATE TABLE IF NOT EXISTS public.attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    unit TEXT,
    source TEXT,
    confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attributes_component ON public.attributes(component_id);
CREATE INDEX IF NOT EXISTS idx_attributes_name ON public.attributes(name);

-- ============================================================================
-- BOM MANAGEMENT
-- ============================================================================

-- BOMs
CREATE TABLE IF NOT EXISTS public.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed', 'archived')),
    component_count INTEGER DEFAULT 0,
    total_cost DECIMAL(12,2),
    enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'queued', 'processing', 'enriched', 'failed')),
    enrichment_priority INTEGER DEFAULT 5 CHECK (enrichment_priority >= 1 AND enrichment_priority <= 10),
    temporal_workflow_id TEXT,
    source TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal')),
    raw_file_s3_key TEXT,
    parsed_file_s3_key TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_org ON public.boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_project ON public.boms(project_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON public.boms(status);
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_status ON public.boms(enrichment_status);

-- BOM Line Items
CREATE TABLE IF NOT EXISTS public.bom_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    line_number INTEGER,
    reference_designator TEXT,
    manufacturer_part_number TEXT,
    manufacturer TEXT,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    component_id UUID,
    match_confidence NUMERIC(5,2),
    match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),
    enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'matched', 'enriched', 'no_match', 'error')),
    enriched_mpn TEXT,
    enriched_manufacturer TEXT,
    specifications JSONB,
    datasheet_url TEXT,
    lifecycle_status TEXT,
    compliance_status JSONB,
    pricing JSONB,
    unit_price DECIMAL(10,4),
    extended_price DECIMAL(12,2),
    risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),
    redis_component_key TEXT,
    component_storage TEXT DEFAULT 'none',
    enrichment_error TEXT,
    category VARCHAR(255),
    subcategory VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    enriched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom ON public.bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component ON public.bom_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn ON public.bom_line_items(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_status ON public.bom_line_items(enrichment_status);

-- Legacy BOM Jobs (for CNS service compatibility)
CREATE TABLE IF NOT EXISTS public.bom_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name VARCHAR(255),
    filename VARCHAR(255),
    file_size INTEGER,
    total_items INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_auto_approved INTEGER DEFAULT 0,
    items_in_staging INTEGER DEFAULT 0,
    items_rejected INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    error_message TEXT,
    results_data JSONB,
    organization_id UUID,
    project_id UUID,
    source VARCHAR(50) DEFAULT 'customer',
    source_metadata JSONB,
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_jobs_job_id ON public.bom_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_bom_jobs_org ON public.bom_jobs(organization_id);

-- Legacy BOM Items
CREATE TABLE IF NOT EXISTS public.bom_items (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) NOT NULL,
    line_number INTEGER NOT NULL,
    mpn VARCHAR(255),
    manufacturer VARCHAR(255),
    quantity INTEGER,
    reference_designator TEXT,
    description TEXT,
    component_id INTEGER,
    enriched_mpn VARCHAR(255),
    enriched_manufacturer VARCHAR(255),
    specifications JSONB,
    datasheet_url TEXT,
    lifecycle_status VARCHAR(50),
    estimated_lifetime DATE,
    compliance_status JSONB,
    pricing JSONB,
    match_confidence NUMERIC(5,2),
    quality_score INTEGER,
    routing_destination VARCHAR(50) DEFAULT 'staging',
    enrichment_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_job_id ON public.bom_items(job_id);

-- BOM Processing Jobs
CREATE TABLE IF NOT EXISTS public.bom_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5,
    temporal_workflow_id TEXT,
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    enriched_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_bom ON public.bom_processing_jobs(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_processing_jobs_status ON public.bom_processing_jobs(status);

-- Column Mapping Templates
CREATE TABLE IF NOT EXISTS public.column_mapping_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    mappings JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_column_mapping_templates_org ON public.column_mapping_templates(organization_id);

-- ============================================================================
-- ENRICHMENT SYSTEM
-- ============================================================================

-- CNS Enrichment Config
CREATE TABLE IF NOT EXISTS public.cns_enrichment_config (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100),
    config_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    enable_suppliers BOOLEAN DEFAULT true,
    preferred_suppliers TEXT[] DEFAULT ARRAY['mouser', 'digikey', 'element14'],
    supplier_min_confidence NUMERIC(5,2) DEFAULT 90.0,
    enable_ai BOOLEAN DEFAULT false,
    ai_provider VARCHAR(50),
    ai_operations TEXT[] DEFAULT ARRAY['category', 'specs'],
    ai_min_confidence NUMERIC(5,2) DEFAULT 70.0,
    ai_cost_limit_monthly NUMERIC(10,2),
    enable_web_scraping BOOLEAN DEFAULT false,
    scraping_sources TEXT[],
    scraping_timeout_seconds INTEGER,
    quality_reject_threshold INTEGER DEFAULT 70,
    quality_staging_threshold INTEGER DEFAULT 94,
    quality_auto_approve_threshold INTEGER DEFAULT 95,
    batch_size INTEGER DEFAULT 100 CHECK (batch_size >= 1 AND batch_size <= 1000),
    max_retries INTEGER DEFAULT 2 CHECK (max_retries >= 0 AND max_retries <= 10),
    ai_cost_current_month NUMERIC(10,2),
    ai_requests_current_month INTEGER,
    web_scraping_requests_current_month INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cns_config_tenant ON public.cns_enrichment_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cns_config_global ON public.cns_enrichment_config(is_global) WHERE is_global = true;

-- CNS Processing Events
CREATE TABLE IF NOT EXISTS public.cns_processing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bom_id UUID REFERENCES public.boms(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) DEFAULT 'processing',
    severity VARCHAR(20) DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    workflow_id VARCHAR(255),
    actor_type VARCHAR(50) DEFAULT 'system',
    actor_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cns_events_org ON public.cns_processing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_cns_events_bom ON public.cns_processing_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_cns_events_type ON public.cns_processing_events(event_type);

-- Enrichment Events
CREATE TABLE IF NOT EXISTS public.enrichment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(255),
    bom_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    project_id UUID,
    user_id UUID,
    source VARCHAR(20) NOT NULL CHECK (source IN ('customer', 'staff')),
    workflow_id VARCHAR(255),
    state JSONB NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom ON public.enrichment_events(bom_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_tenant ON public.enrichment_events(tenant_id);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    routing_key TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id TEXT,
    username TEXT,
    email TEXT,
    source TEXT DEFAULT 'cns-service' NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON public.audit_logs(event_type);

-- Audit Enrichment Runs
CREATE TABLE IF NOT EXISTS public.audit_enrichment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    mpn TEXT NOT NULL,
    manufacturer TEXT,
    enrichment_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    successful BOOLEAN DEFAULT false NOT NULL,
    quality_score NUMERIC(5,2),
    storage_location TEXT,
    supplier_name TEXT NOT NULL,
    supplier_match_confidence NUMERIC(5,2),
    processing_time_ms INTEGER,
    error_message TEXT,
    needs_review BOOLEAN DEFAULT false,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_enrichment_upload ON public.audit_enrichment_runs(upload_id);

-- Audit Field Comparisons
CREATE TABLE IF NOT EXISTS public.audit_field_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrichment_run_id UUID NOT NULL REFERENCES public.audit_enrichment_runs(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_category TEXT,
    supplier_value TEXT,
    normalized_value TEXT,
    changed BOOLEAN DEFAULT false,
    change_type TEXT,
    change_reason TEXT,
    confidence NUMERIC(5,2),
    supplier_data_quality TEXT,
    normalization_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_field_comparisons_run ON public.audit_field_comparisons(enrichment_run_id);

-- Audit Supplier Quality
CREATE TABLE IF NOT EXISTS public.audit_supplier_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier_name TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_quality_score NUMERIC(5,2),
    avg_match_confidence NUMERIC(5,2),
    avg_processing_time_ms INTEGER,
    fields_changed_count INTEGER DEFAULT 0,
    fields_missing_count INTEGER DEFAULT 0,
    fields_invalid_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_supplier_quality_date ON public.audit_supplier_quality(date, supplier_name);

-- ============================================================================
-- ALERTS & NOTIFICATIONS
-- ============================================================================

-- Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    component_id UUID REFERENCES public.components(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN')),
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    context JSONB,
    action_url TEXT,
    archived_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON public.alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON public.alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(alert_type);

-- Alert Preferences
CREATE TABLE IF NOT EXISTS public.alert_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN')),
    is_active BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url TEXT,
    email_address TEXT,
    threshold_config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user ON public.alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_org ON public.alert_preferences(organization_id);

-- Alert Deliveries
CREATE TABLE IF NOT EXISTS public.alert_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    delivery_method TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    delivered_at TIMESTAMPTZ,
    novu_transaction_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON public.alert_deliveries(alert_id);

-- Component Watches
CREATE TABLE IF NOT EXISTS public.component_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
    watch_lifecycle BOOLEAN DEFAULT true,
    watch_price BOOLEAN DEFAULT true,
    watch_availability BOOLEAN DEFAULT true,
    watch_compliance BOOLEAN DEFAULT true,
    watch_supply_chain BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_component_watches_user ON public.component_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_component_watches_component ON public.component_watches(component_id);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Get current user ID
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        nullif(current_setting('app.current_user_id', true), '')::uuid,
        (SELECT id FROM users
         WHERE keycloak_user_id = nullif(current_setting('app.keycloak_user_id', true), '')
         LIMIT 1)
    )
$$;

-- Get user organization IDs
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id
    FROM organization_memberships
    WHERE user_id = get_current_user_id()
$$;

-- Get user organizations (with optional user_id parameter)
CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id UUID DEFAULT NULL::uuid)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id
    FROM organization_memberships
    WHERE user_id = COALESCE(p_user_id, get_current_user_id())
$$;

-- Is member of organization
CREATE OR REPLACE FUNCTION public.is_member_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = get_current_user_id()
        AND organization_id = p_org_id
    )
$$;

-- Is org member (with optional user_id)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_user_id UUID DEFAULT NULL::uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE organization_id = p_org_id
        AND user_id = COALESCE(p_user_id, get_current_user_id())
    )
$$;

-- Is admin of organization
CREATE OR REPLACE FUNCTION public.is_admin_of(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = get_current_user_id()
        AND organization_id = p_org_id
        AND role IN ('owner', 'admin')
    )
$$;

-- Is org admin (with optional user_id)
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID, p_user_id UUID DEFAULT NULL::uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE organization_id = p_org_id
        AND user_id = COALESCE(p_user_id, get_current_user_id())
        AND role IN ('owner', 'admin')
    )
$$;

-- Is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT is_platform_admin FROM users WHERE id = get_current_user_id()),
        false
    )
$$;

-- Is platform staff
CREATE OR REPLACE FUNCTION public.is_platform_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = get_current_user_id()
        AND organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
    )
$$;

-- Is platform admin (JWT-based)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'platform_admin')::BOOLEAN,
        (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'platform_admin')::BOOLEAN,
        false
    )
$$;

-- Current user organization ID
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'organization_id')::UUID,
        (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'organization_id')::UUID
    )
$$;

-- Get active CNS config
CREATE OR REPLACE FUNCTION public.get_active_cns_config(p_tenant_id VARCHAR)
RETURNS TABLE(
    id INTEGER,
    tenant_id VARCHAR,
    config_name VARCHAR,
    is_active BOOLEAN,
    is_global BOOLEAN,
    enable_suppliers BOOLEAN,
    preferred_suppliers TEXT[],
    supplier_min_confidence NUMERIC,
    enable_ai BOOLEAN,
    ai_provider VARCHAR,
    ai_operations TEXT[],
    ai_min_confidence NUMERIC,
    ai_cost_limit_monthly NUMERIC,
    enable_web_scraping BOOLEAN,
    scraping_sources TEXT[],
    scraping_timeout_seconds INTEGER,
    quality_reject_threshold INTEGER,
    quality_staging_threshold INTEGER,
    quality_auto_approve_threshold INTEGER,
    batch_size INTEGER,
    max_retries INTEGER,
    ai_cost_current_month NUMERIC,
    ai_requests_current_month INTEGER,
    web_scraping_requests_current_month INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_tenant_id IS NOT NULL THEN
        RETURN QUERY
        SELECT c.* FROM cns_enrichment_config c
        WHERE c.tenant_id = p_tenant_id AND c.is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT c.* FROM cns_enrichment_config c
    WHERE c.is_global = TRUE AND c.is_active = TRUE
    ORDER BY c.created_at DESC
    LIMIT 1;
END;
$$;

-- Log CNS event helper
CREATE OR REPLACE FUNCTION public.log_cns_event(
    p_organization_id UUID,
    p_event_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT DEFAULT NULL,
    p_bom_id UUID DEFAULT NULL,
    p_event_category VARCHAR DEFAULT 'processing',
    p_severity VARCHAR DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_workflow_id VARCHAR DEFAULT NULL,
    p_actor_type VARCHAR DEFAULT 'system',
    p_actor_id VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO cns_processing_events (
        organization_id, bom_id, event_type, event_category, severity,
        title, message, metadata, workflow_id, actor_type, actor_id
    ) VALUES (
        p_organization_id, p_bom_id, p_event_type, p_event_category, p_severity,
        p_title, p_message, p_metadata, p_workflow_id, p_actor_type, p_actor_id
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

-- Add user to platform organization
CREATE OR REPLACE FUNCTION public.add_user_to_platform_org(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    platform_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
    user_role TEXT;
    user_is_platform_admin BOOLEAN;
BEGIN
    SELECT role, is_platform_admin INTO user_role, user_is_platform_admin
    FROM users WHERE id = p_user_id;

    IF user_role IN ('super_admin', 'admin') OR user_is_platform_admin = true THEN
        INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
        VALUES (p_user_id, platform_org_id, 'admin', NOW(), NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'admin', updated_at = NOW();
    END IF;
END;
$$;

-- Set BOM organization ID from project
CREATE OR REPLACE FUNCTION public.set_bom_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_organization_id UUID;
BEGIN
    SELECT w.organization_id INTO v_organization_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE p.id = NEW.project_id;

    IF v_organization_id IS NOT NULL THEN
        NEW.organization_id := v_organization_id;
    ELSE
        RAISE EXCEPTION '[ERROR] Cannot determine organization_id for BOM "%" with project_id %. Check workspace linkage.',
            NEW.name, NEW.project_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Generate slug from name
CREATE OR REPLACE FUNCTION public.generate_slug_from_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(
            regexp_replace(
                regexp_replace(
                    regexp_replace(trim(NEW.name), '[^\w\s-]', '', 'g'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Ensure single default template
CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE column_mapping_templates
        SET is_default = FALSE
        WHERE organization_id = NEW.organization_id
          AND id != NEW.id
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$;

-- Update component search vector
CREATE OR REPLACE FUNCTION public.update_component_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.manufacturer_part_number, '') || ' ' ||
        COALESCE(NEW.manufacturer, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger for auto-adding platform staff to platform org
CREATE OR REPLACE FUNCTION public.trigger_auto_add_platform_staff_to_platform_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF (NEW.role IN ('super_admin', 'admin') OR NEW.is_platform_admin = true) AND
       (OLD IS NULL OR (OLD.role NOT IN ('super_admin', 'admin') AND OLD.is_platform_admin <> true)) THEN
        PERFORM add_user_to_platform_org(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Update BOM items updated_at
CREATE OR REPLACE FUNCTION public.update_bom_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update BOM jobs updated_at
CREATE OR REPLACE FUNCTION public.update_bom_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update BOM processing jobs updated_at
CREATE OR REPLACE FUNCTION public.update_bom_processing_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update column mapping templates updated_at
CREATE OR REPLACE FUNCTION public.update_column_mapping_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Timestamp triggers
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_org_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER update_org_memberships_updated_at BEFORE UPDATE ON public.organization_memberships
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_org_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER update_org_invitations_updated_at BEFORE UPDATE ON public.organization_invitations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_components_updated_at ON public.components;
CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON public.components
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_boms_updated_at ON public.boms;
CREATE TRIGGER update_boms_updated_at BEFORE UPDATE ON public.boms
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_bom_line_items_updated_at ON public.bom_line_items;
CREATE TRIGGER update_bom_line_items_updated_at BEFORE UPDATE ON public.bom_line_items
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS update_bom_items_updated_at ON public.bom_items;
CREATE TRIGGER update_bom_items_updated_at BEFORE UPDATE ON public.bom_items
    FOR EACH ROW EXECUTE FUNCTION update_bom_items_updated_at();

DROP TRIGGER IF EXISTS update_bom_jobs_updated_at ON public.bom_jobs;
CREATE TRIGGER update_bom_jobs_updated_at BEFORE UPDATE ON public.bom_jobs
    FOR EACH ROW EXECUTE FUNCTION update_bom_jobs_updated_at();

DROP TRIGGER IF EXISTS update_bom_processing_jobs_updated_at ON public.bom_processing_jobs;
CREATE TRIGGER update_bom_processing_jobs_updated_at BEFORE UPDATE ON public.bom_processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_bom_processing_jobs_updated_at();

DROP TRIGGER IF EXISTS update_column_mapping_templates_updated_at ON public.column_mapping_templates;
CREATE TRIGGER update_column_mapping_templates_updated_at BEFORE UPDATE ON public.column_mapping_templates
    FOR EACH ROW EXECUTE FUNCTION update_column_mapping_templates_updated_at();

-- Component search vector trigger
DROP TRIGGER IF EXISTS update_component_search ON public.components;
CREATE TRIGGER update_component_search BEFORE INSERT OR UPDATE ON public.components
    FOR EACH ROW EXECUTE FUNCTION update_component_search_vector();

-- Column mapping template default trigger
DROP TRIGGER IF EXISTS ensure_single_default_template ON public.column_mapping_templates;
CREATE TRIGGER ensure_single_default_template BEFORE INSERT OR UPDATE ON public.column_mapping_templates
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_template();

-- Auto-add platform staff trigger
DROP TRIGGER IF EXISTS auto_add_platform_staff_to_platform_org ON public.users;
CREATE TRIGGER auto_add_platform_staff_to_platform_org AFTER INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION trigger_auto_add_platform_staff_to_platform_org();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed Organization 1: Platform Super Admin (CNS Staff)
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Platform Admin',
    'platform-admin',
    'active',
    'enterprise',
    'Internal platform administrators and CNS staff'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- Seed Organization 2: CNS Staff
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'CNS Staff',
    'cns-staff',
    'active',
    'enterprise',
    'Component Normalization Service staff organization'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- Seed Organization 3: Demo Customer
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000000'::uuid,
    'Demo Organization',
    'demo-org',
    'trial',
    'standard',
    'Demo customer organization for testing'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- Seed User 1: Platform Super Admin
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    'superadmin@ananta.dev',
    'Platform',
    'Admin',
    'super_admin',
    true,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_platform_admin = EXCLUDED.is_platform_admin;

-- Seed User 2: CNS Staff Lead
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000002'::uuid,
    'cns-lead@ananta.dev',
    'CNS',
    'Lead',
    'admin',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- Seed User 3: CNS Engineer
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000003'::uuid,
    'cns-engineer@ananta.dev',
    'CNS',
    'Engineer',
    'engineer',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- Seed User 4: Demo Owner
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000004'::uuid,
    'demo-owner@example.com',
    'Demo',
    'Owner',
    'owner',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- Seed User 5: Demo Engineer
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000005'::uuid,
    'demo-engineer@example.com',
    'Demo',
    'Engineer',
    'engineer',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- Seed Organization Memberships
INSERT INTO public.organization_memberships (user_id, organization_id, role)
VALUES
    ('b0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
    ('b0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'admin'),
    ('b0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'engineer'),
    ('b0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'owner'),
    ('b0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'engineer')
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role;

-- Seed Suppliers
INSERT INTO public.suppliers (name, slug, api_key_required, website, priority, is_active)
VALUES
    ('DigiKey', 'digikey', true, 'https://www.digikey.com', 100, true),
    ('Mouser Electronics', 'mouser', true, 'https://www.mouser.com', 90, true),
    ('Element14', 'element14', true, 'https://www.element14.com', 80, true),
    ('Arrow Electronics', 'arrow', false, 'https://www.arrow.com', 70, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed Manufacturers (Top 20)
INSERT INTO public.manufacturers (name, slug, website, is_verified, normalized_name)
VALUES
    ('Texas Instruments', 'texas-instruments', 'https://www.ti.com', true, 'texas instruments'),
    ('Analog Devices', 'analog-devices', 'https://www.analog.com', true, 'analog devices'),
    ('STMicroelectronics', 'stmicroelectronics', 'https://www.st.com', true, 'stmicroelectronics'),
    ('NXP Semiconductors', 'nxp', 'https://www.nxp.com', true, 'nxp semiconductors'),
    ('Microchip Technology', 'microchip', 'https://www.microchip.com', true, 'microchip technology'),
    ('Infineon', 'infineon', 'https://www.infineon.com', true, 'infineon'),
    ('ON Semiconductor', 'on-semi', 'https://www.onsemi.com', true, 'on semiconductor'),
    ('Renesas', 'renesas', 'https://www.renesas.com', true, 'renesas'),
    ('Murata', 'murata', 'https://www.murata.com', true, 'murata'),
    ('TDK', 'tdk', 'https://www.tdk.com', true, 'tdk'),
    ('Vishay', 'vishay', 'https://www.vishay.com', true, 'vishay'),
    ('Yageo', 'yageo', 'https://www.yageo.com', true, 'yageo'),
    ('TE Connectivity', 'te-connectivity', 'https://www.te.com', true, 'te connectivity'),
    ('Molex', 'molex', 'https://www.molex.com', true, 'molex'),
    ('Amphenol', 'amphenol', 'https://www.amphenol.com', true, 'amphenol')
ON CONFLICT (slug) DO NOTHING;

-- Seed Root Categories
INSERT INTO public.categories (name, slug, level, path, description)
VALUES
    ('Passive Components', 'passive-components', 0, 'Passive Components', 'Resistors, Capacitors, Inductors'),
    ('Active Components', 'active-components', 0, 'Active Components', 'ICs, Transistors, Diodes'),
    ('Electromechanical', 'electromechanical', 0, 'Electromechanical', 'Connectors, Switches, Relays'),
    ('Power', 'power', 0, 'Power', 'Power supplies, Regulators'),
    ('RF & Wireless', 'rf-wireless', 0, 'RF & Wireless', 'Antennas, RF modules'),
    ('Sensors', 'sensors', 0, 'Sensors', 'Temperature, Pressure, Motion sensors')
ON CONFLICT (slug) DO NOTHING;

-- Seed Default CNS Config
INSERT INTO public.cns_enrichment_config (config_name, is_active, is_global, enable_suppliers, enable_ai)
VALUES ('Global Default', true, true, true, false)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    SELECT COUNT(*) INTO function_count FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '  SUPABASE MASTER MIGRATION V6.0 COMPLETE';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '  Total Tables: %', table_count;
    RAISE NOTICE '  Total Functions: %', function_count;
    RAISE NOTICE '';
    RAISE NOTICE 'SEED DATA CREATED:';
    RAISE NOTICE '  - 3 Organizations (Platform Admin, CNS Staff, Demo Org)';
    RAISE NOTICE '  - 5 Users (super_admin, cns-lead, cns-engineer, demo-owner, demo-engineer)';
    RAISE NOTICE '  - 5 Organization memberships';
    RAISE NOTICE '  - 4 Suppliers (DigiKey, Mouser, Element14, Arrow)';
    RAISE NOTICE '  - 15 Manufacturers';
    RAISE NOTICE '  - 6 Root categories';
    RAISE NOTICE '  - 1 Global CNS config';
    RAISE NOTICE '';
    RAISE NOTICE 'KEY FEATURES:';
    RAISE NOTICE '  - Multi-org user management';
    RAISE NOTICE '  - Workspace/Project hierarchy';
    RAISE NOTICE '  - Complete BOM enrichment pipeline';
    RAISE NOTICE '  - Alert & notification system';
    RAISE NOTICE '  - Audit trail & event logging';
    RAISE NOTICE '  - Full-text search on components';
    RAISE NOTICE '================================================================';
END $$;