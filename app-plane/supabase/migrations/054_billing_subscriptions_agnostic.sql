-- =============================================================================
-- Migration 054: Payment-Agnostic Billing & Subscription System
-- =============================================================================
-- This schema is designed to work with ANY payment provider (Stripe, PayPal,
-- Razorpay, Square, etc.) by storing provider-agnostic data with flexible
-- metadata fields for provider-specific details.
--
-- Created: 2025-11-25
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Subscription tiers (matches freemium model)
CREATE TYPE subscription_tier AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
);

-- Subscription status (provider-agnostic)
CREATE TYPE subscription_status AS ENUM (
    'trialing',      -- Free trial period
    'active',        -- Paid and active
    'past_due',      -- Payment failed, grace period
    'canceled',      -- User canceled, access until period end
    'expired',       -- Subscription ended
    'paused'         -- Temporarily paused (if supported)
);

-- Payment status (provider-agnostic)
CREATE TYPE payment_status AS ENUM (
    'pending',       -- Awaiting payment
    'processing',    -- Payment in progress
    'succeeded',     -- Payment completed
    'failed',        -- Payment failed
    'refunded',      -- Full refund
    'partially_refunded',
    'disputed',      -- Chargeback/dispute
    'canceled'       -- Payment canceled
);

-- Invoice status
CREATE TYPE invoice_status AS ENUM (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
);

-- =============================================================================
-- SUBSCRIPTION PLANS (Define your tiers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Plan identification
    name TEXT NOT NULL,                          -- "Starter", "Professional", etc.
    tier subscription_tier NOT NULL,             -- Maps to enum
    slug TEXT UNIQUE NOT NULL,                   -- "starter", "professional"

    -- Pricing (store in cents/smallest currency unit)
    price_monthly INTEGER NOT NULL DEFAULT 0,    -- Monthly price in cents
    price_yearly INTEGER,                        -- Yearly price in cents (discount)
    currency TEXT NOT NULL DEFAULT 'USD',        -- ISO 4217 currency code

    -- Billing
    billing_interval TEXT NOT NULL DEFAULT 'month', -- 'month', 'year'
    trial_days INTEGER DEFAULT 0,                -- Free trial period

    -- Limits (enforced by application)
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example limits structure:
    -- {
    --   "max_members": 5,
    --   "max_projects": 10,
    --   "max_bom_uploads_per_month": 100,
    --   "max_components_per_bom": 1000,
    --   "max_api_calls_per_month": 10000,
    --   "features": ["enrichment", "export", "api_access"]
    -- }

    -- Display
    description TEXT,
    features TEXT[],                             -- Feature list for UI
    is_popular BOOLEAN DEFAULT FALSE,            -- Highlight in pricing page
    display_order INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,              -- Available for new subscriptions

    -- Provider mappings (flexible for any provider)
    provider_plan_ids JSONB DEFAULT '{}'::jsonb,
    -- Example:
    -- {
    --   "stripe": "price_1234567890",
    --   "paypal": "P-ABC123",
    --   "razorpay": "plan_ABC123"
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CUSTOMER BILLING PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to organization
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact info (for invoices)
    billing_email TEXT NOT NULL,
    billing_name TEXT,

    -- Address (for tax/invoices)
    billing_address JSONB DEFAULT '{}'::jsonb,
    -- {
    --   "line1": "123 Main St",
    --   "line2": "Suite 100",
    --   "city": "San Francisco",
    --   "state": "CA",
    --   "postal_code": "94102",
    --   "country": "US"
    -- }

    -- Tax info
    tax_id TEXT,                                 -- VAT/GST number
    tax_exempt BOOLEAN DEFAULT FALSE,

    -- Provider customer IDs (flexible for any provider)
    provider_customer_ids JSONB DEFAULT '{}'::jsonb,
    -- {
    --   "stripe": "cus_ABC123",
    --   "paypal": "CUST-123",
    --   "razorpay": "cust_ABC123"
    -- }

    -- Default payment method reference
    default_payment_method_id UUID,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id)
);

-- =============================================================================
-- PAYMENT METHODS (Provider-Agnostic)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to billing customer
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,

    -- Payment method type
    type TEXT NOT NULL,                          -- 'card', 'bank_account', 'paypal', 'upi', etc.

    -- Display info (safe to show)
    display_name TEXT,                           -- "Visa ending in 4242"
    brand TEXT,                                  -- "visa", "mastercard", "amex"
    last_four TEXT,                              -- "4242"
    exp_month INTEGER,                           -- 12
    exp_year INTEGER,                            -- 2025

    -- Provider references
    provider TEXT NOT NULL,                      -- "stripe", "paypal", "razorpay"
    provider_payment_method_id TEXT NOT NULL,   -- Provider's ID for this payment method

    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_valid BOOLEAN DEFAULT TRUE,               -- Set to false if card expired/declined

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Status
    status subscription_status NOT NULL DEFAULT 'active',

    -- Billing period
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,

    -- Trial
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Provider info (flexible for any provider)
    provider TEXT,                               -- "stripe", "paypal", "razorpay", null for free
    provider_subscription_id TEXT,               -- Provider's subscription ID
    provider_data JSONB DEFAULT '{}'::jsonb,     -- Any provider-specific data

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One active subscription per organization
    UNIQUE(organization_id)
);

-- =============================================================================
-- INVOICES
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invoice number (human readable)
    invoice_number TEXT UNIQUE NOT NULL,

    -- Links
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id),
    subscription_id UUID REFERENCES subscriptions(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Status
    status invoice_status NOT NULL DEFAULT 'draft',

    -- Amounts (in cents/smallest currency unit)
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    amount_due INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',

    -- Dates
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    -- Period covered
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,

    -- Provider info
    provider TEXT,
    provider_invoice_id TEXT,
    provider_data JSONB DEFAULT '{}'::jsonb,

    -- PDF/download
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INVOICE LINE ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    -- Description
    description TEXT NOT NULL,

    -- Amounts
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_amount INTEGER NOT NULL,                -- Price per unit in cents
    amount INTEGER NOT NULL,                     -- Total (quantity * unit_amount)
    currency TEXT NOT NULL DEFAULT 'USD',

    -- Period (for prorations)
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,

    -- Type
    type TEXT DEFAULT 'subscription',            -- 'subscription', 'usage', 'one_time', 'tax'

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    billing_customer_id UUID NOT NULL REFERENCES billing_customers(id),
    invoice_id UUID REFERENCES invoices(id),
    subscription_id UUID REFERENCES subscriptions(id),
    payment_method_id UUID REFERENCES payment_methods(id),

    -- Amount
    amount INTEGER NOT NULL,                     -- Amount in cents
    currency TEXT NOT NULL DEFAULT 'USD',

    -- Status
    status payment_status NOT NULL DEFAULT 'pending',

    -- Provider info
    provider TEXT NOT NULL,                      -- "stripe", "paypal", "razorpay"
    provider_payment_id TEXT NOT NULL,           -- Provider's payment/charge ID
    provider_data JSONB DEFAULT '{}'::jsonb,     -- Full provider response

    -- Failure info
    failure_code TEXT,
    failure_message TEXT,

    -- Refund tracking
    refunded_amount INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- WEBHOOK EVENTS (For idempotency and debugging)
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Provider info
    provider TEXT NOT NULL,                      -- "stripe", "paypal", "razorpay"
    provider_event_id TEXT NOT NULL,             -- Provider's event ID
    event_type TEXT NOT NULL,                    -- "invoice.paid", "subscription.updated"

    -- Payload
    payload JSONB NOT NULL,                      -- Full webhook payload

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    -- Idempotency
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate processing
    UNIQUE(provider, provider_event_id)
);

-- =============================================================================
-- USAGE TRACKING (For metered billing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),

    -- Usage type
    usage_type TEXT NOT NULL,                    -- 'bom_uploads', 'api_calls', 'components_enriched'

    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Counts
    quantity INTEGER NOT NULL DEFAULT 0,

    -- Billing
    reported_to_provider BOOLEAN DEFAULT FALSE,
    provider_usage_record_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One record per org per type per period
    UNIQUE(organization_id, usage_type, period_start)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Subscription plans
CREATE INDEX idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;

-- Billing customers
CREATE INDEX idx_billing_customers_org ON billing_customers(organization_id);

-- Payment methods
CREATE INDEX idx_payment_methods_customer ON payment_methods(billing_customer_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(billing_customer_id, is_default) WHERE is_default = TRUE;

-- Subscriptions
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(billing_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Invoices
CREATE INDEX idx_invoices_customer ON invoices(billing_customer_id);
CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

-- Payments
CREATE INDEX idx_payments_customer ON payments(billing_customer_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider, provider_payment_id);

-- Webhook events
CREATE INDEX idx_webhook_events_provider ON billing_webhook_events(provider, event_type);
CREATE INDEX idx_webhook_events_unprocessed ON billing_webhook_events(processed) WHERE processed = FALSE;

-- Usage records
CREATE INDEX idx_usage_records_org ON usage_records(organization_id);
CREATE INDEX idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX idx_usage_records_type ON usage_records(usage_type);

-- =============================================================================
-- SEED DEFAULT PLANS
-- =============================================================================

INSERT INTO subscription_plans (name, tier, slug, price_monthly, price_yearly, limits, features, description, display_order) VALUES
(
    'Free',
    'free',
    'free',
    0,
    0,
    '{
        "max_members": 1,
        "max_projects": 2,
        "max_bom_uploads_per_month": 5,
        "max_components_per_bom": 100,
        "max_api_calls_per_month": 100,
        "features": ["basic_enrichment"]
    }'::jsonb,
    ARRAY['5 BOM uploads/month', '100 components/BOM', 'Basic enrichment', 'Community support'],
    'Perfect for trying out the platform',
    1
),
(
    'Starter',
    'starter',
    'starter',
    2900,  -- $29/month
    29000, -- $290/year (2 months free)
    '{
        "max_members": 5,
        "max_projects": 10,
        "max_bom_uploads_per_month": 50,
        "max_components_per_bom": 500,
        "max_api_calls_per_month": 5000,
        "features": ["basic_enrichment", "export_csv", "export_excel", "email_support"]
    }'::jsonb,
    ARRAY['5 team members', '50 BOM uploads/month', '500 components/BOM', 'CSV & Excel export', 'Email support'],
    'For small teams getting started',
    2
),
(
    'Professional',
    'professional',
    'professional',
    9900,   -- $99/month
    99000,  -- $990/year (2 months free)
    '{
        "max_members": 25,
        "max_projects": 50,
        "max_bom_uploads_per_month": 200,
        "max_components_per_bom": 2000,
        "max_api_calls_per_month": 50000,
        "features": ["basic_enrichment", "advanced_enrichment", "export_csv", "export_excel", "api_access", "priority_support", "custom_fields"]
    }'::jsonb,
    ARRAY['25 team members', '200 BOM uploads/month', '2000 components/BOM', 'Full API access', 'Advanced enrichment', 'Priority support'],
    'For growing engineering teams',
    3
),
(
    'Enterprise',
    'enterprise',
    'enterprise',
    0,  -- Custom pricing
    0,
    '{
        "max_members": -1,
        "max_projects": -1,
        "max_bom_uploads_per_month": -1,
        "max_components_per_bom": -1,
        "max_api_calls_per_month": -1,
        "features": ["basic_enrichment", "advanced_enrichment", "export_csv", "export_excel", "api_access", "priority_support", "custom_fields", "sso", "dedicated_support", "sla", "custom_integrations"]
    }'::jsonb,
    ARRAY['Unlimited team members', 'Unlimited BOMs', 'SSO/SAML', 'Dedicated support', 'SLA guarantee', 'Custom integrations'],
    'For large organizations with custom needs',
    4
)
ON CONFLICT (slug) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    limits = EXCLUDED.limits,
    features = EXCLUDED.features,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get organization's current subscription tier
CREATE OR REPLACE FUNCTION get_organization_tier(org_id UUID)
RETURNS subscription_tier AS $$
DECLARE
    tier_result subscription_tier;
BEGIN
    SELECT p.tier INTO tier_result
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default to free if no subscription
    RETURN COALESCE(tier_result, 'free');
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if organization has feature
CREATE OR REPLACE FUNCTION organization_has_feature(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_feature BOOLEAN;
BEGIN
    SELECT (p.limits->'features') ? feature_name INTO has_feature
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(has_feature, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get organization's limit value
CREATE OR REPLACE FUNCTION get_organization_limit(org_id UUID, limit_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    limit_value INTEGER;
BEGIN
    SELECT (p.limits->>limit_name)::INTEGER INTO limit_value
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default limits for free tier if no subscription
    IF limit_value IS NULL THEN
        CASE limit_name
            WHEN 'max_members' THEN RETURN 1;
            WHEN 'max_projects' THEN RETURN 2;
            WHEN 'max_bom_uploads_per_month' THEN RETURN 5;
            WHEN 'max_components_per_bom' THEN RETURN 100;
            WHEN 'max_api_calls_per_month' THEN RETURN 100;
            ELSE RETURN 0;
        END CASE;
    END IF;

    -- -1 means unlimited
    RETURN limit_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if organization is within limit
CREATE OR REPLACE FUNCTION check_organization_limit(org_id UUID, limit_name TEXT, current_usage INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    limit_value INTEGER;
BEGIN
    limit_value := get_organization_limit(org_id, limit_name);

    -- -1 means unlimited
    IF limit_value = -1 THEN
        RETURN TRUE;
    END IF;

    RETURN current_usage < limit_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    seq_num INTEGER;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    SELECT COALESCE(MAX(
        SUBSTRING(invoice_number FROM 'INV-' || year_month || '-(\d+)')::INTEGER
    ), 0) + 1
    INTO seq_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_month || '-%';

    RETURN 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION trigger_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_invoice_number();

-- Update timestamps
CREATE OR REPLACE FUNCTION trigger_update_billing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_timestamp
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_billing_timestamp();

CREATE TRIGGER update_billing_customers_timestamp
    BEFORE UPDATE ON billing_customers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_billing_timestamp();

CREATE TRIGGER update_subscriptions_timestamp
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_billing_timestamp();

CREATE TRIGGER update_invoices_timestamp
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_billing_timestamp();

CREATE TRIGGER update_payments_timestamp
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_billing_timestamp();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- Plans are publicly readable (for pricing page)
CREATE POLICY "Plans are viewable by everyone"
    ON subscription_plans FOR SELECT
    USING (is_active = TRUE);

-- Service role has full access
CREATE POLICY "Service role has full access to billing_customers"
    ON billing_customers FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to payment_methods"
    ON payment_methods FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to subscriptions"
    ON subscriptions FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to invoices"
    ON invoices FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to invoice_line_items"
    ON invoice_line_items FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to payments"
    ON payments FOR ALL
    TO service_role
    USING (TRUE);

CREATE POLICY "Service role has full access to usage_records"
    ON usage_records FOR ALL
    TO service_role
    USING (TRUE);

-- Users can view their organization's billing data
-- (These policies assume you have a function to get user's org)
-- Uncomment and customize based on your auth setup:

-- CREATE POLICY "Users can view own billing"
--     ON billing_customers FOR SELECT
--     TO authenticated
--     USING (organization_id = get_user_organization_id(auth.uid()));

COMMENT ON TABLE subscription_plans IS 'Defines available subscription tiers and their limits';
COMMENT ON TABLE billing_customers IS 'Billing profiles linked to organizations';
COMMENT ON TABLE payment_methods IS 'Stored payment methods (cards, bank accounts, etc.)';
COMMENT ON TABLE subscriptions IS 'Active subscriptions linking orgs to plans';
COMMENT ON TABLE invoices IS 'Generated invoices for billing';
COMMENT ON TABLE payments IS 'Payment transactions and their status';
COMMENT ON TABLE billing_webhook_events IS 'Webhook events from payment providers for idempotency';
COMMENT ON TABLE usage_records IS 'Metered usage tracking per organization';
