-- Drop indexes
DROP INDEX IF EXISTS main.idx_user_activities_occurred_at;
DROP INDEX IF EXISTS main.idx_user_activities_entity;
DROP INDEX IF EXISTS main.idx_user_activities_action;
DROP INDEX IF EXISTS main.idx_user_activities_tenant_id;
DROP INDEX IF EXISTS main.idx_user_activities_user_id;

-- Drop user_activities table
DROP TABLE IF EXISTS main.user_activities;
