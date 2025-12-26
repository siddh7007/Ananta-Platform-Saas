ALTER TABLE main.user_invitations
  DROP COLUMN IF EXISTS last_email_sent_at,
  DROP COLUMN IF EXISTS resend_count;
