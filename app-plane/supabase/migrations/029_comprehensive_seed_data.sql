-- ============================================================================
-- Comprehensive Seed Data - 15 Tenants with Users and Projects
-- ============================================================================
-- Purpose: Populate database with realistic test data
-- Includes: 15 tenants, super admins, org admins, users, and projects
-- ============================================================================

-- ============================================================================
-- TENANTS (15 Total)
-- ============================================================================

-- Technology Companies (7)
INSERT INTO public.tenants (id, name, slug) VALUES
('11111111-1111-1111-1111-111111111111'::uuid, 'Tesla Motors', 'tesla-motors'),
('22222222-2222-2222-2222-222222222222'::uuid, 'Apple Inc', 'apple-inc'),
('33333333-3333-3333-3333-333333333333'::uuid, 'ACME Corporation', 'acme-corporation'),
('44444444-4444-4444-4444-444444444444'::uuid, 'SpaceX', 'spacex'),
('55555555-5555-5555-5555-555555555555'::uuid, 'Microsoft Azure IoT', 'microsoft-azure-iot'),
('66666666-6666-6666-6666-666666666666'::uuid, 'Google Nest', 'google-nest'),
('77777777-7777-7777-7777-777777777777'::uuid, 'Amazon Robotics', 'amazon-robotics')
ON CONFLICT (id) DO NOTHING;

-- Manufacturing & Industrial (4)
INSERT INTO public.tenants (id, name, slug) VALUES
('88888888-8888-8888-8888-888888888888'::uuid, 'General Electric Aviation', 'ge-aviation'),
('99999999-9999-9999-9999-999999999999'::uuid, 'Siemens Industrial', 'siemens-industrial'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Honeywell Aerospace', 'honeywell-aerospace'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Bosch Engineering', 'bosch-engineering')
ON CONFLICT (id) DO NOTHING;

-- Medical & Defense (3)
INSERT INTO public.tenants (id, name, slug) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'Medtronic Devices', 'medtronic-devices'),
('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Lockheed Martin Defense', 'lockheed-martin-defense'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'Northrop Grumman Systems', 'northrop-grumman-systems')
ON CONFLICT (id) DO NOTHING;

-- Default Organization (already exists from 000_minimal)
-- 'a1111111-1111-1111-1111-111111111111'::uuid, 'Default Organization', 'default-org'

-- ============================================================================
-- SUPER ADMINS (Platform-wide access)
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
-- CNS Admin - Super Admin
('f0000000-0000-0000-0000-000000000001'::uuid, 'cns-admin@components-platform.com', 'CNS Administrator',
 'a1111111-1111-1111-1111-111111111111'::uuid, 'a1111111-1111-1111-1111-111111111111'::uuid, 'super_admin'),

-- Ananta - Super Admin
('f0000000-0000-0000-0000-000000000002'::uuid, 'ananta@components-platform.com', 'Ananta Krishnan',
 'a1111111-1111-1111-1111-111111111111'::uuid, 'a1111111-1111-1111-1111-111111111111'::uuid, 'super_admin')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TESLA - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
-- Admin
('11111111-0000-0000-0001-000000000001'::uuid, 'admin@tesla.com', 'Elon Musk',
 '11111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'org_admin'),
-- Users
('11111111-0000-0000-0001-000000000002'::uuid, 'engineering@tesla.com', 'Tesla Engineer',
 '11111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'user'),
('11111111-0000-0000-0001-000000000003'::uuid, 'procurement@tesla.com', 'Tesla Procurement',
 '11111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- APPLE - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
-- Admin
('22222222-0000-0000-0001-000000000001'::uuid, 'admin@apple.com', 'Tim Cook',
 '22222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'org_admin'),
-- Users
('22222222-0000-0000-0001-000000000002'::uuid, 'hardware@apple.com', 'Apple Hardware Team',
 '22222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'user'),
('22222222-0000-0000-0001-000000000003'::uuid, 'supply-chain@apple.com', 'Apple Supply Chain',
 '22222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ACME - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
-- Admin
('33333333-0000-0000-0001-000000000001'::uuid, 'admin@acme.com', 'Wile E. Coyote',
 '33333333-3333-3333-3333-333333333333'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'org_admin'),
-- Users
('33333333-0000-0000-0001-000000000002'::uuid, 'engineering@acme.com', 'ACME Engineering',
 '33333333-3333-3333-3333-333333333333'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'user'),
('33333333-0000-0000-0001-000000000003'::uuid, 'quality@acme.com', 'ACME Quality Assurance',
 '33333333-3333-3333-3333-333333333333'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SPACEX - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('44444444-0000-0000-0001-000000000001'::uuid, 'admin@spacex.com', 'Gwynne Shotwell',
 '44444444-4444-4444-4444-444444444444'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'org_admin'),
('44444444-0000-0000-0001-000000000002'::uuid, 'starship@spacex.com', 'Starship Team',
 '44444444-4444-4444-4444-444444444444'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'user'),
('44444444-0000-0000-0001-000000000003'::uuid, 'dragon@spacex.com', 'Dragon Team',
 '44444444-4444-4444-4444-444444444444'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MICROSOFT - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('55555555-0000-0000-0001-000000000001'::uuid, 'admin@microsoft.com', 'Satya Nadella',
 '55555555-5555-5555-5555-555555555555'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'org_admin'),
('55555555-0000-0000-0001-000000000002'::uuid, 'iot@microsoft.com', 'Azure IoT Team',
 '55555555-5555-5555-5555-555555555555'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- GOOGLE - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('66666666-0000-0000-0001-000000000001'::uuid, 'admin@google.com', 'Sundar Pichai',
 '66666666-6666-6666-6666-666666666666'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'org_admin'),
('66666666-0000-0000-0001-000000000002'::uuid, 'nest@google.com', 'Nest Hardware Team',
 '66666666-6666-6666-6666-666666666666'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- AMAZON - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('77777777-0000-0000-0001-000000000001'::uuid, 'admin@amazon.com', 'Andy Jassy',
 '77777777-7777-7777-7777-777777777777'::uuid, '77777777-7777-7777-7777-777777777777'::uuid, 'org_admin'),
('77777777-0000-0000-0001-000000000002'::uuid, 'robotics@amazon.com', 'Amazon Robotics Team',
 '77777777-7777-7777-7777-777777777777'::uuid, '77777777-7777-7777-7777-777777777777'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- GE AVIATION - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('88888888-0000-0000-0001-000000000001'::uuid, 'admin@ge.com', 'GE Aviation Admin',
 '88888888-8888-8888-8888-888888888888'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'org_admin'),
('88888888-0000-0000-0001-000000000002'::uuid, 'engines@ge.com', 'GE Engines Team',
 '88888888-8888-8888-8888-888888888888'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SIEMENS - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('99999999-0000-0000-0001-000000000001'::uuid, 'admin@siemens.com', 'Siemens Admin',
 '99999999-9999-9999-9999-999999999999'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'org_admin'),
('99999999-0000-0000-0001-000000000002'::uuid, 'automation@siemens.com', 'Siemens Automation Team',
 '99999999-9999-9999-9999-999999999999'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HONEYWELL - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('aaaaaaaa-0000-0000-0001-000000000001'::uuid, 'admin@honeywell.com', 'Honeywell Admin',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'org_admin'),
('aaaaaaaa-0000-0000-0001-000000000002'::uuid, 'aerospace@honeywell.com', 'Honeywell Aerospace Team',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BOSCH - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('bbbbbbbb-0000-0000-0001-000000000001'::uuid, 'admin@bosch.com', 'Bosch Admin',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'org_admin'),
('bbbbbbbb-0000-0000-0001-000000000002'::uuid, 'engineering@bosch.com', 'Bosch Engineering Team',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MEDTRONIC - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('cccccccc-0000-0000-0001-000000000001'::uuid, 'admin@medtronic.com', 'Medtronic Admin',
 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'org_admin'),
('cccccccc-0000-0000-0001-000000000002'::uuid, 'devices@medtronic.com', 'Medtronic Devices Team',
 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LOCKHEED MARTIN - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('dddddddd-0000-0000-0001-000000000001'::uuid, 'admin@lockheedmartin.com', 'Lockheed Martin Admin',
 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'org_admin'),
('dddddddd-0000-0000-0001-000000000002'::uuid, 'defense@lockheedmartin.com', 'Lockheed Defense Team',
 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- NORTHROP GRUMMAN - Admins & Users
-- ============================================================================

INSERT INTO public.users (id, email, full_name, organization_id, tenant_id, role) VALUES
('eeeeeeee-0000-0000-0001-000000000001'::uuid, 'admin@northropgrumman.com', 'Northrop Grumman Admin',
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'org_admin'),
('eeeeeeee-0000-0000-0001-000000000002'::uuid, 'systems@northropgrumman.com', 'Northrop Systems Team',
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'user')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PROJECTS (2 per tenant)
-- ============================================================================

-- Tesla Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('11111111-0001-0000-0000-000000000001'::uuid, 'Model S Plaid Electronics', 'model-s-plaid', '11111111-1111-1111-1111-111111111111'::uuid),
('11111111-0001-0000-0000-000000000002'::uuid, 'Cybertruck Power Systems', 'cybertruck-power', '11111111-1111-1111-1111-111111111111'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Apple Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('22222222-0001-0000-0000-000000000001'::uuid, 'iPhone 16 Pro Components', 'iphone-16-pro', '22222222-2222-2222-2222-222222222222'::uuid),
('22222222-0001-0000-0000-000000000002'::uuid, 'MacBook Pro M4 BOM', 'macbook-pro-m4', '22222222-2222-2222-2222-222222222222'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ACME Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('33333333-0001-0000-0000-000000000001'::uuid, 'Rocket Powered Roller Skates', 'rocket-skates', '33333333-3333-3333-3333-333333333333'::uuid),
('33333333-0001-0000-0000-000000000002'::uuid, 'Portable Hole Manufacturing', 'portable-hole', '33333333-3333-3333-3333-333333333333'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- SpaceX Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('44444444-0001-0000-0000-000000000001'::uuid, 'Starship Avionics', 'starship-avionics', '44444444-4444-4444-4444-444444444444'::uuid),
('44444444-0001-0000-0000-000000000002'::uuid, 'Raptor Engine Controls', 'raptor-controls', '44444444-4444-4444-4444-444444444444'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Microsoft Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('55555555-0001-0000-0000-000000000001'::uuid, 'Azure IoT Edge Devices', 'azure-iot-edge', '55555555-5555-5555-5555-555555555555'::uuid),
('55555555-0001-0000-0000-000000000002'::uuid, 'Surface Pro Hardware', 'surface-pro', '55555555-5555-5555-5555-555555555555'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Google Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('66666666-0001-0000-0000-000000000001'::uuid, 'Nest Thermostat Gen 4', 'nest-thermostat-4', '66666666-6666-6666-6666-666666666666'::uuid),
('66666666-0001-0000-0000-000000000002'::uuid, 'Pixel 9 Pro Hardware', 'pixel-9-pro', '66666666-6666-6666-6666-666666666666'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Amazon Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('77777777-0001-0000-0000-000000000001'::uuid, 'Warehouse Robotics Platform', 'warehouse-robotics', '77777777-7777-7777-7777-777777777777'::uuid),
('77777777-0001-0000-0000-000000000002'::uuid, 'Alexa Echo Dot 5', 'echo-dot-5', '77777777-7777-7777-7777-777777777777'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- GE Aviation Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('88888888-0001-0000-0000-000000000001'::uuid, 'LEAP Engine Electronics', 'leap-electronics', '88888888-8888-8888-8888-888888888888'::uuid),
('88888888-0001-0000-0000-000000000002'::uuid, 'GE9X Turbine Controls', 'ge9x-controls', '88888888-8888-8888-8888-888888888888'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Siemens Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('99999999-0001-0000-0000-000000000001'::uuid, 'PLC Control Systems', 'plc-controls', '99999999-9999-9999-9999-999999999999'::uuid),
('99999999-0001-0000-0000-000000000002'::uuid, 'SCADA Interface Hardware', 'scada-hardware', '99999999-9999-9999-9999-999999999999'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Honeywell Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('aaaaaaaa-0001-0000-0000-000000000001'::uuid, 'Flight Management Systems', 'flight-management', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
('aaaaaaaa-0001-0000-0000-000000000002'::uuid, 'Avionics Suite Gen 2', 'avionics-suite-2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Bosch Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('bbbbbbbb-0001-0000-0000-000000000001'::uuid, 'Automotive Sensors Platform', 'auto-sensors', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
('bbbbbbbb-0001-0000-0000-000000000002'::uuid, 'Industrial IoT Gateway', 'iiot-gateway', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Medtronic Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('cccccccc-0001-0000-0000-000000000001'::uuid, 'Pacemaker Electronics Rev 3', 'pacemaker-rev3', 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
('cccccccc-0001-0000-0000-000000000002'::uuid, 'Insulin Pump Control Board', 'insulin-pump', 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Lockheed Martin Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('dddddddd-0001-0000-0000-000000000001'::uuid, 'F-35 Avionics Upgrade', 'f35-avionics', 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid),
('dddddddd-0001-0000-0000-000000000002'::uuid, 'Missile Guidance Systems', 'missile-guidance', 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Northrop Grumman Projects
INSERT INTO public.projects (id, name, slug, organization_id) VALUES
('eeeeeeee-0001-0000-0000-000000000001'::uuid, 'B-21 Raider Electronics', 'b21-electronics', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid),
('eeeeeeee-0001-0000-0000-000000000002'::uuid, 'Unmanned Systems Control', 'unmanned-control', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ============================================================================
-- VERIFICATION COUNTS
-- ============================================================================

-- This should show 16 tenants (including Default Organization)
SELECT COUNT(*) as tenant_count FROM public.tenants;

-- This should show 32+ users (2 super admins + 2-3 per tenant)
SELECT COUNT(*) as user_count FROM public.users;

-- This should show 29+ projects (1 default + 2 per new tenant)
SELECT COUNT(*) as project_count FROM public.projects;

-- Show role distribution
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON TABLE public.tenants IS 'Updated with 15 diverse tenants across technology, manufacturing, medical, and defense sectors';
COMMENT ON TABLE public.users IS 'Updated with super admins (CNS Admin, Ananta) and org-specific users with proper roles';
COMMENT ON TABLE public.projects IS 'Updated with 2 projects per tenant for realistic multi-project testing';
