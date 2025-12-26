-- Usage Events table: tracks individual consumption events for metered billing
CREATE TABLE IF NOT EXISTS main.usage_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100),
    quantity NUMERIC(20, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'units',
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    billing_period VARCHAR(7), -- YYYY-MM format
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

-- Tenant Quotas table: stores per-tenant usage limits and current consumption
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

-- Usage Summaries table: aggregated usage data per billing period
CREATE TABLE IF NOT EXISTS main.usage_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    billing_period VARCHAR(7) NOT NULL, -- YYYY-MM format
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

-- Indexes for efficient querying
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
