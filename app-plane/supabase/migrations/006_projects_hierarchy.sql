-- Migration 006: Add Projects Hierarchy for Multi-Tenant Structure
-- Organizations → Projects → Components/BOMs/Alerts

-- ========================================
-- 1. CREATE PROJECTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,

    -- Project settings
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES user_profiles(id),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: slug must be unique within organization
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_active ON projects(is_active);

-- ========================================
-- 2. ADD PROJECT_ID TO EXISTING TABLES
-- ========================================

-- Add project_id to components
ALTER TABLE components
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX idx_components_project ON components(project_id);

-- Add project_id to boms
ALTER TABLE boms
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX idx_boms_project ON boms(project_id);

-- Add project_id to alerts
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX idx_alerts_project ON alerts(project_id);

-- ========================================
-- 3. ADD ROLE COLUMN TO USER_PROFILES
-- ========================================

-- Update user_profiles to distinguish between admin and regular users
DO $$
BEGIN
    -- Add role_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_profiles' AND column_name = 'role_type') THEN
        ALTER TABLE user_profiles
        ADD COLUMN role_type TEXT DEFAULT 'user' CHECK (role_type IN ('admin', 'user'));
    END IF;
END $$;

-- Update existing owner roles to admin
UPDATE user_profiles SET role_type = 'admin' WHERE role = 'owner';

-- ========================================
-- 4. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
    SELECT role_type = 'admin'
    FROM user_profiles
    WHERE keycloak_user_id = current_setting('app.current_user_id', true)
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to get current user's accessible project IDs
CREATE OR REPLACE FUNCTION public.current_user_project_ids()
RETURNS TABLE(project_id UUID) AS $$
    SELECT id as project_id
    FROM projects
    WHERE organization_id = public.current_user_organization_id();
$$ LANGUAGE SQL STABLE;

-- ========================================
-- 5. RLS POLICIES FOR PROJECTS
-- ========================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Admins can view all projects in their organization
CREATE POLICY "Admins can view projects in their organization"
    ON projects FOR SELECT
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- Users can view projects in their organization
CREATE POLICY "Users can view projects in their organization"
    ON projects FOR SELECT
    USING (organization_id = public.current_user_organization_id());

-- Admins can create projects
CREATE POLICY "Admins can create projects"
    ON projects FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- Users can create projects (but not modify organization settings)
CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (organization_id = public.current_user_organization_id());

-- Admins can update projects
CREATE POLICY "Admins can update projects"
    ON projects FOR UPDATE
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- Users can update their own projects
CREATE POLICY "Users can update projects they created"
    ON projects FOR UPDATE
    USING (
        organization_id = public.current_user_organization_id()
        AND created_by = (
            SELECT id FROM user_profiles
            WHERE keycloak_user_id = current_setting('app.current_user_id', true)
        )
    );

-- Only admins can delete projects
CREATE POLICY "Admins can delete projects"
    ON projects FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- ========================================
-- 6. UPDATE RLS POLICIES FOR COMPONENTS
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view components in their organization" ON components;
DROP POLICY IF EXISTS "Users can create components in their organization" ON components;
DROP POLICY IF EXISTS "Users can update components in their organization" ON components;
DROP POLICY IF EXISTS "Users can delete components in their organization" ON components;

-- New project-scoped policies
CREATE POLICY "Users can view components in their projects"
    ON components FOR SELECT
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Users can create components in their projects"
    ON components FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Users can update components in their projects"
    ON components FOR UPDATE
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Admins can delete any component in their organization"
    ON components FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

CREATE POLICY "Users can delete components in their projects"
    ON components FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

-- ========================================
-- 7. UPDATE RLS POLICIES FOR BOMS
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view BOMs in their organization" ON boms;
DROP POLICY IF EXISTS "Users can create BOMs in their organization" ON boms;
DROP POLICY IF EXISTS "Users can update BOMs in their organization" ON boms;
DROP POLICY IF EXISTS "Users can delete BOMs in their organization" ON boms;

-- New project-scoped policies
CREATE POLICY "Users can view BOMs in their projects"
    ON boms FOR SELECT
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Users can create BOMs in their projects"
    ON boms FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Users can update BOMs in their projects"
    ON boms FOR UPDATE
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Admins can delete any BOM in their organization"
    ON boms FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

CREATE POLICY "Users can delete BOMs in their projects"
    ON boms FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

-- ========================================
-- 8. UPDATE RLS POLICIES FOR ALERTS
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view alerts in their organization" ON alerts;
DROP POLICY IF EXISTS "Users can create alerts in their organization" ON alerts;
DROP POLICY IF EXISTS "Users can update alerts in their organization" ON alerts;
DROP POLICY IF EXISTS "Users can delete alerts in their organization" ON alerts;

-- New project-scoped policies
CREATE POLICY "Users can view alerts in their projects"
    ON alerts FOR SELECT
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "System can create alerts"
    ON alerts FOR INSERT
    WITH CHECK (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Users can update alerts in their projects"
    ON alerts FOR UPDATE
    USING (
        organization_id = public.current_user_organization_id()
        AND (project_id IS NULL OR project_id IN (SELECT * FROM public.current_user_project_ids()))
    );

CREATE POLICY "Admins can delete any alert in their organization"
    ON alerts FOR DELETE
    USING (
        organization_id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- ========================================
-- 9. RLS POLICIES FOR ORGANIZATIONS (ADMIN ONLY)
-- ========================================

-- Drop existing organization policies
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;

-- Only admins can access organization settings
CREATE POLICY "Admins can view their organization"
    ON organizations FOR SELECT
    USING (
        id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (
        id = public.current_user_organization_id()
        AND public.current_user_is_admin()
    );

-- Super admins can create organizations (system-level)
-- This would be handled by a separate super_admin role in production

-- ========================================
-- 10. CREATE TEST PROJECTS
-- ========================================

-- Create test projects for each organization
DO $$
DECLARE
    apple_org_id UUID;
    tesla_org_id UUID;
    ananta_org_id UUID;
    apple_user_id UUID;
    tesla_user_id UUID;
    ananta_user_id UUID;
BEGIN
    -- Get organization IDs
    SELECT id INTO apple_org_id FROM organizations WHERE slug = 'apple';
    SELECT id INTO tesla_org_id FROM organizations WHERE slug = 'tesla';
    SELECT id INTO ananta_org_id FROM organizations WHERE slug = 'ananta-platform';

    -- Get user IDs
    SELECT id INTO apple_user_id FROM user_profiles WHERE email = 'dev@apple.com';
    SELECT id INTO tesla_user_id FROM user_profiles WHERE email = 'dev@tesla.com';
    SELECT id INTO ananta_user_id FROM user_profiles WHERE email = 'dev@ananta.com';

    -- Create projects for Apple
    INSERT INTO projects (organization_id, name, slug, description, created_by)
    VALUES
        (apple_org_id, 'iPhone 16 Pro', 'iphone-16-pro', 'Next generation iPhone components', apple_user_id),
        (apple_org_id, 'MacBook Pro M4', 'macbook-pro-m4', 'M4 MacBook Pro components', apple_user_id);

    -- Create projects for Tesla
    INSERT INTO projects (organization_id, name, slug, description, created_by)
    VALUES
        (tesla_org_id, 'Model S Plaid', 'model-s-plaid', 'Model S Plaid electronic components', tesla_user_id),
        (tesla_org_id, 'Cybertruck', 'cybertruck', 'Cybertruck power systems', tesla_user_id);

    -- Create projects for Ananta (dev/test)
    INSERT INTO projects (organization_id, name, slug, description, created_by)
    VALUES
        (ananta_org_id, 'Platform Development', 'platform-dev', 'Internal platform development', ananta_user_id),
        (ananta_org_id, 'Test Project', 'test-project', 'Testing and experimentation', ananta_user_id);
END $$;

-- ========================================
-- 11. VERIFICATION QUERY
-- ========================================

SELECT
    'Migration 006 Complete' as status,
    (SELECT COUNT(*) FROM projects) as total_projects,
    (SELECT COUNT(*) FROM organizations) as total_organizations,
    (SELECT COUNT(*) FROM user_profiles WHERE role_type = 'admin') as total_admins,
    (SELECT COUNT(*) FROM user_profiles WHERE role_type = 'user') as total_users;
