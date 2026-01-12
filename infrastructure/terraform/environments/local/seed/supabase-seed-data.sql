-- =============================================================================
-- Supabase App Plane Seed Data
-- =============================================================================
-- This file contains seed data for all users matching Keycloak realm users
-- IMPORTANT: User IDs MUST match Keycloak user IDs for SSO to work
-- =============================================================================

-- =============================================================================
-- ORGANIZATIONS - Matching Keycloak tenant_id attributes
-- =============================================================================

-- Ananta Platform Organization (for platform admins)
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Ananta Platform',
    'ananta-platform',
    'active',
    'enterprise',
    'Platform administration organization'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- CNS Staff Organization (for CNS engineers)
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'CNS Staff',
    'cns-staff',
    'active',
    'enterprise',
    'Component Normalization Service staff organization'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- Demo Organization (for demo users)
INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description)
VALUES (
    'a0000000-0000-0000-0000-000000000000'::uuid,
    'Demo Organization',
    'demo-org',
    'trial',
    'standard',
    'Demo customer organization for testing'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description;

-- =============================================================================
-- USERS - IDs aligned with Keycloak realm (c0000000-0000-0000-0000-...)
-- =============================================================================

-- Platform Super Admin (Keycloak ID: c0000000-0000-0000-0000-000000000001)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'superadmin@ananta.dev',
    'Platform',
    'Admin',
    'super_admin',
    true,
    true,
    true,
    'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_platform_admin = EXCLUDED.is_platform_admin,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- CNS Lead (Keycloak ID: c0000000-0000-0000-0000-000000000002)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000002'::uuid,
    'cns-lead@ananta.dev',
    'CNS',
    'Lead',
    'admin',
    false,
    true,
    true,
    'c0000000-0000-0000-0000-000000000002'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- CNS Engineer (Keycloak ID: c0000000-0000-0000-0000-000000000003)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000003'::uuid,
    'cns-engineer@ananta.dev',
    'CNS',
    'Engineer',
    'engineer',
    false,
    true,
    true,
    'c0000000-0000-0000-0000-000000000003'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- Demo Owner (Keycloak ID: c0000000-0000-0000-0000-000000000004)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000004'::uuid,
    'demo-owner@example.com',
    'Demo',
    'Owner',
    'owner',
    false,
    true,
    true,
    'c0000000-0000-0000-0000-000000000004'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- Demo Engineer (Keycloak ID: c0000000-0000-0000-0000-000000000005)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000005'::uuid,
    'demo-engineer@example.com',
    'Demo',
    'Engineer',
    'engineer',
    false,
    true,
    true,
    'c0000000-0000-0000-0000-000000000005'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- CBP Admin (Keycloak ID: c0000000-0000-0000-0000-000000000010)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000010'::uuid,
    'cbpadmin@ananta.dev',
    'CBP',
    'Admin',
    'super_admin',
    true,
    true,
    true,
    'c0000000-0000-0000-0000-000000000010'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_platform_admin = EXCLUDED.is_platform_admin,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- CNS Staff (Keycloak ID: c0000000-0000-0000-0000-000000000011)
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id)
VALUES (
    'c0000000-0000-0000-0000-000000000011'::uuid,
    'cnsstaff@ananta.dev',
    'CNS',
    'Staff',
    'engineer',
    false,
    true,
    true,
    'c0000000-0000-0000-0000-000000000011'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    keycloak_user_id = EXCLUDED.keycloak_user_id;

-- Backstage Admin
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'c0000000-0000-0000-0000-000000000012'::uuid,
    'backstage-admin@ananta.dev',
    'Backstage',
    'Admin',
    'admin',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- Demo Analyst
INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified)
VALUES (
    'c0000000-0000-0000-0000-000000000013'::uuid,
    'demo-analyst@example.com',
    'Demo',
    'Analyst',
    'analyst',
    false,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;

-- =============================================================================
-- ORGANIZATION MEMBERSHIPS - Aligned with Keycloak tenant_id attributes
-- =============================================================================

INSERT INTO public.organization_memberships (user_id, organization_id, role, is_default)
VALUES
    -- Platform Admins -> Ananta Platform org
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', true),
    ('c0000000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', true),
    ('c0000000-0000-0000-0000-000000000012'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', true),
    -- CNS Staff -> CNS Staff org
    ('c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'admin', true),
    ('c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'engineer', true),
    ('c0000000-0000-0000-0000-000000000011'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'engineer', true),
    -- Demo users -> Demo org
    ('c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'owner', true),
    ('c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'engineer', true),
    ('c0000000-0000-0000-0000-000000000013'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'analyst', true)
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_default = EXCLUDED.is_default;

-- =============================================================================
-- WORKSPACES - Default workspace per organization
-- =============================================================================

-- Platform Default Workspace (d1 = workspace UUID prefix)
INSERT INTO public.workspaces (id, organization_id, name, slug, description, visibility, created_by)
VALUES (
    'd1000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Default Workspace',
    'default',
    'Default workspace for Ananta Platform organization',
    'team',
    'c0000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- CNS Staff Default Workspace
INSERT INTO public.workspaces (id, organization_id, name, slug, description, visibility, created_by)
VALUES (
    'd1000000-0000-0000-0000-000000000002'::uuid,
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'Default Workspace',
    'default',
    'Default workspace for CNS Staff organization',
    'team',
    'c0000000-0000-0000-0000-000000000002'::uuid
)
ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Demo Organization Default Workspace
INSERT INTO public.workspaces (id, organization_id, name, slug, description, visibility, created_by)
VALUES (
    'd1000000-0000-0000-0000-000000000003'::uuid,
    'a0000000-0000-0000-0000-000000000000'::uuid,
    'Default Workspace',
    'default',
    'Default workspace for Demo organization',
    'team',
    'c0000000-0000-0000-0000-000000000004'::uuid
)
ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- =============================================================================
-- WORKSPACE MEMBERSHIPS - Add users to their organization's default workspace
-- =============================================================================

INSERT INTO public.workspace_members (user_id, workspace_id, role)
VALUES
    -- Platform Admins -> Platform Default Workspace (as owners)
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 'owner'),
    ('c0000000-0000-0000-0000-000000000010'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 'owner'),
    ('c0000000-0000-0000-0000-000000000012'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 'owner'),
    -- CNS Staff -> CNS Default Workspace
    ('c0000000-0000-0000-0000-000000000002'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 'owner'),
    ('c0000000-0000-0000-0000-000000000003'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 'member'),
    ('c0000000-0000-0000-0000-000000000011'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 'member'),
    -- Demo users -> Demo Default Workspace
    ('c0000000-0000-0000-0000-000000000004'::uuid, 'd1000000-0000-0000-0000-000000000003'::uuid, 'owner'),
    ('c0000000-0000-0000-0000-000000000005'::uuid, 'd1000000-0000-0000-0000-000000000003'::uuid, 'member'),
    ('c0000000-0000-0000-0000-000000000013'::uuid, 'd1000000-0000-0000-0000-000000000003'::uuid, 'viewer')
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Seed data applied successfully:';
    RAISE NOTICE '  Organizations: %', (SELECT COUNT(*) FROM public.organizations);
    RAISE NOTICE '  Users: %', (SELECT COUNT(*) FROM public.users);
    RAISE NOTICE '  Organization Memberships: %', (SELECT COUNT(*) FROM public.organization_memberships);
    RAISE NOTICE '  Workspaces: %', (SELECT COUNT(*) FROM public.workspaces);
    RAISE NOTICE '  Workspace Memberships: %', (SELECT COUNT(*) FROM public.workspace_members);
END $$;
