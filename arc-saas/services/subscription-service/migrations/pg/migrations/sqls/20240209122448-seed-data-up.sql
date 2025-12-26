-- Starter Plan (Free tier - pooled infrastructure)
INSERT INTO main."plans"("name", created_on, created_by, description, price, currency_id, meta_data, billing_cycle_id, tier)
    VALUES ('Starter', CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Free starter plan with basic features', 0,(
            SELECT
                id
            FROM main.currencies
            WHERE
                currency_code = 'USD'), '{"maxUsers": 3, "features": ["basic"]}',(
            SELECT
                id
            FROM
                main.billing_cycles bb
            WHERE
                cycle_name = 'MONTHLY'), 'STARTER');

-- Pro Plan (Standard paid tier - pooled infrastructure)
INSERT INTO main."plans"("name", created_on, created_by, description, price, currency_id, meta_data, billing_cycle_id, tier)
    VALUES ('Pro', CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Professional plan with all features', 49,(
            SELECT
                id
            FROM main.currencies
            WHERE
                currency_code = 'USD'), '{"maxUsers": 25, "features": ["all", "priority_support", "custom_domain"]}',(
            SELECT
                id
            FROM
                main.billing_cycles bb
            WHERE
                cycle_name = 'MONTHLY'), 'PRO');

-- Enterprise Plan (Premium tier - silo/dedicated infrastructure)
INSERT INTO main."plans"("name", created_on, created_by, description, price, currency_id, meta_data, billing_cycle_id, tier)
    VALUES ('Enterprise', CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Enterprise plan with dedicated infrastructure', 299,(
            SELECT
                id
            FROM main.currencies
            WHERE
                currency_code = 'USD'), '{"maxUsers": -1, "features": ["all", "dedicated_infrastructure", "24x7_support", "sla_guarantee"]}',(
            SELECT
                id
            FROM
                main.billing_cycles bb
            WHERE
                cycle_name = 'MONTHLY'), 'ENTERPRISE');

-- Plan Items for Starter
INSERT INTO main.plan_items(created_on, created_by, "name", plan_item_type, plan_id, value)
    VALUES (CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Database', 'database',(
            SELECT
                id
            FROM
                main."plans" pl
            WHERE
                pl.name = 'Starter'), '{"name": "RDS_POSTGRES_STORAGE", "value": 10}');

-- Plan Items for Pro
INSERT INTO main.plan_items(created_on, created_by, "name", plan_item_type, plan_id, value)
    VALUES (CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Database', 'database',(
            SELECT
                id
            FROM
                main."plans" pl
            WHERE
                pl.name = 'Pro'), '{"name": "RDS_POSTGRES_STORAGE", "value": 50}');

-- Plan Items for Enterprise
INSERT INTO main.plan_items(created_on, created_by, "name", plan_item_type, plan_id, value)
    VALUES (CURRENT_TIMESTAMP, '123e4567-e89b-12d3-a456-426614174002', 'Database', 'database',(
            SELECT
                id
            FROM
                main."plans" pl
            WHERE
                pl.name = 'Enterprise'), '{"name": "RDS_POSTGRES_STORAGE", "value": 500}');
