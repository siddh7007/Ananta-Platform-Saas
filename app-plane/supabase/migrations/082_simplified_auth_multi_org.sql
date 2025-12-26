-- Migration: 082_simplified_auth_multi_org.sql
-- Description: Simplified auth model with multi-org support
--
-- KEY CHANGES:
-- 1. Users can be in MULTIPLE organizations (no more single org per user)
-- 2. Lazy provisioning - user created on first API call, not during Auth0 login
-- 3. No synthetic org IDs - users explicitly create workspaces
-- 4. Simplified RLS - lookup by JWT sub → user → memberships
-- 5. No org_id in JWT - org selected via header/path
--
-- Auth0 Action becomes simple (no API calls):
--   Just set: sub, email, email_verified
--
-- RLS Pattern:
--   WHERE organization_id IN (
--     SELECT organization_id FROM organization_memberships
--     WHERE user_id = get_current_user_id()
--   )

BEGIN;

-- ============================================================================
-- SECTION 1: Core Helper Functions
-- ============================================================================

-- Function to get current user ID from JWT sub claim
-- This is the foundation of the new auth model
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users
  WHERE auth0_user_id = auth.jwt() ->> 'sub'
  LIMIT 1
$$;

COMMENT ON FUNCTION get_current_user_id() IS
'Returns the Supabase user UUID by looking up auth0_user_id from JWT sub claim. Returns NULL if user not provisioned yet.';

-- Function to get all organization IDs the current user is a member of
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_memberships
  WHERE user_id = get_current_user_id()
$$;

COMMENT ON FUNCTION get_user_organization_ids() IS
'Returns all organization UUIDs the current user is a member of. Used in RLS policies.';

-- Function to check if user is member of a specific org
CREATE OR REPLACE FUNCTION is_member_of(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = p_org_id
  )
$$;

COMMENT ON FUNCTION is_member_of(uuid) IS
'Returns true if current user is a member of the specified organization.';

-- Function to get user role in a specific org
CREATE OR REPLACE FUNCTION get_role_in_org(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM organization_memberships
  WHERE user_id = get_current_user_id()
  AND organization_id = p_org_id
  LIMIT 1
$$;

COMMENT ON FUNCTION get_role_in_org(uuid) IS
'Returns the user role in the specified organization (owner, admin, engineer, analyst, viewer).';

-- Function to check if user is admin/owner in a specific org
CREATE OR REPLACE FUNCTION is_admin_of(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = p_org_id
    AND role IN ('owner', 'admin')
  )
$$;

COMMENT ON FUNCTION is_admin_of(uuid) IS
'Returns true if current user is owner or admin of the specified organization.';

-- Update is_super_admin to use new pattern
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(auth.jwt() -> 'https://ananta.component.platform/roles', '[]'::jsonb)
    ) AS role
    WHERE role = 'platform:super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE auth0_user_id = auth.jwt() ->> 'sub'
    AND is_platform_admin = true
  )
$$;

COMMENT ON FUNCTION is_super_admin() IS
'Returns true if user has platform:super_admin role in JWT or is_platform_admin in users table.';


-- ============================================================================
-- SECTION 2: Schema Updates
-- ============================================================================

-- Add is_platform_admin flag to users (for super admins)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- Add user preferences table for tracking last used org
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  theme TEXT DEFAULT 'system',
  notifications_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'User-specific preferences including last active organization.';

-- ============================================================================
-- SECTION 2B: Indexes for RLS Performance
-- ============================================================================

-- Index for fast user lookup by auth0_user_id (used by get_current_user_id)
CREATE INDEX IF NOT EXISTS idx_users_auth0_user_id ON users(auth0_user_id);

-- Composite index for membership lookups (used by all RLS policies)
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON organization_memberships(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON organization_memberships(organization_id, user_id);

-- Index for role checks
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_role ON organization_memberships(user_id, role);

-- ============================================================================
-- SECTION 2C: Fix Organization Invitations Constraints
-- ============================================================================

-- Add unique constraint for ON CONFLICT support (org_id + email)
-- First drop if exists to make migration idempotent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_org_email_invitation'
    ) THEN
        ALTER TABLE organization_invitations
        ADD CONSTRAINT unique_org_email_invitation UNIQUE (organization_id, email);
    END IF;
END $$;

-- Update role constraint to use standardized roles
-- Standard roles: owner, admin, engineer, analyst, viewer
ALTER TABLE organization_invitations
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE organization_invitations
ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer'));
-- Note: 'owner' not allowed in invitations - only via org creation

-- Create trigger for user_preferences updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_preferences_timestamp ON user_preferences;
CREATE TRIGGER set_user_preferences_timestamp
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_timestamp();


-- ============================================================================
-- SECTION 3: Updated RLS Policies - Organizations
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;
DROP POLICY IF EXISTS "organizations_org_access" ON organizations;

-- New policies based on membership
CREATE POLICY "organizations_select" ON organizations FOR SELECT
USING (
  (deleted_at IS NULL OR is_super_admin())  -- Filter soft-deleted unless super admin
  AND (
    is_super_admin()
    OR id IN (SELECT get_user_organization_ids())
  )
);

CREATE POLICY "organizations_insert" ON organizations FOR INSERT
WITH CHECK (
  is_super_admin()
  OR get_current_user_id() IS NOT NULL  -- Any authenticated user can create org
);

CREATE POLICY "organizations_update" ON organizations FOR UPDATE
USING (
  is_super_admin()
  OR is_admin_of(id)
)
WITH CHECK (
  is_super_admin()
  OR is_admin_of(id)
);

CREATE POLICY "organizations_delete" ON organizations FOR DELETE
USING (
  is_super_admin()
  OR (
    is_admin_of(id)
    AND get_role_in_org(id) = 'owner'
  )
);


-- ============================================================================
-- SECTION 4: Updated RLS Policies - Organization Memberships
-- ============================================================================

DROP POLICY IF EXISTS "organization_memberships_select" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_update" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_delete" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_org_access" ON organization_memberships;

-- SELECT: Can see memberships for orgs you're in
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
);

-- INSERT: Admins can add members
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (
    is_admin_of(organization_id)
    AND role NOT IN ('owner')  -- Can't add new owners
  )
  OR (
    -- Self-insert when creating org (handled by API with SECURITY DEFINER)
    user_id = get_current_user_id()
    AND role = 'owner'
  )
);

-- UPDATE: Admins can update members (not themselves, not owners)
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
USING (
  is_super_admin()
  OR (
    is_admin_of(organization_id)
    AND user_id != get_current_user_id()  -- Can't modify own membership
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    is_admin_of(organization_id)
    AND role NOT IN ('owner')  -- Can't promote to owner
  )
);

-- DELETE: Admins can remove members (not owners, not themselves)
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
USING (
  is_super_admin()
  OR (
    is_admin_of(organization_id)
    AND user_id != get_current_user_id()
    AND role != 'owner'
  )
  OR (
    -- Users can leave orgs (remove own membership)
    user_id = get_current_user_id()
    AND role != 'owner'  -- Owners can't leave without transferring
  )
);


-- ============================================================================
-- SECTION 5: Updated RLS Policies - Users
-- ============================================================================

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_own_data" ON users;

-- SELECT: Can see users in your orgs + yourself
CREATE POLICY "users_select" ON users FOR SELECT
USING (
  is_super_admin()
  OR auth0_user_id = auth.jwt() ->> 'sub'  -- Own profile
  OR id IN (
    SELECT om2.user_id FROM organization_memberships om1
    JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = get_current_user_id()
  )
);

-- INSERT: Service role only (lazy provisioning via API)
CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (false);  -- Handled by SECURITY DEFINER function

-- UPDATE: Own profile only
CREATE POLICY "users_update" ON users FOR UPDATE
USING (
  is_super_admin()
  OR auth0_user_id = auth.jwt() ->> 'sub'
)
WITH CHECK (
  is_super_admin()
  OR auth0_user_id = auth.jwt() ->> 'sub'
);


-- ============================================================================
-- SECTION 6: Updated RLS Policies - Projects
-- ============================================================================

DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "projects_org_access" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
);

CREATE POLICY "projects_insert" ON projects FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (
    organization_id IN (SELECT get_user_organization_ids())
    AND get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
  )
);

CREATE POLICY "projects_update" ON projects FOR UPDATE
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
)
WITH CHECK (
  is_super_admin()
  OR get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
);

CREATE POLICY "projects_delete" ON projects FOR DELETE
USING (
  is_super_admin()
  OR is_admin_of(organization_id)
);


-- ============================================================================
-- SECTION 7: Updated RLS Policies - BOMs
-- ============================================================================

DROP POLICY IF EXISTS "boms_select" ON boms;
DROP POLICY IF EXISTS "boms_insert" ON boms;
DROP POLICY IF EXISTS "boms_update" ON boms;
DROP POLICY IF EXISTS "boms_delete" ON boms;
DROP POLICY IF EXISTS "boms_org_access" ON boms;

CREATE POLICY "boms_select" ON boms FOR SELECT
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
);

CREATE POLICY "boms_insert" ON boms FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (
    organization_id IN (SELECT get_user_organization_ids())
    AND get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
  )
);

CREATE POLICY "boms_update" ON boms FOR UPDATE
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
)
WITH CHECK (
  is_super_admin()
  OR get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
);

CREATE POLICY "boms_delete" ON boms FOR DELETE
USING (
  is_super_admin()
  OR is_admin_of(organization_id)
);


-- ============================================================================
-- SECTION 8: Updated RLS Policies - Alerts
-- ============================================================================

DROP POLICY IF EXISTS "alerts_org_select" ON alerts;
DROP POLICY IF EXISTS "alerts_org_insert" ON alerts;
DROP POLICY IF EXISTS "alerts_user_update" ON alerts;
DROP POLICY IF EXISTS "alerts_user_delete" ON alerts;

CREATE POLICY "alerts_select" ON alerts FOR SELECT
USING (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
);

CREATE POLICY "alerts_insert" ON alerts FOR INSERT
WITH CHECK (
  is_super_admin()
  OR organization_id IN (SELECT get_user_organization_ids())
);

CREATE POLICY "alerts_update" ON alerts FOR UPDATE
USING (
  is_super_admin()
  OR user_id = get_current_user_id()
  OR is_admin_of(organization_id)
)
WITH CHECK (
  is_super_admin()
  OR user_id = get_current_user_id()
  OR is_admin_of(organization_id)
);

CREATE POLICY "alerts_delete" ON alerts FOR DELETE
USING (
  is_super_admin()
  OR user_id = get_current_user_id()
  OR is_admin_of(organization_id)
);


-- ============================================================================
-- SECTION 9: User Preferences RLS
-- ============================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_own" ON user_preferences
FOR ALL USING (user_id = get_current_user_id())
WITH CHECK (user_id = get_current_user_id());


-- ============================================================================
-- SECTION 10: Organization Invitations RLS (from 081, updated)
-- ============================================================================

DROP POLICY IF EXISTS "organization_invitations_select" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete" ON organization_invitations;

CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
USING (
  is_super_admin()
  OR is_admin_of(organization_id)
  OR email = (SELECT email FROM users WHERE auth0_user_id = auth.jwt() ->> 'sub')
);

CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
WITH CHECK (
  is_super_admin()
  OR is_admin_of(organization_id)
);

CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
USING (
  is_super_admin()
  OR is_admin_of(organization_id)
)
WITH CHECK (
  is_super_admin()
  OR is_admin_of(organization_id)
);

CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
USING (
  is_super_admin()
  OR is_admin_of(organization_id)
);


-- ============================================================================
-- SECTION 11: SECURITY DEFINER Functions for Provisioning
-- ============================================================================

-- Function to provision a new user (called by API with service role)
CREATE OR REPLACE FUNCTION provision_user(
  p_auth0_user_id TEXT,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM users
  WHERE auth0_user_id = p_auth0_user_id;

  IF v_user_id IS NULL THEN
    -- Create new user
    INSERT INTO users (auth0_user_id, email, full_name)
    VALUES (p_auth0_user_id, p_email, COALESCE(p_name, split_part(p_email, '@', 1)))
    RETURNING id INTO v_user_id;

    v_is_new := true;
  ELSE
    -- Update existing user if needed
    UPDATE users
    SET
      email = COALESCE(p_email, email),
      full_name = COALESCE(p_name, full_name),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new;
END;
$$;

COMMENT ON FUNCTION provision_user IS
'Lazily provisions a user on first API call. Creates user if not exists, updates if exists.';


-- Function to create organization with owner
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT,
  p_user_id UUID,
  p_slug TEXT DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  organization_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  -- Generate slug if not provided
  v_slug := COALESCE(
    p_slug,
    LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8)
  );

  -- Create organization
  INSERT INTO organizations (name, slug, created_by)
  VALUES (p_name, v_slug, p_user_id)
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  -- Set as user's last active org
  INSERT INTO user_preferences (user_id, last_organization_id)
  VALUES (p_user_id, v_org_id)
  ON CONFLICT (user_id)
  DO UPDATE SET last_organization_id = v_org_id, updated_at = NOW();

  RETURN QUERY SELECT v_org_id, v_slug;
END;
$$;

COMMENT ON FUNCTION create_organization_with_owner IS
'Creates an organization and adds the specified user as owner.';


-- ============================================================================
-- SECTION 12: Backwards Compatibility
-- ============================================================================

-- Keep current_user_organization_id() working for now
-- It will use the request header or user preferences
CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_header_org TEXT;
BEGIN
  -- Try to get org from request header (X-Organization-ID)
  v_header_org := current_setting('request.headers', true)::json ->> 'x-organization-id';

  IF v_header_org IS NOT NULL THEN
    v_org_id := v_header_org::UUID;
    -- Verify user is member
    IF is_member_of(v_org_id) OR is_super_admin() THEN
      RETURN v_org_id;
    END IF;
  END IF;

  -- Fall back to user's last active org
  SELECT last_organization_id INTO v_org_id
  FROM user_preferences
  WHERE user_id = get_current_user_id();

  -- Verify membership
  IF v_org_id IS NOT NULL AND (is_member_of(v_org_id) OR is_super_admin()) THEN
    RETURN v_org_id;
  END IF;

  -- Last resort: return first org user is member of
  SELECT organization_id INTO v_org_id
  FROM organization_memberships
  WHERE user_id = get_current_user_id()
  ORDER BY created_at
  LIMIT 1;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION current_user_organization_id() IS
'Backwards-compatible function. Gets org from header, user prefs, or first membership.';

-- Keep current_user_role() working
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT get_role_in_org(current_user_organization_id())
$$;


-- ============================================================================
-- SECTION 13: Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_organization_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_member_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_role_in_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_admin_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION provision_user(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_organization_with_owner(text, uuid, text) TO service_role;

-- Revoke from anon
REVOKE EXECUTE ON FUNCTION get_current_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION get_user_organization_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION is_member_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_role_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin_of(uuid) FROM anon;


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- This migration introduces a new auth pattern:
--
-- OLD PATTERN (Migration 080):
--   JWT contains: org_id, roles
--   RLS: WHERE organization_id = current_user_organization_id()
--   Problem: Single org per user, synthetic org IDs
--
-- NEW PATTERN (This migration):
--   JWT contains: just sub, email
--   RLS: WHERE organization_id IN (SELECT get_user_organization_ids())
--   Benefit: Multi-org, no synthetic IDs, simpler Auth0 Action
--
-- Auth0 Action (simplified):
--   exports.onExecutePostLogin = async (event, api) => {
--     const ns = 'https://ananta.component.platform';
--     api.idToken.setCustomClaim(`${ns}/sub`, event.user.user_id);
--     api.idToken.setCustomClaim(`${ns}/email`, event.user.email);
--   };
--
-- API Endpoints needed:
--   GET  /api/users/me - Get current user (lazy provision if needed)
--   GET  /api/organizations/me - Get all user's orgs
--   POST /api/organizations - Create new org
--   POST /api/organizations/:id/invitations - Invite member
--   POST /api/invitations/:token/accept - Accept invitation
