-- GAP-006: Rollback invitation resend cooldown columns

-- Drop the index first
DROP INDEX IF EXISTS main.idx_user_invitations_last_email_sent;

-- Remove the columns
ALTER TABLE main.user_invitations DROP COLUMN IF EXISTS last_email_sent_at;
ALTER TABLE main.user_invitations DROP COLUMN IF EXISTS resend_count;
