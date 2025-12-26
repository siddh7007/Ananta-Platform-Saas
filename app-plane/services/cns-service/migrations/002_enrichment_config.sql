-- ==========================================
-- CNS Service - Enrichment Configuration
-- Migration: 002
-- Created: 2025-11-03
-- Description: Create enrichment configuration tables and functions
-- ==========================================

-- ==========================================
-- Enrichment Configuration Table
-- ==========================================
-- Stores enrichment settings per tenant (multi-tenant support)

CREATE TABLE IF NOT EXISTS cns_enrichment_config (
    id SERIAL PRIMARY KEY,

    -- Multi-tenancy
    tenant_id VARCHAR(100),  -- NULL for global config
    config_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT FALSE,

    -- Tier 2: Supplier APIs
    enable_suppliers BOOLEAN DEFAULT TRUE,
    preferred_suppliers TEXT[] DEFAULT ARRAY['mouser', 'digikey', 'element14'],
    supplier_min_confidence DECIMAL(5,2) DEFAULT 90.0 CHECK (supplier_min_confidence >= 0 AND supplier_min_confidence <= 100),

    -- Tier 3: AI Enhancement (OPTIONAL)
    enable_ai BOOLEAN DEFAULT FALSE,
    ai_provider VARCHAR(50),  -- 'ollama', 'openai', 'claude', 'langflow'
    ai_operations TEXT[] DEFAULT ARRAY['category', 'specs'],
    ai_min_confidence DECIMAL(5,2) DEFAULT 70.0 CHECK (ai_min_confidence >= 0 AND ai_min_confidence <= 100),
    ai_cost_limit_monthly DECIMAL(10,2),

    -- Tier 4: Web Scraping (OPTIONAL)
    enable_web_scraping BOOLEAN DEFAULT FALSE,
    scraping_sources TEXT[] DEFAULT ARRAY['manufacturer', 'datasheet'],
    scraping_timeout_seconds INTEGER DEFAULT 10 CHECK (scraping_timeout_seconds >= 1 AND scraping_timeout_seconds <= 60),

    -- Quality thresholds
    quality_reject_threshold INTEGER DEFAULT 70 CHECK (quality_reject_threshold >= 0 AND quality_reject_threshold <= 100),
    quality_staging_threshold INTEGER DEFAULT 94 CHECK (quality_staging_threshold >= 0 AND quality_staging_threshold <= 100),
    quality_auto_approve_threshold INTEGER DEFAULT 95 CHECK (quality_auto_approve_threshold >= 0 AND quality_auto_approve_threshold <= 100),

    -- Processing
    batch_size INTEGER DEFAULT 100 CHECK (batch_size >= 1 AND batch_size <= 1000),
    max_retries INTEGER DEFAULT 2 CHECK (max_retries >= 0 AND max_retries <= 10),

    -- Cost tracking (current month)
    ai_cost_current_month DECIMAL(10,2) DEFAULT 0.0,
    ai_requests_current_month INTEGER DEFAULT 0,
    web_scraping_requests_current_month INTEGER DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint: one active config per tenant
    CONSTRAINT unique_active_tenant_config UNIQUE (tenant_id, is_active)
        DEFERRABLE INITIALLY DEFERRED
);

-- Indexes
CREATE INDEX idx_cns_enrichment_config_tenant ON cns_enrichment_config(tenant_id);
CREATE INDEX idx_cns_enrichment_config_active ON cns_enrichment_config(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_cns_enrichment_config_global ON cns_enrichment_config(is_global) WHERE is_global = TRUE;

-- Comments
COMMENT ON TABLE cns_enrichment_config IS 'Enrichment configuration settings per tenant (multi-tenant support)';
COMMENT ON COLUMN cns_enrichment_config.tenant_id IS 'Tenant identifier (NULL for global/default config)';
COMMENT ON COLUMN cns_enrichment_config.enable_ai IS 'Enable AI enhancement (OFF by default to control costs)';
COMMENT ON COLUMN cns_enrichment_config.enable_web_scraping IS 'Enable web scraping fallback (OFF by default)';

-- ==========================================
-- Cost Tracking Table (Historical)
-- ==========================================
-- Stores monthly cost tracking data

CREATE TABLE IF NOT EXISTS cns_cost_tracking (
    id SERIAL PRIMARY KEY,
    month VARCHAR(7) NOT NULL,  -- 'YYYY-MM' format
    tenant_id VARCHAR(100),

    -- Enrichment counts
    total_enrichments INTEGER DEFAULT 0,
    ai_enrichments INTEGER DEFAULT 0,
    web_scraping_enrichments INTEGER DEFAULT 0,

    -- Costs
    total_ai_cost DECIMAL(10,2) DEFAULT 0.0,

    -- Performance
    avg_processing_time_ms INTEGER,
    avg_quality_score DECIMAL(5,2),

    -- Routing stats
    routed_production INTEGER DEFAULT 0,  -- Quality >= 95%
    routed_staging INTEGER DEFAULT 0,     -- Quality 70-94%
    routed_rejected INTEGER DEFAULT 0,    -- Quality < 70%

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique per month per tenant
    CONSTRAINT unique_month_tenant UNIQUE (month, tenant_id)
);

-- Indexes
CREATE INDEX idx_cns_cost_tracking_month ON cns_cost_tracking(month DESC);
CREATE INDEX idx_cns_cost_tracking_tenant ON cns_cost_tracking(tenant_id);

COMMENT ON TABLE cns_cost_tracking IS 'Monthly cost tracking for AI and web scraping enrichments';

-- ==========================================
-- Functions
-- ==========================================

-- Function: Get active config for a tenant (with fallback to global)
CREATE OR REPLACE FUNCTION get_active_cns_config(p_tenant_id VARCHAR(100))
RETURNS TABLE (
    id INTEGER,
    tenant_id VARCHAR(100),
    config_name VARCHAR(100),
    is_active BOOLEAN,
    is_global BOOLEAN,
    enable_suppliers BOOLEAN,
    preferred_suppliers TEXT[],
    supplier_min_confidence DECIMAL(5,2),
    enable_ai BOOLEAN,
    ai_provider VARCHAR(50),
    ai_operations TEXT[],
    ai_min_confidence DECIMAL(5,2),
    ai_cost_limit_monthly DECIMAL(10,2),
    enable_web_scraping BOOLEAN,
    scraping_sources TEXT[],
    scraping_timeout_seconds INTEGER,
    quality_reject_threshold INTEGER,
    quality_staging_threshold INTEGER,
    quality_auto_approve_threshold INTEGER,
    batch_size INTEGER,
    max_retries INTEGER,
    ai_cost_current_month DECIMAL(10,2),
    ai_requests_current_month INTEGER,
    web_scraping_requests_current_month INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    -- Try tenant-specific config first
    IF p_tenant_id IS NOT NULL THEN
        RETURN QUERY
        SELECT c.* FROM cns_enrichment_config c
        WHERE c.tenant_id = p_tenant_id AND c.is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Fallback to global config
    RETURN QUERY
    SELECT c.* FROM cns_enrichment_config c
    WHERE c.is_global = TRUE AND c.is_active = TRUE
    ORDER BY c.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_cns_config IS 'Get active enrichment config for tenant (with fallback to global)';

-- ==========================================
-- Triggers
-- ==========================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_cns_enrichment_config_updated_at
    BEFORE UPDATE ON cns_enrichment_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cns_cost_tracking_updated_at
    BEFORE UPDATE ON cns_cost_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Initial Data
-- ==========================================

-- Insert global default configuration
INSERT INTO cns_enrichment_config (
    tenant_id,
    config_name,
    is_active,
    is_global,
    enable_suppliers,
    preferred_suppliers,
    supplier_min_confidence,
    enable_ai,
    ai_provider,
    ai_operations,
    ai_min_confidence,
    ai_cost_limit_monthly,
    enable_web_scraping,
    scraping_sources,
    scraping_timeout_seconds,
    quality_reject_threshold,
    quality_staging_threshold,
    quality_auto_approve_threshold,
    batch_size,
    max_retries
) VALUES (
    NULL,
    'global_default',
    TRUE,
    TRUE,
    TRUE,
    ARRAY['mouser', 'digikey', 'element14'],
    90.0,
    FALSE,  -- AI disabled by default
    'ollama',
    ARRAY['category', 'specs'],
    70.0,
    NULL,   -- No cost limit
    FALSE,  -- Web scraping disabled by default
    ARRAY['manufacturer', 'datasheet'],
    10,
    70,
    94,
    95,
    100,
    2
) ON CONFLICT DO NOTHING;

-- ==========================================
-- Migration Complete
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 002 complete:';
    RAISE NOTICE '   - Created cns_enrichment_config table';
    RAISE NOTICE '   - Created cns_cost_tracking table';
    RAISE NOTICE '   - Created get_active_cns_config() function';
    RAISE NOTICE '   - Created triggers for auto-update';
    RAISE NOTICE '   - Inserted global default configuration';
END$$;
