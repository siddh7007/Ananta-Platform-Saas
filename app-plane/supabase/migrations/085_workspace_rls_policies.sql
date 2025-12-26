-- Migration: 085_workspace_rls_policies.sql
-- Description: Add RLS policies for workspace tables
--
-- This migration:
-- 1. Enables RLS on workspace tables
-- 2. Adds policies based on workspace membership
-- 3. Updates project RLS to check workspace access
--
-- This is Phase 3: RLS Policy Updates

BEGIN;

-- ============================================================================
-- SECTION 1: Enable RLS on Workspace Tables
-- ============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- SECTION 2: Workspaces RLS Policies
-- ============================================================================

-- DROP existing policies if they exist
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON workspaces;

-- SELECT: Can see workspaces in orgs you belong to (not just workspaces you're a member of)
-- This allows users to see available workspaces they could potentially request access to
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        is_super_admin()
        OR organization_id IN (SELECT get_user_organization_ids())
    )
);

-- INSERT: Org owners/billing admins can create workspaces
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        organization_id IN (SELECT get_user_organization_ids())
        AND get_role_in_org(organization_id) IN ('owner', 'billing_admin', 'admin')
    )
);

-- UPDATE: Workspace admins can update their workspace
CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE
USING (
    is_super_admin()
    OR is_workspace_admin(id)
    OR get_role_in_org(organization_id) IN ('owner', 'billing_admin')
)
WITH CHECK (
    is_super_admin()
    OR is_workspace_admin(id)
    OR get_role_in_org(organization_id) IN ('owner', 'billing_admin')
);

-- DELETE: Only org owners and super admins can delete workspaces
CREATE POLICY "workspaces_delete" ON workspaces FOR DELETE
USING (
    is_super_admin()
    OR get_role_in_org(organization_id) = 'owner'
);


-- ============================================================================
-- SECTION 3: Workspace Memberships RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "workspace_memberships_select" ON workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_insert" ON workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_update" ON workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_delete" ON workspace_memberships;

-- SELECT: Can see memberships for workspaces in your org
CREATE POLICY "workspace_memberships_select" ON workspace_memberships FOR SELECT
USING (
    is_super_admin()
    OR workspace_id IN (SELECT get_user_workspace_ids())
    OR EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_memberships.workspace_id
        AND w.organization_id IN (SELECT get_user_organization_ids())
    )
);

-- INSERT: Workspace admins can add members
CREATE POLICY "workspace_memberships_insert" ON workspace_memberships FOR INSERT
WITH CHECK (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
    OR (
        -- Org admins can add members to any workspace in their org
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = workspace_id
            AND w.organization_id IN (SELECT get_user_organization_ids())
            AND get_role_in_org(w.organization_id) IN ('owner', 'billing_admin', 'admin')
        )
    )
);

-- UPDATE: Workspace admins can update member roles (not themselves)
CREATE POLICY "workspace_memberships_update" ON workspace_memberships FOR UPDATE
USING (
    is_super_admin()
    OR (
        is_workspace_admin(workspace_id)
        AND user_id != get_current_user_id()  -- Can't modify own role
    )
)
WITH CHECK (
    is_super_admin()
    OR (
        is_workspace_admin(workspace_id)
        AND user_id != get_current_user_id()
    )
);

-- DELETE: Workspace admins can remove members (not themselves if only admin)
-- Users can leave workspaces (remove own membership)
CREATE POLICY "workspace_memberships_delete" ON workspace_memberships FOR DELETE
USING (
    is_super_admin()
    OR (
        is_workspace_admin(workspace_id)
        AND user_id != get_current_user_id()
    )
    OR (
        -- Self-remove allowed
        user_id = get_current_user_id()
        AND role != 'admin'  -- Admins must transfer before leaving
    )
);


-- ============================================================================
-- SECTION 4: Workspace Invitations RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "workspace_invitations_select" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_insert" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_update" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_delete" ON workspace_invitations;

-- SELECT: Workspace admins + the invited user can see invitations
CREATE POLICY "workspace_invitations_select" ON workspace_invitations FOR SELECT
USING (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
    OR email = (SELECT email FROM users WHERE id = get_current_user_id())
);

-- INSERT: Workspace admins can create invitations
CREATE POLICY "workspace_invitations_insert" ON workspace_invitations FOR INSERT
WITH CHECK (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
);

-- UPDATE: Workspace admins can update (revoke) invitations
CREATE POLICY "workspace_invitations_update" ON workspace_invitations FOR UPDATE
USING (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
)
WITH CHECK (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
);

-- DELETE: Workspace admins can delete invitations
CREATE POLICY "workspace_invitations_delete" ON workspace_invitations FOR DELETE
USING (
    is_super_admin()
    OR is_workspace_admin(workspace_id)
);


-- ============================================================================
-- SECTION 5: Update Projects RLS to Use Workspace
-- ============================================================================

-- Note: We keep the old org-based policies as fallback during transition
-- These new policies add workspace-based access

DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- SELECT: Can see projects in workspaces you're a member of, OR in orgs you belong to (fallback)
CREATE POLICY "projects_select" ON projects FOR SELECT
USING (
    is_super_admin()
    OR workspace_id IN (SELECT get_user_workspace_ids())
    OR (
        -- Fallback: org-level access for projects without workspace_id
        workspace_id IS NULL
        AND organization_id IN (SELECT get_user_organization_ids())
    )
);

-- INSERT: Engineers+ in workspace can create projects
CREATE POLICY "projects_insert" ON projects FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        workspace_id IS NOT NULL
        AND workspace_id IN (SELECT get_user_workspace_ids())
        AND get_role_in_workspace(workspace_id) IN ('admin', 'engineer')
    )
    OR (
        -- Fallback: org-level access
        workspace_id IS NULL
        AND organization_id IN (SELECT get_user_organization_ids())
        AND get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
    )
);

-- UPDATE: Engineers+ in workspace can update projects
CREATE POLICY "projects_update" ON projects FOR UPDATE
USING (
    is_super_admin()
    OR (
        workspace_id IS NOT NULL
        AND get_role_in_workspace(workspace_id) IN ('admin', 'engineer')
    )
    OR (
        workspace_id IS NULL
        AND organization_id IN (SELECT get_user_organization_ids())
    )
)
WITH CHECK (
    is_super_admin()
    OR (
        workspace_id IS NOT NULL
        AND get_role_in_workspace(workspace_id) IN ('admin', 'engineer')
    )
    OR (
        workspace_id IS NULL
        AND get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
    )
);

-- DELETE: Only workspace admins can delete projects
CREATE POLICY "projects_delete" ON projects FOR DELETE
USING (
    is_super_admin()
    OR (
        workspace_id IS NOT NULL
        AND is_workspace_admin(workspace_id)
    )
    OR (
        workspace_id IS NULL
        AND is_admin_of(organization_id)
    )
);


-- ============================================================================
-- SECTION 6: Update BOMs RLS with Workspace Awareness
-- ============================================================================

-- BOMs access via project -> workspace chain
-- Keep org-based access as fallback

DROP POLICY IF EXISTS "boms_select" ON boms;
DROP POLICY IF EXISTS "boms_insert" ON boms;
DROP POLICY IF EXISTS "boms_update" ON boms;
DROP POLICY IF EXISTS "boms_delete" ON boms;

-- SELECT: Access via workspace membership or org membership
CREATE POLICY "boms_select" ON boms FOR SELECT
USING (
    is_super_admin()
    OR organization_id IN (SELECT get_user_organization_ids())
    OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = boms.project_id
        AND p.workspace_id IN (SELECT get_user_workspace_ids())
    )
);

-- INSERT: Engineers+ can create BOMs
CREATE POLICY "boms_insert" ON boms FOR INSERT
WITH CHECK (
    is_super_admin()
    OR (
        organization_id IN (SELECT get_user_organization_ids())
        AND (
            get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
            OR EXISTS (
                SELECT 1 FROM projects p
                WHERE p.id = project_id
                AND p.workspace_id IN (SELECT get_user_workspace_ids())
                AND get_role_in_workspace(p.workspace_id) IN ('admin', 'engineer')
            )
        )
    )
);

-- UPDATE: Engineers+ can update BOMs
CREATE POLICY "boms_update" ON boms FOR UPDATE
USING (
    is_super_admin()
    OR organization_id IN (SELECT get_user_organization_ids())
)
WITH CHECK (
    is_super_admin()
    OR (
        get_role_in_org(organization_id) IN ('owner', 'admin', 'engineer')
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND get_role_in_workspace(p.workspace_id) IN ('admin', 'engineer')
        )
    )
);

-- DELETE: Admins only
CREATE POLICY "boms_delete" ON boms FOR DELETE
USING (
    is_super_admin()
    OR is_admin_of(organization_id)
    OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = boms.project_id
        AND is_workspace_admin(p.workspace_id)
    )
);


-- ============================================================================
-- SECTION 7: Function for Workspace Invitation Acceptance
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_workspace_invitation(
    p_token TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    workspace_id UUID,
    workspace_name TEXT,
    organization_id UUID,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation RECORD;
    v_workspace RECORD;
BEGIN
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM workspace_invitations wi
    WHERE wi.token = p_token
    AND wi.accepted_at IS NULL
    AND wi.revoked_at IS NULL
    AND wi.expires_at > NOW();

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Get workspace info
    SELECT * INTO v_workspace
    FROM workspaces w
    WHERE w.id = v_invitation.workspace_id;

    -- Check user email matches invitation
    IF NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user_id
        AND LOWER(u.email) = LOWER(v_invitation.email)
    ) THEN
        RAISE EXCEPTION 'Invitation email does not match user';
    END IF;

    -- Add to org if not already a member
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_workspace.organization_id, p_user_id, 'member')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Add to workspace
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_invitation.workspace_id, p_user_id, v_invitation.role)
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = v_invitation.role, updated_at = NOW();

    -- Mark invitation as accepted
    UPDATE workspace_invitations
    SET accepted_at = NOW(), accepted_by = p_user_id
    WHERE id = v_invitation.id;

    -- Update user's last workspace
    INSERT INTO user_preferences (user_id, last_workspace_id)
    VALUES (p_user_id, v_invitation.workspace_id)
    ON CONFLICT (user_id)
    DO UPDATE SET last_workspace_id = v_invitation.workspace_id, updated_at = NOW();

    RETURN QUERY SELECT
        v_workspace.id,
        v_workspace.name,
        v_workspace.organization_id,
        v_invitation.role;
END;
$$;

COMMENT ON FUNCTION accept_workspace_invitation IS
    'Accepts a workspace invitation. Adds user to org (as member) and workspace (with invited role).';

GRANT EXECUTE ON FUNCTION accept_workspace_invitation(text, uuid) TO service_role;


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- RLS policies now support:
-- 1. Workspace-based access for projects and BOMs
-- 2. Org-based access as fallback for backward compatibility
-- 3. Role checks at workspace level
--
-- Access pattern:
--   User -> workspace_memberships -> workspaces -> projects -> BOMs
--   User -> organization_memberships -> organizations (fallback)
--
-- Next steps (API updates):
-- 1. Update auth_provisioning.py to create workspace on signup
-- 2. Add workspace CRUD endpoints
-- 3. Add X-Workspace-ID header handling in middleware
-- 4. Update frontend to support workspace switching
