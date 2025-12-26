-- Drop indexes
DROP INDEX IF EXISTS main.idx_user_roles_scope;
DROP INDEX IF EXISTS main.idx_user_roles_role_key;
DROP INDEX IF EXISTS main.idx_user_roles_tenant_id;
DROP INDEX IF EXISTS main.idx_user_roles_user_id;

-- Drop user_roles table
DROP TABLE IF EXISTS main.user_roles;
