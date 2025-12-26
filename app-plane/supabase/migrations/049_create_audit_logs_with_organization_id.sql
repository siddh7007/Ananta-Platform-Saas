-- ============================================================================
-- Audit Logs Table - With organization_id (not tenant_id)
-- ============================================================================
-- Created: 2025-11-20
-- Purpose: Store comprehensive audit trail for compliance and security

CREATE TABLE IF NOT EXISTS public.audit_logs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event metadata
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Actor information
    user_id VARCHAR(255),
    username VARCHAR(255),
    email VARCHAR(255),

    -- Technical details
    ip_address VARCHAR(50),
    user_agent TEXT,
    source VARCHAR(50),

    -- Event payload
    event_data JSONB,

    -- Session tracking
    session_id VARCHAR(255),

    -- Multi-tenancy (using organization_id, NOT tenant_id)
    organization_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_email ON public.audit_logs(email);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_routing_key ON public.audit_logs(routing_key);
CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_event_data ON public.audit_logs USING GIN(event_data);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can see all logs
CREATE POLICY audit_logs_super_admin_all
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.users
            WHERE id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Service role has full access
CREATE POLICY audit_logs_service_role_all
    ON public.audit_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all platform events';
COMMENT ON COLUMN public.audit_logs.organization_id IS 'Organization ID (renamed from tenant_id for consistency)';
