-- GAP-006 support: track resend throttling metadata on invitations
ALTER TABLE main.user_invitations
  ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN main.user_invitations.last_email_sent_at IS 'Timestamp of the last invitation email sent (used for cooldown enforcement)';
COMMENT ON COLUMN main.user_invitations.resend_count IS 'Number of times an invitation email has been resent';
