-- Business Data Migration (No Supabase Auth)
-- Authentication handled by Keycloak SSO
-- This creates business tables only

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ORGANIZATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  keycloak_group_id TEXT, -- Link to Keycloak group
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER PROFILES (linked to Keycloak)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keycloak_user_id TEXT UNIQUE NOT NULL, -- Keycloak user ID
  email TEXT NOT NULL,
  full_name TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member', -- owner, admin, member, viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_keycloak ON user_profiles(keycloak_user_id);

-- =====================================================
-- COMPONENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manufacturer_part_number TEXT NOT NULL,
  manufacturer TEXT,
  category TEXT,
  description TEXT,
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),
  lifecycle_status TEXT CHECK (lifecycle_status IN ('ACTIVE', 'NRND', 'EOL', 'OBSOLETE')),
  rohs_compliant TEXT CHECK (rohs_compliant IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')),
  reach_compliant BOOLEAN,
  unit_price DECIMAL(10, 4),
  currency TEXT DEFAULT 'USD',
  stock_quantity INTEGER,
  moq INTEGER,
  lead_time_days INTEGER,
  vendor_part_number TEXT,
  vendor_name TEXT,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, manufacturer_part_number)
);

CREATE INDEX IF NOT EXISTS idx_components_org ON components(organization_id);
CREATE INDEX IF NOT EXISTS idx_components_mpn ON components(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
CREATE INDEX IF NOT EXISTS idx_components_risk ON components(risk_level);
CREATE INDEX IF NOT EXISTS idx_components_lifecycle ON components(lifecycle_status);

-- =====================================================
-- BOMS
-- =====================================================

CREATE TABLE IF NOT EXISTS boms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT,
  description TEXT,
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),
  status TEXT CHECK (status IN ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
  component_count INTEGER DEFAULT 0,
  total_cost DECIMAL(12, 2),
  high_risk_count INTEGER DEFAULT 0,
  medium_risk_count INTEGER DEFAULT 0,
  low_risk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_org ON boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON boms(status);

-- =====================================================
-- BOM LINE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS bom_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
  reference_designator TEXT,
  mpn_raw TEXT NOT NULL,
  manufacturer_raw TEXT,
  description_raw TEXT,
  quantity INTEGER DEFAULT 1,
  matched_component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5, 2),
  match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),
  unit_price DECIMAL(10, 4),
  extended_price DECIMAL(12, 2),
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom ON bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component ON bom_line_items(matched_component_id);

-- =====================================================
-- ALERTS
-- =====================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE CASCADE,
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('LIFECYCLE', 'RISK', 'PRICE', 'AVAILABILITY', 'COMPLIANCE')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- =====================================================
-- TEST DATA
-- =====================================================

-- Insert Test Organizations
INSERT INTO organizations (name, slug, keycloak_group_id) VALUES
  ('Apple Tesla', 'apple-tesla', NULL),
  ('Ananta Platform', 'ananta-platform', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Insert Test User Profiles (to be linked with Keycloak later)
-- Credentials: dev@apple-tesla.com / password123
-- Credentials: dev@ananta.com / password123
INSERT INTO user_profiles (keycloak_user_id, email, full_name, organization_id, role)
SELECT
  'dev-apple-tesla-temp', -- Temporary, will be replaced by real Keycloak ID
  'dev@apple-tesla.com',
  'Apple Tesla Developer',
  o.id,
  'owner'
FROM organizations o
WHERE o.slug = 'apple-tesla'
ON CONFLICT (keycloak_user_id) DO NOTHING;

INSERT INTO user_profiles (keycloak_user_id, email, full_name, organization_id, role)
SELECT
  'dev-ananta-temp', -- Temporary, will be replaced by real Keycloak ID
  'dev@ananta.com',
  'Ananta Developer',
  o.id,
  'owner'
FROM organizations o
WHERE o.slug = 'ananta-platform'
ON CONFLICT (keycloak_user_id) DO NOTHING;

-- Sample Components for Apple Tesla
INSERT INTO components (
  organization_id, manufacturer_part_number, manufacturer, category,
  description, risk_level, lifecycle_status, rohs_compliant, unit_price, quality_score
)
SELECT
  o.id, 'APPLE-CAP-1234-10UF', 'Murata', 'Capacitors',
  '10uF Ceramic Capacitor 25V X7R 0805', 'GREEN', 'ACTIVE', 'COMPLIANT', 0.15, 95
FROM organizations o WHERE o.slug = 'apple-tesla'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

INSERT INTO components (
  organization_id, manufacturer_part_number, manufacturer, category,
  description, risk_level, lifecycle_status, rohs_compliant, unit_price, quality_score
)
SELECT
  o.id, 'APPLE-RES-5678-10K', 'Yageo', 'Resistors',
  '10K Ohm Resistor 1% 0805', 'YELLOW', 'NRND', 'COMPLIANT', 0.05, 85
FROM organizations o WHERE o.slug = 'apple-tesla'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

-- Sample Components for Ananta
INSERT INTO components (
  organization_id, manufacturer_part_number, manufacturer, category,
  description, risk_level, lifecycle_status, rohs_compliant, unit_price, quality_score
)
SELECT
  o.id, 'ANANTA-MCU-9012', 'STMicroelectronics', 'Microcontrollers',
  'STM32F407 ARM Cortex-M4 MCU', 'ORANGE', 'EOL', 'COMPLIANT', 5.50, 70
FROM organizations o WHERE o.slug = 'ananta-platform'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

-- Sample BOMs
INSERT INTO boms (organization_id, name, version, description, grade, status)
SELECT o.id, 'Apple Tesla Main Board v1.0', '1.0', 'Primary control board', 'B', 'COMPLETED'
FROM organizations o WHERE o.slug = 'apple-tesla';

INSERT INTO boms (organization_id, name, version, description, grade, status)
SELECT o.id, 'Ananta Cable Platform v2', '2.0', 'Main platform BOM', 'A', 'COMPLETED'
FROM organizations o WHERE o.slug = 'ananta-platform';

-- Sample Alerts
INSERT INTO alerts (organization_id, severity, alert_type, title, message)
SELECT o.id, 'HIGH', 'LIFECYCLE', 'Component EOL Notification',
       'ANANTA-MCU-9012 has been marked End-of-Life. Consider finding alternatives.'
FROM organizations o WHERE o.slug = 'ananta-platform';

-- Summary
SELECT
  'Migration Complete' as status,
  (SELECT COUNT(*) FROM organizations) as organizations,
  (SELECT COUNT(*) FROM user_profiles) as user_profiles,
  (SELECT COUNT(*) FROM components) as components,
  (SELECT COUNT(*) FROM boms) as boms,
  (SELECT COUNT(*) FROM alerts) as alerts;
