-- Drop indexes
DROP INDEX IF EXISTS main.idx_subscriptions_deleted;
DROP INDEX IF EXISTS main.idx_subscriptions_status;
DROP INDEX IF EXISTS main.idx_subscriptions_tenant_id;

-- Drop subscriptions table
DROP TABLE IF EXISTS main.subscriptions;
