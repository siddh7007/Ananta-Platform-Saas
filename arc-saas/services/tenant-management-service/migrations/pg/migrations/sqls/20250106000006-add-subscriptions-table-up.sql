-- Create subscriptions table
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

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON main.subscriptions(tenant_id);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON main.subscriptions(status);

-- Create index on deleted
CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted ON main.subscriptions(deleted);
