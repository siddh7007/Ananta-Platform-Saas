-- Central Catalog Schema for Components Platform V2
-- This creates the core tables for the Central Catalog that will be managed via Directus

-- =============================================================================
-- MANUFACTURERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_manufacturers_name ON catalog_manufacturers(name);

-- =============================================================================
-- SUPPLIERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(512),
    api_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_suppliers_name ON catalog_suppliers(name);

-- =============================================================================
-- CATEGORIES TABLE (Self-referencing hierarchy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1024),
    parent_id INTEGER REFERENCES catalog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_name ON catalog_categories(name);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent ON catalog_categories(parent_id);

-- =============================================================================
-- COMPONENTS TABLE (Core catalog data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_components (
    id SERIAL PRIMARY KEY,
    mpn VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    category VARCHAR(255),
    description TEXT,
    datasheet_url VARCHAR(1024),
    image_url VARCHAR(1024),
    lifecycle_status VARCHAR(50) DEFAULT 'Active' CHECK (lifecycle_status IN ('Active', 'NRND', 'EOL', 'Obsolete')),
    specifications JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_components_mpn ON catalog_components(mpn);
CREATE INDEX IF NOT EXISTS idx_catalog_components_manufacturer ON catalog_components(manufacturer);
CREATE INDEX IF NOT EXISTS idx_catalog_components_category ON catalog_components(category);
CREATE INDEX IF NOT EXISTS idx_catalog_components_lifecycle ON catalog_components(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_catalog_components_specs ON catalog_components USING GIN (specifications);

-- Trigger to update updated_at on catalog_components
CREATE OR REPLACE FUNCTION update_catalog_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_components_updated_at
    BEFORE UPDATE ON catalog_components
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_components_updated_at();

-- =============================================================================
-- COMPONENT PRICING TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_component_pricing (
    id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES catalog_components(id) ON DELETE CASCADE,
    supplier VARCHAR(255) NOT NULL,
    price DECIMAL(10, 4),
    quantity_break INTEGER,
    currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_pricing_component ON catalog_component_pricing(component_id);
CREATE INDEX IF NOT EXISTS idx_catalog_pricing_supplier ON catalog_component_pricing(supplier);

-- Trigger to update updated_at on catalog_component_pricing
CREATE OR REPLACE FUNCTION update_catalog_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_pricing_updated_at
    BEFORE UPDATE ON catalog_component_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_pricing_updated_at();

-- =============================================================================
-- COMPONENT COMPLIANCE TABLE (One-to-one with components)
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_component_compliance (
    id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL UNIQUE REFERENCES catalog_components(id) ON DELETE CASCADE,
    rohs_compliant BOOLEAN,
    reach_compliant BOOLEAN,
    reach_svhc_count INTEGER,
    eccn_code VARCHAR(50),
    hts_code VARCHAR(50),
    country_of_origin VARCHAR(2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_compliance_component ON catalog_component_compliance(component_id);
CREATE INDEX IF NOT EXISTS idx_catalog_compliance_rohs ON catalog_component_compliance(rohs_compliant);
CREATE INDEX IF NOT EXISTS idx_catalog_compliance_reach ON catalog_component_compliance(reach_compliant);

-- Trigger to update updated_at on catalog_component_compliance
CREATE OR REPLACE FUNCTION update_catalog_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_compliance_updated_at
    BEFORE UPDATE ON catalog_component_compliance
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_compliance_updated_at();

-- =============================================================================
-- SEED DATA (Sample manufacturers and suppliers)
-- =============================================================================

-- Insert common manufacturers (if not exists)
INSERT INTO catalog_manufacturers (name, website) VALUES
    ('Texas Instruments', 'https://www.ti.com'),
    ('Analog Devices', 'https://www.analog.com'),
    ('STMicroelectronics', 'https://www.st.com'),
    ('NXP', 'https://www.nxp.com'),
    ('Microchip', 'https://www.microchip.com'),
    ('Infineon', 'https://www.infineon.com'),
    ('ON Semiconductor', 'https://www.onsemi.com'),
    ('Maxim Integrated', 'https://www.maximintegrated.com')
ON CONFLICT (name) DO NOTHING;

-- Insert common suppliers (if not exists)
INSERT INTO catalog_suppliers (name, website, api_enabled) VALUES
    ('DigiKey', 'https://www.digikey.com', TRUE),
    ('Mouser', 'https://www.mouser.com', TRUE),
    ('Arrow', 'https://www.arrow.com', TRUE),
    ('Avnet', 'https://www.avnet.com', TRUE),
    ('Newark', 'https://www.newark.com', TRUE),
    ('Element14', 'https://www.element14.com', TRUE),
    ('RS Components', 'https://www.rs-online.com', FALSE)
ON CONFLICT (name) DO NOTHING;

-- Insert common categories
INSERT INTO catalog_categories (name, path, parent_id) VALUES
    ('Passive Components', 'Electronics > Passive Components', NULL),
    ('Active Components', 'Electronics > Active Components', NULL),
    ('Electromechanical', 'Electronics > Electromechanical', NULL)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions to directus user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'directus') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO directus;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO directus;
    END IF;
END $$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE catalog_manufacturers IS 'Master list of component manufacturers';
COMMENT ON TABLE catalog_suppliers IS 'Master list of component suppliers/distributors';
COMMENT ON TABLE catalog_categories IS 'Hierarchical component taxonomy';
COMMENT ON TABLE catalog_components IS 'Central component catalog - master data for all electronic components';
COMMENT ON TABLE catalog_component_pricing IS 'Component pricing from various suppliers';
COMMENT ON TABLE catalog_component_compliance IS 'Component compliance information (RoHS, REACH, export control)';

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- This migration creates:
-- - 6 tables for Central Catalog management
-- - Proper foreign key relations
-- - Indexes for performance
-- - Update triggers for timestamp tracking
-- - Seed data for common manufacturers and suppliers
-- - Ready for Directus administration
