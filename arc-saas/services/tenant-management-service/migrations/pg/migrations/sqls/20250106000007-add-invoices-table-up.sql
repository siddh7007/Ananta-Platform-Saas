-- Create invoices table
CREATE TABLE IF NOT EXISTS main.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES main.tenants(id) ON DELETE CASCADE NOT NULL,
    start_date VARCHAR(50) NOT NULL,
    end_date VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    invoice_file VARCHAR(500),
    due_date VARCHAR(50) NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_on TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    modified_by UUID
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON main.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON main.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON main.invoices(deleted);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON main.invoices(due_date);
