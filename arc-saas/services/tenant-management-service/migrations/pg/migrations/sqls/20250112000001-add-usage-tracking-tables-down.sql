-- Drop indexes first
DROP INDEX IF EXISTS main.idx_usage_summaries_tenant_period;
DROP INDEX IF EXISTS main.idx_usage_summaries_period;
DROP INDEX IF EXISTS main.idx_usage_summaries_tenant;
DROP INDEX IF EXISTS main.idx_tenant_quotas_active;
DROP INDEX IF EXISTS main.idx_tenant_quotas_tenant;
DROP INDEX IF EXISTS main.idx_usage_events_tenant_period;
DROP INDEX IF EXISTS main.idx_usage_events_metric;
DROP INDEX IF EXISTS main.idx_usage_events_timestamp;
DROP INDEX IF EXISTS main.idx_usage_events_period;
DROP INDEX IF EXISTS main.idx_usage_events_tenant;

-- Drop tables in reverse order of creation (due to foreign key dependencies)
DROP TABLE IF EXISTS main.usage_summaries;
DROP TABLE IF EXISTS main.tenant_quotas;
DROP TABLE IF EXISTS main.usage_events;
