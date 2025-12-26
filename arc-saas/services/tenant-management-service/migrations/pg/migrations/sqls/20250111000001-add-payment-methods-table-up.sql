-- Create payment_methods table for storing Stripe payment methods
CREATE TABLE IF NOT EXISTS main.payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    card_details JSONB,
    bank_account_details JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
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
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON main.payment_methods(tenant_id);

-- Create index on stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer_id ON main.payment_methods(stripe_customer_id);

-- Create index on type
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON main.payment_methods(type);

-- Create index on is_default
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON main.payment_methods(is_default);

-- Create index on deleted
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted ON main.payment_methods(deleted);

-- Add comment
COMMENT ON TABLE main.payment_methods IS 'Stores payment methods (cards, bank accounts) for tenant billing via Stripe';
