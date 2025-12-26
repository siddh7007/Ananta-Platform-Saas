-- ==============================================
-- App Plane Database Initialization
-- ==============================================
-- This schema aligns with Components Platform V2's Supabase structure
-- to enable seamless integration and shared patterns.
--
-- Key features:
-- - Auth0/Keycloak organization mapping (auth0_org_id)
-- - Enterprise support (max_users, sso_enabled)
-- - Organization invitations with token flow
-- - Row Level Security (RLS) for multi-tenant isolation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================
-- ORGANIZATIONS TABLE
-- ==============================================
-- Maps to Control Plane Tenants with Auth0/Keycloak org support
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Control Plane mapping
    arc_saas_tenant_id UUID UNIQUE,           -- Links to Control Plane tenant

    -- Basic info
    name TEXT NOT NULL,
    slug TEXT UNIQUE,                          -- tenant_key from Control Plane

    -- Organization type (matches Components V2)
    org_type TEXT DEFAULT 'individual',        -- individual, team, enterprise, platform

    -- Auth0/Keycloak organization mapping (for SSO/enterprise)
    auth0_org_id TEXT,                         -- Auth0 org ID (org_xxx)
    keycloak_realm TEXT,                       -- Keycloak realm for this tenant

    -- Enterprise features
    enterprise_name TEXT,                      -- Full company name
    enterprise_domain TEXT,                    -- SSO domain (e.g., "acme.com")
    enterprise_settings JSONB DEFAULT '{}',   -- Custom enterprise config
    sso_enabled BOOLEAN DEFAULT FALSE,

    -- Plan limits (synced from Control Plane)
    max_users INTEGER DEFAULT 5,
    max_components INTEGER DEFAULT 10000,
    max_storage_gb INTEGER DEFAULT 10,

    -- Subscription (synced from Control Plane)
    subscription_status TEXT DEFAULT 'active', -- active, trialing, past_due, cancelled
    plan_id TEXT,                              -- plan-basic, plan-standard, plan-premium
    trial_ends_at TIMESTAMPTZ,

    -- Settings
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_arc_tenant ON public.organizations(arc_saas_tenant_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_auth0_org_id
    ON public.organizations(auth0_org_id) WHERE auth0_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_keycloak_realm
    ON public.organizations(keycloak_realm) WHERE keycloak_realm IS NOT NULL;

-- Org type constraint
ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_org_type_check
    CHECK (org_type IS NULL OR org_type IN ('individual', 'team', 'enterprise', 'platform'));

-- ==============================================
-- USERS TABLE
-- ==============================================
-- Organization members with Auth0/Keycloak identity
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Identity
    email TEXT NOT NULL,
    auth0_user_id TEXT,                        -- Auth0 user ID (auth0|xxx)
    keycloak_user_id TEXT,                     -- Keycloak user ID

    -- Profile
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,

    -- Role (matches Components V2)
    role TEXT DEFAULT 'viewer',                -- admin, engineer, analyst, viewer

    -- Settings
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT users_email_org_unique UNIQUE(organization_id, email),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer', 'owner', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_users_organization ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth0_id
    ON public.users(auth0_user_id) WHERE auth0_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_id
    ON public.users(keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;

-- ==============================================
-- ORGANIZATION MEMBERSHIPS (Explicit Membership Table)
-- ==============================================
-- Matches Components V2 pattern for multi-org support
CREATE TABLE IF NOT EXISTS public.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT org_membership_unique UNIQUE(organization_id, user_id),
    CONSTRAINT membership_role_check CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer', 'owner'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships(user_id);

-- ==============================================
-- ORGANIZATION INVITATIONS
-- ==============================================
-- Token-based invitation flow (matches Components V2)
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Invitation details
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',       -- admin, engineer, analyst, viewer
    token TEXT NOT NULL UNIQUE,

    -- Tracking
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_invitation_role CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_pending ON public.organization_invitations(organization_id)
    WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW();

-- ==============================================
-- PROJECTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_organization ON public.projects(organization_id);

-- ==============================================
-- COMPONENTS TABLE (BOM Items)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    -- Component identification
    mpn TEXT NOT NULL,                         -- Manufacturer Part Number
    manufacturer TEXT,
    description TEXT,
    category TEXT,

    -- Technical data
    specifications JSONB DEFAULT '{}',
    datasheet_url TEXT,
    image_url TEXT,

    -- Lifecycle
    lifecycle_status TEXT DEFAULT 'active',

    -- Audit
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_components_organization ON public.components(organization_id);
CREATE INDEX IF NOT EXISTS idx_components_project ON public.components(project_id);
CREATE INDEX IF NOT EXISTS idx_components_mpn ON public.components(mpn);
CREATE INDEX IF NOT EXISTS idx_components_category ON public.components(category);

-- ==============================================
-- BOMs TABLE (Bill of Materials)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT DEFAULT '1.0',
    status TEXT DEFAULT 'draft',               -- draft, active, archived
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_organization ON public.boms(organization_id);
CREATE INDEX IF NOT EXISTS idx_boms_project ON public.boms(project_id);

-- ==============================================
-- BOM ITEMS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    component_id UUID REFERENCES public.components(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1,
    reference_designator TEXT,
    notes TEXT,
    alternatives JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON public.bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_component ON public.bom_items(component_id);

-- ==============================================
-- ANALYSES TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bom_id UUID REFERENCES public.boms(id) ON DELETE CASCADE,
    component_id UUID REFERENCES public.components(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,               -- lifecycle, cost, availability, compliance
    status TEXT DEFAULT 'pending',             -- pending, running, completed, failed
    results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_organization ON public.analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_analyses_bom ON public.analyses(bom_id);
CREATE INDEX IF NOT EXISTS idx_analyses_component ON public.analyses(component_id);

-- ==============================================
-- ACTIVITY LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_organization ON public.activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- HELPER FUNCTIONS (Matches Components V2)
-- ==============================================

-- Get organization by Auth0 org ID
CREATE OR REPLACE FUNCTION get_organization_by_auth0_id(p_auth0_org_id TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    org_type TEXT,
    auth0_org_id TEXT,
    enterprise_name TEXT,
    max_users INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.org_type,
        o.auth0_org_id,
        o.enterprise_name,
        o.max_users
    FROM public.organizations o
    WHERE o.auth0_org_id = p_auth0_org_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get organization by Control Plane tenant ID
CREATE OR REPLACE FUNCTION get_organization_by_tenant_id(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    org_type TEXT,
    max_users INTEGER,
    subscription_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.slug,
        o.org_type,
        o.max_users,
        o.subscription_status
    FROM public.organizations o
    WHERE o.arc_saas_tenant_id = p_tenant_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create organization invitation with limit enforcement
CREATE OR REPLACE FUNCTION create_organization_invitation(
    p_organization_id UUID,
    p_email TEXT,
    p_role TEXT DEFAULT 'viewer',
    p_invited_by UUID DEFAULT NULL,
    p_expires_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    id UUID,
    token TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
    v_expires TIMESTAMPTZ;
    v_id UUID;
    v_max_users INTEGER;
    v_current_users INTEGER;
BEGIN
    -- Check organization member limit
    SELECT max_users INTO v_max_users
    FROM organizations WHERE id = p_organization_id;

    IF v_max_users IS NOT NULL THEN
        -- Count current members
        SELECT COUNT(*) INTO v_current_users
        FROM organization_memberships WHERE organization_id = p_organization_id;

        -- Count pending invitations
        v_current_users := v_current_users + (
            SELECT COUNT(*) FROM organization_invitations
            WHERE organization_id = p_organization_id
            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > NOW()
        );

        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Organization has reached its member limit (% members)', v_max_users;
        END IF;
    END IF;

    -- Generate secure token
    v_token := encode(gen_random_bytes(32), 'hex');
    v_expires := NOW() + (p_expires_days || ' days')::INTERVAL;

    -- Insert invitation
    INSERT INTO organization_invitations (
        organization_id, email, role, token, invited_by, expires_at
    ) VALUES (
        p_organization_id, LOWER(p_email), p_role, v_token, p_invited_by, v_expires
    )
    RETURNING organization_invitations.id INTO v_id;

    RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;

-- Revoke organization invitation
CREATE OR REPLACE FUNCTION revoke_organization_invitation(p_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE organization_invitations
    SET revoked_at = NOW()
    WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

    RETURN FOUND;
END;
$$;

-- ==============================================
-- UPDATE TIMESTAMP TRIGGER
-- ==============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['organizations', 'users', 'projects', 'components', 'boms', 'bom_items'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON public.%I
                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t, t, t);
    END LOOP;
END $$;

-- ==============================================
-- GRANT PERMISSIONS
-- ==============================================

GRANT EXECUTE ON FUNCTION get_organization_by_auth0_id TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION get_organization_by_tenant_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_organization_invitation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION revoke_organization_invitation TO authenticated, service_role;
