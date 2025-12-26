-- =============================================================================
-- ARC SaaS Database Initialization
-- Multi-tenant schema isolation setup
-- =============================================================================

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Control Plane Schemas
-- =============================================================================

-- Main schema for platform-wide configuration
CREATE SCHEMA IF NOT EXISTS main;

-- Tenant management schema
CREATE SCHEMA IF NOT EXISTS tenant_management;

-- Subscription/billing schema
CREATE SCHEMA IF NOT EXISTS subscription;

-- Keycloak database (if not exists)
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

-- =============================================================================
-- Main Schema Tables (Platform Configuration)
-- =============================================================================

-- Platform configuration
CREATE TABLE IF NOT EXISTS main.platform_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature flags
CREATE TABLE IF NOT EXISTS main.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Tenant Management Schema
-- =============================================================================

-- Tenant status enum
DO $$ BEGIN
    CREATE TYPE tenant_management.tenant_status AS ENUM (
        'pending',
        'provisioning',
        'active',
        'suspended',
        'deprovisioning',
        'deprovisioned',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenants table
CREATE TABLE IF NOT EXISTS tenant_management.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    key VARCHAR(50) NOT NULL UNIQUE,
    status tenant_management.tenant_status DEFAULT 'pending',
    domains VARCHAR[] DEFAULT '{}',

    -- Tenant metadata
    tier VARCHAR(50) DEFAULT 'free',
    plan_id UUID,

    -- Storage info
    s3_bucket VARCHAR(200),
    schema_name VARCHAR(100),

    -- Contact info
    owner_email VARCHAR(255),
    owner_name VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provisioned_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT tenants_key_format CHECK (key ~ '^[a-z][a-z0-9_-]{2,49}$')
);

-- Tenant resources (provisioned infrastructure)
CREATE TABLE IF NOT EXISTS tenant_management.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenant_management.tenants(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    external_identifier VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant provisioning logs
CREATE TABLE IF NOT EXISTS tenant_management.provisioning_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenant_management.tenants(id) ON DELETE CASCADE,
    workflow_id VARCHAR(200),
    run_id VARCHAR(200),
    step VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant contacts
CREATE TABLE IF NOT EXISTS tenant_management.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenant_management.tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_key ON tenant_management.tenants(key);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenant_management.tenants(status);
CREATE INDEX IF NOT EXISTS idx_resources_tenant ON tenant_management.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_logs_tenant ON tenant_management.provisioning_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON tenant_management.contacts(tenant_id);

-- =============================================================================
-- Subscription Schema
-- =============================================================================

-- Plan billing interval
DO $$ BEGIN
    CREATE TYPE subscription.billing_interval AS ENUM ('monthly', 'yearly', 'one_time');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription status
DO $$ BEGIN
    CREATE TYPE subscription.subscription_status AS ENUM (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Plans table
CREATE TABLE IF NOT EXISTS subscription.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,

    -- Pricing
    price_monthly DECIMAL(10, 2) DEFAULT 0,
    price_yearly DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Features & Limits
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscription.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES subscription.plans(id),

    status subscription.subscription_status DEFAULT 'active',
    billing_interval subscription.billing_interval DEFAULT 'monthly',

    -- Dates
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,

    -- Billing
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,

    -- External references
    stripe_subscription_id VARCHAR(200),
    stripe_customer_id VARCHAR(200),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS subscription.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscription.subscriptions(id),
    tenant_id UUID NOT NULL,

    -- Invoice details
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'draft',

    -- Amounts
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Dates
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Stripe
    stripe_invoice_id VARCHAR(200),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscription.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscription.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON subscription.invoices(tenant_id);

-- =============================================================================
-- Default Plans
-- =============================================================================

INSERT INTO subscription.plans (name, code, description, price_monthly, price_yearly, features, limits)
VALUES
    ('Free', 'free', 'Free tier with basic features', 0, 0,
     '["Up to 100 orders/month", "Basic analytics", "Email support"]'::jsonb,
     '{"orders_per_month": 100, "storage_gb": 1, "api_calls_per_day": 1000}'::jsonb),

    ('Starter', 'starter', 'For small businesses', 29, 290,
     '["Up to 1,000 orders/month", "Advanced analytics", "Priority email support", "API access"]'::jsonb,
     '{"orders_per_month": 1000, "storage_gb": 10, "api_calls_per_day": 10000}'::jsonb),

    ('Professional', 'professional', 'For growing businesses', 99, 990,
     '["Up to 10,000 orders/month", "Custom reports", "Phone support", "Full API access", "Webhooks"]'::jsonb,
     '{"orders_per_month": 10000, "storage_gb": 50, "api_calls_per_day": 100000}'::jsonb),

    ('Enterprise', 'enterprise', 'For large organizations', 299, 2990,
     '["Unlimited orders", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom domain"]'::jsonb,
     '{"orders_per_month": -1, "storage_gb": 500, "api_calls_per_day": -1}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- Tenant Schema Template Function
-- This function creates a new schema for a tenant with all required tables
-- =============================================================================

CREATE OR REPLACE FUNCTION tenant_management.create_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
DECLARE
    v_schema_name VARCHAR(100);
BEGIN
    v_schema_name := 'tenant_' || tenant_key;

    -- Create the tenant schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);

    -- Users table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            role VARCHAR(50) DEFAULT ''user'',
            is_active BOOLEAN DEFAULT true,
            email_verified BOOLEAN DEFAULT false,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Products table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(200) NOT NULL,
            sku VARCHAR(100),
            description TEXT,
            price DECIMAL(10, 2) DEFAULT 0,
            currency VARCHAR(3) DEFAULT ''USD'',
            stock_quantity INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Categories table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            description TEXT,
            parent_id UUID,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Customers table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.customers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(50),
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(2),
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Orders table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.orders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            order_number VARCHAR(50) NOT NULL,
            customer_id UUID,
            status VARCHAR(50) DEFAULT ''pending'',
            subtotal DECIMAL(10, 2) DEFAULT 0,
            tax DECIMAL(10, 2) DEFAULT 0,
            shipping DECIMAL(10, 2) DEFAULT 0,
            total DECIMAL(10, 2) DEFAULT 0,
            currency VARCHAR(3) DEFAULT ''USD'',
            notes TEXT,
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Order items table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.order_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            order_id UUID NOT NULL,
            product_id UUID,
            product_name VARCHAR(200) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price DECIMAL(10, 2) NOT NULL,
            total_price DECIMAL(10, 2) NOT NULL,
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Settings table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            key VARCHAR(100) NOT NULL UNIQUE,
            value JSONB NOT NULL DEFAULT ''{}'',
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Files/media table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.files (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            mime_type VARCHAR(100),
            size_bytes BIGINT,
            s3_key VARCHAR(500) NOT NULL,
            s3_bucket VARCHAR(200),
            url VARCHAR(1000),
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', v_schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_users_email ON %I.users(email)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_sku ON %I.products(sku)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_orders_customer ON %I.orders(customer_id)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_orders_status ON %I.orders(status)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_order_items_order ON %I.order_items(order_id)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_files_s3_key ON %I.files(s3_key)', v_schema_name);

    -- Update tenant record with schema name (use v_schema_name to avoid ambiguity with column name)
    UPDATE tenant_management.tenants
    SET schema_name = v_schema_name,
        updated_at = NOW()
    WHERE key = tenant_key;

    RAISE NOTICE 'Created tenant schema: %', v_schema_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Drop Tenant Schema Function (for deprovisioning)
-- =============================================================================

CREATE OR REPLACE FUNCTION tenant_management.drop_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
DECLARE
    schema_name VARCHAR(100);
BEGIN
    schema_name := 'tenant_' || tenant_key;

    -- Drop the schema and all its objects
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);

    RAISE NOTICE 'Dropped tenant schema: %', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Grant permissions
-- =============================================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA main TO postgres;
GRANT USAGE ON SCHEMA tenant_management TO postgres;
GRANT USAGE ON SCHEMA subscription TO postgres;

-- Grant all privileges on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA main TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_management TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA subscription TO postgres;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION tenant_management.create_tenant_schema(VARCHAR) TO postgres;
GRANT EXECUTE ON FUNCTION tenant_management.drop_tenant_schema(VARCHAR) TO postgres;

-- =============================================================================
-- Create a demo tenant for testing
-- =============================================================================

INSERT INTO tenant_management.tenants (name, key, status, owner_email, owner_name, tier)
VALUES ('Demo Company', 'demo', 'pending', 'demo@example.com', 'Demo User', 'starter')
ON CONFLICT (key) DO NOTHING;

-- Note: The demo tenant schema will be created by the provisioning workflow
-- Or you can manually call: SELECT tenant_management.create_tenant_schema('demo');

DO $$
BEGIN
    RAISE NOTICE 'ARC SaaS database initialization complete!';
END $$;
