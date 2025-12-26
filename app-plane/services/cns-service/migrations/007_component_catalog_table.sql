-- ==========================================
-- CIP Service - Component Catalog Table
-- Migration: 007
-- Created: 2025-01-10
-- Description: Create the component_catalog table used by ComponentCatalogService
--
-- IMPORTANT: This is the canonical table for the central component catalog.
-- The raw SQL in ComponentCatalogService references "component_catalog".
-- A view "catalog_components" is created for ORM compatibility.
-- ==========================================

-- ==========================================
-- Main Component Catalog Table
-- ==========================================
-- This table stores the central component catalog used by CNS enrichment.
-- Components are keyed by (manufacturer_part_number, manufacturer) pairs.

CREATE TABLE IF NOT EXISTS component_catalog (
    -- Primary Key (UUID for distributed systems)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core Component Identification
    manufacturer_part_number VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,

    -- Taxonomy / Category Hierarchy
    category VARCHAR(255),
    subcategory VARCHAR(255),
    category_path TEXT,  -- Full path like "Electronics > Passive > Resistors"
    product_family VARCHAR(255),
    product_series VARCHAR(255),

    -- Basic Information
    description TEXT,
    datasheet_url TEXT,
    image_url TEXT,
    model_3d_url TEXT,  -- 3D model URL if available

    -- Technical Specs
    package VARCHAR(100),

    -- Lifecycle & Risk
    lifecycle_status VARCHAR(50) DEFAULT 'Active',  -- 'Active', 'NRND', 'EOL', 'Obsolete', 'Preview'
    risk_level VARCHAR(50),  -- 'low', 'medium', 'high', 'critical'

    -- Compliance Information
    rohs_compliant BOOLEAN,
    reach_compliant BOOLEAN,
    halogen_free BOOLEAN,
    aec_qualified BOOLEAN,  -- Automotive qualification
    eccn_code VARCHAR(50),  -- Export control classification

    -- Pricing & Availability
    unit_price DECIMAL(12, 4),
    currency VARCHAR(3) DEFAULT 'USD',
    price_breaks JSONB DEFAULT '[]'::jsonb,  -- Array of {quantity, price} objects
    moq INTEGER,  -- Minimum Order Quantity
    lead_time_days INTEGER,
    stock_status VARCHAR(50),  -- 'in_stock', 'low_stock', 'out_of_stock', 'backordered'

    -- Specifications (JSONB for flexibility)
    specifications JSONB DEFAULT '{}'::jsonb,
    -- Example: {"resistance": "10kOhm", "tolerance": "1%", "power_rating": "0.25W"}

    -- Quality & Metadata
    quality_score DECIMAL(5, 2),  -- 0-100 score based on data completeness
    quality_metadata JSONB DEFAULT '{}'::jsonb,  -- Breakdown of quality scoring

    -- Supplier Data (JSONB for multiple suppliers)
    supplier_data JSONB DEFAULT '{}'::jsonb,
    -- Example: {"mouser": {...}, "digikey": {...}}

    -- AI Enrichment Metadata
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    -- Example: {"confidence": 0.95, "model": "gpt-4", "suggestions": [...]}

    -- Enrichment Tracking
    enrichment_source VARCHAR(50),  -- 'mouser', 'digikey', 'element14', 'ai', 'manual', 'fallback'
    last_enriched_at TIMESTAMP WITH TIME ZONE,
    enrichment_count INTEGER DEFAULT 0,

    -- Usage Analytics
    usage_count INTEGER DEFAULT 0,  -- How many times this component was looked up
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint on (MPN, Manufacturer) combination
    -- Using different constraint name to avoid conflict with 'components' table
    CONSTRAINT uq_component_catalog_mpn_mfr UNIQUE (manufacturer_part_number, manufacturer)
);

-- ==========================================
-- Indexes for component_catalog
-- ==========================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_component_catalog_mpn
    ON component_catalog(manufacturer_part_number);

CREATE INDEX IF NOT EXISTS idx_component_catalog_manufacturer
    ON component_catalog(manufacturer);

CREATE INDEX IF NOT EXISTS idx_component_catalog_mpn_mfr
    ON component_catalog(manufacturer_part_number, manufacturer);

-- Category/taxonomy indexes
CREATE INDEX IF NOT EXISTS idx_component_catalog_category
    ON component_catalog(category);

CREATE INDEX IF NOT EXISTS idx_component_catalog_subcategory
    ON component_catalog(subcategory);

-- Quality and lifecycle indexes
CREATE INDEX IF NOT EXISTS idx_component_catalog_quality
    ON component_catalog(quality_score);

CREATE INDEX IF NOT EXISTS idx_component_catalog_lifecycle
    ON component_catalog(lifecycle_status);

-- Usage and analytics indexes
CREATE INDEX IF NOT EXISTS idx_component_catalog_usage
    ON component_catalog(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_component_catalog_last_used
    ON component_catalog(last_used_at DESC);

-- JSONB indexes for specifications lookup
CREATE INDEX IF NOT EXISTS idx_component_catalog_specs
    ON component_catalog USING GIN (specifications);

CREATE INDEX IF NOT EXISTS idx_component_catalog_supplier_data
    ON component_catalog USING GIN (supplier_data);

-- Timestamp indexes
CREATE INDEX IF NOT EXISTS idx_component_catalog_created
    ON component_catalog(created_at);

CREATE INDEX IF NOT EXISTS idx_component_catalog_enriched
    ON component_catalog(last_enriched_at);

-- ==========================================
-- Trigger for auto-updating updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_component_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_component_catalog_updated_at ON component_catalog;
CREATE TRIGGER trg_component_catalog_updated_at
    BEFORE UPDATE ON component_catalog
    FOR EACH ROW
    EXECUTE FUNCTION update_component_catalog_updated_at();

-- ==========================================
-- View: catalog_components (ORM Compatibility)
-- ==========================================
-- SQLAlchemy model CatalogComponent uses __tablename__ = "catalog_components"
-- This view provides compatibility with the ORM while using component_catalog as source

CREATE OR REPLACE VIEW catalog_components AS
SELECT
    id,
    manufacturer_part_number AS mpn,
    manufacturer,
    NULL::VARCHAR(255) AS normalized_mpn,
    NULL::VARCHAR(255) AS normalized_manufacturer,
    category,
    subcategory,
    category_path,
    product_family,
    product_series,
    description,
    datasheet_url,
    image_url,
    lifecycle_status,
    package,
    unit_price,
    currency,
    price_breaks,
    moq,
    lead_time_days,
    stock_status,
    supplier_data,
    specifications,
    NULL::JSONB AS extracted_specs,
    rohs_compliant,
    reach_compliant,
    halogen_free,
    aec_qualified,
    eccn_code,
    quality_score,
    quality_metadata,
    ai_metadata,
    enrichment_source,
    enrichment_source AS api_source,
    created_at,
    updated_at
FROM component_catalog;

-- ==========================================
-- Comments
-- ==========================================

COMMENT ON TABLE component_catalog IS 'Central component catalog - master data for electronic components used by CNS enrichment';
COMMENT ON COLUMN component_catalog.manufacturer_part_number IS 'Manufacturer Part Number (MPN) - primary identifier';
COMMENT ON COLUMN component_catalog.manufacturer IS 'Component manufacturer name';
COMMENT ON COLUMN component_catalog.quality_score IS 'Data completeness score (0-100). Components >= 95 are auto-approved.';
COMMENT ON COLUMN component_catalog.enrichment_source IS 'Source of enrichment data: mouser, digikey, element14, ai, manual, fallback';
COMMENT ON COLUMN component_catalog.usage_count IS 'Number of times this component was looked up (for popularity ranking)';
COMMENT ON COLUMN component_catalog.price_breaks IS 'JSON array of price breaks: [{"quantity": 1, "price": 0.50}, ...]';
COMMENT ON COLUMN component_catalog.supplier_data IS 'JSON object with supplier-specific data keyed by supplier name';

COMMENT ON VIEW catalog_components IS 'ORM compatibility view mapping to component_catalog table. Used by SQLAlchemy CatalogComponent model.';

-- ==========================================
-- Migration Complete
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 007 complete:';
    RAISE NOTICE '  - Created component_catalog table';
    RAISE NOTICE '  - Created indexes for performance';
    RAISE NOTICE '  - Created updated_at trigger';
    RAISE NOTICE '  - Created catalog_components view for ORM compatibility';
END$$;
