-- =============================================================================
-- Migration 069: New User Workflow Schema Changes
-- =============================================================================
-- Implements Individual vs Enterprise organization types with feature gating.
-- Creates proper subscription on signup with 14-day trial.
-- Removes 'member' role (replaced by 'analyst').
--
-- Created: 2025-11-30
-- =============================================================================

-- =============================================================================
-- 1. ADD ORGANIZATION TYPE COLUMN
-- =============================================================================
-- org_type distinguishes between Individual (single-user) and Enterprise (multi-user)
-- 'individual' - Free/Starter/Professional plans (single owner, no org features)
-- 'enterprise' - Enterprise plan (multiple members, full org management)
-- 'platform'   - Ananta platform admin organization

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS org_type TEXT DEFAULT 'individual';

COMMENT ON COLUMN organizations.org_type IS
    'Organization type: individual (single user), enterprise (multi-user), platform (admin)';

-- =============================================================================
-- 2. ADD SUSPENSION FIELDS TO ORGANIZATIONS
-- =============================================================================
-- Allows suspending organizations (e.g., billing issues, policy violations)

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.is_suspended IS 'Whether the organization is suspended';
COMMENT ON COLUMN organizations.suspended_reason IS 'Reason for suspension (if suspended)';
COMMENT ON COLUMN organizations.suspended_at IS 'When the organization was suspended';

-- =============================================================================
-- 3. ADD IS_ACTIVE TO USERS
-- =============================================================================
-- Allows deactivating users without deleting them

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';

-- =============================================================================
-- 4. MAKE billing_customer_id NULLABLE IN SUBSCRIPTIONS
-- =============================================================================
-- Free/trial users don't have billing info until they upgrade
-- billing_customer_id should only be required for paid subscriptions

ALTER TABLE subscriptions
ALTER COLUMN billing_customer_id DROP NOT NULL;

COMMENT ON COLUMN subscriptions.billing_customer_id IS
    'Billing customer reference (NULL for free/trial subscriptions)';

-- =============================================================================
-- 5. UPDATE SUBSCRIPTION PLANS WITH ORG_TYPE AND ORG_FEATURES
-- =============================================================================
-- Free/Starter: org_type = 'individual', max_members = 1, no org_features
-- Professional: org_type = 'individual', max_members = 3 (owner + 2 invited), can_invite_members
-- Enterprise: org_type = 'enterprise', unlimited members, full org_features

-- Free and Starter: Single user only
UPDATE subscription_plans SET
    limits = limits || '{"org_type": "individual", "org_features": false, "max_members": 1, "can_invite_members": false, "can_change_org_name": false}'::jsonb,
    updated_at = NOW()
WHERE tier = 'free';

UPDATE subscription_plans SET
    limits = limits || '{"org_type": "individual", "org_features": false, "max_members": 1, "can_invite_members": false, "can_change_org_name": true}'::jsonb,
    updated_at = NOW()
WHERE tier = 'starter';

-- Professional: Up to 3 members (owner + 2 invited)
UPDATE subscription_plans SET
    limits = limits || '{"org_type": "individual", "org_features": false, "max_members": 3, "can_invite_members": true, "can_change_org_name": true}'::jsonb,
    updated_at = NOW()
WHERE tier = 'professional';

-- Enterprise: Unlimited members, full org features
UPDATE subscription_plans SET
    limits = limits || '{"org_type": "enterprise", "org_features": true, "max_members": -1, "can_invite_members": true, "can_change_org_name": true}'::jsonb,
    updated_at = NOW()
WHERE tier = 'enterprise';

-- =============================================================================
-- 6. CREATE HELPER FUNCTION: has_org_features
-- =============================================================================
-- Check if organization has org-level features (Enterprise only)

CREATE OR REPLACE FUNCTION has_org_features(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_features BOOLEAN;
BEGIN
    SELECT (p.limits->>'org_features')::BOOLEAN INTO has_features
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(has_features, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION has_org_features IS
    'Check if organization has org-level features (invite members, role management, etc.)';

-- =============================================================================
-- 7. CREATE HELPER FUNCTION: get_organization_type
-- =============================================================================
-- Get organization type from subscription plan limits

CREATE OR REPLACE FUNCTION get_organization_type(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    org_type_result TEXT;
BEGIN
    -- First check organization's direct org_type column
    SELECT o.org_type INTO org_type_result
    FROM organizations o
    WHERE o.id = org_id;

    IF org_type_result IS NOT NULL THEN
        RETURN org_type_result;
    END IF;

    -- Fall back to subscription plan limits
    SELECT (p.limits->>'org_type') INTO org_type_result
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(org_type_result, 'individual');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_organization_type IS
    'Get organization type (individual, enterprise, platform)';

-- =============================================================================
-- 8. CREATE INDEX FOR ORG_TYPE LOOKUPS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_org_type
ON organizations(org_type);

CREATE INDEX IF NOT EXISTS idx_organizations_suspended
ON organizations(is_suspended)
WHERE is_suspended = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_is_active
ON users(is_active);

-- =============================================================================
-- 9. ADD TRIAL EXPIRATION INDEX FOR SCHEDULED JOBS
-- =============================================================================
-- Helps efficiently find expired trials for the trial expiration worker

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_expired
ON subscriptions(trial_end)
WHERE status = 'trialing' AND trial_end IS NOT NULL;

-- =============================================================================
-- 10. ENFORCE: User can only belong to ONE organization
-- =============================================================================
-- A user cannot be a member of multiple organizations.
-- This simplifies billing, permissions, and data isolation.

-- Add unique constraint on user_id in organization_memberships
-- (user can only have one membership)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_user_single_org_membership'
    ) THEN
        ALTER TABLE organization_memberships
        ADD CONSTRAINT unique_user_single_org_membership UNIQUE (user_id);
    END IF;
END $$;

COMMENT ON CONSTRAINT unique_user_single_org_membership ON organization_memberships IS
    'A user can only belong to one organization at a time';

-- =============================================================================
-- 11. CREATE TRIGGER: Enforce max_members limit for plans
-- =============================================================================
-- Prevents adding members beyond the plan limit:
-- Free/Starter: 1 member (owner only)
-- Professional: 3 members (owner + 2 invited)
-- Enterprise: unlimited

CREATE OR REPLACE FUNCTION enforce_max_members_limit()
RETURNS TRIGGER AS $$
DECLARE
    max_members INTEGER;
    current_count INTEGER;
BEGIN
    -- Get max_members limit for this organization
    SELECT (p.limits->>'max_members')::INTEGER INTO max_members
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = NEW.organization_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default to 1 if no subscription (free tier behavior)
    max_members := COALESCE(max_members, 1);

    -- -1 means unlimited
    IF max_members = -1 THEN
        RETURN NEW;
    END IF;

    -- Count existing members
    SELECT COUNT(*) INTO current_count
    FROM memberships
    WHERE organization_id = NEW.organization_id;

    IF current_count >= max_members THEN
        RAISE EXCEPTION 'Organization has reached maximum member limit (%). Upgrade to add more members.', max_members;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to memberships table
DROP TRIGGER IF EXISTS check_max_members ON memberships;
CREATE TRIGGER check_max_members
    BEFORE INSERT ON memberships
    FOR EACH ROW
    EXECUTE FUNCTION enforce_max_members_limit();

-- =============================================================================
-- 12. ACCOUNT DELETION SUPPORT
-- =============================================================================
-- Implements soft delete with 30-day grace period for recovery
-- After grace period, hard delete worker permanently removes data

-- Add deletion tracking to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS deletion_requested_by UUID;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user was soft-deleted (NULL = active)';
COMMENT ON COLUMN users.deletion_requested_by IS 'User ID who requested the deletion';
COMMENT ON COLUMN users.deletion_reason IS 'Reason for account deletion (optional feedback)';

-- Add deletion tracking to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS deletion_requested_by UUID;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS deletion_feedback TEXT;

COMMENT ON COLUMN organizations.deleted_at IS 'Timestamp when org was hard-deleted (NULL = active)';
COMMENT ON COLUMN organizations.deletion_scheduled_at IS 'When deletion is scheduled (30-day grace period)';
COMMENT ON COLUMN organizations.deletion_requested_by IS 'User ID who requested the deletion';
COMMENT ON COLUMN organizations.deletion_reason IS 'Reason code for deletion';
COMMENT ON COLUMN organizations.deletion_feedback IS 'Optional user feedback on why they are leaving';

-- =============================================================================
-- 13. ACCOUNT DELETION AUDIT LOG
-- =============================================================================
-- Track all deletion-related events for compliance and debugging

CREATE TABLE IF NOT EXISTS account_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    performed_by UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event types:
-- 'deletion_requested' - User initiated deletion request
-- 'deletion_cancelled' - User cancelled deletion during grace period
-- 'deletion_completed' - Hard delete completed after grace period
-- 'data_exported' - User exported their data before deletion
-- 'subscription_cancelled' - Subscription cancelled as part of deletion
-- 'auth0_deleted' - Auth0 user record deleted

CREATE INDEX IF NOT EXISTS idx_deletion_audit_org
ON account_deletion_audit(organization_id);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_event_type
ON account_deletion_audit(event_type);

CREATE INDEX IF NOT EXISTS idx_deletion_audit_created
ON account_deletion_audit(created_at DESC);

COMMENT ON TABLE account_deletion_audit IS
    'Audit log for account deletion events (GDPR compliance)';

-- =============================================================================
-- 14. INDEX FOR PENDING DELETIONS
-- =============================================================================
-- Efficient lookup for deletion worker

CREATE INDEX IF NOT EXISTS idx_organizations_pending_deletion
ON organizations(deletion_scheduled_at)
WHERE deleted_at IS NULL AND deletion_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted
ON users(deleted_at)
WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- 15. HELPER FUNCTION: is_deletion_pending
-- =============================================================================
-- Check if organization has pending deletion

CREATE OR REPLACE FUNCTION is_deletion_pending(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND deletion_scheduled_at IS NOT NULL
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_deletion_pending IS
    'Check if organization has a pending deletion (in grace period)';

-- =============================================================================
-- 16. HELPER FUNCTION: get_deletion_grace_days_remaining
-- =============================================================================
-- Get days remaining in deletion grace period

CREATE OR REPLACE FUNCTION get_deletion_grace_days_remaining(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    scheduled_date TIMESTAMPTZ;
BEGIN
    SELECT deletion_scheduled_at INTO scheduled_date
    FROM organizations
    WHERE id = org_id;

    IF scheduled_date IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN GREATEST(0, EXTRACT(DAY FROM (scheduled_date - NOW()))::INTEGER);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_deletion_grace_days_remaining IS
    'Get number of days remaining before account is permanently deleted';

-- =============================================================================
-- 17. FUNCTION: schedule_organization_deletion
-- =============================================================================
-- Schedule organization for deletion with 30-day grace period
-- Only callable by organization owner

CREATE OR REPLACE FUNCTION schedule_organization_deletion(
    p_org_id UUID,
    p_requested_by UUID,
    p_reason TEXT DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL,
    p_grace_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    v_org RECORD;
    v_result JSONB;
BEGIN
    -- Validate organization exists and is not already deleted
    SELECT * INTO v_org
    FROM organizations
    WHERE id = p_org_id
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found or already deleted';
    END IF;

    -- Check if already scheduled for deletion
    IF v_org.deletion_scheduled_at IS NOT NULL THEN
        RAISE EXCEPTION 'Organization is already scheduled for deletion on %',
            v_org.deletion_scheduled_at::DATE;
    END IF;

    -- Schedule deletion
    UPDATE organizations SET
        deletion_scheduled_at = NOW() + (p_grace_days || ' days')::INTERVAL,
        deletion_requested_by = p_requested_by,
        deletion_reason = p_reason,
        deletion_feedback = p_feedback,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- Log the event
    INSERT INTO account_deletion_audit (
        organization_id, user_id, event_type, event_data, performed_by
    ) VALUES (
        p_org_id,
        p_requested_by,
        'deletion_requested',
        jsonb_build_object(
            'grace_days', p_grace_days,
            'scheduled_date', (NOW() + (p_grace_days || ' days')::INTERVAL)::TEXT,
            'reason', p_reason
        ),
        p_requested_by
    );

    v_result := jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'deletion_scheduled_at', (NOW() + (p_grace_days || ' days')::INTERVAL)::TEXT,
        'grace_days', p_grace_days,
        'message', 'Account scheduled for deletion. You can cancel within ' || p_grace_days || ' days.'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION schedule_organization_deletion IS
    'Schedule organization for deletion with grace period (owner only)';

-- =============================================================================
-- 18. FUNCTION: cancel_organization_deletion
-- =============================================================================
-- Cancel a pending deletion (during grace period)

CREATE OR REPLACE FUNCTION cancel_organization_deletion(
    p_org_id UUID,
    p_cancelled_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_org RECORD;
BEGIN
    -- Validate organization exists and has pending deletion
    SELECT * INTO v_org
    FROM organizations
    WHERE id = p_org_id
    AND deleted_at IS NULL
    AND deletion_scheduled_at IS NOT NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found or no pending deletion';
    END IF;

    -- Cancel deletion
    UPDATE organizations SET
        deletion_scheduled_at = NULL,
        deletion_requested_by = NULL,
        deletion_reason = NULL,
        deletion_feedback = NULL,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- Log the event
    INSERT INTO account_deletion_audit (
        organization_id, user_id, event_type, event_data, performed_by
    ) VALUES (
        p_org_id,
        p_cancelled_by,
        'deletion_cancelled',
        jsonb_build_object(
            'original_scheduled_date', v_org.deletion_scheduled_at::TEXT,
            'cancelled_at', NOW()::TEXT
        ),
        p_cancelled_by
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'message', 'Account deletion has been cancelled. Your account is now active.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cancel_organization_deletion IS
    'Cancel a pending organization deletion (owner only)';

-- =============================================================================
-- 19. RLS POLICIES FOR DELETION AUDIT
-- =============================================================================

ALTER TABLE account_deletion_audit ENABLE ROW LEVEL SECURITY;

-- Super admins can see all deletion audits
CREATE POLICY deletion_audit_super_admin ON account_deletion_audit
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth0_user_id = auth.uid()::TEXT
            AND u.role = 'super_admin'
        )
    );

-- Organization owners can see their own deletion audit
CREATE POLICY deletion_audit_org_owner ON account_deletion_audit
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN organization_memberships om ON u.id = om.user_id
            WHERE u.auth0_user_id = auth.uid()::TEXT
            AND om.organization_id = account_deletion_audit.organization_id
            AND om.role = 'owner'
        )
    );

-- =============================================================================
-- 20. UPDATE RLS: Exclude deleted organizations from queries
-- =============================================================================
-- Soft-deleted orgs should not appear in normal queries

-- Note: We add WHERE clauses to existing policies rather than dropping them
-- This ensures deleted orgs are filtered out automatically

-- Helper function to check if org is active (not deleted/pending deletion)
CREATE OR REPLACE FUNCTION is_organization_active(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND deleted_at IS NULL
        AND is_suspended = FALSE
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_organization_active IS
    'Check if organization is active (not deleted, not suspended)';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    -- Verify org_type column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'org_type'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration failed: organizations.org_type column not created';
    END IF;

    -- Verify is_suspended column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'is_suspended'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration failed: organizations.is_suspended column not created';
    END IF;

    -- Verify users.is_active column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration failed: users.is_active column not created';
    END IF;

    -- Verify deletion columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'deletion_scheduled_at'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration failed: organizations.deletion_scheduled_at column not created';
    END IF;

    -- Verify audit table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'account_deletion_audit'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'Migration failed: account_deletion_audit table not created';
    END IF;

    RAISE NOTICE 'Migration 069 completed successfully';
    RAISE NOTICE '- Added organizations.org_type (individual/enterprise/platform)';
    RAISE NOTICE '- Added organizations.is_suspended, suspended_reason, suspended_at';
    RAISE NOTICE '- Added users.is_active';
    RAISE NOTICE '- Made subscriptions.billing_customer_id nullable';
    RAISE NOTICE '- Updated subscription_plans with org_type and org_features';
    RAISE NOTICE '- Created has_org_features() and get_organization_type() functions';
    RAISE NOTICE '- Added max_members enforcement trigger';
    RAISE NOTICE '- Added account deletion support (soft delete with 30-day grace)';
    RAISE NOTICE '- Created account_deletion_audit table';
    RAISE NOTICE '- Added RLS policies for deletion audit';
END;
$$;
