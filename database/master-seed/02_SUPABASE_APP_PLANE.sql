-- =============================================================================
-- MASTER SEED: Supabase App Plane Database
-- =============================================================================
-- Version: 1.0.2
-- Last Updated: 2025-01-09
-- Database: postgres (Supabase - port 27432)
--
-- This is the SINGLE SOURCE OF TRUTH for App Plane seed data.
-- DO NOT create duplicate seed files elsewhere.
--
-- UUID Format: Must be valid UUIDv4 (position 13='4', position 17='8/9/a/b')
-- Using prefix conventions for easier identification:
--   a0xxxxxx = Organizations (maps to Control Plane tenants b0...)
--   c0xxxxxx = Users (same as Keycloak)
--   d1xxxxxx = Workspaces
--   e1xxxxxx = Projects
--   f1xxxxxx = BOMs
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Fix invalid UUIDs to valid UUIDv4 format
-- =============================================================================
-- Invalid: a0000000-0000-0000-0000-... (position 13 is '0', position 17 is '0')
-- Valid:   a0000000-0000-4000-a000-... (position 13 is '4', position 17 is 'a')

-- Temporarily disable FK constraints
SET session_replication_role = 'replica';

-- Fix organization UUIDs
UPDATE public.organizations SET id = 'a0000000-0000-4000-a000-000000000001'::uuid WHERE slug = 'platform-admin' AND id = 'a0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.organizations SET id = 'a0000000-0000-4000-a000-000000000002'::uuid WHERE slug = 'cns-staff' AND id = 'a0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.organizations SET id = 'a0000000-0000-4000-a000-000000000000'::uuid WHERE slug = 'demo-org' AND id = 'a0000000-0000-0000-0000-000000000000'::uuid;

-- Fix user UUIDs
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000001'::uuid WHERE email = 'superadmin@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000002'::uuid WHERE email = 'cns-lead@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000003'::uuid WHERE email = 'cns-engineer@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000003'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000004'::uuid WHERE email = 'demo-owner@example.com' AND id = 'c0000000-0000-0000-0000-000000000004'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000005'::uuid WHERE email = 'demo-engineer@example.com' AND id = 'c0000000-0000-0000-0000-000000000005'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000010'::uuid WHERE email = 'cbpadmin@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000010'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000011'::uuid WHERE email = 'cnsstaff@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000011'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000012'::uuid WHERE email = 'backstage-admin@ananta.dev' AND id = 'c0000000-0000-0000-0000-000000000012'::uuid;
UPDATE public.users SET id = 'c0000000-0000-4000-a000-000000000013'::uuid WHERE email = 'demo-analyst@example.com' AND id = 'c0000000-0000-0000-0000-000000000013'::uuid;

-- Fix organization_memberships FK refs
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000001'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000002'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000003'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000003'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000004'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000004'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000005'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000005'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000010'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000010'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000011'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000011'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000012'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000012'::uuid;
UPDATE public.organization_memberships SET user_id = 'c0000000-0000-4000-a000-000000000013'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000013'::uuid;

UPDATE public.organization_memberships SET organization_id = 'a0000000-0000-4000-a000-000000000001'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.organization_memberships SET organization_id = 'a0000000-0000-4000-a000-000000000002'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.organization_memberships SET organization_id = 'a0000000-0000-4000-a000-000000000000'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid;

-- Fix workspace UUIDs and FK refs
UPDATE public.workspaces SET id = 'd1000000-0000-4000-a000-000000000001'::uuid WHERE id = 'd1000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.workspaces SET id = 'd1000000-0000-4000-a000-000000000002'::uuid WHERE id = 'd1000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.workspaces SET id = 'd1000000-0000-4000-a000-000000000003'::uuid WHERE id = 'd1000000-0000-0000-0000-000000000003'::uuid;

UPDATE public.workspaces SET organization_id = 'a0000000-0000-4000-a000-000000000001'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.workspaces SET organization_id = 'a0000000-0000-4000-a000-000000000002'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.workspaces SET organization_id = 'a0000000-0000-4000-a000-000000000000'::uuid WHERE organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid;

UPDATE public.workspaces SET created_by = 'c0000000-0000-4000-a000-000000000001'::uuid WHERE created_by = 'c0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.workspaces SET created_by = 'c0000000-0000-4000-a000-000000000002'::uuid WHERE created_by = 'c0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.workspaces SET created_by = 'c0000000-0000-4000-a000-000000000004'::uuid WHERE created_by = 'c0000000-0000-0000-0000-000000000004'::uuid;

-- Fix user_preferences FK refs
UPDATE public.user_preferences SET user_id = 'c0000000-0000-4000-a000-000000000001'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.user_preferences SET user_id = 'c0000000-0000-4000-a000-000000000002'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000002'::uuid;
UPDATE public.user_preferences SET user_id = 'c0000000-0000-4000-a000-000000000004'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000004'::uuid;
UPDATE public.user_preferences SET user_id = 'c0000000-0000-4000-a000-000000000010'::uuid WHERE user_id = 'c0000000-0000-0000-0000-000000000010'::uuid;

-- Re-enable FK constraints
SET session_replication_role = 'origin';

-- =============================================================================
-- STEP 2: Upsert organizations
-- =============================================================================

INSERT INTO public.organizations (id, name, slug, subscription_status, plan_tier, description, created_at, updated_at)
VALUES
    ('a0000000-0000-4000-a000-000000000001'::uuid, 'Ananta Platform', 'platform-admin', 'active', 'enterprise', 'Platform administration organization', NOW(), NOW()),
    ('a0000000-0000-4000-a000-000000000002'::uuid, 'CNS Staff', 'cns-staff', 'active', 'enterprise', 'Component Normalization Service staff organization', NOW(), NOW()),
    ('a0000000-0000-4000-a000-000000000000'::uuid, 'Demo Organization', 'demo-org', 'trial', 'standard', 'Demo customer organization for testing', NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subscription_status = EXCLUDED.subscription_status,
    plan_tier = EXCLUDED.plan_tier,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================================================
-- STEP 3: Upsert users
-- =============================================================================

INSERT INTO public.users (id, email, first_name, last_name, role, is_platform_admin, is_active, email_verified, keycloak_user_id, created_at, updated_at)
VALUES
    ('c0000000-0000-4000-a000-000000000001'::uuid, 'superadmin@ananta.dev', 'Platform', 'Admin', 'super_admin', true, true, true, 'c0000000-0000-4000-a000-000000000001', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000002'::uuid, 'cns-lead@ananta.dev', 'CNS', 'Lead', 'admin', false, true, true, 'c0000000-0000-4000-a000-000000000002', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000003'::uuid, 'cns-engineer@ananta.dev', 'CNS', 'Engineer', 'engineer', false, true, true, 'c0000000-0000-4000-a000-000000000003', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000004'::uuid, 'demo-owner@example.com', 'Demo', 'Owner', 'owner', false, true, true, 'c0000000-0000-4000-a000-000000000004', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000005'::uuid, 'demo-engineer@example.com', 'Demo', 'Engineer', 'engineer', false, true, true, 'c0000000-0000-4000-a000-000000000005', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000010'::uuid, 'cbpadmin@ananta.dev', 'CBP', 'Admin', 'super_admin', true, true, true, 'c0000000-0000-4000-a000-000000000010', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000011'::uuid, 'cnsstaff@ananta.dev', 'CNS', 'Staff', 'engineer', false, true, true, 'c0000000-0000-4000-a000-000000000011', NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000012'::uuid, 'backstage-admin@ananta.dev', 'Backstage', 'Admin', 'admin', false, true, true, NULL, NOW(), NOW()),
    ('c0000000-0000-4000-a000-000000000013'::uuid, 'demo-analyst@example.com', 'Demo', 'Analyst', 'analyst', false, true, true, NULL, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    is_platform_admin = EXCLUDED.is_platform_admin,
    keycloak_user_id = EXCLUDED.keycloak_user_id,
    updated_at = NOW();

-- =============================================================================
-- STEP 4: Upsert organization memberships
-- =============================================================================

INSERT INTO public.organization_memberships (user_id, organization_id, role, is_default, joined_at)
VALUES
    -- Platform Admins -> Ananta Platform org
    ('c0000000-0000-4000-a000-000000000001'::uuid, 'a0000000-0000-4000-a000-000000000001'::uuid, 'admin', true, NOW()),
    ('c0000000-0000-4000-a000-000000000010'::uuid, 'a0000000-0000-4000-a000-000000000001'::uuid, 'admin', true, NOW()),
    ('c0000000-0000-4000-a000-000000000012'::uuid, 'a0000000-0000-4000-a000-000000000001'::uuid, 'admin', true, NOW()),
    -- CNS Staff -> CNS Staff org (some also belong to platform)
    ('c0000000-0000-4000-a000-000000000002'::uuid, 'a0000000-0000-4000-a000-000000000001'::uuid, 'admin', false, NOW()),
    ('c0000000-0000-4000-a000-000000000002'::uuid, 'a0000000-0000-4000-a000-000000000002'::uuid, 'admin', true, NOW()),
    ('c0000000-0000-4000-a000-000000000003'::uuid, 'a0000000-0000-4000-a000-000000000002'::uuid, 'engineer', true, NOW()),
    ('c0000000-0000-4000-a000-000000000011'::uuid, 'a0000000-0000-4000-a000-000000000002'::uuid, 'engineer', true, NOW()),
    -- Demo users -> Demo org
    ('c0000000-0000-4000-a000-000000000004'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'owner', true, NOW()),
    ('c0000000-0000-4000-a000-000000000005'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'engineer', true, NOW()),
    ('c0000000-0000-4000-a000-000000000013'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'analyst', true, NOW())
ON CONFLICT (user_id, organization_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_default = EXCLUDED.is_default;

-- =============================================================================
-- STEP 5: Upsert workspaces
-- =============================================================================

INSERT INTO public.workspaces (id, organization_id, name, slug, description, visibility, created_by, created_at, updated_at)
VALUES
    -- Demo org default workspace (ID 001 - note: existing data has demo-org with this ID)
    ('d1000000-0000-4000-a000-000000000001'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'Default Workspace', 'default', 'Default workspace for Demo organization', 'team', 'c0000000-0000-4000-a000-000000000004'::uuid, NOW(), NOW()),
    -- Platform admin default workspace (ID 002)
    ('d1000000-0000-4000-a000-000000000002'::uuid, 'a0000000-0000-4000-a000-000000000001'::uuid, 'Default Workspace', 'default', 'Default workspace for Ananta Platform organization', 'team', 'c0000000-0000-4000-a000-000000000001'::uuid, NOW(), NOW()),
    -- CNS Staff default workspace (ID 003)
    ('d1000000-0000-4000-a000-000000000003'::uuid, 'a0000000-0000-4000-a000-000000000002'::uuid, 'Default Workspace', 'default', 'Default workspace for CNS Staff organization', 'team', 'c0000000-0000-4000-a000-000000000002'::uuid, NOW(), NOW()),
    -- Demo org engineering workspace (ID 004)
    ('d1000000-0000-4000-a000-000000000004'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'Engineering', 'engineering', 'Engineering workspace for hardware projects', 'team', 'c0000000-0000-4000-a000-000000000004'::uuid, NOW(), NOW())
ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================================================
-- STEP 6: Upsert projects (if table exists)
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        INSERT INTO public.projects (id, workspace_id, name, slug, description, status, created_by, created_at, updated_at)
        VALUES
            ('e1000000-0000-4000-a000-000000000001'::uuid, 'd1000000-0000-4000-a000-000000000001'::uuid, 'Smart Thermostat', 'smart-thermostat', 'IoT thermostat project for demo', 'active', 'c0000000-0000-4000-a000-000000000004'::uuid, NOW(), NOW()),
            ('e1000000-0000-4000-a000-000000000002'::uuid, 'd1000000-0000-4000-a000-000000000004'::uuid, 'Power Supply Board', 'power-supply', 'Multi-output power supply design', 'active', 'c0000000-0000-4000-a000-000000000005'::uuid, NOW(), NOW()),
            ('e1000000-0000-4000-a000-000000000003'::uuid, 'd1000000-0000-4000-a000-000000000003'::uuid, 'CNS Test Project', 'cns-test', 'Project for testing CNS enrichment', 'active', 'c0000000-0000-4000-a000-000000000002'::uuid, NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- STEP 7: Upsert BOMs (if table exists)
-- =============================================================================
-- boms table schema: id, organization_id, project_id, name, version, description, status, ...

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boms') THEN
        INSERT INTO public.boms (id, organization_id, project_id, name, version, description, status, created_at, updated_at)
        VALUES
            -- Smart Thermostat BOM (Demo org workspace)
            ('f1000000-0000-4000-a000-000000000001'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'e1000000-0000-4000-a000-000000000001'::uuid, 'Smart Thermostat v1', '1.0.0', 'Bill of materials for smart thermostat prototype', 'draft', NOW(), NOW()),
            -- Power Supply BOM (Demo org engineering workspace)
            ('f1000000-0000-4000-a000-000000000002'::uuid, 'a0000000-0000-4000-a000-000000000000'::uuid, 'e1000000-0000-4000-a000-000000000002'::uuid, 'PSU Main Board', '2.0.0', 'Power supply unit main PCB', 'draft', NOW(), NOW()),
            -- CNS Test BOM (CNS Staff workspace)
            ('f1000000-0000-4000-a000-000000000003'::uuid, 'a0000000-0000-4000-a000-000000000002'::uuid, 'e1000000-0000-4000-a000-000000000003'::uuid, 'CNS Enrichment Test BOM', '1.0.0', 'BOM with various components for enrichment testing', 'draft', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- STEP 8: Upsert BOM line items (if table exists)
-- =============================================================================
-- bom_line_items schema: id, bom_id, line_number, manufacturer_part_number, manufacturer, description, quantity, ...

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bom_line_items') THEN
        INSERT INTO public.bom_line_items (id, bom_id, line_number, manufacturer_part_number, manufacturer, description, quantity, enrichment_status, created_at, updated_at)
        VALUES
            ('11110000-0000-4000-a000-000000000001'::uuid, 'f1000000-0000-4000-a000-000000000001'::uuid, 1, 'STM32F401RET6', 'STMicroelectronics', 'ARM Cortex-M4 MCU, 512KB Flash, 96KB RAM', 1, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000002'::uuid, 'f1000000-0000-4000-a000-000000000001'::uuid, 2, 'SHT31-DIS-B', 'Sensirion', 'Digital humidity and temperature sensor', 1, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000003'::uuid, 'f1000000-0000-4000-a000-000000000001'::uuid, 3, 'GRM155R71H104KE14D', 'Murata', '0.1uF 50V X7R 0402 MLCC', 10, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000004'::uuid, 'f1000000-0000-4000-a000-000000000002'::uuid, 1, 'LM2596S-5.0', 'Texas Instruments', '5V 3A Step-Down Voltage Regulator', 1, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000005'::uuid, 'f1000000-0000-4000-a000-000000000002'::uuid, 2, 'B360A-13-F', 'Diodes Incorporated', '60V 3A Schottky Barrier Rectifier', 1, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000006'::uuid, 'f1000000-0000-4000-a000-000000000003'::uuid, 1, 'TPS62840', 'Texas Instruments', 'Ultra-low power DC-DC converter', 1, 'pending', NOW(), NOW()),
            ('11110000-0000-4000-a000-000000000007'::uuid, 'f1000000-0000-4000-a000-000000000003'::uuid, 2, 'ESP32-WROOM-32E', 'Espressif Systems', 'WiFi + Bluetooth MCU Module', 1, 'pending', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- STEP 9: Upsert user preferences
-- =============================================================================

INSERT INTO public.user_preferences (user_id, theme, notifications_enabled, email_notifications, language, timezone)
VALUES
    ('c0000000-0000-4000-a000-000000000001'::uuid, 'system', true, true, 'en', 'UTC'),
    ('c0000000-0000-4000-a000-000000000002'::uuid, 'system', true, true, 'en', 'UTC'),
    ('c0000000-0000-4000-a000-000000000004'::uuid, 'light', true, true, 'en', 'America/New_York'),
    ('c0000000-0000-4000-a000-000000000010'::uuid, 'dark', true, true, 'en', 'UTC')
ON CONFLICT (user_id) DO UPDATE SET
    theme = EXCLUDED.theme,
    timezone = EXCLUDED.timezone;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    org_count INTEGER;
    user_count INTEGER;
    membership_count INTEGER;
    workspace_count INTEGER;
    project_count INTEGER := 0;
    bom_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO org_count FROM public.organizations;
    SELECT COUNT(*) INTO user_count FROM public.users;
    SELECT COUNT(*) INTO membership_count FROM public.organization_memberships;
    SELECT COUNT(*) INTO workspace_count FROM public.workspaces;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        SELECT COUNT(*) INTO project_count FROM public.projects;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boms') THEN
        SELECT COUNT(*) INTO bom_count FROM public.boms;
    END IF;

    RAISE NOTICE '=== Supabase App Plane Seed Data Applied ===';
    RAISE NOTICE '  Organizations: %', org_count;
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Memberships: %', membership_count;
    RAISE NOTICE '  Workspaces: %', workspace_count;
    RAISE NOTICE '  Projects: %', project_count;
    RAISE NOTICE '  BOMs: %', bom_count;
    RAISE NOTICE '=============================================';
END $$;

COMMIT;
