-- =============================================================================
-- NOVU SUBSCRIBER TRACKING
-- =============================================================================
-- Adds Novu subscriber ID and sync status to user profiles
-- Tracks Novu transaction IDs in alert deliveries

-- Add Novu subscriber tracking to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS novu_subscriber_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS novu_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS novu_sync_status VARCHAR(50) DEFAULT 'pending';

-- Index for quick lookup of Novu subscriber
CREATE INDEX IF NOT EXISTS idx_users_novu_subscriber
ON users(novu_subscriber_id)
WHERE novu_subscriber_id IS NOT NULL;

-- Index for finding users that need sync
CREATE INDEX IF NOT EXISTS idx_users_novu_sync_status
ON users(novu_sync_status)
WHERE novu_sync_status IN ('pending', 'failed');

-- Track Novu message IDs in alert_deliveries
ALTER TABLE alert_deliveries
ADD COLUMN IF NOT EXISTS novu_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS novu_message_id VARCHAR(255);

-- Index for Novu transaction lookup
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_novu_transaction
ON alert_deliveries(novu_transaction_id)
WHERE novu_transaction_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN users.novu_subscriber_id IS 'Novu subscriber ID (typically user UUID)';
COMMENT ON COLUMN users.novu_synced_at IS 'Last time user was synced to Novu';
COMMENT ON COLUMN users.novu_sync_status IS 'Sync status: pending, synced, failed';
COMMENT ON COLUMN alert_deliveries.novu_transaction_id IS 'Novu event transaction ID for tracking';
COMMENT ON COLUMN alert_deliveries.novu_message_id IS 'Novu message ID for specific delivery';

-- =============================================================================
-- Grant permissions
-- =============================================================================
GRANT SELECT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT ON alert_deliveries TO authenticated;
