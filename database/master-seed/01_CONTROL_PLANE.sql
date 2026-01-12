-- =============================================================================
-- MASTER SEED: Control Plane Database (ananta / arc_saas)
-- =============================================================================
-- Version: 1.0.2
-- Last Updated: 2025-01-09
-- Database: ananta (PostgreSQL)
-- Port: 5432 (Docker) / varies (Kubernetes)
--
-- PREREQUISITE: Run arc-saas/docker/init-db/01-init-schemas.sql first
-- to create schemas and tables.
--
-- This is the SINGLE SOURCE OF TRUTH for Control Plane seed data.
-- DO NOT create duplicate seed files elsewhere.
--
-- UUID Format: Must be valid UUIDv4 (8-4-4-4-12 hex chars)
-- Using prefix conventions for easier identification:
--   b0xxxxxx = Tenants (Control Plane)
--   50xxxxxx = Subscriptions
--   c0xxxxxx = Users (in tenant schemas)
--   00xxxxxx = Contacts
-- =============================================================================

BEGIN;

-- =============================================================================
-- TENANTS - Organizations in Control Plane
-- =============================================================================
-- Status enum values: pending, provisioning, active, suspended, deprovisioning, deprovisioned, failed
-- Key constraint: must match ^[a-z][a-z0-9_-]{2,49}$

INSERT INTO tenant_management.tenants (id, name, key, status, tier, owner_email, owner_name, plan_id, created_at, updated_at)
VALUES
    -- Ananta Platform (internal platform team)
    ('b0000000-0000-4000-a000-000000000001'::uuid,
     'Ananta Platform',
     'ananta-platform',
     'active',
     'enterprise',
     'superadmin@ananta.dev',
     'Platform Admin',
     (SELECT id FROM subscription.plans WHERE code = 'enterprise'),
     NOW(), NOW()),

    -- CNS Staff (component normalization team)
    ('b0000000-0000-4000-a000-000000000002'::uuid,
     'CNS Staff',
     'cns-staff',
     'active',
     'professional',
     'cns-lead@ananta.dev',
     'CNS Lead',
     (SELECT id FROM subscription.plans WHERE code = 'professional'),
     NOW(), NOW()),

    -- Demo Organization (for testing/demos)
    ('b0000000-0000-4000-a000-000000000000'::uuid,
     'Demo Organization',
     'demo-org',
     'active',
     'starter',
     'demo-owner@example.com',
     'Demo Owner',
     (SELECT id FROM subscription.plans WHERE code = 'starter'),
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    tier = EXCLUDED.tier,
    owner_email = EXCLUDED.owner_email,
    owner_name = EXCLUDED.owner_name,
    plan_id = EXCLUDED.plan_id,
    updated_at = NOW();

-- =============================================================================
-- SUBSCRIPTIONS - Link tenants to plans
-- =============================================================================
-- Status enum: trialing, active, past_due, canceled, expired
-- Billing interval: monthly, yearly, one_time

INSERT INTO subscription.subscriptions (id, tenant_id, plan_id, status, billing_interval, start_date, created_at, updated_at)
VALUES
    -- Ananta Platform on Enterprise plan
    ('50000000-0000-4000-a000-000000000001'::uuid,
     'b0000000-0000-4000-a000-000000000001'::uuid,
     (SELECT id FROM subscription.plans WHERE code = 'enterprise'),
     'active',
     'yearly',
     NOW(),
     NOW(), NOW()),

    -- CNS Staff on Professional plan
    ('50000000-0000-4000-a000-000000000002'::uuid,
     'b0000000-0000-4000-a000-000000000002'::uuid,
     (SELECT id FROM subscription.plans WHERE code = 'professional'),
     'active',
     'monthly',
     NOW(),
     NOW(), NOW()),

    -- Demo Organization on Starter plan
    ('50000000-0000-4000-a000-000000000003'::uuid,
     'b0000000-0000-4000-a000-000000000000'::uuid,
     (SELECT id FROM subscription.plans WHERE code = 'starter'),
     'active',
     'monthly',
     NOW(),
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW();

-- =============================================================================
-- CONTACTS - Tenant contacts
-- =============================================================================

INSERT INTO tenant_management.contacts (id, tenant_id, first_name, last_name, email, is_primary, created_at, updated_at)
VALUES
    -- Ananta Platform primary contact
    ('00000000-0000-4000-a000-000000000101'::uuid,
     'b0000000-0000-4000-a000-000000000001'::uuid,
     'Platform', 'Admin', 'superadmin@ananta.dev', true, NOW(), NOW()),

    -- CNS Staff primary contact
    ('00000000-0000-4000-a000-000000000102'::uuid,
     'b0000000-0000-4000-a000-000000000002'::uuid,
     'CNS', 'Lead', 'cns-lead@ananta.dev', true, NOW(), NOW()),

    -- Demo Organization primary contact
    ('00000000-0000-4000-a000-000000000103'::uuid,
     'b0000000-0000-4000-a000-000000000000'::uuid,
     'Demo', 'Owner', 'demo-owner@example.com', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = NOW();

-- =============================================================================
-- CREATE TENANT SCHEMAS - For each tenant, create their isolated schema
-- =============================================================================

-- Create tenant schemas (using the function from init-schemas.sql)
SELECT tenant_management.create_tenant_schema('ananta-platform');
SELECT tenant_management.create_tenant_schema('cns-staff');
SELECT tenant_management.create_tenant_schema('demo-org');

-- =============================================================================
-- TENANT USERS - Users within each tenant schema
-- =============================================================================
-- Note: User IDs use c0... prefix, same as Keycloak

-- Ananta Platform users
INSERT INTO "tenant_ananta-platform".users (id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
VALUES
    -- Platform Super Admin
    ('c0000000-0000-4000-a000-000000000001'::uuid,
     'superadmin@ananta.dev', 'Platform', 'Admin', 'admin', true, true, NOW(), NOW()),
    -- CBP Admin
    ('c0000000-0000-4000-a000-000000000010'::uuid,
     'cbpadmin@ananta.dev', 'CBP', 'Admin', 'admin', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- CNS Staff users
INSERT INTO "tenant_cns-staff".users (id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
VALUES
    -- CNS Lead
    ('c0000000-0000-4000-a000-000000000002'::uuid,
     'cns-lead@ananta.dev', 'CNS', 'Lead', 'admin', true, true, NOW(), NOW()),
    -- CNS Engineer
    ('c0000000-0000-4000-a000-000000000003'::uuid,
     'cns-engineer@ananta.dev', 'CNS', 'Engineer', 'user', true, true, NOW(), NOW()),
    -- CNS Staff
    ('c0000000-0000-4000-a000-000000000011'::uuid,
     'cnsstaff@ananta.dev', 'CNS', 'Staff', 'user', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Demo Organization users
INSERT INTO "tenant_demo-org".users (id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
VALUES
    -- Demo Owner
    ('c0000000-0000-4000-a000-000000000004'::uuid,
     'demo-owner@example.com', 'Demo', 'Owner', 'admin', true, true, NOW(), NOW()),
    -- Demo Engineer
    ('c0000000-0000-4000-a000-000000000005'::uuid,
     'demo-engineer@example.com', 'Demo', 'Engineer', 'user', true, true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- =============================================================================
-- PLATFORM CONFIG - Default configuration
-- =============================================================================

INSERT INTO main.platform_config (key, value, description)
VALUES
    ('platform_name', '"Ananta Platform"'::jsonb, 'Platform display name'),
    ('default_tier', '"starter"'::jsonb, 'Default subscription tier for new tenants'),
    ('max_users_per_tenant', '100'::jsonb, 'Maximum users per tenant'),
    ('enable_self_service', 'true'::jsonb, 'Enable self-service tenant registration'),
    ('support_email', '"support@ananta.dev"'::jsonb, 'Platform support email')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================================================
-- FEATURE FLAGS - Platform-wide feature toggles
-- =============================================================================

INSERT INTO main.feature_flags (name, enabled, description, metadata)
VALUES
    ('dark_mode', true, 'Enable dark mode UI', '{"default": false}'::jsonb),
    ('multi_factor_auth', true, 'Enable MFA option', '{}'::jsonb),
    ('api_v2', false, 'Enable API v2 endpoints', '{"beta": true}'::jsonb),
    ('advanced_analytics', true, 'Enable advanced analytics dashboard', '{}'::jsonb),
    ('component_enrichment', true, 'Enable component enrichment service', '{"api_version": "v1"}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    tenant_count INTEGER;
    contact_count INTEGER;
    subscription_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM tenant_management.tenants;
    SELECT COUNT(*) INTO contact_count FROM tenant_management.contacts;
    SELECT COUNT(*) INTO subscription_count FROM subscription.subscriptions;

    RAISE NOTICE '=== Control Plane Seed Data Applied ===';
    RAISE NOTICE '  Tenants: %', tenant_count;
    RAISE NOTICE '  Contacts: %', contact_count;
    RAISE NOTICE '  Subscriptions: %', subscription_count;
    RAISE NOTICE '=======================================';
END $$;

COMMIT;
