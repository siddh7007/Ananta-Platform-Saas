-- GAP-006: Add invitation resend cooldown columns
-- These columns enable rate limiting on invitation resend operations:
-- - last_email_sent_at: Tracks when the last invitation email was sent
-- - resend_count: Tracks how many times the invitation has been resent

-- Add last_email_sent_at column to track email sending timestamps
ALTER TABLE main.user_invitations
ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz;

-- Add resend_count column to track number of resends (default 0)
ALTER TABLE main.user_invitations
ADD COLUMN IF NOT EXISTS resend_count integer DEFAULT 0 NOT NULL;

-- Initialize last_email_sent_at to created_on for existing records
UPDATE main.user_invitations
SET last_email_sent_at = created_on
WHERE last_email_sent_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN main.user_invitations.last_email_sent_at IS 'Timestamp of last email sent (for 5-minute cooldown enforcement)';
COMMENT ON COLUMN main.user_invitations.resend_count IS 'Number of times invitation has been resent (max 5)';

-- Create index for efficient cooldown queries
CREATE INDEX IF NOT EXISTS idx_user_invitations_last_email_sent
ON main.user_invitations(last_email_sent_at)
WHERE deleted = FALSE AND status = 0;
