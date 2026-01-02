--
-- PostgreSQL database dump
--

\restrict qjuFk4I2AGOvOvyriYeScdimfzqYA8Pffx9DPcichAWGVhF48008uEzULlp4J76

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: main; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA main;


--
-- Name: subscription; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA subscription;


--
-- Name: tenant_123; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tenant_123;


--
-- Name: tenant_demo; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tenant_demo;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: billing_interval; Type: TYPE; Schema: subscription; Owner: -
--

CREATE TYPE subscription.billing_interval AS ENUM (
    'monthly',
    'yearly',
    'one_time'
);


--
-- Name: subscription_status; Type: TYPE; Schema: subscription; Owner: -
--

CREATE TYPE subscription.subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'expired'
);


--
-- Name: create_tenant_schema(character varying); Type: FUNCTION; Schema: main; Owner: -
--

CREATE FUNCTION main.create_tenant_schema(tenant_key character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: drop_tenant_schema(character varying); Type: FUNCTION; Schema: main; Owner: -
--

CREATE FUNCTION main.drop_tenant_schema(tenant_key character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'tenant_' || tenant_key;
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
    RAISE NOTICE 'Dropped schema %', schema_name;
END;
$$;


--
-- Name: create_tenant_schema(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_tenant_schema(tenant_key character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: drop_tenant_schema(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.drop_tenant_schema(tenant_key character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    schema_name VARCHAR;
BEGIN
    schema_name := 'tenant_' || tenant_key;
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
    RAISE NOTICE 'Dropped tenant schema: %', schema_name;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.addresses (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    address character varying(500),
    city character varying(100),
    state character varying(100),
    zip character varying(25),
    country character varying(25),
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    modified_by uuid
);


--
-- Name: audit_logs; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(100) NOT NULL,
    actor_id uuid NOT NULL,
    actor_name character varying(200),
    actor_email character varying(255),
    target_type character varying(50),
    target_id uuid,
    target_name character varying(200),
    tenant_id uuid,
    tenant_name character varying(200),
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.contacts (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    contact_type character varying(100),
    is_primary boolean DEFAULT false NOT NULL,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    deleted_by uuid,
    deleted_on timestamp with time zone,
    tenant_id uuid NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.feature_flags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    enabled boolean DEFAULT false,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    start_date character varying(50) NOT NULL,
    end_date character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency_code character varying(10) NOT NULL,
    invoice_file character varying(500),
    due_date character varying(50) NOT NULL,
    status integer DEFAULT 0 NOT NULL,
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    modified_by uuid
);


--
-- Name: leads; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.leads (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    email character varying(100) NOT NULL,
    created_by uuid,
    modified_by uuid,
    is_validated boolean DEFAULT false NOT NULL,
    company_name character varying(100),
    address_id uuid
);


--
-- Name: notification_history; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.notification_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id character varying(255) NOT NULL,
    workflow_name character varying(255),
    subscriber_id character varying(255) NOT NULL,
    channel character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    recipient_email character varying(255),
    recipient_phone character varying(50),
    subject character varying(500),
    payload jsonb,
    transaction_id character varying(255),
    novu_message_id character varying(255),
    attempts integer DEFAULT 1,
    error_message text,
    error_code character varying(100),
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    category character varying(100),
    metadata jsonb,
    created_by uuid,
    modified_by uuid,
    created_on timestamp with time zone DEFAULT now(),
    modified_on timestamp with time zone DEFAULT now(),
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT chk_notification_channel CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'push'::character varying, 'in_app'::character varying, 'webhook'::character varying])::text[]))),
    CONSTRAINT chk_notification_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'bounced'::character varying, 'opened'::character varying, 'clicked'::character varying])::text[])))
);


--
-- Name: payment_intents; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.payment_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid,
    stripe_payment_intent_id character varying(255) NOT NULL,
    stripe_customer_id character varying(255),
    stripe_payment_method_id character varying(255),
    amount integer NOT NULL,
    currency character varying(3) DEFAULT 'usd'::character varying NOT NULL,
    status character varying(50) DEFAULT 'requires_payment_method'::character varying NOT NULL,
    client_secret character varying(500),
    description text,
    receipt_email character varying(255),
    failure_code character varying(100),
    failure_message text,
    succeeded_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason character varying(100),
    amount_received integer,
    metadata jsonb,
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    modified_by uuid
);


--
-- Name: TABLE payment_intents; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.payment_intents IS 'Tracks Stripe payment intents for invoice payments';


--
-- Name: payment_methods; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    stripe_payment_method_id character varying(255) NOT NULL,
    stripe_customer_id character varying(255),
    type character varying(50) NOT NULL,
    card_details jsonb,
    bank_account_details jsonb,
    is_default boolean DEFAULT false,
    billing_name character varying(255),
    billing_email character varying(255),
    billing_address jsonb,
    metadata jsonb,
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    modified_by uuid
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.payment_methods IS 'Stores payment methods (cards, bank accounts) for tenant billing via Stripe';


--
-- Name: plans; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.plans (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    tier character varying(50) NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    billing_cycle character varying(20) DEFAULT 'month'::character varying NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    limits jsonb DEFAULT '{}'::jsonb,
    trial_enabled boolean DEFAULT false,
    trial_duration integer DEFAULT 14,
    trial_duration_unit character varying(20) DEFAULT 'days'::character varying,
    stripe_product_id character varying(255),
    stripe_price_id character varying(255),
    is_popular boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    modified_by character varying(255),
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by character varying(255)
);


--
-- Name: platform_config; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.platform_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: resources; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.resources (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    type character varying(100) NOT NULL,
    metadata jsonb NOT NULL,
    external_identifier character varying(200) NOT NULL,
    tenant_id uuid NOT NULL,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid
);


--
-- Name: settings; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text,
    value_type character varying(20) DEFAULT 'string'::character varying,
    description text,
    category character varying(50),
    is_public boolean DEFAULT false,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid
);


--
-- Name: TABLE settings; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.settings IS 'Platform-wide configuration settings';


--
-- Name: COLUMN settings.config_key; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.settings.config_key IS 'Unique key for the setting (e.g., platform.name, email.sender)';


--
-- Name: COLUMN settings.config_value; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.settings.config_value IS 'Value of the setting';


--
-- Name: COLUMN settings.value_type; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.settings.value_type IS 'Data type: string, number, boolean, json';


--
-- Name: COLUMN settings.category; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.settings.category IS 'Category for grouping settings (e.g., general, email, billing)';


--
-- Name: COLUMN settings.is_public; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.settings.is_public IS 'Whether this setting is visible to non-admin users';


--
-- Name: subscriptions; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    planid character varying(100) NOT NULL,
    planname character varying(100) NOT NULL,
    plantier character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    cancel_reason text,
    metadata jsonb,
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    modified_by uuid
);


--
-- Name: tenant_quotas; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.tenant_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_name character varying(100),
    soft_limit numeric(20,4) NOT NULL,
    hard_limit numeric(20,4) NOT NULL,
    current_usage numeric(20,4) DEFAULT 0,
    unit character varying(50) DEFAULT 'units'::character varying,
    reset_period character varying(20) DEFAULT 'monthly'::character varying,
    last_reset timestamp with time zone,
    next_reset timestamp with time zone,
    overage_rate numeric(10,4) DEFAULT 0,
    allow_overage boolean DEFAULT false,
    is_active boolean DEFAULT true,
    metadata jsonb,
    created_by uuid,
    modified_by uuid,
    created_on timestamp with time zone DEFAULT now(),
    modified_on timestamp with time zone DEFAULT now(),
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT chk_quota_metric_type CHECK (((metric_type)::text = ANY ((ARRAY['api_calls'::character varying, 'storage_gb'::character varying, 'users'::character varying, 'workflows'::character varying, 'integrations'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT chk_reset_period CHECK (((reset_period)::text = ANY ((ARRAY['hourly'::character varying, 'daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'yearly'::character varying, 'never'::character varying])::text[])))
);


--
-- Name: tenants; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.tenants (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    name character varying(100) NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    key character varying(20) NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    spoc_user_id uuid,
    lead_id uuid,
    domains character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    address_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    identity_provider character varying(50) DEFAULT 'keycloak'::character varying NOT NULL,
    schema_name character varying(100),
    CONSTRAINT tenants_identity_provider_check CHECK (((identity_provider)::text = ANY ((ARRAY['keycloak'::character varying, 'auth0'::character varying, 'cognito'::character varying])::text[])))
);


--
-- Name: COLUMN tenants.identity_provider; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.tenants.identity_provider IS 'Identity provider type: keycloak, auth0, or cognito';


--
-- Name: usage_events; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_name character varying(100),
    quantity numeric(20,4) DEFAULT 1 NOT NULL,
    unit character varying(50) DEFAULT 'units'::character varying,
    event_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    billing_period character varying(7),
    source character varying(100),
    resource_id character varying(255),
    metadata jsonb,
    created_by uuid,
    modified_by uuid,
    created_on timestamp with time zone DEFAULT now(),
    modified_on timestamp with time zone DEFAULT now(),
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT chk_metric_type CHECK (((metric_type)::text = ANY ((ARRAY['api_calls'::character varying, 'storage_gb'::character varying, 'users'::character varying, 'workflows'::character varying, 'integrations'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: usage_summaries; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.usage_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    billing_period character varying(7) NOT NULL,
    total_quantity numeric(20,4) DEFAULT 0 NOT NULL,
    included_quantity numeric(20,4) DEFAULT 0,
    overage_quantity numeric(20,4) DEFAULT 0,
    overage_amount numeric(20,4) DEFAULT 0,
    unit character varying(50) DEFAULT 'units'::character varying,
    event_count integer DEFAULT 0,
    peak_usage numeric(20,4),
    average_usage numeric(20,4),
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    last_updated timestamp with time zone DEFAULT now(),
    metadata jsonb,
    created_by uuid,
    modified_by uuid,
    created_on timestamp with time zone DEFAULT now(),
    modified_on timestamp with time zone DEFAULT now(),
    deleted boolean DEFAULT false,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT chk_summary_metric_type CHECK (((metric_type)::text = ANY ((ARRAY['api_calls'::character varying, 'storage_gb'::character varying, 'users'::character varying, 'workflows'::character varying, 'integrations'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: user_activities; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.user_activities (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    metadata jsonb,
    ip_address character varying(45),
    user_agent text,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE user_activities; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.user_activities IS 'User activity log for audit trail and user behavior tracking';


--
-- Name: COLUMN user_activities.action; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_activities.action IS 'Action identifier (e.g., user.created, user.login, user.role_changed)';


--
-- Name: COLUMN user_activities.entity_type; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_activities.entity_type IS 'Type of entity affected by the action';


--
-- Name: COLUMN user_activities.entity_id; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_activities.entity_id IS 'UUID of the affected entity';


--
-- Name: COLUMN user_activities.metadata; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_activities.metadata IS 'JSON metadata containing additional context (changed fields, IP, user agent, etc.)';


--
-- Name: COLUMN user_activities.occurred_at; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_activities.occurred_at IS 'Timestamp when the activity occurred';


--
-- Name: user_invitations; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.user_invitations (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    role_key character varying(50) NOT NULL,
    invited_by uuid NOT NULL,
    tenant_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    first_name character varying(100),
    last_name character varying(100),
    custom_message text,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid,
    last_email_sent_at timestamp with time zone,
    resend_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT ck_user_invitations_expires_future CHECK ((expires_at > created_on)),
    CONSTRAINT ck_user_invitations_token_length CHECK ((length((token)::text) >= 32))
);


--
-- Name: TABLE user_invitations; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.user_invitations IS 'User invitation tokens with role assignment and expiration tracking';


--
-- Name: COLUMN user_invitations.token; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.token IS 'Secure random token embedded in invitation link';


--
-- Name: COLUMN user_invitations.expires_at; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.expires_at IS 'Invitation expiration timestamp (typically created_on + 7 days)';


--
-- Name: COLUMN user_invitations.status; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.status IS '0=pending, 1=accepted, 2=expired, 3=revoked';


--
-- Name: COLUMN user_invitations.custom_message; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.custom_message IS 'Optional personalized message from inviter';


--
-- Name: COLUMN user_invitations.last_email_sent_at; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.last_email_sent_at IS 'Timestamp of last email sent (for 5-minute cooldown enforcement)';


--
-- Name: COLUMN user_invitations.resend_count; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_invitations.resend_count IS 'Number of times invitation has been resent (max 5)';


--
-- Name: user_roles; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.user_roles (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    user_id uuid NOT NULL,
    role_key character varying(50) NOT NULL,
    permissions text[],
    scope_type character varying(50) DEFAULT 'tenant'::character varying NOT NULL,
    scope_id uuid,
    tenant_id uuid NOT NULL,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.user_roles IS 'User role assignments with support for tenant, workspace, and project level permissions';


--
-- Name: COLUMN user_roles.role_key; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_roles.role_key IS 'Role identifier (admin, member, billing_manager, viewer, etc.)';


--
-- Name: COLUMN user_roles.permissions; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_roles.permissions IS 'Array of permission codes granted by this role';


--
-- Name: COLUMN user_roles.scope_type; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_roles.scope_type IS 'Scope of the role: tenant (org-wide), workspace, or project';


--
-- Name: COLUMN user_roles.scope_id; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.user_roles.scope_id IS 'NULL for tenant-level roles, otherwise references workspace or project';


--
-- Name: users; Type: TABLE; Schema: main; Owner: -
--

CREATE TABLE main.users (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    auth_id character varying(255),
    status smallint DEFAULT 0 NOT NULL,
    tenant_id uuid NOT NULL,
    phone character varying(50),
    avatar_url character varying(500),
    last_login timestamp with time zone,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamp with time zone,
    deleted_by uuid
);


--
-- Name: TABLE users; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON TABLE main.users IS 'User accounts with multi-tenant support and Keycloak SSO integration';


--
-- Name: COLUMN users.auth_id; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.users.auth_id IS 'Keycloak user UUID for SSO authentication';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: main; Owner: -
--

COMMENT ON COLUMN main.users.status IS '0=pending, 1=active, 2=suspended, 3=deactivated';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(100) NOT NULL,
    actor_id uuid NOT NULL,
    actor_name character varying(200),
    actor_email character varying(255),
    target_type character varying(50),
    target_id uuid,
    target_name character varying(200),
    tenant_id uuid,
    tenant_name character varying(200),
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: migrations_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations_state (
    key character varying NOT NULL,
    value text NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: notification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id character varying(100),
    tenant_id uuid,
    user_id uuid,
    channel character varying(50),
    template_id character varying(100),
    status character varying(20),
    sent_at timestamp with time zone DEFAULT now(),
    error_message text,
    metadata jsonb
);


--
-- Name: invoices; Type: TABLE; Schema: subscription; Owner: -
--

CREATE TABLE subscription.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subscription_id uuid,
    tenant_id uuid NOT NULL,
    invoice_number character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    subtotal numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    currency character varying(3) DEFAULT 'USD'::character varying,
    issue_date timestamp with time zone DEFAULT now(),
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    stripe_invoice_id character varying(200),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: plans; Type: TABLE; Schema: subscription; Owner: -
--

CREATE TABLE subscription.plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    price_monthly numeric(10,2) DEFAULT 0,
    price_yearly numeric(10,2) DEFAULT 0,
    currency character varying(3) DEFAULT 'USD'::character varying,
    features jsonb DEFAULT '[]'::jsonb,
    limits jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    is_public boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscriptions; Type: TABLE; Schema: subscription; Owner: -
--

CREATE TABLE subscription.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status subscription.subscription_status DEFAULT 'active'::subscription.subscription_status,
    billing_interval subscription.billing_interval DEFAULT 'monthly'::subscription.billing_interval,
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    trial_end_date timestamp with time zone,
    canceled_at timestamp with time zone,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    stripe_subscription_id character varying(200),
    stripe_customer_id character varying(200),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    address jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255),
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_items; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(15,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    total_amount numeric(15,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    customer_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100),
    description text,
    price numeric(15,2),
    stock_quantity integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: settings; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(255) NOT NULL,
    value jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: tenant_123; Owner: -
--

CREATE TABLE tenant_123.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: tenant_demo; Owner: -
--

CREATE TABLE tenant_demo.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    total numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: tenant_demo; Owner: -
--

CREATE TABLE tenant_demo.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2),
    sku character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: tenant_demo; Owner: -
--

CREATE TABLE tenant_demo.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    role character varying(50) DEFAULT 'user'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.addresses (id, address, city, state, zip, country, created_on, modified_on, deleted, deleted_on, deleted_by, created_by, modified_by) FROM stdin;
8f61468f-cad0-4ee2-460d-af9807c2d4c9	456 Oak Ave	San Francisco	CA	94102	US	2025-12-04 18:31:33.842+00	2025-12-04 18:31:33.842+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
e2fe805c-49fe-2e95-0c10-2e856933a685	789 Pine St	Boston	MA	02101	US	2025-12-04 18:33:53.863+00	2025-12-04 18:33:53.863+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
6d30721a-d35e-da8e-62b1-af4ebe73c231	456 Tech Ave	New York	NY	10001	US	2025-12-05 18:28:04.023+00	2025-12-05 18:28:04.023+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
1284b3f8-d797-9d70-f430-c0448835b699	789 Innovation Dr	Austin	TX	73301	US	2025-12-05 18:29:29.317+00	2025-12-05 18:29:29.317+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
ce02f523-fd6f-aeb5-1e75-f229092067d3	123 Test St	Seattle	WA	98101	US	2025-12-05 18:47:35.493+00	2025-12-05 18:47:35.493+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
f24a26b2-a493-8417-3532-2e24bb382ef5	123 Test St	Seattle	WA	98101	US	2025-12-05 18:47:54.129+00	2025-12-05 18:47:54.129+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
6513a532-1aca-67f1-a7f0-bf7d382a042c	100 Main St	Boston	MA	02101	US	2025-12-05 18:54:55.058+00	2025-12-05 18:54:55.058+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
23ebd58f-0517-2522-d98d-5127df64c805	100 Main St	Boston	MA	02101	US	2025-12-05 18:57:33.765+00	2025-12-05 18:57:33.765+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
95994da8-84bb-f9fd-b6b8-af88e733359e	123 Test St	Test City	CA	12345	US	2025-12-08 08:40:33.315+00	2025-12-08 08:40:33.315+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
242768fe-c335-11bc-5a3d-d530b98e115b	456 Test Ave	Test City	CA	12345	US	2025-12-08 08:41:02.587+00	2025-12-08 08:41:02.587+00	f	\N	\N	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.audit_logs (id, action, actor_id, actor_name, actor_email, target_type, target_id, target_name, tenant_id, tenant_name, details, ip_address, user_agent, status, "timestamp") FROM stdin;
3e585d35-743e-4e01-b4de-71d26fcfe7d5	USER_LOGIN	12345678-1234-4234-8234-1234567890ab	Test Admin	admin@example.com	user	12345678-1234-4234-8234-1234567890ab	Test Admin	12345678-1234-4234-8234-1234567890ab	Test Tenant	{"os": "Windows", "browser": "Chrome"}	192.168.1.100	\N	success	2025-12-09 01:44:56.057039+00
2fb09463-0697-4275-b822-b0227f40ed43	TENANT_UPDATED	12345678-1234-4234-8234-1234567890ab	Test Admin	admin@example.com	tenant	12345678-1234-4234-8234-1234567890ab	Test Tenant	12345678-1234-4234-8234-1234567890ab	Test Tenant	{"field": "name", "newValue": "Test Tenant", "oldValue": "Old Tenant"}	192.168.1.100	\N	success	2025-12-09 01:44:56.057039+00
3fc96cc8-c5c2-437d-901e-23cf3a305cfb	TENANT_PROVISIONED	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	\N	tenant	192d8f6d-a49a-8731-622b-03c285caa1ce	def	192d8f6d-a49a-8731-622b-03c285caa1ce	def	{"planId": "plan-basic"}	\N	\N	success	2025-12-10 19:10:52.891+00
6ad1c9ae-d076-4929-baad-5f0e60e69128	USER_CREATED	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	\N	user	da0cb637-bd83-a79f-610f-1389952fc6f3	john.doe@def-company.com	192d8f6d-a49a-8731-622b-03c285caa1ce	\N	\N	\N	\N	success	2025-12-10 19:13:47.858+00
9fcd49c7-655f-484d-9a9d-bf01bfafda28	ROLE_ASSIGNED	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	\N	role	da0cb637-bd83-a79f-610f-1389952fc6f3	admin	192d8f6d-a49a-8731-622b-03c285caa1ce	\N	{"userId": "da0cb637-bd83-a79f-610f-1389952fc6f3", "roleKey": "admin", "userEmail": "john.doe@def-company.com"}	\N	\N	success	2025-12-10 19:47:06.316+00
9c655d8b-c1a9-4788-a59b-101a3f77c70c	ROLE_ASSIGNED	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	\N	role	da0cb637-bd83-a79f-610f-1389952fc6f3	staff	192d8f6d-a49a-8731-622b-03c285caa1ce	\N	{"userId": "da0cb637-bd83-a79f-610f-1389952fc6f3", "roleKey": "staff", "userEmail": "john.doe@def-company.com"}	\N	\N	success	2025-12-10 19:47:42.712+00
da6056fe-5b4e-4176-8c97-fd00df37f572	ROLE_ASSIGNED	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	\N	role	da0cb637-bd83-a79f-610f-1389952fc6f3	member	192d8f6d-a49a-8731-622b-03c285caa1ce	\N	{"userId": "da0cb637-bd83-a79f-610f-1389952fc6f3", "roleKey": "member", "userEmail": "john.doe@def-company.com"}	\N	\N	success	2025-12-10 20:02:46.879+00
074bfe44-3346-406b-bfb4-e67d3233a9c5	TENANT_CREATED	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	\N	tenant	47ce017c-fb3f-c9d3-d009-1dcd562947cd	test234	47ce017c-fb3f-c9d3-d009-1dcd562947cd	test234	{"key": "test234", "adminEmail": "test234@abc.com"}	\N	\N	success	2025-12-11 09:01:43.49+00
92c02fba-aed8-44e0-ab8b-b7bc22c1dd81	TENANT_PROVISIONED	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	\N	tenant	47ce017c-fb3f-c9d3-d009-1dcd562947cd	test234	47ce017c-fb3f-c9d3-d009-1dcd562947cd	test234	{"planId": "plan-free"}	\N	\N	success	2025-12-11 09:01:43.787+00
82a58579-0d55-4c03-91bd-659fab1bf8e2	SETTING_CREATED	00000000-0000-4000-8000-000000000001	00000000-0000-4000-8000-000000000001	\N	setting	b6bbe73e-a96e-48cb-b784-c5bebba4261c	test.setting.1765528602599	28e81841-5af9-4f93-83aa-889c21709f54	\N	\N	\N	\N	success	2025-12-12 08:36:42.614+00
45b1620a-ef08-4673-b076-0fa798a43106	SETTING_DELETED	00000000-0000-4000-8000-000000000001	00000000-0000-4000-8000-000000000001	\N	setting	b6bbe73e-a96e-48cb-b784-c5bebba4261c	test.setting.1765528602599	28e81841-5af9-4f93-83aa-889c21709f54	\N	\N	\N	\N	success	2025-12-12 08:36:42.701+00
15cab6d2-2554-49ff-bf1b-e2e373634ccf	TENANT_CREATED	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	\N	tenant	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	{"key": "sbp", "adminEmail": "sbp@sbp.com"}	\N	\N	success	2025-12-14 03:21:29.966+00
215e4d31-ec5b-415e-8326-ccbdf9faa7f5	TENANT_PROVISIONED	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	\N	tenant	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	{"planId": "plan-free"}	\N	\N	success	2025-12-14 03:21:30.345+00
aef2b145-0b0c-4987-a455-dc56a4e815e6	TENANT_PROVISIONED	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	\N	tenant	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	{"planId": "plan-basic"}	\N	\N	success	2025-12-14 09:05:09.479+00
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.contacts (id, first_name, last_name, email, contact_type, is_primary, created_on, modified_on, created_by, modified_by, deleted, deleted_by, deleted_on, tenant_id) FROM stdin;
bb000000-0000-0000-0000-000000000001	Admin	User	admin@testcorp.com	\N	t	2025-12-05 19:00:26.534172+00	\N	\N	\N	f	\N	\N	aa000000-0000-0000-0000-000000000001
5c53d684-6b94-d10a-601b-8eb305046309	Admin	User	sid@ananta.com	\N	t	2025-12-07 15:21:23.274+00	2025-12-07 15:21:23.274+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	468224c2-82a0-6286-57e7-eff8da9982f2
6edd46eb-3a71-575b-a68d-22639fa25777	Admin	User	admin@abc.com	\N	t	2025-12-07 21:38:52.875+00	2025-12-07 21:38:52.875+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	0ce66d1c-abd6-b7b6-bcce-3d4dd4b9b2cf
72029f66-ccfb-78f8-1455-bcf68f24adb9	Admin	User	abc@xyz.com	\N	t	2025-12-08 15:18:38.596+00	2025-12-08 15:18:38.596+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	a264e5e6-7dae-e954-c01a-d082d070bfaa
71911b3c-128c-8534-4292-39719ba5b6f0	Admin	User	abc@def.com	\N	t	2025-12-08 16:05:24.836+00	2025-12-08 16:05:24.836+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	192d8f6d-a49a-8731-622b-03c285caa1ce
beb42f32-5724-7242-97d3-41abd9edd828	Admin	User	hij@abc.co	\N	t	2025-12-08 23:14:24.216+00	2025-12-08 23:14:24.216+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	cbc5389d-a6a4-02f8-d12d-7154255aaba4
cbceb597-6e2e-ee70-8bb1-bcc1f97deb58	Admin	User	123@abc.com	\N	t	2025-12-09 03:22:23.378+00	2025-12-09 03:22:23.378+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	\N	\N	85aa72ad-bdfe-602c-a492-0b712234f81d
13089ee9-c5ea-1395-2423-4c3a86ed7388	Admin	User	test234@abc.com	\N	t	2025-12-11 09:01:43.47+00	2025-12-11 09:01:43.47+00	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	f	\N	\N	47ce017c-fb3f-c9d3-d009-1dcd562947cd
a0000000-0000-0000-0000-000000000001	Platform	Administrator	platform-admin@example.com	\N	t	2025-12-12 07:27:55.773589+00	\N	\N	\N	f	\N	\N	a0000000-0000-0000-0000-000000000000
2b118e15-3046-4834-9e0c-200dc8fc6978	Admin	User	sbp@sbp.com	\N	t	2025-12-14 03:21:29.926+00	2025-12-14 03:21:29.926+00	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	f	\N	\N	ccb700dd-89b0-8ccc-8a33-538297cab396
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.feature_flags (id, name, enabled, description, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.invoices (id, tenant_id, start_date, end_date, amount, currency_code, invoice_file, due_date, status, deleted, deleted_on, deleted_by, created_on, modified_on, created_by, modified_by) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.leads (id, first_name, last_name, created_on, modified_on, deleted, deleted_on, deleted_by, email, created_by, modified_by, is_validated, company_name, address_id) FROM stdin;
bcdf9606-0aa6-d964-60a3-11d20a572586	TestE2E	User	2025-12-08 07:30:08.882+00	2025-12-08 07:30:08.883+00	f	\N	\N	teste2e_1765179008@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	Test E2E Company	\N
5d7fb073-502b-42c1-bcdc-46c92975c59c	First	Lead	2025-12-12 08:14:23.385+00	2025-12-12 08:14:23.385+00	f	\N	\N	duplicate-1765527263342@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
c084bcc4-2e92-d51b-23c6-a37500a63b6d	Fresh	Test	2025-12-08 07:32:09.028+00	2025-12-08 07:32:09.028+00	f	\N	\N	freshtest_1765179128@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	Fresh Test Company	\N
df183bca-2776-66e3-5258-7762699e81d4	Test	User	2025-12-08 08:40:33.327+00	2025-12-08 08:40:33.327+00	f	\N	\N	test-shared-temporal@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	TestCorp SharedTemporal	95994da8-84bb-f9fd-b6b8-af88e733359e
81edc544-2ac5-e95d-7ffc-0591a65b7fbf	TestTemporal	User	2025-12-08 08:41:02.592+00	2025-12-08 08:41:02.592+00	f	\N	\N	shared-temporal-test@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	SharedTemporalTest	242768fe-c335-11bc-5a3d-d530b98e115b
ee7b2812-9ae6-8728-152e-375f6cf0b5be	Test	Provision	2025-12-08 15:00:16.979+00	2025-12-08 15:00:16.979+00	f	\N	\N	test-prov-456@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	TestProvCorp	\N
b8779ebb-b893-52a9-432a-e5d14c1b5ec0	Test	User	2025-12-10 18:57:19.791+00	2025-12-10 18:57:19.791+00	f	\N	\N	testprov1765393039@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	Provision Test Corp	\N
bf3afda8-8e59-02e6-0155-47598c088ce4	Test	Lead	2025-12-12 08:01:40.024+00	2025-12-12 08:01:40.024+00	f	\N	\N	test-1765526499959@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526499959	\N
dbe26af3-19f5-a46b-d003-2c66c3271aad	John	Doe	2025-12-05 18:57:33.775+00	2025-12-05 18:57:33.775+00	f	\N	\N	test961053@acme.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	t	Acme Corp	23ebd58f-0517-2522-d98d-5127df64c805
8a00462d-14f7-b45f-e1c7-9e6b07bbadf9	Test	Lead	2025-12-07 18:57:28.401+00	2025-12-07 18:57:28.401+00	f	\N	\N	test-1765133848224@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765133848224	\N
a7a05fea-5bb1-97bb-7043-c4ef0230e66a	Test	User	2025-12-07 19:07:17.217+00	2025-12-07 19:07:17.217+00	f	\N	\N	test-1765134437@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765134437	\N
ba632042-4b34-94b2-e4f0-4bb5f09003f8	CRUD	Test	2025-12-07 20:11:33.482+00	2025-12-07 20:11:33.482+00	f	\N	\N	crudtest@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	CRUD Test Corp	\N
e6ff65df-6dd2-42dc-1877-4e82ae7e2232	Test	Lead	2025-12-07 20:31:33.758+00	2025-12-07 20:31:33.758+00	f	\N	\N	test-1765139493657@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765139493657	\N
f380818f-a28a-8fd5-3463-6a56626c52d0	Test	Lead	2025-12-07 20:31:36.779+00	2025-12-07 20:31:36.779+00	f	\N	\N	testlead-1765139496741@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765139496741	\N
478db213-4d2c-03b9-1c3c-462e59499e8d	First	Lead	2025-12-07 20:32:06.8+00	2025-12-07 20:32:06.8+00	f	\N	\N	duplicate-1765139526754@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
9d6e9d80-5286-58e9-c607-1f67ca42934a	Second	Lead	2025-12-07 20:32:37.822+00	2025-12-07 20:32:37.822+00	f	\N	\N	duplicate-1765139526754@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
83756e6a-2373-587a-b401-a0fd3777c7f9	TestE2E	User	2025-12-08 07:12:13.587+00	2025-12-08 07:12:13.587+00	f	\N	\N	teste2e_1733648123@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test E2E Company	\N
bc9719dd-4158-6d05-b319-90f287ad2228	TestE2E	User	2025-12-08 07:14:45.276+00	2025-12-08 07:14:45.276+00	f	\N	\N	teste2e_new@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test E2E Company	\N
43053d2a-f45e-1cd3-76a2-c8a6ac166cac	Test	Lead	2025-12-12 08:01:42.5+00	2025-12-12 08:01:42.5+00	f	\N	\N	testlead-1765526502455@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526502455	\N
28f04cb2-f7cd-9c29-7c13-74e50d46947d	First	Lead	2025-12-12 08:02:12.507+00	2025-12-12 08:02:12.507+00	f	\N	\N	duplicate-1765526532466@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
1e2508b6-38a8-8161-d4c7-f0e8ff976698	Second	Lead	2025-12-12 08:02:44.456+00	2025-12-12 08:02:44.456+00	f	\N	\N	duplicate-1765526532466@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
2c1291ab-d8f9-4bb0-3185-d8603699501f	Test	Lead	2025-12-12 08:04:40.659+00	2025-12-12 08:04:40.659+00	f	\N	\N	test-1765526680633@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526680633	\N
0e65a71e-5e8b-dbcf-fe46-f7f56372cb05	Test	Lead	2025-12-12 08:04:42.958+00	2025-12-12 08:04:42.958+00	f	\N	\N	testlead-1765526682912@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526682912	\N
b97dc8ef-a95e-6fcc-71c4-0035851ebf5c	First	Lead	2025-12-12 08:04:48.79+00	2025-12-12 08:04:48.79+00	f	\N	\N	duplicate-1765526688766@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
34a72d90-8893-57ac-9324-6290683fe68e	Test	Lead	2025-12-12 08:05:20.367+00	2025-12-12 08:05:20.367+00	f	\N	\N	test-1765526720338@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526720338	\N
c88c20c9-272b-23ee-0d5d-2e9993d4d441	Test	Lead	2025-12-12 08:05:22.644+00	2025-12-12 08:05:22.644+00	f	\N	\N	testlead-1765526722598@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526722598	\N
3d4963d0-04d2-69e8-ebe0-f3fb1bf0dfff	Test	Lead	2025-12-12 08:05:53.589+00	2025-12-12 08:05:53.589+00	f	\N	\N	test-1765526753555@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526753555	\N
6228941e-45dc-90a3-70e9-3b90334598db	Test	Lead	2025-12-12 08:05:55.918+00	2025-12-12 08:05:55.918+00	f	\N	\N	testlead-1765526755876@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526755876	\N
eab19865-c660-5ef2-8e88-954a00fa2398	Test	Lead	2025-12-12 08:06:35.114+00	2025-12-12 08:06:35.114+00	f	\N	\N	test-1765526795085@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526795085	\N
d6aebac9-ef19-4af2-e256-2c6dbd4c9ec3	Test	Lead	2025-12-12 08:06:37.39+00	2025-12-12 08:06:37.39+00	f	\N	\N	testlead-1765526797340@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526797340	\N
10cc53c6-d670-6d1c-2da7-cc553f773219	Test	Lead	2025-12-12 08:07:35.008+00	2025-12-12 08:07:35.008+00	f	\N	\N	test-1765526854969@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526854969	\N
65770abd-6114-f54c-89e3-185f29b650da	Test	Lead	2025-12-12 08:07:37.216+00	2025-12-12 08:07:37.216+00	f	\N	\N	testlead-1765526857159@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526857159	\N
1c689761-7341-d93b-0b62-ffdf847a719e	Test	Lead	2025-12-12 08:08:29.396+00	2025-12-12 08:08:29.396+00	f	\N	\N	test-1765526909364@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765526909364	\N
144ebd61-4b55-4a42-a9d9-0fe28e0c3233	Test	Lead	2025-12-12 08:12:00.374+00	2025-12-12 08:12:00.374+00	f	\N	\N	test-1765527120317@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527120317	\N
49efa6e5-ade3-ca60-c87a-b2162454d2a9	Test	Lead	2025-12-12 08:12:02.967+00	2025-12-12 08:12:02.967+00	f	\N	\N	testlead-1765527122923@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527122923	\N
6b4e4dfc-8757-d405-a5e7-e09094a2475f	Test	Lead	2025-12-12 08:13:50.855+00	2025-12-12 08:13:50.855+00	f	\N	\N	test-1765527230824@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527230824	\N
bb1a4157-9a3c-c67a-9184-d5a577492af9	Test	Lead	2025-12-12 08:13:53.378+00	2025-12-12 08:13:53.378+00	f	\N	\N	testlead-1765527233334@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527233334	\N
d32b9597-b050-27f4-2ea4-1b61fb41d607	Second	Lead	2025-12-12 08:14:55.084+00	2025-12-12 08:14:55.084+00	f	\N	\N	duplicate-1765527263342@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
7df33eae-0716-a395-a44e-5a20d9181a46	Test	Lead	2025-12-12 08:15:23.199+00	2025-12-12 08:15:23.199+00	f	\N	\N	test-1765527323162@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527323162	\N
ab695cb9-9dce-7fe7-d0de-101ca1174519	Test	Lead	2025-12-12 08:15:25.315+00	2025-12-12 08:15:25.315+00	f	\N	\N	testlead-1765527325269@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527325269	\N
0eca46c4-8d3c-bd18-3d8b-ce8f64e0d70e	First	Lead	2025-12-12 08:15:55.318+00	2025-12-12 08:15:55.318+00	f	\N	\N	duplicate-1765527355274@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
c0e3ba08-c15f-ac37-09ff-808d9138db4a	Test	Lead	2025-12-12 08:16:56.155+00	2025-12-12 08:16:56.155+00	f	\N	\N	test-1765527416120@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527416120	\N
347e8ddb-280b-7d89-dbed-14bda29f4eb1	Test	Lead	2025-12-12 08:16:58.435+00	2025-12-12 08:16:58.435+00	f	\N	\N	testlead-1765527418391@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527418391	\N
d0229061-1f89-88ba-02b0-00da6f55e343	First	Lead	2025-12-12 08:17:28.441+00	2025-12-12 08:17:28.441+00	f	\N	\N	duplicate-1765527448394@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
f677a29c-f1e9-4b8c-161e-a16a6e845e15	Test	Lead	2025-12-12 08:18:31.274+00	2025-12-12 08:18:31.274+00	f	\N	\N	test-1765527511221@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527511221	\N
e712015e-ea04-faa3-ec28-c60fee54c34d	Test	Lead	2025-12-12 08:18:33.677+00	2025-12-12 08:18:33.677+00	f	\N	\N	testlead-1765527513634@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765527513634	\N
36be389e-6277-0a1c-ca5d-e9932de5c0fe	First	Lead	2025-12-12 08:19:03.688+00	2025-12-12 08:19:03.688+00	f	\N	\N	duplicate-1765527543645@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
fac66885-2ef7-51d3-28a9-4c7d59f108d6	Second	Lead	2025-12-12 08:19:34.584+00	2025-12-12 08:19:34.584+00	f	\N	\N	duplicate-1765527543645@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
b6836e91-2b82-0eee-ce05-8852717104d7	Test	Lead	2025-12-12 08:32:52.657+00	2025-12-12 08:32:52.657+00	f	\N	\N	test-1765528372564@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765528372564	\N
9b150b76-028c-2c70-4059-bf0d3e52d942	Test	Lead	2025-12-12 08:32:54.984+00	2025-12-12 08:32:54.984+00	f	\N	\N	testlead-1765528374940@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765528374940	\N
b031c0e0-a012-8b95-29bf-7e24b38770d8	First	Lead	2025-12-12 08:33:24.988+00	2025-12-12 08:33:24.988+00	f	\N	\N	duplicate-1765528404952@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
60b0ada8-0bbf-9903-47b3-081fc676263c	Second	Lead	2025-12-12 08:33:56.843+00	2025-12-12 08:33:56.843+00	f	\N	\N	duplicate-1765528404952@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
8527f580-8dcf-ec56-4dab-e4fa3f4ba1bd	Test	Lead	2025-12-12 08:35:39.913+00	2025-12-12 08:35:39.913+00	f	\N	\N	test-1765528539886@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765528539886	\N
7eaea822-4c04-0c38-32fd-ff6e609bf497	Test	Lead	2025-12-12 08:35:42.125+00	2025-12-12 08:35:42.125+00	f	\N	\N	testlead-1765528542081@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Test Company 1765528542081	\N
d97baf1b-f923-1ce4-77df-26b8bfcfd651	First	Lead	2025-12-12 08:36:12.136+00	2025-12-12 08:36:12.136+00	f	\N	\N	duplicate-1765528572094@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 1	\N
8fa5bda0-44b8-d14a-c9cb-af34d02898f9	Second	Lead	2025-12-12 08:36:43.19+00	2025-12-12 08:36:43.19+00	f	\N	\N	duplicate-1765528572094@example.com	00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000000	f	Company 2	\N
ad288279-8623-c130-c3a5-e953a1dbddc8	Test	User	2025-12-13 23:26:34.641+00	2025-12-13 23:26:34.641+00	f	\N	\N	testuser@example.com	\N	\N	f	Test Company	\N
165165e0-c380-7146-900b-c6a408ca2963	Proxy	Test	2025-12-13 23:29:41.06+00	2025-12-13 23:29:41.06+00	f	\N	\N	proxytest@example.com	\N	\N	f	Proxy Test Co	\N
7a5cfb11-fc21-20cd-1040-050be29a5266	Proxy	Test	2025-12-13 23:29:50.921+00	2025-12-13 23:29:50.921+00	f	\N	\N	proxytest2@example.com	\N	\N	f	Proxy Test	\N
55a0dc50-569c-56f8-677f-d99aa1069d42	Test3	User	2025-12-13 23:30:00.135+00	2025-12-13 23:30:00.135+00	f	\N	\N	test3user@example.com	\N	\N	f	Test Co	\N
0aace9c0-904c-7406-7c1b-781f197fa4d1	K	P	2025-12-14 03:50:00.477+00	2025-12-14 03:50:00.477+00	f	\N	\N	Kris@Patel.com	\N	\N	f	Globe inc	\N
cb919331-cf64-a352-1187-d537b14d74bd	K	P	2025-12-14 09:30:59.971+00	2025-12-14 09:30:59.971+00	f	\N	\N	Kris@Patel.com	\N	\N	f	Globe inc	\N
\.


--
-- Data for Name: notification_history; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.notification_history (id, tenant_id, workflow_id, workflow_name, subscriber_id, channel, status, recipient_email, recipient_phone, subject, payload, transaction_id, novu_message_id, attempts, error_message, error_code, sent_at, delivered_at, opened_at, clicked_at, category, metadata, created_by, modified_by, created_on, modified_on, deleted, deleted_on, deleted_by) FROM stdin;
\.


--
-- Data for Name: payment_intents; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.payment_intents (id, tenant_id, invoice_id, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id, amount, currency, status, client_secret, description, receipt_email, failure_code, failure_message, succeeded_at, cancelled_at, cancellation_reason, amount_received, metadata, deleted, deleted_on, deleted_by, created_on, modified_on, created_by, modified_by) FROM stdin;
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.payment_methods (id, tenant_id, stripe_payment_method_id, stripe_customer_id, type, card_details, bank_account_details, is_default, billing_name, billing_email, billing_address, metadata, deleted, deleted_on, deleted_by, created_on, modified_on, created_by, modified_by) FROM stdin;
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.plans (id, name, description, tier, price, billing_cycle, features, is_active, limits, trial_enabled, trial_duration, trial_duration_unit, stripe_product_id, stripe_price_id, is_popular, sort_order, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by) FROM stdin;
plan-basic	Basic	Perfect for small teams getting started	BASIC	29.00	month	["Up to 5 users", "10 GB storage", "Email support", "Basic analytics", "API access"]	t	{"maxUsers": 5, "maxStorage": 10, "maxApiCalls": 10000, "maxProjects": 10}	f	14	days	\N	\N	f	1	2025-12-13 06:48:57.774+00	2025-12-13 06:48:57.774+00	\N	\N	f	\N	\N
plan-standard	Standard	Best for growing businesses	STANDARD	79.00	month	["Up to 25 users", "100 GB storage", "Priority email support", "Advanced analytics", "API access", "Custom integrations", "SSO authentication"]	t	{"maxUsers": 25, "maxStorage": 100, "maxApiCalls": 100000, "maxProjects": 50}	f	14	days	\N	\N	t	2	2025-12-13 06:48:57.78+00	2025-12-13 06:48:57.78+00	\N	\N	f	\N	\N
plan-premium	Premium	For enterprises with advanced needs	PREMIUM	199.00	month	["Unlimited users", "1 TB storage", "24/7 phone & email support", "Enterprise analytics", "Unlimited API access", "Custom integrations", "SSO authentication", "Dedicated account manager", "Custom SLA", "On-premise deployment option"]	t	{"maxUsers": null, "maxStorage": 1000, "maxApiCalls": null, "maxProjects": null}	f	14	days	\N	\N	f	3	2025-12-13 06:48:57.786+00	2025-12-13 06:48:57.786+00	\N	\N	f	\N	\N
plan-free	Free	Get started for free - perfect for personal projects	FREE	0.00	month	["1 user", "1 GB storage", "Community support", "Basic analytics"]	t	{"maxUsers": 1, "maxStorage": 1, "maxApiCalls": 1000, "maxProjects": 3}	f	14	days			f	0	2025-12-13 06:48:57.749+00	2025-12-13 06:48:57.749+00	\N	\N	f	\N	\N
\.


--
-- Data for Name: platform_config; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.platform_config (id, key, value, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resources; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.resources (id, type, metadata, external_identifier, tenant_id, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.settings (id, config_key, config_value, value_type, description, category, is_public, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by) FROM stdin;
107a25a3-0ef4-42fa-886f-a032f503234b	platform.name	ARC SaaS	string	Platform display name	general	t	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
595b2a60-3754-487f-91bd-031333bf548b	platform.support_email	support@example.com	string	Support contact email	general	t	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
d9844bd4-cc23-4df1-af7a-cd452f4adcfa	billing.trial_days	14	number	Number of days for trial period	billing	f	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
c3ce2671-1f43-4f73-a9e8-d5d9e0843f0e	billing.currency	USD	string	Default billing currency	billing	t	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
17152535-8555-492d-b1ca-fb3305eb0789	email.from_name	ARC SaaS	string	Default sender name for emails	email	f	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
4d5e6df9-6696-46e9-b477-f25e00d8ae82	email.from_address	noreply@example.com	string	Default sender email address	email	f	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
09b88715-e042-4d23-9fdc-e3494aa3fd61	tenant.max_users_default	10	number	Default max users for new tenants	tenant	f	2025-12-07 19:26:19.310484+00	2025-12-07 19:26:19.310484+00	\N	\N	f	\N	\N
33655ef2-143f-4dd6-b7ae-e60af6c01907	test.audit.setting	test-value-123	string	\N	\N	f	2025-12-09 02:31:19.734+00	2025-12-09 02:31:19.734+00	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	f	\N	\N
af5316aa-d496-4d90-ac5d-c6ba08d2b34a	platform.super_admin_tenant_id	a0000000-0000-0000-0000-000000000000	string	The tenant ID for the Platform Super Admin organization. This is a system tenant for platform administration.	platform	f	2025-12-12 07:27:55.773589+00	2025-12-12 07:27:55.773589+00	\N	\N	f	\N	\N
b6bbe73e-a96e-48cb-b784-c5bebba4261c	test.setting.1765528602599	test-value	string	Test setting for integration tests	test	f	2025-12-12 08:36:42.608+00	2025-12-12 08:36:42.608+00	28e81841-5af9-4f93-83aa-889c21709f54	28e81841-5af9-4f93-83aa-889c21709f54	t	2025-12-12 08:36:42.697+00	00000000-0000-4000-8000-000000000001
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.subscriptions (id, tenant_id, planid, planname, plantier, status, current_period_start, current_period_end, trial_start, trial_end, amount, currency, billing_cycle, cancel_at_period_end, canceled_at, cancel_reason, metadata, deleted, deleted_on, deleted_by, created_on, modified_on, created_by, modified_by) FROM stdin;
8c8cca08-137f-41c7-8f67-27d36bad6f1a	468224c2-82a0-6286-57e7-eff8da9982f2	plan-basic	Basic	BASIC	active	2025-12-07 15:24:56.005+00	2026-01-07 15:24:56.007+00	\N	\N	29.00	USD	monthly	f	\N	\N	\N	f	\N	\N	2025-12-07 23:24:56.09+00	2025-12-07 23:24:56.09+00	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab
\.


--
-- Data for Name: tenant_quotas; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.tenant_quotas (id, tenant_id, metric_type, metric_name, soft_limit, hard_limit, current_usage, unit, reset_period, last_reset, next_reset, overage_rate, allow_overage, is_active, metadata, created_by, modified_by, created_on, modified_on, deleted, deleted_on, deleted_by) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.tenants (id, name, status, created_on, modified_on, created_by, modified_by, deleted, key, deleted_on, deleted_by, spoc_user_id, lead_id, domains, address_id, metadata, identity_provider, schema_name) FROM stdin;
47ce017c-fb3f-c9d3-d009-1dcd562947cd	test234	2	2025-12-11 09:01:43.458+00	2025-12-11 09:01:43.458+00	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	f	test234	\N	\N	\N	\N	{test234.localhost,abc.com}	\N	{}	keycloak	\N
a0000000-0000-0000-0000-000000000000	Platform Super Admin	0	2025-12-11 02:12:24.296058+00	2025-12-12 07:27:55.773589+00	\N	\N	f	platform	\N	\N	\N	\N	{platform.local}	\N	{}	keycloak	\N
ccb700dd-89b0-8ccc-8a33-538297cab396	SBP	3	2025-12-14 03:21:29.912+00	2025-12-14 09:05:34.025393+00	0966c907-8395-4fff-b801-032b074c4bc4	0966c907-8395-4fff-b801-032b074c4bc4	f	sbp	\N	\N	\N	\N	{sbp.localhost,sbp.com}	\N	{"error": "Activity task failed", "failedAt": "compensation", "appPlaneUrl": "https://sbp.app.example.com", "provisionedAt": "2025-12-14T09:05:16.758Z", "statusMessage": "Provisioning failed: Activity task failed", "lastStatusUpdate": "2025-12-14T09:05:34.025Z", "compensationExecuted": true}	keycloak	\N
85aa72ad-bdfe-602c-a492-0b712234f81d	123	3	2025-12-09 03:22:23.371+00	2025-12-09 04:02:47.069733+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	123	\N	\N	\N	\N	{123.localhost,abc.com}	\N	{"error": "Activity task failed", "failedAt": "compensation", "statusMessage": "Provisioning failed: Activity task failed", "lastStatusUpdate": "2025-12-09T04:02:47.207Z", "compensationExecuted": true}	keycloak	\N
aa000000-0000-0000-0000-000000000001	TestCorp Inc	1	2025-12-05 19:00:26.534172+00	2025-12-05 19:00:26.534172+00	\N	\N	f	testcorp	\N	\N	\N	\N	{}	\N	{}	keycloak	\N
a264e5e6-7dae-e954-c01a-d082d070bfaa	xyz	3	2025-12-08 15:18:38.592+00	2025-12-08 16:04:42.108851+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	xyz	\N	\N	\N	\N	{xyz.localhost,xyz.com}	\N	{"error": "Activity task failed", "failedAt": "compensation", "statusMessage": "Provisioning failed: Activity task failed", "lastStatusUpdate": "2025-12-08T16:04:41.313Z", "compensationExecuted": true}	keycloak	\N
468224c2-82a0-6286-57e7-eff8da9982f2	Ananta	1	2025-12-07 15:21:23.258+00	2025-12-07 15:21:23.258+00	409704f5-19b1-4bde-bcee-705a1c2d878a	12345678-1234-4234-8234-1234567890ab	f	ananta	\N	\N	\N	\N	{ananta.localhost,ananta.com}	\N	{}	keycloak	\N
cbc5389d-a6a4-02f8-d12d-7154255aaba4	hij	3	2025-12-08 23:14:24.207+00	2025-12-08 23:14:24.207+00	409704f5-19b1-4bde-bcee-705a1c2d878a	409704f5-19b1-4bde-bcee-705a1c2d878a	f	hij	\N	\N	\N	\N	{hij.localhost,abc.co}	\N	{}	keycloak	\N
192d8f6d-a49a-8731-622b-03c285caa1ce	def	3	2025-12-08 16:05:24.829+00	2025-12-10 19:11:13.484817+00	409704f5-19b1-4bde-bcee-705a1c2d878a	12345678-1234-4234-8234-1234567890ab	f	def	\N	\N	\N	\N	{def.localhost,def.com}	\N	{"error": "Activity task failed", "failedAt": "compensation", "appPlaneUrl": "https://def.app.example.com", "provisionedAt": "2025-12-10T19:10:55.731Z", "statusMessage": "Provisioning failed: Activity task failed", "lastStatusUpdate": "2025-12-10T19:11:13.536Z", "compensationExecuted": true}	keycloak	\N
bb000000-0000-0000-0000-000000000002	Provision Test	0	2025-12-08 15:07:21.827648+00	2025-12-08 15:07:21.827648+00	\N	\N	f	provtest	\N	\N	\N	\N	{}	\N	{}	keycloak	\N
cc000000-0000-0000-0000-000000000003	New Provision Test	0	2025-12-08 15:09:28.109632+00	2025-12-08 15:09:28.109632+00	\N	\N	f	newtest	\N	\N	\N	\N	{}	\N	{}	keycloak	\N
0ce66d1c-abd6-b7b6-bcce-3d4dd4b9b2cf	abc	0	2025-12-07 21:38:52.869+00	2025-12-08 08:43:18.043893+00	409704f5-19b1-4bde-bcee-705a1c2d878a	12345678-1234-4234-8234-1234567890ab	f	abc	\N	\N	\N	\N	{abc.localhost,abc.com}	\N	{"error": "Activity task failed", "failedAt": "compensation", "statusMessage": "Provisioning failed: Activity task failed", "lastStatusUpdate": "2025-12-08T08:43:17.551Z", "compensationExecuted": true}	keycloak	\N
\.


--
-- Data for Name: usage_events; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.usage_events (id, tenant_id, metric_type, metric_name, quantity, unit, event_timestamp, billing_period, source, resource_id, metadata, created_by, modified_by, created_on, modified_on, deleted, deleted_on, deleted_by) FROM stdin;
\.


--
-- Data for Name: usage_summaries; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.usage_summaries (id, tenant_id, metric_type, billing_period, total_quantity, included_quantity, overage_quantity, overage_amount, unit, event_count, peak_usage, average_usage, period_start, period_end, last_updated, metadata, created_by, modified_by, created_on, modified_on, deleted, deleted_on, deleted_by) FROM stdin;
\.


--
-- Data for Name: user_activities; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.user_activities (id, user_id, tenant_id, action, entity_type, entity_id, metadata, ip_address, user_agent, occurred_at) FROM stdin;
a3d5c710-5d8f-ad13-ecc1-2a0cc717b036	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	12bd450a-ba0c-1b9f-342c-56d494c8445e	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 06:22:16.429+00
2080ee8b-32d5-2f5d-b90e-2feca3420bf6	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	fadd8c19-9ad1-3794-d2cc-fc0c3f8f3d0e	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 06:25:03.472+00
2336c0d2-7770-241d-2f0c-66ac41c569ec	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	f1c08f88-6959-82be-a5cb-6e08207a7084	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 06:26:43.034+00
cb3b0886-cf0e-389b-e297-ecf21f669807	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	9712b208-c83d-a8d7-6339-3893617c8cdf	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 06:43:23.209+00
1354377f-54be-a9a5-a66c-5f13bbaa4f43	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	3a9826aa-0743-de34-e4f7-c277b4850951	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 06:44:44.929+00
aa9fc038-58b7-3215-173b-e488a1ae0d3d	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	e9f4af99-f1a6-2f8b-3a62-7b63d620f8ae	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 07:01:37.655+00
73b5e753-5c7c-6fd0-ac6c-cd04ed4c45b3	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	75784bae-84c4-3310-30e6-26b059d55039	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 07:05:00.182+00
98be9c97-3839-780b-3f1a-bfa32df990ef	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	bbb8f8c9-61e7-6676-91e4-dc30a25ed338	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 07:09:46.332+00
5c8dead9-1295-0a8d-104e-6c824506e83e	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	invitation.sent	user_invitation	798917d1-b577-40ce-a663-323095949061	{"email": "newuser@testcorp.com"}	\N	\N	2025-12-06 07:23:27.129+00
552a35c8-4753-7704-137f-745487fdb3e1	da0cb637-bd83-a79f-610f-1389952fc6f3	192d8f6d-a49a-8731-622b-03c285caa1ce	user.created	user	da0cb637-bd83-a79f-610f-1389952fc6f3	{"email": "john.doe@def-company.com", "createdBy": "12345678-1234-4234-8234-1234567890ab"}	\N	\N	2025-12-10 19:13:47.846+00
1aaeafaf-5207-cf21-fbd0-198e45c970e4	da0cb637-bd83-a79f-610f-1389952fc6f3	192d8f6d-a49a-8731-622b-03c285caa1ce	user.role_assigned	user_role	\N	{"roleKey": "admin", "assignedBy": "12345678-1234-4234-8234-1234567890ab"}	\N	\N	2025-12-10 19:47:06.308+00
4dc6279a-d53a-d6e5-81e0-1c586b766a1c	da0cb637-bd83-a79f-610f-1389952fc6f3	192d8f6d-a49a-8731-622b-03c285caa1ce	user.role_assigned	user_role	\N	{"roleKey": "staff", "assignedBy": "12345678-1234-4234-8234-1234567890ab"}	\N	\N	2025-12-10 19:47:42.708+00
751f4d80-e2fb-a27a-04fa-03ad2d88ce7c	da0cb637-bd83-a79f-610f-1389952fc6f3	192d8f6d-a49a-8731-622b-03c285caa1ce	user.role_assigned	user_role	\N	{"roleKey": "member", "assignedBy": "12345678-1234-4234-8234-1234567890ab"}	\N	\N	2025-12-10 20:02:46.875+00
\.


--
-- Data for Name: user_invitations; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.user_invitations (id, email, token, role_key, invited_by, tenant_id, expires_at, status, accepted_at, accepted_by, first_name, last_name, custom_message, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by, last_email_sent_at, resend_count) FROM stdin;
fadd8c19-9ad1-3794-d2cc-fc0c3f8f3d0e	newuser@testcorp.com	I1pegXpeMBJveYwWf0X7vULeeTNvDOgdwq_xK5BzlNE	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 06:25:03.44+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 06:25:03.441+00	2025-12-06 06:25:03.441+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 06:25:03.441+00	0
f1c08f88-6959-82be-a5cb-6e08207a7084	newuser@testcorp.com	fP25e2ODtB7xXU24kFdg0fd69BTT1Y28fC6DLT9BmIQ	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 06:26:43.008+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 06:26:43.009+00	2025-12-06 06:26:43.009+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 06:26:43.009+00	0
9712b208-c83d-a8d7-6339-3893617c8cdf	newuser@testcorp.com	_4Jn4oB9eBlkgQcEMGTymxFGefxJgkcaC9ROva9h-5I	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 06:43:23.185+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 06:43:23.186+00	2025-12-06 06:43:23.186+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 06:43:23.186+00	0
3a9826aa-0743-de34-e4f7-c277b4850951	newuser@testcorp.com	WpVt_FYaZJiX8zVgFQfvZFFvFAgCRz5w0BIYMDIod4A	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 06:44:44.897+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 06:44:44.898+00	2025-12-06 06:44:44.898+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 06:44:44.898+00	0
e9f4af99-f1a6-2f8b-3a62-7b63d620f8ae	newuser@testcorp.com	1ryxhwmheqAEur2oR3NOZS7u3H6aC0JHgCWoeDGbHME	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 07:01:37.624+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 07:01:37.624+00	2025-12-06 07:01:37.625+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 07:01:37.624+00	0
75784bae-84c4-3310-30e6-26b059d55039	newuser@testcorp.com	3ZQLR8KL5P6sLCPZdgds11FMnpMwVlRJUtf_K2_0mD8	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 07:05:00.148+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 07:05:00.149+00	2025-12-06 07:05:00.149+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 07:05:00.149+00	0
bbb8f8c9-61e7-6676-91e4-dc30a25ed338	newuser@testcorp.com	DeIP89fDmpfwJu8V3uyyjpBWrRs5gSWbmIt91QMXUhI	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 07:09:46.302+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 07:09:46.303+00	2025-12-06 07:09:46.303+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 07:09:46.303+00	0
798917d1-b577-40ce-a663-323095949061	newuser@testcorp.com	VSELhxTDPiqtEtMTjVY37hhAhzez6CN92xCpL9qh0iw	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 07:23:27.103+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 07:23:27.103+00	2025-12-06 07:23:27.103+00	bbbbbbbb-0000-0000-0000-000000000001	bbbbbbbb-0000-0000-0000-000000000001	f	\N	\N	2025-12-06 07:23:27.103+00	0
12bd450a-ba0c-1b9f-342c-56d494c8445e	newuser@testcorp.com	8RF2BFJ03t5L8-i-TbrjHqukXfUYnrIMJiCv0SsEFtY	member	bbbbbbbb-0000-0000-0000-000000000001	aa000000-0000-0000-0000-000000000001	2025-12-13 06:22:16.406+00	0	\N	\N	New	User	Welcome to TestCorp!	2025-12-06 06:22:16.406+00	2025-12-06 06:22:16.406+00	bbbbbbbb-0000-0000-0000-000000000001	0966c907-8395-4fff-b801-032b074c4bc4	t	2025-12-13 16:22:33.427+00	0966c907-8395-4fff-b801-032b074c4bc4	2025-12-06 06:22:16.406+00	0
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.user_roles (id, user_id, role_key, permissions, scope_type, scope_id, tenant_id, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by) FROM stdin;
5fc168a2-33a2-d822-7bb2-8b2ea9bf31c5	da0cb637-bd83-a79f-610f-1389952fc6f3	admin	\N	tenant	\N	192d8f6d-a49a-8731-622b-03c285caa1ce	2025-12-10 19:47:06.282+00	2025-12-10 19:47:06.282+00	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	f	\N	\N
6fc441d0-0033-de78-dd4f-c162fb69858e	da0cb637-bd83-a79f-610f-1389952fc6f3	staff	\N	tenant	\N	192d8f6d-a49a-8731-622b-03c285caa1ce	2025-12-10 19:47:42.699+00	2025-12-10 19:47:42.699+00	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	f	\N	\N
40bd991f-a0c4-5ca2-cac3-de2f631de5a4	da0cb637-bd83-a79f-610f-1389952fc6f3	member	\N	tenant	\N	192d8f6d-a49a-8731-622b-03c285caa1ce	2025-12-10 20:02:46.866+00	2025-12-10 20:02:46.866+00	12345678-1234-4234-8234-1234567890ab	12345678-1234-4234-8234-1234567890ab	f	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: main; Owner: -
--

COPY main.users (id, email, first_name, last_name, auth_id, status, tenant_id, phone, avatar_url, last_login, created_on, modified_on, created_by, modified_by, deleted, deleted_on, deleted_by) FROM stdin;
bbbbbbbb-0000-0000-0000-000000000001	admin@testcorp.com	Admin	User	\N	1	aa000000-0000-0000-0000-000000000001	\N	\N	\N	2025-12-06 06:16:35.880137+00	2025-12-06 06:16:35.880137+00	\N	\N	f	\N	\N
da0cb637-bd83-a79f-610f-1389952fc6f3	john.doe@def-company.com	John	Doe	\N	1	192d8f6d-a49a-8731-622b-03c285caa1ce	\N	\N	\N	2025-12-10 19:13:47.821+00	2025-12-10 19:13:47.821+00	192d8f6d-a49a-8731-622b-03c285caa1ce	192d8f6d-a49a-8731-622b-03c285caa1ce	f	\N	\N
1d07c925-48ba-4b4e-b28f-665041a012ca	admin@cbp.local	CBP	Admin	1d07c925-48ba-4b4e-b28f-665041a012ca	0	a0000000-0000-0000-0000-000000000000	\N	\N	\N	2025-12-14 15:13:46.15475+00	2025-12-14 15:13:46.15475+00	\N	\N	f	\N	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, action, actor_id, actor_name, actor_email, target_type, target_id, target_name, tenant_id, tenant_name, details, ip_address, user_agent, status, "timestamp") FROM stdin;
a1083b78-d3f1-4cd1-9031-4cdf7517b322	user.login	a0000000-0000-0000-0000-000000000001	Admin User	admin@example.com	user	a0000000-0000-0000-0000-000000000001	Admin	b0000000-0000-0000-0000-000000000001	Demo Tenant	{"ip": "127.0.0.1"}	\N	\N	success	2025-12-14 09:31:12.340829+00
8ccf9f57-dd11-4e8d-8b93-d1412782102d	tenant.created	a0000000-0000-0000-0000-000000000001	System	system@example.com	tenant	b0000000-0000-0000-0000-000000000001	Demo Tenant	b0000000-0000-0000-0000-000000000001	Demo Tenant	{"plan": "basic"}	\N	\N	success	2025-12-14 09:31:12.340829+00
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, name, run_on) FROM stdin;
1	/20240125154021-init	2025-12-06 04:56:52.754834
2	/20240925102459-add-table-tenant-configs	2025-12-06 04:56:52.754834
3	/20250106000001-add-users-table	2025-12-05 20:57:05.724
4	/20250106000002-add-user-roles-table	2025-12-05 20:57:05.765
5	/20250106000003-add-user-invitations-table	2025-12-05 20:57:05.803
6	/20250106000004-add-user-activities-table	2025-12-05 20:57:05.84
7	/20250106000005-add-identity-provider-to-tenants	2025-12-06 05:43:30.221
8	/20250106000006-add-subscriptions-table	2025-12-07 07:12:09.612
9	/20250106000007-add-invoices-table	2025-12-07 07:12:09.626
10	/20250106000008-add-settings-table	2025-12-07 22:56:26.898
11	/20250108000001-add-audit-logs-table	2025-12-11 23:27:55.595
12	/20250109000001-add-invitation-resend-columns	2025-12-11 23:27:55.61
13	/20250110000001-seed-platform-super-admin-tenant	2025-12-11 23:27:55.626
14	/20250111000001-add-payment-methods-table	2025-12-11 23:27:55.659
15	/20250111000002-add-payment-intents-table	2025-12-11 23:27:55.693
16	/20250112000001-add-usage-tracking-tables	2025-12-11 23:30:12.772
17	/20250112000002-add-notification-history-table	2025-12-11 23:31:26.206
18	/20250113000001-add-plans-table	2025-12-14 07:13:04.558
\.


--
-- Data for Name: migrations_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations_state (key, value, run_on) FROM stdin;
__dbmigrate_schema__	{}	2025-12-06 04:56:17.069557
__dbmigrate_state__	{"s":{"step":0,"fin":0,"ID":"jg2DBUl9Cxqx5otVSJX9IuLrzUlwme0XTTIEvG4ZPCE=","date":"2025-12-14T15:13:04.520Z"}}	2025-12-14 15:13:04.42644
\.


--
-- Data for Name: notification_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_history (id, notification_id, tenant_id, user_id, channel, template_id, status, sent_at, error_message, metadata) FROM stdin;
cdcd2032-fa9f-42b2-bd0a-6b1eb4975e26	notif-001	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	email	welcome-email	sent	2025-12-14 09:31:36.977556+00	\N	{"subject": "Welcome"}
17c1162a-7952-47d3-b597-8df4991e37ae	notif-002	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	email	invoice-reminder	failed	2025-12-14 09:31:36.977556+00	SMTP connection timeout	{"subject": "Invoice Due"}
9a30ed41-a886-4176-b607-4f9db2b77968	notif-003	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	sms	verification-code	sent	2025-12-14 09:31:36.977556+00	\N	{"phone": "+1234567890"}
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: subscription; Owner: -
--

COPY subscription.invoices (id, subscription_id, tenant_id, invoice_number, status, subtotal, tax, total, currency, issue_date, due_date, paid_at, stripe_invoice_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: subscription; Owner: -
--

COPY subscription.plans (id, name, code, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, sort_order, created_at, updated_at) FROM stdin;
2a82799a-24bb-4650-8bd1-807b3ab098ec	Free	free	Free tier with basic features	0.00	0.00	USD	["Up to 100 orders/month", "Basic analytics", "Email support"]	{"storage_gb": 1, "orders_per_month": 100, "api_calls_per_day": 1000}	t	t	0	2025-12-08 14:55:49.142983+00	2025-12-08 14:55:49.142983+00
5cf0de55-2921-4e14-ad40-85f31846ecae	Starter	starter	For small businesses	29.00	290.00	USD	["Up to 1,000 orders/month", "Advanced analytics", "Priority email support", "API access"]	{"storage_gb": 10, "orders_per_month": 1000, "api_calls_per_day": 10000}	t	t	0	2025-12-08 14:55:49.142983+00	2025-12-08 14:55:49.142983+00
05b87c77-d09c-496f-b226-74441d294c29	Professional	professional	For growing businesses	99.00	990.00	USD	["Up to 10,000 orders/month", "Custom reports", "Phone support", "Full API access", "Webhooks"]	{"storage_gb": 50, "orders_per_month": 10000, "api_calls_per_day": 100000}	t	t	0	2025-12-08 14:55:49.142983+00	2025-12-08 14:55:49.142983+00
13c34a70-888a-4f75-9989-f1d96b380a7e	Enterprise	enterprise	For large organizations	299.00	2990.00	USD	["Unlimited orders", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom domain"]	{"storage_gb": 500, "orders_per_month": -1, "api_calls_per_day": -1}	t	t	0	2025-12-08 14:55:49.142983+00	2025-12-08 14:55:49.142983+00
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: subscription; Owner: -
--

COPY subscription.subscriptions (id, tenant_id, plan_id, status, billing_interval, start_date, end_date, trial_end_date, canceled_at, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.customers (id, name, email, phone, address, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.notifications (id, user_id, type, title, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.order_items (id, order_id, product_id, quantity, unit_price, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.orders (id, order_number, status, total_amount, currency, customer_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.products (id, name, sku, description, price, stock_quantity, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.settings (id, key, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: tenant_123; Owner: -
--

COPY tenant_123.users (id, email, first_name, last_name, role, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: tenant_demo; Owner: -
--

COPY tenant_demo.orders (id, user_id, status, total, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: tenant_demo; Owner: -
--

COPY tenant_demo.products (id, name, description, price, sku, status, created_at, updated_at) FROM stdin;
5bb88713-aba9-449c-8e42-d62713256d5e	Product A	Description for Product A	29.99	PROD-A	active	2025-12-04 06:00:50.136265+00	2025-12-04 06:00:50.136265+00
d4152f26-7af2-46ce-8de6-860631b662a1	Product B	Description for Product B	49.99	PROD-B	active	2025-12-04 06:00:50.136265+00	2025-12-04 06:00:50.136265+00
e68aa155-3578-462b-b6b0-babb067ad0ba	Product C	Description for Product C	99.99	PROD-C	active	2025-12-04 06:00:50.136265+00	2025-12-04 06:00:50.136265+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: tenant_demo; Owner: -
--

COPY tenant_demo.users (id, email, name, role, status, created_at, updated_at) FROM stdin;
b3784669-590c-4209-93c8-8a741537e17c	admin@demo.com	Demo Admin	admin	active	2025-12-04 06:00:50.13477+00	2025-12-04 06:00:50.13477+00
f2d4ea3b-47e6-4c7f-a092-6cfc22a8093b	user@demo.com	Demo User	user	active	2025-12-04 06:00:50.13477+00	2025-12-04 06:00:50.13477+00
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 18, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_name_key; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.feature_flags
    ADD CONSTRAINT feature_flags_name_key UNIQUE (name);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: resources idx_resource_ext_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.resources
    ADD CONSTRAINT idx_resource_ext_id UNIQUE (external_identifier, tenant_id);


--
-- Name: tenants idx_tenant_key; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenants
    ADD CONSTRAINT idx_tenant_key UNIQUE (key);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: notification_history notification_history_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.notification_history
    ADD CONSTRAINT notification_history_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_intents
    ADD CONSTRAINT payment_intents_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_stripe_payment_method_id_key; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_methods
    ADD CONSTRAINT payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);


--
-- Name: addresses pk_address_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.addresses
    ADD CONSTRAINT pk_address_id PRIMARY KEY (id);


--
-- Name: leads pk_leads_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.leads
    ADD CONSTRAINT pk_leads_id PRIMARY KEY (id);


--
-- Name: resources pk_resources_id_1; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.resources
    ADD CONSTRAINT pk_resources_id_1 PRIMARY KEY (id);


--
-- Name: contacts pk_tenant_contacts; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.contacts
    ADD CONSTRAINT pk_tenant_contacts PRIMARY KEY (id);


--
-- Name: tenants pk_tenants_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenants
    ADD CONSTRAINT pk_tenants_id PRIMARY KEY (id);


--
-- Name: user_activities pk_user_activities_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_activities
    ADD CONSTRAINT pk_user_activities_id PRIMARY KEY (id);


--
-- Name: user_invitations pk_user_invitations_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_invitations
    ADD CONSTRAINT pk_user_invitations_id PRIMARY KEY (id);


--
-- Name: user_roles pk_user_roles_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_roles
    ADD CONSTRAINT pk_user_roles_id PRIMARY KEY (id);


--
-- Name: users pk_users_id; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.users
    ADD CONSTRAINT pk_users_id PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_config platform_config_key_key; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.platform_config
    ADD CONSTRAINT platform_config_key_key UNIQUE (key);


--
-- Name: platform_config platform_config_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.platform_config
    ADD CONSTRAINT platform_config_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tenant_quotas tenant_quotas_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenant_quotas
    ADD CONSTRAINT tenant_quotas_pkey PRIMARY KEY (id);


--
-- Name: user_invitations uk_user_invitations_token; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_invitations
    ADD CONSTRAINT uk_user_invitations_token UNIQUE (token);


--
-- Name: user_roles uk_user_roles_unique; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_roles
    ADD CONSTRAINT uk_user_roles_unique UNIQUE (user_id, role_key, scope_type, scope_id);


--
-- Name: users uk_users_email_tenant; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.users
    ADD CONSTRAINT uk_users_email_tenant UNIQUE (email, tenant_id);


--
-- Name: tenant_quotas uq_tenant_metric; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenant_quotas
    ADD CONSTRAINT uq_tenant_metric UNIQUE (tenant_id, metric_type);


--
-- Name: usage_summaries uq_tenant_metric_period; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.usage_summaries
    ADD CONSTRAINT uq_tenant_metric_period UNIQUE (tenant_id, metric_type, billing_period);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: usage_summaries usage_summaries_pkey; Type: CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.usage_summaries
    ADD CONSTRAINT usage_summaries_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: migrations_state migrations_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations_state
    ADD CONSTRAINT migrations_state_pkey PRIMARY KEY (key);


--
-- Name: notification_history notification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_history
    ADD CONSTRAINT notification_history_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: tenant_demo; Owner: -
--

ALTER TABLE ONLY tenant_demo.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: tenant_demo; Owner: -
--

ALTER TABLE ONLY tenant_demo.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: tenant_demo; Owner: -
--

ALTER TABLE ONLY tenant_demo.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: tenant_demo; Owner: -
--

ALTER TABLE ONLY tenant_demo.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_action ON main.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_actor_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_actor_id ON main.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_status ON main.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_target; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_target ON main.audit_logs USING btree (target_type, target_id);


--
-- Name: idx_audit_logs_tenant_action; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_action ON main.audit_logs USING btree (tenant_id, action);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_id ON main.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_tenant_timestamp; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_timestamp ON main.audit_logs USING btree (tenant_id, "timestamp" DESC);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON main.audit_logs USING btree ("timestamp" DESC);


--
-- Name: idx_invoices_deleted; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_invoices_deleted ON main.invoices USING btree (deleted);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_invoices_due_date ON main.invoices USING btree (due_date);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_invoices_status ON main.invoices USING btree (status);


--
-- Name: idx_invoices_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_invoices_tenant_id ON main.invoices USING btree (tenant_id);


--
-- Name: idx_notification_history_category; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_category ON main.notification_history USING btree (category) WHERE (category IS NOT NULL);


--
-- Name: idx_notification_history_channel; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_channel ON main.notification_history USING btree (channel);


--
-- Name: idx_notification_history_novu_message; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_novu_message ON main.notification_history USING btree (novu_message_id) WHERE (novu_message_id IS NOT NULL);


--
-- Name: idx_notification_history_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_status ON main.notification_history USING btree (status);


--
-- Name: idx_notification_history_tenant; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_tenant ON main.notification_history USING btree (tenant_id);


--
-- Name: idx_notification_history_tenant_created; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_tenant_created ON main.notification_history USING btree (tenant_id, created_on DESC);


--
-- Name: idx_notification_history_transaction; Type: INDEX; Schema: main; Owner: -
--

CREATE UNIQUE INDEX idx_notification_history_transaction ON main.notification_history USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: idx_notification_history_workflow; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_notification_history_workflow ON main.notification_history USING btree (workflow_id);


--
-- Name: idx_payment_intents_deleted; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_deleted ON main.payment_intents USING btree (deleted);


--
-- Name: idx_payment_intents_invoice_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_invoice_id ON main.payment_intents USING btree (invoice_id);


--
-- Name: idx_payment_intents_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_status ON main.payment_intents USING btree (status);


--
-- Name: idx_payment_intents_stripe_customer_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_stripe_customer_id ON main.payment_intents USING btree (stripe_customer_id);


--
-- Name: idx_payment_intents_succeeded_at; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_succeeded_at ON main.payment_intents USING btree (succeeded_at);


--
-- Name: idx_payment_intents_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_intents_tenant_id ON main.payment_intents USING btree (tenant_id);


--
-- Name: idx_payment_methods_deleted; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_methods_deleted ON main.payment_methods USING btree (deleted);


--
-- Name: idx_payment_methods_is_default; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_methods_is_default ON main.payment_methods USING btree (is_default);


--
-- Name: idx_payment_methods_stripe_customer_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_methods_stripe_customer_id ON main.payment_methods USING btree (stripe_customer_id);


--
-- Name: idx_payment_methods_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_methods_tenant_id ON main.payment_methods USING btree (tenant_id);


--
-- Name: idx_payment_methods_type; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_payment_methods_type ON main.payment_methods USING btree (type);


--
-- Name: idx_plans_is_active; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_plans_is_active ON main.plans USING btree (is_active);


--
-- Name: idx_plans_sort_order; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_plans_sort_order ON main.plans USING btree (sort_order);


--
-- Name: idx_plans_tier; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_plans_tier ON main.plans USING btree (tier);


--
-- Name: idx_settings_category; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_settings_category ON main.settings USING btree (category);


--
-- Name: idx_settings_config_key; Type: INDEX; Schema: main; Owner: -
--

CREATE UNIQUE INDEX idx_settings_config_key ON main.settings USING btree (config_key);


--
-- Name: idx_settings_is_public; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_settings_is_public ON main.settings USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_subscriptions_deleted; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_subscriptions_deleted ON main.subscriptions USING btree (deleted);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_subscriptions_status ON main.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_subscriptions_tenant_id ON main.subscriptions USING btree (tenant_id);


--
-- Name: idx_tenant_quotas_active; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_tenant_quotas_active ON main.tenant_quotas USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_tenant_quotas_tenant; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_tenant_quotas_tenant ON main.tenant_quotas USING btree (tenant_id);


--
-- Name: idx_tenants_identity_provider; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_tenants_identity_provider ON main.tenants USING btree (identity_provider);


--
-- Name: idx_usage_events_metric; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_events_metric ON main.usage_events USING btree (metric_type);


--
-- Name: idx_usage_events_period; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_events_period ON main.usage_events USING btree (billing_period);


--
-- Name: idx_usage_events_tenant; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_events_tenant ON main.usage_events USING btree (tenant_id);


--
-- Name: idx_usage_events_tenant_period; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_events_tenant_period ON main.usage_events USING btree (tenant_id, billing_period);


--
-- Name: idx_usage_events_timestamp; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_events_timestamp ON main.usage_events USING btree (event_timestamp DESC);


--
-- Name: idx_usage_summaries_period; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_summaries_period ON main.usage_summaries USING btree (billing_period DESC);


--
-- Name: idx_usage_summaries_tenant; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_summaries_tenant ON main.usage_summaries USING btree (tenant_id);


--
-- Name: idx_usage_summaries_tenant_period; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_usage_summaries_tenant_period ON main.usage_summaries USING btree (tenant_id, billing_period);


--
-- Name: idx_user_activities_action; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_activities_action ON main.user_activities USING btree (action, occurred_at DESC);


--
-- Name: idx_user_activities_entity; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_activities_entity ON main.user_activities USING btree (entity_type, entity_id, occurred_at DESC);


--
-- Name: idx_user_activities_occurred_at; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_activities_occurred_at ON main.user_activities USING btree (occurred_at DESC);


--
-- Name: idx_user_activities_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_activities_tenant_id ON main.user_activities USING btree (tenant_id, occurred_at DESC);


--
-- Name: idx_user_activities_user_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_activities_user_id ON main.user_activities USING btree (user_id, occurred_at DESC);


--
-- Name: idx_user_invitations_email; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_invitations_email ON main.user_invitations USING btree (email) WHERE (deleted = false);


--
-- Name: idx_user_invitations_last_email_sent; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_invitations_last_email_sent ON main.user_invitations USING btree (last_email_sent_at) WHERE ((deleted = false) AND (status = 0));


--
-- Name: idx_user_invitations_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_invitations_status ON main.user_invitations USING btree (status, expires_at) WHERE (deleted = false);


--
-- Name: idx_user_invitations_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_invitations_tenant_id ON main.user_invitations USING btree (tenant_id) WHERE (deleted = false);


--
-- Name: idx_user_invitations_token; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_invitations_token ON main.user_invitations USING btree (token) WHERE ((deleted = false) AND (status = 0));


--
-- Name: idx_user_roles_role_key; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_roles_role_key ON main.user_roles USING btree (role_key) WHERE (deleted = false);


--
-- Name: idx_user_roles_scope; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_roles_scope ON main.user_roles USING btree (scope_type, scope_id) WHERE (deleted = false);


--
-- Name: idx_user_roles_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_roles_tenant_id ON main.user_roles USING btree (tenant_id) WHERE (deleted = false);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON main.user_roles USING btree (user_id) WHERE (deleted = false);


--
-- Name: idx_users_email; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_users_email ON main.users USING btree (email) WHERE (deleted = false);


--
-- Name: idx_users_status; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_users_status ON main.users USING btree (status) WHERE (deleted = false);


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: main; Owner: -
--

CREATE INDEX idx_users_tenant_id ON main.users USING btree (tenant_id) WHERE (deleted = false);


--
-- Name: uk_users_auth_id; Type: INDEX; Schema: main; Owner: -
--

CREATE UNIQUE INDEX uk_users_auth_id ON main.users USING btree (auth_id) WHERE (auth_id IS NOT NULL);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_status ON public.audit_logs USING btree (status);


--
-- Name: idx_audit_logs_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_target ON public.audit_logs USING btree (target_type, target_id);


--
-- Name: idx_audit_logs_tenant_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_action ON public.audit_logs USING btree (tenant_id, action);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_tenant_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_timestamp ON public.audit_logs USING btree (tenant_id, "timestamp" DESC);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp" DESC);


--
-- Name: idx_invoices_tenant; Type: INDEX; Schema: subscription; Owner: -
--

CREATE INDEX idx_invoices_tenant ON subscription.invoices USING btree (tenant_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: subscription; Owner: -
--

CREATE INDEX idx_subscriptions_status ON subscription.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_tenant; Type: INDEX; Schema: subscription; Owner: -
--

CREATE INDEX idx_subscriptions_tenant ON subscription.subscriptions USING btree (tenant_id);


--
-- Name: leads fk_leads_address; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.leads
    ADD CONSTRAINT fk_leads_address FOREIGN KEY (address_id) REFERENCES main.addresses(id);


--
-- Name: contacts fk_tenant_contacts_leads; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.contacts
    ADD CONSTRAINT fk_tenant_contacts_leads FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);


--
-- Name: tenants fk_tenants_address; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenants
    ADD CONSTRAINT fk_tenants_address FOREIGN KEY (address_id) REFERENCES main.addresses(id);


--
-- Name: user_activities fk_user_activities_tenants; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_activities
    ADD CONSTRAINT fk_user_activities_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);


--
-- Name: user_activities fk_user_activities_users; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_activities
    ADD CONSTRAINT fk_user_activities_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE;


--
-- Name: user_invitations fk_user_invitations_accepted_by; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_invitations
    ADD CONSTRAINT fk_user_invitations_accepted_by FOREIGN KEY (accepted_by) REFERENCES main.users(id);


--
-- Name: user_invitations fk_user_invitations_invited_by; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_invitations
    ADD CONSTRAINT fk_user_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES main.users(id);


--
-- Name: user_invitations fk_user_invitations_tenants; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_invitations
    ADD CONSTRAINT fk_user_invitations_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);


--
-- Name: user_roles fk_user_roles_tenants; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_roles
    ADD CONSTRAINT fk_user_roles_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);


--
-- Name: user_roles fk_user_roles_users; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.user_roles
    ADD CONSTRAINT fk_user_roles_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE;


--
-- Name: users fk_users_tenants; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.users
    ADD CONSTRAINT fk_users_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id);


--
-- Name: invoices invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.invoices
    ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: notification_history notification_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.notification_history
    ADD CONSTRAINT notification_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_invoice_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_intents
    ADD CONSTRAINT payment_intents_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES main.invoices(id) ON DELETE SET NULL;


--
-- Name: payment_intents payment_intents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_intents
    ADD CONSTRAINT payment_intents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.payment_methods
    ADD CONSTRAINT payment_methods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_quotas tenant_quotas_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.tenant_quotas
    ADD CONSTRAINT tenant_quotas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: usage_events usage_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.usage_events
    ADD CONSTRAINT usage_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: usage_summaries usage_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: main; Owner: -
--

ALTER TABLE ONLY main.usage_summaries
    ADD CONSTRAINT usage_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscription.subscriptions(id);


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: subscription; Owner: -
--

ALTER TABLE ONLY subscription.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription.plans(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES tenant_123.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: tenant_123; Owner: -
--

ALTER TABLE ONLY tenant_123.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES tenant_123.products(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: tenant_demo; Owner: -
--

ALTER TABLE ONLY tenant_demo.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES tenant_demo.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qjuFk4I2AGOvOvyriYeScdimfzqYA8Pffx9DPcichAWGVhF48008uEzULlp4J76

