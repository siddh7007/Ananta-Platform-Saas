-- ====================================================================
-- CNS Enrichment Configuration (Migration 010)
-- Stores UI-configurable settings for AI and web scraping
-- ====================================================================

-- ====================================================================
-- 1. CNS Enrichment Configuration Table
-- ====================================================================

CREATE TABLE IF NOT EXISTS cns_enrichment_config (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id) ON DELETE CASCADE,

    -- General settings
    config_name VARCHAR(255) NOT NULL DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_global BOOLEAN NOT NULL DEFAULT false,  -- Global config vs tenant-specific

    -- Tier 2: Supplier APIs
    enable_suppliers BOOLEAN NOT NULL DEFAULT true,
    preferred_suppliers TEXT[],  -- Array of supplier names: ["mouser", "digikey"]
    supplier_min_confidence NUMERIC(5,2) DEFAULT 90.0,

    -- Tier 3: AI Enhancement (OPTIONAL - UI toggle)
    enable_ai BOOLEAN NOT NULL DEFAULT false,  -- OFF by default
    ai_provider VARCHAR(50),  -- "ollama", "openai", "claude", "langflow"
    ai_operations TEXT[] DEFAULT ARRAY['category', 'specs'],  -- What to use AI for
    ai_min_confidence NUMERIC(5,2) DEFAULT 70.0,
    ai_cost_limit_monthly NUMERIC(10,2),  -- Monthly budget limit for paid AI

    -- Tier 4: Web Scraping (OPTIONAL - UI toggle)
    enable_web_scraping BOOLEAN NOT NULL DEFAULT false,  -- OFF by default
    scraping_sources TEXT[] DEFAULT ARRAY['manufacturer', 'datasheet'],
    scraping_timeout_seconds INTEGER DEFAULT 10,
    scraping_rate_limit INTEGER DEFAULT 10,  -- Max requests per minute

    -- Quality routing thresholds
    quality_reject_threshold INTEGER DEFAULT 70,
    quality_staging_threshold INTEGER DEFAULT 94,
    quality_auto_approve_threshold INTEGER DEFAULT 95,

    -- Processing options
    batch_size INTEGER DEFAULT 100,
    max_retries INTEGER DEFAULT 2,
    enable_parallel_processing BOOLEAN DEFAULT true,

    -- Cost tracking (for paid services)
    ai_cost_current_month NUMERIC(10,2) DEFAULT 0.0,
    ai_requests_current_month INTEGER DEFAULT 0,
    web_scraping_requests_current_month INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    UNIQUE(tenant_id, config_name)
);

-- Indexes
CREATE INDEX idx_cns_config_tenant ON cns_enrichment_config(tenant_id);
CREATE INDEX idx_cns_config_active ON cns_enrichment_config(is_active);
CREATE INDEX idx_cns_config_global ON cns_enrichment_config(is_global);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_cns_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cns_config_updated_at
    BEFORE UPDATE ON cns_enrichment_config
    FOR EACH ROW
    EXECUTE FUNCTION update_cns_config_timestamp();

-- ====================================================================
-- 2. CNS Enrichment Audit Log
-- ====================================================================

CREATE TABLE IF NOT EXISTS cns_enrichment_audit (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id) ON DELETE CASCADE,
    config_id INTEGER REFERENCES cns_enrichment_config(id) ON DELETE SET NULL,

    -- Component info
    mpn VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),

    -- Enrichment results
    success BOOLEAN NOT NULL,
    quality_score NUMERIC(5,2),
    routing_destination VARCHAR(50),  -- "production", "staging", "rejected"

    -- Tiers used
    tier_catalog_used BOOLEAN DEFAULT false,
    tier_suppliers_used BOOLEAN DEFAULT false,
    tier_ai_used BOOLEAN DEFAULT false,
    tier_web_scraping_used BOOLEAN DEFAULT false,

    -- AI details (if used)
    ai_provider VARCHAR(50),
    ai_cost_usd NUMERIC(10,6),
    ai_tokens_used INTEGER,

    -- Web scraping details (if used)
    web_scraping_source VARCHAR(255),
    web_scraping_duration_ms INTEGER,

    -- Performance
    processing_time_ms NUMERIC(10,2),
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cns_audit_tenant ON cns_enrichment_audit(tenant_id);
CREATE INDEX idx_cns_audit_mpn ON cns_enrichment_audit(mpn);
CREATE INDEX idx_cns_audit_created ON cns_enrichment_audit(created_at DESC);
CREATE INDEX idx_cns_audit_ai_used ON cns_enrichment_audit(tier_ai_used) WHERE tier_ai_used = true;
CREATE INDEX idx_cns_audit_web_used ON cns_enrichment_audit(tier_web_scraping_used) WHERE tier_web_scraping_used = true;

-- ====================================================================
-- 3. Insert Default Global Configuration
-- ====================================================================

INSERT INTO cns_enrichment_config (
    tenant_id,
    config_name,
    is_active,
    is_global,
    enable_suppliers,
    preferred_suppliers,
    enable_ai,
    enable_web_scraping,
    quality_reject_threshold,
    quality_staging_threshold,
    quality_auto_approve_threshold
) VALUES (
    NULL,  -- Global config (no tenant)
    'global_default',
    true,
    true,
    true,  -- Suppliers enabled by default
    ARRAY['mouser', 'digikey', 'element14'],
    false,  -- AI disabled by default (user must enable in UI)
    false,  -- Web scraping disabled by default
    70,
    94,
    95
) ON CONFLICT (tenant_id, config_name) DO NOTHING;

-- ====================================================================
-- 4. CNS Cost Tracking View
-- ====================================================================

CREATE OR REPLACE VIEW cns_cost_tracking AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    tenant_id,
    COUNT(*) AS total_enrichments,
    COUNT(*) FILTER (WHERE tier_ai_used) AS ai_enrichments,
    COUNT(*) FILTER (WHERE tier_web_scraping_used) AS web_scraping_enrichments,
    SUM(ai_cost_usd) AS total_ai_cost,
    AVG(processing_time_ms) AS avg_processing_time_ms,
    AVG(quality_score) AS avg_quality_score,
    COUNT(*) FILTER (WHERE routing_destination = 'production') AS routed_production,
    COUNT(*) FILTER (WHERE routing_destination = 'staging') AS routed_staging,
    COUNT(*) FILTER (WHERE routing_destination = 'rejected') AS routed_rejected
FROM cns_enrichment_audit
GROUP BY DATE_TRUNC('month', created_at), tenant_id;

-- ====================================================================
-- 5. Function: Get Active Config for Tenant
-- ====================================================================

CREATE OR REPLACE FUNCTION get_active_cns_config(p_tenant_id UUID)
RETURNS TABLE (
    id INTEGER,
    config_name VARCHAR(255),
    enable_suppliers BOOLEAN,
    enable_ai BOOLEAN,
    enable_web_scraping BOOLEAN,
    ai_provider VARCHAR(50),
    ai_cost_limit_monthly NUMERIC(10,2),
    ai_cost_current_month NUMERIC(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.config_name,
        c.enable_suppliers,
        c.enable_ai,
        c.enable_web_scraping,
        c.ai_provider,
        c.ai_cost_limit_monthly,
        c.ai_cost_current_month
    FROM cns_enrichment_config c
    WHERE (c.tenant_id = p_tenant_id OR (c.tenant_id IS NULL AND c.is_global = true))
      AND c.is_active = true
    ORDER BY c.tenant_id NULLS LAST  -- Tenant-specific config takes precedence over global
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 6. Grant Permissions
-- ====================================================================

-- Grant to ananta_app role (Control Plane application user)
-- Note: service_role/authenticated are Supabase-specific, not available here
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ananta_app') THEN
        GRANT SELECT, INSERT, UPDATE ON cns_enrichment_config TO ananta_app;
        GRANT SELECT, INSERT ON cns_enrichment_audit TO ananta_app;
        GRANT SELECT ON cns_cost_tracking TO ananta_app;
        GRANT USAGE ON SEQUENCE cns_enrichment_config_id_seq TO ananta_app;
        GRANT USAGE ON SEQUENCE cns_enrichment_audit_id_seq TO ananta_app;
    END IF;
END $$;

COMMENT ON TABLE cns_enrichment_config IS 'UI-configurable settings for CNS enrichment tiers (AI, web scraping)';
COMMENT ON TABLE cns_enrichment_audit IS 'Audit log of all enrichment operations with tier usage and costs';
COMMENT ON VIEW cns_cost_tracking IS 'Monthly cost tracking for AI and web scraping enrichment';
