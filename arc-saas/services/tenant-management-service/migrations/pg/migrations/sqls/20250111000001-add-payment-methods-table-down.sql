-- Drop indexes
DROP INDEX IF EXISTS main.idx_payment_methods_tenant_id;
DROP INDEX IF EXISTS main.idx_payment_methods_stripe_customer_id;
DROP INDEX IF EXISTS main.idx_payment_methods_type;
DROP INDEX IF EXISTS main.idx_payment_methods_is_default;
DROP INDEX IF EXISTS main.idx_payment_methods_deleted;

-- Drop table
DROP TABLE IF EXISTS main.payment_methods;
