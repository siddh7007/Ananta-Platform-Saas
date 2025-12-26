-- Drop indexes first
DROP INDEX IF EXISTS main.idx_notification_history_category;
DROP INDEX IF EXISTS main.idx_notification_history_novu_message;
DROP INDEX IF EXISTS main.idx_notification_history_transaction;
DROP INDEX IF EXISTS main.idx_notification_history_channel;
DROP INDEX IF EXISTS main.idx_notification_history_status;
DROP INDEX IF EXISTS main.idx_notification_history_workflow;
DROP INDEX IF EXISTS main.idx_notification_history_tenant_created;
DROP INDEX IF EXISTS main.idx_notification_history_tenant;

-- Drop table
DROP TABLE IF EXISTS main.notification_history;
