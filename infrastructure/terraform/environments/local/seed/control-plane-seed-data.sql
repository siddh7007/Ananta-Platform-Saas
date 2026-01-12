-- =============================================================================
-- CONTROL PLANE SEED DATA
-- =============================================================================
-- Seed data for the arc_saas database (Control Plane)
-- This creates tenants, plans, subscriptions, and users that align with
-- the Keycloak users and App Plane (Supabase) organizations.
--
-- UUID Conventions:
-- - tenant_id uses b0... prefix (Control Plane tenants)
-- - plan_id uses p0... prefix
-- - subscription_id uses s0... prefix
-- - user_id uses c0... prefix (same as Keycloak and Supabase)
-- =============================================================================

-- Use tenant_management schema
SET search_path TO tenant_management, public;

-- =============================================================================
-- PLANS - Subscription plans
-- =============================================================================
INSERT INTO plans (id, name, description, tier, price, currency_code, billing_cycle, features, created_on, modified_on)
VALUES
    -- Basic Plan
    ('p0000000-0000-0000-0000-000000000001'::uuid,
     'Basic',
     'Basic plan for small teams',
     'basic',
     29.00,
     'USD',
     'monthly',
     '{"users": 5, "projects": 10, "storage": "10GB", "support": "email"}'::jsonb,
     NOW(), NOW()),

    -- Standard Plan
    ('p0000000-0000-0000-0000-000000000002'::uuid,
     'Standard',
     'Standard plan for growing teams',
     'standard',
     79.00,
     'USD',
     'monthly',
     '{"users": 25, "projects": 50, "storage": "100GB", "support": "priority", "sso": true}'::jsonb,
     NOW(), NOW()),

    -- Premium Plan
    ('p0000000-0000-0000-0000-000000000003'::uuid,
     'Premium',
     'Premium plan for enterprises',
     'premium',
     199.00,
     'USD',
     'monthly',
     '{"users": -1, "projects": -1, "storage": "1TB", "support": "dedicated", "sso": true, "audit_logs": true, "custom_domain": true}'::jsonb,
     NOW(), NOW()),

    -- Enterprise Plan (custom pricing)
    ('p0000000-0000-0000-0000-000000000004'::uuid,
     'Enterprise',
     'Custom enterprise plan',
     'enterprise',
     0.00,
     'USD',
     'annual',
     '{"users": -1, "projects": -1, "storage": "unlimited", "support": "dedicated", "sso": true, "audit_logs": true, "custom_domain": true, "sla": "99.99%"}'::jsonb,
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier,
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    modified_on = NOW();

-- =============================================================================
-- TENANTS - Organizations (map to Supabase organizations a0...)
-- =============================================================================
-- Note: tenant.id in Control Plane = organization.id in App Plane
-- We use b0... prefix here but they map to a0... orgs in Supabase

INSERT INTO tenants (id, name, key, status, created_on, modified_on)
VALUES
    -- Ananta Platform (internal) - maps to org a0000000-0000-0000-0000-000000000001
    ('b0000000-0000-0000-0000-000000000001'::uuid,
     'Ananta Platform',
     'ananta',
     'active',
     NOW(), NOW()),

    -- CNS Staff (internal) - maps to org a0000000-0000-0000-0000-000000000002
    ('b0000000-0000-0000-0000-000000000002'::uuid,
     'CNS Staff',
     'cnsstaff',
     'active',
     NOW(), NOW()),

    -- Demo Organization - maps to org a0000000-0000-0000-0000-000000000000
    ('b0000000-0000-0000-0000-000000000000'::uuid,
     'Demo Organization',
     'demo',
     'active',
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    modified_on = NOW();

-- =============================================================================
-- SUBSCRIPTIONS - Link tenants to plans
-- =============================================================================
INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, created_on, modified_on)
VALUES
    -- Ananta Platform on Enterprise plan
    ('s0000000-0000-0000-0000-000000000001'::uuid,
     'b0000000-0000-0000-0000-000000000001'::uuid,
     'p0000000-0000-0000-0000-000000000004'::uuid,
     'active',
     NOW(),
     NOW(), NOW()),

    -- CNS Staff on Premium plan
    ('s0000000-0000-0000-0000-000000000002'::uuid,
     'b0000000-0000-0000-0000-000000000002'::uuid,
     'p0000000-0000-0000-0000-000000000003'::uuid,
     'active',
     NOW(),
     NOW(), NOW()),

    -- Demo Organization on Standard plan
    ('s0000000-0000-0000-0000-000000000003'::uuid,
     'b0000000-0000-0000-0000-000000000000'::uuid,
     'p0000000-0000-0000-0000-000000000002'::uuid,
     'active',
     NOW(),
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    modified_on = NOW();

-- =============================================================================
-- USERS - Control plane users (same IDs as Keycloak)
-- =============================================================================
-- These map to Keycloak users c0000000-...

INSERT INTO users (id, first_name, last_name, email, tenant_id, created_on, modified_on)
VALUES
    -- Platform Super Admin (admin@ananta.io)
    ('c0000000-0000-0000-0000-000000000001'::uuid,
     'Platform',
     'Admin',
     'admin@ananta.io',
     'b0000000-0000-0000-0000-000000000001'::uuid,
     NOW(), NOW()),

    -- CNS Staff Admin (cns.admin@ananta.io)
    ('c0000000-0000-0000-0000-000000000002'::uuid,
     'CNS',
     'Admin',
     'cns.admin@ananta.io',
     'b0000000-0000-0000-0000-000000000002'::uuid,
     NOW(), NOW()),

    -- Platform Admin (platform.admin@ananta.io)
    ('c0000000-0000-0000-0000-000000000003'::uuid,
     'Platform',
     'Manager',
     'platform.admin@ananta.io',
     'b0000000-0000-0000-0000-000000000001'::uuid,
     NOW(), NOW()),

    -- Demo Owner (owner@demo.com)
    ('c0000000-0000-0000-0000-000000000004'::uuid,
     'Demo',
     'Owner',
     'owner@demo.com',
     'b0000000-0000-0000-0000-000000000000'::uuid,
     NOW(), NOW()),

    -- Demo Engineer (engineer@demo.com)
    ('c0000000-0000-0000-0000-000000000005'::uuid,
     'Demo',
     'Engineer',
     'engineer@demo.com',
     'b0000000-0000-0000-0000-000000000000'::uuid,
     NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    tenant_id = EXCLUDED.tenant_id,
    modified_on = NOW();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    tenant_count INTEGER;
    plan_count INTEGER;
    sub_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM tenant_management.tenants;
    SELECT COUNT(*) INTO plan_count FROM tenant_management.plans;
    SELECT COUNT(*) INTO sub_count FROM tenant_management.subscriptions;
    SELECT COUNT(*) INTO user_count FROM tenant_management.users;

    RAISE NOTICE 'Control Plane Seed Data Applied:';
    RAISE NOTICE '  - Tenants: %', tenant_count;
    RAISE NOTICE '  - Plans: %', plan_count;
    RAISE NOTICE '  - Subscriptions: %', sub_count;
    RAISE NOTICE '  - Users: %', user_count;
END $$;
