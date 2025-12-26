-- Create payment_intents table for tracking payment attempts
CREATE TABLE IF NOT EXISTS main.payment_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES main.invoices(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_payment_method_id VARCHAR(255),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    status VARCHAR(50) NOT NULL DEFAULT 'requires_payment_method',
    client_secret VARCHAR(500),
    description TEXT,
    receipt_email VARCHAR(255),
    failure_code VARCHAR(100),
    failure_message TEXT,
    succeeded_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason VARCHAR(100),
    amount_received INTEGER,
    metadata JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_id ON main.payment_intents(tenant_id);

-- Create index on invoice_id
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice_id ON main.payment_intents(invoice_id);

-- Create index on stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_customer_id ON main.payment_intents(stripe_customer_id);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON main.payment_intents(status);

-- Create index on deleted
CREATE INDEX IF NOT EXISTS idx_payment_intents_deleted ON main.payment_intents(deleted);

-- Create index on succeeded_at for reporting
CREATE INDEX IF NOT EXISTS idx_payment_intents_succeeded_at ON main.payment_intents(succeeded_at);

-- Add comment
COMMENT ON TABLE main.payment_intents IS 'Tracks Stripe payment intents for invoice payments';
