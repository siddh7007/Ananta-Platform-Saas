-- Row Level Security Policies
-- Multi-tenant isolation based on organization_id

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Get Current User's Organization ID
-- =====================================================

CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM user_profiles
  WHERE keycloak_user_id = current_setting('app.current_user_id', true)
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- ORGANIZATIONS - Users can only see their own org
-- =====================================================

CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = auth.user_organization_id());

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (
    id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE keycloak_user_id = current_setting('app.current_user_id', true)
      AND organization_id = organizations.id
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- USER PROFILES - Users can see profiles in their org
-- =====================================================

CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (keycloak_user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Admins can manage profiles in their org"
  ON user_profiles FOR ALL
  USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.keycloak_user_id = current_setting('app.current_user_id', true)
      AND up.organization_id = user_profiles.organization_id
      AND up.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- COMPONENTS - Organization-scoped access
-- =====================================================

CREATE POLICY "Users can view components in their organization"
  ON components FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can create components in their organization"
  ON components FOR INSERT
  WITH CHECK (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update components in their organization"
  ON components FOR UPDATE
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Admins can delete components in their organization"
  ON components FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE keycloak_user_id = current_setting('app.current_user_id', true)
      AND organization_id = components.organization_id
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- BOMS - Organization-scoped access
-- =====================================================

CREATE POLICY "Users can view BOMs in their organization"
  ON boms FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can create BOMs in their organization"
  ON boms FOR INSERT
  WITH CHECK (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update BOMs in their organization"
  ON boms FOR UPDATE
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Admins can delete BOMs in their organization"
  ON boms FOR DELETE
  USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE keycloak_user_id = current_setting('app.current_user_id', true)
      AND organization_id = boms.organization_id
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- BOM LINE ITEMS - Access via parent BOM
-- =====================================================

CREATE POLICY "Users can view BOM line items in their organization"
  ON bom_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boms
      WHERE boms.id = bom_line_items.bom_id
      AND boms.organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Users can manage BOM line items in their organization"
  ON bom_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boms
      WHERE boms.id = bom_line_items.bom_id
      AND boms.organization_id = auth.user_organization_id()
    )
  );

-- =====================================================
-- ALERTS - Organization-scoped access
-- =====================================================

CREATE POLICY "Users can view alerts in their organization"
  ON alerts FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update alerts in their organization"
  ON alerts FOR UPDATE
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "System can create alerts"
  ON alerts FOR INSERT
  WITH CHECK (organization_id = auth.user_organization_id());

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT
  'RLS Policies Enabled' as status,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations') as org_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles') as user_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'components') as component_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boms') as bom_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'alerts') as alert_policies;
