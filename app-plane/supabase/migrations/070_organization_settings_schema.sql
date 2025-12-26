-- Migration: Add organization settings columns
-- Created: 2025-11-30
-- Purpose: Add fields for organization profile, security, and configuration settings

-- =====================================================
-- Organization Profile Fields
-- =====================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- =====================================================
-- Security Policy Fields
-- =====================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS require_mfa BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS password_policy TEXT DEFAULT 'strong';

-- =====================================================
-- API & Integration Fields
-- =====================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS api_access_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS webhooks_enabled BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- =====================================================
-- Data Retention Fields
-- =====================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 365;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS audit_log_retention_days INTEGER DEFAULT 90;

-- =====================================================
-- SSO Configuration Fields
-- =====================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_provider TEXT DEFAULT 'saml';
-- Note: SSO configuration details (IdP URL, certificates, etc.) would typically
-- be stored in a separate secure configuration or vault, not in the database

-- =====================================================
-- Add constraints for valid values
-- =====================================================
ALTER TABLE organizations ADD CONSTRAINT chk_password_policy
    CHECK (password_policy IN ('basic', 'strong', 'enterprise'));

ALTER TABLE organizations ADD CONSTRAINT chk_sso_provider
    CHECK (sso_provider IN ('saml', 'okta', 'azure', 'google'));

ALTER TABLE organizations ADD CONSTRAINT chk_session_timeout
    CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 480);

ALTER TABLE organizations ADD CONSTRAINT chk_data_retention
    CHECK (data_retention_days >= 30 AND data_retention_days <= 3650);

ALTER TABLE organizations ADD CONSTRAINT chk_audit_retention
    CHECK (audit_log_retention_days >= 30 AND audit_log_retention_days <= 365);

-- =====================================================
-- Create organization_settings_audit table for tracking changes
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_settings_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    setting_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_org_settings_audit_org
    ON organization_settings_audit(organization_id, changed_at DESC);

-- =====================================================
-- Function to check slug availability
-- =====================================================
CREATE OR REPLACE FUNCTION check_slug_availability(
    p_slug TEXT,
    p_exclude_org_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF p_exclude_org_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM organizations
            WHERE slug = p_slug
            AND id != p_exclude_org_id
            AND deleted_at IS NULL
        ) INTO v_exists;
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM organizations
            WHERE slug = p_slug
            AND deleted_at IS NULL
        ) INTO v_exists;
    END IF;

    RETURN NOT v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to update organization settings with audit
-- =====================================================
CREATE OR REPLACE FUNCTION update_organization_settings(
    p_org_id UUID,
    p_user_id UUID,
    p_settings JSONB
) RETURNS JSONB AS $$
DECLARE
    v_current RECORD;
    v_key TEXT;
    v_value TEXT;
    v_old_value TEXT;
BEGIN
    -- Get current organization
    SELECT * INTO v_current FROM organizations WHERE id = p_org_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    -- Update each setting and log changes
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_settings)
    LOOP
        -- Get old value
        EXECUTE format('SELECT %I::TEXT FROM organizations WHERE id = $1', v_key)
            INTO v_old_value USING p_org_id;

        -- Skip if value hasn't changed
        IF v_old_value IS DISTINCT FROM v_value THEN
            -- Update the column
            EXECUTE format('UPDATE organizations SET %I = $1 WHERE id = $2', v_key)
                USING v_value, p_org_id;

            -- Log the change
            INSERT INTO organization_settings_audit (
                organization_id, changed_by, setting_name, old_value, new_value
            ) VALUES (
                p_org_id, p_user_id, v_key, v_old_value, v_value
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS Policies for organization_settings_audit
-- =====================================================
ALTER TABLE organization_settings_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their organization
CREATE POLICY "Admins can view org settings audit"
    ON organization_settings_audit
    FOR SELECT
    TO authenticated
    USING (
        (organization_id = current_user_organization_id() AND is_org_admin())
        OR is_super_admin()
    );

-- Only system can insert audit records (via functions)
CREATE POLICY "System can insert audit records"
    ON organization_settings_audit
    FOR INSERT
    TO authenticated
    WITH CHECK (false);  -- Inserts only via SECURITY DEFINER functions

COMMENT ON TABLE organization_settings_audit IS 'Audit trail for organization settings changes';
COMMENT ON COLUMN organizations.require_mfa IS 'Whether MFA is required for all users';
COMMENT ON COLUMN organizations.session_timeout_minutes IS 'Session timeout in minutes (5-480)';
COMMENT ON COLUMN organizations.password_policy IS 'Password policy: basic, strong, enterprise';
COMMENT ON COLUMN organizations.api_access_enabled IS 'Whether API access is enabled for this org';
COMMENT ON COLUMN organizations.webhooks_enabled IS 'Whether webhooks are enabled';
COMMENT ON COLUMN organizations.data_retention_days IS 'Days to retain BOM and component data';
COMMENT ON COLUMN organizations.audit_log_retention_days IS 'Days to retain audit logs';
COMMENT ON COLUMN organizations.sso_enabled IS 'Whether SSO is enabled';
COMMENT ON COLUMN organizations.sso_provider IS 'SSO provider: saml, okta, azure, google';
