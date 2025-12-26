-- Drop plans table
DROP INDEX IF EXISTS main.idx_plans_sort_order;
DROP INDEX IF EXISTS main.idx_plans_is_active;
DROP INDEX IF EXISTS main.idx_plans_tier;
DROP TABLE IF EXISTS main.plans;
