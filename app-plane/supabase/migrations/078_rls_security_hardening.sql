-- Migration: 078_rls_security_hardening.sql
-- Description: Fix security gaps identified in RLS audit
--
-- Fixes:
-- 1. organization_memberships: Restrict writes to admins only (prevent privilege escalation)
-- 2. alerts: Split to user-scoped UPDATE/DELETE (prevent editing others' alerts)
-- 3. System insert policies: Restrict to service_role explicit pattern
-- 4. Add role mutation guardrails (prevent self-promotion, protect last owner)

BEGIN;

-- ============================================================================
-- HELPER FUNCTION: Check if user is org admin or owner IN CURRENT ORG
-- SECURITY FIX: Must scope to current_user_organization_id() to prevent
-- cross-org privilege escalation (admin in Org A shouldn't pass for Org B)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_org_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships om
        JOIN users u ON u.id = om.user_id
        WHERE (u.id = auth.uid() OR u.auth0_user_id = auth.uid()::text)
        AND om.organization_id = current_user_organization_id()  -- CRITICAL: Scope to current org
        AND om.role IN ('admin', 'owner', 'super_admin')
    )
$$;

-- ============================================================================
-- FIX 1: organization_memberships - Admin-only writes
-- Risk: Any org member could add themselves as admin/owner
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "organization_memberships_org_access" ON organization_memberships;

-- SELECT: Any org member can view memberships in their org
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

-- INSERT: Only admins/owners can add members
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
        -- Cannot insert with role higher than own role (super_admin can do anything)
        AND (role NOT IN ('owner', 'super_admin') OR is_super_admin())
    )
);

-- UPDATE: Only admins/owners can modify memberships
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (organization_id = current_user_organization_id() OR is_super_admin())
WITH CHECK (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
        -- Cannot promote to owner unless super_admin
        AND (role NOT IN ('owner', 'super_admin') OR is_super_admin())
        -- Cannot demote self (prevents lock-out)
        AND user_id != auth.uid()
    )
);

-- DELETE: Only admins/owners can remove members
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
        -- Cannot delete own membership
        AND user_id != auth.uid()
    )
);

-- ============================================================================
-- FIX 2: alerts - User-scoped UPDATE/DELETE
-- Risk: Any org user could edit/delete others' alerts
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "alerts_org_access" ON alerts;

-- SELECT: Org-scoped (users can see all alerts in their org)
CREATE POLICY "alerts_org_select" ON alerts FOR SELECT
USING (organization_id = current_user_organization_id() OR is_super_admin());

-- INSERT: Org-scoped (users can create alerts in their org)
CREATE POLICY "alerts_org_insert" ON alerts FOR INSERT
WITH CHECK (organization_id = current_user_organization_id() OR is_super_admin());

-- UPDATE: User-scoped (only alert owner or admin can update)
CREATE POLICY "alerts_user_update" ON alerts FOR UPDATE
USING (
    is_super_admin() OR
    user_id = auth.uid() OR
    (organization_id = current_user_organization_id() AND is_org_admin_or_owner())
)
WITH CHECK (
    is_super_admin() OR
    user_id = auth.uid() OR
    (organization_id = current_user_organization_id() AND is_org_admin_or_owner())
);

-- DELETE: User-scoped (only alert owner or admin can delete)
CREATE POLICY "alerts_user_delete" ON alerts FOR DELETE
USING (
    is_super_admin() OR
    user_id = auth.uid() OR
    (organization_id = current_user_organization_id() AND is_org_admin_or_owner())
);

-- ============================================================================
-- FIX 3: System insert policies - Restrict to explicit false check
-- The actual inserts happen via SECURITY DEFINER functions or service_role
-- ============================================================================

-- Drop the permissive policies
DROP POLICY IF EXISTS "onboarding_events_system_insert" ON onboarding_events;
DROP POLICY IF EXISTS "organization_settings_audit_system_insert" ON organization_settings_audit;

-- SECURITY FIX: Drop legacy policies from 070/071 to avoid duplicate/conflicting policies
DROP POLICY IF EXISTS "Admins can view org settings audit" ON organization_settings_audit;
DROP POLICY IF EXISTS "System can insert audit records" ON organization_settings_audit;
DROP POLICY IF EXISTS "Admins can view org onboarding events" ON onboarding_events;
DROP POLICY IF EXISTS "System can insert onboarding events" ON onboarding_events;

-- onboarding_events: No direct INSERT allowed via RLS
-- Inserts must go through service_role or SECURITY DEFINER function
CREATE POLICY "onboarding_events_no_direct_insert" ON onboarding_events FOR INSERT
WITH CHECK (false);

-- Add SELECT for users to see their own onboarding events
CREATE POLICY "onboarding_events_user_select" ON onboarding_events FOR SELECT
USING (user_id = auth.uid() OR is_super_admin());

-- organization_settings_audit: No direct INSERT allowed via RLS
-- Inserts happen via trigger (which uses SECURITY DEFINER)
CREATE POLICY "organization_settings_audit_no_direct_insert" ON organization_settings_audit FOR INSERT
WITH CHECK (false);

-- Add SELECT for org admins to view audit trail
CREATE POLICY "organization_settings_audit_admin_select" ON organization_settings_audit FOR SELECT
USING (
    is_super_admin() OR (
        organization_id = current_user_organization_id()
        AND is_org_admin_or_owner()
    )
);

-- ============================================================================
-- FIX 4: Add trigger to prevent removing last owner
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    owner_count INTEGER;
BEGIN
    -- Only check for DELETE or UPDATE that changes role from owner
    IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
        SELECT COUNT(*) INTO owner_count
        FROM organization_memberships
        WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND user_id != OLD.user_id;

        IF owner_count = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last owner of an organization';
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner' THEN
        SELECT COUNT(*) INTO owner_count
        FROM organization_memberships
        WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND user_id != OLD.user_id;

        IF owner_count = 0 THEN
            RAISE EXCEPTION 'Cannot demote the last owner of an organization';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_owner_removal_trigger ON organization_memberships;
CREATE TRIGGER prevent_last_owner_removal_trigger
    BEFORE DELETE OR UPDATE ON organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_owner_removal();

-- ============================================================================
-- SECURITY DEFINER function for system inserts (onboarding_events)
-- SECURITY FIX: Only callable by service_role (backend services)
-- This prevents authenticated users from inserting events for arbitrary orgs/users
-- ============================================================================

CREATE OR REPLACE FUNCTION insert_onboarding_event(
    p_user_id UUID,
    p_organization_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_id UUID;
    caller_role TEXT;
BEGIN
    -- SECURITY: Only allow service_role to call this function
    -- This prevents privilege escalation via arbitrary org/user insertion
    SELECT current_setting('role', true) INTO caller_role;

    IF caller_role != 'service_role' THEN
        RAISE EXCEPTION 'insert_onboarding_event can only be called by service_role';
    END IF;

    INSERT INTO onboarding_events (user_id, organization_id, event_type, event_data, created_at)
    VALUES (p_user_id, p_organization_id, p_event_type, p_event_data, NOW())
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- Only grant to service_role - NOT to authenticated users
REVOKE EXECUTE ON FUNCTION insert_onboarding_event FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION insert_onboarding_event FROM authenticated;
GRANT EXECUTE ON FUNCTION insert_onboarding_event TO service_role;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run manually)
-- ============================================================================
--
-- Test 1: Regular user cannot add themselves as admin
-- SET LOCAL role TO 'authenticated';
-- SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid", "email": "user@test.com"}';
-- INSERT INTO organization_memberships (user_id, organization_id, role)
--   VALUES ('user-uuid', 'org-uuid', 'admin');
-- Expected: DENIED
--
-- Test 2: Regular user cannot update others' alerts
-- UPDATE alerts SET status = 'dismissed' WHERE user_id != auth.uid();
-- Expected: 0 rows updated
--
-- Test 3: Direct insert to onboarding_events blocked
-- INSERT INTO onboarding_events (user_id, event_type) VALUES ('user-uuid', 'test');
-- Expected: DENIED
--
-- Test 4: Cannot remove last owner
-- DELETE FROM organization_memberships WHERE role = 'owner' AND organization_id = 'org-with-one-owner';
-- Expected: Error "Cannot remove the last owner"
