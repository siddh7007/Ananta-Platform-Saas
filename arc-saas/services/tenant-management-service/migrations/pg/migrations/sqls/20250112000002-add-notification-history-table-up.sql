-- Notification History table: tracks notification delivery for audit and analytics
CREATE TABLE IF NOT EXISTS main.notification_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES main.tenants(id) ON DELETE CASCADE,
    workflow_id VARCHAR(255) NOT NULL,
    workflow_name VARCHAR(255),
    subscriber_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    subject VARCHAR(500),
    payload JSONB,
    transaction_id VARCHAR(255),
    novu_message_id VARCHAR(255),
    attempts INTEGER DEFAULT 1,
    error_message TEXT,
    error_code VARCHAR(100),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    category VARCHAR(100),
    metadata JSONB,
    created_by UUID,
    modified_by UUID,
    created_on TIMESTAMPTZ DEFAULT NOW(),
    modified_on TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false,
    deleted_on TIMESTAMPTZ,
    deleted_by UUID,
    CONSTRAINT chk_notification_channel CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'webhook')),
    CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_history_tenant ON main.notification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_tenant_created ON main.notification_history(tenant_id, created_on DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_workflow ON main.notification_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON main.notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON main.notification_history(channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_history_transaction ON main.notification_history(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_history_novu_message ON main.notification_history(novu_message_id) WHERE novu_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_history_category ON main.notification_history(category) WHERE category IS NOT NULL;
