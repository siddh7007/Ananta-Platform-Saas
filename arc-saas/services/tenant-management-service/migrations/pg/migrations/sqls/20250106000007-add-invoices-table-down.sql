-- Drop indexes
DROP INDEX IF EXISTS main.idx_invoices_due_date;
DROP INDEX IF EXISTS main.idx_invoices_deleted;
DROP INDEX IF EXISTS main.idx_invoices_status;
DROP INDEX IF EXISTS main.idx_invoices_tenant_id;

-- Drop invoices table
DROP TABLE IF EXISTS main.invoices;
