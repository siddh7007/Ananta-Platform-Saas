-- Create settings table for platform-wide configuration
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
    -- Soft delete columns (required by UserModifiableEntity)
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Create unique index on config_key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_config_key
    ON main.settings(config_key);

-- Create index on category for efficient category-based lookups
CREATE INDEX IF NOT EXISTS idx_settings_category
    ON main.settings(category);

-- Create index on is_public for efficient public settings queries
CREATE INDEX IF NOT EXISTS idx_settings_is_public
    ON main.settings(is_public)
    WHERE is_public = TRUE;

-- Add comments for documentation
COMMENT ON TABLE main.settings IS 'Platform-wide configuration settings';
COMMENT ON COLUMN main.settings.config_key IS 'Unique key for the setting (e.g., platform.name, email.sender)';
COMMENT ON COLUMN main.settings.config_value IS 'Value of the setting';
COMMENT ON COLUMN main.settings.value_type IS 'Data type: string, number, boolean, json';
COMMENT ON COLUMN main.settings.category IS 'Category for grouping settings (e.g., general, email, billing)';
COMMENT ON COLUMN main.settings.is_public IS 'Whether this setting is visible to non-admin users';

-- Insert default platform settings
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
