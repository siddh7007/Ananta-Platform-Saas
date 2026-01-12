-- Combined Control Plane Migrations for Ananta Platform
-- Generated from arc-saas/services/tenant-management-service/migrations/pg/migrations/sqls/

-- 1. Create schema and base tables (20240125154021-init-up.sql)
CREATE SCHEMA IF NOT EXISTS main;

CREATE TABLE IF NOT EXISTS main.addresses(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    address varchar(500),
    city varchar(100),
    "state" varchar(100),
    zip varchar(25),
    country varchar(25),
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    created_by uuid,
    modified_by uuid,
    CONSTRAINT pk_address_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS main.leads(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    email varchar(100) NOT NULL,
    created_by uuid,
    modified_by uuid,
    is_validated boolean DEFAULT FALSE NOT NULL,
    company_name varchar(100),
    address_id uuid,
    CONSTRAINT pk_leads_id PRIMARY KEY (id),
    CONSTRAINT fk_leads_address FOREIGN KEY (address_id) REFERENCES main.addresses(id)
);

CREATE TABLE IF NOT EXISTS main.tenants(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    name varchar(100) NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    "key" varchar(20) NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    spoc_user_id uuid,
    lead_id uuid,
    domains varchar[] DEFAULT '{}' NOT NULL,
    address_id uuid,
    CONSTRAINT pk_tenants_id PRIMARY KEY (id),
    CONSTRAINT idx_tenant_key UNIQUE ("key"),
    CONSTRAINT fk_tenants_address FOREIGN KEY (address_id) REFERENCES main.addresses(id)
);

CREATE TABLE IF NOT EXISTS main.branding_metadata(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    theme_metadata jsonb,
    description varchar(500),
    logo varchar(500),
    website varchar(500),
    tenant_id uuid NOT NULL,
    CONSTRAINT pk_branding_metadata PRIMARY KEY (id),
    CONSTRAINT fk_branding_metadata_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id)
);

CREATE TABLE IF NOT EXISTS main.contacts(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    email varchar(100) NOT NULL,
    contact_type varchar(100),
    is_primary boolean DEFAULT FALSE NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_by uuid,
    deleted_on timestamptz,
    tenant_id uuid NOT NULL,
    CONSTRAINT pk_tenant_contacts PRIMARY KEY (id),
    CONSTRAINT fk_tenant_contacts_leads FOREIGN KEY (tenant_id) REFERENCES main.tenants(id)
);

CREATE TABLE IF NOT EXISTS main.resources(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    "type" varchar(100) NOT NULL,
    metadata jsonb NOT NULL,
    external_identifier varchar(200) NOT NULL,
    tenant_id uuid NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_resources_id_1 PRIMARY KEY (id),
    CONSTRAINT idx_resource_ext_id UNIQUE (external_identifier,tenant_id)
);

ALTER TABLE main.resources
    ADD CONSTRAINT fk_resources_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);

-- 2. Add tenant configs table (20240925102459)
CREATE TABLE IF NOT EXISTS main.tenant_mgmt_configs
(
    id uuid NOT NULL DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid,
    config_key varchar(100) NOT NULL,
    config_value jsonb NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_by uuid,
    deleted_on timestamptz,
    tenant_id uuid NOT NULL,
    CONSTRAINT pk_tenant_configs_id PRIMARY KEY (id),
    CONSTRAINT fk_tenant_configs_tenants FOREIGN KEY (tenant_id)
        REFERENCES main.tenants(id)
);

CREATE OR REPLACE FUNCTION main.moddatetime()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $function$
BEGIN
    NEW.modified_on = now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS mdt_tenant_configs ON main.tenant_mgmt_configs;
CREATE TRIGGER mdt_tenant_configs
    BEFORE UPDATE ON main.tenant_mgmt_configs
    FOR EACH ROW
    EXECUTE FUNCTION main.moddatetime('modified_on');

-- 3. Add users table (20250106000001)
CREATE TABLE IF NOT EXISTS main.users(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    email varchar(255) NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    auth_id varchar(255),
    status smallint DEFAULT 0 NOT NULL,
    tenant_id uuid NOT NULL,
    phone varchar(50),
    avatar_url varchar(500),
    last_login timestamptz,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_users_id PRIMARY KEY (id),
    CONSTRAINT fk_users_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    CONSTRAINT uk_users_email_tenant UNIQUE (email, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON main.users(tenant_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_email ON main.users(email) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_status ON main.users(status) WHERE deleted = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_auth_id ON main.users(auth_id) WHERE auth_id IS NOT NULL;

-- 4. Add user_roles table (20250106000002)
CREATE TABLE IF NOT EXISTS main.user_roles(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    user_id uuid NOT NULL,
    role_key varchar(50) NOT NULL,
    permissions text[],
    scope_type varchar(50) DEFAULT 'tenant' NOT NULL,
    scope_id uuid,
    tenant_id uuid NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_user_roles_id PRIMARY KEY (id),
    CONSTRAINT fk_user_roles_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    CONSTRAINT uk_user_roles_unique UNIQUE (user_id, role_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON main.user_roles(user_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON main.user_roles(tenant_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_key ON main.user_roles(role_key) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_roles_scope ON main.user_roles(scope_type, scope_id) WHERE deleted = FALSE;

-- 5. Add user_invitations table (20250106000003)
CREATE TABLE IF NOT EXISTS main.user_invitations(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    role_key varchar(50) NOT NULL,
    invited_by uuid NOT NULL,
    tenant_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    accepted_at timestamptz,
    accepted_by uuid,
    first_name varchar(100),
    last_name varchar(100),
    custom_message text,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_user_invitations_id PRIMARY KEY (id),
    CONSTRAINT fk_user_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES main.users(id),
    CONSTRAINT fk_user_invitations_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    CONSTRAINT fk_user_invitations_accepted_by FOREIGN KEY (accepted_by) REFERENCES main.users(id),
    CONSTRAINT uk_user_invitations_token UNIQUE (token),
    CONSTRAINT ck_user_invitations_token_length CHECK (length(token) >= 32),
    CONSTRAINT ck_user_invitations_expires_future CHECK (expires_at > created_on)
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON main.user_invitations(email) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_id ON main.user_invitations(tenant_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON main.user_invitations(token) WHERE deleted = FALSE AND status = 0;
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON main.user_invitations(status, expires_at) WHERE deleted = FALSE;

-- 6. Add user_activities table (20250106000004)
CREATE TABLE IF NOT EXISTS main.user_activities(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(50),
    entity_id uuid,
    metadata jsonb,
    ip_address varchar(45),
    user_agent text,
    occurred_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_user_activities_id PRIMARY KEY (id),
    CONSTRAINT fk_user_activities_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_activities_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON main.user_activities(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_tenant_id ON main.user_activities(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON main.user_activities(action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_entity ON main.user_activities(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_occurred_at ON main.user_activities(occurred_at DESC);

-- 7. Add identity_provider to tenants (20250106000005)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'main' AND table_name = 'tenants' AND column_name = 'identity_provider') THEN
        ALTER TABLE main.tenants ADD COLUMN identity_provider VARCHAR(50) DEFAULT 'keycloak' NOT NULL;
        ALTER TABLE main.tenants ADD CONSTRAINT tenants_identity_provider_check CHECK (identity_provider IN ('keycloak', 'auth0', 'cognito'));
        CREATE INDEX idx_tenants_identity_provider ON main.tenants(identity_provider);
    END IF;
END $$;

-- 8. Add subscriptions table (20250106000006)
CREATE TABLE IF NOT EXISTS main.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id) ON DELETE CASCADE,
    planid VARCHAR(100) NOT NULL,
    planname VARCHAR(100) NOT NULL,
    plantier VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    metadata JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON main.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON main.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted ON main.subscriptions(deleted);

-- 9. Add invoices table (20250106000007) - recreate with new schema
DROP TABLE IF EXISTS main.invoices CASCADE;
CREATE TABLE IF NOT EXISTS main.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id) ON DELETE CASCADE NOT NULL,
    start_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    invoice_file VARCHAR(500),
    due_date VARCHAR(50) NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON main.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON main.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON main.invoices(deleted);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON main.invoices(due_date);

-- 10. Add settings table (20250106000008)
CREATE TABLE IF NOT EXISTS main.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_config_key ON main.settings(config_key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON main.settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_is_public ON main.settings(is_public) WHERE is_public = TRUE;

INSERT INTO main.settings (config_key, config_value, value_type, description, category, is_public)
VALUES
    ('platform.name', 'ARC SaaS', 'string', 'Platform display name', 'general', true),
    ('platform.support_email', 'support@example.com', 'string', 'Support contact email', 'general', true),
    ('billing.trial_days', '14', 'number', 'Number of days for trial period', 'billing', false),
    ('billing.currency', 'USD', 'string', 'Default billing currency', 'billing', true),
    ('email.from_name', 'ARC SaaS', 'string', 'Default sender name for emails', 'email', false),
    ('email.from_address', 'noreply@example.com', 'string', 'Default sender email address', 'email', false),
    ('tenant.max_users_default', '10', 'number', 'Default max users for new tenants', 'tenant', false)
ON CONFLICT (config_key) DO NOTHING;

-- 11. Add audit_logs table (20250108000001)
CREATE TABLE IF NOT EXISTS main.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON main.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON main.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON main.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON main.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON main.audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON main.audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp ON main.audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON main.audit_logs(tenant_id, action);

-- 12. Add invitation resend columns (20250109000001)
ALTER TABLE main.user_invitations ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz;
ALTER TABLE main.user_invitations ADD COLUMN IF NOT EXISTS resend_count integer DEFAULT 0 NOT NULL;

UPDATE main.user_invitations SET last_email_sent_at = created_on WHERE last_email_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_invitations_last_email_sent ON main.user_invitations(last_email_sent_at) WHERE deleted = FALSE AND status = 0;

-- 13. Seed Platform Super Admin Tenant (20250110000001)
UPDATE main.tenants SET key = 'platform-old-' || EXTRACT(EPOCH FROM NOW())::TEXT WHERE key = 'platform' AND id != 'a0000000-0000-0000-0000-000000000000';

INSERT INTO main.tenants (id, name, key, status, domains, created_on, modified_on)
VALUES ('a0000000-0000-0000-0000-000000000000', 'Platform Super Admin', 'platform', 0, ARRAY['platform.local'], NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, key = 'platform', status = 0, modified_on = NOW();

INSERT INTO main.contacts (id, first_name, last_name, email, is_primary, tenant_id, created_on)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Platform', 'Administrator', 'platform-admin@example.com', TRUE, 'a0000000-0000-0000-0000-000000000000', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO main.settings (config_key, config_value, value_type, description, category, is_public)
VALUES ('platform.super_admin_tenant_id', 'a0000000-0000-0000-0000-000000000000', 'string', 'The tenant ID for the Platform Super Admin organization.', 'platform', FALSE)
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, description = EXCLUDED.description;

-- 14. Add payment_methods table (20250111000001)
CREATE TABLE IF NOT EXISTS main.payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    card_details JSONB,
    bank_account_details JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    metadata JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON main.payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer_id ON main.payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON main.payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON main.payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted ON main.payment_methods(deleted);

-- 15. Add payment_intents table (20250111000002)
CREATE TABLE IF NOT EXISTS main.payment_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES main.invoices(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_payment_method_id VARCHAR(255),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    status VARCHAR(50) NOT NULL DEFAULT 'requires_payment_method',
    client_secret VARCHAR(500),
    description TEXT,
    receipt_email VARCHAR(255),
    failure_code VARCHAR(100),
    failure_message TEXT,
    succeeded_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason VARCHAR(100),
    amount_received INTEGER,
    metadata JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_id ON main.payment_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice_id ON main.payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_customer_id ON main.payment_intents(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON main.payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_deleted ON main.payment_intents(deleted);
CREATE INDEX IF NOT EXISTS idx_payment_intents_succeeded_at ON main.payment_intents(succeeded_at);

-- 16. Add usage tracking tables (20250112000001)
CREATE TABLE IF NOT EXISTS main.usage_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100),
    quantity NUMERIC(20, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'units',
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    billing_period VARCHAR(7),
    source VARCHAR(100),
    resource_id VARCHAR(255),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT NOW(),
    modified_on TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT chk_metric_type CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom'))
);

CREATE TABLE IF NOT EXISTS main.tenant_quotas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100),
    soft_limit NUMERIC(20, 4) NOT NULL,
    hard_limit NUMERIC(20, 4) NOT NULL,
    current_usage NUMERIC(20, 4) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'units',
    reset_period VARCHAR(20) DEFAULT 'monthly',
    last_reset TIMESTAMPTZ,
    next_reset TIMESTAMPTZ,
    overage_rate NUMERIC(10, 4) DEFAULT 0,
    allow_overage BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT NOW(),
    modified_on TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT chk_quota_metric_type CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom')),
    CONSTRAINT chk_reset_period CHECK (reset_period IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never')),
    CONSTRAINT uq_tenant_metric UNIQUE (tenant_id, metric_type)
);

CREATE TABLE IF NOT EXISTS main.usage_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    billing_period VARCHAR(7) NOT NULL,
    total_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
    included_quantity NUMERIC(20, 4) DEFAULT 0,
    overage_quantity NUMERIC(20, 4) DEFAULT 0,
    overage_amount NUMERIC(20, 4) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'units',
    event_count INTEGER DEFAULT 0,
    peak_usage NUMERIC(20, 4),
    average_usage NUMERIC(20, 4),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT NOW(),
    modified_on TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT chk_summary_metric_type CHECK (metric_type IN ('api_calls', 'storage_gb', 'users', 'workflows', 'integrations', 'custom')),
    CONSTRAINT uq_tenant_metric_period UNIQUE (tenant_id, metric_type, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON main.usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_period ON main.usage_events(billing_period);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON main.usage_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON main.usage_events(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_period ON main.usage_events(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON main.tenant_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_active ON main.tenant_quotas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_usage_summaries_tenant ON main.usage_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_period ON main.usage_summaries(billing_period DESC);
CREATE INDEX IF NOT EXISTS idx_usage_summaries_tenant_period ON main.usage_summaries(tenant_id, billing_period);

-- 17. Add notification_history table (20250112000002)
CREATE TABLE IF NOT EXISTS main.notification_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    workflow_id VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255),
    subscriber_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
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
    created_on TIMESTAMPTZ DEFAULT NOW(),
    modified_on TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT chk_notification_channel CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'webhook')),
    CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'))
);

CREATE INDEX IF NOT EXISTS idx_notification_history_tenant ON main.notification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_tenant_created ON main.notification_history(tenant_id, created_on DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_workflow ON main.notification_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON main.notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON main.notification_history(channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_history_transaction ON main.notification_history(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_history_novu_message ON main.notification_history(novu_message_id) WHERE novu_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_history_category ON main.notification_history(category) WHERE category IS NOT NULL;

-- 18. Add plans table (20250113000001)
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

CREATE INDEX IF NOT EXISTS idx_plans_tier ON main.plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON main.plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON main.plans(sort_order);

-- Seed default plans
INSERT INTO main.plans (id, name, description, tier, price, billing_cycle, features, is_active, limits, trial_enabled, trial_duration, is_popular, sort_order)
VALUES
    ('plan-basic', 'Basic', 'For small teams getting started', 'basic', 29.00, 'month', '["5 users", "10 projects", "Basic support"]'::jsonb, true, '{"users": 5, "projects": 10}'::jsonb, true, 14, false, 1),
    ('plan-standard', 'Standard', 'For growing teams', 'standard', 79.00, 'month', '["25 users", "50 projects", "Priority support", "API access"]'::jsonb, true, '{"users": 25, "projects": 50}'::jsonb, true, 14, true, 2),
    ('plan-premium', 'Premium', 'For enterprises', 'premium', 199.00, 'month', '["Unlimited users", "Unlimited projects", "24/7 support", "API access", "Custom integrations"]'::jsonb, true, '{"users": -1, "projects": -1}'::jsonb, true, 30, false, 3)
ON CONFLICT (id) DO NOTHING;

-- Done
SELECT 'Migrations completed successfully!' AS status;
