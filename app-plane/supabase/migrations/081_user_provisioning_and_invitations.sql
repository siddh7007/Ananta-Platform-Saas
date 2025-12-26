-- Migration: 081_user_provisioning_and_invitations.sql
-- Description: Add organization_invitations table for member invitation flow
--
-- Purpose:
-- 1. Enable Professional plan users to invite team members
-- 2. Support accept-invite flow where users join existing orgs
-- 3. Track invitation status and expiration
--
-- Related: auth_provisioning.py API endpoints

BEGIN;

-- ============================================================================
-- SECTION 1: Organization Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Invitation details
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',  -- admin, engineer, analyst, viewer
    token TEXT NOT NULL UNIQUE,

    -- Tracking
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer'))
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_pending ON public.organization_invitations(organization_id)
    WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW();

COMMENT ON TABLE public.organization_invitations IS
    'Tracks member invitations to organizations. Used by Professional/Enterprise plans.';


-- ============================================================================
-- SECTION 2: RLS Policies for Invitations
-- ============================================================================

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: Admins can view invitations for their org
CREATE POLICY "organization_invitations_select" ON public.organization_invitations FOR SELECT
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin()
    )
);

-- INSERT: Admins can create invitations for their org
CREATE POLICY "organization_invitations_insert" ON public.organization_invitations FOR INSERT
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin()
    )
);

-- UPDATE: Admins can update (revoke) invitations
CREATE POLICY "organization_invitations_update" ON public.organization_invitations FOR UPDATE
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin()
    )
)
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin()
    )
);

-- DELETE: Admins can delete invitations
CREATE POLICY "organization_invitations_delete" ON public.organization_invitations FOR DELETE
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin()
    )
);


-- ============================================================================
-- SECTION 3: Helper Functions
-- ============================================================================

-- Function to create an invitation
CREATE OR REPLACE FUNCTION create_organization_invitation(
    p_organization_id UUID,
    p_email TEXT,
    p_role TEXT DEFAULT 'member',
    p_invited_by UUID DEFAULT NULL,
    p_expires_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    id UUID,
    token TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
    v_expires TIMESTAMPTZ;
    v_id UUID;
    v_max_users INTEGER;
    v_current_users INTEGER;
BEGIN
    -- Check organization member limit
    SELECT max_users INTO v_max_users
    FROM organizations WHERE id = p_organization_id;

    IF v_max_users IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_users
        FROM organization_memberships WHERE organization_id = p_organization_id;

        -- Count pending invitations too
        v_current_users := v_current_users + (
            SELECT COUNT(*) FROM organization_invitations
            WHERE organization_id = p_organization_id
            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > NOW()
        );

        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Organization has reached its member limit (% members)', v_max_users;
        END IF;
    END IF;

    -- Generate secure token
    v_token := encode(gen_random_bytes(32), 'hex');
    v_expires := NOW() + (p_expires_days || ' days')::INTERVAL;

    -- Insert invitation
    INSERT INTO organization_invitations (
        organization_id, email, role, token, invited_by, expires_at
    ) VALUES (
        p_organization_id, LOWER(p_email), p_role, v_token, p_invited_by, v_expires
    )
    RETURNING organization_invitations.id INTO v_id;

    RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;

COMMENT ON FUNCTION create_organization_invitation IS
    'Creates an organization invitation with secure token. Enforces member limits.';


-- Function to revoke an invitation
CREATE OR REPLACE FUNCTION revoke_organization_invitation(
    p_invitation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE organization_invitations
    SET revoked_at = NOW()
    WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION revoke_organization_invitation IS
    'Revokes a pending invitation.';


-- ============================================================================
-- SECTION 4: Add org_type column if missing (for plan enforcement)
-- ============================================================================

-- Ensure org_type column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'org_type'
    ) THEN
        ALTER TABLE organizations ADD COLUMN org_type TEXT DEFAULT 'individual';
    END IF;
END $$;

-- Add trial_ends_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMPTZ;
    END IF;
END $$;


-- ============================================================================
-- SECTION 5: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_organization_invitation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION revoke_organization_invitation TO authenticated, service_role;


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- API Endpoints (auth_provisioning.py):
--   POST /api/auth/provision-user - Create org + user on first login
--   GET  /api/auth/lookup-user/{auth0_id} - Check if user exists
--   POST /api/auth/accept-invite - Accept invitation, join org
--
-- Auth0 Post-Login Action:
--   1. Check if user exists (lookup-user)
--   2. If not, call provision-user
--   3. Store auth0_org_id in app_metadata
--   4. Set JWT claims (org_id, roles)
--
-- Invitation Flow:
--   1. Admin calls create_organization_invitation()
--   2. User receives email with invite link
--   3. User signs up/logs in via Auth0
--   4. Auth0 Action calls accept-invite
--   5. User joins org, personal org forfeited if empty
