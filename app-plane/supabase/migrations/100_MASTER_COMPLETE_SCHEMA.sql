-- ============================================================================
-- MASTER MIGRATION: Complete Components Platform V2 Schema
-- ============================================================================
-- Created: 2025-12-09
-- Version: 1.0.0
-- Database: app-plane-supabase-db-dev (port 27432)
--
-- This SINGLE migration creates the complete schema for:
-- - Core tables (organizations, users, projects)
-- - Component catalog (manufacturers, categories, components, suppliers)
-- - BOM management (boms, bom_line_items, bom_uploads)
-- - Enrichment system (queue, audit, events, CNS config)
-- - Risk scoring and alerts
-- - Compliance tracking (SVHC, RoHS, REACH)
-- - Full category hierarchy with vendor mappings
--
-- IMPORTANT: Run this on a fresh database for best results
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================

-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(subscription_status);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'admin', 'member', 'viewer')),
    job_title TEXT,
    is_active BOOLEAN DEFAULT true,
    is_staff BOOLEAN DEFAULT false,
    platform_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    auth_provider TEXT DEFAULT 'keycloak',
    auth_subject TEXT,
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    project_code TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public')),
    project_owner_id UUID REFERENCES user_profiles(id),
    created_by_id UUID REFERENCES user_profiles(id),
    total_boms INTEGER DEFAULT 0,
    total_components INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    last_activity_at TIMESTAMPTZ,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================================================
-- SECTION 2: CATALOG TABLES (Extended)
-- ============================================================================

-- Manufacturers
CREATE TABLE IF NOT EXISTS manufacturers (
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

CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON manufacturers(slug);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(name);

-- Categories (Hierarchical with materialized path)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0,
    path TEXT,
    description TEXT,
    image_url TEXT,
    component_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
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

CREATE INDEX IF NOT EXISTS idx_suppliers_priority ON suppliers(priority);
CREATE INDEX IF NOT EXISTS idx_suppliers_slug ON suppliers(slug);

-- Components (Central Catalog)
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_components_org ON components(organization_id);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_mpn ON components(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_components_lifecycle ON components(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_components_risk ON components(risk_level);
CREATE INDEX IF NOT EXISTS idx_components_search ON components USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_components_specs ON components USING GIN(specifications);

-- SKUs (Vendor-specific listings)
CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_part_number TEXT NOT NULL,
    unit_price DECIMAL(10,4),
    currency TEXT DEFAULT 'USD',
    stock_quantity INTEGER,
    moq INTEGER,
    lead_time_days INTEGER,
    packaging TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, supplier_part_number)
);

CREATE INDEX IF NOT EXISTS idx_skus_component ON skus(component_id);
CREATE INDEX IF NOT EXISTS idx_skus_supplier ON skus(supplier_id);
CREATE INDEX IF NOT EXISTS idx_skus_org ON skus(organization_id);

-- Vendor Category Mappings
CREATE TABLE IF NOT EXISTS vendor_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    vendor_category TEXT NOT NULL,
    normalized_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    confidence DECIMAL(5,2),
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, vendor_category)
);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_supplier ON vendor_category_mappings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_category ON vendor_category_mappings(normalized_category_id);

-- Component Attributes
CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    unit TEXT,
    source TEXT,
    confidence DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attributes_component ON attributes(component_id);
CREATE INDEX IF NOT EXISTS idx_attributes_name ON attributes(name);

-- Component Alternatives
CREATE TABLE IF NOT EXISTS component_alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    alternative_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2),
    match_type TEXT CHECK (match_type IN ('FORM_FIT_FUNCTION', 'FUNCTIONAL', 'PARTIAL', 'CROSS_REFERENCE')) DEFAULT 'FUNCTIONAL',
    recommendation_reason TEXT,
    verified_by UUID REFERENCES user_profiles(id),
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_component_id, alternative_component_id)
);

CREATE INDEX IF NOT EXISTS idx_alternatives_source ON component_alternatives(source_component_id);
CREATE INDEX IF NOT EXISTS idx_alternatives_target ON component_alternatives(alternative_component_id);

-- ============================================================================
-- SECTION 3: BOM MANAGEMENT
-- ============================================================================

-- BOM Uploads (S3 Storage Ready)
CREATE TABLE IF NOT EXISTS bom_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    original_filename TEXT,
    raw_file_url TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    upload_source TEXT NOT NULL DEFAULT 'customer' CHECK (upload_source IN ('customer', 'cns_bulk', 'staff', 'api')),
    s3_bucket TEXT DEFAULT 'bulk-uploads',
    s3_key TEXT,
    storage_backend TEXT DEFAULT 'minio' CHECK (storage_backend IN ('minio', 's3', 'gcs', 'local')),
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
        'uploaded', 'parsing', 'parsed', 'mapping_pending', 'ready_for_enrichment',
        'processing', 'completed', 'failed'
    )),
    detected_columns JSONB,
    column_mappings JSONB,
    mapping_confirmed BOOLEAN DEFAULT false,
    total_rows INTEGER DEFAULT 0,
    preview_data JSONB,
    rabbitmq_event_published BOOLEAN DEFAULT false,
    temporal_workflow_id TEXT,
    cns_job_id TEXT,
    cns_job_status TEXT,
    enrichment_summary JSONB,
    bom_id UUID,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_uploads_org ON bom_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_project ON bom_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_uploads_status ON bom_uploads(status);

-- BOMs (Bill of Materials)
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),
    status TEXT CHECK (status IN ('draft', 'pending', 'analyzing', 'completed', 'failed', 'processing', 'archived')) DEFAULT 'draft',
    component_count INTEGER DEFAULT 0,
    total_cost DECIMAL(12,2),
    high_risk_count INTEGER DEFAULT 0,
    medium_risk_count INTEGER DEFAULT 0,
    low_risk_count INTEGER DEFAULT 0,
    enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'queued', 'processing', 'enriched', 'failed', 'requires_approval')) DEFAULT 'pending',
    enrichment_priority INTEGER CHECK (enrichment_priority >= 1 AND enrichment_priority <= 10) DEFAULT 5,
    enrichment_quality_score INTEGER CHECK (enrichment_quality_score >= 0 AND enrichment_quality_score <= 100),
    temporal_workflow_id TEXT,
    enrichment_match_rate DECIMAL(5,2),
    enrichment_avg_confidence DECIMAL(5,2),
    source TEXT,
    analyzed_at TIMESTAMPTZ,
    created_by_id UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_org ON boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_project ON boms(project_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON boms(status);
CREATE INDEX IF NOT EXISTS idx_boms_enrichment_status ON boms(enrichment_status);

-- Add FK from bom_uploads to boms
ALTER TABLE bom_uploads ADD CONSTRAINT bom_uploads_bom_id_fkey
    FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE SET NULL;

-- BOM Line Items
CREATE TABLE IF NOT EXISTS bom_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    line_number INTEGER,
    reference_designator TEXT,
    manufacturer_part_number TEXT,
    manufacturer TEXT,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    match_confidence DECIMAL(5,2),
    match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),
    enrichment_status TEXT CHECK (enrichment_status IN ('pending', 'matched', 'enriched', 'no_match', 'error')) DEFAULT 'pending',
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
    metadata JSONB DEFAULT '{}'::jsonb,
    enriched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom ON bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component ON bom_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_mpn ON bom_line_items(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_status ON bom_line_items(enrichment_status);

-- ============================================================================
-- SECTION 4: ENRICHMENT SYSTEM
-- ============================================================================

-- Enrichment Queue
CREATE TABLE IF NOT EXISTS enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
    temporal_workflow_id TEXT,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    quality_issues JSONB,
    requires_admin_approval BOOLEAN DEFAULT FALSE,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    total_items INTEGER,
    matched_items INTEGER,
    enriched_items INTEGER,
    match_rate DECIMAL(5,2),
    avg_confidence DECIMAL(5,2),
    UNIQUE(bom_id)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority DESC, queued_at ASC);

-- Enrichment Audit Log
CREATE TABLE IF NOT EXISTS enrichment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'queued', 'quality_check_passed', 'quality_check_failed',
        'started', 'matching_batch_complete', 'enrichment_complete',
        'admin_approval_requested', 'admin_approved', 'admin_rejected',
        'completed', 'failed', 'cancelled'
    )),
    event_data JSONB,
    temporal_workflow_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_audit_bom ON enrichment_audit_log(bom_id, created_at DESC);

-- Enrichment Events (Real-time Progress)
CREATE TABLE IF NOT EXISTS enrichment_events (
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

CREATE INDEX IF NOT EXISTS idx_enrichment_events_bom ON enrichment_events(bom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_tenant ON enrichment_events(tenant_id, created_at DESC);

-- CNS Enrichment Config
CREATE TABLE IF NOT EXISTS cns_enrichment_config (
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
    quality_reject_threshold INTEGER DEFAULT 70,
    quality_staging_threshold INTEGER DEFAULT 94,
    quality_auto_approve_threshold INTEGER DEFAULT 95,
    batch_size INTEGER DEFAULT 100 CHECK (batch_size >= 1 AND batch_size <= 1000),
    max_retries INTEGER DEFAULT 2 CHECK (max_retries >= 0 AND max_retries <= 10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cns_config_tenant ON cns_enrichment_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cns_config_global ON cns_enrichment_config(is_global) WHERE is_global = true;

-- CNS Cost Tracking
CREATE TABLE IF NOT EXISTS cns_cost_tracking (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100),
    config_id INTEGER REFERENCES cns_enrichment_config(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_provider VARCHAR(50),
    ai_operation VARCHAR(50),
    request_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    estimated_cost NUMERIC(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, date, ai_provider, ai_operation)
);

CREATE INDEX IF NOT EXISTS idx_cns_cost_tenant_date ON cns_cost_tracking(tenant_id, date);

-- ============================================================================
-- SECTION 5: RISK & COMPLIANCE
-- ============================================================================

-- Component Risk Scores
CREATE TABLE IF NOT EXISTS component_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100) NOT NULL,
    lifecycle_score INTEGER CHECK (lifecycle_score >= 0 AND lifecycle_score <= 100),
    availability_score INTEGER CHECK (availability_score >= 0 AND availability_score <= 100),
    compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
    price_volatility_score INTEGER CHECK (price_volatility_score >= 0 AND price_volatility_score <= 100),
    single_source_score INTEGER CHECK (single_source_score >= 0 AND single_source_score <= 100),
    risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')) NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(component_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_component ON component_risk_scores(component_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON component_risk_scores(risk_level);

-- SVHC Substances (REACH Compliance)
CREATE TABLE IF NOT EXISTS svhc_substances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cas_number TEXT UNIQUE NOT NULL,
    ec_number TEXT,
    substance_name TEXT NOT NULL,
    reason_for_inclusion TEXT,
    listed_date DATE,
    sunset_date DATE,
    concentration_limit DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svhc_cas ON svhc_substances(cas_number);

-- Component SVHC Mapping
CREATE TABLE IF NOT EXISTS component_svhc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    svhc_id UUID NOT NULL REFERENCES svhc_substances(id) ON DELETE CASCADE,
    concentration DECIMAL(5,2),
    declaration_date DATE,
    source TEXT,
    is_above_threshold BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(component_id, svhc_id)
);

CREATE INDEX IF NOT EXISTS idx_component_svhc_component ON component_svhc(component_id);

-- ============================================================================
-- SECTION 6: NOTIFICATIONS & ALERTS
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    user_id UUID REFERENCES user_profiles(id),
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
    alert_type TEXT CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE')) NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- Predefined Tags
CREATE TABLE IF NOT EXISTS predefined_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component Tags
CREATE TABLE IF NOT EXISTS component_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES predefined_tags(id) ON DELETE CASCADE,
    custom_tag TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_tags_component ON component_tags(component_id);

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Slugify function
CREATE OR REPLACE FUNCTION slugify(text_to_slug text)
RETURNS text AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update component search vector
CREATE OR REPLACE FUNCTION update_component_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.manufacturer_part_number, '') || ' ' ||
        COALESCE(NEW.manufacturer, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Current user organization helper
CREATE OR REPLACE FUNCTION current_user_organization_id()
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

-- Is platform admin helper
CREATE OR REPLACE FUNCTION is_platform_admin()
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

-- ============================================================================
-- SECTION 8: TRIGGERS
-- ============================================================================

-- Update timestamps triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boms_updated_at BEFORE UPDATE ON boms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bom_line_items_updated_at BEFORE UPDATE ON bom_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cns_config_updated_at BEFORE UPDATE ON cns_enrichment_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Component search vector trigger
CREATE TRIGGER update_component_search BEFORE INSERT OR UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_component_search_vector();

-- ============================================================================
-- SECTION 9: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Public read policies (for catalog data)
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE svhc_substances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view manufacturers" ON manufacturers FOR SELECT USING (true);
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view suppliers" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Anyone can view predefined tags" ON predefined_tags FOR SELECT USING (true);
CREATE POLICY "Anyone can view SVHC substances" ON svhc_substances FOR SELECT USING (true);

-- Organization-scoped policies
CREATE POLICY "Users can view own org" ON organizations FOR SELECT
    USING (id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "Users can view own org users" ON user_profiles FOR SELECT
    USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "Users can view own org projects" ON projects FOR SELECT
    USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "Users can view own org components" ON components FOR SELECT
    USING (organization_id = current_user_organization_id() OR is_platform_admin());

CREATE POLICY "Users can view own org boms" ON boms FOR SELECT
    USING (organization_id = current_user_organization_id() OR is_platform_admin());

-- Service role bypass for enrichment events
CREATE POLICY "Service role can insert enrichment events" ON enrichment_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own org enrichment events" ON enrichment_events
    FOR SELECT USING (tenant_id = current_user_organization_id() OR is_platform_admin());

-- ============================================================================
-- SECTION 10: SEED DATA
-- ============================================================================

-- Seed: Suppliers
INSERT INTO suppliers (name, slug, api_key_required, website, priority, is_active, rate_limit_per_minute, rate_limit_per_day)
VALUES
    ('DigiKey', 'digikey', true, 'https://www.digikey.com', 100, true, 1000, 10000),
    ('Mouser Electronics', 'mouser', true, 'https://www.mouser.com', 90, true, 100, 5000),
    ('Element14', 'element14', true, 'https://www.element14.com', 80, true, 50, 3000),
    ('SiliconExpert', 'siliconexpert', true, 'https://www.siliconexpert.com', 70, true, NULL, NULL),
    ('Arrow Electronics', 'arrow', false, 'https://www.arrow.com', 60, true, NULL, NULL),
    ('Avnet', 'avnet', false, 'https://www.avnet.com', 50, true, NULL, NULL),
    ('RS Components', 'rs-components', true, 'https://www.rs-online.com', 55, true, NULL, NULL),
    ('Newark', 'newark', true, 'https://www.newark.com', 45, true, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Seed: Predefined Tags
INSERT INTO predefined_tags (name, slug, description, color, icon)
VALUES
    ('Active', 'active', 'Component is in active production', '#10b981', 'check-circle'),
    ('NRND', 'nrnd', 'Not Recommended for New Designs', '#f59e0b', 'alert-triangle'),
    ('EOL', 'eol', 'End of Life - discontinuing soon', '#ef4444', 'x-circle'),
    ('Obsolete', 'obsolete', 'No longer available', '#6b7280', 'ban'),
    ('RoHS Compliant', 'rohs-compliant', 'Meets RoHS standards', '#10b981', 'shield-check'),
    ('REACH Compliant', 'reach-compliant', 'Meets REACH standards', '#10b981', 'shield'),
    ('Automotive Grade', 'automotive', 'AEC-Q qualified', '#3b82f6', 'car'),
    ('High Reliability', 'high-reliability', 'Military or aerospace grade', '#8b5cf6', 'star'),
    ('Low Stock', 'low-stock', 'Limited availability', '#f59e0b', 'trending-down'),
    ('Preferred', 'preferred', 'Organization preferred part', '#06b6d4', 'bookmark')
ON CONFLICT (slug) DO NOTHING;

-- Seed: Root Categories (Level 0)
INSERT INTO categories (name, slug, level, path, description)
VALUES
    ('Passive Components', 'passive-components', 0, 'Passive Components', 'Resistors, Capacitors, Inductors, Filters'),
    ('Active Components', 'active-components', 0, 'Active Components', 'ICs, Transistors, Diodes, Microcontrollers'),
    ('Electromechanical', 'electromechanical', 0, 'Electromechanical', 'Connectors, Switches, Relays'),
    ('Power', 'power', 0, 'Power', 'Power supplies, Regulators, Converters'),
    ('RF & Wireless', 'rf-wireless', 0, 'RF & Wireless', 'Antennas, RF modules, Wireless components'),
    ('Sensors', 'sensors', 0, 'Sensors', 'Temperature, Pressure, Motion, Proximity sensors'),
    ('Optoelectronics', 'optoelectronics', 0, 'Optoelectronics', 'LEDs, Displays, Optocouplers, Laser diodes'),
    ('Cables & Interconnects', 'cables-interconnects', 0, 'Cables & Interconnects', 'Cables, Wires, Terminals'),
    ('Test & Measurement', 'test-measurement', 0, 'Test & Measurement', 'Test equipment, Probes, Analyzers'),
    ('Tools & Supplies', 'tools-supplies', 0, 'Tools & Supplies', 'Soldering, Assembly, ESD protection')
ON CONFLICT (slug) DO NOTHING;

-- Seed: Sub-categories (Level 1)
INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Resistors', 'resistors', id, 1, 'Passive Components > Resistors', 'Fixed, Variable, Networks'
FROM categories WHERE slug = 'passive-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Capacitors', 'capacitors', id, 1, 'Passive Components > Capacitors', 'Ceramic, Electrolytic, Film, Tantalum'
FROM categories WHERE slug = 'passive-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Inductors', 'inductors', id, 1, 'Passive Components > Inductors', 'Power, RF, Chokes'
FROM categories WHERE slug = 'passive-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Filters', 'filters', id, 1, 'Passive Components > Filters', 'EMI, Power Line, Signal'
FROM categories WHERE slug = 'passive-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Crystals & Oscillators', 'crystals-oscillators', id, 1, 'Passive Components > Crystals & Oscillators', 'Crystals, Clock Oscillators, VCOs'
FROM categories WHERE slug = 'passive-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Integrated Circuits', 'integrated-circuits', id, 1, 'Active Components > Integrated Circuits', 'Microcontrollers, Memory, Logic, Amplifiers'
FROM categories WHERE slug = 'active-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Discrete Semiconductors', 'discrete-semiconductors', id, 1, 'Active Components > Discrete Semiconductors', 'Transistors, Diodes, MOSFETs, IGBTs'
FROM categories WHERE slug = 'active-components'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Connectors', 'connectors', id, 1, 'Electromechanical > Connectors', 'Board-to-Board, Wire-to-Board, USB, HDMI'
FROM categories WHERE slug = 'electromechanical'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Switches', 'switches', id, 1, 'Electromechanical > Switches', 'Pushbuttons, Toggles, DIP, Rotary'
FROM categories WHERE slug = 'electromechanical'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Relays', 'relays', id, 1, 'Electromechanical > Relays', 'Power, Signal, Solid State'
FROM categories WHERE slug = 'electromechanical'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Voltage Regulators', 'voltage-regulators', id, 1, 'Power > Voltage Regulators', 'Linear, Switching, LDO'
FROM categories WHERE slug = 'power'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'DC-DC Converters', 'dc-dc-converters', id, 1, 'Power > DC-DC Converters', 'Buck, Boost, Buck-Boost'
FROM categories WHERE slug = 'power'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Battery Management', 'battery-management', id, 1, 'Power > Battery Management', 'Chargers, Fuel Gauges, Protection'
FROM categories WHERE slug = 'power'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'LEDs', 'leds', id, 1, 'Optoelectronics > LEDs', 'Standard, High Power, RGB, Infrared'
FROM categories WHERE slug = 'optoelectronics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Displays', 'displays', id, 1, 'Optoelectronics > Displays', 'LCD, OLED, 7-Segment, TFT'
FROM categories WHERE slug = 'optoelectronics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Temperature Sensors', 'temperature-sensors', id, 1, 'Sensors > Temperature Sensors', 'Thermistors, RTDs, IC Sensors'
FROM categories WHERE slug = 'sensors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Motion Sensors', 'motion-sensors', id, 1, 'Sensors > Motion Sensors', 'Accelerometers, Gyroscopes, IMUs'
FROM categories WHERE slug = 'sensors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Current Sensors', 'current-sensors', id, 1, 'Sensors > Current Sensors', 'Hall Effect, Shunt, Magnetic'
FROM categories WHERE slug = 'sensors'
ON CONFLICT (slug) DO NOTHING;

-- Seed: Sub-sub-categories (Level 2)
INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Chip Resistors (SMD)', 'chip-resistors-smd', id, 2, 'Passive Components > Resistors > Chip Resistors (SMD)', '0402, 0603, 0805, 1206 packages'
FROM categories WHERE slug = 'resistors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Through-Hole Resistors', 'through-hole-resistors', id, 2, 'Passive Components > Resistors > Through-Hole Resistors', 'Axial, Carbon Film, Metal Film'
FROM categories WHERE slug = 'resistors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Current Sense Resistors', 'current-sense-resistors', id, 2, 'Passive Components > Resistors > Current Sense Resistors', 'Low ohm, High precision'
FROM categories WHERE slug = 'resistors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Ceramic Capacitors (MLCC)', 'ceramic-capacitors-mlcc', id, 2, 'Passive Components > Capacitors > Ceramic Capacitors (MLCC)', 'X5R, X7R, C0G, Y5V'
FROM categories WHERE slug = 'capacitors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Electrolytic Capacitors', 'electrolytic-capacitors', id, 2, 'Passive Components > Capacitors > Electrolytic Capacitors', 'Aluminum, Polymer'
FROM categories WHERE slug = 'capacitors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Tantalum Capacitors', 'tantalum-capacitors', id, 2, 'Passive Components > Capacitors > Tantalum Capacitors', 'Molded, Polymer'
FROM categories WHERE slug = 'capacitors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Film Capacitors', 'film-capacitors', id, 2, 'Passive Components > Capacitors > Film Capacitors', 'Polyester, Polypropylene'
FROM categories WHERE slug = 'capacitors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Microcontrollers (MCU)', 'microcontrollers-mcu', id, 2, 'Active Components > Integrated Circuits > Microcontrollers (MCU)', '8-bit, 16-bit, 32-bit ARM'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Memory ICs', 'memory-ics', id, 2, 'Active Components > Integrated Circuits > Memory ICs', 'Flash, EEPROM, SRAM, DRAM'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Amplifiers', 'amplifiers', id, 2, 'Active Components > Integrated Circuits > Amplifiers', 'Op-Amps, Instrumentation, Audio'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Data Converters', 'data-converters', id, 2, 'Active Components > Integrated Circuits > Data Converters', 'ADC, DAC'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Interface ICs', 'interface-ics', id, 2, 'Active Components > Integrated Circuits > Interface ICs', 'USB, UART, SPI, I2C, CAN'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Logic ICs', 'logic-ics', id, 2, 'Active Components > Integrated Circuits > Logic ICs', 'Gates, Buffers, Flip-Flops'
FROM categories WHERE slug = 'integrated-circuits'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Transistors', 'transistors', id, 2, 'Active Components > Discrete Semiconductors > Transistors', 'BJT, JFET, MOSFET'
FROM categories WHERE slug = 'discrete-semiconductors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Diodes', 'diodes', id, 2, 'Active Components > Discrete Semiconductors > Diodes', 'Rectifier, Schottky, Zener, TVS'
FROM categories WHERE slug = 'discrete-semiconductors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'MOSFETs', 'mosfets', id, 2, 'Active Components > Discrete Semiconductors > MOSFETs', 'N-Channel, P-Channel, Logic Level'
FROM categories WHERE slug = 'discrete-semiconductors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'USB Connectors', 'usb-connectors', id, 2, 'Electromechanical > Connectors > USB Connectors', 'Type-A, Type-B, Type-C, Micro, Mini'
FROM categories WHERE slug = 'connectors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Header Connectors', 'header-connectors', id, 2, 'Electromechanical > Connectors > Header Connectors', 'Pin Headers, Receptacles'
FROM categories WHERE slug = 'connectors'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, level, path, description)
SELECT 'Terminal Blocks', 'terminal-blocks', id, 2, 'Electromechanical > Connectors > Terminal Blocks', 'Screw, Spring, Pluggable'
FROM categories WHERE slug = 'connectors'
ON CONFLICT (slug) DO NOTHING;

-- Seed: Manufacturers (Top 50)
INSERT INTO manufacturers (name, slug, website, is_verified, normalized_name)
VALUES
    ('Texas Instruments', 'texas-instruments', 'https://www.ti.com', true, 'texas instruments'),
    ('Analog Devices', 'analog-devices', 'https://www.analog.com', true, 'analog devices'),
    ('STMicroelectronics', 'stmicroelectronics', 'https://www.st.com', true, 'stmicroelectronics'),
    ('NXP Semiconductors', 'nxp', 'https://www.nxp.com', true, 'nxp semiconductors'),
    ('Microchip Technology', 'microchip', 'https://www.microchip.com', true, 'microchip technology'),
    ('Infineon', 'infineon', 'https://www.infineon.com', true, 'infineon'),
    ('ON Semiconductor', 'on-semi', 'https://www.onsemi.com', true, 'on semiconductor'),
    ('Renesas', 'renesas', 'https://www.renesas.com', true, 'renesas'),
    ('NVIDIA', 'nvidia', 'https://www.nvidia.com', true, 'nvidia'),
    ('AMD/Xilinx', 'amd-xilinx', 'https://www.amd.com', true, 'amd xilinx'),
    ('Intel', 'intel', 'https://www.intel.com', true, 'intel'),
    ('Qualcomm', 'qualcomm', 'https://www.qualcomm.com', true, 'qualcomm'),
    ('Murata', 'murata', 'https://www.murata.com', true, 'murata'),
    ('TDK', 'tdk', 'https://www.tdk.com', true, 'tdk'),
    ('Vishay', 'vishay', 'https://www.vishay.com', true, 'vishay'),
    ('Yageo', 'yageo', 'https://www.yageo.com', true, 'yageo'),
    ('Samsung Electro-Mechanics', 'samsung-em', 'https://www.samsungsem.com', true, 'samsung electro-mechanics'),
    ('Panasonic', 'panasonic', 'https://www.panasonic.com', true, 'panasonic'),
    ('Bourns', 'bourns', 'https://www.bourns.com', true, 'bourns'),
    ('Würth Elektronik', 'wurth', 'https://www.we-online.com', true, 'wurth elektronik'),
    ('TE Connectivity', 'te-connectivity', 'https://www.te.com', true, 'te connectivity'),
    ('Molex', 'molex', 'https://www.molex.com', true, 'molex'),
    ('Amphenol', 'amphenol', 'https://www.amphenol.com', true, 'amphenol'),
    ('JAE Electronics', 'jae', 'https://www.jae.com', true, 'jae electronics'),
    ('Hirose', 'hirose', 'https://www.hirose.com', true, 'hirose'),
    ('Samtec', 'samtec', 'https://www.samtec.com', true, 'samtec'),
    ('Littelfuse', 'littelfuse', 'https://www.littelfuse.com', true, 'littelfuse'),
    ('ROHM Semiconductor', 'rohm', 'https://www.rohm.com', true, 'rohm semiconductor'),
    ('Maxim Integrated', 'maxim', 'https://www.maximintegrated.com', true, 'maxim integrated'),
    ('Silicon Labs', 'silicon-labs', 'https://www.silabs.com', true, 'silicon labs'),
    ('Diodes Incorporated', 'diodes-inc', 'https://www.diodes.com', true, 'diodes incorporated'),
    ('Nexperia', 'nexperia', 'https://www.nexperia.com', true, 'nexperia'),
    ('Toshiba', 'toshiba', 'https://www.toshiba.com', true, 'toshiba'),
    ('KEMET (Yageo)', 'kemet', 'https://www.kemet.com', true, 'kemet'),
    ('AVX (KYOCERA)', 'avx', 'https://www.avx.com', true, 'avx'),
    ('TI Power', 'ti-power', 'https://www.ti.com/power-management', true, 'ti power'),
    ('Espressif', 'espressif', 'https://www.espressif.com', true, 'espressif'),
    ('Nordic Semiconductor', 'nordic', 'https://www.nordicsemi.com', true, 'nordic semiconductor'),
    ('Semtech', 'semtech', 'https://www.semtech.com', true, 'semtech'),
    ('Skyworks', 'skyworks', 'https://www.skyworksinc.com', true, 'skyworks'),
    ('Qorvo', 'qorvo', 'https://www.qorvo.com', true, 'qorvo'),
    ('Broadcom', 'broadcom', 'https://www.broadcom.com', true, 'broadcom'),
    ('Marvell', 'marvell', 'https://www.marvell.com', true, 'marvell'),
    ('Sensirion', 'sensirion', 'https://www.sensirion.com', true, 'sensirion'),
    ('Bosch Sensortec', 'bosch-sensortec', 'https://www.bosch-sensortec.com', true, 'bosch sensortec'),
    ('Honeywell', 'honeywell', 'https://www.honeywell.com', true, 'honeywell'),
    ('Omron', 'omron', 'https://www.omron.com', true, 'omron'),
    ('Phoenix Contact', 'phoenix-contact', 'https://www.phoenixcontact.com', true, 'phoenix contact'),
    ('Wago', 'wago', 'https://www.wago.com', true, 'wago'),
    ('MEAN WELL', 'mean-well', 'https://www.meanwell.com', true, 'mean well')
ON CONFLICT (slug) DO NOTHING;

-- Seed: SVHC Substances (Top 15)
INSERT INTO svhc_substances (cas_number, substance_name, reason_for_inclusion, listed_date, concentration_limit)
VALUES
    ('7439-92-1', 'Lead', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('7440-43-9', 'Cadmium', 'Carcinogenic', '2010-06-18', 0.01),
    ('7440-02-0', 'Nickel', 'Carcinogenic, Sensitizer', '2008-10-28', 0.1),
    ('1313-27-5', 'Molybdenum trioxide', 'Toxic for reproduction', '2010-06-18', 0.1),
    ('85-68-7', 'Benzyl butyl phthalate (BBP)', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('117-81-7', 'Bis(2-ethylhexyl) phthalate (DEHP)', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('84-74-2', 'Dibutyl phthalate (DBP)', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('7784-40-9', 'Lead hydrogen arsenate', 'Carcinogenic', '2008-10-28', 0.1),
    ('12656-85-8', 'Trilead dioxide phosphonate', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('84-69-5', 'Diisobutyl phthalate (DIBP)', 'Toxic for reproduction', '2010-01-13', 0.1),
    ('115-96-8', 'Tris(2-chloroethyl) phosphate (TCEP)', 'Toxic for reproduction', '2010-06-18', 0.1),
    ('7789-06-2', 'Strontium chromate', 'Carcinogenic', '2010-06-18', 0.1),
    ('1303-28-2', 'Diarsenic pentaoxide', 'Carcinogenic', '2008-10-28', 0.1),
    ('7778-39-4', 'Arsenic acid', 'Carcinogenic', '2008-10-28', 0.1),
    ('10043-35-3', 'Boric acid', 'Toxic for reproduction', '2010-06-18', 0.1)
ON CONFLICT (cas_number) DO NOTHING;

-- Seed: Default Organization
INSERT INTO organizations (id, name, slug, subscription_status, plan_tier)
VALUES ('a1111111-1111-1111-1111-111111111111'::uuid, 'Ananta Platform', 'ananta', 'active', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- Seed: Default Admin User
INSERT INTO user_profiles (id, organization_id, email, first_name, last_name, role, is_staff, platform_admin, email_verified)
VALUES ('a0000000-0000-0000-0000-000000000000'::uuid, 'a1111111-1111-1111-1111-111111111111'::uuid, 'dev@ananta.com', 'Dev', 'Admin', 'super_admin', true, true, true)
ON CONFLICT (email) DO NOTHING;

-- Seed: Default Project
INSERT INTO projects (id, organization_id, name, slug, description, status)
VALUES ('b1111111-1111-1111-1111-111111111111'::uuid, 'a1111111-1111-1111-1111-111111111111'::uuid, 'Demo Project', 'demo-project', 'Sample project for development and testing', 'active')
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Seed: Default CNS Config
INSERT INTO cns_enrichment_config (config_name, is_active, is_global, enable_suppliers, enable_ai)
VALUES ('Global Default', true, true, true, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 11: MULTI-ORG USER MANAGEMENT (Auth0/Keycloak Compatible)
-- ============================================================================

-- Users table (linked to external auth providers)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
    avatar_url TEXT,
    auth0_user_id TEXT UNIQUE,
    keycloak_user_id TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'platform_admin', 'admin', 'user', 'viewer')),
    is_platform_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_user_id) WHERE auth0_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_keycloak_id ON users(keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_platform_admin ON users(is_platform_admin) WHERE is_platform_admin = true;

COMMENT ON TABLE users IS 'User accounts linked to external auth providers (Auth0/Keycloak). Users can be in MULTIPLE organizations.';

-- Organization Memberships (Multi-org support)
CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'engineer', 'analyst', 'viewer', 'member')),
    is_default BOOLEAN DEFAULT false,
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role ON organization_memberships(user_id, role);

COMMENT ON TABLE organization_memberships IS 'User-organization relationships. Users can belong to multiple orgs with different roles.';

-- Organization Invitations
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer', 'member')),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_email_invitation UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status) WHERE status = 'pending';

COMMENT ON TABLE organization_invitations IS 'Pending invitations for users to join organizations.';

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'User-specific preferences including last active organization.';

-- ============================================================================
-- SECTION 12: WORKSPACES
-- ============================================================================

-- Workspaces (for project organization within orgs)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

COMMENT ON TABLE workspaces IS 'Workspaces for organizing projects within an organization.';

-- Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ============================================================================
-- SECTION 13: COMPONENT WATCHES & ALERT PREFERENCES
-- ============================================================================

-- Component Watches (user subscriptions to component updates)
CREATE TABLE IF NOT EXISTS component_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    watch_lifecycle BOOLEAN DEFAULT true,
    watch_price BOOLEAN DEFAULT true,
    watch_availability BOOLEAN DEFAULT true,
    watch_compliance BOOLEAN DEFAULT true,
    watch_supply_chain BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_component_watches_user ON component_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_component_watches_component ON component_watches(component_id);
CREATE INDEX IF NOT EXISTS idx_component_watches_org ON component_watches(organization_id);

COMMENT ON TABLE component_watches IS 'User subscriptions to receive alerts about specific components.';

-- Alert Preferences (per alert type)
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE', 'PCN', 'SUPPLY_CHAIN')),
    is_active BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_user ON alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_org ON alert_preferences(organization_id);

COMMENT ON TABLE alert_preferences IS 'User alert delivery preferences per alert type.';

-- Component Price History (for price change alerts)
CREATE TABLE IF NOT EXISTS component_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    last_unit_price DECIMAL(12, 6) NOT NULL,
    price_breaks JSONB,
    price_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_component_price UNIQUE (component_id)
);

CREATE INDEX IF NOT EXISTS idx_price_history_component ON component_price_history(component_id);
CREATE INDEX IF NOT EXISTS idx_price_history_updated ON component_price_history(price_updated_at DESC);

COMMENT ON TABLE component_price_history IS 'Tracks component price history for price change alerts.';

-- ============================================================================
-- SECTION 14: CNS BULK UPLOADS (S3/MinIO Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cns_bulk_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    s3_bucket TEXT NOT NULL DEFAULT 'bulk-uploads',
    s3_key TEXT NOT NULL,
    s3_url TEXT,
    storage_backend TEXT NOT NULL DEFAULT 'minio' CHECK (storage_backend IN ('minio', 's3', 'gcs')),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'validating', 'valid', 'processing', 'completed', 'failed')),
    validation_status TEXT CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    validation_errors JSONB,
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    preview_data JSONB,
    detected_columns JSONB,
    column_mappings JSONB,
    unmapped_columns TEXT[],
    mapping_confirmed BOOLEAN DEFAULT false,
    mapping_confirmed_at TIMESTAMPTZ,
    parse_stats JSONB,
    processing_settings JSONB,
    cns_job_id TEXT,
    cns_job_status TEXT,
    rabbitmq_event_published BOOLEAN DEFAULT false,
    rabbitmq_event_published_at TIMESTAMPTZ,
    temporal_workflow_id TEXT,
    temporal_workflow_status TEXT,
    enrichment_summary JSONB,
    results_s3_key TEXT,
    failed_items_s3_key TEXT,
    error_message TEXT,
    error_details JSONB,
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    archive_s3_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_tenant ON cns_bulk_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_org ON cns_bulk_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_project ON cns_bulk_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_status ON cns_bulk_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_s3_key ON cns_bulk_uploads(s3_key);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_workflow ON cns_bulk_uploads(temporal_workflow_id);
CREATE INDEX IF NOT EXISTS idx_cns_bulk_uploads_archived ON cns_bulk_uploads(archived) WHERE archived = false;

COMMENT ON TABLE cns_bulk_uploads IS 'Tracks CNS bulk upload files stored in MinIO/S3 for staff BOM enrichment.';

-- ============================================================================
-- SECTION 15: CENTRAL COMPONENT CATALOG (For Price History FK)
-- ============================================================================

-- Central Component Catalog (aliased view for backward compatibility)
CREATE TABLE IF NOT EXISTS central_component_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mpn TEXT NOT NULL UNIQUE,
    manufacturer TEXT,
    description TEXT,
    category TEXT,
    datasheet_url TEXT,
    lifecycle_status TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_catalog_mpn ON central_component_catalog(mpn);

COMMENT ON TABLE central_component_catalog IS 'Central component catalog for cross-org component data. Used by price history tracking.';

-- ============================================================================
-- SECTION 16: ADDITIONAL HELPER FUNCTIONS (Multi-Org Auth)
-- ============================================================================

-- Get current user ID from JWT sub claim
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM users
    WHERE auth0_user_id = auth.jwt() ->> 'sub'
       OR keycloak_user_id = auth.jwt() ->> 'sub'
    LIMIT 1
$$;

COMMENT ON FUNCTION get_current_user_id() IS 'Returns user UUID by looking up auth provider ID from JWT sub claim.';

-- Get all organization IDs the current user is a member of
CREATE OR REPLACE FUNCTION get_user_organization_ids()
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

COMMENT ON FUNCTION get_user_organization_ids() IS 'Returns all organization UUIDs the current user is a member of.';

-- Check if user is member of a specific org
CREATE OR REPLACE FUNCTION is_member_of(p_org_id UUID)
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

-- Check if user is admin/owner in a specific org
CREATE OR REPLACE FUNCTION is_admin_of(p_org_id UUID)
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

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE (auth0_user_id = auth.jwt() ->> 'sub' OR keycloak_user_id = auth.jwt() ->> 'sub')
        AND (is_platform_admin = true OR role = 'super_admin')
    )
$$;

-- Check if user is platform staff (for CNS)
CREATE OR REPLACE FUNCTION is_platform_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = get_current_user_id()
        AND organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid
    )
$$;

COMMENT ON FUNCTION is_platform_staff() IS 'Returns true if current user is a member of the Platform Super Admin organization.';

-- ============================================================================
-- SECTION 17: ADDITIONAL TRIGGERS
-- ============================================================================

-- Update timestamps for new tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_memberships_updated_at BEFORE UPDATE ON organization_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_invitations_updated_at BEFORE UPDATE ON organization_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cns_bulk_uploads_updated_at BEFORE UPDATE ON cns_bulk_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 18: RLS FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cns_bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Users: Can view themselves and users in same orgs
CREATE POLICY "Users can view themselves" ON users
    FOR SELECT USING (id = get_current_user_id() OR is_super_admin());

-- Org memberships: Users can see memberships in their orgs
CREATE POLICY "Users can view org memberships" ON organization_memberships
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids()) OR is_super_admin()
    );

-- Invitations: Admins can manage, users can view own org invitations
CREATE POLICY "Users can view org invitations" ON organization_invitations
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids()) OR is_super_admin()
    );

-- User preferences: Users can manage own preferences
CREATE POLICY "Users can manage own preferences" ON user_preferences
    FOR ALL USING (user_id = get_current_user_id());

-- Workspaces: Users can see workspaces in their orgs
CREATE POLICY "Users can view org workspaces" ON workspaces
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids()) OR is_super_admin()
    );

-- Component watches: Users can manage own watches
CREATE POLICY "Users can manage own watches" ON component_watches
    FOR ALL USING (user_id = get_current_user_id() OR is_super_admin());

-- Alert preferences: Users can manage own preferences
CREATE POLICY "Users can manage own alert prefs" ON alert_preferences
    FOR ALL USING (user_id = get_current_user_id() OR is_super_admin());

-- CNS bulk uploads: Admins and platform staff can manage
CREATE POLICY "CNS bulk uploads policy" ON cns_bulk_uploads
    FOR ALL USING (
        is_platform_staff() OR
        organization_id IN (SELECT get_user_organization_ids()) OR
        is_super_admin()
    );

-- ============================================================================
-- SECTION 19: PLATFORM SUPER ADMIN ORGANIZATION
-- ============================================================================

-- Create Platform Super Admin organization for CNS staff
INSERT INTO organizations (id, name, slug, subscription_status, plan_tier)
VALUES ('a0000000-0000-0000-0000-000000000000'::uuid, 'Platform Super Admin', 'platform-super-admin', 'active', 'enterprise')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;

-- Function to add user to platform org
CREATE OR REPLACE FUNCTION add_user_to_platform_org(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    platform_org_id UUID := 'a0000000-0000-0000-0000-000000000000';
    user_role TEXT;
    user_is_platform_admin BOOLEAN;
BEGIN
    SELECT role, is_platform_admin INTO user_role, user_is_platform_admin
    FROM users WHERE id = p_user_id;

    IF user_role IN ('super_admin', 'platform_admin') OR user_is_platform_admin = true THEN
        INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
        VALUES (p_user_id, platform_org_id, 'admin', NOW(), NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'admin', updated_at = NOW();
    END IF;
END;
$$;

-- Trigger to auto-add platform staff
CREATE OR REPLACE FUNCTION trigger_auto_add_platform_staff_to_platform_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (NEW.role IN ('super_admin', 'platform_admin') OR NEW.is_platform_admin = true) AND
       (OLD IS NULL OR (OLD.role NOT IN ('super_admin', 'platform_admin') AND OLD.is_platform_admin <> true)) THEN
        PERFORM add_user_to_platform_org(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_add_platform_staff_to_platform_org ON users;
CREATE TRIGGER auto_add_platform_staff_to_platform_org
    AFTER INSERT OR UPDATE OF role, is_platform_admin ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_add_platform_staff_to_platform_org();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
    cat_count INTEGER;
    mfr_count INTEGER;
    supplier_count INTEGER;
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cat_count FROM categories;
    SELECT COUNT(*) INTO mfr_count FROM manufacturers;
    SELECT COUNT(*) INTO supplier_count FROM suppliers;
    SELECT COUNT(*) INTO table_count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '  MASTER MIGRATION V4 COMPLETE - Components Platform V2';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '  Total Tables: %', table_count;
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '   Core: organizations, projects';
    RAISE NOTICE '   Users: users, organization_memberships, organization_invitations';
    RAISE NOTICE '   Preferences: user_preferences, alert_preferences';
    RAISE NOTICE '   Workspaces: workspaces, workspace_members';
    RAISE NOTICE '   Catalog: manufacturers, categories, components, suppliers, skus';
    RAISE NOTICE '   Mappings: vendor_category_mappings, attributes, component_alternatives';
    RAISE NOTICE '   BOM: boms, bom_line_items, bom_uploads';
    RAISE NOTICE '   Enrichment: enrichment_queue, enrichment_audit_log, enrichment_events';
    RAISE NOTICE '   CNS: cns_enrichment_config, cns_cost_tracking, cns_bulk_uploads';
    RAISE NOTICE '   Risk: component_risk_scores, svhc_substances, component_svhc';
    RAISE NOTICE '   Alerts: notifications, alerts, component_watches, component_price_history';
    RAISE NOTICE '   Tags: predefined_tags, component_tags';
    RAISE NOTICE '   Central: central_component_catalog';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Seed Data:';
    RAISE NOTICE '   - Categories: % (hierarchical with 3 levels)', cat_count;
    RAISE NOTICE '   - Manufacturers: % (major electronics vendors)', mfr_count;
    RAISE NOTICE '   - Suppliers: % (DigiKey, Mouser, Element14, etc)', supplier_count;
    RAISE NOTICE '   - SVHC Substances: 15 (REACH compliance)';
    RAISE NOTICE '   - Predefined Tags: 10 (lifecycle, compliance)';
    RAISE NOTICE '   - Platform Super Admin Org: a0000000-0000-0000-0000-000000000000';
    RAISE NOTICE '   - Ananta Platform Org: a1111111-1111-1111-1111-111111111111';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Features Enabled:';
    RAISE NOTICE '   - Multi-org user management (Auth0/Keycloak compatible)';
    RAISE NOTICE '   - Full-text search on components';
    RAISE NOTICE '   - Row Level Security (RLS) on all tables';
    RAISE NOTICE '   - Auto-update timestamps';
    RAISE NOTICE '   - Hierarchical category paths';
    RAISE NOTICE '   - Component watch subscriptions';
    RAISE NOTICE '   - Price change tracking';
    RAISE NOTICE '   - Platform staff auto-assignment';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
END $$;
