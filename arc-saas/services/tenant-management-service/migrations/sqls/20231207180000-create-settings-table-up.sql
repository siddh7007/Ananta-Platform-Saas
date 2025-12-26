-- Create settings table for platform-wide configuration
CREATE TABLE IF NOT EXISTS main.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    created_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID,
    CONSTRAINT uk_settings_config_key UNIQUE (config_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_config_key ON main.settings (config_key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON main.settings (category);

-- Add comment
COMMENT ON TABLE main.settings IS 'Platform settings and configuration';
