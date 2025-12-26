-- Complete migration for Arc-SaaS App Plane
-- Handles dependency order properly

BEGIN;

-- ============================================================================
-- SECTION 1: Organizations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    domains TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    tier TEXT DEFAULT 'basic',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deprovisioned')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- SECTION 2: Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_platform_admin BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);

-- ============================================================================
-- SECTION 5: get_current_user_id Function (now that users table exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM users
    WHERE keycloak_user_id = keycloak_user_id()
    LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_user_id() IS
'Returns internal user UUID by looking up keycloak_user_id. For RLS policies.';

-- ============================================================================
-- SECTION 6: Updated Timestamps Trigger
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
-- SECTION 7: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 8: RLS Policies - Organizations
-- ============================================================================

DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        is_super_admin()
        OR id = current_organization_id()
    )
);

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations FOR INSERT
WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
USING (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (id = current_organization_id() AND is_org_admin())
);

DROP POLICY IF EXISTS "organizations_delete" ON organizations;
CREATE POLICY "organizations_delete" ON organizations FOR DELETE
USING (is_super_admin());

-- ============================================================================
-- SECTION 9: RLS Policies - Users
-- ============================================================================

DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
USING (
    is_super_admin()
    OR keycloak_user_id = keycloak_user_id()
    OR id IN (
        SELECT user_id FROM organization_memberships
        WHERE organization_id = current_organization_id()
    )
);

DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "users_update" ON users;
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
-- SECTION 10: RLS Policies - Organization Memberships
-- ============================================================================

DROP POLICY IF EXISTS "organization_memberships_select" ON organization_memberships;
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (
    is_super_admin()
    OR organization_id = current_organization_id()
);

DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')
    )
);

DROP POLICY IF EXISTS "organization_memberships_update" ON organization_memberships;
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND user_id != get_current_user_id()
    )
)
WITH CHECK (
    is_super_admin()
    OR (
        organization_id = current_organization_id()
        AND is_org_admin()
        AND role NOT IN ('owner')
    )
);

DROP POLICY IF EXISTS "organization_memberships_delete" ON organization_memberships;
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
-- SECTION 11: RLS Policies - Organization Invitations
-- ============================================================================

DROP POLICY IF EXISTS "organization_invitations_select" ON organization_invitations;
CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
    OR email = keycloak_user_email()
);

DROP POLICY IF EXISTS "organization_invitations_insert" ON organization_invitations;
CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

DROP POLICY IF EXISTS "organization_invitations_update" ON organization_invitations;
CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
)
WITH CHECK (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

DROP POLICY IF EXISTS "organization_invitations_delete" ON organization_invitations;
CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
USING (
    is_super_admin()
    OR (organization_id = current_organization_id() AND is_org_admin())
);

-- ============================================================================
-- SECTION 12: Helper Functions for Provisioning
-- ============================================================================

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
    INSERT INTO users (keycloak_user_id, email, full_name)
    VALUES (p_keycloak_user_id, p_email, COALESCE(p_full_name, split_part(p_email, '@', 1)))
    ON CONFLICT (keycloak_user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (p_organization_id, v_user_id, p_role)
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

    RETURN v_user_id;
END;
$$;

-- ============================================================================
-- SECTION 13: Grants
-- ============================================================================

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION keycloak_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_tenant_organization(UUID, TEXT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION provision_user_in_organization(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_invitations TO authenticated;

GRANT ALL ON organizations TO service_role;
GRANT ALL ON users TO service_role;
GRANT ALL ON organization_memberships TO service_role;
GRANT ALL ON organization_invitations TO service_role;

COMMIT;
