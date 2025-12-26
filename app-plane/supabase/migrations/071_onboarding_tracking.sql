-- Migration: Add onboarding tracking columns
-- Created: 2025-11-30
-- Purpose: Track welcome notifications and onboarding progress for users

-- =====================================================
-- Add welcome_sent_at to organization_memberships
-- =====================================================
ALTER TABLE organization_memberships
ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE organization_memberships
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN organization_memberships.welcome_sent_at IS 'When welcome notification was sent to this member';
COMMENT ON COLUMN organization_memberships.first_login_at IS 'When this member first logged in';

-- =====================================================
-- Add onboarding_completed to organizations
-- =====================================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{
    "first_bom_uploaded": false,
    "first_enrichment_complete": false,
    "team_member_invited": false,
    "alert_preferences_configured": false,
    "risk_thresholds_set": false
}'::jsonb;

COMMENT ON COLUMN organizations.onboarding_completed_at IS 'When organization completed all onboarding steps';
COMMENT ON COLUMN organizations.onboarding_checklist IS 'Tracks completion of onboarding checklist items';

-- =====================================================
-- Create onboarding_events table for audit
-- =====================================================
CREATE TABLE IF NOT EXISTS onboarding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Valid event types:
-- - user_welcome_sent
-- - trial_started
-- - trial_expiring_reminder
-- - organization_created
-- - member_invited
-- - member_joined
-- - onboarding_step_completed
-- - onboarding_completed

CREATE INDEX IF NOT EXISTS idx_onboarding_events_org
    ON onboarding_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user
    ON onboarding_events(user_id, created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

-- Admins can view onboarding events for their organization
CREATE POLICY "Admins can view org onboarding events"
    ON onboarding_events
    FOR SELECT
    TO authenticated
    USING (
        (organization_id = current_user_organization_id() AND is_org_admin())
        OR is_super_admin()
    );

-- System can insert events (via service role)
CREATE POLICY "System can insert onboarding events"
    ON onboarding_events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

COMMENT ON TABLE onboarding_events IS 'Audit trail for onboarding-related events';

-- =====================================================
-- Function to update onboarding checklist
-- =====================================================
CREATE OR REPLACE FUNCTION update_onboarding_checklist(
    p_org_id UUID,
    p_step TEXT,
    p_completed BOOLEAN DEFAULT true
) RETURNS BOOLEAN AS $$
DECLARE
    v_checklist JSONB;
    v_all_complete BOOLEAN;
BEGIN
    -- Update the specific step
    UPDATE organizations
    SET onboarding_checklist = jsonb_set(
        COALESCE(onboarding_checklist, '{}'::jsonb),
        ARRAY[p_step],
        to_jsonb(p_completed)
    )
    WHERE id = p_org_id
    RETURNING onboarding_checklist INTO v_checklist;

    -- Check if all steps are complete
    SELECT (
        COALESCE((v_checklist->>'first_bom_uploaded')::boolean, false)
        AND COALESCE((v_checklist->>'first_enrichment_complete')::boolean, false)
        AND COALESCE((v_checklist->>'team_member_invited')::boolean, false)
        AND COALESCE((v_checklist->>'alert_preferences_configured')::boolean, false)
        AND COALESCE((v_checklist->>'risk_thresholds_set')::boolean, false)
    ) INTO v_all_complete;

    -- If all complete and not already marked, set completion timestamp
    IF v_all_complete THEN
        UPDATE organizations
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
        WHERE id = p_org_id;
    END IF;

    RETURN v_all_complete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_onboarding_checklist IS 'Updates onboarding checklist and marks completion if all steps done';
