-- Drop indexes
DROP INDEX IF EXISTS main.idx_user_invitations_status;
DROP INDEX IF EXISTS main.idx_user_invitations_token;
DROP INDEX IF EXISTS main.idx_user_invitations_tenant_id;
DROP INDEX IF EXISTS main.idx_user_invitations_email;

-- Drop user_invitations table
DROP TABLE IF EXISTS main.user_invitations;
