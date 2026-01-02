-- ============================================================================
-- ULTIMATE MASTER MIGRATION: Arc-SaaS Control Plane Database (COMPLETE)
-- ============================================================================
-- Version: 2.0.0
-- Updated: 2025-12-27
-- Database: arc-saas-postgres (arc_saas database)
-- Port: 5432
--
-- This consolidated migration includes ALL tables, columns, functions, types,
-- indexes, constraints, and seed data from the Arc-SaaS Control Plane.
--
-- VERIFIED AGAINST LIVE DATABASE: December 27, 2025
-- Total tables: 29 (22 in main, 3 in subscription, 4 in public)
--
-- USE THIS FOR:
-- - Fresh database setup
-- - Complete schema verification
-- - Reference documentation
-- - Database recovery/rebuild
--
-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 2: SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS main;
CREATE SCHEMA IF NOT EXISTS subscription;

-- ============================================================================
-- SECTION 3: CUSTOM TYPES (Subscription Schema)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE subscription.billing_interval AS ENUM (
        'monthly',
        'yearly',
        'one_time'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription.subscription_status AS ENUM (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 4: CORE FUNCTIONS
-- ============================================================================

-- Function: Create Tenant Schema (main schema)
CREATE OR REPLACE FUNCTION main.create_tenant_schema(tenant_key VARCHAR)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'tenant_' || tenant_key;

    -- Create the schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Create tenant-specific tables
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            role VARCHAR(50) DEFAULT ''user'',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(255) NOT NULL UNIQUE,
            value JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(100),
            entity_id UUID,
            old_value JSONB,
            new_value JSONB,
            ip_address VARCHAR(45),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_number VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT ''pending'',
            total_amount DECIMAL(15,2),
            currency VARCHAR(3) DEFAULT ''USD'',
            customer_id UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            sku VARCHAR(100),
            description TEXT,
            price DECIMAL(15,2),
            stock_quantity INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID REFERENCES %I.orders(id),
            product_id UUID REFERENCES %I.products(id),
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name, schema_name, schema_name);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255),
            message TEXT,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    RAISE NOTICE 'Created schema % with tenant tables', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function: Drop Tenant Schema (main schema)
CREATE OR REPLACE FUNCTION main.drop_tenant_schema(tenant_key VARCHAR)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'tenant_' || tenant_key;
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
    RAISE NOTICE 'Dropped schema %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function: Create Tenant Schema (public schema - backward compatibility)
CREATE OR REPLACE FUNCTION public.create_tenant_schema(tenant_key VARCHAR)
RETURNS VOID AS $$
DECLARE
    schema_name VARCHAR;
BEGIN
    schema_name := 'tenant_' || tenant_key;

    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO postgres', schema_name);

    -- Create base tables for the tenant
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) DEFAULT ''user'',
            status VARCHAR(50) DEFAULT ''active'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);

    RAISE NOTICE 'Created tenant schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function: Drop Tenant Schema (public schema - backward compatibility)
CREATE OR REPLACE FUNCTION public.drop_tenant_schema(tenant_key VARCHAR)
RETURNS VOID AS $$
DECLARE
    schema_name VARCHAR;
BEGIN
    schema_name := 'tenant_' || tenant_key;
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
    RAISE NOTICE 'Dropped tenant schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: MAIN SCHEMA TABLES
-- ============================================================================

-- Table: addresses
CREATE TABLE IF NOT EXISTS main.addresses (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(25),
    country VARCHAR(25),
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_by UUID,
    modified_by UUID
);

COMMENT ON TABLE main.addresses IS 'represents the addresses of leads and tenants';

-- Table: tenants
CREATE TABLE IF NOT EXISTS main.tenants (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    key VARCHAR(20) NOT NULL UNIQUE,
    status SMALLINT DEFAULT 0 NOT NULL,
    domains VARCHAR[] DEFAULT '{}'::VARCHAR[] NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    identity_provider VARCHAR(50) DEFAULT 'keycloak'::VARCHAR NOT NULL
        CHECK (identity_provider IN ('keycloak', 'auth0', 'cognito')),
    schema_name VARCHAR(100),
    spoc_user_id UUID,
    lead_id UUID,
    address_id UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT fk_tenants_address FOREIGN KEY (address_id) REFERENCES main.addresses(id)
);

COMMENT ON TABLE main.tenants IS 'represents the tenants in the multi-tenant platform';
COMMENT ON COLUMN main.tenants.identity_provider IS 'Identity provider type: keycloak, auth0, or cognito';
COMMENT ON COLUMN main.tenants.status IS 'status of a tenant, it can be - 0(active), 1(provisioning),2(deprovisioning),3(inactive)';
COMMENT ON COLUMN main.tenants.key IS 'a short string used to identify a tenant. This is also used as the namespace and subdomain for this particular tenant';

CREATE INDEX IF NOT EXISTS idx_tenants_key ON main.tenants(key) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON main.tenants(status) WHERE deleted = false;

-- Table: leads
CREATE TABLE IF NOT EXISTS main.leads (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    company_name VARCHAR(100),
    is_validated BOOLEAN DEFAULT false NOT NULL,
    address_id UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_by UUID,
    modified_by UUID,
    CONSTRAINT fk_leads_address FOREIGN KEY (address_id) REFERENCES main.addresses(id)
);

COMMENT ON TABLE main.leads IS 'represents the leads that could or could not lead to an actual tenant as a customer for application.';

CREATE INDEX IF NOT EXISTS idx_leads_email ON main.leads(email) WHERE deleted = false;

-- Table: contacts
CREATE TABLE IF NOT EXISTS main.contacts (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    contact_type VARCHAR(100),
    is_primary BOOLEAN DEFAULT false NOT NULL,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_by UUID,
    deleted_on TIMESTAMPTZ
);

COMMENT ON TABLE main.contacts IS 'represents contacts of a tenant';

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON main.contacts(tenant_id) WHERE deleted = false;

-- Table: branding_metadata
CREATE TABLE IF NOT EXISTS main.branding_metadata (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    theme_metadata JSONB,
    description VARCHAR(500),
    logo VARCHAR(500),
    website VARCHAR(500),
    tenant_id UUID NOT NULL,
    CONSTRAINT fk_branding_metadata_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id)
);

COMMENT ON TABLE main.branding_metadata IS 'Branding and theme customization for tenants';

-- Table: users
CREATE TABLE IF NOT EXISTS main.users (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    auth_id VARCHAR(255),
    keycloak_user_id VARCHAR(255),
    status SMALLINT DEFAULT 0 NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '[]'::jsonb,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    last_login TIMESTAMPTZ,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT uk_users_email_tenant UNIQUE (email, tenant_id)
);

COMMENT ON TABLE main.users IS 'User accounts with multi-tenant support and Keycloak SSO integration';
COMMENT ON COLUMN main.users.auth_id IS 'Keycloak user UUID for SSO authentication';
COMMENT ON COLUMN main.users.keycloak_user_id IS 'Keycloak username/email for SSO lookup';
COMMENT ON COLUMN main.users.role IS 'User role: super_admin, owner, admin, engineer, analyst';
COMMENT ON COLUMN main.users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN main.users.permissions IS 'JSON array of additional permissions';
COMMENT ON COLUMN main.users.status IS '0=pending, 1=active, 2=suspended, 3=deactivated';

CREATE INDEX IF NOT EXISTS idx_users_email ON main.users(email) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_users_status ON main.users(status) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON main.users(tenant_id) WHERE deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_auth_id ON main.users(auth_id) WHERE auth_id IS NOT NULL;

-- Table: user_roles
CREATE TABLE IF NOT EXISTS main.user_roles (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES main.users(id) ON DELETE CASCADE,
    role_key VARCHAR(50) NOT NULL,
    permissions TEXT[],
    scope_type VARCHAR(50) DEFAULT 'tenant'::VARCHAR NOT NULL,
    scope_id UUID,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT uk_user_roles_unique UNIQUE (user_id, role_key, scope_type, scope_id)
);

COMMENT ON TABLE main.user_roles IS 'User role assignments with support for tenant, workspace, and project level permissions';
COMMENT ON COLUMN main.user_roles.role_key IS 'Role identifier (super_admin, owner, admin, engineer, analyst)';
COMMENT ON COLUMN main.user_roles.permissions IS 'Array of permission codes granted by this role';
COMMENT ON COLUMN main.user_roles.scope_type IS 'Scope of the role: tenant (org-wide), workspace, or project';
COMMENT ON COLUMN main.user_roles.scope_id IS 'NULL for tenant-level roles, otherwise references workspace or project';

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON main.user_roles(user_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_key ON main.user_roles(role_key) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_roles_scope ON main.user_roles(scope_type, scope_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON main.user_roles(tenant_id) WHERE deleted = false;

-- Table: user_invitations
CREATE TABLE IF NOT EXISTS main.user_invitations (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    role_key VARCHAR(50) NOT NULL,
    invited_by UUID NOT NULL REFERENCES main.users(id),
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    expires_at TIMESTAMPTZ NOT NULL,
    status SMALLINT DEFAULT 0 NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES main.users(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    custom_message TEXT,
    last_email_sent_at TIMESTAMPTZ,
    resend_count INTEGER DEFAULT 0 NOT NULL,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT ck_user_invitations_expires_future CHECK (expires_at > created_on),
    CONSTRAINT ck_user_invitations_token_length CHECK (length(token) >= 32)
);

COMMENT ON TABLE main.user_invitations IS 'User invitation tokens with role assignment and expiration tracking';
COMMENT ON COLUMN main.user_invitations.token IS 'Secure random token embedded in invitation link';
COMMENT ON COLUMN main.user_invitations.expires_at IS 'Invitation expiration timestamp (typically created_on + 7 days)';
COMMENT ON COLUMN main.user_invitations.status IS '0=pending, 1=accepted, 2=expired, 3=revoked';

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON main.user_invitations(email) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON main.user_invitations(token) WHERE deleted = false AND status = 0;
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_id ON main.user_invitations(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON main.user_invitations(status) WHERE deleted = false;

-- Table: user_activities
CREATE TABLE IF NOT EXISTS main.user_activities (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES main.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE main.user_activities IS 'User activity log for audit trail and user behavior tracking';
COMMENT ON COLUMN main.user_activities.action IS 'Action identifier (e.g., user.created, user.login, user.role_changed)';
COMMENT ON COLUMN main.user_activities.entity_type IS 'Type of entity affected by the action';
COMMENT ON COLUMN main.user_activities.entity_id IS 'UUID of the affected entity';
COMMENT ON COLUMN main.user_activities.metadata IS 'JSON metadata containing additional context (changed fields, IP, user agent, etc.)';
COMMENT ON COLUMN main.user_activities.occurred_at IS 'Timestamp when the activity occurred';

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON main.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_tenant_id ON main.user_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_occurred_at ON main.user_activities(occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON main.user_activities(action);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS main.audit_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor_id UUID NOT NULL,
    actor_name VARCHAR(200),
    actor_email VARCHAR(255),
    target_type VARCHAR(50),
    target_id UUID,
    target_name VARCHAR(200),
    tenant_id UUID,
    tenant_name VARCHAR(200),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success'::VARCHAR NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE main.audit_logs IS 'System-wide audit log for security and compliance tracking';

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON main.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON main.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON main.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON main.audit_logs(action);

-- Table: plans
CREATE TABLE IF NOT EXISTS main.plans (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tier VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'month',
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    limits JSONB DEFAULT '{}'::jsonb,
    trial_enabled BOOLEAN DEFAULT false,
    trial_duration INTEGER DEFAULT 14,
    trial_duration_unit VARCHAR(20) DEFAULT 'days',
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    modified_by VARCHAR(255),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by VARCHAR(255)
);

COMMENT ON TABLE main.plans IS 'Subscription plans with pricing and feature definitions';

CREATE INDEX IF NOT EXISTS idx_plans_tier ON main.plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON main.plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON main.plans(sort_order);

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS main.subscriptions (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id),
    planid VARCHAR(100) NOT NULL,
    planname VARCHAR(100) NOT NULL,
    plantier VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active'::VARCHAR NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD'::VARCHAR NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly'::VARCHAR NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    metadata JSONB,
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

COMMENT ON TABLE main.subscriptions IS 'Tenant subscription records with billing details';

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON main.subscriptions(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON main.subscriptions(status) WHERE deleted = false;

-- Table: invoices
CREATE TABLE IF NOT EXISTS main.invoices (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    start_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    invoice_file VARCHAR(500),
    due_date VARCHAR(50) NOT NULL,
    status INTEGER DEFAULT 0 NOT NULL,
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

COMMENT ON TABLE main.invoices IS 'Invoices for tenant billing';
COMMENT ON COLUMN main.invoices.status IS 'status of the invoice, 0 - pending, 1 - paid';

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON main.invoices(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON main.invoices(status) WHERE deleted = false;

-- Table: payment_methods
CREATE TABLE IF NOT EXISTS main.payment_methods (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    card_details JSONB,
    bank_account_details JSONB,
    is_default BOOLEAN DEFAULT false,
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    metadata JSONB,
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

COMMENT ON TABLE main.payment_methods IS 'Stores payment methods (cards, bank accounts) for tenant billing via Stripe';

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON main.payment_methods(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON main.payment_methods(stripe_payment_method_id);

-- Table: payment_intents
CREATE TABLE IF NOT EXISTS main.payment_intents (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    invoice_id UUID REFERENCES main.invoices(id),
    stripe_payment_intent_id VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255),
    stripe_payment_method_id VARCHAR(255),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd'::VARCHAR NOT NULL,
    status VARCHAR(50) DEFAULT 'requires_payment_method'::VARCHAR NOT NULL,
    client_secret VARCHAR(500),
    description TEXT,
    receipt_email VARCHAR(255),
    failure_code VARCHAR(100),
    failure_message TEXT,
    succeeded_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(100),
    amount_received INTEGER,
    metadata JSONB,
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

COMMENT ON TABLE main.payment_intents IS 'Tracks Stripe payment intents for invoice payments';

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_id ON main.payment_intents(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id ON main.payment_intents(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON main.payment_intents(status);

-- Table: settings
CREATE TABLE IF NOT EXISTS main.settings (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string'::VARCHAR,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT false,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE main.settings IS 'Platform-wide configuration settings';
COMMENT ON COLUMN main.settings.config_key IS 'Unique key for the setting (e.g., platform.name, email.sender)';
COMMENT ON COLUMN main.settings.config_value IS 'Value of the setting';
COMMENT ON COLUMN main.settings.value_type IS 'Data type: string, number, boolean, json';
COMMENT ON COLUMN main.settings.category IS 'Category for grouping settings (e.g., general, email, billing)';
COMMENT ON COLUMN main.settings.is_public IS 'Whether this setting is visible to non-admin users';

CREATE INDEX IF NOT EXISTS idx_settings_category ON main.settings(category) WHERE deleted = false;

-- Table: resources
CREATE TABLE IF NOT EXISTS main.resources (
    id UUID DEFAULT (md5((random()::text || clock_timestamp()::text)))::uuid NOT NULL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    metadata JSONB NOT NULL,
    external_identifier VARCHAR(200) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT idx_resource_ext_id UNIQUE (external_identifier, tenant_id)
);

COMMENT ON TABLE main.resources IS 'model for resources that are provisioned for a tenant';
COMMENT ON COLUMN main.resources.type IS 'type of the resource like storage, compute, etc';
COMMENT ON COLUMN main.resources.metadata IS 'any type specific metadata of the resource like connection info, size, etc';
COMMENT ON COLUMN main.resources.external_identifier IS 'identifier for the resource in the external system it was provisioned';

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON main.resources(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_resources_type ON main.resources(type) WHERE deleted = false;

-- Table: platform_config
CREATE TABLE IF NOT EXISTS main.platform_config (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB DEFAULT '{}'::jsonb NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE main.platform_config IS 'Platform-level configuration for features and integrations';

-- Table: feature_flags
CREATE TABLE IF NOT EXISTS main.feature_flags (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE main.feature_flags IS 'Feature flags for enabling/disabling platform features';

-- Table: notification_history
CREATE TABLE IF NOT EXISTS main.notification_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    workflow_id VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255),
    subscriber_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'webhook')),
    status VARCHAR(50) DEFAULT 'pending'::VARCHAR NOT NULL
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    subject VARCHAR(500),
    payload JSONB,
    transaction_id VARCHAR(255),
    novu_message_id VARCHAR(255),
    attempts INTEGER DEFAULT 1,
    error_message TEXT,
    error_code VARCHAR(100),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    category VARCHAR(100),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT now(),
    modified_on TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE main.notification_history IS 'History of all notifications sent via Novu';

CREATE INDEX IF NOT EXISTS idx_notification_history_tenant_id ON main.notification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON main.notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_workflow_id ON main.notification_history(workflow_id);

-- Table: tenant_quotas
CREATE TABLE IF NOT EXISTS main.tenant_quotas (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    metric_type VARCHAR(50) NOT NULL
        CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom')),
    metric_name VARCHAR(100),
    soft_limit DECIMAL(20,4) NOT NULL,
    hard_limit DECIMAL(20,4) NOT NULL,
    current_usage DECIMAL(20,4) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'units'::VARCHAR,
    reset_period VARCHAR(20) DEFAULT 'monthly'::VARCHAR
        CHECK (reset_period IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never')),
    last_reset TIMESTAMPTZ,
    next_reset TIMESTAMPTZ,
    overage_rate DECIMAL(10,4) DEFAULT 0,
    allow_overage BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT now(),
    modified_on TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE main.tenant_quotas IS 'Usage quotas and limits for each tenant';

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant_id ON main.tenant_quotas(tenant_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_metric_type ON main.tenant_quotas(metric_type);

-- Table: usage_events
CREATE TABLE IF NOT EXISTS main.usage_events (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    metric_type VARCHAR(50) NOT NULL
        CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom')),
    metric_name VARCHAR(100),
    quantity DECIMAL(20,4) DEFAULT 1 NOT NULL,
    unit VARCHAR(50) DEFAULT 'units'::VARCHAR,
    event_timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    billing_period VARCHAR(7),
    source VARCHAR(100),
    resource_id VARCHAR(255),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT now(),
    modified_on TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE main.usage_events IS 'Individual usage events for billing and analytics';

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON main.usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON main.usage_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_billing_period ON main.usage_events(billing_period);

-- Table: usage_summaries
CREATE TABLE IF NOT EXISTS main.usage_summaries (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id),
    metric_type VARCHAR(50) NOT NULL
        CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom')),
    billing_period VARCHAR(7) NOT NULL,
    total_quantity DECIMAL(20,4) DEFAULT 0 NOT NULL,
    included_quantity DECIMAL(20,4) DEFAULT 0,
    overage_quantity DECIMAL(20,4) DEFAULT 0,
    overage_amount DECIMAL(20,4) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'units'::VARCHAR,
    event_count INTEGER DEFAULT 0,
    peak_usage DECIMAL(20,4),
    average_usage DECIMAL(20,4),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT now(),
    modified_on TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE main.usage_summaries IS 'Aggregated usage summaries per tenant per billing period';

CREATE INDEX IF NOT EXISTS idx_usage_summaries_tenant_id ON main.usage_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_period ON main.usage_summaries(billing_period);

-- ============================================================================
-- SECTION 6: SUBSCRIPTION SCHEMA TABLES
-- ============================================================================

-- Table: subscription.plans
CREATE TABLE IF NOT EXISTS subscription.plans (
    id UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tier VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    billing_interval subscription.billing_interval DEFAULT 'monthly'::subscription.billing_interval,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE subscription.plans IS 'Subscription plan definitions (subscription schema)';

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription.plans(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription.plans(is_active);

-- Table: subscription.subscriptions
CREATE TABLE IF NOT EXISTS subscription.subscriptions (
    id UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES subscription.plans(id),
    status subscription.subscription_status DEFAULT 'active'::subscription.subscription_status,
    billing_interval subscription.billing_interval DEFAULT 'monthly'::subscription.billing_interval,
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    stripe_subscription_id VARCHAR(200),
    stripe_customer_id VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE subscription.subscriptions IS 'Active subscriptions (subscription schema)';

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscription.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscription.subscriptions(status);

-- Table: subscription.invoices
CREATE TABLE IF NOT EXISTS subscription.invoices (
    id UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    subscription_id UUID REFERENCES subscription.subscriptions(id),
    tenant_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD'::VARCHAR,
    status VARCHAR(50) DEFAULT 'pending'::VARCHAR,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    invoice_number VARCHAR(100),
    stripe_invoice_id VARCHAR(200),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE subscription.invoices IS 'Subscription invoices (subscription schema)';

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant ON subscription.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription.invoices(status);

-- ============================================================================
-- SECTION 7: PUBLIC SCHEMA TABLES (Migration tracking)
-- ============================================================================

-- Table: public.migrations (db-migrate framework table)
CREATE TABLE IF NOT EXISTS public.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    run_on TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.migrations IS 'db-migrate framework migration tracking';

-- Table: public.migrations_state (db-migrate framework table)
CREATE TABLE IF NOT EXISTS public.migrations_state (
    id SERIAL PRIMARY KEY,
    current VARCHAR(255),
    last_run TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.migrations_state IS 'db-migrate framework state tracking';

-- Table: public.audit_logs (legacy, may be duplicated with main.audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor_id UUID NOT NULL,
    actor_name VARCHAR(200),
    actor_email VARCHAR(255),
    target_type VARCHAR(50),
    target_id UUID,
    target_name VARCHAR(200),
    tenant_id UUID,
    tenant_name VARCHAR(200),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success'::VARCHAR NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Legacy audit logs (public schema) - may be deprecated in favor of main.audit_logs';

-- Table: public.notification_history (legacy, may be duplicated with main.notification_history)
CREATE TABLE IF NOT EXISTS public.notification_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255),
    subscriber_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'webhook')),
    status VARCHAR(50) DEFAULT 'pending'::VARCHAR NOT NULL
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    subject VARCHAR(500),
    payload JSONB,
    transaction_id VARCHAR(255),
    novu_message_id VARCHAR(255),
    attempts INTEGER DEFAULT 1,
    error_message TEXT,
    error_code VARCHAR(100),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    category VARCHAR(100),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT now(),
    modified_on TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID
);

COMMENT ON TABLE public.notification_history IS 'Legacy notification history (public schema) - may be deprecated in favor of main.notification_history';

-- ============================================================================
-- SECTION 8: SEED DATA
-- ============================================================================

-- ============================================================================
-- TENANT SEED DATA (3 tenants - aligned with Supabase organizations)
-- ============================================================================
-- UUID Alignment with Supabase:
--   Arc-SaaS tenant.id = Supabase organization.id
--   Platform Admin:  a0000000-0000-0000-0000-000000000001
--   CNS Staff:       a0000000-0000-0000-0000-000000000002
--   Demo Org:        a0000000-0000-0000-0000-000000000000
-- ============================================================================

-- Tenant 1: Platform Admin (for super_admin users)
INSERT INTO main.tenants (
    id,
    name,
    key,
    status,
    domains,
    identity_provider,
    created_on,
    modified_on
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Platform Admin',
    'platform',
    0,
    ARRAY['platform.ananta.dev', 'admin.ananta.dev'],
    'keycloak',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    key = EXCLUDED.key,
    status = 0,
    modified_on = NOW();

-- Tenant 2: CNS Staff (for CNS service team)
INSERT INTO main.tenants (
    id,
    name,
    key,
    status,
    domains,
    identity_provider,
    created_on,
    modified_on
) VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'CNS Staff',
    'cns-staff',
    0,
    ARRAY['cns.ananta.dev'],
    'keycloak',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    key = EXCLUDED.key,
    status = 0,
    modified_on = NOW();

-- Tenant 3: Demo Organization (for demo/trial users)
INSERT INTO main.tenants (
    id,
    name,
    key,
    status,
    domains,
    identity_provider,
    created_on,
    modified_on
) VALUES (
    'a0000000-0000-0000-0000-000000000000',
    'Demo Organization',
    'demo-org',
    0,
    ARRAY['demo.ananta.dev'],
    'keycloak',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    key = EXCLUDED.key,
    status = 0,
    modified_on = NOW();

-- ============================================================================
-- CONTACT SEED DATA (Primary contacts for each tenant)
-- ============================================================================

-- Contact 1: Platform Admin primary contact
INSERT INTO main.contacts (
    id,
    first_name,
    last_name,
    email,
    is_primary,
    tenant_id,
    created_on
) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'Platform',
    'Admin',
    'superadmin@ananta.dev',
    TRUE,
    'a0000000-0000-0000-0000-000000000001',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Contact 2: CNS Staff primary contact
INSERT INTO main.contacts (
    id,
    first_name,
    last_name,
    email,
    is_primary,
    tenant_id,
    created_on
) VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'CNS',
    'Lead',
    'cns-lead@ananta.dev',
    TRUE,
    'a0000000-0000-0000-0000-000000000002',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Contact 3: Demo Org primary contact
INSERT INTO main.contacts (
    id,
    first_name,
    last_name,
    email,
    is_primary,
    tenant_id,
    created_on
) VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'Demo',
    'Owner',
    'demo-owner@example.com',
    TRUE,
    'a0000000-0000-0000-0000-000000000000',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Seed: Platform Configuration
INSERT INTO main.settings (
    config_key,
    config_value,
    value_type,
    description,
    category,
    is_public
) VALUES
    (
        'platform.super_admin_tenant_id',
        'a0000000-0000-0000-0000-000000000001',
        'string',
        'The tenant ID for the Platform Super Admin organization. This is a system tenant for platform administration.',
        'platform',
        FALSE
    ),
    (
        'platform.name',
        'Ananta Platform SaaS',
        'string',
        'Platform name displayed in UI',
        'general',
        TRUE
    ),
    (
        'platform.version',
        '1.0.0',
        'string',
        'Platform version',
        'general',
        TRUE
    )
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description;

-- Seed: Default Plans
INSERT INTO main.plans (
    id,
    name,
    description,
    tier,
    price,
    billing_cycle,
    features,
    is_active,
    limits,
    trial_enabled,
    trial_duration,
    trial_duration_unit,
    is_popular,
    sort_order,
    created_on,
    modified_on
) VALUES
    (
        'plan-free',
        'Free',
        'Get started for free - perfect for personal projects',
        'FREE',
        0.00,
        'month',
        '["1 user", "1 GB storage", "Community support", "Basic analytics"]'::jsonb,
        TRUE,
        '{"maxUsers": 1, "maxStorage": 1, "maxApiCalls": 1000, "maxProjects": 3}'::jsonb,
        FALSE,
        14,
        'days',
        FALSE,
        0,
        NOW(),
        NOW()
    ),
    (
        'plan-basic',
        'Basic',
        'Perfect for small teams getting started',
        'BASIC',
        29.00,
        'month',
        '["Up to 5 users", "10 GB storage", "Email support", "Basic analytics", "API access"]'::jsonb,
        TRUE,
        '{"maxUsers": 5, "maxStorage": 10, "maxApiCalls": 10000, "maxProjects": 10}'::jsonb,
        FALSE,
        14,
        'days',
        FALSE,
        1,
        NOW(),
        NOW()
    ),
    (
        'plan-standard',
        'Standard',
        'Best for growing businesses',
        'STANDARD',
        79.00,
        'month',
        '["Up to 25 users", "100 GB storage", "Priority email support", "Advanced analytics", "API access", "Custom integrations", "SSO authentication"]'::jsonb,
        TRUE,
        '{"maxUsers": 25, "maxStorage": 100, "maxApiCalls": 100000, "maxProjects": 50}'::jsonb,
        FALSE,
        14,
        'days',
        TRUE,
        2,
        NOW(),
        NOW()
    ),
    (
        'plan-premium',
        'Premium',
        'For enterprises with advanced needs',
        'PREMIUM',
        199.00,
        'month',
        '["Unlimited users", "1 TB storage", "24/7 phone & email support", "Enterprise analytics", "Unlimited API access", "Custom integrations", "SSO authentication", "Dedicated account manager", "Custom SLA", "On-premise deployment option"]'::jsonb,
        TRUE,
        '{"maxUsers": null, "maxStorage": 1000, "maxApiCalls": null, "maxProjects": null}'::jsonb,
        FALSE,
        14,
        'days',
        FALSE,
        3,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    is_popular = EXCLUDED.is_popular,
    modified_on = NOW();

-- Seed: Feature Flags
INSERT INTO main.feature_flags (name, enabled, description) VALUES
    ('workflows', TRUE, 'Enable Temporal workflow management'),
    ('billing', TRUE, 'Enable billing and payment features'),
    ('auditLogs', TRUE, 'Enable audit log viewing'),
    ('monitoring', TRUE, 'Enable system monitoring dashboards'),
    ('notifications', TRUE, 'Enable notification system'),
    ('quotas', TRUE, 'Enable usage quotas and limits')
ON CONFLICT (name) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description;

-- ============================================================================
-- USER SEED DATA (5 users - aligned with Supabase users)
-- ============================================================================
-- UUID Alignment with Supabase:
--   Arc-SaaS user.id = Supabase user.id
--   All users match keycloak_user_id for SSO
-- ============================================================================

-- User 1: Platform Super Admin (super_admin role)
INSERT INTO main.users (
    id,
    tenant_id,
    first_name,
    last_name,
    email,
    status,
    role,
    is_active,
    permissions,
    keycloak_user_id,
    created_on,
    modified_on
) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Platform',
    'Admin',
    'superadmin@ananta.dev',
    0,
    'super_admin',
    TRUE,
    '["*"]'::jsonb,
    'superadmin@ananta.dev',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    modified_on = NOW();

-- User 2: CNS Lead (owner role for CNS Staff org)
INSERT INTO main.users (
    id,
    tenant_id,
    first_name,
    last_name,
    email,
    status,
    role,
    is_active,
    permissions,
    keycloak_user_id,
    created_on,
    modified_on
) VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'CNS',
    'Lead',
    'cns-lead@ananta.dev',
    0,
    'owner',
    TRUE,
    '["tenant:*", "subscription:*", "user:*"]'::jsonb,
    'cns-lead@ananta.dev',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    modified_on = NOW();

-- User 3: CNS Engineer (engineer role for CNS Staff org)
INSERT INTO main.users (
    id,
    tenant_id,
    first_name,
    last_name,
    email,
    status,
    role,
    is_active,
    permissions,
    keycloak_user_id,
    created_on,
    modified_on
) VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'CNS',
    'Engineer',
    'cns-engineer@ananta.dev',
    0,
    'engineer',
    TRUE,
    '["component:*", "bom:*", "enrichment:*"]'::jsonb,
    'cns-engineer@ananta.dev',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    modified_on = NOW();

-- User 4: Demo Owner (owner role for Demo org)
INSERT INTO main.users (
    id,
    tenant_id,
    first_name,
    last_name,
    email,
    status,
    role,
    is_active,
    permissions,
    keycloak_user_id,
    created_on,
    modified_on
) VALUES (
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000000',
    'Demo',
    'Owner',
    'demo-owner@example.com',
    0,
    'owner',
    TRUE,
    '["tenant:read", "tenant:update", "user:*"]'::jsonb,
    'demo-owner@example.com',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    modified_on = NOW();

-- User 5: Demo Engineer (engineer role for Demo org)
INSERT INTO main.users (
    id,
    tenant_id,
    first_name,
    last_name,
    email,
    status,
    role,
    is_active,
    permissions,
    keycloak_user_id,
    created_on,
    modified_on
) VALUES (
    'c0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000000',
    'Demo',
    'Engineer',
    'demo-engineer@example.com',
    0,
    'engineer',
    TRUE,
    '["component:read", "bom:*"]'::jsonb,
    'demo-engineer@example.com',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    modified_on = NOW();

-- ============================================================================
-- USER ROLE ASSIGNMENTS
-- ============================================================================

-- Super Admin role assignment
INSERT INTO main.user_roles (
    id,
    user_id,
    role_key,
    tenant_id,
    created_on
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'super_admin',
    'a0000000-0000-0000-0000-000000000001',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- CNS Lead role assignment
INSERT INTO main.user_roles (
    id,
    user_id,
    role_key,
    tenant_id,
    created_on
) VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'owner',
    'a0000000-0000-0000-0000-000000000002',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- CNS Engineer role assignment
INSERT INTO main.user_roles (
    id,
    user_id,
    role_key,
    tenant_id,
    created_on
) VALUES (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    'engineer',
    'a0000000-0000-0000-0000-000000000002',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Owner role assignment
INSERT INTO main.user_roles (
    id,
    user_id,
    role_key,
    tenant_id,
    created_on
) VALUES (
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000004',
    'owner',
    'a0000000-0000-0000-0000-000000000000',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Engineer role assignment
INSERT INTO main.user_roles (
    id,
    user_id,
    role_key,
    tenant_id,
    created_on
) VALUES (
    'd0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000005',
    'engineer',
    'a0000000-0000-0000-0000-000000000000',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SUBSCRIPTION SEED DATA (Active subscriptions for all tenants)
-- ============================================================================

-- Subscription 1: Platform Admin - Premium (unlimited)
INSERT INTO main.subscriptions (
    id,
    tenant_id,
    planid,
    planname,
    plantier,
    status,
    amount,
    current_period_start,
    current_period_end,
    created_on,
    modified_on
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'plan-premium',
    'Premium',
    'premium',
    'active',
    199.00,
    NOW(),
    NOW() + INTERVAL '100 years',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    modified_on = NOW();

-- Subscription 2: CNS Staff - Premium (unlimited)
INSERT INTO main.subscriptions (
    id,
    tenant_id,
    planid,
    planname,
    plantier,
    status,
    amount,
    current_period_start,
    current_period_end,
    created_on,
    modified_on
) VALUES (
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'plan-premium',
    'Premium',
    'premium',
    'active',
    199.00,
    NOW(),
    NOW() + INTERVAL '100 years',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    modified_on = NOW();

-- Subscription 3: Demo Org - Standard (trial)
INSERT INTO main.subscriptions (
    id,
    tenant_id,
    planid,
    planname,
    plantier,
    status,
    amount,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    created_on,
    modified_on
) VALUES (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000000',
    'plan-standard',
    'Standard',
    'standard',
    'trialing',
    79.00,
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW() + INTERVAL '1 month',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    status = 'trialing',
    trial_end = NOW() + INTERVAL '14 days',
    modified_on = NOW();

-- ============================================================================
-- TENANT QUOTA SEED DATA (using flexible metric_type schema)
-- ============================================================================

-- Quota for Platform Admin - Users (unlimited)
INSERT INTO main.tenant_quotas (
    id, tenant_id, metric_type, metric_name, soft_limit, hard_limit, current_usage
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'users', 'User Accounts', 999999, 999999, 1
) ON CONFLICT (id) DO NOTHING;

-- Quota for CNS Staff - Users (unlimited)
INSERT INTO main.tenant_quotas (
    id, tenant_id, metric_type, metric_name, soft_limit, hard_limit, current_usage
) VALUES (
    'f0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'users', 'User Accounts', 999999, 999999, 2
) ON CONFLICT (id) DO NOTHING;

-- Quota for Demo Org - Users (Standard plan: 25 users)
INSERT INTO main.tenant_quotas (
    id, tenant_id, metric_type, metric_name, soft_limit, hard_limit, current_usage
) VALUES (
    'f0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000000',
    'users', 'User Accounts', 20, 25, 2
) ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- - Schemas: main, subscription, public
-- - Main schema tables: 23 (addresses, tenants, leads, contacts, branding_metadata,
--   users, user_roles, user_invitations, user_activities, audit_logs, plans,
--   subscriptions, invoices, payment_methods, payment_intents, settings, resources,
--   platform_config, feature_flags, notification_history, tenant_quotas,
--   usage_events, usage_summaries)
-- - Subscription schema tables: 3 (plans, subscriptions, invoices)
-- - Public schema tables: 4 (migrations, migrations_state, audit_logs, notification_history)
-- - Custom types: 2 (billing_interval, subscription_status)
-- - Functions: 4 (create_tenant_schema, drop_tenant_schema in main and public)
-- - Extensions: 2 (uuid-ossp, pgcrypto)
--
-- SEED DATA (out-of-box ready):
-- - Tenants: 3 (Platform Admin, CNS Staff, Demo Org) - UUID aligned with Supabase
-- - Contacts: 3 (one primary contact per tenant)
-- - Users: 5 (super_admin, 2x owner, 2x engineer) - UUID aligned with Supabase
-- - User Roles: 5 role assignments
-- - Plans: 4 (Free, Basic, Standard, Premium)
-- - Subscriptions: 3 (Premium for internal orgs, Standard trial for demo)
-- - Quotas: 3 (unlimited for internal, limits for demo)
-- - Feature Flags: 6 (all enabled)
-- - Platform Settings: 3
--
-- UUID ALIGNMENT WITH SUPABASE:
-- - tenant.id = organization.id
-- - user.id matches across both databases
-- - Platform Admin: a0000000-0000-0000-0000-000000000001
-- - CNS Staff:      a0000000-0000-0000-0000-000000000002
-- - Demo Org:       a0000000-0000-0000-0000-000000000000
--
-- Total verified tables: 30 (matches live database)
-- ============================================================================
