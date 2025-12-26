-- =============================================================================
-- Subscription Enhancements Migration
-- Adds trial support, renewal tracking, and upgrade/downgrade capabilities
-- =============================================================================

SET search_path TO main,public;

-- =============================================================================
-- Plan Enhancements
-- =============================================================================

-- Add trial configuration to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_enabled boolean DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_duration integer;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_duration_unit varchar(20);

-- Add limits and features
ALTER TABLE plans ADD COLUMN IF NOT EXISTS limits jsonb DEFAULT '{}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features varchar[] DEFAULT '{}';

-- Add visibility controls
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- =============================================================================
-- Subscription Enhancements
-- =============================================================================

-- Add trial tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date varchar(10);

-- Add renewal tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0;

-- Add cancellation tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at varchar(10);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Add plan change tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id uuid;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_changed_at varchar(10);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS proration_credit numeric(10,2);

-- Add external reference and metadata
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS external_subscription_id varchar(200);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS meta_data jsonb DEFAULT '{}';

-- Add invoice_id if not exists (some schemas may not have it)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS invoice_id uuid;

-- =============================================================================
-- Usage Tracking Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    created_by uuid NOT NULL,
    modified_by uuid,

    -- Usage identification
    subscription_id uuid NOT NULL,
    subscriber_id uuid NOT NULL,
    metric_key varchar(100) NOT NULL,

    -- Usage values
    quantity numeric(15,4) NOT NULL DEFAULT 0,
    unit varchar(50),

    -- Period tracking
    period_start varchar(10) NOT NULL,
    period_end varchar(10) NOT NULL,

    -- Metadata
    meta_data jsonb DEFAULT '{}',

    CONSTRAINT pk_usage_records_id PRIMARY KEY (id),
    CONSTRAINT fk_usage_records_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_records_subscription ON usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_subscriber ON usage_records(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric ON usage_records(metric_key);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start, period_end);

-- =============================================================================
-- Subscription History Table (for audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id uuid DEFAULT (md5(((random())::text || (clock_timestamp())::text)))::uuid NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,

    subscription_id uuid NOT NULL,
    subscriber_id uuid NOT NULL,

    -- Change details
    action varchar(50) NOT NULL, -- 'created', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'reactivated', 'expired'

    -- Snapshot of subscription at time of change
    plan_id uuid,
    previous_plan_id uuid,
    status smallint,

    -- Additional info
    notes text,
    meta_data jsonb DEFAULT '{}',

    CONSTRAINT pk_subscription_history_id PRIMARY KEY (id),
    CONSTRAINT fk_subscription_history_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscriber ON subscription_history(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_action ON subscription_history(action);

-- =============================================================================
-- Indexes for better query performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial ON subscriptions(is_trial) WHERE is_trial = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_renew ON subscriptions(auto_renew) WHERE auto_renew = true;

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plans_is_public ON plans(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_plans_tier ON plans(tier);

-- =============================================================================
-- Update existing plans with default trial settings
-- =============================================================================

UPDATE plans SET
    trial_enabled = false,
    is_public = true,
    is_active = true,
    sort_order = 0,
    limits = '{}',
    features = '{}'
WHERE trial_enabled IS NULL;

-- =============================================================================
-- Update existing subscriptions with default values
-- =============================================================================

UPDATE subscriptions SET
    is_trial = false,
    auto_renew = true,
    renewal_count = 0,
    meta_data = '{}'
WHERE auto_renew IS NULL;
