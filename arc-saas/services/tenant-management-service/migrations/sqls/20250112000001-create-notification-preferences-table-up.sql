-- Create notification_preferences table for tenant notification channel settings
CREATE TABLE IF NOT EXISTS main.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT FALSE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    webhook_url VARCHAR(500),
    channel_config JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID,
    CONSTRAINT uk_notification_pref_tenant_category UNIQUE (tenant_id, category),
    CONSTRAINT fk_notification_pref_tenant FOREIGN KEY (tenant_id) REFERENCES main.tenants(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_pref_tenant_id ON main.notification_preferences (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_pref_category ON main.notification_preferences (category);

-- Add comment
COMMENT ON TABLE main.notification_preferences IS 'Tenant notification channel preferences per category (billing, subscription, user, system, security, workflow)';
COMMENT ON COLUMN main.notification_preferences.category IS 'Notification category: billing, subscription, user, system, security, workflow';
COMMENT ON COLUMN main.notification_preferences.channel_config IS 'Additional channel-specific configuration as JSON';
