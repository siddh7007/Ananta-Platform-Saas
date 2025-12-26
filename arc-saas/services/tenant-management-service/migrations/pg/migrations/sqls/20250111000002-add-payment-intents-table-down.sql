-- Drop indexes
DROP INDEX IF EXISTS main.idx_payment_intents_tenant_id;
DROP INDEX IF EXISTS main.idx_payment_intents_invoice_id;
DROP INDEX IF EXISTS main.idx_payment_intents_stripe_customer_id;
DROP INDEX IF EXISTS main.idx_payment_intents_status;
DROP INDEX IF EXISTS main.idx_payment_intents_deleted;
DROP INDEX IF EXISTS main.idx_payment_intents_succeeded_at;

-- Drop table
DROP TABLE IF EXISTS main.payment_intents;
