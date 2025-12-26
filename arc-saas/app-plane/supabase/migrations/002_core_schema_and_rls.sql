-- Migration 002: Core Schema and RLS Policies for Arc-SaaS App Plane
-- Description: Creates core tables (organizations, users, memberships) and RLS policies
--
-- Date: 2025-12-08
--
-- IMPORTANT: organization.id = tenant.id from Control Plane
-- Organizations are created during tenant provisioning, NOT by users

BEGIN;

-- ============================================================================
-- SECTION 1: Organizations Table (Tenants from Control Plane)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,  -- This IS the tenant_id from Control Plane
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    domains TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    tier TEXT DEFAULT 'basic',  -- Synced from subscription plan tier
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deprovisioned')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL  -- Soft delete
);

COMMENT ON TABLE organizations IS 'Tenant organizations provisioned from Control Plane. id = tenant_id';
COMMENT ON COLUMN organizations.id IS 'Same as tenant_id from Control Plane';
COMMENT ON COLUMN organizations.tier IS 'Subscription tier synced from Control Plane (free, starter, basic, standard, professional, premium, enterprise)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- SECTION 2: Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id TEXT UNIQUE,  -- Keycloak sub claim
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_platform_admin BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'App Plane users, linked to Keycloak via keycloak_user_id';

-- Index for JWT lookups
CREATE INDEX IF NOT EXISTS idx_users_keycloak_user_id ON users(keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- SECTION 3: Organization Memberships Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'engineer', 'analyst', 'viewer')),
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

COMMENT ON TABLE organization_memberships IS 'User memberships in organizations with roles';

-- Indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON organization_memberships(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_role ON organization_memberships(user_id, role);

-- ============================================================================
-- SECTION 4: Organization Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, email)
);

COMMENT ON TABLE organization_invitations IS 'Pending user invitations to organizations';

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);

-- ============================================================================
-- SECTION 5: Updated Timestamps Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['organizations', 'users', 'organization_memberships'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_%I_timestamp ON %I;
            CREATE TRIGGER set_%I_timestamp
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ============================================================================
-- SECTION 6: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 7: RLS Policies - Organizations
-- ============================================================================

-- Users can only see their own organization (via JWT tenant_id claim)
CREATE POLICY "organizations_select" ON organizations FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        is_super_admin()
        OR id = current_organization_id()
    )
);

-- Only super admins can create organizations (Control Plane provisions them)
CREATE POLICY "organizations_insert" ON organizations FOR INSERT
WITH CHECK (is_super_admin());

-- Org admins can update their org, super admins can update any
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
USING (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
);

-- Only super admins can delete organizations
CREATE POLICY "organizations_delete" ON organizations FOR DELETE
USING (is_super_admin());

-- ============================================================================
-- SECTION 8: RLS Policies - Users
-- ============================================================================

-- Users can see themselves and users in their organization
CREATE POLICY "users_select" ON users FOR SELECT
USING (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()  -- Own profile
    OR id IN (
        SELECT user_id FROM organization_memberships
        WHERE organization_id = current_organization_id()
    )
);

-- Service role can insert users (during provisioning)
CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (is_super_admin());

-- Users can update their own profile
CREATE POLICY "users_update" ON users FOR UPDATE
USING (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()
)
WITH CHECK (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()
);

-- ============================================================================
-- SECTION 9: RLS Policies - Organization Memberships
-- ============================================================================

-- Users can see memberships in their org
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (
    is_super_admin()
    OR organization_id = current_organization_id()
);

-- Org admins can add members
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')  -- Can't add new owners
    )
);

-- Org admins can update member roles (not their own, not owners)
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND user_id != get_current_user_id()  -- Can't modify own membership
    )
)
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')  -- Can't promote to owner
    )
);

-- Org admins can remove members (not owners, not themselves)
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
USING (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND user_id != get_current_user_id()
        AND role != 'owner'
    )
);

-- ============================================================================
-- SECTION 10: RLS Policies - Organization Invitations
-- ============================================================================

CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
    OR email = keycloak_user_email()  -- Users can see their own invitations
);

CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

-- ============================================================================
-- SECTION 11: Helper Functions for Provisioning
-- ============================================================================

-- Function to create organization (called by webhook-bridge via service_role)
CREATE OR REPLACE FUNCTION create_tenant_organization(
    p_organization_id UUID,
    p_name TEXT,
    p_slug TEXT,
    p_tier TEXT DEFAULT 'basic',
    p_domains TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO organizations (id, name, slug, tier, domains, status)
    VALUES (p_organization_id, p_name, p_slug, p_tier, p_domains, 'active')
    ON CONFLICT (id) DO UPDATE
    SET
        name = EXCLUDED.name,
        slug = COALESCE(EXCLUDED.slug, organizations.slug),
        tier = EXCLUDED.tier,
        domains = EXCLUDED.domains,
        updated_at = NOW();

    RETURN p_organization_id;
END;
$$;

COMMENT ON FUNCTION create_tenant_organization IS
'Creates or updates an organization from Control Plane provisioning. Called by webhook-bridge.';

-- Function to provision user in organization
CREATE OR REPLACE FUNCTION provision_user_in_organization(
    p_keycloak_user_id TEXT,
    p_email TEXT,
    p_full_name TEXT,
    p_organization_id UUID,
    p_role TEXT DEFAULT 'viewer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Create or update user
    INSERT INTO users (keycloak_user_id, email, full_name)
    VALUES (p_keycloak_user_id, p_email, COALESCE(p_full_name, split_part(p_email, '@', 1)))
    ON CONFLICT (keycloak_user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    -- Create membership
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (p_organization_id, v_user_id, p_role)
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

    RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION provision_user_in_organization IS
'Provisions a user in an organization. Called during tenant provisioning or invitation acceptance.';

-- Grant functions to service_role
GRANT EXECUTE ON FUNCTION create_tenant_organization(UUID, TEXT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION provision_user_in_organization(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

COMMIT;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
--
-- TENANT PROVISIONING FLOW:
-- 1. Control Plane creates tenant with tenant_id (UUID)
-- 2. Temporal workflow sends webhook to App Plane webhook-bridge
-- 3. Webhook-bridge calls create_tenant_organization(tenant_id, name, key, tier)
-- 4. Organization is created with id = tenant_id
-- 5. Admin user is provisioned via provision_user_in_organization
-- 6. Webhook-bridge signals Temporal workflow completion
--
-- USER AUTHENTICATION FLOW:
-- 1. User logs in via Keycloak
-- 2. Keycloak JWT includes: sub (user ID), tenant_id (from mapper)
-- 3. Frontend passes JWT to Supabase client
-- 4. PostgREST validates JWT and sets request.jwt.claims
-- 5. RLS policies use current_organization_id() = JWT tenant_id
-- 6. All queries automatically filtered to user's organization
--
