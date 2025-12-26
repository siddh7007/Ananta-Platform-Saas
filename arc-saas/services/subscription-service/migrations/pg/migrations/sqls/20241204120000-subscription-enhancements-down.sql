-- =============================================================================
-- Subscription Enhancements Rollback
-- =============================================================================

SET search_path TO main,public;

-- Drop new tables
DROP TABLE IF EXISTS subscription_history;
DROP TABLE IF EXISTS usage_records;

-- Remove subscription columns
ALTER TABLE subscriptions DROP COLUMN IF EXISTS is_trial;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS trial_end_date;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS auto_renew;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS renewal_count;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS previous_plan_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan_changed_at;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS proration_credit;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS external_subscription_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS meta_data;

-- Remove plan columns
ALTER TABLE plans DROP COLUMN IF EXISTS trial_enabled;
ALTER TABLE plans DROP COLUMN IF EXISTS trial_duration;
ALTER TABLE plans DROP COLUMN IF EXISTS trial_duration_unit;
ALTER TABLE plans DROP COLUMN IF EXISTS limits;
ALTER TABLE plans DROP COLUMN IF EXISTS features;
ALTER TABLE plans DROP COLUMN IF EXISTS is_public;
ALTER TABLE plans DROP COLUMN IF EXISTS is_active;
ALTER TABLE plans DROP COLUMN IF EXISTS sort_order;

-- Drop indexes
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_subscriptions_end_date;
DROP INDEX IF EXISTS idx_subscriptions_trial;
DROP INDEX IF EXISTS idx_subscriptions_auto_renew;
DROP INDEX IF EXISTS idx_plans_is_active;
DROP INDEX IF EXISTS idx_plans_is_public;
DROP INDEX IF EXISTS idx_plans_tier;
