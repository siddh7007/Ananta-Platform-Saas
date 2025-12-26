-- Create plans table
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

-- Create index on tier for filtering
CREATE INDEX IF NOT EXISTS idx_plans_tier ON main.plans(tier);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON main.plans(is_active);

-- Create index on sort_order for ordering
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON main.plans(sort_order);
