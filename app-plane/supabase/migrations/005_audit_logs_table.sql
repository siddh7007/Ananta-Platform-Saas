-- ============================================================================
-- Audit Logs Table - Track All Platform Events
-- ============================================================================
-- Created: 2025-11-10
-- Purpose: Store comprehensive audit trail for compliance and security
-- Events: Authentication, user actions, admin operations, system events

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event metadata
    event_type VARCHAR(100) NOT NULL,                -- e.g., 'auth.user.login', 'customer.bom.uploaded'
    routing_key VARCHAR(100) NOT NULL,               -- RabbitMQ routing key
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- When event occurred

    -- Actor information (who performed the action)
    user_id VARCHAR(255),                            -- Supabase user UUID or 'cns-internal'
    username VARCHAR(255),                           -- Username for CNS dashboard users
    email VARCHAR(255),                              -- User email

    -- Technical details
    ip_address VARCHAR(50),                          -- IP address or 'browser'/'cns-dashboard'
    user_agent TEXT,                                 -- Browser user agent string
    source VARCHAR(50),                              -- Source system: 'customer-portal', 'cns-dashboard', 'backend'

    -- Event payload (full event data as JSON)
    event_data JSONB,                                -- Complete event payload

    -- Session tracking
    session_id VARCHAR(255),                         -- Session identifier (if available)

    -- Tenant context (for multi-tenancy)
    tenant_id UUID,                                  -- Organization/tenant ID (if applicable)

    -- Indexing timestamp for fast queries
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Fast Queries
-- ============================================================================

-- Index on event_type for filtering by event category
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type);

-- Index on user_id for user activity tracking
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Index on email for searching by user email
CREATE INDEX idx_audit_logs_email ON public.audit_logs(email);

-- Index on timestamp for time-based queries (most recent events)
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- Index on routing_key for RabbitMQ event filtering
CREATE INDEX idx_audit_logs_routing_key ON public.audit_logs(routing_key);

-- Index on tenant_id for multi-tenant filtering
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id) WHERE tenant_id IS NOT NULL;

-- Composite index for common query patterns (user + time range)
CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs(user_id, timestamp DESC);

-- GIN index on event_data JSONB for flexible querying
CREATE INDEX idx_audit_logs_event_data ON public.audit_logs USING GIN(event_data);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: super_admin can see all audit logs (cross-tenant)
CREATE POLICY audit_logs_super_admin_all
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users_v2
            WHERE users_v2.email = auth.jwt() ->> 'email'
            AND users_v2.role = 'super_admin'
        )
    );

-- Policy: admin can see logs for their tenant
CREATE POLICY audit_logs_admin_tenant
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users_v2
            WHERE users_v2.email = auth.jwt() ->> 'email'
            AND users_v2.role IN ('admin', 'super_admin')
        )
    );

-- Policy: Users can see their own audit logs
CREATE POLICY audit_logs_user_own
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        email = auth.jwt() ->> 'email'
        OR user_id = auth.uid()::text
    );

-- Policy: Service role can insert audit logs (for the audit logger service)
CREATE POLICY audit_logs_service_insert
    ON public.audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================================================
-- Useful Views
-- ============================================================================

-- View: Recent authentication events (last 24 hours)
CREATE OR REPLACE VIEW public.recent_auth_events AS
SELECT
    id,
    event_type,
    user_id,
    email,
    username,
    ip_address,
    source,
    timestamp,
    created_at
FROM public.audit_logs
WHERE event_type LIKE 'auth.%'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- View: User login history
CREATE OR REPLACE VIEW public.user_login_history AS
SELECT
    user_id,
    email,
    COUNT(*) FILTER (WHERE event_type LIKE '%.login') as login_count,
    COUNT(*) FILTER (WHERE event_type LIKE '%.logout') as logout_count,
    MAX(timestamp) FILTER (WHERE event_type LIKE '%.login') as last_login,
    MAX(timestamp) FILTER (WHERE event_type LIKE '%.logout') as last_logout,
    ARRAY_AGG(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as ip_addresses
FROM public.audit_logs
WHERE event_type LIKE 'auth.%'
GROUP BY user_id, email;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all platform events (auth, user actions, admin ops)';
COMMENT ON COLUMN public.audit_logs.event_type IS 'Type of event (e.g., auth.user.login, customer.bom.uploaded)';
COMMENT ON COLUMN public.audit_logs.routing_key IS 'RabbitMQ routing key that triggered this event';
COMMENT ON COLUMN public.audit_logs.event_data IS 'Full event payload as JSON for detailed analysis';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'Browser user agent string for device/browser tracking';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant SELECT to authenticated users (controlled by RLS policies)
GRANT SELECT ON public.audit_logs TO authenticated;

-- Grant INSERT to service role (for audit logger service)
GRANT INSERT ON public.audit_logs TO service_role;

-- Grant SELECT on views
GRANT SELECT ON public.recent_auth_events TO authenticated;
GRANT SELECT ON public.user_login_history TO authenticated;
