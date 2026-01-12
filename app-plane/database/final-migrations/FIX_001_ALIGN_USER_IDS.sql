-- =============================================================================
-- FIX_001_ALIGN_USER_IDS.sql
-- =============================================================================
-- Purpose: Align existing user IDs from b0000000-... to c0000000-... pattern
--          to match Keycloak user IDs and ensure cross-service consistency.
--
-- Run this ONCE on existing databases that were seeded before the
-- standardized UUID pattern was established.
--
-- This script is IDEMPOTENT - safe to run multiple times.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Temporarily disable FK constraints for cascade updates
-- =============================================================================
SET session_replication_role = 'replica';

-- =============================================================================
-- STEP 2: Update user IDs from b0000000-... to c0000000-...
-- =============================================================================

-- User 1: superadmin@ananta.dev
UPDATE public.users SET id = 'c0000000-0000-0000-0000-000000000001'::uuid
WHERE email = 'superadmin@ananta.dev' AND id = 'b0000000-0000-0000-0000-000000000001'::uuid;

-- User 2: cns-lead@ananta.dev
UPDATE public.users SET id = 'c0000000-0000-0000-0000-000000000002'::uuid
WHERE email = 'cns-lead@ananta.dev' AND id = 'b0000000-0000-0000-0000-000000000002'::uuid;

-- User 3: cns-engineer@ananta.dev
UPDATE public.users SET id = 'c0000000-0000-0000-0000-000000000003'::uuid
WHERE email = 'cns-engineer@ananta.dev' AND id = 'b0000000-0000-0000-0000-000000000003'::uuid;

-- User 4: demo-owner@example.com
UPDATE public.users SET id = 'c0000000-0000-0000-0000-000000000004'::uuid
WHERE email = 'demo-owner@example.com' AND id = 'b0000000-0000-0000-0000-000000000004'::uuid;

-- User 5: demo-engineer@example.com
UPDATE public.users SET id = 'c0000000-0000-0000-0000-000000000005'::uuid
WHERE email = 'demo-engineer@example.com' AND id = 'b0000000-0000-0000-0000-000000000005'::uuid;

-- =============================================================================
-- STEP 3: Update organization_memberships to reference new user IDs
-- =============================================================================

UPDATE public.organization_memberships SET user_id = 'c0000000-0000-0000-0000-000000000001'::uuid
WHERE user_id = 'b0000000-0000-0000-0000-000000000001'::uuid;

UPDATE public.organization_memberships SET user_id = 'c0000000-0000-0000-0000-000000000002'::uuid
WHERE user_id = 'b0000000-0000-0000-0000-000000000002'::uuid;

UPDATE public.organization_memberships SET user_id = 'c0000000-0000-0000-0000-000000000003'::uuid
WHERE user_id = 'b0000000-0000-0000-0000-000000000003'::uuid;

UPDATE public.organization_memberships SET user_id = 'c0000000-0000-0000-0000-000000000004'::uuid
WHERE user_id = 'b0000000-0000-0000-0000-000000000004'::uuid;

UPDATE public.organization_memberships SET user_id = 'c0000000-0000-0000-0000-000000000005'::uuid
WHERE user_id = 'b0000000-0000-0000-0000-000000000005'::uuid;

-- =============================================================================
-- STEP 4: Add missing users
-- =============================================================================

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
-- STEP 5: Add missing organization memberships
-- =============================================================================

INSERT INTO public.organization_memberships (user_id, organization_id, role, is_default)
VALUES
    -- CBP Admin -> Platform Admin org
    ('c0000000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', true),
    -- Backstage Admin -> Platform Admin org
    ('c0000000-0000-0000-0000-000000000012'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin', true),
    -- CNS Staff -> CNS Staff org
    ('c0000000-0000-0000-0000-000000000011'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'engineer', true),
    -- Demo Analyst -> Demo org
    ('c0000000-0000-0000-0000-000000000013'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'analyst', true)
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_default = EXCLUDED.is_default;

-- =============================================================================
-- STEP 6: Update keycloak_user_id for existing users (ensure consistency)
-- =============================================================================

UPDATE public.users SET keycloak_user_id = 'c0000000-0000-0000-0000-000000000001'
WHERE id = 'c0000000-0000-0000-0000-000000000001'::uuid AND (keycloak_user_id IS NULL OR keycloak_user_id = '');

UPDATE public.users SET keycloak_user_id = 'c0000000-0000-0000-0000-000000000002'
WHERE id = 'c0000000-0000-0000-0000-000000000002'::uuid AND (keycloak_user_id IS NULL OR keycloak_user_id = '');

UPDATE public.users SET keycloak_user_id = 'c0000000-0000-0000-0000-000000000003'
WHERE id = 'c0000000-0000-0000-0000-000000000003'::uuid AND (keycloak_user_id IS NULL OR keycloak_user_id = '');

UPDATE public.users SET keycloak_user_id = 'c0000000-0000-0000-0000-000000000004'
WHERE id = 'c0000000-0000-0000-0000-000000000004'::uuid AND (keycloak_user_id IS NULL OR keycloak_user_id = '');

UPDATE public.users SET keycloak_user_id = 'c0000000-0000-0000-0000-000000000005'
WHERE id = 'c0000000-0000-0000-0000-000000000005'::uuid AND (keycloak_user_id IS NULL OR keycloak_user_id = '');

-- =============================================================================
-- STEP 7: Populate workspace_members from organization_memberships
-- =============================================================================
-- Each user in an org should have membership in that org's workspaces
-- Role mapping: owner->owner, admin->admin, engineer/staff->member, analyst/viewer->viewer

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT DISTINCT
    w.id as workspace_id,
    om.user_id,
    CASE
        WHEN om.role = 'owner' THEN 'owner'
        WHEN om.role = 'admin' THEN 'admin'
        WHEN om.role IN ('engineer', 'staff') THEN 'member'
        WHEN om.role IN ('analyst', 'viewer') THEN 'viewer'
        ELSE 'member'
    END as role
FROM organization_memberships om
JOIN workspaces w ON w.organization_id = om.organization_id
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Platform admins get owner role on workspaces WITHIN their org (not all workspaces)
UPDATE workspace_members wm
SET role = 'owner'
FROM users u
WHERE wm.user_id = u.id AND u.is_platform_admin = true;

-- =============================================================================
-- STEP 8: Fix workspace IDs to standardized d1000000- pattern (DISABLED)
-- =============================================================================
-- NOTE: This step is disabled because workspace IDs are already correct in seed data.
-- Uncomment if you need to fix legacy workspace IDs.

/*
-- Update workspace_members first (FK references)
UPDATE public.workspace_members SET workspace_id = 'd1000000-0000-0000-0000-000000000001'::uuid
WHERE workspace_id NOT LIKE 'd1000000-%' AND workspace_id IN (
    SELECT id FROM public.workspaces WHERE organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid
);

UPDATE public.workspace_members SET workspace_id = 'd1000000-0000-0000-0000-000000000002'::uuid
WHERE workspace_id NOT LIKE 'd1000000-%' AND workspace_id IN (
    SELECT id FROM public.workspaces WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
);

UPDATE public.workspace_members SET workspace_id = 'd1000000-0000-0000-0000-000000000003'::uuid
WHERE workspace_id NOT LIKE 'd1000000-%' AND workspace_id IN (
    SELECT id FROM public.workspaces WHERE organization_id = 'a0000000-0000-0000-0000-000000000002'::uuid
);

-- Update workspace IDs
UPDATE public.workspaces SET id = 'd1000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid AND id::text NOT LIKE 'd1000000-%';

UPDATE public.workspaces SET id = 'd1000000-0000-0000-0000-000000000002'::uuid
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND id::text NOT LIKE 'd1000000-%';

UPDATE public.workspaces SET id = 'd1000000-0000-0000-0000-000000000003'::uuid
WHERE organization_id = 'a0000000-0000-0000-0000-000000000002'::uuid AND id::text NOT LIKE 'd1000000-%';

-- =============================================================================
-- STEP 8: Re-enable FK constraints
-- =============================================================================
SET session_replication_role = 'origin';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    user_count INT;
    membership_count INT;
    c_prefix_count INT;
    workspace_count INT;
    d_prefix_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.users;
    SELECT COUNT(*) INTO membership_count FROM public.organization_memberships;
    SELECT COUNT(*) INTO c_prefix_count FROM public.users WHERE id::text LIKE 'c0000000-%';
    SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
    SELECT COUNT(*) INTO d_prefix_count FROM public.workspaces WHERE id::text LIKE 'd1000000-%';

    RAISE NOTICE '=========================================';
    RAISE NOTICE 'FIX_001_ALIGN_USER_IDS Applied Successfully';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Total Users: %', user_count;
    RAISE NOTICE 'Users with c0000000- prefix: %', c_prefix_count;
    RAISE NOTICE 'Total Organization Memberships: %', membership_count;
    RAISE NOTICE 'Total Workspaces: %', workspace_count;
    RAISE NOTICE 'Workspaces with d1000000- prefix: %', d_prefix_count;
    RAISE NOTICE '=========================================';
END $$;

COMMIT;
