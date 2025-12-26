-- Rollback: Remove identity_provider column and related constraints

-- Drop index
DROP INDEX IF EXISTS main.idx_tenants_identity_provider;

-- Drop check constraint
ALTER TABLE main.tenants DROP CONSTRAINT IF EXISTS tenants_identity_provider_check;

-- Drop column
ALTER TABLE main.tenants DROP COLUMN IF EXISTS identity_provider;
