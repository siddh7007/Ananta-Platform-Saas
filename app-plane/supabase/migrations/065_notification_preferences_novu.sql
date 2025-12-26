-- =============================================================================
-- NOTIFICATION PREFERENCES - NOVU ENHANCEMENT
-- =============================================================================
-- Enhances alert_preferences to support Novu channel preferences

-- Add Novu-specific columns to alert_preferences
ALTER TABLE alert_preferences
ADD COLUMN IF NOT EXISTS novu_channels JSONB DEFAULT '["in_app"]'::jsonb,
ADD COLUMN IF NOT EXISTS novu_preference_synced BOOLEAN DEFAULT FALSE;

-- Example novu_channels values:
-- ["in_app"]
-- ["in_app", "email"]
-- ["in_app", "email", "webhook"]

-- Comments for documentation
COMMENT ON COLUMN alert_preferences.novu_channels IS 'Novu delivery channels for this alert type (in_app, email, webhook, sms, push)';
COMMENT ON COLUMN alert_preferences.novu_preference_synced IS 'Whether preference has been synced to Novu subscriber preferences';

-- Index for finding preferences that need sync
CREATE INDEX IF NOT EXISTS idx_alert_preferences_novu_sync
ON alert_preferences(novu_preference_synced)
WHERE novu_preference_synced = FALSE;

-- =============================================================================
-- Create function to get user notification channels for alert type
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_novu_channels(
    p_user_id UUID,
    p_alert_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channels JSONB;
BEGIN
    SELECT novu_channels INTO v_channels
    FROM alert_preferences
    WHERE user_id = p_user_id
      AND alert_type = p_alert_type
      AND is_enabled = TRUE;

    -- Default to in_app if no preference set
    IF v_channels IS NULL THEN
        v_channels := '["in_app"]'::jsonb;
    END IF;

    RETURN v_channels;
END;
$$;

-- =============================================================================
-- Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION get_user_novu_channels TO authenticated;
GRANT SELECT, UPDATE ON alert_preferences TO authenticated;
