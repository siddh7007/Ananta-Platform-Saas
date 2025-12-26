-- Simple authentication for standalone PostgreSQL
-- (Not using full Supabase Auth, just basic user table)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SIMPLE AUTH SCHEMA
-- =====================================================

-- Users table (simplified auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- In production, use proper hashing
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (Top-level tenant entity)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Memberships (User-to-Org mapping)
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);

-- =====================================================
-- COMPONENTS (Customer Catalog)
-- =====================================================

CREATE TABLE IF NOT EXISTS components (
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
  moq INTEGER,
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
CREATE INDEX IF NOT EXISTS idx_components_org ON components(organization_id);
CREATE INDEX IF NOT EXISTS idx_components_mpn ON components(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
CREATE INDEX IF NOT EXISTS idx_components_risk ON components(risk_level);
CREATE INDEX IF NOT EXISTS idx_components_lifecycle ON components(lifecycle_status);

-- =====================================================
-- BOMS (Bill of Materials)
-- =====================================================

CREATE TABLE IF NOT EXISTS boms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- BOM identification
  name TEXT NOT NULL,
  version TEXT,
  description TEXT,

  -- Grading
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'N/A')),

  -- Status
  status TEXT CHECK (status IN ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',

  -- Statistics
  component_count INTEGER DEFAULT 0,
  total_cost DECIMAL(12, 2),
  high_risk_count INTEGER DEFAULT 0,
  medium_risk_count INTEGER DEFAULT 0,
  low_risk_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boms_org ON boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON boms(status);

-- =====================================================
-- BOM LINE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS bom_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,

  -- Original data
  reference_designator TEXT,
  mpn_raw TEXT NOT NULL,
  manufacturer_raw TEXT,
  description_raw TEXT,
  quantity INTEGER DEFAULT 1,

  -- Matching
  matched_component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5, 2),
  match_method TEXT CHECK (match_method IN ('exact', 'fuzzy', 'manual', 'unmatched')),

  -- Pricing
  unit_price DECIMAL(10, 4),
  extended_price DECIMAL(12, 2),
  risk_level TEXT CHECK (risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom ON bom_line_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_line_items_component ON bom_line_items(matched_component_id);

-- =====================================================
-- ALERTS
-- =====================================================

CREATE TABLE IF NOT EXISTS alerts (
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

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- =====================================================
-- INSERT TEST DATA
-- =====================================================

-- Test Organizations
INSERT INTO organizations (name, slug) VALUES
  ('Apple Tesla', 'apple-tesla'),
  ('Ananta Platform', 'ananta-platform')
ON CONFLICT (slug) DO NOTHING;

-- Test Users (password is 'password123' - in production use proper hashing!)
INSERT INTO users (email, password_hash, full_name) VALUES
  ('dev@apple-tesla.com', 'password123', 'Apple Tesla Developer'),
  ('dev@ananta.com', 'password123', 'Ananta Developer')
ON CONFLICT (email) DO NOTHING;

-- Link users to organizations
INSERT INTO organization_memberships (organization_id, user_id, role)
SELECT
  o.id,
  u.id,
  'owner'
FROM organizations o
CROSS JOIN users u
WHERE
  (o.slug = 'apple-tesla' AND u.email = 'dev@apple-tesla.com')
  OR (o.slug = 'ananta-platform' AND u.email = 'dev@ananta.com')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Sample Components for Apple Tesla
INSERT INTO components (
  organization_id,
  manufacturer_part_number,
  manufacturer,
  category,
  description,
  risk_level,
  lifecycle_status,
  rohs_compliant,
  unit_price,
  quality_score
)
SELECT
  o.id,
  'APPLE-CAP-1234-10UF',
  'Murata',
  'Capacitors',
  '10uF Ceramic Capacitor 25V X7R 0805',
  'GREEN',
  'ACTIVE',
  'COMPLIANT',
  0.15,
  95
FROM organizations o
WHERE o.slug = 'apple-tesla'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

INSERT INTO components (
  organization_id,
  manufacturer_part_number,
  manufacturer,
  category,
  description,
  risk_level,
  lifecycle_status,
  rohs_compliant,
  unit_price,
  quality_score
)
SELECT
  o.id,
  'APPLE-RES-5678-10K',
  'Yageo',
  'Resistors',
  '10K Ohm Resistor 1% 0805',
  'YELLOW',
  'NRND',
  'COMPLIANT',
  0.05,
  85
FROM organizations o
WHERE o.slug = 'apple-tesla'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

-- Sample Components for Ananta
INSERT INTO components (
  organization_id,
  manufacturer_part_number,
  manufacturer,
  category,
  description,
  risk_level,
  lifecycle_status,
  rohs_compliant,
  unit_price,
  quality_score
)
SELECT
  o.id,
  'ANANTA-MCU-9012',
  'STMicroelectronics',
  'Microcontrollers',
  'STM32F407 ARM Cortex-M4 MCU',
  'ORANGE',
  'EOL',
  'COMPLIANT',
  5.50,
  70
FROM organizations o
WHERE o.slug = 'ananta-platform'
ON CONFLICT (organization_id, manufacturer_part_number) DO NOTHING;

-- Sample BOMs
INSERT INTO boms (organization_id, name, version, description, grade, status)
SELECT
  o.id,
  'Apple Tesla Main Board v1.0',
  '1.0',
  'Primary control board for Apple Tesla',
  'B',
  'COMPLETED'
FROM organizations o
WHERE o.slug = 'apple-tesla'
ON CONFLICT DO NOTHING;

INSERT INTO boms (organization_id, name, version, description, grade, status)
SELECT
  o.id,
  'Ananta Cable Platform v2',
  '2.0',
  'Main platform BOM',
  'A',
  'COMPLETED'
FROM organizations o
WHERE o.slug = 'ananta-platform'
ON CONFLICT DO NOTHING;

-- Sample Alerts
INSERT INTO alerts (organization_id, severity, alert_type, title, message)
SELECT
  o.id,
  'HIGH',
  'LIFECYCLE',
  'Component EOL Notification',
  'IC-9012-MCU has been marked End-of-Life. Consider finding alternatives.'
FROM organizations o
WHERE o.slug = 'ananta-platform'
ON CONFLICT DO NOTHING;

-- Display summary
SELECT
  'Test Data Created' as status,
  (SELECT COUNT(*) FROM organizations) as organizations,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM organization_memberships) as memberships,
  (SELECT COUNT(*) FROM components) as components,
  (SELECT COUNT(*) FROM boms) as boms,
  (SELECT COUNT(*) FROM alerts) as alerts;
