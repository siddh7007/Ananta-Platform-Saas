-- Drop indexes
DROP INDEX IF EXISTS main.idx_users_status;
DROP INDEX IF EXISTS main.idx_users_auth_id;
DROP INDEX IF EXISTS main.idx_users_email;
DROP INDEX IF EXISTS main.idx_users_tenant_id;

-- Drop users table
DROP TABLE IF EXISTS main.users;
