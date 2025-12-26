-- Migration 007: Extended Catalog Schema
-- Add remaining V1 tables needed for full platform functionality
-- This completes Phase 2 of the V2 migration

-- ========================================
-- 1. MANUFACTURERS
-- ========================================

CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    website TEXT,
    description TEXT,
    logo_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manufacturers_slug ON manufacturers(slug);

-- ========================================
-- 2. CATEGORIES (Hierarchical)
-- ========================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0,
    path TEXT, -- Materialized path for fast queries (e.g., "Passive Components/Capacitors/Ceramic")
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories(path);

-- ========================================
-- 3. SUPPLIERS
-- ========================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    api_key_required BOOLEAN DEFAULT false,
    api_endpoint TEXT,
    website TEXT,
    priority INTEGER DEFAULT 50, -- Higher = preferred vendor
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_priority ON suppliers(priority);

-- ========================================
-- 4. SKUs (Vendor-specific component listings)
-- ========================================

CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_part_number TEXT NOT NULL,
    unit_price DECIMAL(10, 4),
    currency TEXT DEFAULT 'USD',
    stock_quantity INTEGER,
    moq INTEGER, -- Minimum Order Quantity
    lead_time_days INTEGER,
    packaging TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, supplier_part_number)
);

CREATE INDEX idx_skus_component ON skus(component_id);
CREATE INDEX idx_skus_supplier ON skus(supplier_id);
CREATE INDEX idx_skus_org ON skus(organization_id);

-- ========================================
-- 5. ATTRIBUTES (Component Specifications)
-- ========================================

CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    unit TEXT,
    source TEXT, -- 'digikey', 'mouser', 'manual', etc.
    confidence DECIMAL(5, 2), -- 0-100
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attributes_component ON attributes(component_id);
CREATE INDEX idx_attributes_name ON attributes(name);

-- ========================================
-- 6. MEDIA (Images, Datasheets, 3D Models)
-- ========================================

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    media_type TEXT CHECK (media_type IN ('IMAGE', 'DATASHEET', '3D_MODEL', 'VIDEO', 'DOCUMENT')) NOT NULL,
    url TEXT NOT NULL,
    filename TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    thumbnail_url TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_component ON media(component_id);
CREATE INDEX idx_media_type ON media(media_type);

-- ========================================
-- 7. COMPONENT TAGS
-- ========================================

CREATE TABLE IF NOT EXISTS predefined_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT, -- Hex color for UI
    icon TEXT, -- Icon identifier
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS component_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES predefined_tags(id) ON DELETE CASCADE,
    custom_tag TEXT, -- For user-defined tags
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_tag_source CHECK (
        (tag_id IS NOT NULL AND custom_tag IS NULL) OR
        (tag_id IS NULL AND custom_tag IS NOT NULL)
    )
);

CREATE INDEX idx_component_tags_component ON component_tags(component_id);
CREATE INDEX idx_component_tags_tag ON component_tags(tag_id);

-- ========================================
-- 8. PRODUCT CHANGE NOTIFICATIONS (PCN)
-- ========================================

CREATE TABLE IF NOT EXISTS product_change_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    pcn_number TEXT,
    change_type TEXT CHECK (change_type IN ('DESIGN', 'PROCESS', 'MATERIAL', 'LOCATION', 'DISCONTINUATION', 'OTHER')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    effective_date DATE,
    notification_date DATE,
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
    source_url TEXT,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES user_profiles(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pcn_component ON product_change_notifications(component_id);
CREATE INDEX idx_pcn_org ON product_change_notifications(organization_id);
CREATE INDEX idx_pcn_effective_date ON product_change_notifications(effective_date);

-- ========================================
-- 9. COMPONENT ALTERNATIVES
-- ========================================

CREATE TABLE IF NOT EXISTS component_alternatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    alternative_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    match_score DECIMAL(5, 2), -- 0-100 similarity score
    match_type TEXT CHECK (match_type IN ('FORM_FIT_FUNCTION', 'FUNCTIONAL', 'PARTIAL', 'CROSS_REFERENCE')) DEFAULT 'FUNCTIONAL',
    recommendation_reason TEXT,
    verified_by UUID REFERENCES user_profiles(id),
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_component_id, alternative_component_id)
);

CREATE INDEX idx_alternatives_source ON component_alternatives(source_component_id);
CREATE INDEX idx_alternatives_target ON component_alternatives(alternative_component_id);
CREATE INDEX idx_alternatives_score ON component_alternatives(match_score);

-- ========================================
-- 10. LIFECYCLE EVENTS
-- ========================================

CREATE TABLE IF NOT EXISTS lifecycle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    event_date DATE DEFAULT CURRENT_DATE,
    source TEXT, -- 'digikey', 'mouser', 'manual', etc.
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_events_component ON lifecycle_events(component_id);
CREATE INDEX idx_lifecycle_events_date ON lifecycle_events(event_date);

-- ========================================
-- 11. SVHC SUBSTANCES (REACH Compliance)
-- ========================================

CREATE TABLE IF NOT EXISTS svhc_substances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cas_number TEXT UNIQUE NOT NULL,
    ec_number TEXT,
    substance_name TEXT NOT NULL,
    reason_for_inclusion TEXT,
    listed_date DATE,
    sunset_date DATE,
    concentration_limit DECIMAL(5, 2), -- Percentage
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_svhc_cas ON svhc_substances(cas_number);
CREATE INDEX idx_svhc_listed_date ON svhc_substances(listed_date);

-- ========================================
-- 12. COMPONENT SVHC (Component-to-SVHC mapping)
-- ========================================

CREATE TABLE IF NOT EXISTS component_svhc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    svhc_id UUID NOT NULL REFERENCES svhc_substances(id) ON DELETE CASCADE,
    concentration DECIMAL(5, 2), -- Actual concentration percentage
    declaration_date DATE,
    source TEXT, -- Where this info came from
    is_above_threshold BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(component_id, svhc_id)
);

CREATE INDEX idx_component_svhc_component ON component_svhc(component_id);
CREATE INDEX idx_component_svhc_substance ON component_svhc(svhc_id);

-- ========================================
-- 13. RISK SCORES
-- ========================================

CREATE TABLE IF NOT EXISTS component_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX idx_risk_scores_component ON component_risk_scores(component_id);
CREATE INDEX idx_risk_scores_level ON component_risk_scores(risk_level);
CREATE INDEX idx_risk_scores_overall ON component_risk_scores(overall_score);

-- ========================================
-- 14. RISK SCORE HISTORY
-- ========================================

CREATE TABLE IF NOT EXISTS risk_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    change_reason TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_history_component ON risk_score_history(component_id);
CREATE INDEX idx_risk_history_date ON risk_score_history(recorded_at);

-- ========================================
-- 15. VENDOR CATEGORY MAPPINGS
-- ========================================

CREATE TABLE IF NOT EXISTS vendor_category_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    vendor_category TEXT NOT NULL, -- Original vendor category name
    normalized_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    confidence DECIMAL(5, 2), -- 0-100 mapping confidence
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, vendor_category)
);

CREATE INDEX idx_vendor_mappings_supplier ON vendor_category_mappings(supplier_id);
CREATE INDEX idx_vendor_mappings_category ON vendor_category_mappings(normalized_category_id);

-- ========================================
-- 16. BULK IMPORT JOBS
-- ========================================

CREATE TABLE IF NOT EXISTS bulk_import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    job_name TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_jobs_org ON bulk_import_jobs(organization_id);
CREATE INDEX idx_bulk_jobs_project ON bulk_import_jobs(project_id);
CREATE INDEX idx_bulk_jobs_status ON bulk_import_jobs(status);

-- ========================================
-- 17. BULK IMPORT ITEMS
-- ========================================

CREATE TABLE IF NOT EXISTS bulk_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES bulk_import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    mpn_raw TEXT,
    manufacturer_raw TEXT,
    status TEXT CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED')) DEFAULT 'PENDING',
    matched_component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_items_job ON bulk_import_items(job_id);
CREATE INDEX idx_bulk_items_status ON bulk_import_items(status);

-- ========================================
-- 18. ADD MISSING COLUMNS TO COMPONENTS
-- ========================================

-- Add manufacturer_id foreign key
ALTER TABLE components
ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL;

-- Add category_id foreign key
ALTER TABLE components
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add package information
ALTER TABLE components
ADD COLUMN IF NOT EXISTS package_type TEXT,
ADD COLUMN IF NOT EXISTS mounting_style TEXT CHECK (mounting_style IN ('SMD', 'THT', 'HYBRID'));

-- Add datasheet URL
ALTER TABLE components
ADD COLUMN IF NOT EXISTS datasheet_url TEXT;

-- Add min/max operating temps
ALTER TABLE components
ADD COLUMN IF NOT EXISTS temp_min_c INTEGER,
ADD COLUMN IF NOT EXISTS temp_max_c INTEGER;

-- Add power rating
ALTER TABLE components
ADD COLUMN IF NOT EXISTS power_rating_w DECIMAL(10, 4);

CREATE INDEX idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX idx_components_category ON components(category_id);

-- ========================================
-- 19. RLS POLICIES FOR NEW TABLES
-- ========================================

-- Manufacturers (public read, admin write)
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view manufacturers" ON manufacturers FOR SELECT USING (true);

-- Categories (public read, admin write)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);

-- Suppliers (public read, admin write)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view suppliers" ON suppliers FOR SELECT USING (true);

-- SKUs (organization-scoped)
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view SKUs in their organization"
    ON skus FOR SELECT
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can manage SKUs in their organization"
    ON skus FOR ALL
    USING (organization_id = public.current_user_organization_id());

-- Attributes (linked to components)
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view attributes of accessible components"
    ON attributes FOR SELECT
    USING (
        component_id IN (
            SELECT id FROM components
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- Media (linked to components)
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view media of accessible components"
    ON media FOR SELECT
    USING (
        component_id IN (
            SELECT id FROM components
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- Predefined Tags (public read)
ALTER TABLE predefined_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view predefined tags" ON predefined_tags FOR SELECT USING (true);

-- Component Tags (linked to components)
ALTER TABLE component_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tags of accessible components"
    ON component_tags FOR SELECT
    USING (
        component_id IN (
            SELECT id FROM components
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- PCNs (organization-scoped)
ALTER TABLE product_change_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view PCNs in their organization"
    ON product_change_notifications FOR SELECT
    USING (organization_id = public.current_user_organization_id());

-- Alternatives (organization-scoped)
ALTER TABLE component_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view alternatives in their organization"
    ON component_alternatives FOR SELECT
    USING (organization_id = public.current_user_organization_id());

-- Lifecycle Events (organization-scoped)
ALTER TABLE lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view lifecycle events in their organization"
    ON lifecycle_events FOR SELECT
    USING (organization_id = public.current_user_organization_id());

-- SVHC Substances (public read)
ALTER TABLE svhc_substances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view SVHC substances" ON svhc_substances FOR SELECT USING (true);

-- Component SVHC (linked to components)
ALTER TABLE component_svhc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view SVHC of accessible components"
    ON component_svhc FOR SELECT
    USING (
        component_id IN (
            SELECT id FROM components
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- Risk Scores (organization-scoped)
ALTER TABLE component_risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view risk scores in their organization"
    ON component_risk_scores FOR SELECT
    USING (organization_id = public.current_user_organization_id());

-- Risk Score History (linked to components)
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view risk history of accessible components"
    ON risk_score_history FOR SELECT
    USING (
        component_id IN (
            SELECT id FROM components
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- Vendor Mappings (public read)
ALTER TABLE vendor_category_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view vendor mappings" ON vendor_category_mappings FOR SELECT USING (true);

-- Bulk Import Jobs (organization-scoped)
ALTER TABLE bulk_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view import jobs in their organization"
    ON bulk_import_jobs FOR SELECT
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can create import jobs in their organization"
    ON bulk_import_jobs FOR INSERT
    WITH CHECK (organization_id = public.current_user_organization_id());

-- Bulk Import Items (linked to jobs)
ALTER TABLE bulk_import_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view import items of accessible jobs"
    ON bulk_import_items FOR SELECT
    USING (
        job_id IN (
            SELECT id FROM bulk_import_jobs
            WHERE organization_id = public.current_user_organization_id()
        )
    );

-- ========================================
-- 20. SEED COMMON SUPPLIERS
-- ========================================

INSERT INTO suppliers (name, slug, api_key_required, website, priority, is_active)
VALUES
    ('DigiKey', 'digikey', true, 'https://www.digikey.com', 100, true),
    ('Mouser Electronics', 'mouser', true, 'https://www.mouser.com', 90, true),
    ('Element14', 'element14', true, 'https://www.element14.com', 80, true),
    ('SiliconExpert', 'siliconexpert', true, 'https://www.siliconexpert.com', 70, true),
    ('Arrow Electronics', 'arrow', false, 'https://www.arrow.com', 60, true),
    ('Avnet', 'avnet', false, 'https://www.avnet.com', 50, true)
ON CONFLICT (slug) DO NOTHING;

-- ========================================
-- 21. SEED COMMON PREDEFINED TAGS
-- ========================================

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

-- ========================================
-- 22. SEED ROOT CATEGORIES
-- ========================================

INSERT INTO categories (name, slug, level, path, description)
VALUES
    ('Passive Components', 'passive-components', 0, 'Passive Components', 'Resistors, Capacitors, Inductors'),
    ('Active Components', 'active-components', 0, 'Active Components', 'ICs, Transistors, Diodes'),
    ('Electromechanical', 'electromechanical', 0, 'Electromechanical', 'Connectors, Switches, Relays'),
    ('Power', 'power', 0, 'Power', 'Power supplies, Regulators, Converters'),
    ('RF & Wireless', 'rf-wireless', 0, 'RF & Wireless', 'Antennas, RF modules, Wireless components'),
    ('Sensors', 'sensors', 0, 'Sensors', 'Temperature, Pressure, Motion sensors'),
    ('Optoelectronics', 'optoelectronics', 0, 'Optoelectronics', 'LEDs, Displays, Optocouplers'),
    ('Cables & Interconnects', 'cables-interconnects', 0, 'Cables & Interconnects', 'Cables, Wires, Terminals')
ON CONFLICT (slug) DO NOTHING;

-- ========================================
-- 23. SEED COMMON MANUFACTURERS
-- ========================================

INSERT INTO manufacturers (name, slug, website, is_verified)
VALUES
    ('Texas Instruments', 'texas-instruments', 'https://www.ti.com', true),
    ('Analog Devices', 'analog-devices', 'https://www.analog.com', true),
    ('STMicroelectronics', 'stmicroelectronics', 'https://www.st.com', true),
    ('NXP Semiconductors', 'nxp', 'https://www.nxp.com', true),
    ('Microchip Technology', 'microchip', 'https://www.microchip.com', true),
    ('Infineon', 'infineon', 'https://www.infineon.com', true),
    ('Murata', 'murata', 'https://www.murata.com', true),
    ('Yageo', 'yageo', 'https://www.yageo.com', true),
    ('Samsung Electro-Mechanics', 'samsung-em', 'https://www.samsungsem.com', true),
    ('TDK', 'tdk', 'https://www.tdk.com', true),
    ('Vishay', 'vishay', 'https://www.vishay.com', true),
    ('Bourns', 'bourns', 'https://www.bourns.com', true),
    ('Würth Elektronik', 'wurth', 'https://www.we-online.com', true),
    ('TE Connectivity', 'te-connectivity', 'https://www.te.com', true),
    ('Molex', 'molex', 'https://www.molex.com', true)
ON CONFLICT (slug) DO NOTHING;

-- ========================================
-- 24. SEED COMMON SVHC SUBSTANCES (Top 10)
-- ========================================

INSERT INTO svhc_substances (cas_number, substance_name, reason_for_inclusion, listed_date, concentration_limit)
VALUES
    ('10108-64-2', 'Lead', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('7439-92-1', 'Lead', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('7440-43-9', 'Cadmium', 'Carcinogenic', '2010-06-18', 0.01),
    ('7440-02-0', 'Nickel', 'Carcinogenic', '2008-10-28', 0.1),
    ('1313-27-5', 'Molybdenum trioxide', 'Toxic for reproduction', '2010-06-18', 0.1),
    ('7784-40-9', 'Lead hydrogen arsenate', 'Carcinogenic', '2008-10-28', 0.1),
    ('12656-85-8', 'Trilead dioxide phosphonate', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('85-68-7', 'Benzyl butyl phthalate (BBP)', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('117-81-7', 'Bis(2-ethylhexyl) phthalate (DEHP)', 'Toxic for reproduction', '2008-10-28', 0.1),
    ('84-74-2', 'Dibutyl phthalate (DBP)', 'Toxic for reproduction', '2008-10-28', 0.1)
ON CONFLICT (cas_number) DO NOTHING;

-- ========================================
-- 25. VERIFICATION QUERY
-- ========================================

SELECT
    'Migration 007 Complete' as status,
    (SELECT COUNT(*) FROM manufacturers) as manufacturers,
    (SELECT COUNT(*) FROM categories) as categories,
    (SELECT COUNT(*) FROM suppliers) as suppliers,
    (SELECT COUNT(*) FROM predefined_tags) as predefined_tags,
    (SELECT COUNT(*) FROM svhc_substances) as svhc_substances;
