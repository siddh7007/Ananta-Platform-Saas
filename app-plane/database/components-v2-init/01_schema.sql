-- =============================================================================
-- Components V2 Database - Central Component Catalog (SSOT)
-- =============================================================================
-- Single Source of Truth for all component data
-- Used by: CNS Service, Middleware API, Directus Admin
-- =============================================================================

-- =============================================================================
-- CATEGORIES TABLE (Hierarchical DigiKey taxonomy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    digikey_id INTEGER,
    level INTEGER DEFAULT 1,
    path VARCHAR(1024),
    product_count INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_digikey_id ON categories(digikey_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- =============================================================================
-- MANUFACTURERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(512),
    aliases JSONB DEFAULT '[]',
    logo_url VARCHAR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(name);

-- =============================================================================
-- SUPPLIERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(512),
    api_enabled BOOLEAN DEFAULT FALSE,
    api_key_env_var VARCHAR(100),
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- =============================================================================
-- COMPONENTS TABLE (Central Catalog - SSOT)
-- =============================================================================
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mpn VARCHAR(255) NOT NULL,
    manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,

    -- Datasheet & Media
    datasheet_url VARCHAR(1024),
    image_url VARCHAR(1024),

    -- Lifecycle
    lifecycle_status VARCHAR(50) DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'nrnd', 'eol', 'obsolete', 'preview', 'discontinued')),

    -- Technical Specifications (flexible JSONB)
    specifications JSONB DEFAULT '{}',

    -- Vendor Categories (raw from each vendor)
    category_mouser VARCHAR(512),
    category_digikey VARCHAR(512),
    category_element14 VARCHAR(512),

    -- Compliance
    rohs_status VARCHAR(50) DEFAULT 'unknown'
        CHECK (rohs_status IN ('compliant', 'non_compliant', 'exempt', 'unknown')),
    rohs_version VARCHAR(20),
    reach_status VARCHAR(50) DEFAULT 'unknown'
        CHECK (reach_status IN ('compliant', 'contains_svhc', 'non_compliant', 'unknown')),
    reach_svhc_count INTEGER DEFAULT 0,
    conflict_mineral_status VARCHAR(50) DEFAULT 'unknown',
    china_rohs_compliant BOOLEAN,
    halogen_free BOOLEAN,
    eccn_code VARCHAR(50),
    hts_code VARCHAR(50),
    country_of_origin VARCHAR(2),

    -- Package Info
    package_type VARCHAR(100),
    package_variant VARCHAR(100),
    mounting_type VARCHAR(50) CHECK (mounting_type IN ('smd', 'through_hole', 'chassis', 'panel', 'wire_lead')),
    pin_count INTEGER,
    length_mm DECIMAL(10, 4),
    width_mm DECIMAL(10, 4),
    height_mm DECIMAL(10, 4),
    pitch_mm DECIMAL(10, 4),
    jedec_designation VARCHAR(50),

    -- Manufacturing
    msl_level VARCHAR(10),
    msl_peak_temp_c INTEGER,
    lead_free BOOLEAN,
    termination_finish VARCHAR(50),
    max_reflow_temp_c INTEGER,
    storage_temp_max_c INTEGER,

    -- Quality & Metadata
    confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    quality_score INTEGER DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    data_sources JSONB DEFAULT '[]',
    last_enriched_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint on MPN + Manufacturer
    CONSTRAINT unique_mpn_manufacturer UNIQUE (mpn, manufacturer_id)
);

CREATE INDEX IF NOT EXISTS idx_components_mpn ON components(mpn);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_lifecycle ON components(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_components_specs ON components USING GIN (specifications);
CREATE INDEX IF NOT EXISTS idx_components_quality ON components(quality_score);
CREATE INDEX IF NOT EXISTS idx_components_confidence ON components(confidence_score);

-- =============================================================================
-- COMPONENT PRICING TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS component_pricing (
    id SERIAL PRIMARY KEY,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_part_number VARCHAR(255),
    price DECIMAL(12, 4),
    quantity_break INTEGER DEFAULT 1,
    currency VARCHAR(3) DEFAULT 'USD',
    stock_quantity INTEGER DEFAULT 0,
    lead_time_days INTEGER,
    minimum_order_qty INTEGER DEFAULT 1,
    price_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_component ON component_pricing(component_id);
CREATE INDEX IF NOT EXISTS idx_pricing_supplier ON component_pricing(supplier_id);

-- =============================================================================
-- VENDOR CATEGORY MAPPINGS (For normalization)
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_category_mappings (
    id SERIAL PRIMARY KEY,
    vendor VARCHAR(50) NOT NULL,
    vendor_category_path VARCHAR(1024) NOT NULL,
    canonical_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    confidence_score DECIMAL(5, 4) DEFAULT 0.0,
    is_verified BOOLEAN DEFAULT FALSE,
    match_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_vendor_category UNIQUE (vendor, vendor_category_path)
);

CREATE INDEX IF NOT EXISTS idx_vcm_vendor ON vendor_category_mappings(vendor);
CREATE INDEX IF NOT EXISTS idx_vcm_canonical ON vendor_category_mappings(canonical_category_id);

-- =============================================================================
-- CNS ENRICHMENT CONFIG (Runtime configuration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cns_enrichment_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'integer', 'float', 'boolean', 'json')),
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    default_value TEXT,
    min_value DECIMAL(20, 4),
    max_value DECIMAL(20, 4),
    requires_restart BOOLEAN DEFAULT FALSE,
    deprecated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_cns_config_key ON cns_enrichment_config(config_key);
CREATE INDEX IF NOT EXISTS idx_cns_config_category ON cns_enrichment_config(category);

-- =============================================================================
-- UPDATE TIMESTAMP TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manufacturers_updated_at
    BEFORE UPDATE ON manufacturers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_component_pricing_updated_at
    BEFORE UPDATE ON component_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE categories IS 'Hierarchical component taxonomy (DigiKey structure)';
COMMENT ON TABLE manufacturers IS 'Component manufacturers master list';
COMMENT ON TABLE suppliers IS 'Component suppliers/distributors';
COMMENT ON TABLE components IS 'Central component catalog - Single Source of Truth (SSOT)';
COMMENT ON TABLE component_pricing IS 'Component pricing from various suppliers';
COMMENT ON TABLE vendor_category_mappings IS 'Maps vendor categories to canonical taxonomy';
COMMENT ON TABLE cns_enrichment_config IS 'Runtime configuration for CNS enrichment service';
