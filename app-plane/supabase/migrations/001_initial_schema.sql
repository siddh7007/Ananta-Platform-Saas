-- Components Platform - Initial Database Schema
-- Multi-tenant architecture with Row-Level Security (RLS)
-- Based on Ananta v2 proven pattern

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ORGANIZATIONS & MULTI-TENANCY
-- =====================================================

-- Organizations (Top-level tenant entity)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Memberships (User-to-Org mapping)
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);

-- =====================================================
-- COMPONENTS (Customer Catalog)
-- =====================================================

CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Component identification
  manufacturer_part_number TEXT NOT NULL,
  manufacturer TEXT,
  category TEXT,
  description TEXT,

  -- Risk & Lifecycle
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),
  lifecycle_status TEXT CHECK (lifecycle_status IN ('ACTIVE', 'NRND', 'EOL', 'OBSOLETE')),

  -- Compliance
  rohs_compliant TEXT CHECK (rohs_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')),
  reach_compliant BOOLEAN,

  -- Pricing & Availability
  unit_price DECIMAL(10, 4),
  currency TEXT DEFAULT 'USD',
  stock_quantity INTEGER,
  moq INTEGER, -- Minimum Order Quantity
  lead_time_days INTEGER,

  -- Vendor information
  vendor_part_number TEXT,
  vendor_name TEXT,

  -- Quality score (0-100)
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per organization
  UNIQUE(organization_id, manufacturer_part_number)
);

-- Indexes
CREATE INDEX idx_components_org ON components(organization_id);
CREATE INDEX idx_components_mpn ON components(manufacturer_part_number);
CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_risk ON components(risk_level);
CREATE INDEX idx_components_lifecycle ON components(lifecycle_status);

-- =====================================================
-- BOMS (Bill of Materials)
-- =====================================================

CREATE TABLE boms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- BOM identification
  name TEXT NOT NULL,
  version TEXT,
  description TEXT,

  -- Grading (A-F based on risk analysis)
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),

  -- Status
  status TEXT CHECK (status IN ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',

  -- Statistics
  component_count INTEGER DEFAULT 0,
  total_cost DECIMAL(12, 2),
  high_risk_count INTEGER DEFAULT 0,
  medium_risk_count INTEGER DEFAULT 0,
  low_risk_count INTEGER DEFAULT 0,

  -- Analysis metadata
  analyzed_at TIMESTAMPTZ,
  analysis_version TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_boms_org ON boms(organization_id);
CREATE INDEX idx_boms_status ON boms(status);
CREATE INDEX idx_boms_grade ON boms(grade);

-- =====================================================
-- BOM LINE ITEMS
-- =====================================================

CREATE TABLE bom_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,

  -- Original data from upload
  reference_designator TEXT,
  mpn_raw TEXT NOT NULL,
  manufacturer_raw TEXT,
  description_raw TEXT,
  quantity INTEGER DEFAULT 1,

  -- Matching results
  matched_component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5, 2), -- 0.00 to 100.00
  match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),

  -- Line item analysis
  unit_price DECIMAL(10, 4),
  extended_price DECIMAL(12, 2), -- quantity * unit_price
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bom_line_items_bom ON bom_line_items(bom_id);
CREATE INDEX idx_bom_line_items_component ON bom_line_items(matched_component_id);

-- =====================================================
-- ALERTS
-- =====================================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE CASCADE,

  -- Alert details
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_alerts_org ON alerts(organization_id);
CREATE INDEX idx_alerts_component ON alerts(component_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_is_read ON alerts(is_read);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- =====================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Helper function: Get current user's organization ID
CREATE OR REPLACE FUNCTION auth.current_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM organization_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function: Check if user is org admin
CREATE OR REPLACE FUNCTION auth.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =====================================================
-- COMPONENTS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their org's components"
  ON components FOR SELECT
  USING (organization_id = auth.current_org_id());

CREATE POLICY "Users can create components for their org"
  ON components FOR INSERT
  WITH CHECK (organization_id = auth.current_org_id());

CREATE POLICY "Users can update their org's components"
  ON components FOR UPDATE
  USING (organization_id = auth.current_org_id());

CREATE POLICY "Admins can delete their org's components"
  ON components FOR DELETE
  USING (
    organization_id = auth.current_org_id()
    AND auth.is_org_admin()
  );

-- =====================================================
-- BOMS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their org's BOMs"
  ON boms FOR SELECT
  USING (organization_id = auth.current_org_id());

CREATE POLICY "Users can create BOMs for their org"
  ON boms FOR INSERT
  WITH CHECK (organization_id = auth.current_org_id());

CREATE POLICY "Users can update their org's BOMs"
  ON boms FOR UPDATE
  USING (organization_id = auth.current_org_id());

CREATE POLICY "Admins can delete their org's BOMs"
  ON boms FOR DELETE
  USING (
    organization_id = auth.current_org_id()
    AND auth.is_org_admin()
  );

-- =====================================================
-- BOM LINE ITEMS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their org's BOM line items"
  ON bom_line_items FOR SELECT
  USING (
    bom_id IN (
      SELECT id FROM boms WHERE organization_id = auth.current_org_id()
    )
  );

CREATE POLICY "Users can create BOM line items for their org's BOMs"
  ON bom_line_items FOR INSERT
  WITH CHECK (
    bom_id IN (
      SELECT id FROM boms WHERE organization_id = auth.current_org_id()
    )
  );

CREATE POLICY "Users can update their org's BOM line items"
  ON bom_line_items FOR UPDATE
  USING (
    bom_id IN (
      SELECT id FROM boms WHERE organization_id = auth.current_org_id()
    )
  );

CREATE POLICY "Users can delete their org's BOM line items"
  ON bom_line_items FOR DELETE
  USING (
    bom_id IN (
      SELECT id FROM boms WHERE organization_id = auth.current_org_id()
    )
  );

-- =====================================================
-- ALERTS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their org's alerts"
  ON alerts FOR SELECT
  USING (organization_id = auth.current_org_id());

CREATE POLICY "System can create alerts for any org"
  ON alerts FOR INSERT
  WITH CHECK (true); -- Backend service creates alerts

CREATE POLICY "Users can update their org's alerts"
  ON alerts FOR UPDATE
  USING (organization_id = auth.current_org_id());

CREATE POLICY "Admins can delete their org's alerts"
  ON alerts FOR DELETE
  USING (
    organization_id = auth.current_org_id()
    AND auth.is_org_admin()
  );

-- =====================================================
-- ORGANIZATION MEMBERSHIPS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their org memberships"
  ON organization_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage memberships"
  ON organization_memberships FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- ORGANIZATIONS RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at
  BEFORE UPDATE ON components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boms_updated_at
  BEFORE UPDATE ON boms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- BOM statistics update trigger
CREATE OR REPLACE FUNCTION update_bom_statistics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE boms
  SET
    component_count = (
      SELECT COUNT(*) FROM bom_line_items WHERE bom_id = NEW.bom_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(extended_price), 0) FROM bom_line_items WHERE bom_id = NEW.bom_id
    ),
    high_risk_count = (
      SELECT COUNT(*) FROM bom_line_items WHERE bom_id = NEW.bom_id AND risk_level = 'RED'
    ),
    medium_risk_count = (
      SELECT COUNT(*) FROM bom_line_items WHERE bom_id = NEW.bom_id AND risk_level IN ('ORANGE', 'YELLOW')
    ),
    low_risk_count = (
      SELECT COUNT(*) FROM bom_line_items WHERE bom_id = NEW.bom_id AND risk_level = 'GREEN'
    )
  WHERE id = NEW.bom_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bom_stats_on_line_item_change
  AFTER INSERT OR UPDATE OR DELETE ON bom_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bom_statistics();

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE organizations IS 'Top-level tenant entity for multi-tenancy';
COMMENT ON TABLE organization_memberships IS 'User-to-organization mapping with roles';
COMMENT ON TABLE components IS 'Electronic components catalog with risk and lifecycle tracking';
COMMENT ON TABLE boms IS 'Bill of Materials with automated grading';
COMMENT ON TABLE bom_line_items IS 'Individual line items in a BOM with auto-matching';
COMMENT ON TABLE alerts IS 'System-generated alerts for component lifecycle changes';

COMMENT ON FUNCTION auth.current_org_id() IS 'Get the current authenticated user''s organization ID';
COMMENT ON FUNCTION auth.is_org_admin() IS 'Check if current user is an admin/owner of their organization';
